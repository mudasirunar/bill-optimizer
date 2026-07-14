import os
import requests
import json

GEMINI_API_URL = "https://generativelanguage.googleapis.com/v1beta/models/gemini-3.1-flash-lite:generateContent"

def get_gemini_response(user_message: str, history: list, user_context: dict) -> str:
    """
    Sends chat history and dynamic user context to the Gemini API using raw HTTP requests.
    This eliminates the need for large third-party generative-ai libraries.
    """
    api_key = os.environ.get("GEMINI_API_KEY", "")
    if not api_key:
        return "System Warning: Google Gemini API key (GEMINI_API_KEY) is not set in the server environment. Please configure it to enable the AI Energy Assistant."

    # 1. Construct the system instruction prompt with full user profile context and page context
    sys_instruction = (
        "You are the 'AI Energy Assistant', an expert domestic energy conservation advisor "
        "calibrated for Pakistani households under NEPRA tariff regulations.\n\n"
        
        "PROJECT INFORMATION:\n"
        "- Title: AI-Powered Electricity Bill Optimization using Machine Learning\n"
        "- Department: Department of Software Engineering, Sir Syed University of Engineering & Technology (SSUET), Karachi, Pakistan.\n"
        "- FYP Developers / Group Members & Responsibilities:\n"
        "  * Mudasir Ali (Group Leader): Developed the AI Backend, dynamic prediction pipelines, frontend integrations, and Android application.\n"
        "  * Haider Rizwan: Dataset Processing Engineer (preprocessed and managed raw/processed PRECON datasets).\n"
        "  * Abdullah Tahir: Lead Frontend Architect (designed emerald dashboard interface and integrated Chart.js graphs).\n"
        "  * Abu Bakar Saqib: Software Quality Assurance (SQA testing, system verification, and manual validation).\n"
        "- Tech Stack: Python Flask, scikit-learn, TensorFlow (Bidirectional LSTM), Firebase Auth & Firestore NoSQL, Vercel, DigitalOcean.\n\n"
        
        "USER HOUSEHOLD CONTEXT:\n"
        f"- Grid Provider (DISCO): {user_context.get('disco', 'Unknown')}\n"
        f"- NEPRA Billing Category: {user_context.get('category_display', 'Unknown')} (Protected Status: {user_context.get('is_protected', 'No')}, Lifeline Status: {user_context.get('is_lifeline', 'No')})\n"
        f"- Sanctioned Load Capacity: {user_context.get('sanctioned_load', '1.0')} kW\n"
        f"- Profile Completeness Score: {user_context.get('completeness_score', '0')} / 16\n"
        f"- Matched PRECON Archetype: {user_context.get('archetype', 'None')}\n"
        f"- Current Month's Predicted Consumption: {user_context.get('predicted_units', '0')} kWh\n"
        f"- Current Month's Estimated Bill: Rs. {user_context.get('predicted_bill', '0')}\n\n"
        
        "USER APPLIANCE INVENTORY SUMMARY:\n"
    )

    # Append inventory details
    inv = user_context.get("inventory", {})
    if inv:
        for app, val in inv.items():
            sys_instruction += f"  - {app}: {val}\n"
    else:
        sys_instruction += "  - No inventory registered yet.\n"

    # Inject page context if present
    page = user_context.get("page", "")
    if page:
        sys_instruction += f"\nCURRENT PAGE CONTEXT:\n"
        if "dashboard" in page:
            sys_instruction += "- The user is currently viewing the main dashboard page. Provide a general overview or quick navigation tips for saving energy.\n"
        elif "setup-profile" in page:
            sys_instruction += "- The user is currently in the Setup Profile screen, mapping their household inventory. Guide them on standard vs. inverter appliances and explain that quantity 0 means 'Not Owned'.\n"
        elif "appliance-simulator" in page:
            sys_instruction += "- The user is currently in the interactive Appliance Swap Simulator. Explain that they can toggle standard appliances with inverter models to estimate savings in real-time.\n"
        elif "load-forecaster" in page:
            sys_instruction += "- The user is currently viewing the Load Forecaster screen. The hourly target curve displays baseline predictions modeled from their matched PRECON household archetype using our Bidirectional LSTM network.\n"
        elif "prediction-hub" in page:
            sys_instruction += "- The user is in the Prediction Hub, which displays the overall monthly cost and slabs. If they are close to the 200-unit Protected limit, warn them explicitly.\n"
        elif "nepra-info" in page:
            sys_instruction += "- The user is currently on the NEPRA tariff information screen. Help them understand slabs, FCA, and QTA definitions.\n"
        elif "about-us" in page:
            sys_instruction += "- The user is currently on the About Us page, which documents SSUET credentials and the PRECON sensor channels vs. calibrated physics signatures.\n"
        else:
            sys_instruction += f"- The user is currently viewing: {page}\n"

    # Strict behavioral rules
    sys_instruction += (
        "\nRULES FOR YOUR BEHAVIOR:\n"
        "1. Be extremely concise, brief, and direct. Avoid extra text or pleasantries unless asked.\n"
        "2. If the user's input is a simple greeting (e.g., 'hi', 'hello', 'hey', 'greetings'), reply with a single, warm, one-sentence greeting (e.g., 'Hello! How can I assist you with your energy-saving goals today?'). Do NOT output developer details, SSUET info, or household status lists for simple greetings unless the user explicitly asks for them.\n"
        "3. Reject queries that are completely unrelated to energy saving, electricity, NEPRA tariffs, or the SSUET credentials. Politely redirect them to the application's features.\n"
        "4. Focus on the user's actual registered inventory (e.g. if they have standard ACs, suggest Inverter swap; if they have old refrigerators, recommend modern compressors).\n"
        "5. If they are close to the 200 units Protected slab limit (e.g. 170-199 units), warn them explicitly that exceeding 200 units will trigger Unprotected status, doubling their base rate.\n"
        "6. Refer to costs in PKR (Rs.) and use Pakistani terminology (Slab rates, FCA, QTA, Protected user).\n"
        "7. Keep responses under 1-2 short, bulleted paragraphs to optimize performance and save token consumption.\n"
        "8. If asked about the developers, list Mudasir Ali (Group Leader, AI Backend, Android, integrations), Haider Rizwan (Dataset Preprocessing & management), Abdullah Tahir (Frontend & Charts), and Abu Bakar Saqib (SQA & manual testing)."
    )

    # 2. Build the contents list representing the conversational history
    contents = []
    
    # Map input history (format: [{'role': 'user'|'model', 'text': '...'}] ) to Gemini schema
    for msg in history:
        role = "user" if msg.get("role") == "user" else "model"
        contents.append({
            "role": role,
            "parts": [{"text": msg.get("text", "")}]
        })
        
    # Append the current message
    contents.append({
        "role": "user",
        "parts": [{"text": user_message}]
    })

    # 3. Create payload
    payload = {
        "contents": contents,
        "systemInstruction": {
            "parts": [{"text": sys_instruction}]
        },
        "generationConfig": {
            "temperature": 0.2,
            "maxOutputTokens": 500
        }
    }

    # 4. Make HTTP Post Request
    try:
        url = f"{GEMINI_API_URL}?key={api_key}"
        res = requests.post(url, json=payload, headers={"Content-Type": "application/json"}, timeout=8)
        if res.status_code != 200:
            return f"AI Service Error: Received status code {res.status_code} from Gemini. Response details: {res.text[:150]}"
            
        data = res.json()
        candidates = data.get("candidates", [])
        if candidates:
            parts = candidates[0].get("content", {}).get("parts", [])
            if parts:
                return parts[0].get("text", "Error: Empty response content from AI model.")
        
        return "AI Service Error: Could not parse response candidate structures."
    except Exception as e:
        return f"System Connection Error: Could not connect to Gemini API. Details: {str(e)}"
