# Feature Specification: Onboarding Video Anchor Flow

**Feature Branch**: `004-onboarding-video-anchor`

**Created**: 2026-05-27

**Status**: Draft

**Input**: User description: After email confirmation a new employee sets
their name (existing feature-001 step, untouched) and then advances to a new
second onboarding step — **anchor recording**. The video stress-detection
model needs a per-user calibration vector (an "anchor") computed once from a
~60-second calm baseline recording; without it no predictions can ever be
delivered to that user, because the model is trained on deltas from each
subject's anchor rather than absolute features. The anchor step explains why
the camera is needed in calm voice, lets the user pick a camera, asks for
permission, records 60 seconds with a visible countdown, uploads the clip to a
new backend that extracts a 2958-dimensional feature vector, deletes the raw
video immediately, stores only the vector, and advances the user to `/app`.
The user may "Skip for now" at any point and enter `/app`, where a dismissible
calibration banner reminds them until they complete the recording. Extraction
failures show calm retry copy; after three consecutive failures an escape
hatch appears. Employees only — team leads and admins never see the anchor
step or the banner. Demo users get a synthetic anchor injected by the seed so
they bypass the banner. This feature scaffolds `apps/api/` (FastAPI) for the
first time and adds anchor columns to `public.profiles`.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Employee calibrates during onboarding (Priority: P1)

A newly confirmed employee finishes the existing name step in `/onboarding`
and advances to a new second step: anchor recording. The step opens with calm
copy explaining that the app needs a short, calm baseline recording to learn
what calm looks like for that person — no alarmism, no clinical language. The
employee selects a camera from a device dropdown, grants camera permission
when prompted, and records a 60-second baseline while a visible countdown runs.
On finish the clip uploads to the backend, the backend returns the anchor
vector, the vector is stored against the employee's profile, and the employee
is advanced to `/app` with no calibration banner showing.

**Why this priority**: The anchor is the precondition for every future video
stress prediction. Without a stored anchor the model can deliver nothing to
that user (Constitution Principle II: all predictions are deltas from the
per-user baseline; there is no global fallback anchor). This is the headline
value of the feature and the path every real employee is expected to take.

**Independent Test**: Sign up and confirm a fresh non-demo employee account,
set the name, reach the anchor step, choose a camera, grant permission, let
the 60-second countdown complete, and confirm the upload succeeds, the profile
records an anchor (vector present, capture timestamp set, model version
recorded), the user lands on `/app`, and no calibration banner is shown on
`/app` on this or any subsequent session.

**Acceptance Scenarios**:

1. **Given** a confirmed employee who has just saved their `full_name` in
   `/onboarding`, **When** they advance, **Then** they see a second
   onboarding step that explains in calm voice why a short calm recording is
   needed, with no exclamation marks, no "REQUIRED"/"MANDATORY" shouting, and
   no clinical jargon.
2. **Given** the anchor step before permission is granted, **When** the
   employee opens the camera device dropdown, **Then** the available video
   input devices are listed and one can be selected as the recording source.
3. **Given** a selected camera, **When** the employee starts recording and the
   browser prompts for camera permission, **Then** granting permission shows a
   live self-preview and begins a 60-second recording with a visible countdown
   of remaining time.
4. **Given** an in-progress recording, **When** the 60-second countdown
   completes, **Then** recording stops automatically, the clip is uploaded to
   the backend, and a calm in-progress state is shown while the backend
   extracts the anchor.
5. **Given** a successful extraction, **When** the backend returns the anchor
   vector, **Then** the employee's profile is updated with the anchor vector,
   a capture timestamp, and the model version, and the employee is advanced to
   `/app`.
6. **Given** an employee who completed calibration during onboarding, **When**
   they next sign in and land on `/app`, **Then** no calibration banner is
   rendered.

---

### User Story 2 - Employee skips calibration and is reminded later (Priority: P1)

At any point during the anchor step the employee can choose "Skip for now" and
enter `/app` immediately. On `/app` they see a calm calibration banner
explaining that stress detection is unavailable until they calibrate, with a
button that re-opens the anchor recording UI. The banner is dismissible for the
current session but reappears in future sessions, and keeps reappearing until
the employee actually completes a recording. Completing calibration from the
banner removes it permanently.

**Why this priority**: Forcing a 60-second recording as a hard gate before the
product is usable would be hostile and would violate the calm-first stance.
The skip path is the escape valve that keeps onboarding humane while the banner
provides a persistent, non-nagging nudge. It is co-equal with US1 because the
two together define the complete onboarding contract.

**Independent Test**: As a fresh non-demo employee, reach the anchor step and
click "Skip for now". Confirm immediate arrival at `/app`, a calibration banner
present with a re-open control. Dismiss the banner and confirm it stays hidden
for the rest of the session; sign out and back in and confirm it reappears.
Click the banner's re-open control, complete a recording, and confirm the
banner is gone on this and all subsequent sessions.

**Acceptance Scenarios**:

1. **Given** the anchor step at any sub-state (before permission, during
   recording, during a retry), **When** the employee activates "Skip for now",
   **Then** they are taken to `/app` immediately without recording or
   uploading anything.
2. **Given** an employee who skipped calibration, **When** they land on
   `/app`, **Then** a calm calibration banner is shown explaining stress
   detection is unavailable until they calibrate, with a clearly labeled
   control to start/re-open the anchor recording UI.
3. **Given** the calibration banner, **When** the employee dismisses it,
   **Then** it disappears for the remainder of the current session.
4. **Given** an employee who dismissed the banner earlier, **When** they start
   a new session (sign out / sign in, or new browser session) without having
   completed calibration, **Then** the banner reappears.
5. **Given** the calibration banner, **When** the employee activates its
   re-open control and completes a recording successfully, **Then** the banner
   is removed and does not reappear in any future session.
6. **Given** all calibration banner and anchor-step copy, **When** it is read,
   **Then** it contains no exclamation marks, no alarmist or clinical wording,
   and meets WCAG AA contrast in both light and dark modes.

---

### User Story 3 - Anchor data is captured privately and never exposed to managers (Priority: P1)

When a clip is uploaded, the backend decodes it, runs the feature-extraction
pipeline, returns the 2958-dimensional anchor vector, and deletes the raw video
bytes immediately — the raw frames are never persisted to disk or storage and
never reach any manager-facing layer. Only the anchor vector, a capture
timestamp, and a model-version string are stored on the employee's own profile
row. Row-level security allows a user to read and update only their own anchor;
team leads and admins have no security path that exposes another user's anchor
vector.

**Why this priority**: This is a Constitution Principle I (Privacy by
Architecture, NON-NEGOTIABLE) slice, not a polish item. Raw video must never
leave the backend inference layer, and per-user anchor data is private to that
user. Getting this wrong is a constitutional violation and a hard merge block.

**Independent Test**: Upload a clip through the anchor endpoint and confirm
(a) the raw video file no longer exists on the backend after the response is
returned, (b) only the vector + timestamp + model-version are written to the
profile, and (c) an authenticated team lead or admin cannot read another
employee's anchor vector through any query path, verified against the
row-level-security policies.

**Acceptance Scenarios**:

1. **Given** a clip uploaded to the anchor endpoint, **When** feature
   extraction completes (success or failure), **Then** the raw video bytes are
   deleted server-side immediately and are never written to durable storage.
2. **Given** a successful extraction, **When** the result is persisted,
   **Then** only the anchor vector, the capture timestamp, and the
   model-version string are stored on the requesting user's own profile row —
   no raw frames, no intermediate image data, and no stored video path.
3. **Given** an employee's stored anchor, **When** that same employee queries
   their profile, **Then** they can read and update their own anchor fields.
4. **Given** an employee's stored anchor, **When** a team lead or admin
   attempts to read it through any available query path, **Then** no anchor
   vector belonging to another user is returned.
5. **Given** the backend service, **When** it authenticates to the database,
   **Then** it reads its credentials only from environment variables and no
   secret appears in any committed file (Constitution Principle IX).

---

### User Story 4 - Managers never encounter the anchor flow (Priority: P1)

A team lead or admin who confirms their account and completes onboarding sets
their name and proceeds directly to their existing role placeholder at `/app`
— they never see the anchor recording step and never see a calibration banner.
This reaffirms the standing product decision that managers do not get personal
stress detection.

**Why this priority**: This is a privacy and product-coherence guard. Personal
stress detection is an employee-only capability; surfacing a calibration step
or banner to managers would imply they are being monitored and would
contradict the established role model from features 001 and 003. It is P1
because it is a correctness constraint, not an enhancement.

**Independent Test**: Sign in as the demo cohort's `team_lead` and as the demo
cohort's `admin`. Confirm onboarding for these roles does not present an anchor
recording step, and confirm `/app` renders their existing role placeholder
with no calibration banner.

**Acceptance Scenarios**:

1. **Given** a confirmed `team_lead`, **When** they complete onboarding,
   **Then** the anchor recording step is never shown and they proceed to their
   existing role placeholder.
2. **Given** a confirmed `admin`, **When** they complete onboarding, **Then**
   the anchor recording step is never shown and they proceed to their existing
   role placeholder.
3. **Given** a `team_lead` or `admin` on `/app`, **When** the page renders,
   **Then** no calibration banner is present in any session state.
4. **Given** the existing role-routing contract from features 001 and 003,
   **When** this feature's branch runs, **Then** the role-trio behavior is
   preserved — only the employee path gains the anchor step.

---

### User Story 5 - Calm recovery from extraction failure (Priority: P2)

When the backend cannot extract a usable anchor (for example, no face is
detected in enough frames, or region-of-interest extraction fails), the
employee sees calm retry copy that suggests practical fixes — better lighting,
facing the camera — without blame or alarm. They can record again. After three
consecutive failed attempts, an additional "skip and continue without
calibration" affordance appears so the user is never trapped.

**Why this priority**: Real-world recordings fail for benign reasons (lighting,
camera angle, occlusion), and the model contract explicitly raises an
extraction error and instructs the backend to reject the onboarding and ask
the user to re-record. Without a calm recovery path and an escape hatch, users
would be stuck in a failure loop on their very first experience of the product.
It is P2 because the happy path (US1) and the skip path (US2) already deliver a
working onboarding; this hardens the unhappy path.

**Independent Test**: Drive the anchor endpoint with input that fails
extraction (e.g., a clip with no detectable face) and confirm the UI shows
calm retry copy with practical guidance. Repeat to produce three consecutive
failures and confirm a "skip and continue without calibration" affordance
appears that lands the user on `/app` with the calibration banner.

**Acceptance Scenarios**:

1. **Given** an uploaded clip the backend cannot extract from, **When** the
   failure is returned, **Then** the employee sees calm retry copy naming a
   likely practical cause ("we couldn't read your face clearly — try again
   with better lighting or facing the camera") and a control to record again.
2. **Given** a first or second consecutive failure, **When** the failure copy
   is shown, **Then** no "skip and continue" escape affordance is shown yet —
   the user is encouraged to retry.
3. **Given** three consecutive failed extraction attempts, **When** the third
   failure is shown, **Then** a "skip and continue without calibration"
   affordance appears alongside the retry control.
4. **Given** the escape affordance after three failures, **When** the employee
   activates it, **Then** they land on `/app` with the calibration banner
   (identical end-state to the US2 skip path).
5. **Given** any failure copy, **When** it is read, **Then** it contains no
   exclamation marks, no blame, and no clinical or alarmist language, and meets
   WCAG AA contrast in both modes.

---

### User Story 6 - Demo users land on a clean dashboard (Priority: P2)

The demo seed script injects a deterministic synthetic anchor vector into every
demo profile (the `*@demo.serenify.local` cohort) so demo users bypass the
calibration banner entirely and land on a clean `/app`. Real users (any
non-demo cohort) are untouched and go through the actual recording flow.

**Why this priority**: The demo cohort is the UI smoke-test path used across
features. If demo users hit a calibration banner, every screenshot and
walkthrough of `/app` would be cluttered by an un-calibrated state. Injecting a
synthetic anchor keeps the demo surface clean. It is P2 because it supports
demonstration and testing rather than delivering end-user value directly.

**Independent Test**: Run the demo seed and confirm every `*@demo.serenify.local`
employee profile has a deterministic synthetic anchor recorded (same values on
repeated seeding from the fixed seed). Sign in as a demo employee and confirm
`/app` shows no calibration banner. Confirm a freshly created non-demo employee
still has no anchor and still goes through the recording flow.

**Acceptance Scenarios**:

1. **Given** the demo seed script, **When** it runs, **Then** every demo
   employee profile (`*@demo.serenify.local`) is given a synthetic anchor
   vector of the correct dimensionality (2958-d), a capture timestamp, and the
   model-version string.
2. **Given** the synthetic anchor generation, **When** the seed is run more
   than once, **Then** it produces the same deterministic vector values from a
   fixed seed (re-runnable without drift).
3. **Given** a demo employee, **When** they sign in and land on `/app`,
   **Then** no calibration banner is shown.
4. **Given** a non-demo employee created after seeding, **When** they reach
   `/app` without calibrating, **Then** the calibration banner is shown — the
   synthetic-anchor injection applies to the demo cohort only.

---

### User Story 7 - Completing calibration syncs across tabs (Priority: P2)

If an employee has the onboarding page open in more than one tab, completing
the anchor recording in one tab invalidates the sibling tabs that still show
the now-completed step — those tabs refresh and land on `/app` rather than
remaining on a stale recording step.

**Why this priority**: This mirrors the cross-tab auth-sync expectation
established in feature 003. Without it, a user who completes calibration in one
tab could return to a second tab and re-record or be confused by a stale step.
It is P2 because it polishes a multi-tab edge of the flow rather than the core
single-tab journey.

**Independent Test**: Open the anchor onboarding step in two tabs under the
same session. Complete the recording in tab A. Confirm tab B refreshes and
lands on `/app` (no longer on the recording step) without a manual reload,
reusing the cross-tab broadcast pattern from feature 003.

**Acceptance Scenarios**:

1. **Given** the anchor onboarding step open in two tabs of the same session,
   **When** the employee completes calibration in tab A, **Then** tab B
   transitions off the now-completed step and lands on `/app` without a manual
   reload.
2. **Given** the cross-tab broadcast, **When** calibration completes, **Then**
   the propagation reuses or extends the existing feature-003 cross-tab pattern
   rather than introducing a parallel mechanism.

---

### Edge Cases

- **Camera permission denied**: the employee sees calm copy explaining the app
  cannot record without camera access, with a path to retry permission or to
  "Skip for now". No alarm, no dead-end.
- **No camera device available**: when no video input device is present, the
  step explains this calmly and offers "Skip for now" rather than blocking.
- **Remembered camera no longer present**: if a previously chosen camera is
  unplugged or unavailable, the picker falls back to an available device
  without error.
- **Backend unreachable before recording**: the recording step fails fast if
  the backend is unavailable, rather than letting the user record 60 seconds
  and only then discovering the upload target is down. (See Open Questions —
  health pre-check.)
- **Upload target unreachable after recording**: if the upload fails after a
  completed recording, the employee sees calm retry copy and the recording can
  be retried; a failed upload (transport error) does NOT count toward the
  three-failure extraction-escape threshold — only a backend-returned
  extraction failure does.
- **User navigates away or closes the tab mid-recording or mid-upload**: no
  partial anchor is stored; the next visit shows the anchor step (during
  onboarding) or the calibration banner (on `/app`) as appropriate.
- **`prefers-reduced-motion` enabled**: the countdown animation collapses to a
  plain numeric tick with no animated motion.
- **360px viewport**: the entire anchor flow (explanation, device picker,
  preview, countdown, retry, skip) functions and is legible at 360px width,
  with all interactive targets ≥44×44px.
- **Mobile / front-camera-only devices**: the flow works with a single
  front-facing camera; the device picker degrades gracefully to the one device.
- **Re-opening the anchor UI from the banner after prior failures**: the
  re-opened recording UI starts a fresh attempt; the three-failure escape
  affordance behavior is consistent with the onboarding-step behavior.
- **Demo user persistence**: a demo user with a synthetic anchor never sees the
  banner, including across sign-out / sign-in.
- **Role changes mid-session**: anchor-flow and banner visibility are derived
  from role at page load, consistent with the feature-003 convention; a
  mid-session role change does not retroactively show or hide the anchor flow
  until the next load.
- **Model-version recorded but no invalidation yet**: a stored anchor carries
  its model-version string; this feature does not invalidate or re-prompt when
  the model version differs — the column exists to support a future
  invalidation flow only.
- **Extraction yields a malformed vector**: if the backend produces anything
  other than a valid 2958-dimensional vector, it is treated as an extraction
  failure (US5 path), never persisted as a valid anchor.

## Requirements *(mandatory)*

> House-style note: per the established convention in `specs/003-employee-
> dashboard-shell/spec.md`, requirements reference the constitution-locked
> stack and architecture (FastAPI backend in `apps/api/`, Supabase
> `public.profiles`, RLS, the `packages/ml-video/` package) because those are
> binding architectural contracts under Constitution Principles I, II, III and
> the Architecture Constraints section — not incidental implementation choices.

### Functional Requirements — Onboarding flow & step ordering

- **FR-001**: The `/onboarding` experience MUST present a second step — anchor
  recording — that an employee reaches after saving their `full_name`. The
  existing feature-001 name step MUST remain unchanged in behavior.
- **FR-002**: The anchor step MUST open with calm explanatory copy stating why
  a short calm baseline recording is needed (to learn what calm looks like for
  that person), framed supportively and without alarm.
- **FR-003**: On successful anchor capture during onboarding, the employee MUST
  be advanced to `/app`.
- **FR-004**: The anchor step MUST present a "Skip for now" affordance that, at
  any sub-state of the step, takes the employee to `/app` immediately without
  recording or uploading.

### Functional Requirements — Camera selection, permission & recording

- **FR-005**: The anchor step MUST present a camera device picker listing the
  available video input devices and allowing the employee to choose the
  recording source.
- **FR-006**: The anchor step MUST request camera permission and MUST show a
  live self-preview once permission is granted.
- **FR-007**: When camera permission is denied or no camera is available, the
  step MUST show calm copy explaining the situation and MUST offer a retry
  and/or "Skip for now" path — it MUST NOT dead-end.
- **FR-008**: Recording MUST run for 60 seconds with a visible countdown of
  remaining time, and MUST stop automatically when the countdown completes. The
  60-second duration is fixed per the model contract (Constitution Principle II
  as amended); the UI MUST NOT accept shorter recordings as valid baselines.
- **FR-009**: When `prefers-reduced-motion` is set, the countdown MUST render
  as a plain numeric tick with no animated motion (Constitution Principle VI).
- **FR-010**: Microphone access MUST NOT be requested anywhere in this feature
  — audio capture is out of scope (feature 013).

### Functional Requirements — Backend anchor extraction (`apps/api/`)

- **FR-011**: This feature MUST scaffold the FastAPI service in `apps/api/` and
  expose a single endpoint that accepts an uploaded video clip and returns the
  computed anchor vector.
- **FR-012**: The endpoint MUST run the feature-extraction pipeline defined by
  the model contract (decode → downsample to 5 fps → `%2` frame skip →
  MediaPipe FaceMesh landmarking → LBP-TOP per region of interest → motion
  features → concatenate to a 2958-dimensional vector) and return that vector.
  This is the anchor recipe (no anchor subtraction is performed — anchors are
  absolute features).
- **FR-013**: The backend MUST load the model artifacts at service startup as a
  sanity check that the artifact path is valid and the serialized model and
  scaler are loadable in the current runtime (e.g., the scaler reports
  `n_features_in_ == 2958` and the classifier exposes classes `[0, 1]`),
  refusing to start otherwise. There MUST be no prediction endpoint in this
  feature (prediction is feature 005).
- **FR-014**: The model artifacts currently under `tmp/model-artifacts/`
  (`model.joblib`, `scaler.joblib`, `metadata.json`) MUST be relocated to
  `packages/ml-video/models/` as part of this feature, and the backend MUST
  load them from that location (Constitution Principle II: artifacts live in
  `packages/ml-*/models/`).
- **FR-015**: The backend MUST read all of its credentials (including any
  Supabase credentials) only from environment variables; no secret may appear
  in any committed file (Constitution Principle IX).

### Functional Requirements — Privacy, storage & access control

- **FR-016**: Raw video bytes MUST be deleted server-side immediately after
  feature extraction (on success or failure) and MUST never be written to
  durable storage or surfaced to any manager-facing layer (Constitution
  Principle I, NON-NEGOTIABLE). This overrides the model contract's optional
  "store anchor_video_path for debugging" suggestion — no raw video path is
  retained.
- **FR-017**: Only the anchor vector, a capture timestamp, and a model-version
  string MUST be stored — no raw frames, no intermediate image data, no video
  path.
- **FR-018**: `public.profiles` MUST gain three columns: an anchor vector
  field (2958-dimensional float vector; storage shape is a planning decision —
  see Open Questions), `anchor_captured_at` (timestamp with time zone), and
  `anchor_model_version` (text, matching the model name + version recorded in
  `docs/MODELS.md`, e.g. `serenify-video-lbptop-motion-rf-calibrated@2.0.0`).
- **FR-019**: Row-level security MUST permit a user to read and update only
  their own anchor fields. No RLS path may expose one user's anchor vector to a
  team lead, admin, or any other user (Constitution Principle I). Existing
  feature-001 / security-slice-1 policies MUST be confirmed and extended as
  needed.
- **FR-020**: The `anchor_model_version` column MUST exist now to support a
  future model-bump invalidation flow, but this feature MUST NOT implement any
  invalidation or re-prompt behavior based on version mismatch.

### Functional Requirements — Calibration banner on `/app`

- **FR-021**: For an employee with no stored anchor, `/app` MUST render a calm
  calibration banner explaining that stress detection is unavailable until they
  calibrate, with a clearly labeled control that opens the anchor recording UI.
- **FR-022**: The banner's re-open control MUST open the anchor recording UI on
  the dashboard route (the only in-feature path to recalibrate; the account-
  settings recalibration entry point is out of scope — feature 005).
- **FR-023**: The banner MUST be dismissible for the current session. After
  dismissal it MUST stay hidden for the remainder of that session.
- **FR-024**: The banner MUST reappear in future sessions while the employee
  has no stored anchor, and MUST stop appearing permanently once an anchor is
  successfully captured.
- **FR-025**: Completing a recording from the banner MUST store the anchor and
  remove the banner identically to completing it during onboarding.

### Functional Requirements — Failure handling & escape hatch

- **FR-026**: On a server-side extraction failure, the employee MUST see calm
  retry copy naming a likely practical cause (lighting, facing the camera) and
  a control to record again.
- **FR-027**: After three consecutive failed extraction attempts, a "skip and
  continue without calibration" affordance MUST appear alongside the retry
  control. The first and second failures MUST NOT show it.
- **FR-028**: Activating the post-failure escape affordance MUST land the
  employee on `/app` in the same end-state as the US2 skip path (calibration
  banner shown).

### Functional Requirements — Role scoping

- **FR-029**: The anchor recording step and the calibration banner MUST be
  shown to employees only. `team_lead` and `admin` users MUST NEVER see the
  anchor step or the calibration banner, and MUST continue to see their
  existing role placeholders from feature 003.
- **FR-030**: The role-routing contract from features 001 and 003 MUST be
  preserved; only the employee onboarding/landing path gains anchor behavior.

### Functional Requirements — Demo seed

- **FR-031**: The demo seed script (`scripts/seed-demo.ts`) MUST inject a
  deterministic synthetic anchor vector (fixed-seed generation, 2958-d) into
  every `*@demo.serenify.local` profile, along with a capture timestamp and the
  model-version string, so demo users bypass the calibration banner.
- **FR-032**: Synthetic anchor injection MUST be deterministic and re-runnable
  — repeated seeding produces the same vector values.
- **FR-033**: Synthetic anchor injection MUST apply only to the demo cohort.
  Non-demo users MUST be untouched and MUST go through the real recording flow.

### Functional Requirements — Cross-tab sync

- **FR-034**: Completing the anchor in one tab MUST invalidate sibling tabs
  that have the now-completed onboarding step open, causing them to land on
  `/app` without a manual reload.
- **FR-035**: Cross-tab propagation MUST reuse or extend the existing
  feature-003 cross-tab broadcast pattern (`apps/web/lib/auth-broadcast.ts`)
  rather than introducing a parallel mechanism.

### Functional Requirements — Security headers

- **FR-036**: The site-wide `Permissions-Policy` default of `camera=()`
  (default-deny, set in security slice 5) MUST remain, with `camera=(self)`
  relaxed scoped only to the routes that use the camera in this feature — the
  onboarding anchor route and the dashboard route that re-opens the anchor UI.
- **FR-037**: Microphone MUST remain denied by `Permissions-Policy` (audio is
  feature 013).
- **FR-038**: The Content-Security-Policy `connect-src` MUST add an entry for
  the FastAPI backend origin in both development and production — this is the
  first time the web app calls anything outside Supabase and same-origin.
- **FR-039**: COEP MUST remain unset; no WebAssembly is loaded in `apps/web/`
  because the extraction pipeline (including MediaPipe) runs server-side in
  this feature.

### Functional Requirements — Calm voice, accessibility & responsiveness

- **FR-040**: Every piece of copy in the anchor flow and calibration banner
  (explanation, permission prompts, countdown labels, failure/retry copy, skip
  and escape affordances) MUST use calm voice per Constitution Principle V — no
  exclamation marks, no "REQUIRED"/"MANDATORY" shouting, no clinical jargon.
- **FR-041**: The entire anchor flow MUST function and remain legible at 360px
  minimum viewport width, with light/dark parity, and all interactive targets
  ≥44×44px on touch-capable viewports (Constitution Principle VI).
- **FR-042**: Permission-denied and extraction-failure copy MUST meet WCAG AA
  contrast in both light and dark modes.

### Functional Requirements — Testing (Constitution Principle VII)

- **FR-043**: A Playwright end-to-end happy-path test MUST cover sign up → name
  → anchor → `/app`, and a skip-path test MUST cover sign up → name → skip →
  `/app` with the calibration banner.
- **FR-044**: Pytest MUST cover the FastAPI anchor endpoint including
  failure-mode coverage (e.g., no-face / unextractable input) and the
  raw-byte-deletion invariant.
- **FR-045**: A `smoke-tests.md` MUST be authored for this feature listing
  manual webcam permission-flow checks on Chrome, Firefox, and Safari, on
  mobile and desktop.

### Key Entities

- **Anchor Vector**: A 2958-dimensional float vector representing a user's calm
  baseline, computed once from a ~60-second recording. It is the per-user
  calibration reference from which all future video stress predictions are
  computed as deltas (Constitution Principle II). Stored on the user's own
  `public.profiles` row; private to that user. ~12 KB at float32.
- **Anchor Capture Metadata**: The capture timestamp (`anchor_captured_at`) and
  the model-version string (`anchor_model_version`, e.g.
  `serenify-video-lbptop-motion-rf-calibrated@2.0.0`) stored alongside the
  vector. The version string exists to support a future invalidation flow.
- **Anchor Recording Step**: The new second step in `/onboarding` (and the
  re-openable recording UI on the dashboard) comprising explanation, device
  picker, permission request, self-preview, 60-second countdown recording,
  upload, in-progress and failure/retry states, and the skip/escape affordances.
- **Calibration Banner**: The calm `/app` banner shown to employees with no
  stored anchor. Dismissible per session, reappears across sessions until an
  anchor is captured, and carries the control to open the recording UI.
- **Camera Device Selection**: The chosen video input device for recording,
  surfaced via the device picker. (Whether the choice is remembered for next
  time is an Open Question.)
- **Anchor Extraction Endpoint**: The single FastAPI endpoint in `apps/api/`
  that decodes the uploaded clip, runs the LBP-TOP + motion feature-extraction
  pipeline, returns the anchor vector, and deletes the raw bytes immediately.
- **Synthetic Demo Anchor**: A deterministic, fixed-seed anchor vector injected
  into demo (`*@demo.serenify.local`) profiles by the seed so demo users bypass
  the banner. Nonsense for real prediction by design; exists only to keep the
  demo UI path clean.

## Out of Scope *(explicit exclusions)*

The following are explicitly excluded from this feature:

- **Live inference loop / continuous webcam capture / rolling 60-second buffer
  with 10-second stride.** Feature 005.
- **Wiring the "Today's check-in" card to real predictions.** Feature 005.
- **Recalibration from `/app/account` settings.** Feature 005. In this feature,
  recalibration is reachable only via the dashboard calibration-banner button.
- **Audio capture, microphone permissions, vocal-stress model.** Feature 013.
- **Physiological sensor integration.** Feature 014.
- **Multi-modal fusion.** Feature 015.
- **Manager personal stress detection.** Indefinitely deferred — managers keep
  their role placeholders.
- **The actual anchor-invalidation-on-model-bump flow.** The
  `anchor_model_version` column exists to support it, but the invalidation flow
  ships when there is a second model version to bump to.
- **Any browser-side MediaPipe / WebAssembly execution.** Extraction runs
  server-side; COEP stays unset and no WASM is loaded in `apps/web/`.

## Dependencies

- **Constitution ride-along amendments and `docs/MODELS.md` are a prerequisite
  commit, handled separately from this spec.** Before any feature code lands,
  the first commit of this feature amends the constitution (Principle III
  reworded to the LBP-TOP + motion video pipeline with per-user delta
  calibration; Principle VIII feature-ordering slot `004-webcam-and-rppg`
  renamed to `004-onboarding-video-anchor`; version bump 1.2.0 → 1.3.0; Sync
  Impact Report Amendment 3; `docs/DECISIONS.md` and `docs/CHANGELOG.md`
  entries dated 2026-05-27) and creates `docs/MODELS.md` with the v2.0.0 model
  entry and confusion-matrix figure. This spec does not perform those edits; it
  depends on them being in place so the rest of the feature builds against a
  clean constitution.
- **Feature 001** auth, the `/onboarding` name step, the `public.profiles`
  schema, and RLS policies are available and unchanged.
- **Feature 002** demo seed (`scripts/seed-demo.ts`) creates the
  `*@demo.serenify.local` cohort and is the script extended in FR-031.
- **Feature 003** dashboard shell, role placeholders, and the cross-tab
  broadcast pattern (`apps/web/lib/auth-broadcast.ts`) are available; this
  feature extends the cross-tab pattern (FR-035) and adds the calibration
  banner to the employee `/app` surface.
- **Model contract** (`MODEL_HANDOFF.md` / `docs/MODELS.md`): the extraction
  pipeline, the 2958-dimensional output shape, the 60-second baseline, the
  startup sanity checks, and the artifact names are authoritative as documented
  for `serenify-video-lbptop-motion-rf-calibrated@2.0.0`.

## Assumptions

- The model contract (pipeline stages, 2958-dimensional output, 60-second
  baseline, artifact names, startup sanity checks) is authoritative as
  documented for the model and is recorded in `docs/MODELS.md` as of this
  feature's first commit. The v2.0.0 artifact is named
  `serenify-video-lbptop-motion-rf-calibrated`.
- `public.profiles` is the correct home for per-user anchor data (Constitution
  Principle II: "Calibration data lives in the user's Supabase row").
- The model artifacts presently in `tmp/model-artifacts/` (`model.joblib`,
  `scaler.joblib`, `metadata.json`) are the artifacts relocated to
  `packages/ml-video/models/`. (Note: the training-results figure on disk is
  named `training-results.png.png`; the MODELS.md prerequisite commit handles
  saving it to its documented location.)
- The 60-second baseline is the locked production duration per Constitution
  Principle II as amended (Amendment 2). Column shapes chosen for the anchor
  vector MUST NOT preclude the feature-005 rolling-window inference loop.
- Manual smoke testing is performed by Mohamed per Constitution Principle VII;
  `smoke-tests.md` is authored during `/speckit.tasks` and signed off after
  `/speckit.implement`.
- User-facing copy in this spec is draft-quality and finalized during
  `/speckit.plan` / `/speckit.tasks` against the Constitution Principle V
  calm-voice rubric.

### Open Questions (resolved with informed defaults; flagged for `/speckit.clarify` and `/speckit.plan`)

These have working defaults so the spec is buildable; each is flagged for
explicit confirmation in `/speckit.clarify` or decision in `/speckit.plan`:

- **Anchor vector column shape** (`jsonb` / `float[]` / `bytea`): deferred to
  `/speckit.plan`; trade-offs (query ergonomics, storage size, float precision,
  future rolling-window compatibility) to be surfaced there. The model contract
  suggests `bytea` or a JSON-encoded array. No spec default — a pure planning
  decision.
- **Who writes the anchor to Supabase**: default leans to the privacy-cleaner
  option — `apps/web/` writes the vector using the user's session-scoped client
  after receiving it in the backend response, avoiding a service-role key in
  the backend. The alternative (FastAPI writes directly with a service-role
  key) is simpler ergonomically. This touches Principle I data flow and the
  Principle IX secrets posture; to be confirmed in `/speckit.clarify` and
  decided in `/speckit.plan` with a `docs/DECISIONS.md` entry.
- **"Skip for now" placement**: default is a low-emphasis affordance available
  throughout the step (not a single bottom-only link), consistent with
  calm-first non-coercion. To be confirmed at `/speckit.clarify`.
- **Banner dismissal persistence**: default per the primary journey — dismissal
  is per-session and the banner reappears each new session until calibration is
  completed (FR-023/FR-024). To be confirmed at `/speckit.clarify` (the
  alternative is persisting a dismissal in `localStorage` until completion).
- **Device-picker memory**: default is to remember the user's chosen camera
  (e.g., in `localStorage`) for next time. To be confirmed at `/speckit.clarify`.
- **Backend health pre-check**: default is yes — the web app pings a backend
  health endpoint before showing the recording step so it fails fast if the
  backend is down, rather than letting the user record 60 seconds first. To be
  confirmed at `/speckit.clarify`.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: A fresh non-demo employee can complete the full happy path (name
  → anchor explanation → pick camera → grant permission → 60-second recording →
  upload → land on `/app`) and, on success, has an anchor recorded on their
  profile and sees no calibration banner — in 100% of successful-extraction
  attempts on the demo/test path.
- **SC-002**: An employee can skip calibration from the anchor step and reach
  `/app` in under 5 seconds, and the calibration banner is present on `/app`
  after skipping, in 100% of attempts.
- **SC-003**: After a successful capture, no calibration banner appears for that
  employee on the current session or any subsequent session, in 100% of
  attempts.
- **SC-004**: After raw-clip processing, the raw video bytes no longer exist on
  the backend and only the vector + timestamp + model-version are persisted, in
  100% of processed clips (verified by backend tests).
- **SC-005**: A team lead or admin cannot retrieve any other user's anchor
  vector through any query path, verified against the row-level-security
  policies (0 successful cross-user anchor reads).
- **SC-006**: After three consecutive extraction failures, the "skip and
  continue without calibration" affordance appears in 100% of cases, and the
  first and second failures never show it.
- **SC-007**: Every `*@demo.serenify.local` employee profile has a
  deterministic synthetic anchor after seeding (identical values across re-runs)
  and shows no calibration banner; 0 non-demo users receive a synthetic anchor.
- **SC-008**: Completing calibration in one tab transitions a sibling tab off
  the completed onboarding step to `/app` without a manual reload, in under 2
  seconds under normal local conditions.
- **SC-009**: No copy in the anchor flow or calibration banner contains an
  exclamation mark or any item from the alarmist/clinical blocklist
  ("REQUIRED", "MANDATORY", "alert", "abnormal", "elevated risk"), verified by
  a static check over the new source files.
- **SC-010**: The entire anchor flow renders correctly at 360px in both light
  and dark modes, with `prefers-reduced-motion` collapsing the countdown to a
  numeric tick and every interactive target ≥44×44px, verified at desktop and
  360px in both themes.
- **SC-011**: The camera is permitted (`camera=(self)`) only on the onboarding
  anchor route and the dashboard re-open route, the site-wide `camera=()`
  default-deny is preserved on all other routes, microphone remains denied
  everywhere, and the FastAPI origin is the only new `connect-src` entry —
  verified by inspecting the emitted security headers.
- **SC-012**: All applicable Constitution Principle VII test layers pass for
  this feature: the Playwright happy-path and skip-path e2e tests, the pytest
  suite for the anchor endpoint (including failure modes and raw-byte deletion),
  and a populated `smoke-tests.md` with the cross-browser webcam-permission
  checks.
