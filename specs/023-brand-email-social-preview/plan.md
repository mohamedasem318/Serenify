# Implementation Plan: Brand Email and Social Preview

**Branch**: `fix/brand-email-social-preview` | **Date**: 2026-07-13 | **Spec**: [spec.md](./spec.md)

## Summary

Make narrowly scoped HTML template changes, extend Next.js root metadata, add a
fixed-size Open Graph image route using the existing icon, and lock the existing
password reset sign-out behavior with a unit test before resolving issue #38.

## Technical Context

**Language/Version**: TypeScript 5, Next.js 16 App Router, React 19, HTML email.

**Primary Dependencies**: Next Metadata API, `next/og`, existing Supabase SSR client.

**Testing**: Vitest source/behavior contracts plus full web lint, typecheck, test, and build.

**Target Platform**: Gmail and standards-capable email clients; social unfurlers; web application at 360px and above.

## Constitution Check

| Principle | Status | Evidence |
|---|---|---|
| I. Privacy by Architecture | PASS | Metadata and email presentation expose no user data; reset uses the existing user-scoped Auth client. |
| II. Subject-Disjoint ML Evaluation | PASS | No ML changes. |
| III. Modality Isolation | PASS | No modality changes. |
| IV. LLM Provider Abstraction | PASS | No LLM changes. |
| V. Calm-First Design Language | PASS | Existing Graphite neutrals and meadow brand accent are retained; semantic stress/destructive colors are unused. |
| VI. Responsive & Accessible by Default | PASS | Email remains table-safe and social image uses fixed 1200x630 geometry with readable contrast. |
| VII. Mandatory Testing Per PR | PASS | Template, metadata, image, and reset contracts are tested before full gates. |
| VIII. Spec-Driven Workflow | PASS | Spec, plan, tasks, and smoke-test artifacts precede implementation. |
| IX. Secrets Discipline | PASS | No keys, environment variables, or service-role usage. |
| X. Dataset Stewardship | PASS | No datasets or model artifacts. |

**Post-design re-check**: PASS. No constitution exception is required.

## Project Structure

```text
supabase/templates/{confirmation.html,recovery.html}
apps/web/app/{layout.tsx,opengraph-image.tsx}
apps/web/tests/unit/
docs/BACKLOG.md
specs/023-brand-email-social-preview/
```

## Complexity Tracking

No constitution violations or complexity exceptions.
