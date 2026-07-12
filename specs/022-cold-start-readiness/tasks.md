# Tasks: Cold-Start Readiness

**Input**: Design documents from `/specs/022-cold-start-readiness/`

**Prerequisites**: [spec.md](./spec.md), [plan.md](./plan.md)

## Phase 1: Bounded Wake Requests

- [x] T001 [US1] Add a failing default-timeout test in `apps/web/lib/api/anchor-client.test.ts`.
- [x] T002 [US1] Change `checkHealth` default timeout to 75 seconds and verify focused tests pass.
- [x] T003 [US2] Add a failing abort/result test in `apps/web/tests/unit/lib/monitoring-client.test.ts`.
- [x] T004 [US2] Add a bounded `AbortController` timeout to `createSession` and verify focused tests pass.

## Phase 2: Accessible Responsive Pending State

- [x] T005 [US2] Add failing pending, camera-order, and duplicate-activation tests in monitor component suites.
- [x] T006 [US2] Add local `starting` state to `MonitoringSession` and expose it through `OpSurfaces`.
- [x] T007 [US2] Keep the existing 48px meadow action, disable/relabel it during wake, and add polite live status semantics.
- [x] T008 [US1] Add a failing calibration copy assertion and update the existing checking message.
- [x] T009 [US1] Verify pending copy and controls at 360px and desktop in light and dark themes without clipping or overlap.

## Phase 3: SpecKit Guard

- [x] T010 [US3] Port only the prepared workflow, package script, guard script, and required managed skill into the isolated branch.
- [x] T011 [US3] Run the guard successfully in the repository.
- [x] T012 [US3] Prove the guard fails against a temporary fixture missing one required `SKILL.md`.

## Phase 4: Verification and Delivery

- [x] T013 Run focused tests, full Vitest, lint, typecheck, and production build.
- [x] T014 Run the SpecKit guard, diff check, secret scan, and all ten constitution checks.
- [x] T015 Run `graphify update .` and keep generated graph artifacts out of the PR.
- [x] T016 Push the branch and open a PR with test and constitution evidence ([#143](https://github.com/mohamedasem318/Serenify/pull/143)).
- [ ] T017 Record Mohamed's production smoke-test sign-off in `smoke-tests.md` before merge.

## Dependencies

- T001 precedes T002; T003 precedes T004.
- T005 precedes T006-T007; T008 precedes calibration copy implementation.
- T009 follows the UI implementation.
- T013-T016 follow implementation and CI guard tasks.
- T017 follows deployment and is the final merge gate.
