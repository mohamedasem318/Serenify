# Quickstart: Calibration Capture Quality (006)

How to build, calibrate, and verify the usable-face-coverage gate locally.

## Prerequisites
- The ml-video package env (uv): Python **3.12**, `mediapipe==0.10.13`,
  `scikit-learn==1.6.1` (see `packages/ml-video/README.md`). **Do not** use a Python
  3.9 conda env — a different mediapipe build shifts landmark detection and would
  invalidate the calibration (DECISION-32).
- `apps/api` (FastAPI) and `apps/web` (Next 16) only needed for the end-to-end smoke.

## 1. Run the gate unit tests (CI-equivalent, no mediapipe)
```sh
cd packages/ml-video
uv run pytest -q                      # includes test_usable_face_coverage_gate.py
```
Expects: thin fixture **rejects** (raises `FeatureExtractionError`, code
`insufficient_face_frames`); good-ideal and good-realistic fixtures **accept**;
`compute_anchor` raises with the code when fed thin landmark rows. CI runs no
mediapipe — the test uses committed `.npy` fixtures.

## 2. (Re)extract the landmark fixtures — DEV ONLY, once, in the pinned env
Only needed when (re)calibrating or refreshing fixtures; the `.npy` arrays are
committed so this is not part of CI.
```sh
cd packages/ml-video
# clips are local, NOT committed (raw video stays off the repo — Principle I/X)
uv run python tests/fixtures/extract_coverage_fixtures.py \
    --thin /path/to/thin.(mp4|webm) \
    --good-ideal /path/to/good_ideal.(mp4|webm) \
    --good-realistic /path/to/good_realistic.(mp4|webm)
# writes tests/fixtures/{thin,good_ideal,good_realistic}.npy
```

## 3. Set the thresholds (calibration — DECISION-32)
```sh
# print usable/kept/fraction for each fixture
uv run python - <<'PY'
import numpy as np
from ml_video.coverage import usable_face_coverage
for name in ("thin","good_ideal","good_realistic"):
    lm = np.load(f"tests/fixtures/{name}.npy")
    print(name, usable_face_coverage(lm))
PY
```
Set `MIN_USABLE_FRAMES` and `MIN_COVERAGE_FRACTION` in
`src/ml_video/coverage.py` so **thin** rejects and **both good clips accept**, with
`MIN_COVERAGE_FRACTION` clearly **below** the good-realistic clip's coverage (the
binding upper bound) and `MIN_USABLE_FRAMES` clearly below its usable count. The
**coverage fraction** is the primary lever; the **absolute floor** is the backstop.
Record the measured rows + chosen thresholds in the `docs/DECISIONS.md` note.

## 4. Drive a rejection through the API (optional)
```sh
# from apps/api, with the service running
uv run pytest tests/ -q -k anchor     # asserts a gate error surfaces reason="insufficient_face_frames"
```

## 5. Frontend chip mapping (Vitest)
```sh
cd apps/web
npm run test -- failure-state          # new insufficient-face chip + copy
npm run test -- anchor-recorder        # server-reason precedence + no-regression on dominantCause
```
Expects: `reason==="insufficient_face_frames"` → new chip; any other reason →
`dominantCause` (unchanged); existing `CAUSE` entries unchanged.

## 6. Manual smoke (Mohamed, after /speckit-implement — `smoke-tests.md`)
- Record a calibration minute with your face **out of frame for almost all of it**
  (~2s of face). Expect: **422 → the 005 failure screen** with the face-absence chip
  ("We couldn't see your face for enough of that recording — let's try again"), **not**
  "Your baseline is set" and **not** "this one was on our side".
- Record a **genuine full minute** sitting normally (glasses fine; brief glances away
  fine). Expect: **success** ("Your baseline is set"). No false reject.
- Confirm an off-centre-but-detected minute still behaves as before (not rejected by
  this gate; existing framing chips unchanged).
