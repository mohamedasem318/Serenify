# Implementation Plan: Cold-Start Readiness

**Branch**: `fix/cold-start-readiness` | **Date**: 2026-07-13 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/022-cold-start-readiness/spec.md`

## Summary

Extend the existing typed health and monitoring clients with 75-second bounded requests, expose check-in creation through the existing Graphite permission surface, retain acquire-late camera privacy, and add the prepared Claude SpecKit structural guard to CI.

## Technical Context

**Language/Version**: TypeScript 5, Next.js 16 App Router, React 19, Node.js GitHub Actions runner.

**Primary Dependencies**: Existing browser `fetch` and `AbortController`, Tailwind CSS v4 Graphite tokens, Vitest, Testing Library.

**Storage**: N/A; no database or persistence changes.

**Testing**: Vitest and Testing Library focused regression tests; complete web test, lint, typecheck, and production build; Node CI guard positive and negative fixtures.

**Target Platform**: Authenticated web application from 360px phones through desktop, in light and dark themes.

**Project Type**: Existing monorepo web application; no new service or package.

**Performance Goals**: Warm responses proceed immediately; cold responses may remain pending up to 75 seconds; no page-load keepalive or added polling.

**Constraints**: Explicit-action wake only; camera opens after authenticated session creation; 44px touch target; no new animation; no service-role, secret, model, SVG, raw-signal, or inference launch changes.

**Scale/Scope**: Two existing API client calls, three existing UI components, focused tests, and one CI guard.

## Constitution Check

| Principle | Status | Evidence |
|---|---|---|
| I. Privacy by Architecture | PASS | Session creation remains before camera acquisition; no media exists during wake and no raw signal leaves existing boundaries. |
| II. Subject-Disjoint ML Evaluation | PASS | No model, dataset, split, threshold, or evaluation changes. |
| III. Modality Isolation | PASS | No modality package, raw signal type, or transport changes. |
| IV. LLM Provider Abstraction | PASS | No LLM client or provider changes. |
| V. Calm-First Design Language | PASS | Existing meadow permission surface carries pending; foggy remains failure; amber/crimson are unused. |
| VI. Responsive & Accessible by Default | PASS | Existing 48px control is retained, disabled semantics and polite live status are added, and 360px/light/dark checks are required. |
| VII. Mandatory Testing Per PR | PASS | TDD covers timeout, privacy order, duplicate prevention, semantics, and responsive presentation; full web gates are required. |
| VIII. Spec-Driven Workflow | PASS | `spec.md`, this plan, `tasks.md`, and `smoke-tests.md` exist before implementation; CI protects managed SpecKit skills. |
| IX. Secrets Discipline | PASS | No environment, credential, hostname, or service-role changes. |
| X. Dataset Stewardship | PASS | No dataset, model artifact, identity, or subject media changes. |

**Post-design re-check**: PASS. The bounded typed-client contract and state-only UI extension preserve all affected invariants without an exception.

## Project Structure

```text
specs/022-cold-start-readiness/
├── spec.md
├── plan.md
├── tasks.md
└── smoke-tests.md

apps/web/
├── lib/api/{anchor-client.ts,monitoring-client.ts}
├── components/anchor/green-room.tsx
├── components/monitor/{monitoring-session.tsx,op-surfaces.tsx}
└── tests plus colocated API/component tests

scripts/check-speckit-skills.mjs
.github/workflows/ci.yml
.claude/skills/speckit-agent-context-update/SKILL.md
```

**Structure Decision**: Extend existing typed clients and state-owning components. The CI guard remains a root Node script because it validates repository structure before application execution.

## Complexity Tracking

No constitution violations or complexity exceptions.
