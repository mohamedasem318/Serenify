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
in `coverage.py` as `[CALIBRATION-PENDING]` and are set during `/speckit-implement`
by running the three real fixture clips through the real pipeline in the pinned env.

**Procedure.**

1. Acquire three real clips (developers' own recordings, **not** StressID media):
   **thin** (~2s of face in a full minute), **good-ideal** (face the whole minute),
   **good-realistic** (genuine calm minute with natural brief look-aways — face for
   the large majority but not 100%).
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

## Calibration measurements (T013) — three real clips through the real pipeline

Extracted once in the pinned env (Python **3.12.13**, **mediapipe 0.10.13**, via
`uv run`) with `tests/fixtures/extract_coverage_fixtures.py`. Coverage =
`usable / kept`, `usable` = non-zero landmark rows.

| Clip | usable | kept | fraction | target |
|------|-------:|-----:|---------:|--------|
| thin           |   4 | 172 | **0.023** | reject |
| good-ideal     | 154 | 154 | **1.000** | accept |
| good-realistic | 129 | 129 | **1.000** | accept (binding lower bound) |

**Key finding — the good-realistic clip came out at 1.000 coverage.** FaceMesh held
the face through the natural brief look-aways (glances/turns keep enough of the face
visible to detect), so the "realistic" clip did **not** exercise sub-100% coverage;
empirically it matches good-ideal on fraction (it differs only in `kept`, being a
shorter clip). The accept-side **binding lower bound is therefore `usable = 129`,
`fraction = 1.000`** — the thresholds must sit clearly below that, and are chosen
**conservatively low** so a genuine user whose coverage dips below this particular
clip is never false-rejected (we have no genuine sub-100% sample to pin a tighter
bound).

**Margin verdict (T014 STOP-gate): PASS — a very large, clean gap exists.** thin
coverage `0.023` vs good `1.000` (≈43×); thin usable `4` vs good `129`/`154` (≈32×).
No threshold needs to sit anywhere near the binding clip, so there is no risk of
no-separating-margin; the STOP condition does not trigger.

### Chosen thresholds (T015 / 📌 DECISION-31)

Set in `coverage.py` after review:

- **`MIN_COVERAGE_FRACTION = 0.40`** (primary lever — the face-absent bug). Margin:
  thin `0.023` vs `0.40` (rejects with ~17× headroom); both good clips `1.000` clear
  it with ~2.5× headroom.
- **`MIN_USABLE_FRAMES = 50`** (secondary backstop — too-short captures). Margin:
  thin `4` vs `50` (rejects with ~12× headroom); good-realistic `129` (binding) and
  good-ideal `154` clear it with ≥2.6× headroom.
- thin is rejected by **both** conditions (belt-and-suspenders); both good clips clear
  **both**.

**These values sit in a WIDE EMPTY GAP — a conservative judgment, not a data-derived
precise bound.** The three clips proved clean separation of the *egregious* thin case
(2.3% coverage), but we have **no acceptable sub-100%-coverage sample**: the
good-realistic clip held at **1.000** coverage because **FaceMesh is robust to seated
glances** — a glance/turn keeps enough of the face visible to detect, so coverage
only drops when the face *truly leaves the frame*. There is therefore no empirical
point anywhere between `0.023` and `1.000` to pin a tighter bound. `0.40` / `50` are
deliberately well below the only accept-side evidence (`1.000` / `129`) so a genuine
user whose coverage dips below this particular clip is not false-rejected; **the
numbers MUST be revisited against real-user calibration data** once it exists
(candidate range from the analysis: coverage `0.40–0.60`, usable `30–60`).

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

## Part B — Glasses (investigation-only; recorded, no code) — 📌 DECISION-32

The investigation is complete and produces **no functional requirement and no code**.

- **Result.** A by-eye frame stroll counted **24/53** subjects wearing glasses; a
  glasses-stratified LOSO eval showed **no performance gap** (macro-F1 **0.720**
  glasses vs **0.717** no-glasses; stress-class recall **0.844** vs **0.818**).
- **Guidance decision.** Calibrate the way you normally sit — **glasses included** —
  and avoid glare; **do not ban glasses**.
- **Thesis limitation (must accompany the result).** It is a **between-subject**
  comparison, so it is **not proof of zero glasses effect**; it cannot test the
  calibrate-with / infer-without mismatch; and the group sizes are modest.

Recorded as `docs/DECISIONS.md` DECISION-32 + a thesis note during implement.
