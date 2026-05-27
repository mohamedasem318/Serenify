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

### ~~Auth form components inlined in page files, not extracted~~ — resolved
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

### ~~Cross-tab auth state sync~~ — resolved
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

### Card heading typography — fresh design read needed
**Status**: polish
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

### Cursor pointer on Link-wrapped anchors and other clickable surfaces
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

### CI guard for speckit skills + gitignore rule
**Status**: tech-debt
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

### Dynamic welcome banner subtitle variants
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
005/006) before the variants have anything to key on. Decision M
locks the current copy as the all-contexts fallback; variants
layer on top.
**Address by**: post-feature-006 (calibration shipped, signal
data exists). NOT before — variants without signal would just be
random copy churn.

### Notifications-section live controls on /app/account
**Status**: deferred-feature
**Observed**: feature 003 plan (FR-021 placeholder)
**Description**: The Notifications section on `/app/account` is a
placeholder card today (`apps/web/components/account/notifications-placeholder.tsx`) —
muted body text describing that notification preferences land in a
later feature, no live controls. The component shape matches the
Privacy placeholder so a future swap is symmetric. The notification
*surface* (`apps/web/components/notification.tsx`) shipped in
feature 003 but is not mounted by any production code per FR-033;
features 007/008/010 will mount it. The user-facing **preferences**
(channels, quiet hours, digest cadence) belong in this placeholder
when there's a notifications system to configure.
**Fix scope**: medium — schema + Server Action + form, paired with
whichever feature first generates user-controllable notifications.
**Address by**: with the first feature that emits notifications to
users (likely feature 008 / chatbot interrupts, or feature 010 /
privacy controls if those reuse the notification surface).

### Welcome banner timezone awareness (server-rendered greeting)
**Status**: deferred-bug
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

### Playwright local matrix run: pipe-buffering deadlock with `tail`
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

### Dev-server memory bloat + monotonic slowdown across stacked full-suite runs
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

### Non-dismissible confirmation notifications (stress-detection prompts)
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
mount confirmation flows: 007 (stress detection), 008 (chat), 010
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
**Address by**: whichever consumer feature (007 / 008 / 010) builds the
first non-dismissible confirmation notification.

### Auth-broadcast audit needs a forward-looking guard, not a one-time snapshot
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

### "Send a new confirmation" link contrast underweight in light mode
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

### Extend ST-9 to assert recovery flow submits password update end-to-end
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

## From security slice 3 (privileged-endpoints-and-input-validation) — in progress

### Invite audit log — record who invited whom
**Status**: deferred-feature
**Category**: observability / admin
**Observed**: 2026-05-25, security slice 3 (Out-of-scope note + Finding 2 review)
**Description**: `POST /api/admin/invite` records nothing about *who invited
whom*. The handler has both identifiers in hand at success — the caller's
verified `user.id` (from `getUser()`) and the invitee's `user_id` (from
`inviteUserByEmail`) — but writes no audit trail. There is no way after the fact
to answer "which admin invited this user, and when." For an admin dashboard
(feature 011) this is table-stakes provenance.
**Fix scope**: small-to-medium. Two viable shapes:
  - (a) Structured server-side log line at the 201 branch
    (`console.info("[invite] issued", { by: user.id, invited: invitedId, role })`)
    — cheap, immediate, but not queryable from the product.
  - (b) A dedicated `public.invite_audit` table (`id`, `invited_by`,
    `invited_user_id`, `role`, `manager_id`, `created_at`) written in the same
    request — queryable, surfaces invite history in the admin dashboard. Needs a
    migration + RLS (admin-read-only) and a write from the handler after step 2
    succeeds.
**Address by**: feature 011 (admin-dashboard), which is the first consumer that
needs invite history. Decide (a) vs (b) there; (b) is the durable answer if the
dashboard surfaces invite provenance.

### Concurrent-duplicate-invite idempotency
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
**Address by**: when `/api/admin/invite` gets a real browser client (feature 011
admin dashboard) and concurrent submits become reachable in practice; pair with
the invite partial-success / transactional-semantics handler-design item.

---

## From security slice 7 (rate-limits-and-parity) — in progress

### `/signup` is open self-serve — gate to invite-only (posture) — ⛔ PRE-PRODUCTION DEPLOY BLOCKER
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
the thesis/demo stage. Likely pairs with feature 011 (admin-dashboard), which
owns the invite UX.

### App-layer rate limiting (durable limiter for invite + profile writes)
**Status**: tech-debt
**Category**: hardening / abuse-resistance
**Adjudicated 2026-05-26**: the `/api/admin/invite` per-admin throttle is **held for
feature 011** — calibrating a limit without a real admin UI is arbitrary, and
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
with feature 011 (admin-dashboard), when `/api/admin/invite` gets a real browser
client and abuse becomes reachable in practice.

---

## From feature 004 (onboarding-video-anchor) — planning

### Onboarding name step is redundant with signup full_name collection
**Status**: deferred-bug
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
