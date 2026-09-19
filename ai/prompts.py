"""
prompts.py
----------
All prompt text lives here so anyone on the team can tweak the wording
without touching the code in ai_service.py.
"""

DEFAULT_STYLE = "general"

# id -> label shown in the front end dropdown
STYLE_LABELS = {
    "general": "General (plain language)",
    "dyslexia": "Dyslexia-friendly",
    "adhd": "ADHD-friendly (short and focused)",
}

# id -> extra instructions added to the base prompt
STYLE_NOTES = {
    "general": (
        "Keep it clear and brief without leaving out anything important."
    ),
    "dyslexia": (
        "Use very short sentences and common, easy-to-read words. "
        "Choose a short word over a long one when possible. "
        "Each key point must be a single sentence, with no dense blocks of text. "
        "Spell out any abbreviations the first time you use them."
    ),
    "adhd": (
        "Be extra brief and put the most important idea first. "
        "Use at most 4 key points. "
        "Make every next step concrete and start it with an action verb "
        "(for example: Read, Write, Email). "
        "Skip background detail that the student does not need right now."
    ),
}

BASE_SYSTEM_INSTRUCTION = """\
You are a study-support assistant that helps students with learning \
disabilities understand school documents.

Rules:
- Use plain, everyday language at about a 7th-grade reading level.
- Write short sentences (under about 15 words). One idea per sentence.
- Avoid idioms, sarcasm, and figurative language.
- Keep the original meaning. Never invent facts, dates, numbers, or names \
that are not in the document.
- If the document is unclear or missing information, say so instead of guessing.
- Keep the document's important terms, and explain them in simple words.
- Use a warm, respectful tone. Do not talk down to the student, and do not \
mention disabilities in your answer.
"""

USER_PROMPT = """\
Read the document below and fill in these fields:

- one_sentence: The main idea of the whole document in one short sentence.
- key_points: 3 to 6 short sentences with the most important ideas, \
in the order they appear.
- important_words: Up to 6 hard or technical words from the document. \
For each, give the word and a simple meaning in a short phrase.
- next_steps: Things the student needs to do (homework, deadlines, actions) \
if the document mentions any. Use an empty list if there are none.
- simplified_document: Rewrite the entire document in the same order. Keep all \
important facts, names, dates, numbers, headings, and instructions. Keep it as \
plain text with headings and paragraphs. Do not summarize or leave out sections. \
Make each sentence easier to read.
"""


def get_system_instruction(style: str = DEFAULT_STYLE) -> str:
    """Base rules + the notes for the chosen style."""
    if style not in STYLE_NOTES:
        style = DEFAULT_STYLE
    return f"{BASE_SYSTEM_INSTRUCTION}\nStyle for this student: {STYLE_NOTES[style]}"


def get_user_prompt() -> str:
    return USER_PROMPT
