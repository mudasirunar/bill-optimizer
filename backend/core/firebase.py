import os
import firebase_admin
from firebase_admin import credentials, firestore
from config import BASE_DIR

# Firebase Credential Paths matching root backend structure
cred_path = os.path.join(BASE_DIR, "serviceAccountKey.json")

# Support both local file and cloud environment variable
if os.path.exists(cred_path):
    cred = credentials.Certificate(cred_path)
elif os.environ.get("FIREBASE_CREDENTIALS_JSON"):
    import json as _json
    cred_dict = _json.loads(os.environ["FIREBASE_CREDENTIALS_JSON"])
    cred = credentials.Certificate(cred_dict)
else:
    raise RuntimeError("No Firebase credentials found. Provide serviceAccountKey.json or set FIREBASE_CREDENTIALS_JSON env var.")

# Initialize Firebase app and Firestore instance
firebase_admin.initialize_app(cred)
db = firestore.client()
