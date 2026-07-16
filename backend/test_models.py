import os
import unittest
import joblib
import numpy as np

class TestAIModels(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        # Resolve path directories
        cls.base_dir = os.path.dirname(__file__)
        cls.models_dir = os.path.join(cls.base_dir, "data", "processed", "models")
        
        # Load models if they exist
        cls.rf_path = os.path.join(cls.models_dir, "rf_bill_predictor.pkl")
        cls.knn_path = os.path.join(cls.models_dir, "knn_archetype.pkl")
        cls.lstm_path = os.path.join(cls.models_dir, "lstm_forecaster.keras")
        cls.scaler_path = os.path.join(cls.models_dir, "lstm_scaler.pkl")
        print("\n" + "="*80 + "\n  AI MODEL TEST SUITE INITIALIZATION\n" + "="*80)

    def test_random_forest_loading_and_inference(self):
        """Verify the Random Forest monthly predictor loads and outputs correct dimensions."""
        print("\n[TEST 1] RandomForest Monthly Consumption Regressor:")
        if not os.path.exists(self.rf_path):
            self.skipTest("Random Forest model file not found. Run train_model.py first.")
            
        model = joblib.load(self.rf_path)
        print(f"  -> Model file loaded successfully from: {self.rf_path}")
        
        # Dummy profile with 13 features matching BILL_FEATURES:
        # ac_monthly, kitchen, fridge, ups, water_pump, weekend, month_num,
        # person_count, property_area, ac_count, fridge_count, ups_count, floors
        dummy_input = np.array([[300.0, 50.0, 100.0, 10.0, 20.0, 1.5, 7.0, 4.0, 1000.0, 2.0, 1.0, 1.0, 2.0]])
        print("  -> Fed input vector values (Mock Household Profile):")
        print("     * AC Monthly Scaled Load: 300.0 kWh   * Kitchen: 50.0 kWh    * Refrigerator: 100.0 kWh")
        print("     * Occupant Count: 4.0 people         * Floor Area: 1000.0 sqft * Sanctioned Load: 2.0 kW")
        
        prediction = model.predict(dummy_input)
        print(f"  -> Prediction Output: {prediction[0]:.2f} kWh/month")
        
        self.assertEqual(prediction.shape, (1,))
        self.assertGreater(prediction[0], 0, "Predicted consumption should be positive.")
        print("  ✅ RandomForest Verification: PASS")

    def test_knn_archetype_loading_and_inference(self):
        """Verify the KNN Archetype Matcher maps profile vectors correctly."""
        print("\n[TEST 2] KNN Archetype Pattern Matcher:")
        if not os.path.exists(self.knn_path):
            self.skipTest("KNN model file not found. Run train_model.py first.")
            
        model = joblib.load(self.knn_path)
        scaler = joblib.load(os.path.join(self.models_dir, "knn_scaler.pkl"))
        house_ids = joblib.load(os.path.join(self.models_dir, "knn_house_ids.pkl"))
        print(f"  -> KNN Model, Scaler, and Archetype Indexes loaded successfully.")
        
        # Dummy profile: 3 ACs, 1 fridge, 5 people, 1 UPS, 8 fans, 1 washing machine
        dummy_profile = np.array([[3, 1, 5, 1, 8, 1]])
        dummy_scaled = scaler.transform(dummy_profile)
        print("  -> Query Profile: 3 ACs, 1 Fridge, 5 Occupants, 1 UPS, 8 Fans, 1 Washing Machine")
        
        distances, indices = model.kneighbors(dummy_scaled)
        print("  -> KNN Distance Matching Results (Top 3 PRECON Matches):")
        for rank, (dist, idx) in enumerate(zip(distances[0], indices[0])):
            print(f"     Rank {rank+1}: Archetype ID -> {house_ids[idx]:<8} | Euclidean Distance: {dist:.4f}")
            
        self.assertEqual(distances.shape, (1, 3))
        self.assertEqual(indices.shape, (1, 3))
        print("  ✅ KNN Archetype Pattern Verification: PASS")

    def test_lstm_model_loading_and_shape(self):
        """Verify the Bi-LSTM model loads and forecasts 24 steps from a 48-hour lookback window."""
        print("\n[TEST 3] Bidirectional LSTM Hourly Load Shape Forecaster:")
        if not os.path.exists(self.lstm_path):
            self.skipTest("LSTM model file not found. Run train_model.py first.")
            
        try:
            import tensorflow as tf
            model = tf.keras.models.load_model(self.lstm_path)
            print(f"  -> Keras Deep Learning Model loaded successfully from: {self.lstm_path}")
        except ImportError:
            self.skipTest("TensorFlow is not installed. Cannot test Keras model.")

        # LSTM sequence input shape: (batch_size, lookback_steps=48, n_features=10)
        dummy_sequence = np.random.randn(1, 48, 10)
        print(f"  -> Input Sequence Shape: {dummy_sequence.shape} (1 Batch, 48-hour history window, 10 features)")
        
        forecast = model.predict(dummy_sequence, verbose=0)
        print(f"  -> Output Prediction Matrix Shape: {forecast.shape} (1 Batch, 24-hour diurnal profile)")
        print(f"  -> Output Forecast Values Sample (First 5 Hours kW): {forecast[0][:5]}")
        
        # Expecting a 24-step hourly forecast output
        self.assertEqual(forecast.shape, (1, 24))
        print("  ✅ Bi-LSTM Time-Series Network Verification: PASS")
        print("\n" + "="*80 + "\n")

if __name__ == "__main__":
    unittest.main()
