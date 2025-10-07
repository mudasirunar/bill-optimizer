import pandas as pd
import numpy as np
import joblib
from sklearn.preprocessing import LabelEncoder
import os

class EnhancedBillPredictor:
    def __init__(self):
        self.model = None
        self.scaler = None
        self.feature_columns = None
        self.model_metadata = None
        self.le_region = None
        self.le_consumer = None
        self.load_enhanced_artifacts()
    
    def load_enhanced_artifacts(self):
        """Load enhanced model artifacts"""
        try:
            self.model = joblib.load('bill_predictor_enhanced.pkl')
            self.scaler = joblib.load('scaler_enhanced.pkl')
            self.feature_columns = joblib.load('feature_columns_enhanced.pkl')
            self.model_metadata = joblib.load('model_metadata_enhanced.pkl')
            
            # Load encoders
            if os.path.exists('label_encoder_region.pkl'):
                self.le_region = joblib.load('label_encoder_region.pkl')
            if os.path.exists('label_encoder_consumer.pkl'):
                self.le_consumer = joblib.load('label_encoder_consumer.pkl')
            
            print("✅ ENHANCED ARTIFACTS LOADED SUCCESSFULLY!")
            print(f"   Model: {self.model_metadata['model_name']}")
            print(f"   R² Score: {self.model_metadata['performance']['r2_score']:.4f}")
            print(f"   Features: {len(self.feature_columns)}")
            
        except Exception as e:
            print(f"❌ Error loading enhanced artifacts: {e}")
            self.create_default_encoders()
    
    def create_default_encoders(self):
        """Create default encoders"""
        self.le_region = LabelEncoder()
        self.le_region.fit(['Urban', 'Rural', 'Commercial'])
        
        self.le_consumer = LabelEncoder()
        self.le_consumer.fit(['Protected', 'Lifeline', 'General', 'Commercial'])
    
    def predict_enhanced_bill(self, input_data):
        """
        Enhanced prediction with proper feature mapping and validation
        """
        try:
            print(f"🎯 ENHANCED PREDICTION for input: {input_data}")
            
            # Process user input to enhanced features
            processed_features = self.process_enhanced_input(input_data)
            
            if processed_features is None:
                return self.get_fallback_prediction(input_data)
            
            # Create feature vector in correct order
            feature_vector = self.create_feature_vector(processed_features)
            
            if feature_vector is None:
                return self.get_fallback_prediction(input_data)
            
            # Convert to numpy array and ensure 2D shape
            X = np.array([feature_vector])
            print(f"📊 Feature vector shape: {X.shape}")
            print(f"📊 Feature values: {feature_vector}")
            
            # Scale features
            X_scaled = self.scaler.transform(X)
            
            # Make prediction
            prediction = self.model.predict(X_scaled)[0]
            
            # Ensure prediction is realistic
            prediction = max(500, min(prediction, 50000))  # Reasonable bill range: Rs. 500 - 50,000
            
            # Enhanced analysis
            analysis = self.enhanced_analysis(prediction, input_data, processed_features)
            
            return {
                'predicted_bill': round(prediction, 2),
                'estimated_units': round(analysis['estimated_units'], 2),
                'tariff_slab': analysis['tariff_slab'],
                'optimization_tips': analysis['optimization_tips'],
                'savings_opportunities': analysis['savings_opportunities'],
                'model_confidence': analysis['model_confidence'],
                'model_info': {
                    'model_name': self.model_metadata['model_name'],
                    'r2_score': round(self.model_metadata['performance']['r2_score'], 4),
                    'mae': round(self.model_metadata['performance']['mae'], 2),
                    'features_used': len(self.feature_columns)
                },
                'status': 'success'
            }
            
        except Exception as e:
            print(f"❌ Enhanced prediction error: {str(e)}")
            import traceback
            traceback.print_exc()
            return self.get_fallback_prediction(input_data)
    
    def process_enhanced_input(self, input_data):
        """Process user input to match enhanced features with realistic values"""
        try:
            processed = {}
            
            # Extract basic information with validation
            household_size = max(1, min(input_data.get('household_size', 4), 15))
            num_appliances = max(1, min(input_data.get('num_appliances', 10), 50))
            ac_units = max(0, min(input_data.get('ac_units', 1), 5))
            fridge_count = max(0, min(input_data.get('fridge_count', 1), 3))
            fan_count = max(0, min(input_data.get('fan_count', 3), 10))
            usage_hours = max(1, min(input_data.get('usage_hours', 8), 24))
            previous_units = max(50, min(input_data.get('previous_units', 200), 2000))
            
            # REALISTIC FEATURE CALCULATIONS based on actual Pakistani household patterns
            
            # Basic consumption (more realistic calculation)
            base_daily_units = (ac_units * 12 + fridge_count * 3 + fan_count * 2 + 
                              (num_appliances - ac_units - fridge_count - fan_count) * 1) * usage_hours / 10
            avg_daily_kwh = max(5, min(base_daily_units, 50))  # Realistic range: 5-50 kWh/day
            
            # Appliance usage percentages (based on actual Pakistani data)
            ac_power = ac_units * 1500
            total_power_estimate = (ac_power + fridge_count * 150 + fan_count * 75 + 
                                  (num_appliances - ac_units - fridge_count - fan_count) * 100)
            
            ac_usage_pct = min(80, (ac_power / total_power_estimate) * 100) if total_power_estimate > 0 else 20
            
            # Enhanced features mapping with realistic ranges
            enhanced_features = {
                'avg_daily_kwh': avg_daily_kwh,
                'ac_usage_percentage': ac_usage_pct,
                'kitchen_usage_percentage': min(25, 5 + (household_size * 3)),  # Kitchen usage increases with family size
                'fridge_usage_percentage': min(15, fridge_count * 5),
                'peak_offpeak_ratio': min(3.0, 1.2 + (ac_units * 0.3)),  # More AC = higher peak usage
                'weekend_ratio': 1.1,  # Slightly higher on weekends
                'consumption_variability': min(1.0, 0.2 + (ac_units * 0.1)),  # More AC = more variability
                'load_factor': max(0.2, min(0.8, 0.5 - (ac_units * 0.05))),  # AC reduces load factor
                'ac_daily_hours': min(24, ac_units * 4),  # Realistic AC usage hours
                'avg_peak_usage': min(5.0, 1.0 + (ac_units * 0.5)),  # Peak usage increases with AC
                'seasonal_ratio': min(2.0, 1.1 + (ac_units * 0.2)),  # More AC = higher seasonal variation
                'avg_hourly_consumption': min(3.0, avg_daily_kwh / 10),
                'max_hourly_consumption': min(8.0, 1.0 + (ac_units * 1.2)),
                'base_load_kw': min(1.0, 0.1 + (fridge_count * 0.2)),
            }
            
            # Add basic features
            processed.update(enhanced_features)
            
            print(f"📊 Processed features sample: {list(processed.items())[:5]}...")
            
            return processed
            
        except Exception as e:
            print(f"❌ Error processing enhanced input: {e}")
            return None
    
    def create_feature_vector(self, processed_features):
        """Create feature vector in correct order with proper defaults"""
        try:
            feature_vector = []
            for feature in self.feature_columns:
                if feature in processed_features:
                    value = processed_features[feature]
                    # Ensure no NaN or infinite values
                    if np.isnan(value) or np.isinf(value):
                        value = 0.0
                    feature_vector.append(float(value))
                else:
                    # Use realistic default values based on feature type
                    default_value = self.get_sensible_default(feature)
                    feature_vector.append(default_value)
            
            print(f"✅ Feature vector created with {len(feature_vector)} features")
            return feature_vector
        except Exception as e:
            print(f"❌ Error creating feature vector: {e}")
            return None
    
    def get_sensible_default(self, feature_name):
        """Get sensible default values for missing features"""
        defaults = {
            'avg_daily_kwh': 15.0,
            'ac_usage_percentage': 25.0,
            'kitchen_usage_percentage': 15.0,
            'fridge_usage_percentage': 8.0,
            'peak_offpeak_ratio': 1.5,
            'weekend_ratio': 1.1,
            'consumption_variability': 0.3,
            'load_factor': 0.4,
            'ac_daily_hours': 6.0,
            'avg_peak_usage': 1.5,
            'seasonal_ratio': 1.3,
            'avg_hourly_consumption': 1.2,
            'max_hourly_consumption': 2.5,
            'base_load_kw': 0.3,
        }
        return defaults.get(feature_name, 0.0)
    
    def enhanced_analysis(self, predicted_bill, input_data, processed_features):
        """Perform enhanced analysis of the prediction"""
        
        # Estimate units from bill (realistic calculation)
        estimated_units = self.estimate_units_from_bill(predicted_bill)
        
        # Ensure units are realistic
        estimated_units = max(50, min(estimated_units, 2000))
        
        # Determine tariff slab
        tariff_slab = self.get_tariff_slab(estimated_units)
        
        # Generate optimization tips
        optimization_tips = self.generate_enhanced_tips(estimated_units, processed_features)
        
        # Identify savings opportunities
        savings_opportunities = self.identify_savings_opportunities(estimated_units, processed_features)
        
        # Calculate model confidence
        model_confidence = self.calculate_confidence(estimated_units, processed_features)
        
        return {
            'estimated_units': estimated_units,
            'tariff_slab': tariff_slab,
            'optimization_tips': optimization_tips,
            'savings_opportunities': savings_opportunities,
            'model_confidence': model_confidence
        }
    
    def estimate_units_from_bill(self, bill_amount):
        """Estimate units from bill amount using realistic calculations"""
        # More realistic unit estimation
        if bill_amount <= 0:
            return 200  # Default reasonable value
        
        # Average rate estimation (Rs. 15-35 per unit based on slabs)
        if bill_amount < 2000:
            avg_rate = 18
        elif bill_amount < 5000:
            avg_rate = 22
        elif bill_amount < 10000:
            avg_rate = 28
        else:
            avg_rate = 32
            
        estimated_units = bill_amount / avg_rate
        return max(50, estimated_units)  # Minimum 50 units
    
    def get_tariff_slab(self, units):
        """Determine current tariff slab with proper calculations"""
        units = max(0, units)
        
        if units <= 100:
            return {'slab': '1-100 units', 'rate': 7.74, 'type': 'Protected'}
        elif units <= 200:
            return {'slab': '101-200 units', 'rate': 10.06, 'type': 'Protected'}
        elif units <= 300:
            return {'slab': '201-300 units', 'rate': 26.66, 'type': 'General'}
        elif units <= 700:
            return {'slab': '301-700 units', 'rate': 32.03, 'type': 'General'}
        else:
            return {'slab': '701+ units', 'rate': 35.53, 'type': 'General'}
    
    def generate_enhanced_tips(self, estimated_units, features):
        """Generate enhanced optimization tips"""
        tips = []
        
        # Consumption level tips
        if estimated_units > 700:
            tips.append("🔴 VERY HIGH CONSUMPTION: Professional energy audit recommended")
            tips.append("💰 MAJOR SAVINGS: Reduce AC usage and upgrade to inverter ACs")
        elif estimated_units > 300:
            tips.append("🟡 HIGH CONSUMPTION: Focus on AC optimization and peak hour usage")
            tips.append("🎯 TARGET: Reduce to below 300 units for significant savings")
        elif estimated_units > 200:
            tips.append("🟢 MEDIUM CONSUMPTION: Good level with optimization opportunities")
            tips.append("📊 GOAL: Stay below 200 units for protected tariff rates")
        else:
            tips.append("💚 OPTIMAL CONSUMPTION: Maintain efficient usage patterns")
        
        # Appliance-specific tips
        ac_usage = features.get('ac_usage_percentage', 0)
        if ac_usage > 50:
            tips.append("❄️ AC OPTIMIZATION: Major cost driver - set to 24°C, use timers")
        elif ac_usage > 25:
            tips.append("🌬️ AC MANAGEMENT: Moderate usage - maintain filters, use with fans")
        
        if features.get('peak_offpeak_ratio', 0) > 2:
            tips.append("⏰ PEAK USAGE: Shift laundry and cooking to off-peak hours (10 PM - 6 AM)")
        
        # General tips
        tips.extend([
            "💡 LED UPGRADE: Replace all bulbs with LED lights",
            "🔌 PHANTOM LOAD: Unplug chargers and electronics when not in use",
            "🌞 NATURAL LIGHT: Use daylight during daytime hours",
            "🧺 EFFICIENT LAUNDRY: Full loads, cold water settings"
        ])
        
        return tips
    
    def identify_savings_opportunities(self, estimated_units, features):
        """Identify specific savings opportunities"""
        opportunities = []
        
        # Calculate potential savings from tariff optimization
        if estimated_units > 200:
            reduction_needed = estimated_units - 200
            savings = reduction_needed * (22.95 - 7.74)  # Rate difference
            opportunities.append(f"Reduce to 200 units: Save Rs. {savings:.0f}/month")
        
        if estimated_units > 300:
            reduction_needed = estimated_units - 300
            savings = reduction_needed * (32.03 - 26.66)
            opportunities.append(f"Reduce to 300 units: Save Rs. {savings:.0f}/month")
        
        # Appliance-specific savings
        ac_usage = features.get('ac_usage_percentage', 0)
        if ac_usage > 30:
            ac_savings = estimated_units * 0.15 * 25  # 15% AC reduction
            opportunities.append(f"Optimize AC usage: Save Rs. {ac_savings:.0f}/month")
        
        return opportunities
    
    def calculate_confidence(self, estimated_units, features):
        """Calculate prediction confidence score"""
        confidence = 0.7  # Base confidence
        
        # Adjust based on input quality and realism
        if 100 <= estimated_units <= 1000:  # Realistic range
            confidence += 0.15
        
        if features.get('ac_usage_percentage', 0) > 0:
            confidence += 0.1
        
        if features.get('avg_daily_kwh', 0) > 5:  # Reasonable consumption
            confidence += 0.05
        
        return min(confidence, 0.90)  # Cap at 90%
    
    def get_fallback_prediction(self, input_data):
        """Fallback prediction using simple calculations"""
        print("🔄 Using reliable fallback prediction...")
        
        # Simple but reliable calculation
        ac_units = input_data.get('ac_units', 1)
        fridge_count = input_data.get('fridge_count', 1)
        fan_count = input_data.get('fan_count', 3)
        usage_hours = input_data.get('usage_hours', 8)
        previous_units = input_data.get('previous_units', 200)
        
        # Realistic unit calculation
        base_units = (ac_units * 10 + fridge_count * 2 + fan_count * 1 + 5) * usage_hours / 8
        monthly_units = base_units * 30
        
        # Use previous units if provided and reasonable
        if 50 <= previous_units <= 2000:
            monthly_units = previous_units
        
        # Calculate bill based on Nepra slabs
        bill = self.calculate_bill_from_units(monthly_units)
        
        return {
            'predicted_bill': round(bill, 2),
            'estimated_units': round(monthly_units, 2),
            'tariff_slab': self.get_tariff_slab(monthly_units),
            'optimization_tips': ['Using reliable calculation method'],
            'savings_opportunities': [],
            'model_confidence': 0.8,
            'model_info': {'model_name': 'Reliable Calculator', 'r2_score': 'N/A', 'mae': 'N/A', 'features_used': 0},
            'status': 'fallback'
        }
    
    def calculate_bill_from_units(self, units):
        """Calculate bill directly from units using Nepra slabs"""
        units = max(0, units)
        
        if units <= 100:
            return units * 7.74
        elif units <= 200:
            return 100 * 7.74 + (units - 100) * 10.06
        elif units <= 300:
            return 100 * 7.74 + 100 * 10.06 + (units - 200) * 26.66
        elif units <= 700:
            return 100 * 7.74 + 100 * 10.06 + 100 * 26.66 + (units - 300) * 32.03
        else:
            return 100 * 7.74 + 100 * 10.06 + 100 * 26.66 + 400 * 32.03 + (units - 700) * 35.53
    
    def calculate_units_from_appliances(self, appliances_data):
        """Calculate total units based on appliance usage"""
        total_units = 0
        
        # Standard appliance wattages (in watts)
        appliance_wattage = {
            'ac': 1500, 'fridge': 150, 'fan': 75, 'light': 20, 
            'tv': 100, 'computer': 200, 'washing_machine': 500,
            'iron': 1000, 'microwave': 1000, 'water_heater': 2000,
            'oven': 2000, 'dishwasher': 1200, 'dryer': 3000
        }
        
        for appliance, hours in appliances_data.items():
            if appliance in appliance_wattage:
                # Convert watts to kilowatts and calculate daily units
                daily_units = (appliance_wattage[appliance] * hours) / 1000
                total_units += daily_units * 30  # Monthly estimate
        
        return round(max(0, total_units), 2)

# Enhanced singleton instance
enhanced_predictor = EnhancedBillPredictor()