# ⚡ AI-Powered Electricity Bill Optimizer (FYP 2026)

**University:** Sir Syed University of Engineering and Technology (SSUET)  
**Focus:** Seasonal Intelligence, Load Forecasting, and NEPRA Tariff Optimization

## 🚀 Overview

A sophisticated cross-platform energy management system tailored for the Pakistani energy landscape. Utilizing the **PRECON Dataset**, this project employs a hybrid machine learning approach—combining **Random Forest Regression** for accurate seasonal bill prediction and **Bi-LSTM (Bidirectional Long Short-Term Memory)** networks for precise 24-hour load forecasting.

The ecosystem comprises a responsive Web Application, a native Android App, and a scalable Python/Flask Backend, all synchronized via Firebase.

---

## 🌐 Live Demos & Deployments

- **Frontend Web App:** https://bill-optimizer.vercel.app
- **Backend API:** https://bill-optimizer-fyp-lj83m.ondigitalocean.app

---

## 🛠️ Tech Stack & Ecosystem

### 1. 🐍 Backend (Machine Learning & Core Logic)
- **Framework:** Flask (Python 3.10)
- **Deployment:** DigitalOcean App Platform (Dockerized)
- **Machine Learning:** TensorFlow 2.x, Scikit-Learn, Pandas, NumPy
- **Key Features:**
  - `NepraEngine`: Accurately models Pakistani NEPRA slabs, protected/lifeline categories, and taxes.
  - Generates synthetic 24-hour load curves via LSTM and applies Random Forest for monthly forecasting.
  - Cross-platform configuration with dynamic OS-agnostic Virtual Environment redirection.

### 2. 💻 Frontend (Web Dashboard)
- **Technologies:** HTML5, CSS3, Vanilla JavaScript
- **UI/UX:** Immersive dark theme, dynamic glassmorphism aesthetics, responsive grids.
- **Visualization:** Chart.js for real-time 24-hour load curve analysis and appliance breakdown.
- **Key Features:** Setup profiles, interactive AI Memory dashboard, NEPRA tariff info, and dynamic appliance simulation.

### 3. 📱 Mobile App (Android Native)
- **Platform:** Android (Kotlin)
- **Architecture:** MVVM Architecture
- **Features:**
  - Secure authentication and synchronization via Firebase.
  - On-the-go bill predictions, 24-hour load forecasting, and appliance simulation.
  - Integrated with the Flask Backend REST APIs.

### 4. ☁️ Database & Authentication
- **Service:** Firebase Firestore & Firebase Authentication
- **Role:** Real-time data synchronization between the Web Dashboard and the Mobile App. Secure storage of user archetypes and AI memory.

### 5. 🤖 AI Energy Assistant (RAG System)
- **Retrieval-Augmented Generation (RAG) Architecture**: Integrates a Python Flask API endpoint (`/api/chat`) backed by the **Google Gemini 3.1 Flash Lite** model (`gemini-3.1-flash-lite`). When a user submits a query, the backend automatically retrieves their live profile data from Cloud Firestore (occupancy count, DISCO category, sanctioned load, current-month LSTM predicted consumption, and appliance inventory metadata).
- **Context Augmentation**: This retrieved profile is serialized and injected into the LLM system instructions template, restricting the LLM to context-aware, hyper-personalized tariff optimization advice and preventing out-of-bounds general knowledge hallucination.
- **Session Persistence & Synchronization**: Stores conversation state client-side using `sessionStorage` (Web) or local cache structures (Android) segregated by Firebase `userUid`, and integrates auth state change listeners to dynamically flush cached conversations on logout to ensure data privacy.

---

## 🧠 Machine Learning Engine (v2)

Our intelligence engine is powered by five specialized sub-systems:
- **KNN Archetype Matching:** Discovers a user's "Energy Twin" from real-world PRECON household signatures.
- **Seasonal Scaling Engine:** Dynamically modulates appliance load constraints (AC, Refrigerators) using thermal coefficients tailored for the Pakistani climate.
- **Recency-Weighted Calibration:** An exponential decay filter applied to historical bill data, prioritizing recent behavioral shifts over stale usage.
- **Bi-LSTM Forecaster:** Deep neural network with Layer Normalization generating granular next-day consumption spikes.
- **Retrieval-Augmented Generation (RAG) System:** Integrates a dynamic context-retrieval pipeline that fetches user-specific inventory profiles, slab limits, and forecast units, augmenting this metadata into LLM system instructions to generate tailored conservation feedback.

---

## 📁 Project Structure

```text
bill-optimizer/
│
├── backend/            # Flask API, ML models, and NEPRA tariff logic
│   ├── app.py          # Main backend application and API routes
│   ├── Dockerfile      # Docker configuration for DigitalOcean
│   ├── data/           # Dataset (Local) & Processed ML Models (.pkl, .keras)
│   ├── utils/          # NEPRA Engine computation logic
│   └── venv/           # Python Virtual Environment
│
├── frontend/           # Responsive Web Dashboard
│   ├── login.html      # Authentication
│   ├── js/             # Frontend logic and API integration (config.js)
│   ├── assets/         # UI Elements and Images
│   └── ...
│
└── android-app/        # Native Android Application (Kotlin)
    ├── app/            # Source code, UI layouts, Jetpack Compose
    └── build.gradle    # Android build configurations
```

---

## 💻 Local Setup Instructions

### Backend Setup
1. Open the terminal and navigate to the project root.
2. The project contains an auto-redirecting `app.py`. Simply run:
   ```bash
   python3 backend/app.py
   ```
   *(It will automatically execute within the virtual environment.)*
3. The server will run at `http://127.0.0.1:5001`.

### Frontend Setup
1. Ensure the backend is running locally.
2. The `frontend/js/config.js` file automatically detects `localhost` and routes API calls to port `5001`.
3. Open `frontend/index.html` in your browser or run via Live Server.

### Android App Setup
1. Open the `android-app/` directory in Android Studio.
2. Let Gradle sync and resolve dependencies.
3. Build and run on an Emulator or Physical Device.
