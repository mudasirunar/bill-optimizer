"""
=============================================================
  PRECON Dataset Preprocessor
  FYP: AI-Powered Electricity Bill Optimization
  Run from: bill-optimizer/backend/
  Usage: python preprocess.py
  Output: ../data/processed/
=============================================================
"""

import os
import pandas as pd
import numpy as np

# ─────────────────────────────────────────
#  PATHS
# ─────────────────────────────────────────
BASE_DIR      = os.path.dirname(__file__)
RAW_DIR       = os.path.join(BASE_DIR, "..", "data", "raw")
PROCESSED_DIR = os.path.join(BASE_DIR, "..", "data", "processed")
os.makedirs(PROCESSED_DIR, exist_ok=True)

DIVIDER = "=" * 70

def section(title):
    print(f"\n{DIVIDER}\n  {title}\n{DIVIDER}")

# ─────────────────────────────────────────
#  NEPRA SLAB TARIFF (2023-24 residential)
#  Units: PKR per kWh
# ─────────────────────────────────────────
NEPRA_SLABS = [
    (0,    50,   3.95),
    (51,  100,   7.74),
    (101, 200,  10.06),
    (201, 300,  12.15),
    (301, 700,  19.55),
    (701, float("inf"), 22.65),
]

def calc_nepra_bill(monthly_kwh: float) -> float:
    """Calculate monthly electricity bill based on NEPRA slab tariffs."""
    bill = 0.0
    remaining = monthly_kwh
    prev_limit = 0
    for low, high, rate in NEPRA_SLABS:
        if remaining <= 0:
            break
        slab_size = high - prev_limit if high != float("inf") else remaining
        units_in_slab = min(remaining, slab_size)
        bill += units_in_slab * rate
        remaining -= units_in_slab
        prev_limit = high
    return round(bill, 2)


# ─────────────────────────────────────────
#  APPLIANCE COLUMN NORMALIZER
#  Maps messy column names → standard names
# ─────────────────────────────────────────
APPLIANCE_MAP = {
    # AC variants → ac_kw
    "AC_BR_kW":    "ac_kw", "AC_LR_kW":  "ac_kw", "AC_DR_kW":   "ac_kw",
    "AC_MBR_kW":   "ac_kw", "AC_MB_kW":  "ac_kw", "AC_DNR_kW":  "ac_kw",
    "AC_BR1_kW":   "ac_kw", "AC_BR2_kW": "ac_kw", "AC_BR3_kW":  "ac_kw",
    "AC_BR_kW.1":  "ac_kw", "AC_BR_kW.2":"ac_kw", "AC_kW":      "ac_kw",
    "AC_kW.1":     "ac_kw", "AC_Reg_kW": "ac_kw", "W_AC_kW":    "ac_kw",
    "Ac_kW":       "ac_kw",
    # Refrigerator variants
    "Refrigerator_kW": "refrigerator_kw", "Regrigerator_kW": "refrigerator_kw",
    # Kitchen
    "Kitchen_kW":  "kitchen_kw",
    # UPS
    "UPS_kW":      "ups_kw",
    # Water pump
    "WP_kW":       "wp_kw",
    # Washing / dryer
    "WD_kW":       "wd_kw", "Laundary_kW": "wd_kw",
    # Bedroom general
    "BR_kW":       "br_kw",
}

APPLIANCE_COLS = ["ac_kw", "refrigerator_kw", "kitchen_kw", "ups_kw",
                  "wp_kw", "wd_kw", "br_kw"]

# ─────────────────────────────────────────
#  STEP 1 — LOAD & FIX ONE HOUSE FILE
# ─────────────────────────────────────────
def load_house(filepath: str, house_id: str) -> pd.DataFrame:
    df = pd.read_csv(filepath, low_memory=False)

    # --- Fix datetime (no deprecated infer_datetime_format) ---
    df["Date_Time"] = pd.to_datetime(df["Date_Time"], dayfirst=False, errors="coerce")
    df = df.dropna(subset=["Date_Time"])          # drop unparseable rows
    df = df.sort_values("Date_Time").reset_index(drop=True)
    df = df.set_index("Date_Time")

    # --- Clip to exactly 1 year (use most-populated 365-day window) ---
    year_span = pd.Timedelta(days=365)
    start_date = df.index.min()
    end_date   = start_date + year_span
    df = df[df.index < end_date]

    # --- Rename raw columns to standard names (additive — sums duplicates) ---
    df = df.rename(columns={"Usage_kW": "usage_kw"})
    appliance_data = {}
    for raw_col, std_col in APPLIANCE_MAP.items():
        if raw_col in df.columns:
            if std_col not in appliance_data:
                appliance_data[std_col] = df[raw_col].values.copy()
            else:
                appliance_data[std_col] += df[raw_col].values  # sum duplicates
            df.drop(columns=[raw_col], inplace=True, errors="ignore")

    for std_col, values in appliance_data.items():
        df[std_col] = values

    # Ensure all standard appliance columns exist (fill with 0 if missing)
    for col in APPLIANCE_COLS:
        if col not in df.columns:
            df[col] = 0.0

    # Keep only needed columns
    keep = ["usage_kw"] + APPLIANCE_COLS
    df = df[[c for c in keep if c in df.columns]]

    # --- Clip outliers: usage > 15 kW is physically unreasonable ---
    df["usage_kw"] = df["usage_kw"].clip(lower=0, upper=15)
    for col in APPLIANCE_COLS:
        df[col] = df[col].clip(lower=0, upper=10)

    # --- Resample: 1-minute → 1-hour (mean power in kW) ---
    df_hourly = df.resample("1h").mean()

    # Forward-fill short gaps (≤ 2 consecutive hours), then drop remaining NaN
    df_hourly = df_hourly.ffill(limit=2).dropna()

    # --- Add time-based features ---
    df_hourly["house_id"]     = house_id
    df_hourly["hour"]         = df_hourly.index.hour
    df_hourly["day_of_week"]  = df_hourly.index.dayofweek   # 0=Mon, 6=Sun
    df_hourly["month"]        = df_hourly.index.month
    df_hourly["is_weekend"]   = (df_hourly.index.dayofweek >= 5).astype(int)
    df_hourly["season"]       = df_hourly["month"].map({
        12: "winter", 1: "winter", 2: "winter",
        3:  "spring", 4: "spring", 5: "spring",
        6:  "summer", 7: "summer", 8: "summer",
        9:  "autumn",10: "autumn",11: "autumn",
    })

    # --- Daily kWh (used for NEPRA bill calculation) ---
    df_hourly["daily_kwh"] = df_hourly.groupby(
        df_hourly.index.date
    )["usage_kw"].transform("sum")

    # --- Rolling features (lag-based, crucial for LSTM) ---
    df_hourly["usage_lag_1h"]   = df_hourly["usage_kw"].shift(1)
    df_hourly["usage_lag_24h"]  = df_hourly["usage_kw"].shift(24)
    df_hourly["usage_roll_24h"] = df_hourly["usage_kw"].rolling(24, min_periods=6).mean()
    df_hourly["usage_roll_7d"]  = df_hourly["usage_kw"].rolling(24*7, min_periods=24).mean()

    # Drop first 7 days worth of rows where rolling features are NaN
    df_hourly = df_hourly.dropna(subset=["usage_lag_24h", "usage_roll_7d"])

    return df_hourly


# ─────────────────────────────────────────
#  STEP 2 — PROCESS ALL HOUSES
# ─────────────────────────────────────────
section("STEP 1 — Processing individual house files")

csv_files = sorted([
    f for f in os.listdir(RAW_DIR)
    if f.endswith(".csv") and f.lower() != "metadata.csv"
])

all_dfs      = []
skipped      = []
per_house_monthly = []   # for bill calculation

for fname in csv_files:
    house_id = fname.replace(".csv", "")
    fpath    = os.path.join(RAW_DIR, fname)
    try:
        df = load_house(fpath, house_id)
        n_hours = len(df)
        print(f"  ✅  {house_id:<12}  →  {n_hours:,} hourly rows  |  "
              f"usage range: {df['usage_kw'].min():.2f}–{df['usage_kw'].max():.2f} kW")

        # --- Compute monthly kWh and estimated bill per house ---
        df["year_month"] = df.index.to_period("M")
        monthly = df.groupby("year_month")["usage_kw"].sum().reset_index()
        monthly.columns = ["year_month", "monthly_kwh"]
        monthly["house_id"]     = house_id
        monthly["bill_pkr"]     = monthly["monthly_kwh"].apply(calc_nepra_bill)
        per_house_monthly.append(monthly)

        all_dfs.append(df.drop(columns=["year_month"]))

    except Exception as e:
        print(f"  ❌  {house_id:<12}  →  ERROR: {e}")
        skipped.append(fname)

print(f"\n  Processed : {len(all_dfs)} houses")
print(f"  Skipped   : {len(skipped)} houses  {skipped if skipped else ''}")


# ─────────────────────────────────────────
#  STEP 3 — COMBINE ALL HOUSES
# ─────────────────────────────────────────
section("STEP 2 — Combining into master dataset")

master_df = pd.concat(all_dfs, axis=0)
master_df = master_df.reset_index().rename(columns={"Date_Time": "datetime"})

print(f"  Master dataset shape : {master_df.shape}")
print(f"  Columns              : {list(master_df.columns)}")
print(f"  Houses included      : {master_df['house_id'].nunique()}")
print(f"  Date range           : {master_df['datetime'].min()}  →  {master_df['datetime'].max()}")
print(f"  Null check           : {master_df.isnull().sum().sum()} total nulls")


# ─────────────────────────────────────────
#  STEP 4 — SAVE OUTPUTS
# ─────────────────────────────────────────
section("STEP 3 — Saving processed files")

# 4a. Master hourly dataset (all houses)
master_path = os.path.join(PROCESSED_DIR, "master_hourly.csv")
master_df.to_csv(master_path, index=False)
print(f"  ✅  Saved: master_hourly.csv  ({len(master_df):,} rows)")

# 4b. Monthly bills dataset (for training bill predictor)
bills_df = pd.concat(per_house_monthly, ignore_index=True)
bills_path = os.path.join(PROCESSED_DIR, "monthly_bills.csv")
bills_df.to_csv(bills_path, index=False)
print(f"  ✅  Saved: monthly_bills.csv  ({len(bills_df):,} rows)")

# 4c. Per-house hourly CSVs (for per-house model fine-tuning)
per_house_dir = os.path.join(PROCESSED_DIR, "per_house")
os.makedirs(per_house_dir, exist_ok=True)
for house_id, grp in master_df.groupby("house_id"):
    grp.to_csv(os.path.join(per_house_dir, f"{house_id}_hourly.csv"), index=False)
print(f"  ✅  Saved per-house CSVs in: processed/per_house/")


# ─────────────────────────────────────────
#  STEP 5 — SUMMARY STATISTICS
# ─────────────────────────────────────────
section("STEP 4 — Summary Statistics")

print("\n  Monthly Bills Preview:")
print(bills_df.groupby("house_id")[["monthly_kwh", "bill_pkr"]].mean().round(1).to_string())

print(f"\n  Average monthly consumption : {bills_df['monthly_kwh'].mean():.1f} kWh")
print(f"  Average monthly bill        : PKR {bills_df['bill_pkr'].mean():.0f}")
print(f"  Min monthly bill            : PKR {bills_df['bill_pkr'].min():.0f}")
print(f"  Max monthly bill            : PKR {bills_df['bill_pkr'].max():.0f}")

print(f"\n  Master dataset memory usage : "
      f"{master_df.memory_usage(deep=True).sum() / 1e6:.1f} MB")

print(f"""
{DIVIDER}
  NEXT STEP → run: python train_model.py
  This will train:
    1. RandomForestRegressor  — for monthly bill prediction
    2. LSTM                   — for hourly usage forecasting
{DIVIDER}
""")