import numpy as np

def compute_recency_weighted_avg(bill_history: list, decay: float = 0.35) -> float:
    valid    = [b for b in bill_history if float(b.get('units', 0)) > 5]
    if not valid: return 0.0
    sorted_b = sorted(valid, key=lambda x: x.get('month', '0000-00'))
    if len(sorted_b) == 1: return float(sorted_b[0].get('units', 0))
    weights  = [np.exp(decay * i) for i in range(len(sorted_b))]
    total_w  = sum(weights)
    return round(sum((w / total_w) * float(b['units']) for w, b in zip(weights, sorted_b)), 2)
 

def compute_usage_drift(bill_history: list) -> dict:
    """
    Analyzes trend by comparing the most recent month to the average 
    of previous months. Handles out-of-order data automatically.
    """
    # 1. Filter noise
    valid = [b for b in bill_history if float(b.get('units', 0)) > 5]
    
    if len(valid) < 2:
        return {"trend": "stable", "change_pct": 0, "status": "insufficient_data"}

    # 2. CHRONOLOGICAL SORT
    sorted_b = sorted(valid, key=lambda x: x.get('month', '0000-00'))

    # 3. Compare latest month to the one before it
    current_units = float(sorted_b[-1]['units'])
    previous_units = float(sorted_b[-2]['units'])

    if previous_units == 0:
        return {"trend": "stable", "change_pct": 0}

    change_pct = ((current_units - previous_units) / previous_units) * 100
    
    # Define trend thresholds
    if change_pct > 7:
        trend = "increasing"
    elif change_pct < -7:
        trend = "decreasing"
    else:
        trend = "stable"

    return {
        "trend": trend,
        "change_pct": round(change_pct, 1),
        "recent_val": current_units,
        "previous_val": previous_units
    }
