# Phase 0 Research — Stress Inference Service (008)

Resolves the spec's Deferred Decisions (D-1…D-4), folds in the seven
mock-gap decisions handed down by the mock owner, and records the model-metadata
discrepancy and two implementation-approach findings (windowing, webm/VFR).

Format per decision: **Decision / Rationale / Alternatives considered**.

---

## R-0 — Model window is 60 s, not 30 s (`metadata.json` has a stale block)

**Decision**: The production inference window is **60 s on a 10 s stride**. The
operating point is **0.53**, read from
`metadata.json → loso_metrics_60s_calibrated.threshold_sweep_recommended.threshold`.
The `metadata.json → window_eval_config` block (`window_duration_sec: 30`,
`window_frames: 75`) is **NOT** the production config and MUST NOT be used.

**Rationale**: Constitution Principle II (NON-NEGOTIABLE, Amendment 2) and
`docs/MODELS.md` both lock 60 s/10 s and cite the 60 s LOSO metrics (class-1
recall **0.83**). The amendment records that 30 s collapsed class-1 recall to
0.61. The `loso_metrics_60s_calibrated` block (recall_class1 = 0.793 at the 0.53
sweep point) is the calibrated 60 s evaluation; the 30 s `window_eval_config` is
a leftover from an earlier sweep.

**Alternatives considered**: Trusting `window_eval_config` (30 s) — rejected; it
contradicts the non-negotiable constitution + MODELS.md and would degrade recall.

**Action / flag**: Surface to the model owner that `window_eval_config` in
`metadata.json` is stale and should be corrected to 60 s (or removed) to avoid a
future reader trusting it. This is a documentation cleanup, **not** a blocker —
the plan reads the operating point from the explicit `loso_metrics_60s_calibrated`
path and pins the window at 60 s by constitution.

---

## D-1 — Anchor read path at inference

**Decision**: **Option (a) — server-side service-role read keyed by the
authenticated `user_id`.** `apps/api` gains a scoped Supabase service-role client
(`app/supabase_admin.py`) that reads `profiles.anchor_vector` for the
JWT-verified caller, and also performs the server-side session/reading writes.
The anchor is **never** exposed to any authenticated client SELECT.

**Rationale**:
- Only the **server** reads the anchor (for inference) and the API already
  operates server-side — option (a) avoids a new DB-function surface (the
  maintainer's stated lean).
- This is **not** a supersession of feature 004's DECISION-9 ("the anchor-extract
  service holds no DB credentials"). Feature 004 **explicitly deferred** this exact
  path to the inference feature: `20260527000000_anchor_columns.sql` says
  *"service_role (seed, future 005 server-side read) is untouched,"* and the 004
  decisions note *"feature 005's inference read path for `anchor_vector`
  (server-side service-role read, or a self-scoped SECURITY DEFINER function) is
  still 005's decision."* ("005" = now-008 after the ordering reshuffle.) So the
  service-role read is the **anticipated** resolution, and the existing column
  grants already leave `service_role` access intact while withholding the anchor
  from `authenticated`.
- Server-side writes for `window_readings` are independently required for
  **integrity**: the persisted readings feed feature 009's sustained-tense
  detection, so the client must not be able to fabricate them. A service-role
  writer keyed to the verified `sub` is the clean way to do both the anchor read
  and the reading writes.

**Guardrails (Principle IX)**: `SUPABASE_SERVICE_ROLE_KEY` is env-only (platform
panel in prod; mirrors `apps/web`'s `serverEnv` and the existing
`SUPABASE_JWT_SECRET`). The service-role client is used **only** for: read own
anchor, read own role (employee gate), write/read own sessions+readings. **Every
query is keyed by the verified JWT `sub`** — a client-supplied id is never
trusted. Service role bypasses RLS, so this keying discipline is the control and
is unit-tested.

**Alternatives considered**:
- **(b) self-scoped `SECURITY DEFINER` function** returning the anchor vector —
  rejected. It adds a new DB-function surface (against the maintainer's lean),
  and if called from the browser it delivers the 2958-d anchor to the client,
  contrary to "keep the anchor out of any authenticated client SELECT." A
  server-forwarded-JWT variant (server calls the RPC with the user's token, no
  service key) preserves least-privilege but still adds the RPC surface and a
  PostgREST round-trip from Python, and does not solve the integrity-write need —
  so service-role wins on simplicity for the combined read+write requirement.

---

## D-2 — Endpoint shape AND upload/buffer model

**Decision (endpoint shape)**: **Session-aware**, three endpoints:
`POST /monitoring/sessions` (create) → `POST /monitoring/sessions/{id}/windows`
(score one window, ×N) → `POST /monitoring/sessions/{id}/end`. A lightweight
`PATCH /monitoring/sessions/{id}` carries lifecycle status (paused / active /
out_of_frame) for the recap. Reads (trend, recap) are **not** API endpoints —
the browser reads its own rows via Supabase RLS (typed client).

**Decision (upload/buffer model)**: The **client assembles the full 60 s window
and uploads it per 10 s stride** (consecutive windows overlap by 50 s). The
server holds **no** rolling buffer in this feature.

**Decision (smoothing locus)**: Smoothing, banding, and the cold-start gate are
computed **server-side** in the window endpoint (it already has all of the
session's readings). The band is returned in the response and the client renders
it. This guarantees the first displayed reading is already smoothed and that the
card and page trends agree (SC-008), with the D-3 logic living in one tested place.

**Rationale**:
- Session-aware grouping makes readings/trend/recap trivial to query and gives
  feature 009 a clean unit ("a session's readings"). It also lets the rolling
  buffer move server-side **later** without a UI change.
- Client-assembled 60 s windows keep the server stateless-per-window and reuse the
  proven `/anchor` multipart path verbatim. On localhost the redundant video is
  negligible (the explicit dev-now framing).
- **Documented deployment cost (future item, not built now)**: on real deployment
  this uploads ~6× the bytes and re-runs MediaPipe on ~6× overlapping frames
  (each 60 s window overlaps the previous by 50 s). The optimization is a
  **server-side rolling-feature cache**: the client sends only the new ~10 s, the
  server keeps a per-session frame/feature buffer and reuses the overlapping
  extraction. That implies server-held state (already enabled by the
  session-aware shape) and pairs naturally with moving the transport to WebSocket
  (see the Constitution-deviation note). Logged as a future item, **not built
  here**.

**Alternatives considered**:
- **Single stateless per-window endpoint (no session)** — rejected; readings
  would not group cleanly, the recap/trend and the 009 seam would need a
  synthetic grouping key, and lifecycle (active/paused/ended) would have no home.
- **Server rolling buffer now (client sends only 10 s)** — rejected for the
  dev-now slice: it is the efficient end state but adds stateful assembly +
  extraction-reuse complexity before it is needed; deferred as above.

---

## D-3 — Smoothing, banding, and cold-start

Full numbers + config surface in [`contracts/smoothing-and-banding.md`](./contracts/smoothing-and-banding.md). Summary:

**Decision (smoothing)**: The displayed signal is the **rolling mean of the
stress-positive probability `proba[1]` over the last N = 4 *scored* readings**.
Skipped (low-coverage) windows do **not** enter the buffer.

**Decision (banding)**: Two thresholds applied to the **smoothed** probability:
- `t_low = 0.53` — the calibrated operating point (from metadata; config
  `STRESS_OPERATING_POINT`).
- `t_high = 0.70` — a **display-only** split for Tense vs A-little-tense (config
  `STRESS_TENSE_BAND`).
- Bands: `smoothed < 0.53` → **At ease**; `0.53 ≤ smoothed < 0.70` → **A little
  tense**; `smoothed ≥ 0.70` → **Tense**.

**Decision (cold-start)**: The display stays in **warming-up** until **M = 4
scored readings** have accrued; only then is a band shown. With window 1 at ~60 s
and readings every ~10 s, the 4th reading lands at ~90 s (+~3–5 s extraction) →
first band at ~90–105 s, matching the updated SC-001.

**Rationale**:
- Because consecutive 60 s windows overlap by 50 s, raw readings are already
  highly correlated; a 4-reading trailing mean (spanning ~90 s of underlying
  video) adds robustness to a single anomalous window without lagging the user's
  real trend — it "drifts, not flickers" (SC-003).
- The 0.53 operating point is exactly the model contract's stress/not-stress cut
  on this same uncalibrated `proba[1]`; thresholding the **smoothed** statistic at
  0.53 is faithful to the model. The internal 0.5 label from `predict_delta` is
  **ignored** (FR-012).
- `t_high` is the only invented number and is honest about it: the model is binary
  with **non-probability-calibrated** `predict_proba`, so the Tense/A-little-tense
  split is a **product/UX band**, not a model metric. 0.70 sits roughly midway
  between the operating point and certainty, giving "a little tense" a buffer band
  so the bloom does not jump straight to Tense at threshold. It is config-exposed
  and tunable without retraining. **No numeric value is ever shown** (FR-015) — the
  thresholds only choose a band.

**Alternatives considered**:
- EMA instead of a fixed-window mean — defensible, but a fixed N=4 trailing mean
  is simpler to explain, test, and reason about, and the heavy window overlap
  already provides exponential-like inertia.
- Cold-start of 6 (~first display at ~110–120 s) — rejected; slower than the
  ~90 s target the mock owner set. Cold-start of 1–2 — rejected; too little
  smoothing to honor "already smoothed from the start."
- Deriving `t_high` from metadata — not possible; metadata carries only the single
  stress/not-stress operating point, so a second cut must be a product decision.

---

## D-4 — Readings persistence schema

Full schema, RLS, retention, and aggregation in [`data-model.md`](./data-model.md). Summary:

**Decision**: Two tables.
- **`monitoring_sessions`** — `id`, `user_id`, `started_at`, `ended_at`,
  `status` (`active|paused|out_of_frame|ended`), `end_reason`
  (`user|auto_absence|error`, nullable), `model_version`, `created_at`,
  `updated_at`.
- **`window_readings`** — `id`, `session_id` (FK, `ON DELETE CASCADE`),
  `user_id` (denormalized for RLS + 009 queries), `captured_at` (window-end
  timestamp; the user+session+timestamp key), `scored` (bool),
  `band` (`at_ease|a_little_tense|tense`, null when skipped or warming),
  `label` (smallint 0/1, **server-only**), `stress_probability` (real `proba[1]`,
  **server-only**), `skip_cause` (text, null when scored), `created_at`.

**RLS / grants**: RLS enabled. Authenticated owner gets **SELECT-own only** via a
column whitelist that **excludes `label` and `stress_probability`** (the
`anchor_vector` mechanism) — the client reads `{captured_at, scored, band,
skip_cause}` for the trend and never a probability. **No manager policy exists**
on either table (Principle I — managers see nothing here). All writes are
service-role (the API), keyed to the verified `sub`; authenticated has **no**
INSERT/UPDATE/DELETE.

**Retention**: `window_readings` retained **90 days**, then purged (a scheduled
cleanup is a documented follow-up — see data-model.md); `monitoring_sessions`
(already aggregate-ish: duration + tenor) retained longer. Rationale: 90 days
covers the session trend, the last-session recap, the 009 seam, and demo windows
while minimizing long-term retention of affective signal data (Principle I).

**Aggregation**: Both the dashboard card mini-trend and the monitoring-page trend
read the **same** `window_readings` rows for the session through a single typed
reader (`getSessionTrend(sessionId)`) → identical source → guaranteed consistent
(SC-008). The idle recap reads the most recent **ended** session
(`getLastSessionRecap(userId)`); when none exists it returns `null` and the card
shows the empty state.

**FR-020 seam (no trigger built)**: `window_readings.band` + `captured_at` +
`session_id` are sufficient for feature 009 to detect "sustained tense" (a run of
consecutive `band = 'tense'` readings over a duration) by a server-side query.
008 persists this shape and **builds no questionnaire trigger, UI, or flow**.

**Alternatives considered**:
- Storing only raw `proba`/`label` (FR-017 minimum) and forcing 009 to
  re-implement smoothing — rejected; also persisting the server-computed `band`
  gives 009 a clean, non-duplicative seam and lets the trend render directly.
- Exposing `stress_probability` to the owner's client — rejected; it would invite
  a client to render a number (against FR-015) and retains sensitive signal
  client-side unnecessarily. Held server-only.

---

## Mock-gap resolutions (decided by the mock owner; folded into the plan)

Recorded here and as spec deltas in `docs/CHANGELOG.md`. These resolve MG-1/2/3
and add one missed state.

1. **Warming-up is a 7th operational state.** Before the first window completes
   there is no reading. A calm, neutral-bloom **warming-up** state ("getting a
   read on things") shows until the smoothing buffer holds enough readings (D-3
   cold-start = 4). **FR-004's state list becomes**: permission, **warming-up**,
   active, out-of-frame, paused, blocked, ended — plus the transient **skipped-read
   note** and the **calibrate-first** surface.
2. **First displayed reading at ~90 s, not ~60 s.** The first state the user sees
   is already smoothed; the display holds warming-up until the cold-start gate
   clears. **SC-001 updated**: first smoothed reading within **~90–105 s**, then
   ~every 10 s.
3. **"Couldn't read this window" gets its own affordance** — a quiet **foggy
   "skipped a read" note**, NOT the out-of-frame surface (a coverage failure can
   happen while the user is plainly in frame — glare/low light — so "move back
   into frame" would be wrong). It names the likely cause + a gentle fix, reusing
   the feature 005/006 cause vocabulary (`dominantCause`). The bloom keeps showing
   the **last smoothed state** underneath; capture continues. (FR-013 clarified.)
4. **Calibrate-first surface (no-anchor, US3)** — a **foggy** panel (attention,
   not stress) with a short line and a **"Start calibration"** action routing to
   the calibration flow (forward action button is **meadow** per Principle V).
   Resolves MG-1.
5. **Mobile (≥ 360 px) monitoring stage stacks** — bloom shrinks, controls go
   full-width and stack, pill/viewfinder reposition. Resolves MG-3 (Principle VI).
6. **"Ended" is not a monitoring-page screen.** Ending returns the user to the
   **dashboard with an updated recap** — no distinct ended screen is built.
   **SC-010 wording adjusted**: "ended" is verified as the
   return-to-dashboard-with-recap transition, not a standalone visual.
7. **Idle recap empty state** — a calibrated user who has never run a session has
   no "last session." The idle check-in card shows a graceful empty state ("Start
   your first check-in") rather than a broken/blank recap.

---

## R-5 — Client 60 s-window-on-10 s-stride assembly

**Decision**: Use a **staggered recorder pool**: every 10 s the client starts a
fresh 60 s `MediaRecorder` on the shared `MediaStream`; each recorder stops at
60 s and yields a **self-contained, decodable** clip that is uploaded
immediately. At steady state up to six recorders overlap; readings land at
60 s, 70 s, 80 s, … — exactly the 10 s stride with the first at ~60 s.

**Rationale**: Each upload must be a single decodable video the **shared**
extraction path (`compute_anchor`) can open. Trimming a rolling 60 s slice out of
one continuous webm requires re-muxing (e.g. `ffmpeg.wasm`) because you cannot
drop a webm's init segment and keep a valid file. Multiple `MediaRecorder`
instances on one stream are permitted; the redundant parallel encode is the cost
the brief already accepts on localhost (and is exactly what the future
server-side rolling-feature cache removes). The capture loop is timer-driven and
each upload is fire-and-forget with its own handler, so a slow window never
stalls the next capture (FR-016, SC-007).

**Alternatives considered**:
- **Continuous recorder + client-side rolling trim** — rejected; webm cannot be
  front-trimmed without re-muxing; pulling in `ffmpeg.wasm` is heavy.
- **Six independent 10 s segments uploaded as a batch for server-side assembly** —
  viable and lighter on the encoder, but requires the extraction entry to accept
  multiple clips and concatenate frames (a package change). Kept as the documented
  fallback if the parallel-encoder CPU cost proves too high on target hardware.

**Note for /speckit-tasks**: the recorder-pool encoder cost and clip decodability
on real Chrome MediaRecorder webm is the main implementation risk; the e2e/smoke
plan must exercise it on a real browser, and the fallback (segment + server
assembly) is the escape hatch.

---

## R-6 — webm/VFR fidelity hardening check (scheduled, not a blocker)

**Decision**: Add `packages/ml-video/tests/test_webm_vfr_fidelity.py` that decodes
**the same visual content** as mp4 (CFR) and webm (VFR) and asserts the extracted
2958-d vectors stay within tolerance. Record it as **scheduled hardening, not a
ship blocker**.

**Rationale**: The notebook fidelity gate (`docs/MODELS.md` lineage) was validated
on CFR mp4. Real inference clips are Chrome MediaRecorder **webm/VFR**, which
travel the timestamp-sampler path (`pipeline._timestamp_keep_indices`,
`CAP_PROP_POS_MSEC`) the notebook gate did not check. The package already routes
CFR→legacy-index and VFR→timestamp-bucket sampling with a 0.05 interval-CoV /
0.10 fps-tolerance classifier; this test locks that the two paths agree on real
content. Spec Test Plan Notes mark it as hardening; the feature ships on the
existing CFR-validated fidelity plus the live smoke pass.
