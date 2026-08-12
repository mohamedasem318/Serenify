# Implementation Plan: Public Surface & Legal

**Branch**: `013-public-surface-and-legal` | **Date**: 2026-07-25 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `specs/013-public-surface-and-legal/spec.md` (landed PR #159, amended PR #160; all eight open questions resolved — do not reopen).

**Constitution**: v1.13.0 (Amendment 17) governs. This feature **implements** Principle V's Wordmark block and Principle I's public-communication rule; it **must not** amend the constitution.

**Branch discipline**: every PR in this feature targets `013-public-surface-and-legal`. The feature branch merges to `main` only when implementation, smoke tests, and documentation are all complete.

**Terminology (binding on this document, `tasks.md`, code, comments, and copy)**: **calibration** = baseline capture; **monitoring session** = live camera inference, and **"check-in" is the friendly name for exactly that**; **weekly work-environment survey** = the text questionnaire, which is **never** called a check-in. Where an existing filename contains `checkin`/`checkin-card`, the filename is quoted as-is and the prose names the concept.

> **AMENDED 2026-08-12 by #198** (`docs/CHANGELOG.md`, `docs/DECISIONS.md`). This paragraph originally read: *"**weekly work-environment check-in** = the text questionnaire. Bare 'check-in' is never used."* That is the reverse of the rule above, and it was reversed deliberately. The signed-in dashboard has said **Start check-in** on the button that turns a camera on since feature 008, while the Terms and Privacy Policy this feature shipped reserved "check-in" for the questionnaire and called the camera capture a monitoring session — so the product and its own legal text used the same noun for the two things a reader most needs to tell apart. The app's wording is what users actually read, so the documents moved to it. `terms_privacy@2026-08-12.1` and `camera_inference@2026-08-12.1` are the resulting revisions, both classified **material**. **ST-12 below still reads "check-in" and should be read as "survey"** — smoke-test text is a record of what was run, and is not rewritten after the fact.

---

## 0. Stop-and-report findings (read before approving this plan)

Per request §5, work stops and reports at each of these. Nothing below has been silently resolved.

### 0.1 ✅ RESOLVED — replacement copy is APPROVED

Signed off **2026-07-25**. Four strings — the hero lede, the replacement "Never" card, the closing story beat, and the footer line — are recorded verbatim, with their constraints, in **§10.3**. The blocker on phases **P6** and **P7** is lifted; both now depend only on their build predecessors.

### 0.2 ✅ RESOLVED BY INSPECTION — the silhouette ID mapping is **NOT reversed**

Verified three independent ways against `docs/mockups/serenify-landing-mock.html`:

| SIL key | x-range (viewBox 0–100) | Position in photo |
|---|---|---|
| `mohamed` | 0.34 → 21.84 | leftmost (the man) |
| `fatma` | 22.16 → 40.59 | second from left |
| `hebatullah` | 64.91 → 81.47 | **inner right** (the person wearing glasses) |
| `gehad` | 79.47 → 97.78 | **outer right** (rightmost) |

1. The x-ranges are strictly ascending in the key order `mohamed < fatma < hebatullah < gehad`, which is exactly FR-024's required left-to-right card order.
2. The mock's own `TEAM` array (`:807–812`) lists the same four keys in the same order.
3. The four paths were rasterised over the photo (parsed as pure `M`/`L`/`Z` polylines, scaled ×16 / ×11.64) and each outline traces one person's body precisely. **Heba is inner, Gehad is outer.** Not reversed.

**Residual, and it is a real one**: no artefact in this repository establishes *which human being* is which name. Points 1–3 prove the data is internally consistent and geometrically correct; they cannot catch a mis-labelling made at tracing time that would be wrong in both the `SIL` keys and FR-024 together. That single fact is a human check → **smoke test ST-7**.

### 0.3 ✅ DECIDED — `README.md` contradicts the voice FR-048a requires; fixed as a P3 ride-along

Four lines state manager visibility and the privacy slider in unqualified present tense, with no not-yet-live marker:

- `README.md:11` — "Managers see graded trends for their reports — never raw video, never chat content."
- `README.md:15` — "managers get graded bands, aggregates, and trends…"
- `README.md:16` — "a direct manager sees only their own reports; skip-level and above see anonymized org-wide aggregates."
- `README.md:18` — "**Employee-controlled granularity** — a three-position privacy slider: full detail, summary only, or off during set hours."

This is **not** an FR-050 stop: constitution, code, and the text this feature will write all agree (no manager surface is live; the slider arrives with 018). The README is a *fourth* public text that disagrees with all three. Constitution Amendment 17's own cross-reference sweep identified these exact four lines and deliberately left them unedited — correctly, since bulk-editing prose is not an amendment's job. Once `/privacy` ships saying the slider is not live, the repo's front page will say it exists.

**Already tracked.** `docs/BACKLOG.md:2006–2045` carries the entry, paired with GitHub issue **#158** (`type:tech-debt` / `area:docs`, OPEN). It names the same four lines and already prescribes the fix shape.

**✅ DECIDED 2026-07-25 — fix it as a ride-along in P3**, in the voice `apps/web/components/account/privacy-placeholder.tsx:23–27` already models. The fix is **not uniform across the four lines**, per #158 and confirmed here:

- **Lines 15, 16, 18** — one added sentence marking the block as the designed end-state and stating that no manager-facing surface is live today.
- **Line 11 — split the sentence; do not append a qualifying clause.** It welds a permanent Principle I invariant to a not-yet-live claim inside one sentence: *"Managers see graded trends for their reports"* (**not live**) — *"never raw video, never chat content"* (**permanent invariant**, true today and forever). Appending a marker would drag the invariant under it, implying the raw-video and chat-content guarantees are merely planned. That is false, and it is exactly the other-direction flattening Amendment 17 forbids. After the split, the invariant stands unqualified and only the manager-visibility half carries the marker.

**#158 closes with this feature.** P8 marks its BACKLOG entry resolved and closes the issue in the same change, alongside #75 and #157 (Principle VIII — never one without the other).

### 0.4 ⚠️ REPORTED — photo filename case

The request names `apps/web/public/IMG-20260706-WA0054.JPG`. The file on disk is `IMG-20260706-WA0054.jpg` (lowercase extension), 3024×4032, 1.24 MB. Immaterial on Windows, material on the Linux build host. Recorded so the crop task references the real path. The file is replaced by the cropped asset in **P7** and the 1.24 MB original is removed from `public/` (it must not ship — nothing references it).

### 0.5 ⚠️ REPORTED — `/onboarding` is a calibration surface, and the spec's gate hook does not name it

FR-037 hooks the camera consent gate "before a user's first-ever calibration". For a brand-new employee that moment is **`/onboarding`**, not `/app/calibrate`: `app/(onboarding)/onboarding/onboarding-form.tsx:24` advances from a `"name"` step to an `"anchor"` step that mounts `<AnchorRecorder>`, and `/onboarding` is registered in `CAPTURE_ROUTES` (`next.config.ts:103`) and in `isCaptureRoute` (`proxy.ts:73`) precisely because it calls `getUserMedia`.

This is **not** a spec defect — FR-037 fixes the *moment* ("first-ever calibration"), and the plan is where the *routes* are named. Recorded prominently because gating only `/app/calibrate` would let every new employee's first-ever capture run with no consent recorded, which is the exact failure FR-038 exists to prevent. **All three capture routes are gated** (§7.2).

### 0.6 ✅ RESOLVED — footer attribution vs. the named controller

The mock's footer read "© 2026 Serenify — Capital University" while FR-046 names the controller as **Mohamed Asem, as an individual (there is no legal entity)**. Both can be true (academic affiliation ≠ data controller), but a reader moving from the footer to `/privacy` met an apparent contradiction. **Decided 2026-07-25**: the footer ships as **"© 2026 Serenify"** (§10.3). With no institutional attribution in the footer, there is no contradiction to resolve.

### 0.7 ✅ No constitution amendment is required by this plan

Every token used already exists in `apps/web/app/globals.css` in both themes: `--color-ink`, `--color-meadow-text`, `--color-foggy`, `--color-meadow`, `--color-amber`, `--color-muted`, `--color-bg`, `--color-surface`, `--color-border`. `--color-on-accent` and `--color-scrim` (issue **#155**) are used by existing components this feature reuses; they remain unregistered in Principle V and ride along with the next Principle V amendment. **Not fixed here, not amended here.**

---

## 1. Summary

Build Serenify's public front door and the legal surface behind it, plus the two consent gates and the re-consent machinery that makes them durable.

Nine separable pieces: the shared **wordmark** component (Amendment 17); the **consent ledger** (one append-only table, RLS owner-only, an in-repo version registry); the **signup** and **camera/inference** gates; the **app-shell entry gate** for material Terms/Privacy revisions; the **`/terms`** and **`/privacy`** documents; the **public shell** (navbar + footer); the **root-route takeover** and **hero story card**; and the **team section**.

Two things make this feature harder than its parts:

1. **Neither gate is one-time.** Both consented texts can be revised; a revision judged **material** re-prompts everyone whose recorded consent predates it. Consent is therefore a **history** — one row per accepted revision, never overwritten — and the Terms/Privacy gate blocks the **whole application**, not just signup. That is the highest-blast-radius change in the feature.
2. **Every data-handling claim must be true of the system as shipped.** The signed-off landing mock carries three lines that Amendment 17 forbids. The mock is gitignored and cannot be fixed by a PR, so the rule binds at **copy-transcription time** (§10).

The landing page reuses real components and Graphite tokens; the mock's standalone CSS is a throwaway visual reference (FR-057).

---

## 2. Technical Context

**Language/Version**: TypeScript (strict) on Next.js 16 (App Router, `proxy.ts`), React 19.2, Tailwind CSS v4. SQL (Postgres/Supabase). Python 3.12 for the migration-parse privacy gate.

**Primary Dependencies**: **no new runtime dependency.** Existing only — `@supabase/ssr` + `@supabase/supabase-js`, `framer-motion` (already used by `bloom.tsx`), `react-hook-form` + `zod`, `next-themes`, `lucide-react`, Radix `Sheet` (the mobile-nav pattern). No MDX, no typography plugin, no charting library.

**Storage**: one new table, `public.user_consents`, in one new migration. No change to `profiles`, `monitoring_sessions`, `window_readings`, chat, or questionnaire storage. One additive edit to the existing `handle_new_user()` trigger (§6.6).

**Testing**: Vitest + React Testing Library (pure modules and components); a **static migration-parse pytest gate** in `apps/api/tests/` mirroring `test_privacy.py` / `test_chat_storage_rls.py` / `test_questionnaire_privacy.py`; a **layout-only Playwright** spec under the existing `playwright.layout.config.ts` (no database) for the hero card's zero-pixel invariant; two narrow additions to the existing auth Playwright specs; a live psql RLS probe (documented technique, run by hand); `smoke-tests.md` per Principle VII gate 5.

**Target Platform**: Web (Vercel). Public surface correct at **320 / 375 / 414 / 768 px** (FR-053 — stricter than Principle VI's 360 floor; the stricter number governs). Light and dark equal priority.

**Project Type**: Web application. Work is inside `apps/web` and `supabase/migrations`, plus one pytest file in `apps/api/tests` and three touched files outside the React tree (`opengraph-image.tsx`, two Supabase email templates).

**Performance Goals**: the landing page makes **no authenticated call and consumes no user data** (spec Assumptions). The hero story is entirely scripted — no inference service, no camera, no real person's data. One `setTimeout` chain at ≥1.4 s intervals plus one `IntersectionObserver`; nothing animates under reduced motion.

**Constraints (non-negotiable)**: no `localStorage`/`sessionStorage` anywhere in this feature (FR-051); no fake device chrome (FR-052); no model performance figures on the landing page or in either legal document (FR-004 — "subject-disjoint" named without numbers); reuse real components and Graphite tokens (FR-057); the public navbar is non-translucent `bg-bg` matching the app header but is a separate component with no authed links (FR-018/FR-019); hero CTAs are exactly **"Get started"** (meadow-filled) and **"See how it works"** (outline), both centred on mobile (FR-020); consent is never backfilled (FR-041); declining writes no withdrawal or revocation state and deletes nothing (FR-043e).

**Scale/Scope**: ~9 PRs into the feature branch. One migration. One new route group with four pages. Five wordmark call sites plus three hand-sync exceptions. 17 story beats, 6 chapters, 4 swap panels, 4 silhouettes, 8 external links.

**Next 16 caveat**: `apps/web/AGENTS.md` requires reading the relevant guide under `node_modules/next/dist/docs/` before writing code. Two areas in this feature are specifically exposed: **route groups + the root `page.tsx`** (P3/P6) and **`next/image` sizing** (P7). Read those before implementing, do not infer from Next 14/15 habits.

---

## 3. Constitution Check

*GATE: evaluated against v1.13.0. Re-checked after the design below — unchanged.*

| Principle | Verdict | Notes |
|---|---|---|
| **I. Privacy by Architecture** (NON-NEGOTIABLE) | ✅ PASS | Adds a gate, changes no data flow. `user_consents` is owner-only (ENABLE + FORCE RLS, self SELECT/INSERT, **no** manager or admin policy, no UPDATE/DELETE grant). The landing page reads no user data. The **public-communication rule** is implemented structurally (§9.3): every manager-visibility passage is a named constant carrying its not-yet-live marker, asserted by a unit test. FR-002's two forbidden claim families are asserted absent. Privacy review at §3.1. |
| **II. Subject-Disjoint ML Evaluation** (NON-NEGOTIABLE) | ✅ PASS | No model work. The **method** is named in the legal text ("subject-disjoint"), with **zero numbers** (FR-004) — asserted by test. The metrics on the poster inside the team photograph are accepted by FR-004 and the photo is **not** edited to remove them. |
| **III. Modality Isolation** | ✅ N/A | No modality package touched. |
| **IV. LLM Provider Abstraction** | ✅ N/A | No LLM. The hero story's Ren dialogue is **scripted static copy**, not a model call. |
| **V. Calm-First Design Language** | ✅ PASS | Implements the **Wordmark** block: one shared component, `seren` in `ink` / `ify` in `meadow-text`, lowercase, no terminal punctuation, with the two named hand-sync exceptions enforced by a test (§8). No new token, no token value change. Amber = stress only; foggy = the approved landing liberty for Ren (FR-022, the mock's own `var(--foggy)`); **no red anywhere**. Voice: calm, no exclamation marks, never alarmist. Radii 8–20 px, 0.5 px borders, no glassmorphism. |
| **VI. Responsive & Accessible by Default** | ✅ PASS | 320 px floor (stricter than 360); ≥44 px single-line tap targets; light + dark in tandem; `prefers-reduced-motion` respected via the repo `useMediaQuery` (which **re-subscribes** — framer-motion's `useReducedMotion` snapshots at mount and is forbidden here); every interactive element keyboard-reachable with a visible focus indicator; the team mapping is obtainable without hover. |
| **VII. Mandatory Testing Per PR** | ✅ PASS | Strategy at §12, weighted to DB-level and server-level proof plus unit tests and a human smoke, per the request and the repo's history of green e2e masking cross-session defects. `smoke-tests.md` authored in P8. |
| **VIII. Spec-Driven Workflow** | ✅ PASS | `spec.md` + this `plan.md`; `tasks.md` and `smoke-tests.md` follow. Slot `013-public-surface-and-legal` is ratified (Amendment 16). BACKLOG↔Issues: **#75** and **#157** close in P8 with their BACKLOG entries marked resolved in the same change; **#62** stays open and untouched; **#86** and **#155** are referenced, not owned. **Privacy Policy / ToS per-PR rule**: this feature *is* the Privacy Policy and ToS — every later phase that changes a data-handling statement updates both documents in its own PR. |
| **IX. Secrets Discipline** (NON-NEGOTIABLE) | ✅ PASS | One new optional server env var (`CONSENT_ENTRY_GATE_ENABLED`, §7.3) declared in `lib/env/schema.ts` and `.env.local.example` with no value committed. No key, no private hostname. `mohamedasem318@gmail.com` is a **published controller contact required by FR-046**, not a secret. |
| **X. Dataset Stewardship** (NON-NEGOTIABLE) | ✅ PASS | The team photograph contains the four project members only — **no StressID subject imagery**, so the 12 withheld-consent subjects are not engaged. Real teammate names appear **only** on the public team section, which is exactly the use Principle X reserves them for; no demo employee, fixture, or sample manager row uses them. No commercialization. |

### 3.1 Privacy review (Development Workflow gate 6)

This feature touches signal-capture **entry** (it gates calibration and monitoring sessions) and publishes a description of the whole data flow. Principle I invariants hold:

- **No data flow changes.** No new column on `profiles`, `window_readings`, or `monitoring_sessions`; no new read path; no probability, label, or raw signal reaches any new surface. The migration is asserted (by static parse) never to alter, update, delete, annotate, or trigger on `window_readings` or `monitoring_sessions`.
- **`user_consents` is employee-private.** ENABLE + FORCE RLS; `FOR SELECT`/`FOR INSERT` `TO authenticated USING/WITH CHECK ((select auth.uid()) = user_id)`; no manager, admin, or `reports_under` policy; `REVOKE ALL FROM anon, authenticated` then `GRANT SELECT, INSERT` only. Matches the questionnaire migration's posture exactly.
- **Declining destroys nothing.** No row is written, no prior row is touched, no reading or session is deleted, no revocation or withdrawal state exists to write. Enforced by a `BEFORE UPDATE` immutability trigger, the absence of any UPDATE/DELETE grant or policy, and a `decision` CHECK that admits only `'granted'` today.
- **No purge is described, promised, or implied.** The 90-day retention policy is stated as a **policy**; BACKLOG **#86** is not owned here (FR-003, FR-043e).
- **Manager visibility is described, never flattened**, per FR-048a and Principle I's public-communication rule, with the not-yet-live marker **at the point of use** (§9.3).

---

## 4. Project Structure

### 4.1 Documentation (this feature)

```text
specs/013-public-surface-and-legal/
├── spec.md                    # final (PR #159 + #160); not edited by this plan
├── plan.md                    # this file — the spine
├── research.md                # Phase 0 — the parked decisions, the two seams, the test strategy
├── data-model.md              # Phase 1 — registry shape, table, migration, RLS, grants, trigger
├── contracts/                 # Phase 1 — the module boundaries other code depends on
│   ├── consent-evaluate.md    #   the evaluate.ts surface
│   ├── consent-gates.md       #   the three gates, incl. the opposite fail directions
│   ├── wordmark.md            #   the shared component + the two hand-sync exceptions
│   ├── landing-hero-story.md  #   the hero story card's panel/beat/layout invariants
│   └── public-surface.md      #   team section, legal documents, navbar + footer
├── quickstart.md              # Phase 1 — run and validate locally
├── checklists/requirements.md # pre-plan quality gate (exists)
├── tasks.md                   # /speckit-tasks — NOT created here
└── smoke-tests.md             # authored in P8 (§13)
```

> **Section numbers are stable across the split.** Every `§n.n` keeps the number it had while Phase 0 and Phase 1 were folded into this one file, so every existing cross-reference still resolves — only the file changed. Where each section now lives:
>
> | Section | File |
> |---|---|
> | §0 findings · §1 Summary · §2 Technical Context · §3 Constitution Check · §4 Project Structure · §5 Design overview · §10 Copy discipline · §13 smoke-test table · §14 Phasing · §15 Risks · §16 Complexity Tracking | `plan.md` (this file) |
> | §6.1 A1 · §6.2 A2 · §6.3 A3 · §6.4 A4 · §6.6 signup seam · §8 wordmark location · §11 routing · §12 testing strategy | `research.md` |
> | §6.1 registry shape and types · §6.5 table, migration, RLS, grants, immutability trigger · §6.6 the `handle_new_user()` SQL | `data-model.md` |
> | §6.2 the `evaluate.ts` surface | `contracts/consent-evaluate.md` |
> | §7.1 signup · §7.2 camera/inference · §7.3 app-shell entry · §7.4 no backfill · §7.5 declining ≠ withdrawal | `contracts/consent-gates.md` |
> | §8 component, five consumers, two hand-sync exceptions | `contracts/wordmark.md` |
> | §9.1 hero story card | `contracts/landing-hero-story.md` |
> | §9.2 team · §9.3 legal documents · §9.4 public shell | `contracts/public-surface.md` |
>
> §6.1 and §8 are the two sections that split: the **decision** is in `research.md`, the **shape/contract** it produces is in `data-model.md` / `contracts/wordmark.md`. Each half names the other.
>
> **Single-sourced, deliberately.** The four approved copy strings (**§10.3, this file**), the migration SQL and the `document_version` CHECK regexes (`data-model.md`), and the `evaluate.ts` signatures (`contracts/consent-evaluate.md`) each appear in exactly one place. Every other artifact cross-references them and does not restate them.

### 4.2 Source code

```text
apps/web/
├── app/
│   ├── (public)/                       # NEW route group — public shell (navbar + footer)
│   │   ├── layout.tsx                  # NEW  PublicNavbar + PublicFooter
│   │   ├── page.tsx                    # MOVED from app/page.tsx — ?code= → signed-in → landing
│   │   ├── terms/page.tsx              # NEW
│   │   └── privacy/page.tsx            # NEW
│   ├── page.tsx                        # DELETED (moved into (public); only one page may own "/")
│   ├── opengraph-image.tsx             # MODIFIED — hand-sync wordmark exception
│   ├── (auth)/
│   │   ├── layout.tsx                  # MODIFIED — consume <Wordmark>
│   │   └── signup/{actions.ts,signup-form.tsx}   # MODIFIED — server-side acknowledgement gate
│   ├── (onboarding)/
│   │   ├── layout.tsx                  # MODIFIED — consume <Wordmark>
│   │   └── onboarding/page.tsx         # MODIFIED — camera consent gate before the anchor step
│   └── (authed)/
│       ├── layout.tsx                  # MODIFIED — app-shell entry gate (highest blast radius)
│       └── app/{calibrate,monitor}/page.tsx      # MODIFIED — camera consent gate
├── components/
│   ├── brand/wordmark.tsx              # NEW — the one shared definition (Principle V)
│   ├── header/header.tsx               # MODIFIED — consume <Wordmark>
│   ├── monitor/bloom.tsx               # MODIFIED — one optional `color` prop (default = today)
│   ├── consent/
│   │   ├── terms-acknowledgement-field.tsx   # NEW — signup checkbox + new-tab document links
│   │   ├── camera-consent-gate.tsx           # NEW
│   │   └── terms-reconsent-screen.tsx        # NEW — rendered in place of the app shell
│   ├── legal/legal-document.tsx        # NEW — shared document chrome
│   ├── public/{public-navbar.tsx,public-footer.tsx,public-mobile-nav.tsx}   # NEW
│   └── landing/                        # NEW — hero, story card, panels, chapter markers,
│                                       #       never-cards, how-it-works, status, team
├── lib/
│   ├── bands.ts                        # NEW — the ONE band-label definition (FR-015)
│   ├── session-trend-geometry.ts       # MODIFIED — imports BAND_LABEL instead of inlining
│   ├── consent/
│   │   ├── registry.ts                 # NEW — the version registry (pure, no server-only)
│   │   └── evaluate.ts                 # NEW — pure gate logic (binding version, satisfies)
│   ├── landing/
│   │   ├── story-script.ts             # NEW — the 17 beats as pure data
│   │   ├── copy.ts                     # NEW — every landing string, one reviewable module
│   │   └── team-silhouettes.ts         # NEW — SIL copied VERBATIM, frozen
│   ├── legal/copy.ts                   # NEW — every legal string, one reviewable module
│   ├── auth/schemas.ts                 # MODIFIED — signUpSchema gains the acknowledgement
│   └── env/schema.ts                   # MODIFIED — CONSENT_ENTRY_GATE_ENABLED
├── public/team/serenify-team-2026.jpg  # NEW — the 1600×1164 crop (see §9.2)
├── public/IMG-20260706-WA0054.jpg      # DELETED — the 1.24 MB original must not ship
└── tests/layout/landing-hero-stability.spec.ts   # NEW — zero-pixel-drift proof

supabase/
├── migrations/20260726000000_user_consents.sql   # NEW — the only migration
└── templates/{confirmation.html,recovery.html}   # MODIFIED — hand-sync wordmark exception

apps/api/tests/test_consent_privacy.py            # NEW — static migration-parse privacy gate

README.md                                          # MODIFIED — §0.3 ride-along in P3 (closes #158)
```

---

## 5. Design overview

Nine pieces, three of which are load-bearing and get their own sections: the **consent model** (§6), the **gates** (§7), and the **copy discipline** (§10). The rest are §§8–9 and §11.

---

## 6. Consent data model and the re-consent mechanism

> **Detail lives in:** [`research.md`](./research.md) §§6.1–6.4 and §6.6 — the four parked decisions (A1–A4) with full rationale and rejected alternatives, plus the signup-seam analysis · [`data-model.md`](./data-model.md) — §6.1 the registry shape and types, §6.5 the table, migration, RLS, grants and immutability trigger, §6.6 the `handle_new_user()` edit · [`contracts/consent-evaluate.md`](./contracts/consent-evaluate.md) — §6.2 the `evaluate.ts` surface.

---

## 7. The gates

> **Detail lives in:** [`contracts/consent-gates.md`](./contracts/consent-gates.md) — §7.1 the server-side signup gate, §7.2 the camera/inference gate (**fails CLOSED**), §7.3 the app-shell entry gate (**fails OPEN**; the highest blast radius in this feature, with its fail-open log line and both revert levers), §7.4 existing users are never backfilled, §7.5 declining is not withdrawal.

---

## 8. Wordmark

> **Detail lives in:** [`contracts/wordmark.md`](./contracts/wordmark.md) — the shared component, its five in-tree consumers, and the two hand-sync exceptions with the test that enforces them · [`research.md`](./research.md) §8 — why the component lives in `components/brand/` rather than `components/ui/`.

---

## 9. Landing page, team section, legal documents

> **Detail lives in:** [`contracts/landing-hero-story.md`](./contracts/landing-hero-story.md) — §9.1 the hero story card's panel, beat and layout invariants · [`contracts/public-surface.md`](./contracts/public-surface.md) — §9.2 the team section, §9.3 the two legal documents and the FR-048a mechanism, §9.4 the public navbar and footer.

---

## 10. Copy discipline

### 10.1 Where transcription happens, and the check

The mock is read in exactly **two** phases: **P6** (landing shell and hero story) and **P7** (team section). Nothing before P6 reads it. The check has three parts:

1. **One reviewable surface.** All landing copy lands in `apps/web/lib/landing/copy.ts` and nowhere else — no string literals in landing components. The forbidden-claim review is therefore a review of one file, not of a component tree.
2. **An automated assertion.** `tests/unit/landing/forbidden-claims.test.ts` runs over every exported string in `lib/landing/copy.ts` **and** `lib/legal/copy.ts`, asserting zero matches for the two forbidden claim families of FR-002, with the mock's three literals (`:442`, `:550`, `:772`) included verbatim as negative fixtures so the test proves it can actually catch them.
3. **The grep discipline, written down because it is easy to get wrong.** `docs/mockups/` is gitignored, so a default `rg` **cannot see the mock**. Any search of it must pass `--no-ignore` or scope to `*.html`:
   ```
   rg --no-ignore "nothing reaches a manager|anonymised group trends|never a manager" docs/mockups/
   ```
   This appears in `tasks.md` on the P6 and P7 transcription tasks, not only here.

### 10.2 The three forbidden lines, located and characterised

| Line | What it is | Why it is forbidden |
|---|---|---|
| `:442` | hero lede — "…checks in with the person — **never a manager**. What happens next is always their call." | a blanket manager-negation claim |
| `:547–551` | an entire **"Never"** card: heading "**Show a manager your readings.**" + body "A team lead sees anonymised group trends and nothing else. Not your individual readings, not your conversations, not a name attached to a bad afternoon." | the **card's premise** is the forbidden claim — replacing it is a structural decision, not a line edit |
| `:772` | the final story beat — `say('Nothing here ever reaches a manager.')` | a blanket manager-negation claim |

`:772` is narration-only (the beat sets no panel, band, or thread state), so replacing it changes one string and no structure. `:442` is likewise a single string. `:547–551` is a whole card.

### 10.3 ✅ Replacement copy — **APPROVED 2026-07-25. Use verbatim.**

Every string below is constrained to the only two claim families FR-001 verifies as unconditionally true: **(a)** raw video — transmitted for inference, deleted on every outcome including errors, never persisted, no human including an admin can view or replay it; and **(b)** companion chat content and crisis disclosures — these never reach a manager, admin, or employer, permanently. **Nothing about readings, trends, or manager visibility generally appears in any of them**, because that is precisely the claim Amendment 17 forbids flattening.

These are fixed copy in the sense of FR-032: they go into `lib/landing/copy.ts` character-for-character and are not re-worded during implementation.

**Position 1 — `:442`, the hero lede.** Replaces "…checks in with the person — never a manager…".

> Serenify notices signs of strain during the workday and checks in with the person first. What happens next is always their call.

The manager clause is dropped rather than re-scoped: the approved FR-005 data-handling line — "Your camera is read, then forgotten. Only the reading is kept." — already sits directly below at `:449`, so a lede that also made a raw-video claim would read as repetition. Family: none. It asserts nothing about visibility at all.

**Position 2 — `:547–551`, the whole "Never" card.** The card becomes a *different refusal*, keeping the three-card grid and the "Never" tag. This is a structural replacement, not a body rewrite — the heading changes too.

> **Never**
> **Read your conversations.**
>
> What you say to Ren is yours. Companion chat, and anything you disclose in a crisis, never reaches a manager, an admin, or an employer. Not now, not ever.

Family (b), stated unconditionally and correctly: this is a Principle I invariant, not an unbuilt control, so it carries no not-yet-live marker (FR-001). The closing sentence is **"Not now, not ever."** — *not* "Not now, not later.", which would read as a deferral of the promise rather than its permanence.

**Position 3 — `:772`, the closing story beat.** Narration only; the beat sets no panel, band, or thread state.

> What you said stays yours. The video was read and forgotten.

Two constraints on this string, both load-bearing:

1. **Clause order is deliberate and must not be reversed.** The chat clause comes **first** so the deletion frame in the second clause does not bleed backwards and imply the conversation was deleted too. It was not — companion chat is **stored**, employee-private (chat RLS is self-only). "Stays yours" is a privacy claim; "read and forgotten" is a deletion claim; they attach to different things and the order is what keeps them attached correctly. Swapping the clauses would make the line false.
2. **It must not wrap at 320px.** The narration line is fixed-height (FR-009), so a second line would either clip or force the fixed height up. **Asserted in the layout stability spec** (§12.2) alongside the zero-drift check: at 320 px the narration element's rendered line count is 1 for this beat, and for every other beat's narration.

**Footer.** Replaces "© 2026 Serenify — Capital University".

> © 2026 Serenify

Resolves §0.6: with no institutional attribution in the footer, there is no apparent contradiction with `/privacy` naming Mohamed Asem as the individual data controller. The academic context is stated where it belongs — in the team section and in the legal documents' StressID licensing note — not in a copyright line that reads as an entity claim.

**P6 and P7 are unblocked.**

---

## 11. Routing — the root-route takeover

> **Detail lives in:** [`research.md`](./research.md) §11 — the decision to keep both existing behaviours in the root page component, the precedence order, why this does not move into `proxy.ts`, the `force-dynamic` cost, and the route-group mechanics.

---

## 12. Testing strategy (Principle VII)

> **Detail lives in:** [`research.md`](./research.md) §12 — the four proof layers, how each required proof is obtained, and what is deliberately **not** e2e · [`quickstart.md`](./quickstart.md) — the commands that run them.

---

## 13. `smoke-tests.md` — what automation cannot catch

Authored in **P8**, run by Mohamed, results recorded inline, before the feature branch merges to `main`.

| ID | Check |
|---|---|
| **ST-1** | Two-colour wordmark reads correctly at all five in-tree sites (public navbar, public footer, app header, auth pages, onboarding) in **both** themes, at 320 px and desktop. `seren` ink / `ify` meadow-text, lowercase, no dot. This is a **visible change** to three surfaces that shipped single-colour. |
| **ST-2** | The two hand-sync exceptions match by eye: fetch the OG card, and trigger a **real** confirmation email and a **real** recovery email, viewed in a light client and a dark client. |
| **ST-3** | Hero story, full ~42 s cycle on a real phone at 320 / 375 / 414 and a tablet at 768: the false-alarm beat resolves **before** any companion beat; nothing clips; no scrollbar appears inside the card; the card does not resize when the thread trims to 4. |
| **ST-4** | Ren's blue orb (foggy) reads as intended and calm next to the meadow/amber band states — **FR-022 approved liberty; do not "correct" it to the monitor's band colouring.** Mohamed's aesthetic call. |
| **ST-5** | Reduced motion toggled at the **OS level mid-session**: the story stops auto-advancing immediately (proving the hook re-subscribes rather than snapshotting at mount), no transition plays, the readout stays visible, chapter markers still work. |
| **ST-6** | Scroll the hero out of view and back: the story pauses and resumes, and does **not** jump or double-advance on return. |
| **ST-7** | **Silhouette identity** — Mohamed confirms the inner-right outline highlights **Hebatullah** and the outer-right highlights **Gehad** (§0.2: the one fact no repository artefact can establish). Also: all four outlines register on a real touch screen. |
| **ST-8** | Root route on a real deployment: a signed-in visitor at `/` reaches the app without re-authenticating; a **real** Supabase email link landing on `/` with `?code=` completes the sign-in. |
| **ST-9** | Signup gate end to end, including **with JavaScript disabled** (the `signUpFromForm` progressive-enhancement path): unchecked → blocked with a reason and no account; opening `/terms` and `/privacy` loses no entered data; checked → account created and exactly one consent row exists. |
| **ST-10** | App-shell gate: publish a **material** revision locally → sign in → blocked; **read both documents in full**; **sign out** works; accept → unblocked, with the earlier row still present. Then **exercise both revert levers** — flip `CONSENT_ENTRY_GATE_ENABLED=false`, and separately `git revert` the gate commit — and confirm the app is fully usable after each. An untested kill switch is not a kill switch. **Then run ST-10a**, which exercises the same two levers against the failure mode most likely to require them. |
| **ST-10a** | **Silent-empty read → universal lockout, and both levers recover from it.** The §7.3 fail-open branch triggers on `null` or an **error**. The more likely RLS defect returns **zero rows with no error at all** — `auth.uid()` resolving to null in some server context, so `user_consents_select_self` matches nothing. That reads as "this user has no consent", sets `blocked = true`, and locks out **every** user — and fail-open never fires, because nothing failed. **Induce it without an error**: in a local psql session, `ALTER POLICY user_consents_select_self ON public.user_consents USING (false);` (or otherwise make `auth.uid()` fail to resolve in the server context) — the `SELECT` still succeeds, it just returns nothing. Then confirm: (a) an authenticated user is blocked by the re-consent screen even though their consent row exists; (b) the lockout is **reproducible** — a second user and a second session are blocked identically, so this is not a one-request blip; (c) **`[consent-gate] FAIL-OPEN` does *not* appear** in the server log for those requests, which is the whole point — this failure is silent to the mitigation ST-10b verifies. Then confirm **both** revert levers recover a fully usable app **from this exact state**, each tested from the locked-out condition: `CONSENT_ENTRY_GATE_ENABLED=false` + redeploy, and separately `git revert` of the **P5** gate commit. Restore the policy afterwards and confirm the gate behaves correctly again. The levers already cover this failure mode by design (§7.3, R2); what is being verified here is that they have actually been exercised against it. |
| **ST-10b** | **Fail-open is observable.** Induce a persistent consent read failure (e.g. `REVOKE SELECT ON public.user_consents FROM authenticated` in a local psql session, or point the client at a renamed column), then load an authed route. Confirm the app **stays usable** (fail-open works) **and** that `[consent-gate] FAIL-OPEN` appears in the server log for that request. Restore the grant and confirm the log stops. A gate that can switch itself off in silence is the failure nobody reports — §7.3, R2. |
| **ST-11** | Camera gate: on a device that has **never** granted camera permission, confirm the browser's permission prompt does **not** appear until after consent is given — at `/onboarding`, at `/app/calibrate`, and at `/app/monitor`. |
| **ST-12** | Decline the camera consent, then complete a **weekly work-environment check-in** on `/app`. It works normally. Existing readings and sessions are still visible. |
| **ST-13** | Mohamed reads `/terms` and `/privacy` end to end against FR-048a: manager visibility stated plainly, never softened or buried, with its not-yet-live marker **in the same passage**; the no-legal-review notice is unmissable; zero performance figures. |
| **ST-14** | Team section with the photo **blocked** (DevTools request blocking) and on a throttled connection: name cards, links, and supervisor credits remain readable and usable; layout does not collapse. |
| **ST-15** | All eight external links open the correct real GitHub and LinkedIn profiles. |

---

## 14. Phasing

Each phase is one PR into `013-public-surface-and-legal`, independently buildable, reviewable, and revertible.

| Phase | Scope | Depends on |
|---|---|---|
| **P1 — Wordmark** | `components/brand/wordmark.tsx`; three existing in-tree sites converted; OG card + both email templates hand-synced; the sync contract test. | **nothing** |
| **P2 — Consent foundation** | `lib/consent/{registry,evaluate}.ts`; the `user_consents` migration (table, immutability trigger, RLS, grants); the additive `handle_new_user()` edit; `apps/api/tests/test_consent_privacy.py`; the exhaustive evaluator suite. **No UI.** | **nothing** |
| **P3 — Legal + public shell** | `app/(public)/` group with `layout.tsx`, `terms/`, `privacy/`; `components/legal/`; `lib/legal/copy.ts`; public navbar + footer (**"© 2026 Serenify"**, §10.3) + mobile nav; the copy-invariant tests; **the §0.3 `README.md` fix — one added sentence for lines 15/16/18, a sentence *split* for line 11**. **`/` is untouched.** | **P1, P2** — P1 for the shared `<Wordmark>` the new navbar and footer consume; **P2** because the legal document chrome renders its version id and publication date **from the registry** (`contracts/public-surface.md` §9.3) and the first `terms_privacy` entry lands in the **same PR as the wording** (`research.md` §6.1), so P3 edits `lib/consent/registry.ts`. Free under Order A, where P2 precedes P3 regardless. |
| **P4 — The two prompting gates** | Signup acknowledgement (schema, action, field, new-tab links); camera/inference gate at all three capture routes; the Account → Baseline route back. | P2, P3 |
| **P5 — App-shell entry gate** | `(authed)/layout.tsx` gate; `TermsReconsentScreen`; `CONSENT_ENTRY_GATE_ENABLED`; the fail-open log line (§7.3). **Alone in its PR.** | P2, P3 |
| **P6 — Landing page** | Root-route takeover (`app/page.tsx` → `app/(public)/page.tsx`); `lib/bands.ts` + the `session-trend-geometry` refactor; `bloom.tsx`'s optional `color` prop; `story-script.ts`; the hero story card with the three approved strings from §10.3; the remaining landing sections; the layout stability spec incl. the 320 px narration no-wrap assertion. | P3 |
| **P7 — Team section** | Photo crop + asset placement; `team-silhouettes.ts` (verbatim + frozen); overlay, name cards, links, caption, supervisors. | P6 |
| **P8 — Wrap** | `smoke-tests.md` authored and run; BACKLOG **#75**, **#157** and **#158** marked resolved and all three GitHub issues closed in the same change (Principle VIII — never one without the other); `docs/DECISIONS.md`, `docs/CHANGELOG.md`, `docs/PROGRESS.md` entries; the TTFB follow-up logged as a BACKLOG candidate; merge to `main`. | all |

### 14.1 Why this order

**P1 first** because it is mechanical, touches nothing else, and is near-zero risk — and because P3's new navbar and footer consume it, so doing it first means writing the wordmark once rather than twice.

**P2 second** because it is pure plus SQL with no UI, so its exhaustive evaluator suite and its DB gate land before any surface depends on them. Nothing can be built on the consent model until the model is proven.

**P3 before P4** is forced by **FR-036**: the consent gate must ship together with the real, complete documents, never as a checkbox linking to placeholders. Building the gate first would create a build in which that is false.

**P5 alone and after P4** because it is the highest-blast-radius change in the feature. Isolating it in its own PR is what makes `git revert` a clean one-command rollback.

**P7 after P6** because the team section renders inside the landing page that P6 creates.

### 14.2 The tradeoff — ✅ DECIDED 2026-07-25: **Order A**

The reasoning is kept on the record below, unedited, because why this was decided is worth as much as what was decided.

**#75** is a ⛔ pre-production data-processing blocker. It closes when `/terms`, `/privacy`, and the signup consent gate all ship — that is **P2 + P3 + P4**.

- **Order A (as tabled above): legal first.** #75's dependencies are complete after four PRs. The legally binding half is written and reviewed while schedule pressure is lowest — which matters, because FR-050 exists precisely to stop legal text being written in a hurry. **Cost**: the hero story card, the single largest and least predictable implementation item in the feature (17 beats, four absolutely positioned panels, a zero-pixel-drift geometry contract at four widths, reduced motion, an `IntersectionObserver` with a known repo gotcha, chapter markers), is discovered last. If it overruns, it overruns at the end, against the deadline.

- **Order B: hero first** (P6 promoted ahead of P4/P5). The largest unknown is costed in week one, and any overrun surfaces while there is still room to cut scope. **Cost**: the deploy blocker stays open longest, and the legal documents get written last — under exactly the time pressure that produces a policy that misdescribes the data handling. FR-050 calls that outcome worse than having no policy.

**Decision: Order A**, as tabled in §14. The hero card's risk is *schedule* risk — bounded, visible, and cuttable; the legal text's risk is *correctness* risk on a durable public promise, and it is the one this feature is fundamentally about. The phase table stands as written.

---

## 15. Risks

| # | Risk | Mitigation |
|---|---|---|
| **R1** | ⛔ **CI guard checks do not run for PRs into a feature branch.** `.github/workflows/ci.yml:8–12` triggers only on `pull_request: branches: [main]` and `push: branches: [main]`. All three checks — **`python (ruff · pytest)`**, **`web (lint · typecheck · vitest)`**, **`speckit-skills guard`** — are therefore **silent** for every PR in this feature. Only Vercel runs. Nine PRs, including a migration and a full-application entry gate, would merge into `013-public-surface-and-legal` with no test signal at all. **This is a separate, standalone fix and a precondition for implementation. It is not part of this plan and it must not be forgotten.** | Add `013-public-surface-and-legal` (or a `013-*` pattern) to the workflow's `pull_request.branches` in its own tiny PR **before P1**. Until it lands, every phase PR runs `npm run -w apps/web lint typecheck test` and `uv run pytest` locally and records the result in the PR body. |
| **R2** | The app-shell gate locks out every user — **or, inversely, silently switches itself off.** A *persistent* read failure (RLS wrong after a migration, a dropped grant) makes the fail-open branch permanent, disabling the Terms gate for every user with nothing on any surface to show it. | Lockout: renders in place (never redirects, so it cannot loop); fails **open** on any read failure; confined to one file; ships alone and last; env kill switch; both revert levers exercised in ST-10 — and again in **ST-10a** against a **zero-rows-no-error** read, the lockout shape fail-open cannot catch because nothing errors. Silent-off: the fail-open branch **logs `[consent-gate] FAIL-OPEN`** server-side with the user id and the underlying error, so one occurrence is noise and a steady stream is a visible outage; **ST-10b induces the failure and confirms the log fires**. §7.3. |
| **R3** | Forbidden copy transcribed from the mock. | Copy confined to two modules; automated forbidden-claim assertion with the mock's own literals as negative fixtures; the `--no-ignore` grep discipline recorded on the transcription tasks; transcription confined to P6/P7, and the four replacement strings are fixed verbatim in §10.3 so they are not re-invented at implementation time. |
| **R4** | Silhouettes misaligned because the shipped photo is not the exact crop. | The crop recipe is verified reproducible against the mock's embedded 1600×1164 image (mean per-channel Δ 3.86/255); a unit test freezes each path's length and hash; `preserveAspectRatio="none"` over an exact-aspect box is recorded as a hard constraint; ST-7 confirms on a real device. |
| **R5** | The `session-trend-geometry` refactor for `BAND_LABEL` regresses the live monitor graph. | Pure literal extraction with zero behaviour change, covered by the existing `session-trend-geometry` unit suite; lands in P6 where it is reviewable in isolation. |
| **R6** | `bloom.tsx` is a shipped monitor component and this feature touches it. | One **optional** prop with a default that reproduces today's behaviour exactly; every existing call site is unchanged; asserted by the existing bloom tests plus one new test that omitting `color` yields the current `--bloom` value per tone. |
| **R7** | `raw_user_meta_data` is client-controllable, so a **malformed** signup consent version could be written. | Shape-constrained by two DB CHECKs; a non-registry value never satisfies `satisfiesConsent()`, so the shell gate still prompts that user; detectable by the §6.3 reconciliation query. Same trust level as `full_name` today. Distinct from **R8** below, which is the *well-formed* case. §6.6. |
| **R8** | ⚠️ **SC-006 is bypassable outside the product's UI.** `lib/consent/registry.ts` ships in the web bundle, so the current version id is public. A caller who skips the signup surface entirely and calls Supabase Auth directly with the publishable anon key can pass the **real** current id in `options.data` and obtain a **fully satisfying** `terms_privacy` consent row without the acknowledgement ever being rendered or checked. The shell gate cannot catch it — the row is valid by every check the system can make. **SC-006 therefore holds for 100% of accounts created through the product's own signup surface (every real user path, JS and no-JS) and does not hold against a caller bypassing that surface.** | Not closable by this feature: any client-originated account is forgeable by a client while an unauthenticated party may create an account at all. Blast radius is one forged row for the forger's own account (RLS scopes the write to `auth.uid()`; no cross-user write, no privilege escalation). The root cause is **#62** (`/signup` open self-serve), a ⛔ pre-production deploy blocker that is out of scope here and **stays open** — and which must close before real user data is processed, exactly as this feature must. §6.6. |
| **R9** | Next 16 route-group + root-page semantics differ from earlier versions. | `apps/web/AGENTS.md` requires reading `node_modules/next/dist/docs/` first; P3 and P6 carry that as an explicit task precondition. |
| **R10** | Three existing surfaces change appearance in P1 (single-colour → two-colour wordmark) before anyone expects it. | Called out in the P1 PR description and in ST-1 as an intentional, constitution-mandated visible change. |
| **R11** | The landing page's `force-dynamic` root hurts TTFB. | Near-free for anonymous visitors (no session cookie ⇒ `getUser()` short-circuits without a network call; the proxy runs regardless). If production disagrees, moving only the signed-in redirect into `proxy.ts` is a scoped follow-up — logged as a BACKLOG candidate in P8, not done here. §11. |
| **R12** | The approved closing narration wraps to two lines at 320 px, breaking the fixed-height narration row (FR-009). | Asserted in the layout stability spec at 320 px for **every** beat (§12.2). A failure is a copy-length problem, not a CSS one — the string would need re-approval, not a taller row. |
| **R13** | `README.md` and `/privacy` disagree about manager visibility and the privacy slider. | **Decided** (§0.3): fixed as a P3 ride-along — one added sentence for lines 15/16/18, a sentence **split** for line 11 so the permanent invariant is not dragged under the not-yet-live marker. Closes **#158**, with its BACKLOG entry marked resolved in the same change. Risk now reduces to "P3 ships the copy fix but the split is done as an append" — caught in review against the §0.3 wording. |

---

## 16. Complexity Tracking

| Violation | Why needed | Simpler alternative rejected because |
|---|---|---|
| Consent version registry lives in code, not the database | Publishing a revision must be a reviewable pull request; no admin publishing surface exists or is owned by any planned feature | A `consent_document_versions` table needs a privileged write surface nobody owns, plus a migration or manual production insert per copy revision, and duplicates provenance git already holds authoritatively (§6.3) |
| A `decision` column whose CHECK admits exactly one value today | FR-043 requires a shape that does not preclude withdrawal; feature 018 widens the CHECK and inserts a new row | Presence-of-row semantics ("a row means granted") force 018 to add a column or a second table, and turn "current state" into a two-table question (§6.5) |
| `(authed)/layout.tsx` renders a different tree instead of redirecting | A redirect-based gate can loop, and a loop here is a total product lockout | A `redirect()` to a consent route inside the same group is the classic lockout bug; rendering in place cannot loop (§7.3) |
| One optional prop added to the shipped `bloom.tsx` | Bloom sets `--bloom` as an inline style on its own element, which an ancestor cannot override; FR-021 forbids reimplementing the orb and FR-022 requires Ren's blue state | A landing-only copy of Bloom violates FR-021 outright; a CSS-variable override from an ancestor does not win against an inline style (§9.1) |
| `next/image` on the team photo rather than a plain `<img>` | Keeps `@next/next/no-img-element` green without a disable, and explicit `width`/`height` give the container the photo's exact aspect ratio, which the `preserveAspectRatio="none"` overlay depends on | A raw `<img>` needs an eslint disable and hand-maintained aspect-ratio CSS to keep the outlines aligned (§9.2) |
