---
description: "Task breakdown for feature 005 — calibration capture flow"
---

# Tasks: Calibration Capture Flow

**Input**: Design documents from `/specs/005-calibration-capture-flow/`

**Prerequisites**: plan.md (required), spec.md (user stories), research.md,
data-model.md, contracts/ (face-detection.md, components.md, backend-unchanged.md)

**Branch**: `005-calibration-capture-flow` — a **UX redesign on feature 004's
substrate**. Extend the existing `components/anchor/` recorder; do not rebuild it.
**No backend, package, migration, or seed changes** (see
`contracts/backend-unchanged.md`).

## Format: `[ID] [P?] [Story] Description`

- **[P]**: can run in parallel (different files, no dependency on an incomplete task)
- **[Story]**: the user story the task serves (US1–US7); Setup/Foundational/Polish
  carry no story label
- Every task names exact file paths.

## Honest-test rule (DECISION-26) — applies to every task

Inject only at the **unavoidable I/O boundary** (`getUserMedia`, `MediaRecorder`,
`postAnchor`/`checkHealth`, the detector interface, the session Supabase client) and
exercise the **real** gate / reducer / drift / write-gating logic. **Never** mock the
unit's own logic green. Real-environment behaviour that genuinely cannot run in CI is
deferred to `smoke-tests.md` and **labelled deferred** — not mocked.

## Colour & voice guardrail — applies to every UI task

No 005 surface uses **amber** or **crimson** (Constitution Principle V); calibration
and error surfaces use `foggy` / `meadow` / neutral, affirmative confirmation uses
`meadow`. Calm voice: "noticed" not "detected", no exclamation marks, suggest-not-
prescribe, first-person-plural. M&M tokens only; never remap M&M tokens inside
`@theme inline`.

## Responsive & accessibility guardrail — applies to every UI task

Every 005 surface is **mobile-first and fully functional at 360px** (the recording
screen in particular is a first-class 360px layout, **not** a shrunk desktop one),
with all interactive targets **≥44×44px** and **light + dark designed in tandem at
WCAG AA** (Constitution Principle VI, FR-049). T032 (smoke) verifies this by hand;
each UI task MUST satisfy it at build time, not defer it.

---

## Phase 1: Setup & Groundwork (load-bearing ordering)

**Purpose**: reduced-motion/token groundwork, then the detector assets + the CSP
delta **before any detector call**.

- [X] T001 [P] Standardise reduced-motion on the shared `useMediaQuery("(prefers-reduced-motion: reduce)")` (`apps/web/hooks/use-media-query.ts`) and refactor `apps/web/components/anchor/countdown.tsx` off its inline `usePrefersReducedMotion`.
  - **Acceptance**: no behaviour change; the ring↔tick still flips on the media query (DECISION-27, FR-048).
  - **Honest test**: existing `apps/web/components/anchor/countdown.test.tsx` passes; add an assertion it consumes the shared hook.
  - **Docs**: —
- [X] T002 Commit the self-hosted detector assets to `apps/web/public/face-detect/` (the WASM runtime + `blaze_face_short_range` model file). *(Impl note: `@mediapipe/tasks-vision@0.10.35` pinned (exact in lockfile); the .tflite model is committed; the ~22 MB WASM runtime is gitignored and reproduced same-origin from the pinned dep by a resilient copy in `next.config.ts` that runs on every `next dev`/`next build` (config load) — reliable on any deploy, degrades to the FR-011 fallback on failure. Detector uses an explicit local path, never a CDN. See DECISION-19 note; log in DECISIONS/CHANGELOG at T033.)*
  - **Acceptance**: assets resolve same-origin (covered by `connect-src 'self'`); no third-party origin; no new secret (DECISION-19/20, FR-050).
  - **Docs**: `docs/CHANGELOG.md` (asset addition).
- [X] T003 Add the scoped CSP delta **report-only** in `apps/web/proxy.ts`: change `buildCsp(nonce)` → `buildCsp(nonce, pathname)` and append `script-src 'wasm-unsafe-eval'` (+ provisional `worker-src 'self' blob:`) **only** on capture routes (`/onboarding`, `/app/calibrate`). *(Allowance added + scoped; minimal set validated/narrowed by the T004 sweep.)*
  - **Acceptance**: allowance present on capture routes, absent on all others; **no** `connect-src` host added; COEP stays unset (DECISION-20, FR-050).
  - **Honest test**: Playwright asserts the emitted CSP header differs correctly per route.
  - **Docs**: `docs/DECISIONS.md` entry 20 (draft).
- [ ] T004 Sweep `securitypolicyviolation` under Playwright on the capture routes, narrow to the minimal allowance (drop `worker-src` if the runtime needs no blob worker), and **flip the delta to enforce**. MUST complete before any detector call ships.
  - **Acceptance**: zero CSP violations on `/app/calibrate` + `/onboarding` with the detector loading; policy enforced (DECISION-20, Risk R-2).
  - **Docs**: `docs/CHANGELOG.md` (CSP delta enforced).

**Checkpoint**: detector can load without CSP rejection; reduced-motion gate is shared.

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: the detector lib and the extended state machine — every story consumes
these. **No user-story surface may begin until Phase 2 is complete.**

- [X] T005 [P] Detector loader `apps/web/lib/face-detect/detector.ts` — capability probe (WebAssembly present) + lazy self-hosted load + **hard init timeout** → `Promise<DetectorHandle | null>`; `detect(video, ts)` on a downscaled frame returns a normalized `FaceBox | null`.
  - **Acceptance**: resolves within `initTimeoutMs` (~4.5 s) or returns `null`; never hangs (DECISION-19, contracts/face-detection.md §1, FR-011).
  - **Honest test**: Vitest fake-timers — the timeout path returns `null` deterministically; the loader is injectable.
  - **Docs**: `docs/DECISIONS.md` entry 19 (draft).
- [X] T006 [P] Pure framing logic `apps/web/lib/face-detect/framing.ts` — `toFramingSignal`, `evaluateGate`, `evaluateDrift`, the named threshold constants (`CENTRE_MAX`, `LUMA_MIN`, `SET_DEBOUNCE_MS`, `DRIFT_GRACE_MS`, …), and the grace-window debounce.
  - **Acceptance**: forgiving gate (only no-face / badly-off-centre / too-dark hold it); a wobble `< DRIFT_GRACE_MS` produces no nudge; sustained `≥ grace` → `ease-back`/`absent`; never signals auto-stop (DECISION-19, FR-009/018/020).
  - **Honest test**: Vitest fake-clock over the **real** functions (gate forgiveness; wobble vs sustained drift; absence).
  - **Docs**: —
- [X] T007 Live loop hook `apps/web/lib/face-detect/use-framing-guide.ts` — throttled `requestVideoFrameCallback`/`rAF` (~6–8 fps green room, ~3–4 fps recording) on a downscaled frame + canvas luma; `loading | active | unavailable` lifecycle; **injectable `createDetector` seam**; telemetry sink.
  - **Acceptance**: `unavailable` ⇒ gate bypassed (`ready = true`) so the user is never locked out (DECISION-19, FR-010/011).
  - **Honest test**: inject a fake detector → drive synthetic signals through the **real** `framing.ts` → assert `guide`/`gate`/`drift`.
  - **Docs**: —
- [X] T008 Extend the reducer `apps/web/components/anchor/use-anchor-recorder.ts` — add `intro` / `green-room` / `get-ready` / `stop-confirming`; split `permission-denied` into `camera-blocked` / `camera-busy` / `camera-no-device` mapped from `getUserMedia` `error.name`; add `mode: "first-time" | "recalibrate"`; carry framing readiness; keep `failureCount`/escape semantics (transport + camera errors are **not** strikes).
  - **Acceptance**: every transition incl. stop→green-room, mode-driven exits, the `error.name`→3-state map, escape at `failureCount ≥ 3` (DECISION-21, FR-053, FR-031–035).
  - **Honest test**: Vitest on the pure reducer (`use-anchor-recorder.test.ts`) — all transitions + the error mapping.
  - **Docs**: `docs/DECISIONS.md` entry 21 (draft).

**Checkpoint**: foundation ready — user-story surfaces can begin.

---

## Phase 3: User Story 1 — Guided first-time capture (Priority: P1) 🎯 MVP

**Goal**: a first-timer goes intro → green room → countdown → 60 s recording →
success, calmly and without uncertainty, on `/app/calibrate` **and** onboarding.

**Independent Test**: with a working camera, open `/app/calibrate`, read the intro,
turn on camera, settle in the green room, "I'm ready", watch 3·2·1 with the blur
easing to *softened*, complete the minute (breathing guide + timer), see the success
moment, "Back to home" → `/app` with no banner.

- [X] T009 [P] [US1] `apps/web/components/anchor/intro.tsx` — heading "Set your calm baseline", three icon-led what-to-expect lines, the privacy line, primary "Turn on camera", and the permission-coming line. (FR-001–004)
  - **Honest test**: RTL — copy present; `onTurnOnCamera` fires.
- [X] T010 [P] [US1] `apps/web/components/anchor/framing-overlay.tsx` — **fixed** centred corner brackets + dimmed spotlight (face area sharp) + the drift-nudge layer; motion-free variant. Reused by green room AND recording. (FR-005/006/017, DECISION-27)
  - **Honest test**: RTL — `drift` prop → nudge text/colour is **foggy** (no amber/crimson); reduced-motion ⇒ no transition.
- [X] T011 [US1] `apps/web/components/anchor/green-room.tsx` — live preview + `framing-overlay` + the device picker + gate-driven "I'm ready" (+ calm helper line) + "Not now"; **includes the `unavailable` fallback** ("no live guide — you can still record", soft gate **bypassed** so "I'm ready" is available). The **never-lock-out guarantee ships in this US1 slice**, not deferred to US2. (FR-005–011, esp. FR-010c/FR-011)
  - **Acceptance**: when `useFramingGuide` reports `unavailable`, the green room shows the "no live guide" note and "I'm ready" is enabled — a US1-only build is never locked out (FR-011).
  - **Honest test**: RTL — inject the gate verdict through the `useFramingGuide` seam → "I'm ready" enables only when `ready`; inject the detector as `unavailable` → fallback note shown **and** "I'm ready" available; "Not now" exit fires.
- [X] T012 [US1] `apps/web/components/anchor/get-ready-countdown.tsx` — 3→2→1, **numbers only, no draining ring**; preview blurs then eases to **softened, never fully sharp**; quiet "Cancel"; motion-free variant. (FR-012/013/014, DECISION-27)
  - **Honest test**: RTL — counts 3→2→1; reduced-motion ⇒ numeric tick + immediate softened (no transition); "Cancel" fires.
- [X] T013 [P] [US1] `apps/web/components/anchor/breathing-guide.tsx` (4-in/6-out, **not** a progress role; motion-free "breathe in / hold / out" cue ladder) and `apps/web/components/anchor/recording-timer.tsx` (the 60 s **sole** progress indicator, re-home of the 004 ring, shared reduced-motion hook). (FR-015/016, DECISION-27)
  - **Honest test**: RTL — the breathing guide exposes no `progressbar` role; the timer counts; both have reduced-motion variants.
- [X] T014 [US1] `apps/web/components/anchor/recording-stage.tsx` — breathing guide focal over a **softened** preview + `recording-timer` + persistent `framing-overlay` + "we've got you" + a clear stop control. (FR-015–020)
  - **Acceptance**: the recording screen is a **first-class 360px layout (NOT a shrunk desktop one)**, ≥44×44px targets, light/dark in tandem at WCAG AA (FR-049, per the responsive guardrail).
  - **Honest test**: RTL — composition; stop fires; `drift` prop → overlay nudge; sustained drift/absence does **not** auto-stop.
- [X] T015 [US1] `apps/web/components/anchor/success-state.tsx` — drawn check + soft bloom ripple; **readable** supporting copy (fix 004's under-sized text); heading "Your baseline is set/updated" by `mode`; "Back to home"/"Back to account"; motion-free static check. (FR-025/026)
  - **Honest test**: RTL — heading by `mode`; body sized for readability; `onDone` fires.
- [X] T016 [US1] **`/healthz` gate (PINNED — clarification #2)** in `apps/web/components/anchor/anchor-recorder.tsx` — gate entry to recording **immediately before the get-ready countdown** via the existing `checkHealth()` (`lib/api/anchor-client.ts`); a down/not-ready backend shows feature 004's calm "calibration is temporarily unavailable, please try again later" copy and blocks; never record a full minute into a dead backend.
  - **Acceptance**: pressing "I'm ready" runs the health check; only a healthy backend advances to `get-ready`; an unhealthy one shows the copy and does not start recording (clarification #2, FR-056, 004 FR-048).
  - **Honest test**: inject `checkHealth` → `false` blocks + shows copy; `true` proceeds.
  - **Docs**: `docs/DECISIONS.md` (health-gate placement note).
- [X] T017 [US1] Orchestrator wiring (happy path) `apps/web/components/anchor/anchor-recorder.tsx` — render `intro → green-room → (healthz) → get-ready → recording → success` by reducer state; drive `useFramingGuide`; thread `getUserMedia` / `MediaRecorder` / `postAnchor` / the session Supabase client as **injectable deps**; on success decode `vector_b64` → write the anchor columns → `broadcastAnchorCaptured()` (reuse 004). (FR-001–026)
  - **Honest test**: RTL + Playwright happy path with boundary seams — the **real** orchestration runs; success writes the vector and broadcasts.
- [X] T018 [US1] **Onboarding mount + remove old 004 UI (clarification #1)** — mount the redesigned `<AnchorRecorder context="onboarding"/>` at the onboarding first-time capture (`apps/web/app/(onboarding)/onboarding/onboarding-form.tsx`); **fully remove the old feature-004 calibration UI — no stragglers** — so a first-time user in onboarding sees the new flow. (Clarification #1, DECISION-28; CSP/PP already cover `/onboarding`.)
  - **Acceptance**: onboarding first-time renders the new flow; no old calibration UI remains referenced anywhere.
  - **Honest test**: Playwright onboarding first-time = the new flow; static check that no removed component is imported.
  - **Docs**: `docs/CHANGELOG.md` (old-UI removal), `docs/PROGRESS.md`.

**Checkpoint**: US1 is a fully functional MVP on both `/app/calibrate` and onboarding.

---

## Phase 4: User Story 2 — Framing guide gates softly, never locks out (Priority: P1)

**Goal**: the green-room guide's three states + the forgiving gate + the in-recording
drift feedback, with the "never lock the user out" fallback.

**Independent Test**: force the detector loading / unavailable; hold/clear the gate
with framing; drift briefly (no nudge) vs sustained (calm nudge) vs absent — the
recording continuing throughout.

- [X] T019 [US2] Green-room **loading + active** guide-state polish in `green-room.tsx` — the brief `loading` affordance and the `active` gate-hold helper copy (no-face / badly-off-centre / too-dark), wired from `useFramingGuide`. (The `unavailable` fallback already ships in **T011/US1**; this task refines the other two states.) (FR-010a/b)
  - **Honest test**: inject detector `loading` → brief loading affordance with "I'm ready" disabled; inject `active` gate verdicts → the correct forgiving helper copy per hold reason.
- [X] T020 [US2] In-recording drift feedback in `recording-stage.tsx`/`framing-overlay.tsx` — centred (quiet) / "ease back to centre" after the grace window / "we can't see you"; tune the grace constant; never auto-stop. (FR-017/018/020)
  - **Honest test**: drive synthetic drift through the **real** `evaluateDrift` → overlay states; a wobble `< grace` produces nothing.
- [X] T021 [US2] Cause-telemetry accumulation during recording (`darkFrames` / `offTargetFrames` / `totalFrames` / `detectorAvailable` → `dominantCause()`), wired into the orchestrator's telemetry sink; feeds US5. (DECISION-24)
  - **Honest test**: Vitest — `dominantCause()` mapping incl. the **our-side default** when the detector was unavailable.

**Checkpoint**: US1 + US2 — the guide is resilient and never traps the user.

---

## Phase 5: User Story 3 — Stop → green room (Priority: P2)

**Goal**: an honest stop confirmation that returns to the green room, nothing lost.

**Independent Test**: during recording, Stop → confirm framing → Keep going resumes;
Confirm stop → back in the green room (not a fresh countdown), nothing persisted.

- [ ] T022 [US3] `apps/web/components/anchor/stop-confirm.tsx` — honest dialog (shadcn `dialog`): "starting the minute over", "nothing saved yet, so nothing is lost", "Keep going" as the easy default, **non-destructive (no crimson)**; confirm → **green-room**. (FR-021–024)
  - **Honest test**: RTL — "Keep going" resumes; confirm → green-room (real reducer transition); assert no crimson token on the surface.

**Checkpoint**: US1–US3.

---

## Phase 6: User Story 4 — Three calm camera-access states (Priority: P2)

**Goal**: Blocked / Busy / No-camera, each naming the problem and the fix, foggy.

**Independent Test**: drive permission-denied, camera-busy, and no-device — each shows
its distinct foggy state with "Try again" / "Not now".

- [ ] T023 [US4] `apps/web/components/anchor/camera-access-state.tsx` — the three foggy states (Blocked / Busy / No-camera) + "Try again" / "Not now", wired to the `getUserMedia` `error.name` mapping from T008. (FR-031–035)
  - **Honest test**: inject `getUserMedia` rejections by `error.name` → each distinct state, **foggy (no amber/crimson)**, "Try again" re-requests, "Not now" exits per `mode`.

**Checkpoint**: US1–US4.

---

## Phase 7: User Story 5 — Calm post-recording failure (Priority: P2)

**Goal**: a foggy failure with an adaptive cause chip and a gentle escape.

**Independent Test**: drive each cause (dark / off-frame / our-side) → correct chip;
reach the threshold → the escape appears.

- [ ] T024 [US5] `apps/web/components/anchor/failure-state.tsx` — foggy failure (never red/amber); adaptive cause chip from telemetry (low-light / out-of-frame / **our-side default**); "Try again" (→ green room) / "Not now"; escape at the threshold ("Maybe later" / "Try once more"). (FR-027–030, DECISION-24)
  - **Honest test**: inject `causeTelemetry` + a 422 → correct chip; the escape appears only at/after the threshold; our-side when the detector was unavailable; no amber/crimson.
  - **Docs**: `docs/DECISIONS.md` entry 24 (draft).

**Checkpoint**: US1–US5.

---

## Phase 8: User Story 6 — Recalibrate from account (Priority: P2)

**Goal**: the account "Your calm baseline" section launches the same flow in
recalibrate mode, overwriting on success only, with the mode hardened against
`has_anchor`.

**Independent Test**: account → "Set a new baseline" → replace heads-up → same flow
with "update" copy → success "updated" → `/app/account`; aborting/failing keeps the
old baseline; a stray `?mode=recalibrate` with no baseline behaves first-time.

- [ ] T025 [US6] `apps/web/components/anchor/baseline-section.tsx` rendered on `apps/web/app/(authed)/app/account/page.tsx` (after the Security section) — "Your calm baseline" (whether-set via server `has_anchor`) + "Set a new baseline" → replace heads-up dialog ("Keep current" / "Set new baseline", non-destructive) → **`<a href="/app/calibrate?mode=recalibrate">`** (full document navigation). (FR-036/037/041/055, DECISION-22/23/16)
  - **Acceptance**: the "Set new baseline" CTA is a **full-document navigation** (a plain `<a href=…?mode=recalibrate>`, **not** a `<Link>`/`router.push`) so the per-route `camera=(self)` Permissions-Policy applies on `/app/calibrate` (FR-055; DECISION-16) — the same invariant as the banner CTA.
  - **Honest test**: RTL — section reflects `hasAnchor`; heads-up dialog; the CTA is a plain `<a>` (full nav), not `<Link>`.
- [ ] T026 [US6] Calibrate route `mode` + **hardening (clarification #3)** — `apps/web/app/(authed)/app/calibrate/page.tsx` reads `searchParams.mode`; in `recalibrate` **suppress** the `has_anchor`→`/app` redirect; **reconcile `mode` against `has_anchor`: if no baseline exists, first-time semantics apply regardless of the URL param**; `apps/web/app/(authed)/app/calibrate/calibrate-recorder.tsx` passes `mode` and sets exits (first-time → `/app`, recalibrate → `/app/account`) + copy set→update; success "Your baseline is updated". (FR-038/039/040/053, DECISION-22, clarification #3)
  - **Honest test**: `?mode=recalibrate` with **no** anchor → first-time copy + `/app` exit; **with** anchor → "update" copy + `/app/account` exit (Playwright + RTL).
  - **Docs**: `docs/DECISIONS.md` entry 22 (draft).
- [ ] T027 [US6] Overwrite-on-success-only + exit routing in the orchestrator (reuse the existing client write path; **no new DB**) — across stop / processing-failure / "Not now" / "Maybe later" the prior baseline is untouched and the exit follows `mode`. (FR-053, DECISION-22)
  - **Honest test**: injected Supabase client — `update()` fires **only** on success; every abort/defer → no write + the mode-correct exit.
  - **Docs**: `docs/DECISIONS.md` entry 23 (whether-set-only).

**Checkpoint**: US1–US6.

---

## Phase 9: User Story 7 — Home banner refresh (Priority: P3)

**Goal**: the banner restyled amber→foggy with a meadow "Set baseline", lifecycle +
cross-tab preserved.

**Independent Test**: un-calibrated → foggy banner with meadow button, no amber;
dismiss (session) → reappears next session → disappears on calibrate; cross-tab mirror.

- [ ] T028 [US7] Restyle `apps/web/components/anchor/calibration-banner.tsx` — `border-amber/* bg-amber/*` → **foggy** equivalents; relabel the button "Set baseline" (meadow default `Button`); update the "Amber, never red" docstring; **preserve** the `useSyncExternalStore`/dismiss/`broadcastAnchorBannerDismissed` lifecycle and cross-tab mirror. (FR-042/043/044/054)
  - **Acceptance**: the "Set baseline" CTA stays a **full-document navigation** into `/app/calibrate` — a plain `<a href="/app/calibrate">` (Button `asChild`), **not** a client-side `<Link>`/`router.push` — so the per-route `camera=(self)` Permissions-Policy still applies; the restyle MUST NOT regress this (FR-055; DECISION-16).
  - **Honest test**: RTL — foggy classes, no `amber`; meadow button; the CTA renders as an `<a href="/app/calibrate">` (not a `<Link>`); appear/dismiss-session/reappear via real `sessionStorage`; Playwright cross-tab mirror unchanged.
  - **Docs**: `docs/CHANGELOG.md` (banner amber→foggy).

**Checkpoint**: all user stories functional.

---

## Phase 10: Polish & Cross-Cutting Concerns

- [ ] T029 [P] Device-memory fix `apps/web/components/anchor/device-picker.tsx` (FR-045, DECISION-25) — when the stored value is absent/cleared and a real default camera is resolved in the mount effect, **persist it** to `localStorage`, **without** clobbering a stored-but-temporarily-absent device.
  - **Honest test**: Vitest — clear `localStorage`, mount with one camera → the preference is (re-)written (**this test fails against the pre-fix code**); a stored-but-absent device is not overwritten.
  - **Docs**: `docs/DECISIONS.md` entry 25 (draft).
- [ ] T030 [P] Static guardrail tests over the 005 surfaces — **zero** `amber`/`crimson` token usage on calibration/error surfaces; **zero** exclamation marks or blocklist terms ("detected", "REQUIRED", "MANDATORY", "alert", "abnormal", "elevated risk"). (FR-046/047, SC-009/010)
  - **Honest test**: a static scan test over the new/edited files asserting both.
- [ ] T031 Playwright e2e consolidation in `apps/web/tests/e2e/` — the happy path, the recalibrate path, the three camera-access states, and the banner appear/disappear/persist + cross-tab — all with boundary seams (detector / `getUserMedia` / `MediaRecorder` / `postAnchor` / Supabase injected, real orchestration). **Explicitly mark** CI-impossible behaviour as deferred to `smoke-tests.md` (not mocked green). (FR-051/052, DECISION-26)
  - **Acceptance (Principle I — TOP PRIORITY; automated proof of FR-050/SC-014):** a network-level assertion (Playwright request interception over the whole flow) proves that across **both** framing phases — the **green room** *and* the full **60-second recording** — **zero** video bytes leave the device for framing, and the **only** video egress in the entire flow is the single final encoded clip POSTed to `/anchor` on success. A manual smoke check is **not** sufficient for this NON-NEGOTIABLE; this is the automated guarantee that the on-device detector "transmits nothing".
- [ ] T032 Author `specs/005-calibration-capture-flow/smoke-tests.md` — the six human-validated check groups (see the file's own structure): cross-browser webcam matrix; the three real camera-access conditions; the detector-unavailable fallback on a weak device; the recording screen at 360px; reduced-motion across every animated element; light/dark parity. Each enumerated as a manual check, none mocked. (FR-049, SC-011/012/014, DECISION-26)
- [ ] T033 Docs finalisation — append `docs/DECISIONS.md` entries **19–28**, the running 005 entry to `docs/PROGRESS.md`, and `docs/CHANGELOG.md` deltas (banner amber→foggy; old-UI removal; scoped CSP `'wasm-unsafe-eval'`; the explicit no-migration / no-backend-change note). (Principle VIII)

---

## Dependencies & Execution Order

### Phase dependencies

- **Phase 1 (Setup)**: T001 first; then **T002 → T003 (report-only) → T004 (enforce)** — the CSP must be enforced **before any detector call** (Risk R-2). T001 is `[P]` with T002.
- **Phase 2 (Foundational)**: T005/T006 `[P]`; T007 depends on T005+T006; T008 independent of the detector lib but blocks the surfaces. **Blocks all user stories.**
- **Phase 3 (US1)**: depends on Phase 2. T009/T010/T013 `[P]`; T011 needs T010+T007; T014 needs T010+T013; T016 needs T011; T017 needs T009–T016; T018 needs T017.
- **Phases 4–9 (US2–US7)**: depend on Phase 2 (+ the US1 surfaces they extend). US2 layers onto US1's green room/recording. US3–US7 layer on independently.
- **Phase 10 (Polish)**: T029/T030 `[P]` (anytime after T008). T031 after the story phases. **T032 then T033 last.**

### User-story dependencies

- **US1 (P1)** — the MVP; no dependency on other stories.
- **US2 (P1)** — co-P1; shares US1's green room/recording surfaces (the resilience/gate/drift slice).
- **US3–US5 (P2)** — layer onto the recording/failure surfaces; independently testable.
- **US6 (P2)** — account + calibrate-route; independent of US3–US5.
- **US7 (P3)** — banner restyle; independent.

### Parallel opportunities

- T001 ∥ T002; T005 ∥ T006; T009 ∥ T010 ∥ T013; T029 ∥ T030.

---

## Parallel Example: Phase 2 Foundational

```bash
# T005 and T006 touch different files with no interdependency:
Task: "Detector loader in apps/web/lib/face-detect/detector.ts"
Task: "Pure framing logic in apps/web/lib/face-detect/framing.ts"
# T007 then composes both; T008 (reducer) can proceed alongside T005/T006.
```

---

## Implementation Strategy

### MVP first (Phases 1–3)

1. Phase 1 Setup (incl. **CSP enforced before any detector call**).
2. Phase 2 Foundational (detector lib + reducer).
3. Phase 3 US1 — guided happy path on `/app/calibrate` **and** onboarding, healthz-gated, old UI removed.
4. **STOP and VALIDATE** US1 independently (intro → success → `/app`, banner gone).

### Incremental delivery

US1 (MVP) → US2 (resilience) → US3 (stop) → US4 (camera states) → US5 (failure) →
US6 (recalibrate) → US7 (banner) → Polish (device-memory, guardrails, e2e,
smoke-tests, docs). Each story adds value without breaking the prior ones.

---

## Notes

- **Reuse, don't rebuild**: T008/T017/T029/T026/T028 **extend** existing 004 files; only `lib/face-detect/*` and the new `components/anchor/*` surfaces are net-new.
- **Out of scope — no tasks generated**: live inference / runtime anchor read (006); any onboarding rebuild beyond mount + old-UI removal; the app-wide monotone redesign; a global type scale; the 004 e2e-hardening pass; the post-005 cleanup (auth amber notice; account-dropdown contrast). 005 corrects only its own banner to foggy and introduces no amber on any 005 surface.
- **Backend/DB/seed unchanged** — see `contracts/backend-unchanged.md`; no task touches `apps/api/`, `packages/`, `supabase/migrations/`, or `scripts/`.
- Verify each honest test **fails meaningfully** before its implementation where it asserts new behaviour (esp. T029 device-memory).
- Commit after each task or logical group; keep PRs to one phase-step where possible.
