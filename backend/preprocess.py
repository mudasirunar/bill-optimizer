import pandas as pd
import numpy as np
from sklearn.preprocessing import StandardScaler, LabelEncoder
from sklearn.feature_selection import SelectKBest, f_regression
import joblib
from datetime import datetime
import warnings
warnings.filterwarnings('ignore')

def enhanced_preprocessing():
    """
    ENHANCED preprocessing for 41 houses with advanced feature engineering
    """
    print("🚀 ENHANCED PREPROCESSING FOR 41 HOUSES STARTING...")
    
    try:
        # Load dataset
        print("📂 Loading combined_houses.csv...")
        df = pd.read_csv('combined_houses.csv', low_memory=False)
        df['Date_Time'] = pd.to_datetime(df['Date_Time'])
        
        print(f"✅ Loaded {len(df):,} rows from 41 houses")
        print(f"📅 Data range: {df['Date_Time'].min()} to {df['Date_Time'].max()}")
        
        # Get all houses
        all_houses = sorted(df['House_ID'].unique())
        print(f"🎯 Processing {len(all_houses)} houses...")
        
        household_features = []
        
        for i, house_id in enumerate(all_houses, 1):
            print(f"🏠 Processing {i:2d}/41: {house_id}")
            house_data = df[df['House_ID'] == house_id]
            
            # Skip if insufficient data (less than 1 week)
            if len(house_data) < 10080:  # 7 days * 24 hours * 60 minutes
                print(f"   ⚠️  Skipping {house_id} - insufficient data")
                continue
            
            features = extract_enhanced_features(house_data, house_id)
            household_features.append(features)
        
        print(f"✅ Successfully processed {len(household_features)} houses")
        
        # Create enhanced features dataframe
        household_df = pd.DataFrame(household_features)
        
        # ADVANCED FEATURE SELECTION
        print("\n🔍 Performing advanced feature selection...")
        
        # Separate features and target
        non_feature_cols = ['house_id', 'estimated_monthly_bill', 'estimated_monthly_units', 
                           'data_days', 'total_kwh_consumption', 'house_numeric_id']
        feature_columns = [col for col in household_df.columns if col not in non_feature_cols]
        
        X = household_df[feature_columns]
        y = household_df['estimated_monthly_bill']
        
        # Handle any missing values
        X = X.fillna(X.median())
        
        # Feature selection using SelectKBest
        selector = SelectKBest(score_func=f_regression, k=min(20, len(feature_columns)))
        X_selected = selector.fit_transform(X, y)
        
        # Get selected features
        selected_mask = selector.get_support()
        selected_features = [feature_columns[i] for i in range(len(feature_columns)) if selected_mask[i]]
        
        print(f"📊 Selected {len(selected_features)} most important features:")
        for i, feature in enumerate(selected_features, 1):
            print(f"   {i:2d}. {feature}")
        
        # Scale the selected features
        scaler = StandardScaler()
        X_scaled = scaler.fit_transform(X_selected)
        
        # Save enhanced preprocessed data
        preprocessed_df = pd.DataFrame(X_scaled, columns=selected_features)
        preprocessed_df['monthly_bill'] = y.values
        preprocessed_df['house_id'] = household_df['house_id'].values
        preprocessed_df['monthly_units'] = household_df['estimated_monthly_units'].values
        preprocessed_df['house_numeric'] = household_df['house_numeric_id'].values
        
        output_file = 'preprocessed_enhanced.csv'
        preprocessed_df.to_csv(output_file, index=False)
        
        # Save preprocessing artifacts
        joblib.dump(scaler, 'scaler_enhanced.pkl')
        joblib.dump(selected_features, 'feature_columns_enhanced.pkl')
        joblib.dump(selector, 'feature_selector.pkl')
        joblib.dump(household_df, 'household_analysis_enhanced.pkl')
        
        # Display dataset statistics
        print(f"\n📈 ENHANCED DATASET STATISTICS:")
        print(f"Houses processed: {len(household_df)}")
        print(f"Features selected: {len(selected_features)}")
        print(f"Average monthly consumption: {household_df['estimated_monthly_units'].mean():.1f} ± {household_df['estimated_monthly_units'].std():.1f} units")
        print(f"Average monthly bill: Rs. {household_df['estimated_monthly_bill'].mean():.2f} ± {household_df['estimated_monthly_bill'].std():.2f}")
        print(f"Total kWh analyzed: {household_df['total_kwh_consumption'].sum():,.0f} kWh")
        
        # Show consumption distribution
        consumption_stats = household_df['estimated_monthly_units'].describe()
        print(f"\n📊 CONSUMPTION DISTRIBUTION:")
        print(f"Min: {consumption_stats['min']:.1f} units")
        print(f"25%: {consumption_stats['25%']:.1f} units")
        print(f"50%: {consumption_stats['50%']:.1f} units")
        print(f"75%: {consumption_stats['75%']:.1f} units")
        print(f"Max: {consumption_stats['max']:.1f} units")
        
        print(f"\n🎉 ENHANCED PREPROCESSING COMPLETED!")
        print(f"📁 Output: {output_file}")
        
        return preprocessed_df, selected_features
        
    except Exception as e:
        print(f"❌ Error in enhanced preprocessing: {str(e)}")
        import traceback
        traceback.print_exc()
        return None, None

def extract_enhanced_features(house_data, house_id):
    """EXTRACT ENHANCED FEATURES with advanced engineering"""
    
    # Convert kW-minutes to kWh
    total_kwh = house_data['Usage_kW'].sum() / 60
    total_minutes = len(house_data)
    total_days = total_minutes / (24 * 60)
    avg_daily_kwh = total_kwh / total_days if total_days > 0 else 0
    
    # Enhanced time features
    house_data = house_data.copy()
    house_data['hour'] = house_data['Date_Time'].dt.hour
    house_data['month'] = house_data['Date_Time'].dt.month
    house_data['day_of_week'] = house_data['Date_Time'].dt.dayofweek
    house_data['day_of_year'] = house_data['Date_Time'].dt.dayofyear
    house_data['is_weekend'] = (house_data['day_of_week'] >= 5).astype(int)
    
    # ADVANCED APPLIANCE ANALYSIS
    ac_columns = [col for col in house_data.columns if 'AC' in col or 'Ac' in col]
    kitchen_columns = [col for col in house_data.columns if 'Kitchen' in col]
    refrigerator_columns = [col for col in house_data.columns if 'Refrigerator' in col or 'Regrigerator' in col]
    ups_columns = [col for col in house_data.columns if 'UPS' in col]
    laundry_columns = [col for col in house_data.columns if 'Laundary' in col or 'WD' in col]
    
    # Appliance energy consumption
    ac_total_kwh = house_data[ac_columns].sum().sum() / 60
    kitchen_total_kwh = house_data[kitchen_columns].sum().sum() / 60
    fridge_total_kwh = house_data[refrigerator_columns].sum().sum() / 60
    ups_total_kwh = house_data[ups_columns].sum().sum() / 60
    laundry_total_kwh = house_data[laundry_columns].sum().sum() / 60
    
    # Appliance usage percentages
    total_usage = total_kwh if total_kwh > 0 else 1
    ac_usage_pct = (ac_total_kwh / total_usage) * 100
    kitchen_usage_pct = (kitchen_total_kwh / total_usage) * 100
    fridge_usage_pct = (fridge_total_kwh / total_usage) * 100
    ups_usage_pct = (ups_total_kwh / total_usage) * 100
    laundry_usage_pct = (laundry_total_kwh / total_usage) * 100
    
    # ENHANCED TIME PATTERN ANALYSIS
    hourly_consumption = house_data.groupby('hour')['Usage_kW'].mean()
    peak_hour = hourly_consumption.idxmax()
    base_load = hourly_consumption.min()  # Minimum hourly consumption
    
    # Peak/Off-peak analysis
    peak_hours = [18, 19, 20, 21]  # 6 PM - 10 PM
    off_peak_hours = [0, 1, 2, 3, 4, 5]  # 12 AM - 6 AM
    
    peak_data = house_data[house_data['hour'].isin(peak_hours)]
    off_peak_data = house_data[house_data['hour'].isin(off_peak_hours)]
    
    avg_peak_usage = peak_data['Usage_kW'].mean() if len(peak_data) > 0 else 0
    avg_off_peak_usage = off_peak_data['Usage_kW'].mean() if len(off_peak_data) > 0 else 0
    peak_to_offpeak_ratio = avg_peak_usage / avg_off_peak_usage if avg_off_peak_usage > 0 else 0
    
    # Weekend analysis
    weekend_data = house_data[house_data['is_weekend'] == 1]
    weekday_data = house_data[house_data['is_weekend'] == 0]
    
    weekend_usage = weekend_data['Usage_kW'].mean() if len(weekend_data) > 0 else 0
    weekday_usage = weekday_data['Usage_kW'].mean() if len(weekday_data) > 0 else 0
    weekend_ratio = weekend_usage / weekday_usage if weekday_usage > 0 else 0
    
    # SEASONAL ANALYSIS
    summer_months = [6, 7, 8]  # Jun-Aug
    winter_months = [12, 1, 2] # Dec-Feb
    
    summer_data = house_data[house_data['month'].isin(summer_months)]
    winter_data = house_data[house_data['month'].isin(winter_months)]
    
    summer_usage = summer_data['Usage_kW'].mean() if len(summer_data) > 0 else 0
    winter_usage = winter_data['Usage_kW'].mean() if len(winter_data) > 0 else 0
    seasonal_ratio = summer_usage / winter_usage if winter_usage > 0 else 0
    
    # CONSUMPTION BEHAVIOR FEATURES
    daily_consumption = house_data.groupby(house_data['Date_Time'].dt.date)['Usage_kW'].sum() / 60
    
    # Statistical features
    consumption_std = daily_consumption.std()
    consumption_cv = (consumption_std / daily_consumption.mean()) if daily_consumption.mean() > 0 else 0
    consumption_skew = daily_consumption.skew()
    
    # Load factor (how consistently power is used)
    load_factor = (house_data['Usage_kW'].mean() / house_data['Usage_kW'].max()) if house_data['Usage_kW'].max() > 0 else 0
    
    # AC usage patterns (important for Pakistani households)
    ac_usage_hours = (house_data[ac_columns] > 0.1).any(axis=1).sum() / 60  # Hours AC was used
    ac_daily_hours = ac_usage_hours / total_days if total_days > 0 else 0
    
    # ENERGY EFFICIENCY METRICS
    # Base load percentage (always-on appliances)
    base_load_pct = (base_load / house_data['Usage_kW'].mean()) * 100 if house_data['Usage_kW'].mean() > 0 else 0
    
    # Create enhanced feature dictionary
    features = {
        'house_id': house_id,
        'house_numeric_id': int(house_id.replace('House', '')),
        'data_days': total_days,
        'total_kwh_consumption': total_kwh,
        
        # Basic consumption patterns
        'avg_daily_kwh': avg_daily_kwh,
        'avg_hourly_consumption': house_data['Usage_kW'].mean(),
        'max_hourly_consumption': house_data['Usage_kW'].max(),
        'base_load_kw': base_load,
        
        # Appliance breakdown (CRITICAL FEATURES)
        'ac_usage_percentage': ac_usage_pct,
        'kitchen_usage_percentage': kitchen_usage_pct,
        'fridge_usage_percentage': fridge_usage_pct,
        'ups_usage_percentage': ups_usage_pct,
        'laundry_usage_percentage': laundry_usage_pct,
        'ac_total_kwh': ac_total_kwh,
        'ac_daily_hours': ac_daily_hours,
        
        # Time-based patterns
        'peak_hour': peak_hour,
        'peak_offpeak_ratio': peak_to_offpeak_ratio,
        'avg_peak_usage': avg_peak_usage,
        'avg_offpeak_usage': avg_off_peak_usage,
        'weekend_ratio': weekend_ratio,
        'seasonal_ratio': seasonal_ratio,
        
        # Consumption behavior
        'consumption_variability': consumption_cv,
        'consumption_skewness': consumption_skew,
        'load_factor': load_factor,
        'base_load_percentage': base_load_pct,
        'max_daily_consumption': daily_consumption.max(),
        'min_daily_consumption': daily_consumption.min(),
        'avg_daily_consumption': daily_consumption.mean(),
        'std_daily_consumption': daily_consumption.std(),
        
        # Target variables
        'estimated_monthly_units': avg_daily_kwh * 30,
        'estimated_monthly_bill': calculate_enhanced_bill(avg_daily_kwh * 30, ac_usage_pct)
    }
    
    return features

def calculate_enhanced_bill(monthly_units, ac_usage_pct):
    """
    Enhanced bill calculation considering AC usage patterns
    AC-heavy households might have different consumption patterns
    """
    units = monthly_units
    
    # Base Nepra tariff
    if units <= 100:
        bill = units * 16.48
    elif units <= 200:
        bill = 100 * 16.48 + (units - 100) * 22.95
    elif units <= 300:
        bill = 100 * 16.48 + 100 * 22.95 + (units - 200) * 26.66
    elif units <= 700:
        bill = 100 * 16.48 + 100 * 22.95 + 100 * 26.66 + (units - 300) * 32.03
    else:
        bill = 100 * 16.48 + 100 * 22.95 + 100 * 26.66 + 400 * 32.03 + (units - 700) * 35.53
    
    # Adjust for AC-heavy households (they might have higher peak usage)
    if ac_usage_pct > 30:  # If AC usage is more than 30%
        bill *= 1.05  # 5% adjustment for AC-heavy patterns
    
    return bill

if __name__ == "__main__":
    enhanced_preprocessing()