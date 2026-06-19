# Contract — Inference API (008)

> **REVISED 2026-06-19 (windowing D-2 reversed → continuous single-stream).** DB access
> is in the caller's RLS context via the forwarded user JWT + the publishable anon key
> (**no service-role**). The `score window` endpoint accepts the **contiguous
> recording-so-far** from **one continuous `MediaRecorder`** (init + all chunks in order
> — always decodable); the **server decodes that one clip and tail-extracts the last
> 60 s** via the existing single-clip path (no multi-clip assembly, no clip buffer). B1
> container-reassembly and B2 standalone-clip frame-concat were both rejected — see
> research R-5/R-7 and `docs/DECISIONS.md` 2026-06-19.

The session-aware inference endpoints (D-2). All live in
`apps/api/app/routers/monitoring.py`. Auth reuses the existing `verify_jwt`
dependency (`apps/api/app/auth.py`, returns the verified `user_id` from the token
`sub`); a new `require_employee` dependency adds the role gate. DB access uses a
**user-context** Supabase client (`apps/api/app/supabase_user.py`): the anon key
as `apikey` + the **forwarded user JWT** as `Authorization`, so `auth.uid()`
resolves to the caller and RLS applies — **no service-role key**.

**Transport**: HTTP request/response (multipart for the contiguous recording-so-far),
reusing the proven `/anchor` upload path. This is a logged Constitution deviation
from the WebSocket-streams rule — see `plan.md` Complexity Tracking + DECISIONS
2026-06-19.

**Base**: same FastAPI app as `/healthz` and `/anchor` (no router prefix; the
paths below are absolute). CORS + JWT identical to existing endpoints.

---

## Auth & access (FR-010)

- Every endpoint requires a valid Supabase JWT → `verify_jwt` → `user_id`.
- `require_employee`: reads the caller's own `profiles.role` via the **user-context
  client** (forwarded JWT, RLS select-self — `role` is in the existing SELECT
  whitelist), **no service-role**. Non-employee → **403** `{"error":"forbidden_role"}`.
  (Team leads / admins do not calibrate and MUST NOT run inference.)
- Every DB operation runs **as the user** (forwarded JWT); RLS (select-own /
  insert-own / update-own) is the control. The server never trusts a client-supplied
  id — it uses the verified `sub`, and RLS independently enforces ownership.

---

## 1. Create session — `POST /monitoring/sessions`

Starts a run and performs the **calibrate-first guard up front** (so the user is
told before capturing 60 s of video).

**Request**: empty body (auth header only).

**Server steps**:
1. `require_employee` (else 403).
2. Anchor presence check **as the user** (forwarded JWT): `has_anchor(auth.uid())`
   (or `get_my_anchor()` returning NULL). If absent → **409**
   `{"outcome":"no_anchor"}` (the UI routes to the calibrate-first surface; US3 /
   FR-011). No global/fallback anchor is ever substituted (SC-004).
3. Insert a `monitoring_sessions` row **under RLS (insert-own)** via the
   user-context client (`status='active'`, `model_version` from
   `app.state.predictor.model_version`).

**Response 201**:
```json
{ "session_id": "uuid", "model_version": "serenify-video-lbptop-motion-rf-calibrated@2.0.0" }
```

**Outcomes**: `201` (created) · `403` forbidden_role · `409` no_anchor · `401`
(missing/invalid token).

---

## 2. Submit a window — `POST /monitoring/sessions/{id}/windows`

The **contiguous recording-so-far** in → at most one reading out (once ≥ 60 s has
been recorded). Called ~every 10 s. **Non-blocking**: the handler runs the CPU-bound
decode+tail-extract in a threadpool (FastAPI `def` handler / `run_in_threadpool`) so
concurrent windows don't serialize on the event loop; the **client** keeps its single
continuous recorder running and uploads on its own timer regardless of this response
(FR-016, SC-007). ⚠ Keep-up has **two** components (research R-5): the server's
**decode-to-tail** cost **grows with elapsed session time** (it re-decodes the growing
clip to reach the trailing 60 s; bounded by the 5-min cap, negligible on localhost;
mitigation = the deferred rolling decoded-frame buffer), and the **constant per-window
extract** (MediaPipe + LBP) is a separate fixed cost the buffer does **not** touch — see
research R-5 for the full keep-up flag (and the droplet-phase-out caveat).

**Request**: `multipart/form-data`, field `clip` = the **contiguous recording-so-far**
(`video/webm` or `video/mp4`), matching the `/anchor` upload shape. It is the literal
growing file from **one continuous `MediaRecorder`** (init segment + all chunks in
order), so it is **always decodable** — no init-segment retention, no container
reassembly, no clip stitching.

**Server steps** (the read path, FR-009 / FR-012):
1. Verify session exists, is owned by the verified `user_id` (RLS select-own), and
   is not `ended` (else `404`/`409`).
2. **Decode + tail-window** (`app/services/inference.py`): decode the uploaded
   continuous clip. If it holds **fewer than 60 s** of recording yet → return
   `200 {outcome:"warming_up"}` (no extraction; the window is not yet full — the 60 s
   contract is locked, partial windows are never scored). Otherwise score the
   **trailing 60 s**: the VFR `POS_MSEC` sampler is bounded to frames whose timestamp
   ≥ `duration − 60 s`. **No multi-clip assembly, no clip buffer, no seam handling** —
   the window is one genuine continuous segment.
3. **Shared 2958-d extraction** on the trailing 60 s via
   `ml_video.compute_anchor(clip_path, tail_seconds=60)` — the *same* `extract_landmarks`
   + `lbp_top_features`/`motion_features` calibration uses, with a thin trailing-window
   bound on the sampler (it reduces to `compute_anchor` for a ≤ 60 s clip); it also runs
   the **feature-006 coverage gate**. **Faithful by construction** — the scored window is
   a real continuous 60 s clip, exactly the single-clip input the extraction is already
   validated on, so there is **no multi-clip fidelity gate**. Delete the uploaded clip
   (and any temp file) in `finally` (Principle I — no raw video persists).
   - On `FeatureExtractionError` (e.g. `code="insufficient_face_frames"`, or any
     decode/coverage failure) → **skipped** outcome (below): persist a skipped reading,
     return `200 {outcome:"skipped"}`. (FR-013)
4. Read the user's anchor via `get_my_anchor()` (**forwarded JWT**, server-side) →
   decode `bytea` → `(2958,)` float64. (Defensive: NULL mid-session → `409 no_anchor`.)
5. `delta = current_features − anchor_features` (elementwise float64).
6. `label, proba = predictor.predict_delta(delta)` → `proba` shape `(2,)`;
   `proba[1]` is the stress-positive probability.
7. **Re-threshold**: `stressed = proba[1] >= operating_point` where
   `operating_point` = `STRESS_OPERATING_POINT` (default 0.53 from metadata). The
   internal 0.5 label from `predict_delta` is **ignored** for display.
8. **Smooth + band + cold-start** (see `contracts/smoothing-and-banding.md`):
   fetch this session's last `N−1` **scored** `stress_probability` values, append
   `proba[1]`, take the mean; if fewer than `M=4` scored readings exist →
   **warming-up** (no band); else map the smoothed value through `t_low`/`t_high`
   to a band.
9. Persist a `window_readings` row **under RLS (insert-own)** via the user-context
   client: `scored=true`, raw `label` + `stress_probability` (server-only columns —
   written by the API, unreadable by the owner via the SELECT whitelist), `band`
   (the smoothed band, or `NULL` while warming), `captured_at=now()`.
10. Return the outcome.

**Response 200** — one of (discriminated by `outcome`):

```jsonc
// scored, warmed
{ "outcome": "reading", "band": "at_ease" | "a_little_tense" | "tense",
  "captured_at": "2026-06-19T10:32:11Z" }

// not yet a reading — recording < 60 s OR < 4 scored readings (both render as warming-up)
{ "outcome": "warming_up", "captured_at": "…" }

// couldn't read this window (coverage/extract failure) — routine, NOT an error
{ "outcome": "skipped", "cause": "insufficient-face" | "our-side" }
```

Notes:
- **The client never receives a probability** — only the `band` (FR-015, Principle I).
- **Two warming-up gates** both surface as `outcome:"warming_up"`: (a) the continuous
  recording does not yet hold a full 60 s window; (b) it does, but fewer than `M=4`
  scored readings have accrued (D-3 cold-start). The client shows the same
  warming-up state for both.
- **Skipped is `200`, not `422`** (divergence from `/anchor`, which `422`s): for the
  monitoring loop a skipped window is an expected, routine outcome, not a client
  error — the loop continues. The server cause is coarse (`insufficient-face` from
  `code="insufficient_face_frames"`, else `our-side`); the **client refines** the
  user-facing cause (low-light vs out-of-frame) from its on-device telemetry
  (`dominantCause`, feature 006), exactly as calibration does, and renders the
  foggy skip-note via the reused `failure-state` cause vocabulary. The bloom keeps
  the **last smoothed state**.
- **No-face periods upload nothing** (SC-005): the on-device detector gates
  capture; an empty/no-face segment is never sent (so the server never sees it).

**Outcomes**: `200` (reading / warming_up / skipped) · `403` forbidden_role ·
`404` unknown session · `409` ended_session / no_anchor (defensive) · `401`.

---

## 3. Update lifecycle — `PATCH /monitoring/sessions/{id}`

Records pause/resume/out-of-frame for the recap. Camera control is client-side;
this updates `status` on the row **under RLS (update-own)**. On `status="paused"`
the client releases the camera and stops the continuous recorder; on resume it starts
a **fresh** continuous recording → the next windows are < 60 s again → the display
warms up again, consistent with the 60 s contract. (No server-side clip buffer to clear.)

**Request**: `{ "status": "paused" | "active" | "out_of_frame" }`
**Response 200**: `{ "session_id": "…", "status": "…" }`
**Outcomes**: `200` · `403` · `404` · `409` (cannot transition an ended session) · `401`.

---

## 4. End session — `POST /monitoring/sessions/{id}/end`

**Request**: `{ "reason": "user" | "auto_absence" | "error" }` (default `"user"`).
**Server**: set `ended_at=now()`, `status='ended'`, `end_reason=reason` **under RLS
(update-own)**. (No server-side clip buffer; the client stops its continuous recorder.)
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
| `supabase_anon_key` | `SUPABASE_ANON_KEY` | (required) | **publishable** key (same as `NEXT_PUBLIC_SUPABASE_ANON_KEY`); used as PostgREST `apikey` with the forwarded user JWT. **Not a secret.** |
| `supabase_url` | `SUPABASE_URL` | (now **required**) | existing (also used for JWKS) |

No service-role key is added (revised D-1). The operating-point default is sourced
from metadata at startup (not hard-coded); the env var only overrides it.

---

## Privacy review (Constitution Quality Gate 6)

- Raw video: the uploaded **continuous clip** is held **transiently in memory**,
  decoded to its trailing 60 s of frames for extraction, then the clip + any temp file
  is **deleted in `finally`**. **No per-session clip buffer.** Never persisted, never
  forwarded. (FR-027, SC-009)
- Manager layer: **no policy** on `monitoring_sessions` / `window_readings` →
  managers cannot read either table.
- Raw decision signal (`stress_probability`, `label`): **server-only** columns
  (owner cannot SELECT them; written by the API, withheld by the SELECT whitelist);
  only the coarse `band` reaches the owner's client.
- Anchor: read **server-side only** via `get_my_anchor()` (self-scoped
  `SECURITY DEFINER`, forwarded JWT); never in an authenticated client SELECT.
- **No new secret** (revised D-1): `apps/api` holds **no service-role key**; it uses
  the publishable anon key + the forwarded user JWT (RLS-respecting). Stronger than
  the original plan — see `plan.md` Constitution Check (Principle IX).
- Write-integrity deferred (low-stakes): a user could fabricate **their own**
  readings under RLS; managers see nothing; upgrade path = dedicated INSERT-only
  role (not built now).
