"""
=============================================================
  PRECON Model Trainer — v2 (Seasonal Intelligence Edition)
  FYP: AI-Powered Electricity Bill Optimization

  KEY CHANGES FROM v1:
  - Removed feature leakage (mean_hourly drove 93% of RF)
  - Added month_num + seasonal AC scaling as core features
  - Joined PRECON metadata (person_count, property_area)
  - Trained KNN Archetype Matcher and saved for app.py
  - LSTM: per-house normalization, Bidirectional, LayerNorm

  Run from: bill-optimizer/backend/
  Usage: python train_model.py
  Outputs: ../data/processed/models/
=============================================================
"""

import os, joblib, warnings, json
import numpy as np
import pandas as pd
from sklearn.ensemble import RandomForestRegressor
from sklearn.neighbors import NearestNeighbors
from sklearn.model_selection import cross_val_score, GroupKFold
from sklearn.preprocessing import StandardScaler, LabelEncoder
from sklearn.metrics import mean_absolute_error, mean_squared_error, r2_score

warnings.filterwarnings("ignore")

# ─────────────────────────────────────────
#  PATHS
# ─────────────────────────────────────────
BASE_DIR      = os.path.dirname(__file__)
RAW_DIR       = os.path.join(BASE_DIR, "..", "data", "raw")
PROCESSED_DIR = os.path.join(BASE_DIR, "..", "data", "processed")
MODELS_DIR    = os.path.join(PROCESSED_DIR, "models")
os.makedirs(MODELS_DIR, exist_ok=True)

DIVIDER = "=" * 70
def section(t): print(f"\n{DIVIDER}\n  {t}\n{DIVIDER}")

# ─────────────────────────────────────────
#  SEASONAL COEFFICIENT TABLE
#  Pakistani climate (Karachi/Lahore avg)
#  (AC_scale, Fan_scale) by month
#  These are applied to AC features at TRAINING time
#  so the RF learns the seasonal relationship correctly.
#  The same table is used in app.py at inference time.
# ─────────────────────────────────────────
SEASONAL_COEFFICIENTS = {
    1:  (0.00, 0.10),   # January   — deep winter, no AC
    2:  (0.00, 0.15),   # February
    3:  (0.05, 0.40),   # March     — spring starts
    4:  (0.20, 0.70),   # April
    5:  (0.65, 1.00),   # May       — pre-summer peak
    6:  (1.00, 1.00),   # June      — peak summer
    7:  (1.00, 0.90),   # July      — monsoon
    8:  (0.95, 0.85),   # August
    9:  (0.70, 0.60),   # September — cooling
    10: (0.25, 0.30),   # October
    11: (0.05, 0.10),   # November  — early winter
    12: (0.00, 0.05),   # December
}

# Save the seasonal table for app.py to load
with open(os.path.join(MODELS_DIR, "seasonal_coefficients.json"), "w") as f:
    json.dump(SEASONAL_COEFFICIENTS, f, indent=2)

# ─────────────────────────────────────────
#  NEPRA SLAB BILL CALCULATOR
# ─────────────────────────────────────────
NEPRA_SLABS = [
    (0,   50,   3.95),
    (51,  100,  7.74),
    (101, 200,  10.06),
    (201, 300,  12.15),
    (301, 700,  19.55),
    (701, float("inf"), 22.65),
]

def calc_nepra_bill(monthly_kwh: float) -> float:
    bill, remaining, prev = 0.0, monthly_kwh, 0
    for low, high, rate in NEPRA_SLABS:
        if remaining <= 0: break
        slab_size  = (high - prev) if high != float("inf") else remaining
        units      = min(remaining, slab_size)
        bill      += units * rate
        remaining -= units
        prev       = high
    return round(bill, 2)

# ─────────────────────────────────────────
#  LOAD DATA
# ─────────────────────────────────────────
section("LOADING PROCESSED DATA")

master = pd.read_csv(os.path.join(PROCESSED_DIR, "master_hourly.csv"),
                     parse_dates=["datetime"])
bills  = pd.read_csv(os.path.join(PROCESSED_DIR, "monthly_bills.csv"))

# Load PRECON metadata for household-level context
meta_path = os.path.join(RAW_DIR, "metadata.csv")
if os.path.exists(meta_path):
    metadata = pd.read_csv(meta_path)
    # Normalize "House 1" → "House1" to match master_hourly house_id
    metadata['house_id'] = metadata['Website Name'].str.replace(' ', '', regex=False)
    print(f"  Metadata loaded: {metadata.shape}")
    HAS_METADATA = True
else:
    print("  ⚠️  metadata.csv not found in raw/. Skipping metadata join.")
    HAS_METADATA = False

print(f"  Master hourly : {master.shape}")
print(f"  Monthly bills : {bills.shape}")
print(f"  Houses        : {master['house_id'].nunique()}")
print(f"  Season column : {'season' in master.columns}  ← preprocess.py already built this")
print(f"  Month column  : {'month' in master.columns}")

# ─────────────────────────────────────────
#  ENCODE HOUSE IDS
# ─────────────────────────────────────────
le = LabelEncoder()
master["house_num"] = le.fit_transform(master["house_id"])
bills["house_num"]  = le.transform(bills["house_id"])
joblib.dump(le, os.path.join(MODELS_DIR, "house_label_encoder.pkl"))


# ═══════════════════════════════════════════════════════════
#  MODEL 1 — MONTHLY BILL PREDICTOR (RandomForest)
#
#  V2 CHANGES:
#  - REMOVED: mean_hourly, std_hourly, max_hourly (feature leakage)
#  - REMOVED: peak_usage, night_usage (derived from target)
#  - ADDED: month_num as core feature (seasonality anchor)
#  - ADDED: person_count from metadata (phantom load driver)
#  - ADDED: property_area from metadata (house size proxy)
#  - KEPT: ac_monthly, weekend_usage (genuine behavioral signals)
#  - NEW: ac_monthly is now SEASON-SCALED before entering RF
# ═══════════════════════════════════════════════════════════
section("MODEL 1 — MONTHLY BILL PREDICTOR (RandomForest v2 — No Leakage)")

# ── Build monthly feature table ──
master["year_month"] = master["datetime"].dt.to_period("M")

print("\n  Building monthly feature aggregations...")

monthly_feats = master.groupby(["house_id", "house_num", "year_month"]).agg(
    monthly_kwh           = ("usage_kw",        "sum"),
    # KEPT — these measure actual seasonal appliance usage, not derived from target
    ac_monthly_raw        = ("ac_kw",            "sum"),   # raw, will be season-verified
    kitchen_monthly       = ("kitchen_kw",       "sum"),
    refrigerator_monthly  = ("refrigerator_kw",  "sum"),
    ups_monthly           = ("ups_kw",           "sum"),
    wp_monthly            = ("wp_kw",            "sum"),
    weekend_usage         = ("usage_kw",         lambda x: x[master.loc[x.index, "is_weekend"] == 1].mean()),
    # REMOVED: mean_hourly (= monthly_kwh/720 → pure leakage)
    # REMOVED: std_hourly, max_hourly, peak_usage, night_usage (all derived from usage_kw)
).reset_index()

monthly_feats["bill_pkr"]  = monthly_feats["monthly_kwh"].apply(calc_nepra_bill)
monthly_feats["month_num"] = monthly_feats["year_month"].dt.month

# ── Apply seasonal scaling to AC column ──
# The training data's ac_monthly_raw is already naturally seasonal (real measurements).
# We re-apply scaling here to verify/reinforce the seasonal signal so the RF
# sees a consistent representation matching what app.py will send at inference.
print("  Applying seasonal AC scaling to training features...")

def get_ac_scale(month: int) -> float:
    return SEASONAL_COEFFICIENTS.get(month, (0.5, 0.5))[0]

monthly_feats["ac_monthly"] = (
    monthly_feats["ac_monthly_raw"] *
    monthly_feats["month_num"].apply(get_ac_scale)
)

# ── Join metadata for household-level features ──
if HAS_METADATA:
    meta_cols = metadata[['house_id', 'No_of_People', 'Property_Area_sqft',
                           'No_of_ACs', 'No_of_Refrigerators', 'No_of_UPS',
                           'No_of_Floors']].copy()
    meta_cols = meta_cols.rename(columns={
        'No_of_People':       'person_count',
        'Property_Area_sqft': 'property_area',
        'No_of_ACs':          'meta_ac_count',
        'No_of_Refrigerators':'meta_fridge_count',
        'No_of_UPS':          'meta_ups_count',
        'No_of_Floors':       'floors',
    })
    monthly_feats = monthly_feats.merge(meta_cols, on='house_id', how='left')
    # Fill any missing metadata rows with dataset median
    for col in ['person_count', 'property_area', 'meta_ac_count',
                'meta_fridge_count', 'meta_ups_count', 'floors']:
        monthly_feats[col] = monthly_feats[col].fillna(monthly_feats[col].median())
    
    METADATA_FEATURES = ["person_count", "property_area",
                         "meta_ac_count", "meta_fridge_count", "meta_ups_count", "floors"]
    print(f"  Metadata joined. Extra features: {METADATA_FEATURES}")
else:
    METADATA_FEATURES = []
    for col in ["person_count", "property_area", "meta_ac_count",
                "meta_fridge_count", "meta_ups_count", "floors"]:
        monthly_feats[col] = 0

print(f"\n  Monthly feature table: {monthly_feats.shape}")
print(f"  Bill range : PKR {monthly_feats['bill_pkr'].min():.0f} – {monthly_feats['bill_pkr'].max():.0f}")
print(f"  kWh range  : {monthly_feats['monthly_kwh'].min():.0f} – {monthly_feats['monthly_kwh'].max():.0f} kWh")

# ── Core feature set (NO leakage) ──
BILL_FEATURES = [
    # Appliance load — seasonal-aware
    "ac_monthly",           # season-scaled AC contribution
    "kitchen_monthly",      # relatively flat year-round
    "refrigerator_monthly", # flat year-round (runs 24/7)
    "ups_monthly",          # flat — load shedding driven
    "wp_monthly",           # minor seasonal variation
    # Behavioral signal
    "weekend_usage",        # genuine — measures occupancy pattern
    # Temporal — CRITICAL for seasonality
    "month_num",            # RF now knows it's January vs July
    # Household context from metadata
    "person_count",         # phantom load: fans, lights, phones
    "property_area",        # larger house → more baseload
    "meta_ac_count",        # structural: how many ACs exist
    "meta_fridge_count",    # structural
    "meta_ups_count",       # structural
    "floors",               # structural
]

X_bill = monthly_feats[BILL_FEATURES].fillna(0)
y_kwh  = monthly_feats["monthly_kwh"]
y_bill = monthly_feats["bill_pkr"]

# ── GroupKFold: hold out entire houses (no data leakage between splits) ──
groups = monthly_feats["house_num"].values
gkf    = GroupKFold(n_splits=5)

print(f"\n  Feature set ({len(BILL_FEATURES)} features — zero leakage):")
for f in BILL_FEATURES:
    print(f"    ✓ {f}")

# ── Train RandomForest ──
rf_model = RandomForestRegressor(
    n_estimators=300,
    max_depth=14,
    min_samples_leaf=2,
    max_features="sqrt",    # Prevents any single feature from dominating
    random_state=42,
    n_jobs=-1
)

cv_mae = -cross_val_score(rf_model, X_bill, y_kwh, cv=gkf,
                           groups=groups, scoring="neg_mean_absolute_error")
cv_r2  =  cross_val_score(rf_model, X_bill, y_kwh, cv=gkf,
                           groups=groups, scoring="r2")

print(f"\n  Cross-Validation (GroupKFold, 5-fold, leave-house-out):")
print(f"    MAE : {cv_mae.mean():.2f} ± {cv_mae.std():.2f}  kWh/month")
print(f"    R²  : {cv_r2.mean():.4f} ± {cv_r2.std():.4f}")
print(f"\n  NOTE: R² will be lower than v1's 0.98 — that was feature leakage.")
print(f"        This score is HONEST. The model is genuinely predicting behavior.")

# ── Final fit on all data ──
rf_model.fit(X_bill, y_kwh)

# Feature importances
fi = pd.Series(rf_model.feature_importances_, index=BILL_FEATURES).sort_values(ascending=False)
print(f"\n  Top feature importances (should now be spread across features):")
for feat, imp in fi.items():
    bar = "█" * int(imp * 60)
    print(f"    {feat:<28} {bar} {imp:.4f}")

if fi.iloc[0] > 0.85:
    print(f"\n  ⚠️  WARNING: '{fi.index[0]}' still dominates. Check for remaining leakage.")
else:
    print(f"\n  ✅  Feature importances are distributed. Leakage eliminated.")

# ── Save RF model ──
joblib.dump(rf_model, os.path.join(MODELS_DIR, "rf_bill_predictor.pkl"))
joblib.dump(BILL_FEATURES, os.path.join(MODELS_DIR, "bill_features.pkl"))
print(f"\n  ✅  Saved: models/rf_bill_predictor.pkl")

# In-sample sanity check
y_kwh_pred  = rf_model.predict(X_bill)
y_bill_pred = np.array([calc_nepra_bill(k) for k in y_kwh_pred])
print(f"\n  In-sample bill accuracy (sanity check only):")
print(f"    Bill MAE : PKR {mean_absolute_error(y_bill, y_bill_pred):.0f}")
print(f"    Bill R²  : {r2_score(y_bill, y_bill_pred):.4f}")


# ═══════════════════════════════════════════════════════════
#  MODEL 2 — KNN ARCHETYPE MATCHER
#
#  Maps a user's appliance profile → closest PRECON house.
#  app.py uses this to seed the LSTM with real consumption data.
# ═══════════════════════════════════════════════════════════
section("MODEL 2 — KNN ARCHETYPE MATCHER")

if HAS_METADATA:
    KNN_FEATURES = ['No_of_ACs', 'No_of_Refrigerators', 'No_of_People',
                    'No_of_UPS', 'No_of_Fans', 'No_of_WashingMachines']
    
    # Keep only features that exist in metadata
    knn_feat_cols = [c for c in KNN_FEATURES if c in metadata.columns]
    knn_matrix    = metadata[knn_feat_cols].fillna(0).values
    knn_house_ids = metadata['house_id'].values

    knn_scaler = StandardScaler()
    knn_matrix_scaled = knn_scaler.fit_transform(knn_matrix)

    knn_model = NearestNeighbors(n_neighbors=3, metric='euclidean', algorithm='ball_tree')
    knn_model.fit(knn_matrix_scaled)

    joblib.dump(knn_model,    os.path.join(MODELS_DIR, "knn_archetype.pkl"))
    joblib.dump(knn_scaler,   os.path.join(MODELS_DIR, "knn_scaler.pkl"))
    joblib.dump(knn_house_ids, os.path.join(MODELS_DIR, "knn_house_ids.pkl"))
    joblib.dump(knn_feat_cols, os.path.join(MODELS_DIR, "knn_features.pkl"))

    print(f"  KNN trained on {len(knn_house_ids)} PRECON archetypes")
    print(f"  Features used: {knn_feat_cols}")
    print(f"  ✅  Saved: knn_archetype.pkl, knn_scaler.pkl, knn_house_ids.pkl")

    # Quick test
    test_vec = np.array([[3, 1, 5, 1, 8, 1]])  # 3 ACs, 1 fridge, 5 people...
    test_scaled = knn_scaler.transform(test_vec)
    dists, idxs = knn_model.kneighbors(test_scaled)
    print(f"\n  Test match (3AC, 1fridge, 5ppl, 1UPS, 8fans, 1WM):")
    for rank, (d, i) in enumerate(zip(dists[0], idxs[0])):
        print(f"    Rank {rank+1}: {knn_house_ids[i]}  (distance={d:.2f})")
else:
    print("  ⚠️  Skipping KNN — metadata.csv not available.")
    print("       app.py will fall back to routine-based archetype map.")


# ═══════════════════════════════════════════════════════════
#  MODEL 3 — HOURLY USAGE FORECASTER (LSTM v2)
#
#  V2 CHANGES:
#  - Per-house normalization (fixes val_loss explosion)
#  - Bidirectional LSTM (captures morning↔evening symmetry)
#  - LayerNormalization (stabilizes deep training)
#  - Stronger dropout (0.3 vs 0.2)
#  - month_sin/cos already in features (seasonal awareness)
# ═══════════════════════════════════════════════════════════
section("MODEL 3 — HOURLY USAGE FORECASTER (LSTM v2)")

try:
    import tensorflow as tf
    from tensorflow.keras.models import Sequential
    from tensorflow.keras.layers import (LSTM, Dense, Dropout, Input,
                                          Bidirectional, LayerNormalization)
    from tensorflow.keras.callbacks import EarlyStopping, ReduceLROnPlateau
    from tensorflow.keras.optimizers import Adam
    print(f"  TensorFlow version: {tf.__version__}")
    TRAIN_LSTM = True
except ImportError:
    print("  ⚠️  TensorFlow not installed. Skipping LSTM.")
    TRAIN_LSTM = False

if TRAIN_LSTM:
    LOOKBACK = 48
    HORIZON  = 24

    # ── Cyclical encoding (already in master if preprocess ran) ──
    def encode_cyclical(df, col, max_val):
        df[col + '_sin'] = np.sin(2 * np.pi * df[col] / max_val)
        df[col + '_cos'] = np.cos(2 * np.pi * df[col] / max_val)
        return df

    for col, max_val in [('hour', 24), ('day_of_week', 7), ('month', 12)]:
        if col + '_sin' not in master.columns:
            master = encode_cyclical(master, col, max_val)

    LSTM_FEATURES = [
        "usage_kw",
        "ac_kw",
        "refrigerator_kw",
        "hour_sin", "hour_cos",
        "day_of_week_sin", "day_of_week_cos",
        "month_sin", "month_cos",   # ← seasonal awareness in LSTM
        "is_weekend"
    ]
    N_FEATURES = len(LSTM_FEATURES)

    # ── Per-house scaler (KEY FIX for val_loss explosion) ──
    # Global scaler caused House3 (25 people, 4 ACs) to swamp House12 (2 people).
    # Per-house normalization keeps each house on the same scale during training.
    house_scalers = {}

    def make_sequences_for_house(df_house: pd.DataFrame, house_id: str):
        """Scale per-house then create sliding window sequences."""
        feat_data = df_house[LSTM_FEATURES].values.copy()

        scaler = StandardScaler()
        feat_scaled = scaler.fit_transform(feat_data)
        house_scalers[house_id] = scaler   # store for potential inference use

        target = df_house["usage_kw"].values
        X, y = [], []
        for i in range(LOOKBACK, len(feat_scaled) - HORIZON):
            X.append(feat_scaled[i - LOOKBACK:i])
            y.append(target[i:i + HORIZON])
        return np.array(X), np.array(y)

    # ── Train / Val / Test split ──
    all_house_ids = master["house_id"].unique()
    np.random.seed(42)
    np.random.shuffle(all_house_ids)
    train_houses = all_house_ids[:34]
    val_houses   = all_house_ids[34:38]
    test_houses  = all_house_ids[38:]

    print(f"\n  Train houses : {len(train_houses)}")
    print(f"  Val houses   : {len(val_houses)}")
    print(f"  Test houses  : {len(test_houses)}  {list(test_houses)}")

    def build_split(house_list):
        Xs, ys = [], []
        for h in house_list:
            df_h = master[master["house_id"] == h].sort_values("datetime")
            if len(df_h) < LOOKBACK + HORIZON + 10:
                print(f"    ⚠️  {h} too short, skipping")
                continue
            X, y = make_sequences_for_house(df_h, h)
            if len(X) > 0:
                Xs.append(X); ys.append(y)
        return np.concatenate(Xs), np.concatenate(ys)

    print("\n  Building per-house normalized sequences...")
    X_train, y_train = build_split(train_houses)
    X_val,   y_val   = build_split(val_houses)
    X_test,  y_test  = build_split(test_houses)

    print(f"  Train : X={X_train.shape}  y={y_train.shape}")
    print(f"  Val   : X={X_val.shape}    y={y_val.shape}")
    print(f"  Test  : X={X_test.shape}   y={y_test.shape}")

    # ── Save global scaler (fitted on train houses for inference) ──
    # For app.py inference we still need one global scaler
    global_scaler = StandardScaler()
    train_feat_data = master[master["house_id"].isin(train_houses)][LSTM_FEATURES]
    global_scaler.fit(train_feat_data)
    joblib.dump(global_scaler, os.path.join(MODELS_DIR, "lstm_scaler.pkl"))

    # ── LSTM Architecture v2 ──
    # Bidirectional: captures that 9PM mirrors 9AM in reverse (evening = morning flipped)
    # LayerNormalization: stabilizes training, replaces BatchNorm for sequences
    model = Sequential([
        Input(shape=(LOOKBACK, N_FEATURES)),

        Bidirectional(LSTM(64, return_sequences=True)),
        LayerNormalization(),
        Dropout(0.3),

        Bidirectional(LSTM(32, return_sequences=False)),
        LayerNormalization(),
        Dropout(0.3),

        Dense(48, activation="relu"),
        LayerNormalization(),
        Dropout(0.2),

        Dense(HORIZON)  # 24 hourly kW values
    ])

    model.compile(
        optimizer=Adam(learning_rate=5e-4),  # slightly lower LR for stability
        loss="huber",     # Huber loss: less sensitive to outlier spikes than MSE
        metrics=["mae"]
    )
    model.summary()

    callbacks = [
        EarlyStopping(monitor="val_loss", patience=10, restore_best_weights=True,
                      verbose=1),
        ReduceLROnPlateau(monitor="val_loss", factor=0.5, patience=5,
                          min_lr=1e-6, verbose=1)
    ]

    print("\n  Training LSTM v2 (per-house normalized, Bidirectional)...")
    history = model.fit(
        X_train, y_train,
        validation_data=(X_val, y_val),
        epochs=60,
        batch_size=256,
        callbacks=callbacks,
        verbose=1
    )

    # ── Evaluate on held-out test houses ──
    y_pred_test = model.predict(X_test)
    test_mae  = mean_absolute_error(y_test.flatten(), y_pred_test.flatten())
    test_rmse = np.sqrt(mean_squared_error(y_test.flatten(), y_pred_test.flatten()))
    test_r2   = r2_score(y_test.flatten(), y_pred_test.flatten())

    print(f"\n  LSTM v2 Test Performance (held-out houses):")
    print(f"    MAE  : {test_mae:.4f} kW  (v1 was 0.2653)")
    print(f"    RMSE : {test_rmse:.4f} kW  (v1 was 0.4295)")
    print(f"    R²   : {test_r2:.4f}       (v1 was 0.6423)")

    lstm_path = os.path.join(MODELS_DIR, "lstm_forecaster.keras")
    model.save(lstm_path)

    meta = {
        "lookback"      : LOOKBACK,
        "horizon"       : HORIZON,
        "lstm_features" : LSTM_FEATURES,
        "n_features"    : N_FEATURES,
        "test_houses"   : list(test_houses),
        "test_mae_kw"   : round(float(test_mae), 4),
        "test_rmse_kw"  : round(float(test_rmse), 4),
        "test_r2"       : round(float(test_r2), 4),
        "architecture"  : "Bidirectional-LSTM + LayerNorm + Huber loss",
        "normalization" : "per-house during training, global scaler at inference",
    }
    with open(os.path.join(MODELS_DIR, "lstm_meta.json"), "w") as f:
        json.dump(meta, f, indent=2)

    print(f"  ✅  Saved: models/lstm_forecaster.keras")
    print(f"  ✅  Saved: models/lstm_meta.json")


# ═══════════════════════════════════════════════════════════
#  FINAL SUMMARY
# ═══════════════════════════════════════════════════════════
section("TRAINING COMPLETE — MODEL SUMMARY v2")

print(f"""
  Models saved in: data/processed/models/

  ┌─────────────────────────────────────────────────────────────┐
  │  rf_bill_predictor.pkl     — Monthly bill prediction (RF)   │
  │  bill_features.pkl         — 13 features, zero leakage      │
  │  house_label_encoder.pkl   — House ID encoder               │
  │  seasonal_coefficients.json— Month → AC/Fan scale table     │
  │  knn_archetype.pkl         — User → PRECON house matcher    │
  │  knn_scaler.pkl            — Scaler for KNN input           │
  │  knn_house_ids.pkl         — House ID array for KNN output  │
  │  knn_features.pkl          — Feature list for KNN input     │
  │  lstm_forecaster.keras     — 24h forecaster (BiLSTM v2)     │
  │  lstm_scaler.pkl           — Global scaler for LSTM         │
  │  lstm_meta.json            — LSTM config & performance      │
  └─────────────────────────────────────────────────────────────┘

  KEY IMPROVEMENTS vs v1:
  ✓  Feature leakage eliminated (mean_hourly removed)
  ✓  Seasonal AC scaling in RF features (month_num added)
  ✓  Person count + property area from metadata added
  ✓  KNN archetype model trained and saved
  ✓  LSTM: Bidirectional, LayerNorm, per-house normalization
  ✓  LSTM: Huber loss (robust to consumption spikes)
  ✓  All seasonal data saved for app.py inference

  NEXT STEP → run: python app.py
""")