# Tasks: Questionnaire Feedback

**Input**: Design documents from `/specs/012-questionnaire-feedback/`
**Prerequisites**: `plan.md`, `spec.md`, `data-model.md`, `research.md`, `quickstart.md`, `contracts/`
**Tests**: Required by Constitution Principle VII and the user's task request. Test tasks are marked as "Principle VII test" and should be written first.
**Ordering constraint**: Complete DB/storage tasks before authenticated client/API tasks, and complete authenticated client/API tasks before UI wiring.

## Phase 1: Setup (Task Scaffolding)

**Purpose**: Create feature-level verification scaffolding without implementing product behavior.

- [ ] T001 Create manual smoke checklist from `quickstart.md` in `specs/012-questionnaire-feedback/smoke-tests.md`
- [ ] T002 Create questionnaire DB/privacy test harness notes and SQL fixture helper skeleton in `apps/api/tests/test_questionnaire_privacy.py`

---

## Phase 2: Foundational DB, RLS, RPC, and Privacy Contracts

**Purpose**: Build the storage and privacy boundary that blocks every user story.

**Critical**: No web client or UI task should start until this phase is complete.

### Tests for Foundational DB Layer

- [ ] T003 Add Principle VII test for `questionnaire_confirmatory_prompts` columns, one-row-per-session uniqueness, lifecycle constraints, trigger time requirement, and `aggregate_treatment` false-alarm rule in `apps/api/tests/test_questionnaire_privacy.py`
- [ ] T004 Add Principle VII test for `questionnaire_session_feedback` columns, one-row-per-session uniqueness, skip/null constraints, negative-reason/free-text constraints, and `sampling_policy='every_session'` in `apps/api/tests/test_questionnaire_privacy.py`
- [ ] T005 Add Principle VII test for `weekly_checkin_cadence` columns, `(user_id, iso_week_start)` uniqueness, `prompt_count`/`skipped_count` 0-2 constraints, and absence of answer values in `apps/api/tests/test_questionnaire_privacy.py`
- [ ] T006 Add Principle VII test proving `weekly_work_environment_contributions` has no `user_id`, no `created_at`, no `updated_at`, and no precise timestamp column in `apps/api/tests/test_questionnaire_privacy.py`
- [ ] T007 Add Principle VII test for owner-only RLS on `questionnaire_confirmatory_prompts`, `questionnaire_session_feedback`, and `weekly_checkin_cadence`, including `TO authenticated`, `USING`, `WITH CHECK`, and owned-monitoring-session checks in `apps/api/tests/test_questionnaire_privacy.py`
- [ ] T008 Add Principle VII test for forced RLS, revoked direct `anon`/`authenticated` grants, and no manager/admin policies on `weekly_work_environment_contributions` in `apps/api/tests/test_questionnaire_privacy.py`
- [ ] T009 Add Principle VII test for `submit_weekly_work_environment_checkin` SECURITY DEFINER requirements, caller `auth.uid()` validation, employee-role gate, ISO-week Monday validation, option validation, contribution insert, and cadence completion in `apps/api/tests/test_questionnaire_privacy.py`
- [ ] T010 Add Principle VII test for `get_weekly_work_environment_summary` SECURITY DEFINER requirements, `PUBLIC`/`anon` execute revokes, authenticated execute grant, and grouped return shape only in `apps/api/tests/test_questionnaire_privacy.py`
- [ ] T011 Add Principle VII test for role-gated aggregate visibility: employees rejected, team leads see only visible team buckets, admins see all buckets, and null `team_manager_id` rows are excluded in `apps/api/tests/test_questionnaire_privacy.py`
- [ ] T012 Add Principle VII privacy-regression test that Feature 012 code paths add no `SUPABASE_SERVICE_ROLE_KEY`, no service-role client, no FastAPI bypass write, and no questionnaire manager/admin individual row path in `apps/api/tests/test_questionnaire_privacy.py`
- [ ] T013 Add Principle VII immutability test that the questionnaire migration never alters, updates, deletes, suppresses, or annotates `public.window_readings` in `apps/api/tests/test_questionnaire_privacy.py`

### Implementation for Foundational DB Layer

- [ ] T014 Create `questionnaire_confirmatory_prompts` schema, indexes, lifecycle checks, `trigger_band='tense'`, optional `trigger_window_reading_id`, required `triggered_window_captured_at`, and `touch_updated_at` trigger in `supabase/migrations/20260630000000_questionnaire_feedback.sql`
- [ ] T015 Create `questionnaire_session_feedback` schema, indexes, skip/submitted checks, negative-reason/free-text checks, action target checks, and `sampling_policy='every_session'` default in `supabase/migrations/20260630000000_questionnaire_feedback.sql`
- [ ] T016 Create `weekly_checkin_cadence` schema, indexes, ISO-week cadence columns, `prompt_count`/`skipped_count` checks, and no work-environment answer columns in `supabase/migrations/20260630000000_questionnaire_feedback.sql`
- [ ] T017 Create `weekly_work_environment_contributions` schema with only `id`, `team_manager_id`, `iso_week_start`, `sentiment`, `roadblock`, and `support`; explicitly omit `user_id`, `created_at`, `updated_at`, and any precise timestamp in `supabase/migrations/20260630000000_questionnaire_feedback.sql`
- [ ] T018 Add owner-only RLS policies and explicit grants for `questionnaire_confirmatory_prompts`, `questionnaire_session_feedback`, and `weekly_checkin_cadence`, with monitoring-session ownership checks on inserts/updates where applicable in `supabase/migrations/20260630000000_questionnaire_feedback.sql`
- [ ] T019 Add forced RLS, revoked direct privileges from `anon` and `authenticated`, and the narrow function-owner policy for `weekly_work_environment_contributions` in `supabase/migrations/20260630000000_questionnaire_feedback.sql`
- [ ] T020 Implement `public.submit_weekly_work_environment_checkin` as `LANGUAGE plpgsql SECURITY DEFINER SET search_path = ''`, deriving `team_manager_id` from `profiles.manager_id`, inserting an identity-stripped contribution, and completing private cadence transactionally in `supabase/migrations/20260630000000_questionnaire_feedback.sql`
- [ ] T021 Implement `public.get_weekly_work_environment_summary` as aggregate-only `LANGUAGE plpgsql SECURITY DEFINER SET search_path = ''`, returning only `iso_week_start`, `sample_size`, `sentiment`, `roadblock`, `support`, and `response_count` in `supabase/migrations/20260630000000_questionnaire_feedback.sql`
- [ ] T022 Implement role-gated manager/admin visibility inside `public.get_weekly_work_environment_summary` without accepting an impersonation user id and without returning contribution ids or individual-identifying fields in `supabase/migrations/20260630000000_questionnaire_feedback.sql`
- [ ] T023 Revoke `EXECUTE` on both weekly RPCs from `PUBLIC` and `anon`, grant `EXECUTE` only to `authenticated`, and set both function owners to `postgres` in `supabase/migrations/20260630000000_questionnaire_feedback.sql`

**Checkpoint**: Database schema, RLS, RPCs, and privacy invariants are testable before any web code is added.

---

## Phase 3: Foundational Authenticated Client/API Layer

**Purpose**: Provide typed authenticated Supabase access for the UI without service-role or manager-visible individual paths.

- [ ] T024 [P] Add Principle VII tests for typed confirmatory prompt create/resolve calls, session feedback insert/update calls, weekly cadence calls, and weekly submit/summary RPC mapping in `apps/web/tests/unit/lib/questionnaire/questionnaire-client.test.ts`
- [ ] T025 [P] Add Principle VII tests for shared questionnaire enum/value validation against `data-model.md` enumerations in `apps/web/tests/unit/lib/questionnaire/types.test.ts`
- [ ] T026 Implement shared questionnaire domain types and enum guards for confirmatory outcomes, session feedback values, and weekly check-in values in `apps/web/lib/questionnaire/types.ts`
- [ ] T027 Implement authenticated RLS-as-user questionnaire data client with no admin Supabase import, no service-role path, typed table payloads, typed RPC calls, and no manager individual-row reads in `apps/web/lib/api/questionnaire-client.ts`

**Checkpoint**: UI code can call typed authenticated helpers, but no UI has been mounted yet.

---

## Phase 4: User Story 1 - Confirm a Sustained Tense Signal (Priority: P1)

**Goal**: Show one sticky confirmatory prompt during an active monitoring session after sustained `tense`, persist the outcome, and hand off to Ren when requested.

**Independent Test**: Feed controlled `WindowOutcome` values into the trigger and confirm threshold behavior, non-dismissable prompt behavior, persistence payloads, Ren handoff, one-prompt-per-session, next-session false-alarm suppression, and unchanged employee trend/Today behavior.

### Tests for User Story 1

- [ ] T028 [P] [US1] Add Principle VII trigger tests for `CONFIRMATORY_TENSE_SUSTAINED_MS=20_000`, `CONFIRMATORY_PROMPT_MIN_DWELL_MS=4_500`, one prompt per session, next-session false-alarm suppression, race resolution, chat-signal exclusion, and no cross-worker/server state in `apps/web/tests/unit/lib/questionnaire/confirmatory-trigger.test.ts`
- [ ] T029 [P] [US1] Add Principle VII tests for `Notification` `dismissible={false}` and `nonModal={true}` behavior: no close button, Escape/outside click/blur cannot dismiss, keyboard answerability preserved, and no focus trap in `apps/web/components/notification.test.tsx`
- [ ] T030 [P] [US1] Add Principle VII accessibility and copy tests for the confirmatory prompt title, body, three ordered native buttons, Graphite color roles, lucide icons, and 44px targets in `apps/web/tests/unit/components/questionnaire/confirmatory-prompt.test.tsx`
- [ ] T031 [P] [US1] Add Principle VII Ren handoff tests for `confirmed` and `opened_chat` query seams with no recommendation cards in `apps/web/tests/unit/components/chat/chat-handoff.test.tsx`

### Implementation for User Story 1

- [ ] T032 [US1] Implement confirmatory tunables in `apps/web/lib/questionnaire/constants.ts`
- [ ] T033 [US1] Implement `useConfirmatoryTrigger` over the existing `WindowOutcome`/`Band` stream with local per-session state, dwell floor, false-alarm suppression consumption, single-resolution guard, and no backend polling in `apps/web/lib/questionnaire/confirmatory-trigger.ts`
- [ ] T034 [US1] Extend `NotificationProps` with backward-compatible `dismissible?: boolean` and `nonModal?: boolean`, and prevent close UI/Escape/outside dismissal when `dismissible=false` in `apps/web/components/notification.tsx`
- [ ] T035 [US1] Implement `ConfirmatoryPrompt` with exact spec copy, three ordered outcomes, accessible labels/descriptions, Graphite tokens, and lucide `Activity`, `Wind`, and `MessageCircle` icons in `apps/web/components/questionnaire/confirmatory-prompt.tsx`
- [ ] T036 [US1] Add Ren handoff query support for `?handoff=confirmatory_yes` and `?handoff=confirmatory_maybe` without recommendation cards in `apps/web/app/(authed)/app/chat/page.tsx` and `apps/web/components/chat/chat-shell.tsx`
- [ ] T037 [US1] Feed active `MonitoringSession` `liveSessionId` and `submitWindow()` outcomes into the confirmatory trigger, resolve prompt expiry before session-end navigation, and preserve the existing Band contract in `apps/web/components/monitor/monitoring-session.tsx`

**Checkpoint**: User Story 1 is independently functional and testable against controlled band sequences.

---

## Phase 5: User Story 2 - Give Optional Feedback After a Check-In (Priority: P2)

**Goal**: Offer employee-private session-end product feedback after each monitoring session by default, including skip, good, negative reasons, tailored account routing, and no Ren/manager routing.

**Independent Test**: End monitoring sessions with the sampling seam defaulted to every session and exercise Good, Something was off, each negative reason, free text, and Skip. Confirm persistence stays employee-private and never collides with the confirmatory prompt.

### Tests for User Story 2

- [ ] T038 [P] [US2] Add Principle VII tests for `SESSION_END_FEEDBACK_SAMPLING_POLICY='every_session'` and the future sampling seam in `apps/web/tests/unit/lib/questionnaire/session-feedback-sampling.test.ts`
- [ ] T039 [P] [US2] Add Principle VII component tests for session-end card initial actions, Good success state, Skip muted state, exact negative reasons, non-empty free-text validation, tailored action states, and an explicit SC-007 interaction-count assertion that each path (Good, each negative reason, free text, Skip) completes in no more than three interactions after the card appears in `apps/web/tests/unit/components/questionnaire/session-end-feedback-card.test.tsx`
- [ ] T040 [P] [US2] Add Principle VII privacy tests that session-end free text and `ren_too_robotic` are stored only as employee-private product feedback and never passed to Ren or manager aggregate calls in `apps/web/tests/unit/components/questionnaire/session-end-feedback-privacy.test.tsx`
- [ ] T041 [P] [US2] Add Principle VII tests for the session-end route targets: the `suggestion_didnt_help` action routes to `/app/account` (plain, no preferences anchor yet) and the `needed_quiet` action routes to `/app/account#notifications` in `apps/web/components/account/questionnaire-route-anchors.test.tsx`

### Implementation for User Story 2

- [ ] T042 [US2] Implement the v1 every-session sampling seam in `apps/web/lib/questionnaire/session-feedback-sampling.ts`
- [ ] T043 [US2] Implement `SessionEndFeedbackCard` with exact copy, option ordering, Good/Skip/negative/free-text states, Graphite tokens, lucide icons, minimum 44px controls, and employee-private privacy copy in `apps/web/components/questionnaire/session-end-feedback-card.tsx`
- [ ] T044 [US2] Ensure `notifications-placeholder.tsx` carries an `id="notifications"` anchor (add if missing) for the `needed_quiet` ("needed quiet time") route action; route the `suggestion_didnt_help` ("suggestion didn't help") action to `/app/account` plain — do NOT add a preferences anchor, since no preferences section exists yet (it will target a real preferences section once features 014/016 ship) — in `apps/web/components/account/notifications-placeholder.tsx`
- [ ] T045 [US2] Persist session-end submitted/skipped outcomes through the authenticated questionnaire client without Ren handoff, manager writes, or aggregate writes in `apps/web/components/questionnaire/session-end-feedback-card.tsx`

**Checkpoint**: User Story 2 is independently functional after ended sessions and keeps product feedback employee-private.

---

## Phase 6: User Story 3 - Complete a Weekly Work-Environment Check-In (Priority: P2)

**Goal**: Show the weekly check-in on the first authenticated visit of an ISO week, allow at most one same-week re-prompt after skip, and submit only identity-stripped aggregate contributions.

**Independent Test**: Exercise Good, Could be better, Back, Done, Skip, abandoned Q2, first weekly visit, one same-week re-prompt, and manager aggregate privacy.

### Tests for User Story 3

- [ ] T046 [P] [US3] Add Principle VII tests for ISO-week start calculation, first authenticated visit eligibility, completion suppression, first-skip re-prompt, second-skip suppression, and abandoned-Q2 non-completion in `apps/web/tests/unit/lib/questionnaire/weekly-cadence.test.ts`
- [ ] T047 [P] [US3] Add Principle VII tests for weekly card Good, Skip, Could-be-better entry, exact Q1/Q2 options, Back, disabled Done, Done completion, and no contribution on skip/abandon in `apps/web/tests/unit/components/questionnaire/weekly-check-in-card.test.tsx`
- [ ] T048 [P] [US3] Add Principle VII accessibility tests for weekly two-step focus movement, `role="progressbar"` ARIA values/text, live step announcements, and keyboard/screen-reader reachability of Back and Done in `apps/web/tests/unit/components/questionnaire/weekly-stepper-accessibility.test.tsx`

### Implementation for User Story 3

- [ ] T049 [US3] Implement ISO-week cadence helpers and eligibility decisions for first authenticated visit, one same-week re-prompt after skip, second-skip suppression, and completed-week suppression in `apps/web/lib/questionnaire/weekly-cadence.ts`
- [ ] T050 [US3] Implement `WeeklyCheckInCard` with exact heading, Good/Could-be-better/Skip states, two-step Q1/Q2 flow, Back/Done controls, progress state, Graphite tokens, lucide icons, and minimum 44px controls in `apps/web/components/questionnaire/weekly-check-in-card.tsx`
- [ ] T051 [US3] Wire weekly skip/completion to private cadence updates and `submit_weekly_work_environment_checkin`, ensuring skipped and abandoned paths create no aggregate contribution in `apps/web/components/questionnaire/weekly-check-in-card.tsx`

**Checkpoint**: User Story 3 is independently functional and stores only aggregate-safe weekly answers.

---

## Phase 7: User Story 4 - Preserve Calm, Private Questionnaire Surfaces (Priority: P3)

**Goal**: Coordinate all questionnaire surfaces so they remain calm, accessible, responsive, reduced-motion safe, and privacy-preserving across themes and viewports.

**Independent Test**: Render all instruments at 360px and desktop, in light/dark themes, with and without reduced motion. Confirm no confirmatory/session-end collision, no Graphite semantic violations, no essential text overlap, and no privacy boundary regression.

### Tests for User Story 4

- [ ] T052 [P] [US4] Add Principle VII coordinator tests proving confirmatory prompt and session-end feedback never co-occur, prompt session-end expiry resolves first, weekly check-in stays separate from active monitoring, and rendering priority is centralized in `apps/web/tests/unit/components/questionnaire/questionnaire-coordinator.test.tsx`
- [ ] T053 [P] [US4] Add Principle VII reduced-motion test for smiley draw-in final-state rendering through `useMediaQuery("(prefers-reduced-motion: reduce)")` in `apps/web/tests/unit/components/questionnaire/reduced-motion-smiley.test.tsx`
- [ ] T054 [P] [US4] Add Principle VII reduced-motion test for check draw-in final-state rendering through `useMediaQuery("(prefers-reduced-motion: reduce)")` in `apps/web/tests/unit/components/questionnaire/reduced-motion-check.test.tsx`
- [ ] T055 [P] [US4] Add Principle VII reduced-motion test for weekly progress fill updating without transition when reduced motion is preferred in `apps/web/tests/unit/components/questionnaire/reduced-motion-progress.test.tsx`
- [ ] T056 [P] [US4] Add Principle VII reduced-motion test for muted skip wind/text appearing without pop or fade movement when reduced motion is preferred in `apps/web/tests/unit/components/questionnaire/reduced-motion-muted-skip.test.tsx`
- [ ] T057 [P] [US4] Add Principle VII visual contract tests for Graphite token usage, amber only on stress-confirm affordances, meadow on affirmative/success states, foggy on neutral attention/error states, no crimson on questionnaire surfaces, and lucide-only icons in `apps/web/tests/unit/components/questionnaire/questionnaire-visual-contract.test.tsx`
- [ ] T058 [P] [US4] Add Principle VII Playwright flow tests for confirmatory/session-end collision, Ren handoff, session-end account routing, an SC-007 assertion that each session-end path reaches its visible end state in no more than three interactions, and weekly cadence re-prompt behavior in `apps/web/tests/e2e/questionnaire.spec.ts`
- [ ] T059 [P] [US4] Add Principle VII Playwright layout tests for 360px and desktop, light/dark WCAG AA gates, 44px targets, and no overlapping/truncated essential text in `apps/web/tests/e2e/questionnaire-layout.spec.ts`

### Implementation for User Story 4

- [ ] T060 [US4] Implement shared `QuestionnaireResultIcon` for smiley draw-in, check draw-in, and muted skip states with `useMediaQuery` reduced-motion handling in `apps/web/components/questionnaire/questionnaire-result-icon.tsx`
- [ ] T061 [US4] Implement `QuestionnaireCoordinator` with centralized surface priority, anti-collision rules, confirmatory expiry-before-session-end behavior, session-end eligibility, and weekly eligibility inputs in `apps/web/components/questionnaire/questionnaire-coordinator.tsx`
- [ ] T062 [US4] Mount the coordinator on the authenticated employee dashboard without changing Today-card rendering or monitoring trend rendering in `apps/web/app/(authed)/app/page.tsx`
- [ ] T063 [US4] Apply final Graphite token, lucide icon, focus-ring, 44px target, and responsive text-fit pass across questionnaire components in `apps/web/components/questionnaire/confirmatory-prompt.tsx`, `apps/web/components/questionnaire/session-end-feedback-card.tsx`, `apps/web/components/questionnaire/weekly-check-in-card.tsx`, and `apps/web/components/questionnaire/questionnaire-result-icon.tsx`

**Checkpoint**: All questionnaire surfaces work together without accessibility, privacy, or collision regressions.

---

## Phase 8: Polish and Cross-Cutting Verification

**Purpose**: Verify invariants that span DB, API/client, UI, and out-of-scope surfaces.

- [ ] T064 [P] Add Principle VII non-regression test proving confirmatory outcomes do not suppress, annotate, or otherwise change `TodaysCheckinCard`, `TodayView`, `TodayTrendPlot`, or `SessionTrend` rendering in `apps/web/tests/unit/components/questionnaire/today-trend-untouched.test.tsx`
- [ ] T065 [P] Add Principle VII model-scope regression test proving Feature 012 does not require changes under `packages/ml-video` or `docs/MODELS.md` in `apps/api/tests/test_questionnaire_privacy.py`
- [ ] T066 Run DB/privacy verification and record command/result placeholders in `specs/012-questionnaire-feedback/smoke-tests.md`
- [ ] T067 Run focused web unit/component/e2e/layout verification from `quickstart.md` and record command/result placeholders in `specs/012-questionnaire-feedback/smoke-tests.md`
- [ ] T068 Run final privacy artifact sweep for no service-role questionnaire path, aggregate-only manager returns, no precise contribution timestamp, immutable `window_readings`, and untouched Today/trend rendering; record results in `specs/012-questionnaire-feedback/smoke-tests.md`

---

## Dependencies and Execution Order

### Phase Dependencies

- **Phase 1**: No dependencies.
- **Phase 2**: Depends on Phase 1 and blocks every user story.
- **Phase 3**: Depends on Phase 2 DB/RLS/RPC contracts.
- **Phase 4 (US1)**: Depends on Phase 3 authenticated questionnaire client.
- **Phase 5 (US2)**: Depends on Phase 3 authenticated questionnaire client; coordinator collision work in US4 completes final mounting.
- **Phase 6 (US3)**: Depends on Phase 3 authenticated questionnaire client and weekly RPCs.
- **Phase 7 (US4)**: Depends on US1, US2, and US3 components/helpers existing.
- **Phase 8**: Depends on the desired user stories being complete.

### User Story Dependencies

- **US1 (P1)**: MVP after Phase 3. Independent trigger/prompt/handoff increment.
- **US2 (P2)**: Can start after Phase 3, but final on-screen eligibility depends on the US4 coordinator.
- **US3 (P2)**: Can start after Phase 3, using the weekly submit RPC and private cadence table.
- **US4 (P3)**: Integrates and verifies all surfaces; should run after the three instruments exist.

### Within Each Story

- Principle VII tests first; verify they fail before implementation.
- Shared typed data/client helpers before component persistence wiring.
- Components before coordinator mounting.
- Coordinator mounting after individual instruments exist.
- Privacy regression sweeps before completion.

---

## Parallel Opportunities

- **Setup/docs cluster**: T001 can run independently from T002.
- **Authenticated client test cluster**: T024 and T025 touch distinct test files and can run in parallel.
- **US1 test cluster**: T028, T029, T030, and T031 touch distinct test files and can run in parallel after Phase 3.
- **US2 test cluster**: T038, T039, T040, and T041 touch distinct test files and can run in parallel after Phase 3.
- **US3 test cluster**: T046, T047, and T048 touch distinct test files and can run in parallel after Phase 3.
- **US4 verification cluster**: T052 through T059 touch distinct test files and can run in parallel after the relevant components exist.
- **Polish regression cluster**: T064 and T065 are independent regression tests.

---

## Parallel Example: User Story 1

```text
Task: "T028 trigger state-machine tests in apps/web/tests/unit/lib/questionnaire/confirmatory-trigger.test.ts"
Task: "T029 Notification dismissible=false tests in apps/web/components/notification.test.tsx"
Task: "T030 ConfirmatoryPrompt accessibility/copy tests in apps/web/tests/unit/components/questionnaire/confirmatory-prompt.test.tsx"
Task: "T031 Ren handoff tests in apps/web/tests/unit/components/chat/chat-handoff.test.tsx"
```

---

## Implementation Strategy

### MVP First

1. Complete Phase 1 and Phase 2 so the privacy boundary exists first.
2. Complete Phase 3 authenticated client helpers.
3. Complete Phase 4 User Story 1.
4. Validate sustained-tense trigger, non-dismissable prompt, persistence, false-alarm suppression, Ren handoff, and immutable Today/trend behavior.

### Incremental Delivery

1. Deliver DB/RLS/RPC foundation and privacy tests.
2. Deliver authenticated client helpers.
3. Deliver US1 confirmatory prompt.
4. Deliver US2 session-end feedback.
5. Deliver US3 weekly check-in.
6. Deliver US4 coordinator, accessibility, responsive, reduced-motion, and visual verification.

### Scope Boundaries

- Do not add service-role usage for questionnaire data.
- Do not add `user_id`, `created_at`, `updated_at`, or precise timestamp columns to `weekly_work_environment_contributions`.
- Do not mutate `window_readings`.
- Do not change Today-card or employee trend rendering.
- Do not modify inference model artifacts, model thresholds, `packages/ml-video`, or `docs/MODELS.md` unless a later approved change explicitly expands scope.
