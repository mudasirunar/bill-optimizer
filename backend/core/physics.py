import os
import json
import numpy as np
from datetime import datetime
from config import (
    MODELS_DIR,
    DISCO_PROFILES,
    DISCO_DEFAULT,
    SEASONAL_AC_SCALE,
    FAN_DAILY_HOURS,
    WM_LOAD_KW,
    ROUTINE_FACTORS
)

# Load seasonal coefficients
coefficients_path = os.path.join(MODELS_DIR, "seasonal_coefficients.json")
try:
    with open(coefficients_path) as f:
        _raw = json.load(f)
        SEASONAL_COEFFICIENTS = {int(k): tuple(v) for k, v in _raw.items()}
except Exception as e:
    print(f"⚠️ Warning: Could not load seasonal coefficients from {coefficients_path}: {e}")
    # Fallback default coefficients
    SEASONAL_COEFFICIENTS = {m: (0.5, 0.5) for m in range(1, 13)}


def safe_get(data, key, default=0.0):
    val = data.get(key)
    if val is None or val == "":
        return default
    try:
        return float(val)
    except:
        return default


def get_current_month() -> int:
    return datetime.now().month


def encode_cyclical(val, max_val):
    angle = 2 * np.pi * val / max_val
    return np.sin(angle), np.cos(angle)


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


def compute_true_baseload(u: dict, month: int) -> dict:
    """
    First-principles Pakistani residential consumption.
    
    Three key design rules:
    1. Fridge = monthly constant (not hours × days — it runs 24/7)
    2. AC = user_reported_hours × seasonal_scale
    3. Fans = qty × wattage × monthly_hours × 0.7 occupancy factor
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
    f_base   = 43.0 if u.get('f_type') == 'old' else 24.0
    f_kwh    = safe_get(u, 'f_qty', 0.0) * f_base * (1.0 + 0.15 * ac_sc)
 
    # ── 5. WATER PUMP ──
    wp_kw    = safe_get(u, 'wp_type', 1.0) * 0.746
    wp_freq  = safe_get(u, 'wp_freq', 30.0) 
    wp_kwh   = safe_get(u, 'wp_qty', 0.0) * wp_kw * safe_get(u, 'wp_val', 0.0) * wp_freq
 
    # ── 6. KITCHEN & WASHING ──
    k_freq   = safe_get(u, 'k_freq', 30.0)
    k_kwh    = safe_get(u, 'k_qty', 0.0) * 1.20 * safe_get(u, 'k_val', 0.0) * k_freq
    
    wm_kw    = WM_LOAD_KW.get(u.get('wm_type', 'manual'), 0.35)
    wm_freq  = safe_get(u, 'wm_freq', 4.3)
    wm_kwh   = safe_get(u, 'wm_qty', 0.0) * wm_kw * safe_get(u, 'wm_val', 0.0) * wm_freq
 
    # ── 7. UPS ──
    u_freq   = safe_get(u, 'u_freq', 30.0)
    ups_kwh  = safe_get(u, 'u_qty', 0.0) * 0.15 * safe_get(u, 'u_val', 0.0) * u_freq
 
    # ── 8. CLOTHES IRON ──
    iron_kw   = 1.00
    iron_freq = safe_get(u, 'iron_freq', 4.3)
    iron_kwh  = safe_get(u, 'iron_qty', 0.0) * iron_kw * safe_get(u, 'iron_val', 0.0) * iron_freq

    total    = p_base + a_light + fans_kwh + ac_kwh + f_kwh + wp_kwh + k_kwh + wm_kwh + ups_kwh + iron_kwh
 
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
        "iron":          round(iron_kwh, 2),
    }
