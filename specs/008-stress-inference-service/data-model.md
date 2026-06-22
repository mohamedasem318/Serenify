# Phase 1 Data Model — Stress Inference Service (008)

Concrete schema for the spec's Key Entities, resolving **D-4**. Migration:
`supabase/migrations/20260619000000_monitoring_sessions_and_readings.sql`.

Conventions match the existing migrations (`20260527000000_anchor_columns.sql`,
`20260517000020_profiles_rls.sql`): explicit per-role grants (Supabase grants per
role, so `REVOKE … FROM PUBLIC` alone is a no-op — see DECISIONS 2026-05-25 slice
1), a SELECT **column whitelist** to withhold sensitive columns from the owner,
and **no manager policy** on these tables.

---

## Entities

### 1. Monitoring Session (`public.monitoring_sessions`)

A single check-in run for one employee. Groups the run's readings and anchors the
recap and trend. (FR-008)

| Column | Type | Notes |
|---|---|---|
| `id` | `uuid` PK | `default gen_random_uuid()` |
| `user_id` | `uuid` NOT NULL | `REFERENCES auth.users(id) ON DELETE CASCADE`; the owning employee |
| `started_at` | `timestamptz` NOT NULL | `default now()` |
| `ended_at` | `timestamptz` NULL | set on end / auto-end |
| `status` | `text` NOT NULL | `CHECK (status IN ('active','paused','out_of_frame','ended'))`, `default 'active'` |
| `end_reason` | `text` NULL | `CHECK (end_reason IN ('user','auto_absence','error'))`; null until ended |
| `model_version` | `text` NOT NULL | provenance, e.g. `serenify-video-lbptop-motion-rf-calibrated@2.0.0` |
| `created_at` | `timestamptz` NOT NULL | `default now()` |
| `updated_at` | `timestamptz` NOT NULL | `default now()`; bumped on status/end writes |

Indexes: `(user_id, started_at desc)` for the recap ("most recent ended
session"); PK on `id`.

**Lifecycle / status transitions** (mirror the 7 UI op-states; warming-up,
permission, blocked are pre-session/client-only and have no row state):

```
                 create
           ──────────────────▶  active
 active  ──PATCH paused──▶ paused ──PATCH active──▶ active
 active  ──PATCH out_of_frame──▶ out_of_frame ──auto-resume──▶ active
 any non-ended ──end (user)──▶ ended (end_reason='user')
 out_of_frame/active ──5 min absence──▶ ended (end_reason='auto_absence')
 server/extract fault ──▶ ended (end_reason='error')
```

`status` is advisory for the recap; the authoritative session bounds are
`started_at`/`ended_at`. (Auto-pause at 90 s no-face and auto-end at 5 min
absence are client-detected via the on-device face detector and written through
`PATCH`/`end`; FR-005, FR-007, SC-006.)

### 2. Window Reading (`public.window_readings`)

The result of one captured window, keyed to **user + session + timestamp**.
Source of the trend, the recap, and the FR-020 sustained-tense seam. (FR-017)

| Column | Type | Notes | Owner can SELECT? |
|---|---|---|---|
| `id` | `uuid` PK | `default gen_random_uuid()` | yes |
| `session_id` | `uuid` NOT NULL | `REFERENCES public.monitoring_sessions(id) ON DELETE CASCADE` | yes |
| `user_id` | `uuid` NOT NULL | denormalized for RLS + 009 queries; `REFERENCES auth.users(id) ON DELETE CASCADE` | yes |
| `captured_at` | `timestamptz` NOT NULL | window-end timestamp (the time key) | yes |
| `scored` | `boolean` NOT NULL | scored vs skipped marker | yes |
| `band` | `text` NULL | `CHECK (band IN ('at_ease','a_little_tense','tense'))`; null when skipped **or** warming | yes |
| `skip_cause` | `text` NULL | `CHECK (skip_cause IN ('low-light','out-of-frame','insufficient-face','our-side'))`; null when scored | yes |
| `label` | `smallint` NULL | raw `predict_delta` label 0/1; null when skipped | **no (server-only)** |
| `stress_probability` | `real` NULL | raw `proba[1]`; null when skipped | **no (server-only)** |
| `created_at` | `timestamptz` NOT NULL | `default now()` | yes |

Indexes: `(session_id, captured_at)` for the trend; `(user_id, captured_at)` for
009 + recap.

**State meanings**:
- `scored = true, band = <value>` — a confident smoothed reading (post warm-up).
- `scored = true, band = NULL` — a scored window during **warming-up** (raw
  `proba`/`label` recorded server-only; no confident band yet).
- `scored = false, band = NULL, skip_cause = <value>` — a **skipped** (couldn't-read)
  window; the bloom keeps the last smoothed state and the foggy skip-note shows.

---

## RLS & grants (the Principle-I mechanism) — REVISED (2026-06-19, D-1 flip)

> **Revised**: with D-1 flipped to **no service-role**, all writes happen **as the
> user** (the API forwards the user JWT; RLS applies). So the tables need explicit
> **insert-own / update-own** policies (not just select-own), and writes are no
> longer "service-role only." The raw `stress_probability`/`label` stay server-only
> via the **SELECT** column whitelist, unchanged.

```sql
ALTER TABLE public.monitoring_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.monitoring_sessions FORCE  ROW LEVEL SECURITY;
ALTER TABLE public.window_readings     ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.window_readings     FORCE  ROW LEVEL SECURITY;
-- FORCE is safe now: there is no service-role/owner write path to exempt — every
-- writer (the API and the browser) acts as `authenticated` via a forwarded JWT and
-- is subject to RLS. FORCE additionally blocks any accidental owner-role bypass.

-- Owner reads own rows only. NO admin/manager policy exists on either table
-- (Principle I — the manager layer gets nothing from this feature).
CREATE POLICY ms_select_self ON public.monitoring_sessions
  FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY wr_select_self ON public.window_readings
  FOR SELECT USING (auth.uid() = user_id);

-- Owner writes own rows only (the API performs these as the user via forwarded JWT).
CREATE POLICY ms_insert_self ON public.monitoring_sessions
  FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY ms_update_self ON public.monitoring_sessions
  FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY wr_insert_self ON public.window_readings
  FOR INSERT WITH CHECK (
    auth.uid() = user_id
    AND EXISTS (SELECT 1 FROM public.monitoring_sessions s
                WHERE s.id = session_id AND s.user_id = auth.uid())
  );
-- No UPDATE/DELETE policy on window_readings (append-only from the owner's side).

-- Per-role grants (Supabase grants explicitly per role; PUBLIC revoke is a no-op).
REVOKE ALL ON public.monitoring_sessions FROM anon, authenticated;
REVOKE ALL ON public.window_readings     FROM anon, authenticated;

-- monitoring_sessions: owner reads all columns (no sensitive raw here), inserts,
-- and updates status/ended_at/end_reason on their own row.
GRANT SELECT ON public.monitoring_sessions TO authenticated;
GRANT INSERT (id, user_id, started_at, status, model_version) ON public.monitoring_sessions TO authenticated;
GRANT UPDATE (status, ended_at, end_reason, updated_at)        ON public.monitoring_sessions TO authenticated;

-- window_readings:
--  * SELECT column whitelist EXCLUDES label + stress_probability (the anchor_vector
--    withholding pattern) → owner builds the trend from {captured_at, scored, band,
--    skip_cause} but never reads a probability (FR-015; raw signal server-only).
--  * INSERT grant INCLUDES label + stress_probability so the API (as the user) can
--    write them; they remain unreadable by the owner via the SELECT whitelist.
GRANT SELECT (id, session_id, user_id, captured_at, scored, band, skip_cause, created_at)
  ON public.window_readings TO authenticated;
GRANT INSERT (id, session_id, user_id, captured_at, scored, band, skip_cause, label, stress_probability, created_at)
  ON public.window_readings TO authenticated;
```

Also in this migration: `public.get_my_anchor()` — a scope-guarded
`SECURITY DEFINER` function returning the **caller's own** `anchor_vector`
(filtered on `auth.uid()`, raising on a non-owner target), `STABLE`,
`SET search_path = ''`, `OWNER TO postgres`, `REVOKE EXECUTE … FROM PUBLIC, anon`,
`GRANT EXECUTE … TO authenticated` — mirroring the existing `has_anchor()`
(`20260527000000_anchor_columns.sql`). The API calls it with the forwarded user
JWT so `auth.uid()` resolves to the caller; the anchor is returned to the **API
only**, never to a browser SELECT.

**Write-integrity — deliberately deferred (low-stakes, D-1 amendment).** Because
writes are `authenticated`-role under RLS, a user *could* fabricate **their own**
readings (insert-own). Accepted: own data only; managers read nothing (no manager
policy); the privacy invariant is unchanged. **Upgrade path (not built now)**:
move INSERT to a **dedicated INSERT-only Postgres role** held by the API and
`REVOKE INSERT … FROM authenticated`, so only the API can write readings.

---

## Retention

- **`window_readings`: 90 days, then purge.** Covers the session trend, the
  today recap, the 009 sustained-tense seam, and demo windows, while
  minimizing long-term retention of affective signal data (Principle I).
- **`monitoring_sessions`: retained longer** (already aggregate-ish — duration +
  tenor; no raw signal).
- **Purge mechanism**: a documented follow-up (a `pg_cron` job or a scheduled
  server task that deletes `window_readings WHERE created_at < now() - interval
  '90 days'`). The **policy** is decided now; the job is **not built in 008** (it
  is a small additive task, flagged for /speckit-tasks or a later maintenance
  feature). No reading is read after 90 days by any 008 surface, so the absence of
  the job in 008 has no functional effect beyond storage growth.

---

## Derived: Smoothed Display State (not persisted as such)

The three-band state shown on the bloom is **derived server-side** per window from
a rolling smoothing of recent `stress_probability` values, then **persisted as
`window_readings.band`** so the trend/recap and feature 009 read one source of
truth. The smoothing/banding/cold-start numbers live in
[`contracts/smoothing-and-banding.md`](./contracts/smoothing-and-banding.md).
Never exposed as a number.

---

## Reads — trend, recap, and the 009 seam

Trend/recap reads are **browser-side Supabase RLS SELECTs** (typed client,
`apps/web/lib/api/monitoring-reads.ts`) — no extra API endpoints. The manager
layer has no policy and therefore cannot run these. (The **API** also reads/writes
these tables, but **as the user** via the forwarded JWT — the same RLS select-own /
insert-own scope; revised D-1 — not with a broad credential.)

**Session trend (monitor page — this live session).** The monitor page's own
reader, scoped to the one session currently being recorded:

```ts
// getSessionTrend(sessionId) → ordered series for ONE session
select id, captured_at, scored, band, skip_cause
from window_readings
where session_id = :sessionId            -- RLS also restricts to auth.uid()
order by captured_at asc;
```

The monitoring page renders the full series and maps `band` → height (at_ease low
→ tense high); skipped points (`scored=false`) render as **gaps only** — never
carried forward, never a fabricated reading (FR-029).

**Today recap (dashboard card — FR-019 + empty state).** Today-scoped and
**retrospective** — *not* a single last session. It returns today's (local-day)
sessions that are **ended OR stale-active**, **excluding** the currently fresh-live
session (which stays on the monitor page). This defines the session set the today
trend also reads:

```ts
// getTodayRecap(userId) → today's ended-or-stale-active sessions (fresh-live excluded), or []
select s.id, s.started_at, s.ended_at, s.status
from monitoring_sessions s
where s.user_id = :userId                       -- RLS also restricts to auth.uid()
  and s.started_at >= :localDayStart and s.started_at < :localDayEnd   -- start-day attribution, user-local day (A2/A3)
  and (
    s.status = 'ended'                          -- ended (incl. end_reason 'abandoned')
    or coalesce(                                -- …or stale-active: last reading > 5 min old
         (select max(wr.captured_at) from window_readings wr where wr.session_id = s.id),
         s.started_at
       ) < now() - interval '5 minutes'         -- a fresh-active session (reading within 5 min) is the live one → excluded
  )
order by s.started_at asc;
```

Per session the recap derives **duration** (`ended_at − started_at`, or last
reading − `started_at` for a stale-active row) and **overall tenor** (e.g. the
modal `band`, or fraction `at_ease`, from that session's today-trend rows), plus
the **read-less** flag (zero `scored=true` rows → "no clear read", never calm).
When the query returns `[]` the card renders the **empty state** ("No check-ins
yet today" / first-run "Start your first check-in") — branching on `has_anchor` so
a no-anchor first-run user is routed to calibrate-first instead (E4). (FR-019,
Mock-gap #7)

**Today trend (dashboard card — SC-008 consistency).** The card's collapsed
mini-trend and its expanded in-place "today" view read the **same** per-window
rows from one reader, so they always agree (SC-008). The rows are those of the
`getTodayRecap` session set, owner-readable columns only:

```ts
// getTodayTrend(userId) → per-window rows for TODAY's retrospective sessions (the getTodayRecap set)
select band, captured_at, scored, skip_cause, session_id
from window_readings
where user_id = :userId                         -- RLS also restricts to auth.uid()
  and session_id in (                           -- exactly the getTodayRecap session set
    select s.id from monitoring_sessions s
    where s.user_id = :userId
      and s.started_at >= :localDayStart and s.started_at < :localDayEnd
      and (
        s.status = 'ended'
        or coalesce(
             (select max(wr.captured_at) from window_readings wr where wr.session_id = s.id),
             s.started_at
           ) < now() - interval '5 minutes'
      )
  )
order by captured_at asc;
```

Owner-readable columns only (`band, captured_at, scored, skip_cause, session_id`)
— never `label`/`stress_probability` (FR-015; SELECT whitelist). The collapsed
mini-trend downsamples these rows; the expanded view groups them by `session_id`.
Where a session also appears live on the monitor page (`getSessionTrend`), the two
agree (FR-018). Skipped points render as **gaps only** — never carried forward,
never fabricated (FR-029).

**US4 read-rules — decided 2026-06-21 (008 edge-case pass; see `docs/DECISIONS.md`
"008 US4 read-path edge-case decisions").** These bind the reads/render above when
US4 (T046–T050) is built; none is built yet:

- **Retrospective-only (B4).** Today/recap show **ended** sessions; a genuinely-live
  session stays on the monitoring page and is never drawn here (never a fabricated
  end). "Ended" for the recap means `status = 'ended'` **OR stale-active** — a row
  still `active` but whose **last reading is more than 5 minutes ago** (the existing auto-end
  window; activity signal = `max(window_readings.captured_at)`, no new column). A
  **fresh-active** session (a reading within the last 5 min) is the live one and is
  **excluded** from the retrospective read. (The create route already finalizes a
  prior active as `'abandoned'`, so in practice a stale-active row is rare; the read
  rule is the belt to that suspenders.)
- **Read-less / degenerate session (B1/B2/B3).** A session that produced **zero**
  readable bands (ended in warming-up, or every window skipped) must render an honest
  **"checked in, but we didn't get a clear read"** state with a neutral marker —
  **never** "at ease"/calm. A **single-band** session (n=1) renders as a **dot / short
  mark**, never a broken or empty SVG path. Distinguish "scored ≥1 band" from
  "0 bands" by counting `scored = true` rows.
- **Day attribution (A2).** A session that crosses midnight belongs to its **start
  day**; no splitting at midnight.
- **Local time (A3).** Render `captured_at` (stored UTC, ISO-8601) in the **user's
  local** zone (e.g. `new Date(captured_at)` → `toLocale*`), never a hardcoded
  UTC/server zone.
- **Empty-vs-calibrate (E4).** When this recap/empty surface lands on the check-in
  card, branch on **`has_anchor`**: a first-ever **no-anchor** user gets the
  calibrate-first prompt, **not** the "no sessions yet" empty state.
- **Whitelist (D1) — re-audit on build.** The `getSessionTrend` / `getTodayTrend` /
  `getTodayRecap` `.select()` strings must stay on `{id, captured_at, scored, band,
  skip_cause}` / `{band, captured_at, scored, skip_cause, session_id}` /
  `{id, started_at, ended_at, status}` — **never** `label`/`stress_probability`. The DB
  column GRANT backstops a slip (denies the read, `42501`), but keep the SELECTs honest.

**FR-020 sustained-tense seam (no trigger built in 008).** Feature 009 detects a
sustained-tense stretch with a server-side query over the persisted shape, e.g.:

```sql
-- 009's concern, shown for seam-sufficiency only — NOT built in 008
select count(*) from window_readings
where user_id = :userId and session_id = :sessionId
  and band = 'tense'
  and captured_at >= now() - interval '<009-defined window>';
```

`band` + `captured_at` + `session_id` (+ the server-only raw `proba` if 009 wants
to re-derive) are sufficient for 009 to define "sustained" however it chooses.
**008 persists this shape and builds no questionnaire trigger, UI, or flow.**

---

## Calibration Anchor (existing — read-only input)

`profiles.anchor_vector bytea` (+ `anchor_captured_at`, `anchor_model_version`),
from features 004–006. Read **server-side only** via `public.get_my_anchor()` (a
self-scoped `SECURITY DEFINER` function; the API calls it with the **forwarded user
JWT** so `auth.uid()` resolves to the caller — **no service-role**), decoded to a
`(2958,)` float vector for `delta = current − anchor`. The anchor is returned to
the **API only**, never to a browser SELECT (the column whitelist still excludes
`anchor_vector`). **Not created or modified here.** Absence (`anchor_vector IS
NULL` → `get_my_anchor()` returns NULL) triggers the calibrate-first guard
(FR-011) — checked at session create.
