import os
import sys
import json
import unittest
from unittest.mock import patch, MagicMock
import numpy as np

# 1. Mock firebase_admin and tensorflow/joblib before importing app
mock_firebase = MagicMock()
sys.modules['firebase_admin'] = mock_firebase
sys.modules['firebase_admin.credentials'] = MagicMock()
mock_firestore = MagicMock()
sys.modules['firebase_admin.firestore'] = mock_firestore

mock_tensorflow = MagicMock()
sys.modules['tensorflow'] = mock_tensorflow
sys.modules['tensorflow.keras'] = mock_tensorflow.keras
sys.modules['tensorflow.keras.models'] = mock_tensorflow.keras.models

mock_joblib = MagicMock()
sys.modules['joblib'] = mock_joblib

# Helper function to mock joblib.load
def dummy_load(filepath):
    filename = os.path.basename(filepath)
    if filename == "bill_features.pkl":
        return ["ac_monthly", "kitchen_monthly", "refrigerator_monthly", "ups_monthly", "wp_monthly", "weekend_usage", "month_num", "person_count", "property_area", "meta_ac_count", "meta_fridge_count", "meta_ups_count", "floors"]
    elif filename == "knn_features.pkl":
        return ["No_of_ACs", "No_of_Refrigerators", "No_of_People", "No_of_UPS", "No_of_Fans", "No_of_WashingMachines"]
    elif filename == "knn_house_ids.pkl":
        return ["house_1", "house_2", "house_3"]
    # Model mocks
    mock_obj = MagicMock()
    if filename == "knn_scaler.pkl" or filename == "lstm_scaler.pkl":
        mock_obj.transform.side_effect = lambda x: x
    elif filename == "rf_bill_predictor.pkl":
        mock_obj.predict.return_value = np.array([120.0]) # Mock lower consumption prediction (120 units)
    elif filename == "knn_archetype.pkl":
        mock_obj.kneighbors.return_value = (np.array([[0.0]]), np.array([[0]]))
    return mock_obj

mock_joblib.load.side_effect = dummy_load

# Mock LSTM model loading
mock_lstm_model = MagicMock()
# Mock LSTM prediction to return 1 sequence of 24 hourly values
mock_lstm_model.predict.return_value = np.array([np.ones(24) * 0.5])
mock_tensorflow.keras.models.load_model.return_value = mock_lstm_model

# Ensure the backend directory is in the path
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))

# Import app AFTER mocking modules so top-level imports and executions don't crash
import app
from app import app as flask_app, db as mock_db

class TestAPIEndpoints(unittest.TestCase):

    def setUp(self):
        # Set up Flask test client
        self.client = flask_app.test_client()
        # Reset mocks
        mock_db.reset_mock()

    def test_home_route(self):
        # Test GET /
        res = self.client.get('/')
        self.assertEqual(res.status_code, 200)
        data = json.loads(res.data)
        self.assertEqual(data["status"], "online")
        self.assertEqual(data["project"], "Bill Optimizer AI")

    def test_setup_profile_route(self):
        # Test POST /api/setup_profile
        payload = {
            "uid": "user_123",
            "data": {
                "first_name": "Mudasir",
                "disco": "K-Electric",
                "user_category": "protected"
            }
        }
        res = self.client.post('/api/setup_profile', json=payload)
        self.assertEqual(res.status_code, 200)
        data = json.loads(res.data)
        self.assertEqual(data["status"], "success")

        # Verify Firestore collection setup
        mock_db.collection.assert_called_with('users')
        mock_db.collection('users').document.assert_called_with('user_123')
        mock_db.collection('users').document('user_123').set.assert_called_with(
            payload["data"], merge=True
        )

    def test_simulate_bill_route(self):
        # Test POST /api/simulate_bill
        payload = {
            "units": 150,
            "load_kw": 2.0,
            "category": "protected",
            "is_eligible": True
        }
        res = self.client.post('/api/simulate_bill', json=payload)
        self.assertEqual(res.status_code, 200)
        data = json.loads(res.data)
        self.assertEqual(data["status"], "success")
        self.assertIn("simulation", data)
        self.assertEqual(data["simulation"]["applied_category"], "protected")

    def test_forecast_24h_route_success(self):
        # Mock Firestore response for low-consumption user document
        mock_doc = MagicMock()
        mock_doc.exists = True
        mock_doc.to_dict.return_value = {
            "first_name": "Mudasir",
            "disco": "K-Electric",
            "user_category": "protected",
            "sanctioned_load": 2.0,
            "person_count": 2,
            "property_area": 200,
            "ac_std_qty": 0,
            "ac_inv_qty": 0,
            "f_qty": 1,
            "f_type": "new",
            "bill_history": [{"month": "2026-05", "units": 120}] # May history to avoid extreme scaling
        }
        mock_db.collection('users').document('user_123').get.return_value = mock_doc

        # Test POST /api/forecast_24h
        payload = {
            "uid": "user_123",
            "month": 6
        }
        res = self.client.post('/api/forecast_24h', json=payload)
        self.assertEqual(res.status_code, 200)
        data = json.loads(res.data)
        self.assertEqual(data["status"], "success")
        self.assertIn("forecast", data)
        self.assertEqual(len(data["forecast"]), 24)
        self.assertIn("finance", data)
        self.assertEqual(data["finance"]["applied_category"], "protected")

    def test_predict_bill_route_success(self):
        # Mock Firestore response for low-consumption user document
        mock_doc = MagicMock()
        mock_doc.exists = True
        mock_doc.to_dict.return_value = {
            "first_name": "Mudasir",
            "disco": "K-Electric",
            "user_category": "protected",
            "sanctioned_load": 2.0,
            "person_count": 2,
            "property_area": 200,
            "ac_std_qty": 0,
            "ac_inv_qty": 0,
            "f_qty": 1,
            "f_type": "new",
            "bill_history": [{"month": "2026-05", "units": 120}]
        }
        mock_db.collection('users').document('user_123').get.return_value = mock_doc

        # Test POST /api/predict_bill
        payload = {
            "uid": "user_123",
            "month": 6
        }
        res = self.client.post('/api/predict_bill', json=payload)
        self.assertEqual(res.status_code, 200)
        data = json.loads(res.data)
        self.assertEqual(data["status"], "success")
        self.assertIn("kwh", data)
        self.assertIn("bill", data)
        self.assertEqual(data["bill"]["applied_category"], "protected")

    def test_seasonal_preview_route_success(self):
        # Mock Firestore user doc
        mock_doc = MagicMock()
        mock_doc.exists = True
        mock_doc.to_dict.return_value = {
            "first_name": "Mudasir",
            "disco": "K-Electric",
            "user_category": "protected",
            "sanctioned_load": 2.0,
            "person_count": 4,
            "property_area": 1000,
            "bill_history": []
        }
        mock_db.collection('users').document('user_123').get.return_value = mock_doc

        # Test POST /api/seasonal_preview
        payload = {
            "uid": "user_123"
        }
        res = self.client.post('/api/seasonal_preview', json=payload)
        self.assertEqual(res.status_code, 200)
        data = json.loads(res.data)
        self.assertEqual(data["status"], "success")
        self.assertIn("monthly", data)
        self.assertEqual(len(data["monthly"]), 12) # Returns preview for 12 months

    @patch("app.get_gemini_response")
    def test_chat_route_success(self, mock_gemini):
        # Mock get_gemini_response response
        mock_gemini.return_value = "Hello! I am your assistant."

        # Mock Firestore user doc
        mock_doc = MagicMock()
        mock_doc.exists = True
        mock_doc.to_dict.return_value = {
            "first_name": "Mudasir",
            "disco": "K-Electric",
            "user_category": "protected",
            "sanctioned_load": 2.0,
            "person_count": 4,
            "property_area": 1000,
            "bill_history": []
        }
        mock_db.collection('users').document('user_123').get.return_value = mock_doc

        # Test POST /api/chat
        payload = {
            "uid": "user_123",
            "message": "How do I optimize AC usage?",
            "history": []
        }
        res = self.client.post('/api/chat', json=payload)
        self.assertEqual(res.status_code, 200)
        data = json.loads(res.data)
        self.assertEqual(data["status"], "success")
        self.assertEqual(data["reply"], "Hello! I am your assistant.")

    def test_route_user_not_found(self):
        # Mock Firestore user doc not existing
        mock_doc = MagicMock()
        mock_doc.exists = False
        mock_db.collection('users').document('user_123').get.return_value = mock_doc

        # Test predict bill where user is not found
        payload = {
            "uid": "user_123",
            "month": 6
        }
        res = self.client.post('/api/predict_bill', json=payload)
        self.assertEqual(res.status_code, 404)
        data = json.loads(res.data)
        self.assertIn("error", data)

if __name__ == '__main__':
    unittest.main()
