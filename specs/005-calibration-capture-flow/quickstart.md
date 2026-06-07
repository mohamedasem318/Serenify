# Quickstart: Calibration Capture Flow (005)

Run the redesigned flow locally and exercise **every** state, including the ones
CI cannot reach (real camera, the detector-unavailable fallback). Assumes the 004
substrate is in place (see `specs/004-onboarding-video-anchor/quickstart.md` for
the full backend setup).

## 1. Backend (unchanged from 004)

```bash
# from apps/api/  (Python 3.12 venv via uv)
uv run uvicorn app.main:app --reload --port 8000
# GET http://127.0.0.1:8000/healthz → {"status":"ready", ...}
```

005 changes **no** backend code. If `/healthz` is down, the web app shows the calm
"temporarily unavailable" copy and **does not** let you record — that gate is a
004 invariant 005 preserves (use it to test that path: stop the API and open
`/app/calibrate`).

## 2. Web app

```bash
# from apps/web/
npm run dev          # http://localhost:3000  (NEXT_PUBLIC_API_URL defaults to http://127.0.0.1:8000)
```

Sign in as a **non-demo employee** without a baseline (demo users are pre-anchored
and skip the flow). The home banner (now **foggy**, meadow "Set baseline") links to
`/app/calibrate`.

## 3. Walk the happy path

`/app/calibrate` → **intro** ("Set your calm baseline", what-to-expect, privacy) →
**Turn on camera** → grant → **green room** (fixed corner brackets, dimmed
surround, device picker, the soft gate enabling **I'm ready**) → **I'm ready** →
**3·2·1** (preview blurs then eases to *softened, not sharp*) → **60 s recording**
(breathing guide focal, the timer is the only progress, ambient brackets) →
**success** (drawn check + bloom, "Your baseline is set", "Back to home") → `/app`
with **no banner**.

## 4. Exercise each branch

| To see… | Do this |
|---|---|
| **Camera Blocked** | Deny the permission prompt (or block the site's camera in the address bar), then "Try again". |
| **Camera Busy** | Open the camera in another app (e.g. a video call), then "Turn on camera" → expect the Busy state. |
| **No camera found** | Disable/disconnect all cameras (or use a profile with none), then "Turn on camera". |
| **Soft gate holds** | In the green room, move off-centre / cover the camera / dim the room → "I'm ready" stays disabled with a calm helper line; recentre/brighten → it enables. |
| **Detector loading** | Throttle CPU (DevTools → Performance → CPU 6×) and reload `/app/calibrate` → brief loading guide state. |
| **Detector UNAVAILABLE (fallback)** | Temporarily rename `apps/web/public/face-detect/` (so the assets 404) **or** set the dev override (below) → green room shows "no live guide — you can still record", the gate is bypassed, "I'm ready" is available. |
| **Drift nudge** | During recording, drift off-centre and **hold** past the grace window (~2 s) → calm "ease back to centre"; a brief wobble shows **nothing**; leave frame entirely → "we can't see you". Recording never stops. |
| **Stop → green room** | During recording, Stop → honest confirm ("starting the minute over", "nothing lost") → Confirm → back in the **green room** (not a fresh countdown). |
| **Post-recording failure + cause chip** | Point the API at a clip it can't extract (or use the API's failure fixture) → foggy failure with the cause chip; the chip reflects what the detector observed (dark → low-light; off-centre → out-of-frame; otherwise our-side). |
| **Escape hatch** | Fail extraction repeatedly to the threshold → "Maybe later" / "Try once more". |
| **Recalibrate** | `/app/account` → "Your calm baseline" → "Set a new baseline" → replace heads-up → runs the same flow with **update** copy → success "Your baseline is updated" → back to **/app/account**; aborting/failing leaves the old baseline intact, no banner. |
| **Banner lifecycle + cross-tab** | As an un-calibrated employee: see the foggy banner on `/app`; Dismiss → hidden this session; open a 2nd tab → completing calibration drops the banner in both; new session → reappears until calibrated. |
| **Reduced motion** | OS "reduce motion" on → breathing guide, 3·2·1, success bloom, drift nudge, blur all present **still** equivalents (no animation), not slowed motion. |
| **360px + dark** | DevTools 360px width; toggle dark — the recording screen is a first-class 360px layout, ≥44px targets, AA contrast. |

### Dev override for the detector-unavailable fallback

Renaming `public/face-detect/` is the simplest force. (If a dev query flag is wired
during implementation — e.g. `?noguide=1` on `/app/calibrate` — document it here and
keep it dev-only.)

## 5. Tests

```bash
# from apps/web/
npm run test          # Vitest + RTL: reducer ext, pure framing/grace (fake clock),
                      #   device-memory fix (fails pre-fix), banner lifecycle, cause chip
npm run test:e2e      # Playwright: happy path, recalibrate, 3 camera-access states,
                      #   banner appear/disappear/persist + cross-tab — boundary-injected
```

CI-impossible checks (real webcam permission across browsers, real WASM on a real
weak device, real cross-browser `MediaRecorder`) live in `smoke-tests.md` and are
run by hand — they are **not** mocked green (📌 DECISION-26).

## 6. CSP note

The detector needs a scoped `script-src 'wasm-unsafe-eval'` (and possibly
`worker-src 'self' blob:`) on the capture routes only. If the detector silently
fails to load with a `securitypolicyviolation` in the console, the CSP delta
(`proxy.ts::buildCsp`) has not landed/enforced correctly — it must ship **before**
the detector's first call (📌 DECISION-20).
