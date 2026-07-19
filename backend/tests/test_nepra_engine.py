import os
import sys
import unittest

# Ensure the backend directory is in the path
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))

from utils.nepra_engine import NepraEngine

class TestNepraEngine(unittest.TestCase):
    def setUp(self):
        self.engine = NepraEngine()

    def test_check_eligibility_lifeline(self):
        # Lifeline check: Must stay <= 100 units for last 12 consecutive months.
        # If history_units is empty, it should be eligible.
        self.assertTrue(self.engine.check_eligibility([], 'lifeline'))
        
        # Valid history (<= 100 units)
        self.assertTrue(self.engine.check_eligibility([50, 60, 70, 80, 90, 100], 'lifeline'))
        
        # Invalid history (> 100 units at least once in last 12 months)
        self.assertFalse(self.engine.check_eligibility([50, 101, 80], 'lifeline'))
        self.assertFalse(self.engine.check_eligibility([101] + [50]*11, 'lifeline'))
        
        # Only checks last 12 months, older history doesn't impact
        self.assertTrue(self.engine.check_eligibility([150] + [50]*12, 'lifeline'))

    def test_check_eligibility_protected(self):
        # Protected check: Must stay <= 200 units for last 6 consecutive months.
        self.assertTrue(self.engine.check_eligibility([], 'protected'))
        self.assertTrue(self.engine.check_eligibility([100, 150, 180, 200], 'protected'))
        self.assertFalse(self.engine.check_eligibility([100, 201, 150], 'protected'))
        self.assertFalse(self.engine.check_eligibility([201] + [100]*5, 'protected'))
        
        # Only checks last 6 months
        self.assertTrue(self.engine.check_eligibility([300] + [100]*6, 'protected'))

    def test_check_eligibility_non_protected(self):
        # Non-protected users: new profile is eligible (returns True), but with history they are never eligible
        self.assertTrue(self.engine.check_eligibility([], 'non_protected'))
        self.assertFalse(self.engine.check_eligibility([50]*12, 'non_protected'))

    def test_calculate_bill_lifeline(self):
        # Units <= 50 -> rate 3.95
        res = self.engine.calculate_bill(units=40, load_kw=1.0, user_category="lifeline", is_eligible=True)
        self.assertEqual(res["applied_category"], "lifeline")
        self.assertEqual(res["energy_cost"], 40 * 3.95)
        self.assertEqual(res["fixed_charges"], 0.0)
        # Taxes: gst_rate, ed_rate = 0.0, 0.0. FCA = 40 * 0.3364. QTA = 0. TV = 0.
        # taxes_and_fca = gst + ed + fca + qta + tv_fee = 0 + 0 + 40 * 0.3364 + 0 + 0 = 13.46
        self.assertAlmostEqual(res["taxes_and_fca"], round(40 * 0.3364, 2))
        self.assertEqual(res["total_bill"], round(40 * 3.95 + 40 * 0.3364, 0))

        # Units 51-100 -> rate 7.74
        res = self.engine.calculate_bill(units=80, load_kw=1.0, user_category="lifeline", is_eligible=True)
        self.assertEqual(res["applied_category"], "lifeline")
        self.assertEqual(res["energy_cost"], 80 * 7.74)
        self.assertEqual(res["fixed_charges"], 0.0)
        self.assertAlmostEqual(res["taxes_and_fca"], round(80 * 0.3364, 2))

        # Lifeline but not eligible -> falls back to non_protected
        res = self.engine.calculate_bill(units=80, load_kw=1.0, user_category="lifeline", is_eligible=False)
        self.assertEqual(res["applied_category"], "non_protected")

        # Lifeline and eligible but units > 100 -> falls back to non_protected
        res = self.engine.calculate_bill(units=110, load_kw=1.0, user_category="lifeline", is_eligible=True)
        self.assertEqual(res["applied_category"], "non_protected")

    def test_calculate_bill_protected(self):
        # Protected and eligible, <= 100 units -> rate 10.54, fixed charges 200 * load
        res = self.engine.calculate_bill(units=90, load_kw=2.0, user_category="protected", is_eligible=True)
        self.assertEqual(res["applied_category"], "protected")
        self.assertAlmostEqual(res["energy_cost"], 948.6, places=2)
        self.assertEqual(res["fixed_charges"], 2.0 * 200.0)

        # Protected and eligible, 101-200 units -> first 100 @ 10.54, rest @ 13.01, fixed charges 300 * load
        res = self.engine.calculate_bill(units=150, load_kw=2.0, user_category="protected", is_eligible=True)
        self.assertEqual(res["applied_category"], "protected")
        expected_energy = (100 * 10.54) + (50 * 13.01)
        self.assertEqual(res["energy_cost"], expected_energy)
        self.assertEqual(res["fixed_charges"], 2.0 * 300.0)

        # Protected and eligible but units > 200 -> falls back to non_protected
        res = self.engine.calculate_bill(units=210, load_kw=2.0, user_category="protected", is_eligible=True)
        self.assertEqual(res["applied_category"], "non_protected")

    def test_calculate_bill_non_protected(self):
        # Non-protected, verify slab rate summation
        # 1-100: 22.44, 101-200: 28.91, 201-300: 33.10, ...
        # Let's say 250 units:
        # energy = 100 * 22.44 + 100 * 28.91 + 50 * 33.10 = 2244 + 2891 + 1655 = 6790.0
        res = self.engine.calculate_bill(units=250, load_kw=3.0, user_category="non_protected", is_eligible=True)
        self.assertEqual(res["applied_category"], "non_protected")
        self.assertEqual(res["energy_cost"], 6790.0)
        
        # Fixed charges for non_protected: units <= 300 -> rate_per_kw = 350.0
        self.assertEqual(res["fixed_charges"], 3.0 * 350.0)

if __name__ == '__main__':
    unittest.main()
