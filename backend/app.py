from flask import Flask, request, jsonify
from flask_cors import CORS
import pandas as pd
from predict_enhanced import enhanced_predictor
from auth import auth_system
from database import db
import joblib
import os

app = Flask(__name__)
CORS(app)

# Load model metadata for API info
try:
    model_metadata = joblib.load('model_metadata_enhanced.pkl')
    MODEL_INFO = {
        'name': model_metadata.get('model_name', 'Enhanced AI Model'),
        'r2_score': model_metadata.get('performance', {}).get('r2_score', 'N/A'),
        'features_used': len(model_metadata.get('features_used', [])),
        'training_date': model_metadata.get('training_date', 'N/A')
    }
except:
    MODEL_INFO = {
        'name': 'Enhanced AI Model',
        'r2_score': 'N/A',
        'features_used': 'N/A',
        'training_date': 'N/A'
    }

# Helper function to get user from session
def get_current_user():
    auth_header = request.headers.get('Authorization')
    if auth_header and auth_header.startswith('Bearer '):
        session_token = auth_header[7:]  # Remove 'Bearer ' prefix
        return auth_system.verify_session(session_token)
    return None

# ==================== AUTHENTICATION ROUTES ====================

@app.route('/api/auth/register', methods=['POST'])
def register():
    """User registration endpoint"""
    try:
        data = request.get_json()
        
        required_fields = ['email', 'password', 'full_name']
        for field in required_fields:
            if field not in data:
                return jsonify({'success': False, 'message': f'Missing field: {field}'}), 400
        
        result = auth_system.register_user(
            email=data['email'],
            password=data['password'],
            full_name=data['full_name'],
            household_size=data.get('household_size', 4),
            region=data.get('region', 'Urban'),
            consumer_type=data.get('consumer_type', 'General')
        )
        
        return jsonify(result)
        
    except Exception as e:
        return jsonify({'success': False, 'message': str(e)}), 500

@app.route('/api/auth/login', methods=['POST'])
def login():
    """User login endpoint"""
    try:
        data = request.get_json()
        
        if 'email' not in data or 'password' not in data:
            return jsonify({'success': False, 'message': 'Email and password required'}), 400
        
        result = auth_system.login_user(data['email'], data['password'])
        return jsonify(result)
        
    except Exception as e:
        return jsonify({'success': False, 'message': str(e)}), 500

@app.route('/api/auth/logout', methods=['POST'])
def logout():
    """User logout endpoint"""
    try:
        auth_header = request.headers.get('Authorization')
        if auth_header and auth_header.startswith('Bearer '):
            session_token = auth_header[7:]
            result = auth_system.logout_user(session_token)
            return jsonify(result)
        return jsonify({'success': True, 'message': 'Logged out'})
        
    except Exception as e:
        return jsonify({'success': False, 'message': str(e)}), 500

@app.route('/api/auth/request-password-reset', methods=['POST'])
def request_password_reset():
    """Request password reset"""
    try:
        data = request.get_json()
        
        if 'email' not in data:
            return jsonify({'success': False, 'message': 'Email required'}), 400
        
        result = auth_system.request_password_reset(data['email'])
        return jsonify(result)
        
    except Exception as e:
        return jsonify({'success': False, 'message': str(e)}), 500

@app.route('/api/auth/reset-password', methods=['POST'])
def reset_password():
    """Reset password with token"""
    try:
        data = request.get_json()
        
        if 'token' not in data or 'new_password' not in data:
            return jsonify({'success': False, 'message': 'Token and new password required'}), 400
        
        result = auth_system.reset_password(data['token'], data['new_password'])
        return jsonify(result)
        
    except Exception as e:
        return jsonify({'success': False, 'message': str(e)}), 500

@app.route('/api/auth/profile', methods=['GET'])
def get_profile():
    """Get user profile"""
    user = get_current_user()
    if not user:
        return jsonify({'success': False, 'message': 'Authentication required'}), 401
    
    profile = auth_system.get_user_profile(user['id'])
    return jsonify({'success': True, 'profile': profile, 'user': user})

@app.route('/api/auth/profile', methods=['PUT'])
def update_profile():
    """Update user profile"""
    user = get_current_user()
    if not user:
        return jsonify({'success': False, 'message': 'Authentication required'}), 401
    
    try:
        data = request.get_json()
        result = auth_system.update_user_profile(user['id'], **data)
        return jsonify(result)
        
    except Exception as e:
        return jsonify({'success': False, 'message': str(e)}), 500

# ==================== PROTECTED PREDICTION ROUTES ====================

@app.route('/api/predict', methods=['POST'])
def predict_bill():
    """
    Enhanced prediction endpoint with user tracking
    """
    user = get_current_user()
    
    try:
        data = request.get_json()
        
        # Validate required fields
        required_fields = ['household_size', 'num_appliances', 'ac_units', 'fridge_count',
                          'fan_count', 'usage_hours', 'previous_units', 'region', 'consumer_type']
        
        missing_fields = [field for field in required_fields if field not in data]
        if missing_fields:
            return jsonify({
                'error': f'Missing required fields: {missing_fields}',
                'status': 'error'
            }), 400
        
        # Validate field types and ranges
        validation_errors = []
        
        # Check numeric fields
        numeric_fields = {
            'household_size': (1, 15),
            'num_appliances': (1, 50),
            'ac_units': (0, 10),
            'fridge_count': (0, 5),
            'fan_count': (0, 20),
            'usage_hours': (1, 24),
            'previous_units': (0, 5000)
        }
        
        for field, (min_val, max_val) in numeric_fields.items():
            value = data.get(field, 0)
            if not (min_val <= value <= max_val):
                validation_errors.append(f'{field} should be between {min_val} and {max_val}')
        
        if validation_errors:
            return jsonify({
                'error': 'Invalid input values',
                'details': validation_errors,
                'status': 'error'
            }), 400
        
        # Make enhanced prediction
        result = enhanced_predictor.predict_enhanced_bill(data)
        
        # Store prediction in database if user is logged in
        if user:
            try:
                conn = db.get_connection()
                cursor = conn.cursor()
                
                cursor.execute('''
                    INSERT INTO user_predictions 
                    (user_id, input_data, predicted_units, predicted_bill)
                    VALUES (?, ?, ?, ?)
                ''', (
                    user['id'], 
                    str(data), 
                    result.get('estimated_units', 0), 
                    result.get('predicted_bill', 0)
                ))
                
                conn.commit()
                conn.close()
                
            except Exception as e:
                print(f"Failed to save prediction: {e}")
        
        # Add input summary
        result['input_summary'] = {
            'household_size': data['household_size'],
            'total_appliances': data['num_appliances'],
            'ac_units': data['ac_units'],
            'previous_consumption': f"{data['previous_units']} units/month",
            'consumer_category': data['consumer_type'],
            'usage_hours': f"{data['usage_hours']} hours/day"
        }
        
        # Add user info if logged in
        if user:
            result['user'] = {
                'id': user['id'],
                'email': user['email'],
                'full_name': user['full_name']
            }
        
        return jsonify(result)
            
    except Exception as e:
        return jsonify({
            'error': str(e),
            'status': 'error'
        }), 500

# ==================== PUBLIC ROUTES ====================

@app.route('/')
def home():
    return jsonify({
        "message": "Pak Bill Optimizer Enhanced API with Authentication!",
        "model_info": MODEL_INFO,
        "version": "3.0 - User Accounts & Authentication",
        "features": "AI trained on 41 houses with user accounts and data persistence"
    })

@app.route('/api/calculate-units', methods=['POST'])
def calculate_units():
    """
    Calculate units from appliance usage (Public)
    """
    try:
        data = request.get_json()
        
        if not data or 'appliances' not in data:
            return jsonify({'error': 'Missing appliances data', 'status': 'error'}), 400
        
        # Calculate units using enhanced method
        total_units = enhanced_predictor.calculate_units_from_appliances(data['appliances'])
        
        # Additional analysis
        analysis = {
            'daily_units': round(total_units / 30, 2),
            'estimated_monthly_bill': enhanced_predictor.calculate_bill_from_units(total_units),
            'appliance_count': len(data['appliances'])
        }
        
        return jsonify({
            'total_units': total_units,
            'analysis': analysis,
            'status': 'success'
        })
        
    except Exception as e:
        return jsonify({'error': str(e), 'status': 'error'}), 500

@app.route('/api/nepra-info', methods=['GET'])
def get_nepra_info():
    """
    Return NEPRA tariff information from database
    """
    try:
        conn = db.get_connection()
        cursor = conn.cursor()
        
        cursor.execute('''
            SELECT consumer_type, min_units, max_units, rate, description
            FROM tariff_slabs 
            WHERE is_active = 1
            ORDER BY consumer_type, min_units
        ''')
        
        slabs = cursor.fetchall()
        conn.close()
        
        # Format response
        nepra_data = {}
        for slab in slabs:
            consumer_type, min_units, max_units, rate, description = slab
            
            if consumer_type not in nepra_data:
                nepra_data[consumer_type] = {
                    'description': f'{consumer_type} Consumer',
                    'slabs': []
                }
            
            range_str = f"{min_units}-{max_units} units" if max_units else f"Above {min_units} units"
            
            nepra_data[consumer_type]['slabs'].append({
                'range': range_str,
                'rate': float(rate),
                'savings_tip': description
            })
        
        # Add AI insights based on training data
        ai_insights = {
            'average_consumption': 'Based on 41 houses: 200-400 units/month',
            'major_consumers': 'AC units contribute 40-60% of total bill in summer',
            'peak_usage': '6 PM - 10 PM is typical peak consumption time',
            'savings_tip': 'Reducing AC usage by 2 hours daily can save 20-30% in summer',
            'optimal_range': '150-250 units monthly is most cost-effective for average households'
        }
        
        return jsonify({
            'tariff_slabs': nepra_data,
            'ai_insights': ai_insights,
            'last_updated': '2024',
            'source': 'NEPRA Official Tariffs (Database)',
            'note': 'Rates are per unit in Pakistani Rupees. Additional taxes and duties may apply.'
        })
        
    except Exception as e:
        # Fallback to hardcoded data if database fails
        print(f"Database error, using fallback data: {e}")
        return get_nepra_info_fallback()

def get_nepra_info_fallback():
    """Fallback NEPRA data if database fails"""
    nepra_data = {
        'lifeline': {
            'description': 'Up to 100 units - Subsidized Rates',
            'slabs': [
                {'range': '1-100 units', 'rate': 3.95, 'savings_tip': 'Ideal for small families, try to stay below 100 units'},
                {'range': 'Above 100 units', 'rate': 7.74, 'savings_tip': 'You lose lifeline benefits above 100 units'}
            ]
        },
        'protected': {
            'description': 'Up to 200 units - Government Protected Rates',
            'slabs': [
                {'range': '1-100 units', 'rate': 7.74, 'savings_tip': 'Good for medium consumption households'},
                {'range': '101-200 units', 'rate': 10.06, 'savings_tip': 'Stay below 200 units for optimal rates'},
                {'range': 'Above 200 units', 'rate': 12.15, 'savings_tip': 'Crossing 200 units increases cost significantly'}
            ]
        },
        'general': {
            'description': 'Above 200 units - General Commercial Rates',
            'slabs': [
                {'range': '1-100 units', 'rate': 16.48, 'savings_tip': 'High base rate - optimize usage patterns'},
                {'range': '101-200 units', 'rate': 22.95, 'savings_tip': 'Focus on energy efficiency measures'},
                {'range': '201-300 units', 'rate': 26.66, 'savings_tip': 'AC usage is major contributor at this level'},
                {'range': '301-700 units', 'rate': 32.03, 'savings_tip': 'Time to audit and optimize all appliances'},
                {'range': 'Above 700 units', 'rate': 35.53, 'savings_tip': 'High consumption - professional audit recommended'}
            ]
        }
    }
    
    ai_insights = {
        'average_consumption': 'Based on 41 houses: 200-400 units/month',
        'major_consumers': 'AC units contribute 40-60% of total bill in summer',
        'peak_usage': '6 PM - 10 PM is typical peak consumption time',
        'savings_tip': 'Reducing AC usage by 2 hours daily can save 20-30% in summer',
        'optimal_range': '150-250 units monthly is most cost-effective for average households'
    }
    
    return jsonify({
        'tariff_slabs': nepra_data,
        'ai_insights': ai_insights,
        'last_updated': '2024',
        'source': 'NEPRA Official Tariffs (Fallback)',
        'note': 'Rates are per unit in Pakistani Rupees. Additional taxes and duties may apply.'
    })

@app.route('/api/model-info', methods=['GET'])
def get_model_info():
    """
    Return detailed information about the AI model
    """
    try:
        metadata = joblib.load('model_metadata_enhanced.pkl')
        
        model_info = {
            'model_name': metadata.get('model_name', 'Enhanced AI Model'),
            'model_type': metadata.get('model_type', 'Ensemble'),
            'performance': metadata.get('performance', {}),
            'training_data': {
                'houses_used': metadata.get('dataset_info', {}).get('total_houses', 41),
                'features_selected': metadata.get('dataset_info', {}).get('total_features', 20),
                'training_date': metadata.get('training_date', 'N/A')
            },
            'key_learnings': {
                'major_consumers': 'AC units and kitchen appliances',
                'peak_patterns': 'Evening hours (6-10 PM) highest consumption',
                'savings_opportunities': 'AC optimization yields highest returns',
                'behavioral_patterns': 'Weekend usage 10-15% higher than weekdays'
            },
            'prediction_notes': [
                'Predictions are based on 41 real Pakistani households',
                'Model considers appliance usage patterns and time-based consumption',
                'Results include realistic constraints and validation',
                'Fallback calculations used when AI prediction seems unrealistic'
            ]
        }
        
        return jsonify(model_info)
        
    except Exception as e:
        return jsonify({
            'model_name': 'Reliable Calculator',
            'status': 'Using reliable calculation method',
            'note': 'AI model information not available, using fallback calculations'
        })

# ==================== ADMIN ROUTES ====================

@app.route('/api/admin/tariffs', methods=['GET'])
def get_tariffs_admin():
    """Admin endpoint to get all tariffs"""
    user = get_current_user()
    if not user or not user.get('is_admin'):
        return jsonify({'success': False, 'message': 'Admin access required'}), 403
    
    try:
        conn = db.get_connection()
        cursor = conn.cursor()
        
        cursor.execute('''
            SELECT id, consumer_type, min_units, max_units, rate, description, is_active, effective_date
            FROM tariff_slabs 
            ORDER BY consumer_type, min_units
        ''')
        
        tariffs = []
        for row in cursor.fetchall():
            tariffs.append({
                'id': row[0],
                'consumer_type': row[1],
                'min_units': row[2],
                'max_units': row[3],
                'rate': float(row[4]),
                'description': row[5],
                'is_active': bool(row[6]),
                'effective_date': row[7]
            })
        
        conn.close()
        return jsonify({'success': True, 'tariffs': tariffs})
        
    except Exception as e:
        return jsonify({'success': False, 'message': str(e)}), 500

@app.route('/api/admin/tariffs', methods=['POST'])
def update_tariff():
    """Admin endpoint to update tariff rates"""
    user = get_current_user()
    if not user or not user.get('is_admin'):
        return jsonify({'success': False, 'message': 'Admin access required'}), 403
    
    try:
        data = request.get_json()
        
        if 'id' not in data or 'rate' not in data:
            return jsonify({'success': False, 'message': 'Tariff ID and rate required'}), 400
        
        conn = db.get_connection()
        cursor = conn.cursor()
        
        cursor.execute('''
            UPDATE tariff_slabs 
            SET rate = ?, updated_at = CURRENT_TIMESTAMP
            WHERE id = ?
        ''', (data['rate'], data['id']))
        
        conn.commit()
        conn.close()
        
        return jsonify({'success': True, 'message': 'Tariff updated successfully'})
        
    except Exception as e:
        return jsonify({'success': False, 'message': str(e)}), 500

if __name__ == '__main__':
    print("🚀 Starting Pak Bill Optimizer with User Authentication...")
    print("📊 Database: SQLite with user accounts and data persistence")
    print("🔐 Features: Registration, Login, Password Reset, Profile Management")
    print("👨‍💼 Admin: Basic tariff management")
    print("🌐 Server running on: http://127.0.0.1:5000")
    
    # Initialize database if not exists
    db.init_database()
    
    app.run(debug=True, host='0.0.0.0', port=5000)