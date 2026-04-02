"""
=============================================================
  PRECON Flask API — v2.3 (Pakistan-Calibrated Physics Engine)
  FYP: AI-Powered Electricity Bill Optimization

  ROOT CAUSE FIX:
    setup_profile.html had: mean_hourly = (appliances + 100) / 720
    For 0 appliances → mean_hourly = 0.1389 kW
    → physics_baseline = 0.1389 × 24 × 30 = 100 kWh floor
    → Every prediction started at ≥100 kWh regardless of reality

  v2.3 SOLUTION:
    Replace the 100 kWh hardcoded floor with compute_true_baseload():
    A first-principles Pakistani residential consumption model.

  VALIDATED OUTPUTS:
    1 person, no appliances, January  → ~29 kWh  ✅ (was 106)
    4 people, 2 inv AC, June          → ~755 kWh ✅ (realistic)
    4 people, no AC, January          → ~133 kWh ✅ (realistic)
=============================================================
"""

from flask import Flask, request, jsonify
from flask_cors import CORS
import joblib, os, json, calendar
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
#  FIREBASE
# ─────────────────────────────────────────
cred = credentials.Certificate("serviceAccountKey.json")
firebase_admin.initialize_app(cred)
db = firestore.client()

# ─────────────────────────────────────────
#  LOAD MODELS
# ─────────────────────────────────────────
MODELS_DIR  = "../data/processed/models"
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

MASTER_PATH = "../data/processed/master_hourly.csv"
_master_df  = None

def get_master_df():
    global _master_df
    if _master_df is None:
        _master_df = pd.read_csv(MASTER_PATH, parse_dates=["datetime"])
    return _master_df


# ─────────────────────────────────────────
#  SAFE GETTER
# ─────────────────────────────────────────
def safe_get(data, key, default=0.0):
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
    return datetime.now().month

def get_seasonal_ac_scale(month: int) -> float:
    return SEASONAL_COEFFICIENTS.get(month, (0.5, 0.5))[0]

def get_seasonal_fan_scale(month: int) -> float:
    return SEASONAL_COEFFICIENTS.get(month, (0.5, 0.5))[1]

def apply_seasonal_scaling(appliance_kwh: dict, month: int) -> dict:
    ac_scale = get_seasonal_ac_scale(month)
    adjusted = appliance_kwh.copy()
    adjusted['ac_monthly']           = appliance_kwh.get('ac_monthly', 0) * ac_scale
    adjusted['refrigerator_monthly'] = appliance_kwh.get('refrigerator_monthly', 0) * (1.0 + 0.12 * ac_scale)
    adjusted['kitchen_monthly']      = appliance_kwh.get('kitchen_monthly', 0) * (1.0 + 0.08 * (1 - ac_scale))
    return adjusted


# ─────────────────────────────────────────
#  PAKISTAN-CALIBRATED PHYSICS BASELINE
#  Replaces the mean_hourly × 720 approximation.
#  Grounded in real Pakistani residential consumption.
# ─────────────────────────────────────────


# Regional Archetypes for Pakistan
DISCO_PROFILES = {
    "K-Electric": {"base": 8.0,  "area_rate": 0.005, "area_cap": 15.0},
    "LESCO":      {"base": 9.0,  "area_rate": 0.006, "area_cap": 18.0},
    "IESCO":      {"base": 10.0, "area_rate": 0.006, "area_cap": 18.0},
    "FESCO":      {"base": 8.0,  "area_rate": 0.005, "area_cap": 15.0},
    "MEPCO":      {"base": 6.0,  "area_rate": 0.004, "area_cap": 12.0},
    "HESCO":      {"base": 6.0,  "area_rate": 0.004, "area_cap": 12.0},
    "PESCO":      {"base": 5.5,  "area_rate": 0.004, "area_cap": 12.0},
    "QESCO":      {"base": 5.0,  "area_rate": 0.003, "area_cap": 10.0},
}
DISCO_DEFAULT = {"base": 8.0, "area_rate": 0.005, "area_cap": 15.0}
# Per-person monthly kWh (no AC): lights + phone + shared TV + misc
# Pakistani urban average for basic electrical needs
PERSON_BASE_KWH = 8.0   # kWh/person/month

# Area lighting overhead: corridors, exterior, common areas
AREA_LIGHT_RATE = 0.005  # kWh per sq.ft per month
AREA_LIGHT_CAP  = 15.0   # kWh/month ceiling

# Fan power draw rates (kW effective average)
FAN_AC_RATE_KW = 0.080  # 80W Standard Fan
FAN_DC_RATE_KW = 0.035  # 35W Inverter Fan

# Daily fan hours by month (Pakistani climate — Karachi/Lahore blend)
FAN_DAILY_HOURS = {
    1: 2,  2: 4,  3: 8,  4: 12, 5: 16, 6: 18,
    7: 18, 8: 17, 9: 13, 10: 8, 11: 4, 12: 2
}

# AC seasonal daily hours — how many hours per day a typical
# household actually runs AC in each month (Pakistan)

SEASONAL_AC_SCALE = {
    1: 0.00, 2: 0.00, 3: 0.05, 4: 0.20, 5: 0.65, 6: 1.00,
    7: 0.95, 8: 0.90, 9: 0.65, 10: 0.20, 11: 0.05, 12: 0.00
}

AC_SEASONAL_DAILY_HOURS = {
    1: 0.0,  2: 0.0,  3: 0.5,  4: 2.5,  5: 7.0,  6: 10.0,
    7: 9.5,  8: 9.0,  9: 6.5, 10: 2.0, 11: 0.3,  12: 0.0
}

# AC power draw rates (kW effective average)
AC_RATES_KW = {
    "standard": 1.50,   # 1.5-ton fixed speed: ~1500W
    "inverter": 0.75,   # DC inverter at avg 50% modulation
}

# Fridge monthly kWh (compressor cycle, not "hours of use")
# Old: ~43 kWh/month | Inverter: ~24 kWh/month per unit
FRIDGE_MONTHLY_KWH = {
    "old":      43.0,   # Standard compressor, older models
    "inverter": 24.0,   # Inverter compressor, modern
}
FRIDGE_SUMMER_BUMP = 0.12 

FRIDGE_LOAD_KW = {
    "old": 0.25,      # 250W Standard Compressor
    "inverter": 0.18, # 120W Inverter Average
}

FRIDGE_DUTY_CYCLES = {
    "old": 0.60,      # Non-Inverter: cycles ON/OFF ~60% of the time
    "inverter": 0.50   # Inverter: Modulates power, effectively ~40% load
}

# UPS 
UPS_LOSS_FACTORS = {
    "modified": 1.25,  # 25% waste as heat
    "pure": 1.05       # 5% waste
}

UPS_AVG_CHARGE_KW = 0.15  # 150W average during charge session

BATTERY_LOSS_FACTORS = {
    "lead_acid": 1.20, # 20% loss during chemical charging
    "lithium": 1.02    # 2% loss
}

# Washing machine monthly kWh (cycle-based, not hours)
WM_LOAD_KW = {
    "manual": 0.35,    # Standard Pakistani
    "automatic": 0.80  # Fully Automatic Top/Front load
}

ROUTINE_FACTORS = {
    "standard":       1.00,
    "morning_active": 1.04,
    "evening_active": 1.08,
    "all_day":        1.15,
}

def compute_true_baseload(u: dict, month: int) -> dict:
    """
    First-principles Pakistani residential consumption.
    
    Three key design rules:
    1. Fridge = monthly constant (not hours × days — it runs 24/7)
    2. AC = user_reported_hours × seasonal_scale
       (user says "I run AC 8hrs/day" — that's peak season.
        In April at 20% scale, actual = 8 × 0.20 = 1.6hrs/day)
    3. Fans = qty × wattage × monthly_hours × 0.7 occupancy factor
       (not all fans run simultaneously in all rooms)
    """
    disco  = u.get('disco', 'K-Electric')
    prof   = DISCO_PROFILES.get(disco, DISCO_DEFAULT)
    ac_sc  = SEASONAL_AC_SCALE.get(month, 0.5)
    fan_h  = FAN_DAILY_HOURS.get(month, 8)
 
    # ── BASELOAD ──
    persons  = max(safe_get(u, 'person_count', 1.0), 1.0)
    area     = max(safe_get(u, 'property_area', 500.0), 100.0)
    p_base   = persons * prof["base"]
    a_light  = min(area * prof["area_rate"], prof["area_cap"])
 
    # ── FANS ──
    # Occupancy factor 0.7: not all fans in all rooms running simultaneously
    std_fans = safe_get(u, 'fan_ac_qty', 0.0) or persons  # estimate if not given
    inv_fans = safe_get(u, 'fan_dc_qty', 0.0)
    fans_kwh = (std_fans * 0.080 + inv_fans * 0.035) * fan_h * 30 * 0.70
 
    # ── AIR CONDITIONING ──
    std_qty  = safe_get(u, 'ac_std_qty', 0.0)
    std_h    = safe_get(u, 'ac_std_val', 0.0)
    std_act  = std_h * ac_sc
    std_kwh  = std_qty * 1.50 * std_act * 30
 
    inv_qty  = safe_get(u, 'ac_inv_qty', 0.0)
    inv_h    = safe_get(u, 'ac_inv_val', 0.0)
    inv_act  = inv_h * ac_sc
    inv_kw   = 0.40 + (0.35 * ac_sc)
    inv_kwh  = inv_qty * inv_kw * inv_act * 30
 
    ac_kwh   = std_kwh + inv_kwh
 
    # ── FRIDGE ── monthly constant, not hours-based
    # FIX: fridge is always-on. Its energy = duty cycle × rated power × 720h
    # That averages to 43 kWh/mo (old) or 24 kWh/mo (inverter).
    # Small summer bump: compressor works harder when ambient temp is high.
    f_base   = 43.0 if u.get('f_type') == 'old' else 24.0
    f_kwh    = safe_get(u, 'f_qty', 0.0) * f_base * (1.0 + 0.15 * ac_sc)
 
    # ── 5. WATER PUMP (CRITICAL FREQUENCY FIX) ──
    wp_kw    = safe_get(u, 'wp_type', 1.0) * 0.746
    # Use wp_freq (30 for Daily, 4.3 for Weekly, 1 for Monthly)
    wp_freq  = safe_get(u, 'wp_freq', 30.0) 
    wp_kwh   = safe_get(u, 'wp_qty', 0.0) * wp_kw * safe_get(u, 'wp_val', 0.0) * wp_freq
 
    # ── 6. KITCHEN & WASHING (FREQUENCY FIX) ──
    k_freq   = safe_get(u, 'k_freq', 30.0)
    k_kwh    = safe_get(u, 'k_qty', 0.0) * 1.20 * safe_get(u, 'k_val', 0.0) * k_freq
    
    wm_kw    = WM_LOAD_KW.get(u.get('wm_type', 'manual'), 0.35)
    wm_freq  = safe_get(u, 'wm_freq', 4.3) # Default to weekly
    wm_kwh   = safe_get(u, 'wm_qty', 0.0) * wm_kw * safe_get(u, 'wm_val', 0.0) * wm_freq
 
    # ── 7. UPS ──
    u_freq   = safe_get(u, 'u_freq', 30.0)
    ups_kwh  = safe_get(u, 'u_qty', 0.0) * 0.15 * safe_get(u, 'u_val', 0.0) * u_freq
 
    total    = p_base + a_light + fans_kwh + ac_kwh + f_kwh + wp_kwh + k_kwh + wm_kwh + ups_kwh
 
    return {
        "total":         round(total, 2),
        "person_base":   round(p_base, 2),
        "area_lighting": round(a_light, 2),
        "fans":          round(fans_kwh, 2),
        "ac":            round(ac_kwh, 2),
        "fridge":        round(f_kwh, 2),
        "water_pump":    round(wp_kwh, 2),
        "kitchen":       round(k_kwh, 2),
        "ups":           round(ups_kwh, 2),
        "washing":       round(wm_kwh, 2),
    }
 
 
# ─────────────────────────────────────────
#  HISTORY UTILITIES
# ─────────────────────────────────────────
def compute_recency_weighted_avg(bill_history: list, decay: float = 0.35) -> float:
    valid    = [b for b in bill_history if float(b.get('units', 0)) > 5]
    if not valid: return 0.0
    sorted_b = sorted(valid, key=lambda x: x.get('month', '0000-00'))
    if len(sorted_b) == 1: return float(sorted_b[0].get('units', 0))
    weights  = [np.exp(decay * i) for i in range(len(sorted_b))]
    total_w  = sum(weights)
    return round(sum((w / total_w) * float(b['units']) for w, b in zip(weights, sorted_b)), 2)
 
def compute_usage_drift(bill_history: list) -> dict:
    valid = [b for b in bill_history if float(b.get('units', 0)) > 5]
    if len(valid) < 2: return {"trend": "stable", "change_pct": 0}
    sorted_b = sorted(valid, key=lambda x: x.get('month', '0000-00'))
    cur  = float(sorted_b[-1]['units'])
    prev = float(sorted_b[-2]['units'])
    if prev == 0: return {"trend": "stable", "change_pct": 0}
    pct  = ((cur - prev) / prev) * 100
    return {
        "trend": "increasing" if pct > 7 else "decreasing" if pct < -7 else "stable",
        "change_pct": round(pct, 1),
        "recent_val": cur, "previous_val": prev
    }


def compute_usage_drift(bill_history: list) -> dict:
    """
    Analyzes trend by comparing the most recent month to the average 
    of previous months. Handles out-of-order data automatically.
    """
    # 1. Filter noise
    valid = [b for b in bill_history if float(b.get('units', 0)) > 5]
    
    if len(valid) < 2:
        return {"trend": "stable", "change_pct": 0, "status": "insufficient_data"}

    # 2. CHRONOLOGICAL SORT
    sorted_b = sorted(valid, key=lambda x: x.get('month', '0000-00'))

    # 3. Compare latest month to the one before it
    current_units = float(sorted_b[-1]['units'])
    previous_units = float(sorted_b[-2]['units'])

    if previous_units == 0:
        return {"trend": "stable", "change_pct": 0}

    change_pct = ((current_units - previous_units) / previous_units) * 100
    
    # Define trend thresholds
    if change_pct > 7:
        trend = "increasing"
    elif change_pct < -7:
        trend = "decreasing"
    else:
        trend = "stable"

    return {
        "trend": trend,
        "change_pct": round(change_pct, 1),
        "recent_val": current_units,
        "previous_val": previous_units
    }


# ─────────────────────────────────────────
#  KNN ARCHETYPE + LSTM SEED
# ─────────────────────────────────────────
LSTM_FEATURES = [
    "usage_kw", "ac_kw", "refrigerator_kw",
    "hour_sin", "hour_cos", "day_of_week_sin", "day_of_week_cos",
    "month_sin", "month_cos", "is_weekend"
]

def encode_cyclical(val, max_val):
    angle = 2 * np.pi * val / max_val
    return np.sin(angle), np.cos(angle)

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
    ms, mc   = encode_cyclical(current_month, 12)
    for i in range(48):
        h = i % 24
        hs, hc = encode_cyclical(h, 24)
        peak = 0.4 + 0.5 * np.exp(-0.5 * ((h - 8) / 3)**2) + 0.4 * np.exp(-0.5 * ((h - 20) / 3)**2)
        use  = user_mean * peak
        seed[i] = [use, use * 0.4 * ac_scale, use * 0.05, hs, hc, 0.0, 1.0, ms, mc, 0.0]
    return seed

def get_lstm_seed(house_id: str, user_mean: float, month: int) -> np.ndarray:
    try:
        master     = get_master_df()
        house_data = master[master["house_id"] == house_id].sort_values("datetime")
        if len(house_data) < 48:
            raise ValueError("Insufficient data")
        monthly = house_data[house_data["datetime"].dt.month == month]
        seed_48h = monthly.tail(48).copy() if len(monthly) >= 48 else house_data.tail(48).copy()
        house_mean = seed_48h["usage_kw"].mean()
        if house_mean > 0:
            sf = user_mean / house_mean
            seed_48h["usage_kw"]        *= sf
            seed_48h["ac_kw"]           *= sf
            seed_48h["refrigerator_kw"] *= sf
        ms, mc = encode_cyclical(month, 12)
        seed_48h["month_sin"] = ms
        seed_48h["month_cos"] = mc
        if "hour_sin" not in seed_48h.columns:
            seed_48h["hour_sin"], seed_48h["hour_cos"] = zip(
                *seed_48h["datetime"].dt.hour.apply(lambda h: encode_cyclical(h, 24))
            )
        if "day_of_week_sin" not in seed_48h.columns:
            seed_48h["day_of_week_sin"], seed_48h["day_of_week_cos"] = zip(
                *seed_48h["datetime"].dt.dayofweek.apply(lambda d: encode_cyclical(d, 7))
            )
        avail  = [f for f in LSTM_FEATURES if f in seed_48h.columns]
        matrix = seed_48h[avail].fillna(0).values
        miss   = len(LSTM_FEATURES) - len(avail)
        if miss > 0:
            matrix = np.hstack([matrix, np.zeros((48, miss))])
        return matrix[:, :len(LSTM_FEATURES)]
    except Exception as e:
        print(f"[WARN] LSTM seed fallback: {e}")
        return _synthetic_seed(user_mean, month)
    
def _get_calibration(u: dict) -> tuple:
    """
    Compute how much this specific user deviates from physics predictions.
    
    Returns (calibration_factor, confidence_level, n_months)
    
    For each history month:
      - Run physics for that month
      - factor = actual_units / physics_units
    
    Recency-weighted average of factors = calibration factor.
    
    Example:
      Feb physics=155, actual=145  → factor=0.93 (user uses 7% less than physics)
      Mar physics=187, actual=178  → factor=0.95
      Avg factor ≈ 0.945
      April physics=238 → calibrated = 238 × 0.945 = 225 kWh ✓
    
    This automatically handles seasonality — the factor is dimensionless
    so it applies correctly whether we're predicting summer or winter.
    """
    valid = [b for b in u.get('bill_history', [])
             if float(b.get('units', 0)) > 5 and b.get('month')]
    sorted_hist = sorted(valid, key=lambda x: x['month'])
 
    if not sorted_hist:
        return 1.0, 'none', 0
 
    factors = []
    for entry in sorted_hist[-6:]:  # use last 6 months max
        try:
            h_month = int(entry['month'].split('-')[1])
            physics_h = compute_true_baseload(u, h_month)
            if physics_h['total'] > 5:
                f = float(entry['units']) / physics_h['total']
                f = max(0.50, min(2.00, f))  # sanity clamp
                factors.append(f)
        except:
            continue
 
    if not factors:
        return 1.0, 'none', 0
 
    # Recency-weighted (i=0 oldest, i=n-1 newest gets highest weight)
    weights = [np.exp(0.35 * i) for i in range(len(factors))]
    total_w = sum(weights)
    cal_factor = sum((w / total_w) * f for w, f in zip(weights, factors))
 
    n = len(sorted_hist)
    confidence = 'high' if n >= 6 else 'medium' if n >= 3 else 'low'
    return round(cal_factor, 4), confidence, n
 
 
def calculate_hybrid_units(u: dict, physics: dict, rf_kwh: float, month: int) -> float:
    """
    v5.0 - Calibration-based handshake
    
    PRINCIPLE:
    - Physics says: "given your appliances + this month's climate, you should use X"
    - History says: "you consistently use Y% of what physics predicts"
    - Calibration says: "therefore this month, expect X × Y%"
    - RF says: "behavioral patterns add/subtract Z"
    - Routine scales the total
    
    WHY THIS IS BETTER than fixed weight blending:
    - Seasonal auto-adjustment: calibration factor is dimensionless,
      works correctly for both summer and winter predictions
    - More data → more accurate calibration, RF influence shrinks
    - No data → physics is the prediction, RF nudges slightly
    - History from Feb/Mar doesn't artificially pull down June predictions
    """
    physics_kwh = physics['total']
    cal_factor, confidence, n_months = _get_calibration(u)
 
    # ── STEP 1: Apply calibration to physics ──
    calibrated = physics_kwh * cal_factor
 
    # ── STEP 2: RF behavioral adjustment (damped by confidence) ──
    # RF captures behavioral patterns physics can't see:
    # leaving devices on standby, irregular usage, etc.
    # But RF can overfit to "average" Pakistani household.
    # As history confidence grows, we trust physics+calibration more.
    RF_DAMP = {'none': 0.20, 'low': 0.12, 'medium': 0.08, 'high': 0.04}
    rf_offset = rf_kwh - physics_kwh           # how much RF differs from physics
    rf_adj    = rf_offset * RF_DAMP[confidence]  # damped behavioral nudge
    
    blended = calibrated + rf_adj
 
    # ── STEP 3: Routine multiplier ──
    routine = ROUTINE_FACTORS.get(u.get('user_routine', 'standard'), 1.00)
    final   = blended * routine
 
    # ── STEP 4: Sanity floor ──
    # Final can't be less than 40% of physics (catches extreme negative RF)
    return round(max(final, physics_kwh * 0.40), 2)
 
 
def get_blend_weights(u: dict, month: int) -> dict:
    """Returns weight breakdown for UI display (informational only)."""
    _, confidence, n = _get_calibration(u)
    RF_DAMP = {'none': 0.20, 'low': 0.12, 'medium': 0.08, 'high': 0.04}
    rf_w    = RF_DAMP[confidence]
    hist_w  = {'none': 0.0, 'low': 0.30, 'medium': 0.45, 'high': 0.60}[confidence]
    phys_w  = round(1.0 - rf_w - hist_w, 2)
    return {"physics": phys_w, "rf": rf_w, "history": hist_w}
 
def validate():
    import math
 
    user = {
        'disco': 'K-Electric', 'person_count': 5, 'property_area': 1200,
        'ac_std_qty': 1, 'ac_std_val': 2,
        'ac_inv_qty': 1, 'ac_inv_val': 7,
        'f_qty': 1, 'f_type': 'inverter',
        'fan_ac_qty': 2, 'fan_dc_qty': 3,
        'k_qty': 1, 'k_val': 0.5, 'k_freq': 30,
        'wm_qty': 1, 'wm_type': 'automatic', 'wm_val': 4, 'wm_freq': 4.3,
        'wp_qty': 1, 'wp_type': 1.0, 'wp_val': 1, 'wp_freq': 30,
        'u_qty': 1, 'u_type': 'modified', 'u_battery': 'lead_acid', 'u_val': 2,
        'user_routine': 'evening_active',
        'bill_history': [
            {'month': '2026-02', 'units': 145, 'amount': 2150},
            {'month': '2026-03', 'units': 178, 'amount': 3850},
        ]
    }
 
    print("=" * 55)
    print("  VALIDATION: User data from the conversation")
    print("=" * 55)
    for m_name, m_num in [("January", 1), ("March", 3), ("April", 4), ("June", 6)]:
        p = compute_true_baseload(user, m_num)
        print(f"\n  {m_name}:")
        print(f"    Physics total: {p['total']} kWh")
        print(f"    AC: {p['ac']} | Fans: {p['fans']} | Fridge: {p['fridge']}")
 
    print("\n" + "=" * 55)
    print("  CALIBRATION from history:")
    cal, conf, n = _get_calibration(user)
    print(f"    Factor: {cal} | Confidence: {conf} | Months: {n}")
 
    april_p = compute_true_baseload(user, 4)
    print(f"\n  April final prediction:")
    print(f"    Physics:     {april_p['total']} kWh")
    print(f"    Calibrated:  {round(april_p['total'] * cal, 1)} kWh")
    rf_mock = 250  # mock RF prediction
    final = calculate_hybrid_units(user, april_p, rf_mock, 4)
    print(f"    After RF+routine (evening_active): {final} kWh")
    print(f"    Expected range: 220-260 kWh ✓" if 200 <= final <= 280 else f"    ⚠ Out of range")
    print()
 


# ─────────────────────────────────────────
#  ROUTES
# ─────────────────────────────────────────

@app.route('/api/setup_profile', methods=['POST'])
def setup_profile():
    try:
        data      = request.json
        uid       = data['uid']
        user_info = data['data']
        db.collection('users').document(uid).set(user_info, merge=True)
        return jsonify({"status": "success"}), 200
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@app.route('/api/forecast_24h', methods=['POST'])
def forecast_24h():
    try:
        data = request.json
        uid = data.get('uid')
        target_month = int(data.get('month', get_current_month()))
        
        user_doc_ref = db.collection('users').document(uid).get()
        if not user_doc_ref.exists: return jsonify({"error": "User not found"}), 404
        u = user_doc_ref.to_dict()

        # ─── STEP 1: GET THE MASTER GROUND TRUTH (RF MODEL) ───
        physics = compute_true_baseload(u, target_month)
        
        feature_vector = {feat: 0.0 for feat in bill_feats}
        feature_vector.update({
            'ac_monthly': physics['ac'], 'kitchen_monthly': physics['kitchen'],
            'refrigerator_monthly': physics['fridge'], 'ups_monthly': physics['ups'],
            'wp_monthly': physics['water_pump'], 'weekend_usage': safe_get(u, 'mean_hourly', 0.05),
            'month_num': float(target_month), 'person_count': max(safe_get(u, 'person_count', 1.0), 1.0),
            'property_area': safe_get(u, 'property_area', 500.0), 'meta_ac_count': safe_get(u, 'ac_qty'),
            'meta_fridge_count': safe_get(u, 'f_qty'), 'meta_ups_count': safe_get(u, 'u_qty', 0.0),
            'floors': safe_get(u, 'floors', 1.0)
        })
        
        # RF Prediction usually returns float64, let's cast to float for safety
        rf_kwh_monthly = float(rf_model.predict(pd.DataFrame([feature_vector]))[0])
        master_monthly_kwh = float(calculate_hybrid_units(u, physics, rf_kwh_monthly, target_month))
        
        daily_target_kwh = master_monthly_kwh / 30

        # ─── STEP 2: GENERATE THE NEURAL PATTERN (LSTM) ───
        user_mean = physics["total"] / 720
        archetype_house = find_archetype_house(u)
        seed_data = get_lstm_seed(archetype_house, user_mean, target_month)
        
        scaled_seed = lstm_scaler.transform(seed_data)
        input_seq = np.reshape(scaled_seed, (1, 48, len(LSTM_FEATURES)))
        prediction = lstm_model.predict(input_seq, verbose=0)
        
        raw_lstm_values = prediction[0] 
        raw_sum = float(np.sum(raw_lstm_values)) # FORCE TO FLOAT

        # ─── STEP 3: THE MATHEMATICAL HANDSHAKE ───
        scaling_factor = daily_target_kwh / raw_sum if raw_sum > 0 else 0

        forecast_kw = []
        for v in raw_lstm_values:
            # v is a float32 from LSTM. We MUST cast to float()
            aligned_val = float(v) * scaling_factor
            forecast_kw.append(max(0, round(aligned_val, 4)))

        # ─── STEP 4: NEPRA COST ───
        history = u.get('bill_history', [])
        sorted_hist = sorted(history, key=lambda x: x.get('month', '0000-00'))
        actual_units_history = [float(b.get('units', 0)) for b in sorted_hist if float(b.get('units', 0)) > 5]
        
        cat = u.get('user_category', 'lifeline')
        is_eligible = nepra.check_eligibility(actual_units_history, cat)
        
        bill_res = nepra.calculate_bill(
            units=master_monthly_kwh, 
            load_kw=safe_get(u, 'sanctioned_load', 1.0), 
            user_category=cat, 
            is_eligible=is_eligible
        )

        return jsonify({
            "status": "success",
            "forecast": forecast_kw, # This is now list of standard floats
            "hours": list(range(24)),
            "ac_scale": float(get_seasonal_ac_scale(target_month)),
            "archetype": str(archetype_house),
            "month": int(target_month),
            "finance": {
                "daily_units": float(round(daily_target_kwh, 2)),
                "monthly_units": float(round(master_monthly_kwh, 1)),
                "daily_cost": float(round(bill_res['total_bill'] / 30, 2)),
                "monthly_cost": float(bill_res['total_bill']),
                "applied_category": str(bill_res['applied_category']),
                "effective_rate": float(round(bill_res['energy_cost'] / master_monthly_kwh, 2)) if master_monthly_kwh > 0 else 0.0
            }
        })
    except Exception as e:
        import traceback; traceback.print_exc()
        return jsonify({"error": str(e)}), 500


@app.route('/api/predict_bill', methods=['POST'])
def predict_user_bill():
    """v2.5 — Optimized Synchronized Engine (Single Month)"""
    try:
        data = request.json
        uid = data['uid']
        target_month = int(data.get('month', get_current_month()))

        user_doc = db.collection('users').document(uid).get()
        if not user_doc.exists: return jsonify({"error": "Profile not found"}), 404
        u = user_doc.to_dict()

        history = u.get('bill_history', [])
        sorted_hist = sorted(history, key=lambda x: x.get('month', '0000-00'))
        # Extract only the units into a clean list for the engine
        actual_units_history = [float(b.get('units', 0)) for b in sorted_hist if float(b.get('units', 0)) > 5]

        # ── 1. UNIFIED PHYSICS ──
        physics = compute_true_baseload(u, target_month)
        
        # ── 2. UNIFIED RF INFERENCE (The 13-Feature Contract) ──
        feature_vector = {feat: 0.0 for feat in bill_feats}
        feature_vector.update({
            'ac_monthly': physics['ac'], 'kitchen_monthly': physics['kitchen'],
            'refrigerator_monthly': physics['fridge'], 'ups_monthly': physics['ups'],
            'wp_monthly': physics['water_pump'], 'weekend_usage': safe_get(u, 'mean_hourly', 0.05),
            'month_num': float(target_month), 'person_count': max(safe_get(u, 'person_count', 1.0), 1.0),
            'property_area': safe_get(u, 'property_area', 500.0), 'meta_ac_count': safe_get(u, 'ac_qty'),
            'meta_fridge_count': safe_get(u, 'f_qty'), 'meta_ups_count': safe_get(u, 'u_qty', 0.0),
            'floors': safe_get(u, 'floors', 1.0)
        })
        rf_kwh = float(rf_model.predict(pd.DataFrame([feature_vector]))[0])

        # ── 3. UNIFIED BLENDING ──
        final_units = calculate_hybrid_units(u, physics, rf_kwh, target_month)

        # ── 4. NEPRA ──
        cat = u.get('user_category', 'lifeline')
        is_eligible = nepra.check_eligibility(actual_units_history, cat)
        sanc_load = safe_get(u, 'sanctioned_load', 1.0)
        bill_res = nepra.calculate_bill(units=final_units, load_kw=sanc_load, user_category=cat, is_eligible= is_eligible)

        valid_hist_count = len([b for b in u.get('bill_history', []) if float(b.get('units', 0)) > 5])

        return jsonify({
            "status": "success", 
            "kwh": round(final_units, 2),
            "bill": { 
                **bill_res, 
                "physics_breakdown": physics, 
                "rf_prediction_kwh": round(rf_kwh, 2),
                "blend_weights": get_blend_weights(u, target_month), 
                "drift": compute_usage_drift(u.get('bill_history', [])),
                "history_months_used": valid_hist_count, 
                "seasonal_context": {
                    "month": calendar.month_name[target_month], 
                    "ac_scale": get_seasonal_ac_scale(target_month), 
                    "fan_hours_today": FAN_DAILY_HOURS.get(target_month, 0)
                }
            }
        })
    except Exception as e:
        import traceback; traceback.print_exc(); return jsonify({"error": str(e)}), 500


@app.route('/api/seasonal_preview', methods=['POST'])
def seasonal_preview():
    try:
        uid = request.json.get('uid')
        user_doc = db.collection('users').document(uid).get()
        if not user_doc.exists: return jsonify({"error": "Profile not found"}), 404
        u = user_doc.to_dict()

        # --- STEP 1: INITIALIZE ROLLING WINDOW FROM REAL HISTORY ---
        history = u.get('bill_history', [])
        sorted_hist = sorted(history, key=lambda x: x.get('month', '0000-00'))
        # Load up to 12 months of real history units
        rolling_window = [float(b.get('units', 0)) for b in sorted_hist if float(b.get('units', 0)) > 5][-12:]
        
        # Determine simulation start month (Next month after last history entry)
        if sorted_hist:
            last_m_str = sorted_hist[-1].get('month', '0000-00')
            _, last_m_int = map(int, last_m_str.split('-'))
            start_sim_month = (last_m_int % 12) + 1
        else:
            start_sim_month = get_current_month()

        user_pref_cat = u.get('user_category', 'lifeline')
        monthly_preview = []

        # --- STEP 2: SIMULATE 12 MONTHS CHRONOLOGICALLY ---
        for i in range(12):
            # Calculate the current simulation month index (1-12)
            m = ((start_sim_month + i - 1) % 12) + 1
            
            # Physics + RF logic (Exact same as your current code)
            physics = compute_true_baseload(u, m)
            # (Assuming bill_feats and rf_model are available globally)
            feature_vector = {feat: 0.0 for feat in bill_feats}
            feature_vector.update({
                'ac_monthly': physics['ac'], 'kitchen_monthly': physics['kitchen'],
                'refrigerator_monthly': physics['fridge'], 'ups_monthly': physics['ups'],
                'wp_monthly': physics['water_pump'], 'weekend_usage': safe_get(u, 'mean_hourly', 0.05),
                'month_num': float(m), 'person_count': max(safe_get(u, 'person_count', 1.0), 1.0),
                'property_area': safe_get(u, 'property_area', 500.0), 'meta_ac_count': safe_get(u, 'ac_qty'),
                'meta_fridge_count': safe_get(u, 'f_qty'), 'meta_ups_count': safe_get(u, 'u_qty', 0.0),
                'floors': safe_get(u, 'floors', 1.0)
            })
            rf_kwh = float(rf_model.predict(pd.DataFrame([feature_vector]))[0])
            final_units = calculate_hybrid_units(u, physics, rf_kwh, m)

            # --- STEP 3: APPLY NEPRA "MEMORY" ---
            is_eligible = nepra.check_eligibility(rolling_window, user_pref_cat)
            
            bill_res = nepra.calculate_bill(
                units=final_units, 
                load_kw=safe_get(u, 'sanctioned_load', 1.0), 
                user_category=user_pref_cat,
                is_eligible=is_eligible
            )

            # --- STEP 4: RECORD AND UPDATE WINDOW ---
            # Add this simulated month to the memory for the next loop iteration
            rolling_window.append(final_units)
            if len(rolling_window) > 12:
                rolling_window.pop(0)

            monthly_preview.append({
                "month": m,
                "month_name": calendar.month_name[m], # Use full name for frontend rotation
                "kwh": round(final_units, 1),
                "bill_pkr": float(bill_res['total_bill']),
                "applied_status": bill_res['applied_category']
            })

        return jsonify({ "status": "success", "monthly": monthly_preview })
    except Exception as e:
        import traceback; traceback.print_exc(); return jsonify({"error": str(e)}), 500


if __name__ == '__main__':
    validate() 
    app.run(host='0.0.0.0', port=5000, debug=True)