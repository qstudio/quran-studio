"""Pre-compute word bounding boxes for all 604 mushaf pages.

Copied from rollingquran/backend/scripts/precompute_coordinates.py with
the same algorithm, constants, and output format.

Line positions are empirically measured from the actual mushaf page images.
Across multiple pages, line centers follow a consistent pattern:
  - Line 1 center: y = 0.044
  - Line spacing:  = 0.0647
  - Line 15 center: y = 0.950
  - Text left:  x = 0.056
  - Text right: x = 0.951
"""

import json
from pathlib import Path

from tqdm import tqdm

DATA_DIR = Path(__file__).resolve().parent.parent
LAYOUT_DIR = DATA_DIR / "mushaf_layout"
OUTPUT_FILE = DATA_DIR / "intermediate" / "word_coordinates.json"

TOTAL_PAGES = 604

# Empirically measured from actual page images — same as rollingquran
LINE_1_CENTER_Y = 0.044       # center of first line
LINE_SPACING = 0.0647         # vertical spacing between line centers
LINE_HEIGHT = 0.045            # height of highlight box around a line
TEXT_LEFT = 0.056              # left edge of text area
TEXT_RIGHT = 0.951             # right edge of text area
TEXT_WIDTH = TEXT_RIGHT - TEXT_LEFT


def line_center_y(line_num: int) -> float:
    """Get the vertical center of a line (1-based)."""
    return LINE_1_CENTER_Y + (line_num - 1) * LINE_SPACING


def compute_coordinates():
    """Compute fractional bounding boxes for all words on all pages.

    Algorithm (same as rollingquran):
    1. For each page, load the layout JSON
    2. For each text line, get the line number
    3. Compute vertical position from empirical measurements
    4. Count characters per word (stripping Arabic numerals for end-of-ayah markers)
    5. Distribute horizontal space proportionally by character count (RTL: right to left)
    """
    OUTPUT_FILE.parent.mkdir(parents=True, exist_ok=True)

    coordinates = {}
    location_index = {}
    total_words = 0

    pbar = tqdm(range(1, TOTAL_PAGES + 1), desc="Computing coordinates", unit="page")
    for page_num in pbar:
        layout_file = LAYOUT_DIR / f"page-{page_num:03d}.json"
        if not layout_file.exists():
            continue

        with open(layout_file) as f:
            layout = json.load(f)

        lines_data = layout.get("lines", [])
        text_lines = [l for l in lines_data if l.get("type") == "text" and l.get("words")]

        if not text_lines:
            continue

        for line_data in text_lines:
            line_num = line_data["line"]
            words = line_data.get("words", [])
            if not words:
                continue

            # Vertical position from empirical measurements
            cy = line_center_y(line_num)
            word_y = cy - LINE_HEIGHT / 2

            # Character counts for proportional width distribution (RTL)
            word_chars = []
            for w in words:
                text = w.get("word", " ")
                # Strip Arabic-Indic numerals and spaces (ayah end markers)
                clean = text.rstrip("\u0660\u0661\u0662\u0663\u0664\u0665\u0666\u0667\u0668\u0669 ")
                word_chars.append(max(len(clean if clean else text), 1))

            total_chars = sum(word_chars)

            # RTL: distribute from right to left
            current_x = TEXT_RIGHT
            for pos, (w, char_count) in enumerate(zip(words, word_chars), 1):
                word_w = TEXT_WIDTH * char_count / total_chars
                word_x = current_x - word_w

                key = f"{page_num}:{line_num}:{pos}"
                loc = w.get("location", "")

                coordinates[key] = {
                    "x": round(word_x, 5),
                    "y": round(word_y, 5),
                    "w": round(word_w, 5),
                    "h": round(LINE_HEIGHT, 5),
                }

                if loc:
                    location_index[loc] = key

                current_x = word_x
                total_words += 1

        pbar.set_postfix(words=total_words)

    output = {
        "coordinates": coordinates,
        "location_index": location_index,
    }

    with open(OUTPUT_FILE, "w") as f:
        json.dump(output, f)

    print(f"\nDone. {total_words} words across {TOTAL_PAGES} pages")
    print(f"Saved to: {OUTPUT_FILE}")


if __name__ == "__main__":
    compute_coordinates()
