# Smoke Tests: Calibration Capture Flow (005)

**Human-validated checks** for behaviour that cannot be honestly exercised in CI
(real cameras, real WASM on real hardware, real cross-browser `MediaRecorder`,
real reduced-motion/contrast perception). Per Constitution Principle VII and
DECISION-26, these are **run by hand, not mocked green**. Run after
`/speckit-implement` on a non-demo employee account without a baseline (demo users
are pre-anchored and skip the flow).

**How to record**: mark each row Pass / Fail / N-A with the date, tester, device,
browser, and a note on any failure. Mohamed signs off the table before merge.

Setup: backend `uv run uvicorn app.main:app --port 8000` (so `/healthz` is up);
web `npm run dev`. Force the detector-unavailable fallback by temporarily renaming
`apps/web/public/face-detect/` (or the dev `?noguide=1` override if wired).

---

## 1. Cross-browser webcam permission matrix

The permission grant flow reaches the green room and a real 60 s recording reaches
the success state.

| # | Browser | Device | Check | Result |
|---|---------|--------|-------|--------|
| 1.1 | Chrome | Desktop | Turn on camera → grant → green room → record 60 s → success → `/app`, no banner | |
| 1.2 | Firefox | Desktop | same | |
| 1.3 | Safari | Desktop (macOS) | same (Safari emits MP4; backend accepts) | |
| 1.4 | Chrome | Android | same; front camera; 360-ish width | |
| 1.5 | Safari | iOS | same; front camera | |
| 1.6 | Firefox | Android | same | |

## 2. The three real camera-access conditions

Each shows its **own** foggy state (never amber/red) naming the problem + fix, with
"Try again" and "Not now" (first-time "Not now" → `/app` with banner).

| # | Condition | How to trigger | Expected state | Result |
|---|-----------|----------------|----------------|--------|
| 2.1 | **Blocked** | Deny the prompt, or block the camera in the address bar, then Try again | "Blocked" — points to re-enable in the address bar | |
| 2.2 | **Busy** | Hold the camera in another app (video call), then Turn on camera | "Busy" — names video-call/streaming apps, closing frees it | |
| 2.3 | **No camera** | Disable/disconnect all cameras, then Turn on camera | "No camera found" — connect/enable then pick from the selector | |

## 3. Detector-unavailable fallback on a weak device

| # | Check | Expected | Result |
|---|-------|----------|--------|
| 3.1 | Rename `public/face-detect/` (assets 404) → open `/app/calibrate` | Green room shows "no live guide — you can still record"; gate bypassed; "I'm ready" available | |
| 3.2 | Throttle CPU (DevTools 6×) or use an old/low-end laptop | Either brief loading then active, or a deterministic fall to the unavailable fallback — **never** a hang in loading | |
| 3.3 | From the fallback, complete a recording | Records and reaches success without a live guide | |

## 4. Recording screen at 360px

| # | Check | Expected | Result |
|---|-------|----------|--------|
| 4.1 | DevTools 360px width on the recording screen | First-class layout (not a shrunk desktop): breathing guide focal, timer legible, brackets visible, stop reachable | |
| 4.2 | Touch targets (Stop, I'm ready, Not now, device picker, dialog buttons) | All ≥44×44px | |
| 4.3 | Intro, green room, success, failure, the three camera-access states, account section, banner at 360px | All legible and usable | |

## 5. Reduced-motion — every animated element has a true still equivalent

OS "reduce motion" ON. Each conveys the same thing **without** animation (not a
slowed version).

| # | Element | Expected still equivalent | Result |
|---|---------|---------------------------|--------|
| 5.1 | Breathing guide (4-in/6-out) | Static "breathe in / hold / out" cue, no expand/contract | |
| 5.2 | 3→2→1 get-ready countdown | Plain numeric tick, no ring/sweep | |
| 5.3 | Success bloom ripple | Static drawn check, no ripple | |
| 5.4 | Bracket-drift nudge | Instant state/colour + text change, no animated pulse | |
| 5.5 | Countdown blur transition | Immediate softened-not-sharp state, no animated blur | |

## 6. Light / dark parity (WCAG AA)

Every state in both themes; **no amber, no crimson** on any calibration/error
surface (foggy/meadow/neutral only); affirmative confirmation is meadow.

| # | State | Light | Dark | Result |
|---|-------|-------|------|--------|
| 6.1 | Intro | AA | AA | |
| 6.2 | Green room (+ 3 guide states) | AA | AA | |
| 6.3 | Get-ready countdown | AA | AA | |
| 6.4 | Recording stage | AA | AA | |
| 6.5 | Stop confirmation (non-destructive) | AA | AA | |
| 6.6 | Success | AA | AA | |
| 6.7 | Failure (+ cause chip, foggy) | AA | AA | |
| 6.8 | Camera-access: Blocked / Busy / No-camera | AA | AA | |
| 6.9 | Account "Your calm baseline" | AA | AA | |
| 6.10 | Home banner (foggy + meadow button) | AA | AA | |

---

## 7. Flow-integrity spot checks (manual)

| # | Check | Expected | Result |
|---|-------|----------|--------|
| 7.1 | Stop during recording → confirm | Returns to the **green room** (not a fresh countdown); nothing saved | |
| 7.2 | `/healthz` down (stop the API) → open `/app/calibrate`, reach "I'm ready" | Health-gated **before** the countdown; calm "temporarily unavailable" copy; never records | |
| 7.3 | Onboarding first-time capture | Shows the **new** redesigned flow (no old 004 UI anywhere) | |
| 7.4 | Recalibrate from account, then abort (stop / "Not now") | Existing baseline intact; no banner; back on `/app/account` | |
| 7.5 | Recalibrate success | "Your baseline is updated"; `/app/account` | |
| 7.6 | Stray `?mode=recalibrate` on a user with **no** baseline | First-time copy + `/app` exit (mode hardened against `has_anchor`) | |
| 7.7 | Banner cross-tab | Completing calibration in one tab drops the banner in a sibling tab; dismissal mirrors | |

---

**Sign-off**: ______________________  **Date**: __________

_Failures must be filed and resolved (or explicitly accepted with a rationale)
before merge to `main`._
