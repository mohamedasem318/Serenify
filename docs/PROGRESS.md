# Serenify — Progress Log

Per-feature implementation log. Append-only, newest first.

---

## Fix — Navbar chrome: solid, sticky, and an exact active-state mirror

**Branch**: `fix/navbar-chrome-and-active-state`
**Status**: open — not yet merged.
**Date**: 2026-07-29
**Issues opened**: **#208**, **#209** (both pre-existing defects found while verifying; neither fixed here).

**What it does.** Four things, all chrome, none of them auth-aware:

1. **The public navbar becomes solid.** The inline
   `style={{ background: "color-mix(in srgb, var(--color-bg) 88%, transparent)" }}` and
   `backdrop-blur-md` are both removed in favour of the opaque `bg-bg` token the app header
   already used. Stickiness, `h-16` and `border-b border-border` are kept. This **reverses
   part of the 2026-07-28 decision** that introduced the translucency from the landing mock.
2. **The app header becomes sticky** — `sticky top-0 z-50` on `components/header/header.tsx`,
   matching the public navbar in both directions. It was already `bg-bg` and `h-16`;
   `app/(authed)/layout.tsx` is untouched.
3. **The two destination rows become one treatment.** `public-desktop-nav.tsx` and
   `center-nav.tsx` now carry a **character-identical** 124-byte class string. The public
   row loses its underline, `text-muted` resting colour, `rounded-control` and custom focus
   ring; `CenterNav` is **raised from `h-9` to `h-11`** so both satisfy FR-053's 44 px floor.
4. **The legal contents rail stops sliding under the bar.** `lg:top-8` → `lg:top-20`
   (at 32 px it parked under the 64 px navbar with "Contents" entirely hidden), and its
   `lg:max-h` reserve tracks the new offset. The sections' `scroll-mt-8` is **unchanged** —
   raising it to `scroll-mt-20` was tried and reverted after measuring: it pushed the
   anchored heading from 71.6 px to 119.6 px below the bar. `scroll-padding-top` clears the
   bar, `scroll-mt-*` is breathing room, and `globals.css` now says so at the declaration.

**The direction of the mirror was the real decision.** Making the two rows identical could
have gone either way. FR-053 requires 44 px on the public surface and its one exception is
explicitly spent, so lowering the public row to `h-9` would have needed a fresh spec
amendment *to make a tap target smaller* — on a row that is live from 768 px up, which
includes touch tablets. Raising `CenterNav` costs nothing. **No spec is amended, so
`docs/CHANGELOG.md` gets no entry.**

**The underline is a knowing trade, not an oversight.** `bg-surface` on `bg-bg` measures
1.094:1 in light and 1.085:1 in dark against WCAG 1.4.11's 3:1 for a non-text indicator,
and `hover:bg-surface` renders identically to the active fill. All of that was already true
of `CenterNav`; the ruling was that the two bars share one known-weak indicator rather than
one file fixing it unilaterally. `aria-current="page"` is untouched. Recorded in
`docs/DECISIONS.md` and pinned by tests in both components.

**The mock is now spent for one property.** `docs/mockups/serenify-landing-mock.html` is
gitignored and cannot be corrected by a PR, so DECISIONS records that it is **no longer the
authority for the public navbar's background treatment specifically** — otherwise the next
fidelity pass reads its `nav` rule and puts the translucency back. It remains authoritative
everywhere else.

**Verified — and what the verification does NOT cover:**

- **Vitest**: 1460 tests / 133 files green. Seven new assertions confirmed **red against
  `main`** before the fix.
- **Layout Playwright** (`playwright.layout.config.ts`): new `tests/layout/public-chrome.spec.ts`,
  5 tests, **3 confirmed red against `main`**; the other 2 are guards and say so.
- **The app header's stickiness is class-list assertions ONLY.** `/app` is authed and the
  layout config has no `globalSetup` (which is what frees it from Supabase), so it cannot
  reach that route. The rendered thresholds — the `<h1>` goes under the bar below 624 px,
  the chat card below 576 px, nothing scrolls above 656 px, and the open `ChatPill` panel
  paints *on top of* the header below 444 px — were measured by hand in real Chromium and
  recorded in DECISIONS, not asserted.
- **The layout specs are not a gate.** CI does not invoke that config; a human must run
  `npm run -w apps/web test:layout`.
- **No e2e evidence.** Per **#208** the suite cannot start in any environment. It has also
  never run in CI by design (`ci.yml:4`). The four files touched have no e2e coverage
  regardless.

**Out of scope, deliberately**: the public navbar does not become auth-aware — signed-in
visitors still see "Sign in / Sign up" on `/`. That change adds a `profiles` read to public
routes and is kept to its own deploy. `public-mobile-nav.tsx`'s weaker exact-only active
rule is also left alone pending a separate decision.

---

## Fix — Production sign-out: proxy re-POSTed Server Actions (merged to main)

**Branches**: `fix/signout-race-and-feedback`, `chore/vercel-region-fra1`
**Status**: **merged to `main`** via **PR #204** (squash-merged 2026-07-28T20:53:32Z → `c1f6535`) and
**PR #206** (squash-merged 2026-07-28T21:01:14Z → `bdbff5f`), and **verified live in production**.
Issue **#200**, closed.
**Date**: 2026-07-28

**The bug.** `proxy.ts`'s route gate answered unauthenticated requests on protected paths with
`NextResponse.redirect(...)`, which **defaults to 307** — method- and body-preserving. Next dispatches
Server Actions as a POST to the route they are used on, so the matcher covered them, and a sign-out
whose session was revoked mid-flight by a sibling tab got
`POST /app → 307 → POST /login → 404 "Server action not found."`. `server-action-reducer.js` throws
E394 on that (neither RSC nor an `x-action-redirect`), and with no error boundary anywhere in
`apps/web/app` it fell through to Next's built-in root fallback. Reproduced against production before
the fix.

**A 303 was considered and rejected**: the followed GET is still neither RSC nor an
`x-action-redirect`, so the identical throw fires with different copy. A transport-level redirect is
invisible to the router by construction — `fetch` follows it silently, and the only channel Next has
for action-driven navigation is the `x-action-redirect` header on the action's **own** response.

**Shipped in two deploys on purpose.** `main` is production and squash-merges, so one PR is one
deploy. Splitting the auth fix from the region pin meant a regression against the ~20 live accounts
would have one suspect rather than two.

| PR | Contents |
|---|---|
| **#204** | C1 proxy method guard (GET/HEAD only) · C2 `scope: "local"` + cookie clearing on failed revoke · C3 pending state on all five sign-out call sites · C4 `app/error.tsx` · F1 review follow-up · all tracking docs |
| **#206** | C5 `apps/web/vercel.json` → `"regions": ["fra1"]`, co-located with Supabase `eu-central-1` |

### Measured outcome

| | Before | After |
|---|---|---|
| Single tab, warm | **1.61 s** (devtools "waiting for server response") | **near-instantaneous** |
| Two tabs | ~5 s, then Next's error screen on the originating tab | completes cleanly, **no error screen** |

**Stated precisely, because the two halves are not equally solid**: the before-figures are captured
devtools measurements; the after-state is **human observation, not a captured figure**. The claim is
"near-instant, observed" and should not be quoted as a number. The `chore(deploy)` PR body had said
"expected to reduce sign-out latency, magnitude not measured" — this closes that caveat only as far
as observation allows, and the two columns differ in **two** variables (transport fix *and* region
pin), so this is not an attribution of the win between them.

**Two things learned that outlive the fix**, both filed rather than left in a commit message:

- **Next 16's Proxy defaults to the Node.js runtime**, not Edge, and cannot set `runtime` at all
  (`node_modules/next/dist/docs/.../file-conventions/proxy.md` § Runtime). `proxy.ts` is a Node
  function in the deployment's function region. Believing otherwise produced a wrong latency model
  during diagnosis. Stale claims of the opposite still sit in four docs — **#202**.
- **`supabase.auth.signOut()` defaults to `scope: "global"`**, revoking every session on every
  device, and it **returns** `{ error }` rather than throwing when the auth server is unreachable —
  in which case supabase-js never clears the local session and there is no public API to force it.
  Both call sites now pass `"local"` and clear the `sb-*` cookies themselves on failure. Recorded in
  `DECISIONS.md` 2026-07-28 (fourth pass) as a security-posture decision, since it changes who gets
  logged out.

**Follow-ups left open, all deliberate**: **#201** (recent-chats empty-vs-loading state — goes
through the Azure API, so cold start rather than DB latency, and the `fra1` pin does not help it),
**#202** (stale Edge-runtime claims), **#203** (no `global-error.tsx`), **#205** (the onboarding
*flow* gate no longer applying to POSTs — not an authorization gate, GET still gated, accepted with
reasons).

---

## Feature 013 — Public Surface and Legal (merged to main)

**Branch**: `013-public-surface-and-legal`
**Status**: **merged to `main`** via **PR #194** (squash-merged 2026-07-28T12:56:13Z → `124192a`;
`main` enforces linear history), and **verified live in production** — evidence in
`deploy-log-production-2026-07-28.md`, record PR **#199**. All 148 tasks (T001–T148) complete. The public front door and the legal surface behind it: the
landing page at `/`, `/terms`, `/privacy`, a public navbar + footer, and **two consent gates** —
Terms/Privacy and camera-and-inference — neither of which is one-time. Consent is a **history**
(`20260726000000_user_consents.sql`): one append-only row per accepted revision, never overwritten,
owner-only RLS, an immutability trigger, and no UPDATE/DELETE grant.
**Date**: 2026-07-28

**Merging is the production deploy.** Vercel builds production from `main`, so PR #194 landing *is*
the release — there is no separate deploy step (`deploy-protocol.md` §3, `docs/DECISIONS.md`
2026-07-28 third pass). The migration was applied to hosted **ahead** of the code, deliberately and
safely: pre-013 code sends no `terms_privacy_version`, so the trigger's `?` key-existence guard
skips the consent INSERT and raises nothing.

### Phases and their PRs

| Phase | Tasks | PR |
|---|---|---|
| Spec / plan / tasks | T001 | #160, #166, #167 |
| **P1** — Wordmark: one shared two-colour definition, both hand-sync exceptions | T002–T010 | **#168** |
| **P2** — Consent foundation: append-only history + version-identity evaluator | T011–T019 | **#169** |
| **P3** — Legal + public shell: two real documents and the shell they live in | T020–T037 | **#170** |
| **P4** — The two prompting gates: server-side signup acknowledgement, fail-closed camera gate | T038–T062 | **#171** |
| **P5** — The app-shell entry gate (**ships alone**, so one `git revert` unwinds it) | T063–T077 | **#172** |
| **P6** — The landing page takes over `/` | T078–T113 | **#181** |
| **P7** — The team section | T114–T130 | **#182** |
| **P8** — Wrap, deploy, close-out | T131–T148 | **#194** |

Supporting PRs on the branch: **#173** and **#175** (e2e fixtures consented against P5's gate, with
one user left deliberately blocked), **#180** (`next` 16.2.6 → 16.2.11, nine advisories, taken ahead
of P6 because P6 reads the Next 16 routing docs out of `node_modules`), **#183**, **#186** (landing
made faithful to the mock), **#188** (re-consent screen rhythm, narrow-width auth door, current-page
marker), **#193** (the TTFB follow-up logged, not built).

### Issues closed

- **#75** — ToS + Privacy Policy + signup consent gate (Egypt PDPL). The ⛔ pre-production
  data-processing blocker. All three conditions shipped across P3 and P4.
- **#157** — camera + inference consent gate. All three capture routes gated, including
  `/onboarding`, which is a calibration surface and easy to miss.
- **#158** — `README.md` present-tense manager-visibility claims. Fixed as a P3 ride-along and held
  open until P8 so the result could be re-read against `plan.md` §0.3 rather than closed on the
  strength of the commit.

### Shipped knowingly broken, or knowingly open

- **ST-9 FAILED and knowingly accepted (#184)** — the no-JavaScript signup refusal is silent. It
  fails **closed** (no account, no consent row), so the harm is confusion, not data. **P8's sign-off
  does not mean ST-9 passed.**
- **WebKit has no automated coverage (#177)** — sign-off was **Chromium and Firefox only**.
- **#62 stays open deliberately** — `/signup` remains open self-serve for the demo window, and R8's
  SC-006 bypass is live and accepted with it. Blast radius: one forged consent row, for the forger's
  own account, RLS-scoped. Recorded as a decision so it cannot later be read as an oversight.
- **#176 updated, not closed** — the 18 `next` alerts clear on this merge; `postcss` × 2 and
  `sharp` × 1 remain and this bump does not touch them.
- Also open: **#86, #155, #174, #178, #179, #185, #187, #190, #192, #193**.
- **#189** — the hosted email templates. **Both content halves are now closed**: the template
  bodies were pasted and verified live, and the *Confirm sign up* **subject** was verified on a
  **delivered** production email as `Confirm your Serenify email`. It stays open for the
  **mechanism** half — nothing in the repo or CI transmits `supabase/templates/*.html` to a hosted
  project, and `wordmark-sync.test.ts` reads them off disk, so it can only prove the repo agrees
  with itself.

### Opened during P8's close-out and production verification

- **#193** — landing `/` stays `force-dynamic`; move *only* the signed-in redirect into `proxy.ts`
  **if** measured production TTFB disagrees. Logged, not built.
- **#195** — the Terms/Privacy gate does **not** cover `(onboarding)`. **Knowingly accepted**, with
  the population **measured at zero**. Held on the **T049** precedent, since gating that layout
  broadly once produced a permanent lockout for every new employee.
- **#196** — T146 review follow-ups, led by six landing lists missing `role="list"` (WCAG 1.3.1).
  Logged rather than patched because `role="list"` appears nowhere in `apps/web` — an app-wide
  pass, not a 013 regression.
- **#197** — `anchor-egress.spec.ts` fails on firefox against Next's **dev-only**
  `__nextjs_original-stack-frames`. **Proven pre-existing** by re-running the identical spec against
  `cbb7f81` with identical `node_modules`, where it fails *worse* (two such POSTs, not one).
- **#198** — the signed-in dashboard says **"Start check-in"** while the Terms this feature shipped
  distinguish a **monitoring session** from a **weekly work-environment check-in**. 39 bare uses,
  pre-existing (feature 008), but 013 is what makes it a visible contradiction.

### Verified in production — the evidence, not a claim

**`specs/013-public-surface-and-legal/deploy-log-production-2026-07-28.md`** records the whole pass.
Production deployment `dpl_AiMeacUNLYknQwkNvQ1yoS9MDWFR` (`124192a`), verified immediately after the
merge with **Lever 0 armed**.

Demonstrated: all five approved §10.3 strings verbatim and all three forbidden mock lines absent on
the live site; **30/30** responsive combinations with zero horizontal overflow; the gate blocking
**in place** on four authed routes with the URL unchanged, rendering **exactly four interactive
elements** on a deep route — a different tree, not a hidden one; no camera UI on any capture route;
both documents readable **while blocked**; acceptance writing **exactly one row** at
`terms_privacy@2026-07-26.1`; **ST-8** on both halves; and the throwaway's deletion taking its
consent row with it (**2 → 1**), demonstrating `ON DELETE CASCADE` rather than assuming it. **§6.4
baseline: (a) 1, (b) 1, (c) 0 rows.**

**Recorded as NOT proven, deliberately**: the `[consent-gate] FAIL-OPEN` log check returned **zero
lines over a full 5-minute window — a third consecutive empty one** — and is logged as **no-signal,
never as a pass**, because absence of a channel is not absence of an event. And the intermediate
`/?code=` URL was **never captured**; the routing was proven separately with an invalid-code probe
rather than claiming a screenshot that was not taken.

**Worth knowing**: the closing story beat is **absent from the server HTML** and renders only
client-side — a `curl`-based check would call it missing.

### Decisions logged in DECISIONS.md (2026-07-28, third pass)

Order A (legal first) · version identity over timestamp comparison · the registry in the repo rather
than a table · the two gates' **opposite** fail directions and why · one migration file ·
`decision` admitting only `'granted'`, with declining writing nothing and feature 018 owning
withdrawal · the **R8** residual and the deliberate open-signup posture · the **R7** correction
(narrower than `plan.md` §15 states — `plan.md` deliberately not edited) · production deploying from
`main`.

---

## Milestone — Production deployment: Serenify is live at https://serenify.tech

**Backfilled 2026-07-22.** The three entries below (this one, cold-start readiness, and brand
email/social preview) were written after the fact. PRs #142, #143, and #144 shipped the entire
deployment milestone on 2026-07-12/13 with **no PROGRESS or CHANGELOG entry** — the first break in
the per-feature convention held unbroken since feature 001. A 2026-07-21 recon found the gap.
Reconstructed from commits, SpecKit artifacts, and live platform state; nothing here is from memory.

**Status**: **live and verified in production.**
**Date**: cutover 2026-07-12, verified 2026-07-13.

### Topology as deployed

| Component | Runtime | Location |
|---|---|---|
| Web (Next.js 16) | Vercel | `https://serenify.tech` |
| API (FastAPI + uvicorn, single worker, no `--reload`) | Azure Container Apps, France Central | `https://api.serenify.tech`, container port 8000 |
| Database / Auth / Storage | Supabase Cloud (EU / Frankfurt) | project `excukdzjudslbqmkysrc` |
| API image | GHCR | `ghcr.io/mohamedasem318/serenify-api:production` |
| Transactional email | **Resend**, as Supabase Auth's custom SMTP provider | dashboard-configured |
| Fallback LLM | Local LM Studio via Cloudflare Tunnel | self-hosted by design |

Container App sizing: **4 vCPU / 8 GiB, `minReplicas=0`, `maxReplicas=1`** — scale-to-zero to
control Azure for Students credit. Ratified as **Constitution Amendment 14** (1.10.0 → 1.11.0,
MINOR), replacing the planned DigitalOcean Droplet.

### Verification

**Production smoke test — PASS, 2026-07-13** (`specs/022-cold-start-readiness/smoke-tests.md`), run
against the real production Azure API and cloud Supabase project from a protected branch preview:
calibration woke the API in under one minute, check-in completed normally, the first reading arrived
at **≈1:36** and updated again within about 10 seconds. Approval recorded: *"it worked flawlessly."*
The temporary preview CORS origin was removed after the test.

### Three things a future reader needs to know

1. **There is no rollback target.** `docs/DECISIONS.md` (2026-07-12) claimed the prior Azure
   Container Instance stayed running as one; the cutover design doc in the *same PR* said the
   resource groups had been deleted to stop credit burn. Settled 2026-07-22 against the live
   subscription — `az group list` returns exactly one group (`serenify-prod-rg`) containing only the
   Container Apps environment, the `serenify-api` app, and its managed certificate. **No ACI
   exists.** Recovery is a re-provision from the GHCR image tag, or a Container Apps revision
   rollback while an older healthy revision is retained. Not a traffic flip, not instantaneous.
2. **The deployment is not reproducible from this repository.** There is no IaC of any kind — no
   Bicep, ARM, Container Apps YAML, compose file, systemd unit, or reverse-proxy config.
   Provisioning was manual `az` CLI and is intentionally untracked. The only record of the live
   configuration is `docs/superpowers/plans/2026-07-12-production-cutover.md`.
3. **Resend's absence from this repo is the architecture, not a gap.** Resend is live as Supabase
   Auth's custom SMTP provider and production email is sending, but it has no API key, no SDK, and
   no calling code here — it sits *beneath* Supabase Auth as an SMTP relay. A 2026-07-21 recon read
   the repo-level absence as "not integrated" and was wrong. Ratified as **Amendment 15** (1.11.0 →
   1.11.1, PATCH). Mail incidents are diagnosed in the Supabase and Resend dashboards, never here.

**Cross-references**: `docs/CHANGELOG.md` 2026-07-12 and 2026-07-13 (three entries);
`docs/DECISIONS.md` 2026-07-12, 2026-07-22 (ACI correction), 2026-07-22 (Resend);
`.specify/memory/constitution.md` Amendments 14 and 15.

---

## Deployment — Production cutover: Azure Container Apps, GHCR, branded email, service-role removal (PR #142)

**Branch**: `chore/api-container-deploy` → merged to `main` via **PR #142** (squash `ffb3a96`,
2026-07-12).
**Status**: **done — production backend live on Azure Container Apps.**
**Date**: 2026-07-12. **Backfilled 2026-07-22.**

**What shipped**:

- **Hosting**: Azure Container Apps (`serenify-api` / `serenify-prod-rg` / France Central) at 4 vCPU
  / 8 GiB with `minReplicas=0`, `maxReplicas=1`. Managed HTTPS ingress + custom domain give
  `api.serenify.tech` TLS without a separate reverse proxy. Constitution **Amendment 14**.
- **Image pipeline**: `.github/workflows/publish-api-image.yml` — manual `workflow_dispatch`, builds
  `linux/amd64`, pushes to `ghcr.io/mohamedasem318/serenify-api:production` with the repo-scoped
  `GITHUB_TOKEN`, deliberately avoiding a paid Azure Container Registry. No Azure credentials in CI;
  the deploy step is manual.
- **Container build fixes**: the Dockerfile never copied `packages/llm-client` (added in feature
  011), so `uv sync --frozen` failed on the editable path deps — a clean-context build had never
  succeeded. Adds the COPY, an `ffmpeg -version` build-layer check, deterministic uv env vars, and
  `uv run --no-sync` at boot so container start never re-checks the lock or hits the network.
- **`apps/api/.dockerignore` (new)**: without it, a root-context build baked `apps/api/.env` — real
  dev secrets — into the image and copied both Windows `.venv` trees. Context dropped from
  gigabytes to a few MB.
- **Service-role removal**: deleted `apps/web/lib/supabase/admin.ts` and
  `apps/web/app/api/admin/invite/route.ts`. Production is **RLS-as-user throughout**; inference
  replay runs as the authenticated user; deploy no longer needs a service-role key. Locked by
  `apps/web/tests/unit/runtime-secret-posture.test.ts`.
- **Branded auth email**: `supabase/templates/confirmation.html` + `recovery.html` (Graphite, 520px
  card, meadow top rule, text wordmark, OTP fallback), wired in `supabase/config.toml`, with
  `scripts/preview-auth-emails.mjs` for visual QA and template-invariant tests.

**Backlog reconciliation**: retro-closed **#74** (usable-face-coverage gate shipped in feature 006 /
PR #19) and **#48** (card-heading serif resolved by the Outfit swap in feature 007 / PR #22) — both
long since fixed in code, never reconciled.

**Deviation from Principle VIII, recorded not excused**: no `specs/0NN-…` folder was produced;
`specs/` jumps `012 → 022`. This shipped against ad-hoc `docs/superpowers/` plan + design docs
instead of the standard SpecKit artifact set. The two PRs that followed both got proper folders.

25 files changed, 930 insertions, 331 deletions. Co-authored by all three teammates.

---

## Fix — Cold-start readiness for a scale-to-zero backend + speckit CI guard (#50 done, PR #143)

**Branch**: `fix/cold-start-readiness` → merged to `main` via **PR #143** (squash `90171c3`,
2026-07-13).
**Status**: **done — closes BACKLOG #50 / GitHub issue #50.** SpecKit folder:
`specs/022-cold-start-readiness/`.
**Date**: 2026-07-13. **Backfilled 2026-07-22.**

**The problem `minReplicas=0` created**: scale-to-zero controls credit but makes the first request
after idle pay a full container cold start. Measured in production — **46.68 s** from zero replicas,
**0.34 s** warm. Existing client timeouts sat far below that, so correct backend behaviour presented
to the user as a hard failure.

**What shipped**:

- A bounded **75 s** wake allowance on health readiness (FR-001) and monitoring-session creation
  (FR-002), timer released after settlement, abort/fetch failure mapped onto the existing `network`
  result rather than a new error class. Wake requests start only on an explicit calibration or
  check-in action (FR-003) — never speculatively.
- **Ordering fix that matters for trust**: check-in creates the authenticated backend session
  **before** requesting camera access (FR-004). Previously the camera could open and its indicator
  light while the backend was still asleep — a product like this cannot afford that.
- Explicit pending states rather than silence: check-in disables its action, shows
  `Waking Serenify…`, exposes a polite live status (FR-005); calibration explains the ~1 min wake
  (FR-006). **No new animation, no new reduced-motion path** (FR-009) — a spinner was the easy
  answer and was rejected. Pending control stays ≥44px and fits 360px in light and dark (FR-008).
- **CI guard (#50)**: `scripts/check-speckit-skills.mjs` + `check-speckit-skills.test.mjs` fixtures
  + a `speckit-guard` CI job assert the required `.claude/skills/speckit-*/SKILL.md` files exist and
  reject a broad `.claude/` ignore rule (FR-010), ending the recurring silent disappearance of the
  SpecKit skills.
- Non-production `/cold-start-harness` route + committed Playwright layout contract; the harness
  returns 404 from a production build.

**Verification**: 952 Vitest tests; ESLint 0 errors (2 pre-existing warnings); TypeScript +
Turbopack production build; 8 SpecKit guard fixtures plus the live guard; 4 Playwright checks at
360px/desktop in light/dark. **Production smoke: PASS 2026-07-13** — see the milestone entry above.

25 files changed, 1068 insertions, 42 deletions. **No co-author trailers** — a break from the
blanket rule, recorded here because the omission is now permanent in history.

---

## Fix — Brand polish: auth email typography, social share preview, password-reset lock (#38 done, PR #144)

**Branch**: `fix/brand-email-social-preview` → merged to `main` via **PR #144** (squash `81b4775`,
2026-07-13).
**Status**: **done — closes BACKLOG #38 / GitHub issue #38.** SpecKit folder:
`specs/023-brand-email-social-preview/`.
**Date**: 2026-07-13. **Backfilled 2026-07-22.**

**What shipped**:

- **Email**: wordmarks stay **text, never an image** — `Outfit, Inter, Arial, sans-serif` at 400/24px
  (FR-001), mirroring the app header. CTA cells carry both `align="center"` and inline centered
  alignment (FR-002) — redundant on purpose for older email engines. GoTrue placeholders and
  dark-mode styles preserved (FR-003).
- **Social preview**: `apps/web/app/opengraph-image.tsx` — `next/og` `ImageResponse`, exactly
  **1200×630** (FR-005), fixed dark composition since link unfurlers receive no viewer theme.
  Headline **"Workplace stress, gently noticed."** over a meadow rule and "Private check-ins for
  calmer workdays". `layout.tsx` sets `metadataBase: https://serenify.tech`, canonical `/`, full
  OpenGraph + `twitter: summary_large_image` (FR-004). One deliberate brand deviation: the OG image
  uses Arial rather than Inter/Outfit, since Satori does not fetch Google Fonts the same way.
- **Password reset (#38)**: a successful update ends the recovery session and routes to login; a
  failure does not (FR-006). This was already the behaviour — what shipped is the lock,
  `apps/web/tests/unit/reset-password-actions.test.ts`, so it cannot silently regress.

**Note for future design work**: `supabase-email-templates.test.ts` and `social-metadata.test.ts`
pin these invariants tightly (OG dimensions, content type, icon source, wordmark, tagline,
`#101214`; email subjects, both Google Font loads, the exact wordmark style string, the
`border-top:4px solid #3E7A63` rule, absence of `<img>` and of amber/crimson). **Any restyle must
update these expectations in the same commit** — they will fail otherwise, by design.

13 files changed, 429 insertions, 12 deletions. **No co-author trailers** — same omission as #143.

---

## Feature — Second, milder confirmatory trigger: sustained `a_little_tense` (#134 done)

**Branch**: `012-confirmatory-mild-trigger` → merged to `main` via **PR #135** (squash
`ad58777`, 2026-07-03).
**Status**: **done — closes BACKLOG #134 / GitHub issue #134.**
**Date**: 2026-07-03.

**What shipped**: a second confirmatory trigger — ~60 s sustained `a_little_tense` (a slow simmer
that never spikes) — beside the existing ~20 s sustained-`tense` acute trigger, reusing the prompt
/ dwell / expiry / single-resolution machinery; only the pre-show timer logic and the budget gain a
second path. The reducer (`apps/web/lib/questionnaire/confirmatory-trigger.ts`) adds a second
sustained clock (`littleRunStartMs`) with an exact-band `isLittleTenseReading` predicate (no
band-ordering) and a per-band reset matrix (`tense` feeds acute + zeroes mild; `a_little_tense`
feeds mild + zeroes acute; anything else / inactive zeroes both — climbing `a_little_tense` →
`tense` hands off to acute). Arbitration is explicit: the acute condition is evaluated FIRST
(tense wins). The mild dwell constant `CONFIRMATORY_LITTLE_TENSE_SUSTAINED_MS = 60_000` is a
designed default, not empirically calibrated (StressID's 60 s stressor clips can't validate a
sustained-mild threshold under the 4×60 s smoothing buffer — same limitation as the 0.70 tense
band, #128). The budget is now **tense-senior**: `shownKind` + two flags — a mild answer spends
only the mild budget (a later sustained-tense keeps its shot); a tense answer spends both (no
down-tier nag); auto-resolutions spend neither and re-arm, exactly as #127/#130. Net: ≤1 mild + ≤1
tense per session. The DB (`supabase/migrations/20260703000000_qcp_kind_column.sql`) adds a `kind`
('mild' | 'tense') column (existing rows backfilled to 'tense') and re-scopes the #132 answered-row
cap to one per (session, kind) via `qcp_one_answered_per_session_per_kind`;
`createConfirmatoryPrompt` writes `kind` (`trigger_band` unchanged).

**Verification**: the six #127/#130/#132 reducer/hook guarantee tests (explicit-answer-consumes-
budget, both signal-drop-does-NOT-consume, `markResolvedRearm`, and the two hook tests) are
**byte-for-byte unchanged and green**. Live-verified against the local Supabase Postgres inside a
rolled-back transaction (no data persisted): the old single-column `qcp_one_answered_per_session`
index rejected a second `answered` row in one session (**RED** — `duplicate key value violates
unique constraint`), and after the migration a mild-answered + tense-answered pair both persist
while a second same-kind `answered` row is rejected by the new per-kind index (**GREEN**). The
static migration-text gate (`apps/api/tests/test_questionnaire_privacy.py`, T003) now also parses
this migration and asserts the `kind` column + per-kind index — verified RED (assertion fails when
the migration file is absent) before GREEN.

**Test gate (2026-07-03)**: `apps/web` Vitest — questionnaire dir 88/88, full suite **935/935
passed / 98 files** (58 confirmatory reducer/hook/client tests, of which 16 new); `apps/api` pytest
`test_questionnaire_privacy.py` **12/12**; `tsc --noEmit` clean; ESLint 0 errors (1 pre-existing
unrelated warning).

**Cross-references**: `docs/CHANGELOG.md` 2026-07-03; `docs/DECISIONS.md` 2026-07-03 (D-11);
`docs/BACKLOG.md` #134 (resolved).

---

## Fix — Confirmatory prompt one-per-session budget: DB-side partial index (#127 done)

**Branch**: `fix/127-qcp-answered-only-unique` → merged to `main` via **PR #132** (squash
`d057f43`, 2026-07-02).
**Status**: **done — closes BACKLOG #127 / GitHub issue #127**, together with the client-side
half shipped in **PR #130** (see the entry directly below). This entry is the implementation
record for the DB-side half.
**Date**: 2026-07-02.

**What shipped**: `questionnaire_confirmatory_prompts` dropped the full-table
`qcp_one_per_session UNIQUE (monitoring_session_id)` constraint and replaced it with a partial
unique index, `qcp_one_answered_per_session ON questionnaire_confirmatory_prompts
(monitoring_session_id) WHERE lifecycle = 'answered'`
(`supabase/migrations/20260702000000_qcp_one_answered_per_session.sql`). A session can now hold
several `visible`/`expired` rows — one per re-arm episode — while still capping `answered` rows
at one per session, matching PR #130's client-side `budgetConsumed` predicate exactly (only an
explicit answer spends the budget). `createConfirmatoryPrompt`
(`apps/web/lib/api/questionnaire-client.ts`) is otherwise unchanged — its plain `.insert` now
succeeds for a re-armed session's second prompt instead of hitting the old unconditional
constraint. Also fixed the insert-failure path, which was previously swallowed entirely: on
error it now logs `console.error("[questionnaire] confirmatory prompt create failed:", …)`,
matching the existing `[questionnaire]`-tagged convention in `session-end-feedback-card.tsx`.

**Verification**: live-verified against the local Supabase Postgres instance inside a
rolled-back transaction (no data persisted) — two non-answered rows (`visible` → `expired` →
`visible`) in one session both inserted successfully; a second `answered` row in the same
session was correctly rejected by the new partial index with a unique-violation. The static
migration-text gate (`apps/api/tests/test_questionnaire_privacy.py`, T003) now also parses this
migration and asserts the old constraint is dropped and the new partial index is shaped
correctly — verified RED (assertion fails when the migration file is absent, and when the
`WHERE` clause is mutated to the wrong lifecycle) before GREEN.

**Test gate (2026-07-02)**: `apps/web` Vitest **917/917 passed / 98 files** (new: the
insert-failure logging test, verified RED without the fix then GREEN with it); `apps/api`
pytest full suite passed (`test_questionnaire_privacy.py` 12/12); `tsc --noEmit` clean; ESLint
0 errors (2 pre-existing unrelated warnings).

**Cross-references**: `docs/CHANGELOG.md` 2026-07-02; `docs/DECISIONS.md` 2026-07-02 (D-10);
`docs/BACKLOG.md` #127 (resolved).

---

## Fix — Confirmatory prompt one-per-session budget: client-side re-arm (partial, #127)

**Branch**: `fix/127-confirmatory-prompt-budget-auto-expiry` → merged to `main` via **PR #130**
(squash `d89f4db`, 2026-07-02).
**Status**: **partial fix** — the client-side trigger state machine is fixed; the DB write
path is not, so BACKLOG #127 / GitHub issue #127 stay OPEN. This entry is the implementation
record for the client-side half only.
**Date**: 2026-07-02.

**What shipped**: `useConfirmatoryTrigger`'s reducer conflated two concerns in a single
`resolved` flag — the per-prompt single-resolution guard, and the session's one-time prompt
budget. An auto-resolution (`signal_drop` expiry, whether detected immediately when a
non-tense outcome arrived past the dwell floor, or via the dwell-timer callback) was
permanently blocking all further outcome processing for the session, exactly like an
explicit user answer — so a genuine stress spike later in the same session could never
re-prompt. Split the flag: `resolved` now guards only the currently-(or most-recently-)shown
prompt; a new `budgetConsumed` field is set ONLY by an explicit `type: "answered"` resolution
(confirmed / false_alarm / opened_chat) via a new `markResolvedConsumingBudget` helper. A new
`markResolvedRearm` helper resets the trigger to a fresh, un-shown state on any
auto-resolution — including the hook's own `resolvedRef`/`promptIdRef` — so a later,
genuinely new 20 s sustained-tense episode can still fire a `show` effect in the same
session. Next-session false-alarm suppression is untouched (already correctly scoped to the
explicit `false_alarm` path only).

**Why it's still partial**: `questionnaire_confirmatory_prompts` keeps `CONSTRAINT
qcp_one_per_session UNIQUE (monitoring_session_id)`
(`supabase/migrations/20260630000000_questionnaire_feedback.sql`) — unchanged by this PR.
`createConfirmatoryPrompt` (`apps/web/lib/api/questionnaire-client.ts`) still does a plain
`.insert`; a second prompt row for the same session (even though the client now wants to
create one) hits the UNIQUE violation, the insert fails, `createPrompt` resolves `null`, and
`handleShow` silently no-ops. **In production, a user still cannot be re-prompted after an
auto-expiry** — the client fix is necessary but not sufficient. Caught during the post-merge
doc reconcile, after merge — the unit test suite gave false confidence because `createPrompt`
is mocked in every test and does not model the real DB constraint.

**Remaining scope** (tracked as the still-open part of BACKLOG #127 / GitHub #127): drop the
full-table unique constraint in favor of a partial unique index scoped to `lifecycle =
'answered'`, plus the re-arm/cooldown/cap policy design called for in the original BACKLOG
entry. Needs its own spec-fix pass, not folded into this PR.

**Test gate (2026-07-02)**: `apps/web` Vitest `confirmatory-trigger.test.ts` **20/20** (new
coverage: both signal-drop expiry paths — immediate and via the dwell timer — do not consume
the budget and a fresh sustained-tense run re-shows; single-resolution guard still holds);
full suite **916/916 passed / 98 files**; `tsc --noEmit` clean; ESLint clean on changed
files. All green against the mocked persistence layer — does not exercise the DB-constraint
gap described above.

**Cross-references**: `docs/CHANGELOG.md` 2026-07-02; `docs/DECISIONS.md` 2026-07-02;
`docs/BACKLOG.md` #127.

---

## Feature 012 — Questionnaire Feedback (merged to main)

**Branch**: `012-questionnaire-feedback`
**Status**: **merged to `main`** via **PR #125** (squash `636a7fc`, 2026-07-02); feature branch
deleted (local + remote). All 68 tasks (T001–T068) complete, plus a post-implementation fix round
found live-running the e2e suite and during the pre-merge polish pass (dwell timing, an upsert
correctness fix, shared end-states, and layout fixes — folded into the bullets below). Three
questionnaire instruments on the Phase-1/2 privacy foundation (migration
`20260630000000_questionnaire_feedback.sql`): mid-session confirmatory prompt (US1), session-end
product feedback (US2), weekly work-environment check-in (US3), and a coordinator that keeps
them from colliding (US4) — all RLS-as-the-employee, no service-role.
**Date**: 2026-07-02

**Scope shipped** (US1–US4 / Phases 3–8):

- **Phase 3 — authenticated client.** `lib/api/questionnaire-client.ts` (direct `@supabase/ssr`
  browser writes + the two weekly DEFINER RPCs) and shared enums/guards `lib/questionnaire/types.ts`.
- **US1 — confirmatory prompt.** `useConfirmatoryTrigger` (pure reducers: 20 s sustained-tense,
  4.5 s dwell floor, one prompt/session, single-resolution guard, next-session false-alarm
  suppression in `sessionStorage`, chat-signal-excluded, browser-local). `Notification` extended
  with `dismissible`/`nonModal` (answer-only, no focus trap). `ConfirmatoryPrompt`. Ren handoff
  seam (`?handoff=confirmatory_yes|confirmatory_maybe`, soft opener, no recommendation cards).
  Wired into `monitoring-session.tsx` (expiry resolved before session-end navigation; user_id
  decoded from the JWT — no extra round-trip).
- **US2 — session-end feedback.** `SessionEndFeedbackCard` (Good/off/Skip; free text + "too
  robotic" employee-private only; account routing to `/app/account` + `/app/account#notifications`,
  the placeholder now `id="notifications"`). Every-session sampling seam. Skip is a top-right
  corner ghost-link chip (own row, not baseline-aligned with the heading; text-color-only hover,
  invisible hit-slop so it clears the 44px touch target without a filled hover box bleeding over
  the heading). `ren_too_robotic` and free-text `something_else` resolve into the shared centered
  `QuestionnaireResultIcon` end-state (not an inline banner / bounce-back-to-reason-list); that
  end-state, like Good/Skip, now paints on-screen before the coordinator swaps surfaces (see the
  dwell fix below).
- **US3 — weekly check-in.** `WeeklyCheckInCard` (two-step stepper, `role="progressbar"`, focus
  to Q2, Back/Done; submits one identity-stripped contribution via the DEFINER RPC; skip /
  abandoned-Q2 create no contribution). ISO-week cadence helpers. Skip gets the same corner
  ghost-link chip treatment as US2, with the heading reserving right-padding so it never overlaps.
- **US4 — coordinator + polish.** `QuestionnaireCoordinator` (centralized anti-collision; mounts
  on the dashboard additively — Today card/trend untouched). Shared `QuestionnaireResultIcon`;
  four reduced-motion-safe animations via `useMediaQuery`. Mobile (360px) bottom-offset now
  matches the `sm:` breakpoint's `--chat-pill-offset` formula unconditionally, fixing an overlap
  where the session-end/weekly card sat under the floating chat pill on mobile.
- **Post-implementation fix — coordinator dwell + session-feedback upsert (T067 follow-up).**
  `SessionEndFeedbackCard` and `WeeklyCheckInCard` were calling `onResolved()` synchronously in
  the same handler that set their own local "ending" state, so the coordinator swapped surfaces
  in the same React commit before the end-state ever painted — a real SC-007 violation. Both
  cards now defer `onResolved()` behind `QUESTIONNAIRE_RESULT_DWELL_MS` (timer cleared on
  unmount). Separately, `saveSessionFeedback` switched from `.insert` to
  `.upsert(payload, { onConflict: "monitoring_session_id" })` with every nullable column set
  explicitly: switching reasons before acting used to insert a second row and hit
  `qsf_one_per_session` `UNIQUE(monitoring_session_id)`, silently discarding the second write;
  `route()` now also halts (logs, doesn't navigate/resolve) on a failed save instead of
  proceeding as if it succeeded.

**Test gate (2026-07-02, post-fix)** — `apps/api` `test_questionnaire_privacy.py` **12 passed**
(T003–T013 + T065) + **live RLS/DEFINER probe** on local Postgres (clean `db reset`) — all
boundaries hold; `apps/web` Vitest **909 passed / 98 files**; `tsc --noEmit` clean; ESLint clean
on all changed files. Playwright `questionnaire.spec.ts` + `questionnaire-layout.spec.ts` **4/4
each**; full chromium e2e project **42 passed** (4 pre-existing unrelated skips, 1 pre-existing
unrelated failure in `employee-dashboard-shell.spec.ts`, confirmed via git-stash to reproduce
without this change).

**Gates**:

- ✅ Test gate — all suites + `tsc` + lint green (counts above).
- ✅ Smoke gate — `specs/012-questionnaire-feedback/smoke-tests.md` Section 5, **all 7 manual
  scenarios PASS** against a real local Supabase + live camera, each cross-checked directly in
  Postgres (confirmatory sustained-tense trigger, dismiss-resistance, false-alarm persistence +
  next-session suppression, session-end-during-visible-prompt ordering, all 6 session-end
  feedback paths, weekly ISO-week cadence caps); signed off 2026-07-02 (Constitution VII).
- ✅ Squash-merge — merged to `main` via **PR #125** (squash `636a7fc`, 2026-07-02); feature
  branch deleted (local + remote).
- ✅ Governance (Amendment 9) — **#127** / **#128** opened for the two fast-follow items found
  during this pass; **#123** stays OPEN (pre-real-data blocker, unaffected by this pass).

**Deferred / open**:

- **BACKLOG #123** (minimum-headcount aggregate suppression) stays OPEN — `sample_size` hook
  ships, suppression does not; pre-real-data blocker.
- **BACKLOG #127** (expired confirmatory prompt consumes the one-per-session budget, no re-arm) —
  filed during this pass; 012 fast-follow.
- **BACKLOG #128** (`STRESS_TENSE_BAND=0.70` is an uncalibrated hardcoded default) — filed during
  this pass; future model-calibration pass, not blocking 012.
- The optional `trigger_window_reading_id` link is deferred (research R-4): the prompt stores
  the required `triggered_window_captured_at` only; the time linkage satisfies the contract.

**Cross-references**: `specs/012-questionnaire-feedback/`; `docs/CHANGELOG.md` 2026-06-30 +
2026-07-02; `docs/DECISIONS.md` 2026-06-30 + 2026-07-02; `docs/BACKLOG.md` #123 / #127 / #128;
`.specify/memory/constitution.md` Amendment 13.

---

## Feature 011 — LLM Client and Ren Chatbot (merged to main)

**Branch**: `011-llm-client-chatbot`
**Status**: **merged to `main`** via **PR #121** (squash `8979ee2`, 2026-06-29); feature branch
deleted (local + remote). Implemented and human-validated — smoke pass complete
(`specs/011-llm-client-chatbot/smoke-tests.md` **ALL GREEN**, 2026-06-28/29). Builds the shared LLM client
package (`packages/llm-client`) + the first chatbot surface (Ren) riding on it: dual-mode
stress detection (per-message scorer + whole-conversation rollup), live-only crisis
escalation, employee-private persistence (RLS-as-user, no service-role), and the approved 011
chatbot design. New package `packages/llm-client`; new `apps/api` chat router + services
(`routers/chat.py`, `services/chat_orchestrator.py`, `chat_video_context.py`,
`crisis_resources.py`, `llm_client.py`); new `apps/web` chat surfaces (`app/(authed)/app/chat`,
`components/chat/*`, `lib/api/chat-client.ts`, `lib/chat/*`). The LLM provider switch +
crisis / scorer / rollup design decisions are logged in `docs/DECISIONS.md` 2026-06-28 and
constitution **Amendment 12** (CHANGELOG 2026-06-28) — not repeated here.
**Date**: 2026-06-29

**Scope shipped** (US1–US6 / FR-001…FR-059):

- **US1 — entry points + shared store.** `/app/chat` full page, the employee-only "Talk to
  Ren" pill (desktop label + ✦ / mobile icon-only `aria-label`), the home Recent-chats card,
  and the employee Chat nav item — all reaching one shared conversation store; team-lead /
  admin / unauthenticated users never see chat entry points or chat rows.
- **US2 — listen-first.** Ren reply + per-message scorer run in parallel; the scorer never
  steers Ren's wording; a failed send preserves the typed text for retry (no lost message).
- **US3 — one suggestion + disclaimer.** Ren offers at most one concrete next step; the
  companion disclaimer ("Ren is an AI companion, not a substitute for professional care.")
  stays visible on the page, the pill, and empty states.
- **US4 — end / title / resume.** Fresh whole-conversation rollup every fifth user message and
  on `[END]`; band-only persisted (no per-message scores, no crisis flag); calm auto-title with
  no banned distress words; resume reconstructs continuity from persisted text; rename + delete
  (immediate hard delete) consistent across surfaces.
- **US5 — crisis (live-only).** Calm foggy resource panel on scorer `crisis:true` OR Ren's
  silent `[CRISIS]` token; resources only from the verified table (Egypt 16328 / US 988,
  last-checked 2026-06-28) + the universal immediate-danger line; never persisted, never routed
  to manager / admin / employer; Ren generates no phone numbers or service names.
- **US6 — signal separation + reconcile.** Chat-derived bands appear on recent-chat surfaces
  only and never alter the video today-card / live monitor / video-trend; opportunistic video
  reconcile as opener / agreement context with the 70 s staleness rule and no fused band.

**Test results** (2026-06-29):

- `packages/llm-client` `uv run pytest`: **28 passed**; ruff clean.
- `apps/api` `uv run pytest`: **155 passed** (incl. the **57 chat tests** across
  `test_chat_storage_rls`, `test_chat_store`, `test_chat_prompt_boundaries`,
  `test_crisis_resources`, `test_chat_orchestration`, `test_chat_context_window`,
  `test_chat_crisis_flow`, `test_chat_rollup_title`, `test_chat_privacy`,
  `test_chat_video_reconcile`, `test_ren_behavior_rubric`; the balance is the pre-existing
  feature-005/006/008 monitoring + local replay suite, which scored against the committed ML
  artifact this run); ruff clean.
- `apps/web`: `npm run lint` **clean**, `tsc --noEmit` **clean**, Vitest **775 passed / 79
  files** (`--pool=threads` per the Windows EPERM memory; CI runs the same suite on ubuntu).

**Gates**:

- ✅ Smoke gate — `specs/011-llm-client-chatbot/smoke-tests.md` **ALL GREEN** (2026-06-28/29,
  Constitution VII): entry points + shared store, listen-first send + retry, crisis (both
  triggers → same foggy panel, no Ren-generated numbers, nothing persisted / notified),
  one-suggestion + persistent disclaimer, end / title / resume + rename + hard-delete, signal
  separation, and 360px / light+dark / WCAG-AA design + a11y. Guardrail greps PASS (no inline
  prompt strings in API call sites; no service-role path for chat content).
- ✅ Test gate — all suites + lint + tsc + ruff green (counts above).
- ✅ Squash-merge — **merged to `main`** via **PR #121** (squash `8979ee2`, 2026-06-29);
  feature branch deleted (local + remote).

**Deferred / known items**:

- **Four Playwright e2e tasks deferred — T034 / T052 / T064 / T073** (role entry-point
  visibility, crisis privacy, end/resume, signal separation). They need the live
  FastAPI+Supabase stack + the repo's e2e auth fixtures (the same fixture-stack gap that keeps
  phase-2 CI e2e out of scope, BACKLOG #41). The behaviour they would cover is exercised by the
  automated Vitest + pytest suites (role/access, crisis, end/resume, separation) and confirmed
  in the manual smoke pass. **Not claimed as done.** Spec-internal deferred tasks (same shape
  as feature 010's unfiled spec-internal items) — recorded here + in `docs/BACKLOG.md` "From
  feature 011", not filed as a separate BACKLOG issue.
- **Ren name personalization deferred.** No `preferred_name` was implemented; the
  `ren_preference_block` seam ships empty (FR-009) and `profiles` stores `full_name` only.
  Addressing the employee by name belongs to a future first/last-name split — revisit then.
  **No `preferred_name` column was added.**
- **Crisis country = universal line.** `profiles` has no `country` column yet and the country
  picker is out of scope (spec Out-of-Scope), so the live panel shows the universal
  immediate-danger line; the Egypt/US verified rows exist and are covered by automated tests.
- **#75 (ToS / Privacy Policy / signup consent gate) stays OPEN.** 011 ships only the in-app
  companion disclaimer; the full pre-production consent gate is unchanged and remains a
  pre-real-data blocker.

**Privacy invariant**: chat is employee-private end to end — RLS-as-the-employee on
conversations + messages, **no service-role key on any chat path**, immediate hard delete on
delete, crisis live-only (never persisted, never to the manager / admin / employer chain), and
privacy-safe telemetry only (request outcome / provider / latency bucket / retry count /
validation-failure type — never message text, prompt text, crisis booleans, bands, or
resource-panel events). Consistent with constitution Principle I + Amendment 12.

**Next**: 011 was the shared-LLM-client foundation; the questionnaire and recommendations
features now build on the same provider boundary.

---

## Feature 010 — Monitoring Graph Redesign (merged to main)

**Branch**: `010-monitoring-graph-redesign` (roadmap label `009b-monitoring-graph-redesign`)
**Status**: **merged to `main`** via **PR #118** (squash `6b8653e`, 2026-06-27); feature branch
deleted (local + remote). Frontend-only redesign of the live **"This session"** within-session
monitoring graph — the card below the camera stage on the monitor page — consuming the existing read
layer unchanged (no data-layer / RLS / SELECT-whitelist / API / page-layout / `globals.css` change;
no probability to the client). One component replaced (`apps/web/components/monitor/session-trend.tsx`)
plus one new pure module (`apps/web/lib/session-trend-geometry.ts`).
**Date**: 2026-06-27

**Scope shipped**:

- **US1 — live trend (MVP).** A single continuous **band-coloured step line** (at ease = meadow ·
  a little tense = `--amber-soft-line` · tense = amber; height = tension) on **fixed-pixel SVG
  rendering** (DC-001: 1 SVG unit = 1 screen pixel, intrinsic `width == viewBox` width, no stretched
  viewBox — replacing the totem/oval `viewBox="0 0 100 40" preserveAspectRatio="none"` bug), with a
  single live **"now" marker** at the right edge that recolours to the current band. Reads its
  rendered container width via `ResizeObserver`/ref; matched-pair width with the camera stage holds
  by the existing `max-w-3xl` column (no page change).
- **US2 — three honest no-read treatments + ramp-up geometry.** Starts consuming `skipCause` + the
  warming-vs-skip distinction the component used to discard, splitting no-reads into **warming**
  (dashed muted line, start-only, ≥2 points) · **out-of-frame foggy gap** (built per the mock but
  **gated OFF at launch** behind `showOutOfFrameFoggy`, FR-015 — out-of-frame routes to the muted gap
  until issue #100 confirms reliability) · **no-clear-read muted gap** (static-opacity fade, never a
  bridged flat line; leading skip → fade-in only). Plus the **ramp-up fill-to-width** x-axis (windows
  fill the full plot width during the first ~2 min, locking the slot pitch at `N_target = 12`, then
  scroll off the left) and **1-warming-point stub suppression** (a lone warming point shows the
  just-started text, not a stub-then-snap line).
- **US3 — inspect + a11y.** The "you are here" / "last clear read" **popup** (hover · focus · tap),
  the **parked now-marker** (muted + static during a no-read with a prior confident reading), full
  keyboard operability, **outside-tap / second-tap dismiss**, ≥44×44px touch hit-area, and
  reduced-motion (pulse → static halo; fades are static opacity, not animation). Honest **subtitle**
  fork (neutral "No clear read right now" during an active no-read / all-skipped; "getting a read"
  while warming).
- **Event-driven refresh fix (T011a).** The orb/trend lag is fixed by a new `refreshSignal` prop:
  `monitoring-session.tsx` bumps a counter on each **persisted** window outcome (reading /
  scored-warming / skipped — **not** `superseded`), and `session-trend.tsx` re-fetches
  `getSessionTrend` immediately on each bump while the ~12 s poll stays as the steady-state backstop.
  The marker stays sourced from the persisted row (committed before the window POST returns), so
  there is no optimistic value and no marker-vs-step-line mismatch.
- **#117 out-of-frame staleness fix.** The parked marker no longer disappears on the single-reading →
  out-of-frame edge case (a silent-empty `getSessionTrend` refetch guard), and the freshness horizon
  was re-tuned **20 s → 60 s** — derived from named constants `STRIDE_MS + PROCESSING_CEILING_MS +
  POLL_MS + FRESHNESS_MARGIN_MS` (10+30+12+8) and guarded **two-sided**: the threshold must exceed
  the worst-case healthy read age (~52 s, so a live read is never false-parked) **and** stay below
  `WINDOW_MS` (120 s, so a genuinely stale reading still scrolls off). Live-confirmed in the ST-7
  re-run.

**Test results** (`apps/web`, 2026-06-27):

- Vitest: **726 passed / 70 files**, 0 failed (`--pool=threads` on Windows per project memory; CI
  runs the same suite on ubuntu).
- `npm run lint`: **clean (0 errors)** — the prior 2-error `monitoring-session.tsx` baseline was
  cleared in **PR #94** (2026-06-25), so this branch is fully green, not riding a baseline.
- `tsc --noEmit`: **green**.

**Gates**:

- ✅ Smoke gate — `specs/010-monitoring-graph-redesign/smoke-tests.md` **signed off by Mohamed
  (PASS, ST-1…ST-7)** (Constitution VII / gate 5): band colour+height in light/dark, fixed-px true
  circles / no totem stretch / matched-pair at 360px & ~768px, ramp-up fill-to-width → continuous
  lock → scroll-off, keyboard focus + popup + tap-toggle + ≥44px touch, reduced-motion, now-marker
  freshness in lockstep with the bloom, and the honest warm → read → out-of-frame → return journey.
  **ST-7 was re-run after the #117 fix** and passed.
- ✅ Typecheck / Vitest / Lint — all green (counts above).
- ✅ Squash-merge — merged via **PR #118** (`6b8653e`, 2026-06-27); feature branch deleted
  (local + remote). The dev harness route used for real-CSS width measurement was deleted before
  merge. No `/speckit-analyze` blocker arose (no analyze finding required a resolution on this
  branch).
- ✅ Governance (Amendment 9) — **#117** opened-on-discovery / closed-on-fix in the same change
  (now CLOSED); the foggy-gate trigger remains back-referenced in the open **#100**.

**Privacy invariant**: untouched — **frontend-only** (the merge diff touches only `apps/web/*` +
`docs/*` + `specs/*` + `CLAUDE.md`; **no `apps/api` / data-layer / migration change**). No new read,
no probability on the wire, SELECT whitelist (`id, captured_at, scored, band, skip_cause`) + the
RLS-as-user reader intact; the live graph shows **no numeric value of any kind** (FR-017 / SC-007).

---

## Tooling — Dependabot switched to security-updates only (version updates OFF)

**Branch**: `chore/dependabot-security-only` — config correction PR **open for squash-merge** (CI
green: it touches one YAML + two docs, no lint/typecheck/test surface). **Date**: 2026-06-25.
Follows up the security-pass closeout (PR #101): that `dependabot.yml` read as "security only" but
`applies-to: security-updates` only **groups** security PRs — it doesn't scope the block, so version
updates stayed on and opened five unsolicited bumps (#102 react-dom · #103 radix · #104
react-hook-form · #105 lucide-react · #106 eslint). Set **`open-pull-requests-limit: 0`** on all three
blocks (npm `/`, pip `/apps/api`, pip `/packages/ml-video`) — disables version-update PRs while
security updates keep flowing (separate internal limit of 10) — and added **`labels: []`** so
Dependabot stops stamping its off-taxonomy `dependencies`/`javascript` labels. `groups`/`ignore` left
byte-for-byte unchanged. Rationale + the two failure modes (eslint 9→10 major; react/react-dom
exact-pin skew) in `docs/DECISIONS.md` 2026-06-25. **Post-merge**: close #102–#106 as unintended
(Dependabot won't reopen them with version updates off); leave alert #10 (postcss) open.

---

## Tooling — Security/CI pass closeout (Dependabot triage · protobuf accept-and-document · dependabot.yml · DECISION-20 fix)

**Branch**: `chore/security-pass-closeout` (this docs + config entry) — closes the security/CI
pass whose code landed across **PRs #94/#96** (CI + governance) and **#97/#98/#99** (Dependabot
patches), all already merged to `main`.
**Status**: docs + config PR **open for squash-merge**; CI green on it (docs + a YAML — the
lint/typecheck/test layer is unaffected). Two post-merge steps remain (Part 2 below).
**Date**: 2026-06-25

The closeout of the first security/CI pass on the repo. Nothing in this entry changes runtime
behaviour — it is the CI standup + the Dependabot triage outcomes + the governance record.

- **Phase-1 CI stood up + lint baseline cleared (PR #94, squash `3ee89a3`; BACKLOG/issue sync
  PR #96).** `.github/workflows/ci.yml` runs the cheap hermetic layer (lint · typecheck · Vitest
  for **web**; `ruff` · `pytest` for **python**) on every PR into `main` + push to `main`. First
  run green (web: lint 0 / `tsc` clean / Vitest 641 passed; python: ruff clean, pytest 0 failures
  + the expected ffmpeg/Supabase skips). The 2-error `monitoring-session.tsx` lint baseline was
  cleared via documented targeted suppressions — **#87 closed by-design / not-planned** (the
  camera-lifecycle refactor was declared out of scope; the rules stay globally active). Landed
  **non-blocking** on purpose. Full detail in the entry below.
- **Dependabot triage → 14 in-range security alerts cleared (PRs #97/#98/#99).** A read-only
  triage of all 17 alerts split them 14 CLEAN / 1 NEEDS-CARE / 2 BLOCKED-by-pin. The 14 clean
  in-range bumps landed as three hand-reviewed PRs: **#97** python-multipart `0.0.31` +
  cryptography `48.0.1` + pydantic-settings `2.14.2` (clears alerts #2/#3/#4/#5/#6/#9); **#98**
  the npm dev/test toolchain ws/vite/esbuild/js-yaml/@babel/core (clears #11/#12/#13/#14/#15/#16,
  all dev/test-only — never in a shipped path); **#99** starlette `1.1.0 → 1.3.1` (clears #7/#8;
  in-range under fastapi's `>=0.46.0`, no parent bump). Dependabot now reports **14 `fixed`**.
  (The earlier hand-off note said "15 patched" — the authoritative live count is **14**.)
- **protobuf high (Dependabot #1 `apps/api` + #17 `packages/ml-video`): accept-and-document.**
  The fix floor is protobuf 5.29.6, but `mediapipe==0.10.13` requires `protobuf<5` and there is
  no 4.25.x patch — so the fix is **out of range** (and `uv sync --locked` can't even resolve it).
  Every mediapipe that admits protobuf ≥5 (0.10.30+) drops the legacy `solutions.face_mesh` API
  the pipeline uses → taking it is a feature-extraction rewrite + model re-validation (~2–6 days,
  into the thesis deliverable). The CVE is a JSON-parse recursion DoS; the pipeline only feeds
  mediapipe its own internally-generated binary protobufs (no attacker-controlled JSON on any
  surface) → **not reachable**. **Decision: accept-and-document** (tolerable risk), revisit only
  on a deliberate ML-stack upgrade; the served-path-vs-notebook fidelity check is the re-validation
  backstop. Recorded in `docs/DECISIONS.md` 2026-06-25.
- **`.github/dependabot.yml` added.** Grouped **security-updates only**, weekly, **no auto-merge**:
  one group per ecosystem (npm `/`, pip `/apps/api`, pip `/packages/ml-video`). The load-bearing
  ML pins (`protobuf`, `mediapipe`, `opencv-python`, `scikit-learn`, `numpy`) are `ignore`d on the
  pip ecosystems so the un-takeable protobuf bump stops being re-proposed, and Next-pinned
  `postcss` is ignored on npm (handled separately). The ignore list is kept tight — fastapi /
  starlette / python-multipart / cryptography / pydantic-settings / uvicorn flow through.
- **DECISION-20 correction (CSP now enforced).** DECISION-20 still described the capture-route
  CSP as report-only with the enforce flip open as T004, but `apps/web/proxy.ts` serves the
  policy **enforcing** (`CSP_HEADER = "content-security-policy"`; `buildCsp` scopes
  `'wasm-unsafe-eval'` to `/onboarding`, `/app/calibrate`, `/app/monitor` only). Appended a dated,
  append-only correction in `docs/DECISIONS.md` 2026-06-25 pointing to the enforcing code +
  `docs/security/05-csp-header.md`.
- **End-to-end smoke passed on merged `main`.** A real stress-detection cycle ran clean against
  merged `main` (calibrate → live monitor → a band reading persisted → recap). The first smoothed
  read arriving at **~1m45s** is the **designed cold-start gate** (the band is the rolling mean of
  the last 4 scored ~60 s windows, so the first band lands ~90–105 s in) — **not** a regression.
- **Governance / BACKLOG↔Issues (Amendment 9).** One new BACKLOG item + its mirrored issue: a
  read-only diagnostic for the live-monitor "not in frame" vs "couldn't get a clear read"
  surfacing gap (does the pipeline distinguish *absent* from *present-but-low-confidence*?). The
  monitoring-graph redesign (a roadmap slot, next session) and the starlette→httpx TestClient
  deprecation (Mohamed chose to skip) were **deliberately not filed**.

**Remaining — Part 2 (post-merge tidy, after this PR squash-merges):**

- **Dismiss Dependabot alerts #1 + #17** as tolerable risk (pointing at the DECISIONS entry) so
  the alert list matches reality. **Leave #10 (postcss) open** — deferred, not accepted.
- **Flip CI to required status checks.** Add the `web` and `python` jobs as required checks on
  the `main` branch-protection rule (the rest of slice-0 protection unchanged), now that green
  runs have accumulated. Record it in `docs/security/00-branch-protection.md`.

---

## Tooling — Phase-1 CI (unit-test layer) + lint baseline cleared

**Branch**: `chore/ci-unit-test-layer` → **merged to `main`** via **PR #94** (squash `3ee89a3`, 2026-06-24);
branch deleted (local + remote). The BACKLOG/issue sync (this entry included) followed on a companion docs
branch.
**Status**: **merged**; first CI run **green**.
**Date**: 2026-06-25

Stood up the **first CI** for the repo — a single phase-1 GitHub Actions workflow (`.github/workflows/ci.yml`)
running the cheap, hermetic layer (lint + typecheck + unit tests) on every PR into `main` + push to `main`
(+ `workflow_dispatch`) — and cleared the 2-error ESLint baseline that would otherwise have made the first run red.

- **web job** — Ubuntu, Node **22.11.0** (pinned for the Vitest happy-dom `<22.12` workaround) + npm cache →
  `npm ci` at root → `apps/web` **lint / typecheck / Vitest** as separate steps (later steps gated on
  `!cancelled()` so every failure surfaces in one run).
- **python job** — Ubuntu, `uv` (cached) @ Python **3.12** → `uv sync --locked` for `packages/ml-video` then
  `apps/api` (editable `ml-video`) → **`ruff` + `pytest`** for each. Minimal `libGL`/glib libs for the
  `opencv-python` import (defensive — already pre-present on the current `ubuntu-latest` runner, so the apt step
  was a no-op; kept as a guard per Mohamed); **ffmpeg deliberately not installed**, so the ffmpeg/fixture-gated
  tests `skipif`-skip (the intended CI behavior).
- **Lint baseline cleared** — the 2 known errors in `components/monitor/monitoring-session.tsx` (reactive
  `srcObject` assign; `stopStream()` in the standing release effect) got documented, targeted
  `eslint-disable-next-line` suppressions; both rules stay **globally active** (a fresh probe violation of each
  still errored). `npm run -w apps/web lint` → true zero.

**Excluded (by design)**: no coverage gate, no `next build`, no Playwright/e2e, no Supabase service container, no
secrets. Ref-keyed concurrency (cancel-in-progress) + least-privilege `contents: read`. **Not marked required** —
landed non-blocking to confirm green first; branch protection untouched.

**First-run results**: web — lint 0, `tsc --noEmit` clean, **Vitest 641 passed / 69 files**; python — `ruff`
clean in both workspaces, **pytest 0 failures** with the expected skips (`ml-video` 4 ffmpeg/fixture, `apps/api`
1 local-only Supabase replay).

**Governance / BACKLOG↔Issues (Amendment 9)**: opened + closed **#95** (CI standup) 1:1; closed **#87** (lint
baseline) **as not-planned / by-design** — we documented the intentional suppressions rather than doing the scoped
camera-lifecycle refactor. Both mirrored in `docs/BACKLOG.md`.

**Next (out of scope here)**: Dependabot triage; the stale DECISION-20 correction; promoting the checks to required
once trusted; phase-2 CI (app build / Playwright e2e / Supabase-backed integration).

---

## Feature 009 — Today-Card Stress Trend Redesign (merged to main)

**Branch**: `009-today-card-trend-redesign`
**Status**: **merged to `main`** via **PR #25** (squash `4e51c8f`, 2026-06-23); feature branch
deleted (local + remote). Frontend-only redesign of the employee dashboard today check-in card's
collapsed + expanded stress-trend surfaces + session timeline, consuming the existing read layer
unchanged (no data-layer / RLS / SELECT-whitelist change; no probability to the client). Shipped:
the **collapsed** glanceable mini-trend + the **expanded** axis-labelled lane plot (no legend) on
**fixed-pixel SVG rendering** (DC-001: 1 SVG unit = 1 screen pixel, no stretched viewBox — the
totem bug the prior build hit); an **honest three-level headline** ("at ease" / "a little tense" /
"tense") with a recovery branch + **partial-easing honesty** ("eased a little" when recovery never
reaches calm); and the **T031** first-paint width-flash fix (measure-then-render, zero CLS). US1–US4
+ the Phase 8 headline rework + the Phase 7 Polish run (T024–T028 + T031) all landed. Governance:
Mohamed's hand-run smoke gate PASSED (ST-1…ST-6); `/speckit-analyze` findings C1/C2/C3 resolved
on-branch — **constitution v1.5.2 / Amendment 7** ratifies the inline-SVG carve-out for bespoke
affective micro-viz (Recharts stays the locked default for standard dashboard charts).
**Date**: 2026-06-23

**Polish run shipped (T024–T028 + T031)**:

- **T031 — first-paint width-flash fix (the one runtime change).** The fixed-px lane plot fell back
  to `DEFAULT_AVAIL` (1008) until the wrapper was measured, so on a narrow viewport the SVG painted
  wide/overflowing for the paint(s) before measurement snapped it. Fix is **measure-then-render**
  (`today-trend-plot.tsx`): the measuring wrapper always mounts (so `attachWrap` still reads its
  width) but the SVG renders only once the width is known (`availableWidth != null || measured != null`);
  until then a **height-reserving placeholder (= PLOT_H)** holds the slot, so the swap shifts nothing
  vertically (**zero CLS**). Guarded by two new `test:layout` assertions — a **JS-disabled SSR-state
  check** (no `plot-svg` exists; placeholder reserves PLOT_H) + a settled no-CLS height check. The
  JS-disabled approach freezes the un-measured first paint deterministically (no hydration /
  ResizeObserver), avoiding a flaky single-frame capture.
- **T024 — clean-swap audit.** `today-view.tsx` confirmed orphan-free (single render path, no
  pre-`[3]` remnants); `todays-checkin-card.tsx` wiring unchanged (still loads recap+trend
  RLS-as-user → renders `<TodayView>`); the us4 card-branch slice strengthened to assert the
  redesigned surfaces (collapsed mini-trend → expanded axis-labelled plot, no legend).
- **T025 — role e2e.** New `employee-dashboard-shell.spec.ts` case seeds a calibrated employee +
  retrospective session and asserts the today card expands in place to the four-label left axis with
  **no** bottom legend (SC-001), then collapses — verified green on chromium.
- **T026 — `smoke-tests.md` authored** (Mohamed's hand-run visual gate: amber tokens, 360px
  no-stretch scroll, no first-paint flash, keyboard a11y, reduced motion, day-honesty).
- **Fold-in** — plot unit tests pass `availableWidth={1000}` (≠ the 1008 default) so the width reads
  as an input, not the fallback.

**Test results** (apps/web, 2026-06-23):

- Vitest: **641 passed / 69 files**, 0 failed.
- `test:layout` (real chromium, no DB): **5 passed** — the DC-001 360px-tighten guards + the two new
  T031 first-paint / no-CLS guards.
- e2e `employee-dashboard-shell.spec.ts`: **3/3 passed on chromium** (incl. the new T025 recap case).
  Chromium-only this run (local Supabase up); firefox/webkit not run to avoid the documented
  suite-wide load-timing flakes (not this diff).
- `tsc --noEmit`: **green**.

**Gates**:

- ✅ Lint — `npm run lint` reports the **2 known pre-existing** `monitoring-session.tsx` errors
  (223:39 reactive-srcObject, 560:5 setState-in-effect), **0 new** from this run.
- ✅ Typecheck / Vitest / test:layout / e2e — all green (counts above).
- ✅ Smoke gate — `smoke-tests.md` **signed off by Mohamed (PASS, ST-1…ST-6)** (gate 5). The T028
  quickstart desktop+360px visual walk is carried by that smoke checklist.
- ✅ `/speckit-analyze` + squash-merge — analyze findings C1/C2/C3 resolved on-branch (plan.md →
  v1.5.2, spec.md status flipped, constitution **Amendment 7** + CHANGELOG catch-up); **squash-merged
  via PR #25** (`4e51c8f`, 2026-06-23); feature branch deleted (local + remote).

**Privacy invariant**: untouched — frontend-only; no new read, no probability on the wire, SELECT
whitelist + RLS-as-user intact (SC-008/SC-009).

---

## Feature 008 — Stress Inference Service (merged to main)

**Branch**: `008-stress-inference-service`
**Status**: **merged to `main`** via **PR #23** (squash `6ae3b1e`, 2026-06-22); feature branch
deleted (local + remote). Feature-complete and human-validated before the merge. The live video
stress-inference read path (the committed
`serenify-video-lbptop-motion-rf-calibrated@2.0.0` + `predict_delta` + the shared 2958-d
extraction) is wired end-to-end: **continuous capture → server tail-extract of the last 60 s →
per-user-calibrated RandomForest on LBP-TOP + motion → a smoothed three-band read (no probability
exposed)**, with a session-aware `apps/api` lifecycle, per-window persistence under RLS, a
calibrate-first gate, and the monitoring + dashboard UI. **All 57 tasks done (T001–T059; T018
removed under continuous single-stream); US1–US4 + Phase 8 polish complete.** The Phase 8 smoke
matrix (T054) ran on real Chrome / Firefox / iPhone Safari; the **two silent breaks it surfaced
were fixed in-branch and server-side-verified before merge** (PATCH-CORS persistence +
stale-token-401 — see "Pre-merge fixes (server-side-verified)" below). Tests green: **apps/api 90,
apps/web 575, ml-video 55** (`tsc --noEmit` green). Security posture untouched (no service-role
key, RLS-as-user, SELECT whitelist hides `label`/`stress_probability`, no probability on the wire,
explicit non-wildcard CORS). Constitution Check at plan time: **PASS** with one logged, justified
deviation (per-window HTTP request/response transport instead of WebSocket — the prediction is the
synchronous response to an upload, not polling); no NON-NEGOTIABLE principle violated. Remaining
work tracked on `008-followups` (L1 live cross-expiry smoke retest, L2 lifecycle-PATCH fresh-token,
ST-08-2 iOS live readings on an HTTPS deploy, R-5 perf, the 2 non-blocking `monitoring-session.tsx`
lint errors).
**Date**: 2026-06-22 (merged to `main`; implementation spanned the 008 cycle; planning closed 2026-06-19)

**Windowing in force**: **continuous single-stream upload + server tail-extract**.
One continuous `MediaRecorder` (timeslice for incremental capture only); each stride
uploads the contiguous recording-so-far, and the server extracts the trailing 60 s
with the validated single-clip path (`compute_anchor` + the VFR `POS_MSEC` sampler).
The scored 60 s window is **faithful by construction**, so there is **no fidelity
gate** — both D-2 windowing fallbacks (B1 container-reassembly, B2 multi-clip
frame-concat) were rejected during planning (CHANGELOG 2026-06-19).

**Shipped so far**:

- **US1 — live stress read (P1 / MVP).** `submit_window` scores a window (rolling
  mean of `proba[1]` over the last 4 readings, bands 0.53 / 0.70, ~90–105 s
  cold-start) and persists `window_readings` **under RLS as the user**, with raw
  `stress_probability`/`label` held server-only via the SELECT column whitelist; the
  monitoring UI renders the band as a calm bloom + cause chip, a **warming-up** state
  before the first smoothed read, and a foggy **"skipped a read"** note on a thin
  window (never the out-of-frame surface). **FR-024** reassurance footnote —
  "Processed just for you — analyzed, then deleted." — added to the live reading card
  (commit `3ac7eeb`, resolving /speckit-analyze U1).
- **Keep-up SOLVED — Option 1 (surgical O(stride) tail-decode)** (commit `1ef0c0c`).
  The flagged "known cost" (decode-to-tail grows O(elapsed)) became real: a supervised
  smoke measured live lag growing ~9 s/window to ~3 min behind. Fixed in
  `packages/ml-video` only — a cheap ffprobe **packet** read recovers the file-global
  2.5 fps grid + duration without a full walk, then only the trailing 60 s is decoded
  (OpenCV native `cap.set` seek for mp4; an **ffmpeg `-c copy`** lossless tail remux for
  un-finalized webm, whose `cap.set` seek is a silent no-op that rewinds to t=0) and
  matched back to the file-global grid → the **identical suffix** the whole-file path
  keeps. GATE 1 fidelity: **bit-identical** (max|Δ|=0, cosine=1.0) on the real
  chrome+safari continuous fixtures. GATE 2 keep-up: per-window total **O(elapsed)
  18→55 s → O(stride) flat ~9–13 s**. New host dependency: **ffmpeg/ffprobe CLI**
  (Dockerfile + `apps/api/README.md`); absent → graceful fallback to the whole-file
  decode (correct, O(elapsed)); runs-but-fails on a clip → skipped window (200), never a
  500. **Re-measured on a representative Azure VM (Standard_D2s_v4, 2 vCPU): ~7–8 s/
  window — comfortably under the 10 s stride — and fidelity stayed bit-identical on the
  VM's older apt ffmpeg.** **Option 2** (full per-session rolling decoded-frame buffer —
  decode only the newest ~10 s increment) stays the deferred upgrade, built only if
  keep-up re-measured on the chosen deploy target breaches the stride there. (DECISIONS
  2026-06-21; `docs/BACKLOG.md` feature-008 keep-up entry.)
- **US2 — session control & presence (P2).** Backend lifecycle routes
  `PATCH /monitoring/sessions/{id}` (pause/active/out_of_frame) + `POST .../end`
  (ended_at + status + end_reason), RLS update-own, `ended` terminal with a clean
  **409 (not 500)** on an already-ended session and on-end smoothing-buffer eviction
  (commit `4c18dec`). Frontend presence machine driven by the **same** feature-005
  framing signal that gates uploads: 90 s no-face → out-of-frame, 5 min from face-loss →
  auto-end, manual Pause (releases camera) / Resume (re-acquires, reuses the session) /
  End, foggy out-of-frame + calm paused surfaces, status-driven pill + forced
  foggy-bracket self-view, and a re-end race collapsed onto one caller that maps the
  backend 409 → ok (commit `dbaaae4`).
- **US3 — calibrate-first guard (P2).** Create-time `no_anchor` 409 (T021) plus the
  mid-session defensive re-check: `submit_window` catches `MissingAnchorError` and
  returns the same `409 {"outcome":"no_anchor"}` (never a 500, never a reading without
  the user's own anchor); the client disambiguates the overloaded 409 by body
  (`no_anchor` vs `ended_session`) and routes mid-session no-anchor to the existing
  calibrate-first surface (commit `e49b82e`, SC-004).
- **Edge-case pass (2026-06-21) — one active session per user (C1/C2 fix).** A scoped
  read-only audit over US1–US4 surfaced two real gaps in the **built** lifecycle: an
  orphaned `active` session (client-driven end → a crash leaves `ended_at` NULL forever,
  also shadowing the recap's "most-recent ended session" read) and no concurrency guard
  (two tabs → two parallel active sessions). Fixed structurally: partial unique index
  `(user_id) WHERE ended_at IS NULL` (migration `20260621000000`, with a backfill that
  finalizes pre-existing duplicate actives) + a **last-tab-wins** create route that
  finalizes a prior active session as `'abandoned'` (stamped at its last reading, or now())
  before starting a new run, with a one-shot finalize+retry on the index race — no
  service-role, RLS + SELECT whitelist unchanged. TDD; full `apps/api` suite green; the
  migration applied + the local replay regression re-verified on real Postgres. The
  remaining audit items (timezone, empty/degenerate sessions, n=1 render, in-progress
  treatment, has_anchor branching) were **decided** and recorded as **US4 read-rules**
  (DECISIONS 2026-06-21; `data-model.md` § Reads) — they bind the deferred T046–T050 build,
  no read-path code today. The privacy "watch hardest" item (D1) was found already
  structural at the DB engine (column-GRANT whitelist), robust as-is.

**Shipped (US4 + Polish — completing the build)**:

- **US4 — retrospective trend, recap & 009 seam (P3, T046–T050).** The dashboard check-in card
  recaps **today** and **expands in place** (no route change) to a day trend + per-session
  breakdown from the **same** persisted rows (SC-008); skipped points render as a **gap** (never a
  fabricated or carried-forward reading), a read-less session reads **"no clear read"** (never
  calm), an n=1 session renders as a **single dot**, the axis **auto-fits in local time**, the
  live session is excluded (retrospective-only), and the empty/calibrate-first states branch on
  `has_anchor`. The **FR-020 009-seam** is confirmed (persisted `window_readings` carries
  `band`+`captured_at`+`session_id` for 009's sustained-tense query; **no** questionnaire
  trigger/UI built in 008).
- **Polish (T051–T058).** Playwright employee happy-path e2e (feature-005 detector-injection
  seam), webm/VFR codec fidelity hardening, responsive/a11y sweep (≥360 px stack, reduced-motion,
  visible focus, ≥44 px targets), expanded `smoke-tests.md` (real Safari/iOS), the
  privacy-verification test (no raw video persists; no manager policy; `label`/`stress_probability`
  unreadable by the owner), the model-owner `metadata.json` carry-over note, the 90-day-retention
  follow-up note, and the full Principle VII sweep — **all done**.

**Pre-merge fixes (server-side-verified)** — the two **silent** breaks the Phase 8 smoke surfaced,
fixed **in-branch before merge** (visible/cosmetic findings routed to `008-followups`):

- **PATCH-CORS — lifecycle transitions now persist** (commits `7c1c1f4` fix + `241b296`
  regression). The API CORS config did not allow `PATCH`, so the browser preflight for the
  monitoring lifecycle PATCH (pause/resume/out_of_frame) failed and the status transition never
  reached the DB — with no error surfaced. Verified server-side: the DB status now walks
  `active → paused → active → out_of_frame → ended`, with the 409-on-ended terminal and the
  one-active-session finalize intact.
- **Stale-token 401 — long sessions keep scoring; no silent frozen band** (commits `c434942`,
  `5b2d6ff`, `62d387f`, `40771fc`). A window upload on a cached, expired access token got a 401 the
  client swallowed → the bloom silently froze. Fixed via **approach A**: a fresh token per window
  upload through the `deps.getSession()` seam (the Supabase browser client auto-refreshes near
  expiry), plus an **honest signed-out surface** (`SESSION_EXPIRED` → re-auth, never a frozen band)
  on any un-refreshable session. RLS-as-user posture unchanged (still the user's own token, just
  current). (DECISIONS 2026-06-22 — *approach A*.)

**Deferred to `008-followups`** (the merge is done — PR #23, squash `6ae3b1e`):

- **ST-08-2 (iOS live readings): PENDING a real HTTPS deploy.** Capture / upload / decode are
  proven on a real iPhone (device gate T009); the free quick-tunnel can't carry the growing
  continuous uploads, so the *live cross-session reading* cell is unconfirmed — a transport limit,
  **not** a capture failure.
- **Known followup L1 — live cross-expiry smoke retest.** The cross-expiry continuation is proven
  by composition (SDK refresh + server accepts fresh token + per-upload fresh fetch); the silent
  freeze is gone, but the live run against an aged session goes on the next smoke checklist.
- **Known followup L2 (→ `008-followups`).** The pause/resume/end lifecycle PATCH calls still read
  the cached token (a narrower instance of the stale-token class) — route them through the same
  fresh-token helper. (DECISIONS 2026-06-22 — *Known followup L2*.)
- **Perf (R-5): deferred.** The full per-session rolling decoded-frame buffer + startup pre-warm +
  a dedicated inference host stay deferred; the surgical O(stride) tail-decode (`1ef0c0c`) meets the
  10 s stride on a representative Azure VM. Build only if keep-up re-measured on the chosen deploy
  target breaches the stride there.
- **Lint (non-blocking).** `npm run lint` is RED on **2 pre-existing errors in
  `monitoring-session.tsx`** (200:39 reactive-value mutation; 492:5 setState-in-effect cascade)
  from the camera-lifecycle fix; `tsc --noEmit` is green (the prior 6 `monitoring-client.test`
  errors were fixed in `e461385`). Routed to `008-followups`.

**Decisions resolved (planning snapshot)** (DECISIONS 2026-06-19, as **amended** the
same day after review; **D-2's segmented + B2-fallback windowing was later reversed to
continuous single-stream upload — see "Windowing in force" above and CHANGELOG
2026-06-19; the rest stands**): **D-1 (revised)** self-scoped `SECURITY DEFINER`
`get_my_anchor()` read in
the caller's RLS context — **no service-role key** (anon key + forwarded JWT);
sessions/readings written under RLS as the user; write-integrity deferred (upgrade
path = INSERT-only role). **D-2 (revised)** single-recorder ~10 s segments +
**server-side** rolling 60 s assembly (flagged: container-level reassembly required;
Safari spike de-risks it; B2 = multi-clip extraction fallback). **D-3** rolling mean
of `proba[1]` over last 4 scored readings, bands at 0.53 / 0.70 (operating point
from metadata; tense-split a display-only config), cold-start 4 → first band
~90–105 s. **D-4** `monitoring_sessions` + `window_readings`, owner SELECT-own with
raw probability/label held server-only, no manager policy, 90-day retention, FR-020
seam for 009. Seven mock-gap resolutions folded in (CHANGELOG 2026-06-19):
warming-up 7th state, ~90 s first read, distinct foggy skipped-read note,
calibrate-first panel, mobile stacking, ended→dashboard recap, idle recap empty
state. Front-loaded: **Safari/WebKit early-validation spike (R-7)**. Flagged:
`metadata.json`'s stale `window_eval_config` (30 s) is not the production window
(60 s locked; doc-only cleanup, no model-version bump / no anchor invalidation).

---

## Feature 007 — Visual Redesign (Graphite) (merged to main)

**Branch**: `007-visual-redesign`
**Status**: **merged to `main`** via **PR #22** (squash `0b71d4a`, 2026-06-18). Implementation
complete (Phases 1–3 / T001–T031); **`smoke-tests.md` signed off by Mohamed 2026-06-18 — all 11
checks PASS**; all gates green. Feature branch deleted (local + remote).
**Date**: 2026-06-18 (close; implementation spanned the 007 cycle on the branch above)

**Scope shipped** — a re-skin + re-type of the entire `apps/web` app onto the deepened **Graphite**
palette, **implementing** Constitution v1.4.0 **Amendment 4** (it implements, it does not
re-litigate, the ratified hexes / typefaces / contrast rules). Recolour + re-type + a small set of
targeted changes + two bespoke animated components only — **no behavioural rewrite** (FR-001/FR-004):
no app logic, routing, data model, Supabase, ML, API-contract, or auth-logic change, and no new
runtime dependency beyond the self-hosted fonts.

- **Phase 1 — frozen foundation (serial, T001–T008).** Swapped the nine `@theme` role token
  **values** to Graphite (names unchanged → auto-propagates every token-driven surface + `/10 /15 /50`
  opacity variants); added three real `@theme` tokens — `--color-on-accent` (`#F8F9FA` light),
  `--color-meadow-text` (`#346A56` / `#63B292`), `--color-scrim` (graphite ink @ 60%, fixed both
  modes); overrode three type-scale steps (`--text-xs` 13 / `--text-base` 17 / `--text-4xl` 38) for
  the locked 8-step scale with a 17px base body — **mechanism = override Tailwind v4 `--text-*`**
  (research R-1; zero call-site churn across 149 sites); wired **Outfit** display + kept **Inter**
  body, retiring **DM Serif Display**; fixed the filled meadow/foggy CTA foreground at the button
  primitive (`text-ink` → `text-on-accent`, keep `dark:text-bg`); lowercased the **`serenify`**
  wordmark (no dot) in all three locations; confirmed the dark `--shadow-soft`.
- **Phase 2 — surfaces + two bespoke components (parallel, disjoint scopes, T009–T020).**
  Re-skinned auth / onboarding / dashboard / account / full calibration flow / shared primitives /
  nav shell; migrated small meadow text → `--color-meadow-text`; amber error notices → **foggy**;
  re-tokenised the three raw-black scrims → `bg-scrim`; dark-mode dropdown contrast fix. **OTP**
  redesigned from a single box into the **six-box merge** (`otp-panel.tsx` + new `otp-boxes.tsx` /
  `otp-notice.tsx`) — numeric inputmode, auto-advance, paste-fills-six, foggy wrong-code sway, success
  merge-into-pill → fade-out, reduced-motion via `useMediaQuery`; **props frozen, verification logic +
  backend unchanged**. **Breathing orb** rebuilt as a layered meadow bloom replacing the inline
  `backdropFilter` frost (no glassmorphism remains); preview-hugging progress **bar** (not a ring);
  state-coloured framing brackets (meadow/foggy). Behaviour tests for both bespoke components.
- **Phase 3 — integration, verification & docs (serial, T021–T031).** Preserved-States Checklist
  walk (both modes × 3 roles); WCAG AA both modes; zero-glassmorphism grep → 0; colour-literal +
  typeface sweeps; errors=foggy sweep; 360px + reduced-motion; docs + smoke sign-off + cleanup.

**Closing pass (2026-06-18)** — resolved the one finding from `/speckit-analyze` and reconciled drift:

- **C1 (Principle VI fix).** The one-line OTP boxes measured **42.33px** wide at 360px — below the
  ≥44×44px touch-target floor. Tightened the OTP gap + panel padding responsively (`gap-1.5 sm:gap-2`,
  `px-3 sm:px-4`; OTP files only) → re-measured **45.33px @360 / 50.33 @390 / 52 @414**, still one
  line, merge/sweep/fade/wrong-state unchanged.
- **Doc reconciliation.** Corrected now-false `spec.md` / `smoke-tests.md` wording: OTP "may wrap" →
  "shrink to one line (no wrap, ≥44px)"; success "lifts toward the next step" → "fades out (no lift)"
  (the build followed the FR-027 mock, whose `.lift` class is `opacity:0`); re-signed ST-4/ST-6. Added
  FR-002 items **(7)** intro foggy→meadow accent refinement and **(8)** failure/access retry-CTA trim,
  making the two logged smoke refinements traceable (resolving the FR-003 tension).
- **Cleanup.** Deleted the three untracked 007 mocks (FR-036); removed the dead `anchor/countdown.tsx`
  + its test (only its own test imported it; the live countdown is `GetReadyCountdown`).

**Test results** (closing pass, 2026-06-18):

- Vitest: **457/457 in 49 files** (the 3 dead `countdown` tests removed with the component).
- Typecheck (`tsc --noEmit`): 0 errors. Lint (`eslint`): 0 warnings.
- Playwright e2e: **chromium + firefox fully green** (all specs, 3 roles, OTP, 360px); **webkit green
  on re-run** — one pre-existing `employee-dashboard-shell:48` load-timing flake (password-update
  aria-status; passes in isolation / under CI `retries:2`), unrelated to this diff; the changed OTP /
  auth surfaces pass on all three browsers. (A transient three-runners-on-one-Supabase collision and a
  Windows-webkit IPC wedge were diagnosed and cleared mid-run — environmental, not product; consistent
  with the documented suite-wide load-timing flake.)

**Gates**:

- ✅ Constitution Check — implements Amendment 4; Principles V, VI, VII, VIII addressed in `plan.md`;
  Principle I privacy note (capture **rendering** only — no signal capture, transport, or aggregation
  change).
- ✅ Test gate — all suites + typecheck + lint green locally (webkit flake per above).
- ✅ Smoke-test gate — **signed off by Mohamed 2026-06-18; all 11 ST PASS** (ST-4/ST-6 re-signed to
  as-shipped after the C1 fix + reconciliation).
- ✅ **Merged to `main`** — PR #22 (squash `0b71d4a`, 2026-06-18); feature branch deleted.

**Decisions logged in DECISIONS.md**: the 2026-06-17 Amendment-4 block (palette → Graphite, Outfit,
filled-accent foreground, amber soft-tint, type scale, orb bloom, 007 isolation) + the 2026-06-18
as-built block (type-scale mechanism = override `--text-*`; `--color-on-accent`; `--color-meadow-text`;
errors=foggy; `--color-scrim`; dark `--shadow-soft`; dropdown soft-tint; OTP fade-out-not-lift; intro
meadow-accent refinement). Spec deviations recorded in CHANGELOG.md (2026-06-18).

**Branch commits (close)**: `d85d524` C1 OTP gap fix → `14e9deb` reconcile wrap/lift wording + trace
smoke refinements → `8462ad7` remove mocks + dead countdown → `888d6e1` mark Phase 3 complete.

**Next**: feature 008 — stress-inference-service (the live inference read path consuming `anchor_vector`
as the per-user delta baseline that 005 calibrates).

---

## Fix — VFR-webm decode mis-sampling (timestamp-driven frame sampling)

**Branch**: `fix/webm-vfr-decode-sampling` → **merged to `main` via PR #18** (`6e85484`,
2026-06-16).
**Status**: code validated; this entry is the implementation record. Full rationale in
**📌 DECISION-29**.
**Date**: 2026-06-16.

**Chronology (the thesis narrative)** — how a latent fidelity bug was found, diagnosed, and
fixed:

1. **Surfaced by an end-to-end smoke, not a unit test.** Feature 006's usable-face-coverage
   gate **smoke test** showed an **intermittent false-reject**: a good baseline clip passed on
   one run and was rejected on the next. The unit suite was green throughout — it exercised
   CFR synthetic clips, on which the legacy sampler is correct, so it structurally could not
   see the bug.
2. **Diagnosed to VFR container metadata.** Instrumenting the decode showed production uploads
   are Chrome `MediaRecorder` **variable-frame-rate webm**, and OpenCV's `CAP_PROP_FPS` /
   `CAP_PROP_FRAME_COUNT` are unreliable on them — the **same format** read `8.417 fps /
   504 frames` on one capture and `1000.0 fps / 59 890 frames` on another.
3. **Confirmed the nondeterministic collapse.** Because `skip_ratio = round(reported_fps / 5)`,
   the kept-frame count tracked the garbage fps — **126 frames one run, 4 the next** for
   equivalent input. A dev harness reproduced `fps=1000.0` exactly on a real `MediaRecorder`
   webm (269 true frames over 11.45 s) and measured the legacy sampler keeping **1** frame.
4. **Timestamp-driven hybrid fix.** A probe established that `CAP_PROP_POS_MSEC` is reliable
   and strictly monotonic on these webms. Sampling now reads timestamps: **CFR** keeps the
   legacy index selection **bit-for-bit** (mp4/avi unchanged at any frame rate); **VFR**
   samples on a fixed **2.5 fps grid** (≈150 frames per 60 s, regardless of reported metadata);
   unusable timestamps fall back to legacy. Two-pass decode (`grab` for timestamps, then
   retrieve only the kept frames). **No new dependency** — the FFmpeg transcode-to-CFR fallback
   was deliberately not needed.
5. **Validated.** Real captures now yield **kept ≈ 150 consistently** across reported_fps
   8.4 / 1000 / metadata-mismatch (the count is now a function of *duration*, not garbage fps);
   `usable ≈ kept` on a full capture; CFR mp4/avi select **identical** frames to before;
   `tests/test_vfr_sampling.py` + full ml-video/apps/api suites green.

**Scope**: decode sampling only — the usable-face-coverage gate and every output contract are
untouched. A quiet `logger.debug` decode line and a DEV-only webm recorder
(`packages/ml-video/tools/dev_webm_recorder.html`) were added. The residual caveat (a webm
with **both** garbage fps **and** garbage timestamps would fall back to legacy and could still
collapse — not observed; transcode fallback deferred) is recorded in **DECISION-29**.

**Relation to Principle II**: per-user calibration makes every prediction a delta from the
~60 s baseline, so the baseline's feature fidelity is the measurement datum. The fix
**restores** the model's trained ≈2.5 fps sampling density on webm and keeps CFR bit-identical
— an application of Principle II, not a model change.

---

## Feature 006 — Calibration Capture Quality (merged to main)

**Branch**: `006-calibration-capture-quality`
**Status**: **merged to `main`** via **PR #19** (`7a1c2da`, 2026-06-17). Implementation complete
(Phases 1–8 / T001–T028); no pre-ship blocker.
**Date**: 2026-06-16 (implementation spanned the 006 cycle on the branch above)

**Scope shipped** — a server-side, authoritative **usable-face-coverage gate** that fixes the
005-era bug where a 60 s baseline with the face in frame for only ~2 s was silently accepted,
poisoning every later delta-from-baseline reading (Constitution Principle II — per-user
calibration is load-bearing). **Additive only: no new endpoint, status, response shape,
dependency, or migration.**

- **The gate (DECISION-30).** `packages/ml-video/src/ml_video/coverage.py` —
  `usable_face_coverage(landmarks) -> (usable, kept, fraction)` (usable = non-zero landmark
  row, the predicate `lbp_top_features` already uses) + `assert_usable_face_coverage`, called
  from `compute_anchor` **after `extract_landmarks`, before the existing degenerate floors**.
  Strictly stricter and additive — it never loosens the floors and short-circuits thin clips.
  Confirmed gate-cannot-touch-inference (T003): `compute_anchor` is baseline-path-only; live
  inference uses the separate, unwired `Predictor.predict_delta`.
- **Messaging (DECISION-31).** New categorical reason `insufficient_face_frames` carried in
  the **unchanged** 422 `reason` field via an optional `FeatureExtractionError.code`
  (`reason = getattr(exc, "code", None) or str(exc)`), mapped to **one** new client
  `insufficient-face` chip with server-reason precedence over `dominantCause`. **Counts
  (`usable`/`kept`/`fraction`) live only in a server `logger` line** — generic exception
  message, categorical wire token, so nothing numeric leaks (Principle I / FR-016). Every
  other reason still selects via `dominantCause` (incl. detector-unavailable → `our-side`);
  the three existing chips are byte-for-byte unchanged.
- **Calibration (DECISION-32, recalibrated on real webm).** `MIN_COVERAGE_FRACTION = 0.65`
  (primary) / `MIN_USABLE_FRAMES = 50` (backstop), measured against **four real browser-webm
  clips through the fixed VFR decode** (DECISION-29; pinned env Python 3.12.13, mediapipe
  0.10.13): thin `0.073/11` and **half `0.513/77`** reject; good-ideal `1.000/150` and
  good-realistic `1.000/151` accept. good-realistic held at 1.000 despite genuine look-aways
  (FaceMesh tracks through seated glances), so legitimate captures cluster at ~1.0 and 0.65 does
  not clip them; `half` validates coverage ≈ fraction-present, so `0.65 ≈ "face present ≥ ~40 s
  of 60 s"` and rejects the half-absent baseline (0.137 margin). **Provisional** — one
  intermediate sample (`half`); revisit against real-user data (the apps/api logging config emits
  the reject line, so the reject rate is observable).
- **Glasses (DECISION-33, investigation-only).** No glasses/no-glasses gap (24/53; macro-F1
  0.720 vs 0.717; stress recall 0.844 vs 0.818) → calibrate as you normally sit, glasses
  included; do not ban. Recorded with the between-subject thesis caveat.

**Testing (honest, no mock-green — Principle VII)**: the gate logic is never mocked; the only
injected seam is native extraction (mediapipe), and **CI runs no mediapipe** — the boundary
tests load committed `.npy` landmark fixtures (raw clips never committed — Principle I/X). TDD
throughout (RED → GREEN) for the gate, the router reason, and the frontend chip.

- ✅ `packages/ml-video` `uv run pytest` — green (gate logic + wiring + real-fixture boundary).
- ✅ `apps/api` pytest — green (categorical-reason + legacy-message-unchanged; happy/ES256
  paths bypass the gate via inert thresholds since the synthetic clip is below the floor).
- ✅ `apps/web` Vitest — green (new chip render + server-reason precedence + byte-for-byte
  no-regression on the existing chips; static voice/colour guardrail on the new chip).
- ✅ `tsc --noEmit` + eslint clean.

**Gates**:

- ✅ Constitution Check — Principles I, II, III, V, VII, VIII addressed in `plan.md`.
- ✅ Test gate — all three suites + typecheck + lint green locally.
- ✅ Privacy — counts log-only; raw clips never committed; 422 body categorical.
- ✅ Smoke-test gate — `specs/006-calibration-capture-quality/smoke-tests.md` (T027) completed
  before the PR #19 merge (Dev-Workflow gate 5).
- ✅ Merged to `main` (see **Status** above for PR / date).

**Branch commit ordering** (PR-sized, tests green per step): P1–2 env/scaffold (`8cd2027`) →
P3–4 gate core + wiring (`60983cb`) → P5 fixtures + measurements (`46e3bb8`) → P5 calibrate +
lock (`68c199b`) → P6–7 router reason + chip (`4428060`) → P8 docs + smoke.

**Recalibration (2026-06-16, after the decode fix landed).** The first calibration set the
coverage gate at `0.40` from three clips measured through the *broken* VFR decode (DECISION-29)
— a "wide empty gap" with no honest intermediate sample. Once the timestamp-driven decode
merged, the four clips were re-recorded as real browser webm and run through the *fixed* pipeline
production actually uses. good-realistic again saturated at `1.000` (FaceMesh holds the face
through seated glances), but the deliberately half-absent **`half`** clip landed at `0.513` —
almost exactly the 0.5 even-time sampling predicts, validating that the gate's coverage fraction
really is "fraction of the minute the face was present." With a populated boundary the threshold
could finally be placed *between* the half-absent baseline and the good clips rather than guessed:
`MIN_COVERAGE_FRACTION` rises **`0.40 → 0.65`**, the `.npy` fixtures are regenerated from the webm
clips (and `half.npy` added), and `half` becomes a documented reject (smoke §1b). The choice is
honest about its limits — one intermediate datapoint, an extrapolated accept-side tolerance — but
the reject rate is now observable in the server log, so the number is tunable from real use.

---

## Feature 005 — Calibration Capture Flow (merged to main)

**Branch**: `005-calibration-capture-flow`
**Status**: **merged to `main`** via **PR #17** (`a6a9b19`, 2026-06-08). Implementation complete;
the capture-route CSP report-only→enforce flip (T004) remained a tracked **deploy** follow-up at
merge time.
**Date**: 2026-06-08 (docs-finalisation close; implementation spanned 2026-05-29 → 2026-06-08)

**Scope shipped** — a calm redesign of the calibration capture UX over feature 004's
**unchanged** extraction backend (no migration, no backend/contract change, no seed
change; `contracts/backend-unchanged.md`):

- **On-device framing guide (DECISION-19/20)** — a self-hosted MediaPipe BlazeFace
  detector (vendored WASM, capability-probed, hard-timeout, never hangs) drives a pure
  gate/drift module through a throttled live loop; `loading → active | unavailable`, with
  `unavailable` bypassing the gate so the user is never locked out. A scoped CSP
  `'wasm-unsafe-eval'` allowance on the two capture routes only (report-only) lets the WASM
  compile; no `connect-src` host added, COEP unset. **Nothing leaves the browser.**
- **Settle-before-record flow (DECISION-21/27)** — redesigned reducer
  `intro → green-room → (healthz) → get-ready → recording → success`: a green room that
  lets the user settle with live framing + device switching before anything records, a
  numbers-only 3→2→1, a breathing orb (4-in/6-out) as the only non-progress motion, the
  60 s timer as the sole progress indicator, and a reduced-motion equivalent for every
  animated element on the shared `useMediaQuery` hook.
- **Three calm camera-access states + honest stop-confirm + adaptive failure
  (DECISION-21/24)** — `getUserMedia` `error.name` maps to foggy Blocked / Busy /
  No-camera screens with recovery; a non-destructive "start the minute over" stop-confirm;
  and a foggy failure state whose cause chip (low-light / out-of-frame / our-side default)
  is collapsed from on-device telemetry, never asserting a user-side cause we didn't
  measure. The `/healthz` gate + backend-down modal reuse 004 and block recording into a
  dead backend.
- **Recalibrate from account (DECISION-22/23)** — an employees-only "Your calm baseline"
  section (whether-set only, never the date) with a heads-up dialog → full-document
  `<a href="/app/calibrate?mode=recalibrate">`; `mode` reconciled against the real
  `has_anchor` (a stray `?mode=` never manufactures a recalibration); copy "set"→"update";
  exits to `/app/account`. The baseline is overwritten **only on a successful capture** —
  the same single in-place `UPDATE`, no history table, no migration.
- **Home calibration banner restyled (DECISION-28)** — 004's amber banner becomes foggy
  with a foggy-filled "Set baseline" CTA (attention, not affirmative); lifecycle, cross-tab
  mirror, and the full-document nav unchanged; employees-only.
- **Old 004 calibration UI fully removed (DECISION-28)** and the redesigned recorder
  mounted at both onboarding and `/app/calibrate`.
- **Device-memory fix (DECISION-25)** — a cleared store re-seeds the resolved default
  camera for the session without clobbering a temporarily-absent remembered device.
- **Honest tests + the NON-NEGOTIABLE egress proof (DECISION-26)** — boundary-seam tests
  exercise the real orchestration; an e2e detector seam runs the real gate to a full
  recording; a two-layer Playwright egress proof asserts **no video AND no outbound body of
  any kind** leaves for framing across green-room / mid-recording / post-success, except the
  single final `/anchor` clip POST on success.
- **Static guardrail scan (T030)** — a source scan over the 005 surfaces asserts zero
  `amber`/`crimson` tokens and zero exclamation marks / blocklist terms ("detected",
  "alert", "abnormal", "elevated risk", …) on any calibration or error surface.

**Test results** (as last recorded; this docs pass ran no suites):

- Web anchor Vitest: **161 anchor tests green** (last recorded at the green-room gate-sync
  fix); typecheck 0 / lint 0 at the last code change.
- Anchor e2e (Playwright, chromium): the consolidated 005 specs (`anchor-flow`,
  `anchor-camera-access`, `anchor-banner`, `anchor-egress`, `anchor-cross-tab`) green; the
  egress proof passes both layers. firefox/webkit + the real-detector paths fall to the
  smoke matrix.

**Decisions logged in DECISIONS.md (2026-06-08, T033)**: the collected, finalised
feature-005 block **📌 DECISION-19 through DECISION-28** (folding the 2026-05-31
DECISION-22/23/25 drafts, the banner-CTA meadow→foggy note → DECISION-28, and the e2e-seam /
FR-050 egress note → DECISION-26 into the numbered scheme).

**Open / deferred — before the 005 detector ships** (tracked in `docs/BACKLOG.md`):

- **T004 — flip the capture-route CSP report-only → enforce** after a
  `securitypolicyviolation` sweep. **Hard deploy blocker**; the detector must not ship to
  production under report-only.
- **Run the T032 smoke matrix on a real webcam** (cross-browser; the three real
  camera-access conditions; the weak-device detector-unavailable fallback; 360 px;
  reduced-motion; light/dark) — none of it is CI-reproducible.
- **Verify mobile camera over HTTPS** (the 004-deferred real-device camera path).
- Pre-production: the invite-only `/signup` gate (security slice 7) remains a separate
  pre-launch blocker, unchanged by 005.

**Next**: feature 006 — stress-inference-service (the live inference read path that consumes
`anchor_vector` as the per-user delta baseline 005 calibrates).

---

## Feature 004 — Onboarding Video Anchor Flow (merged to main)

**Branch**: `004-onboarding-video-anchor` (squash-merged via PR #14, then deleted)
**Status**: **merged to `main` 2026-05-29** (PR #14, squash `b75a6a9`); smoke pass
signed off by Mohamed 2026-05-29.
**Date**: 2026-05-29 (ship close; implementation spanned 2026-05-27 → 2026-05-29)

**Scope shipped**:

- **ML video package** (`packages/ml-video`) — `uv`-managed, Python 3.12-pinned
  (mediapipe ceiling, DECISION-1) LBP-TOP + motion feature pipeline; exact ML pins
  copied from `models/metadata.json`; loader/predict path present and unit-tested
  but invoked by no 004 endpoint (that's feature 005's inference read path). Model
  `serenify-video-lbptop-motion-rf-calibrated@2.0.0`.
- **FastAPI extraction service** (`apps/api`) — `POST /anchor` (JWT-verified) runs
  extraction and returns a 2958-dim vector as base64 LE-float32; raw bytes deleted
  in a `finally` (Principle I); `GET /healthz` (no auth) for the recorder
  pre-check; service holds **no** DB credentials (DECISION-8/9). Accepts MP4 + WebM
  (DECISION-11). JWT verified via Supabase JWKS / ES256 with an HS256 fallback
  (DECISION-9 amendment, smoke-surfaced).
- **Anchor columns + privacy** (migration `20260527000000_anchor_columns.sql`) —
  three anchor columns on `public.profiles`, all excluded from the `authenticated`
  SELECT whitelist; calibration status read only via the scope-guarded SECURITY
  DEFINER `has_anchor(auth.uid())` (DECISION-12, plan amendment). The web app does
  the privileged write with the user's own session client.
- **Web recorder** (`apps/web/components/anchor/`) — explicit state machine
  (idle → permission → 60s countdown → extracting → success/failure), post-grant
  device picker, codec probe, calm failure copy with a three-failure escape,
  reduced-motion countdown, health pre-check before any capture UI, and explicit
  user-dismissible terminal states.
- **Onboarding step + `/app/calibrate` route + calibration banner** — anchor step
  inline in onboarding and at a standalone route; amber banner with session-only
  dismissal (resets on sign-out), hard-navigating CTA so the per-route
  `camera=(self)` Permissions-Policy applies (DECISION-14/16 + smoke refinement).
- **Cross-tab sync** (extends `lib/auth-broadcast.ts`) — completing calibration
  drops the banner / redirects sibling tabs within ~2s; dismissal mirrors into
  sibling tabs; the anchor-captured refresh is scoped to banner-bearing routes
  (DECISION-15 + smoke refinements).
- **Demo synthetic anchor** (DECISION-17) — the seed writes one deterministic
  synthetic anchor (seed 42) via service-role so demo employees land on a
  calibrated, banner-free `/app`.

**Test results** (pre-flight, 2026-05-29):

- Web unit (vitest): **291/291 in 31 files**; the 2 previously-red
  `cross-tab-auth.test.tsx` tests are green (file: **35/35**).
- apps/api (pytest): **11/11** (incl. the ES256-via-JWKS accept + wrong-key reject
  tests). ml-video (pytest): **4/4** (unchanged).
- Anchor e2e: **chromium + firefox green — 26/26** (run with `--retries=2`, the CI
  posture: 19 passed clean, 7 chromium tests flaked on the cold-compile *first*
  attempt and passed warm on retry — the documented suite-wide load-timing flake,
  not a product issue). webkit is excluded locally — the Windows worker-teardown
  leak (DECISIONS 2026-05-27, collected entry item 13); Safari coverage falls to the
  smoke matrix + CI's clean Linux webkit.
- Typecheck: 0 errors. Lint: 0 warnings.

**Smoke gate**: signed off by Mohamed 2026-05-29 —
`specs/004-onboarding-video-anchor/smoke-tests.md`. ST-01…ST-20 PASS. **Deferred**:
ST-21 (Safari desktop) + ST-24 (iOS Safari) pending Apple hardware; the mobile
*camera* portions of ST-22/ST-23 to post-deploy HTTPS verification (non-camera
mobile UI verified over a LAN-IP HTTP origin). Several smoke bugs were found and
fixed during the gate (ST-02 retry flash, ST-10 explanation/observer, ST-11
dismissal persistence, ST-17 cross-tab, ST-18 health pre-check, plus the JWKS auth
and banner hard-nav fixes) — all recorded in DECISIONS.md 2026-05-29.

**Decisions logged in DECISIONS.md**: the collected feature-004 entry
(📌 DECISION-1 through DECISION-18, 2026-05-27), the DECISION-12 amendment
(2026-05-27), and the 2026-05-29 smoke-surfaced entry (which also backfills the two
planned decisions — DECISION-10 `/healthz`+startup check, DECISION-11 MP4+WebM —
that the collected entry had skipped).

**Deferred to BACKLOG.md (feature 004)**: post-deploy mobile camera → upload →
anchor verification over HTTPS (incl. mobile-codec server-side decode); Safari/iOS
smoke cells (ST-21/24); the `localStorage` device write-back bug (ST-05); an e2e
test-hardening pass; cross-browser/cross-device anchor + auth realtime sync; and
the redundant onboarding name step. The invite-only `/signup` gate (security slice
7) remains a ⛔ pre-production deploy blocker, unchanged by 004.

**Next**: feature 005 — per-user calibration (live inference read path for
`anchor_vector` + calibration UX revamp / design refinements). 005 owns the anchor
read path and the deferred design-system token pass.

---

## Feature 003 — Employee Dashboard Shell (merged to main)

**Branch**: `003-employee-dashboard-shell`
**Status**: **merged to `main`** via **PR #4** (`b079442`, 2026-05-25). Implementation complete.
**Date**: 2026-05-25 (Phase 13 close; implementation work spanned 2026-05-19 → 2026-05-25)

**Scope shipped** (13 phases / 71 tasks):

- **Auth-primitive extraction** (Phase 2): `PasswordInput`,
  `PasswordRequirements`, `OtpPanel`, and a new `Field` wrapper
  moved to `apps/web/components/ui/auth/`. (auth) page forms
  reimport by path; pages render byte-equivalent to `main` per
  FR-040.
- **`next-themes` migration** (Phase 3): `attribute` flipped from
  `data-theme` to `class`; localStorage namespaced from `theme` to
  `serenify-theme`. Inline migration shim in root layout populates
  the new key from legacy storage on first load (T014 resolution
  at `a5d89b3` + `073bdaf` after the initial guard was too strict).
- **shadcn/ui on Tailwind v4** (Phase 4): manual init (per
  CHANGELOG 2026-05-20 amendment), `components.json` per
  Decision E, 7 primitives installed (button, card, dropdown-menu,
  sheet, dialog, avatar, separator). Mist & Meadow tokens drive
  every shadcn CSS variable via the 19-row `@theme inline` mapping
  in `globals.css`. `--color-*` prefix correction (CHANGELOG
  2026-05-20) unblocked Tailwind v4's utility-class generation;
  7-step radius ladder added in the same correction commit.
- **Header + center nav + profile dropdown** (Phase 5): Server-
  Component `<Header>` reads `profiles.full_name` and `profiles.role`
  once; passes props down to client sub-components (`<CenterNav>`,
  `<ProfileDropdown>`, `<MobileMenu>`). Shared
  `<SignOutButton>` used by the dropdown, account-page Sign out
  section, and role placeholder.
- **`/app/account` page** (Phase 6): five vertical sections —
  Profile (edits `full_name` via Server Action with optimistic
  in-section avatar + `router.refresh()` to flush the header on the
  same render cycle); Security (inline change-password form per
  FR-020 CHANGELOG 2026-05-21 amendment; throwaway anon client for
  current-password verification); Privacy + Notifications
  placeholders; SignOutSection.
- **`/app` body** (Phase 7): employee role sees `<WelcomeBanner>`
  (adaptive greeting + locked Decision M subtitle "A space to
  check in with yourself.") + three skeleton cards in the
  documented 60/40 layout (Today's check-in / Things that might
  help / Recent chats). Stacks single-column at 360px.
- **Chat pill** (Phase 8): visual-only `<ChatPill>` anchored
  bottom-right on employee pages only (FR-035). Writes
  `--chat-pill-offset: 48px` on `<html>` for the notification
  stacking convention.
- **Notification component** (Phase 9): Radix Dialog + Framer
  Motion composition (not Sonner). Desktop slide-in / mobile
  bottom-sheet bifurcation via `useMediaQuery`; `useReducedMotion`
  collapses to opacity-only. Built but not mounted by production
  code per FR-033 — features 007/008/010 consume.
- **Role placeholders** (Phase 10): `<RolePlaceholder>` for
  team_lead and admin; locked Decision L copy with the
  CHANGELOG 2026-05-22 admin-subtitle amendment ("available below"
  → "available from the header dropdown"). FR-035: no chat pill
  for managers.
- **Cross-tab auth listener** (Phase 11): `<CrossTabAuth>` at root
  layout per DECISION-8. Decision N amendment (commit 0e4637f /
  CHANGELOG 2026-05-22) replaced supabase-js storage propagation
  with an explicit broadcast helper at
  `apps/web/lib/auth-broadcast.ts` because `@supabase/ssr` stores
  the session in cookies, not localStorage.
- **Verification + polish** (Phase 12): `employee-dashboard-shell.spec.ts`
  Playwright happy-path covers US 1 + US 2; clean stale-import sweep;
  full test pass green across all gates.
- **Phase 13**: DECISIONS.md collected (12 entries — 11 planned +
  FR-020 amendment); BACKLOG follow-ups appended (4 new entries
  including the T066 pipe-buffering note); cross-tab + auth-
  primitive extraction backlog items marked resolved against
  feature 003's resolutions.

**Test results**:

- Vitest: **154/154 in 20 files** (10.6s).
- Playwright: **54/54** total — chromium 18/18 (37.8s), firefox
  18/18 (1.4m), webkit 18/18 (7.3m). Includes 2 new feature 003
  specs (`employee-dashboard-shell.spec.ts`,
  `cross-tab-auth-sync.spec.ts`) plus the 7 preserved feature 001 /
  hotfix specs (admin-seeded, team-lead-seeded, employee-otp,
  employee-signup, reset-password, demo-coexistence,
  login-expired-link). Only permitted change to feature 001 specs:
  role-placeholder copy assertions in `admin-seeded.spec.ts` /
  `team-lead-seeded.spec.ts` per T057 / FR-036 + admin-subtitle
  refinement per Decision L amendment.
- Typecheck: 0 errors. Lint: 0 warnings.

**Gates passed**:

- ✅ Spec gate — all `specs/003-employee-dashboard-shell/`
  artifacts populated.
- ✅ Constitution Check — Principles V (calm voice, no red on
  affective surfaces with FR-042 destructive-surface clarification
  in constitution 1.1.0), VI (light + dark equal-priority), VII
  (Vitest + Playwright coverage), VIII (DECISIONS.md, CHANGELOG,
  PROGRESS.md), IX (no new secrets, no new env vars) addressed in
  `plan.md`.
- ✅ Test gate — typecheck, lint, Vitest, Playwright all green
  across the three browser projects (T066).
- ✅ Auth regression — feature 001's seven auth Playwright specs
  preserved unchanged save the T057 role-placeholder copy update
  per FR-036.
- ✅ Smoke-test gate — `specs/003-employee-dashboard-shell/smoke-tests.md` (T071; ST-1 through
  ST-10 including the three cross-tab + email/reset scenarios added in T063.1) completed before
  the PR #4 merge (Dev-Workflow gate 5).
- ✅ Merged to `main` (see **Status** above for PR / date).

**Decisions logged in DECISIONS.md (2026-05-25, T067)**:

- DECISION-1: shadcn on Tailwind v4 path + manual init
  substituted.
- DECISION-2: 19-row variable mapping + 3 load-bearing choices
  + `--color-*` prefix convention + 7-step radius ladder.
- DECISION-3: `data-theme` → `class` + `serenify-theme` storage key.
- DECISION-4: three-tier component folder convention.
- DECISION-5: notification on Radix Dialog + Framer Motion (not
  Sonner).
- DECISION-6: notification explicit-dismiss only.
- DECISION-7: welcome banner subtitle locked to "A space to check
  in with yourself."
- DECISION-8: cross-tab listener mounts at root layout.
- DECISION-9: Playwright cross-tab spec pattern (single context,
  two pages) + Decision N amendment (explicit broadcast helper).
- DECISION-10: `framer-motion` + `tw-animate-css` dep deltas.
- DECISION-11: chat-pill / notification stacking via
  `--chat-pill-offset`.
- FR-020 amendment: inline change-password form on `/app/account`.

Plus the existing 2026-05-20 entry: FR-042 scope clarification
(red permitted on destructive action surfaces only via the
`--color-crimson` token).

**Deferred to BACKLOG.md (2026-05-25, T068)**:

- Dynamic welcome banner subtitle variants (deferred-feature)
- Notifications-section live controls (deferred-feature)
- Welcome banner timezone awareness (deferred-bug)
- Playwright local matrix run pipe-buffering note (deferred-tooling)

**Resolved against BACKLOG.md (2026-05-25, T069)** — feature 001
entries closed by feature 003 work:

- "Cross-tab auth state sync" — Phase 11.
- "Auth form components inlined in page files" — Phase 2.
- ("/login does not render ?error=expired_link" — was already
  resolved on the earlier hotfix; verified, not re-touched.)

**Deviations resolved during implementation** (full context in
CHANGELOG.md):

- 2026-05-19: spec Out-of-Scope bullet referencing the expired-link
  hotfix recon — superseded by `8dc822b` (PR #2 merge).
- 2026-05-20: Tailwind v4 `@theme inline` prefix correction.
- 2026-05-20: FR-042 scope clarification (red on destructive only,
  constitution V1.1.0 bump).
- 2026-05-20: shadcn manual init substituted for `shadcn@latest init`.
- 2026-05-21: FR-020 inline change-password form replaces link-to-
  /forgot-password (T034 design failed the proxy redirect contract).
- 2026-05-22: Decision N amendment — explicit broadcast helper.
- 2026-05-22: Decision L admin subtitle copy refinement.

**Commit count**: **112 commits** on the `003-employee-dashboard-shell`
branch (from `65dac2d` "feat(003): add employee dashboard shell spec"
through `f037b4a` "docs(003): T069 — sweep BACKLOG").

---

## Feature 002 — Demo Seed Data (merged to main)

**Branch**: `002-demo-seed-data`
**Status**: **merged to `main`** (2026-05-18, `0d4f44c`). Implementation complete.
**Date**: 2026-05-18

**Scope shipped**:

- `scripts/seed-demo.ts` CLI entrypoint with three code paths:
  idempotent create-or-skip (default), `--reset` (pattern-scoped delete
  + recreate), `--remote` (two-key opt-in to the deployed project).
- Five pure helper modules in `scripts/lib/`: `hierarchy.ts` (the
  canonical 30-slot generator), `env.ts` (`apps/web/.env.local` loader
  + CLI arg parser + target resolution), `supabase-admin.ts` (service-
  role client factory with production-load guard), `confirm.ts`
  (interactive y/N prompt for the remote path), `banner.ts`
  (environment / summary-table / password banner formatters).
- Root tooling: `package.json` devDeps (`@faker-js/faker` 9.2.0 exact,
  `tsx` 4.19.2 exact, `@supabase/supabase-js`, `dotenv`, `vitest`,
  `cross-env`), four npm scripts (`seed`, `seed:reset`, `test:seed`,
  `test:seed:integration`), new root `tsconfig.json` scoped to
  `scripts/`, new root `vitest.config.mts`.
- Playwright retrofit (FR-019): `apps/web/tests/e2e/setup/global-setup.ts`
  pattern-scopes the auth.users wipe to `@example.com` and removes the
  unscoped orphan-profile sweep (which would otherwise have destroyed
  demo profile rows).
- New Playwright spec `apps/web/tests/e2e/demo-coexistence.spec.ts`
  asserts the demo cohort is byte-identical before and after a full
  e2e run.

**Test results**:

- 9/9 Vitest unit assertions on `buildHierarchy(1729)` green (FR-001,
  FR-002, FR-006(a)-(e), FR-007/SC-005, Principle X).
- 8/8 Vitest integration assertions green against local Supabase
  (8.65s wall-clock for the full integration suite, well under the
  60s SC-001 budget).
- 33/33 Playwright e2e specs green across chromium + firefox + webkit
  (94s wall-clock). The new `demo-coexistence.spec.ts` ran in all three
  browsers and confirmed the demo cohort survives global-setup
  untouched.
- Root typecheck (`npx tsc -p tsconfig.json --noEmit`) green; apps/web
  typecheck (`npm run typecheck --workspace=apps/web`) also green
  after the FR-019 edit.

**Gates passed**:

- ✅ Spec gate — all `specs/002-demo-seed-data/` artifacts populated.
- ✅ Constitution Check — Principles VII, VIII, IX, X addressed.
- ✅ Test gate — unit + integration + e2e all green locally.
- ✅ Secrets scan — no new `.env*` files, no key in any banner/summary
  output, service-role key flows only through `process.env`.
- ✅ Smoke-test gate — `specs/002-demo-seed-data/smoke-tests.md` (T025) completed before the
  2026-05-18 merge (Dev-Workflow gate 5).
- ✅ Merged to `main` (see **Status** above for PR / date).

**Decisions logged in DECISIONS.md (2026-05-18)**:

- TS runner: `tsx` 4.19.2 (exact pin)
- Playwright orphan-profile sweep removed
- Demo email format `<first>.<last>.<NN>@demo.serenify.local`

**Deferred to BACKLOG.md**:

- CI integration for `npm run test:seed:integration` (deferred-feature)

---

## Feature 001 — Authentication and Role-Based Access (merged to main)

**Branch**: `001-auth-and-roles`
**Status**: **merged to `main`** via **PR #1** (`e8a0fac`, 2026-05-17). Implementation complete.
**Date**: 2026-05-17

**Scope shipped**:

- Database: `public.user_role` enum, `public.profiles` table with RLS
  (self-select, admin-select, direct-reports-select, safe-fields self-
  update), `handle_new_user()` trigger seeding `role='employee'`,
  `is_admin()` helper, `admin_update_role` / `admin_update_manager`
  SECURITY DEFINER functions, `reports_under()` recursive-CTE helper
  for future signal-aggregate features.
- Web: `/signup`, `/login`, `/forgot-password`, `/reset-password`,
  `/onboarding`, `/app`, and `/auth/callback` + `POST /api/admin/invite`
  route handlers. Editorial-calm direction across all auth surfaces;
  Mist & Meadow palette with light + dark variants honored from day one.
- Middleware (proxy.ts on Next 16): 5-step gate — unauth→/login,
  auth→/app, full_name-null→/onboarding, full_name-set+on-onboarding→
  /app, otherwise pass through.
- Testing: 9/9 Vitest schema unit tests pass; 12/12 Playwright e2e
  specs pass across chromium + firefox + webkit (4 specs × 3 browsers).

**Gates passed**:

- ✅ Spec gate — all `specs/001-auth-and-roles/` artifacts populated.
- ✅ Constitution Check — Principles I, V, VI, VII, VIII, IX addressed
  in `plan.md`; deviations logged in `docs/DECISIONS.md`.
- ✅ Test gate — typecheck, lint, Vitest, Playwright all green locally.
- ✅ Secrets scan — no `.env*` files committed, no hardcoded keys.
- ✅ Smoke-test gate — `specs/001-auth-and-roles/smoke-tests.md` (T041) completed before the
  PR #1 merge (Dev-Workflow gate 5).
- ✅ Privacy review — addressed in `plan.md`'s Constitution Check (merged via PR #1).
- ✅ Merged to `main` (see **Status** above for PR / date).

**Deviations logged in DECISIONS.md**:

- Next.js 16 (not 15)
- Vitest config is `.mts`, environment is `happy-dom`
- shadcn/ui not pulled
- Playwright `workers: 1`
- Migration packaging split: T013 (`admin_update_role` / `admin_update_manager`)
  and T014 (`reports_under`) are separate migration files rather than
  embedded in `20260517000020_profiles_rls.sql` per `contracts/migrations.md`.
  Documented in `tasks.md` § Cross-cutting notes.
- `middleware.ts` written as `proxy.ts` (Next 16 file convention).

**Bug discovered and fixed during implementation**:

- `POST /api/admin/invite` initially called the SECURITY DEFINER RPCs
  via the service-role client. `is_admin()` evaluates `auth.uid()`,
  which is NULL for service-role calls, so every invite returned 500
  with `role_update_failed: forbidden`. Fixed by routing the RPCs
  through the caller's session client (the admin client is now used
  only for `auth.admin.inviteUserByEmail`).
