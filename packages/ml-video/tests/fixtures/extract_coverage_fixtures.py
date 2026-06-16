"""DEV-ONLY, one-time extractor for the coverage-gate fixtures (feature 006, T011).

This is NOT a pytest module (the filename is not ``test_*``), so pytest never
collects it and CI never runs it. Run it ONCE, in the pinned ml-video env
(Python 3.12, ``mediapipe==0.10.13``), to turn the four real calibration clips into
committed landmark arrays:

    uv run python tests/fixtures/extract_coverage_fixtures.py \
        --thin <thin.webm> \
        --good-ideal <good-ideal.webm> \
        --good-realistic <good-realistic.webm> \
        --half <half.webm>

It writes ``{thin,good_ideal,good_realistic,half}.npy`` next to this file and prints
the usable / kept / fraction table. The clips are real browser ``.webm`` recordings
decoded through the fixed VFR-timestamp path (DECISION-29); the recalibration that set
``MIN_COVERAGE_FRACTION = 0.65`` is DECISION-32. The raw clips are NEVER committed
(Constitution Principle I / X) — only the derived ``.npy`` landmark arrays.
"""

from __future__ import annotations

import argparse
from pathlib import Path

import numpy as np

from ml_video.coverage import usable_face_coverage
from ml_video.pipeline import extract_landmarks

FIXTURE_DIR = Path(__file__).resolve().parent
CLIPS = ("thin", "good_ideal", "good_realistic", "half")


def main() -> None:
    parser = argparse.ArgumentParser(description="Extract coverage-gate landmark fixtures.")
    parser.add_argument("--thin", required=True, type=Path)
    parser.add_argument("--good-ideal", required=True, type=Path, dest="good_ideal")
    parser.add_argument("--good-realistic", required=True, type=Path, dest="good_realistic")
    parser.add_argument("--half", required=True, type=Path)
    args = parser.parse_args()

    paths = {
        "thin": args.thin,
        "good_ideal": args.good_ideal,
        "good_realistic": args.good_realistic,
        "half": args.half,
    }

    print(f"{'clip':<16}{'usable':>8}{'kept':>7}{'fraction':>10}   file")
    print("-" * 56)
    for name in CLIPS:
        clip_path = paths[name]
        if not clip_path.exists():
            raise SystemExit(f"clip not found: {clip_path}")
        clip = extract_landmarks(clip_path)
        out = FIXTURE_DIR / f"{name}.npy"
        np.save(out, clip.landmarks)
        usable, kept, fraction = usable_face_coverage(clip.landmarks)
        print(f"{name:<16}{usable:>8}{kept:>7}{fraction:>10.3f}   {out.name}")


if __name__ == "__main__":
    main()
