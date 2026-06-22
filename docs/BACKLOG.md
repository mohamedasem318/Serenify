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

## From feature 004 (onboarding-video-anchor) — in progress

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

### Cross-browser / cross-device anchor + auth sync (realtime push)
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
Features 007/008 (stress detection / chat interrupts) may introduce Supabase
Realtime for live notifications anyway — bundle the anchor/auth realtime sync
into that workstream rather than standing up Realtime solely for the banner. Not
blocking 004: the manual-refresh fallback is acceptable for the thesis/demo
stage, and same-browser multi-tab sync already works.

### Post-deploy mobile camera → upload → anchor verification (real devices, HTTPS)
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
**Fix scope**: medium — stand up an HTTPS dev/staging path reachable from a phone
(the backend + Supabase must also be reachable over HTTPS), then run ST-22/ST-23
camera happy-paths end-to-end and assert the produced codec decodes server-side and
the anchor row is written. ST-24 (iOS) pairs here once Apple hardware is available.
**Address by**: first deploy to an HTTPS environment (staging or production), before
relying on mobile capture in the field.

### Safari desktop + iOS Safari smoke cells (ST-21 / ST-24) — pending Apple hardware
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

### Camera device selection not always written back to localStorage (ST-05)
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

### e2e test-hardening pass — mock-driven coverage masked real 004 bugs
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

### Feature 005 scope pointer — calibration UX revamp + anchor read path + design pass
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
**Fix scope**: feature-sized — tracked here only as a pointer.
**Address by**: feature 005 spec/plan.

---

## From hotfix/lbp-roi-interpolation (feature 005 recon) — 2026-05-29

### Store an extraction/pipeline-version alongside each anchor (auto-invalidation)
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
space. At inference (feature 006), treat an anchor as invalid when EITHER its
model_version OR its extraction_version mismatches the running service, and surface
the "recalibrate" prompt already contemplated in MODEL_HANDOFF §2.3. Keep the new
column write-only / scope-guarded like the other anchor metadata (DECISION-12: not
in the `authenticated` SELECT whitelist).
**Address by**: before any real-tenant production launch, or the next time
`packages/ml-video` extraction code changes — whichever comes first. Pairs with
feature 005's anchor read-path decision and feature 006's live inference.

### End-to-end extraction-vs-notebook fidelity check (prerequisite for feature 006)
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
the CI Supabase/ML setup is already a tracked feature-006 dependency (see the
feature-002 "CI integration" entry) — pair them.
**Address by**: before trusting any live prediction in feature 006 (live inference).
Treat as a go/no-go gate on feature-space fidelity, not optional polish.

---

## From feature 005 (calibration-capture-flow) — in progress

### Before the 005 detector ships — outstanding launch blockers
**Status**: deferred (launch gate)
**Category**: deploy gate / pre-launch verification
**Observed**: 2026-06-01, feature 005 implementation (Phase 1 + Phase 10 follow-ups)
**Description**: The on-device face detector and the redesigned capture flow are
implemented and CI-green — the NON-NEGOTIABLE FR-050 zero-egress proof and the
consolidated e2e (`anchor-egress` / `anchor-flow` / `anchor-camera-access` /
`anchor-banner` / `anchor-cross-tab`) pass on chromium with boundary seams. Three
items MUST still be cleared before the detector ships to a real environment; tracked
together here as the 005 pre-launch gate:

- [ ] **⛔ T004 — flip the capture-route CSP from report-only to ENFORCE** (HARD
  blocker, must land before any detector call ships). The scoped
  `script-src 'wasm-unsafe-eval'` (+ provisional `worker-src 'self' blob:`) delta on
  `/onboarding` + `/app/calibrate` currently ships **report-only** (T003). Run the
  `securitypolicyviolation` sweep under Playwright on both capture routes with the
  detector loading, narrow to the minimal allowance (drop `worker-src` if the runtime
  needs no blob worker), then flip to **enforce** in `apps/web/proxy.ts`. Per
  DECISION-20 / Risk R-2 the enforce MUST be verified BEFORE the detector's first real
  call — a report-only policy does not actually block, so a CSP regression would
  otherwise reach production silently.

- [ ] **Run the T032 smoke matrix on a real webcam** — specifically the cross-browser
  webcam permission matrix (§1) and the three real camera-access conditions (§2:
  Blocked / Busy / No-camera) in
  `specs/005-calibration-capture-flow/smoke-tests.md`. CI proves the orchestration with
  injected seams (getUserMedia/detector); the real permission prompts, real
  cross-browser `MediaRecorder`, and the real detector clearing the soft gate on a real
  face are human-validated only — they are explicitly deferred there, not faked green
  (DECISION-26). Mohamed signs off the smoke table before merge.

- [ ] **Verify the mobile camera path over HTTPS** — `getUserMedia` requires a secure
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

### Thin baseline accepted as success — no minimum-usable-frames / extraction-quality gate
**Status**: bug
**Category**: backend / extraction quality (anchor validity)
**Observed**: 2026-06-01, feature 005 smoke — a 60 s baseline recording in which the
user's face was actually in frame for only **~2 s** was still accepted as success
("Your baseline is set", `apps/web/components/anchor/success-state.tsx:23`).
**Symptom**: An almost-empty recording produces a "successful" calibration. The user
believes they are calibrated when the baseline is built from a handful of usable
frames and is almost certainly garbage — which then poisons every later
delta-from-baseline reading at inference (feature 006). The failure is silent: there
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

**Candidate fixes (feature 006 / backend-quality pass — NOT a 005 task):**
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
- "End-to-end extraction-vs-notebook fidelity check (prerequisite for feature 006)"
  (above) — the same calibration/dataset run that would fix this should also fix the
  coverage threshold; treat min-usable-frames as part of that go/no-go fidelity gate.
- "Store an extraction/pipeline-version alongside each anchor (auto-invalidation)"
  (above) — a different anchor-validity axis (stale feature space); this entry is
  about a *thin* anchor in the current feature space. Both feed feature 006's
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
**Address by**: feature 006 (live inference) / a backend-quality pass — before any
live prediction trusts a stored anchor. A thin baseline silently poisons every
delta-from-baseline reading, so this is a correctness prerequisite for inference, not
optional polish.

---

## Product-wide / cross-cutting — captured 2026-06-19

These two items were not deferred from a single feature; they are product-wide
concerns surfaced during the feature 007 / 008 window and logged here so the
roadmap pulls them in at the right gate rather than re-deriving them.

### Terms of Service, Privacy Policy, and signup consent gate (Egyptian jurisdiction) — ⛔ PRE-PRODUCTION DATA-PROCESSING GATE
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
**Address by**: draft **alongside feature 012 (privacy-controls-and-transparency)**, since
that feature defines the exact data-handling substance the documents must describe (manager
visibility, privacy slider, transparency view) — write the policy and the controls together
so they cannot drift. **Ship the signup checkbox together with the real documents** (not a
placeholder linking to empty pages). **Hard gate: before any real user data.** Pairs with
the security-slice-7 "`/signup` is open self-serve — gate to invite-only — ⛔
PRE-PRODUCTION DEPLOY BLOCKER" entry (both are binding pre-real-data gates on the signup
surface) and with the `/app/account` Privacy placeholder that feature 012 fills in.

### Internationalization — Arabic (RTL) and possibly French
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

## From feature 008 (stress-inference-service) — in progress

- **T026 recorder mime — feature-detect and support BOTH containers (webm-preferred, fMP4 fallback), do not hard-code one** (`watch` / pre-build, from 008 device gate): the T009 gate proved both webm and fMP4 decode to `(2958,)`, but on a single iOS device, and iOS WebM-capture support is recent/uneven — so `window-recorder.ts` (T026) must `pickMime` webm-first with an fMP4 fallback rather than assume either container.
- **Keep-up — surgical O(stride) tail-decode SHIPPED (2026-06-21); the full per-session rolling buffer is now only a *conditional* upgrade, and the read loop still needs back-pressure** (`watch` / production-deploy, from 008 device gate + the 2026-06-20 supervised smoke; pairs with research R-5 / T009): the supervised smoke measured the live lag *growing* ~9 s/window to ~3 min behind, because the server **re-decoded the whole growing recording-so-far every window** (per-window decode O(elapsed)). **Fixed surgically** in `ml-video` (`pipeline._extract_landmarks_tail` + `probe_global_timestamps_fast`, wired through `compute_anchor(tail_seconds=60)` + `probe_recorded_seconds`): both the `< 60 s` gate and the tail decode now touch only the **bounded trailing 60 s** (ffprobe packet grid + native-seek/ffmpeg-`-c copy`-remux), **bit-identical** to the whole-file path (`tests/test_tail_seek_keepup.py`). Measured before→after on the chrome continuous fixtures: per-window total **18 s→13 s, 30 s→11 s, 34 s→9 s, 51 s→11 s, 55 s→9 s** — i.e. BEFORE *grew* 3.1× with elapsed (O(elapsed), lag climbs), AFTER is **flat ~9–13 s** (O(stride), independent of elapsed). The growing-lag breach is removed. **TWO things remain** (decide alongside the chosen deploy target): **(a)** the *absolute* flat cost is still ~9–13 s on the dev laptop — partly the constant MediaPipe+LBP extract (R-5's separate, decode-independent cost; lever = slower reading cadence or GPU MediaPipe) and partly the bounded tail decode — so on a slower target it may still sit near/over the 10 s stride; the **full per-session rolling decoded-frame buffer** (decode only the **new ~10 s increment** each window → ~1.5 s decode, true O(stride) not O(window)) is the upgrade to build **only if** keep-up is re-measured on the real deploy target and the surgical flat cost breaches there (Option 2 of the 2026-06-21 design choice). **(b)** the read loop must still not fire a new stride while one is in flight (or must coalesce) — the per-stride-decode fix does not prevent overlap. Also: the surgical fix adds an **ffmpeg/ffprobe CLI** dependency on the API host (Dockerfile + `apps/api/README.md`); absent → degrades to whole-file decode (O(elapsed)), runs-but-fails on a clip → skipped window (200), never 500. Run `test_tail_seek_keepup.py` **on the deploy image** so an ffmpeg version difference can't silently shift fidelity.
- **In-memory smoothing buffer needs single-worker / session affinity / a shared cache in a multi-worker deploy** (`watch` / production-deploy, from 008 US1 T020; see DECISIONS 2026-06-20): the D-3 server-side smoother reads the last N=4 scored `proba[1]` from a **per-session in-memory buffer** (`inference.py` `_SessionBuffers`), NOT from the DB — because revised D-1 removed the service-role and the `window_readings` SELECT whitelist withholds `stress_probability` from `authenticated`, so the API can't read the raw probability back. Consequences for production: (a) with **>1 worker** the per-stride windows for a session must land on the **same** worker (session affinity) or share state via an external store (e.g. Redis), else the buffer is split and the band warms up erratically; (b) an **API restart drops all buffers**, so each active session **re-warms** (~90 s) — harmless but visible. Acceptable for MVP / localhost (single worker). Same class as the deferred rolling decoded-frame buffer + the read-loop back-pressure item above — decide alongside the chosen deploy target. The explicit per-session `buffers.drop()` on End is wired in US2 / T036; an LRU cap bounds memory until then.
- **Feature 011 (team-lead dashboard) must add a tightly-scoped coarse-aggregate read path — NOT reach for the service-role key** (`deferred-feature` / blocks-011, from 008 foundational T010–T011): 008 deliberately denies any manager access to `monitoring_sessions` / `window_readings` — owner-only RLS (select/insert/update-own), **no manager policy at all**, and `apps/api` holds **no service-role key** (revised D-1). When 011 needs managers to see team stress at a glance, it MUST satisfy that with a **tightly-scoped `SECURITY DEFINER` rollup function or a manager-readable aggregate view** that exposes **coarse bands only** (e.g. counts/fractions per band over a window, or a team tenor) and **never raw individual `window_readings`, never `stress_probability`/`label`, never per-employee point data** — mirroring `get_my_anchor()`'s self-scoping but widened to a manager's direct reports under the existing `profiles` manager relationship, with its own privacy review. It must **not** introduce a service-role key into `apps/api` to bypass RLS — the whole 008 posture is that the manager layer gets *nothing* by default, and any manager visibility is an explicit, coarse, separately-reviewed addition. (Pairs with the feature-001 "Manager dashboard time-range insights" entry — broader windows are *more* privacy-preserving.)
- **A new camera/capture route must be registered in EVERY camera-policy touchpoint, or `getUserMedia` silently dies under the inherited `camera=()`** (`watch` / pre-build, from 008 US1 — `/app/monitor` originally shipped registered in none of them, so a granted permission still yielded no stream): a route that calls `getUserMedia` must be added to **(1)** `CAPTURE_ROUTES` in `apps/web/next.config.ts` (the `camera=(self)` Permissions-Policy header map) **AND (2)** the negative-lookahead exclusion in that same file's site-wide `camera=()` rule (`/((?!onboarding|app/calibrate|app/monitor).*)`) — these two spots MUST move together, because a path matched by *both* PP rules emits a *combined* `camera=() ∩ camera=(self) = denied` header that breaks the camera — **AND (3)** `isCaptureRoute` in `apps/web/proxy.ts`, which scopes the on-device MediaPipe detector's CSP (`script-src 'wasm-unsafe-eval'` + `worker-src 'self' blob:`); without it the detector WASM is CSP-blocked and the capture stage renders blank. The route's API origin must also stay reachable via the proxy `connect-src` (sourced from `NEXT_PUBLIC_API_URL`), so keep that env requirement **discoverable in the relevant `.env.example`** — the same discoverability discipline as the `SUPABASE_ANON_KEY` fix in `apps/api/.env.example`. Symptom of a miss: a granted camera permission still yields no stream (PP denied) or a blank stage (CSP-blocked WASM). A lint/test guard asserting these three lists stay in lockstep would retire the regression class.
- **US4 trend: ambient "weather of the day" view + feel/precise toggle** (`deferred-feature` / post-demo (after feature 010), from 008 US4 trend design): while designing the US4 trend we explored an ambient, lower-precision "weather of the day" representation (soft colour fields across the day rather than the precise soft-line trend), and a feel-vs-precise toggle between it and the approved soft area+line trend. Deferred from 008 to keep a single trend visual language and avoid doubling the build/test/a11y surface in a branch closing clean. Note for any revisit: the literal sun/cloud icons + weather wording read off-voice for Serenify — a future ambient view should use Serenify's own band vocabulary (at ease / a little tense / tense) and abstract soft colour, not weather iconography. Fix scope: medium — a second trend representation, a toggle control, persisted toggle preference, plus its own a11y/responsive/test coverage. Address by: post-demo, after feature 010 — optional dashboard flourish; only if there's appetite for an ambient view.
- **Model-owner: remove/annotate the stale `window_eval_config` (30 s) block in `metadata.json`** (`tech-debt` / model-owner, from 008 T056 carry-over; research R-0): the committed model artifact's `metadata.json` carries a stale `window_eval_config` of **30 s** that is **NOT** the production window — the production contract is **60 s / 10 s**, locked by Constitution Principle II + FR-002 + `docs/MODELS.md`, and the operating point 0.53 is read from `loso_metrics_60s_calibrated`. The 30 s block is a leftover from an earlier eval and could mislead a future reader into shortening the window. **This is a model-owner task, deliberately NOT actioned in 008.** When picked up it is **metadata/doc-only**: annotate or delete the stale block — **NO `model_version` bump, NO anchor invalidation, and DO NOT edit the model artifact or re-touch `metadata.json` in a way that changes the artifact hash** (touching it would invalidate the verified anchor + the bit-for-bit fidelity established for `@2.0.0`). Safest shape is a `docs/MODELS.md` clarifying note that the 30 s block is stale and ignored, leaving the artifact byte-untouched; only the model owner should decide whether to also edit the artifact's metadata under a controlled re-publish. Fix scope: small (doc note) / medium (controlled artifact re-publish, owner-only). Address by: the next model-owner maintenance pass; not blocking 008.
- **Retention: 90-day `window_readings` purge job (policy decided, job deferred)** (`deferred-feature` / data-retention, from 008 T057; `data-model.md` § Retention): 008 decides the retention **policy** — `window_readings` is kept **90 days then purged** (it carries the affective per-window signal; `monitoring_sessions` is retained longer as it holds no raw signal) — but **does not build the purge job**. The job is a small additive `pg_cron` task (or an external scheduled task) running e.g. `DELETE FROM public.window_readings WHERE created_at < now() - interval '90 days';`. No 008 surface reads a reading older than today's recap / the 009 sustained-tense window, so the job's absence has **no functional effect in 008** beyond unbounded storage growth on a long-lived deployment. Fix scope: small — one `pg_cron` schedule (or a cron'd server task) + a migration if using `pg_cron`; pair with whichever feature first provisions scheduled DB jobs. Address by: before any long-running production deployment accumulates >90 days of readings; deferred from 008.
- **Two pre-existing eslint errors in `components/monitor/monitoring-session.tsx` (NOT US4/Phase-8-introduced; deliberately not fixed in polish)** (`tech-debt` / from 008 T058 sweep, pre-dates US4): `npm run lint` reports exactly two errors, both pre-existing from the camera-lifecycle fix and **left untouched on purpose** in the Phase 8 polish pass because they sit on the camera `srcObject`/release lifecycle and are risky to refactor in a polish task: **(1)** `react-hooks/immutability` at **L200** — the reactive bind-and-play effect assigns `videoEl.srcObject = stream` (eslint flags mutating a value returned from `useState()`); this is the deliberate fix for the "self-view stuck until alt-tab" bug (the effect, not the callback ref, owns `srcObject` so a stream arriving after the element mounts still binds). **(2)** `react-hooks/set-state-in-effect` at **L478** — the standing release effect calls `stopStream()` (which `setStream(null)`) when leaving a capturing op; this is the privacy guarantee that a non-capturing op never holds the camera. Both are functionally correct and load-bearing for the camera lifecycle; "fixing" them risks regressing the self-view/release behaviour. `tsc` and Vitest are green; this is the only expected non-green in the lint sweep. Fix scope: medium — a careful camera-lifecycle refactor (e.g. an imperative ref-callback for `srcObject`, an external-store subscription for release) with the full monitor unit + e2e suite as the guard. Address by: a dedicated camera-lifecycle refactor, not a polish pass.
- **Preferences hub + device selection (feature-sized, ~009 range — not a polish chore)** (`deferred-feature` / `area:web`, from 008 US1 monitoring "allow camera" moment): give users a settings home for the choices that make the app feel finished — default camera, theme, and (later) language — replacing the bare "allow camera" prompt in monitoring with a proper device picker. **Scope (three parts):** **(1) Monitoring device selector** — reuse the calibration step's camera selector instead of the bare allow-camera prompt. Note: camera labels / the full device list are only exposed *after* `getUserMedia` permission, so the picker populates **post-permission** (flow: allow → `enumerateDevices` → pick → start, or pick-triggers-allow). **(2) Account → Preferences section** holding: **Default camera** — persisted **per user** as a `deviceId`, with a **graceful fallback when the saved device isn't present** (deviceIds vary across machines/browsers — don't hard-fail); **Theme** — three-state light / dark / **system** (system follows `prefers-color-scheme` via the existing `useMediaQuery` hook, driving the `.dark` class); **Language** — UI slot added now, wired only when i18n lands (currently backlogged) and **must not block the rest**. **Constraints:** per-user settings persistence must stay **RLS-as-user, no service-role key** (existing security posture); the theme + camera parts are **independent of i18n** and can ship before the Arabic/RTL targeting decision. Suggested issue labels (for the future issues migration): `type:feature`, `area:web`. Fix scope: feature-sized. Address by: ~feature 009.
