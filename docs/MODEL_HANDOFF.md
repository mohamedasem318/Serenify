# MODEL_HANDOFF — Video Stress Detection (LBP-TOP + Motion + Per-Subject Calibration)

**Model name**: `serenify-video-lbptop-motion-rf-calibrated`
**Model version**: `2.0.0`
**Task**: binary stress classification (`binary-stress` label from StressID)
**Modality**: video only (no audio, no physio)
**Trained on**: StressID, 53 subjects, 525 calibrated task clips (578 minus 53 anchors)
**Evaluation**: subject-disjoint LeaveOneSubjectOut (LOSO)
**Source notebook**: `stress-id-video-lbp-top_motion_features__refactored_v2.ipynb`

This document is the integration contract for the FastAPI service. A reader who has never opened the notebook should be able to wire the model from this doc alone.

**🔴 The biggest change from v1**: this model requires a **per-user anchor vector** computed at onboarding. Inference cannot run without it. See Section 3.

**🔴 The second biggest change**: deployment is **60-second buffering with 10-second stride**, not the originally-planned 30-second sliding window. The 30s configuration produces a severe recall flip on the stress class (0.83 → 0.61); 60s is the recommended mode. See Section 5.3.

---

## 1. Artifacts

All four files are produced at the end of the notebook in `/kaggle/working/artifacts/`. Download them as a unit.

| File | Purpose | Approx. size |
|---|---|---|
| `model.joblib` | Fitted `RandomForestClassifier` (trained on 525 delta rows) | ~150–400 MB |
| `scaler.joblib` | Fitted `StandardScaler` (mean/std of 525 delta rows) | < 100 KB |
| `metadata.json` | Feature contract, anchor policy, hyperparameters, LOSO metrics + threshold sweeps, dep versions | < 100 KB |
| `subject_anchors_reference.npz` | The 53 per-subject training-time anchors. **Reproducibility only.** Production uses fresh per-user anchors. | < 2 MB |

**The scaler is required.** It was fit on the 525 delta rows and encodes their mean/std. Skipping it does not error, it just produces silently wrong predictions.

---

## 2. Input contract

### 2.1 Two inputs at inference time

| Input | What it is | When captured |
|---|---|---|
| **Current clip** | The window of webcam video you want a prediction for | Live, **60 s** buffered before invoking inference |
| **User anchor vector** | A 2958-d feature vector representing the user's calm baseline | Computed **once** at onboarding from a 60 s calm-baseline recording; stored in the backend keyed by `user_id` |

Inference produces: `prediction = predict(features(current_clip) - user_anchor[user_id])`.

### 2.2 Video format (same for current clip and anchor capture)

| Property | Value | Notes |
|---|---|---|
| Container | MP4 (mp4v / H.264) | What MediaPipe + OpenCV both decode reliably |
| Color space | BGR (OpenCV native) | The inference function decodes via `cv2.VideoCapture` |
| Resolution | Any (StressID training: 720p) | MediaPipe handles arbitrary input |
| FPS | Any (StressID training: 5–62.5 fps) | Service internally downsamples to 5 fps |

### 2.3 Anchor capture (onboarding)

- **Duration**: 60 s of low-arousal recording. User sits looking at the screen, no task.
- **Why 60 s**: matches the training-anchor clip lengths (StressID `Relax` is ~60 s). Shorter (e.g., 30 s) produces noisier anchors because the motion feature statistics are less stable at shorter durations.
- **Validation before saving**: the backend should verify that `compute_anchor_from_video()` returned a vector of shape `(2958,)` and that no extraction error was raised. Reject the onboarding if it fails — ask the user to re-record.
- **Re-anchoring**: anchors can drift over time (camera moved, lighting changed). Plan to expose a "recalibrate" action in the dashboard that overwrites the stored anchor.

### 2.4 Current clip — deployment configuration

**Recommended deployment mode: 60-second buffer with 10-second stride.**

- **Initial latency**: 60 s of webcam recording before the first prediction.
- **Steady-state**: a new prediction every 10 s, each computed on the most recent 60 s of video.
- **Why not 30 s**: the 30 s windowing flips the class balance (Breathing clips dominate class 0 at 30 s windowing), which collapses recall on the stress class from 0.83 to 0.61. See Section 5.3.

### 2.5 Output

```json
{
  "label":             1,
  "label_str":         "stressed",
  "prob_stressed":     0.78,
  "prob_not_stressed": 0.22
}
```

`label ∈ {0, 1}` where `0 = not_stressed`, `1 = stressed`. The decision threshold defaults to 0.5; `metadata.json` exposes a Youden's J–recommended threshold (see Section 5.2).

---

## 3. Preprocessing pipeline — exact order

The notebook's `predict_from_video_and_anchor_video` is the reference. The service performs these steps for both the anchor (once at onboarding) and the current clip (every inference).

### Step 1 — Decode video, downsample to 5 FPS

For each frame index `i` starting at 0:
- `skip_ratio = round(input_fps / 5)`
- Keep the frame iff `i % skip_ratio == 0`

Produces a list of BGR frames at 5 FPS.

### Step 2 — Apply the `%2` frame skip

The non-obvious step. The training pipeline halves the 5-fps stream again before MediaPipe runs, for compute reasons. Replicate exactly:

```python
frame_idx = 0
for frame in frames_5fps:
    frame_idx += 1
    if frame_idx % 2 != 0:
        continue
    # keep this frame
```

`frame_idx` starts at 0 and increments **before** the check, so kept frames are at original indices 1, 3, 5, …. Effective sampling rate after this step: ~2.5 FPS.

### Step 3 — MediaPipe FaceMesh per kept frame

```python
mp.solutions.face_mesh.FaceMesh(
    static_image_mode=False,
    max_num_faces=1,
    refine_landmarks=True,            # gives 478 landmarks (with iris)
    min_detection_confidence=0.5,
    min_tracking_confidence=0.5,
)
```

For each kept frame: BGR → RGB, run `face_mesh.process(rgb)`. Detected → flatten 478 landmarks as `[x0, y0, ..., x477, y477]` (normalized 0–1). Not detected → emit `[0.0] * 956`.

Output shape: `(N_kept_frames, 956)`.

### Step 4 — LBP-TOP features per ROI (90-d)

Three ROIs in **fixed order**: `mouth`, `left_eye`, `right_eye`.

| ROI | MediaPipe landmark indices |
|---|---|
| `mouth` | `[61, 291, 13, 14, 78, 308]` |
| `left_eye` | `[33, 133, 159, 145]` |
| `right_eye` | `[362, 263, 386, 374]` |

Per ROI, per kept frame: skip zero-row landmarks; build bounding box from listed landmarks (multiply normalized × frame dimensions); pad with 10 px margin; clamp to bounds; crop; grayscale; resize to 64×64. Stack all valid frames into `T × 64 × 64` cube.

LBP-TOP on the cube (locked):
- `P = 8`, `R = 1`, method `"uniform"` → 10 bins
- XY plane: one histogram per frame
- XT plane: one histogram per even-indexed row (32 planes for H=64)
- YT plane: one histogram per even-indexed column (32 planes for W=64)
- Average histograms within each plane group → 3 × 10 = 30 values per ROI

Concatenate **in fixed ROI order**: `[mouth (30), left_eye (30), right_eye (30)] → 90-d`.

⚠️ **Failure preserved from original**: if any ROI yields zero valid frames it's silently dropped, producing a `<90`-d vector. The inference wrapper raises `FeatureExtractionError` when this happens. Treat as "no prediction available", not a 500.

### Step 5 — Motion features from landmarks (2868-d)

On the full `(N_kept_frames, 956)` landmark array:

1. `motion = np.diff(landmarks, axis=0)` → `(N-1, 956)`
2. `motion_abs = np.abs(motion)`
3. Three statistics per coordinate, in **fixed order**: `mean`, `std`, `max` — each `(956,)`
4. Concatenate → `(2868,)`

### Step 6 — Concatenate to (2958,) feature vector

```
features = concat(lbp_features (90,), motion_features (2868,)) → (2958,)
```

Column order matches `metadata.json["feature_columns"]`: `f0..f89` (LBP) then `motion_0..motion_2867` (motion).

### Step 7 — 🆕 Calibration: subtract anchor

```python
delta = features - user_anchor   # both shape (2958,)
```

The anchor is the user's stored 2958-d vector from onboarding. **This is the new step in v2.** Skipping it produces silently wrong predictions.

### Step 8 — Scale, predict

```python
scaler = joblib.load("scaler.joblib")
model  = joblib.load("model.joblib")

x = scaler.transform(delta.reshape(1, -1))   # shape (1, 2958)
label = int(model.predict(x)[0])             # 0 or 1
proba = model.predict_proba(x)[0]            # [prob_class_0, prob_class_1]
```

`model.classes_` is `[0, 1]` — confirm at load time.

---

## 4. Anchor capture — full recipe for the backend

The notebook ships a function `compute_anchor_from_video(anchor_video_path)` that the backend can lift directly. It's identical to the inference path's feature extraction (Steps 1–6 above) — it does NOT subtract anything because anchors are themselves absolute features.

```python
# At onboarding:
anchor_vector = compute_anchor_from_video(uploaded_video_path)  # shape (2958,)
assert anchor_vector.shape == (2958,)
db.save_user_anchor(user_id, anchor_vector)

# At every inference:
features = features_from_5fps_frames(buffered_frames)
anchor   = db.get_user_anchor(user_id)
prediction = predict_from_delta_features(features - anchor)
```

### Storage layout

Per user, store: `user_id`, `anchor_vector` (2958 floats, ~12 KB if float32), `anchor_captured_at` (timestamp), `anchor_video_path` (optional, for debugging), `model_version` (so anchors invalidate when the model is bumped).

Format suggestion: `bytea` in Postgres, or JSON-encoded array. 12 KB per user × 10k users = ~120 MB. Manageable.

---

## 5. Performance metrics

### 5.1 Full-clip LOSO (60 s clips, calibrated — Section 7 of notebook) — **HEADLINE**

| Metric | Value |
|---|---|
| Mean per-fold accuracy | 0.733 (± 0.157) |
| **Pooled macro-F1** | **0.718** |
| Recall class 0 (not stressed) | 0.600 |
| Recall class 1 (stressed) | 0.830 |
| ROC-AUC | 0.712 |

**Like-for-like absolute features on the same 525 clips**: macro-F1 0.691.
**Calibration lift**: **+0.028 macro-F1**, with no-stress recall improving (0.523 → 0.600).

These are the headline numbers. See `metadata.json["loso_metrics_60s_calibrated"]` for the full payload including per-fold accuracies and the threshold sweep recommendation.

### 5.2 Threshold sweep — recommended operating point (60 s mode)

The notebook computes a per-threshold sweep across `[0.0, 1.0]` in 0.01 steps and auto-picks the **Youden's J** threshold (the point on the ROC curve that maximizes `sensitivity + specificity - 1`). This is the standard statistical choice when product-specific UX targets aren't yet calibrated against real usage.

| | Default (0.500) | Youden's J pick (0.530) |
|---|---|---|
| macro-F1 | 0.713 | 0.713 |
| precision class 1 | — | 0.747 |
| recall class 1 | 0.830 | 0.793 |
| recall class 0 | 0.600 | 0.627 |
| FPR | 0.400 | 0.373 |

**Note**: the Youden's J pick is essentially at the default. The `class_weight='balanced'` setting already placed the decision boundary near-optimal for this dataset; the threshold sweep didn't reveal a better operating point.

**Recommendation to the backend**:
- Start with **threshold = 0.50** (or 0.53; equivalent within noise)
- Expose it as a config knob, not a hard-coded constant
- Log false-positive rate in production (questionnaire-confirmed-as-false-alarm / total positive predictions)
- If recall on the stress class needs to be pushed higher (e.g., the questionnaire reveals too many misses), lower the threshold; if false-alarm fatigue becomes an issue, raise it
- Real-usage UX data, not test-set numbers, should drive future re-tuning

### 5.3 30-second window LOSO (calibrated — Section 10 of notebook) — informational

The dashboard was originally specified to send 30-second sliding windows. We evaluated this configuration; the result is the reason we're switching to 60s.

| Metric | 60s clips (headline) | 30s windows |
|---|---|---|
| Mean per-fold accuracy | 0.733 | 0.700 |
| Macro-F1 | 0.718 | 0.695 |
| **Recall class 1 (stress)** | **0.830** | **0.614** |
| Recall class 0 (not stressed) | 0.600 | 0.774 |
| ROC-AUC | 0.712 | 0.738 |
| Recommended threshold (Youden's J) | 0.530 | 0.520 |

**The 30s configuration drops stress recall from 0.83 to 0.61.** The model misses ~39% of real stress events vs ~17% in 60s mode. ROC-AUC is actually higher at 30s (0.738 vs 0.712), so the discriminative signal is present — the operating point is just bad for the product's priority.

**Why**: 30s windowing amplifies the long, low-arousal Breathing clips (one Breathing task → ~13 windows; one stress task → ~3 windows). Class 0 becomes the majority (1939 vs 1603) where it was the minority in 60s clips (220 vs 305). With `class_weight='balanced'` the decision boundary shifts, and the recall flips.

**Threshold tuning doesn't fix it cleanly**: pushing recall_1 back to 0.80 would require threshold ≈ 0.35–0.40, at which point recall_0 falls into the 0.50s and the false-alarm rate spikes.

The shipped configuration is **60 s buffering with 10 s stride**. The 30 s numbers are preserved in `metadata.json["loso_metrics_30s_window_calibrated"]` for reference but are not the recommended operating mode.

---

## 6. Inference latency

Measured at the end of Section 9 of the notebook on Kaggle CPU. Smoke test was an end-to-end run (anchor extraction + test clip inference) on subject `2ea4`'s Stroop clip with Relax as the anchor:

**Total end-to-end latency: 8.99 s** (includes both anchor extraction and inference)

Per-stage breakdown (estimated from the total):

- Anchor extraction (one-time at onboarding): ~4.0–4.5 s
- Per-inference cost (anchor already cached): ~4.5–5.0 s
  - Video decode + 5 FPS downsample: ~1 s
  - MediaPipe FaceMesh on ~150 kept frames: ~2–3 s
  - LBP-TOP across 3 ROIs: ~1–2 s
  - Motion + scaler + RF predict: < 200 ms

Production droplet (2 GB, no GPU) will be slower — probably 2–3× — unless MediaPipe gets GPU acceleration. **Plan for ~10–15 s per inference on the deployment hardware.** If real-time matters, this is a hard constraint to design around (async inference, frame-rate reduction, GPU MediaPipe).

---

## 7. Dependencies

Pinned versions captured in `metadata.json["dependencies"]` at notebook run time. Approximate:

```
python>=3.10,<3.13
numpy>=1.26
pandas>=2.0
scikit-learn>=1.4
scikit-image>=0.22
opencv-python>=4.8
mediapipe==0.10.13
joblib>=1.3
xgboost>=2.0     # research log only, not required for inference
```

⚠️ **`mediapipe==0.10.13` has wheels for Python 3.10/3.11/3.12 only — not 3.13.** Pin the DigitalOcean droplet's Python accordingly.

⚠️ **scikit-learn version matters for joblib loading.** Pin scikit-learn in the FastAPI image to whatever `metadata.json["dependencies"]["scikit-learn"]` reports.

---

## 8. Deployment red flags

1. **🔴 The scaler artifact is required.** Without it, predictions are silently wrong. Make scaler-load a startup check; assert `n_features_in_ == 2958` and refuse to start if missing.
2. **🔴 Per-user anchor is required.** Inference for a user without a stored anchor must fail clearly — not fall back to a global mean anchor. There is no global anchor; the model was trained on subject-specific deltas.
3. **🔴 60s buffering, not 30s.** The 30s configuration drops stress recall from 0.83 to 0.61. The buffering window is non-negotiable without retraining; do not let UX pressure shorten it.
4. **🔴 Model version invalidates anchors.** When you bump model version (retrain, re-feature), all stored user anchors must be flagged as invalidated. Users either re-onboard or the backend re-extracts from the stored onboarding video (if you retain it).
5. **🟡 The 60s anchor recommendation is firm.** A 30s anchor produces noisier motion-feature statistics. Don't let onboarding accept shorter recordings without revalidating against the LOSO metrics.
6. **🟡 LBP-TOP can silently produce <90-d output** if an ROI fails. The wrapper raises `FeatureExtractionError`; the backend should map this to a "no prediction available" response, not a 500.
7. **🟡 MediaPipe latency dominates.** ~4–5 s per 60 s clip on Kaggle CPU, expect 10–15 s on droplet. If real-time matters, this needs a plan (GPU MediaPipe, async inference).
8. **🟡 Zero-row contamination from undetected-face frames.** The training data has it, the model learned around it. Don't try to fix it in production preprocessing — would shift the feature distribution.
9. **🟡 MediaPipe version pin won't install on Python 3.13.** Pin the droplet to 3.10–3.12.
10. **🟢 `videos_5fps/` is a relative path in the notebook** (resolves to `/kaggle/working/videos_5fps` because Kaggle's CWD). The inference function does the downsample in-memory — no disk path involved.
11. **🟢 Subject-ID extraction in training relies on the `<id>_<task>.mp4` naming convention.** Doesn't affect inference, but be aware if anyone reuses the training code on a different dataset.
12. **🟢 Class weighting is `balanced` and the model leans toward catching stress.** Intentional — the constitution requires erring toward "noticing," with the confirmatory questionnaire absorbing false positives. Don't retune class weighting without re-running LOSO.
13. **🟢 Random-split notebooks exist in the experiments folder.** Per CC's Exp report, `Fusion Trials/*_random.*` notebooks use non-grouped splits and produce invalid numbers. **Delete them or rename with a clear `LEAKED_DO_NOT_USE_` prefix** before any teammate uses them.

---

## 9. Reproducibility

To re-train from scratch:

1. Kaggle notebook with StressID at `/kaggle/input/stressid-dataset/`.
2. Run all cells of `stress-id-video-lbp-top_motion_features__refactored_v2.ipynb` in order.
3. Artifacts appear in `/kaggle/working/artifacts/`.

The pipeline is deterministic given `random_state=42`. Frame iteration order from `os.listdir()` isn't deterministic across filesystems but LOSO grouping is by `subject_id` so this only affects per-fold print order, not metrics.

Run-to-run macro-F1 variation is within ±0.005 — observed when comparing this run's 0.718 to CC's Exp 1 report of 0.723. Both are valid; the methodology is consistent.

If you retrain, copy the new artifacts + `metadata.json` to the FastAPI image, **bump `model_version`**, and trigger user anchor invalidation.
