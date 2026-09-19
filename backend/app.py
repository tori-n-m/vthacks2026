import os
from flask import Flask, jsonify, request
from dotenv import load_dotenv #read key value pairs from .env file and set them as environment variables
import sys, pathlib
sys.path.append(str(pathlib.Path(file).resolve().parent.parent))
from ai.ai_service import summarize_document, list_styles

@app.route("/summarize", methods=["POST"]) #accept document and style as input, return summarized document
def summarize(): 
    file = request.files["document"] #read http request
    style = request.form.get("style", "general") #read style from form data
    return jsonify(summarize_document(file.read(), file.filename, style)) #return summarized document as json

@app.route("/styles", methods=["GET"]) #create endpoint to return list of styles
def styles():
    return jsonify({"styles": list_styles()}) #call list_styles function and return as json

@app.errorhandler(Exception)
def handle_exception(e):
    return jsonify({"error": str(e)}), 500
