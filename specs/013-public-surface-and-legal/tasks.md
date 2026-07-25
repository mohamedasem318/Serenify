# Tasks: Public Surface & Legal (013)

**Branch**: `013-public-surface-and-legal` | **Date**: 2026-07-25 | **Plan**: [plan.md](./plan.md) | **Spec**: [spec.md](./spec.md)

> ## This file covers **P1, P2, and P3 only**
>
> Phases **P4–P8** are deliberately **not** generated here. They build on components that
> P3 has not created yet (the legal documents the signup gate must link to, the public
> shell the landing page renders inside, the `(public)` group the root route moves into),
> so writing their tasks now would be guesswork that a later run would regenerate anyway.
>
> **P4–P8 follow in a later `/speckit-tasks` run**, after P3 has landed and the real
> component names, props, and file shapes exist to point at. Their scope is already fixed
> in `plan.md` §14 and is not re-opened by this file.

**Input**: `plan.md` (spine — §0 findings, §4.1 section map, §10.3 approved copy, §13 smoke
tests, §14 phasing, §15 risks), `research.md`, `data-model.md`, `contracts/wordmark.md`,
`contracts/consent-evaluate.md`, `contracts/consent-gates.md`, `contracts/public-surface.md`,
`quickstart.md`.

**Tests are tasks, not an afterthought** (Principle VII, `plan.md` §12). The weighting is the
plan's: database-level and server-level proof plus unit tests, with e2e reserved for what
genuinely needs a browser. Nothing in P1–P3 needs one.

---

## Format

```text
- [ ] [TaskID] [P?] [Phase] Description with exact file path(s)
```

- **`[P]`** — parallelisable: touches files disjoint from its siblings and has no
  dependency on an incomplete task.
- **`[P1]` / `[P2]` / `[P3]`** — the **plan phase** (`plan.md` §14), which is what a PR maps
  to in this feature.

> **Do not confuse plan phases with spec priorities.** `spec.md` numbers its user stories
> by priority (US1/US2 are Priority P1, US3 is P2, US4 is P3). This file's `[P1]`/`[P2]`/`[P3]`
> are **build phases** from `plan.md` §14 — one PR each. The mapping:
>
> | Phase | Delivers | Spec user stories served | Requirements |
> |---|---|---|---|
> | **P1** | Wordmark | US1 (partly) | FR-029, FR-030, FR-031 |
> | **P2** | Consent foundation | US2 (foundation only — no UI) | FR-035, FR-039, FR-041, FR-043a–e |
> | **P3** | Legal + public shell | US3, and US1's shell | FR-016, FR-018, FR-019, FR-023, FR-044–FR-050 |

---

## Process — binding on every task in this file

**Branching.** One branch per phase, cut from `013-public-surface-and-legal`:

| Phase | Branch | PR target |
|---|---|---|
| P1 | `p1-wordmark` | `013-public-surface-and-legal` |
| P2 | `p2-consent-foundation` | `013-public-surface-and-legal` |
| P3 | `p3-legal-public-shell` | `013-public-surface-and-legal` |

**Branch names MUST NOT match `[0-9][0-9][0-9]-*`.** `.github/workflows/ci.yml:24–27` has a
`push` trigger on that pattern (added in #164); a branch named `013-p1-wordmark` would fire
both the `push` run and the `pull_request` run, which is why #166 showed every check twice.
Feature-branch PRs do not need the push run — `p1-wordmark` gives one clean check list.

**Never target `main`.** The feature branch merges to `main` only in P8, once implementation,
smoke tests, and documentation are all complete (`plan.md` §9 header note).

**Commits.** Per-file commits — never `git add -A`. Every commit carries all three co-author
trailers:

```text
Co-authored-by: Fatma-Alzahraaa <...>
Co-authored-by: gehaddmohamedd <...>
Co-authored-by: hebatullah003 <...>
```

**Never write a `Claude-Session:` trailer or any `claude.ai` URL** into a commit message, PR
description, or issue comment. This repository is public and those URLs link to private agent
sessions. This applies to the squash-merge message too.

**CI.** R1's trigger fix **has landed** — `.github/workflows/ci.yml:19–27` now runs on
`pull_request` and `push` for `main` **and** `[0-9][0-9][0-9]-*`, and the feature branch
carries that commit (#164 / `cbb7f81`, merged at `528f70e`). All three checks —
`python (ruff · pytest)`, `web (lint · typecheck · vitest)`, `speckit-skills guard` — therefore
run on every phase PR into `013-public-surface-and-legal`.

Each phase still ends with a local verification task, because (a) the checks are landed
**non-blocking**, so green is not enforced by branch protection, and (b) for `pull_request`
GitHub reads the workflow from the PR's *merge* ref — if a phase PR ever shows **no** checks,
the R1 fallback applies verbatim: run `npm run -w apps/web lint typecheck test` and
`uv run pytest` locally and record the results in the PR body (`plan.md` §15 R1).

---

## Constraints that bite at task level

1. **Terminology is binding** (`plan.md` §11 header). **calibration** = baseline capture ·
   **monitoring session** = live camera inference · **weekly work-environment check-in** = the
   text questionnaire. Bare "check-in" is never used — not in task text, not in file names,
   not in test names, not in copy. Where an existing filename contains `checkin`, quote the
   filename as-is and name the concept in prose.
2. **No `localStorage` or `sessionStorage` anywhere in this feature** (FR-051). Guarded by
   T033. *Pre-existing occurrences outside this feature (`app/layout.tsx:74` theme bootstrap,
   `components/anchor/device-memory.ts`, `lib/questionnaire/*`, `components/home/recent-chats-card.tsx`)
   are not this feature's and MUST NOT be "fixed" here.*
3. **`© 2026 Serenify` is fixed copy**, verbatim, per `plan.md` §10.3 — the **only** approved-copy
   string in P1–P3 scope. The other three approved strings (hero lede, the replacement "Never"
   card, the closing story beat) belong to **P6/P7**. **Do not pull landing copy forward into
   P1–P3.**
4. **The mock is gitignored.** `docs/mockups/serenify-landing-mock.html` is invisible to a
   default `rg` — any search of it MUST pass `--no-ignore` or scope to `*.html`:
   ```
   rg --no-ignore "nothing reaches a manager|anonymised group trends|never a manager" docs/mockups/
   ```
   **No task in P1–P3 reads the mock.** Per `plan.md` §10.1 the mock is read in exactly two
   phases — **P6** and **P7** — and this discipline is recorded on those transcription tasks.
   T031's negative fixtures come from **`plan.md` §10.2**, which quotes all three forbidden
   literals verbatim, so the P3 test needs no mock read.
5. **Single-sourcing holds.** The migration SQL and both `document_version` CHECK regexes live
   only in `data-model.md` §6.5/§6.6. The `evaluate.ts` signatures live only in
   `contracts/consent-evaluate.md`. Tasks below **reference** them and do not restate them.
   A task that copies SQL or a signature into this file is a defect in this file.
6. **P2 writes no UI**, and its migration performs **no backfill, ever** (§7.4, FR-041) — see
   T012's precise scoping of that assertion.
7. **Wordmark hand-sync is same-PR.** The `next/og` social card and both Supabase email
   templates are updated in the **same PR** as any wordmark change, with the sync contract
   test (`contracts/wordmark.md`). P1 does all three together or it does none of them.
8. **Next 16 is not the Next.js you know.** `apps/web/AGENTS.md` requires reading the relevant
   guide under `node_modules/next/dist/docs/` before writing route code. P3 is exposed on
   route groups + the root `page.tsx` (T020, R9).

---

## Phase 0: Precondition

**Purpose**: confirm the one thing `plan.md` §15 R1 calls "a precondition for implementation".

- [ ] T001 Verify the CI guard checks actually run on a PR into `013-public-surface-and-legal` by inspecting `.github/workflows/ci.yml` on the feature branch. **Done when**: `.github/workflows/ci.yml` on `013-public-surface-and-legal` contains `[0-9][0-9][0-9]-*` under both `on.pull_request.branches` and `on.push.branches`, and the three jobs `python`, `web`, `speckit-skills guard` are present. **This is a verification, not a build** — the fix landed in #164 (`cbb7f81`) and reached the feature branch at `528f70e`. If it is somehow absent, land it in its own tiny PR **before P1** and do not start T002 until it is green. Dependencies: none.

**Checkpoint**: phase PRs will show a check list. P1 and P2 may now start — **in parallel**.

---

## Phase 1: P1 — Wordmark (branch `p1-wordmark`)

**Depends on**: nothing. **Parallelisable with Phase 2 at the phase level** — P1 and P2 share
no file, no module, and no test, so two people can run them simultaneously and the PRs merge
in either order.

**Goal**: one shared two-colour wordmark definition, three existing in-tree sites converted, both
hand-sync exceptions updated in this same PR, and a test that makes the sync obligation
enforceable rather than remembered.

**Independent test**: `npm run -w apps/web test` is green including the new
`tests/unit/brand/wordmark-sync.test.ts`; the app header, auth pages, and onboarding pages
render `seren` in ink and `ify` in meadow-text in both themes.

**Implements**: constitution v1.13.0 **Amendment 17** (Principle V, Wordmark block). **MUST NOT
re-amend the constitution.** Issue **#155** (`--color-on-accent`, `--color-scrim` unregistered)
is noted, not owned, not fixed here (`contracts/wordmark.md`, `plan.md` §0.7).

### Implementation

- [ ] T002 [P1] Create the shared wordmark component at `apps/web/components/brand/wordmark.tsx`, exactly the shape in `contracts/wordmark.md` §8. **Done when**: it exports `Wordmark({ className }: { className?: string })`; the wrapper carries `font-display lowercase tracking-tight` merged with the caller's `className` via `cn()`; the two halves are `<span className="text-ink">seren</span>` and `<span className="text-meadow-text">ify</span>`; there is **no** dot or terminal punctuation anywhere in the markup; and all size/spacing comes from the caller (no size class inside the component). Lives in `components/brand/`, **not** `components/ui/` — that namespace is the shadcn primitive namespace regenerated from `components.json` (`research.md` §8). Dependencies: T001.

- [ ] T003 [P] [P1] Convert the authed app header to consume the component — `apps/web/components/header/header.tsx:26–28`. **Done when**: the hand-typed `<span className="font-display text-2xl … text-ink">serenify</span>` is replaced by `<Wordmark className="text-2xl leading-none" />`, no literal `serenify` text node remains in the file, and the existing `components/header/header.test.tsx:34` assertion `toHaveTextContent("serenify")` **still passes unchanged** (two spans still yield the same `textContent` — if that test needs editing, the split is wrong). Dependencies: T002.

- [ ] T004 [P] [P1] Convert the auth-pages layout — `apps/web/app/(auth)/layout.tsx:41–43`. **Done when**: replaced by `<Wordmark className="text-4xl leading-none sm:text-5xl" />`, preserving the current rendered size at both breakpoints, and no literal `serenify` text node remains in the file. Dependencies: T002.

- [ ] T005 [P] [P1] Convert the onboarding layout — `apps/web/app/(onboarding)/layout.tsx:39–41`. **Done when**: replaced by `<Wordmark className="text-4xl leading-none sm:text-5xl" />`, preserving the current rendered size at both breakpoints, and no literal `serenify` text node remains in the file. Dependencies: T002.

- [ ] T006 [P] [P1] **Hand-sync exception 1** — split the wordmark in the social card at `apps/web/app/opengraph-image.tsx:52`, and update the existing test that asserts its old shape at `apps/web/tests/unit/social-metadata.test.ts:32`. **Done when**: (a) the single `serenify` text node becomes two elements coloured with the **dark-theme** token values — `seren` `#E2E5E8`, `ify` `#63B292` — because the card is dark-themed (`background: "#101214"`); (b) the containing element keeps `display: "flex"`, which Satori requires on any element with more than one child; (c) `tests/unit/social-metadata.test.ts:32`'s regex `/>\s*serenify\s*</` is replaced — **it cannot match a split wordmark and will fail otherwise** — by assertions covering both halves and both hex values; (d) `npm run -w apps/web test social-metadata` is green. Dependencies: T001.

- [ ] T007 [P] [P1] **Hand-sync exception 2** — split the wordmark in both Supabase email templates, `supabase/templates/confirmation.html:38` and `supabase/templates/recovery.html:38`, and update the existing test that asserts their old shape at `apps/web/tests/unit/supabase-email-templates.test.ts:60,69,72`. **Done when**: (a) each `<p class="wordmark">serenify</p>` becomes two inline-styled child spans carrying the **light** values `#1C2023` (`seren`) and `#346A56` (`ify`); (b) **both** the `prefers-color-scheme: dark` block and the `[data-ogsc]` block override **both halves** with the dark values `#E2E5E8` / `#63B292` — a rule that only recolours `.wordmark` no longer reaches the halves once they carry their own inline colour; (c) the existing inline font declaration `font:400 24px/1 Outfit,Inter,Arial,sans-serif;letter-spacing:0;` is preserved on the wordmark element; (d) `tests/unit/supabase-email-templates.test.ts:60`'s regex `/>serenify<\/[^>]+>/` is replaced — **it cannot match a split wordmark and will fail otherwise** — and the dark-override assertions at `:69`/`:72` are extended to prove both halves flip; (e) `npm run -w apps/web test supabase-email-templates` is green, including the preview generation. Dependencies: T001.

### Tests for P1

- [ ] T008 [P1] Create the sync contract test at `apps/web/tests/unit/brand/wordmark-sync.test.ts`, implementing all four assertions of `contracts/wordmark.md` verbatim. **Done when**: (1) it parses `apps/web/app/globals.css` for the **live** values of `--color-ink` and `--color-meadow-text` in both themes — the values are read, never hard-coded, so a token change fails CI rather than drifting; (2) it reads `app/opengraph-image.tsx` from disk and asserts the split uses the **dark** values; (3) it reads both email templates and asserts the light split **and** that both the `prefers-color-scheme: dark` and `[data-ogsc]` blocks override both halves with the dark values; (4) it asserts `components/brand/wordmark.tsx` names the token classes, and that **no file outside `components/brand/` contains a hand-typed rendered wordmark**. Assertion (4) MUST match a *rendered* wordmark (a JSX/HTML text node), **not** the bare substring `serenify` — the repo legitimately contains ~20 non-wordmark occurrences (storage keys such as `serenify-theme` and `serenify-anchor-camera`, broadcast channel names, mock filenames like `serenify-008-monitoring-mock.html`, and `serenify.tech`), and a substring match would fail against all of them. Dependencies: T002, T006, T007.

- [ ] T009 [P] [P1] Component test for the shared wordmark at `apps/web/tests/unit/components/brand/wordmark.test.tsx`. **Done when**: it asserts the two halves render with `text-ink` and `text-meadow-text` respectively; the accessible text content is exactly `serenify`; the wrapper is `lowercase`; a caller-supplied `className` reaches the wrapper; and the rendered output contains no `.`, `!`, or other terminal punctuation (FR-030). Dependencies: T002.

### Ship P1

- [ ] T010 [P1] Run the phase verification and open the P1 PR from `p1-wordmark` into `013-public-surface-and-legal`. **Done when**: `npm run -w apps/web lint typecheck test` and `uv run pytest` are green locally (on Windows run Vitest with `--pool=threads`; `quickstart.md` Gotchas) with the results recorded in the PR body; the PR body **calls out R10 explicitly** — three existing surfaces (app header, auth pages, onboarding) change appearance from single-colour to two-colour, and that is an intentional, constitution-mandated visible change to be confirmed by **ST-1**; commits are per-file with the three co-author trailers; there is no `Claude-Session:` trailer and no `claude.ai` URL; and all three CI checks are green on the PR. Dependencies: T003, T004, T005, T008, T009.

**Checkpoint**: the wordmark has one definition, both exceptions are synced, and drift on either side of the boundary now fails CI. P3 can consume `<Wordmark>`.

---

## Phase 2: P2 — Consent foundation (branch `p2-consent-foundation`)

**Depends on**: nothing. **Parallelisable with Phase 1 at the phase level.**

**Goal**: the consent model — the in-repo version registry, the pure evaluator, the one
migration, and the proof layers under all three. **No UI.** Nothing in this phase renders.

**Independent test**: `uv run pytest apps/api/tests/test_consent_privacy.py` is green;
`npm run -w apps/web test` is green including the exhaustive evaluator table; `supabase db reset`
applies the migration cleanly; the three live psql probe results are recorded.

**Reads**: `data-model.md` §6.1 (registry shape), §6.5 (table/migration/RLS/grants/trigger),
§6.6 (the `handle_new_user()` edit) · `contracts/consent-evaluate.md` (the three signatures) ·
`research.md` §6.1–§6.4, §6.6, §12.2 · `contracts/consent-gates.md` §7.4, §7.5.

### Implementation

- [ ] T011 [P2] Create the version registry module at `apps/web/lib/consent/registry.ts`, exactly the shape single-sourced in `data-model.md` §6.1. **Done when**: it exports `ConsentTextKey`, `Materiality`, `ConsentRevision`, and `CONSENT_REGISTRY` with the declared types; it imports **nothing** from `server-only`, so Vitest can load it (`contracts/consent-evaluate.md`, "Purity"); `tsc --noEmit` is green; and `CONSENT_REGISTRY` declares **both** keys with **empty entry lists**. **Ships no entries.** `research.md` §6.1 fixes the publishing rule — "editing the wording **and** appending a registry entry, in the **same PR**" — so `terms_privacy`'s first revision lands in **P3** with the documents (T023) and `camera_inference`'s lands in **P4** with the camera wording. The exhaustive evaluator suite runs against fixture registries (`research.md` §12.2), not this one, so an empty registry blocks nothing. Dependencies: T001.

- [ ] T012 [P] [P2] Create the migration at `supabase/migrations/20260726000000_user_consents.sql`, using the SQL single-sourced in `data-model.md` §6.5 and §6.6 — **do not re-derive it**. **Done when**: `supabase db reset` applies it cleanly against local Supabase; the table, the `user_consents_lookup_idx` index, the `public.user_consents_immutable()` function and its `BEFORE UPDATE` trigger, `ENABLE` + `FORCE ROW LEVEL SECURITY`, the two owner-self policies, and `REVOKE ALL … FROM anon, authenticated` followed by `GRANT SELECT, INSERT … TO authenticated` are all present; and the additive `handle_new_user()` edit is a `CREATE OR REPLACE FUNCTION` that **preserves verbatim** the existing `profiles` INSERT, `SECURITY DEFINER`, and `SET search_path = public, pg_temp` from `supabase/migrations/20260517000030_profile_trigger.sql:9–24`, without dropping or recreating the `on_auth_user_created` trigger.

  **No backfill, ever** (FR-041, §7.4): the migration writes **no** consent row for any existing user. Note precisely what that means here, because the naive form of the assertion is unsatisfiable — `data-model.md` §6.6 puts an `INSERT INTO public.user_consents` **inside the `handle_new_user()` function body** by design, and that same statement is what records the signup acknowledgement. The prohibition is therefore on **backfill DML**: no `INSERT INTO public.user_consents` **outside** the `handle_new_user()` body, and specifically no `INSERT … SELECT` sourcing `auth.users` or `public.profiles`. T017 asserts exactly that scoping. Dependencies: T001.

- [ ] T013 [P2] Create the pure evaluator at `apps/web/lib/consent/evaluate.ts`, with the three signatures single-sourced in `contracts/consent-evaluate.md` §6.2 — `currentRevision`, `bindingRevision`, `satisfiesConsent`. **Done when**: the exported signatures match the contract **character-for-character** (they MUST NOT gain a registry parameter — test isolation is achieved by module-mocking `registry.ts`, not by widening the public surface); the module reads registry indices only and references neither `decided_at` nor any wall clock; a key whose entry list is empty **throws a clear error** rather than returning `undefined`, since the contract's return type is non-optional; and `tsc --noEmit` is green. Dependencies: T011.

### Tests for P2

- [ ] T014 [P] [P2] Registry guard tests at `apps/web/tests/unit/lib/consent/registry-guards.test.ts`, implementing the four CI-enforced guards of `research.md` §6.1. **Done when**: it asserts (a) every entry has an explicit `materiality` and a non-empty `rationale`; (b) `versionId` values are unique, well-formed, and prefixed with their own key; (c) entries are ordered by `publishedOn` ascending; (d) **append-only** — a frozen fixture snapshot of every previously published entry is compared field-by-field, so editing or removing a published entry fails CI. The frozen-snapshot mechanism MUST exist and be wired now even though it is trivially satisfied against today's empty registry — T023 appends the first entry, and the snapshot is what locks it. Dependencies: T011.

- [ ] T015 [P2] Exhaustive evaluator suite at `apps/web/tests/unit/lib/consent/evaluate.test.ts`, table-driven per `research.md` §12.2. **Done when**: fixture registries cover every shape — first-ever revision; material after material; cosmetic after material; several cosmetics after one material; material after cosmetic — **crossed** with every held-version case — none, the binding one, one before, one after, an unknown id — and every cell asserts the boolean. Plus: a cosmetic revision published after the binding one re-prompts **nobody**; a material revision re-prompts **everybody** holding only earlier versions; a well-formed but non-registry version id **never** satisfies the gate (R7/R8); an empty entry list throws. No database, no users, no timing — which is why this can be exhaustive where an e2e suite cannot (`research.md` §12.3). Dependencies: T013.

- [ ] T016 [P] [P2] Structural isolation test at `apps/web/tests/unit/lib/consent/questionnaire-isolation.test.ts` — the static half of SC-013 (`research.md` §12.2). **Done when**: it asserts by import-graph inspection that **no** module under `apps/web/lib/questionnaire/` or `apps/web/components/questionnaire/` imports anything from `apps/web/lib/consent/`, so consent state and the weekly work-environment check-in are structurally unable to interact. *(Name the concept in prose; the existing `weekly_checkin_cadence` table and any `checkin`-containing filename are quoted as-is and never used as this feature's own naming.)* Dependencies: T011.

- [ ] T017 [P2] Static migration-parse privacy gate at `apps/api/tests/test_consent_privacy.py`, mirroring the style and structure of `apps/api/tests/test_questionnaire_privacy.py` (module docstring naming the migration under test and the invariants; one test per invariant; test ids mapped to task ids). No live DB — the privacy boundary **is** the schema/RLS/grant shape. **Done when** it asserts, over `supabase/migrations/20260726000000_user_consents.sql`:
  - `decision`'s CHECK enumerates exactly `('granted')` — no `declined`, no `withdrawn`, no `revoked`;
  - `document_version` is `NOT NULL` and carries **both** CHECKs (the format regex and the `consent_key` prefix) as written in `data-model.md` §6.5;
  - `decided_at` is `NOT NULL`;
  - `ENABLE` **and** `FORCE ROW LEVEL SECURITY` are both present;
  - exactly two policies exist — `FOR SELECT` self and `FOR INSERT` self, both `TO authenticated` with `(select auth.uid()) = user_id`; **no** UPDATE policy, **no** DELETE policy, and no manager, admin, or `reports_under` policy anywhere;
  - grants are `REVOKE ALL … FROM anon, authenticated` followed by `GRANT SELECT, INSERT … TO authenticated` **only** — no UPDATE grant, no DELETE grant;
  - the immutability trigger exists as `BEFORE UPDATE … FOR EACH ROW`;
  - **no backfill** — no `INSERT INTO public.user_consents` outside the `handle_new_user()` function body, and no `INSERT … SELECT` sourcing `auth.users` or `public.profiles` (the scoping is explained on T012);
  - the migration never alters, updates, deletes from, annotates, or creates a trigger on `public.window_readings` or `public.monitoring_sessions`;
  - no column and no CHECK value expresses withdrawal or revocation;
  - no service-role key and no `service_role` path appears anywhere in the migration.

  **Done when** additionally: `uv run pytest apps/api/tests/test_consent_privacy.py` is green and each assertion is its own named test, so a failure names the invariant it broke. Dependencies: T012.

- [ ] T018 [P2] Live RLS probe against local Supabase, run by hand once, per `quickstart.md` "Live RLS probe" — the repo's documented per-transaction impersonation (`SET LOCAL ROLE` + `set_config('request.jwt.claims', …, true)`). **Done when**: as an `authenticated` user, `UPDATE` on own `user_consents` row raises `42501` (the immutability trigger); `DELETE` on own row affects 0 rows / is permission-denied (no policy, no grant); `SELECT` of another user's row returns 0 rows — and all three results are pasted into the P2 PR body. This is the live counterpart to T017's static parse; neither replaces the other. Dependencies: T012.

### Ship P2

- [ ] T019 [P2] Run the phase verification and open the P2 PR from `p2-consent-foundation` into `013-public-surface-and-legal`. **Done when**: `npm run -w apps/web lint typecheck test` and `uv run pytest` are green locally with results in the PR body; the PR body states plainly that this phase **ships no UI** and **writes no consent row for any existing user**; the T018 probe output is included; commits are per-file with the three co-author trailers; no `Claude-Session:` trailer and no `claude.ai` URL; all three CI checks green. Dependencies: T014, T015, T016, T017, T018.

**Checkpoint**: the consent model is proven at the database layer and exhaustively at the pure layer, before any surface depends on it. P4 and P5 have their foundation.

---

## Phase 3: P3 — Legal + public shell (branch `p3-legal-public-shell`)

**Depends on**: **P1** (per `plan.md` §14 — T025/T027 consume `<Wordmark>`) **and, for T023/T024
specifically, P2's registry module** — the legal document chrome renders its version id and
publication date **from the registry** (`contracts/public-surface.md` §9.3), and the first
`terms_privacy` entry is appended by the PR that publishes the wording (`research.md` §6.1).
Under Order A the build sequence is P1 → P2 → P3 (`quickstart.md` "Build sequence"), so this
costs no schedule; it is recorded because the phase table lists P1 alone.

**Goal**: `/terms` and `/privacy` as real, substantive documents; the public shell (navbar,
footer, mobile nav) they render inside; the copy-invariant mechanisms that keep FR-048a honest;
and the `README.md` voice fix.

**`/` is untouched in this phase.** `app/page.tsx` keeps ownership of the root route; the
`(public)` group gains a `layout.tsx` plus `terms/` and `privacy/` only. The root-route takeover
is **P6**.

**Independent test**: signed out, `/terms` and `/privacy` render with the public navbar and
footer, are reachable from the footer, and are correct at 320/375/414/768 px in both themes;
`npm run -w apps/web test` is green including the three new copy/shell test files.

### Precondition

- [ ] T020 [P3] Read the Next 16 guides for **route groups** and the **root `page.tsx`** under `node_modules/next/dist/docs/` before writing any route file in this phase (`apps/web/AGENTS.md`; `plan.md` §2 Next 16 caveat; R9). **Done when**: the exact guide path(s) consulted are named in the P3 PR body, and one specific question is answered from the docs rather than inferred — *does adding `app/(public)/layout.tsx` with `terms/` and `privacy/` children change anything about `/`, which `app/page.tsx` still owns?* Do not infer route-group semantics from Next 14/15 habits. Dependencies: T010 (P1 merged).

### Copy — the entire review surface for both documents

- [ ] T021 [P3] Write the Terms of Service strings into `apps/web/lib/legal/copy.ts` as **named exported constants** — no string literals in components (`contracts/public-surface.md` §9.3, item 1). **Done when**: the module exists and exports every ToS string as a named constant; it covers the applicable regimes — **Egypt Law 151/2020**, **EU/GDPR** (personal data in Supabase **Frankfurt**), and the **Azure** processing footprint on Container Apps (FR-045); it identifies the controller as **Mohamed Asem, as an individual** (there is no legal entity) at `mohamedasem318@gmail.com`, with **no placeholder remaining** (FR-046); it carries the **unmissable** statement that this is an **informed draft prepared without qualified legal review**, and that such review is required before any real (non-demo) user data is processed (FR-047); the text is real and grounded in this system's flows, not a template (FR-044); and it contains **zero** numeric quality metrics (FR-004). Dependencies: T010.

- [ ] T022 [P3] Write the Privacy Policy strings into `apps/web/lib/legal/copy.ts` (same file, separate commit), plus the two named lists the FR-048a mechanism depends on. **Done when**: the module additionally exports every Privacy Policy string as a named constant, and:
  - webcam-derived inference is described exactly as FR-001 verifies it — video **is transmitted** for inference, **is deleted on every outcome including errors**, is **never persisted**, and **no human, including an admin, can view or replay it**;
  - only the **derived reading** is stored, retained **90 days as a matter of policy**, with **no** claim of an automated purge mechanism (FR-003, BACKLOG #86 not owned here);
  - companion chat is **employee-private**, and companion chat content and crisis disclosures **never reach a manager, admin, or employer — permanently**, stated unconditionally and with **no** not-yet-live marker, because it is a Principle I invariant rather than an unbuilt control (FR-001);
  - crisis disclosures are never persisted, never notify any manager/admin/employer, and route only to verified external resources;
  - **manager visibility per FR-048a** — stress-trend summaries **are** visible to a direct manager, by default, at `summary only` granularity, stated **plainly, never softened, never buried**, with the fact that **no manager-facing surface is live today** **in the same passage**, framed as the designed end-state; a direct manager sees their direct reports only, skip-level and above see aggregated org-wide data only; unqualified present tense is forbidden;
  - the three-position privacy slider and the transparency view are named as **feature 018** and **not live**;
  - a clearly marked **forward-looking section** names audio and physiological modalities, manager dashboards, and the FR-048a controls as not operating today (FR-049);
  - **"subject-disjoint"** is named as the evaluation method, with **zero numbers** (FR-004);
  - **`MANAGER_VISIBILITY_PASSAGES`** is exported as a named list containing exactly the constants that describe manager visibility;
  - **`NOT_YET_LIVE_MARKERS`** is exported as the named list of approved marker phrases the T032 membership check uses. The voice is modelled on `apps/web/components/account/privacy-placeholder.tsx:23–27` — *"Visibility controls arrive with the transparency view. You'll be able to choose what your manager sees and what stays private — there's nothing to configure yet."* **That existing string is compliant and MUST NOT be "corrected"** (FR-048a, `contracts/public-surface.md` §9.3).

  Every factual statement is cross-checked against Principle I **and** the implementation (FR-050): on any discrepancy between constitution, code, and text, **stop and report** — a policy that misdescribes the data handling is worse than none. Dependencies: T021.

- [ ] T023 [P3] Append the first `terms_privacy` revision to `apps/web/lib/consent/registry.ts` **in this same PR as the wording it describes** (`research.md` §6.1). **Done when**: one entry exists for `terms_privacy` with `materiality: "material"` (the first ask is always material — `contracts/consent-evaluate.md`), a non-empty `rationale` naming it as the initial publication, `publishedOn` set to the date this PR lands, and `versionId` of the form `terms_privacy@<publishedOn>.1`; the T014 frozen append-only snapshot fixture is updated to include it (this is the first entry the snapshot locks, and it can never be edited afterwards); `currentRevision("terms_privacy")` and `bindingRevision("terms_privacy")` both return it; and T014's guards are green. **`camera_inference` stays empty** — its first entry belongs to P4 with the camera wording. Dependencies: T022, T011, T014 (P2 merged).

### Components and routes

- [ ] T024 [P3] Create the shared legal-document chrome at `apps/web/components/legal/legal-document.tsx`. **Done when**: it renders a title, the document's **version id and publication date read from the registry** (not hard-coded), section anchors, and the no-legal-review notice as a **bordered notice at the top of the document, not a footnote** (FR-047); it is plain TSX using Graphite tokens with **no** MDX dependency and **no** typography plugin (`contracts/public-surface.md` §9.3); every heading is a real heading element so the section anchors are keyboard- and screen-reader-navigable; and it lays out correctly at 320 px. Dependencies: T023.

- [ ] T025 [P] [P3] Create the public mobile nav at `apps/web/components/public/public-mobile-nav.tsx`, mirroring the app's existing pattern in `apps/web/components/header/mobile-menu.tsx` (FR-019). **Done when**: it uses the Radix `Sheet` with a `SheetTrigger` labelled **"Open menu"**, `side="left"`, `bg-bg`, and `SheetClose`-wrapped links; every tap target is ≥44 px and single-line at 320 px (FR-053); it contains **no** dashboard or authed link; and it uses no `localStorage`/`sessionStorage`. Dependencies: T010.

- [ ] T026 [P] [P3] Create the public footer at `apps/web/components/public/public-footer.tsx` (FR-023). **Done when**: it links to `/privacy` and `/terms`; it renders `<Wordmark />`; and it renders the approved copyright line **`© 2026 Serenify`** **verbatim, character-for-character** per `plan.md` §10.3 — no institutional attribution, no "Capital University", no em-dash suffix (this resolves §0.6; the academic context belongs in the team section and the documents' StressID licensing note, not in a copyright line that reads as an entity claim). Dependencies: T010.

- [ ] T027 [P3] Create the public navbar at `apps/web/components/public/public-navbar.tsx` (FR-018). **Done when**: it visually matches the app header — same 64 px height, same `border-b border-border`, same **non-translucent `bg-bg`**, same wordmark size, same theme-toggle placement — while being a **separate component** with its own nav items and **no dashboard or authed link anywhere**; it renders `<Wordmark />` and composes `<PublicMobileNav />` below the `md` breakpoint; every interactive element has a visible focus indicator (FR-055). Dependencies: T025, T010.

- [ ] T028 [P3] Create the public route-group shell at `apps/web/app/(public)/layout.tsx`. **Done when**: it renders `<PublicNavbar />`, `{children}`, and `<PublicFooter />`; `/terms` and `/privacy` render inside it for a **signed-out** visitor with no authentication call; and **`app/page.tsx` is neither moved, edited, nor deleted** — `/` renders exactly as it does today, verified by loading `/` before and after (the root-route takeover is P6). Dependencies: T020, T026, T027.

- [ ] T029 [P] [P3] Create `apps/web/app/(public)/terms/page.tsx`. **Done when**: it renders `<LegalDocument>` with the ToS constants from `lib/legal/copy.ts` and **no inline string literals**; it exports a page `title`; and it renders for a signed-out visitor at `/terms`. Dependencies: T021, T024, T028.

- [ ] T030 [P] [P3] Create `apps/web/app/(public)/privacy/page.tsx`. **Done when**: it renders `<LegalDocument>` with the Privacy Policy constants from `lib/legal/copy.ts` and **no inline string literals**; it exports a page `title`; and it renders for a signed-out visitor at `/privacy`. Dependencies: T022, T024, T028.

### Tests for P3

- [ ] T031 [P] [P3] Create the forbidden-claim assertion at `apps/web/tests/unit/landing/forbidden-claims.test.ts` (the path `plan.md` §10.1 fixes; **P6 extends this same file** to also cover `lib/landing/copy.ts`). **Done when**: it runs over **every exported string** in `apps/web/lib/legal/copy.ts` and asserts **zero** matches for FR-002's two forbidden claim families — (a) on-device / in-browser video processing ("video never leaves your device", "frames are processed in your browser and discarded") and (b) any **blanket** "nothing reaches a manager" claim; and it includes the mock's three literals as explicit **negative fixtures**, so the test proves it can actually catch them:
  - `:442` — *"…checks in with the person — never a manager. What happens next is always their call."*
  - `:547–551` — *"Show a manager your readings."* / *"A team lead sees anonymised group trends and nothing else. Not your individual readings, not your conversations, not a name attached to a bad afternoon."*
  - `:772` — *"Nothing here ever reaches a manager."*

  The fixtures are taken from **`plan.md` §10.2**, which quotes all three verbatim — **no mock read happens in P3** (`plan.md` §10.1: the mock is read in P6 and P7 only). The detector MUST **not** flag the scoped chat-and-crisis claim FR-001 permits, which is the only form that claim may take; assert that explicitly with the P3 copy as a positive fixture. Dependencies: T022.

- [ ] T032 [P] [P3] Create the legal copy-invariant tests at `apps/web/tests/unit/lib/legal/copy-invariants.test.ts` (`contracts/public-surface.md` §9.3 items 2–3; `research.md` §12.2 "Copy invariants"). **Done when**: it asserts (a) **every** member of `MANAGER_VISIBILITY_PASSAGES` contains one of `NOT_YET_LIVE_MARKERS` **within its own text** — a marker in a distant forward-looking section MUST NOT satisfy it, which is exactly FR-048a; this is a membership check over named constants, not a regex heuristic over prose, so it has no false positives; (b) `MANAGER_VISIBILITY_PASSAGES` is non-empty and every member is genuinely exported from `lib/legal/copy.ts` (so the list cannot be silently emptied to make (a) pass); (c) **zero** numeric quality metrics across every exported string — a digit adjacent to F1 / AUC / ROC / recall / accuracy / precision / `%` (FR-004, SC-005); (d) `"subject-disjoint"` is present and carries no numbers. Dependencies: T022.

- [ ] T033 [P] [P3] Create the web-storage guard at `apps/web/tests/unit/lib/legal/no-web-storage.test.ts`, implementing FR-051. **Done when**: it asserts **zero** occurrences of `localStorage` or `sessionStorage` across every file this feature adds under `apps/web/app/(public)/`, `apps/web/components/public/`, `apps/web/components/legal/`, `apps/web/lib/legal/`, `apps/web/lib/consent/`, and `apps/web/components/brand/`. The scope is **this feature's files only** — pre-existing uses elsewhere (`app/layout.tsx:74` theme bootstrap, `components/anchor/device-memory.ts`, `lib/questionnaire/*`, `components/home/recent-chats-card.tsx`) are out of scope and MUST NOT be touched. Later phases widen the path list as they add directories. Dependencies: T028.

- [ ] T034 [P] [P3] Create public-shell component tests at `apps/web/tests/unit/components/public/public-shell.test.tsx` (SC-008/SC-009 for the shell, FR-018/FR-019/FR-023). **Done when**: it asserts every interactive element in the navbar, mobile nav, and footer is reachable and carries an accessible name; the mobile trigger's accessible name is exactly **"Open menu"**; the navbar exposes **no** dashboard or authed link; the footer links to both `/terms` and `/privacy`; and the footer renders the string **`© 2026 Serenify`** exactly — asserted as an exact string so a re-worded copyright line fails CI. Dependencies: T026, T027.

### The README ride-along (§0.3)

- [ ] T035 [P] [P3] Fix the four `README.md` lines that state manager visibility and the privacy slider in unqualified present tense (`plan.md` §0.3, R13; the fix shape is prescribed by issue **#158** and `docs/BACKLOG.md:2006–2045`). The fix is **not uniform across the four lines**. **Done when all four acceptance conditions hold**:

  1. **`README.md:15`, `:16`, `:18`** each gain **one added sentence** marking the block as the designed end-state and stating that **no manager-facing surface is live today**, in the voice `apps/web/components/account/privacy-placeholder.tsx:23–27` models.
  2. **`README.md:11` is SPLIT into two sentences — not appended to.** The line currently welds a not-yet-live claim to a permanent invariant inside one sentence: *"Managers see graded trends for their reports"* (**not live**) — *"never raw video, never chat content"* (**permanent Principle I invariant, true today and forever**). After the edit, the manager-visibility half carries the not-yet-live marker and the invariant half stands **unqualified, in its own sentence, outside the marked one**.
  3. **A qualifying clause appended to the existing single sentence is a FAIL**, even if the wording is otherwise correct — it drags the invariant under the marker and implies the raw-video and chat-content guarantees are merely planned. That is false, and it is precisely the other-direction flattening Amendment 17 forbids. This is an **acceptance condition to be checked in review**, not a note.
  4. The four edited lines are quoted in the P3 PR body so a reviewer can check condition 3 against the §0.3 wording without opening the diff.

  **Do NOT close #158 or mark its BACKLOG entry resolved in this phase.** `plan.md` §0.3 and §14 place that in **P8**, alongside #75 and #157 (Principle VIII — never one without the other). P3 ships the copy fix only. Dependencies: T010.

### Ship P3

- [ ] T036 [P3] Run the manual public-surface walk from `quickstart.md`. **Done when**: signed out, `/terms` and `/privacy` render inside the public shell and are reachable from the footer; at **320, 375, 414, and 768 px** there is no horizontal scrolling, no tap target under 44 px, and no tap target whose label wraps to two lines (FR-053, SC-008); both routes are correct in **light and dark**; every interactive element is reachable by keyboard alone with a visible focus indicator (FR-055, SC-009); and `/` is confirmed unchanged. Results recorded in the P3 PR body. Dependencies: T029, T030, T034.

- [ ] T037 [P3] Run the phase verification and open the P3 PR from `p3-legal-public-shell` into `013-public-surface-and-legal`. **Done when**: `npm run -w apps/web lint typecheck test` and `uv run pytest` are green locally with results in the PR body; the four edited README lines are quoted in the PR body per T035 condition 4; the T036 walk results are recorded; the PR body states that `/` is untouched and that #158 remains open until P8; commits are per-file with the three co-author trailers; no `Claude-Session:` trailer and no `claude.ai` URL; all three CI checks green. Dependencies: T031, T032, T033, T035, T036.

**Checkpoint**: the legal surface exists in full, which is what **FR-036** requires before the consent gate may ship — the gate never links to a placeholder. P4 is unblocked.

---

## Dependencies & Execution Order

### Phase dependencies

```text
T001 (precondition)
  ├─────────────────────────┐
  ▼                         ▼
Phase 1: P1 Wordmark   Phase 2: P2 Consent foundation      ← run in PARALLEL
  │  (T002–T010)            (T011–T019)
  │                         │
  └───────────┬─────────────┘
              ▼
      Phase 3: P3 Legal + public shell
              (T020–T037)
              │
              ▼
      P4 · P5 · P6 · P7 · P8  — NOT in this file
```

- **P1 ∥ P2.** They share no file, no module, and no test. Either may merge first.
- **P3 needs P1** for `<Wordmark>` (T025/T027) and **P2** for the registry (T023/T024). Under
  Order A both precede it anyway (`quickstart.md` "Build sequence").

### Within-phase order

- **P1**: T002 → {T003, T004, T005, T006, T007} → {T008, T009} → T010.
- **P2**: {T011, T012} → {T013, T014, T016, T017, T018} → T015 → T019.
- **P3**: T020 → T021 → T022 → T023 → T024 → {T025, T026} → T027 → T028 → {T029, T030} → {T031, T032, T033, T034, T035} → T036 → T037.

### Parallel opportunities

**Phase level** — P1 and P2 run simultaneously, by two people or two branches.

**P1**, after T002:

```text
T003  components/header/header.tsx
T004  app/(auth)/layout.tsx
T005  app/(onboarding)/layout.tsx
T006  app/opengraph-image.tsx + tests/unit/social-metadata.test.ts
T007  supabase/templates/*.html + tests/unit/supabase-email-templates.test.ts
```

**P2**, T011 and T012 immediately (TypeScript vs SQL — fully disjoint), then:

```text
T014  tests/unit/lib/consent/registry-guards.test.ts
T016  tests/unit/lib/consent/questionnaire-isolation.test.ts
T017  apps/api/tests/test_consent_privacy.py
T018  live psql probe (manual)
```

**P3**, after T028:

```text
T029  app/(public)/terms/page.tsx
T030  app/(public)/privacy/page.tsx
T031  tests/unit/landing/forbidden-claims.test.ts
T032  tests/unit/lib/legal/copy-invariants.test.ts
T033  tests/unit/lib/legal/no-web-storage.test.ts
T034  tests/unit/components/public/public-shell.test.tsx
T035  README.md
```

---

## Implementation strategy

**Order A is decided** (`plan.md` §14.2) — legal first, hero later. Do not re-litigate it.

1. **T001** — confirm the checks run. One command.
2. **P1 and P2 in parallel.** P1 is mechanical and near-zero risk; P2 is pure code plus SQL with
   no UI, so its exhaustive evaluator suite and its database gate land before any surface
   depends on them. Nothing can be built on the consent model until the model is proven.
3. **P3.** The legally binding half is written and reviewed while schedule pressure is lowest —
   which is the entire point of Order A, because FR-050 exists to stop legal text being written
   in a hurry.
4. **Stop.** Regenerate P4–P8 against the components P3 actually created.

Each phase is one PR, independently buildable, reviewable, and revertible.

---

## Notes recorded at generation time

Reported at generation time; none of them changes a plan decision. Items **2** and **3** were
corrected in the artifacts on **2026-07-25** and now record what changed rather than the
discrepancy that prompted it.

1. **Three existing test assertions break on the wordmark split, by construction.**
   `tests/unit/social-metadata.test.ts:32` (`/>\s*serenify\s*</`) and
   `tests/unit/supabase-email-templates.test.ts:60` (`/>serenify<\/[^>]+>/`) both match a
   *single* text node and cannot match a split wordmark; the `.wordmark` dark-override
   assertions at `:69`/`:72` stop reaching the halves once those carry inline colour. T006 and
   T007 own those edits **in the same commit as the split**, so CI is never knowingly left red.
   `components/header/header.test.tsx:34` (`toHaveTextContent("serenify")`) **survives unchanged**
   — if it needs editing, the split is wrong.
2. **✅ CORRECTED 2026-07-25 — the no-backfill assertion is now scoped to match the migration.**
   `contracts/consent-gates.md` **§7.4** and `research.md` **§12.2** — *not* `plan.md`, which
   only cross-references them (§4.1 map) — previously read "no `INSERT INTO public.user_consents`
   appears anywhere in the migration". That form is unsatisfiable by the plan's own migration,
   because `data-model.md` §6.6 puts exactly that statement inside the `handle_new_user()` body
   **in the same migration file**. Both now state the scoping T012 and T017 use: no such INSERT
   **outside** the trigger function body, and no `INSERT … SELECT` sourcing `auth.users` or
   `public.profiles` — with the rationale that an INSERT inside `handle_new_user()` fires only on
   auth-user creation and is therefore structurally incapable of writing a row for a user who
   already exists, so it **satisfies** FR-041 rather than violating it. **The migration stays one
   file**; splitting the trigger edit into a second migration was the alternative and was not
   taken.
3. **✅ CORRECTED 2026-07-25 — `plan.md` §14 now lists P3's dependency as "P1, P2".** The phase
   table previously read P1 alone. `contracts/public-surface.md` §9.3 has the legal document
   chrome render its version id and publication date **from the registry**, and `research.md`
   §6.1 requires the registry entry to land in the same PR as the wording — so P3 edits
   `lib/consent/registry.ts` (T023). The row now carries that reason. Costs nothing under
   Order A, where P2 precedes P3 regardless; also recorded on this file's P3 phase header and
   on T023/T024.
4. **`lib/consent/registry.ts` ships with no entries in P2** (T011), because `research.md` §6.1
   fixes publishing as "wording + registry entry in the same PR". `terms_privacy`'s first entry
   lands in P3 (T023); `camera_inference`'s in P4. The evaluator's exhaustive suite uses fixture
   registries, so nothing is blocked.
5. **R1 is already discharged.** `plan.md` §15 R1 describes the CI trigger fix as pending; it
   landed in #164 (`cbb7f81`) and reached this branch at `528f70e`. T001 verifies rather than
   builds, and the local-run-and-record fallback is retained only for the merge-ref case.
6. **R2's loose end is already closed.** `plan.md:426`'s mitigation column cites **both**
   ST-10a ("and again in **ST-10a** against a **zero-rows-no-error** read…") and ST-10b. No edit
   was needed; none was made.

---

## Not in this file

**P4–P8**, per `plan.md` §14, to be generated after P3 lands:

| Phase | Scope | Depends on |
|---|---|---|
| **P4** | The two prompting gates — signup acknowledgement; camera/inference gate at all three capture routes (`/onboarding`, `/app/calibrate`, `/app/monitor` — §0.5); the Account → Baseline route back | P2, P3 |
| **P5** | App-shell entry gate; `TermsReconsentScreen`; `CONSENT_ENTRY_GATE_ENABLED`; the fail-open log line. **Alone in its PR** | P2, P3 |
| **P6** | Landing page — root-route takeover, `lib/bands.ts`, `bloom.tsx`'s optional `color` prop, the hero story card with the three approved strings from §10.3, the layout stability spec | P3 |
| **P7** | Team section — photo crop, frozen silhouettes, overlay, name cards, links, caption, supervisors | P6 |
| **P8** | `smoke-tests.md` authored and run; BACKLOG **#75**, **#157**, **#158** resolved and all three issues closed in the same change; `docs/DECISIONS.md` / `CHANGELOG.md` / `PROGRESS.md`; the TTFB follow-up logged; merge to `main` | all |

**#62 stays open and untouched** (R8, `plan.md` §3 Principle VIII). **#86** and **#155** are
referenced, not owned.
