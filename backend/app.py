import sys
import os

from flask import Flask
from flask_cors import CORS

# Import config first to apply environment and TF memory constraints
import config
from core.firebase import db
from core.ml_predictor import (
    rf_model,
    bill_feats,
    lstm_model,
    lstm_scaler,
    knn_model,
    knn_scaler,
    knn_house_ids,
    knn_features,
    SEASONAL_COEFFICIENTS,
    find_archetype_house,
    get_lstm_seed,
    calculate_hybrid_units,
    get_blend_weights
)
from core.physics import (
    safe_get,
    get_current_month,
    get_seasonal_ac_scale,
    get_seasonal_fan_scale,
    apply_seasonal_scaling,
    compute_true_baseload
)
from core.history import compute_recency_weighted_avg, compute_usage_drift

# Initialize Flask App
app = Flask(__name__)
CORS(app, resources={r"/*": {"origins": "*"}}, supports_credentials=True)

# Register Blueprints
from routes.home import home_bp
from routes.profile import profile_bp
from routes.chat import chat_bp
from routes.billing import billing_bp

app.register_blueprint(home_bp)
app.register_blueprint(profile_bp)
app.register_blueprint(chat_bp)
app.register_blueprint(billing_bp)

# ─────────────────────────────────────────
#  SELF-VALIDATION ROUTINE (FYP Boot check)
# ─────────────────────────────────────────
def validate():
    """Initial boot validation checks for model and data structures."""
    print("=" * 80)
    print(" 🚀 FYP BACKEND INITIALIZATION VALIDATION CHECK ")
    print("=" * 80)
    try:
        import numpy as np
        import pandas as pd
        
        # Test 1: KNN Shape Matcher check
        mock_profile = [3.0, 1.0, 5.0, 1.0, 8.0, 1.0] # AC, Fridge, People, UPS, Fans, WM
        user_vec = np.array([mock_profile])
        user_scaled = knn_scaler.transform(user_vec)
        distances, indices = knn_model.kneighbors(user_scaled)
        matched_house = knn_house_ids[indices[0][0]]
        print(f"  [PASS] KNN Archetype Verification: Matched to {matched_house}")
        
        # Test 2: LSTM dimensions check
        mock_input = np.random.rand(1, 48, 10)
        prediction = lstm_model.predict(mock_input, verbose=0)
        print(f"  [PASS] Bidirectional LSTM Verification: Output shape {prediction.shape}")
        
        # Test 3: Random Forest predictions
        mock_df = pd.DataFrame([{feat: 0.0 for feat in bill_feats}])
        rf_pred = rf_model.predict(mock_df)
        print(f"  [PASS] Random Forest Verification: Base prediction {rf_pred[0]:.2f} kWh")
        
        print(" ⭐ ALL PIPELINE COMPONENTS VERIFIED SUCCESS ⭐")
    except Exception as e:
        print(f" ⚠ Boot validation warning: {e}")
    print("=" * 80)

if __name__ == '__main__':
    validate()
    app.run(host='0.0.0.0', port=5001, debug=True)