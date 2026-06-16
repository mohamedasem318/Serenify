# Implementation Plan: Calibration Capture Quality

**Branch**: `006-calibration-capture-quality` | **Date**: 2026-06-11 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/006-calibration-capture-quality/spec.md`

## Summary

A backend correctness fix. During 005 smoke testing a 60-second calibration in
which the face was in frame for only ~2 seconds was silently accepted as a
successful baseline ("Your baseline is set"); a baseline that thin poisons every
later delta-from-baseline reading (Constitution Principle II), and nothing
downstream can tell it from a good one. This feature adds a **server-side,
authoritative usable-face-coverage gate** to the anchor/baseline capture path in
`packages/ml-video/` that rejects a recording without enough usable face frames,
through the **existing** `FeatureExtractionError → HTTP 422` channel, so the user
lands on the 005 failure screen with a calm, specific "we couldn't see your face
for enough of that recording" message instead of a false success.

The spec settled the gate **shape** (usable = non-zero landmark row; reject if it
fails **either** an absolute usable-frame floor **or** a coverage fraction =
usable ÷ kept; accept only if it clears **both**) and the scope boundaries. This
plan resolves the three decisions the spec deferred — by reading the real code:

1. **Gate placement** (Open Decision 3): a pure `usable_face_coverage` /
   `assert_usable_face_coverage` helper in a new `packages/ml-video/src/ml_video/
   coverage.py`, called from `compute_anchor` **immediately after**
   `extract_landmarks` and **before** `lbp_top_features` / `motion_features`. It
   is **additive and strictly stricter** — it runs ahead of the existing
   degenerate floors and never loosens them. 📌 DECISION-30.
2. **Messaging mechanism** (FR-012): **no existing 005 chip covers it**, so add a
   new reason **value** `insufficient_face_frames` carried inside the existing 422
   `reason` field (via a new optional `FeatureExtractionError.code`), mapped on the
   client to a new `insufficient-face` failure chip. The server reason takes
   precedence over the client `dominantCause` on a 422; every existing chip and its
   selection are untouched. 📌 DECISION-31.
3. **Calibration method** (not numbers): extract landmark arrays from the three
   real fixture clips (thin / good-ideal / good-realistic) **once**, in the pinned
   ml-video env (Python 3.12, `mediapipe==0.10.13`), count non-zero rows + coverage,
   and set the two thresholds so the thin clip is rejected and **both** good clips —
   especially the binding good-realistic one — are accepted. The numbers are
   produced during `/speckit-implement`; the plan fixes only the procedure. The
   **coverage fraction is the primary lever** for the canonical full-length /
   face-absent 2s bug; the **absolute floor is the secondary backstop** for
   too-short clips. 📌 DECISION-32.

**Part B (glasses)** is investigation-only and produces no code; it becomes a
guidance decision (calibrate with glasses, avoid glare, don't ban) plus a thesis
limitation note. 📌 DECISION-33.

The permanent architectural choices (📌 DECISION-30 … 📌 DECISION-33) are
enumerated for one-shot review and become `docs/DECISIONS.md` entries 30–33 during
`/speckit-implement`, continuing from 005's DECISION-28.

## Technical Context

**Language/Version**: Python **3.12** for the gate (`packages/ml-video/`,
`requires-python >=3.10,<3.13` — the `mediapipe==0.10.13` ceiling, DECISION-1) and
the FastAPI router (`apps/api/`); TypeScript 5.x strict / React 19 for the minimal,
additive frontend chip change (`apps/web/`).

**Primary Dependencies**: **No new dependency anywhere.** The gate uses `numpy`
(already a pinned ml-video dep) over the existing `DecodedClip.landmarks` array.
The frontend reuses the existing 005 `FailureState` / `cause-telemetry` / reducer
plumbing. `mediapipe==0.10.13` is used **only** in the one-time, dev-only fixture
extraction — never in CI.

**Storage**: **No schema change, no migration.** The gate decides from in-memory
landmark rows and persists nothing; the only persistence remains the existing
on-success anchor write. Existing stored anchors are **not** re-evaluated (FR-015).

**Testing**: `pytest` (ml-video) for the gate at its real boundary using **committed
landmark-array fixtures** (no mediapipe, no video decode in CI — deterministic);
Vitest + RTL (apps/web) for the additive chip mapping and the no-regression
assertion on existing chip selection. Honest seams only — the gate's own logic is
never mocked green (Constitution Principle VII).

**Target Platform**: FastAPI on a DigitalOcean Droplet (the gate runs inside the
backend inference layer); the chip renders on the existing 005 failure screen on
Vercel/Next 16. Locally: the ml-video `uv` env + the FastAPI service at
`http://127.0.0.1:8000`.

**Project Type**: Backend correctness feature in the video modality package, plus a
1-line additive reason-surfacing in the API router and a minimal additive frontend
chip. (Unlike 005, this feature **does** touch `apps/api/` and `packages/ml-video/`
— but only additively, with no new endpoint/status/response-shape.)

**Performance Goals / Constraints**:

- The gate is **O(N_kept × 956)** over a `(N_kept, 956)` float64 array
  (N_kept ≈ a few hundred for a 60s clip) — a single vectorised `np.any(...,
  axis=1)` reduction; negligible next to FaceMesh extraction. It runs **once** per
  capture, before the heavier LBP-TOP / motion work, so it also **short-circuits**
  thin clips earlier than today.
- **Privacy constraint (load-bearing)**: the gate's numeric outputs (usable count,
  kept count, coverage fraction) are **server-side / logs only** and MUST NOT reach
  the client — the 422 carries a **categorical** reason (`insufficient_face_frames`)
  only (Principle I / FR-016).
- The 60-second duration, the extraction pipeline shape, the anchor storage shape,
  the live-inference path, and role scoping are **unchanged** (FR-003).

**Scale/Scope**: 1 new ml-video module (`coverage.py`) + a call site in
`anchor.py`; an optional `code` attribute on `FeatureExtractionError` (errors.py) +
a 1-line `reason` mapping in `apps/api/app/routers/anchor.py`; one new `FailureCause`
value + one chip entry in `apps/web/components/anchor/failure-state.tsx` + a
one-branch precedence in `anchor-recorder.tsx::submitClip`; committed landmark
fixtures + one ml-video gate test + one frontend mapping/no-regression test. **Zero**
migration, zero new dependency, zero new endpoint/status.

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

This feature engages Principles **I, II, III, V, VII, VIII**. Principles IV (LLM),
VI (this adds one chip to an already-responsive/AA failure screen — no new layout),
IX (no secret), X (fixtures are the developers' own clips, no StressID media) are
either not engaged or trivially satisfied. The load-bearing items are **I** (no raw
signal leaves inference; no counts to the client) and **VII** (honest boundary test).

| Principle | Status | How this plan honours it |
|-----------|--------|--------------------------|
| I. Privacy by Architecture (NON-NEG) | ✅ | The gate runs **inside the backend inference layer**, deciding from the **already-extracted** `(N_kept, 956)` landmark rows — no raw frame is read, transmitted, persisted, or surfaced; the existing raw-byte deletion in the `/anchor` `finally` is unchanged. The 422 returns a **categorical** reason (`insufficient_face_frames`) **only**; the usable count / kept count / coverage fraction are **server-logs only** and never returned to the client (FR-016). The committed test fixtures are **derived landmark geometry** (no image, no frame) from the developers' own calibration clips — not raw video. |
| II. Subject-Disjoint ML Evaluation / calibration load-bearing (NON-NEG) | ✅ | This **is** the principle in action: a too-thin baseline poisons every per-user delta (all predictions are deltas from the baseline). The gate protects calibration integrity at the only point it is detectable. No model, split, normalization, or the 60-second window changes. |
| III. Modality Isolation | ✅ | The gate is **authoritative inside `packages/ml-video/`** (FR-001) — modality logic stays in the package. The client framing detector remains **advisory UI only** and can be unavailable (FR-011/FR-002). The `apps/api` change is a **1-line mapping** of the modality's existing error to the existing 422 — the API layer already owns that mapping; it adds no modality logic. |
| V. Calm-First Design Language | ✅ | The new chip copy is calm, specific, non-blaming, Principle-V voice — "We couldn't see your face for enough of that recording — let's try again." It renders on the existing **foggy** 005 failure screen (never amber/crimson), no exclamation marks, no "detected"/clinical/alarmist words, and does **not** moralize or instruct ("do better"). |
| VII. Mandatory Testing Per PR | ✅ | **Honest test at the real boundary**: committed real landmark arrays (thin / good-ideal / good-realistic) fed to the **real** `assert_usable_face_coverage` and the **real** `compute_anchor` wiring (extract monkeypatched to return the fixture rows) — asserting reject-below / accept-above with the gate's own logic **never mocked green**. No-false-reject is asserted on the **good-realistic** binding fixture; no-regression is asserted on existing chip selection. Fixtures are extracted once in the pinned env so CI stays mediapipe-free + deterministic (mirrors the 005 DECISION-18 fixture discipline). |
| VIII. Spec-Driven Workflow | ✅ | This is the plan artifact; spec → plan → tasks → implement. Decisions logged in `docs/DECISIONS.md` (30–33), progress in `docs/PROGRESS.md`, the feature-ordering drift (constitution's provisional `006-stress-inference-service` → actual `006-calibration-capture-quality`) recorded in `docs/CHANGELOG.md` during implement (Principle VIII permits provisional reordering when recorded). |

**Privacy Review (Quality Gate 6).** This feature touches the signal-capture path,
so an explicit Principle-I note is required. (a) The gate consumes only landmark
rows that the existing pipeline already produced inside the inference layer; it
reads no pixels. (b) It adds **nothing** to any transport: the 422 body shape is
unchanged and its `reason` is a **categorical token**, never the numeric coverage —
those numbers exist only in server logs for calibration/debug. (c) The raw-byte
deletion in the `/anchor` `finally` is unchanged; no recording is retained on accept
or reject. (d) The committed fixtures are derived landmark arrays (no frames) from
the developers' own clips, consistent with using StressID **feature vectors** (not
media) as test fixtures under Principle VII; no consent-withheld subject media is
involved (Principle X). **Gate result: PASS.**

**Gate result**: PASS. No waiver required; no violations.

## Plan-Level Decisions (resolved here, not deferred)

Long-form treatment of each — including the cited code that justified it — is in
[research.md](./research.md); the contracts are in
[contracts/gate.md](./contracts/gate.md),
[contracts/messaging.md](./contracts/messaging.md), and
[contracts/unchanged.md](./contracts/unchanged.md).

### 📌 DECISION-30 — Gate placement: a pure `coverage.py` helper called by `compute_anchor`, before the existing floors

**Where it sits.** `compute_anchor` (`anchor.py`) currently does:
`clip = extract_landmarks(video_path)` → `lbp_top_features(clip.frames,
clip.landmarks)` + `motion_features(clip.landmarks)`. The gate is inserted as the
line **immediately after `extract_landmarks` and before the feature calls**:

```python
clip = extract_landmarks(video_path)
assert_usable_face_coverage(clip.landmarks)   # NEW — additive, stricter, first
features = np.concatenate([lbp_top_features(...), motion_features(...)])
```

**The helper** lives in a new `packages/ml-video/src/ml_video/coverage.py` (modality
logic stays in the package, Principle III) and is **pure** so the honest test can
call it directly with committed arrays — no video, no mediapipe:

- `usable_face_coverage(landmarks) -> (usable:int, kept:int, fraction:float)` where
  `kept = landmarks.shape[0]` and `usable = int(np.count_nonzero(np.any(landmarks,
  axis=1)))`. The `np.any(row)` per-row predicate is **the same one
  `features.py::lbp_top_features` already uses** to skip no-detection frames
  (`if not np.any(row): continue`) and matches `pipeline._landmarks_from_result`
  emitting an all-zero row for no-face — so "usable = non-zero row" (FR-004) reuses
  the existing contract, it does not invent a new detector.
- `assert_usable_face_coverage(landmarks)` raises
  `FeatureExtractionError(..., code="insufficient_face_frames")` iff
  `usable < MIN_USABLE_FRAMES` **or** `fraction < MIN_COVERAGE_FRACTION` (reject if
  **either** fails; accept only if **both** clear — FR-005/006/007). It logs
  `usable/kept/fraction` server-side; the wire reason stays categorical.

**How it composes with the existing degenerate floors (additive, never loosening).**
The two existing floors stay exactly as they are and run **after** the gate:

- `lbp_top_features` raises if any ROI yields zero usable frames (needs ≥1 non-zero
  frame per ROI).
- `motion_features` raises if `landmarks.shape[0] < 2` (≥2 kept frames, zero-rows
  included).

Because the gate runs **first** and only **adds** a rejection condition, it can
never accept anything the floors would reject (control still reaches the floors when
the gate passes) and it newly rejects the captures that previously slipped through
the floors — exactly the ~2s-of-face clip, which clears "≥1 usable frame per ROI"
and "≥2 kept frames" but has far too little coverage. The thresholds are tuned
(DECISION-32) so genuine captures clear the gate and the floors remain a deeper
backstop emitting their own existing reasons.

### 📌 DECISION-31 — Messaging: new `insufficient_face_frames` reason value in the existing 422; new `insufficient-face` chip; existing chips untouched

**No existing 005 chip covers "face not visible for enough of the recording."**
Reading the real client logic:

- `apps/web/components/anchor/anchor-recorder.tsx` line 302 sets the chip on a 422
  via `setFailureCause(dominantCause(telemetryRef.current))` — the cause is **purely
  client-telemetry-derived**; the server `reason` is threaded into the reducer
  (`errorReason`) but **not consumed for chip selection** today.
- `apps/web/lib/face-detect/cause-telemetry.ts::dominantCause` returns **`our-side`**
  whenever `!detectorAvailable || totalFrames === 0` — i.e. exactly the FR-011
  detector-unavailable case the server gate must explain. So in the canonical
  2s-bug-with-no-detector scenario the user would be told *"this one was on our side
  — give it a moment and try again"* — **false and misleading**.
- The nearest existing chip, `out-of-frame` ("Staying roughly centred and still
  helps"), is (a) client-derived (same defect), and (b) framed as a **centring**
  nudge, not the coverage/absence message the spec mandates.

Since the authoritative signal is **server-side** and must produce the correct
message even when the client said `our-side`, and since no existing chip carries the
required copy, we **add a new reason** per the spec's rule ("add a new reason only if
none does"):

- **Backend, additive, same 422 shape.** `FeatureExtractionError` gains an optional
  keyword `code: str | None = None` (backward-compatible; existing raises unchanged).
  The gate raises it with `code="insufficient_face_frames"`. The router
  (`apps/api/app/routers/anchor.py`) maps the existing 422 `reason` to
  `getattr(exc, "code", None) or str(exc)` — **same endpoint, same status, same
  `{error, reason}` body** (FR-009/010): for the gate, `reason ==
  "insufficient_face_frames"`; for every existing error, `reason == str(exc)`
  exactly as today. No counts cross the wire (Principle I / FR-016).
- **Frontend, minimal and additive.** In `submitClip`, on `extraction_failed`,
  the **server reason takes precedence**: `result.reason ===
  "insufficient_face_frames" ? "insufficient-face" : dominantCause(telemetry)`. A
  new `FailureCause` value `"insufficient-face"` and one `CAUSE` entry are added to
  `failure-state.tsx`:
  `{ Icon: ScanFace (or EyeOff), line: "We couldn't see your face for enough of that recording — let's try again." }`.
  Every existing `CAUSE` entry and the entire `dominantCause` path are **unchanged**
  (FR-013/014): all non-`insufficient_face_frames` 422s still select via
  `dominantCause` exactly as before.

This also **completes** a wiring 005 documented but never built: the 005
`backend-unchanged` contract and DECISION-24 describe the 422 `reason` as a
"secondary cause-chip signal," and the reducer already carries `errorReason`, but no
code path consumed it. 006 is the first to consume it — additively, for this one
authoritative case. (Flagged in research.md as a spec-assumption clarification, not
a contradiction.)

### 📌 DECISION-32 — Threshold calibration method (numbers produced at implement, not guessed here)

The two constants live in `coverage.py` as `MIN_USABLE_FRAMES: int` and
`MIN_COVERAGE_FRACTION: float`, set by this procedure during `/speckit-implement` and
later **recalibrated on real browser webm** through the fixed VFR decode (DECISION-29)
to the final values **`MIN_COVERAGE_FRACTION = 0.65` / `MIN_USABLE_FRAMES = 50`**:

1. **Acquire the real clips** (developers' own calibration recordings, not StressID
   media), recorded as browser `.webm`: **thin** (~2–3 s of face in a full minute),
   **good-ideal** (face present the whole minute), **good-realistic** (a genuine calm
   minute with natural brief look-aways), and **half** (the boundary — ~30 s present,
   ~30 s absent).
2. **Run each clip through the REAL anchor pipeline** — `extract_landmarks` in the
   **pinned ml-video env** (`uv run` → Python 3.12, `mediapipe==0.10.13`); **not** a
   Python 3.9 conda env, whose different mediapipe build could shift landmark values
   and thus coverage. This yields each clip's `(N_kept, 956)` landmark array.
3. **Measure** `usable`, `kept`, `fraction` per clip via `usable_face_coverage`.
   Record all three rows.
4. **Set the thresholds** so:
   - **thin → rejected** (fails both conditions);
   - **half → rejected** — the **binding reject-side datapoint** for coverage:
     `MIN_COVERAGE_FRACTION` MUST sit clearly **above** the half-present clip's measured
     coverage (which rejects it by the coverage lever, not the floor);
   - **good-ideal → accepted**;
   - **good-realistic → accepted**: `MIN_COVERAGE_FRACTION` and `MIN_USABLE_FRAMES` sit
     clearly **below** the good clips' measured coverage / usable count (with margin).
   - **Primary lever**: the **coverage fraction** catches the canonical 2s bug
     (full-length, face-absent → very low coverage). The **absolute floor** is the
     **secondary backstop** for genuinely too-short clips (high coverage but few
     frames).
5. **Pin** the chosen numbers as the constants and **record** the per-clip
   measurements + chosen thresholds + the margin in research.md / a `docs/DECISIONS.md`
   note during implement (the numbers are an implement artifact, not a plan guess).
6. **Freeze the fixtures**: save each clip's extracted landmark array **once** as a
   committed `.npy` under `packages/ml-video/tests/fixtures/` so CI never runs
   mediapipe and the gate test is deterministic.

### 📌 DECISION-33 — Glasses (Part B): investigation-only guidance + thesis caveat (no code)

Recorded as a decision, not a requirement. The completed investigation (24/53
subjects wore glasses; glasses-stratified LOSO showed no gap — macro-F1 0.720 vs
0.717, stress-class recall 0.844 vs 0.818) yields the product guidance **"calibrate
the way you normally sit, glasses included; avoid glare; do not ban glasses."** The
**thesis limitation** must accompany it wherever reported: it is a **between-subject**
comparison (not proof of zero glasses effect), it cannot test the
calibrate-with / infer-without mismatch, and the group sizes are modest. No code,
no UI, no test — a `docs/DECISIONS.md` entry + a thesis note only.

## Project Structure

### Documentation (this feature)

```text
specs/006-calibration-capture-quality/
├── plan.md                 # this file
├── spec.md                 # committed
├── research.md             # Phase 0 — the three deferred decisions long-form + calibration method + spec-assumption flags + Part B
├── data-model.md           # Phase 1 — gate quantities, thresholds (CALIBRATION-PENDING), FeatureExtractionError.code, FailureCause delta, fixtures; NO DB change
├── contracts/
│   ├── gate.md             # the server-side gate: signatures, non-zero-row predicate, both conditions, placement, composition with the floors, categorical-only reason
│   ├── messaging.md        # 422 reason value insufficient_face_frames in the existing body; router mapping; frontend precedence + new chip; existing chips unchanged
│   └── unchanged.md        # explicit no-touch boundary: no migration, 60s duration, anchor storage shape, live-inference path, role scoping, existing anchors
├── quickstart.md           # run ml-video tests; (re)extract fixtures in the pinned env; drive a rejection; verify the chip mapping; manual smoke
├── checklists/requirements.md  # from /speckit-specify (all pass)
├── tasks.md                # /speckit-tasks (NOT yet)
└── smoke-tests.md          # /speckit-tasks (NOT yet)
```

### Source Code (repository — additions and modifications)

```text
packages/ml-video/
├── src/ml_video/
│   ├── coverage.py                 # NEW — usable_face_coverage()/assert_usable_face_coverage() + MIN_USABLE_FRAMES=50 / MIN_COVERAGE_FRACTION=0.65 (recalibrated on real webm) (📌 DECISION-30/32)
│   ├── anchor.py                   # MODIFIED — call assert_usable_face_coverage(clip.landmarks) after extract_landmarks, before features (📌 DECISION-30)
│   ├── errors.py                   # MODIFIED — FeatureExtractionError gains optional `code: str | None` (backward-compatible) (📌 DECISION-31)
│   └── __init__.py                 # MODIFIED — export the coverage helpers for the test boundary (optional)
└── tests/
    ├── fixtures/                   # NEW — committed landmark .npy arrays (thin / good-ideal / good-realistic / half, real webm) + provenance README (📌 DECISION-32)
    ├── fixtures/extract_coverage_fixtures.py  # NEW — DEV-ONLY one-time extractor (not collected by pytest); run via uv in the pinned env
    └── test_usable_face_coverage_gate.py      # NEW — reject-below / accept-above at the real boundary; no mock-green; compute_anchor wiring (📌 DECISION-30, FR-017/018)
apps/api/
└── app/routers/anchor.py           # MODIFIED — 1 line: reason = getattr(exc, "code", None) or str(exc) (same 422 shape) (📌 DECISION-31)
apps/web/
└── components/anchor/
    ├── failure-state.tsx           # MODIFIED — add FailureCause "insufficient-face" + one CAUSE entry (existing entries unchanged) (📌 DECISION-31)
    ├── anchor-recorder.tsx         # MODIFIED — submitClip: server reason precedence (insufficient_face_frames → new chip; else dominantCause unchanged) (📌 DECISION-31)
    └── *.test.tsx                  # MODIFIED/NEW — assert the new mapping + no-regression on existing chip selection (FR-018)
docs/
├── DECISIONS.md                    # APPENDED 30–33 during /speckit-implement
├── PROGRESS.md                     # APPENDED running entry
└── CHANGELOG.md                    # APPENDED — feature-ordering drift note (006 = calibration-capture-quality)
CLAUDE.md                           # MODIFIED — SPECKIT pointer → 006 plan (this commit)
```

**Structure Decision**: Backend-correctness feature centred in
`packages/ml-video/` (the authoritative gate), with a 1-line additive surfacing in
the `apps/api/` router and a minimal additive chip in `apps/web/`. No migration, no
new dependency, no new endpoint/status/response-shape. The raw-signal boundary holds:
the gate reads only already-extracted landmark rows and emits only a categorical
outcome.

## Branch Commit Ordering

Canonical ordering for `/speckit-tasks` to decompose; each step is a PR-sized unit
landing on `006-calibration-capture-quality`; tests pass before the next starts.

1. **Gate core (TDD)** — `coverage.py` (`usable_face_coverage` /
   `assert_usable_face_coverage` + the two `[CALIBRATION-PENDING]` constants) and
   `FeatureExtractionError.code`. Write `test_usable_face_coverage_gate.py` first
   against placeholder constants using **small hand-authored arrays** so the
   reject/accept logic is proven before real numbers exist. (📌 DECISION-30/31)
2. **Wire into `compute_anchor`** — call `assert_usable_face_coverage` after
   `extract_landmarks`; add a test that `compute_anchor` raises with code
   `insufficient_face_frames` when `extract_landmarks` is monkeypatched to return
   thin landmark rows (the real boundary, no mediapipe). (📌 DECISION-30)
3. **Fixtures + calibration** — run `extract_coverage_fixtures.py` once in the pinned
   env over the real clips (four after the real-webm recalibration — thin / good-ideal /
   good-realistic / half); commit the `.npy` arrays + provenance README; **set the real
   thresholds** so thin and half reject and both good clips accept; record the
   measurements. Re-point the gate test at the committed fixtures (reject-below /
   accept-above; no-false-reject on good-realistic; half rejected by the coverage lever).
   (📌 DECISION-32, FR-017/018)
4. **Router surfacing** — the 1-line `reason = exc.code or str(exc)` in
   `apps/api/app/routers/anchor.py`; a pytest asserting a gate-raised error surfaces
   `reason == "insufficient_face_frames"` and an existing error's reason is unchanged.
   (📌 DECISION-31)
5. **Frontend chip (additive)** — `failure-state.tsx` new `insufficient-face` cause +
   copy; `anchor-recorder.tsx` server-reason precedence; Vitest asserting (a) the new
   reason → new chip, (b) any other reason → `dominantCause` (unchanged), (c) existing
   `CAUSE` entries unchanged. (📌 DECISION-31, FR-013/018)
6. **Docs + smoke** — `docs/DECISIONS.md` 30–33, `docs/CHANGELOG.md` ordering note,
   the glasses guidance + thesis caveat; `smoke-tests.md` for the manual real-clip
   checks (thin → 422 → failure screen with the face-absence chip; full minute →
   success). Mohamed runs the smoke after `/speckit-implement`.

## Edits to prior features

- **Feature 005 (substrate)** — `failure-state.tsx` and `anchor-recorder.tsx` are
  **extended additively** (one new cause + a precedence branch); every existing 005
  surface, chip, and the `dominantCause` selection are preserved (FR-013/014). The
  005 reducer's already-present `errorReason` is now consumed for the one
  authoritative case (completing the 005-documented-but-unbuilt reason→chip wiring).
- **Feature 004 (anchor backend)** — `compute_anchor`, `errors.py`, and the `/anchor`
  router are **extended additively** (the gate call, the optional `code`, the
  1-line reason mapping); the raw-byte deletion, auth, 60s duration, storage shape,
  and the extraction pipeline are untouched.

## Test Strategy

(Full detail in [contracts/gate.md](./contracts/gate.md) and
[contracts/messaging.md](./contracts/messaging.md).)

- **ml-video gate test (the honest boundary, Principle VII / FR-017/018).** Real
  landmark arrays — `thin.npy` (reject), `good_ideal.npy` (accept),
  `good_realistic.npy` (accept, binding) — fed to the **real**
  `assert_usable_face_coverage`; asserts it **raises** on thin (code
  `insufficient_face_frames`) and **does not** on either good clip. A second test
  monkeypatches `pipeline._build_face_mesh` / `extract_landmarks` to return the thin
  rows and asserts **`compute_anchor`** raises with the code — proving the gate is
  wired at the real call site without mediapipe. The gate logic is **never mocked**;
  fixtures replace only the native extraction.
- **No-regression (gate level).** A detected-throughout array (good-ideal/realistic,
  all non-zero rows) is **not** rejected by the gate regardless of framing — the gate
  is blind to position, so an "off-centre but detected" capture passes.
- **No-regression (frontend, FR-013).** Vitest: a 422 with any reason **other** than
  `insufficient_face_frames` still maps to `dominantCause(telemetry)` (incl.
  detector-unavailable → `our-side`); the new reason maps to the new chip; the three
  existing `CAUSE` entries are unchanged.
- **Determinism / CI.** Fixtures are extracted once in the pinned env and committed;
  CI runs no mediapipe and no video decode for this gate (mirrors 005 DECISION-18).
- **Smoke (`smoke-tests.md`, Mohamed).** Record a real ~2s-of-face minute → expect
  422 → the failure screen with the face-absence chip (not "baseline set", not
  "our-side"); record a real full minute → expect success.

## DECISIONS.md entries this plan implies

Appended to `docs/DECISIONS.md` during `/speckit-implement` (date `2026-06-11+`,
feature 006) as **DECISION-30 through DECISION-33** — 005 ended at DECISION-28 and the
VFR-decode fix (📌 DECISION-29, PR #18) landed in between:

30. **Usable-face-coverage gate** — pure `coverage.py` helper called by
    `compute_anchor` after `extract_landmarks`, before the feature floors; usable =
    non-zero landmark row (the existing predicate); reject if usable <
    `MIN_USABLE_FRAMES` **or** fraction < `MIN_COVERAGE_FRACTION`; additive and
    strictly stricter, never loosening the existing floors. 📌 DECISION-30.
31. **Messaging via a new reason value** `insufficient_face_frames` carried in the
    existing 422 `reason` (optional `FeatureExtractionError.code`; router
    `reason = exc.code or str(exc)`); server reason takes precedence over client
    `dominantCause`; new `insufficient-face` chip; existing chips/selection unchanged;
    categorical-only on the wire (no counts → Principle I). 📌 DECISION-31.
32. **Threshold calibration method** — real clips run through the pinned-env pipeline
    (four after the real-webm recalibration on the fixed VFR decode — DECISION-29);
    coverage fraction primary, absolute floor backstop; numbers produced at implement,
    recalibrated to 0.65/50; landmark arrays committed as deterministic fixtures.
    📌 DECISION-32.
33. **Glasses (Part B)** — investigation-only guidance (calibrate with glasses, avoid
    glare, don't ban) + thesis between-subject limitation; no code. 📌 DECISION-33.

## Complexity Tracking

| Item | Why it is not a violation | Simpler alternative rejected because |
|---|---|---|
| 006 touches `apps/api/` + `apps/web/` (not just `packages/ml-video/`) | The **gate** and its authority live in `packages/ml-video/` (Principle III); the API touch is a **1-line** mapping of the modality's existing error into the existing 422, and the web touch is **one additive chip**. No modality logic leaves the package; no new endpoint/status/shape. | A package-only change can't deliver the **calm, specific** user message the spec mandates (FR-011), and reusing a client-derived chip would mis-report `our-side` in the FR-011 detector-unavailable case. |
| A new reason code rather than reusing an existing chip | The authoritative server signal must produce the correct message even when the client reported `our-side`; no existing chip carries the coverage/absence copy. Spec rule: add a new reason only if none covers it — none does. | Reusing `out-of-frame` would still require server-reason precedence (to override `our-side`) **and** would show centring copy, not the coverage message — more wiring for a worse message. |

No waivers required; both items are reviewed and consistent with the principles.

## Risks & Mitigations

| ID | Risk | Mitigation |
|----|------|------------|
| R-1 | **Thresholds set too high → false-reject normal users** (the over-reach the spec warns against). | The **good-realistic** clip (brief natural look-aways) is the **binding upper bound**: `MIN_COVERAGE_FRACTION` and `MIN_USABLE_FRAMES` are set clearly below its measured values with margin; no-false-reject is asserted against it in CI (DECISION-32, SC-002). |
| R-2 | **Coverage numbers shift with a different mediapipe build** (e.g. a Python 3.9 conda env), invalidating the calibration. | Fixtures + calibration are produced **only** in the pinned ml-video env (Python 3.12, `mediapipe==0.10.13`) via `uv run`; the env is named in DECISION-32 and the fixtures are committed so CI is build-independent. |
| R-3 | **Counts leak to the client** (privacy / Principle I). | The 422 `reason` is the **categorical** token only; usable/kept/fraction are **server-logs only**; the router maps the gate error via `exc.code`, never `str(exc)` (which contains the numbers), for this case (DECISION-31, FR-016). |
| R-4 | **Frontend regression** — the new branch changes existing chip selection. | The precedence branch only **adds** a case before `dominantCause`; a Vitest no-regression test asserts every non-`insufficient_face_frames` reason still selects via `dominantCause` and the existing `CAUSE` entries are byte-for-byte unchanged (FR-013/018). |
| R-5 | **Gate accidentally loosens an existing floor.** | The gate only **raises early**; it never gates the floors out — control reaches `lbp_top_features`/`motion_features` unchanged whenever the gate passes. A test confirms a clip that the floors would reject is still rejected (DECISION-30). |
| R-6 | **005-documented reason→chip wiring was never built** — assuming it exists could mislead implement. | Flagged explicitly in research.md: 006 is the **first** consumer of the 422 `reason` for chip selection; the reducer's `errorReason` already exists, so the change is additive, not a new channel (DECISION-31). |
