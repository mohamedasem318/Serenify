# Contract: Backend & Database — UNCHANGED in 005

This file exists to make the "no backend/DB change" boundary explicit for review
and for `/speckit-tasks` (so no task touches these).

## FastAPI service (`apps/api/`) — unchanged

- `POST /anchor` — same `multipart/form-data` contract, same auth (JWKS/ES256
  verification, env-only secret, no DB credentials), same pipeline, same
  raw-byte deletion in a `finally` (Principle I). 005 calls it via the existing
  `lib/api/anchor-client.ts::postAnchor` with **no signature change**.
- `GET /healthz` — same readiness contract; 005 calls the existing
  `checkHealth()` and **gates entry to recording** with it (the calm
  "temporarily unavailable" copy), preserving the 004 invariant.
- The 422 `reason` (`no_face` / `roi_empty` / `bad_vector`) is consumed only as a
  **secondary** cause-chip signal (📌 DECISION-24); no new backend diagnostic is
  added.

## Database (`supabase/`) — unchanged

- **No migration.** The anchor columns, the DECISION-12 SELECT column-privacy, the
  owner UPDATE whitelist, and `has_anchor(auth.uid())` already support 005's
  banner/account state, capture write, and recalibration overwrite.
- Recalibration uses the **existing** owner UPDATE path to overwrite the single
  anchor row in place, on success only; no history table.
- 005 surfaces **whether** a baseline is set, never the date (📌 DECISION-23) — so
  no `anchor_captured_at` read path is added.

## Demo seed (`scripts/`) — unchanged

The synthetic-anchor injection from 004 is untouched; demo users remain
"calibrated" and never see the banner or the redesigned flow.

## Security headers

- `next.config.ts` per-route `camera=(self)` (on `/onboarding`, `/app/calibrate`)
  is **already correct and unchanged**; `/app/account` correctly stays `camera=()`.
- The **only** header change in 005 is the scoped CSP delta in `proxy.ts` for the
  WASM detector (📌 DECISION-20 / `contracts/face-detection.md` §4).
