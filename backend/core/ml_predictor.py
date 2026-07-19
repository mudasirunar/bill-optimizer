import os
import joblib
import json
import numpy as np
import pandas as pd
import tensorflow as tf

from config import MODELS_DIR, LSTM_FEATURES, ROUTINE_FACTORS
from core.firebase import db
from core.physics import safe_get, get_seasonal_ac_scale, encode_cyclical, compute_true_baseload

# ─────────────────────────────────────────
#  LOAD MODELS
# ─────────────────────────────────────────
rf_model    = joblib.load(os.path.join(MODELS_DIR, "rf_bill_predictor.pkl"))
bill_feats  = joblib.load(os.path.join(MODELS_DIR, "bill_features.pkl"))
lstm_model  = tf.keras.models.load_model(os.path.join(MODELS_DIR, "lstm_forecaster.keras"))
lstm_scaler = joblib.load(os.path.join(MODELS_DIR, "lstm_scaler.pkl"))
knn_model     = joblib.load(os.path.join(MODELS_DIR, "knn_archetype.pkl"))
knn_scaler    = joblib.load(os.path.join(MODELS_DIR, "knn_scaler.pkl"))
knn_house_ids = joblib.load(os.path.join(MODELS_DIR, "knn_house_ids.pkl"))
knn_features  = joblib.load(os.path.join(MODELS_DIR, "knn_features.pkl"))

with open(os.path.join(MODELS_DIR, "seasonal_coefficients.json")) as f:
    _raw = json.load(f)
    SEASONAL_COEFFICIENTS = {int(k): tuple(v) for k, v in _raw.items()}

# ─────────────────────────────────────────
#  KNN ARCHETYPE & LSTM SEEDS
# ─────────────────────────────────────────
def find_archetype_house(user_data: dict) -> str:
    try:
        feature_map = {
            'No_of_ACs':            safe_get(user_data, 'ac_qty'),
            'No_of_Refrigerators':  safe_get(user_data, 'f_qty'),
            'No_of_People':         safe_get(user_data, 'person_count', 4),
            'No_of_UPS':            safe_get(user_data, 'u_qty'),
            'No_of_Fans':           safe_get(user_data, 'fan_qty') or safe_get(user_data, 'person_count', 4) * 2,
            'No_of_WashingMachines': safe_get(user_data, 'wm_qty', 1),
        }
        user_vec    = np.array([[feature_map.get(f, 0) for f in knn_features]])
        user_scaled = knn_scaler.transform(user_vec)
        _, idxs     = knn_model.kneighbors(user_scaled)
        return knn_house_ids[idxs[0][0]]
    except Exception as e:
        print(f"[WARN] KNN failed: {e}")
        return "House1"

def _synthetic_seed(user_mean: float, current_month: int) -> np.ndarray:
    seed = np.zeros((48, len(LSTM_FEATURES)))
    ac_scale = get_seasonal_ac_scale(current_month)
    
    # Simple sinusoids mimicking domestic patterns in Pakistan
    for i in range(48):
        h = i % 24
        hs, hc = encode_cyclical(h, 24)
        ms, mc = encode_cyclical(current_month, 12)
        
        # Diurnal distribution peaks: afternoon AC (14:00) + evening baseline (20:00)
        peak = 0.4 + 0.5 * np.exp(-0.5 * ((h - 8) / 3)**2) + 0.4 * np.exp(-0.5 * ((h - 20) / 3)**2)
        use  = user_mean * peak
        seed[i] = [use, use * 0.4 * ac_scale, use * 0.05, hs, hc, 0.0, 1.0, ms, mc, 0.0]
    return seed

def get_lstm_seed(house_id: str, user_mean: float, month: int) -> np.ndarray:
    try:
        doc_id  = f"{house_id}_month_{month}"
        doc_ref = db.collection("lstm_seeds").document(doc_id).get()
 
        if not doc_ref.exists:
            raise ValueError(f"Seed document not found: {doc_id}")
 
        seed_data = doc_ref.to_dict()
        flat      = seed_data["data"]
        rows      = seed_data.get("rows", 48)
        cols      = seed_data.get("cols", len(LSTM_FEATURES))
        matrix    = np.array(flat, dtype=np.float32).reshape(rows, cols)
 
        if matrix.shape != (48, len(LSTM_FEATURES)):
            raise ValueError(f"Unexpected shape: {matrix.shape}")
 
        house_mean = matrix[:, 0].mean()
        if house_mean > 0:
            sf = user_mean / house_mean
            matrix[:, 0] *= sf
            matrix[:, 1] *= sf
            matrix[:, 2] *= sf
 
        ms, mc = encode_cyclical(month, 12)
        matrix[:, 7] = ms
        matrix[:, 8] = mc
 
        return matrix
 
    except Exception as e:
        print(f"[WARN] Firestore seed read failed ({house_id}, month {month}): {e}")
        print(f"[WARN] Falling back to synthetic seed")
        return _synthetic_seed(user_mean, month)

# ─────────────────────────────────────────
#  HYBRID ML BLENDING
# ─────────────────────────────────────────
def _get_calibration(u: dict) -> tuple:
    valid = [b for b in u.get('bill_history', [])
             if float(b.get('units', 0)) > 5 and b.get('month')]
    sorted_hist = sorted(valid, key=lambda x: x['month'])
 
    if not sorted_hist:
        return 1.0, 'none', 0
 
    factors = []
    for entry in sorted_hist[-6:]:
        try:
            h_month = int(entry['month'].split('-')[1])
            physics_h = compute_true_baseload(u, h_month)
            if physics_h['total'] > 5:
                f = float(entry['units']) / physics_h['total']
                f = max(0.50, min(2.00, f))
                factors.append(f)
        except:
            continue
 
    if not factors:
        return 1.0, 'none', 0
 
    weights = [np.exp(0.35 * i) for i in range(len(factors))]
    total_w = sum(weights)
    cal_factor = sum((w / total_w) * f for w, f in zip(weights, factors))
 
    n = len(sorted_hist)
    confidence = 'high' if n >= 6 else 'medium' if n >= 3 else 'low'
    return round(cal_factor, 4), confidence, n

def calculate_hybrid_units(u: dict, physics: dict, rf_kwh: float, month: int) -> float:
    physics_kwh = physics['total']
    cal_factor, confidence, n_months = _get_calibration(u)
 
    calibrated = physics_kwh * cal_factor
 
    RF_DAMP = {'none': 0.20, 'low': 0.12, 'medium': 0.08, 'high': 0.04}
    rf_offset = rf_kwh - physics_kwh
    rf_adj    = rf_offset * RF_DAMP[confidence]
    
    blended = calibrated + rf_adj
 
    routine = ROUTINE_FACTORS.get(u.get('user_routine', 'standard'), 1.00)
    final   = blended * routine
 
    return round(max(final, physics_kwh * 0.40), 2)

def get_blend_weights(u: dict, month: int) -> dict:
    _, confidence, n = _get_calibration(u)
    RF_DAMP = {'none': 0.20, 'low': 0.12, 'medium': 0.08, 'high': 0.04}
    rf_w    = RF_DAMP[confidence]
    hist_w  = {'none': 0.0, 'low': 0.30, 'medium': 0.45, 'high': 0.60}[confidence]
    phys_w  = round(1.0 - rf_w - hist_w, 2)
    return {"physics": phys_w, "rf": rf_w, "history": hist_w}
