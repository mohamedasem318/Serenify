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

> Status: scaffold (T002). The `.npy` arrays and the extractor are produced in
> Phase 5 (T011–T012); the calibration thresholds and the per-clip
> `usable / kept / fraction` measurements + chosen thresholds + margin are recorded
> at calibration (T013/T015).

## Why raw clips are NOT committed

The raw calibration **video clips are intentionally never committed** (see
`.gitignore` here): `*.mp4` / `*.webm` / `*.mov` / `*.avi` are excluded so a raw
recording can never be added by accident. This keeps raw signal off the repo
(Constitution Principle I — raw frames stay in the inference layer) and avoids any
dataset-consent exposure (Principle X). Only the **derived `.npy` landmark arrays**
are committed — analogous to using StressID feature vectors (not media) as fixtures.

## Provenance (to be filled at calibration — T013/T015)

The three clips are the developers' own calibration recordings (not StressID
media). Extracted **once** in the pinned ml-video env — Python 3.12,
`mediapipe==0.10.13` (run via `uv run`; **not** a Python 3.9 conda env, whose
different mediapipe build would shift detection and thus coverage).

| Clip | usable | kept | fraction | accept/reject |
|------|--------|------|----------|---------------|
| thin           | _(T013)_ | _(T013)_ | _(T013)_ | reject |
| good-ideal     | _(T013)_ | _(T013)_ | _(T013)_ | accept |
| good-realistic | _(T013)_ | _(T013)_ | _(T013)_ | accept (binding upper bound) |

Chosen thresholds + margin: _(recorded at T015)_.
