import pandas as pd
import numpy as np

def detailed_data_analysis():
    """Comprehensive analysis of your dataset to find all 42 houses"""
    print("🔍 COMPREHENSIVE DATA ANALYSIS STARTING...")
    
    try:
        # Load data with different parameters to ensure we get all rows
        print("📂 Loading combined_houses.csv...")
        
        # Try different approaches to read the file
        try:
            df = pd.read_csv('combined_houses.csv', low_memory=False)
        except:
            df = pd.read_csv('combined_houses.csv', encoding='latin-1')
        
        print(f"✅ Dataset loaded: {len(df):,} rows × {len(df.columns)} columns")
        
        # Check House_ID column specifically
        print(f"\n🏠 HOUSE_ID COLUMN ANALYSIS:")
        print(f"Column name: 'House_ID'")
        print(f"Data type: {df['House_ID'].dtype}")
        print(f"Unique values count: {df['House_ID'].nunique()}")
        
        # Show all unique house IDs
        unique_houses = df['House_ID'].unique()
        print(f"All unique House_ID values ({len(unique_houses)}):")
        for i, house in enumerate(unique_houses):
            print(f"  {i+1:2d}. {house}")
        
        # Check if there are patterns in house names
        print(f"\n🔍 HOUSE NAME PATTERNS:")
        house_series = df['House_ID'].astype(str)
        
        # Check for numeric patterns
        numeric_houses = house_series.str.extract(r'(\d+)').dropna()
        if not numeric_houses.empty:
            print(f"Found numeric patterns in house names")
            unique_numeric = numeric_houses[0].unique()
            print(f"Unique numeric values: {sorted(unique_numeric)}")
        
        # Check for different naming conventions
        print(f"\n📊 SAMPLE COUNTS PER HOUSE:")
        house_counts = df['House_ID'].value_counts().head(20)  # Show top 20
        for house, count in house_counts.items():
            print(f"  {house}: {count:,} rows ({count/len(df)*100:.1f}%)")
        
        # Check data distribution across houses
        print(f"\n📈 DATA DISTRIBUTION:")
        total_rows = len(df)
        print(f"Total rows: {total_rows:,}")
        
        if len(unique_houses) == 42:
            expected_rows_per_house = total_rows / 42
            print(f"Expected rows per house (if equal): {expected_rows_per_house:,.0f}")
        else:
            print(f"⚠️  Found {len(unique_houses)} houses, but expected 42")
        
        # Check Date_Time range for each house
        print(f"\n📅 DATE RANGE ANALYSIS:")
        df['Date_Time'] = pd.to_datetime(df['Date_Time'])
        
        date_ranges = df.groupby('House_ID')['Date_Time'].agg(['min', 'max', 'count'])
        date_ranges['days_covered'] = (date_ranges['max'] - date_ranges['min']).dt.days
        
        print(date_ranges.head(10))  # Show first 10 houses
        
        # Check for data quality issues
        print(f"\n🔎 DATA QUALITY CHECK:")
        print(f"Missing values in House_ID: {df['House_ID'].isnull().sum()}")
        print(f"Missing values in Date_Time: {df['Date_Time'].isnull().sum()}")
        print(f"Missing values in Usage_kW: {df['Usage_kW'].isnull().sum()}")
        
        # Check for duplicate timestamps within houses
        print(f"\n⏰ TIMESTAMP ANALYSIS:")
        for house_id in unique_houses[:5]:  # Check first 5 houses
            house_data = df[df['House_ID'] == house_id]
            duplicate_timestamps = house_data['Date_Time'].duplicated().sum()
            print(f"  {house_id}: {duplicate_timestamps} duplicate timestamps")
        
        return df, unique_houses
        
    except Exception as e:
        print(f"❌ Error in detailed analysis: {e}")
        import traceback
        traceback.print_exc()
        return None, None

if __name__ == "__main__":
    df, houses = detailed_data_analysis()
    
    if houses is not None:
        print(f"\n🎯 SUMMARY:")
        print(f"Total houses found: {len(houses)}")
        if len(houses) == 42:
            print("✅ SUCCESS: Found all 42 houses!")
        else:
            print(f"⚠️  WARNING: Expected 42 houses, but found {len(houses)}")
            print("This could be due to:")
            print("1. Different naming conventions (House1, House_1, H1, etc.)")
            print("2. Data split across multiple files")
            print("3. Some houses have very little data")
            print("4. Encoding issues in the CSV file")