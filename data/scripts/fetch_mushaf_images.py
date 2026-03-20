"""Download 604 tajweed mushaf page images.

Ported from rollingquran/backend/scripts/download_mushaf_images.py.
Source: HiIAmMoot/quran-android-tajweed-page-provider on GitHub.
Adds Pillow validation, tqdm progress, retry with backoff, and rate limiting.
"""

import sys
import time
from io import BytesIO
from pathlib import Path

import requests
from PIL import Image
from tqdm import tqdm

DATA_DIR = Path(__file__).resolve().parent.parent
IMAGES_DIR = DATA_DIR / "mushaf_images"
BASE_URL = "https://raw.githubusercontent.com/HiIAmMoot/quran-android-tajweed-page-provider/main/images"
TOTAL_PAGES = 604
MAX_RETRIES = 3
RATE_LIMIT_SECONDS = 1.0
MIN_IMAGE_SIZE = 10_000  # bytes - minimum reasonable PNG size


def download_with_retry(url: str, max_retries: int = MAX_RETRIES) -> requests.Response:
    """Download a URL with exponential backoff retry."""
    for attempt in range(max_retries):
        try:
            resp = requests.get(url, timeout=60)
            resp.raise_for_status()
            return resp
        except requests.RequestException as e:
            if attempt == max_retries - 1:
                raise
            wait = 2 ** attempt
            print(f"  Retry {attempt + 1}/{max_retries} after {wait}s: {e}")
            time.sleep(wait)
    raise RuntimeError("Unreachable")


def validate_image(data: bytes) -> bool:
    """Validate that the data is a valid PNG image of reasonable size."""
    if len(data) < MIN_IMAGE_SIZE:
        return False
    try:
        img = Image.open(BytesIO(data))
        img.verify()
        # Check reasonable dimensions (at least 100x100)
        if img.size[0] < 100 or img.size[1] < 100:
            return False
        return True
    except Exception:
        return False


def download_images():
    """Download all 604 mushaf page images."""
    IMAGES_DIR.mkdir(parents=True, exist_ok=True)

    downloaded = 0
    skipped = 0
    errors = 0

    pbar = tqdm(range(1, TOTAL_PAGES + 1), desc="Downloading images", unit="page")
    for page in pbar:
        # Output format uses underscore: page_001.png
        out_filename = f"page_{page:03d}.png"
        filepath = IMAGES_DIR / out_filename

        if filepath.exists() and filepath.stat().st_size > MIN_IMAGE_SIZE:
            skipped += 1
            pbar.set_postfix(downloaded=downloaded, skipped=skipped)
            continue

        # Source format: {NNN}.png
        url = f"{BASE_URL}/{page:03d}.png"

        try:
            resp = download_with_retry(url)

            if not validate_image(resp.content):
                print(f"\n[error] Invalid image for page {page}")
                errors += 1
                continue

            filepath.write_bytes(resp.content)
            downloaded += 1
        except Exception as e:
            print(f"\n[error] Failed to download page {page}: {e}")
            errors += 1

        pbar.set_postfix(downloaded=downloaded, skipped=skipped)
        time.sleep(RATE_LIMIT_SECONDS)

    print(f"\nDone. Downloaded: {downloaded}, Skipped: {skipped}, Errors: {errors}")
    print(f"Images in: {IMAGES_DIR}")

    if errors > 0:
        sys.exit(1)


if __name__ == "__main__":
    download_images()
