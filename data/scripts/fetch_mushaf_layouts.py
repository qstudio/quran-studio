"""Download 604 mushaf layout JSON files from zonetecde/mushaf-layout repo.

Ported from rollingquran/backend/scripts/download_mushaf_layout.py.
Uses requests instead of httpx, adds tqdm progress, retry with backoff,
and rate limiting.
"""

import json
import sys
import time
from pathlib import Path

import requests
from tqdm import tqdm

DATA_DIR = Path(__file__).resolve().parent.parent
LAYOUT_DIR = DATA_DIR / "mushaf_layout"
BASE_URL = "https://raw.githubusercontent.com/zonetecde/mushaf-layout/main/mushaf"
TOTAL_PAGES = 604
MAX_RETRIES = 3
RATE_LIMIT_SECONDS = 1.0


def download_with_retry(url: str, max_retries: int = MAX_RETRIES) -> requests.Response:
    """Download a URL with exponential backoff retry."""
    for attempt in range(max_retries):
        try:
            resp = requests.get(url, timeout=30)
            resp.raise_for_status()
            return resp
        except requests.RequestException as e:
            if attempt == max_retries - 1:
                raise
            wait = 2 ** attempt
            print(f"  Retry {attempt + 1}/{max_retries} after {wait}s: {e}")
            time.sleep(wait)
    raise RuntimeError("Unreachable")


def download_layouts():
    """Download all 604 mushaf layout JSON files."""
    LAYOUT_DIR.mkdir(parents=True, exist_ok=True)

    downloaded = 0
    skipped = 0
    errors = 0

    pbar = tqdm(range(1, TOTAL_PAGES + 1), desc="Downloading layouts", unit="page")
    for page in pbar:
        filename = f"page-{page:03d}.json"
        filepath = LAYOUT_DIR / filename

        if filepath.exists():
            skipped += 1
            pbar.set_postfix(downloaded=downloaded, skipped=skipped)
            continue

        url = f"{BASE_URL}/{filename}"

        try:
            resp = download_with_retry(url)
            # Validate JSON
            json.loads(resp.text)
            filepath.write_text(resp.text)
            downloaded += 1
        except Exception as e:
            print(f"\n[error] Failed to download {filename}: {e}")
            errors += 1

        pbar.set_postfix(downloaded=downloaded, skipped=skipped)
        time.sleep(RATE_LIMIT_SECONDS)

    print(f"\nDone. Downloaded: {downloaded}, Skipped: {skipped}, Errors: {errors}")
    print(f"Layout files in: {LAYOUT_DIR}")

    if errors > 0:
        sys.exit(1)


if __name__ == "__main__":
    download_layouts()
