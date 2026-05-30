# Feature Specification: Calibration Capture Flow

**Feature Branch**: `005-calibration-capture-flow`

**Created**: 2026-05-30

**Status**: Draft

**Input**: User description: A UX redesign of the calm-baseline recording
experience shipped in feature 004. Every employee has a personal "calm
baseline" — a short calm recording the stress model measures future readings
against as deltas — so the capture experience is load-bearing for accuracy,
not cosmetic: it must keep the person calm by never leaving them uncertain
(Face-ID-grade guided structure with the calm palette and unhurried pace
layered on top). This feature redesigns the `/app/calibrate` page, the
pre-record "green room", the countdown, the 60-second recording surface, the
stop confirmation, the success and post-recording-failure terminal states, the
three camera-access states, the account-page recalibrate entry, and the home
calibration banner — and ships honest tests for the whole flow. It is **not
greenfield**: feature 004's plumbing (the in-browser recorder, the
post-permission device picker, the backend health pre-check, the codec probe,
and explicit success/failure terminal states) already exists; this feature
redesigns the experience around it. The one genuinely new piece of engineering
is a **client-side face detector** that drives the live framing guide and drift
feedback locally, so the framing guidance works without sending any video off
the device (the model's own face analysis stays server-side, unchanged).

> **House-style note**: per the convention established in
> `specs/003-employee-dashboard-shell/spec.md` and continued in
> `specs/004-onboarding-video-anchor/spec.md`, requirements reference the
> constitution-locked design vocabulary (the "Mist & Meadow" palette tokens —
> `meadow`, `foggy`, `amber`, `crimson`, `muted` — and the calm-voice rubric)
> and the established product surfaces (`/app`, `/app/calibrate`,
> `/app/account`) because those are binding contracts under Constitution
> Principles V and VI, not incidental implementation choices. The
> colour-discipline rule the input calls "FR-042" is **Constitution
> Principle V**: amber is reserved for stress/affective signals only, crimson
> for destructive action surfaces only; calibration and error surfaces use the
> calm `foggy` / `meadow` / neutral language. The choice of in-browser face
> detection technology, model hosting, and the related browser-policy
> implications are deferred to `/speckit-plan` (see Dependencies).

## User Scenarios & Testing *(mandatory)*

### User Story 1 - An employee sets their calm baseline, calmly and without uncertainty (Priority: P1)

A first-time employee opens `/app/calibrate` (during or after onboarding, or
from the home banner) and sees a clear heading, "Set your calm baseline", a
short calm explanation of what is about to happen and why, three icon-led
what-to-expect lines, a privacy reassurance, and a single primary action,
"Turn on camera", with a short line setting the expectation that the browser
will ask for permission next. Granting permission turns the page into the
"green room": a live self-view with a fixed, centred portrait target marked by
corner brackets, the area outside the target gently dimmed so the brackets stay
legible, a private-camera reassurance, the device picker sitting quietly, and a
primary action, "I'm ready", which stays disabled with a calm helper line until
the user is set. Pressing "I'm ready" is the user's explicit go-ahead and
starts a gentle 3 → 2 → 1 countdown over a preview that blurs and then eases
out of blur as recording begins. For 60 seconds the breathing guide (a slow
4-in / 6-out rhythm) is the focal point over a softened preview, a 60-second
timer is the only progress indicator, the corner brackets persist as an ambient
framing layer, and a soft "we've got you" reassurance is present. When the
minute completes and processing sets the baseline, a small earned moment plays
— a drawn check mark with a soft bloom ripple, the heading "Your baseline is
set", readable supporting copy, and "Back to home", which returns to `/app`
with the calibration banner gone.

**Why this priority**: The calm baseline is the precondition for every future
stress reading (Constitution Principle II: all predictions are deltas from the
per-user baseline; there is no global fallback). A baseline captured while the
user is tense or uncertain quietly skews every later reading, so the calm,
guided quality of this single journey is the headline value of the feature, not
a polish item. This is the path every real employee is expected to take.

**Independent Test**: As a fresh employee with a working camera, open
`/app/calibrate`, read the intro, press "Turn on camera", grant permission,
confirm the green room appears with corner brackets, a dimmed surround, a
sharp face area, and a quiet device picker; once set, confirm "I'm ready"
enables, press it, watch the 3 → 2 → 1 countdown with the blur easing out as
recording starts, confirm the breathing guide and 60-second timer run for the
full minute, and confirm the success moment with the correct heading and a
readable body, then "Back to home" lands on `/app` with no calibration banner.

**Acceptance Scenarios**:

1. **Given** an employee on `/app/calibrate` before camera access, **When** the
   page loads, **Then** it shows the heading "Set your calm baseline", a short
   calm explanation, three icon-led what-to-expect lines ("A quiet moment to
   yourself", "Good lighting on your face", "About a minute, sitting still"), a
   privacy reassurance ("Your video isn't stored — only the calm reading it
   produces"), a single primary action ("Turn on camera"), and a short line
   that the browser will ask for permission next.
2. **Given** the intro state, **When** the employee presses "Turn on camera"
   and grants permission, **Then** the page becomes the green room with a live
   self-view, fixed centred corner brackets, a gently dimmed surround with the
   face area kept sharp, a private-camera reassurance ("only you see this"),
   the device picker, an "I'm ready" primary action, and a clear "Not now"
   exit.
3. **Given** the green room with the user set within the target, **When** the
   gate clears, **Then** "I'm ready" becomes enabled and the calm helper line
   updates from its waiting state.
4. **Given** an enabled "I'm ready", **When** the employee presses it, **Then**
   a 3 → 2 → 1 countdown (numbers only, no draining ring) runs while the
   preview blurs, with a quiet "Cancel" available, and the blur eases out as
   recording begins.
5. **Given** an in-progress recording, **When** the minute runs, **Then** the
   breathing guide (4-in / 6-out) is the focal point over a softened preview,
   the 60-second timer is the only progress indicator, the corner brackets
   persist, a soft "we've got you" reassurance is present, and a clear, calm
   way to stop is available.
6. **Given** the 60-second recording completes and processing sets the
   baseline, **When** the success state renders, **Then** it shows a drawn
   check mark with a soft bloom ripple, the heading "Your baseline is set",
   readable supporting copy (not the under-sized 004 text), and a "Back to
   home" action that returns to `/app` with no calibration banner shown.

---

### User Story 2 - The framing guide gates softly and never locks the user out (Priority: P1)

The green-room framing guide is driven by client-side face detection and has
three states. While the detector is loading, the user sees a brief loading
state. When the detector is running, the corner brackets confirm when the user
is set and a soft quality gate enables "I'm ready" — gating only on obvious
dealbreakers (no face detected, badly off-centre, or basically too dark) with
forgiving thresholds, so people who look fine to themselves are never blocked.
If the detector cannot run at all (for example, a weak device), the experience
falls back to "no live guide — you can still record" with a short note, and the
user can proceed rather than being trapped behind a feature that did not load.
During the recording, the brackets persist as an ambient framing layer
independent of how sharp the preview is: quiet and receding when centred; a
gentle, foggy "ease back to centre" nudge — never an alarm — only after a brief
grace period when the face drifts (a momentary wobble never trips it); and a
calm "we can't see you — ease back into view" when the face is absent.

**Why this priority**: This story is what makes the capture both accurate and
humane. A guide that hugs the face, alarms on a wobble, or hard-blocks a
fine-looking user would either skew the baseline or break the calm; a guide
that traps a user behind a detector that failed to load would deny them the
product entirely. The "never lock the user out" guarantee and the forgiving,
ambient framing are co-equal with the happy path — together they define the
load-bearing experience.

**Independent Test**: Exercise each guide state independently — force the
detector into its loading state and confirm the brief loading affordance;
confirm a centred, adequately lit face clears the soft gate and a no-face /
badly-off-centre / too-dark frame holds it with a calm helper line; force the
detector to be unavailable and confirm the "no live guide — you can still
record" fallback enables "I'm ready" so the user can proceed; during a
recording, drift the face briefly (under the grace window) and confirm no
nudge, drift past the grace window and confirm the calm "ease back to centre"
nudge, and remove the face entirely and confirm the calm "we can't see you"
message — with the recording continuing throughout.

**Acceptance Scenarios**:

1. **Given** the green room while the face detector is still loading, **When**
   the page is shown, **Then** a brief loading state is displayed for the live
   guide and "I'm ready" stays disabled with a calm helper line.
2. **Given** the detector running, **When** the user is centred within the
   target and adequately lit, **Then** the soft gate clears and "I'm ready"
   enables; **When** there is no detectable face, the user is badly off-centre,
   or the frame is basically too dark, **Then** the gate holds with a calm,
   forgiving helper line and does not block a user who looks fine to themselves.
3. **Given** a device where the detector cannot run at all, **When** the
   fallback engages, **Then** the user sees "no live guide — you can still
   record" with a short note, "I'm ready" is available, and the user is not
   trapped behind the unavailable guide.
4. **Given** an in-progress recording with the user centred, **When** frames
   are processed, **Then** the corner brackets are quiet and receding and no
   nudge is shown.
5. **Given** an in-progress recording, **When** the face drifts off-target for
   less than the grace period, **Then** no nudge appears and the recording
   continues unaffected; **When** the face stays off-target beyond the grace
   period, **Then** a gentle, foggy "ease back to centre" nudge appears (never
   an alarm, never crimson, never amber).
6. **Given** an in-progress recording, **When** no face is detected, **Then** a
   calm "we can't see you — ease back into view" message appears and the
   recording continues (it is not auto-stopped).
7. **Given** the green room, **When** a **first-time** user activates "Not now",
   **Then** they exit without recording to `/app` with the not-yet-calibrated
   banner showing; **When** a **recalibrating** user activates "Not now", **Then**
   they return to the account page with the existing baseline intact and no banner
   (FR-007, FR-053).

---

### User Story 3 - Stopping starts the minute over without losing anything (Priority: P2)

While recording, the employee can stop at any time via a clear, calm control.
Stopping asks for confirmation with honest framing: stopping means starting the
minute over, and nothing is saved yet, so nothing is lost. "Keep going" is the
easy default. Confirming the stop returns the user to the green room to
re-situate — not straight into a fresh countdown. This is not a destructive
action and does not use the destructive colour.

**Why this priority**: The happy path (US1) already delivers a working capture;
this hardens the in-recording exit so a user who needs to stop is met with an
honest, low-stakes choice rather than a destructive-feeling dead-end. It also
protects accuracy by returning the user to the green room to settle before
re-recording, rather than rushing them into a new countdown while flustered.

**Independent Test**: Start a recording, activate the stop control, confirm a
confirmation appears framing the stop as "starting the minute over" with
"nothing saved yet, so nothing is lost", with "Keep going" as the easy default
and no destructive (crimson) styling; choose "Keep going" and confirm the
recording continues; activate stop again, confirm the stop, and confirm the
user lands back in the green room (not a fresh countdown) with nothing
persisted.

**Acceptance Scenarios**:

1. **Given** an in-progress recording, **When** the employee activates the stop
   control, **Then** a confirmation appears stating that stopping starts the
   minute over and that nothing is saved yet so nothing is lost, with "Keep
   going" presented as the easy default.
2. **Given** the stop confirmation, **When** the employee chooses "Keep going",
   **Then** the confirmation dismisses and the recording continues from where
   it was.
3. **Given** the stop confirmation, **When** the employee confirms the stop,
   **Then** the user is returned to the green room to re-situate (not into a
   fresh countdown) and no baseline or partial recording is persisted.
4. **Given** the stop confirmation surface, **When** it is rendered, **Then** it
   does not use the destructive colour (crimson) and reads as a calm,
   reversible choice rather than a destructive one.

---

### User Story 4 - Calm, specific recovery when the camera can't be reached (Priority: P2)

Before recording, the single generic "camera access denied" is replaced by
three specific, calm states, each naming the problem and the fix, all foggy
(never red or amber): **Blocked** (permission denied) points the user to
re-enable the camera in the browser's address bar; **Busy** (camera in use by
another app) names the usual culprits — video-call or streaming apps — and that
closing them frees it up; **No camera found** asks the user to connect or
enable one, then pick it from the selector. Each offers "Try again" and "Not
now"; "Not now" defers calibration and returns to `/app` with the banner still
showing, the honest not-yet-calibrated state.

**Why this priority**: Camera-access problems are common and benign, and a
single generic error leaves the user guessing at the cause and the fix. Naming
the specific situation and the concrete next step keeps the user calm and
moving rather than stuck, and the "Not now" exit guarantees no dead-end. It
hardens the pre-recording unhappy path that US1 assumes works.

**Independent Test**: Drive each camera-access condition independently —
permission denied, camera in use by another process, and no video input device
present — and confirm each shows its own distinct, foggy state naming the
problem and the matching fix, that none use red or amber, and that each offers
"Try again" and "Not now" where "Not now" lands on `/app` with the calibration
banner still present.

**Acceptance Scenarios**:

1. **Given** the employee on `/app/calibrate`, **When** camera permission is
   denied, **Then** a foggy "Blocked" state explains the camera is blocked and
   points the user to re-enable it in the browser's address bar, with "Try
   again" and "Not now".
2. **Given** the employee on `/app/calibrate`, **When** the camera is in use by
   another application, **Then** a foggy "Busy" state names the usual culprits
   (video-call or streaming apps) and that closing them frees the camera, with
   "Try again" and "Not now".
3. **Given** the employee on `/app/calibrate`, **When** no camera device is
   available, **Then** a foggy "No camera found" state asks the user to connect
   or enable one and then pick it from the selector, with "Try again" and "Not
   now".
4. **Given** any camera-access state in a **first-time** capture, **When** the
   employee activates "Not now", **Then** calibration is deferred and the user
   returns to `/app` with the calibration banner still showing; **Given** the same
   state during a **recalibration**, **When** they activate "Not now", **Then**
   their existing baseline is kept (no overwrite), no banner is shown, calibration
   is not described as deferred, and they return to the account page they started
   from.
5. **Given** any camera-access state, **When** it is rendered, **Then** it uses
   the foggy/neutral language and never red or amber, and meets WCAG AA contrast
   in both light and dark modes.

---

### User Story 5 - Calm recovery when the baseline can't be set (Priority: P2)

When the minute recorded but processing could not set the baseline, the
employee sees a calm sibling of the success state — distinct from the
camera-access errors, which happen earlier. It is foggy (never red, never
amber, because a processing hiccup is neither stress nor destructive), honest,
and free of self-blame. A small cause chip (an icon plus one line) names the
actual reason and adapts to it: low light → "facing a little more light usually
helps"; moved out of frame → "staying roughly centred and still helps"; our
side → "this one was on our side — give it a moment and try again" (we own our
own failures and do not hand the user a "do better" tip). It offers "Try again"
and "Not now". After several attempts, a gentle escape appears — "Let's pause
this for now — you can set your baseline later from your account" — with "Maybe
later" and "Try once more".

**Why this priority**: Real recordings fail for benign reasons (lighting,
framing, a transient processing issue), and a generic or self-blaming failure
on the user's first experience of the product would undercut the calm stance
the whole feature exists to protect. The adaptive cause chip turns a dead-end
into a specific, actionable, non-blaming next step, and the escape hatch ensures
the user is never trapped in a failure loop. It hardens the post-recording
unhappy path.

**Independent Test**: Drive the post-recording processing to fail with each
distinct cause (low light, out-of-frame, our-side) and confirm the foggy
failure state shows the matching cause chip with the correct one-line guidance,
that the our-side case owns the failure rather than instructing the user, and
that none of the states use red or amber. Repeat the failure to the configured
attempt threshold and confirm the gentle escape ("Maybe later" / "Try once
more") appears, and that "Maybe later" defers calibration to the account page.

**Acceptance Scenarios**:

1. **Given** a recorded minute that processing could not turn into a baseline,
   **When** the failure state renders, **Then** it is foggy (never red or
   amber), honest, free of self-blame, and visually a calm sibling of the
   success state, with "Try again" and "Not now".
2. **Given** the failure was a low-light cause, **When** the cause chip renders,
   **Then** it shows an icon plus "facing a little more light usually helps";
   **Given** an out-of-frame cause, **Then** it shows "staying roughly centred
   and still helps"; **Given** an our-side cause, **Then** it shows "this one
   was on our side — give it a moment and try again" without any "do better"
   instruction to the user.
3. **Given** the failure state, **When** the employee activates "Try again",
   **Then** the capture flow restarts at the green room (camera access already
   granted); **When** a **first-time** user activates "Not now", **Then**
   calibration is deferred and they return to `/app` with the banner still
   showing; **When** a **recalibrating** user activates "Not now", **Then** their
   existing baseline is kept (no overwrite), no banner is shown, and they return
   to the account page.
4. **Given** several consecutive post-recording failures reaching the configured
   threshold, **When** the next failure renders, **Then** a gentle escape
   appears — "Let's pause this for now — you can set your baseline later from
   your account" — with "Maybe later" and "Try once more".
5. **Given** the gentle escape in a **first-time** capture, **When** the employee
   activates "Maybe later", **Then** calibration is deferred (recoverable later
   from the account page) and the user is not trapped in a retry loop; **Given**
   the escape during a **recalibration**, **When** they activate "Maybe later",
   **Then** their existing baseline is kept (no overwrite), no banner is shown,
   and they return to the account page.

---

### User Story 6 - A returning employee updates their baseline from their account (Priority: P2)

On the account page, a calm "Your calm baseline" section shows whether a
baseline is set, with a quiet "Set a new baseline" action. Choosing it shows an
honest heads-up that doing so replaces the current baseline ("Keep current" /
"Set new baseline") — not destructive styling, because it is reversible by
recalibrating again. Confirming launches the same capture flow, with copy
nudged from "set" to "update", so success reads "Your baseline is updated". The
copy stays baseline-focused and does not imply that live stress check-ins are
already running.

**Why this priority**: The baseline can drift from the person over time (new
glasses, a different desk, a changed routine), so a returning employee needs a
calm, deliberate way to re-set it without going back through onboarding. It is a
distinct journey from first-time capture and reuses the same flow, so it is
valuable but secondary to getting the first baseline captured well.

**Independent Test**: As an employee with a baseline already set, open the
account page, confirm the "Your calm baseline" section shows the baseline is
set with a "Set a new baseline" action; activate it and confirm an honest
"replaces the current baseline" heads-up with "Keep current" and "Set new
baseline" and no destructive styling; choose "Keep current" and confirm nothing
changes; re-enter, choose "Set new baseline", and confirm the same capture flow
runs with "update" copy and a success heading of "Your baseline is updated",
with no copy implying live check-ins are running. Separately, confirm that
stopping, failing, or choosing "Not now" / "Maybe later" during a recalibration
leaves the existing baseline intact, shows no banner, and returns to the account
page.

**Acceptance Scenarios**:

1. **Given** an employee on the account page, **When** the page renders, **Then**
   a calm "Your calm baseline" section shows whether a baseline is set, with a
   quiet "Set a new baseline" action.
2. **Given** the "Set a new baseline" action, **When** the employee activates
   it, **Then** an honest heads-up explains it replaces the current baseline,
   with "Keep current" and "Set new baseline", using non-destructive (not
   crimson) styling.
3. **Given** the replace heads-up, **When** the employee chooses "Keep current",
   **Then** the existing baseline is unchanged and the flow is not launched.
4. **Given** the employee confirms "Set new baseline", **When** the capture flow
   launches, **Then** it is the same flow as first-time capture with copy nudged
   from "set" to "update", and on success the heading reads "Your baseline is
   updated".
5. **Given** any recalibrate copy, **When** it is read, **Then** it stays
   baseline-focused and does not imply that live stress check-ins are already
   running.
6. **Given** a recalibration in progress, **When** the user stops the recording,
   **Then** the existing baseline is left untouched and they return to the green
   room to re-situate (nothing is saved until success); **When** the processing
   fails and they then choose "Not now" / "Maybe later", **Then** the existing
   baseline is still untouched, no home banner is shown, calibration is not
   described as deferred, and they return to the account page they started from.
7. **Given** a recalibration in the green room (before the countdown), **When**
   the user activates "Not now", **Then** their existing baseline is left intact,
   no home banner is shown, and they return to the account page they started from
   (FR-007, FR-053).

---

### User Story 7 - The home banner nudges only until calibrated, in foggy not amber (Priority: P3)

On `/app`, a refreshed calibration banner shows only when the employee has not
calibrated yet and disappears the moment they do — there is no persistent
"you're calibrated" banner anywhere. It uses a foggy treatment (a "needs your
attention, not stress" state) rather than amber, with a meadow primary button
("Set baseline"). It is dismissible for the session and reappears next session
until calibration is complete.

**Why this priority**: The banner already exists from feature 004; this feature
refreshes its treatment (correcting 004's amber to foggy per Constitution
Principle V), confirms its meadow primary action, and makes its
appear/disappear/persist behaviour honest and well-tested. Because it restyles
and hardens an existing nudge rather than adding a net-new capability, it is the
lowest priority slice — but it is the entry point that returns un-calibrated
users to the flow, so its correctness matters.

**Independent Test**: As an un-calibrated employee, confirm `/app` shows the
foggy calibration banner with a meadow "Set baseline" button and no amber;
dismiss it and confirm it stays hidden for the session; start a new session and
confirm it reappears; complete calibration and confirm it disappears
immediately and never returns, with no "you're calibrated" banner replacing it.

**Acceptance Scenarios**:

1. **Given** an un-calibrated employee, **When** they land on `/app`, **Then** a
   foggy calibration banner is shown with a meadow primary button labelled "Set
   baseline" and no amber treatment anywhere on it.
2. **Given** the banner, **When** the employee dismisses it, **Then** it
   disappears for the remainder of the current session.
3. **Given** an employee who dismissed the banner earlier, **When** they start a
   new session without having calibrated, **Then** the banner reappears.
4. **Given** an employee who completes calibration, **When** the baseline is
   set, **Then** the banner disappears immediately and does not reappear in any
   future session, and no persistent "you're calibrated" banner is shown.

---

### Edge Cases

- **Detector loads after "Turn on camera"**: the green room shows the brief
  loading guide state and enables "I'm ready" once the detector comes up and the
  soft gate clears; the user is never blocked by load latency alone.
- **Detector never loads (weak device)**: the "no live guide — you can still
  record" fallback engages, the soft gate is bypassed, and "I'm ready" is
  available so the user can proceed and record.
- **Brief wobble during recording**: a face that leaves the target for less than
  the grace period produces no nudge and does not affect the timer — the model
  tolerates brief stray frames, so a momentary wobble must never trip the guide.
- **Sustained drift / face absent during recording**: the calm "ease back to
  centre" or "we can't see you" message appears, but the recording continues for
  the full minute rather than being auto-stopped.
- **`prefers-reduced-motion` enabled**: the breathing guide, the 3 → 2 → 1
  countdown, the success bloom ripple, the bracket-drift nudge, and the
  countdown blur transition each present a true motion-free equivalent that
  conveys the same thing — not merely a slowed-down version.
- **360px viewport**: the entire flow — and the recording screen in particular —
  is deliberately designed and fully functional at 360px width (not a shrunk
  desktop layout), with every interactive target ≥44×44px.
- **Cancel during countdown vs stop during recording**: the countdown offers a
  quiet "Cancel" (no confirmation needed, nothing recorded yet); the recording
  offers the stop control, which prompts the honest "start the minute over"
  confirmation (US3).
- **Permission already granted (returning user)**: pressing "Turn on camera"
  when the browser has already granted access proceeds straight to the green
  room without a second prompt.
- **Camera lost mid-session (unplugged or claimed by another app during the
  green room or recording)**: the flow surfaces the matching calm camera-access
  state (Busy / No camera found) rather than failing silently.
- **Recalibrate "Keep current"**: choosing to keep the current baseline makes no
  change and does not launch the flow; the existing baseline is untouched.
- **Abort, failure, or defer during a recalibration**: the existing baseline is
  left untouched in every case (overwritten only on success — no baseline history
  is kept). Stopping returns the user to the green room to re-situate; a processing
  failure shows the failure state; and the deferral exits ("Not now" / "Maybe
  later") show no home banner, do not describe calibration as deferred, and return
  the user to the account page they started from.
- **Banner dismissed then calibrated in the same session**: the banner is
  already hidden; completing calibration keeps it permanently gone with no
  flicker or reappearance.
- **Success reached, then the user navigates back**: the baseline is already
  set; the user is not re-prompted and the banner does not reappear.
- **Device selection after the remembered value was cleared**: selecting a
  camera always (re-)writes the remembered-device preference, including after the
  stored value was cleared, so remembered-device behaviour does not silently
  break for the session.
- **Light/dark parity**: every state (intro, green room, countdown, recording,
  stop confirmation, success, failure, all three camera-access states, the
  account section, and the banner) is designed in tandem for both modes and
  meets WCAG AA contrast.
- **Live inference language**: no surface in this flow implies that live stress
  check-ins are already running (live inference is a later feature); copy stays
  baseline-focused.

## Requirements *(mandatory)*

> **Numbering note**: FR-IDs in this spec are spec-local (they restart at FR-001
> per feature) and are NOT the project's legacy "FR-042" colour shorthand. Where
> this spec means the colour rule, it says "Constitution Principle V".

### Functional Requirements — `/app/calibrate` intro state

- **FR-001**: The `/app/calibrate` page MUST present a pre-camera-access intro
  state with a clear heading ("Set your calm baseline"), a short calm
  explanation of what is about to happen and why, three icon-led what-to-expect
  lines ("A quiet moment to yourself", "Good lighting on your face", "About a
  minute, sitting still"), and a privacy reassurance ("Your video isn't stored
  — only the calm reading it produces").
- **FR-002**: The intro state MUST offer a single primary action ("Turn on
  camera") that requests camera permission, and a short line that sets the
  expectation that the browser will ask for permission next.
- **FR-003**: On camera access being granted, the `/app/calibrate` page MUST
  transition into the green room (FR-006…FR-013); the device picker MUST live in
  the green room, not in the intro state, because camera names are only
  available once access is granted.
- **FR-004**: When the browser has already granted camera access, pressing "Turn
  on camera" MUST proceed to the green room without forcing a redundant second
  permission prompt.
- **FR-055**: Entering `/app/calibrate` from the home-banner CTA (FR-043) **and**
  from the recalibrate "Set new baseline" action (FR-038) MUST be a full
  navigation (not an in-app client-side link), so the per-route camera
  Permissions-Policy applies (feature 004 DECISION-16 and the entry-rule smoke
  fix). This MUST NOT regress in the redesign.

### Functional Requirements — Green room & live framing guide

- **FR-005**: The green room MUST show a live self-view with a **fixed, centred
  portrait target** marked by **corner brackets** — a steady guide the user
  settles into, NOT a box that tracks or hugs the detected face.
- **FR-006**: The area outside the target MUST be gently dimmed (a soft
  spotlight) so the brackets stay legible over any camera background and the eye
  is drawn to centre, while the face area inside the target stays sharp.
- **FR-007**: The green room MUST present a reassurance that the camera is
  private ("only you see this"), the device picker (sitting quietly), a primary
  action "I'm ready", and a clear "Not now" that exits without recording. "Not
  now" follows the context split (FR-053): for a **first-time** capture it defers
  calibration and returns to `/app` with the not-yet-calibrated banner showing;
  during a **recalibration** it returns to the account page with the existing
  baseline intact and no banner.
- **FR-008**: "I'm ready" MUST be disabled with a calm helper line until the
  soft quality gate clears; pressing it is the user's explicit go-ahead and MUST
  start the countdown (FR-014).
- **FR-009**: The soft quality gate MUST gate only on obvious dealbreakers — no
  face detected, badly off-centre, or basically too dark — with forgiving
  thresholds, and MUST NOT block users who look fine to themselves.
- **FR-010**: The live framing guide MUST be driven by **client-side, in-browser
  face detection** that runs locally and sends no video off the device; it MUST
  support three states: (a) a brief loading state while the detector loads; (b)
  an active state where the detector drives the brackets and the gate; (c) a
  fallback state — "no live guide — you can still record" with a short note —
  when the detector cannot run at all.
- **FR-011**: In the fallback state, "I'm ready" MUST be available (the soft gate
  is bypassed) so the user is never trapped behind a framing guide that did not
  load.
- **FR-056**: The feature-004 backend health pre-check (`GET /healthz`) MUST gate
  entry to recording — run before the green room or before the countdown — and on
  an unavailable or not-ready backend MUST show feature 004's calm "calibration is
  temporarily unavailable, please try again later" copy, so a user never records a
  full minute into a dead backend.

### Functional Requirements — Countdown

- **FR-012**: Pressing "I'm ready" MUST start a simple 3 → 2 → 1 countdown,
  numbers only, with no draining-ring or progress-style indicator.
- **FR-013**: The preview MUST blur through the countdown and then ease from the
  heavier countdown blur to the lighter **softened** recording state (a soft
  "beginning now") — NEVER to a fully sharp image. A full un-blur (a sharp,
  prominent face at the moment recording starts) is explicitly not wanted: it
  reads as a spotlight and pulls focus from the breathing guide. The target
  end-state is softened, not sharp, consistent with FR-015.
- **FR-014**: A quiet "Cancel" MUST be available during the countdown; cancelling
  records nothing and returns the user to the green room.

### Functional Requirements — The 60-second recording

- **FR-015**: The recording MUST run for 60 seconds (the locked baseline duration
  per Constitution Principle II / the model contract); the composition MUST place
  the breathing guide over a softened preview, where the softness reads as
  deliberate because the guide is layered on top.
- **FR-016**: The breathing guide MUST be the focal point with a slow 4-in / 6-out
  rhythm and MUST NOT be a progress indicator; the 60-second timer MUST be the
  sole progress indicator.
- **FR-017**: The corner brackets MUST persist during recording as an ambient
  framing layer driven by the face detector, independent of how sharp the preview
  is: quiet and receding when the user is centred; a gentle, foggy "ease back to
  centre" nudge — never an alarm — only after a brief grace period when the face
  drifts; and a calm "we can't see you — ease back into view" when the face is
  absent.
- **FR-018**: The drift nudge MUST NOT trigger on a momentary wobble: it MUST
  appear only after the face has been off-target continuously for a brief grace
  period (a tunable threshold on the order of a couple of seconds, so the model's
  tolerance of brief stray frames is respected).
- **FR-019**: A soft "we've got you" reassurance MUST be present during recording,
  and a clear, calm way to stop MUST be available at any time.
- **FR-020**: A sustained drift or absent face MUST NOT auto-stop the recording;
  the minute continues so the model receives a full baseline.

### Functional Requirements — Stop confirmation

- **FR-021**: Activating the stop control during recording MUST ask for
  confirmation with honest framing: stopping means starting the minute over, and
  nothing is saved yet, so nothing is lost.
- **FR-022**: "Keep going" MUST be the easy default of the stop confirmation and
  MUST resume the in-progress recording when chosen.
- **FR-023**: Confirming the stop MUST return the user to the green room to
  re-situate (NOT straight into a fresh countdown), and MUST persist no baseline
  or partial recording.
- **FR-024**: The stop confirmation MUST NOT use the destructive colour (crimson);
  it is a calm, reversible choice, not a destructive action.

### Functional Requirements — Success state

- **FR-025**: On a baseline being set, the success state MUST show a drawn check
  mark with a soft bloom ripple, the heading "Your baseline is set" (or "Your
  baseline is updated" in the recalibrate path, FR-039), and supporting copy
  sized for readability (correcting the under-sized 004 success text).
- **FR-026**: The success state MUST offer "Back to home", which returns to `/app`
  with the calibration banner gone.

### Functional Requirements — Post-recording failure state

- **FR-027**: When the minute recorded but processing could not set the baseline,
  the failure state MUST be foggy (never red, never amber), honest, free of
  self-blame, and a visual calm sibling of the success state. It is distinct from
  the camera-access states (FR-031…FR-035), which occur earlier.
- **FR-028**: The failure state MUST show a small cause chip (an icon plus one
  line) that names the actual reason and adapts to it — at minimum: low light →
  "facing a little more light usually helps"; moved out of frame → "staying
  roughly centred and still helps"; our side → "this one was on our side — give
  it a moment and try again". The our-side message MUST own the failure and MUST
  NOT hand the user a "do better" tip.
- **FR-029**: The failure state MUST offer "Try again", which restarts the capture
  flow at the **green room** (camera access already granted — not the intro
  state), and "Not now", whose behaviour depends on context (FR-053): for a
  **first-time** capture, "Not now" defers calibration and returns to `/app` with
  the not-yet-calibrated banner showing; for a **recalibration**, "Not now" keeps
  the existing baseline (no overwrite), shows no banner, does not describe
  calibration as deferred, and returns to the **account page** the user started
  from.
- **FR-030**: After several consecutive post-recording failures reaching a
  configured threshold, a gentle escape MUST appear — "Let's pause this for now —
  you can set your baseline later from your account" — with "Maybe later" and
  "Try once more"; the threshold MUST NOT show the escape on the first failures.
  "Maybe later" follows the same context split as FR-029's "Not now" (first-time
  defers to `/app` with the banner; recalibration keeps the existing baseline,
  shows no banner, and returns to the account page), with the escape copy nudged
  "set" → "update" in the recalibrate path per FR-038 / FR-040.

### Functional Requirements — Camera-access states

- **FR-031**: The pre-recording camera-access failure MUST be split into three
  specific, calm states (replacing the single generic "camera access denied"),
  each naming the problem and the fix, all foggy and never red or amber.
- **FR-032**: The **Blocked** state (permission denied) MUST point the user to
  re-enable the camera in the browser's address bar.
- **FR-033**: The **Busy** state (camera in use by another app) MUST name the
  usual culprits (video-call or streaming apps) and that closing them frees the
  camera.
- **FR-034**: The **No camera found** state MUST ask the user to connect or enable
  a camera and then pick it from the selector.
- **FR-035**: Each camera-access state MUST offer "Try again" and "Not now". For a
  **first-time** capture, "Not now" defers calibration and returns to `/app` with
  the not-yet-calibrated banner still showing. For a **recalibration**, "Not now"
  keeps the existing baseline (no overwrite), shows no banner, does not describe
  calibration as deferred, and returns to the **account page** the user started
  from (FR-053).

### Functional Requirements — Recalibrate entry (account page)

- **FR-036**: The account page MUST present a calm "Your calm baseline" section
  showing whether a baseline is set, with a quiet "Set a new baseline" action.
- **FR-037**: Activating "Set a new baseline" MUST show an honest heads-up that
  doing so replaces the current baseline, with "Keep current" and "Set new
  baseline", using non-destructive (not crimson) styling; "Keep current" MUST
  leave the existing baseline unchanged and MUST NOT launch the flow.
- **FR-038**: Confirming "Set new baseline" MUST launch the same capture flow as
  first-time capture, with copy nudged from "set" to "update". The stored baseline
  is overwritten only on a successful capture (FR-053); aborting or failing the
  recalibration leaves the existing baseline in place.
- **FR-039**: In the recalibrate path, the success heading MUST read "Your
  baseline is updated".
- **FR-040**: All recalibrate copy MUST stay baseline-focused and MUST NOT imply
  that live stress check-ins are already running.
- **FR-041**: The account "Your calm baseline" section MUST surface only whether
  a baseline is set, not the capture date, unless a self-scoped date read is
  deliberately added during planning (see Dependencies / Assumptions); this
  feature MUST NOT expose another user's calibration state or date.
- **FR-053**: A recalibration MUST overwrite the stored baseline **only on
  success**. Stopping (FR-023), a processing failure (FR-027…FR-030), or any "Not
  now" / "Maybe later" during a recalibration MUST leave the **existing baseline
  untouched** — the user remains calibrated with their prior baseline. No baseline
  history is kept: on success the new baseline replaces the old in place.
  Navigation for the in-flow cases is unchanged by context (stopping returns to
  the green room to re-situate per FR-023; a processing failure shows the failure
  state per FR-027); only the deferral exits differ — for a recalibration, "Not
  now" / "Maybe later" show no home banner, do not describe calibration as
  deferred, and return the user to the account page they started from, whereas for
  a first-time capture those exits defer calibration and show the banner (FR-029,
  FR-030, FR-035).

### Functional Requirements — Home calibration banner

- **FR-042**: The `/app` calibration banner MUST be shown only when the employee
  has not calibrated yet and MUST disappear the moment they do; there MUST be no
  persistent "you're calibrated" banner anywhere.
- **FR-043**: The banner MUST use a **foggy** treatment (a "needs your attention,
  not stress" state) — NOT amber — with a **meadow** primary button labelled "Set
  baseline" (correcting feature 004's amber banner per Constitution Principle V).
- **FR-044**: The banner MUST be dismissible for the session and MUST reappear in
  a new session while the employee remains un-calibrated, until calibration is
  complete.
- **FR-054**: The banner MUST inherit feature 004's cross-tab behaviour unchanged:
  completing calibration in one tab drops the banner in sibling tabs, and
  dismissing the banner mirrors the dismissal across tabs. The restyle MUST NOT
  regress this behaviour.

### Functional Requirements — Recorder device-memory fix

- **FR-045**: Selecting a camera MUST always (re-)write the remembered-device
  preference, including after the stored value was cleared, so remembered-device
  behaviour does not silently break for a session.

### Functional Requirements — Colour discipline, calm voice & accessibility

- **FR-046**: No calibration or error surface in this feature MUST use amber
  (amber is reserved for stress/affective signals only) or crimson (reserved for
  destructive action surfaces only); these surfaces MUST use the calm `foggy` /
  `meadow` / neutral language, and affirmative confirmation MUST use `meadow`
  (Constitution Principle V).
- **FR-047**: All copy across this feature MUST use the calm, non-alarmist voice
  (Constitution Principle V): "noticed" not "detected", no exclamation marks,
  suggest rather than prescribe, and a first-person-plural partner tone.
- **FR-048**: Every animated element — the breathing guide, the 3 → 2 → 1
  countdown, the success bloom ripple, the bracket-drift nudge, and the countdown
  blur transition — MUST have a true zero-motion alternative for reduced-motion
  users that conveys the same thing (not merely a slowed-down version), per
  Constitution Principle VI.
- **FR-049**: Every surface in this feature MUST be mobile-first and deliberately
  designed and fully functional at 360px width — the recording screen in
  particular MUST NOT be a shrunk desktop layout — with all interactive targets
  ≥44×44px and light and dark designed in tandem, both meeting WCAG AA contrast
  (Constitution Principle VI).

### Functional Requirements — Privacy of client-side detection

- **FR-050**: The framing guide and drift feedback MUST be computed by
  client-side face detection only; no video frames may be sent anywhere for the
  purpose of framing guidance. The model's own server-side face analysis (the
  baseline extraction shipped in feature 004) is unchanged and remains the only
  path by which a recording leaves the device (Constitution Principle I).

### Functional Requirements — Honest tests for this flow (Constitution Principle VII)

- **FR-051**: This feature MUST ship with tests that genuinely exercise its real
  behaviour — not mock-masked tests that let real defects pass as green —
  covering: the capture states (intro, green room, countdown, recording,
  success); the soft quality gate and the three guide states including the
  fallback; the stop confirmation returning to the green room; the three
  camera-access states; the post-recording failure state with its adaptive cause
  chip and the escape hatch; the recalibrate path; and the banner's
  appear/disappear/persist behaviour.
- **FR-052**: The device-memory fix (FR-045) MUST be covered by a test that fails
  against the pre-fix behaviour (selecting a camera after the stored value was
  cleared does not re-write the preference) and passes against the fixed
  behaviour.

### Key Entities

- **Calm baseline**: the per-user calibration reference (the stored anchor from
  feature 004) the stress model measures future readings against as deltas.
  Whether it is set is the single signal this feature reads to decide banner and
  account-section state; its capture date stays private unless a self-scoped read
  is deliberately added (FR-041).
- **Capture flow**: the staged experience hosted at `/app/calibrate` — intro →
  green room → countdown → 60-second recording → success, with stop-confirmation,
  post-recording-failure, and camera-access branches. The same flow is reused for
  first-time capture and recalibration, with "set" → "update" copy in the latter.
- **Live framing guide**: the client-side, in-browser face-detection-driven
  guidance comprising the fixed centred corner brackets, the soft quality gate,
  the three guide states (loading / active / fallback), and the in-recording
  drift feedback (quiet / "ease back to centre" / "we can't see you").
- **Cause chip**: the small icon-plus-one-line element on the post-recording
  failure state that names the actual reason and adapts its guidance (low light /
  out of frame / our side), owning our-side failures rather than instructing the
  user.
- **Camera-access state**: one of three distinct, foggy pre-recording states —
  Blocked, Busy, No camera found — each naming a problem and its fix, each with
  "Try again" and "Not now".
- **Home calibration banner**: the foggy `/app` nudge with a meadow "Set
  baseline" button, shown only while un-calibrated, dismissible per session,
  reappearing next session until calibration completes.
- **Remembered camera preference**: the stored choice of recording device that
  selecting a camera must always (re-)write, so device memory does not silently
  break (FR-045).

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: A first-time employee with a working camera can complete the full
  guided path (intro → green room → countdown → 60-second recording → success →
  `/app`) and, on a successful baseline, sees no calibration banner — in 100% of
  successful-capture attempts on the demo/test path.
- **SC-002**: A user who looks fine to themselves (centred, adequately lit) clears
  the soft gate and can press "I'm ready"; the gate only holds on the three
  obvious dealbreakers (no face, badly off-centre, basically too dark), with zero
  false blocks of an adequately framed, adequately lit face in the test fixtures.
- **SC-003**: When the face detector cannot run, the user can still reach and
  complete a recording via the "no live guide — you can still record" fallback in
  100% of detector-unavailable cases (the user is never locked out).
- **SC-004**: A face that drifts off-target for less than the grace window
  produces zero drift nudges, while a drift sustained past the grace window
  produces exactly the calm "ease back to centre" nudge — verified across the
  fixtures; in neither case is the recording auto-stopped.
- **SC-005**: Each of the three camera-access conditions (permission denied,
  camera busy, no camera) renders its own distinct, foggy state naming the
  problem and the matching fix, and each offers "Try again" and "Not now" where
  "Not now" lands on `/app` with the banner still showing — in 100% of cases.
- **SC-006**: The post-recording failure state shows the correct adaptive cause
  chip for each of the three causes (low light, out of frame, our side), and the
  gentle escape ("Maybe later" / "Try once more") appears only at and after the
  configured attempt threshold and never on the first failures — in 100% of
  cases.
- **SC-007**: Recalibrating from the account page replaces the existing baseline
  only after the "Set new baseline" confirmation ("Keep current" changes
  nothing), runs the same flow, and yields a success heading of "Your baseline is
  updated" — in 100% of attempts. An aborted or failed recalibration (stop,
  processing failure, or "Not now" / "Maybe later") leaves the existing baseline
  untouched, shows no home banner, and returns to the account page — in 100% of
  attempts.
- **SC-008**: The home banner appears for an un-calibrated employee, stays hidden
  after a session dismissal, reappears in a new session while un-calibrated, and
  disappears immediately and permanently once a baseline is set, with no
  persistent "you're calibrated" banner — in 100% of attempts.
- **SC-009**: Zero calibration or error surface in this feature renders amber or
  crimson, verified by a static check over the new source files against the
  palette tokens (amber and crimson tokens absent from these surfaces).
- **SC-010**: No copy in this feature contains an exclamation mark or any item
  from the alarmist/clinical blocklist ("detected", "REQUIRED", "MANDATORY",
  "alert", "abnormal", "elevated risk"), verified by a static check over the new
  source files.
- **SC-011**: Every animated element (breathing guide, countdown, success bloom,
  bracket-drift nudge, blur transition) has a verified motion-free equivalent
  under `prefers-reduced-motion` that conveys the same information — not a slowed
  animation — confirmed for all five elements.
- **SC-012**: The entire flow, and the recording screen in particular, renders
  correctly and remains fully functional at 360px in both light and dark modes,
  with every interactive target ≥44×44px, verified at desktop and 360px in both
  themes.
- **SC-013**: Selecting a camera always (re-)writes the remembered-device
  preference, including immediately after the stored value was cleared — verified
  by a test that fails against the pre-fix behaviour and passes against the fix.
- **SC-014**: No video frame leaves the device for the purpose of framing
  guidance — verified by inspecting that the live guide produces no video upload
  network traffic; the only recording that leaves the device is the existing
  feature-004 server-side baseline extraction.
- **SC-015**: The honest-test suite (FR-051, FR-052) exercises the real behaviour
  of the capture states, the gate, the three guide states, the error states, the
  recalibrate path, and the banner — with no mock that masks a real defect of the
  surface under test — and passes in CI.

## Assumptions

- **The feature-004 plumbing is reused, not rebuilt.** The in-browser recorder,
  the post-permission device picker, the backend health pre-check, the codec
  probe, and the success/failure terminal-state wiring from
  `specs/004-onboarding-video-anchor/` exist and are the substrate this feature
  redesigns. The 60-second duration, the server-side extraction pipeline, the
  raw-byte-deletion invariant, and the anchor storage shape are unchanged.
- **"Calibrated" means a stored baseline exists.** Banner visibility and the
  account-section state derive from whether the employee has a stored baseline
  (the feature-004 anchor), read via the existing whether-set signal; the capture
  date stays private unless planning deliberately adds a self-scoped date read
  (FR-041).
- **The post-recording-failure escape threshold reuses 004's "three consecutive
  failures" convention** for the gentle escape, for consistency with the existing
  flow; the exact number is a tunable detail to confirm in planning.
- **The drift-nudge grace period is a tunable value on the order of a couple of
  seconds**, chosen so the model's tolerance of brief stray frames is respected;
  the exact value is confirmed during planning/tuning.
- **Employees only.** As in feature 004, the capture flow and the calibration
  banner are employee-only surfaces; `team_lead` and `admin` users never see
  them. This feature does not change that role scoping.
- **Banner dismissal is session-only**, matching feature 004 (closing the
  browser, signing out, or a new session brings the banner back; only completing
  calibration removes it permanently).
- **User-facing copy in this spec is draft-quality** and is finalized during
  `/speckit-plan` / `/speckit-tasks` against the Constitution Principle V
  calm-voice rubric.
- **Manual smoke testing is performed by Mohamed** per Constitution Principle VII;
  `smoke-tests.md` is authored during `/speckit-tasks` and signed off after
  `/speckit-implement`, and will include cross-browser webcam-permission and
  client-side-detector checks on mobile and desktop.

## Out of Scope *(explicit exclusions)*

The following are explicitly excluded from this feature:

- **Live stress inference and the runtime anchor read path.** A later feature; no
  surface here may imply live check-ins are running.
- **The onboarding rebuild and demographics/preferences.** A later feature.
- **The app-wide "too monotone" redesign.** This feature builds its own new
  screens with proper hierarchy but does not retrofit the rest of the app.
- **A full app-wide type-scale system.** This feature sizes its own strings
  sensibly (including the previously under-sized success copy) without
  introducing a global type scale.
- **The general e2e-hardening pass on feature 004's flaky suites.** This feature
  owns only honest tests for its own flow.
- **The post-005 cleanup** — reconciling leftover amber notices elsewhere to
  foggy (notably the auth expired-link notice) and the account-dropdown contrast
  fix — tracked separately. This feature corrects only its own banner to foggy
  and MUST NOT reintroduce amber on any 005 surface.
- **Changes to the server-side extraction pipeline, the anchor storage shape, the
  60-second duration, or the role scoping** established in feature 004.

## Dependencies

- **Feature 004 (onboarding video anchor flow)** is the substrate: the recorder,
  device picker, health pre-check, codec probe, success/failure states, the
  `/app/calibrate` route, the calibration banner, and the anchor storage and
  extraction backend are all in place and are redesigned/reused here, not rebuilt.
- **Constitution Principle V (Calm-First Design Language)** is the source of the
  colour discipline (amber for affective only, crimson for destructive only,
  calm `foggy`/`meadow`/neutral elsewhere) and the calm-voice rubric that gate
  every surface in this feature.
- **Constitution Principle VI (Responsive & Accessible by Default)** governs the
  360px / light-dark-parity / ≥44px / reduced-motion requirements.
- **Constitution Principle VII (Mandatory Testing Per PR)** governs the honest-
  test requirement (FR-051, FR-052) and the smoke-test gate.
- **Constitution Principle I (Privacy by Architecture)** governs FR-050: the
  client-side detector must keep framing-guidance video on the device.

### Planning-phase flags (NOT spec requirements — for `/speckit-plan`)

These are flagged in the input as engineering questions to resolve in planning,
recorded here so the plan addresses them and does not regress:

1. **Client-side face detector** is the one genuinely new piece of engineering.
   The plan must work out model hosting/self-hosting, performance on weaker
   laptops, and the related browser-policy implications (Content-Security-Policy
   and camera permissions). The "guide unavailable, still record" fallback
   (FR-010c, FR-011) exists precisely because this may not always load.
2. **Surfacing the user's own calibration date** in the account section is
   deferred to a planning decision (FR-041): the date column is currently private
   (the client can learn only whether a baseline exists), so showing the date
   would require a self-scoped read added deliberately. The spec defaults to
   showing only whether a baseline is set.
3. **Two existing amber surfaces** (the auth expired-link notice; feature 004's
   home banner) conflict with Constitution Principle V. This feature corrects its
   own banner to foggy (FR-043); the auth notice is deferred to the post-005
   cleanup branch. The plan MUST NOT reintroduce amber on any 005 surface.
