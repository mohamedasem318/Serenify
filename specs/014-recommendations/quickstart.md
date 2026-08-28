# Quickstart — 014-recommendations

## Run it

```bash
supabase start && supabase db reset --local   # applies the new recommendation_picks migration
npm run -w apps/web dev                       # home card at /app, monitor at /app/monitor
# apps/api (only needed for reflective copy + Ren's pick-awareness):
cd apps/api && uv run --env-file .env uvicorn app.main:app --reload
```

No reading yet today → state 1. Drive states 3–10 by running a monitoring session (or
seeding `window_readings` with Uneasy/Tense rows for today). "Yes, that's me" on the
confirmatory prompt → in-session ConfirmedPickCard + home state 4.

Reflective copy (states 2/9): with apps/api down or `GROQ_API_KEY_REFLECTIVE_COPY` unset
(the second Groq credential, separate from Ren's `GROQ_API_KEY` — Amendment 3, 2026-08-16)
the deterministic fallback renders — that path must always work; generation is the
enhancement. The copy path never uses Ren's key.

## Test it

```bash
npm run -w apps/web test -- --pool=threads    # Vitest (threads: Windows forks-pool EPERM)
npm run -w apps/web lint && npx -w apps/web tsc --noEmit
npm run -w apps/web e2e                       # Playwright (kill port 3000 between suites)
cd apps/api && uv run pytest                  # endpoint + migration-audit gates
cd packages/llm-client && uv run pytest       # prompt registration + JSON contract
```

Key suites: `lib/recommendations/*` (engine determinism SC-001, state coverage SC-002,
copy validation SC-004), `recommendation-storage-rls` static gate + live probe (SC-003),
the untouched 012 suites (SC-006), signal-recording (SC-007).

## Known local gotchas (from memory, verified this repo)

- Windows Vitest needs `--pool=threads`; `hosted-email-template-sync` fails on Windows on
  a clean tree (pre-existing, CI-green on ubuntu).
- Stale `.next` after an interrupted `next dev` → all routes 404 or phantom tsc errors:
  kill port 3000, delete `.next`.
- Links INTO `/app/monitor` must be full-nav `<a>` (soft-nav drops the camera
  Permissions-Policy); links out of it (home, chat) are unaffected.
