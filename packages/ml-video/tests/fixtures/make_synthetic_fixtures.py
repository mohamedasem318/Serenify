"""Generate the SYNTHETIC coverage-gate fixtures (feature 006).

The four committed arrays (``thin``, ``good_ideal``, ``good_realistic``, ``half``) are
**synthetic stand-ins**, not real landmark data. The usable-face-coverage gate
(``ml_video.coverage``) only ever inspects, per row, whether the row is non-zero
(``np.any(row)`` — a detected face) and the total row count; it never reads landmark
*values*. So an array with the right shape, dtype, and non-zero-row count reproduces
the gate's ``(usable, kept, fraction)`` — and therefore every accept/reject decision in
``test_usable_face_coverage_gate.py`` — bit-for-bit, with no real capture committed.

This script is the reproducible source for those arrays: run it to regenerate them.
It is a plain ``__main__`` CLI (not a ``test_*`` module), so pytest never collects it.
It needs only numpy — no mediapipe, no clips, no pinned env.

    python tests/fixtures/make_synthetic_fixtures.py          # write the four .npy
    python tests/fixtures/make_synthetic_fixtures.py --check   # verify, write nothing

Provenance of the REAL clips these replace (all landscape webcam, none iOS) is in
``PROVENANCE.md``. The historical real-clip extractor is ``extract_coverage_fixtures.py``.
"""

from __future__ import annotations

import argparse
from pathlib import Path

import numpy as np

FIXTURE_DIR = Path(__file__).resolve().parent

# (N_LANDMARKS * 2) — 478 FaceMesh points x (x, y). Matches ml_video.features.LANDMARK_DIM.
LANDMARK_DIM = 956

# name -> (kept_rows, usable_rows). usable = non-zero rows; kept = total rows. These are
# the measured values of the original real clips (006 DECISION-32) — the numbers the gate
# calibration is locked to. Coverage = usable / kept:
#   thin            11/150  0.073  -> reject (floor 11 < 50 AND lever 0.073 < 0.65)
#   good_ideal     150/150  1.000  -> accept
#   good_realistic 151/151  1.000  -> accept  (151 rows: ~0.3 s longer clip, one extra window)
#   half            77/150  0.513  -> reject (clears floor 77 >= 50, fails lever 0.513 < 0.65)
SPECS: dict[str, tuple[int, int]] = {
    "thin": (150, 11),
    "good_ideal": (150, 150),
    "good_realistic": (151, 151),
    "half": (150, 77),
}


def build(kept: int, usable: int) -> np.ndarray:
    """A ``(kept, 956)`` float64 array with exactly ``usable`` non-zero (detected-face)
    rows and ``kept - usable`` all-zero (no-detection) rows.

    Detected rows carry a fixed non-zero pattern in the [0.3, 0.7] band (a plausible
    normalized-landmark range, and unambiguously non-zero for ``np.any``); no-detection
    rows are all zeros, exactly as ``pipeline._landmarks_from_result`` emits. The usable
    rows are placed first — the gate is order-insensitive (it counts, not sequences), so
    this only needs to be deterministic, which it is.
    """
    arr = np.zeros((kept, LANDMARK_DIM), dtype=np.float64)
    row = 0.3 + 0.4 * ((np.arange(LANDMARK_DIM) % 50) / 50.0)  # constant, all non-zero
    arr[:usable] = row
    return arr


def main() -> None:
    parser = argparse.ArgumentParser(description="Generate synthetic coverage-gate fixtures.")
    parser.add_argument(
        "--check",
        action="store_true",
        help="verify the committed .npy match this generator; write nothing",
    )
    args = parser.parse_args()

    ok = True
    for name, (kept, usable) in SPECS.items():
        out = FIXTURE_DIR / f"{name}.npy"
        arr = build(kept, usable)
        if args.check:
            have = np.load(out)
            match = (
                have.shape == arr.shape
                and have.dtype == arr.dtype
                and int(np.count_nonzero(np.any(have, axis=1))) == usable
            )
            ok = ok and match
            print(f"{name:<16} {'OK' if match else 'MISMATCH':<10} "
                  f"shape={arr.shape} usable={usable}")
        else:
            np.save(out, arr)
            print(f"{name:<16} wrote {out.name:<20} shape={arr.shape} "
                  f"dtype={arr.dtype} usable={usable} kept={kept}")

    if args.check and not ok:
        raise SystemExit("synthetic fixtures do not match the generator")


if __name__ == "__main__":
    main()
