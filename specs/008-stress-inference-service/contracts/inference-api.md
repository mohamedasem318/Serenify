# Contract — Inference API (008)

The session-aware inference endpoints (D-2). All live in
`apps/api/app/routers/monitoring.py`. Auth reuses the existing `verify_jwt`
dependency (`apps/api/app/auth.py`, returns the verified `user_id` from the token
`sub`); a new `require_employee` dependency adds the role gate.

**Transport**: HTTP request/response (multipart for the video window), reusing the
proven `/anchor` path. This is a logged Constitution deviation from the
WebSocket-streams rule — see `plan.md` Complexity Tracking + DECISIONS 2026-06-19.

**Base**: same FastAPI app as `/healthz` and `/anchor` (no router prefix; the
paths below are absolute). CORS + JWT identical to existing endpoints.

---

## Auth & access (FR-010)

- Every endpoint requires a valid Supabase JWT → `verify_jwt` → `user_id`.
- `require_employee`: reads the caller's `profiles.role` via the **service-role**
  client keyed to the verified `user_id`. Non-employee → **403**
  `{"error":"forbidden_role"}`. (Team leads / admins do not calibrate and MUST NOT
  run inference.)
- Every session/reading row operation is keyed to the verified `user_id`; a
  client-supplied id is never trusted (service role bypasses RLS — keying is the
  control).

---

## 1. Create session — `POST /monitoring/sessions`

Starts a run and performs the **calibrate-first guard up front** (so the user is
told before capturing 60 s of video).

**Request**: empty body (auth header only).

**Server steps**:
1. `require_employee` (else 403).
2. Service-role read of `profiles.anchor_vector` presence for the verified
   `user_id`. If `NULL` → **409** `{"outcome":"no_anchor"}` (the UI routes to the
   calibrate-first surface; US3 / FR-011). No global/fallback anchor is ever
   substituted (SC-004).
3. Insert a `monitoring_sessions` row (`status='active'`, `model_version` from
   `app.state.predictor.model_version`).

**Response 201**:
```json
{ "session_id": "uuid", "model_version": "serenify-video-lbptop-motion-rf-calibrated@2.0.0" }
```

**Outcomes**: `201` (created) · `403` forbidden_role · `409` no_anchor · `401`
(missing/invalid token).

---

## 2. Score a window — `POST /monitoring/sessions/{id}/windows`

One 60 s window → one reading. Called ~every 10 s. **Non-blocking**: the handler
runs the CPU-bound extraction in a threadpool (FastAPI `def` handler /
`run_in_threadpool`) so concurrent windows don't serialize on the event loop;
the **client** fires the next window's capture on its own timer regardless of this
response (FR-016, SC-007).

**Request**: `multipart/form-data`, field `clip` = the 60 s video
(`video/webm` or `video/mp4`), matching the `/anchor` upload shape.

**Server steps** (the read path, FR-009 / FR-012):
1. Verify session exists, is owned by the verified `user_id`, and is not `ended`
   (else `404`/`409`).
2. Write `clip` to a temp file; **shared 2958-d extraction** via
   `ml_video.compute_anchor(tmp_path)` — the *same* function calibration uses; it
   also runs the **feature-006 coverage gate**. Delete the temp file in `finally`
   (Principle I — no raw video persists).
   - On `FeatureExtractionError` (e.g. `code="insufficient_face_frames"`, or any
     decode/coverage failure) → **skipped** outcome (below): persist a skipped
     reading, return `200` with `outcome:"skipped"`. (FR-013)
3. Service-role read of the user's `anchor_vector` → decode `bytea` → `(2958,)`
   float64. (Defensive: if it vanished mid-session → `409 no_anchor`.)
4. `delta = current_features − anchor_features` (elementwise float64).
5. `label, proba = predictor.predict_delta(delta)` → `proba` shape `(2,)`;
   `proba[1]` is the stress-positive probability.
6. **Re-threshold**: `stressed = proba[1] >= operating_point` where
   `operating_point` = `STRESS_OPERATING_POINT` (default 0.53 from metadata).
   The internal 0.5 label from `predict_delta` is **ignored** for display.
7. **Smooth + band + cold-start** (see `contracts/smoothing-and-banding.md`):
   fetch this session's last `N−1` **scored** `stress_probability` values, append
   `proba[1]`, take the mean; if fewer than `M=4` scored readings exist →
   **warming-up** (no band); else map the smoothed value through `t_low`/`t_high`
   to a band.
8. Persist a `window_readings` row: `scored=true`, raw `label` + `stress_probability`
   (server-only columns), `band` (the smoothed band, or `NULL` while warming),
   `captured_at=now()`.
9. Return the outcome.

**Response 200** — one of (discriminated by `outcome`):

```jsonc
// scored, warmed
{ "outcome": "reading", "band": "at_ease" | "a_little_tense" | "tense",
  "captured_at": "2026-06-19T10:32:11Z" }

// scored, still warming up (first < 4 scored readings)
{ "outcome": "warming_up", "captured_at": "…" }

// couldn't read this window (coverage/extract failure) — routine, NOT an error
{ "outcome": "skipped", "cause": "insufficient-face" | "our-side" }
```

Notes:
- **`band`/`proba` are never both** — the client gets the **band only**; the raw
  probability never crosses the wire (FR-015, Principle I).
- **Skipped is `200`, not `422`** (divergence from `/anchor`, which `422`s): for the
  monitoring loop a skipped window is an expected, routine outcome, not a client
  error — the loop continues. The server cause is coarse (`insufficient-face` from
  `code="insufficient_face_frames"`, else `our-side`); the **client refines** the
  user-facing cause (low-light vs out-of-frame) from its on-device telemetry
  (`dominantCause`, feature 006), exactly as calibration does, and renders the
  foggy skip-note via the reused `failure-state` cause vocabulary. The bloom keeps
  the **last smoothed state**.
- **No-face periods upload nothing** (SC-005): the on-device detector gates
  capture; an empty/no-face window is never sent (so the server never sees it).

**Outcomes**: `200` (reading / warming_up / skipped) · `403` forbidden_role ·
`404` unknown/again session · `409` ended_session / no_anchor (defensive) · `401`.

---

## 3. Update lifecycle — `PATCH /monitoring/sessions/{id}`

Records pause/resume/out-of-frame for the recap. Camera control is client-side;
this just reflects status on the row.

**Request**: `{ "status": "paused" | "active" | "out_of_frame" }`
**Response 200**: `{ "session_id": "…", "status": "…" }`
**Outcomes**: `200` · `403` · `404` · `409` (cannot transition an ended session) · `401`.

---

## 4. End session — `POST /monitoring/sessions/{id}/end`

**Request**: `{ "reason": "user" | "auto_absence" | "error" }` (default `"user"`).
**Server**: set `ended_at=now()`, `status='ended'`, `end_reason=reason`.
**Response 200**: `{ "session_id": "…", "ended_at": "…" }`

"Ended" is **not** a monitoring-page screen (mock-gap #6): on success the client
navigates back to the **dashboard**, whose idle check-in card shows the updated
recap (read via `getLastSessionRecap`). (FR-006, SC-010.)

**Outcomes**: `200` · `403` · `404` · `401`.

---

## Reads are NOT here

The session trend and the last-session recap are read **by the browser** via
Supabase RLS (typed client `lib/api/monitoring-reads.ts`, SELECT-own), not via
this API — see `data-model.md` § Reads. This keeps one typed read path, keeps the
raw probability server-only via the column whitelist, and gives the manager layer
no access path at all.

---

## Config surface (FR-012)

In `apps/api/app/config.py` (`Settings`) + loaded into `app.state` at startup:

| Setting | Env | Default | Source |
|---|---|---|---|
| `stress_operating_point` | `STRESS_OPERATING_POINT` | **read from `metadata.json`** `loso_metrics_60s_calibrated.threshold_sweep_recommended.threshold` (0.53) | model metadata, not a literal |
| `stress_tense_band` | `STRESS_TENSE_BAND` | `0.70` | display-only band split (D-3) |
| `supabase_service_role_key` | `SUPABASE_SERVICE_ROLE_KEY` | (required, env-only) | platform panel in prod; **never committed** |
| `supabase_url` | `SUPABASE_URL` | existing | existing (also used for JWKS) |

The operating-point default is sourced from metadata at startup (not hard-coded);
the env var only overrides it.

---

## Privacy review (Constitution Quality Gate 6)

- Raw video: extracted to a temp file, **deleted in `finally`**; never persisted,
  never forwarded. (FR-027, SC-009)
- Manager layer: **no policy** on `monitoring_sessions` / `window_readings` →
  managers cannot read either table.
- Raw decision signal (`stress_probability`, `label`): **server-only** columns
  (owner cannot SELECT them); only the coarse `band` reaches the owner's client.
- Anchor: **server-side read only**, keyed to the verified `user_id`; never in an
  authenticated client SELECT.
- New secret: `SUPABASE_SERVICE_ROLE_KEY` env-only, guardrailed (Principle IX) —
  see `plan.md` Constitution Check.
