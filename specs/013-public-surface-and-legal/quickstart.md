# Quickstart — Public Surface & Legal (013)

**Branch**: `013-public-surface-and-legal` | **Plan**: [plan.md](./plan.md) | **Research**: [research.md](./research.md) | **Data model**: [data-model.md](./data-model.md)

How to build, run, and validate this feature locally. This is the only artifact in the set that is not a re-file of the plan — it assembles commands and orderings that the plan states in prose (§14 phasing, §12 testing, §15 risks) into a runnable sequence. It adds no decisions.

## Prerequisites

- Repo bootstrapped; `apps/web` dependencies installed; `apps/api` Python env available (`uv`).
- Local Supabase running (`supabase start`). The consent migration is applied with `supabase db reset` — note that this also re-seeds, so do not run it against a deploy target (see project memory on `seed:accounts`).
- Visual reference: `docs/mockups/serenify-landing-mock.html`. It is **gitignored**, so a default `rg` cannot see it — every search of it must pass `--no-ignore` (`plan.md` §10.1).
- Next 16: `apps/web/AGENTS.md` requires reading the relevant guide under `node_modules/next/dist/docs/` before writing code. Two areas here are specifically exposed — **route groups + the root `page.tsx`** (P3/P6) and **`next/image` sizing** (P7). Do not infer them from Next 14/15 habits (`plan.md` §2, R9).

## Before P1 — the CI trigger fix (R1)

`.github/workflows/ci.yml` triggers only on `main`, so **no guard check runs on any PR into this feature branch**. Land the trigger fix first, in its own tiny PR. Until it lands, every phase PR runs the checks below locally and records the result in the PR body (`plan.md` §15, R1).

## Build sequence (matches `plan.md` §14 — Order A)

1. **P1 — Wordmark.** `components/brand/wordmark.tsx`; three existing sites converted; OG card + both email templates hand-synced; the sync contract test. Contract: [`contracts/wordmark.md`](./contracts/wordmark.md).
2. **P2 — Consent foundation.** `lib/consent/{registry,evaluate}.ts`; the migration; the additive `handle_new_user()` edit; `apps/api/tests/test_consent_privacy.py`; the exhaustive evaluator suite. **No UI.** Shapes: [`data-model.md`](./data-model.md); surface: [`contracts/consent-evaluate.md`](./contracts/consent-evaluate.md).
3. **P3 — Legal + public shell.** The `(public)` route group, both documents, navbar + footer + mobile nav, the copy-invariant tests, and the `README.md` fix (`plan.md` §0.3). **`/` is untouched.** Contract: [`contracts/public-surface.md`](./contracts/public-surface.md) §9.3/§9.4.
4. **P4 — The two prompting gates.** Signup acknowledgement; camera/inference gate at all three capture routes; the Account → Baseline route back. Contract: [`contracts/consent-gates.md`](./contracts/consent-gates.md) §7.1/§7.2.
5. **P5 — App-shell entry gate.** Alone in its PR, so `git revert` stays clean. Contract: [`contracts/consent-gates.md`](./contracts/consent-gates.md) §7.3.
6. **P6 — Landing page.** Root-route takeover; `lib/bands.ts` + the geometry refactor; `bloom.tsx`'s optional `color` prop; the hero story card with the three approved strings from `plan.md` §10.3; the layout stability spec. Contract: [`contracts/landing-hero-story.md`](./contracts/landing-hero-story.md).
7. **P7 — Team section.** Photo crop + asset placement; frozen silhouettes; overlay, name cards, links, caption, supervisors. Contract: [`contracts/public-surface.md`](./contracts/public-surface.md) §9.2.
8. **P8 — Wrap.** `smoke-tests.md` authored and run (`plan.md` §13); BACKLOG/issue closures; docs entries; merge to `main`.

## Verify

```bash
# Apply the migration locally
supabase db reset

# Database privacy gate — static parse of the migration, no live DB
uv run pytest apps/api/tests/test_consent_privacy.py

# Web: lint, types, unit + component tests
npm --workspace web run lint
npm --workspace web run typecheck
npm --workspace web run test
```

> **Windows note:** run Vitest with `--pool=threads` — the default forks pool crashes at startup on this machine with `kill EPERM` (project memory). e.g. `npx vitest run --pool=threads` from `apps/web`.

```bash
# Layout-only Playwright (real browser, real layout, NO database)
npm --workspace web run test:layout -- landing-hero-stability

# The two narrow root-route checks live with the existing auth specs (research.md §12.2)
npm --workspace web run test:e2e
```

**Live RLS probe (by hand, once, against local Supabase).** Use the repo's documented per-transaction impersonation — `SET LOCAL ROLE` + `set_config('request.jwt.claims', …, true)` — and confirm, as an `authenticated` user:

- `UPDATE` own `user_consents` row → `42501` (the immutability trigger)
- `DELETE` own row → 0 rows / permission denied (no policy, no grant)
- `SELECT` another user's row → 0 rows

**Then run the app** (`npm --workspace web run dev`) and walk the surface:

- `/` signed out → the landing page; signed in → `/app`; `/?code=…` → `/auth/callback?code=…` (`research.md` §11).
- `/terms` and `/privacy` render for a signed-out visitor and are reachable from the footer.
- Signup with the box unchecked → blocked with a reason and **no account**; opening either document in a new tab loses no entered data.
- `/onboarding`, `/app/calibrate`, `/app/monitor` → the camera consent surface appears **before** the browser's camera permission prompt.
- Decline camera consent → the weekly work-environment check-in on `/app` still works.

The human pass that automation cannot cover is the ST table in `plan.md` §13, authored into `smoke-tests.md` in P8 and run by Mohamed before the branch merges.

## Gotchas

- **The mock is gitignored.** `rg --no-ignore "…" docs/mockups/` or you will search nothing and conclude the line is absent (`plan.md` §10.1).
- **The four approved strings are fixed copy.** They go into `lib/landing/copy.ts` character-for-character from `plan.md` §10.3 and are not re-worded at implementation time. The closing beat's two clauses must stay in the approved order.
- **Silhouette paths are copied verbatim and frozen** (length + SHA-256 asserted). Never re-trace or reformat them.
- **The camera gate fails CLOSED, the app-shell gate fails OPEN.** That asymmetry is deliberate and unit-asserted in both directions (`contracts/consent-gates.md` §7.2, §7.3).
- **`CONSENT_ENTRY_GATE_ENABLED`** is the kill switch for the shell gate. It is server-only, defaults to `true`, and a Vercel env change needs a redeploy — fast, not instant.
- **`/` stays `force-dynamic`.** That is a known, accepted cost (`plan.md` §15, R11).
- **Never `git push` to `main`** — it is protected; land via PR with squash merge (project memory).
