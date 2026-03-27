"""
=============================================================
  PRECON Dataset Analyzer
  FYP: AI-Powered Electricity Bill Optimization
  Run from: bill-optimizer/backend/
  Usage: python analyze_data.py
=============================================================
"""

import os
import pandas as pd
import numpy as np

# ─────────────────────────────────────────
#  CONFIG — adjust if your path differs
# ─────────────────────────────────────────
RAW_DATA_DIR = os.path.join(os.path.dirname(__file__), "..", "data", "raw")
METADATA_FILE = os.path.join(RAW_DATA_DIR, "metadata.csv")

DIVIDER = "=" * 70
SECTION  = "-" * 70


def section(title: str):
    print(f"\n{DIVIDER}")
    print(f"  {title}")
    print(DIVIDER)


def subsection(title: str):
    print(f"\n{SECTION}")
    print(f"  {title}")
    print(SECTION)


# ─────────────────────────────────────────
#  1. METADATA ANALYSIS
# ─────────────────────────────────────────
section("1. METADATA ANALYSIS")

if os.path.exists(METADATA_FILE):
    meta = pd.read_csv(METADATA_FILE)
    print(f"\n  Shape         : {meta.shape[0]} rows × {meta.shape[1]} columns")
    print(f"\n  Columns       :\n    {list(meta.columns)}")
    print(f"\n  Data Types    :\n{meta.dtypes.to_string()}")
    print(f"\n  Null Values   :\n{meta.isnull().sum().to_string()}")
    print(f"\n  Preview (first 5 rows):\n")
    print(meta.head().to_string(index=False))

    # Numeric summary
    numeric_cols = meta.select_dtypes(include=[np.number]).columns.tolist()
    if numeric_cols:
        print(f"\n  Numeric Column Summary:\n")
        print(meta[numeric_cols].describe().to_string())
else:
    print(f"\n  [WARNING] metadata.csv not found at: {METADATA_FILE}")


# ─────────────────────────────────────────
#  2. SCAN ALL 42 CSV FILES
# ─────────────────────────────────────────
section("2. INDIVIDUAL HOUSE CSV ANALYSIS")

csv_files = sorted([
    f for f in os.listdir(RAW_DATA_DIR)
    if f.endswith(".csv") and f.lower() != "metadata.csv"
])

print(f"\n  Total house CSV files found: {len(csv_files)}\n")

summary_rows = []   # for the big summary table at the end
problem_files = []  # files with issues

for i, fname in enumerate(csv_files):
    fpath = os.path.join(RAW_DATA_DIR, fname)
    subsection(f"File {i+1:02d} / {len(csv_files)}  ──  {fname}")

    try:
        df = pd.read_csv(fpath, low_memory=False)

        n_rows, n_cols = df.shape
        col_names      = list(df.columns)
        null_counts    = df.isnull().sum()
        null_pct       = (null_counts / n_rows * 100).round(2)
        dtypes         = df.dtypes
        duplicates     = df.duplicated().sum()

        print(f"\n  Rows         : {n_rows:,}")
        print(f"  Columns      : {n_cols}")
        print(f"  Column Names : {col_names}")
        print(f"\n  Data Types   :")
        for col in col_names:
            print(f"    {col:<35} {str(dtypes[col]):<12}  "
                  f"nulls: {null_counts[col]:>6}  ({null_pct[col]:.1f}%)")

        print(f"\n  Duplicate rows    : {duplicates:,}")

        # Try to detect datetime column
        datetime_col = None
        for col in col_names:
            if any(kw in col.lower() for kw in ["time", "date", "timestamp", "ts"]):
                datetime_col = col
                break

        if datetime_col:
            try:
                df[datetime_col] = pd.to_datetime(df[datetime_col], infer_datetime_format=True)
                t_min = df[datetime_col].min()
                t_max = df[datetime_col].max()
                span  = t_max - t_min
                print(f"\n  Datetime column   : '{datetime_col}'")
                print(f"  Date range        : {t_min}  →  {t_max}")
                print(f"  Total time span   : {span}")

                # Check gaps (minute-level expected)
                df_sorted = df.sort_values(datetime_col)
                diffs = df_sorted[datetime_col].diff().dropna()
                most_common_freq = diffs.mode()[0]
                gap_threshold = pd.Timedelta("5 min")
                large_gaps = diffs[diffs > gap_threshold]
                print(f"  Most common freq  : {most_common_freq}")
                print(f"  Gaps > 5 min      : {len(large_gaps):,}")
                if len(large_gaps) > 0:
                    print(f"  Largest gap       : {diffs.max()}")
            except Exception as e:
                print(f"  [WARN] Could not parse datetime column '{datetime_col}': {e}")

        # Numeric columns stats
        numeric_cols = df.select_dtypes(include=[np.number]).columns.tolist()
        if numeric_cols:
            print(f"\n  Numeric Columns Summary:")
            print(df[numeric_cols].describe().round(3).to_string())

        # Check for negative values in energy/power columns
        for col in numeric_cols:
            neg_count = (df[col] < 0).sum()
            if neg_count > 0:
                print(f"\n  [!] Negative values in '{col}': {neg_count}")

        summary_rows.append({
            "file"          : fname,
            "rows"          : n_rows,
            "columns"       : n_cols,
            "col_names"     : str(col_names),
            "null_total"    : null_counts.sum(),
            "duplicates"    : duplicates,
            "date_range"    : f"{t_min} → {t_max}" if datetime_col else "N/A",
        })

    except Exception as e:
        print(f"\n  [ERROR] Could not read file: {e}")
        problem_files.append(fname)
        summary_rows.append({
            "file": fname, "rows": "ERROR", "columns": "ERROR",
            "col_names": str(e), "null_total": "-", "duplicates": "-",
            "date_range": "-",
        })


# ─────────────────────────────────────────
#  3. CONSOLIDATED SUMMARY TABLE
# ─────────────────────────────────────────
section("3. CONSOLIDATED SUMMARY TABLE")

summary_df = pd.DataFrame(summary_rows)
print(f"\n{summary_df[['file','rows','columns','null_total','duplicates','date_range']].to_string(index=False)}")


# ─────────────────────────────────────────
#  4. CROSS-FILE CONSISTENCY CHECK
# ─────────────────────────────────────────
section("4. CROSS-FILE CONSISTENCY CHECK")

valid_summaries = [r for r in summary_rows if r["rows"] != "ERROR"]
all_col_sets    = [r["col_names"] for r in valid_summaries]
unique_schemas  = set(all_col_sets)

print(f"\n  Files read successfully : {len(valid_summaries)}")
print(f"  Files with errors       : {len(problem_files)}")
if problem_files:
    print(f"  Problem files           : {problem_files}")

print(f"\n  Unique column schemas   : {len(unique_schemas)}")
if len(unique_schemas) == 1:
    print("  ✅ All files share the same column structure.")
else:
    print("  ⚠️  Column structures differ across files — review before merging!")
    for idx, schema in enumerate(unique_schemas, 1):
        count = all_col_sets.count(schema)
        print(f"\n  Schema {idx} ({count} file(s)): {schema}")

# Row count stats
row_counts = [r["rows"] for r in valid_summaries if isinstance(r["rows"], int)]
if row_counts:
    print(f"\n  Row counts across files:")
    print(f"    Min      : {min(row_counts):,}")
    print(f"    Max      : {max(row_counts):,}")
    print(f"    Mean     : {int(np.mean(row_counts)):,}")
    print(f"    Median   : {int(np.median(row_counts)):,}")
    print(f"    Total    : {sum(row_counts):,}")


# ─────────────────────────────────────────
#  5. QUICK RECOMMENDATIONS
# ─────────────────────────────────────────
section("5. QUICK OBSERVATIONS (paste output + share with Claude)")

print("""
  After running this script, share the console output and we will:

  Step A — Preprocessing plan:
    • Decide which columns to keep / drop
    • Handle nulls (forward-fill, interpolation, or drop)
    • Handle duplicates & large time gaps
    • Resample from per-minute → per-hour or per-day

  Step B — Feature engineering:
    • Extract hour-of-day, day-of-week, month, season
    • Compute rolling averages (24h, 7-day)
    • Map NEPRA slab tariffs to usage levels

  Step C — Model training:
    • LSTM for time-series forecasting
    • RandomForest for appliance-level predictions
    • Cross-validate on held-out houses

  Share the output now and we move to preprocess.py!
""")

print(DIVIDER)
print("  Analysis complete. Copy the full console output and share it.")
print(DIVIDER)