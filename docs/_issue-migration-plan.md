# Issue migration plan — Phase 1 proposal (REVIEW ONLY — nothing created)

> **Scratch artifact** (leading `_`). One-time planning file for the
> `docs/BACKLOG.md` → GitHub Issues migration. **No labels or issues have been
> created.** This file proposes the full issue set for Mohamed's review; a
> separate Phase 2 prompt will do the actual `gh label create` / `gh issue create`.
>
> Rules applied: constitution **Principle VIII** (BACKLOG is source of truth,
> 1:1 mirror) and `docs/DECISIONS.md` **2026-06-24** (Amendment 9 — label
> taxonomy, status→label/state mapping, *all* items migrate; resolved items are
> created-then-closed; `watch` items migrate **open**).
>
> **Source state:** `main` @ `18cb4e0` (PR #28 merged), `docs/BACKLOG.md` = 63 items.

---

## Conventions used in this proposal

- **`watch` items carry BOTH `status:watch` AND an inferred `type:`.** The
  2026-06-24 mapping maps `watch` → `status:watch` + open, but `watch` is not a
  *type*. The new-format feature-008 `watch` bullets already self-suggest a type
  (e.g. the live-monitor stability item says `type:bug`), so each `watch` row
  below gets `status:watch` in the priority/status column **plus** a `type:` from
  the item's underlying nature. **Flagged for confirmation** (see Flag W).
- **Resolved (struck-through) items** become **CLOSED (fixed)** issues; their
  original `type:` is inferred from content (the struck status field only says
  "resolved"). Real resolution date + commit/PR sourced from the BACKLOG entry.
- **State is read from BACKLOG markers only** (struck-through / `**Status**:
  resolved`). Where my own knowledge suggests an un-struck item may actually be
  done, I leave it **OPEN** (BACKLOG wins) and **flag** it instead of overriding.
- **Target feature** is body-text only (no milestones/feature-labels in v1).
  Feature numbers use the **current** post-Amendment-8 roadmap (001–020).
- `area:` is inferred from the paths/content each item names. Repo-root tooling
  and `supabase/` config items have no perfect `area:` fit — those are flagged.

---

## From feature 001 (auth-and-roles) — merged 2026-05-17

| # | BACKLOG anchor | Proposed title | type | area(s) | priority/status | State | Resolution (if closed) | Target feature | One-line body summary |
|---|---|---|---|---|---|---|---|---|---|
| 1 | 001 · `/login` `?error=expired_link` notice | `/login` does not render the `expired_link` notice | type:bug | area:web | — | CLOSED (fixed) | 2026-05-19, `hotfix/login-expired-link-notice` (login/page.tsx; tests login-page.test.tsx + login-expired-link.spec.ts) | → 001 | PKCE-callback failure redirected to `/login?error=expired_link` but no calm notice rendered; now awaits searchParams + shows amber `role=status`. |
| 2 | 001 · Auth form components inlined, not extracted | Extract auth form primitives out of page files | type:tech-debt | area:web | — | CLOSED (fixed) | 2026-05-20, feature 003 Phase 2 (T004–T010 auth-primitive extraction sweep) | → 003 | Bespoke form primitives lived inside (auth) page files; extracted to `components/ui/auth/` so shadcn swap touched one place. *(type inferred — struck status was only "resolved")* |
| 3 | 001 · Cross-tab auth state sync | Cross-tab auth state sync (sign-in/out propagation) | type:bug | area:web | — | CLOSED (fixed) | 2026-05-22, feature 003 Phase 11 (T059–T063; Decision N amendment commit `0e4637f`) | → 003 | Confirming in a new tab didn't update the original tab; `CrossTabAuth` + `auth-broadcast.ts` now propagate via storage events. *(type:bug — corrected a defect; see Flag B)* |
| 4 | 001 · Supabase email templates carry unused OTP block | Customize Supabase email templates to Serenify voice | type:polish | area:db | — | OPEN | — | → 017 / first real-email env | Confirmation + recovery emails ship generic Supabase boilerplate (magic link + OTP); author `supabase/templates/*.html` + wire via `config.toml`. *(area: Supabase-config, see Flag C)* |
| 5 | 001 · OTP submit transient-stale-render flake | OTP submit button transient stale-render flake | type:bug | area:web | status:watch | OPEN | — | monitor | First-attempt OTP submit stayed disabled despite valid input; suspected Strict-Mode/HMR dev race; escalate to bug on reproduction. |
| 6 | 001 · Node 22.11 forces happy-dom + .mts config | Revert to jsdom + `.ts` Vitest config after Node upgrade | type:tech-debt | area:web | — | OPEN | — | → before 005 (overdue — see Flag F) | Node 22.11 can't `require(esm)`; forces `vitest.config.mts` + happy-dom. Upgrade Node 22.13+, revert to jsdom + `.ts`. |
| 7 | 001 · postcss XSS advisory in transitive dep | Re-triage postcss XSS advisory (GHSA-qx2v-qp2m-jg93) | type:tech-debt | area:web | status:watch | OPEN | — | re-triage at next Next.js major | Transitive Next.js dep; not exercised at runtime; `audit fix --force` would downgrade Next. Re-triage each Next major. *(no `type:security` label — see Flag G)* |
| 8 | 001 · HMR WebSocket console spam at 127.0.0.1 | HMR WebSocket failures spam console at 127.0.0.1:3000 | type:polish | area:web | status:watch | OPEN | — | optional | Loading dev at `127.0.0.1` (not `localhost`) breaks HMR WS; optional `allowedDevOrigins` fix. |
| 9 | 001 · Force re-sign-in after password reset | Optional force re-sign-in after password reset | type:feature | area:web | — | OPEN | — | revisit if corporate deploy needs | Auto-sign-in after PKCE reset today; some security postures prefer forced re-auth; per-deployment config later. |
| 10 | 001 · Dedicated `/verify-otp` route | Dedicated `/verify-otp` route | type:feature | area:web | — | OPEN | — | only if use case emerges | OTP entry is inline on signup/forgot panels; a dedicated route would make it linkable/first-class. |
| 11 | 001 · Password strength meter (entropy-based) | Password strength meter (entropy-based) — kept-as-rejected | type:feature | area:web | — | CLOSED (not planned) | decided — requirements-checklist approach chosen, entropy meter intentionally not implemented | keep listed, do-not-action | OWASP-discouraged; rejected in favour of the requirements checklist; logged so it isn't re-proposed. *(closed-as-not-planned; `wontfix` not created — see Flag K)* |

## From feature 002 (demo-seed-data) — merged 2026-05-18

| # | BACKLOG anchor | Proposed title | type | area(s) | priority/status | State | Resolution (if closed) | Target feature | One-line body summary |
|---|---|---|---|---|---|---|---|---|---|
| 12 | 002 · CI integration for `test:seed:integration` | Wire `test:seed:integration` into CI (Supabase-in-CI) | type:feature | area:infra, area:db | — | OPEN | — | → 008 CI setup | Seed integration suite runs only on Mohamed's laptop (no `.github/workflows/` yet); pair with feature 008's Supabase-in-CI need. *(deferred-feature per status, though CI-tooling-flavored)* |
| 13 | 002 · Cleaner error when Supabase unreachable | Friendly error when local Supabase is unreachable | type:polish | area:infra | — | OPEN | — | any polish pass / pre-016 seed work | Seed script surfaces raw `ECONNREFUSED` stack; wrap first call to print a one-line friendly message + clean exit. *(area:infra — seed/dev-tooling, not DB schema; see Flag C)* |

## From feature 003 (employee-dashboard-shell) — merged 2026-05-25

| # | BACKLOG anchor | Proposed title | type | area(s) | priority/status | State | Resolution (if closed) | Target feature | One-line body summary |
|---|---|---|---|---|---|---|---|---|---|
| 14 | 003 · Onboarding visual regression untestable | `/onboarding` visual regression untestable on completed accounts | type:tooling | area:web, area:db | — | OPEN | — | → demo-seed reset option / 008 CI | All 30 demo users complete onboarding, so the `/onboarding` visual cell has no eligible account; needs a seed "reset onboarding" option or a pristine slot. |
| 15 | 003 · Avatar disc washed in dark mode | Avatar disc reads washed-grey in dark mode | type:polish | area:web | — | OPEN | — | → design-system token pass | AAA contrast passes but the disc reads weak (surface-on-bg ~1.2:1); may want a dedicated `--color-avatar-bg`. |
| 16 | 003 · Mobile/tablet typography bump | Mobile/tablet responsive typography pass | type:polish | area:web | — | OPEN | — | → design-system token pass | text-sm/xs read cramped at 360px/tablet; wants a fluid-type scale, not one-off `sm:` patches. |
| 17 | 003 · `--color-muted` underweight on light bg | `--color-muted` fails WCAG AA on light bg | type:bug | area:web | — | OPEN | — | → design-token pass | M&M `--color-muted` ~3.8:1 on light bg (under AA 4.5:1) for every `text-muted` site; darken light value. |
| 18 | 003 · Button-system character pass | Button-system character + variant cleanup | type:polish | area:web | — | OPEN | — | → design-system pass | Variants under-differentiated; `Sign out` reads perceptually destructive; fix ghost/outline/link contrast; decide 4th scoped colour. |
| 19 | 003 · Card heading typography | Card heading typography — fresh design read | type:polish | area:web | — | OPEN | — | → design-system pass | Card `<h2>` font-display "doesn't resonate"; explore 2–3 alternatives side-by-side, don't tweak in place. |
| 20 | 003 · Cursor pointer on clickable surfaces | Restore cursor:pointer on Link/clickable surfaces | type:polish | area:web | — | OPEN | — | → design-system pass | Tailwind v4 preflight strips anchor cursor; one `@layer base` rule for `a[href]`/`[role=button]`. |
| 21 | 003 · CI guard for speckit skills + gitignore | CI guard for speckit SKILL.md files + `.gitignore` rule | type:tech-debt | area:infra | — | OPEN | — | → before 004 / first CI workflow | Speckit skills silently vanished twice; a file-existence + `.gitignore` regex check in CI catches both modes. |
| 22 | 003 · Dynamic welcome banner subtitle variants | Dynamic welcome-banner subtitle variants | type:feature | area:web | — | OPEN | — | → post-008 (signal data exists) | Locked static subtitle today; FR-009 context-aware variants need signal/calibration data before they key on anything. |
| 23 | 003 · Notifications-section live controls | Live notification preferences on `/app/account` | type:feature | area:web | — | OPEN | — | → 010 / 014 | Notifications section is a placeholder; needs schema + Server Action + form once a notifications system exists. |
| 24 | 003 · Welcome banner timezone awareness | Welcome-banner greeting is server-timezone-bound | type:bug | area:web | — | OPEN | — | → later polish / 005 | Greeting uses server `new Date()`; users in other zones see the wrong band; fix via client `useEffect` or IANA cookie. |
| 25 | 003 · Playwright matrix pipe-buffering deadlock | Playwright matrix `\| tail` pipe-buffering deadlock helper | type:tooling | area:infra | — | OPEN | — | → next matrix run / first CI | `playwright test 2>&1 \| tail` hangs (buffer deadlock); add `scripts/run-e2e-matrix.sh` line-buffered wrapper. *(area: test-tooling, see Flag M)* |
| 26 | 003 · Dev-server memory bloat across runs | Dev-server memory bloat + slowdown across stacked suite runs | type:tech-debt | area:web | — | OPEN | — | → before 004 | Stacked Playwright runs grow 3.0→11.2m with `next dev` ~4.1GB resident, manufacturing unrelated flakes; investigate leak. |
| 27 | 003 · Non-dismissible confirmation notifications | Non-dismissible stress-detection confirmation notifications | type:feature | area:web | — | OPEN | — | → 008 / 010 / 014 | Add `dismissible?:boolean` to `Notification`; confirmation-of-detection prompts must not dismiss on Escape/click-outside. |
| 28 | 003 · Auth-broadcast forward-looking guard | Forward-looking guard for auth-broadcast coverage | type:tech-debt | area:web | — | OPEN | — | → security/quality hardening pass | The bdf1463 audit is a one-time snapshot; a new auth flow could silently skip `broadcastSignIn`; add a CI/contract guard. |
| 29 | 003 · "Send a new confirmation" link contrast | "Send a new confirmation" link contrast underweight (light) | type:polish | area:web | — | OPEN | — | → design-system pass | Sign-in resend link falls short of AA in light mode; single-token review to ≥4.5:1. |
| 30 | 003 · Extend ST-9 recovery e2e end-to-end | Extend ST-9 to assert recovery submits password update e2e | type:tech-debt | area:web | — | OPEN | — | → testing/e2e-quality pass | ST-9 checks recovery navigation only, not the actual password-submit; a `config.toml [auth]` change could silently break recovery. |

## From security slice 3 (privileged-endpoints-and-input-validation) — merged 2026-05-25

| # | BACKLOG anchor | Proposed title | type | area(s) | priority/status | State | Resolution (if closed) | Target feature | One-line body summary |
|---|---|---|---|---|---|---|---|---|---|
| 31 | sec-3 · Invite audit log | Invite audit log — record who invited whom | type:feature | area:web, area:db | — | OPEN | — | → 017 | `POST /api/admin/invite` writes no audit trail; add a structured log or `invite_audit` table (+ RLS) for provenance. |
| 32 | sec-3 · Concurrent-duplicate-invite idempotency | Concurrent-duplicate-invite idempotency | type:tech-debt | area:web | — | OPEN | — | → 017 | Two parallel invites for one email yield one 201 + one 500; add an idempotency key so concurrent dupes collapse to 200/409. |

## From security slice 7 (rate-limits-and-parity) — merged 2026-05-26

| # | BACKLOG anchor | Proposed title | type | area(s) | priority/status | State | Resolution (if closed) | Target feature | One-line body summary |
|---|---|---|---|---|---|---|---|---|---|
| 33 | sec-7 · `/signup` open self-serve ⛔ | Gate `/signup` to invite-only (open self-serve posture) | type:feature | area:web, area:db | **priority:blocker** | OPEN | — | → 017 (before any real-tenant launch) | `/signup` is open; any visitor self-serves an employee account. ⛔ binding pre-production deploy blocker; gate behind invite tokens or remove. |
| 34 | sec-7 · App-layer rate limiting | App-layer rate limiter (invite + profile writes) | type:tech-debt | area:web, area:db | — | OPEN | — | → 017 / hardening slice | No app-layer limiter anywhere; GoTrue per-IP buckets miss `/api/admin/invite`; add a durable Supabase-table limiter keyed by admin id. |

## From feature 004 (onboarding-video-anchor) — merged 2026-05-29

| # | BACKLOG anchor | Proposed title | type | area(s) | priority/status | State | Resolution (if closed) | Target feature | One-line body summary |
|---|---|---|---|---|---|---|---|---|---|
| 35 | 004 · Onboarding name step redundant | Onboarding name step is redundant with signup `full_name` | type:bug | area:web | — | OPEN | — | → post-004 profile/preferences feature | `/onboarding` re-asks the name signup already stored; skip the step or pre-fill it as confirmation. |
| 36 | 004 · Cross-browser/device anchor + auth sync | Cross-browser/device anchor + auth sync (realtime push) | type:feature | area:web, area:db | — | OPEN | — | → 008 / 010 | Storage-event sync is per-browser-profile; cross-browser/device live updates need a Supabase Realtime push (stale render, not stale data). |
| 37 | 004 · Post-deploy mobile camera verification | Verify mobile camera→upload→anchor on real devices over HTTPS | type:feature | area:web, area:ml-video, area:infra | — | OPEN | — | → first HTTPS staging/prod deploy | iOS calibration validated over a tunnel (Run 4); still unverified on a real production HTTPS deploy + Android Chrome/Firefox capture. |
| 38 | 004 · Safari/iOS smoke cells ST-21/ST-24 | Run Safari-desktop + iOS-Safari smoke cells (Apple hardware) | type:tooling | area:web, area:ml-video | — | OPEN | — | → when Apple hardware available | Only WebKit matrix cells; need real Safari camera + MP4 decode. *(Embeds the 006 coverage-gate Safari/WebKit smoke addendum — pre-production gate before live inference; see Flag S)* |
| 39 | 004 · Camera device selection writeback (ST-05) | Camera device selection not always written to localStorage | type:bug | area:web | — | OPEN | — | → 005 / next anchor device-handling touch | Explicit picker selection isn't reliably persisted to `serenify-anchor-camera`; make write-back unconditional + assert it. |
| 40 | 004 · e2e test-hardening pass | e2e hardening — mock-driven coverage masked real 004 bugs | type:tech-debt | area:web, area:api | — | OPEN | — | → testing/quality slice | Several 004 bugs passed green e2e (mocks bypass real PP/JWT/codec); add a non-mocked tier (real-token vs live FastAPI, cross-tab timing). |
| 41 | 004 · Feature 005 scope pointer | Design-system token pass (feature-005 scope pointer, sub-item 3) | type:feature | area:web | — | OPEN | — | → dedicated design pass | Pointer: sub-items (1) anchor read-path + (2) calibration UX revamp DONE; only (3) the 6-item design-system token pass remains OPEN. *(partial-resolution pointer; see Flag P)* |

## From hotfix/lbp-roi-interpolation (feature 005 recon) — 2026-05-29

| # | BACKLOG anchor | Proposed title | type | area(s) | priority/status | State | Resolution (if closed) | Target feature | One-line body summary |
|---|---|---|---|---|---|---|---|---|---|
| 42 | recon · Store extraction/pipeline-version per anchor | Store `anchor_extraction_version` for auto-invalidation | type:tech-debt | area:db, area:ml-video, area:api | — | OPEN | — | → before prod / next ml-video extraction change | Anchors track only `model_version`; an extraction-only change (LBP hotfix) didn't auto-invalidate; add a stored extraction version. |
| 43 | recon · End-to-end extraction-vs-notebook fidelity | End-to-end extraction-vs-notebook fidelity check (real clip) | type:tech-debt | area:ml-video, area:api | — | OPEN | — | → 008 go/no-go gate | Full chain never run end-to-end on a real StressID clip vs the notebook within float tolerance. **V1 verdict 2026-06-24 — stays OPEN: checked specs/008, PROGRESS, DECISIONS, CHANGELOG, MODELS + git log; no committed StressID-vs-notebook full-chain validation found. 008's "bit-identical (max\|Δ\|=0) GATE 1" is the keep-up tail-decode vs whole-file decode (a different check), and 008 treats single-clip extraction as faithful-by-construction citing only the isolated LBP-TOP guard `test_lbp_interpolation_fidelity.py` — exactly what #43 says is NOT the end-to-end check. Not closeable on committed evidence; see Flag R.** |

## From feature 005 (calibration-capture-flow) — merged 2026-06-08

| # | BACKLOG anchor | Proposed title | type | area(s) | priority/status | State | Resolution (if closed) | Target feature | One-line body summary |
|---|---|---|---|---|---|---|---|---|---|
| 44 | 005 · Pre-detector-ship launch blockers | Feature-005 detector pre-launch gate (CSP / smoke / mobile-HTTPS) | type:tech-debt | area:web, area:ml-video, area:infra | — | CLOSED (fixed) | 2026-06-22 — T004 CSP enforce live in proxy.ts; T032 smoke signed 2026-06-01; mobile-HTTPS Run 4 commit `34c951b` | → 005 | Three pre-launch blockers (CSP report-only→enforce, real-webcam smoke, mobile-HTTPS path) all cleared. *(type inferred for a closed gate item — see Flag W2)* |
| 45 | 005 · Thin baseline accepted as success | Thin baseline accepted — no min-usable-frames gate | type:bug | area:ml-video, area:api | — | OPEN | — | → 008 / backend-quality pass | A 60s clip with ~2s of face passed as a "successful" baseline; add a min-usable-frames/coverage gate (→422 `insufficient_face_frames`). |

## Product-wide / cross-cutting — captured 2026-06-19

| # | BACKLOG anchor | Proposed title | type | area(s) | priority/status | State | Resolution (if closed) | Target feature | One-line body summary |
|---|---|---|---|---|---|---|---|---|---|
| 46 | x-cut · ToS / Privacy / signup consent gate ⛔ | ToS + Privacy Policy + signup consent gate (Egypt PDPL) | type:feature | area:web, area:docs, area:db | **priority:blocker** | OPEN | — | → 014 (before any real user data) | No ToS/Privacy/consent today; Egypt Law 151/2020 + labour-law overlay, biometric+health+employment = highest-sensitivity. ⛔ pre-production data-processing gate; informed-draft-not-legal-advice caveat. |
| 47 | x-cut · Internationalization (Arabic RTL + French) | Internationalization — Arabic (RTL) and possibly French | type:feature | area:web, area:api | — | OPEN | — | → decide early; externalize strings from 008 onward | Arabic is arguably primary in-market; RTL layout mirroring + Arabic font + 6 plural categories + content/LLM-prompt localization. Decide thesis-scope early. |

## From feature 008 (stress-inference-service) — merged 2026-06-22

| # | BACKLOG anchor | Proposed title | type | area(s) | priority/status | State | Resolution (if closed) | Target feature | One-line body summary |
|---|---|---|---|---|---|---|---|---|---|
| 48 | 008 · T026 recorder mime dual-container | Recorder mime: support both webm + fMP4 (feature-detect) | type:bug | area:web | status:watch | OPEN | — | → pre-build (window-recorder.ts) | `pickMime` must prefer webm with an fMP4 fallback; T009 proved both decode but iOS WebM support is uneven. |
| 49 | 008 · Keep-up tail-decode + read-loop back-pressure | Keep-up: full rolling buffer + read-loop back-pressure | type:tech-debt | area:api, area:ml-video | status:watch | OPEN | — | → production-deploy target | O(stride) tail-decode SHIPPED (flat ~9–13s); remaining: conditional full per-session rolling buffer + read loop must not overlap strides; adds ffmpeg/ffprobe host dep. |
| 50 | 008 · In-memory smoothing buffer multi-worker | Smoothing buffer needs session affinity / shared cache (multi-worker) | type:tech-debt | area:api | status:watch | OPEN | — | → production-deploy target | Per-session in-memory `_SessionBuffers`; >1 worker needs affinity/Redis; restart re-warms (~90s). Fine for single-worker MVP. |
| 51 | 008 · Dev `--reload` leaves bloom stuck | Dev `--reload` leaves live bloom permanently "getting a read" | type:tech-debt | area:api, area:docs | status:watch | OPEN | — | → dev-diagnostic (recorded) | Recorded dev fingerprint: `--reload` worker restarts drop the smoothing buffer, re-warming each time; use `--reload-dir app`, don't edit `app/` mid-session. |
| 52 | 008 · Live-monitor readings stability | Live-bloom durability (decouple from live-response delivery) | type:bug | area:api, area:web | status:watch | OPEN | — | → production-deploy (stability first) | Make the bloom latch off the durable `window_readings` poll, not the live response; buffer restart-resilience; investigate 166s upload cessation + mid-session auth event. *(self-suggested: type:bug, area:api +area:web)* |
| 53 | 008 · Feature-016 coarse-aggregate read path + time ranges | Team-lead coarse-aggregate read path + multi-range time selection | type:feature | area:db, area:web | — | OPEN | — | → 016 (and 017 for org-wide) | 016 must expose manager visibility via a tightly-scoped SECURITY DEFINER rollup (coarse bands only, no raw readings, no service-role) + a 1wk–1yr time-range selector. **"consolidated 2026-06-24" = a BACKLOG-entry consolidation (absorbed the feature-001 manager-visibility item), NOT work-done — state OPEN; see Flag X.** |
| 54 | 008 · Camera route must register in every PP/CSP touchpoint | Capture route must register in all 3 camera-policy touchpoints | type:tech-debt | area:web | status:watch | OPEN | — | → pre-build (guard would retire the class) | A `getUserMedia` route must be in `CAPTURE_ROUTES` + the `camera=()` negative-lookahead + `isCaptureRoute`; a lint/test guard would prevent the silent-dead-camera regression. |
| 55 | 008 · US4 ambient "weather of the day" view | US4 ambient trend view + feel/precise toggle | type:feature | area:web | — | OPEN | — | → post-demo, after 010 | A second, lower-precision ambient trend representation + toggle; revisit must use Serenify band vocabulary, not weather iconography. |
| 56 | 008 · Stale `window_eval_config` (30s) in metadata.json | Annotate/remove stale 30s `window_eval_config` in model metadata | type:tech-debt | area:ml-video, area:docs | — | OPEN | — | → next model-owner maintenance | Model artifact carries a stale 30s eval block (prod is 60s/10s); model-owner doc-note only — NO model_version bump / NO artifact-hash change. |
| 57 | 008 · 90-day window_readings purge job | Retention: 90-day `window_readings` purge job | type:feature | area:db | — | OPEN | — | → before long-running prod (>90d) | Policy decided (90d then purge); job not built; small `pg_cron` DELETE task. No functional effect in 008 beyond storage growth. |
| 58 | 008 · Two pre-existing eslint errors in monitoring-session | Resolve 2 pre-existing eslint errors in `monitoring-session.tsx` | type:tech-debt | area:web | — | OPEN | — | → dedicated camera-lifecycle refactor | Two load-bearing camera-lifecycle eslint errors (L200 srcObject mutation, L478 release setState); functionally correct, risky to "fix" in a polish pass. tsc + Vitest green. |
| 59 | 008 · Preferences hub + device selection | Preferences hub + monitoring device selection | type:feature | area:web | — | OPEN | — | → 015 preferences-hub (BACKLOG says "~009") | Settings home: monitoring device picker (post-permission), Account→Preferences (default camera w/ fallback, theme light/dark/system, language slot), RLS-as-user. *(self-suggested: type:feature, area:web)* |
| 60 | 008 · iOS Safari monitoring 0 readings (decode death) | iOS Safari monitoring: 0 readings — un-finalized-webm decode death | type:bug | area:ml-video, area:api, area:web | — | OPEN | — | → before real-iOS monitoring sign-off | `probe_recorded_seconds()` throws on iOS's growing un-finalized webm (~40s) → every window skipped → 0 readings; NOT the resolved kickout. Fix: prefer fMP4 on iOS recorder + harden the probe. Not demo-blocking. *(self-suggested: type:bug, area:ml-video +caller area:api)* |

## From feature 009 (today-card-trend-redesign) — merged 2026-06-23

| # | BACKLOG anchor | Proposed title | type | area(s) | priority/status | State | Resolution (if closed) | Target feature | One-line body summary |
|---|---|---|---|---|---|---|---|---|---|
| 61 | 009 · Headline escalation arc collapses to peak | Headline escalation arc (a-little-tense→tense) collapses to peak | type:feature | area:web | — | OPEN | — | → 009 headline revisit | An escalation opening *a little tense* and climbing to *tense* drops the opener and renders peak-only; add an escalation branch or bless peak-only. Not demo-blocking. |
| 62 | 009 · Cross-pod recovery clause time-neutral | Cross-pod recovery clause is time-neutral | type:polish | area:web | — | OPEN | — | → 009 copy revisit | A cross-pod recovery ("…then eased") names the peak's pod but not the easing pod; minor, not a mis-pod. |
| 63 | 009 · Collapse "a little tense" to a single word | Copy: collapse "a little tense" to a single word | type:polish | area:web | — | OPEN | — | → future copy pass (needs word chosen) | The only multi-word band label; a single word tightens the headline + the partial-easing clause. |

---

## Counts

| Metric | Count |
|---|---|
| **Total issues** | **63** |
| OPEN | 58 |
| CLOSED (created-then-closed as fixed) | 4 |
| CLOSED (not planned) | 1 |
| `priority:blocker` | 2 |
| `status:watch` | 9 |

- **CLOSED-as-fixed (4):** #1, #2, #3 (feature 001), #44 (feature 005).
- **CLOSED-as-not-planned (1):** #11 (password strength meter — decided do-not-implement).
- **`priority:blocker` (2):** #33 (`/signup` open self-serve), #46 (ToS/Privacy/consent gate).
- **`status:watch` (9):** #5, #7, #8, #48, #49, #50, #51, #52, #54.
- **`type:` distribution:** bug 13 · tech-debt 18 · polish 10 · feature 17 · tooling 5.
- **`area:` usage:** web (most), api, ml-video, db, infra, docs. **`area:ml-audio` is unused** by any current item (no audio-modality backlog items yet) — created per the taxonomy for forward use (feature 018).

---

## Phase 2 `gh label create` commands (DO NOT RUN — listed for review)

One per taxonomy label, exact hex from DECISIONS 2026-06-24. Colors given without `#`.

```bash
gh label create "type:bug"         --color "d73a4a" --description "Known-wrong behavior"
gh label create "type:tech-debt"   --color "845422" --description "Structural cleanup"
gh label create "type:polish"      --color "bfdadc" --description "UX nicety, non-blocking"
gh label create "type:feature"     --color "0e8a16" --description "New capability"
gh label create "type:tooling"     --color "5319e7" --description "Harness/CI/dev-tooling"
gh label create "area:web"         --color "1d76db" --description "apps/web"
gh label create "area:api"         --color "006b75" --description "apps/api"
gh label create "area:ml-video"    --color "8250df" --description "packages/ml-video"
gh label create "area:ml-audio"    --color "a371f7" --description "Audio modality"
gh label create "area:db"          --color "fbca04" --description "Supabase / migrations / RLS"
gh label create "area:infra"       --color "5a6772" --description "Azure / CI / cloudflared"
gh label create "area:docs"        --color "0075ca" --description "Docs only"
gh label create "priority:blocker" --color "b60205" --description "Pre-production deploy blockers"
gh label create "status:watch"     --color "fef2c0" --description "Monitor-only, no work yet"
```

`wontfix` is intentionally **NOT** created (per DECISIONS 2026-06-24 — no current item qualifies). See Flag K for the one rejected-but-kept item.

---

## Flagged rows (decide before Phase 2)

**Flag W — `watch` items: type + status, or status only?**
Rows #5, #7, #8, #48, #49, #50, #51, #52, #54 are `watch`. The 2026-06-24 mapping
gives `watch` → `status:watch` + open, but doesn't assign a `type:`. I assigned
each a `type:` from its nature (the 008 watch bullets self-suggest one, e.g. #52
says `type:bug`). **Decision:** keep `status:watch` + a `type:` on each (current
proposal), or `status:watch`-only? Recommend keeping both for filterability.

**Flag R — #43 fidelity check: RESOLVED 2026-06-24 → stays OPEN (NOT-COVERED).**
Investigated whether feature-008's *reported* 2026-06-20 served-path validation
covers #43's ask (a real StressID clip through the full `ml_video` chain vs the
notebook's `compute_anchor_from_video` / `extract_full_feature_vector` within float
tolerance). Checked specs/008, PROGRESS, DECISIONS, CHANGELOG, MODELS + git log:
**no committed end-to-end StressID-vs-notebook validation exists.** 008's
"bit-identical (max|Δ|=0, cosine=1.0) GATE 1" is the keep-up tail-decode vs the
whole-file decode — a *different* comparison; 008 treats single-clip extraction as
faithful-by-construction, citing only the isolated LBP-TOP golden
(`test_lbp_interpolation_fidelity.py`) — exactly the isolated guard #43 says is NOT
the end-to-end check. Not closeable on committed evidence → **migrate OPEN.**

**Flag B — #3 Cross-tab auth sync: RESOLVED 2026-06-24 → `type:bug`.**
Framed in BACKLOG as a smoke-test defect ("original tab did not update"); though
delivered as cross-tab propagation, it **corrected a defect**, so it migrates as
`type:bug` (down-classified from the earlier `type:feature` proposal). Already
CLOSED (fixed) either way — this is a tidy consistency call.

**Flag C — #4 area for `supabase/` config? (#13 RESOLVED → `area:infra`.)**
#4 (email templates under `supabase/templates/` + `config.toml`) has no clean
`area:` — `area:db` is "Supabase/migrations/RLS", which it isn't strictly; kept as
the closest Supabase umbrella (confirm, or prefer `area:infra`). **#13 RESOLVED
2026-06-24 → `area:infra`** (the seed-reachability friendly-error is seed/dev-tooling,
not DB schema — a label call, no BACKLOG change).

**Flag G — #7 postcss advisory: no `type:security` label.**
A dependency/security-advisory watch item. The taxonomy has no security type; I
used `type:tech-debt` + `status:watch`. Confirm that's acceptable (vs adding a
`type:security`, which would be a taxonomy change).

**Flag K — #11 Password strength meter: RESOLVED 2026-06-24 → CLOSED (not planned).**
Decided: migrate as `type:feature` but **created-then-closed as "not planned"**
(GitHub `state_reason: not_planned`), the body recording the decided
do-not-implement rationale (requirements-checklist approach chosen; entropy meter
OWASP-discouraged). `wontfix` label still not created. BACKLOG entry updated to a
decided do-not-implement record.

**Flag P — #41 Feature-005 scope pointer: partial resolution.**
2 of 3 sub-items are DONE (anchor read-path via 008; calibration UX via 005 PR
#17); only sub-item (3) the design-system token pass remains. I keep ONE OPEN
issue scoped to sub-item (3), with the body recording (1)+(2) as done. Confirm,
vs splitting/retitling.

**Flag S — #38 carries the 006 Safari coverage-gate addendum + a pre-prod note.**
#38 (ST-21/ST-24) embeds a feature-006 coverage-gate Safari/WebKit smoke
addendum whose text says "clear before relying on live inference". I did **not**
add `priority:blocker` (only the two ⛔-marked items get it per the task), but
this is a soft pre-production gate. Confirm it stays `type:tooling` without
blocker, or split the 006 addendum into its own issue.

**Flag X — #53 "merged 2026-06-24".**
That phrase is a **BACKLOG-entry merge** (this 016 item absorbed the feature-001
"Manager dashboard time-range insights" item during the PR #28 cleanup), **not**
work completion. State is OPEN. Confirm the reading.

**Flag F — #6 Node 22.11 overdue.**
Address-by was "before feature 005", which has shipped; the entry is un-struck so
it stays OPEN. Just noting the deadline passed; no state change.

**Flag W2 — #2 / #44 closed items: `type:` inferred.**
Both struck items only say "resolved" with no original `type:`. #2 inferred
`type:tech-debt` (an extraction refactor), #44 inferred `type:tech-debt` (a
pre-launch gate bundling CSP/smoke/mobile-HTTPS). Confirm the inferred types for
the closed issues.

---

## Confirmation

- **No GitHub labels created. No GitHub issues created. No labels/issues edited.**
- Only `docs/_issue-migration-plan.md` (this file) was written; no other repo
  file changed.
- This is a review artifact only; Phase 2 (a separate prompt) performs creation.
