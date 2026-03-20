"""Build the quran.sqlite database from intermediate JSON data.

Reads pre-computed coordinates, mushaf layouts, alignments, translations,
and reciter metadata to produce a single SQLite database that the Rust
application consumes.

CRITICAL: Coordinate conversion.
word_coordinates.json has fractional values (0.0-1.0).
SQLite words table stores INTEGER.
Conversion: x_int = round(fractional * 100000).
Agent 1's Rust code divides by 100000.0 to reconstruct.
"""

import json
import re
import sqlite3
import unicodedata
from pathlib import Path

from tqdm import tqdm

DATA_DIR = Path(__file__).resolve().parent.parent
SCRIPTS_DIR = Path(__file__).resolve().parent

# Input paths
WORD_COORDS_FILE = DATA_DIR / "intermediate" / "word_coordinates.json"
LAYOUT_DIR = DATA_DIR / "mushaf_layout"
ALIGNMENTS_DIR = DATA_DIR / "intermediate" / "alignments"
TRANSLATIONS_DIR = DATA_DIR / "intermediate" / "translations"
RECITERS_FILE = SCRIPTS_DIR / "reciters.json"

# Output
DB_DIR = DATA_DIR / "db"
DB_FILE = DB_DIR / "quran.sqlite"

TOTAL_PAGES = 604
FRAC_SCALE = 100000  # fractional -> integer scale factor

# Arabic diacritics Unicode range for stripping to get text_simple
ARABIC_DIACRITICS = re.compile(
    "[\u0610-\u061A\u064B-\u065F\u0670\u06D6-\u06DC\u06DF-\u06E4\u06E7-\u06E8\u06EA-\u06ED]"
)


def strip_diacritics(text: str) -> str:
    """Strip Arabic diacritical marks to produce simplified text.

    Removes tashkeel (fathah, dammah, kasrah, sukun, shadda, tanwin, etc.)
    and other Quranic annotation marks.
    """
    return ARABIC_DIACRITICS.sub("", text)


def create_schema(conn: sqlite3.Connection):
    """Create database tables and indexes matching Agent 1's migration."""
    conn.executescript("""
        CREATE TABLE IF NOT EXISTS words (
            id INTEGER PRIMARY KEY,
            surah INTEGER NOT NULL,
            ayah INTEGER NOT NULL,
            word_position INTEGER NOT NULL,
            text_uthmani TEXT NOT NULL,
            text_simple TEXT NOT NULL,
            page INTEGER NOT NULL,
            line INTEGER NOT NULL,
            x INTEGER NOT NULL,
            y INTEGER NOT NULL,
            width INTEGER NOT NULL,
            height INTEGER NOT NULL
        );

        CREATE TABLE IF NOT EXISTS translations (
            id INTEGER PRIMARY KEY,
            surah INTEGER NOT NULL,
            ayah INTEGER NOT NULL,
            language TEXT NOT NULL,
            translator TEXT NOT NULL,
            text TEXT NOT NULL
        );

        CREATE TABLE IF NOT EXISTS reciters (
            id TEXT PRIMARY KEY,
            name_en TEXT NOT NULL,
            name_ar TEXT NOT NULL,
            style TEXT,
            available_surahs TEXT NOT NULL
        );

        CREATE TABLE IF NOT EXISTS alignments (
            id INTEGER PRIMARY KEY,
            reciter_id TEXT NOT NULL,
            surah INTEGER NOT NULL,
            ayah INTEGER NOT NULL,
            word_position INTEGER NOT NULL,
            start_ms INTEGER NOT NULL,
            end_ms INTEGER NOT NULL,
            FOREIGN KEY (reciter_id) REFERENCES reciters(id)
        );

        CREATE INDEX IF NOT EXISTS idx_alignments_lookup
            ON alignments(reciter_id, surah, ayah);
        CREATE INDEX IF NOT EXISTS idx_words_lookup
            ON words(surah, ayah, word_position);
        CREATE INDEX IF NOT EXISTS idx_words_page
            ON words(page);
        CREATE INDEX IF NOT EXISTS idx_translations_lookup
            ON translations(surah, ayah, language);
    """)


def build_words_table(conn: sqlite3.Connection) -> int:
    """Build the words table from word_coordinates.json and mushaf layouts.

    Merges coordinate data (fractional bboxes) with layout data (text, page, line).
    Coordinates are converted: int_val = round(fractional * 100000).
    """
    if not WORD_COORDS_FILE.exists():
        print(f"[warn] Word coordinates file not found: {WORD_COORDS_FILE}")
        return 0

    with open(WORD_COORDS_FILE) as f:
        coord_data = json.load(f)

    coordinates = coord_data.get("coordinates", {})
    location_index = coord_data.get("location_index", {})

    # Build reverse index: coord_key -> location
    key_to_location = {}
    for loc, coord_key in location_index.items():
        key_to_location[coord_key] = loc

    # Also load layout files to get text_uthmani
    word_texts = {}  # "page:line:pos" -> text_uthmani
    for page_num in range(1, TOTAL_PAGES + 1):
        layout_file = LAYOUT_DIR / f"page-{page_num:03d}.json"
        if not layout_file.exists():
            continue

        with open(layout_file) as f:
            layout = json.load(f)

        for line_data in layout.get("lines", []):
            if line_data.get("type") != "text":
                continue
            line_num = line_data["line"]
            for pos, w in enumerate(line_data.get("words", []), 1):
                key = f"{page_num}:{line_num}:{pos}"
                word_texts[key] = w.get("word", "")

    # Now insert words
    rows = []
    for coord_key, bbox in coordinates.items():
        parts = coord_key.split(":")
        if len(parts) != 3:
            continue
        # coord_key is "page:line:pos" format from precompute, BUT
        # in word_coordinates.json generated by rollingquran, the keys may
        # actually be "surah:ayah:word" format. Use bbox["page"] if available.
        page = bbox.get("page", int(parts[0]))
        line = int(parts[1])

        # Get surah:ayah:word_position from location
        location = key_to_location.get(coord_key)
        if not location:
            continue

        loc_parts = location.split(":")
        if len(loc_parts) != 3:
            continue

        surah = int(loc_parts[0])
        ayah = int(loc_parts[1])
        word_position = int(loc_parts[2])

        # Get text from layout
        text_uthmani = word_texts.get(coord_key, "")
        text_simple = strip_diacritics(text_uthmani) if text_uthmani else ""

        # Convert fractional coords to integer (* 100000)
        x_int = round(bbox["x"] * FRAC_SCALE)
        y_int = round(bbox["y"] * FRAC_SCALE)
        w_int = round(bbox["w"] * FRAC_SCALE)
        h_int = round(bbox["h"] * FRAC_SCALE)

        rows.append((
            surah, ayah, word_position,
            text_uthmani, text_simple,
            page, line,
            x_int, y_int, w_int, h_int,
        ))

    # Sort for consistent insertion order
    rows.sort(key=lambda r: (r[0], r[1], r[2]))  # surah, ayah, word_position

    # Batch insert
    batch_size = 1000
    cursor = conn.cursor()
    for i in tqdm(range(0, len(rows), batch_size), desc="Inserting words", unit="batch"):
        batch = rows[i:i + batch_size]
        cursor.executemany(
            """INSERT INTO words
               (surah, ayah, word_position, text_uthmani, text_simple,
                page, line, x, y, width, height)
               VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)""",
            batch,
        )
    conn.commit()

    return len(rows)


def build_translations_table(conn: sqlite3.Connection) -> int:
    """Build the translations table from intermediate translation JSONs."""
    if not TRANSLATIONS_DIR.exists():
        print(f"[warn] Translations directory not found: {TRANSLATIONS_DIR}")
        return 0

    total_rows = 0
    cursor = conn.cursor()

    for trans_file in sorted(TRANSLATIONS_DIR.glob("*.json")):
        with open(trans_file, encoding="utf-8") as f:
            data = json.load(f)

        language = data.get("language", trans_file.stem)
        translator = data.get("translator", "Unknown")
        verses = data.get("verses", {})

        rows = []
        for verse_key, text in verses.items():
            parts = verse_key.split(":")
            if len(parts) != 2:
                continue
            surah = int(parts[0])
            ayah = int(parts[1])
            rows.append((surah, ayah, language, translator, text))

        # Batch insert
        batch_size = 1000
        for i in range(0, len(rows), batch_size):
            batch = rows[i:i + batch_size]
            cursor.executemany(
                """INSERT INTO translations
                   (surah, ayah, language, translator, text)
                   VALUES (?, ?, ?, ?, ?)""",
                batch,
            )

        total_rows += len(rows)
        print(f"  {language}: {len(rows)} verses")

    conn.commit()
    return total_rows


def build_reciters_table(conn: sqlite3.Connection) -> int:
    """Build the reciters table, computing available_surahs from alignment data."""
    if not RECITERS_FILE.exists():
        print(f"[warn] Reciters file not found: {RECITERS_FILE}")
        return 0

    with open(RECITERS_FILE) as f:
        reciters = json.load(f)

    cursor = conn.cursor()
    count = 0

    for reciter in reciters:
        # Determine which surahs have alignment files
        reciter_align_dir = ALIGNMENTS_DIR / reciter["id"]
        available = []
        if reciter_align_dir.exists():
            for f in sorted(reciter_align_dir.glob("*.json")):
                try:
                    surah_num = int(f.stem)
                    # Check file is non-empty
                    with open(f) as fh:
                        data = json.load(fh)
                    if data:  # non-empty alignment data
                        available.append(surah_num)
                except (ValueError, json.JSONDecodeError):
                    continue

        available_json = json.dumps(sorted(available))

        cursor.execute(
            """INSERT OR REPLACE INTO reciters
               (id, name_en, name_ar, style, available_surahs)
               VALUES (?, ?, ?, ?, ?)""",
            (reciter["id"], reciter["name_en"], reciter["name_ar"],
             reciter.get("style"), available_json),
        )
        count += 1
        print(f"  {reciter['id']}: {len(available)} surahs available")

    conn.commit()
    return count


def build_alignments_table(conn: sqlite3.Connection) -> int:
    """Build the alignments table from intermediate alignment JSONs."""
    if not ALIGNMENTS_DIR.exists():
        print(f"[warn] Alignments directory not found: {ALIGNMENTS_DIR}")
        return 0

    cursor = conn.cursor()
    total_rows = 0

    # Iterate over reciter directories
    reciter_dirs = sorted([d for d in ALIGNMENTS_DIR.iterdir() if d.is_dir()])

    for reciter_dir in tqdm(reciter_dirs, desc="Loading alignments", unit="reciter"):
        reciter_id = reciter_dir.name
        rows = []

        for surah_file in sorted(reciter_dir.glob("*.json")):
            try:
                surah_num = int(surah_file.stem)
            except ValueError:
                continue

            with open(surah_file) as f:
                data = json.load(f)

            for verse_key, words in data.items():
                parts = verse_key.split(":")
                if len(parts) != 2:
                    continue
                surah = int(parts[0])
                ayah = int(parts[1])

                for word in words:
                    word_pos = word["word_position"]
                    start_ms = word["start_ms"]
                    end_ms = word["end_ms"]
                    rows.append((reciter_id, surah, ayah, word_pos, start_ms, end_ms))

        # Batch insert
        batch_size = 1000
        for i in range(0, len(rows), batch_size):
            batch = rows[i:i + batch_size]
            cursor.executemany(
                """INSERT INTO alignments
                   (reciter_id, surah, ayah, word_position, start_ms, end_ms)
                   VALUES (?, ?, ?, ?, ?, ?)""",
                batch,
            )

        total_rows += len(rows)

    conn.commit()
    return total_rows


def print_statistics(conn: sqlite3.Connection):
    """Print summary statistics about the built database."""
    cursor = conn.cursor()

    print("\n=== Database Statistics ===")

    # Words
    cursor.execute("SELECT COUNT(*) FROM words")
    word_count = cursor.fetchone()[0]
    cursor.execute("SELECT COUNT(DISTINCT page) FROM words")
    page_count = cursor.fetchone()[0]
    cursor.execute("SELECT COUNT(DISTINCT surah) FROM words")
    surah_count = cursor.fetchone()[0]
    print(f"Words: {word_count:,} across {page_count} pages, {surah_count} surahs")

    # Translations
    cursor.execute("SELECT COUNT(*) FROM translations")
    trans_count = cursor.fetchone()[0]
    cursor.execute("SELECT DISTINCT language FROM translations")
    langs = [r[0] for r in cursor.fetchall()]
    print(f"Translations: {trans_count:,} entries in {len(langs)} languages: {', '.join(langs)}")

    # Reciters
    cursor.execute("SELECT COUNT(*) FROM reciters")
    reciter_count = cursor.fetchone()[0]
    print(f"Reciters: {reciter_count}")

    # Alignments
    cursor.execute("SELECT COUNT(*) FROM alignments")
    align_count = cursor.fetchone()[0]
    cursor.execute("SELECT DISTINCT reciter_id FROM alignments")
    align_reciters = [r[0] for r in cursor.fetchall()]
    print(f"Alignments: {align_count:,} entries for {len(align_reciters)} reciters: {', '.join(align_reciters)}")

    # DB file size
    db_size = DB_FILE.stat().st_size / (1024 * 1024)
    print(f"\nDatabase size: {db_size:.1f} MB")
    print(f"Database path: {DB_FILE}")


def build_database():
    """Build the complete quran.sqlite database."""
    DB_DIR.mkdir(parents=True, exist_ok=True)

    # Remove existing database to rebuild cleanly
    if DB_FILE.exists():
        DB_FILE.unlink()
        print(f"Removed existing database: {DB_FILE}")

    conn = sqlite3.connect(str(DB_FILE))
    conn.execute("PRAGMA journal_mode=WAL")
    conn.execute("PRAGMA synchronous=NORMAL")

    try:
        print("Creating schema...")
        create_schema(conn)

        print("\nBuilding words table...")
        word_count = build_words_table(conn)
        print(f"  Inserted {word_count:,} words")

        print("\nBuilding translations table...")
        trans_count = build_translations_table(conn)
        print(f"  Inserted {trans_count:,} translations")

        print("\nBuilding reciters table...")
        reciter_count = build_reciters_table(conn)
        print(f"  Inserted {reciter_count} reciters")

        print("\nBuilding alignments table...")
        align_count = build_alignments_table(conn)
        print(f"  Inserted {align_count:,} alignments")

        # Optimize
        print("\nOptimizing database...")
        conn.execute("ANALYZE")

        print_statistics(conn)

    finally:
        conn.close()


if __name__ == "__main__":
    build_database()
