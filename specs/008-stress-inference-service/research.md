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

**Metadata hygiene (Change 4, 2026-06-19 amendment)**: removing/annotating the
stale 30 s block is **metadata/doc only** — it does **not** change the model, the
scaler, or the 2958-d feature space. Therefore **no `model_version` bump and no
anchor invalidation** (existing anchors stay valid). The model artifact MUST NOT
be edited as part of this plan; this is recorded as a small backlog/task item and
flagged for the model owner, to be done separately.

---

## D-1 — Anchor read path at inference

> **REVISED — 2026-06-19 amendment.** The maintainer flipped D-1 to preserve
> DECISION-9's "no broad DB credential in `apps/api`" posture. The original
> service-role decision (kept below under *Alternatives*) is **superseded**.

**Decision**: **Self-scoped `SECURITY DEFINER` read, in the caller's RLS context —
no service-role key.** `apps/api` gains **no** broad DB credential. The anchor is
read by a `SECURITY DEFINER` function `public.get_my_anchor()` that filters
strictly on `auth.uid()` and returns **only the caller's own** anchor; EXECUTE is
granted to `authenticated` only. The API calls it **as the user** — forwarding the
verified access token (RLS-respecting), using the **publishable anon key** as the
PostgREST `apikey` (a publishable key, not a secret), never a service credential.
The anchor never enters a normal authenticated client SELECT (the column-grant
whitelist still excludes `anchor_vector`); it flows Supabase → API only.

**Writes (sessions/readings)**: RLS-scoped, consistent with the anchor posture —
the employee inserts/updates **their own** rows under RLS (insert-own / select-own
/ update-own; **no manager policy at all**, Principle I intact). The API performs
these writes **as the user** (forwarded JWT), so the raw `stress_probability` /
`label` are written by the API but held server-side via the SELECT column
whitelist — the owner reads only `{captured_at, scored, band, skip_cause}`.

**Rationale**:
- Strongest secrets posture: **no new secret** in `apps/api`. The anon/publishable
  key is already shipped to browsers (`NEXT_PUBLIC_SUPABASE_ANON_KEY`) and grants
  nothing beyond RLS — **stronger** than the original service-role design
  (Principle IX).
- `auth.uid()` resolves correctly when the RPC is called with the **forwarded user
  JWT** — the established, working pattern: DECISION-9's note records that
  `/api/admin/invite` calls SECURITY DEFINER RPCs *"via the CALLER's session client
  … so `auth.uid()` inside `is_admin()` resolves to the verified user. Calling via
  the service-role client would return NULL `auth.uid()`."* `get_my_anchor()`
  mirrors the existing scope-guarded `has_anchor()` (owner-only).
- Alignment with `/anchor` (verified): the `/anchor` router does **zero** DB I/O —
  it returns the vector and the **browser writes it via its own RLS session
  client**. 008 preserves that *credential posture* (no broad credential;
  user-context RLS) — see the flagged divergence below.

**Flagged divergence (not a blocker)**: `/anchor`'s literal pattern is "API does
no DB I/O; the browser does it via RLS." 008 cannot follow that literally: (1) the
decision is explicit that *the API* talks to Supabase as the user (not the
browser), keeping the anchor off the client; (2) the raw
`stress_probability`/`label` must stay server-side, so the **browser cannot be the
writer** of the reading row (it would have to hold the probability — contrary to
"no number" / Principle I). Therefore `apps/api` gains forwarded-JWT DB I/O — a
*new* access pattern for that service (the forwarded-JWT-RPC pattern itself already
exists in the **web** invite handler). It uses the same user-context RLS posture
and **no broad credential**, honoring DECISION-9's intent; recorded as a deliberate
divergence, not a contradiction.

**Write-integrity — deliberately deferred (low stakes)**: without a server-only
write credential, a user could in principle fabricate **their own** readings (they
hold insert-own under RLS). Accepted because (a) the blast radius is the user's own
data only, (b) managers never see raw readings (no manager policy), and (c) the
privacy invariant is unchanged. **Upgrade path (not built now)**: a **dedicated
INSERT-only Postgres role** (a narrow write credential, far less than service-role)
held only by the API, with INSERT revoked from `authenticated` — added only if
reading integrity ever needs enforcing.

**Mechanism note**: the API makes the RPC/RLS calls via a thin Supabase client
(`supabase-py` `create_client(url, anon_key)` then per-request
`postgrest.auth(<forwarded JWT>)`, or an equivalent `httpx` PostgREST call with
`apikey: <anon>` + `Authorization: Bearer <forwarded JWT>`). `SUPABASE_URL`
(already in config for JWKS) becomes required; `SUPABASE_ANON_KEY` is added
(publishable, not a secret). The employee gate reads the caller's own
`profiles.role` via the same forwarded-JWT select-self (`role` is in the existing
SELECT whitelist) — no service credential needed.

**Alternatives considered**:
- **(a, original — superseded) server-side service-role read** keyed by the
  verified `user_id` via a scoped service-role client. Rejected on review: it
  introduced a **broad DB credential** (a new secret) into `apps/api`, against
  DECISION-9's posture, even though feature 004 had left the service-role path open
  (`20260527000000_anchor_columns.sql`: *"service_role … future 005 server-side
  read … untouched"*). The self-scoped-DEFINER path is the other option 004 named
  and is the safer one.
- **Browser calls `get_my_anchor()` and sends the anchor to the API** — rejected;
  ships the 2958-d anchor to the client (the decision keeps the API as the caller).

---

## D-2 — Endpoint shape AND upload/buffer model (REVISED — 2026-06-19 amendment)

> **REVISED — 2026-06-19 amendment.** The maintainer flipped the upload/buffer
> model: the client no longer assembles 60 s windows. It streams uniform ~10 s
> segments from a **single** `MediaRecorder`, and the **server** buffers the recent
> segments per session and assembles the rolling 60 s window. What the original
> plan called the "deferred server-side rolling-feature cache" becomes the
> **primary** design. The session-aware endpoint shape (below) is unchanged.

**Decision (endpoint shape — unchanged)**: **Session-aware**, three endpoints:
`POST /monitoring/sessions` (create) → `POST /monitoring/sessions/{id}/windows`
(submit one ~10 s segment, ×N) → `POST /monitoring/sessions/{id}/end`. A
lightweight `PATCH /monitoring/sessions/{id}` carries lifecycle status (paused /
active / out_of_frame) for the recap. Reads (trend, recap) are **not** API
endpoints — the browser reads its own rows via Supabase RLS (typed client).

**Decision (upload/buffer model — REVISED)**: The client records with a **single
`MediaRecorder`** in timeslice mode (~10 s) and uploads **only the newest ~10 s
segment** each stride. The **server** keeps a small **transient per-session
segment buffer** (the last 6 segments = 60 s) and **assembles the rolling 60 s
window** for extraction. No band is produced until the buffer holds a full 60 s
(plus the D-3 cold-start count of scored readings).

**Decision (smoothing locus — unchanged)**: Smoothing, banding, and the cold-start
gate stay **server-side** in the window endpoint; the band is returned and the
client renders it (first reading already smoothed; card/page trends agree, SC-008).

**Rationale**:
- **One client encoder instead of ~6** (the original staggered-pool would run up
  to six overlapping `MediaRecorder`s): far lighter on CPU/battery, especially on
  mobile, and **~6× less upload bandwidth** (10 s/stride vs a full 60 s clip).
- **Cross-browser robustness**: **WebKit/Safari `MediaRecorder` is the fragile
  case** (limited webm; emits fragmented MP4) and **Safari/iOS is a hard
  pre-production gate** — a single-encoder path is materially more defensible than
  six concurrent recorders. (See R-7 for the required early Safari spike.)
- Session-aware grouping still makes readings/trend/recap trivial and gives feature
  009 a clean unit; the transient buffer is small and lives only for an active
  session.

**Privacy (Principle I)**: buffered segments are **transient, server-side only,
never persisted**; the assembled window and the segments are deleted in a `finally`
block (same pattern as `/anchor`). No raw video persists.

**Alternatives considered**:
- **Single stateless per-window endpoint (no session)** — rejected (as before);
  no clean grouping/lifecycle home.
- **Client-assembled 60 s window per stride (the original D-2)** — superseded:
  ~6× bandwidth and a ~6-recorder encoder pool, fragile on Safari (see R-5).

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

**RLS / grants** (revised for the D-1 flip): RLS enabled (+ FORCE). The owner gets
**select-own + insert-own (+ update-own on sessions)**; the **SELECT** column
whitelist **excludes `label` and `stress_probability`** (the `anchor_vector`
mechanism) — the client reads `{captured_at, scored, band, skip_cause}` for the
trend and never a probability, while the **INSERT** grant includes those columns so
the API (writing **as the user** via forwarded JWT) can persist them server-only.
**No manager policy exists** on either table (Principle I — managers see nothing
here). Writes run **as the user under RLS** (no service-role); write-integrity is
deferred (a user could fabricate their own readings — own data only; upgrade path =
a dedicated INSERT-only role).

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

## R-5 — Segment streaming + server-side 60 s assembly (REVISED — 2026-06-19 amendment)

> **REVISED — replaces the staggered-recorder-pool approach** with single-recorder
> segments + server-side rolling assembly (per the D-2 flip).

**Decision**: The client runs a **single `MediaRecorder`** with
`start(timeslice ≈ 10000 ms)` and uploads each emitted ~10 s segment as it
arrives. The server keeps a **transient per-session buffer** of the last 6 cluster
segments (= 60 s) plus the recording's **init segment**, **reassembles** a trailing
60 s container, writes it to a temp file, and runs the **existing single-path
extraction** (`ml_video.compute_anchor(tmp_path)`). Buffer lifecycle: append each
segment; once > 6 cluster segments, evict the oldest; assemble on each stride;
**clear on pause/end**; segments + assembled temp file deleted in `finally`.

**⚠ FLAGGED contradiction (per the brief: "if container-level concatenation is
unavoidable, flag it")**: the brief's *preferred* "decode each segment and
concatenate sampled frames (rather than mux containers)" is **not directly
feasible** here, for two verified reasons:
1. **Timeslice chunks are not independently decodable.** With one `MediaRecorder`
   in timeslice mode, only the **first** chunk carries the container init segment
   (webm EBML header / fMP4 `ftyp`+`moov`); every later chunk is bare media
   clusters/fragments. A lone non-first segment cannot be opened by
   `cv2.VideoCapture`, so it cannot be decoded to frames in isolation — there is
   nothing to "concatenate frames" from without first restoring a container.
2. **The shared extraction entry is single-file/path-based.** `extract_landmarks`
   (and thus `compute_anchor`) opens **one** container via `cv2.VideoCapture`
   (probe pass + retrieve pass). It has **no** frame-sequence / multi-clip entry.

Therefore the realistic design is **container-level reassembly** —
`[init segment] + [last 6 cluster segments]` → one temp container → existing
decode (the VFR timestamp-sampler handles the rest). This is exactly the
"container-level concatenation" the brief asked to flag. **It is the recommended
path (B1)** and its decodability MUST be validated early on real browsers (see
R-7), because the assembled file is a synthetic container (header + non-contiguous
clusters), and **Safari emits fragmented MP4, not webm**, so two container formats
must both reassemble + decode.

**Fallback (B2, if B1 reassembly proves unreliable on Safari)**: stop/restart the
recorder every ~10 s so each segment is a **complete, standalone** container, then
add a **new multi-clip extraction entry** to `packages/ml-video` that decodes each
segment, samples frames per clip, and concatenates the **frame arrays** before
LBP-TOP/motion. This is the true frame-level approach but (a) is **not** "a single
timeslice recorder" and (b) is a **package change** (Principle III — a new public
extraction entry, not a second copy). Held as the escape hatch, not built now.

**Timeline (unchanged vs the original)**: the server can assemble a 60 s window
only once 6 segments (~60 s) have arrived → first scored reading ~60 s, readings
every ~10 s thereafter; with D-3 cold-start = 4 scored readings, the first band
lands ~90–105 s. Before 60 s of segments accrue there is **no** reading
(warming-up) — partial windows are never scored (the 60 s contract is locked).

**Non-blocking (FR-016, SC-007)**: the single recorder emits segments on its own
timer; each segment upload is fire-and-forget; a slow server assembly/extraction
for one window never stalls the next segment's capture or upload, and each window
is processed independently (threadpool) server-side.

**Note for /speckit-tasks**: the **container reassembly + decodability across
Chrome (webm) and Safari (fMP4)** is the primary implementation risk and MUST be
de-risked by the R-7 early Safari spike before the full build; B2 is the escape
hatch if it fails.

---

## R-6 — webm/VFR fidelity hardening check (scheduled, not a blocker)

**Decision**: Add `packages/ml-video/tests/test_webm_vfr_fidelity.py` that decodes
**the same visual content** as mp4 (CFR) and webm (VFR) and asserts the extracted
2958-d vectors stay within tolerance. Record it as **scheduled hardening, not a
ship blocker**. **Amendment note (2026-06-19)**: with R-5's server-side assembly,
this check should also cover a **reassembled** trailing-60 s container (init +
clusters) decoding to a 2958-d vector within tolerance of the same content decoded
as a single complete file — i.e. the assembly path does not perturb features.

**Rationale**: The notebook fidelity gate (`docs/MODELS.md` lineage) was validated
on CFR mp4. Real inference clips are Chrome MediaRecorder **webm/VFR**, which
travel the timestamp-sampler path (`pipeline._timestamp_keep_indices`,
`CAP_PROP_POS_MSEC`) the notebook gate did not check. The package already routes
CFR→legacy-index and VFR→timestamp-bucket sampling with a 0.05 interval-CoV /
0.10 fps-tolerance classifier; this test locks that the two paths agree on real
content. Spec Test Plan Notes mark it as hardening; the feature ships on the
existing CFR-validated fidelity plus the live smoke pass.

---

## R-7 — Safari/WebKit early validation (front-loaded, not deferred) (Change 3, 2026-06-19 amendment)

**Decision**: The **segment recorder + server-side container reassembly + decode**
path (R-5) MUST be validated on **WebKit/Safari (incl. iOS) early** — a small spike
**before** the full build — not discovered at the end. This is an explicit
plan/test-plan item to front-load in `/speckit-tasks` (it should be among the first
tasks, gating the rest of the capture/inference build).

**Scope of the spike**: on real Safari (desktop + iOS), confirm that (1) a single
`MediaRecorder` with `timeslice` emits usable ~10 s segments (Safari emits
**fragmented MP4**, not webm), (2) the server can reassemble `[init segment +
recent fragments]` into a container `cv2.VideoCapture` can open, and (3) the
extracted 2958-d vector is sane (and within R-6 tolerance of the same content as a
single file). If the reassembly fails on Safari, switch to the R-5 **B2 fallback**
(standalone segments + a new multi-clip frame-concat extraction entry) — better to
learn that on day one than after the UI is built.

**Rationale**: **Safari/iOS is a hard pre-production gate** and WebKit
`MediaRecorder` is the fragile case (container format + fragment behavior differ
from Chrome). Playwright suites have historically given **false confidence** on
cross-browser capture/timing behavior (see the e2e-load-timing flake history), so
the WebKit smoke gate (real Safari, the existing manual smoke channel) must be
**prioritized**, not relied upon via Playwright alone. This pairs with the single
-encoder choice in D-2 (chosen partly *for* Safari robustness) — the spike confirms
the choice actually pays off on the fragile browser.
