# Quickstart: LLM Client and Ren Chatbot

## Prerequisites

- Repo dependencies installed.
- Supabase local stack available for RLS integration checks when needed.
- LLM provider environment configured outside committed files.
- Prompt files present in `packages/llm-client/prompts/`.
- Visual target available at `serenify-011-chatbot-mock.html`.

## Build Sequence

1. Create `packages/llm-client` as a Python package with provider protocol, Groq/LM Studio adapters, prompt loading, scorer JSON validation/extraction, and telemetry allowlist types.
2. Add chat schema migration for `chat_conversations` and `chat_messages`, explicit grants, ENABLE/FORCE RLS, owner-only policies, and no manager/admin policy.
3. Add FastAPI chat router and orchestration service: send lock, rate limit, Ren + scorer parallel calls, retry/degraded states, fifth-turn rollup, `[END]` rollup/title.
4. Add crisis resources service with Egypt/US rows, universal line, and no-model-generated-number boundary.
5. Build `/app/chat`, extend the persistent pill, add employee Chat nav, and upgrade the home recent-chats card using existing feature-003 shells.
6. Add focused tests: prompt loading, scorer extraction, orchestration failure matrix, RLS privacy, role access, signal separation, crisis no-persist/no-notify, accessibility.
7. Author `smoke-tests.md` during implementation.

## Verification Commands

Frontend:

```bash
cd apps/web
npm run lint
npx tsc --noEmit
npx vitest run --pool=threads
```

API:

```bash
cd apps/api
uv run pytest
```

Root package tests:

```bash
npm test
```

Supabase/RLS, when local integration is available:

```bash
npm run test:seed:integration
```

## Manual Validation Targets

- Employee can open Ren from card, pill, and Chat nav with the same conversation store.
- Team lead/admin/unauthenticated users do not see employee chat entry points and cannot read chat rows.
- Mobile pill is icon-only with `aria-label="Talk to Ren"` and a 44px+ target.
- Crisis from scorer and `[CRISIS]` both render the same calm foggy panel.
- Egypt and US rows match the verified table; unsupported/missing country still shows the universal line.
- Ren text contains no phone number or service name during crisis.
- Crisis creates no persisted flag/event/log/manager notification.
- Chat band appears on recent-chat surfaces only and never in the video card or other physiological surfaces.
- Prompt text is loaded from files and no inline prompt strings exist in app call sites.
