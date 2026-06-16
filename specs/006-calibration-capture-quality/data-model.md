# Phase 1 Data Model: Calibration Capture Quality

There is **no database entity and no schema change** in this feature (FR-015). The
"data model" here is the small set of in-memory quantities the gate computes, the
two tunable constants, the additive error/reason shapes, and the committed test
fixtures.

## Computed quantities (transient, server-side, never persisted, never sent to the client)

| Quantity | Type | Definition | Notes |
|---|---|---|---|
| `kept` | `int` | `landmarks.shape[0]` | The kept-frame count = rows of `DecodedClip.landmarks` (after the 5fps + %2 downsample). The coverage denominator (FR-006). Always ≥1 at the gate — `extract_landmarks` already raises on zero kept frames. |
| `usable` | `int` | `np.count_nonzero(np.any(landmarks, axis=1))` | Count of **non-zero** landmark rows = frames with a detected face (FR-004). Same predicate `lbp_top_features` uses to skip no-face frames. |
| `fraction` | `float` | `usable / kept` (0.0 if `kept == 0`) | Coverage fraction (FR-006). |

**Privacy (Principle I / FR-016):** all three are **server-logs only**. None is
returned to the client; the 422 carries a categorical reason, not numbers.

## Tunable constants (`packages/ml-video/src/ml_video/coverage.py`)

| Constant | Type | Value | Set by |
|---|---|---|---|
| `MIN_USABLE_FRAMES` | `int` | **[CALIBRATION-PENDING]** | DECISION-32 procedure, during `/speckit-implement` (absolute floor — FR-005; secondary backstop). |
| `MIN_COVERAGE_FRACTION` | `float` | **[CALIBRATION-PENDING]** | DECISION-32 procedure, during `/speckit-implement` (coverage fraction — FR-006; primary lever). |

**Gate rule (FR-007):** accept iff `usable >= MIN_USABLE_FRAMES` **and** `fraction >=
MIN_COVERAGE_FRACTION`; reject (raise) if **either** fails. Calibrated so the
**good-realistic** clip clears both with margin (the binding upper bound).

## Error / reason shapes (additive)

### `FeatureExtractionError` (`packages/ml-video/src/ml_video/errors.py`) — MODIFIED, backward-compatible

| Member | Type | Default | Notes |
|---|---|---|---|
| message (positional) | `str` | — | **Generic, count-free** (`"insufficient usable face coverage"`). The numeric detail (`usable`/`kept`/`fraction`) goes to a **separate `logger` line only**, never the message — so even `str(exc)` cannot leak counts. |
| `code` (keyword-only) | `str \| None` | `None` | NEW. The gate passes `"insufficient_face_frames"`. Existing raises omit it → `None` (unchanged behaviour). |

### `POST /anchor` 422 body — SHAPE UNCHANGED

```json
{ "error": "extraction_failed", "reason": "<string>" }
```

`reason = getattr(exc, "code", None) or str(exc)`:
- gate rejection → `reason == "insufficient_face_frames"` (categorical; no numbers);
- every existing extraction failure → `reason == str(exc)` exactly as today.

No new field, endpoint, or status (FR-009/010).

## Frontend shapes (additive)

### `FailureCause` (`apps/web/components/anchor/failure-state.tsx`) — MODIFIED

```
"low-light" | "out-of-frame" | "our-side" | "insufficient-face"   // ← new member
```

New `CAUSE` entry (existing three unchanged — FR-013):

| Cause | Icon (Lucide) | Line |
|---|---|---|
| `insufficient-face` | `ScanFace` / `EyeOff` (final pick at implement) | "We couldn't see your face for enough of that recording — let's try again." |

### Cause selection precedence (`anchor-recorder.tsx::submitClip`) — MODIFIED

```
on 422 (extraction_failed):
  cause = (result.reason === "insufficient_face_frames")
        ? "insufficient-face"                       // server reason is authoritative
        : dominantCause(telemetryRef.current)       // UNCHANGED existing path
```

`RecorderState.errorReason` (already present in the 005 reducer) continues to carry
`result.reason`; it is now also read by the precedence branch above. No reducer shape
change.

## Test fixtures (`packages/ml-video/tests/fixtures/`) — NEW, committed

| Fixture | Type | Provenance | Use |
|---|---|---|---|
| `thin.npy` | `float64 (N_kept, 956)` | thin clip via `extract_landmarks` in the pinned env | reject-below assertion |
| `good_ideal.npy` | `float64 (N_kept, 956)` | good-ideal clip, same | accept-above assertion |
| `good_realistic.npy` | `float64 (N_kept, 956)` | good-realistic clip, same | accept-above (binding upper bound) + gate-level no-regression (detected-throughout) |
| `README.md` | doc | — | records clip provenance, the pinned env, and that raw clips are intentionally **not** committed |

Fixtures are **derived landmark geometry** (no frames/images), extracted **once** by
the dev-only `extract_coverage_fixtures.py`; CI never runs mediapipe (Principle VII
determinism, mirrors 005 DECISION-18).

## Unchanged (FR-003 / FR-015)

No migration; the `public.profiles` anchor columns, grants, `has_anchor`, the 60s
duration, the extraction pipeline shape, the anchor storage shape, the live-inference
path, and role scoping are all untouched. Existing stored anchors are not
re-evaluated.
