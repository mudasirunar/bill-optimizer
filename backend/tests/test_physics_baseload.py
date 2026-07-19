import os
import sys
import unittest
from unittest.mock import MagicMock

# 1. Mock external heavy modules before importing app.py to speed up tests and avoid loading models/Firebase
sys.modules['firebase_admin'] = MagicMock()
sys.modules['firebase_admin.credentials'] = MagicMock()
sys.modules['firebase_admin.firestore'] = MagicMock()
sys.modules['tensorflow'] = MagicMock()
sys.modules['joblib'] = MagicMock()

# Ensure the backend directory is in the path
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))

# Import targeted functions from core packages
from core.physics import (
    safe_get,
    get_current_month,
    get_seasonal_ac_scale,
    get_seasonal_fan_scale,
    apply_seasonal_scaling,
    compute_true_baseload,
    encode_cyclical
)
from core.history import compute_recency_weighted_avg, compute_usage_drift
from core.ml_predictor import get_blend_weights

class TestPhysicsBaseload(unittest.TestCase):

    def test_safe_get(self):
        data = {"key1": "12.5", "key2": 42, "key3": None, "key4": "not_a_float"}
        self.assertEqual(safe_get(data, "key1"), 12.5)
        self.assertEqual(safe_get(data, "key2"), 42.0)
        self.assertEqual(safe_get(data, "key3", 5.0), 5.0)
        self.assertEqual(safe_get(data, "key4", 10.0), 10.0)
        self.assertEqual(safe_get(data, "key5", 1.0), 1.0)

    def test_get_current_month(self):
        month = get_current_month()
        self.assertTrue(1 <= month <= 12)

    def test_seasonal_scales(self):
        # Verify AC scaling and Fan scaling for summer/winter months
        # Let's check June (6) vs December (12)
        june_ac = get_seasonal_ac_scale(6)
        dec_ac = get_seasonal_ac_scale(12)
        # June should be higher than December
        self.assertTrue(june_ac > dec_ac)

        june_fan = get_seasonal_fan_scale(6)
        dec_fan = get_seasonal_fan_scale(12)
        self.assertTrue(june_fan >= dec_fan)

    def test_apply_seasonal_scaling(self):
        appliance_kwh = {
            'ac_monthly': 100,
            'refrigerator_monthly': 100,
            'kitchen_monthly': 100
        }
        # Scaled June
        scaled_june = apply_seasonal_scaling(appliance_kwh, 6)
        # Scaled Dec
        scaled_dec = apply_seasonal_scaling(appliance_kwh, 12)

        # June AC should be scaled higher
        self.assertTrue(scaled_june['ac_monthly'] > scaled_dec['ac_monthly'])

    def test_compute_true_baseload_default(self):
        # Empty user dict to verify default values
        u = {}
        res = compute_true_baseload(u, 6)
        self.assertIn("total", res)
        self.assertIn("person_base", res)
        self.assertIn("area_lighting", res)
        self.assertIn("fans", res)
        self.assertIn("ac", res)
        self.assertIn("fridge", res)

    def test_compute_true_baseload_appliances(self):
        # Configure standard & inverter ACs, refrigerator, pump, fans, etc.
        u = {
            "disco": "K-Electric",
            "person_count": 4,
            "property_area": 1000,
            "fan_ac_qty": 3,
            "fan_dc_qty": 2,
            "ac_std_qty": 1,
            "ac_std_val": 6.0,
            "ac_inv_qty": 1,
            "ac_inv_val": 8.0,
            "f_type": "new",  # inverter base
            "f_qty": 1,
            "wp_type": 1.0,
            "wp_qty": 1,
            "wp_val": 1.0,
            "wp_freq": 30.0,  # daily
            "k_qty": 1,
            "k_val": 0.5,
            "k_freq": 30.0,
            "wm_qty": 1,
            "wm_val": 1.0,
            "wm_type": "automatic",
            "wm_freq": 4.3,
            "u_qty": 1,
            "u_val": 2.0,
            "u_freq": 30.0,
            "iron_qty": 1,
            "iron_val": 1.5,
            "iron_freq": 4.3
        }
        res = compute_true_baseload(u, 6) # June simulation
        
        # Verify parts of calculation
        # Std AC kwh: 1 * 1.50 * (6.0 * ac_scale) * 30
        # June ac_scale is 1.0 (from seasonal_coefficients.json)
        # Std AC kwh = 1.50 * 6.0 * 30 = 270.0
        # Inverter AC kwh: 1 * (0.40 + 0.35 * 1.0) * (8.0 * 1.0) * 30 = 0.75 * 8 * 30 = 180.0
        # Total AC kwh = 450.0
        self.assertEqual(res["ac"], 450.0)

        # Refrigerator kwh: 1 * 24.0 (for 'new'/inverter) * (1.0 + 0.15 * 1.0) = 24.0 * 1.15 = 27.60
        self.assertAlmostEqual(res["fridge"], 27.60)

        # Water pump: wp_qty * (wp_type * 0.746) * wp_val * wp_freq
        # = 1 * 0.746 * 1.0 * 30.0 = 22.38
        self.assertAlmostEqual(res["water_pump"], 22.38)

    def test_compute_recency_weighted_avg(self):
        # Empty history
        self.assertEqual(compute_recency_weighted_avg([]), 0.0)

        # Single history item
        history = [{"month": "2026-01", "units": 150}]
        self.assertEqual(compute_recency_weighted_avg(history), 150.0)

        # Multiple items
        history = [
            {"month": "2026-01", "units": 100},
            {"month": "2026-02", "units": 200}
        ]
        avg = compute_recency_weighted_avg(history)
        # Since Feb is newer, it should have a higher weight
        self.assertTrue(avg > 150.0)

    def test_compute_usage_drift(self):
        # Insufficient data
        self.assertEqual(compute_usage_drift([])["status"], "insufficient_data")
        self.assertEqual(compute_usage_drift([{"month": "2026-01", "units": 100}])["status"], "insufficient_data")

        # Stable trend
        history = [
            {"month": "2026-01", "units": 100},
            {"month": "2026-02", "units": 101}
        ]
        res = compute_usage_drift(history)
        self.assertEqual(res["trend"], "stable")

        # Increasing trend (> 7%)
        history = [
            {"month": "2026-01", "units": 100},
            {"month": "2026-02", "units": 110}
        ]
        res = compute_usage_drift(history)
        self.assertEqual(res["trend"], "increasing")
        self.assertEqual(res["change_pct"], 10.0)

        # Decreasing trend (< -7%)
        history = [
            {"month": "2026-01", "units": 100},
            {"month": "2026-02", "units": 90}
        ]
        res = compute_usage_drift(history)
        self.assertEqual(res["trend"], "decreasing")
        self.assertEqual(res["change_pct"], -10.0)

    def test_encode_cyclical(self):
        sin_val, cos_val = encode_cyclical(6, 12)
        # For value 6 out of 12 (halfway), sin(pi) should be near 0, cos(pi) should be near -1
        self.assertAlmostEqual(sin_val, 0.0, places=5)
        self.assertAlmostEqual(cos_val, -1.0, places=5)

    def test_get_blend_weights(self):
        u = {}
        w = get_blend_weights(u, 6)
        self.assertIn("physics", w)
        self.assertIn("rf", w)
        self.assertIn("history", w)
        self.assertAlmostEqual(w["physics"] + w["rf"] + w["history"], 1.0)

if __name__ == '__main__':
    unittest.main()
