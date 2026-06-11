# Contract: Explicit no-touch boundary (006)

Makes the "do not change this" surface explicit for review and `/speckit-tasks`, so
no task touches it. 006 is additive; the items below are **unchanged**.

## Database / Supabase — UNCHANGED (FR-015)
- **No migration.** The `public.profiles` anchor columns (`anchor_vector`,
  `anchor_captured_at`, `anchor_model_version`), the DECISION-12 SELECT
  column-privacy, the owner UPDATE whitelist, and `has_anchor(auth.uid())` are
  untouched.
- **No retroactive invalidation.** Existing stored anchors are not re-evaluated or
  re-written. The gate applies to **new captures only**. (Dev-only env; no production
  anchors.)

## ML pipeline (`packages/ml-video/`) — UNCHANGED except the additive gate
- `extract_landmarks`, `DecodedClip`, `lbp_top_features`, `motion_features`, the
  locked pipeline parameters (`models/metadata.json`), the 60-second baseline
  duration, the `(2958,)` anchor shape, the model artifacts, and the loader contract
  are **unchanged**.
- The two existing degenerate floors (≥1 usable frame per ROI for LBP-TOP; ≥2 kept
  frames for motion) are **unchanged** and remain as a deeper backstop after the gate.
- The **only** additions: `coverage.py` (the gate), the `assert_usable_face_coverage`
  call in `compute_anchor`, and the optional `code` attribute on
  `FeatureExtractionError`.

## FastAPI (`apps/api/`) — UNCHANGED except the 1-line reason mapping
- `POST /anchor`: same multipart contract, same JWKS/ES256 auth (env-only secret, no
  DB credentials), same 422 status + `{error, reason}` body shape, same unconditional
  raw-byte deletion in the `finally` (Principle I).
- `GET /healthz`: unchanged.
- The **only** change: the 422 `reason` value is `getattr(exc, "code", None) or
  str(exc)` (so the gate's categorical code surfaces); behaviour for every existing
  error is unchanged.

## Frontend (`apps/web/`) — UNCHANGED except the additive chip
- The 005 capture flow, the reducer states, `dominantCause`/`cause-telemetry`, the
  failure screen layout, the success state, the banner, the camera-access states,
  recalibrate, and every existing `CAUSE` entry are **unchanged**.
- The **only** changes: one new `FailureCause` value + one `CAUSE` entry in
  `failure-state.tsx`, and a one-branch server-reason precedence in
  `anchor-recorder.tsx::submitClip`. No layout/responsive/AA change — the new chip
  inherits the existing failure screen's treatment (Principle VI satisfied by reuse).

## Out of scope (later features)
- The **live-inference / runtime anchor read path** (FR-003) — untouched.
- **Image-quality grading** of present-but-detectable frames — separate future item.
- Role scoping (employee-only capture) — unchanged.
