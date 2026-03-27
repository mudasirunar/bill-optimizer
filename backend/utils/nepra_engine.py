class NepraEngine:
    def __init__(self):
        # 2026 Lifeline Rates (Exempt from Fixed Charges)
        self.lifeline_slabs = [
            (1, 50, 3.95),
            (51, 100, 7.74)
        ]
        
        # 2026 Protected Rates (Fixed Charges Apply)
        self.protected_slabs = [
            (1, 100, 10.54), 
            (101, 200, 13.01)
        ]

        # 2026 Non-Protected Variable Rates
        self.non_protected_slabs = [
            (1, 100, 22.44), (101, 200, 28.91), (201, 300, 33.10),
            (301, 400, 36.46), (401, 500, 38.97), (501, 600, 40.22),
            (601, 700, 41.85), (701, float('inf'), 47.20)
        ]

        # 2026 Fixed Monthly Charges (PKR per kW)
        self.fixed_rates = {
            "protected": {100: 200, 200: 300},
            "non_protected": {100: 275, 200: 300, 300: 350, 400: 400, 500: 500, 600: 675, 700: 675, 9999: 675}
        }

    def calculate_bill(self, units, load_kw=1.0, user_category="non_protected"):
        """
        Calculates the 2026 Bill.
        user_category options: 'lifeline', 'protected', 'non_protected'
        """
        energy_cost = 0
        temp_units = units
        prev_limit = 0
        fixed_total = 0
        applied_category = "non_protected"

        # 1. Logic for Category Determination & Energy Cost
        if user_category == "lifeline" and units <= 100:
            applied_category = "lifeline"
            # Lifeline does NOT have slab benefits (non-progressive)
            if units <= 50:
                energy_cost = units * 3.95
            else:
                energy_cost = units * 7.74
            fixed_total = 0 # Lifeline is exempt from Fixed Charges
        else:
            # Determine if Protected or Non-Protected
            if user_category == "protected" and units <= 200:
                applied_category = "protected"
                slabs = self.protected_slabs
            else:
                applied_category = "non_protected"
                slabs = self.non_protected_slabs

            # Progressive Slab Calculation
            for low, high, rate in slabs:
                if temp_units <= 0: break
                chunk = min(temp_units, high - prev_limit)
                energy_cost += chunk * rate
                temp_units -= chunk
                prev_limit = high

            # 2. Fixed Charges (Only for Protected/Non-Protected)
            fixed_rate_per_kw = 0
            for limit, rate in sorted(self.fixed_rates[applied_category].items()):
                if units <= limit:
                    fixed_rate_per_kw = rate
                    break
            fixed_total = fixed_rate_per_kw * load_kw

        # 3. Taxes & Adjustments
        fca = units * 1.64 
        gst = (energy_cost + fixed_total + fca) * 0.18  # 18% GST
        ed = energy_cost * 0.015  # 1.5% Electricity Duty
        tv_fee = 35.0
        
        total = energy_cost + fixed_total + fca + gst + ed + tv_fee
        
        return {
            "units": round(units, 1),
            "applied_category": applied_category,
            "energy_cost": round(energy_cost, 2),
            "fixed_charges": round(fixed_total, 2),
            "taxes_and_fca": round(gst + ed + fca + tv_fee, 2),
            "total_bill": round(total, 2)
        }