"""Master data pipeline for Quran Studio.

Runs all data ingestion and processing steps in order.

Usage:
    python run_pipeline.py                    # Run all steps
    python run_pipeline.py --step fetch_mushaf_layouts
    python run_pipeline.py --skip-images --skip-audio
    python run_pipeline.py --reciter mishary  # Only one reciter
    python run_pipeline.py --surah 1          # Only one surah (testing)
"""

import argparse
import subprocess
import sys
import time
from pathlib import Path

SCRIPTS_DIR = Path(__file__).resolve().parent

STEPS = [
    "fetch_mushaf_layouts",
    "precompute_coordinates",
    "fetch_mushaf_images",
    "fetch_alignments",
    "fetch_translations",
    "fetch_audio",
    "build_database",
    "validate_data",
]


def run_step(step_name: str, extra_args: list[str] | None = None) -> bool:
    """Run a pipeline step as a subprocess. Returns True on success."""
    script_path = SCRIPTS_DIR / f"{step_name}.py"
    if not script_path.exists():
        print(f"[error] Script not found: {script_path}")
        return False

    cmd = [sys.executable, str(script_path)]
    if extra_args:
        cmd.extend(extra_args)

    print(f"\n{'='*60}")
    print(f"STEP: {step_name}")
    print(f"{'='*60}")

    start = time.time()
    result = subprocess.run(cmd)
    elapsed = time.time() - start

    status = "OK" if result.returncode == 0 else "FAILED"
    print(f"\n[{status}] {step_name} completed in {elapsed:.1f}s")

    return result.returncode == 0


def main():
    parser = argparse.ArgumentParser(description="Quran Studio data pipeline")
    parser.add_argument("--step", type=str, choices=STEPS, help="Run only this step")
    parser.add_argument("--skip-images", action="store_true", help="Skip mushaf image download")
    parser.add_argument("--skip-audio", action="store_true", help="Skip audio download")
    parser.add_argument("--reciter", type=str, help="Only process this reciter ID")
    parser.add_argument("--surah", type=int, help="Only process this surah number (for testing)")
    args = parser.parse_args()

    # Determine which steps to run
    if args.step:
        steps_to_run = [args.step]
    else:
        steps_to_run = list(STEPS)
        if args.skip_images:
            steps_to_run.remove("fetch_mushaf_images")
        if args.skip_audio:
            steps_to_run.remove("fetch_audio")

    print(f"Pipeline steps: {', '.join(steps_to_run)}")
    if args.reciter:
        print(f"Reciter filter: {args.reciter}")
    if args.surah:
        print(f"Surah filter: {args.surah}")

    results = {}
    start_total = time.time()

    for step in steps_to_run:
        # Build extra args based on the step
        extra_args = []
        if step == "fetch_alignments":
            if args.reciter:
                extra_args.extend(["--reciter", args.reciter])
            if args.surah:
                extra_args.extend(["--surah", str(args.surah)])
        elif step == "fetch_audio":
            if args.reciter:
                extra_args.extend(["--reciter", args.reciter])
            else:
                extra_args.append("--all")
            if args.surah:
                extra_args.extend(["--surah", str(args.surah)])

        success = run_step(step, extra_args if extra_args else None)
        results[step] = success

        if not success and step not in ("fetch_audio", "fetch_mushaf_images"):
            # Critical step failed - abort pipeline
            print(f"\n[ABORT] Critical step '{step}' failed. Stopping pipeline.")
            break

    elapsed_total = time.time() - start_total

    # Print summary
    print(f"\n{'='*60}")
    print("PIPELINE SUMMARY")
    print(f"{'='*60}")
    for step, success in results.items():
        status = "OK" if success else "FAILED"
        print(f"  [{status}] {step}")

    passed = sum(1 for s in results.values() if s)
    failed = sum(1 for s in results.values() if not s)
    print(f"\nTotal: {passed} passed, {failed} failed")
    print(f"Elapsed: {elapsed_total:.1f}s")

    if failed > 0:
        sys.exit(1)


if __name__ == "__main__":
    main()
