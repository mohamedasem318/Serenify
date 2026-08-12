# Triage recon — full open-issue catalogue (2026-08-10)

Read-only recon of all **74 open issues** as of 2026-08-10. Nothing was fixed, closed,
relabelled, or edited in this run. Verdicts verified against current `main` code, BACKLOG,
DECISIONS, PROGRESS, and the constitution Principle VIII roadmap.

## Summary table

| # | Title (short) | Verdict | Disposition | Blocking |
|---|---|---|---|---|
| 34 | OTP submit button stale-render flake | stale as written | close — won't do | no |
| 35 | Revert to jsdom + `.ts` Vitest config | still real | cheap | no |
| 36 | Re-triage postcss XSS advisory | already fixed | — | no |
| 37 | HMR WebSocket spam at 127.0.0.1:3000 | still real | cheap | no |
| 39 | Dedicated `/verify-otp` route | still real | close — won't do | no |
| 41 | Wire `test:seed:integration` into CI | still real | expensive | no |
| 42 | Friendly error when local Supabase unreachable | still real | cheap | no |
| 43 | `/onboarding` visual regression untestable | still real | cheap | no |
| 44 | Avatar disc washed-grey in dark mode | still real | cheap | no |
| 45 | Mobile/tablet responsive typography pass | stale as written | expensive | no |
| 46 | `--color-muted` fails WCAG AA (light) | already fixed | — | no |
| 47 | Button-system character + variant cleanup | still real | cheap | no |
| 49 | Restore cursor:pointer on clickable surfaces | still real | cheap | no |
| 51 | Dynamic welcome-banner subtitle variants | still real | cheap | no |
| 52 | Live notification preferences on `/app/account` | stale as written | expensive | no |
| 53 | Welcome greeting is server-timezone-bound | still real | cheap | no |
| 54 | Playwright matrix `\| tail` deadlock helper | still real | cheap | no |
| 55 | Dev-server memory bloat across suite runs | still real | cheap | no |
| 56 | Non-dismissible confirmation notifications | already fixed | — | no |
| 57 | Forward-looking auth-broadcast guard | still real | cheap | no |
| 58 | "Send a new confirmation" link contrast | already fixed | — | no |
| 59 | Extend ST-9 to assert recovery e2e | still real | cheap | no |
| 60 | Invite audit log | unclear | — | no |
| 61 | Concurrent-duplicate-invite idempotency | unclear | — | no |
| 62 | Gate `/signup` to invite-only | still real | absorbed by 019-admin-dashboard | no |
| 63 | App-layer rate limiter | still real | absorbed by 019-admin-dashboard | no |
| 64 | Onboarding name step redundant | stale as written | cheap | no |
| 65 | Cross-device anchor + auth sync (realtime) | still real | expensive | no |
| 66 | Verify mobile calibration on real prod HTTPS | still real | cheap | no |
| 67 | Safari-desktop + iOS-Safari smoke cells | stale as written | cheap | no |
| 68 | Camera device selection not saved | already fixed | — | no |
| 69 | e2e hardening — mock-driven coverage | still real | expensive | no |
| 70 | Design-system token pass (pointer) | still real | expensive | no |
| 71 | Store `anchor_extraction_version` | still real | expensive | no |
| 72 | Extraction-vs-notebook fidelity check | already fixed | — | no |
| 76 | Internationalization — Arabic (RTL) / French | still real | expensive | no |
| 77 | Recorder mime: webm + fMP4 feature-detect | already fixed | — | no |
| 79 | Smoothing buffer session affinity | still real | expensive | no |
| 80 | Dev `--reload` breaks live bloom | still real | close — won't do | no |
| 81 | Live-bloom durability | still real | expensive | no |
| 82 | Team-lead coarse-aggregate read path | still real | absorbed by 017-team-lead-dashboard | no |
| 83 | Capture route × 3 camera-policy touchpoints | still real | cheap | no |
| 84 | US4 ambient trend view + feel/precise toggle | still real | expensive | no |
| 85 | Stale 30s `window_eval_config` in metadata | still real | cheap | no |
| 86 | Retention: 90-day `window_readings` purge | still real | expensive | no |
| 88 | Preferences hub + monitoring device selection | still real | absorbed by 016-preferences-hub | no |
| 90 | Headline escalation arc collapses to peak | still real | cheap | no |
| 91 | Cross-pod recovery clause is time-neutral | still real | cheap | no |
| 92 | Collapse "a little tense" to a single word | still real | cheap | no |
| 100 | Absent vs present-but-low-confidence | still real | cheap | no |
| 123 | Small-team aggregate anonymization | still real | absorbed by 017-team-lead-dashboard | **yes** |
| 128 | STRESS_TENSE_BAND uncalibrated | still real | expensive | no |
| 136 | Tense-senior budget silences prompts | still real | cheap | no |
| 139 | Repoint local `apps/api/.env` to cloud | still real | cheap | no |
| 145 | Azure production has no IaC | still real | expensive | no |
| 152 | 017/018 privacy-controls ordering cost | still real | absorbed by 018-privacy-controls-and-transparency | no |
| 174 | Restore `POST /api/admin/invite` | still real | absorbed by 019-admin-dashboard | no |
| 176 | Dependabot: 21–22 open alerts | stale as written | cheap | no |
| 177 | WebKit Playwright hangs on Windows | still real | expensive | no |
| 185 | Blocked team photo — no placeholder | still real | cheap | no |
| 187 | cold-start spec fights next-themes | still real | cheap | no |
| 192 | failOpen() unobservable | still real | expensive | no |
| 193 | Landing `/` stays force-dynamic (watch) | still real | close — won't do | no |
| 195 | Terms gate absent from onboarding layout | still real | expensive | no |
| 196 | T146 review follow-ups (six items) | still real | cheap | no |
| 198 | 39 bare "check-in" uses in shipped copy | still real | cheap | no |
| 205 | Onboarding gate skips POSTs (accepted) | still real | close — won't do | no |
| 208 | `service_role` has no DML — e2e/seeders dead | still real | expensive | no |
| 213 | Proxy swallows /terms + /privacy mid-onboarding | still real | cheap | no |
| 214 | Camera consent gate links to nothing | still real | expensive | no |
| 218 | hosted-email-template-sync SyntaxError (Windows) | still real | cheap | no |
| 244 | Camera prompt reappeared mid-session (prod) | still real | cheap | no |
| 252 | Opening Ren full-page leaves session indeterminate | still real | cheap | no |
| 253 | Readings ~19s apart vs 10s stride | still real | cheap | no |

Verdict counts: 59 still real · 6 stale as written · 7 already fixed · 2 unclear.
Blocking: **1** (#123).

## Per-issue detail

### #34 — OTP submit button transient stale-render flake
- **Plain English**: A one-time early report said the "submit" button on the code-entry screen sometimes stayed greyed out. That screen no longer has a submit button at all — it submits automatically when the code is complete.
- **Verdict**: stale as written — the described UI element no longer exists; feature 007's redesign replaced the single-input-plus-button form with six auto-advancing, auto-submitting digit boxes.
- **Disposition**: close — won't do (nothing left to fix).
- **Blocking**: no.
- **BACKLOG drift**: ok (`docs/BACKLOG.md:92`, `(#34)` present) — the BACKLOG entry is equally stale and should be closed alongside.
- **Evidence**: `apps/web/components/ui/auth/otp-panel.tsx:74-79` ("auto-submits the moment all six digits are present … there is no separate submit button"); redesign commit `0b71d4a` (PR #22).

### #35 — Revert to jsdom + `.ts` Vitest config after Node upgrade
- **Plain English**: The automated-test setup still uses a workaround needed for an older JavaScript engine version; the newer version that would let the team remove it hasn't been adopted.
- **Verdict**: still real.
- **Disposition**: cheap (bump Node, rename config, swap dep — matches BACKLOG's own scope note).
- **Blocking**: no.
- **BACKLOG drift**: ok (`docs/BACKLOG.md:101-110`, `(#35)` present).
- **Evidence**: `apps/web/vitest.config.mts:1,10` (still `.mts`, still `happy-dom`); `.github/workflows/ci.yml:85` still pins `node-version: 22.11.0`.

### #36 — Re-triage postcss XSS advisory (GHSA-qx2v-qp2m-jg93)
- **Plain English**: An old security warning about a styling library used at build time has been resolved by later library updates and no longer appears as an active alert.
- **Verdict**: already fixed — the advisory is absent from the repo's live Dependabot alerts (queried 2026-08-10, 64 total), and resolved postcss 8.5.14 is past the advisory's range.
- **Disposition**: —.
- **Blocking**: no.
- **BACKLOG drift**: ok (`docs/BACKLOG.md:112-119`, `(#36)` present) — entry still carries the original "watch" framing; the issue can be closed.
- **Evidence**: `gh api …/dependabot/alerts --paginate` → no `GHSA-qx2v-qp2m-jg93`; `package-lock.json:3589` `"postcss": "^8.5.10"` → 8.5.14.

### #37 — HMR WebSocket failures spam console at 127.0.0.1:3000
- **Plain English**: When a developer opens the dev site via a specific address instead of "localhost", live-reload breaks and floods the browser console with errors. Real users are unaffected.
- **Verdict**: still real.
- **Disposition**: cheap (one-line array addition).
- **Blocking**: no.
- **BACKLOG drift**: ok (`docs/BACKLOG.md:121-131`, `(#37)` present).
- **Evidence**: `apps/web/next.config.ts:105-114` — `allowedDevOrigins` lists only `"192.168.100.11"`, not `127.0.0.1`.

### #39 — Dedicated `/verify-otp` route
- **Plain English**: The one-time-code entry lives inline on the signup and password-reset pages rather than at its own address — an architectural nicety, not a bug.
- **Verdict**: still real (the gap exists).
- **Disposition**: close — won't do (issue's own bar was "only if a use case emerges"; none has through 013).
- **Blocking**: no.
- **BACKLOG drift**: ok (`docs/BACKLOG.md:140`, `(#39)` present).
- **Evidence**: no `verify`/`otp` route under `apps/web/app/`; OTP entry remains inline via `apps/web/components/ui/auth/otp-panel.tsx` embedded in signup/forgot-password forms.

### #41 — Wire `test:seed:integration` into CI (Supabase-in-CI)
- **Plain English**: A set of database-seeding tests only ever runs on one developer's machine, never automatically, because the shared build pipeline has no database to test against.
- **Verdict**: still real.
- **Disposition**: expensive (new CI workflow with a Supabase service + migrations-on-PR).
- **Blocking**: no.
- **BACKLOG drift**: ok (`docs/BACKLOG.md:167`, `(#41)` present; cross-ref at :1679).
- **Evidence**: `.github/workflows/` holds only `ci.yml`, `publish-api-image.yml`, `sync-email-templates.yml`; no workflow references `SUPABASE_INTEGRATION` or `test:seed:integration`.

### #42 — Friendly error when local Supabase is unreachable
- **Plain English**: When the demo-account script can't reach the database it shows a raw technical error instead of a plain message saying what's wrong and how to fix it.
- **Verdict**: still real.
- **Disposition**: cheap (~20 lines, one file).
- **Blocking**: no.
- **BACKLOG drift**: ok (`docs/BACKLOG.md:192-199`, `(#42)` present).
- **Evidence**: `scripts/seed-demo.ts:159-160` propagates raw errors to the `.catch` at :212-214; no `ECONNREFUSED`/friendly-message handling anywhere in `scripts/`.

### #43 — `/onboarding` visual regression untestable on completed accounts
- **Plain English**: There's no easy way to look at the account-setup screen for testing, because every seeded demo account has already finished setup and the app skips the screen for them.
- **Verdict**: still real.
- **Disposition**: cheap (extend `scripts/seed-demo.ts` with a reset option or a pristine slot).
- **Blocking**: no.
- **BACKLOG drift**: ok (`docs/BACKLOG.md:213`, `(#43)` present).
- **Evidence**: `apps/web/proxy.ts:16-18,242-246` (redirect guard unchanged); `scripts/seed-demo.ts` has no reset/pristine logic.

### #44 — Avatar disc reads washed-grey in dark mode
- **Plain English**: In dark mode a user's initials-avatar circle nearly vanishes into the background instead of standing out like the app's other accents.
- **Verdict**: still real — and measurably flatter than when filed (~1.09:1 self-vs-bg under current Graphite tokens vs the ~1.2:1 originally measured).
- **Disposition**: cheap.
- **Blocking**: no.
- **BACKLOG drift**: ok (`docs/BACKLOG.md:233`, `(#44)` present) — entry cites pre-redesign hex values (stale text), but the problem persists under the new tokens.
- **Evidence**: `apps/web/components/account/profile-section.tsx:107` and `apps/web/components/header/profile-dropdown.tsx:53` still `bg-surface text-foreground border-border`; dark tokens `#181B1E` vs `#101214` (`globals.css:169-171`).

### #45 — Mobile/tablet responsive typography pass
- **Plain English**: Body text and labels feel small and cramped on phones and tablets; the real fix is a size scale that adapts to screen size, not a few overrides.
- **Verdict**: stale as written — should now say: feature 007 already bumped base body text to 17px and `text-xs` to 13px globally, but there is still no viewport-stepped/fluid scale, and the heavily-used 14px `text-sm` was deliberately left unchanged.
- **Disposition**: expensive (the ask is a 360/600/900px audit plus a fluid `clamp()` scale — a real design pass).
- **Blocking**: no.
- **BACKLOG drift**: ok (`docs/BACKLOG.md:253`, `(#45)` present; paired with #178 at :2405).
- **Evidence**: `apps/web/app/globals.css:74-76` (`--text-xs: 0.8125rem`, `--text-base: 1.0625rem`; comment notes sm/lg/… "already equal the locked values"); no `clamp()` anywhere in `globals.css`.

### #46 — `--color-muted` fails WCAG AA on light bg
- **Plain English**: Secondary grey text used to be too faint to read comfortably in light mode. It has since been darkened and now passes accessibility standards.
- **Verdict**: already fixed — feature 007's Graphite re-skin changed the token; current value computes ≈5.58:1 against the light background, clearing AA (4.5:1).
- **Disposition**: —.
- **Blocking**: no.
- **BACKLOG drift**: ok (`docs/BACKLOG.md:272`, `(#46)` present) — text still cites the old `#6E7572` value; the issue can be closed.
- **Evidence**: `apps/web/app/globals.css:31` (`--color-muted: #585D61`) vs `--color-bg: #EAEBEC` (:28); commit `0b71d4a` (PR #22).

### #47 — Button-system character + variant cleanup
- **Plain English**: Buttons are readable but undifferentiated — most notably "Sign out", which ends your session, looks identical to an ordinary save button.
- **Verdict**: still real, partially superseded — two of four sub-items (ghost/outline dark-hover contrast; "unused in production") were resolved by feature 007; the core Sign-out-weight ask and the sub-AA `link` variant remain.
- **Disposition**: cheap.
- **Blocking**: no.
- **BACKLOG drift**: drift — issue/BACKLOG still describe ghost/outline as unfixed and unused in production; both false since 007 (see Evidence).
- **Evidence**: `apps/web/components/ui/button.tsx:29-30,54-60` (contrast fixed in `0b71d4a`); ghost/outline used at `apps/web/app/(onboarding)/layout.tsx:44`, `terms-reconsent-screen.tsx:204`, `anchor/*`; `sign-out-section.tsx:20` still `variant="secondary"`; `link` variant ≈4.22:1, unused.

### #49 — Restore cursor:pointer on Link/clickable surfaces
- **Plain English**: Hovering most links (navbar, profile menu, mobile menu) shows the plain arrow cursor instead of the pointing finger, though real buttons already behave correctly.
- **Verdict**: still real.
- **Disposition**: cheap.
- **Blocking**: no.
- **BACKLOG drift**: ok (`docs/BACKLOG.md:425`, `(#49)` present).
- **Evidence**: `apps/web/components/ui/button.tsx:8` has `cursor-pointer` (button half done); no `a[href]` rule in `globals.css`; `header.tsx:43`, `center-nav.tsx:43`, `profile-dropdown.tsx:70` lack the class.

### #51 — Dynamic welcome-banner subtitle variants
- **Plain English**: The home-page greeting always shows the same fixed subtitle; a version that varies with context was planned but never built.
- **Verdict**: still real.
- **Disposition**: cheap — the component's own doc says the subtitle constant is the only edit needed, and the stated precondition (signal data exists post-008) is long satisfied.
- **Blocking**: no.
- **BACKLOG drift**: ok (`docs/BACKLOG.md:568`, `(#51)` present).
- **Evidence**: `apps/web/components/home/welcome-banner.tsx:29-32,57` — hardcoded `SUBTITLE`, no variant logic.

### #52 — Live notification preferences on `/app/account`
- **Plain English**: The Notifications section of account settings is still a placeholder saying preferences aren't available yet. There is no way to control how the app notifies you.
- **Verdict**: stale as written — the core ask is still unbuilt, but the issue's premise that the notification surface "is not mounted by any production code" is now false: feature 012's confirmatory prompt mounts it in production. It should say: surface mounted, preferences UI still missing.
- **Disposition**: expensive (schema + Server Action + form per BACKLOG's own scope). Adjacent to `016-preferences-hub` but that slot's scope (#88) doesn't include notification channels.
- **Blocking**: no.
- **BACKLOG drift**: ok (`docs/BACKLOG.md:589`, `(#52)` present) — the "not mounted" staleness exists equally in both, not a divergence between them.
- **Evidence**: `apps/web/components/account/notifications-placeholder.tsx:25-28`; `apps/web/components/questionnaire/confirmatory-prompt.tsx` mounted from `monitoring-session.tsx`.

### #53 — Welcome-banner greeting is server-timezone-bound
- **Plain English**: The "Good morning / afternoon / evening" greeting uses the server's clock, not the visitor's, so someone in a distant timezone can see a greeting that doesn't match their local time of day.
- **Verdict**: still real.
- **Disposition**: cheap (single component; client-side timezone read or cookie).
- **Blocking**: no.
- **BACKLOG drift**: ok (`docs/BACKLOG.md:608`, `(#53)` present).
- **Evidence**: `apps/web/components/home/welcome-banner.tsx:33-36` — `greetingFor(date)` on server-local time, unchanged since feature 003.

### #54 — Playwright matrix `| tail` pipe-buffering deadlock helper
- **Plain English**: Running the full browser-test suite through a common shell pattern silently hangs due to output buffering; a helper script to avoid the trap was never built.
- **Verdict**: still real.
- **Disposition**: cheap (small script + one npm-script entry).
- **Blocking**: no.
- **BACKLOG drift**: ok (`docs/BACKLOG.md:632`, `(#54)` present).
- **Evidence**: no matrix helper in `scripts/`; no `test:e2e:matrix` in `apps/web/package.json`.

### #55 — Dev-server memory bloat + slowdown across stacked suite runs
- **Plain English**: Running the browser-test suite repeatedly without restarting the local server makes it slower and heavier each time, occasionally failing unrelated tests.
- **Verdict**: still real — the reused-dev-server condition that produces the leak is unchanged; no investigation has landed.
- **Disposition**: cheap (as scoped: a heap-snapshot investigation spike; the eventual fix may grow).
- **Blocking**: no.
- **BACKLOG drift**: ok (`docs/BACKLOG.md:668`, `(#55)` present).
- **Evidence**: `apps/web/playwright.config.ts:32-35` (`reuseExistingServer: !process.env.CI`); only the original observation commit `642fa09` in history.

### #56 — Non-dismissible stress-detection confirmation notifications
- **Plain English**: The "we noticed you might be stressed — are you okay?" prompt should only close via its own Dismiss button, not Escape or an outside click. This has been built and shipped.
- **Verdict**: already fixed — `dismissible={false}` support shipped with feature 012 (commit `636a7fc`, PR #125) and is used by the confirmatory prompt.
- **Disposition**: —.
- **Blocking**: no.
- **BACKLOG drift**: drift — `docs/BACKLOG.md:706` carries `(#56)` but is not marked resolved and the issue is still open: a fixed-but-not-closed-out case against the BACKLOG↔Issues contract.
- **Evidence**: `apps/web/components/notification.tsx:38-40,122-128,202`; `apps/web/components/questionnaire/confirmatory-prompt.tsx:41` (`dismissible={false}`).

### #57 — Forward-looking guard for auth-broadcast coverage
- **Plain English**: Nothing automatically stops a future change from silently breaking the mechanism that keeps login state consistent across multiple open tabs; today only human memory catches it.
- **Verdict**: still real.
- **Disposition**: cheap (grep-based CI check per the issue's own first option).
- **Blocking**: no.
- **BACKLOG drift**: ok (`docs/BACKLOG.md:741`, `(#57)` present).
- **Evidence**: no `broadcastSignIn` reference in `.github/workflows/ci.yml`; no custom rule in `apps/web/eslint.config.mjs`; mechanism at `apps/web/lib/auth-broadcast.ts` unchanged.

### #58 — "Send a new confirmation" link contrast underweight (light)
- **Plain English**: A link shown when logging in before confirming your email used to be too faint in light mode. It reads fine now.
- **Verdict**: already fixed — the link uses the token feature 007 introduced for small green text on light backgrounds; computed ≈5.27:1 (≈4.66:1 inside its tinted box), both clearing AA.
- **Disposition**: —.
- **Blocking**: no.
- **BACKLOG drift**: ok (`docs/BACKLOG.md:774`, `(#58)` present) — text still describes the pre-fix state; the issue can be closed.
- **Evidence**: `apps/web/app/(auth)/login/login-form.tsx:119-121` (`text-meadow-text`); `globals.css:54`; commit `0b71d4a` (PR #22).

### #59 — Extend ST-9 to assert recovery submits password update e2e
- **Plain English**: The "forgot my password" test only checks that the form looks right and validates — it never confirms that submitting a new password actually works and lets you log back in.
- **Verdict**: still real.
- **Disposition**: cheap (extend the existing spec).
- **Blocking**: no.
- **BACKLOG drift**: ok (`docs/BACKLOG.md:792`, `(#59)` present).
- **Evidence**: `apps/web/tests/e2e/reset-password.spec.ts:1-14` ("UX-only coverage"); the only submit-a-password e2e (`employee-dashboard-shell.spec.ts:166-176`) is the in-app change, not the recovery flow.

### #60 — Invite audit log — record who invited whom
- **Plain English**: No record is kept of which admin invited which employee — and the invite feature it would log for doesn't currently exist at all.
- **Verdict**: unclear — the target endpoint was deleted (see #174), so there is nothing to verify the gap against; it becomes decidable when the invite path is rebuilt (naturally inside 019-admin-dashboard).
- **Disposition**: — (folds into the #174 rebuild).
- **Blocking**: no.
- **BACKLOG drift**: ok (`docs/BACKLOG.md:825`, `(#60)` present).
- **Evidence**: `apps/web/app/api/admin/invite/route.ts` absent; no `invite`-related table in `supabase/migrations/`.

### #61 — Concurrent-duplicate-invite idempotency
- **Plain English**: Two near-simultaneous invites for the same email used to make one fail ugly instead of cleanly — but the invite feature no longer exists, so the bug currently can't occur.
- **Verdict**: unclear — the bug lived entirely in the deleted endpoint; it can only be re-verified (or designed out) when that endpoint is rebuilt (naturally inside 019-admin-dashboard).
- **Disposition**: — (folds into the #174 rebuild; BACKLOG's own "Address by" already says this).
- **Blocking**: no.
- **BACKLOG drift**: ok (`docs/BACKLOG.md:848`, `(#61)` present).
- **Evidence**: `apps/web/app/api/admin/invite/route.ts` absent; issue explicitly paired with #174.

### #62 — Gate `/signup` to invite-only (open self-serve posture)
- **Plain English**: Anyone can sign themselves up as an employee without being invited — fine for a demo/thesis, unacceptable once real companies use the product. (Labelled `priority:blocker`, but that was adjudicated as a pre-production-launch bar, not a today bar.)
- **Verdict**: still real.
- **Disposition**: absorbed by 019-admin-dashboard (issue text says "pairs with feature 017 (admin-dashboard)" — that slot is `019-admin-dashboard` under current numbering).
- **Blocking**: no — explicitly adjudicated to stay open until a production-posture launch; no real tenant is live today (`docs/DECISIONS.md:5647` "#62 STAYS OPEN").
- **BACKLOG drift**: ok (`docs/BACKLOG.md:875`, `(#62)` present).
- **Evidence**: `supabase/config.toml:179,230` (`enable_signup = true`); `apps/web/proxy.ts:33` (`/signup` public); `signup/actions.ts:38-80` (no invite-token check).

### #63 — App-layer rate limiter (invite + profile writes)
- **Plain English**: Nothing stops someone from hammering the invite or profile-save features with rapid repeated requests; the platform's built-in limits don't fully cover these paths.
- **Verdict**: still real.
- **Disposition**: absorbed by 019-admin-dashboard — explicitly deferred until the invite endpoint has a real browser client, and that endpoint doesn't exist (#174).
- **Blocking**: no — issue's own rating: no reachable critical exploit today (invite admin-gated/deleted; profile writes self-scoped under RLS).
- **BACKLOG drift**: ok (`docs/BACKLOG.md:915`, `(#63)` present).
- **Evidence**: no rate-limiter code under `apps/web` (Server Actions, route handlers, `proxy.ts`).

### #64 — Onboarding name step is redundant with signup `full_name`
- **Plain English**: New users type their name at signup and are shown a name step again during setup — but contrary to the issue's framing, that second step already arrives pre-filled with their name, so the residual cost is one extra confirmation click, not re-typing.
- **Verdict**: stale as written — the pre-fill (the issue's suggested option (b)) has existed since before the issue was filed; only option (a), skipping the step entirely, remains open.
- **Disposition**: cheap (small conditional to skip when the name is already present).
- **Blocking**: no.
- **BACKLOG drift**: ok (`docs/BACKLOG.md:956`, `(#64)` present) — the BACKLOG shares the same stale "blank field" framing (staleness in both, not divergence).
- **Evidence**: `apps/web/app/(onboarding)/onboarding/onboarding-form.tsx:52` (`defaultValues` from `defaultFullName`); `page.tsx:44-47`; pre-fill commit `309e78d` (2026-05-21) predates the issue's "Observed 2026-05-27".

### #65 — Cross-browser/device anchor + auth sync (realtime push)
- **Plain English**: Signed in on two different browsers or devices, an action in one (finishing calibration, signing out) doesn't instantly update the other — it catches up only on refresh. No data is lost; a screen just looks stale.
- **Verdict**: still real.
- **Disposition**: expensive (BACKLOG: "medium-to-large (FEATURE work — a new transport, not a tweak)"); no roadmap slot owns it.
- **Blocking**: no — stale render, not stale data; same-browser multi-tab sync already works.
- **BACKLOG drift**: ok (`docs/BACKLOG.md:992`, `(#65)` present).
- **Evidence**: `apps/web/lib/auth-broadcast.ts:1-29` (still `localStorage`-only); no Realtime channel usage (`.channel(`/`postgres_changes`) anywhere in `apps/web`.

### #66 — Verify mobile camera→upload→anchor on real devices over HTTPS
- **Plain English**: The team wanted proof, on real phones against the real production site, that a phone-recorded calibration video uploads and processes correctly. It was proven once on an iPhone through a temporary test tunnel — never on production itself, and never on any Android phone.
- **Verdict**: still real — the entry's own close-criterion (production HTTPS, ≥1 real iOS + ≥1 real Android) is unmet for the calibration path; the recent real-iPhone-against-production work (#89, PRs #243/#247/#250) covered the monitoring path and raises confidence without satisfying it.
- **Disposition**: cheap (verification-only; production is live, no code change).
- **Blocking**: no — a verification gap, not a known failure.
- **BACKLOG drift**: ok (`docs/BACKLOG.md:1058-1067`, `(#66)` present; accurately says "STILL UNVERIFIED").
- **Evidence**: `docs/BACKLOG.md:1058-1067`; `docs/PROGRESS.md:24-52` (iPhone-vs-production proof is for monitoring, not calibration).

### #67 — Run Safari-desktop + iOS-Safari smoke cells (Apple hardware)
- **Plain English**: Two browser combinations were untestable for lack of Apple hardware when filed. iPhone testing has since happened extensively and passed; Safari on a Mac still has never been tested.
- **Verdict**: stale as written — the iOS half is substantially superseded by the 2026-08 real-iPhone validation (#89 resolved, PRs #243/#247/#250); it should now say only Safari desktop (ST-21) and the feature-006 coverage-gate's WebKit threshold cell remain.
- **Disposition**: cheap (a smoke run once macOS hardware is available).
- **Blocking**: no.
- **BACKLOG drift**: drift — BACKLOG/issue not updated for the 2026-08-08/10 iPhone validation; still reads as if ST-21 and ST-24 are equally open. `(#67)` present.
- **Evidence**: `specs/006-calibration-capture-quality/smoke-tests.md:55,81,97,122` (Safari/WebKit still deferred); `docs/PROGRESS.md:24-52` and the BACKLOG #89 entry.

### #68 — Camera device selection not always written to localStorage
- **Plain English**: Picking a different camera in the calibration device list didn't always save the choice, so the app could silently forget your preferred camera. Fixed: a camera is now remembered or forgotten based on whether it actually started successfully.
- **Verdict**: already fixed — shipped in feature 005 (commit `a6a9b19`, PR #17).
- **Disposition**: —.
- **Blocking**: no.
- **BACKLOG drift**: ok (`docs/BACKLOG.md:1108`, `(#68)` present) — no resolved note; the issue can be closed.
- **Evidence**: `apps/web/components/anchor/device-memory.ts:1-16` (docstring cites FR-045/DECISION-25/T029, write-only-on-actual-start); called from `anchor-recorder.tsx:454,547`.

### #69 — e2e hardening — mock-driven coverage masked real 004 bugs
- **Plain English**: Some browser tests use fake camera and network responses to run reliably, which means they can pass while the real feature is broken in ways only a human would notice. No "real behavior" safety-net tier was ever added.
- **Verdict**: still real.
- **Disposition**: expensive (real-token JWKS integration tier, cross-tab timing coverage, hard-navigation guard — new test infra).
- **Blocking**: no — a coverage-class gap; the named bugs were fixed at the time.
- **BACKLOG drift**: ok (`docs/BACKLOG.md:1127`, `(#69)` present).
- **Evidence**: no non-mocked JWKS-path spec exists; the two cross-tab specs predate the issue (feature 003/004-005 era, e.g. commit `17f9d26`); `measure-bounded-upload.spec.ts:62` is one incidental hard-nav instance, not the guard.

### #70 — Design-system token pass (feature-005 scope pointer, sub-item 3)
- **Plain English**: A tracking pointer bundling several visual-polish items (button styling, avatar color, mobile text size, link cursors) deferred from an early feature into one design pass.
- **Verdict**: still real — but its status note predates reality: feature 007 had already fixed one of its six items (#46) and half of another (#47) when the note claimed all six were unchanged-open.
- **Disposition**: expensive in aggregate (the #45 audit dominates; most sub-items are individually cheap). No 014–022 slot fits a cross-cutting token pass.
- **Blocking**: no.
- **BACKLOG drift**: drift — the 2026-06-24 status note ("all six … remain open … unchanged") is wrong for #46 (fixed) and half of #47; #44/#45/#49 and the Sign-out half of #47 remain genuinely open. `(#70)` present.
- **Evidence**: `docs/BACKLOG.md:1150`; `globals.css:31` and `button.tsx:29-30,54-60` (both fixed in `0b71d4a`).

### #71 — Store `anchor_extraction_version` for auto-invalidation
- **Plain English**: The app records which model version produced your calibration baseline, but not which version of the video-processing code — so a future processing change that breaks old baselines would not be flagged automatically.
- **Verdict**: still real.
- **Disposition**: expensive (new column → migration, plus wiring through anchor writes and the inference-time check).
- **Blocking**: no — the one known extraction change was handled manually and recorded; recent capture work was proven bit-identical.
- **BACKLOG drift**: ok (`(#71)` present).
- **Evidence**: `supabase/migrations/20260527000000_anchor_columns.sql` adds only `anchor_model_version`; no extraction/pipeline-version column anywhere in migrations or `apps/api`.

### #72 — End-to-end extraction-vs-notebook fidelity check (real clip)
- **Plain English**: The worry was that the live pipeline had never been checked against the original research notebook on a real recording. That check was run before the live-inference feature shipped and came back a perfect match, so the gap no longer exists.
- **Verdict**: already fixed — the go/no-go gate ran and passed, recorded at `specs/008-stress-inference-service/spec.md:200` ("bit-for-bit for CFR mp4 input") and relied on at `research.md:507` and `docs/BACKLOG.md:1550`. It is a documented one-time validation, not a committed re-runnable artifact (harnesses were gitignored, `.gitignore:117`), which matches the issue's own close-criterion ("go/no-go gate" before trusting live predictions — not a CI test). [Opus-verified after a first-pass `unclear`.]
- **Disposition**: — (residual doc-hygiene fix, if wanted: cheap).
- **Blocking**: no.
- **BACKLOG drift**: drift — `docs/BACKLOG.md:1203-1228` untouched since 2026-05-29, still asserts the chain "has NEVER run" on a real clip; issue still open. Bonus defect: `docs/DECISIONS.md:4283-4286` cites "PROGRESS 2026-06-20, MODEL_HANDOFF" — neither contains such a record; the real citation is the 008 spec line. `(#72)` present.
- **Evidence**: `specs/008-stress-inference-service/spec.md:200`; `research.md:507`; `.gitignore:117` (`.validation_*/`); only committed fidelity tests are synthetic (`test_lbp_interpolation_fidelity.py`) or mp4-vs-webm (`test_webm_vfr_fidelity.py`).

### #76 — Internationalization — Arabic (RTL) and possibly French
- **Plain English**: The app is English-only, with no Arabic or French version and no groundwork (like translation files) started to make one possible later.
- **Verdict**: still real — no i18n/locale/RTL work exists despite the issue's own advice to start message externalization at feature 008 (long since shipped).
- **Disposition**: expensive (feature-sized full retrofit; needs its own spec; no 014–022 slot owns it, and the thesis-scope decision was never made).
- **Blocking**: no.
- **BACKLOG drift**: ok (`docs/BACKLOG.md:1504-1536`, `(#76)` present).
- **Evidence**: zero matches for `*i18n*`/`*locale*`/`*rtl*` under `apps/web`.

### #77 — Recorder mime: support both webm + fMP4 (feature-detect)
- **Plain English**: The camera recorder needed to automatically pick a compatible video format per device instead of assuming one always works. This has since been built and shipped.
- **Verdict**: already fixed — `pickCaptureMimeType()` landed in commit `a5c8d3d` (PR #243, under the #89 umbrella): non-Apple engines try WebM first with an mp4 fallback, Apple WebKit goes straight to fMP4.
- **Disposition**: —.
- **Blocking**: no.
- **BACKLOG drift**: drift — the BACKLOG #78/#89 entries record the fix, but the `#77` line at `docs/BACKLOG.md:1542` is not marked resolved and the issue is still open. `(#77)` present.
- **Evidence**: `apps/web/lib/capture/constraints.ts:83-127`; commit `a5c8d3d` (PR #243).

### #79 — Smoothing buffer needs session affinity / shared cache (multi-worker)
- **Plain English**: The reading-smoothing system keeps its short-term memory in a single server process; if the backend ever ran multiple workers, a session could split across them and smoothing would misbehave.
- **Verdict**: still real.
- **Disposition**: expensive (infrastructure decision — shared cache or enforced affinity — tied to the deploy target).
- **Blocking**: no — production runs single-worker (`apps/api/Dockerfile:53,58`), so the failure mode isn't live; correctly `status:watch`.
- **BACKLOG drift**: ok (`docs/BACKLOG.md:1544`, `(#79)` present).
- **Evidence**: `apps/api/app/services/inference.py:75-122` (`_SessionBuffers` still module-level per-process, no shared cache anywhere in `apps/api`).

### #80 — Dev `--reload` leaves live bloom permanently "getting a read"
- **Plain English**: A developer-only quirk: running the backend with hot-reload restarts the server on every file save, endlessly resetting the "warming up" indicator during a test session — while readings still save correctly behind the scenes.
- **Verdict**: still real.
- **Disposition**: close — won't do (dev-only cosmetic; fingerprint + workaround documented; the real fix is the same shared-cache work tracked by #79/#81).
- **Blocking**: no.
- **BACKLOG drift**: ok (`docs/BACKLOG.md:1545`, `(#80)` present).
- **Evidence**: `apps/api/README.md:56-75` (documented workaround); `inference.py:75-122` (per-process buffer unchanged).

### #81 — Live-bloom durability (decouple from live-response delivery)
- **Plain English**: The live "how you're doing" indicator only updates when a scoring response happens to arrive in time; a slow or lost response, or a server restart, can freeze it even though the reading was saved.
- **Verdict**: still real.
- **Disposition**: expensive (spans backend buffer durability and frontend driving the bloom off polled data; deferred pending deploy-target architecture).
- **Blocking**: no — single-worker/single-instance production mitigates part (a) today; `status:watch` is right.
- **BACKLOG drift**: ok (`docs/BACKLOG.md:1546`, `(#81)` present).
- **Evidence**: `apps/api/Dockerfile:53,58`; `monitoring-session.tsx:712` (`getSessionTrend` feeds only the trend card, never the bloom — part (b) unbuilt).

### #82 — Team-lead coarse-aggregate read path + multi-range time selection
- **Plain English**: A future manager dashboard must show team stress trends only as safely blurred-together numbers across week/month/quarter/year ranges — never one person's raw data. This issue records that design constraint ahead of building it.
- **Verdict**: still real — nothing built; 008's safe posture (owner-only access, no manager read path) still holds.
- **Disposition**: absorbed by 017-team-lead-dashboard (org-wide half falls to 019-admin-dashboard).
- **Blocking**: no.
- **BACKLOG drift**: drift — the GitHub issue still carries pre-renumbering slots ("Feature 016 (team-lead dashboard) … the admin / feature 017"); `docs/BACKLOG.md:1547` was updated to 017/019 but the issue mirror never resynced. `(#82)` present.
- **Evidence**: no manager/stress-band rollup function in `supabase/migrations/`; `team-lead-seeded.spec.ts:9` is `test.skip`.

### #83 — Capture route must register in all 3 camera-policy touchpoints
- **Plain English**: Every new camera-using page must be added to three separate configuration lists or the camera silently fails even after permission is granted. All current pages are registered; nothing guards the next one.
- **Verdict**: still real — the historical defect is fixed; the asked-for regression guard does not exist.
- **Disposition**: cheap (one unit test asserting the two route lists stay in lockstep).
- **Blocking**: no — all three touchpoints currently agree for all capture routes.
- **BACKLOG drift**: ok (`docs/BACKLOG.md:1548`, `(#83)` present).
- **Evidence**: `apps/web/next.config.ts:103,129` and `apps/web/proxy.ts:79` list the same three routes; no test references `CAPTURE_ROUTES`/`isCaptureRoute`.

### #84 — US4 ambient trend view + feel/precise toggle
- **Plain English**: An optional softer "mood weather" visual for the daily trend, as an alternative to the precise line chart, was deliberately postponed and never built.
- **Verdict**: still real.
- **Disposition**: expensive (a second trend representation + toggle + persisted preference + its own a11y/responsive/test coverage; no 014–022 slot owns it).
- **Blocking**: no.
- **BACKLOG drift**: drift — issue says "Address by: post-demo, after feature 010"; `docs/BACKLOG.md:1549` says "after feature 011" (post-renumbering update never resynced to the issue). Practically moot — both shipped. `(#84)` present.
- **Evidence**: no second trend representation or toggle in `apps/web/components/home/`; `specs/` confirms 010 and 011 both merged.

### #85 — Annotate/remove stale 30s `window_eval_config` in model metadata
- **Plain English**: A leftover block inside the trained model's paperwork still describes an old, unused 30-second measurement window instead of the real 60-second one — confusing documentation, invisible to users.
- **Verdict**: still real.
- **Disposition**: cheap (a one-line stale-block note in `docs/MODELS.md`).
- **Blocking**: no — the production 60s/10s window is locked by constitution Principle II regardless.
- **BACKLOG drift**: ok (`(#85)` present).
- **Evidence**: `packages/ml-video/models/metadata.json:3095-3104` (untouched `window_duration_sec: 30` block); no stale-flag note in `docs/MODELS.md`.

### #86 — Retention: 90-day `window_readings` purge job
- **Plain English**: The privacy policy states camera-based stress readings are kept for 90 days, but no automated deletion process exists yet, so data will silently accumulate past that window as the product ages.
- **Verdict**: still real.
- **Disposition**: expensive (natural implementation is `pg_cron` → migration; an external scheduler is the non-migration alternative, also unbuilt).
- **Blocking**: no — the shipped privacy copy explicitly discloses the gap ("that is a policy, not a mechanism. No purge job runs on a schedule today"), so users are informed, not misled. Becomes a live legal exposure if the copy ever hardens into a promise before the job exists.
- **BACKLOG drift**: ok (`(#86)` present; entry explicitly "unslotted — not owned by any planned feature").
- **Evidence**: `apps/web/lib/legal/copy.ts:414-418` (`PRIVACY_RETENTION_P2` disclosure); no purge/`pg_cron` job anywhere under `supabase/`.

### #88 — Preferences hub + monitoring device selection
- **Plain English**: There is no settings page for basics like which camera or theme to use — the app always uses whatever it started with, with no way to save a preference. Monitoring sessions can't even pick a camera (calibration can).
- **Verdict**: still real.
- **Disposition**: absorbed by 016-preferences-hub.
- **Blocking**: no.
- **BACKLOG drift**: ok (`docs/BACKLOG.md:1553`, `(#88)` present, word-for-word match).
- **Evidence**: `monitoring-session.tsx:513` calls `captureVideoConstraints()` with no `deviceId`; the calibration picker (`components/anchor/device-picker.tsx`) is not reused; no `*preference*` file in `apps/web`.

### #90 — Headline escalation arc (a-little-tense→tense) collapses to peak
- **Plain English**: If someone's day went from mildly tense to fully tense, the day summary mentions only the tense peak and drops the mild start — while the calm-to-tense direction does get both parts. A wording inconsistency, not a data problem.
- **Verdict**: still real.
- **Disposition**: cheap (one branch addition in an existing function).
- **Blocking**: no.
- **BACKLOG drift**: ok (`docs/BACKLOG.md:1560`, `(#90)` present).
- **Evidence**: `apps/web/lib/api/monitoring-reads.ts:320-371` — the arc branch (:357) only looks for an `at_ease` opener; an `a_little_tense` opener before a `tense` peak falls through to the plain-peak branch (:371).

### #91 — Cross-pod recovery clause is time-neutral
- **Plain English**: When the app says your stress peaked and then eased, it names the time of day for the peak but never for the easing, even when that clearly happened at a different part of the day.
- **Verdict**: still real.
- **Disposition**: cheap.
- **Blocking**: no.
- **BACKLOG drift**: ok (`docs/BACKLOG.md:1561`, `(#91)` present).
- **Evidence**: `apps/web/lib/api/monitoring-reads.ts:353` — the eased clause never interpolates a part-of-day; only `peakPod` is named (:343).

### #92 — Copy: collapse "a little tense" to a single word
- **Plain English**: The daily summary calls a moderately stressful day "a little tense" — a two-word phrase where every other stress level uses one word. No replacement word has been chosen.
- **Verdict**: still real.
- **Disposition**: cheap.
- **Blocking**: no.
- **BACKLOG drift**: ok (`docs/BACKLOG.md:1562`, `(#92)` present).
- **Evidence**: `apps/web/lib/api/monitoring-reads.ts:268,294,342` still emit `"a little tense"` / `"held a little tense"`.

### #100 — Live monitor: distinguish 'not in frame' from 'couldn't get a clear read'?
- **Plain English**: Stepping away from the camera during a monitoring session sometimes gets the correct "step back into frame" message and sometimes a vague "something went wrong on our end" — the same action produces two different messages.
- **Verdict**: still real — the pipeline *can* distinguish but by design doesn't always: the live chip only refines the cause when one signal crosses a 35%-of-frames threshold, and the recap trend never distinguishes because its out-of-frame flag defaults off and nothing enables it.
- **Disposition**: cheap (recap half is a one-line flag flip; live half is a tunable threshold).
- **Blocking**: no — vague copy, not wrong data.
- **BACKLOG drift**: ok (`docs/BACKLOG.md:1579-1599`, `(#100)` present).
- **Evidence**: `apps/web/lib/session-trend-geometry.ts:446-447`; `session-trend.tsx:225` (`showOutOfFrameFoggy` never `true`); `lib/face-detect/cause-telemetry.ts:46-52` (`CAUSE_MIN_RATIO = 0.35`); `monitoring-session.tsx:371-374`.

### #123 — Harden work-environment feedback aggregate anonymization for small teams
- **Plain English**: The weekly work-environment check-in summary shows a manager their team's combined answers, but for a very small team the "combined" answer is really one person's answer — so it isn't anonymous. Nothing currently stops a manager from seeing an individual's answer disguised as a team summary.
- **Verdict**: still real — the summary function computes the team headcount but never uses it to suppress small buckets (its own comment defers that to this issue).
- **Disposition**: absorbed by 017-team-lead-dashboard (BACKLOG: "Consume this in feature 017 when the manager aggregate is built") — **but see Blocking: the DB function is already deployed today, ahead of any UI**.
- **Blocking**: **yes** — the role-gated `SECURITY DEFINER` RPC is live in production with no headcount suppression, so any team_lead/admin session can call it directly (no UI needed) and retrieve sentiment/roadblock/support attributable to a single subordinate on a small team — violating constitution Principle I / Amendment 13 (anonymized-aggregate-only) today.
- **BACKLOG drift**: ok (`docs/BACKLOG.md:1694`, `(#123)` present); privacy policy discloses the control as "required… and not built" (`apps/web/lib/legal/copy.ts:687`).
- **Evidence**: `supabase/migrations/20260630000000_questionnaire_feedback.sql:341-399` (`v_sample_size` computed, unused for suppression; comment at :379-380 cites #123); `apps/web/lib/api/questionnaire-client.ts:296-319` (`getWeeklySummary` — forward contract, not yet called by production pages).

### #128 — STRESS_TENSE_BAND (0.70) is an uncalibrated hardcoded default
- **Plain English**: The line between "a little tense" and "tense" shown in the app is a guessed number, not data-derived like the main stress/not-stress cutoff — so the "tense" label may trigger slightly early or late.
- **Verdict**: still real.
- **Disposition**: expensive (needs an actual re-calibration pass over the trained model's validation folds, not a code edit).
- **Blocking**: no — display-only banding; the calibrated 0.53 operating point is unaffected.
- **BACKLOG drift**: ok (`(#128)` present).
- **Evidence**: `apps/api/app/config.py:75` (`stress_tense_band: float = 0.70`); no calibrated tense-band value in `packages/ml-video/models/metadata.json` or `docs/MODELS.md`.

### #136 — Tense-senior budget silences confirmatory prompts for the rest of a session
- **Plain English**: Answering a "you seem tense" question honestly during a monitoring session stops the app from asking again for the rest of that session, even if stress spikes again later. A deliberate design choice, tracked as watch.
- **Verdict**: still real (confirmed intentional, `status:watch`).
- **Disposition**: cheap (a cooldown/re-arm timer instead of a hard per-session lockout, once designed).
- **Blocking**: no — sessions auto-end after 5 minutes of face absence, so most users get a fresh budget anyway.
- **BACKLOG drift**: ok (`(#136)` present; text matches code exactly).
- **Evidence**: `apps/web/lib/questionnaire/confirmatory-trigger.ts:146-147` (tense answer burns both budgets); `components/monitor/presence-monitor.ts:25` (`AUTO_END_AFTER_MS = 300_000`).

### #139 — Supabase cloud migration — repoint local `apps/api/.env` (dev-only)
- **Plain English**: One developer's personal local configuration still points at an old local test database instead of the cloud one, causing confusing errors only if they mix their local backend with the live site. Real users unaffected.
- **Verdict**: still real.
- **Disposition**: cheap (three values in one untracked local file).
- **Blocking**: no — dev-workstation only; production repointed and smoke-tested 2026-07-12/13.
- **BACKLOG drift**: ok (`docs/BACKLOG.md:1828-1856`, `(#139)` present; accurately narrowed to the local remainder).
- **Evidence**: `apps/api/.env` (untracked) still `SUPABASE_URL=http://127.0.0.1:54321`.

### #145 — Azure production infrastructure has no IaC
- **Plain English**: If the cloud servers running the backend ever had to be rebuilt from scratch, nobody could do it from the code alone — it would mean manually following a document and re-typing configuration.
- **Verdict**: still real.
- **Disposition**: expensive (cross-cutting infra work, well beyond 1-2 files).
- **Blocking**: no — insurance against a low-probability event; production is live and healthy.
- **BACKLOG drift**: ok (`docs/BACKLOG.md:1862-1901`, `(#145)` present).
- **Evidence**: no `infra/`, `*.bicep`, or provisioning script anywhere in the repo.

### #152 — 017 ships hardcoded default visibility scopes; 018 retrofits employee privacy controls
- **Plain English**: A future manager dashboard will initially show a fixed default level of employee detail, with employee-facing controls arriving only in the follow-up feature. This issue records that accepted ordering trade-off so the earlier feature is built to not need rewriting.
- **Verdict**: still real (forward-looking tracking; neither feature exists yet).
- **Disposition**: absorbed by 018-privacy-controls-and-transparency (the issue's own acceptance criteria are "satisfied at 018").
- **Blocking**: no — nothing has shipped, so no live surface exhibits the behaviour.
- **BACKLOG drift**: ok (`docs/BACKLOG.md:1911`, `(#152)` present; slot numbers current).
- **Evidence**: `.specify/memory/constitution.md:407-409` (Amendment 16 ordering); no `017-*`/`018-*` folder in `specs/`.

### #174 — Restore `POST /api/admin/invite` — deleted in #142
- **Plain English**: There is no way inside the app for an admin to invite or promote someone as a manager or admin — the capability was deliberately removed for security and never rebuilt.
- **Verdict**: still real.
- **Disposition**: absorbed by 019-admin-dashboard.
- **Blocking**: no — a missing capability, not an active risk; no runtime service-role path exists, and a guard test would fail on any reintroduction.
- **BACKLOG drift**: ok (`docs/BACKLOG.md:2196-2301`, `(#174)` present).
- **Evidence**: `apps/web/app/api/admin/invite/route.ts` absent; `tests/unit/runtime-secret-posture.test.ts` guard; `admin-seeded.spec.ts:9` and `team-lead-seeded.spec.ts:9` both `test.skip`.

### #176 — Dependabot: 21–22 open alerts on main (next / postcss / sharp)
- **Plain English**: Automated scanning once flagged 21+ known weaknesses in third-party libraries; most were cleared by a framework update, leaving a handful.
- **Verdict**: stale as written — should now say: the Next.js bump (16.2.6 → 16.2.11, PR #180, merged 2026-07-28) cleared all 18 `next` alerts; only `postcss` (3 alerts, incl. new advisory `GHSA-fxqj-rqcc-2cmp`) and `sharp` (1) remain open.
- **Disposition**: cheap (bump the pinned versions).
- **Blocking**: no — remaining advisories are build-time or unreachable paths (`next.config.ts` defines no remote image patterns, so sharp never touches user-supplied images in production).
- **BACKLOG drift**: ok (`docs/BACKLOG.md:2161-2194`, `(#176)` present; the 2026-07-28 update already matches this state).
- **Evidence**: `apps/web/package.json:30` (`"next": "16.2.11"`); live alerts query 2026-08-10: all 9 `next` advisories `fixed`, postcss #66/#67/#75 + sharp #56 `open`; `docs/PROGRESS.md:718-719`.

### #177 — WebKit Playwright runner hangs on Windows
- **Plain English**: Automated tests can't run reliably against Safari-style browsers on Windows, so the "did we test in Safari" checklist is currently done by hand.
- **Verdict**: still real.
- **Disposition**: expensive (upstream diagnosis and/or a Linux CI runner; parked as a documented accepted gap).
- **Blocking**: no — coverage gap with a documented manual mitigation (real Safari/iOS device validation).
- **BACKLOG drift**: ok (`docs/BACKLOG.md:2304`, `(#177)` present).
- **Evidence**: `apps/web/playwright.config.ts:17,30` (webkit project still configured, `workers: 1`); no Playwright job in `.github/workflows/`.

### #185 — Blocked team photo leaves a large empty reserved box
- **Plain English**: If the team photo on the public homepage fails to load, visitors see a large empty rectangle with no cue that a photo belonged there; everything else on the page still works.
- **Verdict**: still real.
- **Disposition**: cheap (an error-driven styled fallback in one file, preserving the layout reservation).
- **Blocking**: no — cosmetic; the section stays fully functional when the photo is blocked (ST-14).
- **BACKLOG drift**: ok (`docs/BACKLOG.md:2494-2495`, `(#185)` present).
- **Evidence**: `apps/web/components/landing/team-photo.tsx:69-81` — no `onError` handler, no fallback UI.

### #187 — cold-start-readiness.spec.tsx fights next-themes for the dark class
- **Plain English**: One visual test checking dark-mode colors sometimes fails when the test machine is busy, even though the real dark-mode colors are fine — a flaky test, not a user-visible bug.
- **Verdict**: still real.
- **Disposition**: cheap (swap the manual class toggle for media emulation in one test file).
- **Blocking**: no.
- **BACKLOG drift**: ok (`docs/BACKLOG.md:2523`, `(#187)` present).
- **Evidence**: `apps/web/tests/layout/cold-start-readiness.spec.tsx:30-31` — manual `classList.toggle("dark", …)` right after `page.goto`, the exact race described.

### #192 — failOpen() is unobservable on Hobby
- **Plain English**: If the code that checks whether a user accepted the Terms silently breaks, the app only writes an error to a log nobody watches — there's no real alarm.
- **Verdict**: still real.
- **Disposition**: expensive (the proposed durable record of fail-open occurrences needs a migration).
- **Blocking**: no — deliberate, reasoned deferral; the gate itself works, and a lagging SQL detector covers the interim.
- **BACKLOG drift**: ok (`docs/BACKLOG.md:2761-2802`, `(#192)` present).
- **Evidence**: `apps/web/app/(authed)/layout.tsx:61-67` — still `console.error` only.

### #193 — Landing `/` stays `force-dynamic` (watch)
- **Plain English**: The public homepage is rebuilt fresh on every visit rather than pre-built — a deliberate trade-off to be revisited only if real-world load-time measurement disagrees, and no such measurement has been taken.
- **Verdict**: still real (state accurate; trigger condition never fired).
- **Disposition**: close — won't do (self-closing watch; the issue's own text says close as not-needed absent a TTFB number).
- **Blocking**: no.
- **BACKLOG drift**: ok (`docs/BACKLOG.md:2806-2832`, `(#193)` present).
- **Evidence**: `apps/web/app/(public)/page.tsx:42` (`force-dynamic` still present); `specs/013-public-surface-and-legal/research.md` §11.

### #195 — Terms/Privacy gate absent from `(onboarding)/layout.tsx` — FR-043c gap
- **Plain English**: The rule that nobody may use the app without accepting the Terms isn't enforced on the account-setup screens. Today it doesn't matter — every existing account has finished that step — but a future account created through a side door could slip past.
- **Verdict**: still real.
- **Disposition**: expensive — touches the documented FR-043c invariant, and the issue mandates a proven lockout-and-recovery exercise (ST-10 equivalent) against this gate before merge.
- **Blocking**: no — measured affected population is zero, and the camera-and-inference gate still fails closed for anyone reaching onboarding.
- **BACKLOG drift**: ok (`docs/BACKLOG.md:2834-2835`, `(#195)` present).
- **Evidence**: `apps/web/app/(onboarding)/layout.tsx` contains no consent read; `proxy.ts:246-254` gates onboarding only on `full_name IS NULL`.

### #196 — T146 review follow-ups: landing list semantics + five small items
- **Plain English**: A pre-launch review of the public site found six small, non-urgent issues — most notably that screen readers may not announce some marketing lists as lists — all deliberately logged rather than fixed before launch.
- **Verdict**: still real (all six unaddressed).
- **Disposition**: cheap — five are isolated single-file edits; the list-semantics item is cheap per file, with the issue itself recommending one app-wide pass (a scope call, not new invariants).
- **Blocking**: no.
- **BACKLOG drift**: ok (`docs/BACKLOG.md:2882-2912`, `(#196)` present).
- **Evidence**: no `role="list"` in `apps/web/components/landing/`; `user_consents.sql:111` comment still wrong; `team-photo.tsx:79` `sizes` still disagrees with `team-section.tsx:61`; nav predicates still diverge (`public-mobile-nav.tsx:61` vs `public-desktop-nav.tsx:64-65`).

### #198 — Dashboard says "Start check-in" while the Terms say "monitoring session"
- **Plain English**: The dashboard button that starts a webcam monitoring session is labelled "Start check-in" — a vaguer term than the Terms' careful distinction between a camera "monitoring session" and the text-based "weekly work-environment check-in" — so users can't tell from the button which very different thing they're starting. (The quoted bare "check-in" is exactly the banned terminology.)
- **Verdict**: still real (39 bare uses persist).
- **Disposition**: cheap (copy-only across ~half a dozen files; component/file names unchanged).
- **Blocking**: no — terminology consistency, not a legal exposure; the legal texts themselves use the correct terms.
- **BACKLOG drift**: **no matching BACKLOG entry** — only passing cross-references inside other entries (`docs/BACKLOG.md:2908,3024`); `docs/PROGRESS.md:225` confirms it was deliberately left, but the 1:1 BACKLOG mirror was never created.
- **Evidence**: `apps/web/components/home/today-view.tsx:65,68,93,119`; `components/home/todays-checkin-card.tsx:96,136-168`; `app/opengraph-image.tsx:101` ("Private check-ins for calmer workdays").

### #205 — Onboarding flow gate no longer applies to POSTs (accepted deliberately)
- **Plain English**: Due to a fix for an unrelated sign-out bug, someone who hasn't finished setup could hand-craft a request to trigger a couple of app actions slightly early — only against their own account, and no button in the app can do it. Filed so the consequence can't later read as an oversight.
- **Verdict**: still real (as framed: a knowingly accepted consequence).
- **Disposition**: close — won't do (the issue explicitly requests no action; every reachable action self-guards on identity).
- **Blocking**: no — writes stay within the acting user's own protected rows.
- **BACKLOG drift**: ok (`docs/BACKLOG.md:3105-3131`, `(#205)` present).
- **Evidence**: `apps/web/proxy.ts:218-220` (method guard); `components/consent/actions.ts:64-66` and chat actions both identity-guarded; commit `c1f6535` (#204).

### #208 — `service_role` has no DML on any `public` table
- **Plain English**: The end-to-end test runner and two developer setup scripts can't write to the local database because a required permission was never granted, so nobody can run the full test suite on their own machine. The live app is unaffected.
- **Verdict**: still real — live-confirmed as recently as 2026-08-05 (`docs/DECISIONS.md:7039`, Playwright globalSetup died on `42501`).
- **Disposition**: expensive (needs a migration, plus a decision whether seeders/tests should use service-role DML at all).
- **Blocking**: no — the service-role key never appears in runtime code; tooling-only.
- **BACKLOG drift**: ok (`docs/BACKLOG.md:3141`, `(#208)` present).
- **Evidence**: no `GRANT … TO service_role` in any of the 16 files under `supabase/migrations/`; `tests/e2e/setup/global-setup.ts:74-88` (the failing path); `docs/DECISIONS.md:7039`.

### #213 — Signed-in users mid-onboarding cannot open /terms or /privacy
- **Plain English**: A user who signed up but hasn't finished entering their name cannot open the Terms or Privacy Policy at all — the site bounces them back to the "finish setting up" screen, even though they accepted those documents minutes earlier.
- **Verdict**: still real.
- **Disposition**: cheap (a route exemption in the existing onboarding-gate condition; the issue's own-PR note is about blast radius and tests, not complexity).
- **Blocking**: no — the issue itself verifies nobody is ever asked to accept a document while unable to read it; this blocks re-reading, not blind consent.
- **BACKLOG drift**: ok (`docs/BACKLOG.md:3392-3441`, `(#213)` present).
- **Evidence**: `apps/web/proxy.ts:239,246-254` — the onboarding gate exempts only `/api/`; no `/terms`/`/privacy` exemption.

### #214 — Camera consent gate links to nothing
- **Plain English**: The screen asking permission to turn on your camera is supposed to point to the Privacy Policy for the details of who can see your data — but the actual screen contains no link anywhere, so that information can't be reached from there.
- **Verdict**: still real.
- **Disposition**: expensive — not just adding a link: the gate's copy contract requires any new visible string to ship with a consent-registry revision plus a recorded materiality judgment before code, enforced by a frozen snapshot test.
- **Blocking**: no — the Privacy Policy remains reachable via the public navbar/footer; a consistency gap, not suppression of a required disclosure.
- **BACKLOG drift**: ok (`docs/BACKLOG.md:3443-3471`, `(#214)` present).
- **Evidence**: `apps/web/components/consent/camera-consent-gate.tsx` — no `href`/link markup; `lib/consent/copy.ts:23-28` claims "this surface links to it"; contrast `terms-acknowledgement-field.tsx:115,125`.

### #218 — Windows: hosted-email-template-sync.test.ts fails to load (SyntaxError)
- **Plain English**: On Windows, one test file crashes before running, making a developer's local test results look worse than they are; the official cloud test run is unaffected.
- **Verdict**: still real.
- **Disposition**: cheap (same-root fixture or a test-runner path allowance — one file).
- **Blocking**: no.
- **BACKLOG drift**: ok (`docs/BACKLOG.md:3477`, `(#218)` present).
- **Evidence**: `apps/web/tests/unit/ops/hosted-email-template-sync.test.ts:13` — the outside-root `.mjs` import is unchanged; no config change in `vitest.config` addressing it.

### #244 — Monitoring session fell back to the camera prompt at 01:20 mid-session
- **Plain English**: Once in production, a monitoring session unexpectedly showed the initial "allow camera" screen again partway through, as if the camera feed died. It happened once and hasn't reproduced.
- **Verdict**: still real — no path from a live state back to the permission screen exists in the documented state machine, and no camera-track-ended handler exists, so the suspected cause remains untraced.
- **Disposition**: cheap (the issue's own scope: a read-only trace, then a targeted handler).
- **Blocking**: no — single unreproduced occurrence with a clean control run after.
- **BACKLOG drift**: ok (`docs/BACKLOG.md:3519`, `(#244)` present).
- **Evidence**: `apps/web/components/monitor/use-monitoring-session.ts:16-31,108-109`; no `track.onended` handler anywhere in the monitor components.

### #252 — Opening Ren outside the chat pill leaves the monitoring session indeterminate
- **Plain English**: Leaving the live monitoring screen by opening the full chat page (instead of the small chat popup) leaves the session in limbo — it neither cleanly stops nor keeps going, with no indication of what happened.
- **Verdict**: still real.
- **Disposition**: cheap (first step is read-only instrumentation of the teardown path, as scoped in the issue).
- **Blocking**: no — the camera is genuinely released locally; the ambiguity is server-side session state, a UX confusion.
- **BACKLOG drift**: ok (`docs/BACKLOG.md:3525`, `(#252)` present).
- **Evidence**: `apps/web/components/monitor/monitoring-session.tsx:750-752` (full navigation to `/app/chat`), `:804-813` (unmount stops camera/recorder locally but sends no end-session signal to the backend).

### #253 — Steady-state readings arrive ~19s apart against a 10s stride
- **Plain English**: During a monitoring session, readings appear roughly every 19 seconds instead of the intended 10, so a session produces about half the designed readings — but the gap doesn't grow, so nothing is degrading.
- **Verdict**: still real.
- **Disposition**: cheap — a deliberately parked throughput ceiling with three named options (overlap the client loop, cut server scoring cost, or make the stride honest); no migration or invariant.
- **Blocking**: no — reading density halved, not corrupted; explicitly an observation, `status:watch`.
- **BACKLOG drift**: ok (`docs/BACKLOG.md:3527`, `(#253)` present).
- **Evidence**: `apps/web/components/monitor/monitoring-session.tsx:339,406` — the upload loop awaits each submission and coalesces mid-flight windows; `docs/BACKLOG.md:1543` corroborates ~4.5s/window server cost.

## BACKLOG drift found

Hard drifts (issue ↔ BACKLOG ↔ reality disagree on substance or status):

1. **#198 — no BACKLOG entry at all.** Only passing cross-references (`docs/BACKLOG.md:2908,3024`); the 1:1 mirror rule (constitution Principle VIII) is violated. `docs/PROGRESS.md:225` shows it was known and deliberately deferred, but the entry was never created.
2. **#72 — fixed in reality, BACKLOG asserts the opposite.** `docs/BACKLOG.md:1203-1228` (untouched since 2026-05-29) still says the fidelity chain "has NEVER run" on a real clip; the gate ran and passed per `specs/008-stress-inference-service/spec.md:200`. Bonus: `docs/DECISIONS.md:4283-4286` carries a dangling citation ("PROGRESS 2026-06-20, MODEL_HANDOFF" — neither exists); the real citation is the 008 spec line.
3. **#56 — fixed (PR #125, commit `636a7fc`) but BACKLOG entry not marked resolved and issue still open.**
4. **#77 — fixed (PR #243, commit `a5c8d3d`) under the #89 umbrella; the #89 entry records it but the `#77` line (`docs/BACKLOG.md:1542`) was never marked resolved and the issue is open.**
5. **#82 — issue mirror carries pre-renumbering slots** ("feature 016 team-lead / feature 017 admin"); BACKLOG was updated to 017/019 but the issue never resynced.
6. **#84 — issue says "after feature 010", BACKLOG says "after feature 011"** (same resync failure; practically moot since both shipped).
7. **#67 — neither issue nor BACKLOG reflects the 2026-08 real-iPhone validation**; both still present ST-21 (Safari desktop) and ST-24 (iOS) as equally open when only the desktop half is.
8. **#70 — status note (2026-06-24) claims all six token-pass items unchanged-open**; #46 was already fixed and #47 half-fixed by feature 007 six days earlier.
9. **#47 — issue/BACKLOG still describe ghost/outline variants as contrast-broken and unused in production**; both false since feature 007.

Soft drifts (status not misleading, but the text describes pre-fix or pre-redesign state — worth a resolved/updated note when next touched): #34, #36, #44, #46, #58, #64, #68, #176.

Also mirrored-contract observation: the seven `already fixed` issues (#36, #46, #56, #58, #68, #72, #77) are all still open on GitHub — each closure needs the paired BACKLOG resolved-note in the same change per the contract. Not performed in this read-only run.
