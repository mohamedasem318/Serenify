# Smoke Tests: Questionnaire Feedback (Feature 012)

**Status: ALL SECTIONS COMPLETE — PASS (2026-07-02).** Sections 1–5 (RLS/privacy, web
unit, component/a11y, e2e/layout, manual smoke) all verified, including all 7 manual
scenarios against a real local Supabase + live camera. Final Privacy Artifact Sweep and
Model Artifact Sweep both confirm no drift. One real defect was found and fixed along the
way (Section 4 — the questionnaire-coordinator premature-`onResolved` race); no open
defects remain from this pass.

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
| 2026-07-02 (re-run after the coordinator-timing fix below) | `npx vitest run --pool=threads` | **PASS — 907 passed / 98 files** — no regression from the Section 4 fix |

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

**2026-07-02 — actually executed against the local Supabase + dev server stack (T067 follow-through).**

Pre-req fix (local dev only, not a code change): `globalSetup`'s `auth.admin.listUsers()` was failing
with `500 Database error finding users` (`sql: Scan error … converting NULL to string`). Root cause:
five raw-SQL fixture users left over from the 2026-06-30 live RLS/DEFINER probe
(`admin@t.local`, `m1@t.local`, `m2@t.local`, `e1@t.local`, `e2@t.local`) had `NULL` GoTrue
token columns (`confirmation_token`, `recovery_token`, `email_change_token_new/current`,
`phone_change_token`, `reauthentication_token`, `email_change`, `phone_change`) — GoTrue's Go
driver can't scan `NULL` into those columns. Backfilled to `''` directly in the local Postgres
container; no application code or migration involved.

**Defect found + fixed:** the first real run of `questionnaire.spec.ts` failed 3 of 4 tests. Root
cause: `WeeklyCheckInCard` and `SessionEndFeedbackCard` both called `onResolved()` in the *same*
synchronous handler that set their own local "ending" state. React batches both updates into one
commit, and `QuestionnaireCoordinator` recomputes `surface` in that same commit — so the parent
swapped the visible card out (or, worse, unmounted `SessionEndFeedbackCard` before the user's 3rd
click could ever reach the "Notification settings" / "Update preferences" button) before anything
ever painted. This is a real SC-007 violation ("≤3 interactions"), not a test artifact — component-
level unit tests never caught it because they mount each card standalone, with no coordinator to
race against.

Fix (`components/questionnaire/weekly-check-in-card.tsx`,
`components/questionnaire/session-end-feedback-card.tsx`,
`lib/questionnaire/constants.ts` new `QUESTIONNAIRE_RESULT_DWELL_MS=2_500`):
- Weekly card: `onResolved()` now fires after a 2.5s dwell (timer, cleared on unmount) so the
  "Glad the week's been good." / "All good — we'll ask again next week." / "Heard — thanks for
  speaking up." message is actually visible before the coordinator swaps surfaces.
- Session-end card: `suggestion_didnt_help` and `needed_quiet` now save immediately but only call
  `onResolved()` from `route()` — i.e. when the user actually clicks the action button — so the
  action row stays mounted between reason-selection and the route click. `Good`/`Skip`/
  `ren_too_robotic`/free-text behaviour is unchanged (already covered by the passing
  `questionnaire-coordinator.test.tsx` Skip-flow expectation, which asserts an immediate swap).

Verified no regression: full `npx vitest run --pool=threads` (907 passed / 98 files) and the full
chromium e2e project (42 passed, 4 pre-existing skips unrelated to 012, 1 pre-existing unrelated
failure — see note below) both green after the fix.

| Run date | Command | Result |
|----------|---------|--------|
| 2026-06-30 (T067) | `npm --workspace web run test:e2e -- questionnaire` | AUTHORED, not yet executed (superseded by the row below). |
| 2026-06-30 (T067) | `npm --workspace web run test:layout -- questionnaire` | AUTHORED, not yet executed (superseded by the row below). |
| 2026-07-02 | `npx playwright test --config playwright.config.ts tests/e2e/questionnaire.spec.ts --project=chromium` (first real run) | **FAIL — 1/4 passed.** Found the premature-`onResolved` defect above. |
| 2026-07-02 | Same command, after the fix | **PASS — 4/4.** Weekly Done → visible "Heard — thanks…"; `needed_quiet` → Notification settings → `/app/account#notifications`; `suggestion_didnt_help` → Update preferences → `/app/account`; Ren soft-opener handoff, no recommendation cards. |
| 2026-07-02 | `npx playwright test --config playwright.config.ts tests/e2e/questionnaire-layout.spec.ts --project=chromium` | **PASS — 4/4** (360px/desktop × light/dark; no horizontal overflow; ≥44px targets on the weekly card + stepper). Note: this spec lives under `tests/e2e/` and needs the real `playwright.config.ts` (globalSetup + service-role seeding) — `npm run test:layout` points at `playwright.layout.config.ts` (no globalSetup) and reports "No tests found" for it; run it via `test:e2e` instead. Comment in the spec corrected to match. |
| 2026-07-02 | Full chromium e2e project (all specs) | **42 passed, 4 skipped (pre-existing: demo-cohort/cross-tab, unrelated to 012), 1 failed** — `employee-dashboard-shell.spec.ts` "employee shell at 360px" (card x-alignment off by 8px vs an expected ≤4px). Confirmed **pre-existing and unrelated to Feature 012**: reproduces identically with the questionnaire fix stashed out (`git stash` → same failure → `git stash pop`). Feature 008/009 dashboard-shell layout, out of scope here; flagged separately (see close-out note). |

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
| 1 | 2026-07-02 | **PASS (incidental).** Real local Supabase + live camera, account `omar.nabil@serenify.tech`. Early short jaw-clench bursts (a few seconds, well under the sustained window) never triggered the prompt — consistent with no-premature-trigger, though not a clean deliberately-timed run. |
| 2 | 2026-07-02 | **PASS.** Same session — genuine sustained tense (unintentional, from being focused/frowning during an extended stretch) crossed the sustained threshold and the confirmatory prompt appeared in the bottom-right notification surface. Also incidentally exercised the signal-drop auto-expiry path (prompt closed once the band dropped back to `a_little_tense` and the existing `CONFIRMATORY_PROMPT_MIN_DWELL_MS` dwell had already elapsed by the next ~10s-stride reading) — matches existing unit test coverage, not a numbered scenario itself. |
| 3 | 2026-07-02 | **PASS.** With the prompt visible, outside click and Escape both did nothing — prompt remained (`dismissible={false}` holds live, not just in component tests). |
| 4 | 2026-07-02 | **PASS, DB-verified.** Clicked "No, I'm okay": prompt faded, Today/trend card visibly unchanged. Verified in Postgres: the row landed `lifecycle=answered`, `outcome=false_alarm`, `aggregate_treatment=exclude_or_down_weight`. Next-session suppression confirmed two ways — live (2nd session: sustained tense readings across the whole graph, prompt never fired; 3rd session: fired normally again) and via DB (`monitoring_sessions` × `questionnaire_confirmatory_prompts` join): session 2 (suppressed) has **0** prompt rows — the trigger never even creates one, not merely hides it — session 3 has 1, matching `CONFIRMATORY_FALSE_ALARM_SUPPRESS_NEXT_SESSIONS=1` exactly. |
| 5 | 2026-07-02 | **PASS, DB-verified.** Ended the monitoring session while the confirmatory prompt was still visible/unanswered (3rd session from scenario 4's suppression check). Prompt disappeared, then session-end feedback card appeared in its place on the dashboard — never both at once. Verified in Postgres: the prompt row resolved `lifecycle=expired`, `expiry_reason=session_end` (not `signal_drop`) — confirms `resolveForSessionEnd()` drove the expiry, not a coincidental band drop. |
| 6 | 2026-07-02 | **PASS, DB-verified.** All 6 session-end paths run through the real dashboard, one ended session per path: Good, "suggestion didn't help" (→ Update preferences → `/app/account`), "needed quiet time" (→ Notification settings → `/app/account#notifications`), "chatbot felt too robotic" (shows the not-sent-to-Ren note), free text (Send disabled on empty and on whitespace-only, enabled + submits on real text), and Skip. None opened Ren. Verified in Postgres: `questionnaire_session_feedback` has one correctly-shaped row per path (`status`/`sentiment`/`reason`/`action_target`/`free_text` all match the CHECK-constraint shape), including two incidental repeat rounds (`ren_too_robotic`, `something_else`) that landed identically correct both times. |
| 7 | 2026-07-02 | **PASS, DB-verified.** Fresh account `yara.fathy@serenify.tech` (no prior cadence row): first dashboard visit showed the weekly card, skipped; reload → reappeared (the one allowed re-prompt), skipped again; reload again → did not appear a third time. Verified in Postgres: `weekly_checkin_cadence` row for the ISO week is `prompt_count=2, skipped_count=2, completed_at=null` — both hit `MAX_PROMPTS`/`MAX_SKIPS`, matching `shouldShowWeeklyCheckIn`'s suppression condition exactly. |

**Note:** `apps/api/.env` (gitignored, not committed) temporarily overrode `STRESS_TENSE_BAND=0.58` (default 0.70) for scenarios 3–7, to cut down real time needed to reach the `tense` band — the backend's 60s-window + 4-reading smoothing means reaching `tense` at the default threshold took several minutes of genuine sustained tension. **Reverted** back to the 0.70 default after scenario 7 passed (line removed from `apps/api/.env`; API server needs one more restart to pick that up, no functional impact until then since the override only ever affected this local dev process).

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
