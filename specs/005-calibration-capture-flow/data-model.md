# Phase 1 Data Model: Calibration Capture Flow

**There is no database schema change in 005.** This document records (a) the
existing 004 database surface 005 reuses, and (b) the **client-side state shapes**
that are the real "data model" of this UX redesign.

---

## A. Reused database surface (feature 004 — unchanged)

| Object | Shape | 005 usage |
|---|---|---|
| `public.profiles.anchor_vector` | `bytea` (11832 B = 2958 × float32) | Capture writes it (existing path); recalibration **overwrites in place, on success only**. |
| `public.profiles.anchor_captured_at` | `timestamptz` | Written alongside the vector. **Not read by 005** (date not surfaced — 📌 DECISION-23). |
| `public.profiles.anchor_model_version` | `text` | Written alongside the vector. |
| SELECT column-whitelist (DECISION-12) | `authenticated` cannot SELECT any anchor column | Unchanged; 005 reads status only via `has_anchor`. |
| UPDATE whitelist (DECISION-12) | owner may UPDATE `full_name`, `anchor_vector`, `anchor_captured_at`, `anchor_model_version` on their own row | Recalibration overwrite uses this exact path — **no widening needed**. |
| `public.has_anchor(target_user uuid) → boolean` | SECURITY DEFINER, scope-guarded to `auth.uid()` | Banner visibility (`/app`) **and** the new account "Your calm baseline" state. |

**Migrations added by 005: none.** **Grants changed by 005: none.** **Backend
endpoints changed by 005: none** (`/anchor`, `/healthz` reused as-is; raw bytes
still deleted in a `finally`).

Recalibration writes exactly what first-time capture writes (vector + timestamp +
model version), to the same row, overwriting the previous values. No history row is
created (spec: "the new one replaces the old in place"). Because the client writes
only after a successful extraction, **stop / processing-failure / "Not now" /
"Maybe later" leave the prior values untouched** with no extra guard.

---

## B. Client-side state (the 005 data model)

### B.1 `RecorderState` (extended) — `components/anchor/use-anchor-recorder.ts`

Extends the 004 reducer. New/changed fields in **bold**.

```text
RecorderStatus =
  | "intro"                # NEW — pre-camera intro screen
  | "permission-requesting"
  | "camera-blocked"       # NEW — split from permission-denied (NotAllowedError / hard-blocked)
  | "camera-busy"          # NEW — split (NotReadableError / TrackStartError / AbortError)
  | "camera-no-device"     # NEW — split (NotFoundError / OverconstrainedError)
  | "green-room"           # NEW — replaces the bare permission-granted preview
  | "get-ready"            # NEW — 3 → 2 → 1 countdown
  | "recording"            # 60 s
  | "stop-confirming"      # NEW — honest stop dialog over the recording
  | "uploading"            # POST /anchor — covers upload AND server-side extraction (004 convention; no distinct user-facing message)
  | "success"
  | "upload-failed"        # transport — retry, not a strike
  | "extract-failed"       # backend 422 — retry, ++failureCount

RecorderState = {
  status: RecorderStatus
  mode: "first-time" | "recalibrate"        # NEW — drives copy (set→update) + exit destinations (FR-053)
  failureCount: number                       # unchanged — only EXTRACT_FAILED increments
  errorReason?: string                       # backend 422 reason (secondary cause-chip input)
  causeTelemetry?: CauseTelemetry            # NEW — client-observed dominant adverse signal (📌 DECISION-24)
  gate: GateVerdict                          # NEW — current soft-gate readiness (drives "I'm ready")
  guide: "loading" | "active" | "unavailable" # NEW — the three guide states (📌 DECISION-19)
}
```

Notes:
- `mode` is set from the calibrate route's `searchParams.mode` (or `"first-time"`
  for onboarding/banner entry).
- The old `permission-denied` + `permissionBlocked` boolean is replaced by the
  three explicit `camera-*` states. The existing `navigator.permissions.query`
  anti-flash probe still distinguishes a hard block (→ `camera-blocked` directly,
  no `getUserMedia` re-call).
- `failureCount` semantics are unchanged: transport failures and permission/camera
  errors are **not** strikes; the escape appears at `failureCount ≥ 3`.

### B.2 Exit-destination rule (derived, not stored)

| Exit | first-time | recalibrate |
|---|---|---|
| green-room "Not now" / camera-state "Not now" / failure "Not now" / escape "Maybe later" | hard-nav `/app`, banner shows | hard-nav `/app/account`, baseline kept, no banner |
| success "Back to …" | hard-nav `/app`, banner gone | hard-nav `/app/account` |
| stop → confirm | → `green-room` (both modes; nothing persisted) | → `green-room` |

All capture-route exits are **hard navigations** (`window.location.replace`) so the
`camera=(self)` policy does not linger (📌 DECISION-22 / DECISION-16).

### B.3 `FramingSignal` & `GateVerdict` — `lib/face-detect/framing.ts` (pure)

```text
FramingSignal = {
  facePresent: boolean         # detection score ≥ threshold
  centreDistance: number       # normalized distance of box centre from frame centre (0 = dead centre)
  sizeRatio: number            # box height / frame height
  brightness: number           # target-region mean luma, 0..255 (canvas, model-independent)
  at: number                   # timestamp (ms) — for the grace-window debounce
}

GateVerdict = "ready" | "no-face" | "off-centre" | "too-dark"
DriftState  = "centred" | "ease-back" | "absent"   # in-recording, grace-gated
```

- `framing.ts` is **pure** (input signal + prior debounce state → verdict/drift +
  next debounce state), so the gate thresholds and the ~2 s grace window are
  unit-tested with a fake clock (📌 DECISION-26).
- Thresholds are named constants (see `contracts/face-detection.md`), all
  forgiving and tunable.

### B.4 `CauseTelemetry` — accumulated during recording (📌 DECISION-24)

```text
CauseTelemetry = {
  darkFrames: number       # frames below the brightness floor
  offTargetFrames: number  # frames off-centre or absent
  totalFrames: number
  detectorAvailable: boolean
}
→ dominantCause(): "low-light" | "out-of-frame" | "our-side"
```

`dominantCause()` returns `"our-side"` when the detector was unavailable or no
adverse signal dominates — we never assert a user-side cause we did not measure.

### B.5 Banner persistence (reused — `lib/auth-broadcast.ts`)

Unchanged from 004 and **must not regress** (FR-042–FR-044, FR-054):
- `serenify-anchor-banner-dismissed` (`sessionStorage`) — session-only dismissal.
- `serenify-anchor-banner-dismissed-broadcast` (`localStorage`) — cross-tab mirror.
- `serenify-anchor-captured` (`localStorage`) — completion broadcast; sibling tabs
  on `/onboarding` `/app` `/app/calibrate` `router.refresh()`.
- `serenify-anchor-camera` (`localStorage`) — remembered device; **005 fixes** the
  resolved-default persistence (📌 DECISION-25, FR-045).

### B.6 Detector assets (static, not data)

`apps/web/public/face-detect/` — the self-hosted WASM runtime + the
`blaze_face_short_range` model file, served same-origin. No PII; public artifacts.
