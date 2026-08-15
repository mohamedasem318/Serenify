# Tasks: Recommendations — "Things that might help" (014)

**Branch**: `014-recommendations` | **Date**: 2026-08-15 | **Plan**: [plan.md](./plan.md) | **Spec**: [spec.md](./spec.md)

**Input**: plan.md, spec.md, research.md (R-1…R-10), data-model.md, quickstart.md,
contracts/{recommendation-storage-rls, reflective-copy, confirmatory-resolution,
selection-engine}.md. Behaviour reference: the approved mock
`docs/mockups/serenify-014-things-that-might-help-mock.html` (gitignored — grep with
`--no-ignore`; its item copy is placeholder).

**Tests are tasks, not an afterthought** (Principle VII). Every task below names its
acceptance as observable behaviour or a passing test.

## Format & markers

```text
- [ ] [TaskID] [P?] [Story?] Description with exact file path(s)
```

- **[P]** — parallelisable: disjoint files, no dependency on an incomplete task.
- **[US1–US4]** — spec user story (US1/US2 = P1, US3 = P2, US4 = P3). Foundational and
  wrap tasks carry no story label.
- **[LIVE]** — needs a live environment (running local Supabase, real camera, real
  provider key, or a real device). Where CI cannot verify the task, the task says so and
  points at its [smoke-tests.md](./smoke-tests.md) entry; completion may not be claimed
  from unit tests alone.
- **[GATE: Mohamed]** — a blocking human decision or review. **The implementer cannot
  tick it.** It is complete only when Mohamed's approval is recorded on the PR/branch.

**Hallmark note (binding on every task that renders UI — T012–T016, T018–T020, T026,
T027, T029)**: these tasks are governed by the plan's **UI design contract (Hallmark)**
section — tokens by name only, the 8-state control discipline with error/success
deliberately absent, state-4 prominence exactly the mock's five moves, `ConfirmedPickCard`
inside the `Notification` geometry, motion only as listed and under
`prefers-reduced-motion`. The approved mock is the **binding behaviour reference**;
where this file and the mock disagree on behaviour, the mock (as reconciled by
spec FR-029–FR-031) governs.

---

## Phase 1: Schema and its proof (blocking — nothing may read or write the table before this phase is done)

**Purpose**: `recommendation_picks` exists and its owner-only posture is *proven*, not
assumed (spec SC-003, contracts/recommendation-storage-rls.md).

- [X] T001 Migration `supabase/migrations/20260815090000_recommendation_picks.sql`: full
      data-model §2 shape — columns, the three CHECKs (`rp_outcome_iff_at`,
      `rp_outcome_requires_opened`, `rp_outcome_xor_swap`), `rp_user_day_idx`, partial
      unique `rp_one_active_per_user_day`, `touch_updated_at` trigger, ENABLE+FORCE RLS,
      exactly three owner policies (SELECT / INSERT / UPDATE, `(select auth.uid()) =
      user_id`), `REVOKE ALL FROM anon, authenticated` then table-wide `SELECT, INSERT`
      and **column-scoped** `UPDATE (confirmed_at, opened_at, outcome, outcome_at,
      swapped_away_at, updated_at)` to `authenticated`. No DELETE policy, no
      manager/admin/team-lead/aggregate/`service_role`/`serenify_seeder` grant or policy
      of any kind (contract §5–6). **Acceptance**: `supabase db reset --local` applies
      cleanly; the existing migration-audit pytest suite stays green.
- [X] T002 Static RLS gate `apps/api/tests/test_recommendation_storage_rls.py` (the
      `test_chat_storage_rls.py` pattern): pins every contract invariant — FORCE RLS,
      exactly three owner policies, no DELETE/service-role/seeder path, no SECURITY
      DEFINER touching the table, the column-scoped UPDATE grant list verbatim.
      **Acceptance**: `uv run pytest` green; deleting any posture line from the migration
      makes a named assertion fail.
- [X] T003 [LIVE] Live RLS probe against local Supabase (the feature-012 `SET LOCAL ROLE`
      + `request.jwt.claims` psql method): owner reads own rows; a second user, a
      team-lead, and an admin each read **zero** rows; `anon` errors; UPDATE on an
      identity column (`item_id`) fails on grant. **Acceptance**: probe transcript
      recorded in [smoke-tests.md](./smoke-tests.md) **ST-1** and cited in the PR. Runs
      against a local stack, not in CI — CI covers only the static gate (T002).

**Checkpoint**: table exists, posture proven. Only now may any task write to it.

---

## Phase 2: Library and strings — authored, then gated (blocking for all UI wiring)

**Purpose**: the fifteen real items and every deterministic string exist and are approved
**before** any surface is built against them (plan §Library authoring; spec FR-004,
SC-008). No placeholder copy may survive to the PR.

- [X] T004 Author the library and the deterministic strings in
      `apps/web/lib/recommendations/library.ts`: the `RecommendationCategory` /
      `LibraryItem` types (data-model §1), then **fifteen real items** — three per
      category across `breathing_grounding`, `movement`, `sensory_reset`,
      `taking_a_break`, `connection` — each with `id` (slug matching the DB CHECK regex),
      `title`, `whyLine`, `durationLabel`, `steps[]`, optional `footNote`. In the same
      pass, author the deterministic reflective fallback strings for states 2 and 9 and
      the card's fixed strings (state-1 line, acknowledgement word used identically by
      states 7/8, the swap-retirement honest line, the state-8 no-replacement line) as
      exported constants beside the library. All copy obeys FR-007/FR-008/FR-009 and the
      FR-028 voice rules. Declared category order and item order are part of the
      deterministic contract (R-10) — order deliberately, not alphabetically.
      **Acceptance**: module typechecks; T006's structural guard passes; content itself
      is accepted only by T005.
- [X] T005 [GATE: Mohamed] **Line-by-line review of every item and string from T004.**
      APPROVED by Mohamed 2026-08-16, after the T005 follow-up amendments he directed
      (honest duration pills, breath-hold opt-out into step 3, one title rename —
      commits `3ee3315`, `b5faee6`).
      Checklist per item, each point checked explicitly: no physical discomfort as a
      coping technique (no ice, no cold shock, no snapping, no pain — FR-008); no
      substances including caffeine (FR-008); nothing clinical, outcome-claiming, or
      requiring leaving the workplace (FR-009); nothing touching crisis territory
      (FR-007); calm-first voice (FR-028). **This is a blocking human review, not a
      checkbox** — the implementer cannot tick it; an unreviewed library is treated as
      placeholder and the PR cannot merge with it. **Acceptance**: Mohamed's approval
      recorded on the PR/branch (SC-008: zero shipped items in violation).
- [X] T006 [P] Structural library guard
      `apps/web/tests/unit/lib/recommendations/library.test.ts`: exactly the five fixed
      categories, ≥3 items each (15 in v1), unique slugs matching
      `^[a-z0-9-]{1,64}$`, non-empty title/whyLine/durationLabel/steps, **no placeholder
      tokens, no exclamation marks anywhere** in library or deterministic strings.
      **Acceptance**: Vitest green; introducing a placeholder token, a `!`, or a sixth
      category makes it fail. (This guards structure and voice mechanics; content safety
      is T005's human gate, not this test's claim.)

**Checkpoint**: real, reviewed strings exist. UI tasks build against them, never
placeholders.

---

## Phase 3: Deterministic core (blocking for all UI wiring)

**Purpose**: engine, episode/budget reducer, preference seam, and the write client —
pure, table-driven-tested **before** any component consumes them (plan Risk 3).

- [X] T007 [P] `apps/web/lib/recommendations/preference-source.ts`: `PreferenceSource`
      type + `neutralPreferenceSource` (constant affinity, R-8). **Acceptance**: consumed
      by T008; the seam test there proves a fake non-neutral source changes ranking with
      zero engine edits (FR-006).
- [X] T008 `apps/web/lib/recommendations/engine.ts` per contracts/selection-engine.md —
      pure `selectPick`, injected `nowMs`, no randomness, rules in contract order
      (warrant → budget → non-repeat → category ranking with the data-table of band
      tenor × time-of-day × affinity, stable tiebreak by declared order → first eligible
      item, category fall-through). Tests
      `apps/web/tests/unit/lib/recommendations/engine.test.ts`: determinism property —
      repeated calls with frozen inputs are identical across all ten states' input
      shapes (SC-001, SC-002 reachability); budget/non-repeat interaction; the
      preference-seam proof. **Acceptance**: suite green; the determinism property holds
      in 100% of runs.
- [X] T009 `apps/web/lib/recommendations/episode.ts` — episode/budget/non-repeat reducer
      + `local_day` filtering, driving all ten states from `(today's picks, today's
      bands, in-flight UI events)`. Table-driven tests
      `apps/web/tests/unit/lib/recommendations/episode.test.ts` whose fixture list is
      the FR-018 paragraph, **at minimum**: mid-episode confirmation (same pick, same
      remaining budget, prominence 3→4 only); state-8 replacement draws on the shared
      three-pick budget; **state-8 no-replacement variant** (budget spent, and
      separately non-repeat leaves nothing eligible); **non-repeat beats the budget**
      (swap retires early); **FR-014 interruption** (new confirmed detection removes a
      pending outcome prompt without writing; new episode iff the prior one was closed
      by an outcome); day-boundary reset of everything (FR-019); a continuously elevated
      stretch is one episode; state-9 re-arm = new episode with fresh budget; ignored
      outcome prompt records nothing. **Acceptance**: every named fixture is present and
      green; no eleventh state and no error state is derivable (SC-002, FR-030).
- [X] T010 `apps/web/lib/api/recommendations-client.ts` (pick-write half): typed
      owner-RLS writes per the contract's write-path table — INSERT full row on surface;
      UPDATE `confirmed_at` on attach; UPDATE `opened_at` set-once (client guards
      re-set); UPDATE `outcome`+`outcome_at` with **retry exactly once** then silent
      degrade; UPDATE `swapped_away_at` with **no retry**, silent degrade; ignored
      prompt writes nothing. **Swap ordering is RULED (Ruling B, 2026-08-15) and forced
      by the schema**: `rp_one_active_per_user_day` is a partial unique index and the two
      writes are separate PostgREST requests with no transaction, so insert-first would
      collide with the still-active outgoing row. Stamp `swapped_away_at` **first**, then
      INSERT the replacement; if the INSERT fails, re-run the engine **once** to refresh
      the card; if that also fails, keep the previous pick and stop — no retry loop, no
      error surface; the stamp is **never reversed**; a failed swap **does NOT consume a
      budget slot** (Amendment 2026-08-16, reversing the 2026-08-15 position — a person
      must not lose a suggestion because a write failed on our side). Consequence for the
      reducer: budget consumption counts **replacement rows that actually landed**
      (surfaced picks), never stamps — stamp count alone can no longer derive it. Tests
      `apps/web/tests/unit/lib/recommendations-client.test.ts` (the
      `monitoring-client.test.ts` pattern) with an injected failing writer.
      **Acceptance**: exactly one retry observed for outcome, zero for swap; the stamp is
      observed to precede the INSERT and is never reversed; a failed replacement INSERT
      triggers exactly one engine re-run and no further write; no code path surfaces an
      error (FR-030); requires Phase 1 complete.

**Checkpoint**: the whole decision core is proven pure and deterministic. UI wiring may
begin.

---

## Phase 4: User Story 1 — a pick when the day turns tense (P1) 🎯 MVP

**Goal**: the suggest → engage → outcome loop on the home card (states 3, 5, 6, 7, 8 +
no-replacement variant, 9).

**Independent test**: seed a day with Uneasy/Tense readings, render home, open the pick,
close, answer each way — complete cycle, records owner-only.

- [X] T011 [US1] `apps/web/components/recommendations/pick-item.tsx` — the one shared
      item block (tile, title, duration pill, why-line, steps, foot-note) rendered from
      a pick row + its library entry; used by both the home card and
      `ConfirmedPickCard` so "same pick, same words" holds by construction (plan Risk 4).
      Hallmark-governed; mock binding. **Acceptance**: RTL test renders a real T004 item
      with title/steps **verbatim** (FR-004) and no band chip.
- [X] T012 [US1] `apps/web/components/recommendations/recommendation-card-states.tsx` —
      presentational shells for the ten states exactly as the mock draws them, including
      the state-8 no-replacement variant; states 7/8 reuse `QuestionnaireResultIcon` and
      its D-6 dwell timing (FR-029); result-ring motion collapses under
      `prefers-reduced-motion`; identical acknowledgement word in 7 and 8. Hallmark
      -governed; mock binding. **Acceptance**: T014's coverage suite reaches all ten
      states + the variant; no error/success control states exist (documented
      deviation-by-design).
- [X] T013 [US1] Wire `apps/web/components/home/things-that-might-help-card.tsx`
      (placeholder → stateful): reads today's picks + bands through the existing
      owner-RLS reads (`monitoring-reads.ts` pattern, `localDayWindow` day semantics),
      T009 reducer drives state, T008 engine picks, T010 client writes; deps injectable
      for tests. Quiet updates on Uneasy/Tense — never an interruption (FR-013); outcome
      prompt only after open **and** close, never over open instructions
      (FR-016/FR-031); ignoring it writes nothing and costs nothing. Hallmark-governed;
      mock binding. **Acceptance**: T014 green; day-boundary reset falls out of
      query-time `local_day` filtering with nothing stored to clear (FR-019).
- [X] T014 [US1] State-coverage + signal suite
      `apps/web/tests/unit/components/home/things-that-might-help-card.test.tsx`: all
      ten states reachable, no eleventh (SC-002); US1 acceptance scenarios 1–6; helped /
      didn't-help stored distinctly and ignore stores nothing (SC-007, card level);
      failed writes render no error and degrade per FR-030. **Acceptance**: suite green
      with `--pool=threads` on Windows.
- [X] T015 [US1] [LIVE] e2e `apps/web/tests/e2e/recommendations-loop.spec.ts`: seed
      Uneasy/Tense `window_readings` for today via the existing e2e seeding path
      (`serenify_seeder`), then home shows exactly one quiet pick → open → instructions
      verbatim → close → outcome each way → state 9. No camera needed, so this **does**
      run in CI; locally requires local Supabase + a dev server (kill port 3000 between
      suites — reuseExistingServer poisons later runs). **Acceptance**: spec passes in
      CI.

**Checkpoint**: US1 delivers the MVP loop end to end.

---

## Phase 5: User Story 2 — a confirmed detection resolves to the pick (P1)

**Goal**: "Yes, that's me" resolves to the recommendation — in-session card + home
state 4 — with 012 behaviour otherwise untouched (highest-regression area, plan Risk 1).

**Independent test**: sustained Tense → "Yes, that's me" → pick reachable in-session
without navigation → home shows the identical pick prominently; other two answers
regression-tested.

- [ ] T016 [US2] **The 012 coordinator change — its own task, this file only**:
      `apps/web/lib/questionnaire/confirmatory-trigger.ts` dep swap per
      contracts/confirmatory-resolution.md — `onConfirm` still calls
      `finalize({answered, confirmed})` first, then a new `resolveToRecommendation()`
      dep instead of `openRen("confirmatory_yes")`; `openRen` remains for
      `confirmatory_maybe`; the pure reducers (`reduceOutcome`, `reduceDwellElapsed`,
      `markResolvedConsumingBudget`, `markResolvedRearm`) are **not edited**.
      **Acceptance is regression evidence, not a claim of care**: `git diff` shows zero
      edits to the reducers; the pinned #127/#130/#132/#134 guarantee suites — including
      `apps/web/tests/unit/lib/questionnaire/confirmatory-trigger.test.ts` — pass
      **byte-for-byte unmodified** (SC-006); new wiring tests added beside them prove
      confirm → `resolveToRecommendation`, maybe → `openRen`, false-alarm path +
      suppression untouched.
- [X] T017 [US2] `apps/web/components/recommendations/confirmed-pick-card.tsx` through
      the shared `Notification` primitive in the confirmatory prompt's slot (desktop
      `w-80` corner card, mobile bottom sheet, `--chat-pill-offset` stacking) —
      dismissible, non-modal; renders the pick via T011's `pick-item.tsx`; expanding
      instructions records `opened_at`; the inline outcome question appears only after
      instructions close (asked once, ignorable at no cost); **dismissing writes
      nothing** — neither swap nor outcome. Hallmark-governed; mock + R-6 binding.
      **Acceptance**: RTL tests in
      `apps/web/tests/unit/components/monitor/confirmed-pick-card.test.tsx` pin the
      open-write, the outcome-write rules, and dismiss-writes-nothing.
- [ ] T018 [US2] Host wiring in `apps/web/components/monitor/monitoring-session.tsx`:
      implement `resolveToRecommendation` — active pick today → UPDATE `confirmed_at`
      (same episode, same budget, prominence only); none → run the engine, INSERT with
      `source='confirmed'` (+`confirmed_at`), new episode with fresh budget iff the
      prior one closed on an outcome; mount `ConfirmedPickCard` in-session, no
      navigation (FR-011); FR-014 — a new confirmed detection removes a pending outcome
      prompt **without writing**; the monitor stops producing `confirmatory_yes` while
      the handoff seam stays tolerant of stale URLs
      (`CONFIRMATORY_HANDOFF_SHOWS_RECOMMENDATIONS` remains `false`). **Acceptance**:
      host-level tests cover attach-vs-insert, the FR-014 interruption, and
      seam tolerance; existing monitor suites stay green (the file is large — plan
      Risk 1 names host-wiring races; the FR-014 fixtures from T009 are re-exercised
      here at host level).
- [X] T019 [US2] Home state 4 in the T013 card: a confirmed active pick renders
      prominently with exactly the mock's five moves (amber rail, tint wash, warm tile,
      17→19 px title, meadow-filled primary — the only filled CTA outside state 4's
      absence elsewhere), same pick, same words as the monitor surface. Hallmark
      -governed; mock binding. **Acceptance**: RTL test renders home card and
      `ConfirmedPickCard` from the **same pick row** and asserts identical strings (US2
      scenario 2); no crimson, no exclamation marks.
- [ ] T020 [US2] [LIVE] SC-005 end-to-end proof — **not CI-verifiable**: driving
      sustained Tense needs a real camera (Playwright's fake-camera flags do not engage
      in this repo), so this runs as a live smoke check, recorded in
      [smoke-tests.md](./smoke-tests.md) **ST-2/ST-3/ST-4** before merge: "Yes, that's
      me" → pick reachable in-session without navigation → home shows the identical
      pick; "No, I'm okay" and "Maybe — talk about it" behave exactly as 012 shipped
      them; FR-014 observed live. **Acceptance**: the three smoke entries recorded with
      method + observations.

**Checkpoint**: both P1 stories complete; 012 regression net green and unchanged.

---

## Phase 6: User Story 3 — honest reflection on calm and empty days (P2)

**Goal**: states 1, 2, 9 with generated-but-validated reflective copy over the already
-reviewed deterministic strings (authored in Phase 2 — generation is a layer over
something correct and shippable on its own).

**Independent test**: render with (a) no readings today, (b) an all-Calm day with
specifics, (c) an all-Calm day with no true specific line, (d) the provider down — each
renders the required shape with zero fabricated facts.

- [ ] T021 [P] [US3] `apps/web/lib/recommendations/reflective-copy-validation.ts` —
      pure `validateReflectiveCopy(text, facts)` per contracts/reflective-copy.md
      §Validation: every maximal digit run, every time-shaped token, every band word
      must appear in the facts; no exclamation marks; no forbidden vocabulary (`alert`,
      `abnormal`, `elevated risk`, `detected`); ≤220 chars, non-empty. Tests
      `apps/web/tests/unit/lib/recommendations/reflective-copy-validation.test.ts`
      against fabricated-number / fabricated-time / fabricated-band / exclamation /
      oversized / empty outputs. **Acceptance**: SC-004's zero-fabrication clause —
      every fabrication fixture is rejected, valid rephrasings pass.
- [ ] T022 [P] [US3] `apps/web/lib/recommendations/reflective-copy-cache.ts` —
      sessionStorage keyed by a fingerprint of `(state, facts minus fallbackText,
      local_day)`; only **validated** text is ever cached; nothing persists to the DB.
      Tests: same fingerprint → reuse without regeneration (FR-022); day change →
      new key (FR-019 for free). **Acceptance**: suite green.
- [ ] T023 [P] [US3] Prompt registration:
      `packages/llm-client/prompts/reflective_copy.txt` (versioned; variables = the
      `ReflectiveFacts` fields, rendered by `render_prompt` literal replacement;
      instructs JSON `{"text": string}` re-phrasing of the fallback, nothing added) +
      register in the closed `PromptId` literal and `PROMPT_IDS` in
      `packages/llm-client/src/llm_client/prompts.py`. **Acceptance**:
      `packages/llm-client/tests/test_prompts.py` extensions green — the id renders, the
      closed-set check passes, unregistered ids still fail.
- [ ] T024 [US3] apps/api endpoint: `apps/api/app/services/reflective_copy.py` +
      `apps/api/app/routers/recommendations.py` — `POST
      /recommendations/reflective-copy`, forwarded-JWT auth (`/chat/*` pattern), body =
      the `ReflectiveFacts` bundle and nothing else, **no DB reads of any kind**
      (FR-020/FR-023). **Second credential (Amendment 3, 2026-08-16)**: the endpoint
      calls a NEW additive accessor `get_reflective_copy_llm_client()` in
      `apps/api/app/services/llm_client.py` — same provider (FR-024 stands), primary key
      rebuilt from `GROQ_API_KEY_REFLECTIVE_COPY` (`os.environ.get(...) or None`, never
      `GROQ_API_KEY`, no default-key parameter), **no fallback provider** on this path;
      Ren's `get_llm_client()` and `packages/llm-client` are byte-untouched; add the
      documented block to `apps/api/.env.example`. Absent/invalid key → provider raises
      at request time → non-200; `response_format="json_object"` parsed with
      `extract_json_object`; missing or non-string `text` → non-200 + validation
      telemetry; the endpoint never falls back itself. Tests
      `apps/api/tests/test_recommendations_reflective_copy.py`: auth required,
      facts-only input surface, parse-failure → non-200, provider error → non-200,
      **credential isolation** — with `GROQ_API_KEY` set and the reflective key absent,
      the endpoint returns non-200 and Ren's key is never read by this path.
      **Acceptance**: pytest green; no test requires a real key.
- [ ] T025 [US3] Client fetch (extend `apps/web/lib/api/recommendations-client.ts`) +
      first-paint orchestration in the home card per contracts/reflective-copy.md
      §First paint: cache hit paints immediately; cache miss shows the **800 ms**
      skeleton line (shimmer in the line's slot only, static under
      `prefers-reduced-motion`, `aria-busy`); a validated result inside the budget is
      the first and only paint; on expiry the deterministic string paints **and
      stands** — a late validated result goes to the cache only; background budget
      ≈3.5 s with the request timeout below it. Fake-timer Vitest per the contract's
      test list (drive with `act` + `advanceTimersByTimeAsync`, assert synchronously —
      RTL `waitFor` deadlocks on Vitest fake timers). **Acceptance**: the three
      first-paint tests green: cache-hit-skips-skeleton, in-budget-paints-once,
      late-result-never-replaces-painted-fallback.
- [ ] T026 [US3] States 1/2/9 in the T013 card: state 1 names the cause (no check-in
      yet) and offers a check-in; state 2 = specific true line (real counts, real
      times) + one forward-looking line, **no action**, and when no true specific line
      is derivable it falls back to state 1's **shape**, never a generic affirmation;
      state 9 rests without pushing another pick, never claims the day is over, and
      re-arms on a qualifying reading. Facts computed in advance in the card
      (counts, preformatted times, band display labels, tried-item title) — never raw
      readings. Hallmark-governed; mock binding. **Acceptance**: RTL tests for US3
      scenarios (a)–(d) — provider disabled renders the fallback in 100% of cases and
      the card never blocks (SC-004).
- [ ] T027 [US3] [LIVE] Real-provider generation check — **not CI-verifiable** (needs
      apps/api up with a real `GROQ_API_KEY_REFLECTIVE_COPY` — the second credential,
      Amendment 3; Ren's `GROQ_API_KEY` alone must NOT make copy generate): a generated
      line validates and paints once; killing the provider mid-day degrades to fallback
      with no error surface. **Acceptance**: recorded in
      [smoke-tests.md](./smoke-tests.md) **ST-5**.

**Checkpoint**: the card's most common states are honest, specific, and provider-proof.

---

## Phase 7: User Story 4 — swapping away (P3)

**Goal**: swap as a ceremony-free preference signal with the shared budget and honest
retirement.

**Independent test**: swap until the episode's three picks are exhausted — each swap
recorded as a swap, item changes without ceremony, final state is honest retirement, no
day-repeat.

- [ ] T028 [US4] Swap wiring in the T013 card: swap action **stamps `swapped_away_at` on
      the old row FIRST, then inserts** the next engine pick (state 10 — no
      acknowledgement, no ceremony, only the mock's state-10 fade). **Ordering is RULED
      (Ruling B, 2026-08-15) and forced by `rp_one_active_per_user_day`** — two
      untransacted PostgREST requests, so insert-first collides with the still-active row.
      If the INSERT fails, **re-run the engine once** to refresh the card (it now sees the
      declined pick and produces a new one — indistinguishable from a successful swap,
      since swap has no ceremony); if that also fails, keep the previous pick on screen
      and stop — **no retry loop**, nothing renders as an error (FR-030). The stamp is
      **never reversed**, and a failed swap **does NOT consume a budget slot**
      (Amendment 2026-08-16, reversing the 2026-08-15 position): budget consumption
      counts replacement rows that actually landed, so a stamp with no successor row
      costs nothing — no refund path needed, because nothing was charged.
      Swap + Ren actions withdrawn while
      instructions are open (state 5); when budget or non-repeat exhausts eligibility
      the swap action retires with the reviewed honest line (T004) instead of
      repeating. Hallmark-governed; mock binding. **Acceptance**: RTL tests for US4
      scenarios 1–3 green, including retire-early-when-non-repeat-bites-first; plus a
      test proving the stamp precedes the INSERT, one that a failed INSERT produces
      exactly one engine re-run and then stops, and one that a twice-failed swap leaves
      the previous pick on screen with no error UI.
- [ ] T029 [US4] Signal-distinctness suite (SC-007, cross-surface): swaps and
      didn't-help answers stored as **distinct** signals in 100% of cases (different
      columns, never conflated — the `rp_outcome_xor_swap` CHECK is exercised), ignored
      outcome prompt stores nothing; asserted at client level
      (extend the T010 suite) and card level (extend T014). **Acceptance**: suites
      green; a hypothetical write of both signals to one row is rejected.

**Checkpoint**: all four stories independently complete.

---

## Phase 8: Cross-cutting wrap — Ren awareness, legal, docs, verification

- [ ] T030 [P] Ren pick-awareness (R-7):
      `apps/api/app/services/chat_pick_context.py` — `current_pick_line` reads the
      owner's active pick title for today via the forwarded-JWT client, fail-soft to
      `""`, one fixed hedged sentence; `apps/api/app/services/chat_orchestrator.py`
      passes it to `render_prompt("ren", …)`; `packages/llm-client/prompts/ren.txt`
      gains a documented fenced `{current_pick_line}` beside `{recent_read_line}`.
      Chat renders no recommendation cards
      (`CONFIRMATORY_HANDOFF_SHOWS_RECOMMENDATIONS` stays `false`). **Acceptance**:
      pytest — line present with an active pick, empty string on any failure, ren
      prompt renders with and without the variable; existing chat suites green.
- [ ] T031 [P] **Privacy Policy copy — MERGE-BLOCKING** (plan Risk 6):
      `apps/web/lib/legal/copy.ts` — the three §Legal additions: (1) the suggestion
      -records data-class bullet in `PRIVACY_CATEGORIES_ITEMS`; (2) the ninety-day
      retention passage beside `PRIVACY_RETENTION_P2` in the existing "a policy, not a
      mechanism" framing (FR-027 — no purge job exists or is promised; the record does
      not outlive its parent reading's period); (3) one never-manager-visible sentence
      in the `PRIVACY_CHAT_P1` "permanent and unconditional" register (FR-025).
      `terms_privacy@2026-08-15.1` is **already on the branch** — until this wording
      lands the registry describes text that does not exist and the branch MUST NOT
      merge.
      **PLUS — four published passages are false against infrastructure credentials and
      MUST be corrected in this same task (RULED, Mohamed 2026-08-15). T031 cannot be
      marked done without them.** Evidence: on the cloud project `service_role` holds
      full `arwdDxtm` on public tables and both `service_role` and `postgres` have
      `rolbypassrls = true` (read live 2026-08-15; DECISIONS 2026-08-15). Against that —
      (a) `PRIVACY_SECURITY_P1` falsely claims database rules bind the database's own
      owner, and falsely claims consent records are "read by their owner and by no one
      else" and "cannot be deleted at all, by anyone"; the UPDATE-blocking trigger is
      real so **"cannot be edited" stays**; (b) `PRIVACY_MANAGER_DEFAULT`'s "visible to
      you and to nobody else" is stated absolutely and is false against infrastructure
      credentials; (c) `PRIVACY_CHAT_P1`'s "no second rule granting anyone else a way in"
      is literally true and misleading — a role exists that needs no rule; revise it too.
      **Manner of correction**: do **not** simply delete the false sentences. State
      plainly that infrastructure credentials exist and what they can reach, in the
      register the policy already uses for the Groq disclosure and the missing purge job.
      **Claims about managers, admins, and the employer stay absolute** — those are true.
      No new registry entry: these ride the already-material
      `terms_privacy@2026-08-15.1`. **And** the new suggestion-records sentence in (3)
      above must take the **manager/admin/employer shape, NOT the "no way in exists"
      shape** — the latter is precisely what broke here.
      **Acceptance**: `apps/web/tests/unit/lib/legal/copy-invariants.test.ts`
      green; the registry/snapshot guard suites stay green unchanged; no remaining
      absolute no-one-else claim in the Privacy Policy that infrastructure credentials
      contradict; the four passages read as a reviewer-checkable diff.
- [ ] T032 [P] Terms of Service review, recorded: review the ToS against the new data
      class; **no text change expected** (disclosure changed, not agreement mechanics).
      Record the outcome in the PR description and `docs/DECISIONS.md` either way.
      If the review concludes a text change IS needed, stop — that becomes a decision
      for Mohamed before proceeding. **Acceptance**: the recorded review statement
      exists.
- [ ] T033 Tracking docs (CLAUDE.md table — write all that apply, skip none): one
      `docs/PROGRESS.md` entry when this line of work lands (what shipped, what was
      verified, what was **not** — name the LIVE checks explicitly);
      `docs/BACKLOG.md` — add `recommendation_picks` to the existing 90-day-purge
      -mechanism entry (#86) and update its GitHub issue **in the same change**;
      `docs/CHANGELOG.md` only if the spec was actually amended (none expected).
      **Acceptance**: docs and issue updated together; progress-freshness guard green.
- [ ] T034 Full local verification per quickstart.md: `npm run -w apps/web test --
      --pool=threads`, lint, `tsc --noEmit`, Playwright e2e (kill port 3000 between
      suites), `uv run pytest` in apps/api and packages/llm-client; `graphify update .`
      after the code lands. **Acceptance**: all green except the known pre-existing
      Windows-only `hosted-email-template-sync` failure (CI-green on ubuntu); any other
      red is this feature's to fix.
- [ ] T035 [LIVE] [GATE: Mohamed] Execute and record every check in
      [smoke-tests.md](./smoke-tests.md) (ST-1…ST-6) **before the PR merges** —
      Principle VII gate 5. Agent-run checks state their method; Mohamed's attestations
      say so. **Acceptance**: every entry carries a verdict + observations; no blank
      results at merge time.

---

## Phase 9: Pause from the in-session card (scope addition — Mohamed, 2026-08-15)

**Goal**: acting on a suggestion that sends the person away from the desk must not cost
them the session. Belongs with the US2 surface work (`ConfirmedPickCard`, built in
T017) — sequence it after that card exists. Full rationale: plan §Pause from the
in-session card; contracts/confirmatory-resolution.md §3.

- [ ] T036 [US2] Pause/resume control on `ConfirmedPickCard`
      (`apps/web/components/recommendations/`), wired to the **existing** feature-008
      handlers — this adds a second entry point, not new machinery. Ground truth:
      `handlePause` / `handleResume` in `components/monitor/monitoring-session.tsx`
      stop and reacquire the camera and PATCH `status='paused'` / `'active'` on the same
      session row; a neutral `PausedStage` already renders; **no migration** — the
      `status` CHECK already accepts `'paused'`. **ONE** control that becomes a **resume**
      action while the session is paused — never two competing pause affordances. Not
      per-item: no logic decides which items "need" a pause. The card renders outside the
      op-surface switch so it stays visible on the paused surface beside the existing
      Resume/End controls. Hallmark-governed (plan §UI design contract). Home card
      unaffected. **Acceptance** (RTL): pausing from the card calls **no** `finalize`, no
      `openRen`, and no outcome/swap write — no budget spend, no confirm/dismiss, no
      false-alarm suppression (structurally true: the 012 budget is only spent via
      `finalize` from the three answer handlers, which pause never calls); the control
      swaps to resume while paused and back on resume; no second pause affordance exists
      in the rendered tree; the 012 reducers and the pinned #127/#130/#132/#134 suites are
      **byte-unchanged** and green.
- [ ] T037 Drop the session's smoothing buffer when a PATCH sets `status='paused'`
      (`apps/api` — feature-008 server code, **not** 012). Evidence for why: the buffer
      currently survives a pause, so with a deque of 4 and only `end_session` dropping it,
      the first post-resume band is largely derived from **pre-pause** video and can drive
      a confirmatory prompt about an episode that already ended. **GATE INSIDE THIS TASK**:
      first establish that the cold-start / warm-up path handles a partial buffer after
      the drop. If it does not, **report back rather than shipping an unsmoothed window** —
      do not improvise a smoothing change. **Acceptance**: pytest showing the buffer is
      dropped on the paused transition and retained on every other transition; the
      warm-up-path finding recorded either way; existing apps/api suites green.

**Checkpoint**: acting on a suggestion no longer costs the session.

---

## Dependencies

- **Phase 1 → everything that touches the table** (T010, T013+, T015, T017, T018,
  T024's context, T028): the migration and both RLS proofs come first; the posture is
  verified (T002/T003), never assumed.
- **Phase 2 → all UI wiring** (T011 onward): real strings before layout; T005 is a
  human gate that blocks merge, and T011–T014 build against T004's real copy — but note
  T005 gates *shipping*, so component work may start once T004 exists, at the risk of
  rework if review changes strings.
- **Phase 3 → all UI wiring**: T008/T009 table-driven proofs precede any component that
  consumes them (constraint: reducer edge cases are fixtures, not afterthoughts).
- **T004 (fallback strings) → Phase 6**: generation layers over strings already correct
  and shippable (T021–T027 also depend on T023 for the prompt id).
- **T016 → T017/T018** (the dep exists before hosts wire it); **T011 → T017/T019**
  (shared pick-item); **T031 blocks merge** independently of story order.
- **T017 → T036**: the pause control lives on `ConfirmedPickCard`, so that card must
  exist first. **T037 is independent of every web task** (apps/api only) and may run any
  time; it carries its own internal gate and may report back instead of shipping.
- Story order: US1 → US2 share the card built in Phase 4; US3/US4 extend it. US3
  (T021–T024) can proceed in parallel with Phases 4–5 except T025/T026 which touch the
  card.

## Parallel opportunities

- Phase 1's T002 alongside T001 (same author, different files); T003 after both.
- T006, T007 in parallel with T004's authoring.
- After Phase 3: T011/T012 in parallel; T021/T022/T023 (US3) and T030 (Ren) in parallel
  with Phase 4/5 UI work; T031/T032 any time.
- T016 (trigger file) in parallel with T017 (new component) — disjoint files.

## Implementation strategy

MVP = Phases 1–4 (US1): the loop works end to end with real reviewed strings before the
012 surface is touched. Then US2 (the regression-sensitive change) as its own reviewable
increment, then US3, then US4, then the wrap, then Phase 9's pause addition (T036 after
the card exists; T037 any time). One PR per coherent increment into the
feature branch if splitting helps review; the feature branch merges to `main` only when
T005, T031, and T035 are all satisfied. While the PR is open, fold small surfacing items
into it rather than opening a second one.

## Task counts

37 tasks: Phase 1 = 3 · Phase 2 = 3 · Phase 3 = 4 · US1 = 5 · US2 = 5 · US3 = 7 ·
US4 = 2 · Wrap = 6 · Phase 9 (pause scope addition, 2026-08-15) = 2 (T036 [US2],
T037 apps/api). LIVE: T003, T015 (CI-capable, live locally), T020, T027, T035.
Gates requiring Mohamed: **T005** (library line-by-line review), **T035** (smoke
sign-off); **T032** escalates to him only if the ToS review finds a needed change.
