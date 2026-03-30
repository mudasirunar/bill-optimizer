import joblib

# Path to your features file
FEATURES_PATH = "../data/processed/models/bill_features.pkl"

try:
    bill_feats = joblib.load(FEATURES_PATH)
    print("--- PRECON MODEL REQUIRED FEATURES ---")
    for i, feat in enumerate(bill_feats, 1):
        print(f"{i}. {feat}")
    print("--------------------------------------")
    print(f"Total Features Expected: {len(bill_feats)}")
except Exception as e:
    print(f"Error loading pkl: {e}")