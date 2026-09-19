import os
from flask import Flask, jsonify
from dotenv import load_dotenv
import sys, pathlib

BASE_DIR = pathlib.Path(__file__).parent.resolve()
PROJECT_ROOT = BASE_DIR.parent
sys.path.append(str(PROJECT_ROOT))
from routes.ai_routes import ai_bp
load_dotenv()

app = Flask(__name__)
app.register_blueprint(ai_bp)


#global error handler
@app.errorhandler(Exception)
def handle_exception(e):
    return jsonify({"error": str(e)}), 500

#testing: test if we can push to the github
if __name__ == "__main__":
    app.run(debug=True)