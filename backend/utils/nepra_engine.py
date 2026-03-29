import calendar

class NepraEngine:
    def __init__(self):
        # 2026 Fuel Cost Adjustment (Variable monthly - currently set at 1.63)
        self.current_fca = 1.63 
        
        # 1. 2026 ENERGY RATES (Variable Charges per Unit)
        # Matches your "Full Tariff Breakdown" Table
        self.lifeline_slabs = [(1, 50, 3.95), (51, 100, 7.74)]
        self.protected_slabs = [(1, 100, 10.54), (101, 200, 13.01)]
        self.non_protected_slabs = [
            (1, 100, 22.44), (101, 200, 28.91), (201, 300, 33.10),
            (301, 400, 36.46), (401, 500, 38.97), (501, 600, 40.22),
            (601, 700, 41.85), (701, float('inf'), 47.20)
        ]

        # 2. 2026 FIXED CHARGE RATES (Rs. per kW per Month)
        # Matches your "Category-Wise Fixed Charges" Table
        self.fixed_rates_protected = {
            100: 200.0, # Range: 01-100
            200: 300.0  # Range: 101-200
        }
        
        # Upper bounds for ranges: 100, 200, 300, 400, 500, 700, and 700+
        self.fixed_rates_non_protected = [
            (100, 275.0), (200, 300.0), (300, 350.0), 
            (400, 400.0), (500, 500.0), (700, 675.0), (float('inf'), 675.0)
        ]

    def calculate_bill(self, units, load_kw=1.0, user_category="non_protected"):
        energy_cost = 0
        fixed_total = 0
        applied_category = "non_protected"
        
        # --- STEP 1: Category & Energy Calculation ---
        
        # A. LIFELINE
        if user_category == "lifeline" and units <= 100:
            applied_category = "lifeline"
            rate = 3.95 if units <= 50 else 7.74
            energy_cost = units * rate
            fixed_total = 0 # Exempt
            gst_rate, ed_rate = 0.0, 0.0 # Lifeline usually has tax exemptions
            
        # B. PROTECTED
        elif user_category == "protected" and units <= 200:
            applied_category = "protected"
            if units <= 100:
                energy_cost = units * 10.54
                rate_per_kw = self.fixed_rates_protected[100]
            else:
                energy_cost = (100 * 10.54) + ((units - 100) * 13.01)
                rate_per_kw = self.fixed_rates_protected[200]
            
            fixed_total = load_kw * rate_per_kw
            gst_rate, ed_rate = 0.18, 0.015

        # C. NON-PROTECTED / UNPROTECTED
        else:
            applied_category = "non_protected"
            temp_units = units
            prev_limit = 0
            # Progressive Energy Calculation
            for low, high, rate in self.non_protected_slabs:
                if temp_units <= 0: break
                chunk = min(temp_units, high - prev_limit)
                energy_cost += chunk * rate
                temp_units -= chunk
                prev_limit = high
            
            # Determine Fixed Rate based on the slab table provided
            rate_per_kw = 675.0 
            for limit, rate in self.fixed_rates_non_protected:
                if units <= limit:
                    rate_per_kw = rate
                    break
            
            fixed_total = load_kw * rate_per_kw
            gst_rate, ed_rate = 0.18, 0.015

        # --- STEP 2: Taxes & Adjustment Logic ---
        fca = units * self.current_fca
        
        # GST (18%) applies to Energy + Fixed + FCA
        gst = (energy_cost + fixed_total + fca) * gst_rate
        
        # ED (Electricity Duty - 1.5%) applies to Energy Cost
        ed = energy_cost * ed_rate
        tv_fee = 35.0
        
        total = energy_cost + fixed_total + fca + gst + ed + tv_fee
        
        return {
            "units": round(units, 1),
            "applied_category": applied_category,
            "energy_cost": round(energy_cost, 2),
            "fixed_charges": round(fixed_total, 2),
            "taxes_and_fca": round(gst + ed + fca + tv_fee, 2),
            "total_bill": round(total, 0)
        }