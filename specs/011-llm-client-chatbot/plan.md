# Implementation Plan: LLM Client and Ren Chatbot

**Branch**: `011-llm-client-chatbot` | **Date**: 2026-06-28 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `specs/011-llm-client-chatbot/spec.md`

**Visual authority**: `serenify-011-chatbot-mock.html` in the repository root. The approved mock is binding for `/app/chat`, the home recent-chats card, the persistent pill, the crisis panel, and empty states.

**Prompt authority**: fixed prompt files in `packages/llm-client/prompts/`: `ren`, `ren_preference_block`, `scorer_per_message`, `scorer_rollup`, and `auto_title`. Application code wires these files to call sites; it does not inline or rewrite prompt wording.

## Summary

Build a new shared `packages/llm-client` Python package and the first Ren chatbot surface on top of it. The web app owns the employee-facing UI in `apps/web`; FastAPI in `apps/api` owns authenticated LLM orchestration, provider calls, privacy-safe telemetry, and caller-scoped Supabase persistence. Chat content is employee-private through RLS-as-user Postgres tables; crisis handling is live-only, renders verified resources from an app table, never persists a crisis flag, and never routes to manager/admin/employer layers.

The implementation reuses existing feature-003 shell primitives and Graphite tokens (`apps/web/components/ui/*`, `apps/web/components/chat-pill.tsx`, `apps/web/components/home/recent-chats-card.tsx`, `apps/web/components/header/*`, and `apps/web/app/globals.css`). It does not remap Graphite role tokens inside `@theme inline`; crisis uses foggy attention treatment, stress/chat bands use amber only where they represent stress, and crimson remains reserved for destructive actions such as delete.

## Technical Context

**Language/Version**: TypeScript strict mode with Next.js 16 App Router in `apps/web`; Python with FastAPI, Pydantic, and async endpoints in `apps/api`; SQL migrations for Supabase/Postgres; Python package under `packages/llm-client` with import package `llm_client`.

**Primary Dependencies**: Next.js App Router, React, Tailwind CSS v4, shadcn/ui primitives already present in `apps/web/components/ui`, Lucide icons, FastAPI, Supabase clients, Groq `openai/gpt-oss-120b` primary provider, LM Studio `openai/gpt-oss-20b` fallback behind Cloudflare Tunnel, PostHog/Sentry only for privacy-safe operational metadata.

**Storage**: Supabase/Postgres public schema tables for `chat_conversations` and `chat_messages` with explicit grants, ENABLE/FORCE RLS, owner-only policies, and no manager/admin policy. No service-role access path for chat content.

**Testing**: Vitest + React Testing Library for chat UI, LLM-client prompt loading/extractor/scorer contracts, orchestration units, and RLS SQL shape tests; pytest for FastAPI orchestration and privacy telemetry; Playwright employee/team_lead/admin role e2e for access boundaries; SQL/RLS integration checks where Supabase integration is available; `smoke-tests.md` during implementation.

**Target Platform**: Web application on Vercel plus FastAPI on DigitalOcean Droplet; Supabase hosted Postgres/Auth; 360px minimum viewport through desktop; light and dark themes equal priority.

**Project Type**: Full-stack web application plus shared Python LLM package.

**Performance Goals**: Per-message Ren and scorer calls launch concurrently; per-conversation send lock prevents duplicate sends; retry once or twice with backoff for transient LLM failures; rollup every fifth user message and on `[END]`; rate limit sends per employee with a calm inline blocked state.

**Constraints**: RLS-as-user only; no service-role key for chat content; no raw prompt text/message text/crisis booleans/bands/resource-panel events in logs; no model-generated crisis numbers; no inline prompt strings; no chat-derived band on video-derived surfaces; Graphite semantic tokens preserved; 44px minimum touch targets; WCAG AA in light and dark.

**Scale/Scope**: Employee-only chatbot v1 for one owner at a time, with one in-flight send per conversation; persistent conversation history; recent-chats rollup labels; prompt-file seams for future preferences, questionnaire, and recommendations.

**Supabase docs checked**: Official Supabase changelog and RLS/API docs were checked on 2026-06-28. Relevant current guidance: enable RLS on exposed-schema tables, use explicit grants, use `TO authenticated` plus ownership predicates, pair UPDATE policies with both `USING` and `WITH CHECK`, and account for the 2026-04-28 change that new tables may not be exposed to the Data API automatically.

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-checked after Phase 1 design: PASS, no new violations introduced.*

| Principle | Verdict | Notes |
|---|---|---|
| **I. Privacy by Architecture** | PASS | Chat content is employee-private. `chat_conversations` and `chat_messages` have owner-only RLS and no manager/admin/employer policy. Crisis is live-only: no crisis column, badge, event log, manager/admin route, employer notification, or persisted resource-panel event. Privacy-safe telemetry excludes message text, prompt text, crisis booleans, bands, and resource-panel events. |
| **IV. LLM Provider Abstraction** | PASS | All LLM calls go through one `LLMProvider` boundary from `packages/llm-client`; no direct vendor SDK imports in app surfaces. Provider selection is config-driven with Groq primary and LM Studio fallback. Prompts are loaded from `packages/llm-client/prompts/`; inline prompt strings are forbidden. Dual-mode detection uses Ren plus per-message scorer and fifth-turn/end rollup. |
| **V. Calm-First Design Language** | PASS | Reuse Graphite tokens from `apps/web/app/globals.css`. Do not remap role tokens inside `@theme inline`. Crisis panel uses foggy attention, not crimson/red. Crimson appears only for irreversible delete. Chat rollup stress bands stay on recent-chat surfaces and use amber only as a stress signal. Copy stays calm and non-alarmist. |
| **VI. Responsive & Accessible by Default** | PASS | `/app/chat`, pill, panel, recent card, crisis panel, and empty states target 360px minimum, both themes, WCAG AA, 44px touch targets. Mobile pill is icon-only with `aria-label="Talk to Ren"`. Any motion respects the repo media-query hook, not Framer Motion's reduced-motion hook. |
| **VII. Mandatory Testing Per PR** | PASS | Plan defines frontend, backend, package, RLS, privacy, role e2e, and smoke coverage. Required hard cases: listen-first, one suggestion, `[END]`, crisis from scorer and `[CRISIS]`, no generated numbers, prompt-file seams, clean scorer JSON, signal separation, rate limiting, and failed end-flow retry. |
| **VIII. Spec-Driven Workflow** | PASS | `spec.md` and this `plan.md` exist under `specs/011-llm-client-chatbot/`. Phase 0/1 artifacts are generated here. `tasks.md` and `smoke-tests.md` follow in later SpecKit phases. No BACKLOG item is introduced by this plan. |
| **IX. Secrets Discipline** | PASS | This feature introduces the Groq API token and the LM Studio fallback's Cloudflare Tunnel hostname. Both are secrets/private-service pointers under Principle IX: they MUST live only in env files (`.env.local` / deployment-panel variables on Vercel, DigitalOcean, and Supabase), MUST be gitignored, and MUST NOT appear in any committed file — not in `packages/llm-client` provider config, `apps/api` services, prompt files, tests, or fixtures. Provider selection is config-driven by reading these env values at runtime; no key, tunnel URL, or private hostname is hardcoded. Telemetry already excludes prompt/message text (Principle I), so no secret leaks via logs. |

**Privacy review note (Principle I)**: Chat content and crisis handling stay employee-private. All chat persistence runs as the authenticated employee through RLS; service-role access is not used for chat content. A crisis trigger only affects live response rendering and the verified resource panel. Crisis never reaches manager/admin/employer layers, never creates an employer notification, and is not persisted on conversations, messages, dashboards, logs, telemetry, or product behavior tables.

**Gate result**: PASS. No constitutional violation requires a Complexity Tracking exception.

## Project Structure

### Documentation (this feature)

```text
specs/011-llm-client-chatbot/
├── spec.md
├── plan.md
├── research.md
├── data-model.md
├── quickstart.md
├── checklists/
│   ├── requirements.md
│   └── privacy-crisis.md
├── contracts/
│   ├── llm-provider.md
│   ├── scorer-json.md
│   ├── chat-storage-rls.md
│   ├── crisis-resources.md
│   └── orchestration.md
└── tasks.md                  # /speckit-tasks output, not created by /speckit-plan
```

### Source Code (repository root)

```text
packages/
└── llm-client/                         # NEW Python package, consumed by apps/api via uv
    ├── pyproject.toml
    ├── src/
    │   └── llm_client/
    │       ├── __init__.py
    │       ├── provider.py             # LLMProvider protocol and provider registry
    │       ├── groq_provider.py
    │       ├── lm_studio_provider.py
    │       ├── prompts.py              # loads prompt files; no inline prompt strings
    │       ├── scorer.py               # scorer contract validation + extractor
    │       └── telemetry.py            # privacy-safe metadata types
    └── prompts/
        ├── ren
        ├── ren_preference_block
        ├── scorer_per_message
        ├── scorer_rollup
        └── auto_title

apps/api/
├── app/
│   ├── routers/chat.py                 # employee-only chat endpoints
│   ├── services/chat_orchestrator.py   # Ren + scorer orchestration, rollup/title
│   ├── services/llm_client.py          # thin app integration around packages/llm-client
│   ├── services/crisis_resources.py    # verified table, universal emergency line
│   ├── supabase_user.py                # reuse RLS-as-user client pattern; no service role
│   └── schemas.py                      # chat request/response Pydantic schemas
└── tests/
    ├── test_chat_orchestration.py
    ├── test_chat_privacy.py
    └── test_crisis_resources.py

apps/web/
├── app/(authed)/app/chat/
│   ├── page.tsx                        # NEW /app/chat full page
│   └── actions.ts                      # typed server actions/API client wrappers
├── components/
│   ├── chat-pill.tsx                   # extend existing pill to Talk to Ren/panel behavior
│   ├── chat/                           # NEW Ren chat components
│   ├── home/recent-chats-card.tsx      # extend existing feature-003 card shell
│   ├── header/center-nav.tsx           # add employee Chat item
│   └── ui/*                            # reuse existing Button/Card/Dialog/Sheet/etc.
├── lib/
│   ├── api/chat-client.ts              # typed client, no untyped app fetch
│   └── supabase/*                      # existing auth/session helpers
└── tests/
    ├── unit/components/chat/*
    └── e2e/chat.spec.ts

supabase/
└── migrations/
    └── <timestamp>_chat_conversations_messages.sql
```

**Structure Decision**: Add one shared Python package for the LLM provider/prompt/scorer contract, one FastAPI chat orchestration layer, and one employee-only web surface. Database state lives in Supabase with caller-scoped RLS. The web app does not import vendor SDKs and does not embed prompt strings.

## Phase 0 Research Output

See [research.md](./research.md). Decisions are closed; no open clarification markers remain.

## Phase 1 Design Output

Generated artifacts:

- [data-model.md](./data-model.md)
- [contracts/llm-provider.md](./contracts/llm-provider.md)
- [contracts/scorer-json.md](./contracts/scorer-json.md)
- [contracts/chat-storage-rls.md](./contracts/chat-storage-rls.md)
- [contracts/crisis-resources.md](./contracts/crisis-resources.md)
- [contracts/orchestration.md](./contracts/orchestration.md)
- [quickstart.md](./quickstart.md)

## Complexity Tracking

No constitution violations or stack deviations are planned.

| Item | Status | Note |
|---|---|---|
| `packages/llm-client` does not exist yet | Planned addition | The package is explicitly required by the locked architecture and this feature. |
| Prompt files may not exist yet | Planned addition | The prompt directory and fixed prompt files are implementation tasks; application code must load them from disk. |
| `packages/llm-client` needs API wiring | Planned local package dependency | Add it to `apps/api/pyproject.toml` as a local editable `uv` source, matching the existing `ml-video` pattern. |
