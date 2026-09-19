import os
from flask import Flask, jsonify
from dotenv import load_dotenv
import sys, pathlib

sys.path.append(str(pathlib.Path(__file__).resolve().parent.parent))
from routes.ai_routes import ai_bp
load_dotenv()
app = Flask(__name__)
app.register_blueprint(ai_bp)


#global error handler
@app.errorhandler(Exception)
def handle_exception(e):
    return jsonify({"error": str(e)}), 500
