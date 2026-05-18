# Serenify — Backlog

Append-only follow-up items deferred from prior features. Each entry has a status,
the feature it was deferred from, and notes about when it should be addressed.

Status values:
- `bug` — known incorrect behavior, not yet fixed
- `polish` — UX improvement, not blocking
- `tech-debt` — structural cleanup, address before it grows
- `watch` — monitor; act if condition changes
- `deferred-feature` — intentional scope cut, future work

---

## From feature 001 (auth-and-roles) — merged 2026-05-17

### `/login` page does not render the `?error=expired_link` notice
**Status**: bug
**Observed**: smoke test ST-1 of feature 001
**Description**: When the PKCE callback fails and redirects to `/login?error=expired_link`,
the URL carries the error but the page renders the bare login form with no error message.
User can still sign in, so the path isn't fully broken, but the page should display a
calm "Your activation link expired — please sign in" notice.
**Fix scope**: small — read `searchParams` in the login page, render an alert block when
the error param matches a known value. Add to the (auth) shell's error-alert component if
one exists.
**Address by**: feature 003 start or sooner.

### Auth form components inlined in page files, not extracted
**Status**: tech-debt
**Observed**: during feature 001 polish
**Description**: `apps/web/components/ui/` does not exist. The bespoke form primitives
(`PasswordInput`, the requirements checklist, the field/label wrappers) live inside the
(auth) page files. When shadcn/ui is introduced in feature 003, retrofitting will require
touching every page rather than swapping primitives in one location.
**Fix scope**: medium — extract `PasswordInput`, `Field`, `Label`, `ErrorText` to
`components/ui/` as the first commit on the feature-003 branch, before shadcn lands.
**Address by**: feature 003, first commit.

### Cross-tab auth state sync
**Status**: deferred-feature
**Observed**: smoke test ST-1 of feature 001
**Description**: User has signup tab open showing "Check your email." User clicks the
confirmation link in a new tab. Original tab does not update to reflect the now-authed
state — user must refresh manually.
**Fix scope**: medium — wire `supabase.auth.onAuthStateChange` listener at the auth-shell
level; on SIGNED_IN transition, redirect to `/app`. Test with two browser tabs in a
Playwright spec. No security issue (same user, same session).
**Address by**: feature 003+ when the UX overhead matters more.

### Supabase default email templates include unused 6-digit OTP block
**Status**: polish
**Observed**: smoke test ST-1 of feature 001
**Description**: Both confirmation and password-reset emails ship with a magic link AND
a 6-digit OTP code. The app now supports OTP entry as a fallback (added during feature 001),
but the email template wording is generic Supabase boilerplate. Could be customized to
match the Mist & Meadow voice and reference Serenify directly.
**Fix scope**: small — author `supabase/templates/confirmation.html` and `recovery.html`,
wire via `supabase/config.toml` `[auth.email.template.*]`.
**Address by**: feature 011 (admin-dashboard) or whichever feature first ships to a
real environment with real email.

### OTP submit button transient-stale-render flake
**Status**: watch
**Observed**: once during smoke test ST-1 of feature 001; not reproducible afterward
**Description**: On first OTP entry attempt of a session, the submit button stayed
disabled despite a valid 6-digit input. Reload + retry worked. Suspected cause:
React Strict Mode + hot-reload race during dev. If it appears in production or repeats
in CI, escalate to bug.
**Address by**: monitor; act only on reproduction.

### Node 22.11 forces happy-dom + .mts Vitest config
**Status**: tech-debt
**Observed**: during feature 001 plan
**Description**: Node 22.11 cannot `require(esm)` (landed in 22.12). This forces
`vitest.config.mts` and `happy-dom` instead of `jsdom`. Upgrading Node to 22.13+
allows reverting to jsdom and a regular `.ts` config.
**Fix scope**: small — upgrade Node, change `vitest.config.mts` to `vitest.config.ts`,
change `environment: "happy-dom"` to `"jsdom"`, run tests, remove `happy-dom` from
devDependencies and add `jsdom`.
**Address by**: any time before feature 005 (the FastAPI/ML feature) starts.

### postcss XSS advisory in transitive dep
**Status**: watch
**Observed**: `npm audit` during feature 001
**Description**: GHSA-qx2v-qp2m-jg93 (PostCSS XSS via CSS Stringify with `</style>`).
Transitive dependency of Next.js. Does not apply to Serenify's usage (no untrusted CSS
stringification at runtime). `npm audit fix --force` would downgrade Next to 9.3.3,
which is not viable.
**Address by**: re-run `npm audit` and re-triage at every Next.js major version bump.

### HMR WebSocket failures spam the console at 127.0.0.1:3000
**Status**: watch / polish
**Observed**: during feature 001 development
**Description**: Loading the dev server at `http://127.0.0.1:3000` (instead of
`http://localhost:3000`) breaks the HMR WebSocket because Next 16's `allowedDevOrigins`
defaults to localhost. Form pages without progressive-enhancement `action={...}` would
silently fall back to GET (already fixed in feature 001 by adding the wrappers, but
the underlying HMR failure remains).
**Fix scope**: tiny — add `allowedDevOrigins: ['http://127.0.0.1:3000']` to `next.config.ts`
if you want to support both hostnames in dev.
**Address by**: optional; not blocking.

### Force re-sign-in after password reset (security alternative)
**Status**: deferred-feature
**Observed**: design discussion during feature 001
**Description**: Current behavior auto-signs-in the user after a successful PKCE password
reset (industry standard for SaaS). Some workplace security postures prefer forcing a
re-sign-in with the new password. Could be made a per-deployment config later.
**Address by**: revisit if a corporate deployment requires it.

### Dedicated `/verify-otp` route (instead of inline panels)
**Status**: deferred-feature
**Observed**: design discussion during feature 001
**Description**: OTP entry is currently inline on the signup "check email" and
forgot-password "reset sent" panels. A dedicated route would make the OTP a first-class
auth surface that can be linked-to directly (e.g., from a help article). Not needed
for current scope.
**Address by**: only if a use case emerges.

### Password strength meter (entropy-based)
**Status**: deferred-feature
**Observed**: design discussion during feature 001
**Description**: Considered during the requirements-checklist work but rejected —
strength meters are OWASP-discouraged because entropy estimation is unreliable. The
current checklist (✓ 8 characters, ✓ letter, ✓ number) is the chosen approach. Listed
here only so a future Claude doesn't re-propose it without context.
**Address by**: keep listed; not a follow-up to action.

### Manager dashboard time-range insights
**Status**: deferred-feature
**Observed**: scope discussion during feature 001 wrap-up
**Description**: Team-lead and admin dashboards should support multiple time ranges
for viewing stress trends — 1 week, 1 month, 1 quarter, 6 months, 1 year. Required UX:
a time-range selector control that re-aggregates the underlying daily data into
weekly/monthly bars as appropriate. Compatible with the existing privacy model since
broader windows are MORE privacy-preserving (less granular), not less.
**Fix scope**: medium — UI control, query-side aggregation in the Supabase
signal-event tables, charting in Recharts.
**Address by**: feature 010 (team-lead-dashboard) spec must include these time ranges
as acceptance scenarios; feature 011 (admin-dashboard) likewise for org-wide aggregates.

---

## From feature 002 (demo-seed-data) — merged 2026-05-18

### CI integration for `npm run test:seed:integration`
**Status**: deferred-feature
**Observed**: scope decision during /speckit.implement of feature 002
**Description**: The seed integration test suite (`scripts/__tests__/seed-demo.integration.test.ts`)
runs locally against the developer's Supabase Docker stack and is gated by
`SUPABASE_INTEGRATION=1`. CI does not currently run it because GitHub Actions has no
Supabase service spun up — adding one is a non-trivial workflow change (docker-compose
or the `supabase/cli` action, plus seeded migrations on each PR). The 8 integration
assertions therefore run only on Mohamed's laptop today; the Vitest unit suite (9 assertions
against the pure hierarchy generator) is the only piece of feature 002's testing that runs
in CI.
**Fix scope**: medium — Add a docker-compose Supabase service to the GitHub Actions workflow
(or use the `supabase/setup-cli` action), apply feature 001's migrations on each PR run,
and gate `test:seed:integration` to PRs touching `scripts/` so the cost only pays on
diff-relevant runs. Pair with feature 006's CI work since stress-inference-service will
need Supabase in CI anyway.
**Address by**: feature 006 (stress-inference-service) CI setup, or sooner if PRs to
`scripts/` start landing without integration coverage.

### Cleaner error output when local Supabase is unreachable
**Status**: polish
**Observed**: smoke test ST-10, feature 002
**Description**: When the seed script encounters a fetch failure
(Supabase not running, network down, wrong URL), it surfaces the
raw `fetch failed` / `ECONNREFUSED` stack trace from Node. The
script still exits non-zero with no partial writes, so the
behaviour is correct — just noisy. A friendlier surface would be a
single-line message like `ERROR: Cannot reach Supabase at <url>.
Is it running?` followed by `(run "supabase start" or check your
NEXT_PUBLIC_SUPABASE_URL)`, then a clean non-zero exit.
**Fix scope**: small. Wrap the first network call in env.ts or the
orchestrator with a try/catch that detects fetch / ECONNREFUSED
errors and substitutes a friendly message. Probably 20 lines.
**Address by**: any polish pass, or whoever next touches the seed
script (e.g. the signal-event seeding follow-up before feature 011).
