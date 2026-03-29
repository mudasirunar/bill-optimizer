"""
=============================================================
  PRECON Flask API — v2 (Seasonal Intelligence Edition)
  FYP: AI-Powered Electricity Bill Optimization

  KEY CHANGES FROM v1:
  - Seasonal coefficient scaling at inference time
  - KNN-based archetype matching (replaces hardcoded map)
  - Recency-weighted history calibration
  - current_month injected into RF prediction
  - Better LSTM seed with proper feature construction

  Run from: bill-optimizer/backend/
  Usage: python app.py
=============================================================
"""

from flask import Flask, request, jsonify
from flask_cors import CORS
import joblib
import os
import json
import calendar
from datetime import datetime

import pandas as pd
import numpy as np
import tensorflow as tf
import firebase_admin
from firebase_admin import credentials, firestore

from utils.nepra_engine import NepraEngine

app = Flask(__name__)
CORS(app, resources={r"/*": {"origins": "*"}}, supports_credentials=True)
nepra = NepraEngine()

# ─────────────────────────────────────────
#  FIREBASE INITIALIZATION
# ─────────────────────────────────────────
cred = credentials.Certificate("serviceAccountKey.json")
firebase_admin.initialize_app(cred)
db = firestore.client()

# ─────────────────────────────────────────
#  LOAD ALL MODELS
# ─────────────────────────────────────────
MODELS_DIR = "../data/processed/models"

rf_model    = joblib.load(os.path.join(MODELS_DIR, "rf_bill_predictor.pkl"))
bill_feats  = joblib.load(os.path.join(MODELS_DIR, "bill_features.pkl"))
lstm_model  = tf.keras.models.load_model(os.path.join(MODELS_DIR, "lstm_forecaster.keras"))
lstm_scaler = joblib.load(os.path.join(MODELS_DIR, "lstm_scaler.pkl"))

# KNN Archetype Matcher
knn_model     = joblib.load(os.path.join(MODELS_DIR, "knn_archetype.pkl"))
knn_scaler    = joblib.load(os.path.join(MODELS_DIR, "knn_scaler.pkl"))
knn_house_ids = joblib.load(os.path.join(MODELS_DIR, "knn_house_ids.pkl"))
knn_features  = joblib.load(os.path.join(MODELS_DIR, "knn_features.pkl"))

# Seasonal Coefficient Table
with open(os.path.join(MODELS_DIR, "seasonal_coefficients.json")) as f:
    _raw_coeff = json.load(f)
    # JSON keys are strings — convert to int
    SEASONAL_COEFFICIENTS = {int(k): tuple(v) for k, v in _raw_coeff.items()}

# Load PRECON master hourly for LSTM seeding
MASTER_PATH = "../data/processed/master_hourly.csv"
_master_df  = None   # lazy-loaded on first LSTM request

def get_master_df():
    """Lazy-load master_hourly.csv — only pulled into memory when LSTM is called."""
    global _master_df
    if _master_df is None:
        print("[INFO] Loading master_hourly.csv for LSTM seeding...")
        _master_df = pd.read_csv(MASTER_PATH, parse_dates=["datetime"])
    return _master_df

def safe_get(data, key, default=0.0):
    """
    PREVENTS NoneType CRASHES.
    If DB value is null or missing, returns the provided default.
    """
    val = data.get(key)
    if val is None or val == "":
        return default
    try:
        return float(val)
    except:
        return default


# ─────────────────────────────────────────
#  SEASONAL UTILITIES
# ─────────────────────────────────────────

def get_current_month() -> int:
    """Returns current calendar month (1–12)."""
    return datetime.now().month

def get_seasonal_ac_scale(month: int) -> float:
    """AC usage scale factor for a given month. 1.0 = peak summer, 0.0 = deep winter."""
    return SEASONAL_COEFFICIENTS.get(month, (0.5, 0.5))[0]

def get_seasonal_fan_scale(month: int) -> float:
    """Fan/baseload scale factor for a given month."""
    return SEASONAL_COEFFICIENTS.get(month, (0.5, 0.5))[1]

def apply_seasonal_scaling(appliance_kwh: dict, month: int) -> dict:
    """
    Scale appliance kWh contributions by seasonal coefficients
    BEFORE feeding into the RF model.

    This is the core fix for "winter overestimation":
    - User reports "2 ACs, 8 hrs/day" → flat number in their profile
    - Without scaling: RF thinks you run AC at full capacity in January
    - With scaling: January → ac_monthly × 0.0 = 0.0 → correct

    Args:
        appliance_kwh: dict with keys matching bill_feats
        month: current calendar month (1-12)

    Returns:
        dict with season-adjusted values
    """
    ac_scale  = get_seasonal_ac_scale(month)

    adjusted = appliance_kwh.copy()
    adjusted['ac_monthly']         = appliance_kwh.get('ac_monthly', 0) * ac_scale
    # Refrigerator: runs 24/7, minor seasonal bump in summer (food preservation)
    adjusted['refrigerator_monthly'] = (
        appliance_kwh.get('refrigerator_monthly', 0) *
        (1.0 + 0.15 * ac_scale)   # up to 15% more work in summer heat
    )
    # Kitchen: slightly more use in winter (cooking to stay warm)
    adjusted['kitchen_monthly']    = (
        appliance_kwh.get('kitchen_monthly', 0) *
        (1.0 + 0.1 * (1 - ac_scale))
    )
    # UPS, WP: not strongly seasonal
    return adjusted


# ─────────────────────────────────────────
#  KNN ARCHETYPE MATCHER
# ─────────────────────────────────────────

def find_archetype_house(user_data: dict) -> str:
    """
    Find the PRECON house most structurally similar to the user's household.
    Returns the house_id (e.g. 'House7') to use as LSTM seed source.

    Matches on: AC count, fridge count, people, UPS, fans, washing machines.
    """
    try:
        # Build feature vector matching knn_features order
        feature_map = {
            'No_of_ACs':            float(user_data.get('ac_qty', 0)),
            'No_of_Refrigerators':  float(user_data.get('f_qty', 0)),
            'No_of_People':         float(user_data.get('person_count', 4)),
            'No_of_UPS':            float(user_data.get('u_qty', 0)),
            'No_of_Fans':           float(user_data.get('person_count', 4)) * 2,  # estimate
            'No_of_WashingMachines': 1.0,  # most households have one
        }
        user_vec = np.array([[feature_map.get(f, 0) for f in knn_features]])
        user_vec_scaled = knn_scaler.transform(user_vec)

        _, idxs = knn_model.kneighbors(user_vec_scaled)
        best_match = knn_house_ids[idxs[0][0]]
        print(f"[INFO] KNN archetype match: {best_match}")
        return best_match

    except Exception as e:
        print(f"[WARN] KNN matching failed ({e}), using House1 fallback")
        return "House1"


# ─────────────────────────────────────────
#  RECENCY-WEIGHTED HISTORY CALIBRATION
# ─────────────────────────────────────────

def compute_recency_weighted_avg(bill_history: list, decay: float = 0.35) -> float:
    """
    Compute a weighted average of historical monthly units where
    more recent months carry higher weight.

    decay=0.35 → each month back is worth ~70% of the month ahead of it.
    This means a lifestyle change (new AC, child moved out) is reflected
    within 2–3 months instead of being diluted by 12 months of old data.

    Args:
        bill_history: list of {'month': 'YYYY-MM', 'units': float}
        decay: exponential decay rate

    Returns:
        Weighted average monthly units
    """
    if not bill_history:
        return 0.0

    # Filter valid entries and sort chronologically
    valid = [b for b in bill_history
             if b.get('month') and b.get('units') is not None
             and float(b.get('units', 0)) > 0]

    if not valid:
        return 0.0

    sorted_bills = sorted(valid, key=lambda x: x.get('month', ''))
    n = len(sorted_bills)

    if n == 1:
        return float(sorted_bills[0].get('units', 0))

    # Exponential weights: index 0 = oldest, index n-1 = most recent
    weights = [np.exp(decay * i) for i in range(n)]
    total_w = sum(weights)

    weighted_avg = sum(
        (w / total_w) * float(b.get('units', 0))
        for w, b in zip(weights, sorted_bills)
    )
    return round(weighted_avg, 2)

def compute_usage_drift(bill_history: list) -> dict:
    """
    Detect if user's consumption is trending up or down.
    Returns drift info for UI display.
    """
    valid = [b for b in bill_history
             if b.get('month') and float(b.get('units', 0)) > 0]

    if len(valid) < 3:
        return {"trend": "insufficient_data", "change_pct": 0}

    sorted_bills = sorted(valid, key=lambda x: x['month'])
    recent_3  = np.mean([float(b['units']) for b in sorted_bills[-3:]])
    older_3   = np.mean([float(b['units']) for b in sorted_bills[:3]])

    if older_3 == 0:
        return {"trend": "insufficient_data", "change_pct": 0}

    change_pct = ((recent_3 - older_3) / older_3) * 100
    trend = "increasing" if change_pct > 5 else "decreasing" if change_pct < -5 else "stable"

    return {
        "trend": trend,
        "change_pct": round(change_pct, 1),
        "recent_avg": round(recent_3, 1),
        "older_avg": round(older_3, 1)
    }


# ─────────────────────────────────────────
#  LSTM SEED GENERATION
# ─────────────────────────────────────────

LSTM_FEATURES = [
    "usage_kw", "ac_kw", "refrigerator_kw",
    "hour_sin", "hour_cos",
    "day_of_week_sin", "day_of_week_cos",
    "month_sin", "month_cos",
    "is_weekend"
]

def encode_cyclical(val, max_val):
    """Return (sin, cos) cyclical encoding for a value."""
    angle = 2 * np.pi * val / max_val
    return np.sin(angle), np.cos(angle)

def get_lstm_seed(house_id: str, user_mean: float, current_month: int) -> np.ndarray:
    """
    Pull the last 48 hours of data from the matched PRECON house,
    scale to the user's consumption level, and encode seasonal features.

    Args:
        house_id: matched PRECON house (e.g. 'House7')
        user_mean: user's estimated mean hourly kW
        current_month: calendar month for seasonal feature injection

    Returns:
        numpy array of shape (48, 10) — ready for LSTM scaler
    """
    try:
        master = get_master_df()

        # Filter for the matched house
        house_data = master[master["house_id"] == house_id].copy()
        if len(house_data) < 48:
            raise ValueError(f"House {house_id} has only {len(house_data)} rows")

        house_data = house_data.sort_values("datetime")

        # Find 48 hours that match the current month for seasonal accuracy
        monthly_data = house_data[house_data["datetime"].dt.month == current_month]
        if len(monthly_data) >= 48:
            seed_48h = monthly_data.tail(48).copy()
        else:
            # Fall back to last 48h of any month
            seed_48h = house_data.tail(48).copy()

        # Scale the house's usage to match user's consumption level
        house_mean = seed_48h["usage_kw"].mean()
        if house_mean > 0:
            scale_factor = user_mean / house_mean
        else:
            scale_factor = 1.0

        seed_48h["usage_kw"]        = seed_48h["usage_kw"] * scale_factor
        seed_48h["ac_kw"]           = seed_48h["ac_kw"] * scale_factor
        seed_48h["refrigerator_kw"] = seed_48h["refrigerator_kw"] * scale_factor

        # Inject correct seasonal cyclical features for current month
        month_sin, month_cos = encode_cyclical(current_month, 12)
        seed_48h["month_sin"] = month_sin
        seed_48h["month_cos"] = month_cos

        # Build cyclical hour/day features if not present
        if "hour_sin" not in seed_48h.columns:
            seed_48h["hour_sin"], seed_48h["hour_cos"] = zip(
                *seed_48h["datetime"].dt.hour.apply(lambda h: encode_cyclical(h, 24))
            )
        if "day_of_week_sin" not in seed_48h.columns:
            seed_48h["day_of_week_sin"], seed_48h["day_of_week_cos"] = zip(
                *seed_48h["datetime"].dt.dayofweek.apply(lambda d: encode_cyclical(d, 7))
            )

        # Extract feature matrix
        available = [f for f in LSTM_FEATURES if f in seed_48h.columns]
        missing   = [f for f in LSTM_FEATURES if f not in seed_48h.columns]
        seed_matrix = seed_48h[available].fillna(0).values

        # Fill missing columns with zeros
        if missing:
            pad = np.zeros((48, len(missing)))
            seed_matrix = np.hstack([seed_matrix, pad])

        return seed_matrix[:, :len(LSTM_FEATURES)]  # ensure correct shape

    except Exception as e:
        print(f"[WARN] LSTM seed from master failed ({e}), using synthetic fallback")
        return _synthetic_seed(user_mean, current_month)


def _synthetic_seed(user_mean: float, current_month: int) -> np.ndarray:
    """
    Fallback: generate a plausible 48h consumption pattern when
    the master CSV lookup fails.
    """
    seed = np.zeros((48, len(LSTM_FEATURES)))
    ac_scale = get_seasonal_ac_scale(current_month)
    month_sin, month_cos = encode_cyclical(current_month, 12)

    for i in range(48):
        hour = i % 24
        is_weekend = 0
        hour_sin, hour_cos = encode_cyclical(hour, 24)

        # Diurnal pattern: low at night, peaks at 8AM and 8PM
        hour_factor = (
            0.4 + 0.5 * np.exp(-0.5 * ((hour - 8) / 3) ** 2) +
            0.4 * np.exp(-0.5 * ((hour - 20) / 3) ** 2)
        )
        usage = user_mean * hour_factor
        ac_usage = usage * 0.4 * ac_scale  # AC is ~40% of usage when in season

        seed[i] = [
            usage, ac_usage, usage * 0.05,   # usage, ac, fridge
            hour_sin, hour_cos,              # hour cyclical
            0.0, 1.0,                        # day_of_week (Monday)
            month_sin, month_cos,            # month cyclical
            float(is_weekend)
        ]
    return seed


# ─────────────────────────────────────────
#  ROUTES
# ─────────────────────────────────────────

@app.route('/api/setup_profile', methods=['POST'])
def setup_profile():
    try:
        data     = request.json
        uid      = data['uid']
        user_info = data['data']

        db.collection('users').document(uid).set(user_info, merge=True)
        return jsonify({"status": "success", "message": "Profile updated"}), 200

    except Exception as e:
        print(f"Flask Error: {e}")
        return jsonify({"error": str(e)}), 500


@app.route('/api/forecast_24h', methods=['POST'])
def forecast_24h():
    """
    Generate a 24-hour consumption forecast using the LSTM model.

    V2 Pipeline:
    1. Find best PRECON archetype via KNN
    2. Pull 48h seed from matched house (current month)
    3. Scale seed to user's consumption level
    4. Run LSTM inference
    5. Apply seasonal post-processing
    """
    try:
        uid      = request.json.get('uid')
        user_doc = db.collection('users').document(uid).get().to_dict()

        user_mean     = float(user_doc.get('mean_hourly', 0.5))
        current_month = get_current_month()

        # 1. Find best archetype via KNN
        archetype_house = find_archetype_house(user_doc)

        # 2. Get properly seeded 48h window
        seed_data = get_lstm_seed(archetype_house, user_mean, current_month)

        # 3. Scale with global scaler
        scaled_seed = lstm_scaler.transform(seed_data)
        input_seq   = np.reshape(scaled_seed, (1, 48, len(LSTM_FEATURES)))

        # 4. LSTM inference
        prediction = lstm_model.predict(input_seq, verbose=0)  # shape: (1, 24)

        # 5. Post-process: denormalize and apply seasonal ceiling
        ac_scale = get_seasonal_ac_scale(current_month)
        forecast_kw = []
        for i, v in enumerate(prediction[0]):
            hour = i % 24
            # Diurnal cap: forecast shouldn't exceed 3× mean
            raw_val = float(v) * user_mean * 2
            # Apply seasonal ceiling on AC-heavy hours (afternoon peak)
            if 13 <= hour <= 17 and ac_scale < 0.3:
                # Winter afternoon: suppress the AC-driven peak
                raw_val *= (0.3 + ac_scale)
            forecast_kw.append(max(0, round(raw_val, 4)))

        return jsonify({
            "status": "success",
            "archetype": archetype_house,
            "month": current_month,
            "ac_scale": ac_scale,
            "forecast": forecast_kw,
            "hours": list(range(24))
        })

    except Exception as e:
        print(f"LSTM Error: {e}")
        import traceback; traceback.print_exc()
        return jsonify({"error": str(e)}), 500


@app.route('/api/predict_bill', methods=['POST'])
def predict_user_bill():
    try:
        data = request.json
        uid  = data['uid']
        target_month = int(data.get('month', get_current_month()))

        user_doc = db.collection('users').document(uid).get()
        if not user_doc.exists:
            return jsonify({"error": "Profile not found"}), 404
        u = user_doc.to_dict()

        # ── STEP 1: Foundation Data Extraction ──
        sanc_load    = safe_get(u, 'sanctioned_load', 1.0)
        p_area       = safe_get(u, 'property_area', sanc_load * 600) 
        person_count = safe_get(u, 'person_count', 1.0)
        floors       = safe_get(u, 'floors', 1.0)
        routine      = u.get('user_routine', 'standard')

        # ── STEP 2: Inventory Awareness ──
        ac_qty = safe_get(u, 'ac_qty', 0.0)
        f_qty  = safe_get(u, 'f_qty', 0.0)
        u_qty  = safe_get(u, 'u_qty', 0.0)
        is_minimalist = (ac_qty == 0 and f_qty == 0)
        
        # Calibration Multiplier: Damping AI assumptions for empty houses
        appliance_intensity = 1.0 if not is_minimalist else 0.55

        appliance_kwh_raw = {
            'ac_monthly':           safe_get(u, 'ac_monthly'),
            'refrigerator_monthly': safe_get(u, 'refrigerator_monthly'),
            'kitchen_monthly':      safe_get(u, 'kitchen_monthly'),
            'ups_monthly':          safe_get(u, 'ups_monthly'),
            'wp_monthly':           safe_get(u, 'wp_monthly'),
            'weekend_usage':        safe_get(u, 'mean_hourly', 0.0833), 
        }

        # ── STEP 3: Seasonal Intelligence ──
        appliance_kwh = apply_seasonal_scaling(appliance_kwh_raw, target_month)
        ac_scale      = get_seasonal_ac_scale(target_month)
        fan_scale     = get_seasonal_fan_scale(target_month)
        month_name    = calendar.month_name[target_month]

        # ── STEP 4: Occupancy & Routine Heuristics ──
        # Tighter phantom load (5.0 base) to prevent 'Lifeline creep'
        phantom_kwh = person_count * (5.0 + 5.0 * fan_scale)
        routine_map = {"standard": 1.0, "morning_active": 1.05, "evening_active": 1.10, "all_day": 1.20}
        routine_factor = routine_map.get(routine, 1.0)

        # ── STEP 5: Ground-Truth Physics Anchor ──
        # Your input: 0.0833 kW * 24h * 30 days = ~60 kWh
        user_mean_load = appliance_kwh_raw['weekend_usage']
        physics_baseline_kwh = user_mean_load * 24 * 30

        # ── STEP 6: Intelligent RF Inference ──
        feature_vector = {feat: 0.0 for feat in bill_feats}
        feature_vector.update({
            'ac_monthly':           appliance_kwh['ac_monthly'],
            'kitchen_monthly':      appliance_kwh['kitchen_monthly'],
            'refrigerator_monthly': appliance_kwh['refrigerator_monthly'],
            'ups_monthly':          appliance_kwh['ups_monthly'],
            'wp_monthly':           appliance_kwh['wp_monthly'],
            'weekend_usage':        user_mean_load,
            'month_num':            float(target_month),
            'person_count':         person_count,
            'property_area':        p_area,
            'meta_ac_count':        ac_qty,
            'meta_fridge_count':    f_qty,
            'meta_ups_count':       u_qty,
            'floors':               floors
        })

        ai_pred_raw = float(rf_model.predict(pd.DataFrame([feature_vector]))[0])
        
        # THE ACCURACY MERGE: Blend AI Structural logic with Physics Ground Truth
        # If no appliances, we trust the Physics math 85% to avoid hallucinations
        if is_minimalist:
            ai_contribution = (ai_pred_raw * appliance_intensity)
            steered_kwh = (physics_baseline_kwh * 0.85) + (ai_contribution * 0.15)
            calibration_mode = "Physics-Anchored (Minimalist)"
        else:
            steered_kwh = (ai_pred_raw * 0.70) + (physics_baseline_kwh * 0.30)
            calibration_mode = "Appliance-Aware Context"

        # Apply heuristics to the blended result
        total_ai_kwh = (steered_kwh + phantom_kwh) * routine_factor

        # ── STEP 7: History Blending & Drift ──
        bill_history = u.get('bill_history', [])
        hist_avg     = compute_recency_weighted_avg(bill_history)
        drift_info   = compute_usage_drift(bill_history)

        if hist_avg > 0:
            ai_weight, hist_weight = (0.50, 0.50) if drift_info['trend'] != 'stable' else (0.65, 0.35)
            final_kwh = (total_ai_kwh * ai_weight) + (hist_avg * hist_weight)
            calibration_mode += f" | Hybrid ({drift_info['trend']})"
        else:
            final_kwh = total_ai_kwh

        # ── STEP 8: NEPRA Billing (Using the Overhauled Engine) ──
        cat = u.get('user_category', 'lifeline')
        bill_res = nepra.calculate_bill(units=final_kwh, load_kw=sanc_load, user_category=cat)

        # UI Response Formatting
        bill_res['engine_mode'] = calibration_mode
        bill_res['seasonal_context'] = {
            'month': month_name, 
            'ac_scale': round(ac_scale, 2),
            'fan_scale': round(fan_scale, 2)
        }
        bill_res['occupancy_phantom_kwh'] = round(phantom_kwh, 1)
        bill_res['drift'] = drift_info

        # Detailed Audit Trail Save
        db.collection('users').document(uid).collection('history').add({
            "timestamp":       firestore.SERVER_TIMESTAMP,
            "month_predicted": target_month,
            "kwh_predicted":   round(final_kwh, 2),
            "bill_estimate":   float(bill_res['total_bill']),
            "factors": {
                "people": person_count, "area": p_area, "routine": routine,
                "ac_qty": ac_qty, "f_qty": f_qty, "mean_hourly": user_mean_load,
                "calibration": calibration_mode, "is_minimalist": is_minimalist
            }
        })

        return jsonify({
            "status": "success", 
            "month": month_name, 
            "kwh": round(final_kwh, 2), 
            "bill": bill_res
        })

    except Exception as e:
        print(f"[CRITICAL] AI Inference Failure: {e}")
        import traceback; traceback.print_exc()
        return jsonify({"error": str(e)}), 500


@app.route('/api/seasonal_preview', methods=['POST'])
def seasonal_preview():
    """
    Returns a 12-month seasonal simulation.
    Fully synchronized with predict_bill v2.2 (Physics-Anchored Logic).
    """
    try:
        data = request.json
        uid = data.get('uid')
        
        user_doc = db.collection('users').document(uid).get()
        if not user_doc.exists:
            return jsonify({"error": "Profile not found"}), 404

        u = user_doc.to_dict()

        # ── STEP 1: Foundation Data Extraction ──
        sanc_load    = safe_get(u, 'sanctioned_load', 1.0)
        p_area       = safe_get(u, 'property_area', sanc_load * 600) 
        person_count = safe_get(u, 'person_count', 1.0)
        floors       = safe_get(u, 'floors', 1.0)
        routine      = u.get('user_routine', 'standard')
        cat          = u.get('user_category', 'non_protected')

        # ── STEP 2: Inventory & Intensity Logic (PredictBill Sync) ──
        ac_qty = safe_get(u, 'ac_qty', 0.0)
        f_qty  = safe_get(u, 'f_qty', 0.0)
        u_qty  = safe_get(u, 'u_qty', 0.0)
        
        is_minimalist = (ac_qty == 0 and f_qty == 0)
        appliance_intensity = 1.0 if not is_minimalist else 0.55

        appliance_kwh_raw = {
            'ac_monthly':           safe_get(u, 'ac_monthly'),
            'refrigerator_monthly': safe_get(u, 'refrigerator_monthly'),
            'kitchen_monthly':      safe_get(u, 'kitchen_monthly'),
            'ups_monthly':          safe_get(u, 'ups_monthly'),
            'wp_monthly':           safe_get(u, 'wp_monthly'),
            'weekend_usage':        safe_get(u, 'mean_hourly', 0.0833), 
        }

        # Routine Heuristics (PredictBill v2.2 Standards)
        routine_map = {"standard": 1.0, "morning_active": 1.05, "evening_active": 1.10, "all_day": 1.20}
        routine_factor = routine_map.get(routine, 1.0)

        monthly_preview = []

        # ── STEP 3: 12-Month Simulation Loop ──
        for m in range(1, 13):
            # A. Seasonal Scaling for the specific month
            scaled = apply_seasonal_scaling(appliance_kwh_raw, m)
            ac_scale = get_seasonal_ac_scale(m)
            fan_scale = get_seasonal_fan_scale(m)

            # B. Phantom Load (Synchronized 5.0 base)
            phantom_kwh = person_count * (5.0 + 5.0 * fan_scale)

            # C. Ground-Truth Physics Anchor (Consistent with PredictBill)
            # This represents the base-load behavior (mean_hourly * 720 hours)
            user_mean_load = appliance_kwh_raw['weekend_usage']
            physics_baseline_kwh = user_mean_load * 24 * 30

            # D. AI Feature Vector Construction
            feature_vector = {feat: 0.0 for feat in bill_feats}
            feature_vector.update({
                'ac_monthly':           scaled['ac_monthly'],
                'kitchen_monthly':      scaled['kitchen_monthly'],
                'refrigerator_monthly': scaled['refrigerator_monthly'],
                'ups_monthly':          scaled['ups_monthly'],
                'wp_monthly':           scaled['wp_monthly'],
                'weekend_usage':        user_mean_load,
                'month_num':            float(m),
                'person_count':         person_count,
                'property_area':        p_area,
                'meta_ac_count':        ac_qty,
                'meta_fridge_count':    f_qty,
                'meta_ups_count':       u_qty,
                'floors':               floors
            })

            # E. RF Inference
            ai_pred_raw = float(rf_model.predict(pd.DataFrame([feature_vector]))[0])

            # F. THE ACCURACY MERGE (The logic you specifically requested to sync)
            if is_minimalist:
                # Trust Physics math 85% for empty/low-appliance houses
                ai_contribution = (ai_pred_raw * appliance_intensity)
                steered_kwh = (physics_baseline_kwh * 0.85) + (ai_contribution * 0.15)
            else:
                # Standard blend for active houses
                steered_kwh = (ai_pred_raw * 0.70) + (physics_baseline_kwh * 0.30)

            # Apply final heuristics
            final_kwh = (steered_kwh + phantom_kwh) * routine_factor

            # G. NEPRA Calculation (Using the overhauled 2026 Engine)
            bill_res = nepra.calculate_bill(
                units=final_kwh, 
                load_kw=sanc_load, 
                user_category=cat
            )

            monthly_preview.append({
                "month": m,
                "month_name": calendar.month_abbr[m],
                "kwh": round(final_kwh, 1),
                "bill_pkr": float(bill_res['total_bill']),
                "ac_scale": round(ac_scale, 2),
                "is_peak": (m in [6, 7, 8, 9]) # Highlighting summer peak
            })

        # ── STEP 4: Aggregated Annual Metrics ──
        total_annual_kwh = sum(p['kwh'] for p in monthly_preview)
        total_annual_bill = sum(p['bill_pkr'] for p in monthly_preview)
        peak_month_data = max(monthly_preview, key=lambda x: x['kwh'])

        return jsonify({
            "status": "success",
            "monthly": monthly_preview,
            "summary": {
                "annual_kwh": round(total_annual_kwh, 1),
                "annual_bill": round(total_annual_bill, 0),
                "avg_monthly_bill": round(total_annual_bill / 12, 0),
                "peak_month": peak_month_data['month_name'],
                "peak_kwh": peak_month_data['kwh'],
                "is_minimalist_profile": is_minimalist
            }
        })

    except Exception as e:
        print(f"[CRITICAL] Seasonal Preview Error: {e}")
        import traceback; traceback.print_exc()
        return jsonify({"error": str(e)}), 500


if __name__ == '__main__':
    app.run(host='0.0.0.0', port=5000, debug=True)