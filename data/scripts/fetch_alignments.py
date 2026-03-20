"""Fetch word-level alignment timestamps from the QDC API.

Adapted from rollingquran/backend/app/services/quran_api.py.
For each reciter and surah, fetches verse_timings with segments from:
  GET https://api.qurancdn.com/api/qdc/audio/reciters/{qdc_id}/audio_files?chapter={ch}&segments=true

Each segment is [word_index, start_ms, end_ms].
"""

import argparse
import json
import logging
import sys
import time
from pathlib import Path

import requests
from tqdm import tqdm

DATA_DIR = Path(__file__).resolve().parent.parent
SCRIPTS_DIR = Path(__file__).resolve().parent
ALIGNMENTS_DIR = DATA_DIR / "intermediate" / "alignments"
RECITERS_FILE = SCRIPTS_DIR / "reciters.json"

QDC_API_BASE = "https://api.qurancdn.com/api/qdc"
TOTAL_SURAHS = 114
MAX_RETRIES = 3
RATE_LIMIT_SECONDS = 1.0

logging.basicConfig(level=logging.INFO, format="%(levelname)s: %(message)s")
logger = logging.getLogger(__name__)


def load_reciters(reciter_filter: str | None = None) -> list[dict]:
    """Load reciter registry, optionally filtering to one reciter."""
    with open(RECITERS_FILE) as f:
        reciters = json.load(f)
    if reciter_filter:
        reciters = [r for r in reciters if r["id"] == reciter_filter]
        if not reciters:
            logger.error(f"Reciter '{reciter_filter}' not found in {RECITERS_FILE}")
            sys.exit(1)
    return reciters


def fetch_with_retry(url: str, params: dict, max_retries: int = MAX_RETRIES) -> dict:
    """Fetch JSON from URL with exponential backoff retry."""
    for attempt in range(max_retries):
        try:
            resp = requests.get(url, params=params, timeout=30)
            resp.raise_for_status()
            return resp.json()
        except requests.RequestException as e:
            if attempt == max_retries - 1:
                raise
            wait = 2 ** attempt
            logger.warning(f"Retry {attempt + 1}/{max_retries} after {wait}s: {e}")
            time.sleep(wait)
    raise RuntimeError("Unreachable")


def fetch_surah_alignments(qdc_id: int, surah: int) -> dict:
    """Fetch word-level timestamps for one reciter + surah.

    Returns dict with verse_key -> list of {word_position, start_ms, end_ms}.
    """
    url = f"{QDC_API_BASE}/audio/reciters/{qdc_id}/audio_files"
    params = {"chapter": surah, "segments": "true"}

    data = fetch_with_retry(url, params)

    audio_files = data.get("audio_files", [])
    if not audio_files:
        logger.warning(f"No audio files for reciter {qdc_id}, surah {surah}")
        return {}

    audio_file = audio_files[0]
    verse_timings = audio_file.get("verse_timings", [])

    result = {}
    for vt in verse_timings:
        verse_key = vt["verse_key"]
        segments = vt.get("segments", [])

        words = []
        for seg in segments:
            if len(seg) < 3:
                continue
            word_idx, start_ms, end_ms = seg[0], seg[1], seg[2]

            # Handle missing/null timestamps
            if start_ms is None or end_ms is None:
                logger.warning(
                    f"Null timestamp for {verse_key} word {word_idx} "
                    f"(reciter {qdc_id})"
                )
                continue

            if not isinstance(start_ms, (int, float)) or not isinstance(end_ms, (int, float)):
                logger.warning(
                    f"Invalid timestamp type for {verse_key} word {word_idx} "
                    f"(reciter {qdc_id}): start={start_ms}, end={end_ms}"
                )
                continue

            words.append({
                "word_position": word_idx,
                "start_ms": int(start_ms),
                "end_ms": int(end_ms),
            })

        if words:
            result[verse_key] = words

    return result


def fetch_alignments(reciter_filter: str | None = None, surah_filter: int | None = None):
    """Fetch alignments for all reciters and surahs."""
    reciters = load_reciters(reciter_filter)

    surahs = range(1, TOTAL_SURAHS + 1)
    if surah_filter:
        surahs = [surah_filter]

    total = len(reciters) * len(surahs)
    downloaded = 0
    skipped = 0
    errors = 0

    pbar = tqdm(total=total, desc="Fetching alignments", unit="surah")

    for reciter in reciters:
        reciter_dir = ALIGNMENTS_DIR / reciter["id"]
        reciter_dir.mkdir(parents=True, exist_ok=True)

        for surah in surahs:
            out_file = reciter_dir / f"{surah:03d}.json"

            if out_file.exists():
                skipped += 1
                pbar.update(1)
                pbar.set_postfix(dl=downloaded, skip=skipped, err=errors)
                continue

            try:
                alignments = fetch_surah_alignments(reciter["qdc_id"], surah)
                with open(out_file, "w") as f:
                    json.dump(alignments, f)
                downloaded += 1
            except Exception as e:
                logger.error(
                    f"Failed: {reciter['id']} surah {surah}: {e}"
                )
                errors += 1

            pbar.update(1)
            pbar.set_postfix(dl=downloaded, skip=skipped, err=errors)
            time.sleep(RATE_LIMIT_SECONDS)

    pbar.close()

    print(f"\nDone. Downloaded: {downloaded}, Skipped: {skipped}, Errors: {errors}")
    print(f"Alignments in: {ALIGNMENTS_DIR}")

    if errors > 0:
        sys.exit(1)


def main():
    parser = argparse.ArgumentParser(description="Fetch word-level alignment timestamps from QDC API")
    parser.add_argument("--reciter", type=str, help="Only fetch for this reciter ID")
    parser.add_argument("--surah", type=int, help="Only fetch this surah number")
    args = parser.parse_args()

    fetch_alignments(reciter_filter=args.reciter, surah_filter=args.surah)


if __name__ == "__main__":
    main()
