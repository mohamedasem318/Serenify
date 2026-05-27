# Contract: web components (`apps/web/`)

All new UI is under `components/anchor/`. The recorder is a Client Component;
pages that host it are Server Components that role-gate first. See 📌 DECISION-13/14.

---

## `AnchorRecorder` (client)

`components/anchor/anchor-recorder.tsx` — the full capture flow. Used by **both**
the onboarding step and `/app/calibrate`.

**Props**:

| Prop | Type | Notes |
|------|------|-------|
| `onComplete` | `() => void` | Called after the vector is written + broadcast; the host routes to `/app`. |
| `onSkip` | `() => void` | Called when the user takes "Skip for now" / the 3-fail escape. Host routes to `/app`. |
| `context` | `"onboarding" \| "calibrate"` | Copy/telemetry only; behavior identical. |

**Behavior contract**:

- Pings `GET /healthz` before showing the recording controls; unreachable →
  "temporarily unavailable" copy, no recording offered (FR-048).
- Drives the `useAnchorRecorder` state machine (below).
- Writes `anchor_vector` / `anchor_captured_at` / `anchor_model_version` to the
  user's own profile row via the **session** Supabase client on success
  (resolved decision 2), then calls `broadcastAnchorCaptured()` (📌 DECISION-15)
  and `onComplete()`.
- All copy calm-voice (Principle V); renders correctly at 360px, light+dark,
  ≥44×44px; countdown respects `prefers-reduced-motion` (numeric tick).

## `useAnchorRecorder` (state machine)

`components/anchor/use-anchor-recorder.ts` — reducer. States:

```text
idle → device-selecting → permission-requesting → permission-granted
     → recording → uploading → extracting → success
permission-requesting ─denied→ permission-denied
uploading ─network→ upload-failed        (retry; NOT a 3-fail strike)
extracting ─422→ extract-failed          (retry; ++failureCount)
```

**Invariants**:

- `failureCount` increments **only** on backend `422` (FR-027). Transport
  failures and permission denials never increment it.
- "Skip for now" is hidden until `failureCount ≥ 1` **OR** `scrolledPastExplanation`
  is true (FR-004). In `permission-denied` / health-unavailable states it is
  always available (FR-007).
- The 3-fail escape ("skip and continue without calibration") renders when
  `failureCount ≥ 3` (FR-027); activating it → `onSkip()` (FR-028).
- Recording is fixed at 60s; auto-stops at 0 (FR-008). No shorter recording is
  accepted.

## `DevicePicker` (client)

`components/anchor/device-picker.tsx`.

- Lists `enumerateDevices()` video inputs. **Pre-grant**, labels are blank →
  show a single "Default camera" placeholder; **after** the first
  `getUserMedia` grant, re-enumerate and show real labels (resolved decision 5).
- Persists the chosen `deviceId` to `localStorage["serenify-anchor-camera"]`
  (last-write-wins). On mount, pre-selects the stored device if still present;
  else falls back to the default camera without error (FR-005).

## `Countdown` (client)

`components/anchor/countdown.tsx` — 60→0 visible countdown. Animated ring by
default; collapses to a plain numeric tick under `prefers-reduced-motion`
(FR-009).

## `CalibrationBanner` (client)

`components/anchor/calibration-banner.tsx`.

- Rendered by `/app` **only** for an employee whose `anchor_captured_at IS NULL`
  (the Server Component decides; managers never reach this branch, FR-029).
- Calm copy: stress detection is unavailable until calibration; "Calibrate now"
  → `/app/calibrate`.
- Dismissal is **session-only** via `sessionStorage["serenify-anchor-banner-dismissed"]`
  (FR-023); reappears next session until calibrated (FR-024). No exclamation
  marks; amber (never red) for any accent.

## Typed API client

`lib/api/anchor-client.ts`:

```ts
type AnchorResult =
  | { ok: true; modelVersion: string; vectorB64: string; dim: number }
  | { ok: false; kind: "unauthenticated" | "unsupported" | "extraction"; reason?: string };

postAnchor(clip: Blob, accessToken: string): Promise<AnchorResult>;
checkHealth(): Promise<boolean>;
```

The **only** module that talks to the FastAPI origin. No untyped `fetch` in
component code (transport rule). Attaches `Authorization: Bearer <token>` and
`multipart/form-data`.

## Pages (server components)

- `app/(onboarding)/onboarding/page.tsx` — renders the 2-step flow (name →
  `AnchorRecorder`) for employees; managers complete at the name step (their
  `completeOnboarding` still server-redirects to `/app`, FR-029).
- `app/(authed)/app/page.tsx` — employee branch renders `CalibrationBanner` when
  `anchor_captured_at IS NULL`; managers see their role placeholder (unchanged).
- `app/(authed)/app/calibrate/page.tsx` — **employee-only** (redirect
  team_lead/admin → `/app`); renders `AnchorRecorder` with `context="calibrate"`.

## Cross-tab (`lib/auth-broadcast.ts` + `components/cross-tab-auth.tsx`)

- New: `broadcastAnchorCaptured()` writes `serenify-anchor-captured` =
  `captured:${Date.now()}`; `parseAnchorBroadcast(newValue)` recognizes it.
- The listener `router.refresh()`es a sibling tab sitting on the onboarding step
  / `/app/calibrate` when an anchor-captured event arrives (FR-034). Refresh →
  server recomputes `anchor_captured_at` → falls through to `/app` without the
  step/banner.
