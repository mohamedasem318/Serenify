# Implementation Plan: Questionnaire Feedback

**Branch**: `012-questionnaire-feedback` | **Date**: 2026-06-30 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/012-questionnaire-feedback/spec.md`

## Summary

Build the three Feature 012 questionnaire instruments as a web-first, RLS-first addition:

- A mid-session confirmatory prompt driven by the existing passive monitoring band stream, shown through the feature-003 notification surface with `dismissible:false`.
- A session-end product feedback card that remains employee-private and defaults to "every session" behind a sampling seam.
- A weekly work-environment check-in that separates employee-private cadence from identity-stripped aggregate contributions so feature 017 can consume team summaries without inheriting individual attributed answers.

The implementation will use direct Supabase RLS-as-user writes for employee-private questionnaire rows, a restricted `SECURITY DEFINER` RPC for identity-stripped weekly aggregate submission/read contracts, and client-side state machines that sit beside the existing monitoring and dashboard surfaces. No inference model, model metadata, Today-card rendering, or employee trend rendering changes are part of this plan.

## Technical Context

**Language/Version**: TypeScript 5 with Next.js 16 App Router and React 19 in `apps/web`; SQL/Postgres migrations under `supabase/migrations`; Python 3.10-3.12 FastAPI remains available but is not expanded for this feature.

**Primary Dependencies**: Supabase JS / `@supabase/ssr`, existing browser/server Supabase clients, Radix Dialog through the existing `Notification`, Framer Motion where already used, `lucide-react`, Tailwind CSS v4 with Graphite tokens from `apps/web/app/globals.css`.

**Storage**: Supabase/Postgres. New questionnaire tables plus restricted RPCs. All per-user access is RLS-as-employee. No service-role key. Weekly manager-facing read is aggregate-only through a `SECURITY DEFINER` summary function.

**Testing**: Vitest + Testing Library for hooks/components, Playwright for responsive/theme/reduced-motion gates, SQL/privacy regex tests in the existing pytest privacy style, and optional Supabase integration smoke when available.

**Target Platform**: Authenticated employee web app at 360px minimum through desktop, light and dark themes.

**Project Type**: Monorepo web application with Supabase-backed persistence. No new service, package, or model artifact.

**Performance Goals**: Confirmatory trigger adds no backend polling beyond current live band handling. Weekly/session feedback writes are single-row operations. Aggregate summaries return grouped counts, not row streams.

**Constraints**: RLS on every table; no service-role; no `@theme inline` token remaps; reduced motion through `apps/web/hooks/use-media-query.ts`; passive inference server stays single-worker friendly and must not require cross-worker state.

**Scale/Scope**: Three questionnaire instruments, four new storage concepts, one monitoring-side trigger hook, account/chat route seams only. Feature 017 dashboard UI, recommendations, preference capture, and minimum-headcount hardening remain out of scope.

## Checklist Gate Coverage

| Checklist | Plan gate | Design artifact proving the gate |
|-----------|-----------|----------------------------------|
| `requirements.md` (16/16) | Preserve clarified FRs and do not reopen resolved ambiguities. | This plan, [data-model.md](./data-model.md), and contracts encode the four clarifications as design decisions. |
| `privacy-data-flow.md` (14 items) | Employee-private confirmatory/session feedback, identity-stripped weekly aggregate, immutable windows, no Ren/manager leakage. | [data-model.md](./data-model.md), [questionnaire-storage-rls.md](./contracts/questionnaire-storage-rls.md), [weekly-aggregate-contract.md](./contracts/weekly-aggregate-contract.md). |
| `accessibility.md` (15 items) | Non-misclick-dismissable prompt remains keyboard/screen-reader operable; stepper/progress/focus states; reduced-motion for four animations; 44px/AA. | [confirmatory-trigger-ui.md](./contracts/confirmatory-trigger-ui.md), [feedback-instruments-ui.md](./contracts/feedback-instruments-ui.md). |
| `ux-state-machine.md` (20 items) | Sustained-tense/dwell tunables, one prompt per session, next-session false-alarm suppression, anti-collision, ISO week cadence. | [confirmatory-trigger-ui.md](./contracts/confirmatory-trigger-ui.md), [data-model.md](./data-model.md), [quickstart.md](./quickstart.md). |

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principle | Status | Evidence |
|-----------|--------|----------|
| I. Privacy by Architecture | PASS | Confirmatory/session feedback tables are owner-only. Weekly answers are submitted into rows with no `user_id`; private cadence is separate. Manager contract returns only grouped aggregates. |
| II. Employee Agency & Consent | PASS | All feedback instruments are optional/skippable except the confirmatory prompt, which is answer-only because it is a sticky false-alarm gate and expires on signal drop. |
| III. Explainable AI | PASS | No new model output is exposed. Confirmatory logic consumes the existing coarse band only. |
| IV. AI Boundary | PASS | Ren handoff uses the existing chat entry; product feedback is never sent to Ren. No new LLM provider path. |
| V. Calm-First Design Language | PASS | UI binds to Graphite tokens in `globals.css`, lucide icons, amber only for stress-confirm affordance, meadow for affirmative/success, foggy/muted for neutral attention. |
| VI. Responsive & Accessible | PASS | 360px minimum, 44px targets, WCAG AA in both themes, non-modal sticky prompt accessibility, stepper focus/progress announcements, reduced motion through `useMediaQuery`. |
| VII. Mandatory Testing | PASS | Planned unit, component, SQL/privacy, and Playwright gates cover trigger timing, RLS, aggregate privacy, a11y, responsive layout, and reduced motion. |
| VIII. Spec-Driven Workflow | PASS | Plan builds on spec, clarifications, and four checklists; tasks and smoke tests are deferred to later SpecKit phases. |
| IX. Secrets Discipline | PASS | No service-role key or new secret. Supabase RPCs resolve `auth.uid()` from the caller's authenticated token. |

**Post-design re-check**: PASS. The storage/RLS contracts and UI contracts satisfy the four focused checklists without constitution exceptions.

## Key Decisions

1. **Direct RLS-as-employee for employee-private records.** Confirmatory prompt rows and session-end product feedback are written/read by the authenticated employee through Supabase RLS. There is no FastAPI service-role path and no manager/admin policy.

2. **Split weekly cadence from weekly aggregate facts.** `weekly_checkin_cadence` stores per-employee prompt/skip/completion state but no answers. `weekly_work_environment_contributions` stores answer buckets with `team_manager_id` and `iso_week_start` but no `user_id`. A `SECURITY DEFINER` submit function validates the caller, derives the team bucket from `profiles.manager_id`, inserts the identity-stripped contribution, and updates cadence transactionally.

3. **Manager read contract is aggregate-only from day one.** Feature 017 will call a summary RPC that validates the manager/admin caller and returns grouped counts by sentiment, roadblock, and support. It never returns individual rows. Minimum-headcount suppression is still BACKLOG #123 and must be added before real data collection.

4. **Confirmatory timing lives beside the existing browser monitoring loop.** The hook consumes `WindowOutcome` readings already returned by `submitWindow()` and the `liveSessionId` held by `MonitoringSession`. It tracks consecutive `tense` observations using named constants and browser time, avoiding any cross-worker server state and preserving the inference server's in-memory smoothing constraint.

5. **Window readings remain immutable.** `false_alarm` is represented only on the prompt row as `manager_aggregate_treatment = 'exclude_or_down_weight'` with a required triggering captured time and optional `window_reading_id`. No `window_readings` row is updated, deleted, suppressed, or annotated; Today card and trend components are not touched.

6. **Notification surface is extended, not replaced.** `Notification` gains a backward-compatible `dismissible?: boolean`/non-modal behavior needed by the documented feature-003 seam. The confirmatory prompt passes `dismissible={false}`, omits close UI, prevents escape/outside dismissal, remains keyboard answerable, and does not trap focus or block the rest of the app.

7. **Anti-collision is centralized in a questionnaire coordinator.** Session-end feedback becomes eligible only after the monitoring session is ended and no confirmatory prompt is visible/resolving. If a prompt is open during session end, it resolves first with an expiry reason and session feedback mounts after that state settles.

8. **Model artifacts are not touched.** This feature adds product tunables over the existing `Band` contract, not model thresholds, weights, extractors, metadata, or inference documentation. `docs/MODELS.md` does not enter the later doc sweep unless implementation unexpectedly changes a model artifact.

## Data Model Summary

| Concept | Persisted shape | Privacy/RLS shape |
|---------|-----------------|-------------------|
| Confirmatory prompt outcome | `questionnaire_confirmatory_prompts`: `user_id`, `monitoring_session_id`, optional `trigger_window_reading_id`, required `triggered_window_captured_at`, `trigger_band='tense'`, lifecycle, `outcome in ('confirmed','false_alarm','opened_chat')`, `aggregate_treatment` | Owner-only SELECT/INSERT/UPDATE. Unique prompt per session. No manager policy. False alarm marks the prompt row only. |
| Session-end product feedback | `questionnaire_session_feedback`: `user_id`, `monitoring_session_id`, sentiment, reason, free text, action target, skipped/submitted status, `sampling_policy='every_session'` | Owner-only. Product feedback never reaches Ren, manager tables, or aggregate functions. |
| Weekly cadence | `weekly_checkin_cadence`: `user_id`, `iso_week_start`, `prompt_count`, `skipped_count`, `completed_at`, `last_prompted_at` | Owner-only. Tracks first authed visit and one same-week re-prompt; stores no work-environment answers. |
| Weekly aggregate contribution | `weekly_work_environment_contributions`: `team_manager_id`, `iso_week_start`, sentiment, optional roadblock/support; no precise per-row timestamp | No `user_id`; direct grants revoked. Insert only through caller-validating RPC. Manager read only through grouped aggregate RPC. |

## Project Structure

### Documentation (this feature)

```text
specs/012-questionnaire-feedback/
├── plan.md
├── research.md
├── data-model.md
├── quickstart.md
├── checklists/
│   ├── requirements.md
│   ├── privacy-data-flow.md
│   ├── accessibility.md
│   └── ux-state-machine.md
└── contracts/
    ├── questionnaire-storage-rls.md
    ├── confirmatory-trigger-ui.md
    ├── feedback-instruments-ui.md
    └── weekly-aggregate-contract.md
```

### Source Code (repository root)

```text
apps/web/
├── app/(authed)/app/
│   ├── account/page.tsx                    # add stable placeholder anchors if absent
│   ├── chat/page.tsx                       # existing Ren entry; accept handoff query seam if needed
│   └── page.tsx                            # weekly/session feedback mount point
├── components/
│   ├── notification.tsx                    # add documented dismissible:false behavior
│   ├── monitor/monitoring-session.tsx      # feed band/session events into questionnaire hook
│   └── questionnaire/
│       ├── confirmatory-prompt.tsx
│       ├── session-end-feedback-card.tsx
│       ├── weekly-check-in-card.tsx
│       ├── questionnaire-coordinator.tsx
│       └── questionnaire-result-icon.tsx
├── hooks/use-media-query.ts                # existing reduced-motion source
├── lib/
│   ├── api/questionnaire-client.ts
│   └── questionnaire/
│       ├── constants.ts
│       ├── confirmatory-trigger.ts
│       ├── session-feedback-sampling.ts
│       └── weekly-cadence.ts
└── tests/
    ├── unit/components/questionnaire/
    ├── unit/lib/questionnaire/
    ├── e2e/questionnaire.spec.ts
    └── e2e/questionnaire-layout.spec.ts

supabase/
└── migrations/
    └── 20260630xxxxxx_questionnaire_feedback.sql

apps/api/
└── tests/
    └── test_questionnaire_privacy.py       # SQL/RLS/no-service-role/privacy contract tests
```

**Structure Decision**: Keep this feature in the existing web + Supabase layers. The monitoring API already returns the coarse band; no FastAPI route is required to trigger questionnaires. Supabase RPCs are the narrowest way to write identity-stripped weekly aggregate rows while preserving caller validation and RLS posture.

## Complexity Tracking

No constitution violations or complexity exceptions. The `SECURITY DEFINER` RPCs are not an exception; they are the required privacy boundary for identity-stripped weekly aggregation and will be implemented with explicit auth checks, restricted grants, and no service-role key.
