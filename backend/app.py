import os
from flask import Flask, jsonify, request
from dotenv import load_dotenv #read key value pairs from .env file and set them as environment variables
import sys, pathlib
sys.path.append(str(pathlib.Path(file).resolve().parent.parent))
from ai.ai_service import summarize_document, list_styles

@app.route("/summarize", methods=["POST"])
def summarize():
    file = request.files["document"]
    style = request.form.get("style", "general")
    return jsonify(summarize_document(file.read(), file.filename, style))
