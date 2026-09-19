"""
ai_service.py
-------------
All Gemini API calls live here. The backend only needs to import and call:

    summarize_document(file_bytes, filename, style="general")
    summarize_text(text, style="general")
    list_styles()

Every summarize function NEVER raises an error. It always returns a dict:

    success -> {"ok": True,  "summary": {...}, "error": None}
    failure -> {"ok": False, "summary": None,  "error": "message for the student"}

    summary = {
        "one_sentence":    "The main idea in one short sentence.",
        "key_points":      ["...", "..."],
        "detailed_summary": "A thorough explanation of the document's main ideas.",
        "important_words": [{"word": "...", "meaning": "..."}],
        "next_steps":      ["...", "..."],
        "image_descriptions": ["Useful, objective descriptions of important images."],
        "simplified_document": "The complete document rewritten in plain language.",
    }

Keep this shape stable so the front end never breaks.

The `simplified_document` field is the complete document rewritten in plain
language. It is returned alongside the bullet-point fields so the web app can
display a preview and create a downloadable file.
"""

import io
import json
import os
import time
from pathlib import Path
from typing import List

from dotenv import load_dotenv
from google import genai
from google.genai import types
from pydantic import BaseModel

# Works both when run as a script (python ai/test_ai.py) and when the
# backend imports it (from ai.ai_service import ...).
try:
    from .prompts import (
        DEFAULT_STYLE,
        STYLE_LABELS,
        get_system_instruction,
        get_user_prompt,
    )
except ImportError:
    from prompts import (
        DEFAULT_STYLE,
        STYLE_LABELS,
        get_system_instruction,
        get_user_prompt,
    )

# Load GEMINI_API_KEY from the .env file in the repo root

load_dotenv(Path(__file__).resolve().parent.parent / ".env")
load_dotenv()  # also checks the current folder, doesn't override

# Model name can be changed in .env without editing code
MODEL_NAME = os.getenv("GEMINI_MODEL", "gemini-2.5-flash")

SUPPORTED_TYPES = {".txt", ".md", ".pdf", ".docx", ".png", ".jpg", ".jpeg", ".webp"}
IMAGE_TYPES = {".png", ".jpg", ".jpeg", ".webp"}
MAX_FILE_MB = 25
MAX_CHARS = 200_000  # allows detailed text rewrites while bounding request size


# ---------- The shape Gemini must answer in ----------

class ImportantWord(BaseModel):
    word: str
    meaning: str


class DocumentSummary(BaseModel):
    one_sentence: str
    key_points: List[str]
    detailed_summary: str
    important_words: List[ImportantWord]
    next_steps: List[str]
    image_descriptions: List[str]
    simplified_document: str


# ---------- Small helpers ----------

_client = None


def _get_client():
    """Create the Gemini client once, the first time it's needed."""
    global _client
    if _client is None:
        api_key = os.getenv("GEMINI_API_KEY")
        if not api_key:
            raise RuntimeError("GEMINI_API_KEY is missing. Add it to your .env file.")
        _client = genai.Client(api_key=api_key)
    return _client


def _error(message: str) -> dict:
    return {"ok": False, "summary": None, "error": message}


def _read_docx(file_bytes: bytes) -> str:
    """Pull plain text (paragraphs and tables) out of a Word document."""
    from docx import Document  # imported here so .txt/.pdf work without it

    doc = Document(io.BytesIO(file_bytes))
    parts = [p.text for p in doc.paragraphs if p.text.strip()]
    for table in doc.tables:
        for row in table.rows:
            parts.append(" | ".join(cell.text.strip() for cell in row.cells))
    return "\n".join(parts)

RETRY_WAITS = [2, 5, 10]  # seconds to wait between attempts


def _generate_with_retry(**kwargs):
    """Call Gemini, retrying when Google says it's busy (503/429)."""
    for attempt in range(len(RETRY_WAITS) + 1):
        try:
            return _get_client().models.generate_content(**kwargs)
        except Exception as exc:
            error_text = str(exc)
            if "RESOURCE_EXHAUSTED" in error_text or "quota" in error_text.lower():
                raise
            busy = any(code in error_text for code in ("503", "UNAVAILABLE", "429"))
            if not busy or attempt == len(RETRY_WAITS):
                raise
            print(f"[ai_service] Gemini is busy, retrying in {RETRY_WAITS[attempt]}s...")
            time.sleep(RETRY_WAITS[attempt])


def _summarize(document_content, style: str, describe_images: bool = False) -> dict:
    """Send the document to Gemini and return the standard result dict."""
    if style not in STYLE_LABELS:
        style = DEFAULT_STYLE

    response = _generate_with_retry(
        model=MODEL_NAME,
        contents=[get_user_prompt(describe_images), document_content],
        config=types.GenerateContentConfig(
            system_instruction=get_system_instruction(style),
            temperature=0.3,  # low = more faithful to the document
            response_mime_type="application/json",
            response_schema=DocumentSummary,
        ),
    )

    parsed = response.parsed
    if parsed is None and response.text:
        parsed = DocumentSummary(**json.loads(response.text))
    if parsed is None:
        return _error("The AI couldn't summarize this document. Please try another one.")

    return {"ok": True, "summary": parsed.model_dump(), "error": None}


def _friendly_error(exc: Exception) -> dict:
    """Turn a scary exception into a message a student can understand."""
    print(f"[ai_service] error: {exc!r}")  # full details for the developers
    text = str(exc)
    if "GEMINI_API_KEY" in text:
        return _error("The AI isn't set up yet (missing API key).")
    if "401" in text or "UNAUTHENTICATED" in text or "ACCESS_TOKEN_TYPE_UNSUPPORTED" in text:
        return _error("The Gemini API key is invalid. Replace GEMINI_API_KEY in .env with a Google AI Studio API key.")
    if "RESOURCE_EXHAUSTED" in text or "quota" in text.lower():
        return _error("This Gemini project has reached its usage limit. Wait for the quota to reset, use another API key, or enable billing.")
    if "429" in text or "RESOURCE_EXHAUSTED" in text:
        return _error("The AI is busy right now. Please wait a minute and try again.")
    return _error("Something went wrong while summarizing. Please try again.")


# ---------- Functions the backend calls ----------

def list_styles() -> list:
    """For the front end dropdown: [{"id": "dyslexia", "label": "..."}, ...]"""
    return [{"id": key, "label": label} for key, label in STYLE_LABELS.items()]


def summarize_text(text: str, style: str = DEFAULT_STYLE) -> dict:
    """Summarize text the student pasted in."""
    try:
        if not text or not text.strip():
            return _error("There's no text to summarize.")
        return _summarize(text[:MAX_CHARS], style)
    except Exception as exc:
        return _friendly_error(exc)


def summarize_document(
    file_bytes: bytes,
    filename: str,
    style: str = DEFAULT_STYLE,
    describe_images: bool = False,
) -> dict:
    """Summarize an uploaded document or image."""
    try:
        ext = Path(filename or "").suffix.lower()
        if ext not in SUPPORTED_TYPES:
            return _error("Sorry, I can only read PDF, Word, TXT, Markdown, PNG, JPG, and WEBP files.")
        if not file_bytes:
            return _error("That file looks empty.")
        if len(file_bytes) > MAX_FILE_MB * 1024 * 1024:
            return _error(f"That file is too big. Please use one under {MAX_FILE_MB} MB.")

        if ext == ".pdf" or ext in IMAGE_TYPES:
            mime_type = "application/pdf" if ext == ".pdf" else f"image/{'jpeg' if ext in {'.jpg', '.jpeg'} else ext[1:]}"
            content = types.Part.from_bytes(data=file_bytes, mime_type=mime_type)
        else:
            if ext == ".docx":
                text = _read_docx(file_bytes)
            else:
                text = file_bytes.decode("utf-8", errors="ignore")
            if not text.strip():
                return _error("I couldn't find any text in that file.")
            content = text[:MAX_CHARS]

        return _summarize(content, style, describe_images)
    except Exception as exc:
        return _friendly_error(exc)
