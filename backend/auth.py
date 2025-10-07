from database import db
import secrets
from datetime import datetime, timedelta
import smtplib
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
import os

class AuthSystem:
    def __init__(self):
        self.session_duration = timedelta(days=7)  # Sessions last 7 days
    
    def register_user(self, email, password, full_name, household_size=4, region='Urban', consumer_type='General'):
        """Register a new user"""
        try:
            conn = db.get_connection()
            cursor = conn.cursor()
            
            # Check if user already exists
            cursor.execute('SELECT id FROM users WHERE email = ?', (email,))
            if cursor.fetchone():
                return {'success': False, 'message': 'Email already registered'}
            
            # Create user
            password_hash = db.hash_password(password)
            cursor.execute('''
                INSERT INTO users (email, password_hash, full_name)
                VALUES (?, ?, ?)
            ''', (email, password_hash, full_name))
            
            user_id = cursor.lastrowid
            
            # Create user profile
            cursor.execute('''
                INSERT INTO user_profiles (user_id, household_size, region, consumer_type)
                VALUES (?, ?, ?, ?)
            ''', (user_id, household_size, region, consumer_type))
            
            conn.commit()
            conn.close()
            
            return {'success': True, 'message': 'Registration successful', 'user_id': user_id}
            
        except Exception as e:
            return {'success': False, 'message': f'Registration failed: {str(e)}'}
    
    def login_user(self, email, password):
        """Authenticate user and create session"""
        try:
            conn = db.get_connection()
            cursor = conn.cursor()
            
            # Get user
            cursor.execute('''
                SELECT id, email, password_hash, full_name, is_admin 
                FROM users 
                WHERE email = ? AND is_active = 1
            ''', (email,))
            user = cursor.fetchone()
            
            if not user:
                return {'success': False, 'message': 'Invalid email or password'}
            
            user_id, user_email, password_hash, full_name, is_admin = user
            
            # Verify password
            if not db.verify_password(password, password_hash):
                return {'success': False, 'message': 'Invalid email or password'}
            
            # Create session
            session_token = secrets.token_urlsafe(32)
            expires_at = datetime.now() + self.session_duration
            
            cursor.execute('''
                INSERT INTO user_sessions (user_id, session_token, expires_at)
                VALUES (?, ?, ?)
            ''', (user_id, session_token, expires_at))
            
            conn.commit()
            conn.close()
            
            return {
                'success': True, 
                'message': 'Login successful',
                'session_token': session_token,
                'user': {
                    'id': user_id,
                    'email': user_email,
                    'full_name': full_name,
                    'is_admin': bool(is_admin)
                }
            }
            
        except Exception as e:
            return {'success': False, 'message': f'Login failed: {str(e)}'}
    
    def verify_session(self, session_token):
        """Verify session token and return user data"""
        try:
            conn = db.get_connection()
            cursor = conn.cursor()
            
            cursor.execute('''
                SELECT u.id, u.email, u.full_name, u.is_admin, us.expires_at
                FROM user_sessions us
                JOIN users u ON us.user_id = u.id
                WHERE us.session_token = ? AND us.expires_at > ? AND u.is_active = 1
            ''', (session_token, datetime.now()))
            
            session = cursor.fetchone()
            conn.close()
            
            if not session:
                return None
            
            user_id, email, full_name, is_admin, expires_at = session
            return {
                'id': user_id,
                'email': email,
                'full_name': full_name,
                'is_admin': bool(is_admin)
            }
            
        except Exception as e:
            print(f"Session verification error: {e}")
            return None
    
    def logout_user(self, session_token):
        """Invalidate session token"""
        try:
            conn = db.get_connection()
            cursor = conn.cursor()
            
            cursor.execute('DELETE FROM user_sessions WHERE session_token = ?', (session_token,))
            conn.commit()
            conn.close()
            
            return {'success': True, 'message': 'Logout successful'}
            
        except Exception as e:
            return {'success': False, 'message': f'Logout failed: {str(e)}'}
    
    def request_password_reset(self, email):
        """Generate password reset token and send email"""
        try:
            conn = db.get_connection()
            cursor = conn.cursor()
            
            # Get user
            cursor.execute('SELECT id FROM users WHERE email = ? AND is_active = 1', (email,))
            user = cursor.fetchone()
            
            if not user:
                return {'success': True, 'message': 'If email exists, reset instructions sent'}  # Don't reveal if email exists
            
            user_id = user[0]
            
            # Generate reset token
            reset_token = secrets.token_urlsafe(32)
            expires_at = datetime.now() + timedelta(hours=24)
            
            # Invalidate any existing tokens
            cursor.execute('UPDATE password_reset_tokens SET used = 1 WHERE user_id = ?', (user_id,))
            
            # Create new token
            cursor.execute('''
                INSERT INTO password_reset_tokens (user_id, token, expires_at)
                VALUES (?, ?, ?)
            ''', (user_id, reset_token, expires_at))
            
            conn.commit()
            conn.close()
            
            # In development, just return the token
            # In production, you would send an email here
            reset_link = f"http://localhost:8000/reset-password?token={reset_token}"
            
            print(f"🔐 Password Reset Link: {reset_link}")
            
            return {
                'success': True, 
                'message': 'Password reset instructions sent to your email',
                'reset_token': reset_token  # Only for development
            }
            
        except Exception as e:
            return {'success': False, 'message': f'Password reset request failed: {str(e)}'}
    
    def reset_password(self, reset_token, new_password):
        """Reset password using valid token"""
        try:
            conn = db.get_connection()
            cursor = conn.cursor()
            
            # Get valid token
            cursor.execute('''
                SELECT user_id FROM password_reset_tokens 
                WHERE token = ? AND expires_at > ? AND used = 0
            ''', (reset_token, datetime.now()))
            
            token_data = cursor.fetchone()
            
            if not token_data:
                return {'success': False, 'message': 'Invalid or expired reset token'}
            
            user_id = token_data[0]
            
            # Update password
            new_password_hash = db.hash_password(new_password)
            cursor.execute('UPDATE users SET password_hash = ? WHERE id = ?', (new_password_hash, user_id))
            
            # Mark token as used
            cursor.execute('UPDATE password_reset_tokens SET used = 1 WHERE token = ?', (reset_token,))
            
            conn.commit()
            conn.close()
            
            return {'success': True, 'message': 'Password reset successful'}
            
        except Exception as e:
            return {'success': False, 'message': f'Password reset failed: {str(e)}'}
    
    def get_user_profile(self, user_id):
        """Get user profile data"""
        try:
            conn = db.get_connection()
            cursor = conn.cursor()
            
            cursor.execute('''
                SELECT up.household_size, up.region, up.consumer_type, up.address, up.phone_number
                FROM user_profiles up
                WHERE up.user_id = ?
            ''', (user_id,))
            
            profile = cursor.fetchone()
            conn.close()
            
            if profile:
                return {
                    'household_size': profile[0],
                    'region': profile[1],
                    'consumer_type': profile[2],
                    'address': profile[3],
                    'phone_number': profile[4]
                }
            return None
            
        except Exception as e:
            print(f"Error getting user profile: {e}")
            return None
    
    def update_user_profile(self, user_id, **kwargs):
        """Update user profile data"""
        try:
            conn = db.get_connection()
            cursor = conn.cursor()
            
            allowed_fields = ['household_size', 'region', 'consumer_type', 'address', 'phone_number']
            updates = []
            values = []
            
            for field, value in kwargs.items():
                if field in allowed_fields and value is not None:
                    updates.append(f"{field} = ?")
                    values.append(value)
            
            if updates:
                values.append(user_id)
                cursor.execute(f'''
                    UPDATE user_profiles 
                    SET {', '.join(updates)}, updated_at = CURRENT_TIMESTAMP
                    WHERE user_id = ?
                ''', values)
                
                conn.commit()
            
            conn.close()
            return {'success': True, 'message': 'Profile updated successfully'}
            
        except Exception as e:
            return {'success': False, 'message': f'Profile update failed: {str(e)}'}

# Global auth instance
auth_system = AuthSystem()