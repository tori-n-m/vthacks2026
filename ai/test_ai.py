"""
test_ai.py
----------
Try the AI on its own, no front end or back end needed.

Run from the repo root:

    python ai/test_ai.py                      # uses the built-in sample text
    python ai/test_ai.py notes.pdf            # summarize a real file
    python ai/test_ai.py notes.pdf dyslexia   # pick a style: general, dyslexia, adhd
"""

import sys
from pathlib import Path

from ai_service import list_styles, summarize_document, summarize_text

SAMPLE_TEXT = """\
Mitosis is the process by which a single eukaryotic cell divides to produce two \
genetically identical daughter cells. It is divided into four principal phases: \
prophase, metaphase, anaphase, and telophase. During prophase, chromatin \
condenses into discrete chromosomes and the nuclear envelope begins to break \
down. In metaphase, the chromosomes align along the cell's equatorial plane. \
Sister chromatids are then separated and pulled toward opposite poles during \
anaphase. Finally, in telophase, nuclear envelopes re-form around each set of \
chromosomes, and cytokinesis divides the cytoplasm. Students should complete \
the mitosis diagram worksheet and submit it before Friday's lab session.
"""


def show(result: dict) -> None:
    """Print the result in a readable way."""
    if not result["ok"]:
        print(f"\n❌ FAILED: {result['error']}")
        return

    s = result["summary"]
    print("\n✅ SUMMARY")
    print(f"\nMain idea: {s['one_sentence']}")

    print("\nKey points:")
    for point in s["key_points"]:
        print(f"  - {point}")

    print("\nImportant words:")
    for item in s["important_words"]:
        print(f"  - {item['word']}: {item['meaning']}")

    print("\nNext steps:")
    if s["next_steps"]:
        for step in s["next_steps"]:
            print(f"  - {step}")
    else:
        print("  (none)")


def main() -> None:
    args = sys.argv[1:]
    file_path = args[0] if args else None
    style = args[1] if len(args) > 1 else "general"

    valid = [s["id"] for s in list_styles()]
    if style not in valid:
        print(f"Unknown style '{style}'. Choose from: {', '.join(valid)}")
        return

    print(f"Style: {style}")

    if file_path:
        path = Path(file_path)
        if not path.exists():
            print(f"File not found: {file_path}")
            return
        print(f"Summarizing file: {path.name} ...")
        result = summarize_document(path.read_bytes(), path.name, style)
    else:
        print("No file given, using the built-in sample text ...")
        result = summarize_text(SAMPLE_TEXT, style)

    show(result)


if __name__ == "__main__":
    main()
