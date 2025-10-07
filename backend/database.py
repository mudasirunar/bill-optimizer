import sqlite3
import os
from datetime import datetime
import hashlib


class Database:
    def __init__(self, db_path='electricity_bill_optimizer.db'):
        self.db_path = db_path
        self.init_database()
    
    def get_connection(self):
        return sqlite3.connect(self.db_path)
    
    def init_database(self):
        """Initialize database with all required tables"""
        conn = self.get_connection()
        cursor = conn.cursor()
        
        # Users table
        cursor.execute('''
            CREATE TABLE IF NOT EXISTS users (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                email VARCHAR(255) UNIQUE NOT NULL,
                password_hash VARCHAR(255) NOT NULL,
                full_name VARCHAR(255) NOT NULL,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                is_active BOOLEAN DEFAULT 1,
                is_admin BOOLEAN DEFAULT 0
            )
        ''')
        
        # User profiles table
        cursor.execute('''
            CREATE TABLE IF NOT EXISTS user_profiles (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                user_id INTEGER NOT NULL,
                household_size INTEGER DEFAULT 4,
                region VARCHAR(100) DEFAULT 'Urban',
                consumer_type VARCHAR(50) DEFAULT 'General',
                address TEXT,
                phone_number VARCHAR(20),
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
            )
        ''')
        
        # User sessions table
        cursor.execute('''
            CREATE TABLE IF NOT EXISTS user_sessions (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                user_id INTEGER NOT NULL,
                session_token VARCHAR(255) UNIQUE NOT NULL,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                expires_at DATETIME NOT NULL,
                FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
            )
        ''')
        
        # Password reset tokens table
        cursor.execute('''
            CREATE TABLE IF NOT EXISTS password_reset_tokens (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                user_id INTEGER NOT NULL,
                token VARCHAR(255) UNIQUE NOT NULL,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                expires_at DATETIME NOT NULL,
                used BOOLEAN DEFAULT 0,
                FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
            )
        ''')
        
        # Tariff slabs table (for admin management)
        cursor.execute('''
            CREATE TABLE IF NOT EXISTS tariff_slabs (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                consumer_type VARCHAR(50) NOT NULL,
                min_units INTEGER NOT NULL,
                max_units INTEGER,
                rate DECIMAL(10,2) NOT NULL,
                description VARCHAR(255),
                is_active BOOLEAN DEFAULT 1,
                effective_date DATE DEFAULT CURRENT_DATE,
                created_by INTEGER,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
            )
        ''')
        
        # User consumption history
        cursor.execute('''
            CREATE TABLE IF NOT EXISTS user_consumption_history (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                user_id INTEGER NOT NULL,
                month_year VARCHAR(7) NOT NULL, -- Format: YYYY-MM
                units_used DECIMAL(10,2) NOT NULL,
                bill_amount DECIMAL(10,2) NOT NULL,
                predicted_units DECIMAL(10,2),
                predicted_bill DECIMAL(10,2),
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
            )
        ''')
        
        # User predictions history
        cursor.execute('''
            CREATE TABLE IF NOT EXISTS user_predictions (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                user_id INTEGER NOT NULL,
                input_data JSON NOT NULL,
                predicted_units DECIMAL(10,2) NOT NULL,
                predicted_bill DECIMAL(10,2) NOT NULL,
                actual_units DECIMAL(10,2),
                actual_bill DECIMAL(10,2),
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
            )
        ''')
        
        # Appliances catalog
        cursor.execute('''
            CREATE TABLE IF NOT EXISTS appliances (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                name VARCHAR(255) NOT NULL,
                category VARCHAR(100) NOT NULL,
                wattage INTEGER NOT NULL,
                description TEXT,
                is_active BOOLEAN DEFAULT 1,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP
            )
        ''')
        
        # User appliances (inventory)
        cursor.execute('''
            CREATE TABLE IF NOT EXISTS user_appliances (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                user_id INTEGER NOT NULL,
                appliance_id INTEGER,
                custom_name VARCHAR(255),
                custom_wattage INTEGER,
                count INTEGER DEFAULT 1,
                avg_usage_hours DECIMAL(5,2) DEFAULT 0,
                is_active BOOLEAN DEFAULT 1,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE,
                FOREIGN KEY (appliance_id) REFERENCES appliances (id) ON DELETE SET NULL
            )
        ''')
        
        # Insert default admin user
        cursor.execute('''
            INSERT OR IGNORE INTO users (email, password_hash, full_name, is_admin)
            VALUES (?, ?, ?, ?)
        ''', ('admin@billoptimizer.com', 
              hashlib.sha256('admin123'.encode()).hexdigest(), 
              'System Administrator', 1))
        
        # Insert default tariff slabs
        default_tariffs = [
            ('Lifeline', 1, 100, 3.95, 'First 100 units'),
            ('Lifeline', 101, None, 7.74, 'Above 100 units'),
            ('Protected', 1, 100, 7.74, 'First 100 units'),
            ('Protected', 101, 200, 10.06, '101-200 units'),
            ('Protected', 201, None, 12.15, 'Above 200 units'),
            ('General', 1, 100, 16.48, 'First 100 units'),
            ('General', 101, 200, 22.95, '101-200 units'),
            ('General', 201, 300, 26.66, '201-300 units'),
            ('General', 301, 700, 32.03, '301-700 units'),
            ('General', 701, None, 35.53, 'Above 700 units')
        ]
        
        cursor.executemany('''
            INSERT OR IGNORE INTO tariff_slabs (consumer_type, min_units, max_units, rate, description)
            VALUES (?, ?, ?, ?, ?)
        ''', default_tariffs)
        
        # Insert default appliances
        default_appliances = [
            ('Air Conditioner', 'Cooling', 1500, 'Split AC Unit'),
            ('Refrigerator', 'Kitchen', 150, 'Standard Refrigerator'),
            ('Ceiling Fan', 'Cooling', 75, 'Standard Ceiling Fan'),
            ('LED Light', 'Lighting', 20, 'Energy Efficient LED'),
            ('Television', 'Entertainment', 100, 'LED TV'),
            ('Computer', 'Office', 200, 'Desktop Computer'),
            ('Washing Machine', 'Laundry', 500, 'Automatic Washing Machine'),
            ('Electric Iron', 'Laundry', 1000, 'Clothes Iron'),
            ('Microwave Oven', 'Kitchen', 1000, 'Standard Microwave'),
            ('Water Heater', 'Heating', 2000, 'Instant Water Heater'),
            ('Electric Oven', 'Kitchen', 2000, 'Baking Oven'),
            ('Dishwasher', 'Kitchen', 1200, 'Automatic Dishwasher')
        ]
        
        cursor.executemany('''
            INSERT OR IGNORE INTO appliances (name, category, wattage, description)
            VALUES (?, ?, ?, ?)
        ''', default_appliances)
        
        conn.commit()
        conn.close()
        
        print("✅ Database initialized successfully!")
    
    def hash_password(self, password):
        """Simple password hashing for development"""
        return hashlib.sha256(password.encode()).hexdigest()
    
    def verify_password(self, password, password_hash):
        """Verify password against hash"""
        return self.hash_password(password) == password_hash

# Global database instance
db = Database()