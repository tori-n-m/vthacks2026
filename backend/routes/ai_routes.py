from flask import Blueprint, jsonify, request
from ai_service import summarize_document, list_styles
ai_bp = Blueprint("ai", __name__)

@ai_bp.route("/summarize", methods=["POST"])
def summarize():
    file = request.files["document"]
    style = request.form.get("style", "general")
    return jsonify(summarize_document(file.read(), file.filename, style))

@ai_bp.route("/styles", methods=["GET"])
def styles():
    return jsonify({"styles": list_styles()})