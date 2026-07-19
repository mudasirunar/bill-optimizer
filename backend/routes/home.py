from flask import Blueprint, jsonify

home_bp = Blueprint('home', __name__)

@home_bp.route('/')
def home():
    return jsonify({
        "status": "online",
        "project": "Bill Optimizer AI",
        "version": "2.3 (Physics Engine Validated)"
    })
