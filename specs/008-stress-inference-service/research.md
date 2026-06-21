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

## D-2 — Endpoint shape AND upload/buffer model (REVISED — 2026-06-19; B2 REVERSED → continuous single-stream)

> **REVISED — 2026-06-19, final.** Lineage: original client-assembled windows →
> single-timeslice + server container reassembly (**B1, NO-GO**) → standalone
> stop/restart clips + server multi-clip frame-concat (**B2, REJECTED** on the
> single-source fidelity fixture — see R-5/R-7 and `docs/DECISIONS.md` 2026-06-19) →
> **continuous single-stream upload (ADOPTED)**. The client now runs **one continuous
> `MediaRecorder`** and uploads the **contiguous recording-so-far** each stride; the
> **server** decodes that one continuous clip and **tail-extracts the last 60 s** via
> the existing single-clip path — **no multi-clip assembly**. The session-aware
> endpoint shape (below) is unchanged.

**Decision (endpoint shape — unchanged)**: **Session-aware**, three endpoints:
`POST /monitoring/sessions` (create) → `POST /monitoring/sessions/{id}/windows`
(submit the contiguous recording-so-far, ×N) → `POST /monitoring/sessions/{id}/end`. A
lightweight `PATCH /monitoring/sessions/{id}` carries lifecycle status (paused /
active / out_of_frame) for the recap. Reads (trend, recap) are **not** API
endpoints — the browser reads its own rows via Supabase RLS (typed client).

**Decision (upload/buffer model — REVISED, continuous single-stream)**: The client runs
**one continuous `MediaRecorder`** (timeslice used only for *incremental capture*, never
stop/restart). Each stride it uploads the **contiguous recording-so-far** — the init
segment + all chunks **in order**, i.e. the literal growing file, which is **always
decodable** (the case already proven reliable — no surgery, no clip stitching, no
init-segment retention). The **server** decodes that one continuous clip and **extracts
the last 60 s** with the existing, validated single-clip extraction path (`compute_anchor`
+ the VFR timestamp / `POS_MSEC` sampler) **bounded to the trailing window** — frames whose
timestamp ≥ `duration − 60 s`. **No multi-clip assembly, no per-session clip buffer.** No
band is produced until ≥ 60 s of continuous recording exists (plus the D-3 cold-start count
of scored readings). The only `packages/ml-video` change is a thin **tail-window option** on
the existing extraction (reuses the exact decode + sampler + features; it only bounds *which*
frames feed the features) — strictly smaller than the retired `compute_anchor_multiclip`.

**Faithful by construction (no new fidelity gate)**: the scored window is a **genuine
continuous 60 s segment sampled by one continuous grid** — no stop/restart seams, no
per-clip phase resets — i.e. exactly the single-clip input the extraction path is **already
validated on**. There is therefore **no new feature-fidelity gate** (contrast B2, whose
multi-clip assembly needed a hard gate that it then failed — R-5/R-7). Residual: only a
≤200 ms *global* sampling-phase offset, within ordinary recording-to-recording variation.

**Decision (smoothing locus — unchanged)**: Smoothing, banding, and the cold-start
gate stay **server-side** in the window endpoint; the band is returned and the
client renders it (first reading already smoothed; card/page trends agree, SC-008).

**Rationale**:
- **Faithful by construction** is the deciding factor: the 60 s window *is* a real
  continuous clip, identical to the training/calibration distribution and the
  already-validated extraction — so windowing stops being a fidelity risk. B2's
  standalone-clip assembly could not reproduce continuous sampling phase and failed the
  fidelity gate (R-5); continuous upload removes the assembly step entirely.
- **One client encoder, simplest possible capture**: a single continuous recorder with no
  stop/restart and no clip lifecycle — the least fragile path on **Safari/WebKit**
  `MediaRecorder` (the hard pre-production gate), since the contiguous file is whatever the
  browser natively produces and is uploaded as-is.
- **Reuses the proven `/anchor` path**: one continuous clip → multipart upload → single-clip
  extraction is exactly the calibration upload+extract path, already validated end-to-end.
- Session-aware grouping still makes readings/trend/recap trivial and gives feature 009 a
  clean unit.
- **Cost, accepted**: upload size and the server's decode-to-tail work grow over the session
  (each stride re-uploads + re-decodes the whole recording-so-far), bounded by the 5-min hard
  cap and negligible on localhost. See the flag + the deferred rolling decoded-frame buffer in
  R-5 and `plan.md`.

**Privacy (Principle I)**: the uploaded continuous clip is **transient, server-side only,
never persisted**; it (and any temp file) is deleted in a `finally` block (same pattern as
`/anchor`). No per-session clip buffer is held; no raw video persists. *(The deferred
server-side rolling decoded-frame buffer, if ever built, holds only decoded frames in memory
for an active session — same transient, never-persisted posture.)*

**Alternatives considered**:
- **Single stateless per-window endpoint (no session)** — rejected (as before);
  no clean grouping/lifecycle home.
- **Client-assembled 60 s window per stride (the original D-2)** — superseded:
  ~6× bandwidth and a ~6-recorder encoder pool, fragile on Safari.
- **Single timeslice recorder + server-side container reassembly (B1)** — rejected (R-7
  structural NO-GO): timeslice chunks aren't independently decodable, a spliced container
  silently corrupts `motion_features`, and webm cluster boundaries aren't guaranteed (see R-5).
- **Standalone stop/restart clips + server multi-clip frame-concat (B2)** — **rejected** on
  the single-source fidelity fixture: a per-clip sampling-phase reset → cosine 0.991 < 0.999,
  ~14% motion-magnitude shortfall, only 31.5% of sampled frames coinciding; not patchable for
  real clips, which carry no global clock (R-5; `docs/DECISIONS.md` 2026-06-19).

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
covers the session trend, the today recap, the 009 seam, and demo windows
while minimizing long-term retention of affective signal data (Principle I).

**Aggregation**: The dashboard card's collapsed mini-trend and its expanded today
view read the **same** `window_readings` rows through a single typed reader
(`getTodayTrend(userId)`) → identical source → guaranteed consistent (SC-008); the
monitoring page reads its own this-session reader (`getSessionTrend(sessionId)`).
The today recap (`getTodayRecap(userId)`) is **today-scoped and retrospective** —
today's **ended-or-stale-active** sessions, the fresh-live one excluded; when there
are none today it returns empty and the card shows the empty state.

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
7. **Idle recap empty state** — a calibrated user with **no check-ins today** has
   nothing to recap. The check-in card shows a graceful empty state ("No check-ins
   yet today" / first-run "Start your first check-in") rather than a broken/blank recap.

---

## R-5 — Continuous single-stream upload + server-side tail-extraction (REVISED — 2026-06-19; B1 NO-GO, B2 REJECTED)

> **REVISED — final 2026-06-19. Windowing lineage:** staggered-recorder pool (original
> R-5) → single-timeslice recorder + server container reassembly (**B1, structural
> NO-GO**) → standalone stop/restart clips + server multi-clip frame-concat (**B2,
> REJECTED** on the single-source fidelity fixture) → **continuous single-stream upload
> (ADOPTED)**. Each prior decision and its evidence is kept below for traceability; the
> live path is continuous. Numbers: `docs/DECISIONS.md` (2026-06-19) and
> `smoke-tests.md` (Step F).

**Decision (continuous single-stream)**: The client runs **one continuous `MediaRecorder`**
(timeslice used only for *incremental capture*, never stop/restart). Each stride it uploads
the **contiguous recording-so-far** — the init segment + all chunks **in order**, i.e. the
literal growing file, which is **always decodable** (the case already proven reliable — no
surgery, no clip stitching, no init-segment retention). The **server** decodes that one
continuous clip and **extracts the last 60 s** with the existing, validated single-clip
extraction path (`compute_anchor` + the VFR timestamp / `POS_MSEC` sampler) **bounded to the
trailing window** — sample frames whose timestamp ≥ `duration − 60 s`, then run **LBP-TOP ⊕
motion** on that ~150-frame / ~60 s set → the 2958-d vector. **No multi-clip assembly, no
per-session clip buffer, no seam handling.** The uploaded clip + any temp file are deleted in
`finally` (Principle I — no raw video persists).

**Faithful by construction (the deciding property)**: the scored window is a **genuine
continuous 60 s segment sampled by one continuous grid** — no stop/restart seams, no per-clip
phase resets — i.e. exactly the single-clip input the extraction path is **already validated
on** (the notebook fidelity gate + the existing webm/VFR sampler). **There is therefore no new
feature-fidelity gate to pass** — the heavy multi-clip fidelity question that blocked B2 simply
does not exist here. (Residual: only a ≤200 ms *global* sampling-phase offset between the
window grid and a standalone clip's grid — within ordinary recording-to-recording variation.)

**Package change (Principle III)**: a thin **tail-window option** on the existing single-clip
extraction — `compute_anchor` gains a trailing-window bound (e.g. `tail_seconds=60`) on the
VFR `_timestamp_keep_indices` sampler so only frames with timestamp ≥ `duration − 60 s` feed
the features. It **reuses** the exact decode + sampler + feature math; for a ≤ 60 s clip it
reduces to `compute_anchor` unchanged. This is **smaller** than the retired
`compute_anchor_multiclip` (no concatenation, no seam-aware motion).

**Faithfulness is grid-dependent — and now enforced, not assumed.** "Faithful by construction"
holds **only** while the tail-window option preserves the **file-global sampling grid**: it must
sample the whole decoded stream on the grid anchored at the file's **t=0** and then *filter* to the
trailing window — it must **never** re-zero `CAP_PROP_POS_MSEC` by seeking/trimming to the last 60 s
and re-sampling the sub-stream (the per-clip phase reset that sank B2, offsetting samples by up to
½ the 400 ms period). With the grid preserved, the kept tail frames are **exactly the suffix** of
the full-file keep-set. This invariant is **enforced by the T006 regression test** (exact
integer-index suffix-equality on synthetic VFR timestamps — deterministic, CI-runnable, no video),
which the **deferred rolling decoded-frame buffer** (below) and any future incremental/buffered
decoder MUST continue to pass — so the optimization can be *validated* rather than *trusted*.

**Retired (B2 artifacts — kept in git history, removed from the active path)**:
`compute_anchor_multiclip`, `motion_features_seamaware`, `test_multiclip_fidelity.py`, and the
multi-clip frame-concat **HARD GATE**. The **single-source diagnostic**
(`tests/helpers/singlesource_fidelity.py`), the single-source fixture, and the finding below
**stay recorded** — they are why B2 was rejected.

**Why B2 (standalone clips + multi-clip frame-concat) is REJECTED — the single-source numbers**:
the multi-clip fidelity gate ran on a **single-source** fixture (the continuous Chrome clip
losslessly re-segmented — identical frames, no re-encode, no new recording, so the *only*
variable is the assembly). Result: **cosine 0.991 < 0.999**, a systematic **~14% motion-magnitude
shortfall** (l2 ratio 0.864), **motion_rel_p99 0.334 > 0.25**. The cause is **not** the seams and
**not** frame loss (`frames_lost = 0`): it is a **per-clip sampling-phase reset** — only **31.5%**
of the 2.5 fps-sampled frames coincide with continuous sampling (52/165); the rest are offset by
up to ~½ the 400 ms sampling period, because each standalone clip re-applies the timestamp grid
from its **own `t≈0`** (`CAP_PROP_POS_MSEC` resets per clip). **Not patchable for real clips**: a
real stop/restart clip carries **no global clock** — its `POS_MSEC` genuinely starts at 0 and the
server cannot know the variable recorder stop→restart gaps, so the continuous sampling phase cannot
be reconstructed. (Two corrected findings, both recorded: the earlier *cross-take* fixture **was a
real flaw** — it conflated assembly fidelity with recording reproducibility, cosine 0.896, motion
p50 0.41 — and the single-source fixture is the **correct** test; but even corrected, B2 cannot hit
fidelity.) The seam-aware motion fix (a prior amendment) was correct for the seams but did not and
could not close this broadband sampling-phase gap.

**Why B1 (container reassembly) was rejected — NO-GO (structural; accepted as-is)**:
1. **`[chunk0 + recent tail]` is not a clean trailing 60 s** without container surgery (the first
   timeslice blob is init + ~10 s of media).
2. **Silent `motion_features` corruption**: a spliced container has a time discontinuity at the
   splice; the frame-to-frame diff inflates max/std across the 2868 motion dims, and the decode can
   **"succeed" while the vector is wrong** (no error raised).
3. **webm timeslice boundaries aren't guaranteed cluster-aligned** → a reassembled webm can be
   structurally invalid (decodability itself unreliable across browsers).
A B1 harness exists at `_scratch-008-b1-spike/` for optional confirmation; the decision did not
wait on it.

**Timeline (unchanged)**: the server can score a 60 s window only once ≥ 60 s of continuous
recording exists → first scored reading ~60 s, readings ~every 10 s thereafter; with the D-3
cold-start of 4 scored readings, the first band lands ~90–105 s. Before ~60 s there is **no**
reading (warming-up) — partial windows are never scored (the 60 s contract is locked).

**Non-blocking (FR-016, SC-007)**: the continuous recorder runs on the client's own timer;
each upload is fire-and-forget; a slow server decode+extract for one window never stalls the
next upload, and each window is processed independently (threadpool) server-side. (This matters
more here than under B2 — see the growing-cost flag.)

**⚠ Known cost — keep-up has TWO components (flagged; arithmetic + diagnosis corrected
2026-06-19 corrective pass)**: each stride re-uploads + re-decodes the **whole recording-so-far**,
so the per-stride server time grows over the session, bounded by the **5-minute hard cap**.
Whether it stays inside the 10 s stride depends on **two distinct costs**, and **only one of them
is fixed by the deferred buffer** — so a breach must be attributed before reaching for a lever:

- **(a) Growing decode-to-tail — O(elapsed); the rolling buffer fixes this.** Real Chrome webm is
  **VFR** and VFR seek is unreliable, so reaching the tail means **sequential decode from the
  start** of the growing file each stride. At the 5-min cap that is ~300 s of video decoded per
  stride. **The budget bar is tighter than a naïve 10 s**: the same stride must *also* fit the
  constant per-window extract (~3–5 s MediaPipe + LBP on Kaggle CPU, per MODEL_HANDOFF.md), so
  decode must complete within `(10 s − extract)` ≈ **5–7 s**, i.e. **~43–60× realtime** at the
  5-min cap — **not** the ~30× / full-10 s an earlier draft stated (that figure wrongly allocated
  the entire stride to decode). Plausible for low-res webcam video; **not guaranteed for 720p
  VP9** on a slow CPU. This is the component the **deferred server-side rolling decoded-frame
  buffer** removes (decode only the newest increment → O(stride)).
- **(b) Constant per-window extract — O(1) per window; the buffer does NOT touch this.** MediaPipe
  + LBP is a fixed per-window cost regardless of session length. MODEL_HANDOFF.md projects
  **~10–15 s/window** on the DigitalOcean droplet (2–3× the Kaggle CPU) — which **alone exceeds
  the 10 s stride**, *even with a perfect decode buffer*. On such a target the correct lever is
  **not** the buffer but a **slower reading cadence** (FR-016 non-blocking + D-3 smoothing already
  tolerate variable arrival) or **GPU MediaPipe**. An extract-bound breach must **not** be
  misdiagnosed as "the decode buffer is needed."

**Bounded, not fatal**: FR-016 non-blocking means capture continues and only the *reading cadence*
degrades toward end-of-session; the 5-min cap bounds the worst case; **localhost (dev/demo) is
unaffected**. The (now lighter) windowing validation measures **both components separately**
(R-7, T008) so a breach can be attributed (T009) without re-running the session.

**⚠ Deploy-target caveat**: every number above is pinned to the **DigitalOcean droplet, which is
being phased out** in favour of **Azure student credits / HuggingFace**. The production keep-up
question (both components) MUST be **re-evaluated against the actually-chosen deploy target**
before relying on long sessions — these droplet figures are indicative, not the production budget.

**Deferred optimization (unchanged — not built now)**: a **server-side rolling decoded-frame
buffer** — retain the trailing 60 s of sampled frames and decode only the **newest increment**
each stride — collapses per-stride decode from O(elapsed) to O(stride) and removes the growth.
Same optimization already deferred (pairs with the future WebSocket transport). Build it
**before** relying on long droplet sessions in production; not needed for localhost/demo.

**Note for /speckit-tasks**: with fidelity faithful-by-construction, windowing is **no longer a
hard fidelity gate**. The one remaining real-device check is light — continuous capture + growing
upload + last-60 s tail-extract **works** on real Chrome + real Safari/iOS and **keeps up**
(per-stride server time within the 10 s stride across a 5-min session), reusing the proven
`/anchor` upload+extract path. The **real Safari/iOS check stays the pre-production gate** but as
a *works-and-keeps-up* check, not a fidelity gate (see R-7 and the tasks ordering).

---

## R-6 — webm/VFR fidelity hardening check (scheduled, not a blocker)

**Decision**: Add `packages/ml-video/tests/test_webm_vfr_fidelity.py` that decodes
**the same visual content** as mp4 (CFR) and webm (VFR) and asserts the extracted
2958-d vectors stay within tolerance. Record it as **scheduled hardening, not a
ship blocker**. **Amendment note (2026-06-19, continuous single-stream adopted)**: there is
**no assembly dimension** under the continuous design — the scored window is a single continuous
clip through the same single-clip extraction the notebook gate validated, so the only residual
is the **codec/sampler** path this check already covers (CFR mp4 vs Chrome webm/VFR through the
`_timestamp_keep_indices` / `POS_MSEC` sampler). This stays **scheduled hardening, not a ship
blocker**. (The earlier B2 amendment had routed the assembly dimension to a multi-clip fidelity
hard gate; that gate and the multi-clip entry are **retired** with B2 — see R-5.)

**Rationale**: The notebook fidelity gate (`docs/MODELS.md` lineage) was validated
on CFR mp4. Real inference clips are Chrome MediaRecorder **webm/VFR**, which
travel the timestamp-sampler path (`pipeline._timestamp_keep_indices`,
`CAP_PROP_POS_MSEC`) the notebook gate did not check. The package already routes
CFR→legacy-index and VFR→timestamp-bucket sampling with a 0.05 interval-CoV /
0.10 fps-tolerance classifier; this test locks that the two paths agree on real
content. Spec Test Plan Notes mark it as hardening; the feature ships on the
existing CFR-validated fidelity plus the live smoke pass.

---

## R-7 — Continuous-capture windowing validation (front-loaded; Safari/iOS pre-production gate; NO longer a fidelity gate) (REVISED 2026-06-19)

> **REVISED — supersedes the B2 "capture + multi-clip fidelity HARD GATE" framing.** With
> the continuous single-stream path **faithful by construction** (R-5), the windowing
> question is **no longer a fidelity risk**: there is **no multi-clip fidelity gate**.

**Decision**: What remains is a **light, real-device validation**, still front-loaded, that
confirms the continuous capture/upload/tail-extract path **works** and **keeps up** on real
browsers. It largely **reuses the proven `/anchor` single-clip upload+extract path**, so it is
far cheaper than the retired B2 gate. One real-device check, on **real Chrome + real Safari/iOS
(NOT Playwright)**:

1. **Works.** A single continuous `MediaRecorder` records a session; each stride the
   **contiguous recording-so-far** uploads and is **decodable** on the server (Chrome webm,
   Safari fragmented MP4), and the server **tail-extracts the last 60 s** → a 2958-d vector each
   stride. (Safari is the fragile encoder — its native contiguous file must decode and
   tail-extract the same way Chrome's does.)
2. **Keeps up.** Per-stride server time (decode-to-tail + extract) stays **within the 10 s
   stride across a 5-minute session** — record measured per-stride times at t ≈ 60 / 120 / 180 /
   240 / 300 s per browser (the worst case is the last stride, ~300 s decoded). A breach late in
   a 5-min session means the **deferred rolling decoded-frame buffer** is needed for production
   (R-5) — it is **not** a fidelity failure and does **not** re-open the windowing approach.

**This remains the Safari/iOS pre-production gate** — but as a *"does the continuous
capture/upload/tail-extract work and keep up"* check, **not** a fidelity gate. Because fidelity
can no longer fail, the feature build need not block on a fidelity result the way it did under
B2; the real-Safari/iOS works-and-keeps-up validation is required **before production**.

**Rationale**: Safari/WebKit `MediaRecorder` is still the fragile encoder and Playwright has
historically given **false confidence** on cross-browser capture/timing (see the
e2e-load-timing flake history), so the real Safari/iOS smoke channel — not Playwright — is the
validator. Front-loading it surfaces a capture/keep-up problem early; but the catastrophic risk
that justified B2's hard gate (silent feature corruption / unreproducible assembly) is gone by
construction, so this is a *de-risking smoke*, not a build-blocking fidelity gate.
