import os
import sys
import tensorflow as tf

# ─────────────────────────────────────────
#  ENVIRONMENT SETUP
# ─────────────────────────────────────────
# Load local .env file into os.environ if it exists
try:
    dotenv_path = os.path.join(os.path.dirname(os.path.abspath(__file__)), ".env")
    if os.path.exists(dotenv_path):
        with open(dotenv_path, "r") as f:
            for line in f:
                line = line.strip()
                if line and not line.startswith("#") and "=" in line:
                    key, val = line.split("=", 1)
                    os.environ[key.strip()] = val.strip()
except Exception as e:
    print(f"⚠️  Manual .env loading warning: {e}")

# ── Render Free Tier Memory Optimization ──
# Limits TensorFlow CPU threads to reduce RAM usage
# Does NOT affect model accuracy or predictions
tf.config.threading.set_inter_op_parallelism_threads(1)
tf.config.threading.set_intra_op_parallelism_threads(1)

# Prevent TensorFlow from grabbing all available RAM upfront
tf.config.set_soft_device_placement(True)
gpus = tf.config.list_physical_devices('GPU')
if gpus:
    for gpu in gpus:
        tf.config.experimental.set_memory_growth(gpu, True)

# ─────────────────────────────────────────
#  PATHS
# ─────────────────────────────────────────
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
MODELS_DIR = os.path.join(BASE_DIR, "data", "processed", "models")

# ─────────────────────────────────────────
#  PAKISTAN DISCO REGIONAL ARCHETYPES
# ─────────────────────────────────────────
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

# ─────────────────────────────────────────
#  APPLIANCE CONFIGURATIONS
# ─────────────────────────────────────────
# Per-person monthly kWh (no AC): lights + phone + shared TV + misc
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

WM_LOAD_KW = {
    "manual":    0.25, # 250W motor
    "automatic": 0.45, # 450W motor + electric valve controls
}

ROUTINE_FACTORS = {
    "standard":       1.00,
    "morning_active": 1.04,
    "evening_active": 1.08,
    "all_day":        1.15,
}

# ─────────────────────────────────────────
#  LSTM FEATURES DEFINITIONS
# ─────────────────────────────────────────
LSTM_FEATURES = [
    "usage_kw", "ac_kw", "refrigerator_kw",
    "hour_sin", "hour_cos", "day_of_week_sin", "day_of_week_cos",
    "month_sin", "month_cos", "is_weekend"
]
