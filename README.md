# ⚡ AI-Powered Electricity Bill Optimizer (FYP 2026)

**Institution:** Department of Software Engineering, Sir Syed University of Engineering and Technology (SSUET), Karachi, Pakistan  
**Focus:** Seasonal Intelligence, Bi-LSTM Load Forecasting, and NEPRA Tariff Optimization  
**Project Classification:** Final Year Project (FYP)

---

## 🚀 System Overview

The **AI-Powered Electricity Bill Optimizer** is a comprehensive, cross-platform energy intelligence ecosystem designed specifically for the Pakistani energy landscape. By leveraging real-world consumption data from the **PRECON (LUMS) Dataset**, the system deploys a dual machine learning core:
1. **Random Forest Regression** for accurate monthly consumption and cost predictions based on seasonal appliance scaling.
2. **Bidirectional LSTM (Long Short-Term Memory)** networks for generating high-resolution 24-hour load forecasting curves.

The platform coordinates real-time user inventory tracking, NEPRA slab notifications, and appliance upgrade simulators across a distributed Web Application, a native Android client wrapper, and a scalable Python backend.

---

## 🌐 Project Architecture & Deployments

The system is deployed and distributed across the following environments:

| Component | Platform / Host | Current Status | Access Endpoint |
| :--- | :--- | :--- | :--- |
| **Frontend Web Portal** | Vercel | **Active** | [AI Bill Optimizer Web Portal](https://bill-optimizer.vercel.app) |
| **Backend REST API** | DigitalOcean | **Active** (Dockerized) | `https://bill-optimizer-fyp-lj83m.ondigitalocean.app` |
| **Android Client App** | GitHub Releases | **Active** (Latest Release Build) | [AI Bill Optimizer Android App (Latest Release)](https://github.com/mudasirunar/bill-optimizer/releases/latest) |
| **Database & Auth** | Cloud Firestore | **Active** | Firebase Integration Sandbox |

---

## 🛠️ Sub-System Specifications

### 1. 📱 Android Mobile Client (`android_app/`)
The legacy native Jetpack Compose views have been upgraded to a production-grade, highly optimized **full-screen WebView wrapper** designed for seamless desktop-mobile sync.
* **Persistent Sessions & Autofill**: Configured third-party cookie access and scheduled automatic database flushes (`CookieManager.getInstance().flush()`). This eliminates Google 2FA loop warnings and allows password managers to autofill logins natively.
* **OAuth Cancel Interception**: Implemented custom dialog `OnDismissListener` interfaces. If a user dismisses the Google Login window manually (by hitting the back button or tapping outside), the app destroys the popup instance, prompting the web app's Firebase Auth SDK to throw the `auth/popup-closed-by-user` cancel exception and clear stuck loading indicators.
* **Real-Time Connectivity Monitor**: Uses Android's `ConnectivityManager` callbacks. If connection drops, it instantly overlays a custom Compose offline warning screen. When the network returns, it automatically triggers `webView.reload()` without requiring user interaction.
* **Flicker-Free Transitions**: Visually binds layout states to page loading values. The WebView is programmatically set to invisible during load phases to prevent browser connection logs or blank frames from flickering.
* **R8 Minification & Proguard**: Obfuscated and optimized using custom rules to protect JavaScript interfaces, keeping the final APK light, secure, and fast.

### 2. 💻 Web Dashboard Application (`frontend/`)
A high-performance single-page web dashboard styled with CSS3 (glassmorphic theme, custom charts, responsive grids).
* **Interactive Visualization**: Leverages `Chart.js` canvas overlays to display 24-hour predictive load spikes and compare standard vs. inverter appliance setups.
* **Local Caching & Auth**: Directly integrates Firebase client SDKs for password and Google Authentication. User metadata like `userDisplayName` and `userEmail` are managed locally to persist sessions across page reloads.

### 3. 🐍 Python Flask Backend (`backend/`)
The computational logic center deployed on DigitalOcean using Docker containers.
* **NepraEngine**: Models complex fiscal tariffs, including protected/lifeline categories, FPA (Fuel Price Adjustment), and QTA (Quarterly Tariff Adjustment) taxes.
* **Hybrid Prediction Pipeline**: Combines KNN Archetype search (discovering a user's "Energy Twin" from PRECON signatures) with Random Forest and Bi-LSTM neural networks to construct load forecasts.

### 4. 🤖 AI Chatbot Assistant (RAG Engine)
An intelligent energy conservation assistant powered by **Google Gemini 3.1 Flash Lite** API requests.
* **Platform & Device Detection**: Appends `" AiBillOptimizerAndroid"` to the mobile app's user-agent. The chatbot javascript detects this header flag and updates the API request `platform` payload to `"android"`. The AI reads this context, adjusts its advice to mobile tab references, and changes its greetings.
* **Personalized Context Integration**: Merges active Firebase Auth session credentials with Firestore profile variables. The chatbot safely reads the user's first name, full name, and email, enabling occasional personalized name greetings while maintaining privacy filters (never volunteering emails or full names).

---

## 📁 Project Directory Layout

```text
bill-optimizer/
│
├── android_app/         # Android Client App Wrapper (Kotlin)
│   ├── app/             # Application source, WebView controllers, and assets
│   └── build.gradle.kts # Kotlin Gradle DSL build configs (Production Configured)
│
├── backend/             # Python Flask API & Machine Learning Engine
│   ├── app.py           # REST Controllers and routing entrypoint
│   ├── Dockerfile       # Containerization instructions for DigitalOcean
│   ├── data/            # Pre-trained models (.pkl, .keras) and LUMS PRECON data
│   └── utils/           # Nepra computation core & chatbot prompting managers
│
├── frontend/            # Web Portal Frontend (HTML5, CSS3, JS)
│   ├── js/              # Configuration logic, auth scripts, and API wrappers
│   └── index.html       # Primary application entrypoint
│
└── fyp-docs/            # Project documentation, diagrams, and system requirements
```

---

## 💻 Local Setup & Execution

### 1. Execute Backend Server
1. Navigate to the project root directory.
2. Launch the Flask auto-redirection environment loader:
   ```bash
   python3 backend/app.py
   ```
   *(This automatically resolves library dependencies inside the local Python virtual environment)*.
3. The API service will start on port `5001`.

### 2. Launch Frontend
1. Ensure the Python backend is active on your host.
2. The web config file [config.js](file:///Users/apple/University/Final Year Project/bill-optimizer/frontend/js/config.js) will automatically direct client requests to `localhost:5001`.
3. Open `frontend/index.html` inside a web browser or spin up a local Live Server.

### 3. Compile Android Client
1. Open the [android_app](file:///Users/apple/University/Final Year Project/bill-optimizer/android_app) folder inside Android Studio.
2. Sync the project Gradle structures.
3. Connect an emulator or developer device, compile the debug sources, or package a release APK via:
   ```bash
   ./gradlew assembleRelease
   ```

---

## 👥 FYP Project Team & Responsibilities

| Student Name | Seat Number | Role | Primary Technical Responsibilities |
| :--- | :--- | :--- | :--- |
| **Mudasir Ali** | 2022F-SE-030 | **Team Lead** | Neural model architecture (Bi-LSTM, RF, KNN), data preprocessing, Android WebView wrapper implementation, session caching, and API integration. |
| **Haider Rizwan** | 2022F-SE-020 | **Backend Developer** | Flask REST API framework development and hardcoding NEPRA tariff engine rules. |
| **Abu Bakar Saqib** | 2022F-SE-037 | **Database & QA Engineer** | Firestore NoSQL schema management, database sync pipelines, and system testing. |
| **Abdullah Tahir** | 2022F-SE-080 | **Frontend Designer** | Single-page application layouts, Chart.js visual graphs, and dashboard design. |
