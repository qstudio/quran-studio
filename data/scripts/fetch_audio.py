"""Download per-surah audio files for reciters.

Gets audio URLs from the QDC API (same approach as rollingquran's quran_api.py
get_audio_url), then downloads the MP3 files.

Usage:
    python fetch_audio.py --reciter mishary
    python fetch_audio.py --all
    python fetch_audio.py --reciter mishary --surah 1
"""

import argparse
import json
import sys
import time
from pathlib import Path

import requests
from tqdm import tqdm

DATA_DIR = Path(__file__).resolve().parent.parent
SCRIPTS_DIR = Path(__file__).resolve().parent
AUDIO_DIR = DATA_DIR / "audio"
RECITERS_FILE = SCRIPTS_DIR / "reciters.json"

QDC_API_BASE = "https://api.qurancdn.com/api/qdc"
TOTAL_SURAHS = 114
MAX_RETRIES = 3
RATE_LIMIT_SECONDS = 1.0
MIN_AUDIO_SIZE = 1000  # bytes - minimum reasonable MP3 size


def load_reciters(reciter_filter: str | None = None) -> list[dict]:
    """Load reciter registry, optionally filtering to one reciter."""
    with open(RECITERS_FILE) as f:
        reciters = json.load(f)
    if reciter_filter:
        reciters = [r for r in reciters if r["id"] == reciter_filter]
        if not reciters:
            print(f"Error: Reciter '{reciter_filter}' not found in {RECITERS_FILE}")
            sys.exit(1)
    return reciters


def fetch_with_retry(url: str, params: dict | None = None,
                     max_retries: int = MAX_RETRIES, timeout: int = 30) -> requests.Response:
    """Fetch URL with exponential backoff retry."""
    for attempt in range(max_retries):
        try:
            resp = requests.get(url, params=params, timeout=timeout)
            resp.raise_for_status()
            return resp
        except requests.RequestException as e:
            if attempt == max_retries - 1:
                raise
            wait = 2 ** attempt
            print(f"  Retry {attempt + 1}/{max_retries} after {wait}s: {e}")
            time.sleep(wait)
    raise RuntimeError("Unreachable")


def get_audio_url(qdc_id: int, surah: int) -> str:
    """Get the audio file URL for a reciter's surah from QDC API.

    Same approach as rollingquran's quran_api.py get_audio_url.
    """
    url = f"{QDC_API_BASE}/audio/reciters/{qdc_id}/audio_files"
    params = {"chapter": surah}

    resp = fetch_with_retry(url, params)
    data = resp.json()

    audio_files = data.get("audio_files", [])
    if not audio_files:
        raise ValueError(f"No audio found for reciter {qdc_id}, surah {surah}")

    audio_url = audio_files[0].get("audio_url", "")
    if not audio_url:
        raise ValueError(f"Empty audio URL for reciter {qdc_id}, surah {surah}")

    return audio_url


def download_audio(reciter_filter: str | None = None, surah_filter: int | None = None,
                   fetch_all: bool = False):
    """Download audio files for reciters."""
    if not reciter_filter and not fetch_all:
        print("Error: Must specify --reciter <id> or --all")
        sys.exit(1)

    reciters = load_reciters(reciter_filter)

    surahs = list(range(1, TOTAL_SURAHS + 1))
    if surah_filter:
        surahs = [surah_filter]

    total = len(reciters) * len(surahs)
    downloaded = 0
    skipped = 0
    errors = 0

    pbar = tqdm(total=total, desc="Downloading audio", unit="file")

    for reciter in reciters:
        reciter_dir = AUDIO_DIR / reciter["id"]
        reciter_dir.mkdir(parents=True, exist_ok=True)

        for surah in surahs:
            out_file = reciter_dir / f"{surah:03d}.mp3"
            pbar.set_postfix(reciter=reciter["id"], surah=surah)

            # Resume: skip existing files with non-zero size
            if out_file.exists() and out_file.stat().st_size > MIN_AUDIO_SIZE:
                skipped += 1
                pbar.update(1)
                continue

            try:
                # Get the audio URL from QDC API
                audio_url = get_audio_url(reciter["qdc_id"], surah)
                time.sleep(RATE_LIMIT_SECONDS)

                # Download the audio file
                resp = fetch_with_retry(audio_url, timeout=120)

                if len(resp.content) < MIN_AUDIO_SIZE:
                    print(f"\n[warn] Audio too small for {reciter['id']} surah {surah}")
                    errors += 1
                    pbar.update(1)
                    continue

                out_file.write_bytes(resp.content)
                downloaded += 1

            except Exception as e:
                print(f"\n[error] Failed: {reciter['id']} surah {surah}: {e}")
                errors += 1

            pbar.update(1)
            time.sleep(RATE_LIMIT_SECONDS)

    pbar.close()

    print(f"\nDone. Downloaded: {downloaded}, Skipped: {skipped}, Errors: {errors}")
    print(f"Audio in: {AUDIO_DIR}")

    if errors > 0:
        sys.exit(1)


def main():
    parser = argparse.ArgumentParser(description="Download per-surah audio files for reciters")
    parser.add_argument("--reciter", type=str, help="Only download for this reciter ID")
    parser.add_argument("--all", action="store_true", help="Download for all reciters")
    parser.add_argument("--surah", type=int, help="Only download this surah number")
    args = parser.parse_args()

    download_audio(
        reciter_filter=args.reciter,
        surah_filter=args.surah,
        fetch_all=args.all,
    )


if __name__ == "__main__":
    main()
