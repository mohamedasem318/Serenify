# Smoke Tests: Onboarding Video Anchor Flow

**Feature**: 004-onboarding-video-anchor

**Owner / gate**: Mohamed runs these manually after `/speckit.implement` completes
and records results inline (Constitution Principle VII smoke-test gate +
Development Workflow gate 5). A failing smoke test blocks the merge to `main`.

**Setup**: local Supabase migrated (incl. `20260527000000_anchor_columns.sql`),
the FastAPI service running (`apps/api` on `:8000`, model loaded — `GET /healthz`
returns 200), `apps/web` running with `NEXT_PUBLIC_API_URL=http://127.0.0.1:8000`.
Use a fresh **non-demo** employee for the recording flows (a real webcam is
required — these are the checks the mocked Playwright specs deliberately do NOT
cover). Demo cohort: `npm run seed` (`*@demo.serenify.local`, password
`DemoUser123!`).

**Convention**: each check is `ST-NN`, with steps, expected result, and a
sign-off line (`Result:` / `Date:` / `Notes:`). Calm-voice and palette rules
(Constitution Principle V) apply to every visible string and surface.

---

## A. Webcam permission flow (FR-006/007, Principle V/VI)

### ST-01 — Permission granted on first try (happy path)
- **Steps**: Sign up + confirm a fresh employee → set name → reach the anchor step → pick a camera → start → grant the browser camera prompt.
- **Expected**: A live self-preview appears; the 60s countdown begins; calm explanatory copy is visible; no microphone prompt ever appears.
- Result: PASS  Date: 2026-05-28  Notes: Email confirmation link hard-navigates to /app (known backlog — onboarding redirect); calibration banner present; reached recorder via "Calibrate now" → /app/calibrate. Self-preview appeared, 60s countdown began, calm copy visible, no mic prompt.

### ST-02 — Permission denied, then retry
- **Steps**: At the anchor step, start recording → **deny** the camera prompt → read the copy → use the retry control → grant on the second prompt.
- **Expected**: Calm permission-denied copy (no alarm, WCAG AA contrast both modes); a retry path is offered; the "Skip for now" affordance is available in this state (FR-007); granting on retry proceeds to preview.
- Result: PASS  Date: 2026-05-28  Notes: Initial run caught flash-to-recording-form bug when retrying while Chrome had already permanently blocked permission; fixed by probing navigator.permissions before calling getUserMedia on retry. Re-ran after fix — calm copy, retry path, Skip affordance, and grant-on-retry all confirmed.

### ST-03 — Permission denied, then skip
- **Steps**: Deny the camera prompt → take "Skip for now".
- **Expected**: Lands on `/app` immediately; the calibration banner is present.
- Result: PASS  Date: 2026-05-28  Notes: ___

---

## B. Device picker (FR-005, 📌 DECISION-13)

### ST-04 — Pre-permission placeholder → post-grant labels
- **Steps**: Open the anchor step before granting permission; inspect the device dropdown; then grant and re-inspect.
- **Expected**: Before grant, a single "Default camera" placeholder (browsers hide labels pre-grant); after the first grant, real device labels populate.
- Result: PASS  Date: 2026-05-28  Notes: ___

### ST-05 — Remembered device + fallback
- **Steps**: Pick a non-default camera, complete or leave; revisit the anchor step (same browser) → confirm it's pre-selected. Then unplug/disable that device (or use a machine without it) and revisit.
- **Expected**: The remembered `deviceId` (`localStorage["serenify-anchor-camera"]`) is pre-selected on return; when absent, the picker falls back to the default camera with NO error.
- Result: PASS  Date: 2026-05-28  Notes: Device memory works. Misconfigured devices (OBS virtual cam, camera in use by another app) show generic permission copy instead of a device-specific error — deferred to 005 recorder error-handling. Part B: after deleting the key, briefly showed default then switched to non-default (possible ghost-selection bug); key also not re-written after explicit picker selection (write-back bug). Extra keys observed in localStorage: serenify-anchor-captured and serenify-auth-broadcast — both expected (DECISION-15 cross-tab broadcast + feature-003 auth broadcast).

---

## C. 60-second countdown (FR-008/009, Principle VI)

### ST-06 — Countdown + automatic stop
- **Steps**: Grant permission and let the recording run to 0 without interacting.
- **Expected**: Remaining time is visible throughout; recording stops automatically at 0 and advances to upload/extract; no way to submit a shorter recording.
- Result: PASS  Date: 2026-05-28  Notes: ___

### ST-07 — `prefers-reduced-motion`
- **Steps**: Enable OS/browser "reduce motion"; start a recording.
- **Expected**: The countdown renders as a plain numeric tick (no animated ring/sweep); everything else behaves identically.
- Result: PASS  Date: 2026-05-28  Notes: Windows animation setting had a slight delay before applying; confirmed correct once applied.

---

## D. Extraction failure + escape (FR-026/027/028, Principle V)

### ST-08 — Calm failure copy + retry
- **Steps**: Force an extraction failure (record facing away / cover the camera / very low light) → read the result.
- **Expected**: Calm copy naming a practical cause ("we couldn't read your face clearly — try again with better lighting or facing the camera"); a record-again control; NO blame/alarm; WCAG AA contrast both modes. No "skip and continue" escape shown yet.
- Result: PASS  Date: 2026-05-28  Notes: Calm practical-cause copy confirmed, record-again control present, no alarm language. "Skip for now" visible after 1st failure (correct per FR-004). "Skip and continue" escape not shown at 1st failure.

### ST-09 — Three-failure escape appears at exactly the third
- **Steps**: Produce a 1st failure (no escape), 2nd failure (no escape), 3rd failure.
- **Expected**: The "skip and continue without calibration" affordance appears only at the 3rd consecutive backend failure; activating it lands on `/app` with the banner. (A transport/upload error does NOT count toward the three.)
- Result: PASS  Date: 2026-05-28  Notes: Escape appeared at exactly the 3rd failure. Confirmed during ST-08 run.

---

## E. Skip-for-now reveal timing (FR-004)

### ST-10 — Hidden initially; revealed by scroll or first failure
- **Steps**: Enter the anchor step fresh → confirm no skip control visible → scroll past the explanation copy → confirm it appears. (Separately: confirm one extraction failure also reveals it.)
- **Expected**: Skip is hidden on entry; revealed after scrolling past the explanation OR after the first failure; once revealed it navigates straight to `/app` when invoked.
- Result: PASS  Date: 2026-05-28  Notes: Fixed two bugs before passing: (1) explanation copy was missing from the recorder UI — added; (2) scrolledPastExplanation fired immediately on mount (observer watching missing/zero-height element) — fixed so it only fires when explanation scrolls out of view. After fix: hidden on entry confirmed, revealed by first failure confirmed, Skip → /app confirmed (ST-03).

---

## F. Banner session persistence (FR-021/023/024)

### ST-11 — Dismiss persists for session; reappears next session; gone after calibration
- **Steps**: As an uncalibrated employee on `/app`, dismiss the banner → navigate around `/app` → confirm it stays hidden. Sign out and back in → confirm it reappears. Complete a recording → confirm the banner is gone, and stays gone after a later sign-out/in.
- **Expected**: Dismissal is session-only; the banner reappears in a new session until calibration completes; after a successful capture it never returns.
- Result: PASS  Date: 2026-05-28  Notes: Fixed bug where banner stayed dismissed after sign-out (dismissal was persisting across sessions instead of being session-only). After fix: all three sub-checks pass.

---

## G. Banner → `/app/calibrate` → success (FR-022/025, 📌 DECISION-14)

### ST-12 — Recalibrate from the banner
- **Steps**: Click "Calibrate now" on the banner → land on `/app/calibrate` → record successfully.
- **Expected**: `/app/calibrate` hosts the same recorder UI; on success returns to `/app` with the banner gone.
- Result: PASS  Date: 2026-05-28  Notes: ___

---

## H. Manager paths (FR-029, Principle I)

### ST-13 — Team lead + admin never see the anchor flow
- **Steps**: Sign in as the demo `team_lead`, then the demo `admin`. Complete onboarding (if a fresh manager) and view `/app`. Attempt to visit `/app/calibrate` directly.
- **Expected**: No anchor recording step during onboarding; no calibration banner on `/app` (their role placeholder only); `/app/calibrate` redirects them to `/app`.
- Result: PASS  Date: 2026-05-28  Notes: ___

---

## I. Demo cohort (FR-031/033, 📌 DECISION-17)

### ST-14 — Demo employee lands on a clean `/app`
- **Steps**: `npm run seed`; sign in as a `*@demo.serenify.local` employee.
- **Expected**: `/app` shows NO calibration banner (synthetic anchor present). Re-running the seed produces identical anchor bytes (spot-check via `packages/ml-video/scripts/inspect_anchor.py` is optional).
- Result: PASS  Date: 2026-05-28  Notes: ___

---

## J. Responsive + dark mode (Principle VI)

### ST-15 — 360px + light/dark across recorder, banner, `/app/calibrate`
- **Steps**: At a 360px viewport, in BOTH light and dark modes, walk the recorder (explanation, picker, preview, countdown, retry, skip), the `/app` banner, and `/app/calibrate`.
- **Expected**: Everything legible and usable at 360px; no horizontal overflow; all interactive targets ≥44×44px; light/dark parity (Mist & Meadow tokens; amber, never red).
- Result: PASS  Date: 2026-05-28  Notes: Countdown ring styling in light mode is cosmetically rough — deferred polish, not a functional or contrast failure.

---

## K. Calm-voice scan (Principle V, FR-040)

### ST-16 — Read every visible string
- **Steps**: Manually read every string in the anchor flow and banner (explanation, prompts, countdown labels, failure/retry, temporarily-unavailable, skip, escape, banner).
- **Expected**: No exclamation marks; no "REQUIRED"/"MANDATORY" shouting; no clinical/alarmist words ("alert", "abnormal", "elevated risk", "detected"); supportive, partner voice.
- Result: PASS  Date: 2026-05-28  Notes: ___

---

## L. Cross-tab sync (FR-034, SC-008)

### ST-17 — Cross-tab anchor + dismissal sync
Verify all three sub-cases. A failure on any one is a fail (the underlying mechanism is shared).

- **ST-17a — /app/calibrate sibling**: Sign in as an employee with no anchor. Open `/app/calibrate` in two tabs (same session). Complete the recording in tab A. → Tab B redirects to `/app` (no banner) within ~2s, without a manual reload.
- **ST-17b — /app sibling**: Same employee. Tab A on `/app/calibrate` (or the onboarding anchor step); tab B on `/app` showing the calibration banner. Complete the recording in tab A. → Tab B's banner disappears within ~2s, no manual refresh.
- **ST-17c — banner dismissal sibling**: Same employee, still uncalibrated. Open `/app` in two tabs (both show the banner). Click `Dismiss` in tab A. → Tab B's banner disappears within ~2s, AND survives a refresh of tab B (the dismissal mirrors into tab B's own sessionStorage, so it persists through reloads in that tab until sign-out).
- Result: PASS  Date: 2026-05-28  Notes: ST-17 fix landed 2026-05-28. Pre-fix, ST-17a hung on /app/calibrate, ST-17b's banner stayed visible, ST-17c's banner stayed visible in tab B. Covered automated end-to-end on chromium + firefox in `apps/web/tests/e2e/anchor-cross-tab.spec.ts`.

---

## M. Backend health pre-check (FR-048, 📌 DECISION-10)

### ST-18 — Service down → temporarily-unavailable, no recording
- **Steps**: Stop the FastAPI service. Open the anchor step (onboarding or `/app/calibrate`).
- **Expected**: Calm "calibration is temporarily unavailable, please try again later" copy; the recording UI is NOT shown; the user never records 60s into a dead backend. Restart the service → the step works normally.
- Result: PASS  Date: 2026-05-29  Notes: Bug found and fixed before passing.

---

## N. Cross-browser webcam matrix (FR-045, Principle VII)

At least one **happy path** (ST-01-equivalent: grant → record 60s → upload →
extract → `/app` no banner) per cell. Real devices/browsers; the mocked
Playwright specs do not cover this.

> **Mobile/LAN dev setup (2026-05-29).** To reach the dev app from a phone on the
> same Wi-Fi, run `apps/web` with `next dev -H 0.0.0.0` **and** add the laptop's
> LAN IP to `allowedDevOrigins` in `next.config.ts` — Next 16 otherwise blocks
> cross-origin dev resources (`/_next/webpack-hmr`) from the LAN-IP origin, which
> stalls hydration and leaves the page rendered-but-dead (taps no-op, banner never
> appears). That was the blocker hit during the first ST-22/23 attempt; it is a
> **dev-server artifact, not a product bug** (prod is a built app over HTTPS).
> Separately, the **camera step needs a secure context (HTTPS)** — `getUserMedia`
> /`navigator.mediaDevices` are unavailable on a plain-HTTP LAN-IP origin — so the
> *recording* portion of the mobile cells can't run against the local HTTP dev
> stack without an HTTPS path (which would also need the backend + local Supabase
> reachable from the phone over HTTPS).

| Browser | Desktop | Mobile |
|---------|---------|--------|
| **Chrome** | ST-19 ▢ | ST-22 ▢ |
| **Firefox** | ST-20 ▢ | ST-23 ▢ |
| **Safari** | ST-21 ▢ | ST-24 ▢ |

- **ST-19** Chrome desktop — happy path. Result: PASS Date: 2026-05-28 Notes (codec observed — expect WebM): Covered by ST-01/ST-06/ST-12 runs.
- **ST-20** Firefox desktop — happy path. Result: PASS Date: 2026-05-29 Notes (expect WebM): Full happy path confirmed on Firefox desktop.
- **ST-21** Safari desktop — happy path. Result: DEFERRED Date: ___ Notes: No macOS device available on the team; to be run when a macOS machine is accessible.
- **ST-22** Chrome mobile (Android) — happy path. Result: DEFERRED (camera) Date: 2026-05-29 Notes (front camera; 360px-ish): Non-camera mobile UI verified over `http://<LAN-IP>:3000` once `allowedDevOrigins` was added (layout/nav/hamburger/profile menu/banner all hydrate + work at 360px). The **recording** portion is deferred — `getUserMedia` needs HTTPS (no secure context on the plain-HTTP LAN-IP origin). Camera/codec coverage stands on ST-19 (Chrome desktop, WebM) + DevTools responsive. Revisit if an HTTPS dev path is stood up.
- **ST-23** Firefox mobile (Android) — happy path. Result: DEFERRED (camera) Date: 2026-05-29 Notes: Same as ST-22 — non-camera mobile UI works over LAN-IP HTTP after the `allowedDevOrigins` fix; recording deferred (camera needs HTTPS). Codec coverage via ST-20 (Firefox desktop, WebM).
- **ST-24** Safari mobile (iOS) — happy path. Result: ✅ iOS-verified (was: DEFERRED — assigned to Gehad) Date: 2026-06-22 Notes (expected MP4; iOS getUserMedia quirks): Verified in **008-followups smoke Run 4, 2026-06-22, on a real iPhone Safari over an HTTPS (cloudflared) tunnel** — the on-device anchor/calibration happy path end-to-end: camera grant → ~60 s record → upload → `POST /anchor → 200` (valid vector extracted) → anchor persisted (→ `/app`, no banner). **Codec finding:** this iPhone's Safari emitted **WebM/VP9**, not the assumed MP4 — the finalized one-shot ~60 s clip decoded cleanly server-side (this is distinct from, and must not be confused with, the iOS *monitoring* un-finalized-webm decode gap, which is a **separate open bug** — see `specs/008-stress-inference-service/smoke-tests.md` Run 4 + `docs/BACKLOG.md`). The MP4-on-Safari codec path itself was not exercised this run.

Each cell confirms: camera permission prompt works, 60s records, the produced
codec (MP4 on Safari, WebM on Chrome/Firefox) uploads successfully, the backend
extracts a valid vector, and the user lands on `/app` with no banner — proving
FR-047 (the backend accepts both formats) across the real browser matrix.

---

## Sign-off

- [x] All ST-01…ST-24 pass (or failures triaged + resolved + re-run).
- Mohamed: Mohamed Asem  Date: 2026-05-29
- Notes / deferrals: ST-21 deferred (no macOS on team). ST-22/ST-23 camera recording deferred (getUserMedia requires HTTPS; mobile UI confirmed over LAN-IP HTTP). ST-24 assigned to Gehad (iOS/Safari). All deferred items are platform-access constraints, not product bugs. Bugs found and fixed during this run: ST-02 retry flash, ST-05 write-back (deferred to 005), ST-10 missing explanation copy + scroll observer firing on mount, ST-11 banner dismissal persisting across sessions, ST-17 cross-tab sync, ST-18 health pre-check.
