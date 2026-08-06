# Serenify — Models Registry

This file lists every pre-trained model artifact loaded in production. Per
Constitution Principle II, models without an entry here MUST NOT be loaded.
Entries are append-only; reversals are appended as new entries that reference
the original.

---

## `serenify-video-lbptop-motion-rf-calibrated@2.0.0`

**Artifact location**: `packages/ml-video/models/`
**Files**: `model.joblib`, `scaler.joblib`, `metadata.json`
**Task**: binary stress classification (StressID `binary-stress` label)
**Modality**: video only (no audio, no physio)

### Training

- Date: 2026-05-26
- Dataset: StressID, 53 subjects, 525 calibrated task clips (578 minus 53
  anchors). Academic license — see Constitution Principle X.
- Source notebook: `stress-id-video-lbp-top_motion_features__refactored_v2.ipynb`
- Capture conditions (recorded 2026-08-05 so they are never re-derived; source:
  the StressID paper): video was recorded on a **Logitech QuickCam Pro 9000 at
  1280×720, 15 fps**, landscape. This is the operating point production capture
  targets (`apps/web/lib/capture/constraints.ts` — `ideal` 1280×720@15 on both
  the calibration and monitoring recorders); the pipeline has no full-frame
  resize, so capture resolution reaches the 64×64 ROI resize directly.

### Evaluation

- Method: subject-disjoint LeaveOneSubjectOut (LOSO), 53 subjects
- Macro-F1 (pooled): 0.718
- Per-class recall: class 0 (not stressed) 0.600, class 1 (stressed) 0.830
- ROC-AUC: 0.712
- Confusion matrix: see
  [`docs/models/serenify-video-lbptop-motion-rf-calibrated-v2.0.0-results.png`](models/serenify-video-lbptop-motion-rf-calibrated-v2.0.0-results.png).
  The figure has three panels (left to right: confusion matrix, ROC curve,
  score distribution). The **leftmost panel** is the confusion matrix; the
  **middle** panel is the ROC curve; the **right** panel is the score
  distribution.

### Deployment

- 60-second inference windows with 10-second stride (Constitution Principle II
  as amended in 1.2.0).
- Per-user anchor calibration required at runtime: every prediction is a delta
  from the user's stored 2958-dimensional anchor vector. There is no global
  fallback anchor — inference for a user without a stored anchor MUST fail
  clearly.
- Full integration contract: [`docs/MODEL_HANDOFF.md`](MODEL_HANDOFF.md).

**Status**: active.
