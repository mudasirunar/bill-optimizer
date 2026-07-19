from flask import Blueprint, request, jsonify
from core.firebase import db

profile_bp = Blueprint('profile', __name__)

@profile_bp.route('/api/setup_profile', methods=['POST'])
def setup_profile():
    try:
        data      = request.json
        uid       = data['uid']
        user_info = data['data']
        db.collection('users').document(uid).set(user_info, merge=True)
        return jsonify({"status": "success"}), 200
    except Exception as e:
        return jsonify({"error": str(e)}), 500
