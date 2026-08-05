# Security Slice 4 — Secrets Handling

> **Audit-only.** This document records findings; it applies no fixes. Mohamed
> reviews these with claude.ai, decides which to apply, and a follow-up Claude
> Code session lands the approved fixes on this same branch
> (`security/04-secrets-handling`). No application, script, or config code is
> changed by the commit that introduces this doc.

## Summary

This slice audited how secrets enter, propagate, and exit the application:
the `.env` surface and its documentation; the `NEXT_PUBLIC_*` prefix discipline
and whether any server-only secret leaks into the client JavaScript bundle; the
`console.*` / logger surface; the full `SUPABASE_SERVICE_ROLE_KEY` flow (every
read, every caller, every guard); auxiliary third-party secrets; and git history.

**Headline posture: clean.** The one true server-secret —
`SUPABASE_SERVICE_ROLE_KEY` — is read in exactly three places (one production,
one seed script, one Playwright helper), is always sourced from `process.env`
(never hardcoded), and is **not reachable from the client bundle**.

> **Status update (2026-08-05, #179):** the one *production* read-site described
> throughout this audit — `apps/web/lib/supabase/admin.ts`, whose sole importer
> was `app/api/admin/invite/route.ts` — was **deleted in PR #142** (production
> cutover), and `apps/web/tests/unit/runtime-secret-posture.test.ts` now
> actively enforces its absence (forbidden-token scan over `app/` + `lib/`, plus
> an assertion that `lib/supabase/admin.ts` does not exist). The key is
> **test/scripts-infrastructure only** today; its documented home for e2e setup
> is the `tests/e2e/setup/global-setup.ts` header. The findings below are the
> audit as it stood on 2026-05-25 and are kept as written. The
privilege-relevant controls were verified *empirically*, not just read:

- A **production build** (`next build`, Turbopack, 28 chunks / 1.8 MB
  `.next/static`) was searched for the actual service-role key **value** (read
  out of `.env.local` at search time, never printed): **0 matches**. The literals
  `service_role`, `SUPABASE_SERVICE_ROLE_KEY`, and `supabase/admin` also returned
  **0**. As a positive control proving the method works, the **anon** key
  (`NEXT_PUBLIC_`-prefixed, intended-public) was found in exactly **1** chunk.
- **Git history** carries **no** `.env*` file other than the tracked
  `.env.local.example`, **0** JWT-shaped literals across all refs (conclusive
  that no real or demo key value was ever committed), and **0** third-party key
  prefixes (`sk_live_`, `ghp_`, `AKIA`, `xoxb-`, …).

**The most important adjudication is a *non*-promotion.** A reviewing subagent
flagged that the Playwright helper `tests/e2e/setup/admin-client.ts` reads the
service-role key without an `import "server-only"` guard. Verifying the import
graph showed the file is imported **only** from `tests/e2e/**` (never from any
route, layout, Server Component, or `"use client"` file), so Next.js never
bundles it; it also carries a `NODE_ENV==='production'` throw at module load.
Adding `server-only` would be pointless (the file is meant to run in the Node
test runner, not a render). This is therefore **Audited-clean #4**, *not* a
finding — exactly the over-rating the audit was warned to guard against.

The residual is **three `low` items**, all hygiene / documentation / ops-resilience
(none is a reachable secret exposure):

**Finding counts by severity:** `critical` 0 · `high` 0 · `med` 0 · `low` 3
(3 total).

| # | Title | Severity |
|---|-------|----------|
| 1 | No single validated env-access module — core Supabase vars read via the `!` non-null assertion at 7 sites, with no presence/shape/prefix guard (fail-late on misconfig) | low |
| 2 | Five test/infrastructure env vars are read by code but undocumented in `.env.local.example` | low |
| 3 | The seed CLI prints the shared demo-account password + synthetic demo emails to stdout/stderr (CI-log capture is the only residual; by-design for a local fixture tool) | low |

### Adjudication (2026-05-25 — Mohamed)

All three findings are **approved for the fix pass** on this branch. (No fix code
is in the commit that introduces this doc; a fresh Claude Code session applies
them. Severities are unchanged — all `low` — and the fixes harden posture rather
than close a reachable exploit.)

1. **F1 — apply now, not deferred.** The `NEXT_PUBLIC_`-prefix-discipline
   guarantee was verified *by hand* this slice; a single validated env module
   makes it **regression-proof** — a real ongoing benefit that justifies touching
   the 7 read sites now rather than waiting for a config-touching feature.
2. **F2 — document them.** Contributors find `.env.local.example` before they
   find the code that reads each var; "fallbacks are documentation" holds in
   theory, but the example file is where people actually look. Trivial cost.
3. **F3 — gate the banner.** Wrap `passwordBanner()` in a `process.stdout.isTTY`
   check; the check is essentially free and the CI-log residual stops mattering
   immediately.

---

## Env-var inventory

Every environment variable read anywhere in the repo. Classification: `public`
(safe to inline into the client bundle), `server-secret` (must never reach the
client), `infrastructure` (build/deploy/test/CLI-time only — not a secret).

| Name | Read at (file:line) | Class | In `.env.local.example`? | Sane default? | Type-validated? |
|---|---|---|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | `apps/web/lib/supabase/client.ts:5`, `server.ts:8`, `admin.ts:15`, `proxy.ts:34`, `app/auth/callback/route.ts:46`, `app/(authed)/app/account/actions.ts:111`, `tests/e2e/setup/admin-client.ts:23`, `tests/e2e/setup/global-setup.ts:25`; `scripts/lib/env.ts:150` | public | yes | no (`!` at prod sites; `?? ""` only in `global-setup.ts:25`) | none in prod code; `global-setup.ts:26` does a localhost-substring guard; `scripts/lib/env.ts:107` `requireEnv` throws if empty |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | `apps/web/lib/supabase/client.ts:6`, `server.ts:9`, `app/auth/callback/route.ts:47`, `app/(authed)/app/account/actions.ts:112` | public | yes | no (`!` assertion) | none |
| `SUPABASE_SERVICE_ROLE_KEY` | ~~`apps/web/lib/supabase/admin.ts:16`~~ (deleted in #142 — see status update above), `tests/e2e/setup/admin-client.ts:24`; `scripts/lib/supabase-admin.ts:25`, `scripts/lib/env.ts:128` | **server-secret** | yes | ~~no in app (`!`)~~ (no app read-site since #142); **yes** in scripts (`requireEnv` throws a clear error) | presence-checked in `scripts/lib/env.ts:128` (`requireEnv`); none in app code |
| `SITE_URL` | ~~`apps/web/app/api/admin/invite/route.ts:60,84`~~ (route deleted in #142), `app/(auth)/forgot-password/actions.ts:19`, `app/(auth)/signup/actions.ts:34` | infrastructure (server config — a base URL, not a secret) | yes | yes (`?? "http://localhost:3000"` at every site) | none (no URL parse) |
| `NODE_ENV` | `apps/web/lib/supabase/server.ts:35`, `proxy.ts:57`, `app/auth/callback/route.ts:69,101`, `tests/e2e/setup/admin-client.ts:1`; `scripts/lib/env.ts:114`, `scripts/lib/supabase-admin.ts:1` | infrastructure | framework-provided | yes (compared `=== "production"`; falsy if unset) | none (string equality) |
| `SUPABASE_PROJECT_REF` | `scripts/lib/env.ts:131` | infrastructure (project identifier for the `--remote` seed path — not a secret) | no | yes (only required when `--remote` is passed; otherwise ignored) | presence-checked when `--remote` |
| `PLAYWRIGHT_PORT` | `apps/web/playwright.config.ts:11` | infrastructure (test-only) | no | yes (`?? 3000`, `Number()`-coerced) | coerced |
| `CI` | `apps/web/playwright.config.ts:20,21,35` | infrastructure (test/CI-only) | no | yes (used as truthy boolean) | none |
| `MAILPIT_URL` | `apps/web/tests/e2e/helpers.ts:54` | infrastructure (test-only) | no | yes (`?? "http://127.0.0.1:54324"`) | none |
| `TEST_ADMIN_EMAIL` | `apps/web/tests/e2e/admin-seeded.spec.ts:17`, `team-lead-seeded.spec.ts:16` | infrastructure (test-only) | no | n/a — set in-process by `global-setup.ts:72` from a hardcoded constant before any spec reads it | none |
| `TEST_ADMIN_PASSWORD` | `apps/web/tests/e2e/admin-seeded.spec.ts:18`, `team-lead-seeded.spec.ts:17` | infrastructure (test-only) | no | n/a — set in-process by `global-setup.ts:73` | none |

> `scripts/lib/env.ts` also reads the npm-lifecycle vars `npm_config_reset` /
> `npm_config_remote` (`:100-101`) as a PowerShell-flag-forwarding fallback —
> npm-provided, not configuration secrets; out of inventory scope.

---

## Fix-pass summary

**Date**: 2026-05-25. **Branch**: `security/04-secrets-handling`. **PR**: #9.

All three findings are **fixed** across three commits. The severity rollup is
unchanged before/after — every finding was `low` (hygiene / documentation /
ops-resilience), so the rollup stays `critical 0 · high 0 · med 0 · low 3`; the
fixes harden posture rather than close a reachable exploit.

**Approach** — one fix commit per finding:

- `94a14d6` — **F1**: a single Zod-validated env module
  (`apps/web/lib/env/{schema,client,server}.ts`). The Supabase credential vars
  (`NEXT_PUBLIC_SUPABASE_URL`/`ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`) and
  `SITE_URL` now route through it; the eight scattered `process.env.X!` reads are
  replaced, and a missing/malformed value throws a clear, field-listed error at
  boot. `serverEnv` carries `import "server-only"`, so the service-role key is
  structurally unreachable from the client bundle. The pure `schema.ts` is
  unit-tested; the `server-only` binding is never imported by a test (the
  `server-only` package's default export throws outside Next's `react-server`
  condition — i.e. in Vitest), so `tests/unit/setup.ts` seeds schema-valid
  placeholder env. `NODE_ENV` checks stay inline (framework-managed, not a
  fail-late `!` read).
- `f61a26c` — **F2**: `.env.local.example` documents the five test/infra vars
  + `SUPABASE_PROJECT_REF` under a commented "Test-only / infrastructure" block.
- `9dcb70a` — **F3**: `scripts/seed-demo.ts` gates `passwordBanner()` behind
  `process.stdout.isTTY`.

**Re-verification (the highest-value check) — verbatim, identical to the audit
baseline.** Post-refactor production build (`next build`, Turbopack), then the
slice-4 value-extraction grep against `.next/static` (key values read from
`.env.local` at search time, never printed):

```
[SECRET]  service-role key value in .next/static : 0 files   (MUST be 0)   PASS
[CONTROL] anon key value in .next/static          : 1 file    (MUST be >=1) PASS
literal 'service_role'                             : 0
literal 'SUPABASE_SERVICE_ROLE_KEY'                : 0
literal 'supabase/admin'                           : 0
```

The refactor moved *where* `process.env.SUPABASE_SERVICE_ROLE_KEY` is read (now
the `server-only` `serverEnv`), not *whether* it leaks — the empirical check
confirms the prefix discipline still holds.

**Tests**: typecheck clean (`tsc --noEmit`). Vitest unit **227 passed** (24 files;
includes the 7-case `lib/env/schema` suite). Root seed unit **20 passed / 12
skipped**; seed **integration 32 passed** (4 files, against live local Supabase —
exercises the F3 seed flow; the non-TTY run printed the summary table with **no**
password banner, confirming the gate). Playwright e2e **57 passed** (chromium /
firefox / webkit, 19 each) — full matrix green on the first run, no flakes.

**Decisions**: `docs/DECISIONS.md` (2026-05-25 — Security slice 4) records the
three policy choices: validated env module as the single boot-time gate for
Supabase credentials, complete `.env.local.example`, and TTY gating for sensitive
CLI output. **Cloud-dashboard parity: n/a** — env values still live in the
platform panels; this slice changes how the app *reads* them locally and adds
boot-time validation.

---

## Findings

## Finding 1: No single validated env-access module — core Supabase vars read via `!` at 7 sites with no presence/shape/prefix guard

- **Severity**: `low`
- **Surface**: `apps/web/lib/supabase/client.ts:5-6`, `server.ts:8-9`, `admin.ts:15-16`, `proxy.ts:34-35`, `app/auth/callback/route.ts:46-47`, `app/(authed)/app/account/actions.ts:111-112`, `tests/e2e/setup/admin-client.ts:23-24` (the app/web read sites for the three Supabase vars).
- **What**: `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, and `SUPABASE_SERVICE_ROLE_KEY` are each read with TypeScript's `!` non-null assertion and no `??` fallback or runtime presence check in the app code. Each read site re-reads `process.env` directly; there is no single validated env module. (Contrast `scripts/lib/env.ts:105-111` `requireEnv`, which throws a clear `Required env var X is missing or empty` — the app code has no equivalent.)
- **Why it's a risk**: This is misconfiguration-resilience / fail-fast hygiene (OWASP A05), **not** a secret-leak. A missing/empty var yields `undefined`, which the Supabase client constructor accepts and fails on later with an opaque deep-stack error rather than a clear "env var X is required" message at boot. The deeper point is the *absence of a natural home for shape/prefix invariants*: a validated env module is exactly where you would assert "`SUPABASE_SERVICE_ROLE_KEY` must be present, must be a well-formed JWT, and must **not** be `NEXT_PUBLIC_`-prefixed" — turning the prefix-discipline guarantee this slice verified by hand into an enforced, regression-proof check. No security exposure today; this is the most *actionable* of the three findings.
- **Suggested fix** (fix pass, not this slice): introduce one server-side env module (e.g. a small Zod schema parsed once at startup) that presence-checks all three vars, URL-parses `NEXT_PUBLIC_SUPABASE_URL`, and length/prefix-checks the keys; export the typed values and consume them at the seven read sites instead of re-reading `process.env`. Note: this touches 7 app read sites (wider blast radius than a typical `low` fix) — see Open questions.
- **Status**: `fixed in 94a14d6`. A single Zod-validated env module (`apps/web/lib/env/{schema,client,server}.ts`) now gates the Supabase credential vars + `SITE_URL`; the eight `process.env.X!` reads are replaced, and `serverEnv` carries `import "server-only"` so the service-role key is structurally unreachable from the client bundle. Re-verified empirically — service-role key value still **absent** from `.next/static` (0 matches), anon key still **present** (1, positive control). (Adjudicated 2026-05-25 → apply now, not deferred; severity held at `low` — informational, the fix is the same.) See DECISIONS.md (2026-05-25 — Security slice 4, choice 1).

## Finding 2: Five test/infrastructure env vars are read by code but undocumented in `.env.local.example`

- **Severity**: `low`
- **Surface**: `apps/web/playwright.config.ts:11` (`PLAYWRIGHT_PORT`), `:20-35` (`CI`), `apps/web/tests/e2e/helpers.ts:54` (`MAILPIT_URL`), `apps/web/tests/e2e/*.spec.ts` (`TEST_ADMIN_EMAIL`, `TEST_ADMIN_PASSWORD`). (`SUPABASE_PROJECT_REF`, read by `scripts/lib/env.ts:131`, is likewise undocumented but is a seed-only infra identifier — recorded here for completeness.)
- **What**: Five env vars are read by web/test code but absent from the `.env.local.example` template. All are infrastructure/test-only; all have a fallback or are populated in-process (the `TEST_ADMIN_*` pair is seeded from hardcoded constants in `global-setup.ts:20-21` before any spec reads it).
- **Why it's a risk**: documentation completeness only — none carries a secret, none is required for the production app to run. A new contributor reading `.env.local.example` does not learn these knobs exist, but the fallbacks mean nothing breaks. Lowest-priority of the three.
- **Suggested fix** (fix pass): optionally add a commented "test-only (defaults shown)" block to `.env.local.example`, or leave as-is since each is documented implicitly by its fallback and the `globalSetup` flow. See Open questions.
- **Status**: `fixed in f61a26c`. `.env.local.example` now lists `PLAYWRIGHT_PORT`, `CI`, `MAILPIT_URL`, `TEST_ADMIN_EMAIL`, `TEST_ADMIN_PASSWORD`, and `SUPABASE_PROJECT_REF` under a commented "Test-only / infrastructure (defaults shown)" block. See DECISIONS.md (2026-05-25 — Security slice 4, choice 2).

## Finding 3: The seed CLI prints the shared demo-account password + synthetic demo emails to stdout/stderr

- **Severity**: `low`
- **Surface**: `scripts/lib/banner.ts:56` (`passwordBanner`, rendered via `scripts/seed-demo.ts:114`); demo-email / raw-error writes at `scripts/seed-demo.ts:53,86,109`.
- **What**: The seed CLI prints the shared demo-account password (`SHARED_PASSWORD`, a hardcoded **non-production** constant) and the synthetic demo emails (`@demo.serenify.local`) to stdout, and writes Supabase `error.message` from `deleteUser`/`createUser`/`upsert` to stderr.
- **Why it's a risk**: low and arguably by-design. This is a local developer CLI; the password is a fixed demo constant (not a real credential), the emails are synthetic, and the banner deliberately omits UUIDs and real secrets (the file's own comment cites Principle IX). The only residual is **CI-log capture**: if the seed step ever runs in CI with captured output, the demo password lands in a build log. It never touches the app-runtime log surface. The service-role key is **never** printed (verified — `scripts/lib/supabase-admin.ts` has zero log statements).
- **Suggested fix** (fix pass): if the seed ever runs in CI, gate `passwordBanner()` behind an interactive-TTY check (`process.stdout.isTTY`); otherwise no change. See Open questions.
- **Status**: `fixed in 9dcb70a`. `scripts/seed-demo.ts` now prints `passwordBanner()` only when `process.stdout.isTTY`. Verified empirically — a non-interactive (piped) seed run prints the summary table with **no** password banner following it; diagnostic `stderr` writes are unchanged. See DECISIONS.md (2026-05-25 — Security slice 4, choice 3).

---

## Audited and clean

Affirmative record — each surface below was examined (and, where marked,
verified *empirically* against a production build or git history) and returned no
finding. This is the most-cited section in slices 1–3; kept explicit.

1. **Service-role key flow is tightly isolated** — exactly three read sites
   (`apps/web/lib/supabase/admin.ts:16`, `scripts/lib/supabase-admin.ts:25`,
   `apps/web/tests/e2e/setup/admin-client.ts:24`), all sourced from `process.env`,
   none hardcoded, none reachable from the client bundle. (`scripts/lib/env.ts:128`
   is a presence-assertion only — the value is validated, not stored or returned.)
2. **`apps/web/lib/supabase/admin.ts`** — `import "server-only"` at line 1
   (verified); the client is constructed **lazily inside `createAdminClient()`**
   (not at module top-level, so no tree-shake-into-client risk); its **sole**
   importer is `app/api/admin/invite/route.ts:4` (a Route Handler — inherently
   server-side, no `"use client"`). Import graph confirmed; no client-component
   reach. Matches slice-1 Audited-clean #15 / slice-3 #7.
3. **Decision-2026-05-17 service-role isolation intact** — in
   `app/api/admin/invite/route.ts`, the admin client (`:83`) is used **only** for
   `inviteUserByEmail` (`:88`); both SECURITY DEFINER RPCs `admin_update_role`
   (`:117`) and `admin_update_manager` (`:131`) go through the **caller's session
   client** (`:37`), not the admin client, so `auth.uid()` resolves to the
   verified admin. Cross-ref slice-1 #14, slice-3 #4.
4. **`tests/e2e/setup/admin-client.ts` — Audited-clean, *not* a finding** —
   reads the service-role key (`:24`) without `import "server-only"`, but the
   import graph proves it is imported only from `tests/e2e/**` (8 spec files +
   `global-setup.ts:18`), never from app runtime code, so Next.js never bundles
   it; it also carries a `NODE_ENV==='production'` throw at module load (`:1-3`).
   A `server-only` import would be counterproductive (the file runs in the Node
   test runner). The existing production-throw + `tests/` exclusion is the correct
   pattern for a test helper. (Subagent flagged this `low`; **down-adjudicated to
   non-finding** after import-graph verification.)
5. **Production-build client-bundle inspection** — `next build` output
   (`.next/static`, 28 JS chunks) searched for the **actual service-role key
   value** (extracted from `.env.local` at search time, never printed):
   **0 matches**. Literals `service_role` → 0, `SUPABASE_SERVICE_ROLE_KEY` → 0,
   `supabase/admin` → 0. Positive control: the **anon** key value → **1** chunk
   (expected; it is `NEXT_PUBLIC_`-prefixed and inlined). *Empirically verified.*
6. **`inviteUserByEmail` in the client bundle is library code, not ours** —
   the one chunk (`chunks/04ues19se9vgk.js`, the Supabase client chunk) containing
   `inviteUserByEmail` holds the **full `@supabase/supabase-js` `GoTrueAdminApi`
   class** (`inviteUserByEmail`, `deleteUser`, `listUsers`, `generateLink`,
   `getUserById`, `createUser`, `updateUserById` — each exactly once, the class
   definition). Our `lib/supabase/admin` module and `/api/admin/invite` route are
   **absent** (`0`). These admin methods are inert in the browser without the
   service-role key (confirmed absent). Standard for any Supabase-JS app.
   *Empirically verified.*
7. **`apps/web/next.config.ts`** — an empty `NextConfig`. No `env`, no
   `publicRuntimeConfig`, no `serverRuntimeConfig`, no `productionBrowserSourceMaps`
   (defaults to `false`). Nothing can push a non-`NEXT_PUBLIC_` var into the
   client bundle via config, and no production source maps expose server paths.
8. **`NEXT_PUBLIC_` prefix discipline** — only two vars carry the prefix
   (`NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`); both are
   intended-public Supabase connection values (the anon key is RLS-bound by
   design). The service-role key is correctly **un**-prefixed. No sensitive value
   is mis-prefixed.
9. **Log surface** — exactly 8 `console.*` sites, all `console.error`, all in
   server-only surfaces: four `"use server"` actions (`signup/actions.ts:54`,
   `login/actions.ts:39`, `reset-password/actions.ts:36`,
   `(onboarding)/onboarding/actions.ts:43`) and four invite-handler branches
   (`api/admin/invite/route.ts:76,103,122,136`). **Zero** in `"use client"`
   components (cross-checked against all 26 client files). None logs
   `process.env.*`, a session/user object, cookie values, a JWT, or the
   service-role key. No custom logger (`pino`/`winston`/`logger`) exists. (Raw
   error objects logged server-side are the *correct* place for diagnostic detail
   — these are Supabase query/auth/RPC errors and Zod issues, none plausibly
   carrying a token/key.)
10. **Telemetry absent** — no `@sentry`/`Sentry`/`posthog`/`posthog-js` anywhere
    in `apps/web` or its `package.json`. Nothing to verify re: DSN handling,
    secret forwarding, or `NEXT_PUBLIC_` PostHog keys. (Deep telemetry PII →
    slice 5; moot while absent.)
11. **No auxiliary third-party secrets** — no `DATABASE_URL`, `SENTRY_DSN`,
    PostHog/Stripe/OpenAI/Anthropic key, generic `API_KEY`/`_TOKEN`/`_SECRET`, or
    JWT-signing secret anywhere in `apps/web`, `scripts`, or dependencies. The
    category is absent entirely. `SUPABASE_PROJECT_REF` is an infrastructure
    project identifier (remote-seed path), correctly unprefixed, seed-only.
12. **Git history clean** — no `.env*` file ever committed except the tracked
    `apps/web/.env.local.example`; **0** JWT-shaped literals
    (`eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9`) across **all** refs (conclusive that
    no real or demo key value was ever committed); **0** commits for every
    third-party prefix scanned (`sk_live_`, `sk_test_`, `ghp_`, `github_pat_`,
    `AKIA`, `xoxb-`, `SENTRY_DSN`, `DATABASE_URL=`). The lone `SERVICE_ROLE_KEY=`
    pickaxe hit (commit `d4621fe`) is the **empty** template line
    (`apps/web/.env.local.example:11`) plus a doc reference
    (`specs/001-auth-and-roles/quickstart.md:45`) — both placeholders, no value.
    *Empirically verified.*
13. **`.gitignore` posture correct** — `.env`, `.env.local`, `.env.*.local`,
    `.env.development`, `.env.production` are ignored; `.env.example` and
    `.env.local.example` are re-included with `!` (tracked as documentation).
    `apps/web/.env.local` is untracked (`git check-ignore` matches; absent from
    `git ls-files`). Recent commit `6104555` added private-key file patterns
    (defense-in-depth).
14. **`.env.local.example` holds no real values** — the `NEXT_PUBLIC_SUPABASE_ANON_KEY`
    and `SUPABASE_SERVICE_ROLE_KEY` lines are empty (`=`); `NEXT_PUBLIC_SUPABASE_URL`
    and `SITE_URL` are localhost defaults. No real-looking JWT/hex string in the
    committed template.
15. **`scripts/lib/supabase-admin.ts` & `scripts/seed-demo.ts`** — the key is read
    from `process.env` (never an argument, never hardcoded), the module throws on
    `NODE_ENV==='production'` at load (`:1-3`), and the key is **never logged**
    (zero log statements in the file). No `apps/web` code imports from `scripts/`
    (grep confirmed no matches).

---

## Out of scope this slice

Routed elsewhere; recorded so nothing is silently dropped.

- **Sentry / PostHog telemetry PII scrubbing** → slice 5. Moot for now — neither
  is installed (Audited-clean #10); revisit if/when telemetry is added.
- **Content Security Policy header** → slice 5 (the right place for the second
  layer under React-escaping and to harden the slice-2 `httpOnly:false` cookie
  exposure).
- **Dependency audit** → slice 6. **Rate-limit quota deep-dive** → slice 7.
- **Production env-panel secrets + rotation** — the production secrets live in the
  Vercel / DigitalOcean / Supabase environment-variable panels (Constitution
  Principle IX) and are **not auditable from the repo**. Rotation is Mohamed's
  manual responsibility. *Observed in passing*: the local `apps/web/.env.local`
  on the audit machine contains only the **well-known Supabase CLI demo keys**
  (`iss: "supabase-demo"` — the public defaults shipped identically by every
  `supabase start`), so no real project secret was present to leak; the
  build-inlining behavior verified above is value-independent (Next inlines by
  `NEXT_PUBLIC_` prefix, not by value), so the conclusion holds for real keys too.

---

## Verification approach

Source-level enumeration (sections a, b-source, c, d, e) was performed by three
parallel `general-purpose` subagents; the secret-value-handling empirical layer
(production-build grep, git-history scan, `.gitignore` posture) was run in the
main session to keep verbatim outputs and redaction under direct control. No
finding rests on source-reading alone where an empirical check was possible.

### Env enumeration + client-bundle source (run over `apps/web`, incl. `tests/`)

```bash
# read-site enumeration + prefix discipline
rg "process\.env"  apps/web --glob '*.ts' --glob '*.tsx'
rg "NEXT_PUBLIC_"   apps/web --glob '*.ts' --glob '*.tsx'
rg "server-only"    apps/web                 # import "server-only" discipline
# service-role read sites + import-graph reachability
rg "SUPABASE_SERVICE_ROLE_KEY" apps/web
rg "createAdminClient|supabase/admin|admin-client" apps/web
rg "from ['\"].*scripts|require\(.*scripts"  apps/web   # no app→scripts imports (0)
```

### Production-build client-bundle inspection (run from `apps/web`)

Methodology: the key **values** are read out of `.env.local` into shell variables
at search time and matched with `grep -F` (full-string, count/filename only — the
value is **never printed**). The anon key is the positive control.

```bash
npm run build                       # next build (Turbopack) → .next/static, 28 chunks, 1.8M
SRK=$(grep -E '^SUPABASE_SERVICE_ROLE_KEY=' .env.local | cut -d= -f2- | tr -d '\r\n')
ANON=$(grep -E '^NEXT_PUBLIC_SUPABASE_ANON_KEY=' .env.local | cut -d= -f2- | tr -d '\r\n')
grep -rlF "$ANON" .next/static | wc -l   # positive control
grep -rlF "$SRK"  .next/static | wc -l   # the secret
grep -rl 'service_role'            .next/static | wc -l
grep -rl 'SUPABASE_SERVICE_ROLE_KEY' .next/static | wc -l
grep -rl 'supabase-admin\|supabase/admin' .next/static | wc -l
grep -rl 'inviteUserByEmail'       .next/static | wc -l
```

Verbatim results:

```
extracted service-role key length: 164 (non-empty check)
extracted anon key length: 153 (non-empty check)

[CONTROL] anon key full-value matches in .next/static (EXPECT >0):
  04ues19se9vgk.js
  anon file-match count: 1

[SECRET] service-role key full-value matches in .next/static (EXPECT 0):
  service-role file-match count: 0

literal string scans in .next/static (EXPECT 0 each):
  'service_role'             : 0 files
  'SUPABASE_SERVICE_ROLE_KEY' : 0 files
  'supabase/admin'/'admin.ts' : 0 files
  'inviteUserByEmail'         : 1 files   # → @supabase/supabase-js GoTrueAdminApi class def

# proof the inviteUserByEmail hit is library code, not ours (same chunk):
  inviteUserByEmail : 1   deleteUser : 1   listUsers : 1   generateLink : 1
  getUserById : 1   createUser : 1   updateUserById : 1
  'lib/supabase/admin' : 0     '/api/admin/invite' : 0
```

### Git-history scan (run from repo root; `--oneline`/`--name-only`/`-S`, never `-p`, so no diff content/secret is printed)

```bash
git log --all --oneline --name-only --diff-filter=A -- '.env' '.env.*' '**/.env' '**/.env.*'
git ls-files | grep -iE '\.env'
git log --all --oneline -S 'SERVICE_ROLE_KEY='
git log --all --oneline -S 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9'   # JWT shape
for p in sk_live_ sk_test_ ghp_ github_pat_ AKIA xoxb- SENTRY_DSN 'DATABASE_URL='; do
  git log --all --oneline -S "$p"; done
git grep -l 'SERVICE_ROLE_KEY=' d4621fe        # locate the lone hit
```

Verbatim results:

```
(1) .env* ever committed (added):   <none>
    tracked env files now:          apps/web/.env.local.example
(2) 'SERVICE_ROLE_KEY=' :           1 commit  → d4621fe feat(001): authentication and role-based access
                                    └─ files: apps/web/.env.local.example:11 (empty value)
                                              specs/001-auth-and-roles/quickstart.md:45 (placeholder)
(3) 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9' (JWT shape): 0 commits   ← conclusive: no key value ever committed
(4) sk_live_:0  sk_test_:0  ghp_:0  github_pat_:0  AKIA:0  xoxb-:0  SENTRY_DSN:0  DATABASE_URL=:0
```

### Tooling note

`/security-review` was **not** used as the audit engine: it is diff-scoped (it
reviews the branch diff, which here is only this new doc) and cannot audit
already-committed code. The `cybersecurity-skills:*` set are live-pentest
playbooks (taxonomy), not static-audit engines; OWASP **A02** (Cryptographic
Failures), **A05** (Security Misconfiguration), and **A09** (Security Logging &
Monitoring) were used as conceptual framing only. The audit engine was three
`general-purpose` reviewer subagents plus the main-session empirical layer.

### Re-running this audit

With `apps/web/.env.local` populated (local Supabase keys), from `apps/web`:
`npm run build`, then re-run the value-extraction grep block above against
`.next/static` (anon → ≥1, service-role → 0). From repo root, re-run the
git-history block. No running dev server or database is required — the build
inspection is static and the history scan is local-only.
