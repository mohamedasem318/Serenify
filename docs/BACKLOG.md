# Serenify — Backlog

Append-only follow-up items deferred from prior features. Each entry has a status,
the feature it was deferred from, and notes about when it should be addressed.

Status values:
- `bug` — known incorrect behavior, not yet fixed
- `polish` — UX improvement, not blocking
- `tech-debt` — structural cleanup, address before it grows
- `watch` — monitor; act if condition changes
- `deferred-feature` — intentional scope cut, future work
- `deferred-tooling` — blocked on a tooling or harness capability that does not yet exist

---

## From feature 001 (auth-and-roles) — merged 2026-05-17

### ~~`/login` page does not render the `?error=expired_link` notice~~ — resolved
**Status**: resolved
**Resolved**: 2026-05-19 on `hotfix/login-expired-link-notice` — `login/page.tsx` now
awaits `searchParams` and renders a calm amber `role="status"` notice above the form
when `error === "expired_link"`. Covered by a Vitest + RTL component test
(`tests/unit/login-page.test.tsx`) and a Playwright spec
(`tests/e2e/login-expired-link.spec.ts`). The shared error-alert component extraction
remains deferred to feature 003 per the auth-primitives backlog entry below.
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

---

## From feature 003 (employee-dashboard-shell) — in progress

### Onboarding visual regression untestable on completed accounts
**Status**: deferred-tooling
**Observed**: ST-1 / T014 of feature 003
**Description**: ST-1's visual matrix includes `/onboarding`, but the
(authed) route guard redirects any account with a non-null
`profiles.full_name` to `/app` — so onboarding can only be reached by
a never-onboarded user. The 30 demo cohort users seeded by feature 002
all complete onboarding, leaving zero eligible accounts to drive the
`/onboarding` cell of the visual diff. Future visual gates (any ST-1
rerun on this branch, and equivalent regressions in features 004+)
hit the same wall.
**Fix scope**: small. Either (a) extend `scripts/seed-demo.ts` with a
"reset onboarding state" option that nulls `profiles.full_name` for a
named user, OR (b) reserve one demo slot as the
"onboarding-pristine" probe — never assigned a `full_name`, never
asserted against in role-trio specs.
**Address by**: when the demo-seed harness gains a "reset onboarding
state" option — natural pairing with the CI integration work logged
above against feature 006.

### Avatar disc reads "out of character" in dark mode
**Status**: polish
**Observed**: 2026-05-21, feature 003 Phase 5 visual review (T030)
**Description**: After the 515984c contrast fix the AvatarFallback
uses `bg-surface text-foreground border border-border`, which lands
WCAG AAA contrast in both modes (light 14.4:1, dark 11.7:1). The
disc itself, however, reads as a slightly washed grey blob in
dark mode — surface (#20231F) on bg (#161917) is only ~1.2:1
self-vs-bg, and the border (#2D3130) is also subtle. The fix is
correct for accessibility but the disc feels visually weaker than
the meadow / amber accents elsewhere in the surface. May want a
circle-specific design token (e.g. `--color-avatar-bg`) tuned for
identity rather than reusing the generic surface stack.
**Fix scope**: small if just a token swap, medium if it widens
into a "calm identity accents" pass (avatars, badges, status
chips). Eyeball-driven, not WCAG-driven — current state PASSES
all contrast thresholds.
**Address by**: token-tuning pass alongside the muted-on-bg item
above; not blocking any feature.

### Mobile / tablet typography bump
**Status**: polish
**Observed**: 2026-05-21, feature 003 Phase 5 visual review (T030)
**Description**: At 360px and tablet widths (~600–900px) the body
text and labels feel small. text-sm (14px) is heavily used across
the header, the (authed) layout's nav, and the placeholder body;
text-xs (12px) shows up on form labels. On a phone held at arm's
length these read as cramped. A broader responsive-typography
pass — likely a viewport-stepped fluid-type scale (e.g. `clamp()`
for headings, larger base for narrow viewports) — would help.
Avoid one-off `sm:text-base` patches that ratchet up complexity
without solving the system.
**Fix scope**: medium. Audit usage of text-xs / text-sm / text-base
across (auth) and (authed) surfaces, propose a fluid scale, eyeball
on every page at 360px / 600px / 900px / desktop. May involve
adding tokens to the M&M `@theme` block.
**Address by**: alongside the M&M token-tuning pass — typography
and color rhythm belong in the same review.

### Token tune — `--color-muted` underweight on light bg (WCAG AA)
**Status**: bug
**Observed**: 2026-05-20, feature 003 T020 visual sweep
**Description**: M&M `--color-muted` at `#6E7572` against light bg
`#ECEEE9` gives ~3.8:1 contrast — under WCAG AA body-text minimum
(4.5:1) by ~15%. Affects every `text-muted` site in light mode: auth
field labels, password-requirements rule rows, page intros, footer
links, helper text. Dark mode is fine (~5.6:1, comfortably over AA).
Not caused by the sidecar fix in 2b0c2b3 — that fix correctly
restored `--color-muted` to its M&M value (it had been clobbered by
an `@theme inline` remap). The underlying issue is the M&M palette
value itself.
**Fix scope**: medium — dedicated design-token pass. Likely darken
the light value from `#6E7572` to ~`#5A615F` (target 4.6:1+), with
eyeball verification across every authed surface. NOT to be embedded
in feature implementation work; deserves its own task.
**Address by**: secondary-text contrast, not blocking — primary text
reads fine and WCAG AA-large threshold (3:1) is satisfied. Belongs
in a deliberate token-tuning pass, not in active feature work.

### Button-system character pass — semantic-weight differentiation + variant cleanup
**Status**: polish
**Observed**: 2026-05-21, feature 003 Phase 6 polish re-eyeball
**Description**: Post-Phase-6, `button.tsx` ships three production
variants — `default` (bg-ink + bg-color text, AAA in both modes),
`secondary` (bg-surface + ink text + meadow border + meadow/10
hover, AAA in both modes), `destructive` (FR-042 crimson, AAA).
Contrast is solved. Character is not. Mohamed's re-eyeball
flagged that the variants feel under-differentiated — they
"match the theme" but lack distinct identity, and `Sign out`
specifically reads as **perceptually destructive** even though
it isn't data-destructive: it ends the session and requires
re-auth to come back. Currently `Sign out` and `Save password`
share `variant="secondary"`, which the visual hierarchy doesn't
distinguish from each other or signal Sign out's session-boundary
weight.

Calm-first (Constitution V) intentionally restrains the palette;
FR-042 scopes amber and crimson to specific use cases. Richer
character requires either (a) variant tweaks within the existing
palette (e.g. `Sign out` → `ghost` for "peripheral exit" framing,
or a distinct sign-out-specific treatment that acknowledges
perceptual weight without invoking crimson), or (b) a
constitution-level amendment introducing a fourth scoped color
(e.g. session-boundary actions). Either decision belongs in a
dedicated design-system pass, not a piecemeal Phase 6 patch.

Also outstanding (bundled into the same pass for coherence):
  - `variant="ghost"` and `variant="outline"` hover state in
    dark mode currently resolves to bg-accent (foggy) +
    text-accent-foreground (ink-light) = ~1.49:1 — hard fail
    WCAG AA. No production surface uses them yet, so deferred
    rather than patched.
  - `variant="link"` uses `text-primary` (= meadow) which gives
    ~3:1 contrast against light bg-bg — fails AA for normal
    text. No production surface uses it yet.
  - `variant="secondary"` hover wash `bg-meadow/10` computed
    ratio wasn't fully verified in the Phase 6 probe (the 10%
    overlay didn't parse cleanly via regex). Visual inspection
    is fine; the math deserves a proper measurement.

**Fix scope**: medium. Bundle with the existing M&M token-tuning
queue (avatar disc dark-mode greyness, muted-on-bg light-mode
contrast under AA, mobile/tablet typography bump) so the four
items land as ONE coherent design-tokens revision instead of
four sequential patches that each touch overlapping surfaces.

Specifics the future pass should evaluate:
  - Sign out variant choice: does it warrant its own visual
    treatment distinct from both primary action AND `Save
    password`? Mohamed's "perceptually destructive" framing is
    the conversation starter here.
  - Fix ghost/outline dark-mode hover contrast.
  - Fix link variant light-mode contrast.
  - Measure secondary hover wash in computed ratio terms.
  - Decide whether to amend FR-042 with a fourth scoped color
    or hold the line at three (meadow / amber / crimson).

**Address by**: design-system pass — same workstream as the
three existing token-tuning entries above. Not blocking any
in-progress feature; deferred polish.
