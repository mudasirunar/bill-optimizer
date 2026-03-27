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
    fan_scale = get_seasonal_fan_scale(month)

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
    """
    Predict monthly electricity bill.

    V2 Pipeline:
    1. Load user profile from Firestore
    2. Compute seasonal-adjusted appliance kWh
    3. Build RF feature vector (matching training features exactly)
    4. RF predicts base kWh for current month
    5. Apply occupancy + routine heuristics
    6. Calibrate with recency-weighted bill history
    7. Calculate bill via NepraEngine
    8. Save to history
    """
    try:
        data = request.json
        uid  = data['uid']

        # Allow optional month override for "what-if" simulations
        target_month = int(data.get('month', get_current_month()))

        user_doc = db.collection('users').document(uid).get()
        if not user_doc.exists:
            return jsonify({"error": "Profile not found"}), 404

        u = user_doc.to_dict()

        # ── STEP 1: Raw appliance kWh from user profile ──
        # These are computed and stored by the frontend (setup_profile.html)
        appliance_kwh_raw = {
            'ac_monthly':           float(u.get('ac_monthly', 0)),
            'refrigerator_monthly': float(u.get('refrigerator_monthly', 0)),
            'kitchen_monthly':      float(u.get('kitchen_monthly', 0)),
            'ups_monthly':          float(u.get('ups_monthly', 0)),
            'wp_monthly':           float(u.get('wp_monthly', 0)),
            'weekend_usage':        float(u.get('mean_hourly', 0.5)),  # proxy
        }

        # ── STEP 2: Apply seasonal scaling ──
        # THIS is the core fix: user reports flat "8 hrs/day AC" usage
        # but we know in January that AC runs 0 hours, so we scale it down.
        appliance_kwh = apply_seasonal_scaling(appliance_kwh_raw, target_month)

        ac_scale = get_seasonal_ac_scale(target_month)
        month_name = calendar.month_name[target_month]

        print(f"[INFO] Predicting for {month_name} (AC scale: {ac_scale:.2f})")
        print(f"[INFO] Raw AC kWh: {appliance_kwh_raw['ac_monthly']:.1f} → "
              f"Scaled: {appliance_kwh['ac_monthly']:.1f}")

        # ── STEP 3: Occupancy & Routine heuristics ──
        person_count = float(u.get('person_count', 1))
        routine      = u.get('user_routine', 'standard')

        # Phantom load: fans, lights, phone chargers, always-on devices
        # Scale by season (more fans in summer, more lights in winter)
        fan_scale    = get_seasonal_fan_scale(target_month)
        phantom_kwh  = person_count * (12.0 + 8.0 * fan_scale)  # 12–20 kWh/person/month

        routine_multipliers = {
            "standard":       1.00,
            "morning_active": 1.05,
            "evening_active": 1.15,
            "all_day":        1.25,
        }
        routine_factor = routine_multipliers.get(routine, 1.00)

        # ── STEP 4: Build RF feature vector ──
        # Must match BILL_FEATURES list from training EXACTLY
        person_count_meta = person_count
        property_area     = float(u.get('sanctioned_load', 5)) * 800  # rough proxy: kW → sqft

        feature_vector = {feat: 0.0 for feat in bill_feats}  # initialize all to 0

        # Fill known features
        feature_vector['ac_monthly']           = appliance_kwh['ac_monthly']
        feature_vector['kitchen_monthly']       = appliance_kwh['kitchen_monthly']
        feature_vector['refrigerator_monthly']  = appliance_kwh['refrigerator_monthly']
        feature_vector['ups_monthly']           = appliance_kwh['ups_monthly']
        feature_vector['wp_monthly']            = appliance_kwh['wp_monthly']
        feature_vector['weekend_usage']         = appliance_kwh['weekend_usage']
        feature_vector['month_num']             = float(target_month)
        feature_vector['person_count']          = person_count_meta
        feature_vector['property_area']         = property_area
        feature_vector['meta_ac_count']         = float(u.get('ac_qty', 0))
        feature_vector['meta_fridge_count']     = float(u.get('f_qty', 0))
        feature_vector['meta_ups_count']        = float(u.get('u_qty', 0))
        feature_vector['floors']                = 1.0  # default — not collected in form

        df_input = pd.DataFrame([feature_vector])

        # ── STEP 5: RF prediction ──
        ai_pred_kwh = float(rf_model.predict(df_input)[0])

        # Apply occupancy heuristic and routine multiplier
        steered_kwh = (ai_pred_kwh + phantom_kwh) * routine_factor

        print(f"[INFO] RF base kWh: {ai_pred_kwh:.1f} | "
              f"Phantom: {phantom_kwh:.1f} | Steered: {steered_kwh:.1f}")

        # ── STEP 6: Recency-weighted history calibration ──
        bill_history = u.get('bill_history', [])
        hist_avg     = compute_recency_weighted_avg(bill_history)
        drift_info   = compute_usage_drift(bill_history)

        if hist_avg > 0:
            # Blend AI (60%) with recency-weighted history (40%)
            # If drift is strong, trust history more
            if drift_info['trend'] in ('increasing', 'decreasing'):
                ai_weight   = 0.50
                hist_weight = 0.50
                calibration_mode = (
                    f"Hybrid AI — {drift_info['trend']} trend detected "
                    f"({drift_info['change_pct']:+.1f}% vs 3mo ago)"
                )
            else:
                ai_weight   = 0.60
                hist_weight = 0.40
                calibration_mode = (
                    f"Hybrid AI — stable usage pattern "
                    f"(Occupancy: {int(person_count)}p, {month_name}, {routine})"
                )
            final_kwh = (steered_kwh * ai_weight) + (hist_avg * hist_weight)
        else:
            final_kwh        = steered_kwh
            calibration_mode = f"Seasonal AI ({month_name}, AC@{ac_scale:.0%}, {routine})"

        print(f"[INFO] History avg: {hist_avg:.1f} kWh | Final: {final_kwh:.1f} kWh")

        # ── STEP 7: Calculate bill via NepraEngine ──
        cat      = u.get('user_category', 'non_protected')
        bill_res = nepra.calculate_bill(
            units         = final_kwh,
            load_kw       = float(u.get('sanctioned_load', 1.0)),
            user_category = cat
        )

        # ── STEP 8: Enrich response with seasonal context ──
        bill_res['engine_mode']             = calibration_mode
        bill_res['seasonal_context']        = {
            'month':            month_name,
            'month_num':        target_month,
            'ac_scale':         round(ac_scale, 2),
            'ac_kwh_raw':       round(appliance_kwh_raw['ac_monthly'], 1),
            'ac_kwh_seasonal':  round(appliance_kwh['ac_monthly'], 1),
            'ac_saving_kwh':    round(appliance_kwh_raw['ac_monthly'] -
                                      appliance_kwh['ac_monthly'], 1),
        }
        bill_res['occupancy_phantom_kwh']   = round(phantom_kwh, 1)
        bill_res['routine_factor']          = routine_factor
        bill_res['drift']                   = drift_info
        bill_res['history_months_used']     = len(bill_history)

        # ── Save prediction to Firestore history ──
        db.collection('users').document(uid).collection('history').add({
            "timestamp":      firestore.SERVER_TIMESTAMP,
            "month_predicted":target_month,
            "kwh_predicted":  round(final_kwh, 2),
            "kwh_rf_base":    round(ai_pred_kwh, 2),
            "kwh_hist_avg":   round(hist_avg, 2),
            "factors": {
                "people":        person_count,
                "routine":       routine,
                "ac_scale":      round(ac_scale, 2),
                "month":         month_name,
                "calibration":   calibration_mode,
            },
            "bill_estimate":  float(bill_res['total_bill'])
        })

        return jsonify({
            "status": "success",
            "month":  month_name,
            "kwh":    round(final_kwh, 2),
            "bill":   bill_res
        })

    except Exception as e:
        print(f"Prediction Error: {e}")
        import traceback; traceback.print_exc()
        return jsonify({"error": str(e)}), 500


@app.route('/api/seasonal_preview', methods=['POST'])
def seasonal_preview():
    """
    NEW ENDPOINT: Return 12-month seasonal estimate for the user.
    Useful for the dashboard's "Annual Energy Signature" chart.
    Shows what the user's bill looks like across all 12 months.
    """
    try:
        uid      = request.json.get('uid')
        user_doc = db.collection('users').document(uid).get()
        if not user_doc.exists:
            return jsonify({"error": "Profile not found"}), 404

        u = user_doc.to_dict()

        appliance_kwh_raw = {
            'ac_monthly':           float(u.get('ac_monthly', 0)),
            'refrigerator_monthly': float(u.get('refrigerator_monthly', 0)),
            'kitchen_monthly':      float(u.get('kitchen_monthly', 0)),
            'ups_monthly':          float(u.get('ups_monthly', 0)),
            'wp_monthly':           float(u.get('wp_monthly', 0)),
            'weekend_usage':        float(u.get('mean_hourly', 0.5)),
        }

        person_count   = float(u.get('person_count', 1))
        routine        = u.get('user_routine', 'standard')
        routine_factor = {'standard': 1.00, 'morning_active': 1.05,
                          'evening_active': 1.15, 'all_day': 1.25}.get(routine, 1.0)
        cat = u.get('user_category', 'non_protected')

        monthly_preview = []
        for m in range(1, 13):
            scaled      = apply_seasonal_scaling(appliance_kwh_raw, m)
            fan_scale   = get_seasonal_fan_scale(m)
            phantom_kwh = person_count * (12.0 + 8.0 * fan_scale)

            feature_vector = {feat: 0.0 for feat in bill_feats}
            feature_vector.update({
                'ac_monthly':          scaled['ac_monthly'],
                'kitchen_monthly':     scaled['kitchen_monthly'],
                'refrigerator_monthly':scaled['refrigerator_monthly'],
                'ups_monthly':         scaled['ups_monthly'],
                'wp_monthly':          scaled['wp_monthly'],
                'weekend_usage':       scaled['weekend_usage'],
                'month_num':           float(m),
                'person_count':        person_count,
                'property_area':       float(u.get('sanctioned_load', 5)) * 800,
                'meta_ac_count':       float(u.get('ac_qty', 0)),
                'meta_fridge_count':   float(u.get('f_qty', 0)),
                'meta_ups_count':      float(u.get('u_qty', 0)),
                'floors':              1.0,
            })

            df_m         = pd.DataFrame([feature_vector])
            ai_kwh       = float(rf_model.predict(df_m)[0])
            final_kwh    = (ai_kwh + phantom_kwh) * routine_factor

            bill_res = nepra.calculate_bill(
                units=final_kwh,
                load_kw=float(u.get('sanctioned_load', 1.0)),
                user_category=cat
            )

            monthly_preview.append({
                "month":     m,
                "month_name":calendar.month_abbr[m],
                "kwh":       round(final_kwh, 1),
                "bill_pkr":  float(bill_res['total_bill']),
                "ac_scale":  get_seasonal_ac_scale(m),
            })

        total_annual = sum(p['kwh'] for p in monthly_preview)
        peak_month   = max(monthly_preview, key=lambda x: x['kwh'])

        return jsonify({
            "status":         "success",
            "monthly":        monthly_preview,
            "annual_kwh":     round(total_annual, 1),
            "annual_bill":    round(sum(p['bill_pkr'] for p in monthly_preview), 0),
            "peak_month":     peak_month['month_name'],
            "peak_kwh":       peak_month['kwh'],
        })

    except Exception as e:
        print(f"Seasonal Preview Error: {e}")
        return jsonify({"error": str(e)}), 500


if __name__ == '__main__':
    app.run(host='0.0.0.0', port=5000, debug=True)