# ml-video

Serenify's **video stress modality** (Constitution Principle III): LBP-TOP +
motion feature extraction and the per-user-anchor model loader for
`serenify-video-lbptop-motion-rf-calibrated@2.0.0`.

Feature 004 uses only the **anchor** path — `compute_anchor(video_path)` turns a
60-second calm-baseline clip into the absolute `(2958,)` feature vector. The
delta-subtraction + predict path (`Predictor.predict_delta`) exists for feature
005 and is unused here.

## Layout

```
src/ml_video/
  pipeline.py   decode -> 5fps -> %2 skip -> MediaPipe FaceMesh   (handoff §3 1-3)
  features.py   LBP-TOP per ROI (90-d) + motion (2868-d)          (handoff §3 4-5)
  anchor.py     compute_anchor() -> (2958,)                       (handoff §3 6, §4)
  loader.py     load_model() startup contract check               (handoff §8 1-2)
  errors.py     FeatureExtractionError
models/         model.joblib, scaler.joblib, metadata.json        (Principle II)
scripts/        inspect_anchor.py (bytea blob debug helper)
tests/          fixture-locked regression + loader contract
```

## Pins

Python **3.12** only — `mediapipe==0.10.13` has no 3.13 wheel. ML deps are pinned
exactly to `models/metadata.json["dependencies"]`; `scikit-learn==1.6.1` is
load-bearing for unpickling the fitted artifacts.

## Develop

```sh
uv sync
uv run pytest
uv run python scripts/inspect_anchor.py '\x...'   # inspect a stored anchor blob
```

> **Fidelity caveat.** Two LBP-TOP details are underdetermined by the handoff
> prose and pinned in `features.py` (per-plane histograms are L1-normalized; the
> per-ROI block is `[XY, XT, YT]` with ROIs `mouth, left_eye, right_eye`). Confirm
> against the training notebook's `compute_anchor_from_video` before trusting
> production vectors — the regression test guards this implementation, not
> notebook fidelity.
