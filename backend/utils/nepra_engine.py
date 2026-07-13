class NepraEngine:
    def __init__(self):
        # 2026 Fuel Cost Adjustment (July 2026 rate: Rs. 0.3364)
        self.current_fca = 0.3364 
        
        # 2026 QTA (Quarterly Tariff Adjustment) - Rs. -1.9857/unit for June-August 2026
        self.current_qta = -1.9857
        
        # 1. 2026 ENERGY RATES
        self.lifeline_slabs = [(1, 50, 3.95), (51, 100, 7.74)]
        self.protected_slabs = [(1, 100, 10.54), (101, 200, 13.01)]
        self.non_protected_slabs = [
            (1, 100, 22.44), (101, 200, 28.91), (201, 300, 33.10),
            (301, 400, 36.46), (401, 500, 38.97), (501, 600, 40.22),
            (601, 700, 41.85), (701, float('inf'), 47.20)
        ]

        # 2. 2026 FIXED CHARGE RATES
        self.fixed_rates_protected = {100: 200.0, 200: 300.0}
        self.fixed_rates_non_protected = [
            (100, 275.0), (200, 300.0), (300, 350.0), 
            (400, 400.0), (500, 500.0), (700, 675.0), (float('inf'), 675.0)
        ]
    
    def check_eligibility(self, history_units: list, user_category: str) -> bool:
        """
        NEPRA Dual-Status Rule Engine:
        - Lifeline: Must stay <= 100 units for last 12 consecutive months.
        - Protected: Must stay <= 200 units for last 6 consecutive months.
        """
        if not history_units:
            return True # Assume eligible for new profiles

        if user_category == "lifeline":
            # Lifeline window is usually 12 months
            window = history_units[-12:]
            return all(u <= 100 for u in window)
        
        elif user_category == "protected":
            # Protected window is 6 months
            window = history_units[-6:]
            return all(u <= 200 for u in window)
            
        return False # Standard users are never "eligible" for subsidies

    def calculate_bill(self, units, load_kw=1.0, user_category="non_protected", is_eligible=True):
        energy_cost = 0
        fixed_total = 0
        applied_category = "non_protected"
        
        # Taxes setup
        gst_rate, ed_rate = 0.18, 0.015 
        
        # A. LIFELINE (Rule: 12-month memory <= 100)
        if user_category == "lifeline" and is_eligible and units <= 100:
            applied_category = "lifeline"
            rate = 3.95 if units <= 50 else 7.74
            energy_cost = units * rate
            fixed_total = 0 
            gst_rate, ed_rate = 0.0, 0.0 # Lifeline Tax Exempt

        # B. PROTECTED (Rule: 6-month memory <= 200)
        elif user_category == "protected" and is_eligible and units <= 200:
            applied_category = "protected"
            if units <= 100:
                energy_cost = units * 10.54
                rate_per_kw = self.fixed_rates_protected[100]
            else:
                energy_cost = (100 * 10.54) + ((units - 100) * 13.01)
                rate_per_kw = self.fixed_rates_protected[200]
            fixed_total = load_kw * rate_per_kw

        # C. NON-PROTECTED (Fallback for high usage or lost eligibility)
        else:
            applied_category = "non_protected"
            temp_units = units
            prev_limit = 0
            for low, high, rate in self.non_protected_slabs:
                if temp_units <= 0: break
                chunk = min(temp_units, high - prev_limit)
                energy_cost += chunk * rate
                temp_units -= chunk
                prev_limit = high
            
            # Determine Non-Protected Fixed Rate
            rate_per_kw = 675.0 
            for limit, rate in self.fixed_rates_non_protected:
                if units <= limit:
                    rate_per_kw = rate
                    break
            fixed_total = load_kw * rate_per_kw

        # --- STEP 2: Taxes & Surcharges ---
        fca = units * self.current_fca
        qta = units * self.current_qta if applied_category != "lifeline" else 0.0
        gst = (energy_cost + fixed_total + fca + qta) * gst_rate
        ed = energy_cost * ed_rate
        tv_fee = 0.0 if applied_category == "lifeline" else 35.0
        
        total = energy_cost + fixed_total + fca + qta + gst + ed + tv_fee
        
        return {
            "units": round(units, 1),
            "applied_category": applied_category,
            "is_eligible": is_eligible,
            "energy_cost": round(energy_cost, 2),
            "fixed_charges": round(fixed_total, 2),
            "taxes_and_fca": round(gst + ed + fca + qta + tv_fee, 2),
            "total_bill": round(total, 0)
        }