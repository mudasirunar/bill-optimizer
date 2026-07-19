from flask import Blueprint, request, jsonify
import pandas as pd
import numpy as np
import calendar

from config import FAN_DAILY_HOURS, LSTM_FEATURES
from core.firebase import db
from core.physics import get_current_month, compute_true_baseload, safe_get, get_seasonal_ac_scale
from core.history import compute_usage_drift
from core.ml_predictor import (
    rf_model,
    bill_feats,
    lstm_model,
    lstm_scaler,
    calculate_hybrid_units,
    find_archetype_house,
    get_lstm_seed,
    get_blend_weights
)
from utils.nepra_engine import NepraEngine

billing_bp = Blueprint('billing', __name__)
nepra = NepraEngine()

@billing_bp.route('/api/forecast_24h', methods=['POST'])
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
        raw_sum = float(np.sum(raw_lstm_values))

        # ─── STEP 3: THE MATHEMATICAL HANDSHAKE ───
        scaling_factor = daily_target_kwh / raw_sum if raw_sum > 0 else 0

        forecast_kw = []
        for v in raw_lstm_values:
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
            "forecast": forecast_kw,
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


@billing_bp.route('/api/predict_bill', methods=['POST'])
def predict_user_bill():
    try:
        data = request.json
        uid = data['uid']
        target_month = int(data.get('month', get_current_month()))

        user_doc = db.collection('users').document(uid).get()
        if not user_doc.exists: return jsonify({"error": "Profile not found"}), 404
        u = user_doc.to_dict()

        # ─── STEP 1: INITIALIZE ROLLING WINDOW FROM REAL HISTORY ───
        history = u.get('bill_history', [])
        sorted_hist = sorted(history, key=lambda x: x.get('month', '0000-00'))
        rolling_window = [float(b.get('units', 0)) for b in sorted_hist if float(b.get('units', 0)) > 5][-12:]

        # Determine where the simulation starts
        if sorted_hist:
            last_m_str = sorted_hist[-1].get('month', '0000-00')
            _, last_m_int = map(int, last_m_str.split('-'))
            current_sim_month = (last_m_int % 12) + 1
        else:
            current_sim_month = get_current_month()

        # ─── STEP 2: SIMULATE THE GAP UNTIL TARGET MONTH ───
        final_units = 0
        physics = {}
        rf_kwh = 0
        
        max_safety_iterations = 13
        while max_safety_iterations > 0:
            m = current_sim_month
            
            physics = compute_true_baseload(u, m)
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

            if m == target_month:
                break
                
            rolling_window.append(final_units)
            if len(rolling_window) > 12: rolling_window.pop(0)
            current_sim_month = (m % 12) + 1
            max_safety_iterations -= 1

        # ─── STEP 3: NEPRA CALCULATION ───
        cat = u.get('user_category', 'lifeline')
        is_eligible = nepra.check_eligibility(rolling_window, cat)
        sanc_load = safe_get(u, 'sanctioned_load', 1.0)
        
        bill_res = nepra.calculate_bill(
            units=final_units, 
            load_kw=sanc_load, 
            user_category=cat, 
            is_eligible=is_eligible
        )

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


@billing_bp.route('/api/seasonal_preview', methods=['POST'])
def seasonal_preview():
    try:
        uid = request.json.get('uid')
        user_doc = db.collection('users').document(uid).get()
        if not user_doc.exists: return jsonify({"error": "Profile not found"}), 404
        u = user_doc.to_dict()

        # --- STEP 1: INITIALIZE ROLLING WINDOW FROM REAL HISTORY ---
        history = u.get('bill_history', [])
        sorted_hist = sorted(history, key=lambda x: x.get('month', '0000-00'))
        rolling_window = [float(b.get('units', 0)) for b in sorted_hist if float(b.get('units', 0)) > 5][-12:]
        
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
            m = ((start_sim_month + i - 1) % 12) + 1
            
            physics = compute_true_baseload(u, m)
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
            rolling_window.append(final_units)
            if len(rolling_window) > 12:
                rolling_window.pop(0)

            monthly_preview.append({
                "month": m,
                "month_name": calendar.month_name[m],
                "kwh": round(final_units, 1),
                "bill_pkr": float(bill_res['total_bill']),
                "applied_status": bill_res['applied_category']
            })

        return jsonify({ "status": "success", "monthly": monthly_preview })
    except Exception as e:
        import traceback; traceback.print_exc(); return jsonify({"error": str(e)}), 500


@billing_bp.route('/api/simulate_bill', methods=['POST'])
def simulate_bill():
    try:
        data = request.json
        units = float(data.get('units', 0))
        load_kw = float(data.get('load_kw', 1.0))
        category = data.get('category', 'non_protected')
        is_eligible = data.get('is_eligible', True)

        bill_res = nepra.calculate_bill(
            units=units, 
            load_kw=load_kw, 
            user_category=category, 
            is_eligible=is_eligible
        )

        return jsonify({
            "status": "success",
            "simulation": bill_res
        })
    except Exception as e:
        return jsonify({"error": str(e)}), 500
