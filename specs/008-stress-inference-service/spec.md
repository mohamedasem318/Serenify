# Feature Specification: Stress Inference Service

**Feature Branch**: `008-stress-inference-service`

**Created**: 2026-06-19

**Status**: Draft — **reconciled 2026-06-19** to the resolved plan decisions (see the note below)

**Input**: User description: "stress-inference-service — the live video stress-inference read path. The first feature that produces a real stress reading for an employee, wiring the already-built model, `Predictor.predict_delta`, and shared 2958-d feature extraction to a capture loop, a backend endpoint, persistence, and the monitoring UI."

> **Reconciliation note (2026-06-19).** Several architecture/UX choices deferred in this spec
> were resolved late and authoritatively during planning; the spec has been **back-ported to
> match them** (it never reverts them). The authoritative resolutions live in
> [`plan.md`](./plan.md) / [`research.md`](./research.md) and `docs/DECISIONS.md`:
> **(1) Windowing = B2** — the client records standalone **stop/restart ~10–12 s clips** and the
> server assembles the rolling 60 s window by **multi-clip frame concatenation** (the B1
> single-timeslice + container-reassembly path was a structural **NO-GO**).
> **(2) Anchor read = self-scoped `SECURITY DEFINER` `get_my_anchor()`** called by the API as
> the user (forwarded JWT + publishable anon key), with RLS-as-user session/reading writes and
> **no service-role key**.
> **(3) A `warming-up` state** is the 7th operational state and the first *displayed* reading
> lands at **~90–105 s** (smoothing cold-start), on the **0.53** re-threshold, smoothed/banded
> **server-side**.
> **(4) The seven mock-gap resolutions** (below).
> The **Deferred Decisions** and **Mock Gaps** sections are annotated **RESOLVED** accordingly.

## Overview

This feature delivers the first **real stress reading** an employee can see. The trained video model, the `Predictor.predict_delta` method, and the shared 2958-d feature-extraction path already exist and are verified; this feature is the **wiring** that connects them to (1) a webcam capture loop, (2) an authenticated backend inference endpoint, (3) per-window persistence, and (4) the monitoring UI surfaces shown in the approved mock (`serenify-008-monitoring-mock.html`).

The signature experience is calm: an employee starts a check-in, and an ambient "breathing" bloom drifts between three coarse states — **At ease / A little tense / Tense** — backed by a smoothed signal, with a retrospective trend that carries the proof. There is deliberately no live number or gauge.

**Visual contract**: every UI surface in this feature is governed by the approved mock `serenify-008-monitoring-mock.html` (layout, operational states, motion, color roles, copy tone). The mock is the reference for *intent*; implementation uses the real Graphite design tokens and existing `apps/web` components, not the mock's inline hex/CSS. Where the mock is silent, the gap is recorded in **Deferred Decisions** rather than resolved by invention (mocks-first governance).

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Live stress read during a check-in (Priority: P1)

An employee opens the dashboard, sees the check-in card with a recap of their last session, and presses **Start check-in**. They are asked for camera permission explicitly; on granting it, a monitoring session opens on its own page. The webcam records in fixed 60-second windows on a 10-second stride; a calm **warming-up** state shows while the first windows accrue, the first *displayed* smoothed reading lands at roughly 90 seconds (one window plus the smoothing cold-start), then a new reading arrives about every 10 seconds. Each reading is smoothed across recent windows and shown as one of three calm states rendered as an ambient breathing bloom — never a precise percentage or gauge.

**Why this priority**: This is the core value of the entire feature and the first time the platform produces a real stress reading for a user. Without it nothing else in the feature has meaning. It is the minimum viable slice.

**Independent Test**: With a calibrated employee account, start a check-in, grant the camera, and confirm a calm **warming-up** state shows first, then a smoothed three-state reading appears on the bloom within ~90–105 seconds and refreshes roughly every 10 seconds — without any numeric value being shown anywhere.

**Acceptance Scenarios**:

1. **Given** a calibrated, signed-in employee on the dashboard, **When** they press **Start check-in** and grant camera access, **Then** a monitoring session begins on its own page showing the ambient bloom and a state line.
2. **Given** an active session with the user in frame, **When** the smoothing cold-start clears (~90 s, after the first few windows accrue), **Then** a smoothed reading is shown as exactly one of **At ease**, **A little tense**, or **Tense**, with no numeric percentage or gauge anywhere on screen; before that the UI shows the calm **warming-up** state, never a fabricated reading.
3. **Given** an active session, **When** successive 10-second-stride windows complete, **Then** the displayed state updates from the smoothed signal and drifts (changes gradually) rather than flickering window-to-window.
4. **Given** the model returns a stress-positive probability, **When** the displayed state is derived, **Then** the band is computed from the **smoothed** signal against the calibrated operating point — not from the model's internal default-0.5 label.
5. **Given** a reading is produced, **When** it is shown, **Then** it is also persisted (keyed to user + session + timestamp, with label and probability) so it can feed the trend, recap, and downstream questionnaire trigger.

---

### User Story 2 - Session control and presence handling (Priority: P2)

While a session runs, the employee can take a manual break (**Pause**, which releases the camera) and **Resume** later, or **End session** at any time. If they drift out of frame, the session auto-pauses, shows a self-view so they can re-center, and surfaces a foggy "move back into frame" prompt; it resumes automatically when they return. Empty (no-face) windows are never uploaded. Prolonged absence ends the session on its own.

**Why this priority**: A live-camera session that cannot be paused, that uploads empty frames, or that strands the user in a stuck state when they step away is not trustworthy enough to ship. This slice makes the session robust and respectful, but the core read (US1) already delivers value without it.

**Independent Test**: During an active session, step out of frame and confirm the session auto-pauses with a self-view and a foggy prompt and then auto-resumes on return; separately confirm manual Pause releases the camera, Resume restarts capture, and End returns to the dashboard with an updated recap.

**Acceptance Scenarios**:

1. **Given** an active session, **When** the on-device face detector reports no face, **Then** no window is uploaded for that period and capture is gated until a face returns.
2. **Given** the user has been out of frame for 90 continuous seconds, **When** that threshold is reached, **Then** the session auto-pauses, shows a self-view, and displays the foggy out-of-frame prompt (attention styling, not stress styling).
3. **Given** an out-of-frame auto-pause, **When** the user returns to frame, **Then** the session resumes automatically and capture continues from where it left off.
4. **Given** the user has been continuously absent for 5 minutes, **When** that threshold is reached, **Then** the session auto-ends and the dashboard recap reflects the ended session.
5. **Given** an active or out-of-frame session, **When** the user presses **Pause**, **Then** the camera is released and the session enters a resumable paused state; **When** they press **Resume**, **Then** capture restarts.
6. **Given** any non-ended session state, **When** the user presses **End session**, **Then** the session ends, the camera is released, and they return to the dashboard idle check-in card showing the session recap.

---

### User Story 3 - Calibrate-first guard for users without an anchor (Priority: P2)

An employee who has not completed calibration (no stored anchor) starts a check-in. Instead of receiving a misleading reading, they get a clear, recognizable outcome that routes them toward calibration. The system never substitutes a global or fallback anchor and never returns a silent default.

**Why this priority**: A reading computed without that user's own anchor would be meaningless and would violate the no-global-anchor rule (Principle II / red-flag 2). Surfacing it as a real stress state would actively mislead. This guard protects correctness and trust, but is a branch off the main path, so it sits just below the core read.

**Independent Test**: With an employee account that has no stored anchor, start a check-in and confirm the session never displays a fabricated reading; instead it presents a recognizable "you need to calibrate first" outcome that links to calibration.

**Acceptance Scenarios**:

1. **Given** a signed-in employee with no stored anchor, **When** a captured window is submitted for inference, **Then** the backend returns a specific, recognizable "no anchor" outcome — never a reading derived from a global/fallback anchor or a silent default.
2. **Given** the "no anchor" outcome, **When** the UI receives it, **Then** it routes the user to a calibrate-first path rather than rendering any of the three stress states.
3. **Given** a user who later completes calibration, **When** they start a check-in again, **Then** inference proceeds normally and US1 behavior applies.

---

### User Story 4 - Retrospective trend, recap, and the questionnaire seam (Priority: P3)

After (and during) a session, the employee can see a retrospective session trend on both the monitoring page and the dashboard check-in card, so the at-a-glance read is available without opening the page. The idle card shows a recap of the last session. The system also records the persisted signal that a future questionnaire feature (009) will consume when a tense state is sustained — but builds no questionnaire here.

**Why this priority**: The trend and recap are the "proof" surface and the at-a-glance value, and the sustained-tense seam unblocks feature 009. They depend on persistence from US1 and are valuable but not required for the core live read to function.

**Independent Test**: Complete a session with a mix of states, then confirm the monitoring page and the dashboard card both render the same session trend from persisted readings, the idle card shows a last-session recap, and a sustained-tense stretch is represented in the persisted data in a form a downstream consumer can read.

**Acceptance Scenarios**:

1. **Given** a session with persisted readings, **When** the monitoring page renders, **Then** it shows a session trend summarizing the run (calm vs. tense stretches) without exposing a precise per-window number as the headline.
2. **Given** the same persisted readings, **When** the dashboard check-in card renders, **Then** it shows a trend consistent with the monitoring page's trend.
3. **Given** a completed session, **When** the employee returns to the idle dashboard card, **Then** the card shows a recap of the last session (e.g., duration and overall tenor).
4. **Given** a sustained-tense stretch within a session, **When** readings are persisted, **Then** the data needed to detect "sustained tense" is available to a downstream consumer (feature 009) without this feature triggering or rendering any questionnaire.

---

### Edge Cases

- **Thin / low-coverage window**: a window without enough usable face (per the feature-006 usable-face-coverage gate) returns a clear "couldn't read this window" outcome through the existing extraction-failure channel. The UI shows a distinct, quiet **foggy "skipped a read" note** — **not** the out-of-frame surface (a coverage failure can happen while the user is plainly in frame, e.g. glare/low light), names a likely cause, and shows no reading (never a fabricated one); the bloom keeps the last smoothed state and capture continues. (mock-gap #3 / MG-2)
- **Permission denied or blocked**: if the user denies the camera, or it is blocked at the browser/OS level, the session shows the blocked state with a path to retry; no recording occurs and no windows are uploaded.
- **Secure-context unavailable**: webcam capture requires a secure context (HTTPS or `localhost`); outside one, capture cannot start (recorded as an environment constraint, see Assumptions).
- **Slow inference**: a window whose extraction is slow MUST NOT stall the next window's capture or upload; the capture loop continues on its fixed cadence regardless of per-window inference latency.
- **First-reading latency**: nothing is shown as a "reading" before the smoothing cold-start clears (~90 s, several windows in); the UI shows a calm **warming-up** state ("getting a read on things") rather than implying a neutral result.
- **Out-of-frame while a window is in flight**: a window that was partially captured before the user left frame either completes as a normal reading or is treated as skipped — it never produces a fabricated reading attributed to a period with no face.
- **Resume after long pause**: resuming a manually paused session re-requests the camera if the browser released it, and re-enters the permission flow if access is no longer granted.
- **Reduced motion**: with `prefers-reduced-motion`, the bloom's breathing/animation is suppressed while the state color and trend remain legible.

## Requirements *(mandatory)*

### Functional Requirements

**Capture & session lifecycle**

- **FR-001**: Starting a check-in MUST be an explicit user action and MUST trigger a real camera-permission request; the flow MUST handle granted, denied, and blocked outcomes without assuming any prior permission (the calibration grant does not carry over).
- **FR-002**: Capture MUST use fixed 60-second windows on a 10-second stride. This window/stride is set by the model contract (Constitution Principle II) and MUST NOT be shortened.
- **FR-003**: The on-device face detector (feature 005) MUST gate capture: when no face is present, the system MUST NOT upload empty windows.
- **FR-004**: The UI MUST represent these operational states distinctly: **permission**, **warming-up** (first windows accruing — calm, no band yet), **active** (recording, in frame), **out-of-frame** (auto-paused, self-view shown, foggy framing prompt), **paused** (manual break, camera released), **blocked**, and **ended** — plus the transient **skipped-read note** (a coverage failure mid-session) and the **calibrate-first** surface (no anchor). (warming-up is the 7th state, mock-gap #1.)
- **FR-005**: The system MUST auto-pause after 90 continuous seconds with no face, and MUST hard-auto-end after 5 minutes of continuous absence.
- **FR-006**: Manual **Pause/Resume** and manual **End session** MUST be available throughout an active or out-of-frame session. Pause MUST release the camera; Resume MUST restart capture; End MUST release the camera and end the session.
- **FR-007**: Out-of-frame handling MUST surface a self-view and a foggy "move back into frame" prompt, and MUST auto-resume when the user returns to frame.
- **FR-008**: A **session** MUST be a first-class concept with a defined start and end, so that readings can be grouped, trended, and recapped.

**Inference behavior**

- **FR-009**: An authenticated inference endpoint MUST accept a captured window for the signed-in employee, run the shared 2958-d extraction, fetch that user's stored anchor, compute `delta = current − anchor`, call `predict_delta`, and return a reading.
- **FR-010**: Inference MUST be restricted to employees. Team leads and admins do not calibrate and MUST NOT run inference.
- **FR-011**: A user without a stored anchor MUST receive a specific, recognizable "no anchor" outcome. The system MUST NEVER substitute a global or fallback anchor and MUST NEVER return a silent default. The UI MUST route this to a calibrate-first path.
- **FR-012**: The displayed state MUST be derived using the metadata's calibrated operating point (default 0.53) applied to the stress-positive probability — not the default-0.5 label that `predict_delta` returns internally. The operating point MUST be a configuration value whose default is sourced from the model metadata, not a hard-coded literal.
- **FR-013**: A window without enough usable face (feature-006 usable-face-coverage gate) MUST return a clear "couldn't read this window" outcome via the existing extraction-failure channel; the UI MUST surface it as a distinct, quiet **foggy "skipped a read" note** (NOT the out-of-frame surface — the coverage failure can occur while the user is plainly in frame), name a likely cause, keep the last smoothed state on the bloom, and MUST NOT fabricate a reading. (mock-gap #3 / MG-2)
- **FR-014**: The displayed state MUST be smoothed across recent windows so it drifts rather than flickers. The spec defines the smoothing **policy** (a rolling smoothing over recent windows mapped to three bands — At ease / A little tense / Tense); the exact recent-window count and band thresholds are set in planning (D-3, now **resolved**: a trailing mean of the last **4 scored** readings; bands at **0.53 / 0.70**; a **4-reading cold-start** → first band ~90–105 s). Smoothing and banding are computed **server-side**.
- **FR-015**: Because the model is a binary classifier with raw (non-probability-calibrated) `predict_proba`, the UI MUST NOT present a precise probability or percentage anywhere; the three coarse bands derive only from the smoothed signal.
- **FR-016**: Inference MUST NOT block the capture loop: a slow window MUST NOT stall the capture or upload of the next window.

**Persistence & analytics**

- **FR-017**: Each per-window reading MUST be persisted, keyed to user + session + timestamp, recording at minimum the label and the probability, so the trend, the session recap, and a future questionnaire trigger can read them.
- **FR-018**: The dashboard check-in card and the monitoring page MUST both render the session trend from this persisted data, and the two trends MUST be consistent with each other.
- **FR-019**: The idle dashboard check-in card MUST show a recap of the user's last session, or a graceful **empty state** ("Start your first check-in") when the user has never completed a session. (mock-gap #7)
- **FR-020**: The system MUST persist readings in a form sufficient for a downstream consumer (feature 009) to detect a sustained-tense signal. This feature defines the seam only and MUST NOT build any questionnaire trigger, UI, or flow.

**Display & design (governed by the approved mock)**

- **FR-021**: The ambient breathing bloom MUST be the signature element; all other elements stay quiet. The UI MUST NOT show a large live number or gauge.
- **FR-022**: Color roles MUST follow Constitution Principle V exactly: **amber** for the stress signal only (the Tense and a-little-tense readings), **foggy** for attention/error (out-of-frame prompt, blocked, permission), **meadow** for calm/affirmative (At ease and primary actions). The out-of-frame prompt MUST be foggy, not amber.
- **FR-023**: The camera pill MUST be state-driven (recording / out of frame / paused / camera off) and MUST reveal a viewfinder on peek (hover/tap) and pin (click). The viewfinder MUST show framing graphics only — no words rendered on the raw video preview; all text lives in the cards.
- **FR-024**: In-product copy MUST be minimal and light-touch — one short in-product reassurance line, not a privacy lecture. The detailed privacy story belongs to the Terms of Service / Privacy Policy (feature 012) and any landing page.
- **FR-025**: All surfaces MUST respect `prefers-reduced-motion` and provide visible keyboard focus, and MUST work down to mobile width (≥360px per Principle VI).
- **FR-026**: Copy and voice MUST follow Principle V (calm, non-alarmist, no exclamation marks, no clinical/warning language); state names are **At ease / A little tense / Tense**.

**Privacy (Principle I)**

- **FR-027**: Raw video MUST NEVER reach the manager-facing layer. Managers see only derived states/trends downstream of inference. Raw frames stay within the device and the backend inference layer.

### Key Entities *(include if feature involves data)*

- **Monitoring Session**: a single check-in run for one employee, with a start time, an end time, and a lifecycle status (active / paused / out-of-frame / ended). Groups the readings produced during the run and anchors the recap and trend.
- **Window Reading**: the result of one captured window, keyed to user + session + timestamp. Records the model label and probability, and whether the window was scored or skipped (couldn't-read). Source of the trend, recap, and the sustained-tense seam.
- **Calibration Anchor** (existing, from features 004–006): the per-user stored baseline subtracted from the current feature vector at inference. Read-only input to this feature; not created or modified here. Absence triggers the calibrate-first guard.
- **Smoothed Display State** (derived): the three-band state (At ease / A little tense / Tense) computed from a rolling smoothing of recent readings against the calibrated operating point. Drives the bloom; never exposed as a number.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: A calibrated employee starting a check-in sees a calm **warming-up** state immediately, then their first smoothed reading within roughly **90–105 seconds** (the first window at ~60 s plus the 4-reading smoothing cold-start), and a refreshed reading approximately every 10 seconds thereafter.
- **SC-002**: The displayed reading is always exactly one of three named states (At ease / A little tense / Tense); no numeric percentage, score, or gauge appears on any surface in the feature.
- **SC-003**: The displayed state does not change on every single window when the underlying signal is noisy — it drifts (smoothing visibly suppresses window-to-window flicker).
- **SC-004**: 100% of inference attempts by a user with no stored anchor result in the calibrate-first outcome and never a displayed stress state; no global/fallback anchor is ever used.
- **SC-005**: 100% of no-face periods upload zero windows, and 100% of "couldn't read this window" outcomes produce no reading.
- **SC-006**: Out-of-frame is detected and the session auto-pauses within 90 seconds of face loss, auto-resumes within one stride (~10 seconds) of the user's return, and auto-ends after 5 minutes of continuous absence.
- **SC-007**: A slow window never delays the next window's capture; capture cadence stays on its fixed 10-second stride regardless of per-window inference time.
- **SC-008**: The session trend shown on the dashboard check-in card matches the trend shown on the monitoring page for the same session.
- **SC-009**: No raw video leaves the device/backend inference layer toward any manager-facing surface (Principle I invariant holds).
- **SC-010**: All seven operational states (permission, **warming-up**, active, out-of-frame, paused, blocked, ended) are reachable and visually distinct, using the Principle V color roles (amber = stress only; foggy = attention/error; meadow = calm/affirmative); **"ended" returns to the dashboard with an updated recap, not a standalone monitoring-page screen** (mock-gap #6).

## Assumptions

- The video model is committed at `packages/ml-video/models/`, loads at API startup via `load_model()` in `loader.py`, and `/healthz` reports its version. (Verified; not re-derived here.)
- `Predictor.predict_delta(delta)` is fully implemented and returns `(label, proba)`. It currently has no callers; this feature adds its first caller and its first test.
- Feature extraction is a single shared path (`extract_landmarks → lbp_top_features ⊕ motion_features → 2958-d`); the anchor/calibration path and the inference path use the same extraction, and the only inference-specific step is subtracting the user's stored anchor.
- An end-to-end fidelity gate confirmed `packages/ml-video` reproduces the training notebook's 2958-d vector bit-for-bit for CFR mp4 input. (Residual: real inference clips are Chrome MediaRecorder webm/VFR through a timestamp-sampler path not yet notebook-checked — see Test Plan Notes.)
- Per-user calibration anchors are already captured and stored (features 004–006); calibration is employees-only.
- Local CPU-bound extraction runs ~3–5 seconds per window on the dev laptop (MediaPipe is CPU-bound; the dev GPU does not accelerate it), comfortably inside the 10-second stride. Production latency is a later concern, out of scope here.
- Webcam capture requires a secure context (HTTPS or `localhost`); this is an environment constraint, not a feature requirement.
- The dashboard hosts three cards (check-in, chat, recommendations). Only the check-in card's session states are in scope; the chat (010) and recommendations (011) cards are existing/out of scope and are not redesigned.
- The smoothed three-band signal, not the model's internal 0.5 label, drives the display; the operating-point default (0.53) is read from model metadata.

## Out of Scope (Non-Goals)

- **No questionnaire.** When a tense state is sustained, this feature stops at surfacing and persisting the reading. The confirmatory questionnaire (trigger, UI, flow) is feature 009. This feature defines the seam only.
- **No chatbot or recommendations** (features 010 / 011).
- **No redesign** of existing dashboard chrome or of the chat / recommendations cards. This feature adds only the check-in card's session states and the monitoring page.
- **No model changes**: no retraining, no new artifact, no change to extraction or to `predict_delta`'s internals. The committed model is used as-is.
- **No always-on background monitoring** across the app. A dedicated monitoring page plus an explicit session is the model for now; background-across-the-workday and cross-app browser notifications are backlog items.
- **No i18n/RTL retrofit.** As a near-zero-cost guideline only, prefer not to hardcode user-facing strings in a way that blocks later externalization, and prefer logical CSS properties where free. No i18n system is built here.

## Deferred Decisions — RESOLVED in planning

These were flagged for planning and have since been **RESOLVED** (see [`plan.md`](./plan.md), [`research.md`](./research.md), `docs/DECISIONS.md`). Kept here for traceability; the planning resolution is authoritative.

- **D-1 — Anchor read path at inference** — **RESOLVED: self-scoped `SECURITY DEFINER` `get_my_anchor()`**, called by the API **as the user** (forwarded JWT + the publishable anon key), with RLS-as-user session/reading writes and **no service-role key**. (The originally-recommended server-side **service-role** read was rejected to preserve DECISION-9's "no broad DB credential in `apps/api`" posture; the self-scoped DEFINER is the safer option feature 004 also named.)
- **D-2 — Endpoint shape & windowing** — **RESOLVED: session-aware** (create → submit clip ×N → end) with **B2 windowing**: the client uploads standalone **stop/restart ~10–12 s clips** and the **server** assembles the rolling 60 s window by **multi-clip frame concatenation** (the B1 single-timeslice + container-reassembly path was a structural **NO-GO**). Smoothing/banding stay **server-side**.
- **D-3 — Smoothing & banding specifics** — **RESOLVED**: a trailing mean of the last **4 scored** windows; bands at **t_low = 0.53** (the metadata operating point) and **t_high = 0.70** (display-only product split); a **4-reading cold-start** (first band ~90–105 s).
- **D-4 — Readings persistence schema** — **RESOLVED**: two tables (`monitoring_sessions`, `window_readings`) with RLS select/insert/update-own and **no manager policy**, the raw `stress_probability`/`label` held **server-only** via the SELECT column whitelist, **90-day** retention for readings, and the shared `getSessionTrend`/`getLastSessionRecap` reads. See [`data-model.md`](./data-model.md).

### Mock Gaps — RESOLVED (seven mock-owner decisions)

All mock gaps are **resolved** by the mock owner and folded into the plan ([`research.md`](./research.md) § Mock-gap resolutions). Kept for traceability.

- **MG-1 — Calibrate-first surface** — **RESOLVED**: a **foggy** panel (attention, not stress) with a short line and a **meadow "Start calibration"** action routing to the calibration flow (no-anchor / User Story 3).
- **MG-2 — "Couldn't read this window" treatment** — **RESOLVED**: its **own** quiet **foggy "skipped a read" note** (NOT the out-of-frame surface — a coverage failure can occur while the user is plainly in frame), naming a likely cause; the bloom keeps the last smoothed state and capture continues.
- **MG-3 — Monitoring stage at mobile width** — **RESOLVED**: the stage **stacks at ≥360 px** (bloom shrinks, controls go full-width and stack, pill/viewfinder reposition).
- **Additional mock-owner resolutions** (completing the seven): **(4)** **warming-up** is a 7th operational state, shown until the smoothing cold-start clears; **(5)** the **first displayed reading is at ~90–105 s** (not ~60 s); **(6)** **"ended" returns to the dashboard with an updated recap**, not a standalone monitoring-page screen; **(7)** the idle check-in card shows a graceful **empty state** when the user has never run a session.

## Test Plan Notes

- `predict_delta` currently has **zero tests**; this feature adds its first caller and its first test.
- **Multi-clip windowing fidelity (B2 — HARD GATE, front-loaded)**: because the 60 s window is now assembled from ~6 standalone stop/restart clips, a hard gate confirms the multi-clip 2958-d vector matches the same content recorded as one continuous clip within tolerance — validated on real Chrome **and** real Safari/iOS (not Playwright) **before** the rest of the build. If it fails, the windowing approach is revisited. (Decision #1; see `plan.md` / `research.md` R-7.)
- **webm/VFR fidelity residual (planned hardening check, not a blocker)**: decode the same content as both mp4 (CFR) and webm (VFR), then confirm the extracted 2958-d vectors stay within tolerance. Real inference clips are browser MediaRecorder webm/VFR, which travel a timestamp-sampler path the notebook fidelity gate did not check. This is a hardening item to schedule, not a gate on shipping the feature.

## Constitution Alignment

- **Principle I (Privacy by Architecture)**: raw video stays in the device/backend inference layer; managers receive only derived states/trends (FR-027, SC-009).
- **Principle II (Subject-Disjoint ML Evaluation / calibration & windows)**: 60s window / 10s stride is honored and not shortened (FR-002); per-user delta calibration is required with no global anchor (FR-011); subject-disjoint evaluation is already satisfied for the model and no new ML evaluation is in scope.
- **Principle V (Calm-First Design Language)**: amber = stress only, foggy = attention/error, meadow = calm/affirmative; no big number; calm, non-alarmist copy (FR-021–FR-024, FR-026).
- **Principle VI (Responsive & Accessible)**: ≥360px, reduced-motion, visible focus (FR-025).
- **Principle VII (Mandatory Testing)**: first `predict_delta` caller and test; the **front-loaded B2 multi-clip windowing fidelity HARD GATE** (real Chrome + Safari/iOS); plus the webm/VFR hardening check (Test Plan Notes).
