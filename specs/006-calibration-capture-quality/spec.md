# Feature Specification: Calibration Capture Quality

**Feature Branch**: `006-calibration-capture-quality`

**Created**: 2026-06-11

**Status**: Draft

**Input**: User description: A backend-focused correctness feature. During feature
005 smoke testing, a 60-second calibration baseline in which the user's face was
in frame for only ~2 seconds was silently accepted as a successful baseline
("Your baseline is set"). A baseline that thin is almost certainly unusable, and
accepting it poisons every later delta-from-baseline reading. This feature
(Part A) adds a server-side usable-face-coverage gate to the baseline/anchor
capture path: when a calibration recording does not contain enough usable face
frames, the backend rejects it (through the existing failure channel) instead of
accepting it as a successful baseline, and the user sees a calm, specific
explanation via the failure screen built in feature 005. Part B (a completed
glasses investigation) is recorded as context and a decision only — it produces
no code.

> **House-style note**: per the convention established in
> `specs/003-employee-dashboard-shell/spec.md` and continued through
> `specs/005-calibration-capture-flow/spec.md`, this spec references binding
> architectural contracts by name — the **server-side** decision, the video
> modality package (`packages/ml-video/`), the `FeatureExtractionError` →
> **HTTP 422** failure channel, and the feature-005 **422 → failure-screen →
> cause-chip** flow (`reason` field, `dominantCause` logic). These are binding
> contracts under **Constitution Principles I (privacy), III (modality
> isolation), and VII (testing)**, not incidental implementation choices, so
> they belong in the spec as requirements. The two items deliberately left open
> — the threshold **numbers** and the chip-vs-new-reason **messaging
> mechanism** — are marked `[CALIBRATION-PENDING]` / deferred to `/speckit-plan`
> below; they are not unresolved ambiguities, they are decisions intentionally
> made later (numbers against real clips; mechanism after reading the
> `dominantCause` logic).

## User Scenarios & Testing *(mandatory)*

### User Story 1 - A too-thin baseline is refused, not silently accepted (Priority: P1)

An employee records a 60-second calibration baseline, but their face is actually
in frame for only a couple of seconds (they stepped away, the camera pointed at
an empty chair, or the room was so dark no face was detectable for most of the
minute). Today the backend silently accepts this as a successful baseline and the
user sees "Your baseline is set" — a green outcome that is not actually a usable
baseline. With this feature, the backend recognises that the recording does not
contain enough usable face frames and refuses it: the capture ends on the
feature-005 failure screen, not on the success screen.

**Why this priority**: This is the correctness bug the feature exists to fix.
Every future stress reading is a delta from the stored baseline (Constitution
Principle II); a baseline built from ~2 seconds of face poisons every later
reading silently and indefinitely. A "green" calibration that is not a usable
baseline is the single worst outcome the calibration flow can produce, because
it is invisible — nothing downstream can tell a poisoned baseline from a good
one. Refusing the thin capture at the moment of capture is the only place the
problem is detectable.

**Independent Test**: Feed the known-thin ~2-second-of-face calibration clip to
the baseline/anchor capture path and confirm it is **rejected** with HTTP 422 and
the user lands on the failure screen — never "baseline set" — and that no anchor
is stored.

**Acceptance Scenarios**:

1. **Given** a 60-second calibration recording in which a face is present for only
   ~2 seconds (the known-thin fixture clip), **When** the backend processes it on
   the baseline/anchor capture path, **Then** it is rejected with HTTP 422 through
   the existing failure channel and no baseline is stored.
2. **Given** that rejection, **When** the capture flow renders the outcome,
   **Then** the user sees the feature-005 failure screen, not the success state,
   and the "Your baseline is set" message never appears.
3. **Given** a recording that is too short overall (few usable face frames even
   though the face is present whenever the camera sees anything), **When** it is
   processed, **Then** the **absolute-minimum** floor rejects it.
4. **Given** a full-length recording in which the face is present only
   intermittently (well under the required share of the minute), **When** it is
   processed, **Then** the **coverage-fraction** check rejects it even though the
   absolute count of usable frames alone might look survivable.

---

### User Story 2 - A genuine full-minute baseline is still accepted (Priority: P1)

An employee records a normal 60-second calibration baseline, sitting reasonably
still with their face in view for essentially the whole minute (glasses, normal
fidgeting, brief glances away included). The new gate must let this through
unchanged — the same successful "Your baseline is set" outcome as before. A gate
that rejects good captures is exactly as broken as one that accepts bad ones, and
on the demo path a false reject would block a real user from ever calibrating.

**Why this priority**: The no-false-reject guarantee is co-equal with the
rejection itself. The thresholds are deliberately calibrated low enough that any
genuine full-minute capture clears both conditions; this story is the guardrail
that keeps the gate from over-reaching into the image-quality territory that is
explicitly out of scope. Without it, "fix the bug" could silently become "block
calibration."

**Independent Test**: Feed the known-good calibration clips — the **ideal**
full-minute clip (face present throughout) and the **realistic** full-minute clip
(natural brief look-aways; face present for most but not all of the minute) — to
the baseline/anchor capture path and confirm each is **accepted** (HTTP 200,
baseline stored) with no change to the existing success outcome. The realistic
clip is the binding case.

**Acceptance Scenarios**:

1. **Given** a genuine 60-second calibration recording with the face present
   throughout (the known-good fixture clip), **When** the backend processes it,
   **Then** it is accepted exactly as today (baseline stored, success state shown)
   and the new gate does not reject it.
2. **Given** a normal capture with ordinary brief glances away or fidgeting that
   still leaves the face present for the large majority of the minute, **When** it
   is processed, **Then** it clears both the absolute-minimum and coverage-fraction
   conditions and is accepted.
3. **Given** the calibrated thresholds, **When** any genuine full-minute capture is
   evaluated, **Then** zero genuine full-minute captures are falsely rejected in
   the test fixtures.

---

### User Story 3 - The rejection is explained calmly and specifically, without disturbing existing causes (Priority: P2)

When the gate rejects a capture, the user does not see a generic or self-blaming
error. Through the feature-005 failure screen they see a calm, specific
explanation that their face wasn't visible for enough of the recording — in the
Constitution Principle V voice (for example, "we couldn't see your face for
enough of that recording — let's try again"). The existing framing/cause chips
from feature 005 (off-centre and the other framing causes) are unchanged: an
off-centre but **detected** face is still a usable frame and passes this gate, so
the face-absence rejection and the existing framing nudges never overlap.

**Why this priority**: The capture flow's whole reason for existing is to keep the
user calm (Constitution Principle V). A correctness gate that surfaced a cold or
blaming error, or that accidentally re-pointed the existing off-centre chip at a
user whose framing was fine, would undo the feature-005 work. This story makes the
rejection humane and surgical — it adds one specific, accurate explanation and
changes nothing else.

**Independent Test**: Drive a gate rejection and confirm the failure screen shows
a calm, specific "face not visible for enough of the recording" explanation in the
calm voice; separately confirm an off-centre-but-detected capture is **not**
rejected by this gate and the existing cause-chip selection for the other failure
modes is byte-for-byte unchanged.

**Acceptance Scenarios**:

1. **Given** a capture rejected by the usable-face-coverage gate, **When** the
   failure screen renders, **Then** the user sees a calm, specific explanation that
   their face wasn't visible for enough of the recording, in the Principle V voice
   (no exclamation marks, no "detected"/clinical language, no self-blame).
2. **Given** a capture in which the face is **detected** but off-centre or
   otherwise poorly framed (yet present), **When** it is processed, **Then** this
   gate does **not** reject it — an off-centre detected face is a usable frame — and
   the recording is judged only by the existing pipeline as before.
3. **Given** any failure mode that already produced a cause chip in feature 005
   (low-light, out-of-frame, our-side), **When** that failure occurs, **Then** its
   chip selection is unchanged by this feature; the new explanation only covers the
   newly-introduced face-absence rejection.
4. **Given** the on-device framing detector was unavailable for the capture
   (feature 005 FR-011), **When** the gate rejects the recording server-side,
   **Then** the user still receives the specific face-absence explanation (the
   server's decision does not depend on client telemetry that may not exist).

---

### Edge Cases

- **Face present throughout but the clip is genuinely too short** (e.g. the user
  stopped early via some path that still submitted a clip): the **absolute-minimum**
  floor rejects it even though coverage fraction alone would be high.
- **Full-length clip, face present only intermittently** (present ~2s of 60s): the
  **coverage-fraction** check rejects it even though the absolute usable-frame
  count is non-trivial. Failing **either** condition rejects the capture.
- **Boundary captures**: a capture sitting right at the calibrated thresholds is
  decided deterministically by the documented rule (accept only if it clears
  **both**; reject if it fails **either**); the calibration of the numbers ensures
  the genuine good clips — including the **realistic** one with brief look-aways —
  sit clearly on the accept side and the thin clip clearly on the reject side.
- **Off-centre but detected face**: a usable frame. This gate is blind to framing
  quality — it counts face presence only — so off-centre captures pass this gate
  and are handled exactly as before.
- **On-device detector unavailable (FR-011)**: the server gate is authoritative and
  still runs; the rejection and its explanation do not depend on any client-side
  framing telemetry.
- **Degenerate existing floors still apply**: the current floors (LBP-TOP needs at
  least one usable frame per ROI; motion needs at least two decoded frames,
  counting no-face frames) remain in place; the new gate is an **additional**,
  stricter usable-face condition layered before/around them, not a replacement that
  loosens anything.
- **Image quality of present faces** (soft, dim-but-detectable, blurry, small): out
  of scope. A frame with a detected face is "usable" for this gate regardless of how
  good the face looks; present-but-poor-quality grading is a separate future item.

## Requirements *(mandatory)*

> **Numbering note**: FR-IDs in this spec are spec-local (they restart at FR-001
> per feature). Where this spec means the colour/voice rule, it says
> "Constitution Principle V".

### Functional Requirements — Gate placement & authority

- **FR-001**: The usable-face-coverage gate MUST run **server-side**, inside the
  video modality package (`packages/ml-video/`) on the anchor/baseline computation
  path, and MUST be **authoritative** — it is the decision of record for whether a
  calibration recording is accepted (Constitution Principle III: modality logic
  lives in the package).
- **FR-002**: The on-device (client-side) framing detector MUST NOT be the gate.
  It can be unavailable (feature 005 FR-011) and is a different model from the
  server's FaceMesh, so it cannot be authoritative. Any client-side framing signal
  is advisory only and MUST NOT be required for the server's accept/reject decision.
- **FR-003**: The gate MUST apply to the **baseline/anchor capture path only**. It
  MUST NOT change the live-inference path (a later feature), the server-side
  extraction pipeline shape, the anchor storage shape, the 60-second duration, or
  the role scoping established in feature 004/005.

### Functional Requirements — What "usable" means & the two conditions

- **FR-004**: A **usable face frame** MUST be defined as a kept frame with a
  **detected face**. The pipeline already emits an **all-zero** landmark row for a
  no-face frame and a **non-zero** row when a face is detected, so "usable" =
  "non-zero landmark row". This feature **counts** the signal that already exists;
  it does not add a new detector.
- **FR-005**: The gate MUST apply an **absolute minimum number of usable face
  frames**. This floor rejects captures that are too short to be a usable baseline
  even when a face is present whenever the camera sees anything.
- **FR-006**: The gate MUST apply a **minimum coverage fraction** = (usable face
  frames ÷ kept frames). This fraction rejects full-length captures in which the
  face is present only intermittently.
- **FR-007**: A capture MUST be **accepted only if it clears BOTH** conditions
  (FR-005 and FR-006), and MUST be **rejected if it fails EITHER**. The two
  conditions are complementary: the absolute floor catches the too-short case, the
  fraction catches the present-only-intermittently case.
- **FR-008**: The exact threshold **numbers** for FR-005 and FR-006 are
  `[CALIBRATION-PENDING]` — they MUST NOT be guessed in this spec. They MUST be
  calibrated during `/speckit-plan` / `/speckit-implement` against **three** real
  fixture clips: the known-thin ~2-second-of-face clip (reject side); the
  known-good **ideal** full-minute clip (face present the whole minute, accept
  side); and the known-good **realistic** full-minute clip (a genuine calm
  baseline with natural brief look-aways, so the face is present for the large
  majority but **not 100%** of the minute, accept side). The thresholds MUST be set
  **low enough that the good-realistic clip is accepted** — that clip, not the
  ideal one, is the **binding upper-bound constraint**, because a normal user
  glances away, looks down, or shifts, so a genuine good capture has the face
  present for most but not all of the minute (FR-006 of User Story 2 / SC-002).

### Functional Requirements — Failure channel & messaging

- **FR-009**: On rejection, the gate MUST reuse the **existing failure channel** —
  raising `FeatureExtractionError`, which the API maps to **HTTP 422**
  (`extraction_failed`). It MUST NOT introduce a new API surface, status code, or
  endpoint.
- **FR-010**: The rejection MUST drive the **existing feature-005 422 →
  failure-screen → cause-chip flow** with no new flow: the user reaches the same
  failure screen as any other extraction failure.
- **FR-011**: On rejection, the user MUST see a **calm, specific explanation that
  their face wasn't visible for enough of the recording**, in the Constitution
  Principle V voice (e.g. "we couldn't see your face for enough of that recording —
  let's try again"): no exclamation marks, no "detected"/clinical/alarmist
  language, no self-blame, delivered through the feature-005 failure screen.
- **FR-012**: The **mechanism** for FR-011 — whether the explanation reuses an
  existing feature-005 cause chip or is carried by a **new distinct reason code**
  (e.g. `insufficient_face_frames`) surfaced from the server 422 `reason` — is an
  implementation choice **deferred to `/speckit-plan`**, to be decided **after
  reading the current cause-chip / `dominantCause` logic**
  (`apps/web/lib/face-detect/cause-telemetry.ts`,
  `apps/web/components/anchor/failure-state.tsx`). The plan MUST **prefer reusing an
  existing chip** if one already covers face-absence, and add a new reason **only
  if none does**.
- **FR-013**: The existing framing/cause chips (off-centre / out-of-frame,
  low-light, our-side) MUST remain **unchanged**. Because an off-centre but
  **detected** face is a usable frame that passes this gate, the face-absence
  rejection and the existing framing failure modes **do not overlap**; this feature
  MUST NOT alter the selection of any existing chip.
- **FR-014**: Any frontend change MUST be **minimal and purely additive** — at most
  surfacing the new face-absence explanation — and MUST NOT regress the existing
  cause-chip selection, the failure-screen behaviour, or any other feature-005
  surface. The on-device detector being unavailable (FR-011 of feature 005) — which
  leaves no client telemetry to drive a chip — is the main case a **server-supplied
  reason** would cover.

### Functional Requirements — Scope, migration & privacy

- **FR-015**: This feature MUST NOT retroactively invalidate baselines already
  stored. The gate applies to **new captures only**; there is no migration and no
  re-evaluation of existing anchors (this is a dev-only environment with no
  production anchors).
- **FR-016**: The gate MUST NOT cause any raw frames, raw landmark rows, or other
  raw signal data to leave the backend inference layer. It computes its decision
  from the already-extracted landmark rows entirely server-side and emits only the
  accept/reject outcome (and, on reject, the existing 422 `reason`), consistent with
  Constitution Principle I and the unchanged feature-004 raw-byte-deletion
  invariant.

### Functional Requirements — Honest test for the gate (Constitution Principle VII)

- **FR-017**: This feature MUST ship a **unit test that exercises the gate at the
  real boundary**: it MUST feed real (or faithfully real) landmark arrays — one
  derived from the thin ~2-second clip (reject side), one from the good **ideal**
  full-minute clip, and one from the good **realistic** full-minute clip (natural
  brief look-aways; included as an **accepted-side** fixture) — and assert
  **reject-below / accept-above**. The test MUST NOT mock the gate's own logic to
  green; these three calibration clips are the fixtures.
- **FR-018**: The test suite MUST also assert the **no-false-reject** guarantee
  (SC-002) on the good **realistic** fixture (the binding upper-bound case, not only
  the ideal clip) and the **no-regression** guarantee on the existing cause-chip
  selection (FR-013) — i.e. an off-centre-but-detected capture is not rejected by
  this gate.

### Key Entities

- **Usable face frame**: a kept frame with a detected face, represented as a
  **non-zero** landmark row (no-face frames are all-zero rows). The single signal
  this feature counts; it already exists in the pipeline output.
- **Kept frames**: the frames the decode pipeline retains after its existing
  downsample (the `DecodedClip.landmarks` rows). The denominator of the coverage
  fraction (FR-006).
- **Usable-face-coverage gate**: the server-side decision applying both an
  absolute-minimum usable-frame floor (FR-005) and a minimum coverage fraction
  (FR-006); accepts only if both clear, rejects if either fails.
- **Calibration baseline (anchor)**: the per-user calibration reference computed on
  the capture path; a thin/unusable one poisons every later delta reading
  (Constitution Principle II). Stored only on acceptance.
- **Failure channel**: the existing `FeatureExtractionError` → HTTP 422
  (`extraction_failed`, with a `reason`) path that already drives the feature-005
  failure screen and cause-chip flow; reused unchanged in shape.
- **Face-absence explanation**: the calm, specific Principle-V message shown on
  rejection ("we couldn't see your face for enough of that recording"); its delivery
  mechanism (reused chip vs new reason code) is deferred to planning (FR-012).

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: The known-thin calibration clip (face present ~2 seconds of the
  minute) is **rejected** on the baseline/anchor capture path (HTTP 422) and the
  user lands on the failure screen — never "baseline set" — in 100% of runs, and no
  anchor is stored for it.
- **SC-002**: Both the known-good **ideal** full-minute clip (face present
  throughout) and the known-good **realistic** full-minute clip (natural brief
  look-aways; face present for the large majority but not 100% of the minute) are
  **accepted** (HTTP 200, baseline stored) with **zero false rejects** — the new
  gate changes their outcome not at all. The good-realistic clip is the binding
  case: the thresholds are verified against it, not only the ideal clip.
- **SC-003**: The accept/reject decision is made **server-side in the video
  package** (`packages/ml-video/`), not on the client; the client cannot override or
  be required for the decision.
- **SC-004**: The rejection reuses the **existing 422 → failure-screen →
  cause-chip flow** with **no new API surface** (same status code, same endpoint,
  same channel).
- **SC-005**: On rejection the user sees a **calm, specific** "face not visible for
  enough of the recording" explanation in the Principle V voice — verified to
  contain no exclamation mark and none of the alarmist/clinical blocklist
  ("detected", "alert", "abnormal", "elevated risk") — via the feature-005 failure
  screen.
- **SC-006**: The existing cause-chip selection for the prior failure modes
  (low-light, out-of-frame, our-side) is **unchanged**, and an
  off-centre-but-detected capture is **not** rejected by this gate — verified by a
  test that would fail if this gate altered either.
- **SC-007**: A unit test asserts **reject-below / accept-above** at the real
  boundary using real (or faithfully real) landmark arrays from the three fixture
  clips (thin, good-ideal, good-realistic), with **no mock of the gate's own
  logic**, and passes in CI (Constitution Principle VII).

## Assumptions

- **The feature-004/005 capture plumbing and failure channel are reused, not
  rebuilt.** The decode/landmark pipeline (`extract_landmarks` → `DecodedClip` with
  all-zero rows for no-face frames), `compute_anchor`, the `FeatureExtractionError`
  → HTTP 422 mapping, and the feature-005 failure screen + cause-chip flow all exist
  and are the substrate this feature extends.
- **The threshold numbers are calibration-pending, not unknown.** The gate's
  **shape** is fully specified (FR-004…FR-007); only the two numbers (FR-008) are
  set later, empirically, against the three real fixture clips (thin, good-ideal,
  good-realistic). They are tuned low enough that the good-**realistic** capture —
  face present for most but not all of the minute — clears both.
- **The messaging mechanism is a deliberate planning decision, not an ambiguity.**
  Whether to reuse an existing chip or add a new reason code (FR-012) is decided in
  `/speckit-plan` after reading the `dominantCause` logic. Note for planning: that
  logic is **client-derived** and defaults to `our-side` when the on-device detector
  was unavailable — precisely the FR-011 case the server gate must explain — which is
  the main argument for a server-supplied reason.
- **Employees only.** As in feature 004/005, the capture path and its outcomes are
  employee-only; this feature does not change role scoping.
- **Dev-only environment, no production anchors.** No migration or retroactive
  invalidation is required or performed (FR-015).
- **User-facing copy in this spec is draft-quality** and is finalised during
  `/speckit-plan` / `/speckit-tasks` against the Constitution Principle V calm-voice
  rubric.
- **Manual smoke testing is performed by Mohamed** per Constitution Principle VII;
  `smoke-tests.md` is authored during `/speckit-tasks` and signed off after
  `/speckit-implement`, and will include the thin-clip-rejected / good-clip-accepted
  end-to-end checks.

## Out of Scope *(explicit exclusions)*

The following are explicitly excluded from this feature:

- **Image-quality grading of present-but-detectable frames** (soft, dim, blurry, or
  small-but-detected faces). This feature gates on **face absence/coverage only**,
  not image quality. "Present but poor quality" is a separate future item.
- **Any change to the live-inference path** (a later feature). This touches the
  baseline/anchor capture path only.
- **Retroactive invalidation of baselines already stored.** The gate applies to new
  captures only; no migration (FR-015).
- **Guessing the threshold numbers.** The gate's shape is specified here; the actual
  minimum-frame and coverage values are calibrated later against the three real
  clips (thin, good-ideal, good-realistic) and are marked `[CALIBRATION-PENDING]`
  (FR-008).
- **Any redesign of the feature-005 failure screen or its existing cause chips.**
  This feature adds at most one specific face-absence explanation and changes nothing
  else (FR-013, FR-014).
- **Changes to the server-side extraction pipeline, anchor storage shape, the
  60-second duration, or role scoping** established in features 004/005.

## Part B — Glasses (Investigation Only, NON-NORMATIVE — no code)

Part B is **investigation-only** and produces **no functional requirement and no
code**. It is recorded here so the buildable scope (Part A) is not confused with
it, and so the result is captured for the thesis and `docs/DECISIONS.md`.

- **Investigation result**: a by-eye frame stroll counted **24/53 subjects wearing
  glasses**, and a glasses-stratified LOSO evaluation showed **no performance gap**
  (macro-F1 **0.720** glasses vs **0.717** no-glasses; stress-class recall **0.844**
  vs **0.818**).
- **Product decision (to be logged in `docs/DECISIONS.md` during planning)**:
  calibrate the way you normally sit — **glasses included** — and avoid glare; **do
  not ban glasses**.
- **Thesis limitation note**: this is a **between-subject** comparison, so it is
  **not proof of zero glasses effect**; it cannot test the
  calibrate-with / infer-without mismatch; and the group sizes are modest. These
  caveats MUST accompany the result wherever it is reported.

## Dependencies

- **Feature 004 (onboarding video anchor flow)** — the decode/landmark pipeline,
  `compute_anchor`, the `FeatureExtractionError` → HTTP 422 channel, and the
  raw-byte-deletion invariant are the substrate the gate extends.
- **Feature 005 (calibration capture flow)** — the 422 → failure-screen →
  cause-chip flow (`failure-state.tsx`, `cause-telemetry.ts` / `dominantCause`) is
  the channel the rejection reuses; FR-011 (detector-may-be-unavailable) is the
  case the server gate must remain authoritative through.
- **Constitution Principle I (Privacy by Architecture)** — the gate computes
  server-side; no raw signal leaves the inference layer (FR-016).
- **Constitution Principle II (Subject-Disjoint ML Evaluation / per-user
  calibration)** — a thin baseline poisons every delta-from-baseline reading; this
  is why the gate exists.
- **Constitution Principle III (Modality Isolation)** — the gate lives in
  `packages/ml-video/` and is authoritative there (FR-001).
- **Constitution Principle V (Calm-First Design Language)** — the rejection copy is
  calm, specific, non-alarmist, non-blaming (FR-011).
- **Constitution Principle VII (Mandatory Testing Per PR)** — the boundary unit test
  with no mocked-green gate logic (FR-017, FR-018).

### Open Decisions Deferred to Planning (NOT spec requirements — for `/speckit-plan`)

These are intentionally-deferred decisions, recorded so the plan resolves them and
does not regress:

1. **Threshold numbers** (FR-008): the absolute-minimum usable-frame count and the
   minimum coverage fraction are calibrated empirically against the known-thin,
   known-good-ideal, and known-good-realistic fixture clips during plan/implement —
   the good-realistic clip (face present for most but not all of the minute) being
   the binding upper bound. The spec specifies the gate's shape and the
   no-false-reject constraint; it deliberately does not fix the numbers.
2. **Messaging mechanism** (FR-012): reuse an existing feature-005 cause chip vs add
   a new distinct reason code (e.g. `insufficient_face_frames`). Decide **after**
   reading `cause-telemetry.ts` / `dominantCause` and `failure-state.tsx`. Prefer
   reuse if an existing chip already covers face-absence; add a new reason only if
   none does. Relevant fact for the decision: `dominantCause` is client-derived and
   returns `our-side` when the on-device detector was unavailable, so it cannot, on
   its own, tell a face-absence rejection apart from a genuine our-side failure.
3. **Where exactly the gate sits in `packages/ml-video/`** (e.g. inside
   `compute_anchor` after `extract_landmarks`, or a small dedicated helper it calls)
   and how it composes with the existing degenerate floors — a plan-level placement
   decision, kept additive and stricter, never loosening the existing floors.
