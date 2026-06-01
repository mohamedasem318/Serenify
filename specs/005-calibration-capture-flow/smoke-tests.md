# Smoke Tests: Calibration Capture Flow (005)

**Human-validated checks** for behaviour that cannot be honestly exercised in CI
(real cameras, real WASM on real hardware, real cross-browser `MediaRecorder`, real
reduced-motion / contrast perception). Per Constitution Principle VII and DECISION-26,
these are **run by hand, not mocked green**.

**Account to use**: a real (non-demo) **employee** account whose baseline is **not yet
set** — sign in lands on `/app` with the calibration banner showing. Demo cohort users
are pre-anchored and skip the flow, so they cannot drive §1–§7. The recalibrate checks
(§8) need an account that **already** has a baseline (run a §1 capture first, or reuse
one that has calibrated).

**How to record**: put your initials + the date in **Notes** and mark **Pass/Fail** for
every row you run (or `N-A` with a reason, e.g. no Apple hardware). Mohamed signs off the
table before merge. A failure must be filed and resolved (or explicitly accepted with a
rationale) before merge to `main`.

**Setup**:
- Backend up: `uv run uvicorn app.main:app --port 8000` (so `/healthz` is ready and
  `/anchor` extracts). Web: `npm run dev`.
- **To force the detector-unavailable fallback** (§3): DevTools → Network → enable
  **Block request URL** and add the pattern `*/face-detect/*`, then reload
  `/app/calibrate`. This is restart-proof; renaming `apps/web/public/face-detect/` does
  **not** work because `next.config.ts` re-copies the WASM runtime into it on every dev
  start.
- **To force a backend-down state** (§8.7): stop the uvicorn process so `/healthz` fails.
- **Reduced motion** (§5): turn on the OS "Reduce motion" setting (macOS
  Accessibility → Display; Windows Settings → Accessibility → Visual effects → off).

**What the automated e2e already covers vs. what these checks defer (T031).** The
Playwright suite (`anchor-egress`, `anchor-flow`, `anchor-camera-access`,
`anchor-banner`, `anchor-cross-tab`) runs the CI-runnable paths with boundary seams —
including the NON-NEGOTIABLE FR-050 egress proof (`anchor-egress.spec.ts`: zero video
bytes leave the device across the green room *and* the full 60 s recording; the only
video egress is the single final `/anchor` clip POST), the happy + recalibrate paths,
the three camera-access states (via injected `getUserMedia` rejections), and the banner +
cross-tab lifecycle. These manual checks deliberately cover only what CI **cannot
honestly run**, never mocked green:

- **Real WASM detector clearing the soft gate on a real face** (§1, §7). The e2e clears
  the gate via an *injected* deterministic detector (real BlazeFace sees no face in a
  headless browser); a real camera + real face clearing the real gate is here.
- **Real OS camera-permission prompts and real device states** (§2). The e2e drives
  `error.name` rejections to assert the *mapping*; the real Blocked/Busy/No-camera
  conditions with actual prompts/hardware are here.
- **The detector-unavailable fallback on real/weak hardware** (§3), **real cross-browser
  `MediaRecorder`/webcam** (§1), **reduced-motion** (§5) and **light/dark perception**
  (§6) — none are honestly runnable in CI.

---

## 1. Cross-browser webcam permission matrix

The full happy path on a real camera: intro → grant → green room (the **real** detector
clears the soft gate on your face) → 3·2·1 → 60 s recording → success → `/app`. Sign in
fresh (un-calibrated) for each row.

**Action (every row)**: On `/app`, click **Set baseline** in the banner (or open
`/app/calibrate`) → **Turn on camera** → grant permission → centre your face and wait for
**"I'm ready"** to enable → click it → watch **3·2·1** → sit through the **60-second**
recording → reach the success screen → click **Back to home**.
**Expected (every row)**: Permission prompt appears; the green room shows your live
preview with corner brackets and a device picker; "I'm ready" enables once you're centred
and lit; the countdown plays; the timer counts 60→0; the success screen reads **"Your
baseline is set"**; **Back to home** lands on `/app` with **no banner**.

| # | Browser / device | Pass/Fail | Notes |
|---|------------------|-----------|-------|
| 1.1 | Chrome — desktop | | |
| 1.2 | Firefox — desktop | | |
| 1.3 | Safari — desktop (macOS; emits MP4, backend accepts) | | |
| 1.4 | Chrome — Android (front camera) | | |
| 1.5 | Safari — iOS (front camera; emits MP4) | | |
| 1.6 | Firefox — Android | | |

## 2. The three real camera-access conditions

Each shows its **own** foggy state (never amber, never red) naming the problem **and** the
fix, with a foggy **Try again** and a quiet **Not now**. Drive each on `/app/calibrate` by
clicking **Turn on camera**.

| # | Action | Expected result | Pass/Fail | Notes |
|---|--------|-----------------|-----------|-------|
| 2.1 | **Blocked**: deny the permission prompt (or block the camera via the address-bar icon), then Turn on camera | Heading **"Camera's blocked"**; body points to **re-enable it from the camera icon in your address bar**; foggy; **Try again** + **Not now** present; no recording timer | | |
| 2.2 | **Busy**: hold the camera in another app (a video call / screen recorder), then Turn on camera | Heading **"Camera's in use"**; body names a **video call or screen recorder** and that **closing it frees it up**; foggy; **Try again** + **Not now**; no timer | | |
| 2.3 | **No camera**: disable/disconnect every camera, then Turn on camera | Heading **"No camera found"**; body asks to **connect or enable one, then pick it from the selector**; foggy; **Try again** + **Not now**; no timer | | |
| 2.4 | From the **Busy** state, free the camera (close the other app), then click **Try again** | Re-requests access and enters the green room on a working camera (not re-trapped) | | |
| 2.5 | From any state, click **Not now** (first-time capture) | Returns to `/app` with the calibration banner still showing | | |

## 3. Detector-unavailable fallback on a weak device

The user is **never** locked out when the on-device guide can't run (FR-011).

| # | Action | Expected result | Pass/Fail | Notes |
|---|--------|-----------------|-----------|-------|
| 3.1 | Block `*/face-detect/*` in DevTools (see Setup), reload `/app/calibrate`, Turn on camera | Green room shows **"No live guide — you can still record."**; the soft gate is bypassed — **"I'm ready" is enabled** with no face required | | |
| 3.2 | DevTools → Performance → CPU throttle 6×, or use an old/low-end laptop, then enter the green room | Either a brief "Getting your live guide ready…" then the live guide activates, **or** a deterministic fall to the "No live guide" fallback — **never** a permanent hang on the loading state | | |
| 3.3 | From the fallback (3.1), press **I'm ready** and complete a full 60 s recording | Records and reaches the **"Your baseline is set"** success screen without a live guide | | |

## 4. Recording screen at 360px (mobile-first, not a shrunk desktop)

Use DevTools responsive mode at **360px** width (or a real ~360px phone).

| # | Action | Expected result | Pass/Fail | Notes |
|---|--------|-----------------|-----------|-------|
| 4.1 | View the **recording** screen at 360px | First-class layout: the breathing orb is the focal graphic on the softened preview; the 60 s timer is legible; the corner brackets are visible; the **Stop** control and the "We've got you — just keep breathing." line sit in the card below the preview — nothing overlaps or is cut off | | |
| 4.2 | Measure the interactive targets at 360px (Stop, I'm ready, Not now, Cancel, the device picker, dialog buttons) | All are **≥44×44px** and comfortably tappable | | |
| 4.3 | View **intro** and **green room** at 360px | Heading, the three what-to-expect lines, the privacy line, the preview, the device picker, and the buttons all fit and are legible | | |
| 4.4 | View **success**, **failure**, and the three **camera-access** screens at 360px | Each centred, legible, with full-width buttons; no horizontal scroll | | |
| 4.5 | View the **account "Your calm baseline"** section and the **home banner** at 360px | The banner stacks (text over button); the account section's status row + CTA stack; both legible | | |

## 5. Reduced motion — every animated element has a true still equivalent

OS "Reduce motion" **ON**. Each element conveys the same thing **without** animation (an
instant state change, **not** a slowed-down version).

| # | Element | Expected still equivalent | Pass/Fail | Notes |
|---|---------|---------------------------|-----------|-------|
| 5.1 | Breathing orb (recording) | The green pool does **not** pulse/expand — it sits at a fixed mid-size; the **"Breathe in" / "Breathe out"** label still alternates on the 4 s-in / 6 s-out cadence (an instant text swap) to carry the pace. (There is no "hold" label.) | | |
| 5.2 | 3 → 2 → 1 get-ready countdown | The numeral just **ticks** 3, 2, 1 with no zoom/fade and no ring/sweep | | |
| 5.3 | Success screen | A **static drawn check** — no bloom ripple, no path-draw animation | | |
| 5.4 | In-recording bracket drift (off-centre / absent) | The corner brackets change to **foggy by hue only** (no pulse/blink) and the nudge text appears instantly ("Ease back to centre" / "We can't see you — ease back into view") | | |
| 5.5 | Countdown → recording blur | The preview snaps to the **softened (never fully sharp)** state instantly — no animated blur transition | | |
| 5.6 | Green-room affirmative + loading dot | When the gate clears, the meadow brackets + check appear with **no animated glow/fade**; the brief loading dot does **not** pulse | | |

## 6. Light / dark parity (WCAG AA + colour discipline)

For each surface, toggle the theme and view it in **both** light and dark. **Expected
both themes**: text meets AA (no gray-on-gray); **no amber, no crimson** anywhere
(foggy / meadow / neutral only); affirmative confirmations (Turn on camera, I'm ready,
Set a new baseline, Keep going, success, Back to home) are **meadow**; attention/error
surfaces (banner CTA, failure, the three camera-access screens, the backend-down modal)
are **foggy**.

| # | Surface | Per-surface colour expectation | Pass/Fail | Notes |
|---|---------|--------------------------------|-----------|-------|
| 6.1 | Intro | Meadow "Turn on camera"; foggy what-to-expect icon chips; neutral text | | |
| 6.2 | Green room (+ loading / active / unavailable guide states) | Meadow "I'm ready" + meadow affirmative brackets/check; foggy loading dot; neutral helper text | | |
| 6.3 | Get-ready countdown | White numeral legible over the blurred preview | | |
| 6.4 | Recording stage | Meadow breathing orb; foggy drift-nudge chip; neutral "Stop" / reassurance | | |
| 6.5 | Stop confirmation | Meadow "Keep going"; neutral outline "Start over" — **no crimson** (non-destructive) | | |
| 6.6 | Success | Meadow check + bloom + meadow "Back to home/account" | | |
| 6.7 | Failure (+ cause chip) | **Foggy** throughout — foggy chip, foggy "Try again"; **no amber, no red** | | |
| 6.8 | Camera-access: Blocked / Busy / No-camera | **Foggy** icon + foggy "Try again"; ghost "Not now"; **no amber, no red** | | |
| 6.9 | Account "Your calm baseline" | Meadow "Set a new baseline"; in the heads-up, neutral outline "Keep current" + meadow "Set new baseline" | | |
| 6.10 | Home calibration banner | **Foggy** surface (border + background) + a **foggy "Set baseline"** button (dark/ink text) — **not** meadow, **not** amber | | |
| 6.11 | Backend-down modal | Foggy "Try again"; ghost "Not now"; strong scrim isolating the modal | | |

## 7. Live framing guide — gate + drift (real detector, real face)

Needs the real detector running (do **not** block `/face-detect/*` here). Drive these in
the green room and during a recording.

| # | Action | Expected result | Pass/Fail | Notes |
|---|--------|-----------------|-----------|-------|
| 7.1 | Centre your face, well lit, in the green room | Helper reads **"You're all set — start when you're ready."**; brackets turn **meadow** with a check; **"I'm ready" enables** | | |
| 7.2 | Move out of frame in the green room | Helper reads **"We can't see your face yet — come into view."**; "I'm ready" **disabled** | | |
| 7.3 | Sit well off to one side | Helper reads **"Ease into the centre of the frame."**; "I'm ready" **disabled** | | |
| 7.4 | Dim the room / cover the lens partly | Helper reads **"A little more light on your face would help."**; "I'm ready" **disabled** | | |
| 7.5 | During recording, stay centred | Brackets are **steady meadow** (quiet); no nudge; "We've got you — just keep breathing." shows; the minute keeps running | | |
| 7.6 | During recording, drift off-centre and **hold ~2 s+** | After the grace window, brackets blink **foggy** and **"Ease back to centre"** appears; recording **does not** stop | | |
| 7.7 | During recording, move fully out of view and **hold ~2 s+** | Brackets blink foggy and **"We can't see you — ease back into view"** appears; recording **does not** stop | | |
| 7.8 | During recording, a quick wobble (**under ~2 s**) then re-centre | **No** nudge fires (the grace window absorbs the wobble) | | |

## 8. Flow-integrity spot checks

| # | Action | Expected result | Pass/Fail | Notes |
|---|--------|-----------------|-----------|-------|
| 8.1 | During recording, click **Stop** | A dialog asks **"Start the minute over?"** — "Stopping starts the calm minute again — nothing's saved yet, so nothing's lost." with **Keep going** (default) + **Start over**; **no crimson** | | |
| 8.2 | In that dialog, click **Keep going** (or press Escape / click outside) | The recording **resumes** from where it was; no restart | | |
| 8.3 | Trigger the dialog again and click **Start over** | Returns to the **green room** (NOT a fresh countdown); nothing is saved | | |
| 8.4 | Record a minute with extraction bound to fail (lens covered / facing away / very dark) so the backend returns a processing failure | Foggy failure screen **"We couldn't set your baseline that time"** + a foggy cause chip (low-light / out-of-frame / our-side matching the conditions) + **Try again** / **Not now**; **no amber, no red** | | |
| 8.5 | Fail the recording **3 times in a row** (repeat 8.4) | On the 3rd failure a gentle escape appears: **"Let's pause this for now — you can set your baseline later from your account."** with **Try once more** + **Maybe later** | | |
| 8.6 | `/healthz` down (stop uvicorn) → green room → press **I'm ready** | A **blocking** modal **"Calibration's having a quiet moment"** appears with **Try again** + **Not now**; the controls beneath are inert; it cannot be dismissed by Escape or clicking outside; the countdown never starts | | |
| 8.7 | From 8.6, bring the backend back up, then click the modal's **Try again** | The modal closes and the get-ready countdown begins (the gate re-checks `/healthz`) | | |
| 8.8 | Recalibrate: on `/app/account`, the **"Your calm baseline"** section shows **"Baseline set"** → click **Set a new baseline** | A heads-up dialog **"Set a new baseline?"** appears with **Keep current** (leaves the baseline untouched, closes) + **Set new baseline** | | |
| 8.9 | Click **Set new baseline** in the heads-up | A **full-page** navigation to `/app/calibrate?mode=recalibrate`; the intro reads **"Update your calm baseline"** | | |
| 8.10 | Complete the recalibrate recording | Success reads **"Your baseline is updated"**; **Back to account** lands on `/app/account` | | |
| 8.11 | Start a recalibration, then abort it (Stop → Start over → Not now, or "Not now" from the green room) | The **existing baseline is intact** (still "Baseline set"); no calibration banner; you're back on `/app/account` | | |
| 8.12 | Visit `/app/calibrate?mode=recalibrate` as a user with **no** baseline | Behaves first-time: intro reads **"Set your calm baseline"** and the exit goes to `/app` (mode reconciled against `has_anchor`) | | |
| 8.13 | Onboarding first-time capture (a brand-new employee through `/onboarding`) | Shows the **new** redesigned flow (intro → green room → 3·2·1 → 60 s → success) — no old 004 calibration UI anywhere | | |
| 8.14 | Banner lifecycle: un-calibrated employee on `/app` | A **foggy** banner reads "Stress detection isn't active yet — it needs about a minute of calibration to know what your calm looks like." with a foggy **Set baseline** button + **Dismiss** | | |
| 8.15 | Dismiss the banner, reload, then start a fresh session | Dismiss hides it for the session and across a reload; it **reappears** in a new session (and disappears for good once you calibrate) | | |
| 8.16 | Cross-tab: open `/app` in two tabs of the same browser, calibrate in one | The other tab's banner drops (and a sibling `/app/calibrate` tab redirects to `/app`); a dismissal in one tab mirrors to the other | | |

---

**Sign-off**: ______________________  **Date**: __________

_Failures must be filed and resolved (or explicitly accepted with a rationale) before
merge to `main`._
