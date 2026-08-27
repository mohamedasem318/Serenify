# Smoke Tests: Recommendations — "Things that might help" (014)

**Status: 5 of 6 recorded (ST-1, ST-2, ST-3, ST-4, ST-5); ST-6 pending write-up.** Authored at the tasks stage (plan
§Constitution VII); results are recorded **inline in this file before
`014-recommendations` merges to `main`** (Principle VII gate 5). Owner: **Mohamed**.

These are the checks automation cannot catch in CI: the live RLS posture, anything
needing a **real camera** (Playwright's fake-camera flags do not engage in this repo),
the **real provider**, and judgement calls on the rendered surface. Each entry carries
three fields — **Check** (what must be true), **Method** (how it was actually verified —
agent-run checks state their method in full; Mohamed's attestations say so), and
**Observations / Verdict** (left blank until run). A failed check is recorded as a
failure, not softened.

Task cross-references: T003 → ST-1 · T020 → ST-2/ST-3/ST-4 · T027 → ST-5 · T035 runs
the file.

---

## ST-1 — Live RLS probe on `recommendation_picks`

**Check**: the owner reads their own rows; a second employee, a team-lead, and an admin
each read **zero** rows; `anon` errors; an UPDATE on an identity column (`item_id`)
fails on grant; **no DELETE path is reachable by any client role** (`authenticated` or
`anon`) (SC-003, FR-025, contracts/recommendation-storage-rls.md §Verification).

**Method**: local Supabase, psql per-transaction impersonation — `SET LOCAL ROLE` +
`set_config('request.jwt.claims', …, true)` (the feature-012 validated method). Seed one
pick row as user A; probe as A, as user B, as a team-lead, as an admin, as `anon`;
attempt `UPDATE … SET item_id` and `DELETE` as A. Transcript pasted below.

**Observations / Verdict**: **PASS — every sub-check.** Run **by agent** (not a Mohamed
attestation) on 2026-08-15, T003.

_Method as actually run._ Local stack only — `supabase status` → `DB_URL
postgresql://postgres:postgres@127.0.0.1:54322/postgres`. No cloud project was touched.
`npx supabase db reset --local` re-applied all eighteen migrations, ending with
`Applying migration 20260815090000_recommendation_picks.sql...` (clean, no errors). The
host has no `psql`, so every statement ran inside the DB container:
`docker exec -i supabase_db_Serenify psql -U postgres -d postgres -f …`.

_Fixtures._ Four users inserted into `auth.users` as `postgres` (the
`on_auth_user_created` trigger seeds `public.profiles`), then `profiles.role` /
`manager_id` set so the hierarchy is real:

```
                  id                  |  full_name  |   role    |              manager_id
--------------------------------------+-------------+-----------+--------------------------------------
 aaaaaaaa-0000-4000-8000-000000000001 | Probe A     | employee  | cccccccc-0000-4000-8000-000000000003
 dddddddd-0000-4000-8000-000000000004 | Probe Admin | admin     |
 bbbbbbbb-0000-4000-8000-000000000002 | Probe B     | employee  | cccccccc-0000-4000-8000-000000000003
 cccccccc-0000-4000-8000-000000000003 | Probe Lead  | team_lead | dddddddd-0000-4000-8000-000000000004
```

A and B both report to the Lead, who reports to the Admin — the manager layer has every
hierarchy edge it would need if any cross-user path existed.

**Every probe prints `current_user` and `auth.uid()` alongside its result**, so the
transcript itself proves which identity each zero-count ran under rather than asking the
reader to trust the surrounding `\echo`. Output below is genuine psql output; only the
`BEGIN` / `SET` / `ROLLBACK` echo lines and blank rows are trimmed.

_Seed — the pick row is inserted by A herself_, not by `postgres`, so the probe also
proves the `rp_insert_self` policy and the INSERT grant, not just the read side:

```
BEGIN;
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claims',
  '{"sub":"aaaaaaaa-0000-4000-8000-000000000001","role":"authenticated"}', true);
SELECT current_user AS db_role, auth.uid() AS acting_as;
    db_role    |              acting_as
---------------+--------------------------------------
 authenticated | aaaaaaaa-0000-4000-8000-000000000001

INSERT INTO public.recommendation_picks (user_id, local_day, episode_id, item_id, category, source)
VALUES ('aaaaaaaa-0000-4000-8000-000000000001', current_date,
        'eeeeeeee-0000-4000-8000-00000000000e','box-breathing','breathing_grounding','reading')
RETURNING id, user_id, item_id;
                  id                  |               user_id                |    item_id
--------------------------------------+--------------------------------------+---------------
 08ed3281-c9bd-48ae-a429-e55ed25a9714 | aaaaaaaa-0000-4000-8000-000000000001 | box-breathing
INSERT 0 1
COMMIT
```

_Probe transcript_ (each probe is its own `BEGIN; SET LOCAL ROLE …; set_config(…); …;
ROLLBACK;`):

```
=== P1 owner (user A) SELECT -> expect her row ===
 claims_set: {"sub":"aaaaaaaa-0000-4000-8000-000000000001","role":"authenticated"}
    db_role    |              acting_as               | rows_visible
---------------+--------------------------------------+--------------
 authenticated | aaaaaaaa-0000-4000-8000-000000000001 |            1

=== P2 second employee (user B) SELECT -> expect 0 ===
 claims_set: {"sub":"bbbbbbbb-0000-4000-8000-000000000002","role":"authenticated"}
    db_role    |              acting_as               | profile_role | rows_visible
---------------+--------------------------------------+--------------+--------------
 authenticated | bbbbbbbb-0000-4000-8000-000000000002 | employee     |            0

=== P3 team lead (A's manager) SELECT -> expect 0 ===
 claims_set: {"sub":"cccccccc-0000-4000-8000-000000000003","role":"authenticated"}
    db_role    |              acting_as               | profile_role | rows_visible
---------------+--------------------------------------+--------------+--------------
 authenticated | cccccccc-0000-4000-8000-000000000003 | team_lead    |            0

=== P4 admin SELECT -> expect 0 ===
 claims_set: {"sub":"dddddddd-0000-4000-8000-000000000004","role":"authenticated"}
    db_role    |              acting_as               | profile_role | rows_visible
---------------+--------------------------------------+--------------+--------------
 authenticated | dddddddd-0000-4000-8000-000000000004 | admin        |            0

=== P5 anon SELECT -> expect permission denied ===
 db_role
---------
 anon
ERROR:  permission denied for table recommendation_picks
HINT:  Grant the required privileges to the current role with: GRANT SELECT ON public.recommendation_picks TO anon;

=== P5b serenify_seeder SELECT -> expect permission denied ===
     db_role
-----------------
 serenify_seeder
ERROR:  permission denied for table recommendation_picks

=== P8 user B UPDATES A's row on a GRANTED column -> expect UPDATE 0 (RLS, not grant) ===
 claims_set: {"sub":"bbbbbbbb-0000-4000-8000-000000000002","role":"authenticated"}
    db_role    |              acting_as
---------------+--------------------------------------
 authenticated | bbbbbbbb-0000-4000-8000-000000000002
UPDATE 0

=== P7 POSITIVE CONTROL: user A UPDATEs the same granted column -> expect UPDATE 1 ===
 claims_set: {"sub":"aaaaaaaa-0000-4000-8000-000000000001","role":"authenticated"}
    db_role    |              acting_as
---------------+--------------------------------------
 authenticated | aaaaaaaa-0000-4000-8000-000000000001
UPDATE 1
```

The grant-refusal and DELETE probes, run as user A under the same impersonation shape
(`SET LOCAL ROLE authenticated` + A's claims). These fail at the **grant** layer, before
RLS is consulted, so `current_user` is the whole identity that matters:

```
=== P6 user A UPDATE item_id (identity column) -> expect permission denied ===
ERROR:  permission denied for table recommendation_picks
HINT:  Grant the required privileges to the current role with: GRANT UPDATE ON public.recommendation_picks TO authenticated;

=== P6b user A UPDATE each remaining identity/provenance column ===
ERROR:  permission denied for table recommendation_picks     -- SET user_id = <B>
ERROR:  permission denied for table recommendation_picks     -- SET local_day = current_date - 1
ERROR:  permission denied for table recommendation_picks     -- SET episode_id = gen_random_uuid()
ERROR:  permission denied for table recommendation_picks     -- SET category = 'movement'
ERROR:  permission denied for table recommendation_picks     -- SET source = 'confirmed'
ERROR:  permission denied for table recommendation_picks     -- SET suggested_at = now()

=== P9 DELETE as user A -> expect permission denied ===
ERROR:  permission denied for table recommendation_picks
HINT:  Grant the required privileges to the current role with: GRANT DELETE ON public.recommendation_picks TO authenticated;

=== P9b DELETE repeated under the team-lead and admin profile identities, then as anon ===
ERROR:  permission denied for table recommendation_picks     -- claims sub = Lead
ERROR:  permission denied for table recommendation_picks     -- claims sub = Admin
ERROR:  permission denied for table recommendation_picks     -- SET LOCAL ROLE anon

=== P10 user A INSERT a row owned by user B -> expect RLS policy violation ===
ERROR:  new row violates row-level security policy for table "recommendation_picks"

=== P11 anon INSERT -> expect permission denied ===
ERROR:  permission denied for table recommendation_picks
HINT:  Grant the required privileges to the current role with: GRANT INSERT ON public.recommendation_picks TO anon;
```

_Live catalogue read-back_ — the posture as the database actually holds it, not as the
migration text claims it. Genuine output of `pg_policy`, `pg_class`, `relacl` and
`information_schema.column_privileges`:

```
--- 1. pg_policy: every policy on the table ---
    polname     | polcmd | permissive |     roles     |               using_expr                |             with_check_expr
----------------+--------+------------+---------------+-----------------------------------------+-----------------------------------------
 rp_insert_self | a      | t          | authenticated |                                         | (( SELECT auth.uid() AS uid) = user_id)
 rp_select_self | r      | t          | authenticated | (( SELECT auth.uid() AS uid) = user_id) |
 rp_update_self | w      | t          | authenticated | (( SELECT auth.uid() AS uid) = user_id) | (( SELECT auth.uid() AS uid) = user_id)

--- 2. pg_class: RLS enabled + forced ---
       relname        | relrowsecurity | relforcerowsecurity
----------------------+----------------+---------------------
 recommendation_picks | t              | t

--- 3. relacl: the raw table ACL ---
         acl_entry
----------------------------
 postgres=arwdDxtm/postgres
 service_role=Dxtm/postgres
 authenticated=ar/postgres

--- 4. column count on the table ---
 total_columns
---------------
            15

--- 5. information_schema.column_privileges, non-owner grantees ---
    grantee    | privilege_type | n_columns | columns
---------------+----------------+-----------+-------------------------------------------------------
 authenticated | INSERT         |        15 | (all 15 columns)
 authenticated | SELECT         |        15 | (all 15 columns)
 authenticated | UPDATE         |         6 | confirmed_at, opened_at, outcome, outcome_at,
               |                |           | swapped_away_at, updated_at
 service_role  | REFERENCES     |        15 | (all 15 columns)

--- 6. anon / PUBLIC anywhere in the ACL? ---
 anon_or_public_acl_entries
----------------------------
                          0
```

(The two `(all 15 columns)` cells and the wrapped UPDATE list are the only edits to
block 5 — the query returned each column name in full. The verbatim list is
`category, confirmed_at, created_at, episode_id, id, item_id, local_day, opened_at,
outcome, outcome_at, source, suggested_at, swapped_away_at, updated_at, user_id`.)

Reading the ACL: three policies exactly, all `TO authenticated`, all permissive, and every
predicate is the bare owner comparison — no `OR`, no second branch. `relrowsecurity` and
`relforcerowsecurity` are both `t`. `authenticated=ar` is INSERT+SELECT only; the
column-scoped UPDATE lives in `pg_attribute.attacl`, which is why it shows in block 5 and
not in `relacl`. Neither `anon` nor a PUBLIC (`=…`) entry appears anywhere (block 6 = 0).

`service_role=Dxtm` is the project's `pg_default_acl` baseline for public tables —
`D`=TRUNCATE, `x`=REFERENCES, `t`=TRIGGER, `m`=MAINTAIN — i.e. no DML. `MAINTAIN` shows in
`relacl` as `m` but has no `information_schema` row, which is why block 5 lists only
`REFERENCES` for that grantee; that asymmetry is expected, not a discrepancy. This
migration grants that role nothing. Factual note only — the wider posture question is not
settled here.

_Verdict per sub-check_:

| # | Sub-check | Expected | Observed | Verdict |
|---|---|---|---|---|
| P1 | owner A SELECT | her row | 1 row, `acting_as` = A | **PASS** |
| P2 | second employee B SELECT | 0 rows | 0, `acting_as` = B (`employee`) | **PASS** |
| P3 | team-lead (A's manager) SELECT | 0 rows | 0, `acting_as` = Lead (`team_lead`) | **PASS** |
| P4 | admin SELECT | 0 rows | 0, `acting_as` = Admin (`admin`) | **PASS** |
| P5 | `anon` SELECT | error | permission denied | **PASS** |
| P5b | `serenify_seeder` SELECT | error | permission denied | **PASS** |
| P6 | A UPDATE `item_id` | fails on grant | permission denied | **PASS** |
| P6b | A UPDATE the other six identity/provenance columns | fails on grant | permission denied ×6 | **PASS** |
| P7 | A UPDATE `opened_at` (positive control) | succeeds | UPDATE 1 | **PASS** |
| P8 | B UPDATE A's row, granted column | 0 rows (RLS) | UPDATE 0, `acting_as` = B | **PASS** |
| P9 | DELETE as `authenticated` (user A) | fails | permission denied | **PASS** |
| P9b | **P9 repeated under the team-lead and admin profile identities**, plus once as `anon` | fails each time | permission denied ×3 | **PASS** |
| P10 | A INSERT a row owned by B | RLS violation | new row violates RLS policy | **PASS** |
| P11 | `anon` INSERT | error | permission denied | **PASS** |

**P9b is not three independent proofs.** `team_lead` and `admin` are `profiles.role`
values, not database roles: all three attempts run under the same DB role as P9
(`authenticated`, differing only in the `sub` claim). Since no DELETE grant exists for
`authenticated` at all, the refusal is identical by construction. The row is kept because
it rules out a policy or grant keyed on the profile identity, not because it adds a
second mechanism.

_Supplementary — constraints and indexes, same session_ (not part of ST-1's check, but
run while the stack was live because the migration's correctness is cheap to prove here):

| # | Attempt | Observed | Verdict |
|---|---|---|---|
| C1 | `outcome` with no `opened_at` | violates `rp_outcome_requires_opened` | **PASS** |
| C2 | `outcome` with no `outcome_at` | violates `rp_outcome_iff_at` | **PASS** |
| C3 | `outcome` **and** `swapped_away_at` | violates `rp_outcome_xor_swap` | **PASS** |
| C4 | `item_id = 'Box Breathing'` | violates `recommendation_picks_item_id_check` | **PASS** |
| C5 | second **active** pick, same user + day | duplicate key on `rp_one_active_per_user_day` | **PASS** |
| C6 | same, after the first is swapped away | `INSERT 0 1` — the index is correctly partial | **PASS** |
| C7 | UPDATE bumps `updated_at` | `updated_at > created_at` → `t` | **PASS** |

_Caveats, recorded rather than smoothed over_:

- **Locally, `postgres` is a superuser and bypasses RLS regardless of FORCE.** On the
  hosted project `postgres` is a non-superuser table owner, where FORCE is what binds it.
  So a `postgres` probe returning rows on this local stack is expected and is **not** a
  posture break — which is exactly why every posture probe above runs under `SET LOCAL
  ROLE authenticated` / `anon` / `serenify_seeder`, never as `postgres`.
- `local_day` was written from the container's **UTC** `current_date` (2026-08-14) while
  the host's local date was 2026-08-15. Immaterial — in production `local_day` is
  client-supplied from the today-card boundary, never `current_date`.
- psql interleaves stdout and stderr, so a few `ROLLBACK` lines printed before their
  `ERROR` in the raw capture. Statement-to-outcome mapping above follows the `\echo`
  markers and is unaffected.
- Impersonation is `SET LOCAL ROLE` + `request.jwt.claims`, not a real PostgREST request
  with a signed JWT. That is the feature-012 validated method and exercises the same RLS
  and grant machinery, but it does not cover PostgREST's own request handling.
- Fixtures were removed afterwards (`DELETE FROM auth.users WHERE email LIKE
  'probe-%@example.test'` → `DELETE 4`); the pick row disappeared with them, which
  incidentally confirms the `ON DELETE CASCADE` from `auth.users`. The local DB is back to
  a clean post-reset state — `picks_left 0 | profiles_left 0 | users_left 0`.

---

## ST-2 — SC-005: "Yes, that's me" resolves to the pick, in-session and at home

**Check**: drive a real monitoring session to sustained Tense on a real camera; answer
"Yes, that's me". The prompt resolves to the recommendation, **not** a Ren handoff; the
`ConfirmedPickCard` is reachable in-session with **no navigation** (FR-011), in the
`Notification` slot the prompt occupied; the home card then shows the **identical pick,
identical words**, rendered prominently (state 4, the mock's five moves — US2
scenarios 1–2).

**Method**: real device, real camera, local stack (or the deployed stack). Compare the
in-session card's title/why-line/duration against the home card's, word for word.

**Observations / Verdict**: **PASS** — run 2026-08-25, Mohamed on the laptop (Acer
built-in camera, Chrome, local stack, throwaway local account), agent driving the page
through Claude-in-Chrome and reading the DB as `postgres` for the record checks.
Mohamed's attestation covers what he saw on screen; the agent's method covers the rows.
- Sustained Tense landed at 05:38 into the session; the 012 prompt showed 12:46:48 UTC;
  Mohamed answered "Yes, that's me" at 12:46:51 (prompt row `lifecycle=answered`,
  `outcome=confirmed`). URL stayed `/app/monitor` — no navigation, no Ren handoff.
- The `ConfirmedPickCard` appeared in the `Notification` slot the prompt had occupied:
  header "Things that might help", line "You said that's how it feels. Here's one small
  thing.", item **Box breathing · 2 min** with its why-line, Show me / Pause / Dismiss.
- One `recommendation_picks` row, inserted at 12:46:51 with `source=confirmed`,
  `confirmed_at` = the answer time, `item_id=box-breathing`, `local_day=2026-08-25`;
  Show me stamped `opened_at` (12:46:56); closing the steps showed "Did that help?"
  (left unanswered on purpose — ST-4's precondition). Budget 1/3 for the episode.
- Card **Pause** → page "Paused — taking a break", one `PATCH` 200, the card's control
  flipped to Resume; **Resume** → "Getting a read on things" (the T037 warm-up).
- **End session** → home: state 4, prominent — identical header line, item title,
  why-line and *opened* chip, plus Show me / Something else / Talk to Ren about this.
  (No "Did that help?" on the fresh mount: state 6 is mount-local by FR-016 — asked
  once after the steps close; the home card re-offers the steps. By design.)
- Observation, not a failure (logged as a follow-up, see PROGRESS): with the steps
  expanded, the in-session card is taller than a 726 px-tall viewport and the header
  clips at the top; Mohamed asked for a wider card so the steps wrap less. The title
  "Box breathing" also wraps to two lines beside the *opened* chip at `w-80`.
- Not a 014 finding: getting a *sustained* Tense read on demand is hard — only the
  first ~90 s of the session scored ≥ 0.67; later attempts sat at 0.30–0.62. That is
  the 008 model, not the resolution path.

---

## ST-3 — 012's other two answers are untouched on the real surface

**Check**: on the live confirmatory prompt, "No, I'm okay" behaves exactly as 012
shipped it (false-alarm path, next-session suppression) and "Maybe — talk about it"
still opens Ren (`confirmatory_maybe`), including D-6 dwell feel and the
explicit-answer-only budget (FR-012, SC-006's live half — the pinned suites cover the
reducers; this covers the surface).

**Method**: same live session setup as ST-2, one run per answer path.

**Observations / Verdict**: **PASS** — run 2026-08-27/28 on the local stack, agent-driven
through Claude-in-Chrome on the calibrated throwaway account `st5-live`, Mohamed supplying
the facial expression on cue; the agent read the DB as `postgres` for the record checks.
**Test-harness note, stated plainly**: reaching a live confirmatory prompt needs a
*sustained* tense/uneasy read, which was impractical to hold for the shipped 20 s (tense) /
60 s (uneasy) sustain windows. So `apps/web/lib/questionnaire/constants.ts` timers were
**temporarily lowered** (tense-sustain 20 s→5 s, mild-sustain 60 s→12 s, prompt min-dwell
4.5 s→15 s) to make the prompt fire and linger long enough to answer, and **reverted to the
ship values before any commit** (verified: the #127/#130/#132/#134 pinned reducer suites +
monitor suites, 282 tests, pass on the restored constants). These are injected config
values — the 012 pure reducers were NOT touched. The sustain *timing* is therefore
reducer-pinned, not what this live run measured; the run measured the answer **surfaces**.
- **"No, I'm okay"** (mild prompt, 20:49): prompt row `lifecycle=answered, outcome=false_alarm`;
  the page returned to the calm reading with **no card**; no pick was confirmed
  (`confirmed_at` stayed NULL on the day's engine-surfaced pick).
- **Next-session suppression**: the very next session (same account) held a genuine
  sustained tense/uneasy run for ~40 s (20:53:28→20:54:08, up to band=tense 0.77) — long
  past every lowered threshold — and produced **zero** confirmatory-prompt rows. The prior
  false alarm suppressed the prompt for the following session, exactly as 012 specifies.
- **"Maybe — talk about it"** (mild prompt, 20:57): navigated to
  `/app/chat?handoff=confirmatory_maybe`, Ren opened with a gentle pre-filled draft, prompt
  row `outcome=opened_chat`, and **no recommendation card** was created
  (`CONFIRMATORY_HANDOFF_SHOWS_RECOMMENDATIONS` stays false).

---

## ST-4 — FR-014: a new confirmed detection beats a pending outcome prompt

**Check**: with an outcome prompt pending on the home card, a new confirmed detection
removes the stale prompt **without recording an answer** and the confirmed pick takes
over (in-session and at home). If the prior episode had closed on an outcome, the new
episode has a fresh budget.

**Method**: live session; needs the timing to be engineered (answer nothing on the
outcome prompt, then drive a second sustained-Tense confirmation). Verify no `outcome`
was written for the abandoned prompt's pick row (owner query).

**Observations / Verdict**: **PASS** — run 2026-08-28 (00:0x local, `st5-live`), same
lowered-then-reverted timer note as ST-3. Staged across two sessions:
- **Set-up**: session 1 — "Yes, that's me" → a confirmed pick landed
  (`source=confirmed`, `confirmed_at=21:07:17`, episode `ffe66642`); the in-session
  ConfirmedPickCard **Show me** → **Close** recorded `opened_at=21:08:11` and left the
  "Did that help?" question **pending, unanswered**. Session ended with the pick in the
  opened/outcome-NULL (pending) state.
- **The FR-014 event**: session 2 — a second "Yes, that's me" (new confirmed detection)
  at 21:13:19. Owner query on the pick row immediately after:
  `confirmed_at` re-stamped 21:07:17 → **21:13:19**, `opened_at` **unchanged** (21:08:11),
  **`outcome` still NULL** (no answer written), **same episode** `ffe66642`, and **exactly
  one row** for the day (attached in place — Ruling C — never a second row). In-session the
  ConfirmedPickCard took the notification slot back prominently (the "opened" pick), no
  outcome question, no error surface. This is FR-014 exactly: a new confirmed detection
  while an outcome prompt is pending removes the stale prompt **without recording an
  answer** and the confirmed pick takes over.
- **Incidental finding (not a defect, logged as an observation)**: the first ST-4 "Yes"
  attempt landed within a second of the local-day rollover (00:00 Africa/Cairo). The
  resolution computed the *new* day, which had no established pick and too few readings to
  warrant one, so it surfaced nothing — no card, no row, no error (FR-030 held). Correct
  behaviour at an unlucky instant, not a bug; logged as a BACKLOG observation (#TBD, to
  open in PR prep) for a one-line guard consideration.

---

## ST-5 — Reflective copy against the real provider, and its collapse

**Check**: with apps/api up and a real `GROQ_API_KEY_REFLECTIVE_COPY` (the second Groq
credential — Amendment 3, 2026-08-16; Ren's `GROQ_API_KEY` alone must NOT make copy
generate), a state-2 (or state-9) reflective
line generates, passes validation, and **paints exactly once** — cache hit on re-render,
no flip under the reader; every fact in it (counts, times, bands) appears in the
precomputed facts. Then with the provider down (kill apps/api or unset the key), the
deterministic fallback renders inside the budget and **nothing on the surface reads as
an error** (FR-021, FR-030, SC-004's live half).

**Method**: agent-run or attested; observe the 800 ms skeleton behaviour on a cold
cache, then reload (cache hit — instant), then kill the provider and force a state
change.

**Observations / Verdict**: **PASS** — run 2026-08-25 on the local stack, agent-run
through Claude-in-Chrome (page text, `sessionStorage`, resource timing, the API log)
on a second throwaway local account seeded with one ended session and three Calm
readings today (card state 2; fallback "Calm at your one check-in today, at 2:35.").
Mohamed placed `GROQ_API_KEY_REFLECTIVE_COPY` in `apps/api/.env`.
- **Ren's key alone does not generate**: the API process launched before the second key
  existed (it had `GROQ_API_KEY` only) answered `POST /recommendations/reflective-copy`
  **502**; the card painted the deterministic line, nothing on the surface read as an
  error, and the failure was not cached (`sessionStorage` empty).
- **Generates with the second key**: after a restart, the first request 502'd once
  (transient — the surface again showed the fallback cleanly; the reason is in the
  telemetry `extra`, which the default log formatter does not print, so it was not
  captured), every request after that was **200**. Three generated lines were seen
  across loads: "One check-in today was Calm, at 2:35." / "Your single check-in today
  at 2:35 was Calm." / "Your single check-in today was Calm, at 2:35." — each contains
  only the supplied facts (1 check-in, 2:35, Calm), no exclamation, and passed the
  client validator. A direct in-process call to `generate_reflective_copy` returned in
  0.9–1.9 s over three tries.
- **Cache hit paints with no request**: reload with the fingerprint cached
  (`serenify.014.reflective-copy.v1:[2,1,["2:35"],["Calm"],null,null,"2026-08-25"]`)
  made **no** reflective-copy request; the cached line painted.
- **Cold miss, no flip**: cache cleared, reload → the request took **744 ms** (resource
  timing), inside the 800 ms skeleton window, so the generated line was the first
  paint. The `settled` guard (`things-that-might-help-card.tsx` ≈ lines 408–439) is what
  forbids a later flip; the visible sub-second window is beyond what the scripting hook
  can observe, so that part rests on the unit tests plus Mohamed's attestation below.
- **Provider down**: API process stopped, cache cleared, reload → request failed
  (≈2.0 s), the card painted the deterministic line; the only error text on the page was
  the Recent-chats card's "Your chats didn't load just now… Try again" — 011's chat
  list, not this card.
- Mohamed's attestation (watching a cold-miss reload, re-run 2026-08-26 local, request
  **505 ms**): he did not see a placeholder line — what he saw before the state-2 content
  was the card's **state 1** ("Nothing from today yet… Start check-in"), i.e. the
  pre-first-read shape at `things-that-might-help-card.tsx:824–834`, and then state 2
  with its line already in place; no rewording after that. So the reflective skeleton
  was never the first thing on screen: the reads-in-flight state 1 covered that window.
  **Observation, referred to Mohamed (queue item 8, not decided here)**: that state 1 is
  a definitive empty state painted before the read resolves — the same shape as #201
  (Recent chats, ruled a bug 2026-07-28, fixed PR #240) — and it also offers "Start
  check-in" to someone who already has readings today. Deliberate in the code comment;
  contradicts the #201 precedent. **Ruled the same session (option a) and fixed**: the
  pre-read shape now holds the lead skeleton with no claim and no action
  (`docs/DECISIONS.md` 2026-08-26). Re-run with the fix, cache cleared, request 775 ms:
  Mohamed attested "a skeleton, then the text showed about the reading" — no state-1
  detour, one paint, no rewording.

---

## ST-6 — The rendered card at 360 px, dark mode, and reduced motion

**Check**: the card's states — at minimum 3, 4, 5, and the retirement line — hold the
approved mock's layout at a **360 px** viewport (the mock's wrap point), in **both**
palettes, with 44 px touch targets; under `prefers-reduced-motion` the result ring and
skeleton are static and state transitions do not animate. No crimson, no exclamation
marks, no band chip on the card (Principle V / VI, plan §UI design contract).

**Method**: real device or devtools emulation across the states; Mohamed's eye on the
mock fidelity is the verdict that counts (attestation — and says so).

**Observations / Verdict**: _not run yet._
