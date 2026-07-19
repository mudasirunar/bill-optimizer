from flask import Blueprint, request, jsonify
import pandas as pd

from core.firebase import db
from core.physics import get_current_month, compute_true_baseload, safe_get
from core.ml_predictor import rf_model, bill_feats, calculate_hybrid_units, find_archetype_house
from utils.nepra_engine import NepraEngine
from utils.chat_manager import get_gemini_response

chat_bp = Blueprint('chat', __name__)
nepra = NepraEngine()

@chat_bp.route('/api/chat', methods=['POST'])
def chat_with_assistant():
    try:
        data = request.json
        uid = data.get('uid')
        message = data.get('message', '')
        history = data.get('history', [])
        page = data.get('page', '')
        platform = data.get('platform', 'web')
        client_display_name = data.get('displayName', '')
        client_email = data.get('email', '')

        if not uid or not message:
            return jsonify({"error": "Missing uid or message"}), 400

        # 1. Fetch user data from Firestore
        user_doc = db.collection('users').document(uid).get()
        if not user_doc.exists:
            fallback_first = client_display_name.split(' ')[0] if client_display_name else 'User'
            fallback_context = {
                "disco": "Unknown",
                "category_display": "Unknown",
                "inventory": {},
                "page": page,
                "platform": platform,
                "first_name": fallback_first or 'User',
                "full_name": client_display_name or 'User',
                "email": client_email or 'Unknown'
            }
            reply = get_gemini_response(message, history, fallback_context)
            return jsonify({"status": "success", "reply": reply})

        u = user_doc.to_dict()

        # 2. Compute live predictions & baselines for context
        m = get_current_month()
        physics = compute_true_baseload(u, m)

        # Run RF prediction
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

        # Calculate Nepra Bill
        cat = u.get('user_category', 'lifeline')
        valid_hist = [float(b.get('units', 0)) for b in u.get('bill_history', []) if float(b.get('units', 0)) > 5]
        is_eligible = nepra.check_eligibility(valid_hist, cat)
        bill_res = nepra.calculate_bill(
            units=final_units, 
            load_kw=safe_get(u, 'sanctioned_load', 1.0), 
            user_category=cat, 
            is_eligible=is_eligible
        )

        archetype_house = find_archetype_house(u)

        # 3. Calculate completeness score
        completeness_score = 0
        fields = [
            'disco', 'sanctioned_load', 'user_category', 'person_count',
            'user_routine', 'property_area', 'floors', 'f_qty',
            'wm_qty', 'wp_qty', 'u_qty', 'k_qty', 'iron_qty'
        ]
        for f in fields:
            if u.get(f) is not None and u.get(f) != "":
                completeness_score += 1
        if u.get('fan_ac_qty') is not None or u.get('fan_dc_qty') is not None:
            completeness_score += 1
        if u.get('ac_std_qty') is not None or u.get('ac_inv_qty') is not None:
            completeness_score += 1
        if len(u.get('bill_history', [])) > 0:
            completeness_score += 1

        # 4. Construct user profile context
        raw_first = u.get('firstName') or u.get('first_name', '')
        raw_last = u.get('lastName') or u.get('last_name', '')
        constructed_full = f"{raw_first} {raw_last}".strip()
        final_full_name = constructed_full or u.get('name') or client_display_name or 'User'
        final_first_name = raw_first or u.get('name', '').split(' ')[0] or (client_display_name.split(' ')[0] if client_display_name else '') or 'User'
        
        user_context = {
            "first_name": final_first_name,
            "full_name": final_full_name,
            "email": u.get('email') or u.get('email_address') or client_email or 'Unknown',
            "disco": u.get('disco', 'Unknown'),
            "category_display": "Un-Protected" if cat == 'non_protected' else "Protected" if cat == 'protected' else "Lifeline",
            "is_protected": "Yes" if cat == 'protected' else "No",
            "is_lifeline": "Yes" if cat == 'lifeline' else "No",
            "sanctioned_load": str(u.get('sanctioned_load', '1.0')),
            "completeness_score": f"{completeness_score}",
            "archetype": str(archetype_house).replace("House", "House #"),
            "predicted_units": str(round(final_units, 1)),
            "predicted_bill": str(round(bill_res['total_bill'], 0)),
            "page": page,
            "platform": platform,
            "inventory": {
                "Standard ACs": f"{u.get('ac_std_qty', 0)} units ({u.get('ac_std_val', 0)} hrs/day)",
                "Inverter ACs": f"{u.get('ac_inv_qty', 0)} units ({u.get('ac_inv_val', 0)} hrs/day)",
                "Standard Fans": f"{u.get('fan_ac_qty', 0)} units",
                "Inverter Fans": f"{u.get('fan_dc_qty', 0)} units",
                "Refrigerator": f"{u.get('f_qty', 0)} units ({u.get('f_type', 'standard')})",
                "Washing Machine": f"{u.get('wm_qty', 0)} units ({u.get('wm_type', 'manual')})",
                "Water Pump": f"{u.get('wp_qty', 0)} units ({u.get('wp_type', '1.0')} HP)",
                "UPS System": f"{u.get('u_qty', 0)} units",
                "Kitchen Oven/Kettle": f"{u.get('k_qty', 0)} units",
                "Clothes Iron": f"{u.get('iron_qty', 0)} units ({u.get('iron_val', 0)} hrs/session)"
            }
        }

        # 5. Fetch Gemini response
        reply = get_gemini_response(message, history, user_context)
        return jsonify({"status": "success", "reply": reply})

    except Exception as e:
        import traceback; traceback.print_exc()
        return jsonify({"error": str(e)}), 500
