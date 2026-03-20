"""Fetch translations from Quran.com API.

Uses the v3 verses endpoint which includes translations embedded in verse objects.
Fetches chapter by chapter for all 114 surahs.
"""

import json
import sys
import time
from pathlib import Path

import requests
from tqdm import tqdm

DATA_DIR = Path(__file__).resolve().parent.parent
TRANSLATIONS_DIR = DATA_DIR / "intermediate" / "translations"

QURAN_API_BASE = "https://api.quran.com/api/v3"
MAX_RETRIES = 3
RATE_LIMIT_SECONDS = 1.0
TOTAL_SURAHS = 114

# Translation IDs from Quran.com
TRANSLATIONS = [
    {"id": 131, "language": "en", "translator": "Dr. Mustafa Khattab"},
    {"id": 136, "language": "fr", "translator": "Muhammad Hamidullah"},
    {"id": 97, "language": "ur", "translator": "Ahmed Ali"},
    {"id": 77, "language": "tr", "translator": "Diyanet Isleri"},
    {"id": 33, "language": "id", "translator": "Indonesian Ministry of Religious Affairs"},
]


def fetch_with_retry(url: str, params: dict | None = None, max_retries: int = MAX_RETRIES) -> dict:
    """Fetch JSON from URL with exponential backoff retry."""
    for attempt in range(max_retries):
        try:
            resp = requests.get(url, params=params, timeout=60)
            resp.raise_for_status()
            return resp.json()
        except requests.RequestException as e:
            if attempt == max_retries - 1:
                raise
            wait = 2 ** attempt
            print(f"  Retry {attempt + 1}/{max_retries} after {wait}s: {e}")
            time.sleep(wait)
    raise RuntimeError("Unreachable")


def fetch_translation(translation_id: int, language: str, translator: str) -> dict:
    """Fetch all verses for a translation, chapter by chapter.

    Uses v3 API: /chapters/{ch}/verses?translations={id}&per_page=300
    Returns dict mapping verse_key -> text.
    """
    result = {}

    for surah in range(1, TOTAL_SURAHS + 1):
        page = 1
        while True:
            url = f"{QURAN_API_BASE}/chapters/{surah}/verses"
            params = {
                "translations": translation_id,
                "per_page": 50,
                "page": page,
            }

            data = fetch_with_retry(url, params)
            verses = data.get("verses", [])
            if not verses:
                break

            for verse in verses:
                verse_key = verse.get("verse_key", "")
                trans_list = verse.get("translations", [])
                if trans_list and verse_key:
                    text = trans_list[0].get("text", "")
                    text = _strip_html(text)
                    if text:
                        result[verse_key] = text

            pagination = data.get("pagination", {})
            current_page = pagination.get("current_page", page)
            total_pages = pagination.get("total_pages", 1)

            if current_page >= total_pages:
                break

            page += 1
            time.sleep(RATE_LIMIT_SECONDS)

        time.sleep(RATE_LIMIT_SECONDS)

    return result


def _strip_html(text: str) -> str:
    """Remove simple HTML tags from translation text."""
    import re
    return re.sub(r"<[^>]+>", "", text).strip()


def fetch_translations():
    """Fetch all configured translations."""
    TRANSLATIONS_DIR.mkdir(parents=True, exist_ok=True)

    downloaded = 0
    skipped = 0
    errors = 0

    pbar = tqdm(TRANSLATIONS, desc="Fetching translations", unit="lang")
    for trans in pbar:
        out_file = TRANSLATIONS_DIR / f"{trans['language']}.json"
        pbar.set_postfix(lang=trans["language"])

        if out_file.exists():
            skipped += 1
            continue

        try:
            verses = fetch_translation(trans["id"], trans["language"], trans["translator"])

            output = {
                "translation_id": trans["id"],
                "language": trans["language"],
                "translator": trans["translator"],
                "verses": verses,
            }

            with open(out_file, "w", encoding="utf-8") as f:
                json.dump(output, f, ensure_ascii=False)

            downloaded += 1
            print(f"\n  {trans['language']}: {len(verses)} verses")
        except Exception as e:
            print(f"\n[error] Failed to fetch {trans['language']}: {e}")
            errors += 1

        time.sleep(RATE_LIMIT_SECONDS)

    pbar.close()

    print(f"\nDone. Downloaded: {downloaded}, Skipped: {skipped}, Errors: {errors}")
    print(f"Translations in: {TRANSLATIONS_DIR}")

    if errors > 0:
        sys.exit(1)


if __name__ == "__main__":
    fetch_translations()
