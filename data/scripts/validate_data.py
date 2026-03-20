"""Validate the quran.sqlite database for completeness and correctness.

Runs a series of checks and reports pass/fail for each.
"""

import json
import sqlite3
import sys
from pathlib import Path

DATA_DIR = Path(__file__).resolve().parent.parent
DB_FILE = DATA_DIR / "db" / "quran.sqlite"

TOTAL_PAGES = 604
TOTAL_SURAHS = 114
MIN_TOTAL_WORDS = 77000
EXPECTED_RECITERS = 5


class ValidationResult:
    def __init__(self):
        self.passed = 0
        self.failed = 0
        self.warnings = 0

    def check(self, name: str, condition: bool, detail: str = ""):
        status = "PASS" if condition else "FAIL"
        if condition:
            self.passed += 1
        else:
            self.failed += 1
        msg = f"[{status}] {name}"
        if detail:
            msg += f" -- {detail}"
        print(msg)

    def warn(self, name: str, detail: str = ""):
        self.warnings += 1
        msg = f"[WARN] {name}"
        if detail:
            msg += f" -- {detail}"
        print(msg)

    def summary(self):
        print(f"\n=== Validation Summary ===")
        print(f"Passed:   {self.passed}")
        print(f"Failed:   {self.failed}")
        print(f"Warnings: {self.warnings}")
        return self.failed == 0


def validate():
    """Run all validation checks on quran.sqlite."""
    if not DB_FILE.exists():
        print(f"Error: Database not found at {DB_FILE}")
        sys.exit(1)

    conn = sqlite3.connect(str(DB_FILE))
    cursor = conn.cursor()
    result = ValidationResult()

    # ---- Words table checks ----
    print("\n--- Words Table ---")

    cursor.execute("SELECT COUNT(*) FROM words")
    word_count = cursor.fetchone()[0]
    result.check(
        "Total word count",
        word_count >= MIN_TOTAL_WORDS,
        f"{word_count:,} words (minimum: {MIN_TOTAL_WORDS:,})",
    )

    # All 604 pages have at least one word
    cursor.execute("SELECT COUNT(DISTINCT page) FROM words")
    page_count = cursor.fetchone()[0]
    result.check(
        "Page coverage",
        page_count >= TOTAL_PAGES,
        f"{page_count}/{TOTAL_PAGES} pages have words",
    )

    # Find pages without words
    if page_count < TOTAL_PAGES:
        cursor.execute(
            "SELECT DISTINCT page FROM words ORDER BY page"
        )
        present_pages = {r[0] for r in cursor.fetchall()}
        missing = sorted(set(range(1, TOTAL_PAGES + 1)) - present_pages)
        if len(missing) <= 20:
            result.warn("Missing pages", f"Pages without words: {missing}")
        else:
            result.warn("Missing pages", f"{len(missing)} pages without words")

    # No words with all-zero coordinates
    cursor.execute(
        "SELECT COUNT(*) FROM words WHERE x=0 AND y=0 AND width=0 AND height=0"
    )
    zero_coord_count = cursor.fetchone()[0]
    if zero_coord_count > 0:
        result.warn(
            "Zero coordinates",
            f"{zero_coord_count} words have x=0, y=0, w=0, h=0",
        )
    else:
        result.check("No zero-coordinate words", True)

    # No gaps in word_position sequences per ayah
    cursor.execute("""
        SELECT surah, ayah, GROUP_CONCAT(word_position ORDER BY word_position) as positions,
               MIN(word_position) as min_pos, MAX(word_position) as max_pos,
               COUNT(*) as cnt
        FROM words
        GROUP BY surah, ayah
        HAVING cnt != (max_pos - min_pos + 1)
        LIMIT 10
    """)
    gaps = cursor.fetchall()
    result.check(
        "Word position continuity",
        len(gaps) == 0,
        f"{len(gaps)} ayahs have gaps in word_position" if gaps else "No gaps found",
    )
    for g in gaps[:5]:
        result.warn(
            "Position gap",
            f"Surah {g[0]}, Ayah {g[1]}: positions={g[2]}, expected {g[4]-g[3]+1} got {g[5]}",
        )

    # ---- Reciters table checks ----
    print("\n--- Reciters Table ---")

    cursor.execute("SELECT COUNT(*) FROM reciters")
    reciter_count = cursor.fetchone()[0]
    result.check(
        "Reciter count",
        reciter_count == EXPECTED_RECITERS,
        f"{reciter_count} reciters (expected: {EXPECTED_RECITERS})",
    )

    cursor.execute("SELECT id, available_surahs FROM reciters")
    for row in cursor.fetchall():
        reciter_id = row[0]
        try:
            available = json.loads(row[1])
            result.check(
                f"Reciter {reciter_id} surahs",
                len(available) > 0,
                f"{len(available)} surahs available",
            )
        except json.JSONDecodeError:
            result.check(f"Reciter {reciter_id} surahs", False, "Invalid JSON in available_surahs")

    # ---- Alignments table checks ----
    print("\n--- Alignments Table ---")

    cursor.execute("SELECT COUNT(*) FROM alignments")
    align_count = cursor.fetchone()[0]
    result.check(
        "Alignment entries exist",
        align_count > 0,
        f"{align_count:,} alignment entries",
    )

    # Check each reciter has alignments for all 114 surahs
    cursor.execute("""
        SELECT reciter_id, COUNT(DISTINCT surah) as surah_count
        FROM alignments
        GROUP BY reciter_id
    """)
    for row in cursor.fetchall():
        reciter_id, surah_count = row
        result.check(
            f"Alignment coverage: {reciter_id}",
            surah_count == TOTAL_SURAHS,
            f"{surah_count}/{TOTAL_SURAHS} surahs",
        )

    # Check timestamps are monotonically increasing within each surah per reciter
    # (check a sample - doing all would be slow)
    cursor.execute("""
        SELECT reciter_id, surah, ayah, word_position, start_ms, end_ms
        FROM alignments
        WHERE reciter_id = (SELECT reciter_id FROM alignments LIMIT 1)
          AND surah = 1
        ORDER BY ayah, word_position
    """)
    rows = cursor.fetchall()
    monotonic = True
    prev_start = -1
    for row in rows:
        start_ms = row[4]
        if start_ms < prev_start:
            monotonic = False
            break
        prev_start = start_ms
    result.check(
        "Timestamp monotonicity (sample: surah 1)",
        monotonic,
        "Timestamps increase monotonically" if monotonic else "Non-monotonic timestamps found",
    )

    # ---- Translations table checks ----
    print("\n--- Translations Table ---")

    cursor.execute("SELECT COUNT(*) FROM translations")
    trans_count = cursor.fetchone()[0]
    result.check(
        "Translation entries exist",
        trans_count > 0,
        f"{trans_count:,} translation entries",
    )

    cursor.execute("SELECT DISTINCT language FROM translations")
    languages = [r[0] for r in cursor.fetchall()]
    result.check(
        "Translation languages",
        len(languages) >= 1,
        f"Languages: {', '.join(sorted(languages))}",
    )

    # Check at least 1 language covers all 114 surahs
    for lang in languages:
        cursor.execute(
            "SELECT COUNT(DISTINCT surah) FROM translations WHERE language = ?",
            (lang,),
        )
        lang_surah_count = cursor.fetchone()[0]
        result.check(
            f"Translation coverage: {lang}",
            lang_surah_count == TOTAL_SURAHS,
            f"{lang_surah_count}/{TOTAL_SURAHS} surahs",
        )

    conn.close()

    # ---- Summary ----
    success = result.summary()
    if not success:
        sys.exit(1)


if __name__ == "__main__":
    validate()
