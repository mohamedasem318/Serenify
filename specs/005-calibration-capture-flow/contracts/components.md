# Contract: Web Components & State Machine (`apps/web/components/anchor/`)

Extends the 004 anchor feature. All surfaces use Mist & Meadow tokens only
(`foggy`/`meadow`/neutral; **no amber, no crimson** on any 005 calibration/error
surface — FR-046), calm voice (FR-047), and a true motion-free equivalent gated on
`useMediaQuery("(prefers-reduced-motion: reduce)")` (📌 DECISION-27).

## 1. Extended state machine — `use-anchor-recorder.ts`

States and the canonical happy path:

```text
intro ──Turn on camera──▶ permission-requesting
  permission-requesting ──granted──▶ green-room
  permission-requesting ──NotAllowedError/blocked──▶ camera-blocked
  permission-requesting ──NotReadableError/TrackStartError/AbortError──▶ camera-busy
  permission-requesting ──NotFoundError/OverconstrainedError──▶ camera-no-device
  green-room ──I'm ready (gate ready)──▶ get-ready ──3·2·1──▶ recording
  recording ──stop──▶ stop-confirming ──confirm──▶ green-room   (nothing saved)
  recording ──60 s complete──▶ uploading ──POST /anchor (upload + server extraction)
  uploading ──200──▶ success
  uploading ──422──▶ extract-failed (++failureCount; cause chip; escape at ≥3)
  uploading ──transport/401──▶ upload-failed (retry, not a strike)
```

### `getUserMedia` error → camera-access state (the three calm states)

| `error.name` | State | Copy intent (FR-031–FR-035) |
|---|---|---|
| `NotAllowedError` / `SecurityError` (or `permissions.query === "denied"`) | `camera-blocked` | re-enable the camera in the browser's address bar |
| `NotReadableError` / `TrackStartError` / `AbortError` | `camera-busy` | a video-call/streaming app likely holds it; closing it frees it up |
| `NotFoundError` / `OverconstrainedError` / `DevicesNotFoundError` | `camera-no-device` | connect or enable a camera, then pick it from the selector |

Each offers "Try again" and "Not now". "Try again" re-enters
`permission-requesting`; "Not now" follows the mode exit rule (below). The existing
`navigator.permissions.query` anti-flash probe routes a hard block straight to
`camera-blocked` without re-calling `getUserMedia`.

### `mode` and exits (FR-053)

- `mode` ∈ `"first-time" | "recalibrate"` (from `searchParams.mode`).
- Copy nudges set→update in recalibrate (success: "Your baseline is updated").
- Exit destinations: see `data-model.md` §B.2. All capture-route exits are **hard
  navigations** (`window.location.replace`).

## 2. Component contracts

| Component | Responsibility | Key props / notes |
|---|---|---|
| `intro.tsx` | Pre-camera intro: heading "Set your calm baseline", 3 icon-led what-to-expect lines, privacy line, "Turn on camera", permission-coming line. | `onTurnOnCamera()` |
| `green-room.tsx` | Live preview + `framing-overlay` + device picker + gate-driven "I'm ready" (+ helper line) + "Not now"; renders the three guide states. | `video`, `gate`, `ready`, `guide`, `onReady`, `onNotNow` |
| `framing-overlay.tsx` | **Fixed** centred corner brackets + dimmed spotlight (face area sharp) + drift nudge layer. Used in green room AND recording. Motion-free variant. | `drift`, `reducedMotion` |
| `get-ready-countdown.tsx` | 3 → 2 → 1, **numbers only, no ring**; preview blurs then eases to **softened (never fully sharp)**; quiet "Cancel". Motion-free → numeric tick + immediate softened state. | `onComplete`, `onCancel` |
| `recording-stage.tsx` | Breathing guide focal over **softened** preview; `recording-timer` as **sole** progress; persistent `framing-overlay`; "we've got you"; stop. | `remaining`, `drift`, `onStop` |
| `breathing-guide.tsx` | 4-in / 6-out; **not** a progress indicator. Motion-free → static "breathe in / hold / out" cue ladder. | `reducedMotion` |
| `recording-timer.tsx` | The 60 s **sole** progress indicator (re-home of the 004 ring). Shared reduced-motion hook. | `remaining`, `total` |
| `stop-confirm.tsx` | Honest stop dialog: "starting the minute over", "nothing saved yet, so nothing is lost"; "Keep going" default. **Non-destructive (no crimson).** → green room on confirm. | `onKeepGoing`, `onConfirmStop` |
| `success-state.tsx` | Drawn check + soft bloom ripple; heading "Your baseline is set/updated"; **readable** body (fix 004's tiny text); "Back to home"/"Back to account". Motion-free → static check. | `mode`, `onDone` |
| `failure-state.tsx` | Foggy (never red/amber); adaptive **cause chip** (low-light / out-of-frame / our-side); "Try again" (→ green room) / "Not now"; escape at failure threshold ("Maybe later" / "Try once more"). | `cause`, `escapeVisible`, `onRetry`, `onNotNow`, `onPause` |
| `camera-access-state.tsx` | One of Blocked / Busy / No-camera; foggy; "Try again" / "Not now". | `kind`, `onRetry`, `onNotNow` |
| `baseline-section.tsx` | Account "Your calm baseline": whether-set (`has_anchor`) + "Set a new baseline" → replace heads-up dialog ("Keep current" / "Set new baseline", non-destructive) → **`<a href="/app/calibrate?mode=recalibrate">`** (full nav). | server-passed `hasAnchor` |
| `calibration-banner.tsx` (MODIFIED) | Restyle **amber→foggy** + **meadow** "Set baseline"; preserve appear/dismiss-session/reappear/disappear-on-calibrate + cross-tab (FR-042–FR-044, FR-054). CTA stays `<a href="/app/calibrate">`. | — |
| `device-picker.tsx` (MODIFIED) | FR-045: persist the resolved default on a cleared/absent store, without clobbering a temporarily-absent remembered device. | — |

## 3. Cause-chip mapping (📌 DECISION-24)

`failure-state.tsx` consumes `causeTelemetry.dominantCause()`:

| Dominant client signal | Chip | Copy |
|---|---|---|
| mostly-dark | low-light | "facing a little more light usually helps" |
| mostly off-centre/absent | out-of-frame | "staying roughly centred and still helps" |
| none / detector unavailable / backend `bad_vector` | our-side | "this one was on our side — give it a moment and try again" |

We never assert a user-side cause we did not measure (the our-side copy carries no
"do better" instruction).

## 4. Honest-test seams (📌 DECISION-26)

- `useFramingGuide({ createDetector })` — inject a fake detector → drive synthetic
  signals into the **real** gate/drift logic.
- Orchestrator deps `{ getUserMedia, MediaRecorder, postAnchor, supabase }` —
  injectable; assert recalibrate `update()` fires **only** on success.
- `getUserMedia` rejection by `error.name` → assert the **real** three-state map.
- Reducer transitions (stop→green-room, mode exits, escape ≥3) tested directly.
- Banner lifecycle + cross-tab run the real `sessionStorage`/storage-event paths.

## 5. Route hosts

| Route/file | Change |
|---|---|
| `app/(authed)/app/calibrate/page.tsx` | Read `searchParams.mode`; in `recalibrate` **suppress** the `has_anchor`→`/app` redirect; still employee-gate. |
| `app/(authed)/app/calibrate/calibrate-recorder.tsx` | Accept `mode`; exits → `/app` (first-time) or `/app/account` (recalibrate), hard nav. |
| `app/(authed)/app/account/page.tsx` | Render `<BaselineSection hasAnchor={…}/>` after Security; server-side `has_anchor`. |
| `app/(onboarding)/onboarding/onboarding-form.tsx` | Unchanged host; the redesigned `<AnchorRecorder context="onboarding"/>` flows through. |
| `app/(authed)/app/page.tsx` | Unchanged mount; banner restyle is internal to the component. |
