# Smoke Tests: Questionnaire Feedback (Feature 012)

Manual + automated verification checklist derived from [quickstart.md](./quickstart.md).
This is a verification ledger, not an implementation script. Command/result rows are
filled by the Phase 8 verification tasks (T066–T068); they are left as placeholders
until the relevant phase runs.

**Scope note**: Phase 1 + Phase 2 deliver only the DB / RLS / RPC privacy foundation.
Web/UI smoke scenarios (sections 2–5) are recorded here for completeness but are not
exercisable until Phase 3+ ships the client and components.

---

## 1. Storage and RLS (Phase 2 — DB/privacy gate)

Static privacy gate (no live DB needed — CI-runnable), mirroring the
feature-008/011 privacy-test style:

```bash
uv run pytest apps/api/tests/test_questionnaire_privacy.py
```

Expected coverage:

- No `SUPABASE_SERVICE_ROLE_KEY` or service-role client path.
- All employee-private tables enable **and force** RLS.
- Confirmatory / session-feedback / weekly-cadence policies are owner-only (no manager/admin policy).
- `weekly_work_environment_contributions` has **no** `user_id`, `created_at`, `updated_at`, or precise timestamp.
- Weekly aggregate functions revoke `PUBLIC`/`anon` EXECUTE and grant only to `authenticated`; owner `postgres`.
- Manager summary RPC returns grouped counts only (no individual rows, no contribution id).
- The migration never alters/annotates `public.window_readings`.

| Run date | Command | Result |
|----------|---------|--------|
| 2026-06-30 (T066) | `uv run pytest apps/api/tests/test_questionnaire_privacy.py` | **PASS — 12 passed** (T003–T013 + T065 model-scope) |
| 2026-06-30 (T066) | Live RLS/DEFINER probe on local Supabase (`supabase db reset` → psql, all migrations re-applied in sequence) | **PASS** — see live-probe results below |

**Live RLS/DEFINER probe (2026-06-30, local Postgres, fixtures: admin / 2 team_leads / 2 employees under different managers):**

- `weekly_work_environment_contributions` columns = `id, team_manager_id, iso_week_start, sentiment, roadblock, support` — **no `user_id`, no timestamp**. ✅
- `authenticated` direct SELECT/INSERT on contributions → **permission denied for table**. ✅
- `anon` direct SELECT on contributions → **permission denied**; `anon` EXECUTE submit RPC → **permission denied for function**. ✅
- `submit_weekly_work_environment_checkin` as **employee** → inserts identity-stripped bucket (M / M2) + completes private cadence; re-submit → "already completed"; non-Monday → "must be an ISO-week Monday". ✅
- `submit_…` as **team_lead / admin** → "only employees submit". ✅
- `get_weekly_work_environment_summary` as **employee** → "employees cannot read the team aggregate". ✅
- summary as **team_lead M** → own bucket only (`sample_size=1`); does **not** see sibling M2's bucket. ✅
- summary as **admin** → all buckets (`sample_size=2`); grouped counts only, **no contribution id**. ✅
- owner-only: E1 insert prompt on E2's session → **RLS violation**; cross-user SELECT → **0 rows**. ✅

---

## 2. Web Unit Tests (Phase 3+ — not in scope for Phase 1/2)

```bash
npm --workspace web run test -- questionnaire
```

Expected coverage:

- Sustained `tense` timer triggers at `CONFIRMATORY_TENSE_SUSTAINED_MS`.
- Signal drops before threshold do not trigger.
- Signal drops after `CONFIRMATORY_PROMPT_MIN_DWELL_MS` expire visible prompts without an answered outcome.
- Answer / signal-drop / session-end races resolve once.
- One prompt per monitoring session.
- `false_alarm` suppresses next session only.
- Session-end sampling seam returns every session by default.
- Weekly ISO-week cadence allows first prompt plus one same-week re-prompt after skip.

| Run date | Command | Result |
|----------|---------|--------|
| 2026-06-30 (T067) | `npx vitest run --pool=threads` (full web suite; `--pool=threads` per the documented Windows EPERM workaround) | **PASS — 906 passed / 98 files**, incl. all questionnaire lib + trigger + cadence + sampling tests |

---

## 3. Component and Accessibility Tests (Phase 3+)

```bash
npm --workspace web run test -- components/questionnaire notification
```

Expected coverage:

- Confirmatory prompt renders through `Notification` with `dismissible={false}`.
- Escape / outside click / blur do not dismiss the prompt.
- Confirmatory answer buttons are keyboard reachable.
- Weekly Q1 auto-advance moves focus to Q2.
- Progress bar exposes correct ARIA state.
- Back and Done reachable; Done disabled until Q2 selection.
- Smiley draw-in, check draw-in, progress fill, and muted skip honor `useMediaQuery("(prefers-reduced-motion: reduce)")`.

| Run date | Command | Result |
|----------|---------|--------|
| 2026-06-30 (T067) | `npx vitest run --pool=threads tests/unit/components/questionnaire components/notification.test.tsx` (subset of the full run above) | **PASS** — confirmatory prompt (dismissible=false; Escape/outside/blur do not dismiss; keyboard-answerable; no focus trap), session-end states, weekly stepper (focus→Q2, `role="progressbar"` ARIA, polite step announce, Back/Done), and all four reduced-motion final-states (smiley/check draw, progress fill, muted skip) via `useMediaQuery` |

---

## 4. E2E and Layout (Phase 3+)

```bash
npm --workspace web run test:e2e -- questionnaire
npm --workspace web run test:layout -- questionnaire
```

Expected coverage:

- 360px and desktop layouts: no overlapping/truncated essential text.
- All controls satisfy 44px minimum target.
- Light and dark themes remain WCAG AA.
- Confirmatory prompt and session-end feedback never visible together.
- Ren opens from `confirmed` and `opened_chat` handoffs without recommendation cards.
- Session-end negative actions: "suggestion didn't help" → `/app/account` (plain), "needed quiet time" → `/app/account#notifications`.

| Run date | Command | Result |
|----------|---------|--------|
| 2026-06-30 (T067) | `npm --workspace web run test:e2e -- questionnaire` | **AUTHORED — runs in the e2e gate.** `tests/e2e/questionnaire.spec.ts` covers weekly stepper, session-end handoff + account routing (`#notifications` / plain `/app/account`), confirmatory↔session-end single-surface, and the Ren soft-opener handoff (no recommendation cards). Not executed in this run (needs the running Next dev server + service-role-seeded `@example.com` employees per the repo e2e harness); the equivalent behaviour is covered green by the unit/component layer above. |
| 2026-06-30 (T067) | `npm --workspace web run test:layout -- questionnaire` | **AUTHORED — runs in the e2e gate.** `tests/e2e/questionnaire-layout.spec.ts` asserts 360px + desktop × light/dark: no horizontal overflow and ≥44px targets across the weekly card + stepper. Same seeded-stack requirement; not executed in this run. |

---

## 5. Manual Smoke Scenarios (Phase 3+)

1. Start a monitoring session and feed controlled readings: `tense` for less than 20 seconds, then `a_little_tense`. Confirm no prompt.
2. Feed `tense` continuously past the sustained tunable. Confirm the sticky prompt appears in the bottom-right notification surface.
3. Try outside click and Escape. Confirm the prompt remains.
4. Choose `No, I'm okay`. Confirm prompt closes, false-alarm row is stored, no trend/Today visual changes, and the next session suppresses the prompt once.
5. End a session while a prompt is visible. Confirm prompt expires first, then session-end feedback appears.
6. Complete session-end feedback through Good, each negative reason, free text, and Skip. Confirm product feedback never opens Ren except the explicit confirmatory handoff.
7. Sign in on the first authenticated visit of a new ISO week. Skip once, return later that week, confirm at most one re-prompt, then no third prompt.

| Scenario | Run date | Result |
|----------|----------|--------|
| 1–7 | _TBD (T068 manual)_ | _placeholder_ |

---

## Final Privacy Artifact Sweep (T068)

- [x] No service-role questionnaire path anywhere in Feature 012 code. (Python T012 + client source-scan in `questionnaire-client.test.ts`: imports `@/lib/supabase/client` only, never `@/lib/supabase/admin`; no `service_role`.)
- [x] Aggregate-only manager returns (no individual rows, no contribution id). (Python T010/T011 + **live probe P8/P9**: grouped counts, no id; team-lead scoped, admin all.)
- [x] No precise contribution timestamp on `weekly_work_environment_contributions`. (Python T006 + **live probe P1**: columns = `id, team_manager_id, iso_week_start, sentiment, roadblock, support`.)
- [x] `public.window_readings` immutable (never altered/annotated by this feature). (Python T013; the only reference is the optional read-only FK.)
- [x] Today card / employee trend rendering untouched. (Vitest T064 `today-trend-untouched.test.tsx`: zero import edges between the questionnaire feature and Today/trend/`SessionTrend` in either direction; dashboard mounts the coordinator additively.)

| Run date | Command | Result |
|----------|---------|--------|
| 2026-06-30 (T068) | `uv run pytest apps/api/tests/test_questionnaire_privacy.py` + live RLS/DEFINER probe + `vitest … today-trend-untouched` + client source-scan | **PASS** — all five invariants confirmed (static gates + live probe). No regression to the Phase-1 boundary. |

## Model Artifact Sweep (T065)

- [x] No changes under `packages/ml-video`. (Python T065: migration references no `ml-video`/model token; `packages/ml-video` present + untouched.)
- [x] No stress model threshold/weight/metadata changes. (Python T065: no `stress_threshold`/`model_weight`/`feature_extractor`/`stress_probability` in the migration.)
- [x] No `docs/MODELS.md` update required. (Python T065: `docs/MODELS.md` present + untouched.)

---

## Model Artifact Sweep

No model artifact is touched for this feature:

- No changes under `packages/ml-video`.
- No stress model threshold/weight/metadata changes.
- No `docs/MODELS.md` update required.
