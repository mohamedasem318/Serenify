# Contract — Inference API (008)

> **REVISED 2026-06-19** for the D-1 + D-2 amendments (incl. the **B1 NO-GO → B2**
> windowing flip): **no service-role** (DB access is in the caller's RLS context via
> the forwarded user JWT + the publishable anon key); the `score window` endpoint now
> accepts a **standalone ~10–12 s clip** (the client stops/restarts the recorder each
> stride so every clip is independently decodable) and the **server assembles** the
> rolling 60 s window by **decoding the recent clips and concatenating their sampled
> frames** (a transient per-session clip buffer — B2, see research R-5/R-7).

The session-aware inference endpoints (D-2). All live in
`apps/api/app/routers/monitoring.py`. Auth reuses the existing `verify_jwt`
dependency (`apps/api/app/auth.py`, returns the verified `user_id` from the token
`sub`); a new `require_employee` dependency adds the role gate. DB access uses a
**user-context** Supabase client (`apps/api/app/supabase_user.py`): the anon key
as `apikey` + the **forwarded user JWT** as `Authorization`, so `auth.uid()`
resolves to the caller and RLS applies — **no service-role key**.

**Transport**: HTTP request/response (multipart for the ~10 s video segment),
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

## 2. Submit a clip — `POST /monitoring/sessions/{id}/windows`

One **standalone ~10–12 s clip** in → at most one reading out (once ~6 clips / 60 s
are buffered). Called ~every 10 s. **Non-blocking**: the handler runs the CPU-bound
decode+assembly+extraction in a threadpool (FastAPI `def` handler /
`run_in_threadpool`) so concurrent windows don't serialize on the event loop; the
**client** keeps stop/restart-recording standalone clips on its own timer regardless
of this response (FR-016, SC-007).

**Request**: `multipart/form-data`, field `clip` = the latest **standalone ~10–12 s**
clip (`video/webm` or `video/mp4`), matching the `/anchor` upload shape. The client
**stops and restarts** the recorder each stride, so **every clip carries its own
container init and is independently decodable** (B2 — no init-segment retention, no
container reassembly).

**Server steps** (the read path, FR-009 / FR-012):
1. Verify session exists, is owned by the verified `user_id` (RLS select-own), and
   is not `ended` (else `404`/`409`).
2. **Buffer + assemble** (`app/services/segment_buffer.py`): append the clip to the
   session's transient in-memory buffer; keep the last **~6 standalone clips**
   (= ~60 s), evicting the oldest. If **fewer than ~60 s** are buffered yet → return
   `200 {outcome:"warming_up"}` (no extraction; the window is not yet full — the 60 s
   contract is locked, partial windows are never scored). Otherwise hand the **~6
   clip paths** to the multi-clip extraction entry.
   - **Assembly is frame-level + seam-aware (B2, R-5/R-7)**: each clip is decoded **on
     its own** (its own init) and the **sampled frames are concatenated** into one
     ~150-frame / ~60 s set — there is **no** container reassembly and **no** intra-file
     splice. The motion block is built **seam-aware** (`motion_features_seamaware`):
     frame-to-frame diffs are taken **per clip** and the **cross-seam diffs are
     excluded** before mean/std/max (they are stop/restart artifacts absent from a
     continuous stream). The remaining seam effect is the per-restart frames lost.
     ⚠️ **Gate status (2026-06-19): NOT cleared** — the R-7 fidelity gate still **FAILED**
     on the Chrome fixtures after the seam-aware fix (residual is broadband divergence
     beyond the seams; the continuous vs multi-clip fixtures are independent recordings).
     Windowing fidelity is under a design session; this server path is **blocked** until
     it clears. (The rejected B1 container-reassembly path is recorded in research R-5.)
3. **Shared 2958-d extraction** on the clip set via
   `ml_video.compute_anchor_multiclip(clip_paths)` — a thin multi-clip wrapper over
   the *same* per-clip `extract_landmarks` + `lbp_top_features`/`motion_features`
   calibration uses; it also runs the **feature-006 coverage gate** per clip. Delete
   the buffered clips (and any temp files) in `finally` (Principle I — no raw video
   persists; the buffer stays in memory only).
   - On `FeatureExtractionError` (e.g. `code="insufficient_face_frames"`, or any
     decode/coverage failure on any clip) → **skipped** outcome (below): persist a
     skipped reading, return `200 {outcome:"skipped"}`. (FR-013)
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

// not yet a reading — buffer < 60 s OR < 4 scored readings (both render as warming-up)
{ "outcome": "warming_up", "captured_at": "…" }

// couldn't read this window (coverage/extract failure) — routine, NOT an error
{ "outcome": "skipped", "cause": "insufficient-face" | "our-side" }
```

Notes:
- **The client never receives a probability** — only the `band` (FR-015, Principle I).
- **Two warming-up gates** both surface as `outcome:"warming_up"`: (a) the server
  buffer does not yet hold a full 60 s window; (b) it does, but fewer than `M=4`
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
the server **clears the session's transient clip buffer** (the client releases
the camera; on resume the buffer refills from empty → the display warms up again,
consistent with the 60 s contract).

**Request**: `{ "status": "paused" | "active" | "out_of_frame" }`
**Response 200**: `{ "session_id": "…", "status": "…" }`
**Outcomes**: `200` · `403` · `404` · `409` (cannot transition an ended session) · `401`.

---

## 4. End session — `POST /monitoring/sessions/{id}/end`

**Request**: `{ "reason": "user" | "auto_absence" | "error" }` (default `"user"`).
**Server**: set `ended_at=now()`, `status='ended'`, `end_reason=reason` **under RLS
(update-own)**; **clear the transient clip buffer** for the session.
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

- Raw video: standalone ~10–12 s clips held in a **transient in-memory** per-session
  buffer; each clip is decoded and its sampled frames concatenated for the 60 s
  window, and the clips + any temp files are **deleted in `finally`**; the buffer is
  **cleared on pause/end**. Never persisted, never forwarded. (FR-027, SC-009)
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
