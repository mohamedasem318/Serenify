# Coverage-gate test fixtures (feature 006)

These fixtures back the usable-face-coverage gate's honest boundary test
(`tests/test_usable_face_coverage_gate.py`, FR-017/018, Constitution Principle VII).

## What lives here

- `thin.npy`, `good_ideal.npy`, `good_realistic.npy` — **derived landmark arrays**
  (`float64 (N_kept, 956)`), each the FaceMesh landmark output of one real
  calibration clip run through `ml_video.pipeline.extract_landmarks`. They are
  **geometry, not frames** — no image/pixel data.
- `extract_coverage_fixtures.py` — the **dev-only, one-time** extractor (a `__main__`
  CLI, deliberately **not** a `test_*` file so pytest never collects it).

> Status: calibrated (Phase 5 complete through T016). The `.npy` arrays + extractor
> were produced in T011–T012; the per-clip `usable / kept / fraction` and the chosen
> thresholds are recorded below and in research.md "Calibration measurements (T013)"
> / "Chosen thresholds (T015 / DECISION-32)".

## Why raw clips are NOT committed

The raw calibration **video clips are intentionally never committed** (see
`.gitignore` here): `*.mp4` / `*.webm` / `*.mov` / `*.avi` are excluded so a raw
recording can never be added by accident. This keeps raw signal off the repo
(Constitution Principle I — raw frames stay in the inference layer) and avoids any
dataset-consent exposure (Principle X). Only the **derived `.npy` landmark arrays**
are committed — analogous to using StressID feature vectors (not media) as fixtures.

## Provenance

The three clips are the developers' own calibration recordings (not StressID
media). Extracted **once** in the pinned ml-video env — Python 3.12,
`mediapipe==0.10.13` (run via `uv run`; **not** a Python 3.9 conda env, whose
different mediapipe build would shift detection and thus coverage).

| Clip | usable | kept | fraction | accept/reject |
|------|-------:|-----:|---------:|---------------|
| thin           |   4 | 172 | 0.023 | reject |
| good-ideal     | 154 | 154 | 1.000 | accept |
| good-realistic | 129 | 129 | 1.000 | accept (binding lower bound) |

Extracted in the pinned env (Python 3.12.13, mediapipe 0.10.13). Note: the
good-realistic clip measured 1.000 coverage — FaceMesh held the face through the
brief look-aways — so it did not exercise sub-100% coverage; see research.md
"Calibration measurements (T013)".

Chosen thresholds (T015 / DECISION-32): **`MIN_COVERAGE_FRACTION = 0.40`**
(thin 0.023 vs 0.40, ~17× margin; good clips 1.000) and **`MIN_USABLE_FRAMES = 50`**
(thin 4 vs 50, ~12× margin; good-realistic 129, the binding lower bound). The
thresholds sit in a wide empty gap — a conservative judgment to revisit against
real-user data, since no genuine sub-100%-coverage sample exists (good-realistic
held at 1.000). See research.md for the full DECISION-32 note.
