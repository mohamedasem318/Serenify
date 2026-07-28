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

### ~~`/login` page does not render the `?error=expired_link` notice~~ — resolved (#30)
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

### ~~Auth form components inlined in page files, not extracted~~ — resolved (#31)
**Status**: resolved
**Resolved**: 2026-05-20 on `003-employee-dashboard-shell` Phase 2 (T004–T010 +
commits surrounding the auth-primitive extraction sweep). `PasswordInput`,
`PasswordRequirements`, `OtpPanel`, and a new `Field` wrapper now live under
`apps/web/components/ui/auth/`; the four (auth) page forms (`login-form.tsx`,
`signup-form.tsx`, `forgot-form.tsx`, `reset-form.tsx`) and `security-section.tsx`
import them by path. The (auth) pages render byte-equivalent to `main` per FR-040;
verified by feature 001's auth Playwright suite passing unchanged. The shadcn
install in feature 003 Phase 4 landed primitives flat in `components/ui/` per the
three-tier convention in DECISIONS.md 2026-05-25 (DECISION-4).
**Observed**: during feature 001 polish
**Description**: `apps/web/components/ui/` did not exist. The bespoke form
primitives (`PasswordInput`, the requirements checklist, the field/label
wrappers) lived inside the (auth) page files. When shadcn/ui was introduced in
feature 003, retrofitting would have required touching every page rather than
swapping primitives in one location — hence the Phase 2 extraction.

### ~~Cross-tab auth state sync~~ — resolved (#32)
**Status**: resolved
**Resolved**: 2026-05-22 on `003-employee-dashboard-shell` Phase 11 (T059–T063 +
the Decision N amendment in commit 0e4637f). `CrossTabAuth` listener mounts at
the root layout (DECISIONS.md 2026-05-25 / DECISION-8) and navigates sibling tabs
per FR-046's pathname rules. The Decision N amendment replaced the plan-time
`supabase.auth.onAuthStateChange` mechanism with an explicit broadcast helper
at `apps/web/lib/auth-broadcast.ts` because `@supabase/ssr` stores the session
in cookies rather than localStorage — no localStorage write happens on sign-in,
so no `storage` event fires cross-tab through supabase-js. The helper writes the
marker explicitly. Two-tab propagation covered by
`apps/web/tests/e2e/cross-tab-auth-sync.spec.ts` (54/54 across the three browser
projects in T066). Stopwatch-verified ≤2s on T063 manual validation.
**Observed**: smoke test ST-1 of feature 001
**Description**: User had a signup tab open showing "Check your email." User
clicked the confirmation link in a new tab. Original tab did not update to reflect
the now-authed state — user had to refresh manually. Resolution above covers this
plus the symmetric sign-out propagation (sign out in one tab → sibling tabs
navigate to /login).

### ~~Supabase default email templates include unused 6-digit OTP block~~ — resolved (#33)
**Status**: resolved
**Resolved**: 2026-07-11 on `chore/api-container-deploy` — added branded
confirmation and password-recovery templates at `supabase/templates/`, wired
them through `supabase/config.toml`, and covered the template/config contract
with `apps/web/tests/unit/supabase-email-templates.test.ts`. Templates keep both
`{{ .ConfirmationURL }}` and `{{ .Token }}` so the existing link and six-digit
OTP flows both work.
**Observed**: smoke test ST-1 of feature 001
**Description**: Both confirmation and password-reset emails ship with a magic link AND
a 6-digit OTP code. The app now supports OTP entry as a fallback (added during feature 001),
but the email template wording is generic Supabase boilerplate. Could be customized to
match the Mist & Meadow voice and reference Serenify directly.
**Fix scope**: small — author `supabase/templates/confirmation.html` and `recovery.html`,
wire via `supabase/config.toml` `[auth.email.template.*]`.
**Address by**: feature 019 (admin-dashboard) or whichever feature first ships to a
real environment with real email.

### OTP submit button transient-stale-render flake (#34)
**Status**: watch
**Observed**: once during smoke test ST-1 of feature 001; not reproducible afterward
**Description**: On first OTP entry attempt of a session, the submit button stayed
disabled despite a valid 6-digit input. Reload + retry worked. Suspected cause:
React Strict Mode + hot-reload race during dev. If it appears in production or repeats
in CI, escalate to bug.
**Address by**: monitor; act only on reproduction.

### Node 22.11 forces happy-dom + .mts Vitest config (#35)
**Status**: tech-debt
**Observed**: during feature 001 plan
**Description**: Node 22.11 cannot `require(esm)` (landed in 22.12). This forces
`vitest.config.mts` and `happy-dom` instead of `jsdom`. Upgrading Node to 22.13+
allows reverting to jsdom and a regular `.ts` config.
**Fix scope**: small — upgrade Node, change `vitest.config.mts` to `vitest.config.ts`,
change `environment: "happy-dom"` to `"jsdom"`, run tests, remove `happy-dom` from
devDependencies and add `jsdom`.
**Address by**: any time before feature 005 (the FastAPI/ML feature) starts.

### postcss XSS advisory in transitive dep (#36)
**Status**: watch
**Observed**: `npm audit` during feature 001
**Description**: GHSA-qx2v-qp2m-jg93 (PostCSS XSS via CSS Stringify with `</style>`).
Transitive dependency of Next.js. Does not apply to Serenify's usage (no untrusted CSS
stringification at runtime). `npm audit fix --force` would downgrade Next to 9.3.3,
which is not viable.
**Address by**: re-run `npm audit` and re-triage at every Next.js major version bump.

### HMR WebSocket failures spam the console at 127.0.0.1:3000 (#37)
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

### Force re-sign-in after password reset (security alternative) (#38)
**Status**: resolved — 2026-07-13 (implemented in `d4621fe`; verified in PR #144)
**Observed**: design discussion during feature 001; implementation re-verified for production
**Resolution**: A successful PKCE password update calls `auth.signOut()` before the client
routes to `/login?flash=password_updated`. A focused server-action regression test now locks
the update-before-sign-out order and proves failed updates do not end the recovery session.

### Dedicated `/verify-otp` route (instead of inline panels) (#39)
**Status**: deferred-feature
**Observed**: design discussion during feature 001
**Description**: OTP entry is currently inline on the signup "check email" and
forgot-password "reset sent" panels. A dedicated route would make the OTP a first-class
auth surface that can be linked-to directly (e.g., from a help article). Not needed
for current scope.
**Address by**: only if a use case emerges.

### Password strength meter (entropy-based) (#40)
**Status**: closed — not planned (decided; do-not-implement)
**Decided**: Addressed via the password **requirements checklist** (OWASP-aligned:
✓ 8 characters, ✓ letter, ✓ number) — that is the chosen approach. The entropy-based
strength meter is **intentionally not implemented** (OWASP-discouraged: entropy
estimation is unreliable). Kept here as a decided do-not-implement record so a future
Claude doesn't re-propose it; this is a log entry, not an actionable follow-up.
**Observed**: design discussion during feature 001
**Description**: Considered during the requirements-checklist work but rejected —
strength meters are OWASP-discouraged because entropy estimation is unreliable. The
current checklist (✓ 8 characters, ✓ letter, ✓ number) is the chosen approach. Listed
here only so a future Claude doesn't re-propose it without context.
**Address by**: keep listed; not a follow-up to action.

---

## From feature 002 (demo-seed-data) — merged 2026-05-18

### CI integration for `npm run test:seed:integration` (#41)
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
**Verified still open (2026-06-24 recon)**: confirmed NOT-WIRED — the repo has **no
`.github/workflows/` directory at all** (no CI pipeline of any kind yet), so nothing runs
`test:seed:integration` (defined in `package.json` as `cross-env SUPABASE_INTEGRATION=1
vitest run`, gated by `SUPABASE_INTEGRATION=1`); the 8 integration assertions still run only
on Mohamed's laptop. When CI is first stood up, this is the natural pairing with feature 008's
Supabase-in-CI need.
**Fix scope**: medium — Add a docker-compose Supabase service to the GitHub Actions workflow
(or use the `supabase/setup-cli` action), apply feature 001's migrations on each PR run,
and gate `test:seed:integration` to PRs touching `scripts/` so the cost only pays on
diff-relevant runs. Pair with feature 008's CI work since stress-inference-service will
need Supabase in CI anyway.
**Address by**: feature 008 (stress-inference-service) CI setup, or sooner if PRs to
`scripts/` start landing without integration coverage.

### Cleaner error output when local Supabase is unreachable (#42)
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
script (e.g. the signal-event seeding follow-up before feature 017).

---

## From feature 003 (employee-dashboard-shell) — merged 2026-05-25

### Onboarding visual regression untestable on completed accounts (#43)
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
above against feature 008.

### Avatar disc reads "out of character" in dark mode (#44)
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

### Mobile / tablet typography bump (#45)
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

### Token tune — `--color-muted` underweight on light bg (WCAG AA) (#46)
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

### Button-system character pass — semantic-weight differentiation + variant cleanup (#47)
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

### ~~Card heading typography — fresh design read needed (#48)~~
**Status**: RESOLVED — 2026-07-12, fixed in feature 007 (PR #22, commit 0b71d4a): DM Serif Display replaced with Outfit system-wide; the outdated serif feel is gone.
**Observed**: 2026-05-22, feature 003 Phase 7 eyeball (T045 re-look)
**Description**: The three home cards ship with their headings in
`font-display` (DM Serif Display) — `text-2xl` on TodaysCheckinCard
and `text-xl` on ThingsThatMightHelpCard / RecentChatsCard. Mohamed
flagged that this treatment "doesn't resonate" without articulating
which axis is off — family, weight, or scale all candidates.
The visual hierarchy in question pairs:

  - `<h1>` welcome-banner heading: font-display text-3xl /
    sm:text-4xl ("Good morning, Jane")
  - `<h2>` card headings: font-display text-2xl /
    text-xl

Both currently use the same display family (DM Serif Display)
which may be over-using the "one display moment" Constitution V
intended for the wordmark and the highest-level page heading.
Cards may want Inter — possibly at a heavier weight or a
distinct scale — to read as informational headings rather than
editorial moments. The shadcn `<CardTitle>` default
(`text-2xl font-semibold leading-none tracking-tight`) was
explicitly overridden in 533e8ba's commit body's spirit — that
override may have gone too far in the editorial direction.

**Fix scope**: small-to-medium. Recoverable className swap across
three card components (todays-checkin-card.tsx,
things-that-might-help-card.tsx, recent-chats-card.tsx) plus
any sibling section headings that share the treatment (the five
account-section headings in `components/account/*` currently
also use font-display text-2xl — they're hierarchical peers and
should move together). Future passes that ship more cards
(welcome-banner is structurally a card-shaped header; T054's
role-placeholder; features 004-009's eventual content surfaces)
will inherit whatever the design pass settles on.

Specifics the future pass should evaluate:
  - Should card headings shift family from DM Serif Display
    (editorial) to Inter (informational)?
  - Re-weighting within the chosen family — Inter at 500 / 600
    vs DM Serif Display default 400?
  - Re-sizing — is the text-2xl / text-xl split between primary
    and secondary cards the right hierarchy, or should they all
    match?
  - Whether a new heading scale token belongs in the M&M
    `@theme` block (e.g. `--font-card-heading`) to lock the
    decision and prevent drift.
  - Whether the welcome banner `<h1>` (font-display) and the
    card `<h2>` (under review) read as the right hierarchical
    pair — moving cards to Inter would create a clearer
    family-driven hierarchy with DM Serif reserved for the page
    title.

No tests assert on font family / weight / size — the calm-voice
text-content assertions in T045 are agnostic. No structural risk.

**Refinement (2026-05-25, feature 003 smoke review)**: at smoke
sign-off Mohamed re-confirmed the current card heading font on the
employee dashboard "doesn't feel right." Direction for the pass: do
NOT tweak the current treatment in place — explore 2-3 typographic
alternatives (different weights, sizes, or font choices within the
Mist & Meadow token system) and pick one from a side-by-side
comparison rather than nudging what's there now.

**Address by**: design-system pass — same workstream as the four
existing entries above (button-system character, mobile/tablet
typography bump, avatar disc dark-mode tint, muted-on-bg
contrast). Card heading typography belongs in the same revision
because it touches the same family/weight/scale decisions the
mobile-typography-bump entry already names.

### Cursor pointer on Link-wrapped anchors and other clickable surfaces (#49)
**Status**: polish
**Observed**: 2026-05-22, feature 003 Phase 8 eyeball (T048 re-look)
**Description**: Mohamed confirmed the cursor-pointer treatment
on the shadcn Button base (9cdfb6b) and the ChatPill (81cdb39)
feels right - hovering a button shows the pointing-finger cursor
as expected. Wants the same affordance extended to other
clickable elements that currently fall back to the default arrow
cursor under Tailwind v4's preflight:

  - `<Link>` (Next.js) wrapped anchors throughout the (authed)
    surface - the "Account" row in the profile dropdown (which
    uses `<DropdownMenuItem asChild><Link>...`), CenterNav's
    "Home" link, the MobileMenu's sheet links, the Serenify
    wordmark link in the header, the forthcoming employee-shell
    spec's Account / Sign out / theme-toggle navigation paths.
  - Any future clickable non-Button surface (radio cards,
    sortable list items, expandable rows in features 010+).

Tailwind v4's preflight removes the native `cursor: pointer`
from anchors AND buttons (the button case was the source of
9cdfb6b's fix). Anchors carrying interactive behaviour through
`<Link>` or onClick handlers should restore the cursor so the
affordance reads as clickable.

Restoring it is a single globals.css rule under `@layer base`
covering the broad class of clickable elements without forcing
every call-site to add `cursor-pointer`:

```css
@layer base {
  a[href], button:not(:disabled), [role="button"]:not([aria-disabled="true"]) {
    cursor: pointer;
  }
}
```

The `button:not(:disabled)` half is redundant with shadcn
Button's `cursor-pointer disabled:cursor-not-allowed` (9cdfb6b),
but having a base rule means future bespoke `<button>` elements
(if any) also inherit the affordance without needing to
remember the className. Decision belongs in the design-system
pass: bare CSS rule vs. per-component className vs. a Tailwind
plugin that injects the class. Probably option A (bare CSS) is
simplest.

**Fix scope**: small. One `@layer base` block in
`apps/web/app/globals.css`. No structural impact; no tests
break (no spec asserts on `cursor:` properties).

**Address by**: design-system pass — bundle with the five
existing entries above (button-system character, mobile/tablet
typography bump, avatar disc dark-mode tint, muted-on-bg
contrast, card heading typography). Cursor affordance is part
of the same UX-polish revision. Not blocking any in-progress
phase.

### CI guard for speckit skills + gitignore rule (#50)
**Status**: resolved — 2026-07-13 (`90171c3`, branch `fix/cold-start-readiness`, PR #143). GitHub issue **#50 CLOSED** (2026-07-12 — closed ahead of the code, same drift as #33).
**Resolution**: `scripts/check-speckit-skills.mjs` + its `check-speckit-skills.test.mjs` fixtures + the
`speckit-guard` CI job (`.github/workflows/ci.yml`) added — the guard verifies the required
`.claude/skills/speckit-*/SKILL.md` files are present and rejects a broad `.claude/` ignore rule
(FR-010 of `specs/022-cold-start-readiness/`). Covers Mode A; Mode B is mitigated by the same job
failing on any branch whose tree is missing the blobs.
**Observed**: 2026-05-22, feature 003 — second regression of
`.claude/skills/speckit-*/SKILL.md` going missing on disk,
mirroring the PR #3 incident (7a7beff restore) only days
earlier. DECISIONS.md @ 512c1d6 already documents the rule;
documentation alone has not been sufficient.
**Description**: Two structural failure modes have now each
caused the spec-kit slash commands (`/speckit.implement` et al)
to silently stop dispatching:

  - **Mode A — `.gitignore` broadening.** The original `.claude/`
    rule from d4621fe (feat 001 auth) was inherited into 003's
    branch base, then never narrowed. PR #3 narrowed it on main
    to `.claude/settings.local.json` but the change did not
    propagate to 003 because 003 forked before the PR merged.
  - **Mode B — branch ancestry drift.** 003 was forked from
    8dc822b — before the PR #3 merge at 68b7d47 — and was never
    rebased onto main. The 14 SKILL.md blobs that exist on main
    (tracked from 7a7beff) are simply absent from 003's tree.

Both modes produce the identical user-facing symptom: typing
`/speckit.implement` returns no schema; Mohamed has to diagnose
and Claude has to restore. The cost per occurrence is ~15-20 min
plus a context reset (CC must restart to register the skills).

A trivial CI check would catch both modes pre-merge:

```js
// scripts/check-speckit-skills.mjs (sketch)
import fs from "node:fs";
const REQUIRED = [
  "speckit-analyze", "speckit-checklist", "speckit-clarify",
  "speckit-constitution", "speckit-git-commit", "speckit-git-feature",
  "speckit-git-initialize", "speckit-git-remote", "speckit-git-validate",
  "speckit-implement", "speckit-plan", "speckit-specify",
  "speckit-tasks", "speckit-taskstoissues",
];
const missing = REQUIRED.filter(
  (s) => !fs.existsSync(`.claude/skills/${s}/SKILL.md`),
);
if (missing.length) {
  console.error("Missing speckit skill files:", missing);
  console.error("See DECISIONS.md @ 512c1d6 and commit 7a7beff.");
  process.exit(1);
}
const gitignore = fs.readFileSync(".gitignore", "utf8");
if (/^\.claude\/?\s*$/m.test(gitignore)) {
  console.error(
    "Broad `.claude/` rule found in .gitignore — narrow to " +
    "`.claude/settings.local.json` per 7a7beff.",
  );
  process.exit(1);
}
```

Wire into `package.json` as `"check:speckit-skills": "node
scripts/check-speckit-skills.mjs"` and add to the CI workflow
ahead of the test step. Optionally add a husky pre-commit hook
for the local layer.

**Why this is worth doing despite the existing DECISIONS.md
entry**: 512c1d6 documents the rule; this guard *enforces* it.
The first regression happened because a feature commit (d4621fe)
swept the skills as collateral damage. The second happened
because a branch was forked before the documenting fix merged.
Neither failure mode is detectable by reading DECISIONS.md.
Both are trivially caught by file-existence + regex on
`.gitignore`. The maintenance surface is near-zero (the rule
itself does not change unless spec-kit's skill set changes,
which is a deliberate spec-kit version bump).

**Fix scope**: small — ~25 lines of script, 3 lines of
`package.json`, 2 lines of CI workflow YAML. ~15 min total.

**Address by**: before feature 004 begins, or sooner if a third
occurrence is observed. Pair with whoever next touches the CI
workflow (currently empty per repo structure, so this may also
be the first CI workflow file — in which case scope grows to
"medium" to include the workflow scaffolding itself).

### Dynamic welcome banner subtitle variants (#51)
**Status**: deferred-feature
**Observed**: feature 003 plan (Decision M) and FR-009 deferral
**Description**: The welcome banner on `/app` for employees renders
a locked static subtitle ("A space to check in with yourself.")
beneath the adaptive greeting per Decision M. FR-009 originally
contemplated context-aware variants (signal-driven, time-of-week-
driven, post-checkin-driven) that swap into the single `<p>` slot.
The markup in `apps/web/components/home/welcome-banner.tsx`
already accommodates the swap — the slot is a single sibling
element under the greeting, and the SUBTITLE constant is the only
edit needed once variants exist. Re-logged here so a future
contributor doesn't re-derive FR-009's deferral.
**Fix scope**: medium — needs signal/calibration data (features
005/008) before the variants have anything to key on. Decision M
locks the current copy as the all-contexts fallback; variants
layer on top.
**Address by**: post-feature-008 (calibration shipped, signal
data exists). NOT before — variants without signal would just be
random copy churn.

### Notifications-section live controls on /app/account (#52)
**Status**: deferred-feature
**Observed**: feature 003 plan (FR-021 placeholder)
**Description**: The Notifications section on `/app/account` is a
placeholder card today (`apps/web/components/account/notifications-placeholder.tsx`) —
muted body text describing that notification preferences land in a
later feature, no live controls. The component shape matches the
Privacy placeholder so a future swap is symmetric. The notification
*surface* (`apps/web/components/notification.tsx`) shipped in
feature 003 but is not mounted by any production code per FR-033;
features 008/010/014 will mount it. The user-facing **preferences**
(channels, quiet hours, digest cadence) belong in this placeholder
when there's a notifications system to configure.
**Fix scope**: medium — schema + Server Action + form, paired with
whichever feature first generates user-controllable notifications.
**Address by**: with the first feature that emits notifications to
users (likely feature 011 / chatbot interrupts, or feature 018 /
privacy controls if those reuse the notification surface).

### Welcome banner timezone awareness (server-rendered greeting) (#53)
**Status**: bug
**Observed**: feature 003 T040 (welcome-banner.tsx implementation)
**Description**: `apps/web/components/home/welcome-banner.tsx`
renders the adaptive greeting (Good morning/afternoon/evening) on
the server using `new Date()` — i.e., the server's local time
(Vercel deployment region). Users outside that timezone may see
the wrong band: a user in `Asia/Tokyo` reading at their local
8pm would be greeted "Good morning" if the server is in
`America/Los_Angeles` (8pm Tokyo = 4am LA). The component
comment names this trade-off and points here.
**Fix scope**: small — two viable paths:
  - (a) Defer the greeting to a `useEffect` that reads
    `Intl.DateTimeFormat().resolvedOptions().timeZone` and re-
    computes client-side. Costs a brief flash of the server-
    rendered greeting before hydration. Acceptable for the
    home page.
  - (b) Pass the IANA zone in a cookie (set on sign-in or via
    a one-time client-side write) and pass to the Server
    Component as a prop. No flash, more wiring.
**Address by**: a later polish pass, or whichever feature first
needs per-user timezone awareness (signal aggregation in
feature 005 may need this anyway).

### Playwright local matrix run: pipe-buffering deadlock with `tail` (#54)
**Status**: deferred-tooling
**Observed**: feature 003 T066 (full Playwright matrix run on
chromium + firefox + webkit)
**Description**: Running the full Playwright matrix locally via
`npx playwright test 2>&1 | tail -80` hangs for tens of minutes
with an empty output buffer, even though each per-project run
(`--project=chromium`, `--project=firefox`, `--project=webkit`)
completes in 1-7 minutes individually. Diagnosed as pipe-
buffering deadlock: `tail` only flushes its buffer when stdin
closes, so Playwright's reporter chunks never reach a visible
buffer while the dev server's stdin chain stays open. The
test runner *appears* to make no progress; processes accumulate
in the background; output file stays at 0 bytes.

Workaround: run each project sequentially with
`--reporter=list` and pipe through a line-buffered filter
(`grep --line-buffered -E "^\s+(ok|x|\d+ (ok|failed|passed))"`)
or skip pipe filtering entirely.

This isn't a Playwright bug — it's a shell-pipeline interaction
with how Node's stdout buffers under non-TTY conditions. But
the symptom is misleading enough that the first occurrence
cost ~30 minutes of "is it hung?" diagnosis. Worth a small
helper script (`scripts/run-e2e-matrix.sh`) that wraps the
per-project sequential invocation with the streaming filter
so future contributors hit the working path by default.

**Fix scope**: small — ~20 lines of bash plus a `package.json`
npm-script entry (`"test:e2e:matrix": "scripts/run-e2e-matrix.sh"`).
The full T066 commit body (7dec3c9) has the diagnosis details
and the working invocation pattern.
**Address by**: anyone next running the full matrix locally, or
whoever first sets up CI (the streaming filter is also the right
pattern for CI logs that may be captured non-interactively).

### Dev-server memory bloat + monotonic slowdown across stacked full-suite runs (#55)
**Status**: tech-debt
**Observed**: 2026-05-25, feature 003 smoke verification (the webkit
timeout-flake fix on `reset-password.spec.ts:87`). Three consecutive full
Playwright matrix runs (`npx playwright test`, 54 tests ×
chromium/firefox/webkit) against a single long-lived `npm run dev` server.
**Description**: Wall-clock grew **monotonically across the stacked runs —
3.0m → 5.7m → 11.2m** — while the reused `next dev` process on :3000 sat at
**~4.1 GB** resident. Run 3 degraded enough that a firefox worker wedged and
was force-killed after the 300s stop timeout (`worker process did not exit
within 300000ms`), and the shared `signInAs` helper
(`tests/e2e/helpers.ts:13`) timed out waiting for the post-sign-in redirect
(`toHaveURL(/\/(app|onboarding)$/)` stuck on `/login`), failing
`admin-seeded.spec.ts` on firefox. Runs 1 and 2 were clean 54/54; the
failure was purely load-induced and unrelated to the code under test.
**Why it matters**: the leak manufactures *unrelated* flakes during smoke
verification — here it surfaced an admin-seeded firefox failure with nothing
to do with the change being verified, costing investigation time and risking
a wrong fix being chased. Any future multi-run smoke or local-matrix session
hits the same wall as the suite grows.
**Investigate** (before feature 004) — candidate root causes:
  - Next.js dev compiler / HMR memory retention across a long session (the
    `.next/dev` postcss workers and module graph held warm).
  - Supabase client connection pooling under the e2e harness (each spec's
    `createAdminClient` / sign-in path; possible un-closed clients).
  - Playwright `reuseExistingServer: true` interacting with hot reload — the
    server is never torn down between runs, so nothing reclaims the heap.
**Workaround until investigated**: restart the dev server between full-suite
runs (or every 2 runs); for the smoke gate, run the matrix once against a
freshly-started server rather than stacking runs.
**Fix scope**: small-to-medium — an investigation spike to attribute the leak
(heap-snapshot the `next dev` process across runs) first, then either a
harness change (let Playwright own the webServer lifecycle per run instead of
reusing) or an upstream Next/Supabase mitigation.
**Address by**: before feature 004 begins. Pairs with the "Playwright local
matrix run: pipe-buffering deadlock" tooling entry above — both are about
making the local matrix run reliably.

### Non-dismissible confirmation notifications (stress-detection prompts) (#56)
**Status**: deferred-feature
**Observed**: 2026-05-25, feature 003 ST-2 review (Notification component)
**Description**: A stress-detection confirmation notification — e.g.
"we noticed you might be stressed — are you okay?" — should NOT be
dismissible by click-outside or Escape. The whole reason that prompt
fires is that the user may be distracted or overwhelmed; a stray click
or keypress dismissing a time-sensitive check-in is exactly the
accidental loss we want to prevent. Informational notifications keep
the current dismiss-anywhere behaviour (explicit Dismiss button, Escape,
click-outside); only confirmation-of-detection prompts lock down to the
explicit Dismiss control.

Deferred because feature 003's Notification is built-don't-mount per
FR-033 — the component exists but nothing in 003 mounts it. The
dismissibility decision belongs to the consumer features that actually
mount confirmation flows: 008 (stress detection), 010 (chat), 014
(talk). Whichever ships the first non-dismissible notification owns the
implementation.
**Fix scope**: small — 5-10 lines plus a small Vitest addition. Add a
`dismissible?: boolean` prop (default `true`) to `Notification`
(`apps/web/components/notification.tsx`). When `false`, wire Radix
Dialog's `onPointerDownOutside` and `onEscapeKeyDown` on
`DialogPrimitive.Content` to call `event.preventDefault()`, so the
surface can only be dismissed via its explicit Dismiss button
(`DialogPrimitive.Close` → `onOpenChange(false)`). Pass
`dismissible={false}` for confirmation-of-detection notifications;
leave the default for informational ones. Vitest: assert that with
`dismissible={false}` an Escape keypress and an outside pointerdown do
NOT fire `onOpenChange(false)` while the Dismiss button still does, and
that the default (`dismissible` unset) path keeps all three dismiss
routes.
**Address by**: whichever consumer feature (008 / 010 / 014) builds the
first non-dismissible confirmation notification.

### Auth-broadcast audit needs a forward-looking guard, not a one-time snapshot (#57)
**Status**: tech-debt
**Observed**: 2026-05-25, feature 003 — the ST-8 fix (commit c8c182c) and
the OTP follow-up (commit bdf1463)
**Description**: ST-8 and the OTP follow-up surfaced that the
auth-broadcast pattern (`broadcastSignIn` / `AUTH_SIGNIN_COOKIE`) was
applied ad-hoc at each auth-completing code path. Three rounds of "we
found another path that doesn't broadcast" happened before commit
bdf1463's audit closed the gaps:
  1. Phase 11 originally — only the form sign-in Server Action broadcast.
  2. ST-8 fix (c8c182c) — `/auth/callback` added to the bridge.
  3. OTP follow-up (bdf1463) — `OtpPanel` (signup OTP verify) added.
The audit table in bdf1463 is a one-time snapshot, not a forward-looking
guard — a future PR adding a new auth flow could regress this silently
(no broadcast → sibling tabs don't propagate after that flow completes).
**Action when picked up**: implement a contract test, lint rule, or
runtime assertion that detects when a new code path establishes a
Supabase session and redirects to an authed surface WITHOUT calling
`broadcastSignIn()` (client) or setting `AUTH_SIGNIN_COOKIE` (server).
Possible approaches:
  - Static grep check in CI: any module calling `supabase.auth.verifyOtp`
    / `exchangeCodeForSession` / `signInWithPassword` must also reference
    `broadcastSignIn` or `AUTH_SIGNIN_COOKIE`. (Note: would need an
    allowlist for `account/actions.ts`, whose `signInWithPassword` on a
    throwaway anon client is a re-auth verification, not a sign-in nav.)
  - Integration test that drives every documented auth flow and asserts
    the broadcast fires.
  - Code-review checklist update: PRs adding auth flows must update the
    audit table from commit bdf1463.
**Fix scope**: medium. Belongs in a future security / quality hardening
pass, not mid-feature work.
**Address by**: a future security / quality hardening pass.

### "Send a new confirmation" link contrast underweight in light mode (#58)
**Status**: polish
**Observed**: 2026-05-25, feature 003 smoke review (sign-in screen)
**Description**: On the sign-in screen, the "send a new confirmation"
link — surfaced when a user attempts to sign into an as-yet-unverified
email — has insufficient contrast in light mode. It is visible, but the
foreground/background ratio falls short of what's expected for an action
affordance. Dark mode reads fine. Thematically this sits with the other
light-mode contrast / token entries (muted-on-bg under AA, button-system
character) rather than being a standalone treatment.
**Fix scope**: small — single-color-token review. WCAG-probe the link's
computed foreground/background ratio against the Mist & Meadow tokens and
adjust to ≥4.5:1 (AA) or 7:1 (AAA) for the affordance. Verify dark mode
stays clean after the change.
**Address by**: design-system pass — bundle with the existing light-mode
contrast entries above (muted-on-bg under AA, button-system character).
Same workstream; not blocking any in-progress feature.

### Extend ST-9 to assert recovery flow submits password update end-to-end (#59)
**Status**: tech-debt
**Category**: testing / e2e quality
**Observed**: 2026-05-25, security slice 2 (Finding 7 verification)
**Description**: Smoke ST-9 currently verifies the password-recovery flow's
*navigation* (recovery link / OTP → `/reset-password`, and that sibling tabs do
NOT spuriously propagate a sign-in) but does NOT actually submit the new
password and assert the update succeeds end-to-end. The gap surfaced during the
slice-2 Finding 7 fix: enabling `secure_password_change=true` needed proof that a
recovery-scoped session can still call `updateUser({password})` without a reauth
nonce. With no e2e covering the password-submission step, that verification had
to be done with a throwaway Node script driving gotrue directly (recorded in
`docs/security/02-auth-cookies-broadcast.md` Finding 7 "EMPIRICAL VERIFICATION").
Because the recovery-submit path is untested, a future `config.toml` `[auth]`
change (e.g. a stricter reauthentication window, an MFA requirement on password
change, or a gotrue version bump that changes recovery-session semantics) could
silently break real password recovery and the suite would stay green.
**Fix scope**: small-to-medium. Extend `apps/web/tests/e2e/reset-password.spec.ts`
(or add a sibling spec) to: trigger a reset for a fixture user, consume the
recovery OTP via the existing `fetchLatestOtp` Mailpit helper (the OTP path is
fully Playwright-testable — no PKCE `code_verifier` blocker), land on
`/reset-password`, submit a valid new password, assert the success state, then
assert the user can sign in with the *new* password and not the old one. This
turns the slice-2 throwaway-Node verification into a permanent regression gate.
**Address by**: a future testing / e2e-quality pass, or whoever next touches
`config.toml` `[auth]` settings affecting the recovery flow. Pairs naturally with
the "auth-broadcast forward-looking guard" entry above — both harden the auth
suite against silent regressions.

---

## From security slice 3 (privileged-endpoints-and-input-validation) — merged 2026-05-25

### Invite audit log — record who invited whom (#60)
**Status**: deferred-feature
**Category**: observability / admin
**Observed**: 2026-05-25, security slice 3 (Out-of-scope note + Finding 2 review)
**Description**: `POST /api/admin/invite` records nothing about *who invited
whom*. The handler has both identifiers in hand at success — the caller's
verified `user.id` (from `getUser()`) and the invitee's `user_id` (from
`inviteUserByEmail`) — but writes no audit trail. There is no way after the fact
to answer "which admin invited this user, and when." For an admin dashboard
(feature 019) this is table-stakes provenance.
**Fix scope**: small-to-medium. Two viable shapes:
  - (a) Structured server-side log line at the 201 branch
    (`console.info("[invite] issued", { by: user.id, invited: invitedId, role })`)
    — cheap, immediate, but not queryable from the product.
  - (b) A dedicated `public.invite_audit` table (`id`, `invited_by`,
    `invited_user_id`, `role`, `manager_id`, `created_at`) written in the same
    request — queryable, surfaces invite history in the admin dashboard. Needs a
    migration + RLS (admin-read-only) and a write from the handler after step 2
    succeeds.
**Address by**: feature 019 (admin-dashboard), which is the first consumer that
needs invite history. Decide (a) vs (b) there; (b) is the durable answer if the
dashboard surfaces invite provenance.

### Concurrent-duplicate-invite idempotency (#61)
**Status**: tech-debt
**Category**: handler design / correctness
**Observed**: 2026-05-25, security slice 3 (Finding 2 empirical — concurrent race)
**Description**: Two parallel invites for the *same* email produce one `201` and
one `500`. The handler's `/already/i` → `409` branch only catches the
**sequential** duplicate (the second request sees GoTrue's "already registered"
error); two *concurrent* requests both pass the pre-check and the loser falls
through to the generic `500 invite_failed` (GoTrue raises "Database error saving
new user" on the unique-constraint collision). The slice-3 fix pass made that 500
body generic (no raw detail), but the underlying non-idempotent behavior remains:
a concurrent dupe is a 500, not a clean 409/200.
**Fix scope**: medium. Introduce an idempotency key — either caller-supplied
(an `Idempotency-Key` header the admin UI generates per submit) or derived from
`(admin_id, normalized_email)` — and deduplicate at the handler so a concurrent
or retried dupe collapses to a single deterministic outcome (200 with the
existing `user_id`, or a clean 409) instead of a 500. The partial-success /
transactional-rollback item from slice 1's Out-of-scope note benefits from the
same plumbing — both want the invite to be a single idempotent unit of work.
**Address by**: when `/api/admin/invite` gets a real browser client (feature 019
admin dashboard) and concurrent submits become reachable in practice; pair with
the invite partial-success / transactional-semantics handler-design item.

---

## From security slice 7 (rate-limits-and-parity) — merged 2026-05-26

### `/signup` is open self-serve — gate to invite-only (posture) — ⛔ PRE-PRODUCTION DEPLOY BLOCKER (#62)
**Status**: deferred-feature
**Category**: auth posture / tenancy
**⛔ Deploy-blocker** (adjudicated 2026-05-26): a real-tenant production launch with
real user signals **MUST NOT** proceed while `/signup` is open. This is a binding
gate, not merely deferred work — codified as an invariant in `docs/DECISIONS.md`
and surfaced in `PROJECT_SYSTEM_PROMPT.md`. The thesis/demo stage keeps open signup
as-is; the gate is what holds the Low–Med thesis severity in place by guaranteeing
the High-at-production posture cannot ship unaddressed.
**Observed**: 2026-05-26, security slice 7 (Finding 1 — `/signup` posture)
**Description**: `/signup` is **OPEN**. Any anonymous visitor can submit the form
and self-serve an email-confirmed `employee` account via `supabase.auth.signUp`
(`apps/web/app/(auth)/signup/actions.ts:38`). There is **no** invite-token gate,
**no** `invites` table, and **no** profiles-pre-existence check; `enable_signup =
true` at the Supabase layer (`config.toml`) and `proxy.ts` does not block
anonymous access to `/signup`. `handle_new_user` hard-codes `role='employee'`
(`supabase/migrations/20260517000030_profile_trigger.sql:20`), so a self-signup
**cannot** escalate to `team_lead`/`admin` (that control is sound) — but it still
yields a logged-in, RLS-scoped employee account inside a tool intended for invited
staff. The admin-invite email link (`/api/admin/invite`) is a *parallel*
privileged path, not the only way in. Mandatory email confirmation
(`enable_confirmations = true`) gates *email ownership*, not *authorization to
join the org*. **Severity is dual-lens: Low–Med under the thesis/pre-prod lens
that applies today; High before any real-tenant production launch** — a B2B
employee tool with open signup is a Day-1 tenancy/trust violation.
**Fix scope**: medium-to-large (FEATURE work, not a security fix-pass tweak).
Either gate `/signup` behind invite-token validation — an `invites` table (token,
email, role, expiry, consumed_at), a token field + UI on `/signup`, server-side
validation matching the token to the email, expiry handling, and
"invalid/expired invite" error states — OR make a product decision to remove
`/signup` entirely and funnel all entry through `/api/admin/invite`. Either path
needs schema + UI + tests. Optionally pair with CAPTCHA (the commented-out
`[auth.captcha]` block in `config.toml` is ready to wire) if open signup is kept
for any tier. See `docs/security/07-rate-limits-and-parity.md` → "`/signup`
posture".
**Address by**: a product/auth decision **before any real-tenant production
launch** — this MUST be re-rated to High and resolved at that gate. Not blocking
the thesis/demo stage. Likely pairs with feature 019 (admin-dashboard), which
owns the invite UX.

### App-layer rate limiting (durable limiter for invite + profile writes) (#63)
**Status**: tech-debt
**Category**: hardening / abuse-resistance
**Adjudicated 2026-05-26**: the `/api/admin/invite` per-admin throttle is **held for
feature 019** — calibrating a limit without a real admin UI is arbitrary, and
today's exposure requires a valid admin session. The slice-7 fix pass leaves an
inline reminder comment in `apps/web/app/api/admin/invite/route.ts` so anyone
touching the handler is reminded. No limiter is built this slice.
**Observed**: 2026-05-26, security slice 7 (Findings 2 + 4, custom rate-limiting recommendation)
**Description**: There is **no** application-layer rate limiter anywhere
(`proxy.ts`, Server Actions, route handlers) — verified by repo-wide grep. The app
relies entirely on GoTrue's per-IP `[auth.rate_limit]` buckets, which (a) **do not
cover** `/api/admin/invite` (service-role admin calls bypass the per-IP user
buckets; only email rate loosely caps it, and `inviteUserByEmail` may create the
`auth.users` row even when the email send is throttled — a compromised admin could
mass-provision accounts and promote them to any role), and (b) **do not cover** the
DB-write Server Actions `updateProfile` / `completeOnboarding` (they make no
rate-limited auth *mutation*; the writes are self-scoped under RLS, so the abuse
ceiling is self-directed write spam — low risk, but unthrottled at the app layer).
Neither is a reachable critical exploit today (invite is admin-gated; profile
writes are self-scoped), so this is hardening, not a live hole.
**Fix scope**: medium. Recommended approach: a **durable Supabase DB table + RLS**
(a `rate_limit_events` table or an atomic `SECURITY DEFINER` increment RPC) —
matches the existing "Postgres is source of truth" architecture, survives across
serverless instances (an in-memory `Map` does not), and is correctly sized for
these coarse, low-frequency endpoints. Start with `/api/admin/invite` keyed by
**admin user-id** (e.g. 20/min + 100/hour, IP as secondary key) — the single most
defensible addition, since service-role invites get zero coverage from GoTrue's
per-IP buckets. **Do NOT introduce Vercel KV / Upstash** (premature external
dependency for a pre-prod thesis app); revisit that only if a per-keystroke /
high-frequency surface emerges. See
`docs/security/07-rate-limits-and-parity.md` → "Custom rate-limiting
recommendation".
**Address by**: a quality / hardening slice; the invite throttle pairs naturally
with feature 019 (admin-dashboard), when `/api/admin/invite` gets a real browser
client and abuse becomes reachable in practice.

---

## From feature 004 (onboarding-video-anchor) — merged 2026-05-29

### Onboarding name step is redundant with signup full_name collection (#64)
**Status**: bug
**Observed**: 2026-05-27, feature 004 planning
**Description**: The signup form at `apps/web/app/(auth)/signup/` collects
`full_name` and stores it via the `handle_new_user` trigger
(`supabase/migrations/20260517000030_profile_trigger.sql`). The
`/onboarding` flow then re-asks for the name as its only step. This is
redundant — by the time a user reaches `/onboarding`, the profile already
has a `full_name`.

The middleware (`apps/web/proxy.ts`) routes to `/onboarding` when
`full_name IS NULL`, so the redirect itself is defensible (it catches the
edge case where signup metadata didn't propagate). But the page UI asking
the user to type their name again is the UX bug — it should either:

- (a) detect the existing `full_name` and skip the step entirely (let the
  middleware fall through to `/app`), OR
- (b) pre-fill the form with the existing value as a confirmation step
  rather than a blank field, OR
- (c) signup stops collecting `full_name` and onboarding becomes the
  canonical place — but this contradicts the current UX where signup
  feels incomplete without it.

Option (a) is the cleanest. Option (b) is the least disruptive.

**Fix scope**: small — single page edit in `apps/web/app/onboarding/` plus
a Server Action / middleware tweak. Pair with whichever feature next
touches the onboarding flow; do not branch standalone unless other
onboarding work converges.

**Address by**: bundle with the post-004 user-profile-and-preferences
feature (currently planned to slot between feature 007 and feature 008
per the 2026-05-27 chat decision), since that feature redesigns
onboarding for demographics + preferences anyway and will rebuild the
flow from scratch.

### Cross-browser / cross-device anchor + auth sync (realtime push) (#65)
**Status**: deferred-feature
**Observed**: 2026-05-29, feature 004 manual check — calibrating in one browser
left the banner up in another browser signed into the same account
**Description**: All cross-tab propagation in the app — the calibration-banner
hide on anchor capture (ST-17 / FR-034), the `/app/calibrate` sibling redirect,
the banner-dismissal mirror, and the feature-001/003 sign-in/sign-out navigation
— is built on `window` `storage` events over `localStorage` markers
(`apps/web/lib/auth-broadcast.ts` + `apps/web/components/cross-tab-auth.tsx`).
That mechanism is scoped to a single browser profile's storage area. So if a user
is signed into the same account in two DIFFERENT browsers (or two devices) —
e.g. Chrome on `/app` with the calibration banner showing, and Firefox finishing
calibration — Firefox's `serenify-anchor-captured` write never reaches Chrome,
and Chrome's banner stays up until its next refresh/navigation re-runs
`has_anchor` server-side. Same limitation applies to sign-in/sign-out
propagation and dismissal sync: all same-browser-only by design.

This is a **stale render, not stale data** — the anchor is written to the DB the
moment calibration completes, so Chrome is merely showing an out-of-date view;
any refresh or navigation reflects the calibrated state. No correctness or
privacy impact, and same-browser multi-tab sync (the ST-17 scope) works
correctly. `localStorage`/`BroadcastChannel` are both per-browser, so neither can
ever close this gap.

**Fix scope**: medium-to-large (FEATURE work — a new transport, not a tweak).
Cross-browser/device live updates need a **server-push channel**: most naturally
a Supabase Realtime subscription on the user's own `profiles` row (or a derived
`has_anchor`/anchor-captured event) that flips the banner / triggers a
`router.refresh()` when the row changes from any client, with the existing
`storage`-event path kept as the same-browser fast path. A polling fallback
(re-probe `has_anchor` on `visibilitychange` / focus) is a cheaper partial
mitigation that would at least clear the banner when the user returns to the
Chrome tab, without standing up Realtime. Either path needs an RLS-safe
subscription/probe scoped to `auth.uid()` only (Principle I — a user may only
observe their own anchor state, mirroring the `has_anchor` scope guard).

**Address by**: whichever feature first needs genuine cross-device live updates.
Features 008/010 (stress detection / chat interrupts) may introduce Supabase
Realtime for live notifications anyway — bundle the anchor/auth realtime sync
into that workstream rather than standing up Realtime solely for the banner. Not
blocking 004: the manual-refresh fallback is acceptable for the thesis/demo
stage, and same-browser multi-tab sync already works.

### Post-deploy mobile camera → upload → anchor verification (real devices, HTTPS) (#66)
**Status**: deferred-feature (verification, post-deploy)
**Observed**: 2026-05-29, feature 004 smoke matrix (ST-22 / ST-23 camera portions)
**Description**: The full mobile capture path — camera permission prompt → 60s
record → upload → server-side extraction → anchor write → `/app` with no banner —
could NOT be exercised locally. `getUserMedia` / `navigator.mediaDevices` require a
secure context (HTTPS); the local dev stack is plain-HTTP over a LAN IP, so the
*recording* portion of ST-22 (Chrome/Android) and ST-23 (Firefox/Android) is
deferred. The non-camera mobile UI (layout / nav / banner / 360px hamburger) WAS
verified over `http://<LAN-IP>:3000` after adding `allowedDevOrigins`. **The one
risk desktop + DevTools cannot catch**: whether a *mobile-browser-produced* video
codec (Android Chrome WebM/VP8/VP9 profiles, iOS Safari MP4/H.264) actually
**decodes server-side** in the `ml-video` OpenCV/MediaPipe path — a desktop capture
exercises a different codec profile, so a green desktop run does not prove the
mobile bytes extract. This must be confirmed on real devices once an HTTPS path
exists.
**Validated-vs-unverified (2026-06-24 recon, via 008-followups smoke Run 4 — 2026-06-22,
commit `34c951b`):**
  - **VALIDATED on a real iPhone Safari over an HTTPS cloudflared tunnel (the *calibration*
    path this entry covers):** camera permission → ~60 s record → upload → server-side
    extraction (2958-d) → `POST /anchor` 200 → anchor persisted → `/app` with no banner. The
    mobile-codec concern is answered for a *finalized* ~60 s iOS capture (it decodes
    server-side). The desktop LAN-HTTP secure-context block was separately confirmed.
  - **STILL UNVERIFIED:** the same path on a **real production (non-tunnel) HTTPS deploy** (the
    quick-tunnel is evidence, not the production target); and Android Chrome/Firefox real-device
    camera capture (ST-22/ST-23) over HTTPS. NOTE: the iOS **monitoring** (live-inference) path
    is a *separate* open `bug` — the un-finalized growing-webm `our-side` decode death tracked
    in the feature-008 section below — and must NOT hold this calibration-path entry open.
**Close-criterion**: close when this calibration mobile path is verified on the **real
production HTTPS deploy** (staging/production, not a quick-tunnel) on at least one real iOS and
one real Android device, with the produced codec confirmed to decode server-side and the anchor
row written. Tunnel runs (Run 4) count as **evidence** (calibration already passes there), NOT
as the close trigger.
**Fix scope**: medium — stand up an HTTPS dev/staging path reachable from a phone
(the backend + Supabase must also be reachable over HTTPS), then run ST-22/ST-23
camera happy-paths end-to-end and assert the produced codec decodes server-side and
the anchor row is written. ST-24 (iOS) pairs here once Apple hardware is available.
**Address by**: first deploy to an HTTPS environment (staging or production), before
relying on mobile capture in the field.

### Safari desktop + iOS Safari smoke cells (ST-21 / ST-24) — pending Apple hardware (#67)
**Status**: deferred-tooling (hardware access)
**Observed**: 2026-05-29, feature 004 smoke matrix
**Description**: ST-21 (Safari desktop, expect MP4) and ST-24 (iOS Safari mobile,
expect MP4 + iOS `getUserMedia` quirks) could not be run — no macOS/iOS device on
the team. These are the only WebKit cells in the cross-browser matrix; local
headless webkit is unreliable on Windows (worker-teardown leak — DECISIONS
2026-05-27 collected entry item 13) and does not substitute for real Safari camera
behavior. ST-24 is assigned to Gehad (iOS access).
**Fix scope**: small — run the two happy-path cells on real Apple hardware; confirm
MP4 capture uploads and the backend extracts a valid vector (FR-047 dual-codec
accept). Pairs with the post-deploy mobile HTTPS verification above for ST-24.
**Address by**: when a macOS machine (ST-21) and an iOS device on an HTTPS path
(ST-24) are accessible.

**Feature 006 addendum (2026-06-17) — usable-face-coverage gate Safari/WebKit smoke
deferred.** The 006 coverage gate and the VFR-timestamp decode it depends on
(DECISION-29) were calibrated and smoke-validated **only on Chrome and Firefox webm** —
see `specs/006-calibration-capture-quality/smoke-tests.md` §1 / §1b / §2 / §3, where the
**Safari/WebKit** cells are marked N-A / deferred. WebKit's `MediaRecorder` emits a
different container/codec than Chrome's webm (historically MP4/H.264; Safari's webm
support differs), which decodes through a different server-side path and could shift
per-frame face detection and therefore the measured coverage fraction — so the gate's
accept/reject boundary (`MIN_COVERAGE_FRACTION = 0.65` / `MIN_USABLE_FRAMES = 50`,
DECISION-32) is **unproven on Safari**. Re-run the four 006 flows on a real iPhone (thin
→ reject; half-present → reject; full minute + realistic look-aways → accept) and confirm
the same gate outcomes and the categorical `422 {"reason":"insufficient_face_frames"}`.
**Owner**: Gehad Mohamed (iPhone access). **Status**: pending.
**Pre-production gate**: clear this **before relying on live inference** — the anchor the
gate guards is the reference every later delta-from-baseline reading is measured against
(Principle II), so a Safari-specific gate miscalibration would silently poison or wrongly
block real baselines.

### Camera device selection not always written back to localStorage (ST-05) (#68)
**Status**: bug
**Observed**: 2026-05-29, feature 004 smoke ST-05 (remembered device + fallback)
**Description**: The recorder remembers the last camera in
`localStorage["serenify-anchor-camera"]` and pre-selects it on return — that part
works. But selecting a device in the picker does **not** reliably write the key:
(a) after the key was deleted, the picker briefly showed the default then switched
to a non-default device (possible ghost-selection), and (b) an explicit picker
selection was not re-written to the key. Net: the "remembered device" can drift from
what the user last picked. Low impact — the fallback to the default camera is clean
and no error surfaces — but the write-back should be unconditional (every explicit
selection writes the key).
**Fix scope**: small — on every device-picker change, write the chosen `deviceId` to
`localStorage["serenify-anchor-camera"]` (not only on certain paths), and audit the
initial-selection effect so it doesn't transiently select a device the user didn't
choose. Add a Vitest/e2e assertion that an explicit pick is persisted.
**Address by**: feature 005 (the calibration UX revamp touches the recorder anyway)
or whoever next touches `apps/web/components/anchor/` device handling.

### e2e test-hardening pass — mock-driven coverage masked real 004 bugs (#69)
**Status**: tech-debt
**Category**: testing / e2e quality
**Observed**: 2026-05-29, feature 004 smoke gate (multiple bugs slipped past green e2e)
**Description**: Several 004 bugs shipped green through the e2e suite and were caught
only in manual smoke, because the specs mock `getUserMedia` / `MediaRecorder` and
intercept the anchor API (DECISION-18) — necessary for CI, but they mask
real-environment behavior. Examples that passed e2e yet failed smoke: the camera
Permissions-Policy violation on the banner → `/app/calibrate` navigation (mocks
bypass real PP enforcement); the HS256-vs-ES256 JWT mismatch (an intercepted API
never verifies a real token); the abort-write (no real unmount-during-record path);
the health-precheck flash; and the cross-tab / dismissal sync timing. The mocks are
the right call for CI — the gap is the *absence of a non-mocked tier* and of
cross-tab / cross-session / timing coverage that exercises real behavior.
**Fix scope**: medium — add a hardening tier that does NOT rely on mocks masking
real behavior: e.g. a real-token integration test against the live local FastAPI +
JWKS; cross-tab / cross-session specs asserting the storage-event timing and the
dismissal-reset-on-sign-out invariant; and (where feasible) a guard for the
Permissions-Policy entry rule (a non-capture → capture link must be a hard nav).
**Address by**: a testing/quality slice; pairs with the feature-003 "auth-broadcast
forward-looking guard" and "extend ST-9 recovery e2e" entries — all harden the suite
against silent regressions.

### Feature 005 scope pointer — calibration UX revamp + anchor read path + design pass (#70)
**Status**: deferred-feature (pointer)
**Observed**: 2026-05-29, feature 004 ship
**Description**: Consolidation pointer so feature 005 planning pulls these together
rather than re-deriving them. Feature 005 (per-user calibration) owns: (1) the
inference **read path** for `anchor_vector` — a server-side service-role read or a
self-scoped SECURITY DEFINER function, explicitly **NOT** decided in 004 (DECISIONS
2026-05-27 collected entry "Revisit if"); (2) the **calibration UX revamp** + design
refinements; and (3) the deferred **design-system token pass** carried since feature
003 (button-system character, mobile/tablet typography, avatar disc dark-mode tint,
muted-on-bg AA contrast, card-heading typography, cursor affordance — all in the
feature-003 section above), plus the 004 recorder polish (countdown-ring light-mode
cosmetics, ST-15).
**Status update (2026-06-24 recon)**: 2 of 3 sub-items resolved; this pointer stays OPEN for sub-item (3).
  - **(1) anchor read path — DONE, but by feature 008, not 005.** The self-scoped `SECURITY DEFINER` `get_my_anchor()` shipped in feature 008's migration `supabase/migrations/20260619000000_monitoring_sessions_and_readings.sql` (T010/T011); feature 005 was locked to no-backend-change, so it never owned this, and no service-role read was used.
  - **(2) calibration UX revamp — DONE in feature 005** (PR #17, `a6a9b19`, merged 2026-06-08): the full capture-flow redesign (green room, framing guide, breathing guide, calm camera-access states, recalibrate entry, success state).
  - **(3) design-system token pass — STILL OPEN.** All six feature-003 token-pass items (button-system character, mobile/tablet typography, avatar disc dark-mode tint, muted-on-bg AA contrast, card-heading typography, cursor affordance) remain open in the feature-003 section above with unchanged `polish`/`bug` status; 005 did not absorb them and they were never re-homed to a specific feature. The 004 countdown-ring (ST-15) cosmetic has no standalone entry; feature 007's Graphite recolour may have addressed it (unverified). This pointer stays open as the live tracker for that still-pending design-system pass.
**Fix scope**: feature-sized — tracked here only as a pointer.
**Address by**: feature 005 spec/plan (sub-items 1+2 shipped; the design-system token pass (3) remains for a dedicated design pass).

---

## From hotfix/lbp-roi-interpolation (feature 005 recon) — 2026-05-29

### Store an extraction/pipeline-version alongside each anchor (auto-invalidation) (#71)
**Status**: tech-debt
**Category**: schema / anchor invalidation
**Observed**: 2026-05-29, hotfix/lbp-roi-interpolation (feature 005 recon)
**Description**: Anchors today store only `anchor_model_version` (the RF
`model_version`, currently `2.0.0`; column added in
`supabase/migrations/20260527000000_anchor_columns.sql`). The handoff's
invalidation contract (MODEL_HANDOFF §8 red-flag 4) keys off model_version:
bumping it is what flags all stored anchors as stale. But the LBP-TOP
interpolation hotfix changed the *extraction* output (the feature space) WITHOUT
touching the model — `model_version` stayed `2.0.0`, so nothing auto-flagged the
now-invalid pre-fix anchors; their invalidation had to be reasoned about and
handled manually (see DECISIONS.md 2026-05-29 "LBP-TOP ROI resize interpolation").
The extraction pipeline is a distinct axis of the feature contract from the trained
model and needs its own stored version so a future extraction change invalidates
anchors on its own.
**Fix scope**: medium — add a stored `anchor_extraction_version` (or
`anchor_pipeline_version`) column on `public.profiles` alongside the existing anchor
metadata, sourced from a constant in `packages/ml-video` that is bumped whenever
decode / ROI / LBP / motion extraction changes in a way that moves the feature
space. At inference (feature 008), treat an anchor as invalid when EITHER its
model_version OR its extraction_version mismatches the running service, and surface
the "recalibrate" prompt already contemplated in MODEL_HANDOFF §2.3. Keep the new
column write-only / scope-guarded like the other anchor metadata (DECISION-12: not
in the `authenticated` SELECT whitelist).
**Address by**: before any real-tenant production launch, or the next time
`packages/ml-video` extraction code changes — whichever comes first. Pairs with
feature 005's anchor read-path decision and feature 008's live inference.

### End-to-end extraction-vs-notebook fidelity check (prerequisite for feature 008) (#72)
**Status**: tech-debt
**Category**: testing / fidelity verification
**Observed**: 2026-05-29, hotfix/lbp-roi-interpolation (feature 005 recon — check #4)
**Description**: The 005 recon verified each extraction step against the training
notebook (`video-lbp-top-motion-per-subject-calibration.ipynb` == the handoff's
`refactored_v2`) IN ISOLATION — decode / 5fps / `%2` frame alignment, ROI indices +
crop math, LBP-TOP plane order + per-plane L1 normalization, motion mean/std/max
order, and the 2958-d concat — and the interpolation hotfix added a value-level
guard for the LBP-TOP block (`tests/test_lbp_interpolation_fidelity.py`). What has
NEVER run is the FULL chain end-to-end on a REAL clip: a StressID video pushed
through `packages/ml-video` (decode → 5fps → `%2` → MediaPipe FaceMesh → ROI →
LBP-TOP → motion → 2958-d concat) compared against the notebook's output for the
SAME clip within float tolerance. Recon check #4 was not run because it needs the
StressID dataset + a real MediaPipe runtime (the isolated guards deliberately avoid
both). The interpolation bug is exactly the class of defect an isolated check can
miss and an end-to-end check catches — so this gap is load-bearing, not academic.
**Fix scope**: medium — pick one StressID clip (e.g. the handoff's smoke subject
`2ea4`, Stroop clip with Relax as the anchor), run `ml_video.compute_anchor` (and/or
the full feature path) on it, run the notebook's `compute_anchor_from_video` /
`extract_full_feature_vector` on the SAME clip, and assert the two 2958-d vectors
match within float tolerance. Needs MediaPipe installed and the dataset available;
the CI Supabase/ML setup is already a tracked feature-008 dependency (see the
feature-002 "CI integration" entry) — pair them.
**Address by**: before trusting any live prediction in feature 008 (live inference).
Treat as a go/no-go gate on feature-space fidelity, not optional polish.

---

## From feature 005 (calibration-capture-flow) — merged 2026-06-08

### ~~Before the 005 detector ships — outstanding launch blockers~~ — resolved (#73)
**Status**: resolved
**Category**: deploy gate / pre-launch verification
**Resolved**: 2026-06-22 — all three pre-launch blockers cleared (confirmed by 2026-06-24
recon). (1) **T004 CSP enforce** is live in `apps/web/proxy.ts`: the capture-route delta
now ships under the enforcing `content-security-policy` header (not report-only), with
`script-src 'wasm-unsafe-eval'` + `worker-src 'self' blob:` scoped via `isCaptureRoute`;
the `securitypolicyviolation` sweep is recorded in `docs/security/05-csp-header.md`.
*Doc-lag caveat:* `docs/DECISIONS.md` DECISION-20 still narrates "report-only / T004 open"
— the running code is enforcing; that narrative line was never updated. (2) **T032
real-webcam smoke matrix** signed off by Mohamed on 2026-06-01 in
`specs/005-calibration-capture-flow/smoke-tests.md` (desktop Chrome/Firefox pass; the
Safari/Android cells are N-A / deferred to the post-deploy HTTPS verification). (3) **Mobile
camera path over HTTPS** — the calibration anchor path was validated on a real iPhone Safari
over an HTTPS cloudflared tunnel in 008-followups smoke **Run 4** (2026-06-22, commit
`34c951b`): grant → ~60 s record → upload → `POST /anchor` 200 → anchor persisted → `/app`
with no banner.
**Residual (separate items, NOT this detector-ship gate)**: iOS *monitoring* (live inference)
still returns 0 readings on a server-side un-finalized-webm decode death — tracked as its own
`bug` entry in the feature-008 section below; and the feature-004 "Post-deploy mobile camera"
entry stays **open** for verification on the real production (non-tunnel) HTTPS deploy.
**Observed**: 2026-06-01, feature 005 implementation (Phase 1 + Phase 10 follow-ups)
**Description**: The on-device face detector and the redesigned capture flow are
implemented and CI-green — the NON-NEGOTIABLE FR-050 zero-egress proof and the
consolidated e2e (`anchor-egress` / `anchor-flow` / `anchor-camera-access` /
`anchor-banner` / `anchor-cross-tab`) pass on chromium with boundary seams. Three
items MUST still be cleared before the detector ships to a real environment; tracked
together here as the 005 pre-launch gate:

- [x] **⛔ T004 — flip the capture-route CSP from report-only to ENFORCE** (HARD
  blocker, must land before any detector call ships). The scoped
  `script-src 'wasm-unsafe-eval'` (+ provisional `worker-src 'self' blob:`) delta on
  `/onboarding` + `/app/calibrate` currently ships **report-only** (T003). Run the
  `securitypolicyviolation` sweep under Playwright on both capture routes with the
  detector loading, narrow to the minimal allowance (drop `worker-src` if the runtime
  needs no blob worker), then flip to **enforce** in `apps/web/proxy.ts`. Per
  DECISION-20 / Risk R-2 the enforce MUST be verified BEFORE the detector's first real
  call — a report-only policy does not actually block, so a CSP regression would
  otherwise reach production silently.

- [x] **Run the T032 smoke matrix on a real webcam** — specifically the cross-browser
  webcam permission matrix (§1) and the three real camera-access conditions (§2:
  Blocked / Busy / No-camera) in
  `specs/005-calibration-capture-flow/smoke-tests.md`. CI proves the orchestration with
  injected seams (getUserMedia/detector); the real permission prompts, real
  cross-browser `MediaRecorder`, and the real detector clearing the soft gate on a real
  face are human-validated only — they are explicitly deferred there, not faked green
  (DECISION-26). Mohamed signs off the smoke table before merge.

- [x] **Verify the mobile camera path over HTTPS** — `getUserMedia` requires a secure
  context, so the local plain-HTTP-over-LAN stack cannot exercise mobile capture
  (camera prompt → 60s record → upload → extraction → anchor write), including that a
  mobile-browser codec (Android WebM/VP8-9, iOS MP4/H.264) decodes server-side. This is
  the same gate as the feature-004 entry "Post-deploy mobile camera → upload → anchor
  verification (real devices, HTTPS)" and the iOS ST-24 cell above — re-stated here so
  005 is not declared shippable without it.

**Fix scope**: T004 is small (the violation sweep + one `proxy.ts` edit + a Playwright
header assertion); the smoke matrix and the mobile-HTTPS verification are
human/device-dependent runs, not code.
**Address by**: all three BEFORE the detector ships to any real (HTTPS, real-tenant)
environment. T004 specifically must precede the detector's first production call.

### ~~Thin baseline accepted as success — no minimum-usable-frames / extraction-quality gate (#74)~~
**Status**: RESOLVED — 2026-07-12, fixed in feature 006 (commit 7a1c2da, PR #19)
**Category**: backend / extraction quality (anchor validity)
**Observed**: 2026-06-01, feature 005 smoke — a 60 s baseline recording in which the
user's face was actually in frame for only **~2 s** was still accepted as success
("Your baseline is set", `apps/web/components/anchor/success-state.tsx:23`).
**Symptom**: An almost-empty recording produces a "successful" calibration. The user
believes they are calibrated when the baseline is built from a handful of usable
frames and is almost certainly garbage — which then poisons every later
delta-from-baseline reading at inference (feature 008). The failure is silent: there
is no warning, no failure chip, no "insufficient footage" path. It is a correctness
bug, not polish — a green calibration that is not actually a usable baseline.

**Findings (read-only investigation 2026-06-01):**

**1. The API never gates on how many frames had a usable face — it returns a vector
whenever ≥1 face frame exists.** `POST /anchor` (`apps/api/app/routers/anchor.py`)
calls `ml_video.compute_anchor(tmp_path)` and, unless that raises
`FeatureExtractionError` (→ 422), base64-encodes the vector and returns 200. The only
gates inside `compute_anchor` (`packages/ml-video/src/ml_video/anchor.py`) are a final
**shape** check (`features.shape != (FEATURE_DIM,)`) and an **all-finite** check
(`np.all(np.isfinite(features))`) — neither says anything about face *coverage*. The
two upstream feature functions impose only degenerate floors:
  - `lbp_top_features` (`packages/ml-video/src/ml_video/features.py:110`) skips
    zero-row (no-detection) frames per ROI and raises **only if a whole ROI yields
    ZERO valid frames** — i.e. **one** usable frame per ROI is enough:
    ```python
    if not crops:
        raise FeatureExtractionError(
            f"ROI '{roi}' produced no valid frames; LBP-TOP would be < 90-d"
        )
    ```
  - `motion_features` (`features.py:136`) raises only if there are **fewer than 2
    frames total** — and it is "Computed over the FULL landmark array, zero-rows
    included", so no-face frames satisfy this floor:
    ```python
    if landmarks.shape[0] < 2:
        raise FeatureExtractionError(
            "need at least 2 frames to compute motion features"
        )
    ```
There is **no** minimum count or fraction of face-present frames, and **no**
confidence/quality score gating the response. (MediaPipe's `min_detection_confidence`
is used internally per frame, then collapsed to a binary face/zero-row — no aggregate
confidence is retained.) Concretely: a 60 s clip is downsampled to ~2.5 fps
(`pipeline.py` `TARGET_FPS = 5`, `FRAME_SKIP_MOD = 2`), ≈150 kept frames; a ~2 s face
presence ≈ **~5 non-zero rows out of ~150** — LBP passes (≥1/ROI), motion passes (≥2
total, zero-rows count), shape + finite pass → **200 success**. Exactly the symptom.

**2. The server-side pipeline ALREADY has the signal it would need — it just doesn't
count it.** `extract_landmarks` (`packages/ml-video/src/ml_video/pipeline.py:48`)
emits a **zero-row** for any frame with no detected face:
```python
def _landmarks_from_result(result) -> np.ndarray:
    faces = getattr(result, "multi_face_landmarks", None)
    if not faces:
        return np.zeros(LANDMARK_DIM, dtype=np.float64)
    ...
```
So `clip.landmarks` already distinguishes face frames (non-zero rows) from no-face
frames (all-zero rows), and `lbp_top_features` literally inspects this per frame
(`if not np.any(row): continue`, `features.py:123`). The usable-frame count is one
line away — `int(np.count_nonzero(np.any(clip.landmarks, axis=1)))` — but the backend
never computes, retains, or acts on it. The raw signal exists; the gate does not.

**3. The frontend ALREADY tracks face-presence across the whole recording — but only
to label a failure, never to prevent a success.** The framing detector runs during
recording (not just the green-room gate), and `anchor-recorder.tsx:226` folds every
per-frame signal into `CauseTelemetry` while recording:
```python
const handleSignal = useCallback((signal: FramingSignal) => {
  if (recorderRef.current?.state === "recording") accumulate(telemetryRef.current, signal);
}, []);
```
`accumulate` (`apps/web/lib/face-detect/cause-telemetry.ts:33`) counts `totalFrames`
and `offTargetFrames` (which includes `!signal.facePresent`) — so the client already
holds an off-target/absence ratio for the minute. **But that telemetry is consumed
ONLY on a backend 422** (`anchor-recorder.tsx:302`, `dominantCause(...)` inside the
`extraction_failed` branch) to pick the failure chip; on a 200 it is discarded. For
the 2-s clip, `offTargetFrames/totalFrames` would be ~0.97 (well over the 0.35
`CAUSE_MIN_RATIO`), yet because the backend returns 200 the rich presence summary is
thrown away and "Your baseline is set" shows anyway.

**Candidate fixes (feature 008 / backend-quality pass — NOT a 005 task):**
- **Primary — backend min-usable-frames / coverage gate (authoritative).** In
  `ml_video` (in `extract_landmarks`/`compute_anchor`), count non-zero landmark rows
  and raise `FeatureExtractionError` when usable face frames fall below a calibrated
  threshold (an absolute floor and/or a fraction of kept frames). This reuses the
  existing failure channel — `FeatureExtractionError` → **HTTP 422** → the frontend's
  `extract-failed` state, cause chip, and 3-strike escape — so **no new API surface
  is required**. Optionally give it a distinct reason (e.g. `insufficient_face_frames`)
  so the chip can say "we couldn't see your face for enough of the recording" instead
  of the generic cause. The threshold must be calibrated against the training
  distribution (how many usable frames a *real* StressID anchor clip yields), so it
  pairs naturally with the end-to-end fidelity check below.
- **Alternative/companion — an extraction-confidence/quality score.** Derive an
  aggregate detectability/quality score for the clip and gate on it, rather than a raw
  frame count — more robust to fps/duration variation, but needs a defensible
  threshold (same calibration dependency).
- **Optional — frontend presence-summary assist (defense-in-depth, NOT the gate).**
  The client already computes coverage in `CauseTelemetry`; it could warn earlier and
  more kindly ("we lost sight of your face for most of that — try again?") before/at
  upload. This must NOT be the only gate: the on-device detector can be `unavailable`
  → the soft gate is bypassed and no telemetry is collected (FR-011,
  `use-framing-guide.ts`), and it is a different model from the server's FaceMesh. The
  authoritative decision belongs server-side (Principle III — modality logic lives in
  `ml_video`); the frontend summary is only earlier/kinder feedback.

**Why this is deferred, not fixed now**: feature 005 is **locked to no
backend/contract changes** (`contracts/backend-unchanged.md`); the real fix lives in
`packages/ml-video` + `apps/api`, which 005 must not touch. It belongs with the
inference work that consumes these anchors.

**Cross-references (standing extraction/anchor-quality caveats):**
- "End-to-end extraction-vs-notebook fidelity check (prerequisite for feature 008)"
  (above) — the same calibration/dataset run that would fix this should also fix the
  coverage threshold; treat min-usable-frames as part of that go/no-go fidelity gate.
- "Store an extraction/pipeline-version alongside each anchor (auto-invalidation)"
  (above) — a different anchor-validity axis (stale feature space); this entry is
  about a *thin* anchor in the current feature space. Both feed feature 008's
  "is this anchor trustworthy?" decision.
- The `# CAVEAT` fidelity markers in `features.py` (lines 8–18) and MODEL_HANDOFF §8
  red-flags 6/8 — the existing "confirm against the training notebook before trusting
  production vectors" caveat; coverage is the volume-of-evidence companion to it.
- DECISION-24 (cause telemetry) — the existing client signal this entry proposes
  promoting from "explain a failure" to (optionally) "warn before a thin success".

**Fix scope**: small-to-medium for the backend gate itself (a frame-count/coverage
check + a 422 reason + a unit test); the load-bearing cost is **calibrating the
threshold** against real anchor clips, which is gated on the same MediaPipe runtime +
StressID dataset as the end-to-end fidelity check.
**Address by**: feature 008 (live inference) / a backend-quality pass — before any
live prediction trusts a stored anchor. A thin baseline silently poisons every
delta-from-baseline reading, so this is a correctness prerequisite for inference, not
optional polish.

---

## Product-wide / cross-cutting — captured 2026-06-19

These two items were not deferred from a single feature; they are product-wide
concerns surfaced during the feature 007 / 008 window and logged here so the
roadmap pulls them in at the right gate rather than re-deriving them.

### Terms of Service, Privacy Policy, and signup consent gate (Egyptian jurisdiction) — ⛔ PRE-PRODUCTION DATA-PROCESSING GATE (#75)
**Status**: deferred-feature
**Category**: legal / compliance / consent
**Observed**: 2026-06-19, product-wide capture (cross-cutting, not deferred from a single feature)
**Description**: The app needs a **Terms of Service** and a **Privacy Policy**, plus an
**acceptance checkbox on the signup page** (`apps/web/app/(auth)/signup/`) that **gates
account creation** and links to both documents. None of these exist today.

**Jurisdiction — Egypt.** The governing data-protection statute is the **Personal Data
Protection Law (Law No. 151 of 2020)**. **Egyptian labour law is also in scope**, because
the product is employee monitoring and may inform employment-affecting decisions — so the
documents sit at the intersection of data-protection and employment regimes, not data
protection alone.

**High-sensitivity case.** This combines **facial/biometric capture**, **inferred
health-adjacent data** (stress), in an **employment context** — exactly the categories
these regimes treat **most strictly**. Generic templates are **not acceptable**; the
documents must be grounded in the actual statute text and the app's real data flows
(what is captured, where it is processed, who sees what, retention, cross-border).

**⛔ Resourcing reality — record this caveat explicitly.** There is **no external legal
reviewer available**. The documents will be drafted in-project (Claude + CC), grounded in
the actual statute text — but this produces an **INFORMED DRAFT, not legal assurance**. A
**qualified legal review is required before any real (non-demo) user data is processed**.
The thesis/demo stage may proceed on the informed draft; a real-tenant launch may not.
**Fix scope**: large (FEATURE work, not a doc-only task). Two real documents authored
against Law 151/2020 + the employment-law overlay and the app's actual data-handling
substance; a consent checkbox + links wired into the signup Server Action
(`apps/web/app/(auth)/signup/actions.ts`) that blocks account creation until accepted;
acceptance recorded (timestamp + document version) so consent is auditable; and the
"informed-draft-not-legal-advice" caveat tracked until a qualified legal review clears it.
**Address by**: **feature 013 (public-surface-and-legal)** — the public landing page,
`/terms`, `/privacy`, the site footer, and the signup consent gate are exactly 013's scope
(Constitution Amendment 16). The documents must still be grounded in the actual
data-handling substance that **feature 018 (privacy-controls-and-transparency)** defines
(manager visibility, privacy slider, transparency view) — 013 authors the ToS/Privacy pages
and wires the signup gate; 018's data-handling substance feeds their content, and either doc
gets revisited if 018 changes what is collected/seen/retained (see the standing
Privacy-Policy/ToS-per-PR rule added in Amendment 16). **Ship the signup checkbox together
with the real documents** (not a placeholder linking to empty pages). **Hard gate: before
any real user data.** Pairs with the security-slice-7 "`/signup` is open self-serve — gate
to invite-only — ⛔ PRE-PRODUCTION DEPLOY BLOCKER" entry (both are binding pre-real-data
gates on the signup surface) and with the `/app/account` Privacy placeholder that feature
018 fills in.
**Update (2026-06-29, feature 011)**: still **OPEN** — feature 011 ships only the in-app
chatbot companion disclaimer ("Ren is an AI companion, not a substitute for professional
care.") on chat surfaces; this is **not** the consent gate. The full ToS/Privacy documents +
the account-creation consent checkbox remain unbuilt and this stays a pre-real-data blocker.
**Update (2026-07-24, Constitution Amendment 16)**: owning feature reconciled from
`018-privacy-controls-and-transparency` to **`013-public-surface-and-legal`** — Amendment 16
inserted 013 as the slot for the public landing page/`/terms`/`/privacy`/signup consent gate,
which is #75's actual subject; still **OPEN** (013 has not shipped).
**Update (2026-07-25, mis-close corrected)**: GitHub issue #75 was closed as COMPLETED on
2026-07-24 by commit `fba656d` (PR #154, the owning-feature reconcile above), which carried a
stray closing keyword. **Nothing that could complete it shipped** — there is still no `/terms`,
no `/privacy`, and no signup consent checkbox. This entry and `docs/DECISIONS.md` both recorded
it as OPEN, and per `CLAUDE.md` BACKLOG wins on conflict, so **the issue was reopened**. It
re-closes only when feature 013 ships. Newly paired with **#157** (camera + inference consent
gate) — the two consent gates on the same user journey, both owned by 013, both binding
pre-real-data blockers.

### Internationalization — Arabic (RTL) and possibly French (#76)
**Status**: deferred-feature
**Category**: i18n / localization / layout
**Observed**: 2026-06-19, product-wide capture (cross-cutting, not deferred from a single feature)
**Description**: The app should ship an **Arabic** version, and possibly **French**. In the
Egyptian market **Arabic is arguably the primary language, not an add-on** — treating it as
an afterthought misreads the target users.

**Load-bearing cost — Arabic is right-to-left.** This is **layout mirroring**, not just
string translation: logical CSS properties (`margin-inline-*`, `padding-inline-*`, `start`/
`end`), `dir="rtl"` on the document, and a **per-surface review** of every directional
element — nav, chevrons, progress bars, the calibration flow, the Graphite layout — to
confirm it mirrors correctly. **Additional Arabic-specific costs:** the current type stack
(**Inter and Outfit**) does **not** cover Arabic glyphs, so an Arabic-capable font must be
added and tuned; and Arabic has **six CLDR plural categories** (vs English's two), so any
count-driven copy needs full plural handling. **French is lower-cost** (Latin script, LTR)
but still requires **full string externalization**. Beyond static UI, the **chatbot (010)**
and **questionnaire (009)** generate **natural-language content** that also needs
localization, and the **LLM prompts are English-only today**.

**Open decision — is Arabic in scope for the thesis demo, or post-thesis?** The answer
**changes how strings are written from feature 008 onward**: if Arabic is in, strings must
be authored into message catalogs as features land; if it is deferred to post-thesis, that
externalization can wait — but retrofitting it later is the expensive path.
**Fix scope**: feature-sized for the full retrofit (layout mirroring + Arabic font +
plural rules + content/LLM-prompt localization across every surface). **Cheap-insurance
recommendation:** if Arabic is in scope for the thesis, **externalize UI strings into
message catalogs as new features are built (008 onward)** rather than retrofitting at the
end — the incremental cost per feature is small; the end-of-project retrofit is not.
**Address by**: **decide the thesis-scope question early.** The full RTL retrofit is
feature-sized and best **not** deferred to the very end if Arabic is in scope — the
string-externalization discipline must start at feature 008 to avoid a costly retrofit,
even if the actual Arabic translation + RTL pass ships later.

---

## From feature 008 (stress-inference-service) — merged 2026-06-22

- **T026 recorder mime — feature-detect and support BOTH containers (webm-preferred, fMP4 fallback), do not hard-code one** (#77) (`watch` / pre-build, from 008 device gate): the T009 gate proved both webm and fMP4 decode to `(2958,)`, but on a single iOS device, and iOS WebM-capture support is recent/uneven — so `window-recorder.ts` (T026) must `pickMime` webm-first with an fMP4 fallback rather than assume either container.
- **Keep-up — surgical O(stride) tail-decode SHIPPED (2026-06-21); the full per-session rolling buffer is now only a *conditional* upgrade, and the read loop still needs back-pressure** (#78) (`watch` / production-deploy, from 008 device gate + the 2026-06-20 supervised smoke; pairs with research R-5 / T009): the supervised smoke measured the live lag *growing* ~9 s/window to ~3 min behind, because the server **re-decoded the whole growing recording-so-far every window** (per-window decode O(elapsed)). **Fixed surgically** in `ml-video` (`pipeline._extract_landmarks_tail` + `probe_global_timestamps_fast`, wired through `compute_anchor(tail_seconds=60)` + `probe_recorded_seconds`): both the `< 60 s` gate and the tail decode now touch only the **bounded trailing 60 s** (ffprobe packet grid + native-seek/ffmpeg-`-c copy`-remux), **bit-identical** to the whole-file path (`tests/test_tail_seek_keepup.py`). Measured before→after on the chrome continuous fixtures: per-window total **18 s→13 s, 30 s→11 s, 34 s→9 s, 51 s→11 s, 55 s→9 s** — i.e. BEFORE *grew* 3.1× with elapsed (O(elapsed), lag climbs), AFTER is **flat ~9–13 s** (O(stride), independent of elapsed). The growing-lag breach is removed. **TWO things remain** (decide alongside the chosen deploy target): **(a)** the *absolute* flat cost is still ~9–13 s on the dev laptop — partly the constant MediaPipe+LBP extract (R-5's separate, decode-independent cost; lever = slower reading cadence or GPU MediaPipe) and partly the bounded tail decode — so on a slower target it may still sit near/over the 10 s stride; the **full per-session rolling decoded-frame buffer** (decode only the **new ~10 s increment** each window → ~1.5 s decode, true O(stride) not O(window)) is the upgrade to build **only if** keep-up is re-measured on the real deploy target and the surgical flat cost breaches there (Option 2 of the 2026-06-21 design choice). **(b)** the read loop must still not fire a new stride while one is in flight (or must coalesce) — the per-stride-decode fix does not prevent overlap. **[note (b) RESOLVED 2026-06-26 → formalized + fixed as #110 (per-session scoring gate, concurrency 1, + drop-stale + client coalescing back-pressure); PR #113.]** Also: the surgical fix adds an **ffmpeg/ffprobe CLI** dependency on the API host (Dockerfile + `apps/api/README.md`); absent → degrades to whole-file decode (O(elapsed)), runs-but-fails on a clip → skipped window (200), never 500. Run `test_tail_seek_keepup.py` **on the deploy image** so an ffmpeg version difference can't silently shift fidelity.
- **In-memory smoothing buffer needs single-worker / session affinity / a shared cache in a multi-worker deploy** (#79) (`watch` / production-deploy, from 008 US1 T020; see DECISIONS 2026-06-20): the D-3 server-side smoother reads the last N=4 scored `proba[1]` from a **per-session in-memory buffer** (`inference.py` `_SessionBuffers`), NOT from the DB — because revised D-1 removed the service-role and the `window_readings` SELECT whitelist withholds `stress_probability` from `authenticated`, so the API can't read the raw probability back. Consequences for production: (a) with **>1 worker** the per-stride windows for a session must land on the **same** worker (session affinity) or share state via an external store (e.g. Redis), else the buffer is split and the band warms up erratically; (b) an **API restart drops all buffers**, so each active session **re-warms** (~90 s) — harmless but visible. Acceptable for MVP / localhost (single worker). Same class as the deferred rolling decoded-frame buffer + the read-loop back-pressure item above — decide alongside the chosen deploy target. The explicit per-session `buffers.drop()` on End is wired in US2 / T036; an LRU cap bounds memory until then.
- **Dev-side manifestation of the smoothing-buffer drop: running live-monitor under bare `--reload` leaves the bloom *permanently* stuck on "getting a read on things"** (#80) (`watch` / dev-diagnostic, from the 2026-06-23 dev-reload diagnosis; pairs with the in-memory smoothing-buffer item above): empirically-confirmed dev fingerprint, recorded so it isn't re-debugged. **Symptom:** the live bloom is stuck on **"getting a read on things"** for an entire session, while the **recap afterward shows a normal band line**. **Cause:** running the inference service under `--reload`; a uvicorn **worker restart** — triggered by *any* watched-file change (source save, cache write, `git checkout`) — drops the per-session in-memory smoothing buffer (`_SessionBuffers` in `app/services/inference.py`), forcing a fresh **~90 s / 4-window re-warm** each time. Persisted bands survive (the `window_readings` inserts are already committed) → the **recap is fine** but the **live bloom never latches**. **Fingerprint in `window_readings`:** band→warming-up regressions + a band appearing **before** 4 scored windows + an upload gap — a combination **impossible under one stable buffer**. **Dev workaround:** `--reload --reload-dir app` (or no `--reload`) for live-monitor testing, and **don't edit `app/` source mid-session** (even under `--reload-dir app`, saving a watched source file restarts the worker) — see `apps/api/README.md` "Live-monitor testing" + the 008/004/005 quickstarts. **Relation to the buffer note above:** that item covers the **multi-worker / intentional-restart** re-warm (a one-time, visible warm-up); this is the **single-worker dev** manifestation — under `--reload` the restart is **involuntary and repeated**, so the bloom looks *permanently* stuck rather than re-warming once.
- **Live-monitor readings stability (live-bloom durability)** (#81) (`watch` / production-deploy, from the 2026-06-23 dev-reload diagnosis; pairs with the in-memory smoothing-buffer item + the dev fingerprint above): make the live bloom durable so it latches whenever a band has actually been computed/persisted, independent of worker lifecycle and live-response delivery. **Scope (from the read-only diagnostic):** **(a)** make the cold-start smoothing buffer **restart/worker-resilient** — single-worker + session affinity, or a shared cache (e.g. Redis), decided with the chosen deploy target; this is the existing buffer-durability concern, now shown to bite in **dev** too (the fingerprint above). **(b) decouple the live bloom from live-response delivery** — drive it partly from the `getSessionTrend` poll (the same durable `window_readings` rows the recap + the monitor "This session" card already read via `apps/web/lib/api/monitoring-reads.ts`), so a band that reached the DB shows even if its live scoring response was lost or late; this removes the recap-vs-bloom inconsistency at its root. **(c) investigate (needs live logs):** the final **~166 s upload cessation** (face-gate vs server-side upload failure) and the **"sign in again" mid-session auth event** seen in the 2026-06-23 run — Mohamed has the backend logs; attach when this branch opens. Same `production-deploy` class as the keep-up tail-decode + multi-worker buffer-affinity + read-loop back-pressure items above — do **stability first**. Fix scope: medium, split across `area:api` (buffer durability) + `area:web` (bloom driven off the durable poll). **Suggested issue labels:** `type:bug`, `area:api` (+ `area:web` for the bloom-delivery half).
- **Feature 017 (team-lead dashboard) must add a tightly-scoped coarse-aggregate read path with multi-range time selection — NOT reach for the service-role key** (#82) (`deferred-feature` / blocks-017, **consolidated 2026-06-24 (absorbed the feature-001 "Manager dashboard time-range insights" manager-visibility item)** + the 008-foundational read-path constraint, T010–T011): **(read-path constraint — from 008)** 008 deliberately denies any manager access to `monitoring_sessions` / `window_readings` — owner-only RLS (select/insert/update-own), **no manager policy at all**, and `apps/api` holds **no service-role key** (revised D-1). When 017 needs managers to see team stress at a glance, it MUST satisfy that with a **tightly-scoped `SECURITY DEFINER` rollup function or a manager-readable aggregate view** that exposes **coarse bands only** (e.g. counts/fractions per band over a window, or a team tenor) and **never raw individual `window_readings`, never `stress_probability`/`label`, never per-employee point data** — mirroring `get_my_anchor()`'s self-scoping but widened to a manager's direct reports under the existing `profiles` manager relationship, with its own privacy review. It must **not** introduce a service-role key into `apps/api` to bypass RLS — the whole 008 posture is that the manager layer gets *nothing* by default, and any manager visibility is an explicit, coarse, separately-reviewed addition. **(time-range UX — from the feature-001 wrap-up)** The team-lead (and, for org-wide aggregates, the admin / feature 019) dashboards must support multiple time ranges for viewing stress trends — **1 week, 1 month, 1 quarter, 6 months, 1 year** — via a time-range selector control that re-aggregates the underlying daily data into weekly/monthly bars as appropriate. This is *compatible with* the read-path posture above, and the two reinforce each other: broader windows are **more** privacy-preserving (less granular), not less. **Fix scope**: medium — the `SECURITY DEFINER` rollup / manager-readable aggregate view + RLS + privacy review (read-path half), plus the time-range UI control, query-side aggregation, and Recharts charting (UX half). Suggested issue labels: `type:feature`, `area:db` (+ `area:web` for the selector UI). **Address by**: feature 017 (team-lead-dashboard) spec — must include BOTH the coarse-aggregate read-path constraint AND the time-range selector as acceptance scenarios; feature 019 (admin-dashboard) likewise for org-wide aggregates.
- **A new camera/capture route must be registered in EVERY camera-policy touchpoint, or `getUserMedia` silently dies under the inherited `camera=()`** (#83) (`watch` / pre-build, from 008 US1 — `/app/monitor` originally shipped registered in none of them, so a granted permission still yielded no stream): a route that calls `getUserMedia` must be added to **(1)** `CAPTURE_ROUTES` in `apps/web/next.config.ts` (the `camera=(self)` Permissions-Policy header map) **AND (2)** the negative-lookahead exclusion in that same file's site-wide `camera=()` rule (`/((?!onboarding|app/calibrate|app/monitor).*)`) — these two spots MUST move together, because a path matched by *both* PP rules emits a *combined* `camera=() ∩ camera=(self) = denied` header that breaks the camera — **AND (3)** `isCaptureRoute` in `apps/web/proxy.ts`, which scopes the on-device MediaPipe detector's CSP (`script-src 'wasm-unsafe-eval'` + `worker-src 'self' blob:`); without it the detector WASM is CSP-blocked and the capture stage renders blank. The route's API origin must also stay reachable via the proxy `connect-src` (sourced from `NEXT_PUBLIC_API_URL`), so keep that env requirement **discoverable in the relevant `.env.example`** — the same discoverability discipline as the `SUPABASE_ANON_KEY` fix in `apps/api/.env.example`. Symptom of a miss: a granted camera permission still yields no stream (PP denied) or a blank stage (CSP-blocked WASM). A lint/test guard asserting these three lists stay in lockstep would retire the regression class.
- **US4 trend: ambient "weather of the day" view + feel/precise toggle** (#84) (`deferred-feature` / post-demo (after feature 011), from 008 US4 trend design): while designing the US4 trend we explored an ambient, lower-precision "weather of the day" representation (soft colour fields across the day rather than the precise soft-line trend), and a feel-vs-precise toggle between it and the approved soft area+line trend. Deferred from 008 to keep a single trend visual language and avoid doubling the build/test/a11y surface in a branch closing clean. Note for any revisit: the literal sun/cloud icons + weather wording read off-voice for Serenify — a future ambient view should use Serenify's own band vocabulary (at ease / a little tense / tense) and abstract soft colour, not weather iconography. Fix scope: medium — a second trend representation, a toggle control, persisted toggle preference, plus its own a11y/responsive/test coverage. Address by: post-demo, after feature 011 — optional dashboard flourish; only if there's appetite for an ambient view.
- **Model-owner: remove/annotate the stale `window_eval_config` (30 s) block in `metadata.json`** (#85) (`tech-debt` / model-owner, from 008 T056 carry-over; research R-0): the committed model artifact's `metadata.json` carries a stale `window_eval_config` of **30 s** that is **NOT** the production window — the production contract is **60 s / 10 s**, locked by Constitution Principle II + FR-002 + `docs/MODELS.md`, and the operating point 0.53 is read from `loso_metrics_60s_calibrated`. The 30 s block is a leftover from an earlier eval and could mislead a future reader into shortening the window. **This is a model-owner task, deliberately NOT actioned in 008.** When picked up it is **metadata/doc-only**: annotate or delete the stale block — **NO `model_version` bump, NO anchor invalidation, and DO NOT edit the model artifact or re-touch `metadata.json` in a way that changes the artifact hash** (touching it would invalidate the verified anchor + the bit-for-bit fidelity established for `@2.0.0`). Safest shape is a `docs/MODELS.md` clarifying note that the 30 s block is stale and ignored, leaving the artifact byte-untouched; only the model owner should decide whether to also edit the artifact's metadata under a controlled re-publish. Fix scope: small (doc note) / medium (controlled artifact re-publish, owner-only). Address by: the next model-owner maintenance pass; not blocking 008.
- **Retention: 90-day `window_readings` purge job (policy decided, job deferred)** (#86) (`deferred-feature` / data-retention, from 008 T057; `data-model.md` § Retention): 008 decides the retention **policy** — `window_readings` is kept **90 days then purged** (it carries the affective per-window signal; `monitoring_sessions` is retained longer as it holds no raw signal) — but **does not build the purge job**. The job is a small additive `pg_cron` task (or an external scheduled task) running e.g. `DELETE FROM public.window_readings WHERE created_at < now() - interval '90 days';`. No 008 surface reads a reading older than today's recap / the 009 sustained-tense window, so the job's absence has **no functional effect in 008** beyond unbounded storage growth on a long-lived deployment. Fix scope: small — one `pg_cron` schedule (or a cron'd server task) + a migration if using `pg_cron`; pair with whichever feature first provisions scheduled DB jobs. Address by: **unslotted** — not owned by any planned feature (in particular **NOT** `013-public-surface-and-legal`; Amendment 16's Privacy-Policy/retention rule requires the *policy* to describe retention, not this *purge job* to be built). Pair with whichever feature first provisions scheduled DB jobs, before any long-running production deployment accumulates >90 days of readings; deferred from 008.
- ~~**Two pre-existing eslint errors in `components/monitor/monitoring-session.tsx` (NOT US4/Phase-8-introduced; deliberately not fixed in polish)**~~ — **CLOSED 2026-06-25, by-design / not-planned (PR #94, `3ee89a3`; issue #87 closed NOT_PLANNED)** (#87) (`tech-debt` / from 008 T058 sweep, pre-dates US4): `npm run lint` reports exactly two errors, both pre-existing from the camera-lifecycle fix and **left untouched on purpose** in the Phase 8 polish pass because they sit on the camera `srcObject`/release lifecycle and are risky to refactor in a polish task: **(1)** `react-hooks/immutability` at **L200** — the reactive bind-and-play effect assigns `videoEl.srcObject = stream` (eslint flags mutating a value returned from `useState()`); this is the deliberate fix for the "self-view stuck until alt-tab" bug (the effect, not the callback ref, owns `srcObject` so a stream arriving after the element mounts still binds). **(2)** `react-hooks/set-state-in-effect` at **L478** — the standing release effect calls `stopStream()` (which `setStream(null)`) when leaving a capturing op; this is the privacy guarantee that a non-capturing op never holds the camera. Both are functionally correct and load-bearing for the camera lifecycle; "fixing" them risks regressing the self-view/release behaviour. `tsc` and Vitest are green; this is the only expected non-green in the lint sweep. Fix scope: medium — a careful camera-lifecycle refactor (e.g. an imperative ref-callback for `srcObject`, an external-store subscription for release) with the full monitor unit + e2e suite as the guard. Address by: a dedicated camera-lifecycle refactor, not a polish pass. **Resolution (2026-06-25, PR #94):** closed **by-design / not-planned**, NOT via the camera-lifecycle refactor this entry scoped — instead both occurrences were declared intentional and given documented, targeted `eslint-disable-next-line` suppressions (the same load-bearing `srcObject` bind + release-effect teardown described above), restoring a true zero-error ESLint baseline so phase-1 CI (#95) runs green. The rules stay **globally active** (a fresh probe violation of each still errored); only these two lines are suppressed — no rule disabled in `eslint.config.mjs`, no file-level/blanket disable. The refactor remains an option but is not planned.
- **Preferences hub + device selection (feature-sized, ~009 range — not a polish chore)** (#88) (`deferred-feature` / `area:web`, from 008 US1 monitoring "allow camera" moment): give users a settings home for the choices that make the app feel finished — default camera, theme, and (later) language — replacing the bare "allow camera" prompt in monitoring with a proper device picker. **Scope (three parts):** **(1) Monitoring device selector** — reuse the calibration step's camera selector instead of the bare allow-camera prompt. Note: camera labels / the full device list are only exposed *after* `getUserMedia` permission, so the picker populates **post-permission** (flow: allow → `enumerateDevices` → pick → start, or pick-triggers-allow). **(2) Account → Preferences section** holding: **Default camera** — persisted **per user** as a `deviceId`, with a **graceful fallback when the saved device isn't present** (deviceIds vary across machines/browsers — don't hard-fail); **Theme** — three-state light / dark / **system** (system follows `prefers-color-scheme` via the existing `useMediaQuery` hook, driving the `.dark` class); **Language** — UI slot added now, wired only when i18n lands (currently backlogged) and **must not block the rest**. **Constraints:** per-user settings persistence must stay **RLS-as-user, no service-role key** (existing security posture); the theme + camera parts are **independent of i18n** and can ship before the Arabic/RTL targeting decision. Suggested issue labels (for the future issues migration): `type:feature`, `area:web`. Fix scope: feature-sized. Address by: ~feature 009.
- **iOS Safari *monitoring* produces 0 readings — a server-side decode death on the iOS un-finalized webm (`probe_recorded_seconds` throws → `our-side`); NOT the resolved kickout** (#89) (`bug` / suggested labels `type:bug` + `area:ml-video` (decode/probe lives there; caller in `apps/api`) + **not demo-blocking**; from 008 device gate T009 + smoke **Run 4, 2026-06-22**): On a **real iPhone Safari over HTTPS** (Run 4, cloudflared tunnel) app load + sign-in + on-device **calibration all worked**, but a **monitoring** session produced **0 readings** and died ~3.5 min in showing the client surface **"This one was on our side."** **Symptom:** the session fails partway in with the "our side" server error and never scores. **Root cause (precise):** `probe_recorded_seconds()` — the ffprobe duration probe in the O(stride) tail-decode path (**defined in `packages/ml-video/src/ml_video/anchor.py`**, called from `apps/api/app/services/inference.py`) — **throws on iOS Safari's un-finalized *growing* webm past the early-seconds mark (~40 s)**, tripping the scoring gate. Server trace (session `02a60299`): windows `probe_s = 9 → 19 → 29 → 39 s` `warming_up`, then **`probe_s = -1.00 … FeatureExtractionError:our-side`** repeated → every window skipped → the session **never reaches the 60 s scoring gate** → 0 readings. iOS also records **sub-realtime** (`probe_s = 39` at ~75 s wall-clock). **NOT auth / NOT the kickout (which is resolved):** every window upload returned **200**, **0 × 401, no re-login** — auth held the whole ~3.5 min (so the 008-followups `[1]` stale-token fix held on iOS and was the wrong layer for this); a true ITP/re-login kickout did **not** reproduce. Chrome's un-finalized webm decodes fine (desktop scored **35 readings** across the full band range the same day) — **iOS's webm is the problem child**, the same container **T009** flagged. **Impact — disproves the old assumption:** this is **NOT** the old "iOS live-readings are blocked until a real HTTPS deploy" read — Run 4 *had* HTTPS and load/sign-in/calibration all passed; it is a **capture/decode** failure, not a transport/HTTPS one. **Likely fix direction — same problem class as the known un-finalized-`MediaRecorder`-webm issue** (there the fix was an **`ffmpeg -c copy` remux** to a finalized/cued container *before* OpenCV decode, because `cap.set()` is a silent no-op on un-cued webm): **(1) prefer fMP4/CMAF on the iOS *monitor* recorder** — **T009 proved this iPhone's fMP4/CMAF decodes cleanly to `(2958,)` where its webm chokes** (the recorder's `pickMime` already needs webm-first-with-fMP4-fallback per the T026 backlog item above) — and/or **(2) harden `probe_recorded_seconds`** to degrade gracefully on an un-finalized iOS webm (remux-then-probe, or fall back to a timestamp estimate) instead of throwing `our-side`. Then **re-run ST-08-2**. Full evidence: `specs/008-stress-inference-service/smoke-tests.md` **Run 4** (commit `34c951b`). Fix scope: small-to-medium (recorder-mime preference + a probe-hardening guard + a T009 fMP4 re-validation on the deploy image). **Non-blocking for the desktop demo; required for real iOS monitoring support.** Address by: before any real-iOS monitoring sign-off; pairs with the **T026 recorder-mime** + the **keep-up tail-decode** items above (same decode path).

---

## From feature 009 (today-card-trend-redesign) — merged 2026-06-23

- **Headline escalation arc (a-little-tense → tense) collapses to the plain peak** (#90) (`deferred-feature` / `area:web`, from 009 headline rework + the follow-up §1 verification): an escalation that opens *a little tense* (confident band) and climbs to *tense* renders the plain peak ("Your afternoon was tense") and **silently drops the opening a-little-tense band** — asymmetric with the calm→tense arc, which names both pods. The most-recent band *is* the peak so the recovery branch doesn't fire, and there is no `at_ease` opener so the calm→tension arc doesn't fire either; it falls through to peak-only. Deferred by decision (009). Revisit: either add an escalation branch that narrates the climb, or formally bless peak-only as the intended shape. Not demo-blocking.
- **Cross-pod recovery clause is time-neutral** (#91) (`polish` / `area:web`, from 009 follow-up §2 verification): when the easing band sits in a **different** pod from the peak, the recovery clause ("…then eased" / "…then eased a little") names the peak's pod but **never names the easing pod** — the second clause is time-neutral. It does not mis-pod (the peak attribution is correct), but a cross-pod recovery could read "…then eased in the evening". Minor polish, not a correctness issue.
- **Copy: collapse "a little tense" to a single word** (#92) (`polish` / `area:web`, from 009 follow-up §3): the two-word mid-tense descriptor is the only multi-word band label; a single word would tighten the headline and simplify the partial-easing clause ("eased a little"). Future copy pass — needs the word chosen first.

---

## Tooling & CI — established 2026-06-25

### ~~Phase-1 CI: no automated lint / typecheck / test gate on PRs~~ — resolved (#95)
**Status**: resolved (`type:tooling` / `area:infra`)
**Resolved**: 2026-06-25 via **PR #94** (squash `3ee89a3`). `.github/workflows/ci.yml` runs the cheap, hermetic layer on every PR into `main` + push to `main` (+ `workflow_dispatch`): a **web** job (Node 22.11.0 + npm cache → `npm ci` at root → `apps/web` lint / typecheck / Vitest) and a **python** job (`uv` cached @ 3.12 → `uv sync --locked` for `packages/ml-video` then `apps/api` → `ruff check .` + `pytest tests/ -q` each; the ffmpeg/fixture-gated tests `skipif`-skip cleanly, ffmpeg deliberately not installed; the minimal `libGL`/glib libs `opencv-python` imports are installed defensively — already present on the current runner). Ref-keyed `concurrency` (cancel-in-progress), least-privilege `contents: read`; no secrets / Supabase / Playwright / `next build`. **First run green** (web: lint 0 / `tsc` clean / Vitest 641 passed; python: ruff clean both, pytest 0 failures + expected skips — ml-video 4, apps/api 1).
**Landed non-blocking** — **not** a required check yet (watch it stay green first; making the checks required is a separate later step, branch protection untouched). Cleared the lint-baseline blocker (#87, closed by-design) so the first run could be green.
**Observed**: repo had no CI — lint/typecheck/tests ran only locally, so a regression could land on `main` unguarded.
**Out of scope (next sessions)**: Dependabot triage; the stale DECISION-20 correction; promoting the checks to required; phase-2 layers (app build / Playwright e2e / Supabase-backed integration).

---

## Monitoring — surfaced during the 2026-06-25 security/CI pass closeout smoke

### Live monitor: does the pipeline distinguish "not in frame" (absent) from "couldn't get a clear read" (present-but-low-confidence)? — read-only diagnostic (#100)
**Status**: bug (`type:bug` / `area:web` + `area:ml-video`; the decision logic also touches `apps/api` inference)
**Observed**: 2026-06-25, the end-to-end stress-detection smoke on merged `main` (the security/CI pass closeout).
**Description**: Walking away from the camera mid-session was surfaced **inconsistently** — **sometimes** the live monitor showed the vague **"couldn't get a clear read"** (the generic "on our side" / thin-read surface), **other times** it correctly showed a distinct **"face not centred" / not-in-frame** state. Same physical action (the user leaving the frame), two different user-facing outcomes.

**The question to resolve**: **does the pipeline distinguish *absent* from *present-but-low-confidence*?** — i.e. does it tell apart **absent** (no face in frame at all — the user walked away) from **present-but-low-confidence** (a face *is* present but extraction/coverage is too thin for a confident read: low light, partial face, motion, a brief glance away), and are those two states deterministically mapped to two **distinct** user surfaces? If they are, why does walking away sometimes fall through to the vague "couldn't get a clear read" instead of the distinct "not in frame" state?

**Why read-only (not a fix)**: there are (at least) two independent paths that can surface on walk-away, suspected to race/overlap rather than cleanly partition the cases —
  1. **Client-side framing presence machine** — the feature-005 on-device framing signal (`apps/web` `use-framing-guide` + the monitoring presence state) drives the **out-of-frame / "face not centred"** surface (90 s no-face → `out_of_frame`). This is the *distinct, correct* surface.
  2. **Server-side cause classification** — when a window *is* uploaded but can't be scored, `apps/api` inference / the `packages/ml-video` coverage gate emit a categorical reason mapping to the client cause chip — including the generic **"our side"** surface and the foggy **"skipped a read"** note. This is the *vague* surface the diagnostic chases.
The diagnostic traces which path fires on a real walk-away, confirms whether "absent" and "present-but-low-confidence" are actually separable signals in the pipeline today, and pins down why the vague server-side message sometimes wins over the distinct client framing state. **No behaviour change in this item** — it scopes the investigation; any fix is a follow-up once the distinction (or its absence) is established.

**Cross-references**:
  - **#89** (iOS monitoring 0 readings via a server-side decode death that *also* surfaces as the vague "on our side") — same vague-surface class, different root cause (decode vs framing).
  - The feature-006 coverage gate (`insufficient_face_frames` → the `insufficient-face` chip) — the existing "present but thin" path; check whether walk-away ever routes here vs to "our side".
  - The "skipped a read" foggy note + the 90 s-no-face → `out_of_frame` presence machine (feature 008 US1/US2) — the two existing distinct surfaces this gap sits between.
  - **009b / spec 010** (`specs/010-monitoring-graph-redesign`): ships `out-of-frame` mapped to the muted "no clear read" treatment (FR-019 fallback). When this diagnostic confirms `skipCause === "out-of-frame"` is reliable, flip the foggy "step back into frame" treatment on in `session-trend.tsx` — it is a one-line gate; the code is already built per spec 010.

**Fix scope**: read-only diagnostic first (no code change) — small investigation across `apps/web` (presence/cause-chip rendering), `apps/api` (inference cause classification), and `packages/ml-video` (coverage gate). Any resulting fix is a separate, later item sized once the diagnostic lands.
**Address by**: a monitoring-quality pass — not demo-blocking, but it muddies the live-monitor UX (the vague message reads as a system fault when the real cause is "you left the frame"). Pairs with #89 (same vague-surface class).

---

## Monitoring — inference concurrency + camera-down fix (2026-06-26)

### ~~Live-monitor lag: per-session scoring unbounded → growing pile-up~~ — resolved (#110)
**Status**: resolved (`type:bug` / `area:api` + `area:web`)
**Resolved**: 2026-06-26 via **PR #113** (commits `61b224b` server gate + drop-stale, `558f60c` client back-pressure). **Formalizes the embedded note (b) in #78**; related #79 (single-worker smoothing buffer), #80 (`--reload` bloom drop), #81 (live-bloom durability) — broader, NOT closed here.
**Observed**: live-monitor reading lag was contention-dominated and **growing** (~2 min stale, climbing). One window scores ~10–11 s isolated, but `POST …/windows` dispatched scoring via `run_in_threadpool` under the **anyio default `CapacityLimiter` = 40**, and the browser uploaded a new 60 s window every ~10 s **regardless** of whether the last finished → ~10 windows scored at once on a 16-core laptop → CPU oversubscription → each ballooned to 40–110 s → lag grew.
**Fix**: *(server)* new `SessionScoringGate` (`app/services/scoring_gate.py`) — a per-session `asyncio.Lock` held across `run_in_threadpool` (**concurrency 1 per session**) + a monotonic per-session sequence; a window superseded by a newer one before its turn is **shed as a clean `superseded` outcome** (no scoring, **no `window_readings` row**) — only the freshest scores. Concurrency 1 preserves the `_SessionBuffers` single-writer invariant (#79); the freshest always wins the freshness check so warm-up still reaches its 4 scored windows. Gate dropped on End; LRU-capped. *(client)* `monitoring-session.tsx` in-flight back-pressure — never two uploads at once; a stride mid-upload **coalesces** to the latest window (the contiguous recording-so-far, a superset), dropping ~6× wasted upload bytes. Geometry unchanged (60 s / 10 s — only *when* an upload fires is gated). New `SupersededOutcome` parsed client-side as a true no-op (never folded into `warming_up`).
**Verified**: API pytest 97 / Web Vitest 649 / tsc 0 / ESLint 0. **Stage 1 (live, API on, no `--reload`, single worker):** steady-state per-window processing **bounded, not climbing** — ~18–22 s flat across a 4–5 min session (regression slope ≈ 0 to negative), vs the pre-fix O(elapsed) climb to 40–110 s. The growing pile-up (#78) is dead.
**Forward note (009b / US3)**: drop-stale ⇒ **fewer persisted `window_readings` rows** ⇒ the 009b "This session" trend (`specs/010-monitoring-graph-redesign`) will have **sparser points** — weigh when US3 resumes; not part of this fix. (Cross-ref #100, which also touches 009b / spec 010.)
**Remaining (separate item)**: warm-up latency → #112.

### ~~Monitor mislabels a backend outage as "camera blocked"~~ — resolved (#111)
**Status**: resolved (`type:bug` / `area:web`)
**Resolved**: 2026-06-26 via **PR #113** (commit `64d98e0`).
**Observed**: when a session failed to start because the **backend** was unreachable/erroring, the UI showed "Camera access is blocked · turn it back on in your browser's site settings" — sending the user to fix a camera that was never the problem. `monitoring-session.tsx` (`handleAllow`) flattened **every** non-`no_anchor` create failure (network / 5xx / 401 / null-token) into `CAMERA_BLOCKED`; only the genuine `getUserMedia` denial (Path A) was separate.
**Fix**: a distinct `service-unavailable` op + `ServiceUnavailablePanel` ("Can't reach Serenify right now", FOGGY attention, `CloudOff` icon, a "Try again" that re-attempts the create — the camera never opens until a session is confirmed). Honest routing: `no_anchor` → calibrate-first (unchanged); `401` / null-token → the existing **signed-out** re-auth surface (a token problem, not "the backend is down"); `network` / `5xx` / stray `403` → service-unavailable. Path A (real `getUserMedia` denial) untouched.
**Verified**: **Stage 2 (API off):** new "Can't reach Serenify" surface confirmed; a genuine camera-permission denial still shows the camera copy. Surfaces correctly separated.

### Warm-up latency — ~2:30 to first reading (parked enhancement) (#112)
**Status**: watch (`type:tech-debt` / `area:api` + `area:web`) — **OPEN, parked future enhancement; do NOT close.**
**Surfaced**: 2026-06-26, while measuring the #110 fix. Steady-state lag is fixed (bounded ~18–22 s/window); the remaining slow part is the **warm-up to first reading (~2:30)** — the expected cost of concurrency = 1.
**Breakdown** (post-fix, local laptop): first **band** (4th scored window) ≈ **~60 s recording gate** (locked, FR-002 / Constitution Principle II — the hard floor) + **~80–100 s serial warm-up** (4 cold-start windows × ~20–25 s, serialized back-to-back; window 1 carries a ~27–29 s cold-start spike). The ~12 s `getSessionTrend` poll is **not** on the bloom's critical path (the band comes from the live `submitWindow` response; the poll only feeds the "This session" trend card).
**Tier options (ranked by safety)**: **T1** (low risk, ~10–13 s real + perceived) pre-warm the extractor to kill the first-window cold-start spike + a display-only "getting your first read — N of 4" cue → ~2:15, no inference-path change. **T2** (high risk/effort, realistically **~2:00 not ~90 s** given the 10 s window spacing) bounded warm-up burst — score the first M=4 windows concurrently then **hard-clamp to 1**; re-opens the just-fixed path, needs `_SessionBuffers` locking (#79), and must **score-all-of-the-first-M (not drop-stale)** or warm-up starves. **T3** (medium risk) provisional early band at M=2–3 — trades smoothing quality (touches the locked M=N=4 contract; SC-003 drift; needs sign-off).
**Caveat**: all second-counts are **laptop-specific** (i5, browser competing for CPU). On the Azure demo VM the per-window cost changes, reshaping the warm-up math — **re-measure on the real VM before tuning warm-up.**
**Address by**: a future warm-up-latency pass, only after a VM re-measure; not demo-blocking.

---

## From feature 010 (monitoring-graph-redesign) — merged 2026-06-27

Frontend-only redesign of the live "This session" monitoring graph (roadmap label `009b`), **merged
to `main`** via **PR #118** (squash `6b8653e`, 2026-06-27); feature branch deleted. No new open
follow-ups were logged from this feature beyond the one below — the 11 unchecked
`checklists/requirements.md` items and the optional T029 (Amendment 7 second-example doc-polish) are
spec-internal / optional-polish (Mohamed's call), not backlog-shaped, and are deliberately not filed
here.

### ~~010 ST-7: parked marker disappears on single-reading → out-of-frame transition~~ — resolved (#117)
**Status**: resolved (`type:bug` / `area:web`) — GitHub issue **#117 CLOSED** (2026-06-27).
**Resolved**: 2026-06-27 on `010-monitoring-graph-redesign` — silent-empty refetch guard (`setPoints` functional update, commit `8517118`), now-marker parks on stale out-of-frame edge (commit `ae43e5f`), FR-004a freshness horizon 20 s→60 s to stop false-parking healthy live reads (commit `a550ab3`), two-sided regression guard (commit `cbce6b2`). ST-7 re-run passed 2026-06-27. **Merged to `main`** via **PR #118** (squash `6b8653e`, 2026-06-27) — the per-fix commits listed above were on the now-deleted feature branch and are squashed into `6b8653e` on `main`.
**Observed**: 2026-06-27, ST-7 manual smoke (this branch).
**Description**: With exactly **1 confident reading** in the session, stepping out of frame caused the graph to blank and the confident dot (the parked marker) to disappear instead of staying muted + static at the last confident position (SC-010 / FR-004a). The no-clear-read gap treatment only appeared **after returning to frame**, not during the out-of-frame period.
**Root cause**: `getSessionTrend` returns `[]` (not throws) on any Supabase error (`if (error || !data) return []`, monitoring-reads.ts). In `session-trend.tsx`, `refetch` called `setPoints(next)` unconditionally, so a silent empty response wiped `points` → `isEmpty=true`. The geometry (`buildNowMarker`) handles `[confident, no_read]` correctly; the bug was purely in the component's data layer. The upload gate on out-of-frame means no `refreshSignal` fires, so the only refetch is the immediate one triggered by `active→false` — exactly the moment a transient Supabase error can return `[]`.
**Fix**: `session-trend.tsx` `refetch` — functional update guard: `setPoints((prev) => next.length === 0 && prev.length > 0 ? prev : next)` treats a silent empty response like a thrown exception and leaves existing rows in place. Regression tests added in both geometry and component suites.

---

## From feature 011 (llm-client-chatbot) — merged 2026-06-29 (PR #121)

The shared LLM client package (`packages/llm-client`) + the first Ren chatbot surface. Smoke
pass ALL GREEN (`specs/011-llm-client-chatbot/smoke-tests.md`, 2026-06-28/29). **No new
BACKLOG follow-ups are filed from this feature.** Two deferrals are recorded in
`docs/PROGRESS.md` (Feature 011) as spec-internal / known-deferred items rather than
backlog-shaped issues — the same treatment feature 010 gave its unfiled spec-internal items:

- **Four Playwright e2e tasks deferred — T034 / T052 / T064 / T073** (role entry-point
  visibility, crisis privacy, end/resume, signal separation): blocked on the live
  FastAPI+Supabase e2e auth-fixture stack (pairs with the phase-2 CI / Supabase-in-CI work,
  #41). Covered meanwhile by the automated `apps/web` Vitest + `apps/api` pytest
  role/access/crisis/separation suites and the manual smoke pass. Not a standalone follow-up —
  revived with the e2e fixture stack. **Not claimed as done.**
- **Ren name personalization deferred**: no `preferred_name` shipped — the `ren_preference_block`
  seam is empty in 011 (FR-009) and `profiles` stores `full_name` only. Addressing the employee
  by name belongs to a future first/last-name split; no column was added.

**#75** (ToS / Privacy Policy / signup consent gate) remains **OPEN** — 011 ships only the
in-app companion disclaimer ("Ren is an AI companion, not a substitute for professional
care."); the full pre-production consent gate is unchanged and stays a pre-real-data blocker.

---

## From feature 012 (questionnaire-feedback) — merged 2026-07-02 (PR #125)

### Work-environment feedback aggregate anonymization hardening (#123)
**Status**: deferred-feature (`type:feature` / privacy / pre-real-data / `area:db` + `area:web`)
— **OPEN, blocks real employee data collection; consumed by feature 017 (team-lead-dashboard).**
**Observed / deferred**: 2026-06-30, Constitution Amendment 13.
**Description**: Feature 012's weekly work-environment check-in creates a new
employee-submitted data class: overall sentiment, and when negative, a roadblock
selection plus a desired-support selection. Principle I allows this class to reach
the manager-facing layer only as an anonymized team-level aggregate, never as an
individual employee's attributed answer. The demo build may defer the small-team
privacy hardening, but real employee data collection MUST NOT start until it is in
place.
**Fix scope**: add minimum-headcount suppression to the manager-facing aggregate so
no tally can be traced back to one person on a small team. Keep the implementation
separate from stress-signal direct-manager visibility and cover it in the feature
017 privacy review when the team-lead dashboard consumes the aggregate.
**Address by**: before any real employee data is collected; implement no later than
feature 017 (team-lead-dashboard) before exposing the manager aggregate to real data.

### ~~Expired confirmatory prompt consumes the one-per-session budget — no re-arm~~ — resolved (#127)
**Status**: resolved (`type:bug` / `area:db` + `area:web`) — GitHub issue **#127 CLOSED** (2026-07-02).
**Resolved**: 2026-07-02, across two PRs. **PR #130** (squash `d89f4db`) fixed the CLIENT-side
half — see **Progress** below. **PR #132** (squash `d057f43`) fixed the DB-side half: dropped
the full-table `qcp_one_per_session UNIQUE (monitoring_session_id)` constraint and replaced it
with a partial unique index, `qcp_one_answered_per_session ON questionnaire_confirmatory_prompts
(monitoring_session_id) WHERE lifecycle = 'answered'`
(`supabase/migrations/20260702000000_qcp_one_answered_per_session.sql`) — a session may now
hold several visible/expired rows (one per re-arm episode); only one **answered** row is
capped, matching the client's `budgetConsumed` predicate from PR #130. Also fixed the
previously-silent `createConfirmatoryPrompt` insert-failure path: it now logs a
`[questionnaire]`-tagged `console.error` instead of swallowing the failure. Live-verified
against local Postgres in a rolled-back transaction (no data persisted): two non-answered rows
in one session both insert; a second answered row is still rejected. Record: `docs/PROGRESS.md`
2026-07-02, `docs/CHANGELOG.md` 2026-07-02, `docs/DECISIONS.md` 2026-07-02 (D-10).
**Observed**: 2026-07-02, feature-012 pre-merge polish pass.
**Progress**: 2026-07-02 — **PR #130** (squash `d89f4db`) fixed the CLIENT-side half only.
`useConfirmatoryTrigger`'s reducer previously used one `resolved` flag for two different
concerns (per-prompt single-resolution guard + the session's one-time budget), so an
auto-resolution (`signal_drop`) permanently blocked all further prompting, same as an
explicit answer. Split into a per-prompt `resolved` guard and a new session-scoped
`budgetConsumed` flag, set ONLY by an explicit answer (confirmed / false_alarm /
opened_chat); a new `markResolvedRearm` resets the trigger (state + the hook's
`resolvedRef`/`promptIdRef`) on auto-resolution so a fresh 20 s sustained-tense episode can
fire a new `show` effect in the same session.
**Description**: The confirmatory prompt table enforced `UNIQUE (monitoring_session_id)`
(`qcp_one_per_session`, `supabase/migrations/20260630000000_questionnaire_feedback.sql`) —
one row per monitoring session, whether the prompt's `lifecycle` ended `answered` or
`expired`. A prompt that **expired unanswered** (`expiry_reason IN ('signal_drop',
'session_end')`) still consumed that session's single-prompt budget at the DB layer: after
PR #130, the client WANTED to create a second prompt row after such an expiry, but
`createConfirmatoryPrompt` (`apps/web/lib/api/questionnaire-client.ts`) still did a plain
`.insert`, which hit the UNIQUE constraint and failed silently; `createPrompt` resolved `null`
and `handleShow` no-opped. Fixed by PR #132 (above).
**Desired behavior — delivered**: only an *answered* prompt (`lifecycle = 'answered'`, an
actual outcome recorded) closes the budget; an expired prompt allows a re-arm. The **re-arm
condition** (what state transition allows a new prompt to open) and the **DB-level budget
cap** (the partial index) are both done. A **cooldown** (minimum gap after an expiry before a
new prompt can arm) and a **per-session cap** (an upper bound on total prompts per session,
independent of re-arm) were considered in the original scoping but are **intentionally NOT
part of this fix** — #127 was filed specifically because an expired prompt permanently
blocked re-arm end-to-end, which is now fully resolved. The existing 20 s sustained-tense
floor already rate-limits re-prompts per-episode. Cooldown/cap remains a potential future
hardening idea, not currently tracked as its own backlog item — file one separately if still
wanted.

### `STRESS_TENSE_BAND` (0.70) is an uncalibrated hardcoded default (#128)
**Status**: tech-debt (`type:tech-debt` / `area:api` + `area:ml-video` + `area:docs`)
**Observed**: 2026-07-02, feature-012 pre-merge polish pass.
**Description**: `stress_tense_band` (env `STRESS_TENSE_BAND`, default `0.70` —
`apps/api/app/config.py`) is a hardcoded product default, unlike the lower `0.53`
stress/not-stress operating point, which is data-derived from the LOSO/GroupKFold-calibrated
`loso_metrics_60s_calibrated.threshold_sweep_recommended.threshold` in
`packages/ml-video/models/metadata.json` (documented in `docs/MODELS.md`). The 0.70 tense-band
split (a-little-tense vs tense, D-3 display-only banding) has no equivalent empirical
grounding.
**Plan**: re-run the trained video model over the LOSO/GroupKFold folds to produce calibrated
probabilities, and set the tense cutoff from that distribution. Evaluate on the **SMOOTHED
4-window scores** (what users actually experience via the server-side smoothing buffer, D-3)
rather than raw per-window probabilities — the smoothing-window length (currently N=4) is a
coupled lever affecting the resulting distribution, so it must be held fixed (or explicitly
re-considered) during calibration.
**Fix scope**: ML/calibration work (Kaggle) — touches `apps/api/app/config.py` (the
constant/default), `packages/ml-video/models/metadata.json` (if the calibrated tense
operating point is recorded there alongside 0.53), and `docs/MODELS.md` (documenting the
derivation, mirroring how 0.53 is documented today).
**Address by**: a future model-calibration pass; not blocking feature 012.

### ~~Add a second, milder confirmatory trigger (~60 s sustained `a_little_tense`)~~ — resolved (#134)
**Status**: resolved (`type:feature` / `area:web` + `area:db`) — GitHub issue **#134 CLOSED** (2026-07-03).
**Resolved**: 2026-07-03, **PR #135** (squash `ad58777`). Added a second confirmatory trigger — ~60 s
sustained `a_little_tense` (a slow simmer that never spikes) — beside the existing ~20 s
sustained-`tense` acute trigger, reusing the prompt / dwell / expiry / single-resolution machinery;
only the pre-show timer logic and the budget gained a second path. The reducer
(`apps/web/lib/questionnaire/confirmatory-trigger.ts`) runs two independent sustained clocks
(`tenseRunStartMs`, `littleRunStartMs`) with an exact-band `isLittleTenseReading` predicate (no
band-ordering) under a **per-band reset matrix** — `tense` feeds the acute run and zeroes the mild
run, `a_little_tense` feeds the mild run and zeroes the acute run, anything else / inactive zeroes
both (climbing `a_little_tense` → `tense` hands off to acute) — and **arbitrates acute-first (tense
wins)**. The budget is **tense-senior**: a mild answer spends only the mild budget (a later
sustained-tense keeps its shot); a tense answer spends both (no down-tier nag); auto-resolutions
spend neither and re-arm, exactly as #127/#130. Net: **≤1 mild + ≤1 tense per session**. The DB
change (`supabase/migrations/20260703000000_qcp_kind_column.sql`) adds a `kind` ('mild' | 'tense')
column (existing rows backfilled to 'tense') and replaces the #132 `qcp_one_answered_per_session`
index with `qcp_one_answered_per_session_per_kind ON questionnaire_confirmatory_prompts
(monitoring_session_id, kind) WHERE lifecycle = 'answered'` — one answered row per (session, kind),
proven necessary against real Postgres (two answered rows collided on the old single-session index).
The ~60 s mild dwell is a designed default, not empirically calibrated (see #128). The #127/#130/#132
guarantees are preserved (six named reducer/hook tests unchanged and green). Record:
`docs/PROGRESS.md` 2026-07-03, `docs/CHANGELOG.md` 2026-07-03, `docs/DECISIONS.md` 2026-07-03 (D-11).
**Observed**: 2026-07-02, feature-012 follow-up (planned enhancement, filed as GitHub #134).
**Description**: The confirmatory prompt previously fired on a single condition — ~20 s sustained
`tense`. A slow simmer that stays at `a_little_tense` without ever spiking into `tense` produced no
prompt at all. #134 adds the milder trigger so that pattern is caught, with a tense-senior per-type
budget so the two triggers never cannibalize each other's one-per-session shot (a mild prompt never
locks out a real tense one; a tense answer blocks a later down-tier mild).

### Tense-senior budget silences confirmatory prompts for the rest of a session after a tense answer (#136)
**Status**: watch (`type:tech-debt` / `area:web` / `status:watch`) — GitHub issue **#136 OPEN**.
**Observed**: 2026-07-03, filed alongside the #134 tense-senior budget.
**Description**: Because a **tense** answer spends BOTH budgets (#134 / D-11), once a user answers a
genuine acute prompt they receive **no further confirmatory prompts for the rest of that monitoring
session** — including a later, distinct acute spike. This is intentional today (it avoids a
down-tier "nag"), and low-urgency: a session hard-ends after **5 min of continuous face-absence**
(`AUTO_END_AFTER_MS`), so normal breaks start a fresh session with a fresh budget, and most sessions
produce 0–1 prompts anyway.
**Revisit for**: **long, continuous all-day sessions** (a user who never trips the 5-min auto-end)
could go the rest of the day silent after one tense answer. Decide **alongside the potential #127
cooldown idea** — a minimum gap after a prompt before re-arm could replace the hard per-session
lockout more gracefully than reopening the budget.
**Address by**: not blocking the demo; monitor-only for now.

---

## Ops — Supabase local→cloud migration (`excukdzjudslbqmkysrc`) — executed 2026-07-04

### Supabase cloud migration — deploy-step follow-ups (production domains + apps/api repoint) (#139)
**Status**: deferred-feature (`type:tech-debt` / `area:api`) — **OPEN, local-workstation only. Does NOT block production; production shipped and passed smoke on 2026-07-13.** GitHub issue **#139 OPEN** (rescoped 2026-07-22; `priority:blocker` + `area:infra` + `area:web` dropped).
**Reconciled 2026-07-22**: this entry was written 2026-07-04 as a pre-deploy blocker and was never
revisited after the cutover shipped. Production went live at `https://serenify.tech` on 2026-07-12
(PR #142) and passed a production smoke test on 2026-07-13 (`specs/022-cold-start-readiness/smoke-tests.md`:
PASS, Mohamed approval "it worked flawlessly"). Items (a) and (b) are closed out and item (c) is
resolved *for production*; only the local-workstation half of (c) genuinely remains.
**Observed**: 2026-07-04, execution of `docs/runbooks/supabase-local-to-cloud-migration.md` — local → cloud project `excukdzjudslbqmkysrc` (EU / Frankfurt). 14 real accounts + profiles + ~300 rows across 9 tables migrated (UUIDs / `email_confirmed_at` / `anchor_vector` bytea preserved; 6/6 anchors byte-identical to the §5a dump; RLS + grants verified on cloud; passwords reset; `apps/web/.env.local` repointed).
**(a) Runbook junk-delete reorder — DONE (provenance)**: the §4 `DELETE ... WHERE email LIKE '%@t.local'` was moved to a new §5c after the §5b child-row load — deleting fixtures in §4 FK-fails §5b's load of their own child rows (`pg_dump` can't filter). One deferred cascade drops fixtures + identities + skeleton profiles + child rows together. Patched in commit `d74864d`. No further action.
**(b) Production-domain settings — DONE (2026-07-12/13, PR #142)**: Supabase Auth `site_url` +
`additional_redirect_urls`, the Vercel `SITE_URL` / `NEXT_PUBLIC_API_URL`, and the Azure Container
App `ALLOWED_ORIGINS` are all set to the production origins (`https://serenify.tech` /
`https://api.serenify.tech`) in their respective platform panels. Evidenced by the 2026-07-13
production smoke test — sign-in, calibration, and check-in all succeeded end-to-end against the
production Azure API and cloud Supabase, which is not possible with a localhost redirect allow-list
or a mismatched CORS origin. Panel values are not committed (Principle IX).
**(c) apps/api repoint — DONE for production, OPEN for local dev**: the *deployed* API reads its
`SUPABASE_URL` / `SUPABASE_ANON_KEY` / `SUPABASE_JWT_SECRET` from Azure Container App secrets, which
are set to the cloud project — again proven by the smoke test (a JWT-secret mismatch would have
failed every authenticated request with HS256 signature errors). **What genuinely remains** is the
untracked local file `apps/api/.env` on Mohamed's workstation, still pointing at local Supabase.
Consequence is dev-only but is a real footgun: running `apps/web` (cloud) against a local `apps/api`
(local Supabase) makes the API reject every cloud-issued JWT with an opaque 401, because the HS256
secrets differ. Fix is a three-value edit to one untracked file; no code, migration, or panel change.
**Resend / SMTP — DONE (not a blocker)**: the earlier "live new signup stays blocked until SMTP
lands" note is obsolete. Resend is live in production as Supabase's **custom SMTP provider**,
configured in the Supabase dashboard. It is correctly absent from this repo — the integration is a
dashboard/DNS concern by design and calls no application code. See `docs/DECISIONS.md` 2026-07-22.
**Address by**: opportunistically, next time `apps/api` is run locally. Not gating anything.

---

## Ops — Production cutover to Azure Container Apps — executed 2026-07-12/13 (PR #142/#143/#144)

### Azure production infrastructure has no IaC — environment is not reproducible from the repo (#145)
**Status**: tech-debt (`type:tech-debt` / `area:infra`) — **OPEN, not a blocker.** GitHub issue **#145 OPEN**.
**Observed**: 2026-07-22, post-cutover docs reconciliation (the same pass that settled the ACI-rollback
contradiction in `docs/DECISIONS.md`).
**Description**: The production Azure backend was provisioned **manually via `az` CLI**. No
infrastructure-as-code is committed — no Bicep, ARM template, Container Apps YAML, `azure.yaml`,
compose file, systemd unit, or reverse-proxy config. This was deliberate at cutover time ("no
repository files unless an existing deployment document requires current resource values"); what was
never recorded is the consequence.

**The risk**: the live environment **cannot be recreated from this repository**. The only description
of the deployed configuration is prose in `docs/superpowers/plans/2026-07-12-production-cutover.md`,
so rebuilding means a human re-reading that document and re-running `az` commands by hand.

This compounds with the confirmed absence of a rollback target (`docs/DECISIONS.md` 2026-07-22: the
prior ACI was deleted; `az group list` returns only `serenify-prod-rg` holding the Container Apps
environment, `serenify-api`, and its managed certificate). The failure mode is therefore not "flip
traffic back" but **"re-provision from a prose document, under pressure."** Exposed if the resource
group is deleted, the Azure for Students subscription lapses (finite student credit), or a revision
breaks with no healthy earlier revision retained. Undocumented-as-code today:

  - Container App sizing/scaling — 4 vCPU / 8 GiB, `minReplicas=0`, `maxReplicas=1`, external
    ingress on port 8000.
  - The managed-environment + managed-certificate setup for `api.serenify.tech`.
  - The Container App secret and env-var **names and wiring** (values are correctly panel-only per
    Principle IX, but the wiring exists nowhere machine-readable).
  - Cloudflare DNS — the `api` CNAME plus the `asuid.api` TXT record for Azure domain validation,
    proxying off.

The GHCR tag `ghcr.io/mohamedasem318/serenify-api:production` is the one durable reproducible
artifact in the chain. The image is fine; everything *around* the image is undocumented.

**Fix scope**: medium. Commit provisioning as code — either **Bicep** (`infra/main.bicep` +
`main.bicepparam`; declarative, idempotent, diffable — preferred if this outlives the thesis) or an
**`az`-based provisioning script** (`scripts/provision-azure.*`; lower ceremony, closer to what was
actually run — preferred if the goal is just capturing what exists). Must declare the resource group,
managed environment, container app (image, ingress, port, CPU/memory, replica bounds), custom-domain
binding, and managed certificate; reference secrets **by name only, never by value**; and be verified
against a throwaway resource group so it is known to work rather than assumed to. Add a
`docs/runbooks/` pointer matching the existing runbook convention.

**Address by**: before the thesis defense, not before any feature. Production is live, healthy, and
smoke-verified (2026-07-13) — nothing is broken and nothing is blocked. This is insurance against a
low-probability, high-cost event whose cost peaks exactly when it is least affordable.

---

## From constitution Amendment 16 (feature-ordering reconciliation) — 2026-07-24

### 017-team-lead-dashboard ships hardcoded default visibility scopes; 018 retrofits employee-facing privacy controls (#152)
**Status**: deferred-feature (`type:feature` / `area:web` + `area:db`) — **OPEN.** GitHub issue **#152 OPEN**.
**Observed**: 2026-07-24, constitution Amendment 16 (Principle VIII provisional-ordering reorder).
**Description**: Amendment 16 moved `018-privacy-controls-and-transparency` to sit **after**
`017-team-lead-dashboard`, fixing a dependency inversion — privacy-controls governs what an employee
lets their team lead see, so it cannot meaningfully ship before the dashboard it constrains exists. The
**accepted cost**, recorded here so it is tracked rather than living only inside a constitution
rationale paragraph: `017` ships with **hardcoded default visibility scopes** (the manager sees the
constitution's default surface — per-individual trends at the `summary only` default granularity, per
Principle I's privacy slider default), and `018` later **retrofits employee-facing controls** onto that
already-shipped surface (the three-position privacy slider `full detail` / `summary only` (default) /
`off during specified hours`, and the "what your manager sees right now" transparency view).
**Fix scope**: at `017` — implement the default visibility scopes as **explicit, centralized defaults**
(not scattered magic values) so `018` can intercept them with employee-controlled overrides without a
rewrite; treat the default as "the value the slider produces at its `summary only` default position." At
`018` — wire the privacy slider to actually constrain what `017` reads, render the transparency view
(Principle I), and preserve the default (no manager-facing regression for employees who never touch the
controls). Suggested issue labels: `type:feature`, `area:web`, `area:db`.
**Address by**: `017-team-lead-dashboard` (build the centralized defaults) and
`018-privacy-controls-and-transparency` (the retrofit). See `.specify/memory/constitution.md`
Amendment 16 and `docs/DECISIONS.md` 2026-07-24.

## From constitution Amendment 17 (wordmark canonization + manager-visibility copy discipline) — 2026-07-24

### `--color-on-accent` and `--color-scrim` are shipped Graphite tokens never registered in Principle V (#155)
**Status**: tech-debt (`type:tech-debt` / `area:docs`) — **OPEN.** GitHub issue **#155 OPEN**.
**Observed**: 2026-07-24, during the constitution Amendment 17 template/token audit.
**Description**: Principle V's palette block is declared **"locked, no additions without amendment"**, but
two tokens shipped in feature 007 have never been named there: `--color-on-accent`
(`apps/web/app/globals.css:39` — light `#F8F9FA`, dark uses `--color-bg`) and `--color-scrim`
(`globals.css:41` — `rgba(28, 32, 35, 0.60)`, fixed in both modes). Principle V lists
bg / surface / ink / muted / meadow / foggy / amber / crimson / border, plus the four amber sub-tokens
that **Amendment 5 explicitly registered**. Amendment 4 (the 007 visual redesign) described the
filled-accent foreground rule in prose but never named `--color-on-accent`, and never mentioned
`--color-scrim` at all. **This is a documentation gap, not a code problem** — both tokens are correct,
shipped, and in use. The risk is that the next Principle V amendment either rediscovers them as a
surprise or treats the palette list as complete when it is not.
**Precedent**: Amendment 17 closed exactly this gap for a third 007 token, `--color-meadow-text`, because
the new Wordmark rule depends on it. The remaining two were **deliberately** left out of that amendment
as out of scope and logged here instead, rather than silently widening an approved amendment.
**Fix scope**: register both in Principle V's palette block with their values and their 007 origin, in
whichever amendment next touches Principle V — a **ride-along, not an amendment of its own**. Do **not**
change either value. Suggested issue labels: `type:tech-debt`, `area:docs`.
**Address by**: the next amendment that touches Principle V. See `.specify/memory/constitution.md`
Amendment 17, `docs/DECISIONS.md` 2026-07-24 (Amendment 17), and `docs/DECISIONS.md` 2026-06-17
(filled-accent CTA foreground) / 2026-06-18 (`--color-meadow-text`).

---

## From feature 013 spec (public-surface-and-legal) — captured 2026-07-25

### Camera + inference consent gate — no consent is recorded for webcam capture or inference — ⛔ PRE-PRODUCTION DATA-PROCESSING GATE (#157)
**Status**: deferred-feature (`type:feature` / `area:web` / `area:db` / `priority:blocker`) — **OPEN.** GitHub issue **#157 OPEN**.
**Category**: legal / compliance / consent
**Observed**: 2026-07-25, while resolving the open questions in `specs/013-public-surface-and-legal/spec.md` (OQ-7 point 3). New scope — this had no issue and no BACKLOG entry.
**Description**: The app requests camera access via `getUserMedia` at the calibration
intro (`apps/web/components/anchor/intro.tsx`) and infers a stress reading from the
frames, which is then stored against a named employee (`window_readings`). **No consent
to that processing is obtained or persisted anywhere** — `grep -ri consent` over
`apps/**` and `supabase/**` returns zero hits; there is no consent table and no consent
column. The only thing between the user and biometric-adjacent inference is the
browser's permission dialog, which grants *device access*, not agreement to the
processing, and which leaves no artifact that could be produced later to show anyone was
ever asked. Every existing account is in this position retroactively. The nearest thing
that exists today is copy, not consent: the calibration intro reassures "Your video
isn't stored — only the calm reading it produces" and notes "Your browser will ask for
permission next."
**⚠ Legal position is believed, not verified.** The belief is that webcam-derived,
health-adjacent inference in an employment context sits in the most strictly treated
category under Egypt's **Law 151/2020**, and that consent for it must be explicit and
demonstrable — a browser prompt being neither. **This has not been checked by a
qualified lawyer**, and nothing in this repository constitutes legal review; it inherits
#75's standing caveat that a qualified review is required before any real (non-demo)
user data is processed. **The blocker does not rest on that belief.** It rests on the
operational fact above: the camera opens, inference runs, a reading is stored against a
named person, and no record exists that they agreed to any of it. That is sufficient on
its own.
**Fix scope**: medium (FEATURE work). The requirements are already specified as
**FR-037–FR-043** in `specs/013-public-surface-and-legal/spec.md` — this entry points at
them rather than restating them, so the two cannot drift. In summary: a gate before a
user's first-ever calibration, presented **before** camera access is requested
and before any capture begins (FR-037/FR-038); the grant persisted with **both a
timestamp and the identity of the consent wording the user was actually shown**
(FR-039), and not re-shown afterwards until the wording is materially revised (FR-040);
declining or abandoning writes **no** record for the offered wording and blocks
calibration and camera-based monitoring sessions (FR-042/FR-043c). Three constraints
matter most and are easy to get wrong:
- **No backfill (FR-041).** Existing users have never given camera consent and MUST be
  prompted once on their next session. Consent MUST NOT be backfilled as already-granted
  — recording a fact that never happened is forbidden. Existing readings, sessions, and
  accounts are left untouched: this is a gate, not a deletion. The same prohibition
  governs re-consent: an existing record MUST NOT be rolled forward to cover a revision
  the user was never shown.
- **Re-consent on material revision (FR-043a–FR-043e).** Consent is **not one-time**.
  Every published revision of a consented text is classified at publication as
  **MATERIAL** or **COSMETIC** — a human judgment, not an automatic text comparison.
  Material re-prompts everyone whose consent predates it; cosmetic re-prompts nobody.
  Acceptance is recorded as a **new** consent; the earlier record is never overwritten,
  because the history of what a person agreed to and when is the point. This applies
  **symmetrically** to the camera wording **and** the Terms/Privacy acknowledgement
  (FR-035) — one rule, two applications, neither built without the other. Declining
  blocks only that text's scope (camera → calibration + monitoring sessions, with the
  weekly work-environment check-in still available; Terms/Privacy → the whole app, while
  still allowing the user to read both documents and sign out), is **not** withdrawal,
  is **not** a deletion trigger, and MUST be recoverable.
- **Withdrawal-ready shape (FR-043).** Withdrawal itself is out of scope and belongs to
  **feature 018** (`privacy-controls-and-transparency`), but the record MUST be shaped so
  withdrawal can be added later without rework. **A shape that can only ever express
  "granted" is not acceptable.** The concrete schema is a plan decision. Note that
  **declining a gate is not withdrawal** and must not be modelled as one.
**Address by**: **feature 013 (public-surface-and-legal)**, which owns it and closes this
issue when it ships. Pairs with **#75** (ToS/Privacy + signup consent gate) — both are
binding pre-real-data gates on the same user journey, and both are owned by 013. Does
**not** pair with **#62** (`/signup` invite-only): #62 governs *who may hold an account
at all* and is an unrelated auth-posture/tenancy blocker that 013 does not address.

### `README.md` states manager visibility + the privacy slider as present-tense fact, violating the merged Principle I public-communication rule (#158)
**Status**: tech-debt (`type:tech-debt` / `area:docs`) — **OPEN.** GitHub issue **#158 OPEN**.
**Category**: docs / public-facing copy compliance
**Observed**: 2026-07-24, during the constitution Amendment 17 copy sweep; logged 2026-07-25 once the amendment merged and the rule went live.
**Description**: Constitution **Amendment 17** added a **public-communication rule** to
Principle I: any public-facing or user-facing text describing manager visibility MUST mark
controls that are not yet live as not yet live. The sweep that accompanied the amendment
found **four non-compliant lines in `README.md`** and **deliberately did not edit them** —
correctly, because bulk-editing prose is not an amendment's job. That was the right call for
the amendment PR, but it leaves a gap: **the amendment is merged, so `main` now carries
public-facing copy that violates a live constitutional rule, with nothing tracking it.** This
entry closes that gap. The four lines, all present tense with no not-yet-live qualifier:
- **`README.md:11`** — "Managers see graded trends for their reports — never raw video, never chat content."
- **`README.md:15`** — "**Raw video never leaves the inference layer** — managers get graded bands, aggregates, and trends, computed downstream of the model, never the frames."
- **`README.md:16`** — "**Bounded visibility** — a direct manager sees only their own reports; skip-level and above see anonymized org-wide aggregates."
- **`README.md:18`** — "**Employee-controlled granularity** — a three-position privacy slider: full detail, summary only, or off during set hours."

None of this is live: `monitoring_sessions` and `window_readings` are self-only, there is no
manager read policy and no manager-facing route, and the three-position slider and the
transparency view both arrive with **feature 018** (`privacy-controls-and-transparency`).
**The claims are not wrong about the designed end-state — they are wrong about the tense.**
**Fix scope**: small (docs only), but **not uniform across the four lines**.
- **Lines 15, 16 and 18** are fixed by **one added sentence** marking the block as the
  designed end-state and stating that no manager-facing surface is live today.
- **⚠ Line 11 needs more than an appended sentence.** It welds a permanent Principle I
  invariant to a not-yet-live claim inside a single sentence: *"Managers see graded trends
  for their reports"* (**not live** — no manager read policy, no manager-facing route) —
  *"never raw video, never chat content"* (**permanent invariant**, true today and forever).
  Appending a not-yet-live marker to that sentence would drag the invariant under the marker
  too, implying the raw-video and chat-content guarantees are also merely planned — which is
  false, and is exactly the other-direction flattening the same rule forbids. **Line 11
  likely needs splitting** so the permanent half stands unqualified and only the
  manager-visibility half carries the marker. Do not append a sentence to line 11 and call it
  done.

Model the voice on the
already-compliant in-app string at `apps/web/components/account/privacy-placeholder.tsx:24-26`
("Visibility controls arrive with the transparency view. You'll be able to choose what your
manager sees and what stays private — there's nothing to configure yet."), which names the
control, says what it will let the person do, and closes on the fact that there is nothing to
configure yet. Do **not** rewrite the four lines' substance and do **not** hedge the two
genuinely unconditional promises they contain (chat is employee-private and never reaches an
employer; crisis disclosures are never persisted and never notify anyone) — those are
permanent Principle I invariants, not unbuilt controls, and softening them would flatten the
distinction in the other direction, which the same rule forbids.
**⚠ Do NOT touch the four verified-compliant strings.** Amendment 17's sweep checked four
live user-facing strings and found them already compliant. They MUST NOT be "corrected" —
re-editing copy that already passes is how a compliance sweep introduces the defect it was
meant to remove.
**Address by**: any docs pass; it is a **ride-along, not a feature**. Deliberately **not**
fixed in the feature-013 spec PR that logged it, which is spec-scope only. Note that feature
**013** (`public-surface-and-legal`) independently ships **FR-048a**, which imposes the same
point-of-use not-yet-live discipline on the landing page, both legal documents, and both
consent gates — `README.md` is simply not one of 013's surfaces, so it needs its own fix.
See `.specify/memory/constitution.md` Principle I (public-communication rule, Amendment 17)
and `docs/DECISIONS.md` 2026-07-24 (Amendment 17).

---

## From feature 013 implementation (public-surface-and-legal) — captured 2026-07-27

Four items surfaced while implementing feature 013 that are **not** 013's work. They are logged
here so the feature ships without absorbing them, and each is mirrored to its own GitHub issue.

### Dependabot: 21–22 open vulnerability alerts on `main` — pre-existing, unrelated to 013, and `serenify.tech` is live (#176)
**Status**: tech-debt (`type:tech-debt` / `area:web` / `area:infra`) — **OPEN.** GitHub issue **#176 OPEN**.
**Category**: dependencies / security posture
**Observed**: 2026-07-27. Surfaced by GitHub during a `git push` in the feature-013 window; the
counts below were then verified directly against the Dependabot API.
**Description**: **Two GitHub surfaces disagree, concurrently, and both were read on 2026-07-27.**
The push-time banner (`remote:` output on `git push`) says **22 open (11 high, 11 moderate)**. The
Dependabot REST API, queried the same day, says **21 open (11 high, 10 moderate)**, spanning **12
distinct advisories** across **three packages**. This is not drift between two dates — it is the
banner and the API reporting different numbers at the same moment. One alert (`brace-expansion`,
GHSA-mh99-v99m-4gvg) was **auto-dismissed on 2026-07-25**, inside the same window, which plausibly
explains the total but not the severity split. **Treat every figure here as a snapshot, not a fixed
number**, and re-count from the Dependabot security tab before acting. The per-advisory breakdown
below is from the API and is the reliable part.

They sit on **`main`**. **None was introduced by feature 013**, which adds no dependency and
carries an empty `package.json` diff; every alert traces to `next`, `postcss`, or `sharp`, all of
which predate the feature.

- **`next` — 9 advisories, 18 of the 21 alerts.** Each is counted twice, once against
  `package-lock.json` and once against `apps/web/package.json`. **4 high**: SSRF in Server Actions
  on custom servers (GHSA-89xv-2m56-2m9x), SSRF in rewrites via an attacker-controlled destination
  hostname (GHSA-p9j2-gv94-2wf4), middleware/proxy bypass in App Router applications using
  Turbopack and a single locale (GHSA-6gpp-xcg3-4w24), DoS in App Router Server Actions
  (GHSA-m99w-x7hq-7vfj). **5 moderate**: two response-body cache confusions (GHSA-68g3-v927-f742,
  GHSA-4633-3j49-mh5q), unbounded Server Action payload on the Edge runtime (GHSA-4c39-4ccg-62r3),
  unauthenticated disclosure of internal Server Function endpoints (GHSA-955p-x3mx-jcvp), and DoS
  in the Image Optimization API via SVGs (GHSA-q8wf-6r8g-63ch). **All nine are fixed in 16.2.11**;
  the repo pins **16.2.6** (`apps/web/package.json:30`). **One patch-level bump inside 16.2.x
  clears 18 of the 21 alerts.**
- **`postcss` — 2 high**, both `sourceMappingURL` handling: arbitrary `.map` file disclosure via
  path traversal in previous-source-map auto-loading (GHSA-r28c-9q8g-f849) and arbitrary file read
  via an attacker-controlled `sourceMappingURL` in a CSS comment (GHSA-6g55-p6wh-862q). Fixed in
  8.5.18. Transitive; lockfile manifest only. **Distinct from the older PostCSS advisory already
  logged as #36** (GHSA-qx2v-qp2m-jg93) — do not treat #36 as covering these.
- **`sharp` — 1 high**, inherited libvips CVEs (GHSA-f88m-g3jw-g9cj). Fixed in 0.35.0. Transitive;
  lockfile manifest only.

**⚠ Do not attempt any upgrade while feature 013 is unmerged.** A dependency bump underneath an
in-flight feature-branch stack costs days: every open branch inherits a lockfile conflict, and a
`next` upgrade landing in the same window as feature 013's change to `app/(authed)/layout.tsx` —
the shell **every** authenticated route renders through — makes any resulting regression ambiguous
between the two. The upgrade is worth doing; it is not worth doing here.

**⚠ This is NOT a P8 blocker.** P8 (T131–T148) ships feature 013 to production. These alerts are
separate work, on `main`, with their own risk profile and their own verification. Nothing in this
entry gates the feature, and it must not be folded into P8 — a dependency upgrade landing inside a
deployment phase is the fastest way to turn a feature deploy into a debugging session.

**Fix scope**: small-to-medium, on its own branch, **after 013 merges**. Sequence: `next`
16.2.6 → 16.2.11 first (patch-level, clears 18 of 21), then `postcss` and `sharp`, which are
transitive and should resolve without a manifest change. Verify with the full
`npm run -w apps/web lint typecheck test` plus a Playwright chromium + firefox pass, and **read the
16.2.7–16.2.11 release notes before shipping**: the middleware/proxy-bypass fix touches App Router
routing, and `apps/web/proxy.ts` is load-bearing for authentication. Confirm the fix does not
change proxy semantics.

**Address by**: a dedicated dependency branch **after feature 013 merges to `main`**, and before
any further production deploy. Re-run the counts at that point. Pairs with **#36** (the older
PostCSS advisory, `watch`) and **#35** (the Node 22.13+ upgrade), the other two standing dependency
items.

### Restore `POST /api/admin/invite` — deleted in #142; there is no in-app path left to create a `team_lead` or an `admin` (#174)
**Status**: deferred-feature (`type:feature` / `area:web` / `area:db`) — **OPEN.** GitHub issue **#174 OPEN**.
**Category**: product / auth surface
**Observed**: 2026-07-27, while fixing the e2e fixtures blocked by feature 013's app-shell
consent gate (PR #173). `admin-seeded.spec.ts` and `team-lead-seeded.spec.ts` still
`POST /api/admin/invite` and assert `201`. They get **404**, and they fail *at the POST* —
not at anything downstream. `apps/web/app` today contains exactly one route file,
`auth/callback/route.ts`.
**Description**: `apps/web/app/api/admin/invite/route.ts` (152 lines) was deleted in
`ffb3a96` — the squash of PR #142, *"chore(deploy): prepare Serenify production cutover"*,
merged 2026-07-12. It was the only in-app way to create a `team_lead` or an `admin`: it
invited through the service-role admin client (creating the `auth.users` row, which
`handle_new_user` seeded as `role='employee'`), then called the `admin_update_role` and
`admin_update_manager` SECURITY DEFINER RPCs **through the caller's session client**, so
`auth.uid()` resolved to the verified admin and Postgres re-checked `is_admin()` on its own
side. With it gone, role assignment above `employee` has no application surface at all.

**Why it was removed — the reason is recorded, but not in the commit or the PR body.**
The squash carries the bare subject line `* fix(web): remove runtime admin service-role
path` with no body, and PR #142's description says only *"remove the runtime admin/service-role
path and keep production access RLS-as-user"* and *"no service-role secret is required by the
production web/API runtime"*. **Neither names the route.** The docs shipped in the same PR do
name it, and they give the reason — `docs/CHANGELOG.md:2553`:

> **Security posture.** Removed the runtime admin/service-role path entirely — deleted
> `apps/web/lib/supabase/admin.ts` and `apps/web/app/api/admin/invite/route.ts`. Production
> access is now **RLS-as-user throughout**, and inference replay runs as the authenticated
> user. Locked by a new `apps/web/tests/unit/runtime-secret-posture.test.ts`; deploy no longer
> requires a service-role key at all.

`docs/PROGRESS.md:90` repeats it. So this was a **deliberate security-posture cut, not
collateral**: the route was the sole runtime consumer of `lib/supabase/admin.ts`, and removing
the service-role client from the production runtime necessarily removed the route.

What is **not** recorded anywhere — not the commit, not the PR body, not `docs/DECISIONS.md` —
is any discussion of the **consequence**: that the product loses its only invite path, that
three open follow-ups now hang off an endpoint that no longer exists (**#60** invite audit log,
**#61** concurrent-duplicate idempotency, **#63** app-layer rate limiting), that **#62**'s
"funnel all entry through `/api/admin/invite`" resolution becomes unavailable, and that two e2e
specs are left asserting `201` against a 404. **The removal is documented; its product cost is
not.**

**Decision: restore, not retire.** The invite flow is wanted. This entry is not a request to
delete the two specs or to close the endpoint's follow-ups — it is a request to bring the
capability back.

**⚠ The restore cannot be a `git revert`.** `apps/web/tests/unit/runtime-secret-posture.test.ts`
now fails the build if any of `SUPABASE_SERVICE_ROLE_KEY`, `service_role`, `service-role`,
`createAdminClient`, `supabaseServiceRoleKey`, or `/auth/v1/admin/` appears anywhere under
`apps/web/app/` or `apps/web/lib/`, and separately asserts that `lib/supabase/admin.ts` does not
exist. Reinstating the old handler re-introduces precisely what #142 removed and turns that
guard red. **The design question the spec has to answer is how an admin invites a user without a
runtime service-role key** — a Supabase Edge Function holding the key outside the web runtime, an
`invites` table plus a self-serve claim flow, a SECURITY DEFINER RPC that provisions without
GoTrue admin, or something else. That question is the reason this is not a small change.

**This is product code with an auth surface, so it needs its own spec → plan → tasks, after 013
ships.** Not a drive-by fix. The deleted handler carried three controls that were each the
outcome of a security-audit finding and must be re-derived rather than copy-pasted back:

1. **Auth-then-authz before any body work** — an unauthenticated caller got a clean 401 with no
   schema disclosure, a non-admin got 403, and only a verified admin ever reached Zod validation
   (slice 3, Findings 1 & 3).
2. **An `Origin` allowlist** as defence-in-depth over the `SameSite=Lax` session cookie — Route
   Handlers get no automatic same-origin check from Next.js the way Server Actions do (slice 3,
   Finding 1).
3. **Error hygiene** — no branch forwarded raw Supabase / RPC / Zod text to the client; failures
   were logged server-side and responses carried a fixed error code only (slice 3, Finding 2).

See `docs/DECISIONS.md` (2026-05-25 — Security slice 3) and
`docs/security/01-rls-and-security-definer.md`.

**Open question — recorded here, deliberately not answered: does restoring this re-open #62?**
**#62** (`/signup` is open self-serve → gate to invite-only, ⛔ pre-production deploy blocker)
names `/api/admin/invite` as *"a **parallel** privileged path, not the only way in"*, and offers
as one of its two resolutions *"make a product decision to remove `/signup` entirely and funnel
all entry through `/api/admin/invite`"* — a resolution that is currently impossible, because the
funnel does not exist. Whether restoring the endpoint re-opens that option, partially satisfies
#62, or is fully independent of it **is not decided here**. It needs the same product/auth
decision #62 is already waiting on. Do not read this entry as closing or advancing #62.

**Stale references left behind** (breadcrumbs for whoever picks this up — listed so they are
found together, **not** as a request to clean them up piecemeal):
- `apps/web/lib/auth/schemas.ts:117` — `adminInviteSchema` survives with no consumer.
- `apps/web/tests/e2e/helpers.ts:11` — comment still says seeded users arrive "via
  `/api/admin/invite`".
- `docs/DECISIONS.md` (2026-05-26 — Security slice 7, decision 3) defers a per-admin throttle and
  points at `apps/web/app/api/admin/invite/route.ts:37`, a file that no longer exists;
  `docs/CHANGELOG.md:825` carries the same dangling line reference.
- `docs/security/01-rls-and-security-definer.md:28` and `:107` describe the route's
  caller-session-client pattern and the zero-admin hazard in the present tense.

**The two e2e specs are skipped, not deleted.** `apps/web/tests/e2e/admin-seeded.spec.ts` and
`apps/web/tests/e2e/team-lead-seeded.spec.ts` are marked `test.skip` with a comment naming #174.
**Un-skipping them is part of this entry's definition of done** — they are the only end-to-end
coverage of admin-invites-admin (201), employee-invites-anyone (403), and
team_lead-invites-anyone (403), and the role-placeholder assertions for both privileged roles ride
along with them.
**Fix scope**: medium-to-large (FEATURE work). Own spec → plan → tasks. Must not re-introduce a
runtime service-role dependency (see the guard above), must re-derive the three security controls,
and must un-skip the two e2e specs. Suggested issue labels: `type:feature`, `area:web`, `area:db`.
**Address by**: **after feature 013 (`public-surface-and-legal`) ships.** Not before — 013 owns
the public front door and the two consent gates, and an auth-surface change mid-feature is exactly
the kind of drive-by that this repo's PR-isolation discipline exists to prevent. Likely pairs with
whichever feature owns the invite UX (feature 017 `team-lead-dashboard` or the admin-dashboard
work), and should be scheduled alongside **#60**, **#61** and **#63**, which are all follow-ups on
this same endpoint and are unactionable until it exists.

### The WebKit Playwright runner hangs on Windows — ⚠ WebKit is dropped from the feature-013 P8 sign-off bar (#177)
**Status**: deferred-tooling (`type:tooling` / `area:web`) — **OPEN.** GitHub issue **#177 OPEN**.
**Category**: test harness / browser coverage
**Observed**: 2026-07-27, twice, while measuring the Playwright suite before and after the e2e
consent-fixture fix (PR #173). Chromium and Firefox completed normally on the same machine, in the
same session, against the same dev server and the same local Supabase.
**Description**: **The signature, recorded verbatim — this is the only diagnostic anyone will
have:**

> Two hangs, identical signature: output frozen 17+ min, orphaned `WebKitNetworkProcess` at 0.1
> CPU-sec, no live browser process, stopping at a different test each run. Chromium and Firefox
> complete on the same machine.

Expanded, so the signature is readable without the shorthand:

- The reporter stops emitting. No new test lines, no failure, no timeout — the process simply sits.
  Observed frozen for **17+ minutes** on both attempts before being killed.
- `WebKitNetworkProcess.exe` orphans remain in the process table, each showing roughly **0.1
  CPU-seconds** consumed *since launch* — i.e. they did essentially nothing and then stopped, rather
  than spinning.
- **No WebKit browser process is alive** at that point. Only the network-process orphans and the
  runner remain, so the runner is waiting on a browser that has already gone.
- **It stops at a different test each run** — once mid-`anchor-flow`, once at 28/50. There is no
  single reproducing spec, which rules out a spec-level fix and points at the harness.
- `taskkill` will not terminate the orphans; PowerShell
  `Invoke-CimMethod -InputObject $cp -MethodName Terminate` does.

Chromium (43 passed / 3 failed / 4 skipped) and Firefox (42 passed / 4 failed / 4 skipped)
complete on the same machine, so this is **WebKit-on-Windows, not the suite** and not any change in
feature 013. Environment: `@playwright/test ^1.60.0`, `workers: 1`,
`{ name: "webkit", use: { ...devices["Desktop Safari"] } }` (`apps/web/playwright.config.ts:30`),
Windows 11.

**⚠ DECISION: WebKit is dropped from the feature-013 P8 sign-off bar. P8 signs off on Chromium and
Firefox.** This is a **knowingly accepted coverage hole on a live product**, written down rather
than assumed. It is stated in those words deliberately: **nobody may later read P8's green tick as
meaning all three browsers passed.** P8's sign-off covers two of the three configured Playwright
projects, and the third was never measured.

**What the hole actually costs.** WebKit is the only project standing in for Safari, and Safari is
not a hypothetical for this product: the calibration and monitoring-session capture paths behave
measurably differently there (iOS Safari's `MediaRecorder` output and the server-side decode of it
have their own history in this repo). Nothing about the Safari capture path is covered by an
automated run today. The mitigation that exists is manual: the feature-008 device gate was
validated on real Chrome **and real Safari/iOS**, and P8's smoke tests are performed by hand. That
is a genuine mitigation, but it is a person, not a gate.

**Fix scope**: unknown until diagnosed — start with `DEBUG=pw:browser*` on a single-spec WebKit run
to catch the disconnect, then try a newer Playwright, a re-download of the WebKit binary
(`npx playwright install --force webkit`), and `--workers=1 --max-failures=1` on individual specs to
see whether the hang follows the browser lifecycle rather than any spec. If it reproduces cleanly,
it is worth an upstream report; if it is Windows-specific, running WebKit in CI on Linux is the
cheaper route to the coverage than fixing the local runner. Pairs with **#54** (Playwright
pipe-buffering deadlock with `tail`) and **#55** (dev-server memory bloat across stacked full-suite
runs) — three separate harness pathologies now sit between this repo and a trustworthy local matrix
run.

**Address by**: before WebKit can return to any sign-off bar — so, not during feature 013.
Re-evaluate when CI first gains a Playwright job (see **#41**), because a Linux runner may close the
coverage hole without the local hang ever being solved.

### 360 px single-column card alignment misses by 8 px against a ≤ 4 px bar — pre-existing, and the consent gate had been masking it (#178)
**Status**: bug (`type:bug` / `area:web`) — **OPEN.** GitHub issue **#178 OPEN**.
**Category**: responsive layout / test masking
**Observed**: 2026-07-27, after fixing the e2e fixtures blocked by feature 013's app-shell consent
gate (PR #173). The failure appeared only *because* that fix unblocked the page.
**Description**: `apps/web/tests/e2e/employee-dashboard-shell.spec.ts:191` — *"employee shell at
360px: hamburger menu, single-column cards, icon-only chat pill"* — probes the single-column stack
by bounding box: the three card headings must share an x origin within a **4 px** tolerance
(`:226-227`), which is what distinguishes the mobile stack from the desktop `3fr/2fr` split. At
360 px the measured x-origin delta is **8 px**, so the assertion fails. The y-ordering assertions
above it pass, so the cards *are* stacking — the stack is simply not left-aligned to within the
tolerance the test was written against. Whether the fix is the layout or the tolerance is a
product/layout call, not a test call, which is why this is logged rather than patched.

**Pre-existing — proven, not assumed.** Checked out **`eefe83f`** (the P4 merge commit, before any
P5 gate code exists) and ran that single test there. It fails identically: same assertion, same
numbers. Nothing in feature 013 causes it.

**⚠ The interesting part: the consent gate had been masking it, and it may not be the only one.**
Before PR #173, every Playwright fixture user landed on P5's Terms/Privacy re-consent screen
instead of the page under test, so this spec died at the `/app` URL assertion — long before it
reached line 226. The failure did not "start"; it became *visible*. **A suite that fails early
reports the gate, not the defect underneath it**, and roughly 12 of 17 specs were failing early.
Any other pre-existing failure downstream of a blocked point was equally invisible for the same
reason, and some of it may still be hidden behind the residual failures that remain.

The general rule this establishes, worth applying to any future gate: **when a change blocks
fixture users, re-baseline the suite against the pre-gate commit before concluding that a newly-red
test is new.** The reverse also holds — when a gate is *removed* or fixtures are unblocked,
expect previously-masked failures to surface, and do not attribute them to the unblocking change.

**Fix scope**: small, but it needs a decision first. Either (a) fix the layout so the three headings
share an x origin at 360 px — likely a per-card padding or grid-gutter asymmetry, since the y
ordering is already correct — or (b) widen the tolerance if the 8 px offset is intentional design.
**Do not simply widen the tolerance to make the suite green**: the 4 px bar exists to prove the
desktop `3fr/2fr` split has collapsed, and a tolerance loose enough to hide a real regression is
worse than a red test. Verify at the feature-013 mobile floor — 320 / 375 / 414 / 768 px — not only
at 360.

**Address by**: any responsive-layout pass after 013 merges. Natural pairing with the mobile /
tablet typography bump (**#45**) and the rest of the standing design-system queue, since all of them
touch the same card surfaces at the same widths.

### e2e `SUPABASE_SERVICE_ROLE_KEY` is undocumented — and `.env.local.example` is the wrong home for it (#179)
**Status**: tech-debt (`type:tech-debt` / `area:docs`) — **OPEN.** GitHub issue **#179 OPEN**.
**Category**: contributor setup / test infrastructure documentation
**Observed**: 2026-07-27, while recording the pre-bump Playwright baseline for the Next
16.2.6 → 16.2.11 patch bump (#176). Cost one full aborted suite run before it was diagnosed.
**Description**: a clean checkout cannot run the Playwright e2e suite. `globalSetup` dies at once
with `Error: supabaseKey is required.` from `tests/e2e/setup/admin-client.ts:22`, which builds the
admin client out of `SUPABASE_SERVICE_ROLE_KEY`. `playwright.config.ts:9` loads
`apps/web/.env.local` into the runner process precisely so that key is present — but nothing tells
a contributor to set it. `apps/web/.env.local.example` lists exactly four variables
(`NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `NEXT_PUBLIC_API_URL`, `SITE_URL`)
and the service-role key is not among them.

**⚠ The obvious fix — adding it to `.env.local.example` — is the wrong one, and is actively
guarded against.** `.env.local.example` is the **runtime** env example; the service-role key is
deliberately not part of the runtime surface. **#142** removed the runtime service-role path
(`apps/web/lib/supabase/admin.ts` no longer exists), and
`apps/web/tests/unit/runtime-secret-posture.test.ts` stands guard over that removal: it fails if
the literal token `SUPABASE_SERVICE_ROLE_KEY` (or `service_role`, `createAdminClient`,
`/auth/v1/admin/`, …) appears anywhere under `apps/web/app/` or `apps/web/lib/`, and separately
asserts that `lib/supabase/admin.ts` is absent. Documenting the key in the runtime example would
advertise a runtime capability the codebase has deliberately deleted, and would invite exactly the
regression that test exists to catch. **The key is e2e test infrastructure and belongs in the e2e
setup documentation, not in the runtime env example.**

**Fix scope**: small — a doc change plus a decision on which home. Either (a) extend the
`global-setup.ts` header comment (`:1-16`), which already carries the other e2e prerequisite
(`npx playwright install --with-deps chromium firefox webkit`) and sits where the failure
originates, or (b) add a short `docs/testing/e2e-setup.md` (none exists today) covering the local
Supabase stack, the browser-binary install, and this key. Whichever lands must state **where the
value comes from** — `npx supabase status` against the local stack, a published Supabase CLI
local-dev constant, never a hosted project's key — and must say plainly that it is test-only, so
the next person does not mirror it into the runtime example. Worth naming the localhost guard at
`global-setup.ts:5-6` in the doc: it refuses to run against a non-localhost
`NEXT_PUBLIC_SUPABASE_URL`, which is what bounds the blast radius and makes this safe to write down.

**Address by**: any contributor-onboarding or test-infrastructure pass. Not urgent while the
current machines already have a working `.env.local`, but it is a hard stop for a fresh clone —
including CI, if a Playwright job ever lands (**#41**).

### Signup refusal is silent on the no-JavaScript path — ST-9 FAILED and knowingly accepted (#184)
**Status**: bug (`type:bug` / `area:web`) — **OPEN.** GitHub issue **#184 OPEN**.
**Category**: progressive enhancement / consent gate UX
**Observed**: 2026-07-28, running **ST-9** during feature-013 P8 Stage 1
(`specs/013-public-surface-and-legal/smoke-tests.md`).
**Description**: with JavaScript disabled — or hydration not yet complete, or failed behind a proxy
or on a flaky network — submitting `/signup` with the Terms and Privacy acknowledgement **unchecked**
is correctly refused, but the refusal is **silent**. The page re-renders with **zero `[role="alert"]`
nodes** and **every field cleared**: a blank form and no explanation.

**⚠ DECISION: ST-9 is recorded as FAILED and knowingly accepted for feature 013 — never as passed,
and never as partial.** Same treatment as **#177**: a knowingly accepted hole on a live product,
written down rather than assumed, so nobody later reads P8's green tick as meaning ST-9 passed.

**Why it is accepted rather than fixed now.** The refusal is **safe** — it fails closed: no account
and no consent row, because `signUpSchema` refuses at the parse step before `supabase.auth.signUp` is
reached. The harm is **confusion for a small population**, not mishandled data. Fixing it means
editing `apps/web/app/(auth)/signup/actions.ts` — the most sensitive file in this feature — during
the deploy window, risking the ~99% JavaScript path to repair the ~1% no-JavaScript path.

**How it was measured, because the method matters here.** Playwright, context created with
`javaScriptEnabled: false`. That setting was **verified rather than assumed**: `page.evaluate()` is
not a valid probe of it — the call runs through the debugger protocol and keeps working with script
execution disabled — so the probe used a side effect of the page's own scripts. JavaScript off:
`window.__next_f` `undefined`, no `__react*` keys on the checkbox. JavaScript on (control): both
present. Anyone re-running this should use the same probe; a `page.evaluate`-based one will report
the opposite and be wrong.

The rest of ST-9 passed on that same run: unchecked → **0** rows in `auth.users`; `/terms` and
`/privacy` open in a new tab (`target="_blank"`) and lose **no** entered data — email, full name, a
17-character password and the ticked box all survived; checked → account created with **exactly one**
`user_consents` row (`terms_privacy@2026-07-26.1`).

**Fix scope**: small, and it is **surfacing an existing message, not inventing one** — the
JavaScript-on path already renders the correct string, *"Please accept the Terms and Privacy Policy
to continue."*, so the work is carrying that reason across the no-JavaScript seam. Two server-side
shapes are worth weighing: redirect back to `/signup` with a **non-sensitive** status marker in the
query string (the `?state=check_email` pattern already in that file — note the current path returns
`void` precisely so credentials never reach the URL), or render the reason from the server component
on re-render. Whichever lands must preserve `signUpFromForm`'s deliberate design: it adds **no**
validation of its own and delegates entirely to `signUp()`, and a parallel guard there is a second
thing to get wrong — the one nobody exercises.

**Address by**: its own change, after `013-public-surface-and-legal` merges. **Not** during the
deploy window.

### Blocked team photo leaves a large empty reserved box — no graceful placeholder (#185)
**Status**: polish (`type:polish` / `area:web`) — **OPEN.** GitHub issue **#185 OPEN**.
**Category**: landing page / failure-state presentation
**Observed**: 2026-07-28, running **ST-14** during feature-013 P8 Stage 1.
**Description**: when the landing page's team photograph fails to load, the space it occupied stays
as a **large empty box** — roughly 1440 × 700 px at desktop — bordered and blank. Everything around
it is unaffected.

**This is correct behaviour, and that is the point.** `apps/web/components/landing/team-photo.tsx`
renders `next/image` with explicit `width={1600} height={1164}`, which reserves the aspect ratio and
prevents cumulative layout shift — and that reservation is exactly why the layout does **not**
collapse when the image is missing. What is missing is the *graceful* half: the reserved area reads
as a blank rather than as a deliberate placeholder.

**ST-14 itself PASSED** and this entry is the cosmetic remainder, logged so it is not lost. With the
photo blocked (every image request and `/_next/image` aborted): 4 name cards, 8 external links, the
caption "Choose a name to find them in the photo." and the supervisor credits all present, section
1440 × 1197.8 px. Throttled (50 kB/s down, 500 ms RTT): same content, 1440 × 1198.0 px — within a
third of a pixel of the unthrottled height.

**Fix scope**: small and self-contained — a placeholder state on the reserved area (a surface-token
fill so the box reads as intentional, a short acknowledgement that the photo did not load, or
`next/image`'s `onError` driving a styled fallback). **Must keep the explicit width/height
reservation**: removing it to avoid the blank box would trade a cosmetic blemish for real layout
shift, which is the worse outcome.

**Address by**: any landing-page polish pass after 013 merges. Low priority — it appears only when
the image fails, and the section stays fully functional when it does.

### `cold-start-readiness.spec.tsx` fights next-themes for the `dark` class — intermittent under load (#187)
**Status**: test defect (`type:bug` / `area:web`) — **OPEN.** GitHub issue **#187 OPEN.**
**Category**: layout test suite / feature 009
**Observed**: 2026-07-28, while verifying `fix-landing-fidelity` (PR #186).

**Description**: the two **dark** variants of `apps/web/tests/layout/cold-start-readiness.spec.tsx`
fail intermittently in a full `playwright.layout.config.ts` run, and pass every time in isolation.
The failure is a contrast assertion — `Expected: >= 4.5`, `Received: 4.336…` — which looks like a
colour regression and is not one. No token value changed.

**Root cause**: the spec sets the theme by hand, immediately after `page.goto`:

```ts
await page.evaluate((dark) => {
  document.documentElement.classList.toggle("dark", dark);
}, theme === "dark");
```

`/cold-start-harness` lives under `app/`, so it is wrapped by `Providers` →
`ThemeProvider attribute="class" defaultTheme="system"`. **next-themes owns that class.** When its
hydration effect runs *after* the test's toggle — which is what happens once the machine is busy —
it resolves the system preference (light, Playwright's default) and reverts the class. The dark
test then measures a light or partially-reverted palette, and 4.336 is that torn state rather than
either theme's real value.

**Why it surfaced now, and why it is not PR #186's defect**: that PR adds a fifth viewport (1280 px)
to `landing-hero-stability.spec.ts` — a 17-beat test that adds ~40 s of wall clock and CPU to the
same four-worker pool. That extra contention is what makes the pre-existing race land on the losing
side. Measured: **3/3 clean full-suite runs on `013-public-surface-and-legal`** vs **3 intermittent
failures across ~8 full-suite runs on `fix-landing-fidelity`**, with **6/6 clean** on the branch once
the machine was otherwise idle. The race is in the 009 spec; the new width only changes how often it
loses. Every landing-owned assertion passed in every run.

**Fix scope**: small. Drive the theme the way the browser actually does rather than by racing the
provider — `await page.emulateMedia({ colorScheme: theme })` before `goto`, which is what the
feature-013 walks use and what next-themes then resolves *to* rather than away from. Alternatively
await a settled signal (`html.dark` present AND hydration complete) before measuring. Either removes
the race; the manual `classList.toggle` cannot be made reliable while the provider owns the class.

**Address by**: any pass that touches the layout suite. Not urgent — it is a false negative rather
than a missed regression, and it never passes when it should fail.

## From feature 013 P8 Stage 3 review — captured 2026-07-28

### Hosted Supabase email templates render a single-colour wordmark — the hand-sync exception is unenforced on the hosted side (#189)
**Status**: bug (`type:bug` / `area:db` / `area:docs`) — **OPEN.** GitHub issue **#189 OPEN.**
**Category**: constitution Principle V (Amendment 17) / FR-029 / ops
**Observed**: 2026-07-28, reading the Supabase dashboard for `excukdzjudslbqmkysrc` directly.

**Description**: the **hosted** transactional email templates render `serenify` in **one colour**.
The two-colour wordmark Amendment 17 requires is **not in production**. Both *Confirm sign up* and
*Reset password* declare `.wordmark` alone in their `@media (prefers-color-scheme: dark)` block —
hosted line 16 is `.wordmark`, line 17 is `.headline`, where the repo file carries three rules
across 16–18 — and the dashboard's own Preview pane renders the mark as a single uniform grey in
both. Hosted is the repo template **at its pre-T007 revision**.

Everything else compared matches the repo: `<title>`, headline, body copy, CTA label, the OTP line,
the dark-block colour values. One unrelated divergence: the *Confirm sign up* **subject** was
`Confirm your Serenify account` on hosted against `Confirm your Serenify email` in
`supabase/config.toml`; recovery's subject matches.

**Ruled 2026-07-28 (Mohamed): the repo version wins — `Confirm your Serenify email`.** The point of
this entry is making production match the repo; opening a new divergence while closing one would
defeat it.

**Root cause — two layers.** `supabase/config.toml` wires both templates via `content_path`, but
that is **local-dev config**. Nothing in the repo and nothing in CI ever transmits
`supabase/templates/*.html` to a hosted project: no workflow references Supabase at all, and there
is no `supabase config push` anywhere. Hosted templates are dashboard-only.

Beneath that, `apps/web/tests/unit/brand/wordmark-sync.test.ts` — the mechanism Principle V relies
on to stop exactly this drift — reads `supabase/templates/*.html` **off disk**. It can only ever
prove the repo agrees with itself. The hand-sync exception has been unenforced on the one side that
reaches users, which is why this survived T007 and every run since.

**Fix scope**: two separable pieces. (1) **Content** — paste the current repo templates into the
dashboard; operator action, cheap, and the urgent half. (2) **Mechanism** — the gap is permanent and
re-opens silently the next time the wordmark changes; candidates, in rising cost, are a documented
release-checklist step, a `supabase config push` in the deploy runbook, or a check that pulls the
hosted template through the Management API and diffs it against the repo file.

**Progress 2026-07-28**: **both template BODIES pasted and saved by Mohamed, and verified live** — the
dashboard Source now carries `.wordmark-seren` / `.wordmark-ify` in the dark block on both templates,
and both Preview panes render `seren` in ink and `ify` in meadow. The FR-029 content breach is
**closed**. **Still outstanding**: the *Confirm sign up* **subject** is still `Confirm your Serenify
account` and must be set to `Confirm your Serenify email` per the ruling above — the subject is a
separate dashboard field, so pasting the body did not touch it.

**Address by**: (1) subject field, before Stage 4 ships anything that sends mail. (2) the mechanism
gap — the same pass that does #190, so the email surfaces are touched once.

### The OTP verification tick vanishes immediately — it should linger (#190)
**Status**: polish (`type:polish` / `area:web`) — **OPEN.** GitHub issue **#190 OPEN.**
**Category**: auth surfaces / motion
**Observed**: 2026-07-28, entering the emailed code on the preview's own form
(`deploy-log-stage3-2026-07-28.md` §3).

**Description**: on a correct 6-digit code the form shows "✓ Verified" and moves on essentially at
once. The tick is gone before it registers as an acknowledgement — and the moment it marks, the
user learning the code they typed was right, is precisely the one that should read as reassurance.

**Fix scope**: motion only — a hold before the transition, honouring `prefers-reduced-motion`. No
copy change implied.

**Address by**: the design pass over the transactional email and OTP surfaces after
`013-public-surface-and-legal` ships. **Deliberately not built now**, and deliberately paired with
#189 so those surfaces are opened once rather than twice.

### ~~Landing chapter-marker dots are 24×24 px tap targets, not 44×44~~ — WITHDRAWN, not a defect (#191)
**Status**: **WITHDRAWN 2026-07-28 — not a defect.** GitHub issue **#191 CLOSED as superseded.**
**Category**: feature 013 P6 landing page / FR-053
**Observed**: 2026-07-28, on the driven P8 responsive walk for PR #188. **Ruling: Mohamed, same day.**

**The measurement was right and the conclusion was wrong.** The markers really are 24×24 at every
width — but that is **deliberate and compliant**, not a miss. FR-053 was amended on 2026-07-28 with a
**spent 24×24 px exception scoped to `components/landing/chapter-markers.tsx` only**
(`spec.md` FR-053; `docs/DECISIONS.md`, "FR-053 gains a spent 24×24 exception for the chapter
markers"). 24×24 satisfies **WCAG 2.5.8 (AA)**, the markers are a convenience rather than a path,
and they keep their focus ring — all recorded in the amendment.

**What was actually stale was T096**, which still demanded "≥44×44 px on touch viewports" while marked
`[X]`. That text has been corrected in place to cite the amendment, so the contradiction is gone
rather than left for someone to "fix" by growing the targets and undoing a deliberate decision.

**Lesson worth keeping**: the walk checked `tasks.md` and the constitution but not FR-053's own text in
`spec.md`, where the amendment lives. A tap-target finding must be read against the amended FR, not
against the task that predates it.

<details><summary>Original report, retained for the record</summary>

**Description**: the six chapter-marker buttons at
`apps/web/components/landing/chapter-markers.tsx:65` set their hit area with an unconditional
`size-6` — **24×24 px**. No `@media (pointer: coarse)` rule exists anywhere in
`apps/web/app/globals.css`, so 24 px is what every viewport gets, phone included.

Measured at 320 / 375 / 414 / 768 / 1280 px in both themes: all six report a 24 px box at every
width, in both themes. They are the **only** sub-44 px controls on any public route — `/terms`,
`/privacy` and the re-consent screen all report zero.

**Why it is more than a nicety**: T096's acceptance conditions require "each is **≥44×44 px on
touch viewports**" (`specs/013-public-surface-and-legal/tasks.md:693`), FR-053 sets the same bar,
and **T096 is marked `[X]`**. This is a checked-off condition that was not met, not an unlogged
nice-to-have.

The instinct in the code was right — the comment above the line reads "The hit area is the button;
the dot is only what you see" — `size-6` just does not carry it far enough, growing the target from
the 1.5 px dot to 24 px and stopping short of 44.

The six sit contiguously in a `flex items-center justify-center` with no gap, so at 24 px they do
clear WCAG 2.5.8's 24 px AA floor. The project's own bar is the stricter one.

**Fix scope**: small. `size-6` → `size-11` on the button, dot stays `size-1.5` — the dot is already
a separate `<span>`, so nothing visual changes, only the invisible hit area. Re-check the row width
at 320 px afterwards (6 × 44 = 264 px, inside the 288 px content column) and that the focus ring
still reads at the larger size.

**Address by**: any landing-page pass after 013 merges. Not a deploy blocker — the markers are a
convenience and the story advances on its own — but it should not stay closed against a task that
claims it.

</details>

### `failOpen()` is unobservable on Hobby — A5 has no real-time detector (#192)
**Status**: tech debt (`type:tech-debt` / `area:web` / `area:infra`) — **OPEN, DEFERRED BY DECISION.**
GitHub issue **#192 OPEN.**
**Category**: feature 013 consent gate / deploy observability
**Observed**: 2026-07-28, during P8 Stage 3b.

**Description**: `failOpen()` (`apps/web/app/(authed)/layout.tsx:62`) records a fail-open — the
Terms/Privacy gate silently disabling itself for a request — with `console.error` alone, and
abort condition **A5** is defined as "a sustained stream" of that line. **On this project that is
not observable**: the Vercel account is **Hobby**, where Log Drains are Pro+ and retention is
short, so a sustained stream is something someone would have to happen to be watching. There is
nothing to alert on.

Distinct from the *method* bug corrected in `deploy-log-stage3b-2026-07-28.md` §5 (the earlier
positive control returned before the line it was testing). This entry is about the **plan**, which
is unobservable even with perfectly readable logs.

**Deferred deliberately — ruled by Mohamed, 2026-07-28.** `failOpen()` lives in the file **P5
shipped alone, specifically to keep `git revert` clean**: Lever 2 of the deploy protocol is a
`git revert` of the gate commit, and that lever's value depends on the commit staying surgical.
Reopening that file days before production — for a failure mode that **requires a schema change to
occur at all** (wrong RLS policy after a migration, dropped grant, renamed column) — trades a real
and immediate risk for a hypothetical one. Not because it isn't real; because the cure is riskier
than the disease this week.

**What covers it in the meantime**: `deploy-protocol.md` §6.4 now carries a **lagging** detector
needing no code change and working on any plan — if the gate works the 20 returning users write
consent rows, and if it is failing open they reach the app and write nothing. Query (c), signed in
since the deploy with no consent row, growing while (a) grows, is the alarm. Its limits are
documented there and are real: it reports only after someone signs in, no single row is conclusive
(a user sitting on the screen looks identical to one who slipped past), and **zero sign-ins means
zero information, not good news**.

**Fix scope**: have `failOpen()` also record its own occurrence somewhere queryable — a small
append-only table or a counter — so "sustained stream" becomes a SQL query that survives retention
and needs no plan upgrade. **Caveat to design around**: it fires *because* a consent read failed,
so a total database outage blocks that write too; it is not a universal net. But the three modes the
docstring names are all specific to the `user_consents` SELECT under RLS, and a separate INSERT
survives all three — which is the point. Worth pairing with whatever replaces the `console.error`,
so the file is opened once.

**Address by**: after `013-public-surface-and-legal` merges, as its own change.
