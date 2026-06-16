# Phase 0 Research: Calibration Capture Quality

This resolves the three decisions the spec deferred (FR-008 / FR-012 / Open
Decision 3) by reading the **actual** code, plus the Part B record and the
spec-assumption flags surfaced while reading. Format per decision: **Decision /
Rationale (with cited code) / Alternatives considered**.

---

## Decision 1 — Gate placement & composition with the existing floors (Open Decision 3)

**Decision.** Add a pure helper module `packages/ml-video/src/ml_video/coverage.py`
with `usable_face_coverage(landmarks)` and `assert_usable_face_coverage(landmarks)`,
and call the latter from `compute_anchor` (`anchor.py`) **immediately after
`extract_landmarks` and before `lbp_top_features` / `motion_features`**. The gate is
**additive and strictly stricter** — it runs ahead of the existing degenerate floors
and never loosens them.

**Rationale (cited code).**

- `pipeline.py::_landmarks_from_result` emits an **all-zero** `(956,)` row when no
  face is detected:
  ```python
  faces = getattr(result, "multi_face_landmarks", None)
  if not faces:
      return np.zeros(LANDMARK_DIM, dtype=np.float64)
  ```
  and `DecodedClip.landmarks` is the `(N_kept, 956)` stack of these rows. So
  "usable = non-zero row" (FR-004) is already the pipeline's no-face contract.
- `features.py::lbp_top_features` already uses exactly the **non-zero-row predicate**
  to skip no-detection frames:
  ```python
  if not np.any(row):  # zero-row landmark => no detection => skip frame
      continue
  ```
  The gate reuses this predicate (`np.any(landmarks, axis=1)`) — it counts the signal
  that already exists, it does not add a detector.
- `anchor.py::compute_anchor` is the single anchor entry point; placing the gate as
  its first post-extraction step makes it **authoritative inside the package**
  (Principle III / FR-001) and lets it **short-circuit** thin clips before the heavier
  LBP-TOP / motion work.
- The existing floors are **degenerate** and a ~2s-of-face clip clears them:
  `lbp_top_features` raises only if an ROI has **zero** usable frames (`≥1` non-zero
  frame per ROI suffices); `motion_features` raises only if `landmarks.shape[0] < 2`
  (`≥2` kept frames, **zero-rows counted**). Neither is a coverage check. The gate
  adds the missing coverage condition **before** them, so:
  - it never accepts what the floors reject (control still flows into the floors when
    the gate passes), and
  - it newly rejects coverage-thin captures that previously passed — the exact bug.

**The gate (contract in `contracts/gate.md`).**
```python
def usable_face_coverage(landmarks):
    kept = int(landmarks.shape[0])
    usable = int(np.count_nonzero(np.any(landmarks, axis=1)))
    fraction = (usable / kept) if kept else 0.0
    return usable, kept, fraction

def assert_usable_face_coverage(landmarks):
    usable, kept, fraction = usable_face_coverage(landmarks)
    if usable < MIN_USABLE_FRAMES or fraction < MIN_COVERAGE_FRACTION:
        logger.info("coverage reject: usable=%d kept=%d fraction=%.3f", usable, kept, fraction)
        raise FeatureExtractionError(
            "insufficient usable face coverage",   # GENERIC message — counts stay in the log only
            code="insufficient_face_frames",
        )
```
Accept only if it clears **both**; reject if it fails **either** (FR-005/006/007).
The numeric detail is **logged server-side only**; the wire reason is categorical
(Principle I / FR-016).

**Alternatives considered.**

- *Fold the check into `lbp_top_features` / `motion_features`.* Rejected: it would
  entangle the coverage gate with feature extraction, can't be unit-tested at a clean
  boundary, and risks changing the floors' behaviour (the spec forbids loosening them).
- *Gate in the API router (`apps/api`).* Rejected: it would put modality logic
  outside the package (violates Principle III) and the router has no access to the
  landmark rows.
- *Replace the existing floors with the gate.* Rejected: the floors guard real
  downstream invariants (per-ROI LBP validity, ≥2 frames for motion diffs); the gate
  is **additional**, not a substitute.

---

## Decision 2 — Messaging mechanism (FR-012): reuse a chip, or a new reason code?

**Decision.** **No existing 005 chip covers "face not visible for enough of the
recording," so add a new reason value** `insufficient_face_frames`, carried inside
the **existing** 422 `reason` field, mapped on the client to a **new
`insufficient-face` chip**. The server reason **takes precedence** over the client
`dominantCause` on a 422. Every existing chip and its selection are untouched.

**Rationale (cited code).**

- The chip is currently **client-telemetry-derived only**. In
  `anchor-recorder.tsx::submitClip`:
  ```js
  if (result.kind === "extraction_failed") {
    // 422 — the chip reflects what we actually measured this minute
    setFailureCause(dominantCause(telemetryRef.current));
    dispatch({ type: "EXTRACT_FAILED", reason: result.reason });
  }
  ```
  The server `result.reason` is threaded into the reducer (`errorReason`) but **not
  used to choose the chip**.
- `cause-telemetry.ts::dominantCause` returns **`our-side`** exactly in the
  detector-unavailable case the server gate must explain:
  ```js
  export function dominantCause(t) {
    if (!t.detectorAvailable || t.totalFrames === 0) return "our-side";
    ...
  }
  ```
  So for the canonical 2s bug **with the on-device detector unavailable (FR-011)**,
  the user would be told *"This one was on our side — give it a moment and try
  again."* — false, and the opposite of the spec's required message.
- The nearest existing chip, `out-of-frame` in `failure-state.tsx`:
  ```js
  "out-of-frame": { Icon: MoveDiagonal, line: "Staying roughly centred and still helps." },
  ```
  is (a) selected from client telemetry (same `our-side` defect when the detector is
  off), and (b) phrased as a **centring** nudge, not the coverage/absence message
  FR-011 mandates. Even though `dominantCause` folds no-face frames into
  `offTargetFrames` → `out-of-frame` when the detector **is** available, the client
  model ≠ the server's FaceMesh and the client heuristic (`CAUSE_MIN_RATIO = 0.35`)
  is **not** the authoritative gate — they can disagree.

Because the authoritative decision is **server-side** and must yield the correct
message even when the client said `our-side`, and because no existing chip carries
the required copy, the spec's rule ("add a new reason **only if none does**") resolves
to **add a new reason**.

**Mechanism (additive, same 422 shape — contract in `contracts/messaging.md`).**

- `errors.py`: `FeatureExtractionError(message, *, code: str | None = None)` —
  backward-compatible; existing raises (which pass only a message) keep `code = None`.
- The gate raises with `code="insufficient_face_frames"`.
- `apps/api/app/routers/anchor.py`: change the 422 body's `reason` from `str(exc)` to
  `getattr(exc, "code", None) or str(exc)` — **same endpoint, status, and
  `{error, reason}` shape** (FR-009/010). Gate → `reason == "insufficient_face_frames"`;
  every existing error → `reason == str(exc)` exactly as today; **no counts on the
  wire** (FR-016).
- `apps/web`: in `submitClip`, `const cause = result.reason === "insufficient_face_frames"
  ? "insufficient-face" : dominantCause(telemetryRef.current);`. Add `"insufficient-face"`
  to the `FailureCause` union and one `CAUSE` entry:
  `line: "We couldn't see your face for enough of that recording — let's try again."`
  All existing entries and the `dominantCause` fallback are unchanged (FR-013/014).

**Alternatives considered.**

- *Reuse `out-of-frame`.* Rejected: still needs server-reason precedence to override
  the wrong `our-side` default, and shows centring copy instead of the mandated
  coverage message — more wiring for a worse, less accurate message.
- *A new JSON field (`code`) on the 422 body.* Rejected: the spec constrains the new
  value to live **inside the existing `reason` field** (FR-009: no new API surface);
  the optional Python `code` attribute is internal and never serialized as a separate
  field — the wire shape stays `{error, reason}`.
- *A new endpoint/status.* Rejected outright by FR-009/010.

---

## Decision 3 — Threshold calibration method (FR-008; numbers NOT in the plan)

**Decision.** The two constants `MIN_USABLE_FRAMES` and `MIN_COVERAGE_FRACTION` live
in `coverage.py` and are set by running the real fixture clips through the real
pipeline in the pinned env. (Initially three mp4-handled clips → `0.40`; **recalibrated
to four real-webm clips through the fixed VFR decode → `0.65`** — see "Calibration
measurements" below and 📌 DECISION-29 / DECISION-32.)

**Procedure.**

1. Acquire the real clips (developers' own recordings, **not** StressID media), recorded
   as browser `.webm`: **thin** (~2–3 s of face in a full minute), **good-ideal** (face
   the whole minute), **good-realistic** (genuine calm minute with natural brief
   look-aways), and **half** (the boundary case — ~30 s present, ~30 s absent).
2. Run each through `extract_landmarks` in the **pinned ml-video env** — `uv run`,
   Python 3.12, `mediapipe==0.10.13` (the README/pyproject pin, DECISION-1) — **not**
   a Python 3.9 conda env, whose different mediapipe build would shift landmark values
   and thus coverage and invalidate the calibration.
3. Measure `usable`, `kept`, `fraction` per clip via `usable_face_coverage`.
4. Set the thresholds so **thin rejects** and **both good clips accept**, with the
   **good-realistic** clip as the **binding upper bound**: `MIN_COVERAGE_FRACTION`
   clearly below its measured coverage (with margin) and `MIN_USABLE_FRAMES` clearly
   below its usable count. **Primary lever**: the **coverage fraction** (catches the
   full-length / face-absent 2s bug); **secondary backstop**: the **absolute floor**
   (catches genuinely too-short clips).
5. Pin the numbers and record the per-clip measurements + chosen thresholds + margin
   in a `docs/DECISIONS.md` note (the numbers are an implement artifact, not a plan
   guess).
6. Save each clip's extracted landmark array **once** as a committed `.npy` under
   `packages/ml-video/tests/fixtures/` so CI never runs mediapipe.

**Rationale.** The spec forbids guessing the numbers and binds them to real clips;
the env pin is load-bearing because coverage is a function of which frames mediapipe
detects, which depends on the mediapipe build.

**Alternatives considered.**

- *Hard-code reasonable-looking numbers in the spec/plan.* Rejected by FR-008.
- *Derive thresholds analytically from frame counts.* Rejected: real detection
  coverage on the good-realistic clip (look-aways, lighting) is the only honest upper
  bound; it must be measured, not assumed.

---

## Calibration measurements — four real webm clips through the real (fixed-decode) pipeline

**Recalibrated on real browser webm.** The initial calibration measured three clips
handled as mp4 through the **pre-fix decode**, which mis-sampled variable-frame-rate
browser webm (📌 DECISION-29). After the VFR-timestamp decode landed, the measurement
was **redone on real `.webm` recordings through the fixed pipeline** — the path
production runs — and a deliberate **half-present** boundary clip was added to probe the
previously empty gap. The webm figures below **supersede** the mp4 ones (mp4: `thin
4/172/0.023`, `good-ideal 154/154/1.000`, `good-realistic 129/129/1.000`).

Extracted once in the pinned env (Python **3.12.13**, **mediapipe 0.10.13**, via
`uv run`) with `tests/fixtures/extract_coverage_fixtures.py`. Coverage = `usable / kept`,
`usable` = non-zero landmark rows. All four confirmed on the **VFR timestamp decode path**
(reported `fps=1000` is garbage; true ~28.7–30.1 fps).

| Clip | kept | usable | fraction | duration | target |
|------|-----:|-------:|---------:|---------:|--------|
| thin           | 150 |  11 | **0.073** | 59.97 s | reject |
| good-ideal     | 150 | 150 | **1.000** | 59.94 s | accept |
| good-realistic | 151 | 151 | **1.000** | 60.29 s | accept |
| half           | 150 |  77 | **0.513** | 59.97 s | reject (boundary) |

**Key finding — legitimate captures cluster at 1.000.** `good-realistic` came out at
**1.000** coverage: FaceMesh holds the face through natural seated look-aways
(glances/turns keep enough of the face visible to detect), so coverage only drops when
the face *truly leaves the frame*. The added **`half`** clip (~30 s present / ~30 s
absent) measured **0.513**, almost exactly the 0.5 that even-time frame sampling
predicts — confirming the gate fraction is a faithful proxy for *fraction-of-minute-
present*. `half` is the one intermediate datapoint between the egregious `thin` (0.073)
and the saturated good clips (1.000).

**Margin verdict: clean separation with a populated boundary.** thin coverage `0.073`
and the boundary `half` `0.513` both sit below any sane accept line; both good clips at
`1.000` sit well above. The coverage threshold can now be placed *between* `half` and
the good clips rather than guessed in an empty gap.

### Chosen thresholds (📌 DECISION-32)

Set in `coverage.py` after the recalibration:

- **`MIN_COVERAGE_FRACTION = 0.65`** (primary lever — the face-absent bug). `half` 0.513
  rejects with a **0.137 margin**; both good clips 1.000 clear it by 0.35.
  `0.65 ≈ "face present ≥ ~40 s of the 60 s"`.
- **`MIN_USABLE_FRAMES = 50`** (secondary backstop — too-short captures). `thin` 11 < 50;
  `half` 77 and the good clips ≥ 150 clear it — so the **coverage lever, not the floor,
  rejects `half`**.
- `thin` is rejected by **both** conditions; `half` by the coverage lever alone; both
  good clips clear **both**.

**The anchor is the reference every later delta is measured against** (Principle II), so
a half-absent baseline is rejected as incomplete / possibly biased — a redo is cheap; a
poisoned baseline corrupts every downstream reading.

**Honest caveats (revisit against real-user data).** Only one intermediate sample
(`half`) pins the knee; the accept-side absence tolerance (~15–20 s) is **extrapolated**
from the validated linearity (`half` ≈ 0.5), not directly measured; and the real-world
coverage distribution is unknown until deployment. The reject rate is now **observable**
— the `apps/api` logging config emits the server-side reject line (`coverage reject:
usable=… kept=… fraction=…`; no counts on the wire — FR-016) — so the threshold can be
tuned from field data.

## Spec-assumption flags surfaced while reading (NOT contradictions — clarifications)

Per the user's instruction to STOP and flag rather than paper over, two things in the
real code refine the spec's premise. Neither blocks; both are recorded so implement
does not trip on them.

1. **The "reuse the existing 422 → cause-chip flow" wiring is partially aspirational.**
   The 005 `contracts/backend-unchanged.md` says *"The 422 `reason`
   (`no_face` / `roi_empty` / `bad_vector`) is consumed only as a secondary cause-chip
   signal,"* and 005 DECISION-24 repeats it. **But the real backend** raises
   **free-text** `str(exc)` (e.g. `"ROI 'mouth' produced no valid frames; LBP-TOP
   would be < 90-d"`), **not** those stable codes, and the orchestrator selects the
   chip **only** from `dominantCause(telemetry)` — `result.reason` is threaded into
   the reducer (`errorReason`) but **never consumed** for selection. So 006 is the
   **first** code path to actually consume the 422 `reason` for the chip. This is
   **good** (the `errorReason` field already exists; the change is additive, not a new
   channel) and consistent with the documented intent — but the spec's wording
   "reuse the existing flow" should be read as "reuse the existing 422 channel and the
   existing `errorReason` plumbing," not "a reason→chip selector already exists."

2. **The closest existing chip *conceptually* covers face-absence, yet is unfit as
   the authoritative carrier.** `dominantCause` folds no-face frames into
   `offTargetFrames` → `out-of-frame`, so on the client side "no face" already maps to
   a chip. The spec said "prefer reusing an existing chip if one already covers
   face-absence." We are **not** reusing it — justified above (client-derived, wrong
   `our-side` default when the detector is off, centring copy). This is the spec's
   own escape hatch ("add a new reason only if none does"), exercised deliberately,
   not a deviation.

Everything else in the real code is **consistent** with the spec: the all-zero
no-face row, the `compute_anchor` → `FeatureExtractionError` → HTTP 422 channel, the
raw-byte deletion, and the unchanged DB surface all hold.

Separately (housekeeping, not a code contradiction): the constitution's **provisional**
feature ordering listed slot 006 as `006-stress-inference-service`; the actual 006 is
`006-calibration-capture-quality`. Principle VIII permits provisional reordering when
recorded — a `docs/CHANGELOG.md` note lands during implement. (005 DECISION-23 even
anticipated "feature 006's inference read path"; that work simply moves to a later
slot.)

---

## Path confirmation (T003) — `compute_anchor` is baseline-capture-path-only

Verified before wiring the gate (the Phase 2 BLOCKING task), by tracing every
`compute_anchor` and `predict_delta` reference across `apps/` and `packages/`
(excluding `specs/` and `.venv/`):

**`compute_anchor` references**
- `apps/api/app/routers/anchor.py:56` — `ml_video.compute_anchor(tmp_path)` — **the
  only production caller**: the `POST /anchor` baseline/anchor capture route.
- `apps/api/tests/test_anchor.py:128` — test (monkeypatches `compute_anchor`).
- `packages/ml-video/tests/test_pipeline_fixtures.py:22,91,111,112` — tests.
- `packages/ml-video/src/ml_video/anchor.py:18` (definition),
  `__init__.py:12,18` (import/export), `features.py:6,10` (comments),
  `README.md`, `docs/MODEL_HANDOFF.md`, `docs/BACKLOG.md` — definition/docs only.

**Inference entry point is separate and not yet wired**
- `Predictor.predict_delta` is defined at `packages/ml-video/src/ml_video/loader.py:39`
  and has **zero callers in `apps/`** — the live-inference route does not exist yet
  (a later feature). `model.predict`/`predict_proba` appear only inside
  `predict_delta` itself.
- The `/anchor` route touches the predictor only for `predictor.model_version`
  (`anchor.py:64`, a response label) and startup load (`main.py:20`) / health
  (`health.py:18`) — never `predict_delta`.

**Conclusion**: `compute_anchor` is invoked **only** on the baseline/anchor capture
path; the live-inference path uses the distinct `Predictor.predict_delta` entry
point and is not even wired. Inserting the gate inside `compute_anchor` (after
`extract_landmarks`, before the feature floors) therefore **cannot affect
inference**. `docs/BACKLOG.md:1249–1317` independently anticipated this exact
placement. **Safe to wire the gate (Phase 4).**

## Part B — Glasses (investigation-only; recorded, no code) — 📌 DECISION-33

The investigation is complete and produces **no functional requirement and no code**.

- **Result.** A by-eye frame stroll counted **24/53** subjects wearing glasses; a
  glasses-stratified LOSO eval showed **no performance gap** (macro-F1 **0.720**
  glasses vs **0.717** no-glasses; stress-class recall **0.844** vs **0.818**).
- **Guidance decision.** Calibrate the way you normally sit — **glasses included** —
  and avoid glare; **do not ban glasses**.
- **Thesis limitation (must accompany the result).** It is a **between-subject**
  comparison, so it is **not proof of zero glasses effect**; it cannot test the
  calibrate-with / infer-without mismatch; and the group sizes are modest.

Recorded as `docs/DECISIONS.md` DECISION-33 + a thesis note during implement.
