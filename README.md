# ⚡ AI-Powered Electricity Bill Optimizer (FYP 2026)
**University:** Sir Syed University of Engineering and Technology  
**Focus:** Seasonal Intelligence, Load Forecasting, and Tariff Optimization

## 🚀 Overview
A sophisticated energy management system tailored for the Pakistani energy landscape. Using the **PRECON Dataset**, this system employs a hybrid approach combining **Random Forest Regression** for seasonal bill prediction and **LSTM (Long Short-Term Memory)** networks for 24-hour load forecasting.

## 🧠 Model v2 Features (Seasonal Intelligence)
- **KNN Archetype Matching:** Finds the "Energy Twin" of a user from real-world PRECON household signatures.
- **Seasonal Scaling:** Dynamically adjusts appliance weights (AC, Fridge, Kitchen) based on monthly thermal coefficients.
- **Recency-Weighted Calibration:** Historical bill data is processed using exponential decay to prioritize recent lifestyle changes.
- **Bi-LSTM Forecaster:** A Bidirectional LSTM model with Layer Normalization to predict next-day consumption spikes.

## 🛠️ Tech Stack
- **Backend:** Flask (Python), TensorFlow, Scikit-learn
- **Frontend:** HTML5, CSS3 (Premium Dark Theme), Chart.js
- **Database:** Firebase Firestore (Cloud Sync & AI Memory)
- **Deployment:** Git/GitHub for Version Control

## 📁 Project Structure
- `/backend`: Flask API, ML models, and NEPRA tariff engine.
- `/frontend`: Responsive dashboard and AI profile setup.
- `/data`: (Local only) Raw and processed PRECON dataset files.

