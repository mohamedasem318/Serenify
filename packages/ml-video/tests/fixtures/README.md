# Coverage-gate test fixtures (feature 006)

These fixtures back the usable-face-coverage gate's honest boundary test
(`tests/test_usable_face_coverage_gate.py`, FR-017/018, Constitution Principle VII).

## What lives here

- `thin.npy`, `good_ideal.npy`, `good_realistic.npy`, `half.npy` — **derived landmark
  arrays** (`float64 (N_kept, 956)`), each the FaceMesh landmark output of one real
  calibration clip run through `ml_video.pipeline.extract_landmarks`. They are
  **geometry, not frames** — no image/pixel data.
- `extract_coverage_fixtures.py` — the **dev-only, one-time** extractor (a `__main__`
  CLI, deliberately **not** a `test_*` file so pytest never collects it).

> Status: calibrated, then **recalibrated on real browser webm** (DECISION-32). The
> `.npy` arrays were regenerated from the four `.webm` clips through the fixed
> VFR-timestamp decode (DECISION-29); the per-clip `usable / kept / fraction` and the
> chosen thresholds are recorded below and in research.md "Calibration measurements"
> / "Chosen thresholds (DECISION-32)".

## Why raw clips are NOT committed

The raw calibration **video clips are intentionally never committed** (see
`.gitignore` here): `*.mp4` / `*.webm` / `*.mov` / `*.avi` are excluded so a raw
recording can never be added by accident. This keeps raw signal off the repo
(Constitution Principle I — raw frames stay in the inference layer) and avoids any
dataset-consent exposure (Principle X). Only the **derived `.npy` landmark arrays**
are committed — analogous to using StressID feature vectors (not media) as fixtures.

## Provenance

The four clips are the developers' own calibration recordings (not StressID media),
captured in the browser as `.webm` (the dev recorder
`packages/ml-video/tools/dev_webm_recorder.html`) and decoded through the **fixed
VFR-timestamp path** (DECISION-29 — real Chrome MediaRecorder webm reports a garbage
`fps=1000`, so frame selection is driven by `CAP_PROP_POS_MSEC`). Extracted **once**
in the pinned ml-video env — Python **3.12.13**, `mediapipe==0.10.13` (run via
`uv run`; **not** a Python 3.9 conda env, whose different mediapipe build would shift
detection and thus coverage).

| Clip | kept | usable | fraction | duration | verdict @ 0.65 |
|------|-----:|-------:|---------:|---------:|----------------|
| thin           | 150 |  11 | **0.073** | 59.97 s | reject (face ~2–3 s only) |
| good-ideal     | 150 | 150 | **1.000** | 59.94 s | accept |
| good-realistic | 151 | 151 | **1.000** | 60.29 s | accept (natural look-aways) |
| half           | 150 |  77 | **0.513** | 59.97 s | reject (~30 s present / 30 s absent) |

All four confirmed on the VFR timestamp decode path (reported `fps=1000` is garbage;
true ~28.7–30.1 fps). good-realistic measured **1.000** despite genuine seated
look-aways — FaceMesh tracks through brief glances — so legitimate captures cluster at
~1.0; `half` is the one intermediate datapoint, and its **0.513** validates that
coverage ≈ fraction-of-minute-present (even-time sampling predicts ~0.5 for ~30 s
present in a 60 s clip).

Chosen thresholds (DECISION-32): **`MIN_COVERAGE_FRACTION = 0.65`** (the primary lever)
— `half` 0.513 rejects with a **0.137 margin** while both good clips at 1.000 clear it
by 0.35 — and **`MIN_USABLE_FRAMES = 50`** (the secondary backstop) — `thin` 11 < 50;
`half` 77 and the good clips ≥ 150 clear it, so the coverage lever (not the floor) is
what rejects `half`. 0.65 ≈ "face present ≥ ~40 s of the 60 s". **Provisional** — only
one intermediate sample (`half`); the accept-side absence tolerance (~15–20 s) is
extrapolated from the validated linearity, not directly measured. Revisit against
real-user data — the apps/api logging config now emits the reject line, so the reject
rate is observable. See research.md and `docs/DECISIONS.md` DECISION-32 for the full note.
