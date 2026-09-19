from io import BytesIO
from pathlib import Path

from flask import Flask, jsonify, render_template, request, send_file

from ai.ai_service import list_styles, summarize_document

app = Flask(__name__)


@app.get("/styles")
def styles():
    return jsonify(list_styles())


@app.post("/summarize")
def summarize():
    uploaded = request.files.get("document")
    style = request.form.get("style", "general")

    if uploaded is None or not uploaded.filename:
        return jsonify({"ok": False, "error": "Choose a document to upload."}), 400

    result = summarize_document(uploaded.read(), uploaded.filename, style)
    if not result["ok"]:
        return jsonify(result), 400

    summary = result["summary"]
    original_stem = Path(uploaded.filename).stem or "document"
    response = jsonify({
        "ok": True,
        "summary": summary,
        "download_name": f"{original_stem}-simplified.txt",
    })
    return response


def _download_text(filename: str, summary: dict) -> BytesIO:
    """Build one readable file containing both the bullets and full rewrite."""
    lines = [
        f"Simplified version of {filename}",
        "",
        "SUMMARY",
        f"Main idea: {summary['one_sentence']}",
        "",
        "Key points:",
        *[f"- {point}" for point in summary["key_points"]],
        "",
        "Important words:",
        *[f"- {item['word']}: {item['meaning']}" for item in summary["important_words"]],
        "",
        "Next steps:",
        *([f"- {step}" for step in summary["next_steps"]] or ["- None listed"]),
        "",
        "FULL SIMPLIFIED DOCUMENT",
        summary["simplified_document"],
        "",
    ]
    return BytesIO("\n".join(lines).encode("utf-8"))


@app.post("/download")
def download():
    payload = request.get_json(silent=True) or {}
    filename = payload.get("filename", "document")
    summary = payload.get("summary")
    if not isinstance(summary, dict) or not summary.get("simplified_document"):
        return jsonify({"ok": False, "error": "Generate a document before downloading."}), 400

    file_data = _download_text(filename, summary)
    file_data.seek(0)
    stem = Path(filename).stem or "document"
    return send_file(
        file_data,
        mimetype="text/plain; charset=utf-8",
        as_attachment=True,
        download_name=f"{stem}-simplified.txt",
    )


@app.get("/")
def index():
    return render_template("index.html")


if __name__ == "__main__":
    app.run(debug=True, port=5000)
