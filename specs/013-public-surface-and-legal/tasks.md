# Tasks: Public Surface & Legal (013)

**Branch**: `013-public-surface-and-legal` | **Date**: 2026-07-25 | **Plan**: [plan.md](./plan.md) | **Spec**: [spec.md](./spec.md)

> ## This file covers **P1 through P8** — the whole feature
>
> **P1, P2 and P3 are built and merged** into `013-public-surface-and-legal` (PRs **#168**,
> **#169**, **#170**). Their tasks — **T001–T037** — are kept verbatim, checkboxes and all,
> as the record of what shipped. Do not re-open them.
>
> **P4–P8 (T038–T149) were deliberately deferred to this second run**, so their tasks could
> name the modules, exports and props P1–P3 actually created rather than guessing at them.
> Every path below was verified on disk on **2026-07-26**; where a task creates something
> new it says so explicitly. Their scope is fixed in `plan.md` §14 and is **not** re-opened
> by this file.

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
> | **P4** | The two prompting gates | **US2** (the asking half) | FR-033–FR-038, FR-040, FR-042, FR-043a–c, FR-043e · SC-006, SC-007, SC-013 |
> | **P5** | App-shell entry gate | **US2** (the re-asking half) | FR-043a, FR-043b, FR-043d · SC-012 |
> | **P6** | Landing page | **US1** | FR-003, FR-005–FR-017, FR-020–FR-022, FR-051–FR-057 · SC-001–SC-005, SC-008–SC-011 |
> | **P7** | Team section | **US4** | FR-024–FR-028 · SC-008, SC-009 |
> | **P8** | Wrap — smoke tests, closures, docs, deploy, merge | all four | FR-056 (Principle VII gate 5) · every SC confirmed by a human pass |
>
> **US1** = *a visitor understands the product and its boundaries* (Priority P1) · **US2** =
> *a person consents before anything happens, and again when the terms change* (Priority P1) ·
> **US3** = *a person can read what actually happens to their data* (Priority P2) · **US4** =
> *a visitor meets the team* (Priority P3).

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
`uv run --directory apps/api pytest` locally and record the results in the PR body (`plan.md` §15 R1). **`uv run pytest` from the repository root does not work** — it exits with `Failed to spawn: pytest … program not found`, because the Python project and its `.venv` live in `apps/api`, not at the root. Corrected 2026-07-26 in this line and in T061 / T076 / T112 / T129 / T147. *(The same wrong invocation also appears in T010, T017, T019 and T037 and in P2's "Independent test" line. Those are left as written: all four tasks are `[X]` complete and their text is the record of what P1–P3 actually ran, not an instruction to anyone. Nothing forward-looking points at them.)*

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

- [X] T002 [P1] Create the shared wordmark component at `apps/web/components/brand/wordmark.tsx`, exactly the shape in `contracts/wordmark.md` §8. **Done when**: it exports `Wordmark({ className }: { className?: string })`; the wrapper carries `font-display tracking-tight` merged with the caller's `className` via `cn()`, with `lowercase` passed **after** `className` so a caller cannot override the casing (`cn()` is tailwind-merge and the last conflicting utility wins — the ordering is what makes FR-030 structural); the two halves are `<span className="text-ink">seren</span>` and `<span className="text-meadow-text">ify</span>`; there is **no** dot or terminal punctuation anywhere in the markup; and all size/spacing comes from the caller (no size class inside the component). Lives in `components/brand/`, **not** `components/ui/` — that namespace is the shadcn primitive namespace regenerated from `components.json` (`research.md` §8). Dependencies: T001.

- [X] T003 [P] [P1] Convert the authed app header to consume the component — `apps/web/components/header/header.tsx:26–28`. **Done when**: the hand-typed `<span className="font-display text-2xl … text-ink">serenify</span>` is replaced by `<Wordmark className="text-2xl leading-none" />`, no literal `serenify` text node remains in the file, and the existing `components/header/header.test.tsx:34` assertion `toHaveTextContent("serenify")` **still passes unchanged** (two spans still yield the same `textContent` — if that test needs editing, the split is wrong). Dependencies: T002.

- [X] T004 [P] [P1] Convert the auth-pages layout — `apps/web/app/(auth)/layout.tsx:41–43`. **Done when**: replaced by `<Wordmark className="text-4xl leading-none sm:text-5xl" />`, preserving the current rendered size at both breakpoints, and no literal `serenify` text node remains in the file. Dependencies: T002.

- [X] T005 [P] [P1] Convert the onboarding layout — `apps/web/app/(onboarding)/layout.tsx:39–41`. **Done when**: replaced by `<Wordmark className="text-4xl leading-none sm:text-5xl" />`, preserving the current rendered size at both breakpoints, and no literal `serenify` text node remains in the file. Dependencies: T002.

- [X] T006 [P] [P1] **Hand-sync exception 1** — split the wordmark in the social card at `apps/web/app/opengraph-image.tsx:52`, and update the existing test that asserts its old shape at `apps/web/tests/unit/social-metadata.test.ts:32`. **Done when**: (a) the single `serenify` text node becomes two elements coloured with the **dark-theme** token values — `seren` `#E2E5E8`, `ify` `#63B292` — because the card is dark-themed (`background: "#101214"`); (b) the containing element keeps `display: "flex"`, which Satori requires on any element with more than one child; (c) `tests/unit/social-metadata.test.ts:32`'s regex `/>\s*serenify\s*</` is replaced — **it cannot match a split wordmark and will fail otherwise** — by assertions covering both halves and both hex values; (d) `npm run -w apps/web test social-metadata` is green. Dependencies: T001.

- [X] T007 [P] [P1] **Hand-sync exception 2** — split the wordmark in both Supabase email templates, `supabase/templates/confirmation.html:38` and `supabase/templates/recovery.html:38`, and update the existing test that asserts their old shape at `apps/web/tests/unit/supabase-email-templates.test.ts:60,69,72`. **Done when**: (a) each `<p class="wordmark">serenify</p>` becomes two inline-styled child spans carrying the **light** values `#1C2023` (`seren`) and `#346A56` (`ify`); (b) **both** the `prefers-color-scheme: dark` block and the `[data-ogsc]` block override **both halves** with the dark values `#E2E5E8` / `#63B292` — a rule that only recolours `.wordmark` no longer reaches the halves once they carry their own inline colour; (c) the existing inline font declaration `font:400 24px/1 Outfit,Inter,Arial,sans-serif;letter-spacing:0;` is preserved on the wordmark element; (d) `tests/unit/supabase-email-templates.test.ts:60`'s regex `/>serenify<\/[^>]+>/` is replaced — **it cannot match a split wordmark and will fail otherwise** — and the dark-override assertions at `:69`/`:72` are extended to prove both halves flip; (e) `npm run -w apps/web test supabase-email-templates` is green, including the preview generation. Dependencies: T001.

### Tests for P1

- [X] T008 [P1] Create the sync contract test at `apps/web/tests/unit/brand/wordmark-sync.test.ts`, implementing all four assertions of `contracts/wordmark.md` verbatim. **Done when**: (1) it parses `apps/web/app/globals.css` for the **live** values of `--color-ink` and `--color-meadow-text` in both themes — the values are read, never hard-coded, so a token change fails CI rather than drifting; (2) it reads `app/opengraph-image.tsx` from disk and asserts the split uses the **dark** values; (3) it reads both email templates and asserts the light split **and** that both the `prefers-color-scheme: dark` and `[data-ogsc]` blocks override both halves with the dark values; (4) it asserts `components/brand/wordmark.tsx` names the token classes, and that **no file outside `components/brand/` contains a hand-typed rendered wordmark**. Assertion (4) MUST match a *rendered* wordmark (a JSX/HTML text node), **not** the bare substring `serenify` — the repo legitimately contains ~20 non-wordmark occurrences (storage keys such as `serenify-theme` and `serenify-anchor-camera`, broadcast channel names, mock filenames like `serenify-008-monitoring-mock.html`, and `serenify.tech`), and a substring match would fail against all of them. Dependencies: T002, T006, T007.

- [X] T009 [P] [P1] Component test for the shared wordmark at `apps/web/tests/unit/components/brand/wordmark.test.tsx`. **Done when**: it asserts the two halves render with `text-ink` and `text-meadow-text` respectively; the accessible text content is exactly `serenify`; the wrapper is `lowercase`; a caller-supplied `className` reaches the wrapper; and the rendered output contains no `.`, `!`, or other terminal punctuation (FR-030). Dependencies: T002.

### Ship P1

- [X] T010 [P1] Run the phase verification and open the P1 PR from `p1-wordmark` into `013-public-surface-and-legal`. **Done when**: `npm run -w apps/web lint typecheck test` and `uv run pytest` are green locally (on Windows run Vitest with `--pool=threads`; `quickstart.md` Gotchas) with the results recorded in the PR body; the PR body **calls out R10 explicitly** — three existing surfaces (app header, auth pages, onboarding) change appearance from single-colour to two-colour, and that is an intentional, constitution-mandated visible change to be confirmed by **ST-1**; commits are per-file with the three co-author trailers; there is no `Claude-Session:` trailer and no `claude.ai` URL; and all three CI checks are green on the PR. Dependencies: T003, T004, T005, T008, T009.

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

- [X] T011 [P2] Create the version registry module at `apps/web/lib/consent/registry.ts`, exactly the shape single-sourced in `data-model.md` §6.1. **Done when**: it exports `ConsentTextKey`, `Materiality`, `ConsentRevision`, and `CONSENT_REGISTRY` with the declared types; it imports **nothing** from `server-only`, so Vitest can load it (`contracts/consent-evaluate.md`, "Purity"); `tsc --noEmit` is green; and `CONSENT_REGISTRY` declares **both** keys with **empty entry lists**. **Ships no entries.** `research.md` §6.1 fixes the publishing rule — "editing the wording **and** appending a registry entry, in the **same PR**" — so `terms_privacy`'s first revision lands in **P3** with the documents (T023) and `camera_inference`'s lands in **P4** with the camera wording. The exhaustive evaluator suite runs against fixture registries (`research.md` §12.2), not this one, so an empty registry blocks nothing. Dependencies: T001.

- [X] T012 [P] [P2] Create the migration at `supabase/migrations/20260726000000_user_consents.sql`, using the SQL single-sourced in `data-model.md` §6.5 and §6.6 — **do not re-derive it**. **Done when**: `supabase db reset` applies it cleanly against local Supabase; the table, the `user_consents_lookup_idx` index, the `public.user_consents_immutable()` function and its `BEFORE UPDATE` trigger, `ENABLE` + `FORCE ROW LEVEL SECURITY`, the two owner-self policies, and `REVOKE ALL … FROM anon, authenticated` followed by `GRANT SELECT, INSERT … TO authenticated` are all present; and the additive `handle_new_user()` edit is a `CREATE OR REPLACE FUNCTION` that **preserves verbatim** the existing `profiles` INSERT, `SECURITY DEFINER`, and `SET search_path = public, pg_temp` from `supabase/migrations/20260517000030_profile_trigger.sql:9–24`, without dropping or recreating the `on_auth_user_created` trigger.

  **No backfill, ever** (FR-041, §7.4): the migration writes **no** consent row for any existing user. Note precisely what that means here, because the naive form of the assertion is unsatisfiable — `data-model.md` §6.6 puts an `INSERT INTO public.user_consents` **inside the `handle_new_user()` function body** by design, and that same statement is what records the signup acknowledgement. The prohibition is therefore on **backfill DML**: no `INSERT INTO public.user_consents` **outside** the `handle_new_user()` body, and specifically no `INSERT … SELECT` sourcing `auth.users` or `public.profiles`. T017 asserts exactly that scoping. Dependencies: T001.

- [X] T013 [P2] Create the pure evaluator at `apps/web/lib/consent/evaluate.ts`, with the three signatures single-sourced in `contracts/consent-evaluate.md` §6.2 — `currentRevision`, `bindingRevision`, `satisfiesConsent`. **Done when**: the exported signatures match the contract **character-for-character** (they MUST NOT gain a registry parameter — test isolation is achieved by module-mocking `registry.ts`, not by widening the public surface); the module reads registry indices only and references neither `decided_at` nor any wall clock; a key whose entry list is empty **throws a clear error** rather than returning `undefined`, since the contract's return type is non-optional; and `tsc --noEmit` is green. Dependencies: T011.

### Tests for P2

- [X] T014 [P] [P2] Registry guard tests at `apps/web/tests/unit/lib/consent/registry-guards.test.ts`, implementing the four CI-enforced guards of `research.md` §6.1. **Done when**: it asserts (a) every entry has an explicit `materiality` and a non-empty `rationale`; (b) `versionId` values are unique, well-formed, and prefixed with their own key; (c) entries are ordered by `publishedOn` ascending; (d) **append-only** — a frozen fixture snapshot of every previously published entry is compared field-by-field, so editing or removing a published entry fails CI. The frozen-snapshot mechanism MUST exist and be wired now even though it is trivially satisfied against today's empty registry — T023 appends the first entry, and the snapshot is what locks it. Dependencies: T011.

- [X] T015 [P2] Exhaustive evaluator suite at `apps/web/tests/unit/lib/consent/evaluate.test.ts`, table-driven per `research.md` §12.2. **Done when**: fixture registries cover every shape — first-ever revision; material after material; cosmetic after material; several cosmetics after one material; material after cosmetic — **crossed** with every held-version case — none, the binding one, one before, one after, an unknown id — and every cell asserts the boolean. Plus: a cosmetic revision published after the binding one re-prompts **nobody**; a material revision re-prompts **everybody** holding only earlier versions; a well-formed but non-registry version id **never** satisfies the gate (R7/R8); an empty entry list throws. No database, no users, no timing — which is why this can be exhaustive where an e2e suite cannot (`research.md` §12.3). Dependencies: T013.

- [X] T016 [P] [P2] Structural isolation test at `apps/web/tests/unit/lib/consent/questionnaire-isolation.test.ts` — the static half of SC-013 (`research.md` §12.2). **Done when**: it asserts by import-graph inspection that **no** module under `apps/web/lib/questionnaire/` or `apps/web/components/questionnaire/` imports anything from `apps/web/lib/consent/`, so consent state and the weekly work-environment check-in are structurally unable to interact. *(Name the concept in prose; the existing `weekly_checkin_cadence` table and any `checkin`-containing filename are quoted as-is and never used as this feature's own naming.)* Dependencies: T011.

- [X] T017 [P2] Static migration-parse privacy gate at `apps/api/tests/test_consent_privacy.py`, mirroring the style and structure of `apps/api/tests/test_questionnaire_privacy.py` (module docstring naming the migration under test and the invariants; one test per invariant; test ids mapped to task ids). No live DB — the privacy boundary **is** the schema/RLS/grant shape. **Done when** it asserts, over `supabase/migrations/20260726000000_user_consents.sql`:
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

- [X] T018 [P2] Live RLS probe against local Supabase, run by hand once, per `quickstart.md` "Live RLS probe" — the repo's documented per-transaction impersonation (`SET LOCAL ROLE` + `set_config('request.jwt.claims', …, true)`). **Done when**: as an `authenticated` user, `UPDATE` on own `user_consents` row raises `42501` (the immutability trigger); `DELETE` on own row affects 0 rows / is permission-denied (no policy, no grant); `SELECT` of another user's row returns 0 rows — and all three results are pasted into the P2 PR body. This is the live counterpart to T017's static parse; neither replaces the other. Dependencies: T012.

### Ship P2

- [X] T019 [P2] Run the phase verification and open the P2 PR from `p2-consent-foundation` into `013-public-surface-and-legal`. **Done when**: `npm run -w apps/web lint typecheck test` and `uv run pytest` are green locally with results in the PR body; the PR body states plainly that this phase **ships no UI** and **writes no consent row for any existing user**; the T018 probe output is included; commits are per-file with the three co-author trailers; no `Claude-Session:` trailer and no `claude.ai` URL; all three CI checks green. Dependencies: T014, T015, T016, T017, T018.

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

- [X] T020 [P3] Read the Next 16 guides for **route groups** and the **root `page.tsx`** under `node_modules/next/dist/docs/` before writing any route file in this phase (`apps/web/AGENTS.md`; `plan.md` §2 Next 16 caveat; R9). **Done when**: the exact guide path(s) consulted are named in the P3 PR body, and one specific question is answered from the docs rather than inferred — *does adding `app/(public)/layout.tsx` with `terms/` and `privacy/` children change anything about `/`, which `app/page.tsx` still owns?* Do not infer route-group semantics from Next 14/15 habits. Dependencies: T010 (P1 merged).

### Copy — the entire review surface for both documents

- [X] T021 [P3] Write the Terms of Service strings into `apps/web/lib/legal/copy.ts` as **named exported constants** — no string literals in components (`contracts/public-surface.md` §9.3, item 1). **Done when**: the module exists and exports every ToS string as a named constant; it covers the applicable regimes — **Egypt Law 151/2020**, **EU/GDPR** (personal data in Supabase **Frankfurt**), and the **Azure** processing footprint on Container Apps (FR-045); it identifies the controller as **Mohamed Asem, as an individual** (there is no legal entity) at `mohamedasem318@gmail.com`, with **no placeholder remaining** (FR-046); it carries the **unmissable** statement that this is an **informed draft prepared without qualified legal review**, and that such review is required before any real (non-demo) user data is processed (FR-047); the text is real and grounded in this system's flows, not a template (FR-044); and it contains **zero** numeric quality metrics (FR-004). Dependencies: T010.

- [X] T022 [P3] Write the Privacy Policy strings into `apps/web/lib/legal/copy.ts` (same file, separate commit), plus the two named lists the FR-048a mechanism depends on. **Done when**: the module additionally exports every Privacy Policy string as a named constant, and:
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

- [X] T023 [P3] Append the first `terms_privacy` revision to `apps/web/lib/consent/registry.ts` **in this same PR as the wording it describes** (`research.md` §6.1). **Done when**: one entry exists for `terms_privacy` with `materiality: "material"` (the first ask is always material — `contracts/consent-evaluate.md`), a non-empty `rationale` naming it as the initial publication, `publishedOn` set to the date this PR lands, and `versionId` of the form `terms_privacy@<publishedOn>.1`; the T014 frozen append-only snapshot fixture is updated to include it (this is the first entry the snapshot locks, and it can never be edited afterwards); `currentRevision("terms_privacy")` and `bindingRevision("terms_privacy")` both return it; and T014's guards are green. **`camera_inference` stays empty** — its first entry belongs to P4 with the camera wording. Dependencies: T022, T011, T014 (P2 merged).

### Components and routes

- [X] T024 [P3] Create the shared legal-document chrome at `apps/web/components/legal/legal-document.tsx`. **Done when**: it renders a title, the document's **version id and publication date read from the registry** (not hard-coded), section anchors, and the no-legal-review notice as a **bordered notice at the top of the document, not a footnote** (FR-047); it is plain TSX using Graphite tokens with **no** MDX dependency and **no** typography plugin (`contracts/public-surface.md` §9.3); every heading is a real heading element so the section anchors are keyboard- and screen-reader-navigable; and it lays out correctly at 320 px. Dependencies: T023.

- [X] T025 [P] [P3] Create the public mobile nav at `apps/web/components/public/public-mobile-nav.tsx`, mirroring the app's existing pattern in `apps/web/components/header/mobile-menu.tsx` (FR-019). **Done when**: it uses the Radix `Sheet` with a `SheetTrigger` labelled **"Open menu"**, `side="left"`, `bg-bg`, and `SheetClose`-wrapped links; every tap target is ≥44 px and single-line at 320 px (FR-053); it contains **no** dashboard or authed link; and it uses no `localStorage`/`sessionStorage`. Dependencies: T010.

- [X] T026 [P] [P3] Create the public footer at `apps/web/components/public/public-footer.tsx` (FR-023). **Done when**: it links to `/privacy` and `/terms`; it renders `<Wordmark />`; and it renders the approved copyright line **`© 2026 Serenify`** **verbatim, character-for-character** per `plan.md` §10.3 — no institutional attribution, no "Capital University", no em-dash suffix (this resolves §0.6; the academic context belongs in the team section and the documents' StressID licensing note, not in a copyright line that reads as an entity claim). Dependencies: T010.

- [X] T027 [P3] Create the public navbar at `apps/web/components/public/public-navbar.tsx` (FR-018). **Done when**: it visually matches the app header — same 64 px height, same `border-b border-border`, same **non-translucent `bg-bg`**, same wordmark size, same theme-toggle placement — while being a **separate component** with its own nav items and **no dashboard or authed link anywhere**; it renders `<Wordmark />` and composes `<PublicMobileNav />` below the `md` breakpoint; every interactive element has a visible focus indicator (FR-055). Dependencies: T025, T010.

- [X] T028 [P3] Create the public route-group shell at `apps/web/app/(public)/layout.tsx`. **Done when**: it renders `<PublicNavbar />`, `{children}`, and `<PublicFooter />`; `/terms` and `/privacy` render inside it for a **signed-out** visitor with no authentication call; and **`app/page.tsx` is neither moved, edited, nor deleted** — `/` renders exactly as it does today, verified by loading `/` before and after (the root-route takeover is P6). Dependencies: T020, T026, T027.

- [X] T029 [P] [P3] Create `apps/web/app/(public)/terms/page.tsx`. **Done when**: it renders `<LegalDocument>` with the ToS constants from `lib/legal/copy.ts` and **no inline string literals**; it exports a page `title`; and it renders for a signed-out visitor at `/terms`. Dependencies: T021, T024, T028.

- [X] T030 [P] [P3] Create `apps/web/app/(public)/privacy/page.tsx`. **Done when**: it renders `<LegalDocument>` with the Privacy Policy constants from `lib/legal/copy.ts` and **no inline string literals**; it exports a page `title`; and it renders for a signed-out visitor at `/privacy`. Dependencies: T022, T024, T028.

### Tests for P3

- [X] T031 [P] [P3] Create the forbidden-claim assertion at `apps/web/tests/unit/landing/forbidden-claims.test.ts` (the path `plan.md` §10.1 fixes; **P6 extends this same file** to also cover `lib/landing/copy.ts`). **Done when**: it runs over **every exported string** in `apps/web/lib/legal/copy.ts` and asserts **zero** matches for FR-002's two forbidden claim families — (a) on-device / in-browser video processing ("video never leaves your device", "frames are processed in your browser and discarded") and (b) any **blanket** "nothing reaches a manager" claim; and it includes the mock's three literals as explicit **negative fixtures**, so the test proves it can actually catch them:
  - `:442` — *"…checks in with the person — never a manager. What happens next is always their call."*
  - `:547–551` — *"Show a manager your readings."* / *"A team lead sees anonymised group trends and nothing else. Not your individual readings, not your conversations, not a name attached to a bad afternoon."*
  - `:772` — *"Nothing here ever reaches a manager."*

  The fixtures are taken from **`plan.md` §10.2**, which quotes all three verbatim — **no mock read happens in P3** (`plan.md` §10.1: the mock is read in P6 and P7 only). The detector MUST **not** flag the scoped chat-and-crisis claim FR-001 permits, which is the only form that claim may take; assert that explicitly with the P3 copy as a positive fixture. Dependencies: T022.

- [X] T032 [P] [P3] Create the legal copy-invariant tests at `apps/web/tests/unit/lib/legal/copy-invariants.test.ts` (`contracts/public-surface.md` §9.3 items 2–3; `research.md` §12.2 "Copy invariants"). **Done when**: it asserts (a) **every** member of `MANAGER_VISIBILITY_PASSAGES` contains one of `NOT_YET_LIVE_MARKERS` **within its own text** — a marker in a distant forward-looking section MUST NOT satisfy it, which is exactly FR-048a; this is a membership check over named constants, not a regex heuristic over prose, so it has no false positives; (b) `MANAGER_VISIBILITY_PASSAGES` is non-empty and every member is genuinely exported from `lib/legal/copy.ts` (so the list cannot be silently emptied to make (a) pass); (c) **zero** numeric quality metrics across every exported string — a digit adjacent to F1 / AUC / ROC / recall / accuracy / precision / `%` (FR-004, SC-005); (d) `"subject-disjoint"` is present and carries no numbers. Dependencies: T022.

- [X] T033 [P] [P3] Create the web-storage guard at `apps/web/tests/unit/lib/legal/no-web-storage.test.ts`, implementing FR-051. **Done when**: it asserts **zero** occurrences of `localStorage` or `sessionStorage` across every file this feature adds under `apps/web/app/(public)/`, `apps/web/components/public/`, `apps/web/components/legal/`, `apps/web/lib/legal/`, `apps/web/lib/consent/`, and `apps/web/components/brand/`. The scope is **this feature's files only** — pre-existing uses elsewhere (`app/layout.tsx:74` theme bootstrap, `components/anchor/device-memory.ts`, `lib/questionnaire/*`, `components/home/recent-chats-card.tsx`) are out of scope and MUST NOT be touched. Later phases widen the path list as they add directories. Dependencies: T028.

- [X] T034 [P] [P3] Create public-shell component tests at `apps/web/tests/unit/components/public/public-shell.test.tsx` (SC-008/SC-009 for the shell, FR-018/FR-019/FR-023). **Done when**: it asserts every interactive element in the navbar, mobile nav, and footer is reachable and carries an accessible name; the mobile trigger's accessible name is exactly **"Open menu"**; the navbar exposes **no** dashboard or authed link; the footer links to both `/terms` and `/privacy`; and the footer renders the string **`© 2026 Serenify`** exactly — asserted as an exact string so a re-worded copyright line fails CI. Dependencies: T026, T027.

### The README ride-along (§0.3)

- [X] T035 [P] [P3] Fix the four `README.md` lines that state manager visibility and the privacy slider in unqualified present tense (`plan.md` §0.3, R13; the fix shape is prescribed by issue **#158** and `docs/BACKLOG.md:2006–2045`). The fix is **not uniform across the four lines**. **Done when all four acceptance conditions hold**:

  1. **`README.md:15`, `:16`, `:18`** each gain **one added sentence** marking the block as the designed end-state and stating that **no manager-facing surface is live today**, in the voice `apps/web/components/account/privacy-placeholder.tsx:23–27` models.
  2. **`README.md:11` is SPLIT into two sentences — not appended to.** The line currently welds a not-yet-live claim to a permanent invariant inside one sentence: *"Managers see graded trends for their reports"* (**not live**) — *"never raw video, never chat content"* (**permanent Principle I invariant, true today and forever**). After the edit, the manager-visibility half carries the not-yet-live marker and the invariant half stands **unqualified, in its own sentence, outside the marked one**.
  3. **A qualifying clause appended to the existing single sentence is a FAIL**, even if the wording is otherwise correct — it drags the invariant under the marker and implies the raw-video and chat-content guarantees are merely planned. That is false, and it is precisely the other-direction flattening Amendment 17 forbids. This is an **acceptance condition to be checked in review**, not a note.
  4. The four edited lines are quoted in the P3 PR body so a reviewer can check condition 3 against the §0.3 wording without opening the diff.

  **Do NOT close #158 or mark its BACKLOG entry resolved in this phase.** `plan.md` §0.3 and §14 place that in **P8**, alongside #75 and #157 (Principle VIII — never one without the other). P3 ships the copy fix only. Dependencies: T010.

### Ship P3

- [X] T036 [P3] Run the manual public-surface walk from `quickstart.md`. **Done when**: signed out, `/terms` and `/privacy` render inside the public shell and are reachable from the footer; at **320, 375, 414, and 768 px** there is no horizontal scrolling, no tap target under 44 px, and no tap target whose label wraps to two lines (FR-053, SC-008); both routes are correct in **light and dark**; every interactive element is reachable by keyboard alone with a visible focus indicator (FR-055, SC-009); and `/` is confirmed unchanged. Results recorded in the P3 PR body. Dependencies: T029, T030, T034.

- [X] T037 [P3] Run the phase verification and open the P3 PR from `p3-legal-public-shell` into `013-public-surface-and-legal`. **Done when**: `npm run -w apps/web lint typecheck test` and `uv run pytest` are green locally with results in the PR body; the four edited README lines are quoted in the PR body per T035 condition 4; the T036 walk results are recorded; the PR body states that `/` is untouched and that #158 remains open until P8; commits are per-file with the three co-author trailers; no `Claude-Session:` trailer and no `claude.ai` URL; all three CI checks green. Dependencies: T031, T032, T033, T035, T036.

**Checkpoint**: the legal surface exists in full, which is what **FR-036** requires before the consent gate may ship — the gate never links to a placeholder. P4 is unblocked.

---

## Process — additions binding on P4 through P8

Everything in **Process** and **Constraints that bite at task level** above still applies
unchanged. These are the additions that come into force from P4 onward.

**Branching.** One branch per phase, cut from `013-public-surface-and-legal`:

| Phase | Branch | PR target |
|---|---|---|
| P4 | `p4-consent-gates` | `013-public-surface-and-legal` |
| P5 | `p5-app-shell-gate` | `013-public-surface-and-legal` |
| P6 | `p6-landing-page` | `013-public-surface-and-legal` |
| P7 | `p7-team-section` | `013-public-surface-and-legal` |
| P8 | `p8-wrap` | `013-public-surface-and-legal`, **then merge to `main`** |

The `[0-9][0-9][0-9]-*` prohibition is unchanged: a branch named `013-p4-…` fires the `push`
run **and** the `pull_request` run and doubles every check (#164). **Never target `main` before
P8.** The feature branch merges to `main` exactly once, in T149.

**New from P4: a code-review agent runs at the end of every phase.** It reviews against **that
phase's own task acceptance criteria and constitution v1.13.0** — not generic code style. Its
findings go in the PR body. It is its own task, and it runs **before** the "open the PR" task,
so what it finds is fixed rather than filed.

**New from P4: literal diffs before commits.** Every ship task requires the implementer to show
the **actual diff** of every file it committed — `git diff --staged` output, not a prose summary
of what it believes it did.

**New from P4: a design skill is a hard first step on every phase that renders anything** — P4,
P5, P6 and P7. Carried by **T038, T063, T078 and T114**. The rule below is **decided**; those
four tasks are executable and none of them stops.

### ✅ DECIDED — Hallmark is the only design skill invoked on this feature

**Invoke `hallmark`, with theme selection SKIPPED.** Serenify already has a theme. Hallmark's
genre detection, macrostructure, responsive gates and pre-emit slop test all apply; its theme
step does not, because the theme is registered in constitution **Principle V** and is not this
feature's to choose. What every design task tells Hallmark:

| Hallmark's discipline | How it binds here |
|---|---|
| **Token block / theme** | The token block is **`apps/web/app/globals.css`**; the theme is **Graphite**. Skip theme selection. |
| **#3 locked tokens — no mid-render improvisation** | **Harder-edged here than Hallmark normally enforces.** Every colour and every `font-family` must reference a token that **already exists** in `globals.css`. Hallmark's usual escape hatch — *lift the value into the token block as a new named variable* — is **NOT available**: registering a new token requires a **constitution amendment**, and this feature must not amend the constitution (`plan.md` §0.7). If a design needs a colour that does not exist, the design changes, not the token block. |
| **#5 mobile floor** | **320 / 375 / 414 / 768 px** — exactly **FR-053** and **SC-008**. Lean on Hallmark's gate rather than re-deriving the widths. |
| **#4 re-drawn chrome forbidden** | This is **FR-052**: no fake browser bars, no phone frames, no fake IDE chrome, anywhere on the landing page. |
| **#2 honest copy — no fabricated content** | This is **FR-001 / FR-002 / FR-004**: no invented metric, no invented testimonial, **zero model performance figures**. And in this feature **copy is not Hallmark's to write at all** — every string comes from `lib/landing/copy.ts`, `lib/legal/copy.ts` or `lib/consent/copy.ts`, and the four approved strings in `plan.md` **§10.3** are verbatim and **unrewordable**. |

**`frontend-design` is NOT invoked on this feature.** Its documented process is to brainstorm a
new palette and type pairing for the brief; Serenify's tokens are registered in constitution
Principle V, so generating a second token system is the exact move Principle V forbids. It stays
installed and is **not** to be uninstalled or otherwise touched. This also settles the machine's
global `CLAUDE.md` rule against stacking `frontend-design` on Hallmark: **there is no stacking —
there is one skill.**

**The `design:*` plugin requirement is DROPPED.** Verified 2026-07-26 against
`C:\Users\moham\.claude\plugins\cache\`: no installed marketplace publishes a `design:*`
namespace, and **this feature does not block on it.** The only two that would have applied are
**`design:design-critique`** and **`design:accessibility-review`**; both are **optional and
non-blocking**. If they are installed before P6, they may be run at **T111** and **T128**
alongside the code-review agent. Nothing waits on them.

---

## Phase 4: P4 — The two prompting gates (branch `p4-consent-gates`)

**Depends on**: **P2** (the registry and the evaluator) and **P3** (the real `/terms` and
`/privacy` the acknowledgement links to — **FR-036**: the checkbox never exists in a build
where the documents do not).

**Goal**: the two gates that *ask*. A server-side signup acknowledgement that covers the JS and
the no-JS path through one function, and a camera-and-inference gate at **all three** capture
routes that is presented before `getUserMedia` is ever reached. Declining writes nothing.

**Independent test**: with the box unchecked, signup is refused with a reason and **no account
exists**; with it checked, exactly one `terms_privacy` row is written. On a browser that has
never granted camera permission, `/onboarding`, `/app/calibrate` and `/app/monitor` each show
the consent surface and the browser's permission prompt does **not** fire. Declining leaves the
weekly work-environment check-in fully usable.

**Reads**: `contracts/consent-gates.md` §7.1 (signup), §7.2 (camera — **fails CLOSED**), §7.4,
§7.5 · `research.md` §6.1 (the publishing rule), §6.4 (the route back), §6.6 (the signup seam),
§12.2 · `plan.md` §0.5 (why `/onboarding` is in the list), §13 (ST-9, ST-11, ST-12) ·
`contracts/consent-evaluate.md`.

> **⚠ Recorded at generation time — the route back is pinned, but not where the request
> expected.** `contracts/consent-gates.md` **§7.2 does not name a surface** for reaching a
> declined camera gate again. `research.md` **§6.4** does, exactly and by file: *"the existing
> **Account → Baseline** section (`components/anchor/baseline-section.tsx`) gains one line when
> consent is absent, naming the camera-and-inference consent and offering the control that
> opens it."* Verified on disk: `apps/web/components/anchor/baseline-section.tsx` exists and is
> rendered by `apps/web/app/(authed)/app/account/page.tsx:63` with a `hasAnchor` prop resolved
> from `has_anchor` at `:42`. **Nothing was invented**; T052 cites §6.4 as its source.

### Precondition

- [X] T038 [P4] Invoke **`hallmark`, with theme selection skipped**, before writing any UI in this phase — the acknowledgement field and the camera consent gate both render. **Theme selection is skipped because Serenify already has a theme** (constitution Principle V; see "Process — additions"). **Done when**: Hallmark has run against the two new surfaces (`apps/web/components/consent/terms-acknowledgement-field.tsx`, `apps/web/components/consent/camera-consent-gate.tsx`) having been told that the token block is **`apps/web/app/globals.css`** and the theme is **Graphite**; its **#3 locked-tokens** discipline was applied with **no new token invented** — every colour and `font-family` references a variable already in `globals.css`, and the "lift it into the token block" escape hatch was **not** used, because a new token needs a constitution amendment this feature must not make (`plan.md` §0.7); its **#5 mobile floor** was taken as **320 / 375 / 414 / 768 px** (FR-053, SC-008); its **#2 honest-copy** discipline was satisfied structurally, since **Hallmark writes no copy here** — every string comes from `lib/consent/copy.ts` (T039); and **`frontend-design` was NOT invoked** (see "Process — additions" for why). **Name in the P4 PR body which skill ran and confirm theme selection was skipped.** Dependencies: T037 (P3 merged).

### The camera-and-inference wording, and its registry entry

- [X] T039 [P4] Create the camera-and-inference consent wording at `apps/web/lib/consent/copy.ts` as **named exported constants** — the module `research.md` §6.3 names as the home of this text ("The wording itself lives in `lib/legal/copy.ts` and `lib/consent/copy.ts` in git"). **Done when**: it exports every string the camera gate renders as a named constant with **no string literal in the gate component**; the text says plainly what FR-001 verifies as true and what `lib/legal/copy.ts` already says — video **is transmitted** for inference, **is deleted on every outcome including errors**, is **never persisted**, and **no human, including an admin, can view or replay it**; it names what declining costs (**calibration**, baseline capture, and **monitoring sessions** become unavailable) and what it does not cost (the **weekly work-environment check-in** stays available — FR-043c); it makes no claim about manager visibility at all; it contains **zero** numeric quality metrics (FR-004); and the voice matches Principle V (calm, no exclamation marks, never alarmist). **Terminology is binding** — never bare "check-in". Dependencies: T038.

- [X] T040 [P4] Append the first `camera_inference` revision to `apps/web/lib/consent/registry.ts` **in this same PR as the wording it describes** (`research.md` §6.1 — the publishing rule; the same rule T023 followed for `terms_privacy`). **Done when**: `CONSENT_REGISTRY.camera_inference` — today `[]` at `registry.ts:57` with the comment "First entry: P4, with the camera-and-inference consent wording" — holds exactly one entry with `materiality: "material"` (the first ask is always material), a non-empty `rationale` naming it as the initial publication and pointing at `lib/consent/copy.ts`, `publishedOn` set to the date this PR lands, and a `versionId` of the form `camera_inference@<publishedOn>.1` (the shape both DB CHECKs at `supabase/migrations/20260726000000_user_consents.sql:28–29` independently constrain); **T014's frozen append-only snapshot fixture is extended to include it**, which is what locks it against ever being edited; and `npm run -w apps/web test registry-guards` is green with all four guards passing. `currentRevision("camera_inference")` and `bindingRevision("camera_inference")` must both return it, and `evaluate.ts:32–41`'s empty-list throw must no longer be reachable for this key. Dependencies: T039, **T011** (P2 — `lib/consent/registry.ts`, the module this appends to; merged, so nothing is blocked).

### The signup acknowledgement — server-side (§7.1)

- [X] T041 [P4] Extend `signUpSchema` in `apps/web/lib/auth/schemas.ts:41–49` with the two acknowledgement fields, exactly the shape single-sourced in `contracts/consent-gates.md` §7.1. **Done when**: `signUpSchema` gains `accept_terms` (a literal `"on"` with the field-scoped message §7.1 fixes) and `terms_privacy_version` (a non-empty string — **the version the page rendered**, compared server-side and never trusted as the value to store); `email`, `password` and `full_name` are otherwise untouched; `SignUpInput` still infers correctly; `tsc --noEmit` is green. **FR-033 — an active choice**: the field must be impossible to satisfy by a default value, so a `z.boolean()` with a default or an `.optional()` is a FAIL. Dependencies: T037.

- [X] T042 [P4] Gate `signUp()` in `apps/web/app/(auth)/signup/actions.ts:19–33` at the `signUpSchema.safeParse` step, **before** `supabase.auth.signUp` is reached (`actions.ts:38`). **Done when**: the `safeParse` call — which today passes only `email`, `password`, `full_name` at `:21–23` — additionally passes `formData.get("accept_terms")` and `formData.get("terms_privacy_version")`; an unchecked box returns `{ status: "validation", field: "accept_terms", message: … }` through the existing branch at `:26–33` so **no account is created and the visitor is told why** (Acceptance Scenario 1); a submitted `terms_privacy_version` that does not equal `currentRevision("terms_privacy").versionId` returns a new `{ status: "stale_terms" }` member of `SignUpResult` (`actions.ts:8–12`) rather than recording a mismatch — **it refuses rather than mis-records**; and the `options.data` object at `:42` carries `terms_privacy_version` resolved from **the registry on the server**, never the form's value, alongside the existing `full_name`. The metadata key must be exactly `terms_privacy_version` — `supabase/migrations/20260726000000_user_consents.sql:108–110` reads `NEW.raw_user_meta_data->>'terms_privacy_version'` and a different key writes no consent row at all. Dependencies: T040, T041, **T013** (P2 — `lib/consent/evaluate.ts`, for `currentRevision`; merged).

- [X] T043 [P4] Confirm and assert that the **JavaScript-disabled path is gated by the same code**, in `apps/web/app/(auth)/signup/actions.ts:76–82`. **Done when**: `signUpFromForm` still delegates to `signUp(formData)` at `:78` with **no second validation path added**, so one gate covers both entry points — which is precisely why a client-side checkbox is not a gate and this is (§7.1); the no-JS failure path is verified by hand with JS disabled in the browser (unchecked → no account, and the page re-renders); and the P4 PR body records that walk. **Do not add a parallel schema call, a client-only guard, or an early return inside `signUpFromForm`** — a second path is a second thing to get wrong. Dependencies: T042.

- [X] T044 [P4] Create the acknowledgement field at `apps/web/components/consent/terms-acknowledgement-field.tsx` (**new file, new directory**). **Done when**: it renders an unchecked-by-default `<input type="checkbox" name="accept_terms">` — **never pre-checked, never inferred** (FR-033) — with a real `<label>` association and a ≥44 px tap target that does not wrap at 320 px (FR-053); it renders links to the **real** `/terms` and `/privacy` P3 shipped, each `target="_blank" rel="noopener noreferrer"` with an accessible name that says so — *"Read the Privacy Policy (opens in a new tab)"* (§7.1, FR-034); it renders a hidden `<input type="hidden" name="terms_privacy_version">` carrying the value the page rendered; it takes the version id as a prop rather than importing the registry itself; it has a visible focus indicator (FR-055); and it uses **no** `localStorage`/`sessionStorage` (FR-051). Dependencies: T038, T040.

- [X] T045 [P4] Wire the field into `apps/web/app/(auth)/signup/signup-form.tsx`. **Done when**: `<TermsAcknowledgementField>` renders inside the existing `<form>` (`signup-form.tsx:133–218`), above the submit button at `:201`; the `zodResolver(signUpSchema)` at `:42` resolves against the extended schema and the client-side error surfaces through the same `errors` object the other fields use; `onSubmit` at `:52–64` — which today hand-builds a `FormData` with three `form.set` calls at `:55–57` — also sets `accept_terms` and `terms_privacy_version`, **or the react-hook-form path silently submits without them and every JS user is rejected**; the current version id reaches the form as a prop from the `/signup` server component (resolved there via `currentRevision("terms_privacy")`), not imported into the client bundle by hand; a `{ status: "stale_terms" }` result re-renders the form with the **current** documents and an **unchecked** box; and **opening either document loses no entered data** — the form is never unmounted, so no state is preserved anywhere (which matters, because `sessionStorage` is forbidden by FR-051 and a URL round-trip would put a password in a query string). Dependencies: T044, T042.

### The camera / inference gate — fails CLOSED (§7.2)

- [X] T046 [P4] Create the owner-scoped consent read at `apps/web/lib/consent/read.ts` (**new file**) — the server-side helper both gates call, which does not exist yet. **Done when**: it exports an async function returning the caller's held `document_version` values for one `ConsentTextKey`, selecting from `public.user_consents` under the caller's own session so RLS scopes it (`user_consents_select_self`); it takes the Supabase client as a parameter rather than creating one, so it is testable without a database; the caller composes it as `satisfiesConsent(key, heldVersionIds)` per §7.2; and — **the load-bearing part** — the **failure contract is explicit and CLOSED for the camera key**: `null`, an error, or an unreadable result is surfaced to the caller as an unsatisfied gate, never as satisfied. It must NOT hard-code a fail direction internally: **P5's shell gate fails OPEN on exactly the same read** (§7.3), so the direction belongs to each call site and this module returns a result the caller decides on. Encode that in the return type (a discriminated result, not a bare `string[]`), so a call site cannot conflate "no rows" with "read failed" by accident. **"No rows" is a real, expected answer** — every pre-existing user has zero consent records (§7.4), and so does anyone created during P8's deploy window (see T135 step **(g)**); it means *not consented*, not *broken*. Dependencies: T040, **T013** (P2 — `lib/consent/evaluate.ts`, for `satisfiesConsent`; merged).

- [X] T047 [P4] Create the consent-write server action at `apps/web/components/consent/actions.ts` (**new file**, `"use server"`) — colocated with the gate that calls it, because the gate renders at `/onboarding` (outside `(authed)`) as well as inside it, so `app/(authed)/actions.ts` cannot host it. **Done when**: granting inserts exactly one row into `public.user_consents` with `consent_key`, `document_version` **resolved from the registry on the server** (`currentRevision(key).versionId` — never a value taken from the request, §6.3 "Trust boundary"), and `user_id` **resolved server-side via `supabase.auth.getUser()` and passed explicitly** — `getUser()` and not `getSession()`, which returns the cookie's contents without revalidating them. **Corrected 2026-07-26:** this task previously said `user_id` was "left to the RLS `WITH CHECK` and the column default". **There is no column default** — `user_id` is `NOT NULL` with no `DEFAULT` (`supabase/migrations/20260726000000_user_consents.sql:25`), and `data-model.md` §6.5 agrees, so an INSERT omitting it fails outright on NOT NULL. The value must be passed, exactly as the shipped `handle_new_user()` already passes `NEW.id` at `:109–110`. RLS `WITH CHECK ((select auth.uid()) = user_id)` remains the **enforcement** — it rejects any row whose subject is not the caller — but it is not the source of the value. The action MUST NOT accept a `user_id` parameter at all, optional or otherwise: a caller that can name the subject reduces defence-in-depth to RLS alone. It must also fail **closed** when `getUser()` returns no user or errors — write nothing, return a failure the caller can render. The insert uses `ON CONFLICT DO NOTHING` so a duplicate under `user_consents_one_per_revision` (`…_user_consents.sql:37`) is a **no-op, not an error** — which is what makes fail-closed safe (§7.2); **declining calls this action not at all** and there is **no decline branch, no decline parameter, and no withdrawal path** — `decision` admits only `'granted'` and there is no revocation state to write (FR-042, FR-043e, §7.5); and the writer is injectable (or the module structured) so T055 can assert **zero** write calls on the decline path. Dependencies: T046.

- [X] T048 [P4] Create the camera consent gate at `apps/web/components/consent/camera-consent-gate.tsx` (**new file**). **Done when**: it renders the T039 wording with an explicit accept control and an explicit decline control, both keyboard-operable with a visible focus indicator and ≥44 px at 320 px; accepting calls the T047 action and then reveals the capturing child; **declining returns the user to `/app` and writes nothing at all** (§6.4); it renders **no** camera preview, requests **no** device permission, and imports nothing that calls `getUserMedia` — the capturing child must not be in the mounted tree at all, not merely hidden (FR-038, ST-11); it uses **no** `localStorage`/`sessionStorage`; and it carries **no** claim about manager visibility. Dependencies: T038, T039, T047.

- [X] T049 [P4] Gate `/onboarding` at `apps/web/app/(onboarding)/onboarding/page.tsx`, after the auth guard at `:15–17` and before `<OnboardingForm>` is returned at `:25`. **Done when**: an employee with no satisfying `camera_inference` record reaches the `"anchor"` step and finds `<CameraConsentGate>` rendered **in place of `<AnchorRecorder>`**, so no capture code is ever mounted (FR-038); the existing `defaultFullName` pre-fill at `:20–23` is preserved; and the page stays `force-dynamic` (`:8`).

  **Corrected 2026-07-26 — this task's text over-scoped the gate, and the over-scoping was a total product lockout.** It previously required rendering `<CameraConsentGate>` **instead of `<OnboardingForm>`**, i.e. gating the whole route. That also removes the **name step**, which is the only thing in the product that ever writes `profiles.full_name`. Declining then navigates to `/app`, where `proxy.ts:203` bounces a null-`full_name` user straight back to `/onboarding` — and round again, with no way to set a name, reach `/app`, or reach the **weekly work-environment check-in**. **FR-043c is the resolution and not a workaround**: declining blocks calibration, anchor/baseline capture and camera-based monitoring sessions, "**and nothing else**". A text field is not camera capture, so gating it exceeded the requirement. The server component therefore resolves the decision and passes it **down** as a `cameraBlocked` prop; `apps/web/app/(onboarding)/onboarding/onboarding-form.tsx` renders the gate at its `"anchor"` step in place of the recorder (`:60`), and the name step runs regardless. **Modifying `onboarding-form.tsx` is authorised for this fix only.** `plan.md` §0.5's "all three capture routes are gated" **still holds and needs no amendment** — the *capture* at each route is gated, which is what §0.5 exists to guarantee. FR-038 remains structural and is asserted, not asserted-about, in `tests/unit/components/consent/onboarding-anchor-step-gate.test.tsx`. **This route is in the gate list for a reason** — `plan.md` §0.5: for a brand-new employee this, not `/app/calibrate`, is the moment of their first-ever calibration, and it is registered in `CAPTURE_ROUTES` (`next.config.ts:103`) and `isCaptureRoute` (`proxy.ts:71–74`) precisely because it calls `getUserMedia`. Gating only `/app/calibrate` would let every new employee's first capture run unconsented. Dependencies: T048, T046.

- [X] T050 [P4] Gate `/app/calibrate` at `apps/web/app/(authed)/app/calibrate/page.tsx`, **after** the role guard at `:39–44` and **after** `resolveCalibrateMode` at `:62–68`, before `<CalibrateRecorder>` at `:74`. **Done when**: a user with no satisfying `camera_inference` record renders `<CameraConsentGate>` in place of `<CalibrateRecorder>`; **`has_anchor` keeps driving mode reconciliation and the ST-17 redirect exactly as it does today at `:59–68`, unchanged** — no new "has this user ever calibrated" concept is invented and the gate asks one orthogonal question (§7.2); the `?mode=recalibrate` path is unaffected; and the surrounding centring wrapper at `:73` still lays out at 320 px. Dependencies: T048, T046.

- [X] T051 [P4] Gate `/app/monitor` at `apps/web/app/(authed)/app/monitor/page.tsx`, after the role guard at `:36–40`, before `<MonitoringSession />` at `:42`. **Done when**: a user with no satisfying `camera_inference` record renders `<CameraConsentGate>` instead of `<MonitoringSession>`, so no capture code and no `getUserMedia` call is mounted first (FR-038); the employees-only guard at `:38–40` still runs **first**, so a team lead or admin is still redirected to `/app` and never meets a consent surface for a capture they can never run. Dependencies: T048, T046.

- [X] T052 [P4] Add the deliberate, discoverable **route back to a declined camera gate** — `apps/web/components/anchor/baseline-section.tsx`, plus the state it needs from `apps/web/app/(authed)/app/account/page.tsx`. **Source: `research.md` §6.4**, which pins the surface by file; `contracts/consent-gates.md` §7.2 does not name one, and none was invented here. **Done when**: the account page resolves the user's `camera_inference` consent alongside the existing `has_anchor` RPC at `page.tsx:42` and passes it to `<BaselineSection>` at `:63`; when consent is **absent**, the section gains **one line** naming the camera-and-inference consent and offering the control that opens it — the shape §6.4 prescribes, in the calm voice the file's own header comment describes; when consent is present the section renders **exactly as it does today**, byte-for-byte in the rendered output; the control is a **full-document `<a href>`, never a `<Link>` or a router transition** — the same invariant `RECALIBRATE_HREF` already holds at `:40`/`:91`/`:117`, because a soft-nav into a capture route keeps the previous route's `camera=()` Permissions-Policy and the camera dies; and the existing `baseline-section.test.tsx` still passes or is extended in the same commit. Dependencies: T048.

### Tests for P4

- [X] T053 [P] [P4] Signup gate unit tests at `apps/web/tests/unit/lib/auth/signup-consent-gate.test.ts`. **Done when**: it asserts over `signUpSchema` that a missing `accept_terms` fails, that `accept_terms: "off"`/`false`/absent all fail, that only the literal `"on"` passes, and that the failure carries the field-scoped message §7.1 fixes; that a missing or empty `terms_privacy_version` fails; and — the part that proves FR-033 structurally — that **no default value can satisfy the field**, so parsing an object with `accept_terms` simply omitted is a failure rather than a pass. Plus assertions over the action's rejection contract: an unchecked submission returns `{ status: "validation", field: "accept_terms" }` and reaches **no** `supabase.auth.signUp` call, and a stale version returns `{ status: "stale_terms" }` and likewise creates nothing. Dependencies: T042, T041.

- [X] T054 [P] [P4] Fail-CLOSED unit tests at `apps/web/tests/unit/lib/consent/fail-closed.test.ts`. **Done when**: for the **camera** key, a read that errors, a read that returns `null`, and a read that returns an unreadable result each produce **gate shown** (`blocked`), and only an explicit satisfying row produces gate hidden; the test states in a comment **why this direction** — capturing and inferring video with no recorded consent because a `SELECT` blipped is the exact harm the gate exists to prevent (§7.2) — and asserts the opposite default is **not** used for this key. Pairs with P5's T071, which asserts the inverse for the shell gate; **the asymmetry is deliberate and both directions are pinned so neither can drift.** Dependencies: T046.

- [X] T055 [P] [P4] Decline-writes-nothing tests at `apps/web/tests/unit/components/consent/decline-writes-nothing.test.tsx` — the server half of `research.md` §12.2. **Done when**: with an **injected fake writer**, the decline path is exercised and the writer records **zero** calls; the abandon path (unmount / navigate away without answering) never invokes the action at all, so zero is trivially provable; and it asserts there is **no** code path in `components/consent/actions.ts` that writes a withdrawal, a revocation, or a `decision` other than `'granted'` — none exists to write (FR-042, FR-043e, §7.5). The DB half is already asserted by T017. Dependencies: T047, T048.

- [X] T056 [P] [P4] Camera gate component tests at `apps/web/tests/unit/components/consent/camera-consent-gate.test.tsx`. **Done when**: rendering the gate mounts **no** element or module that calls `getUserMedia` — asserted by the capturing child's absence from the tree, not by a hidden attribute (FR-038, ST-11); both controls are reachable by keyboard alone and carry accessible names; accepting invokes the write action exactly once with a version id resolved from the registry and **never one supplied by the render**; declining navigates to `/app`; and the surface is presentable again on a later arrival, because the absence of a satisfying record **is** the state and every evaluating path is therefore a path back to the prompt (§6.4). Dependencies: T048.

- [X] T057 [P] [P4] Weekly work-environment check-in isolation test at `apps/web/tests/unit/components/consent/questionnaire-unaffected.test.tsx` — the component half of SC-013 (`research.md` §12.2; T016 is the static half). **Done when**: `/app`'s questionnaire path is rendered for a user with **no** `camera_inference` record and the weekly work-environment card renders and submits normally (FR-043c, ST-12); and the test names the concept in prose while quoting any existing `checkin`-containing filename as-is. **Declining blocks that scope and only that scope** — calibration, baseline capture and monitoring sessions become unavailable; nothing else changes. Dependencies: T048.

- [X] T058 [P] [P4] Extend `apps/web/tests/unit/landing/forbidden-claims.test.ts` to walk `apps/web/lib/consent/copy.ts`. **Done when**: `COPY_MODULES` at `:100–102` — today `[{ name: "lib/legal/copy.ts", module: legalCopy }]`, with the comment at `:99` reserving the slot for P6 — gains the consent copy module; every exported string in it produces **zero** matches for both forbidden families; the four negative fixtures at `:131–152` still fail the detector (they must stay CAUGHT, or the suite is passing vacuously); and the `ALL_STRINGS.length > 50` sanity guard at `:110` still holds. Dependencies: T039.

- [X] T059 [P] [P4] Widen the web-storage guard at `apps/web/tests/unit/lib/legal/no-web-storage.test.ts` to cover **every directory this feature creates, in ONE edit** — including the ones that do not exist yet. **This is the only phase that edits this file.** P5 and P6 verify it (T073, T109) and do not touch it, so three phases cannot collide on one small test file. **Done when**: the asserted path list covers, in a single change, `apps/web/components/consent/`, `apps/web/components/brand/`, `apps/web/components/landing/`, `apps/web/lib/consent/`, `apps/web/lib/landing/`, `apps/web/lib/legal/`, and `apps/web/app/(public)/`; **the list is SPLIT into paths that exist now and paths reserved for later phases**. **Corrected 2026-07-26:** this task previously said "a path entry matching nothing is inert … the guard simply finds no files under them and passes". **That is not how the guard behaves, and it should not be.** The existing coverage assertion at `no-web-storage.test.ts` deliberately FAILS on a declared-but-empty directory, precisely so a renamed or mistyped path cannot silently turn the whole guard into a no-op that passes — and `walk()` throws outright on a directory that does not exist. Both properties are wanted, so both are stated: existing paths are scanned and must contain source, while reserved paths are asserted **absent** and the test fails by name the moment one appears. That makes promotion **CI-enforced rather than remembered** — the same mechanism as the wordmark sync test and the registry's append-only snapshot. Consequently **T073 and T109 each promote their own phase's paths** into the scanned list, which is a one-line mechanical edit the failing test names for them; there are **zero** occurrences of `localStorage` or `sessionStorage` across everything the list does match (FR-051); and the **existing exclusions are untouched** — the pre-existing occurrences outside this feature (`app/layout.tsx:74` theme bootstrap, `components/anchor/device-memory.ts`, `lib/questionnaire/*`, `components/home/recent-chats-card.tsx`) stay out of scope and **MUST NOT** be "fixed" here. Dependencies: T048, T046, T039.

### Ship P4

- [X] T060 [P4] Run a **code-review agent** over the P4 diff, reviewing against **this phase's own task acceptance criteria** (T038–T059) and **constitution v1.13.0** — not generic code style. **Done when**: the agent has specifically checked that the camera gate fails **CLOSED** and the signup gate is **server-side** on both the JS and no-JS path; that the version id written at signup is the server's resolved value and never the form's; that declining writes nothing anywhere; that the `camera_inference` registry entry landed in the same PR as its wording; that terminology is correct throughout (**calibration** / **monitoring session** / **weekly work-environment check-in**, never bare "check-in"); and that no `Claude-Session:` trailer or `claude.ai` URL appears anywhere. Its findings are pasted into the P4 PR body and **fixed before T062**, not filed. Dependencies: T053, T054, T055, T056, T057, T058, T059, T043, T045, T049, T050, T051, T052.

- [X] T061 [P4] Run the local phase verification. **Done when**: `npm run -w apps/web lint typecheck test` and `uv run --directory apps/api pytest` are green, with the output recorded in the P4 PR body **The verification runs AFTER the final commit of the phase, and the report states the commit SHA it ran against — a verification result without a SHA is not a verification result** (added 2026-07-26, after a P4 report cited a `typecheck` run that predated the file which broke it; the review agent caught the failure, the reporting discipline did not). (on Windows run Vitest with `--pool=threads` — `quickstart.md` Gotchas); `supabase db reset` still applies cleanly; and the manual walk from `quickstart.md` is done and recorded — unchecked box → refused with a reason and **no account**; documents open in a new tab losing no entered data; all three capture routes show the consent surface **before** the browser permission prompt; declining leaves the weekly work-environment check-in working. Dependencies: T060.

- [X] T062 [P4] Open the P4 PR from `p4-consent-gates` into `013-public-surface-and-legal`. **Done when**: the **actual diff of every committed file** is shown before committing — `git diff --staged`, not a prose summary; commits are **per-file, never `git add -A`**, each carrying all three co-author trailers; there is no `Claude-Session:` trailer and no `claude.ai` URL anywhere in the commits, the PR body, or any comment; the PR body names which design skills ran (T038) and records both design conflicts as **open questions for Mohamed**; it records the T060 findings, the T061 verification output, and the no-JS walk from T043; it states plainly that **declining writes nothing, deletes nothing, and is not withdrawal** (feature 018 owns withdrawal); and all three CI checks are green. Dependencies: T061.

**Checkpoint**: both prompting gates are live and both fail in the direction that costs least when they fail. **P5 and P6 are unblocked and may run in parallel.** The one file all three phases relate to is `apps/web/tests/unit/lib/legal/no-web-storage.test.ts`: **P4 covers it once (T059), listing every directory this feature creates including the ones that do not exist yet**, and P5 and P6 only **verify** it (T073, T109) without touching it. No other file is shared between them.

---

## Phase 5: P5 — App-shell entry gate (branch `p5-app-shell-gate`) — **ALONE IN ITS PR**

**Depends on**: **P2** (registry + evaluator), **P3** (the documents a blocked user must still
be able to read in full), **and P4** — for two modules P4 creates and this phase consumes:
`apps/web/components/consent/actions.ts`, the consent-write server action **T047** creates and
**T065** calls, and `apps/web/lib/consent/read.ts`, the owner-scoped consent read **T046**
creates and **T066** calls. `plan.md` **§14.1** sequences it the same way and says why:
**"P5 alone and after P4."**

> ### Why this phase ships alone, and why that is not ceremony
>
> **This is the highest-blast-radius change in the feature (R2).** `app/(authed)/layout.tsx` is
> the single shell every authenticated route renders through. A bug here does not degrade a
> feature — it locks out **every user of the product**. Isolating it in its own PR is the entire
> mechanism that makes `git revert <sha>` a clean, conflict-free one-command rollback that
> unwinds **nothing else**: not the schema, not the signup gate, not the camera gate.
>
> **Nothing else ships in this PR.** Not a copy tweak, not a lint fix, not a drive-by rename.
> If something else needs doing, it goes in another PR.

**Goal**: a material Terms/Privacy revision re-prompts every user whose consent predates it, by
**rendering a different tree** — never by redirecting. It **fails OPEN**, and it says so out
loud when it does.

**Independent test**: publish a material revision locally → sign in → blocked; both documents
readable in full and **Sign out** works; accept → unblocked with the earlier row still present.
Then flip `CONSENT_ENTRY_GATE_ENABLED=false`, and separately `git revert` the gate commit, and
confirm the app is fully usable after each.

**Reads**: `contracts/consent-gates.md` **§7.3** (the whole section — this phase is that
section) · `plan.md` §15 **R2** · `plan.md` §13 **ST-10, ST-10a, ST-10b** ·
`contracts/consent-evaluate.md`.

### Precondition

- [X] T063 [P5] Invoke **`hallmark`, with theme selection skipped**, before writing the re-consent screen — it renders, and it is the only surface a locked-out user will ever see. **Theme selection is skipped because Serenify already has a theme** (constitution Principle V). **Done when**: Hallmark has run against `apps/web/components/consent/terms-reconsent-screen.tsx` having been told the token block is **`apps/web/app/globals.css`** and the theme is **Graphite**; its **#3 locked-tokens** discipline was applied with **no new token invented** — the "lift it into the token block" escape hatch is unavailable, because a new token needs a constitution amendment this feature must not make (`plan.md` §0.7); its **#5 mobile floor** was taken as **320 / 375 / 414 / 768 px** (FR-053, SC-008), which matters unusually much here because this screen is the **entire** experience for a blocked user at the narrowest width; **Hallmark writes no copy** — the strings are this task's own calm-voice prose reviewed against Principle V, and the document links and sign-out control are fixed by FR-043d, not by the design pass; and **`frontend-design` was NOT invoked**. **Name in the P5 PR body which skill ran and confirm theme selection was skipped.** Dependencies: T037 (P3 merged).

### The kill switch

- [X] T064 [P5] Add `CONSENT_ENTRY_GATE_ENABLED` as a server-only boolean, **defaulting to `true`** — `apps/web/lib/env/schema.ts`, `apps/web/lib/env/server.ts`, and `apps/web/.env.local.example`. **Done when**: `serverEnvSchema` at `schema.ts:29–31` (which today only extends `clientEnvSchema` with `siteUrl`) gains the flag with a default of enabled, so an **absent** variable means the gate is **on** — a kill switch that fails to the disabled state is not a safety lever, it is a silent outage; `loadServerEnv()` in `server.ts` passes `process.env.CONSENT_ENTRY_GATE_ENABLED` into the parse; the flag is **absent from `clientEnvSchema`**, so it never reaches the browser bundle; `.env.local.example` documents it under the existing "Test-only / infrastructure (defaults shown)" block **with no value committed** (Principle IX); and `tsc --noEmit` is green. Dependencies: T063.

### The screen and the gate

- [X] T065 [P5] Create the re-consent screen at `apps/web/components/consent/terms-reconsent-screen.tsx` (**new file**). **Done when**: it states plainly that the Terms and Privacy Policy have been revised and that continuing requires acknowledging the current wording, in the Principle V voice (calm, no exclamation marks, never alarmist); it renders an accept control that calls the T047 write action with `currentRevision("terms_privacy").versionId` **resolved on the server**; **a blocked user can still read both documents in full** — links to `/terms` and `/privacy` opening in a **new tab** (`target="_blank" rel="noopener noreferrer"` with accessible names saying so), so the accept control is still there when they return (FR-043d); **a blocked user can still sign out** — it renders the existing `<SignOutButton>` from `@/components/sign-out-button`, whose `signOut` server action lives at `app/(authed)/actions.ts:6` and is invoked by POST, so it is not gated by a layout render; it lays out at **320 px** in both themes with every control keyboard-reachable and ≥44 px; and it uses **no** `localStorage`/`sessionStorage`. **There is no decline control** — declining is the absence of accepting, it writes nothing, and the next navigation presents the screen again (§6.4, §7.5). Dependencies: T063, T047.

- [X] T066 [P5] Add the gate to `apps/web/app/(authed)/layout.tsx` — **it renders a different tree; it never redirects.** **Done when**: after the existing `getUser()` at `:14–20` and the `profiles` read at `:22–26`, the layout performs **one** owner-scoped `user_consents` read via `lib/consent/read.ts` and, when `gateEnabled && blocked`, returns `<div className="flex min-h-dvh flex-col bg-bg"><TermsReconsentScreen … /></div>` **instead of** the normal `Header` + `main` + `ChatPill` shell at `:32–38` — the exact shape §7.3 fixes; there is **no** `redirect()` call added anywhere in the gate path, and **`proxy.ts` is not touched at all**; the existing `redirect("/login")` for an unauthenticated user at `:19` is unchanged; and `/terms` and `/privacy` are untouched by construction, because they live in the `(public)` group and this layout cannot run for them at all (FR-043d). **A redirect-based gate can loop, and a loop here is a total product lockout** — rendering in place cannot loop, and that is the point (§7.3 failure mode 1, `plan.md` §16). Dependencies: T065, T064, T046.

- [X] T067 [P5] Make the fail-OPEN branch **observable** — its own task, its own assertion, because it is the only thing that makes a silently-disabled gate visible. **Done when**: `null`, an error, or an unreadable consent result in `app/(authed)/layout.tsx` yields **not blocked** (the normal shell renders); and **before** returning that shell the branch emits, server-side, exactly `console.error("[consent-gate] FAIL-OPEN: terms_privacy gate disabled for this request", { userId: user.id, error })` — the string, the user id, and the underlying error, per §7.3. **This log line is not optional.** A *transient* read failure is what fail-open is for; a *persistent* one — an RLS policy wrong after a migration, a dropped grant, a renamed column — silently disables the Terms gate for **every user** with nothing on any surface to say so, and the app looks perfectly healthy while a legal gate is off. `console.error` matches the repo's existing server convention (`[signUp] supabase error:` at `app/(auth)/signup/actions.ts:55`) and surfaces in Vercel function logs. The line is deliberately loud and greppable: one occurrence is noise, a steady stream is an outage. **ST-10b induces the failure and confirms the log fires.** Dependencies: T066.

### Tests for P5

- [X] T068 [P] [P5] Env kill-switch tests at `apps/web/tests/unit/lib/env/consent-entry-gate.test.ts`. **Done when**: an **absent** `CONSENT_ENTRY_GATE_ENABLED` parses to **enabled** (the gate defaults on — the assertion that matters most); `"false"` parses to disabled; a malformed value is rejected at boot rather than silently coerced; and the flag is asserted **absent** from `clientEnvSchema`, so it cannot leak into the browser bundle. Dependencies: T064.

- [X] T069 [P] [P5] Re-consent screen tests at `apps/web/tests/unit/components/consent/terms-reconsent-screen.test.tsx` — **FR-043d, asserted rather than trusted**. **Done when**: it asserts a link to `/terms` and a link to `/privacy` are both present, both `target="_blank"` with `rel` containing `noopener`, and both carry accessible names identifying the document **and** the new tab; that a sign-out control is present with an accessible name; that every interactive element is keyboard-reachable with a visible focus indicator; that **no decline control exists**; and that accepting invokes the write action exactly once. **Corrected 2026-07-27 (P5):** this clause previously read "invoked exactly once **with a registry-resolved version id**", which asserts a parameter that does not exist. `grantConsent(key)` takes exactly ONE argument — the consent key — and resolves `document_version` from the registry INSIDE the action (`components/consent/actions.ts:24-48`, :73), deliberately and structurally, so that no caller can name the revision a record is written against; a caller-supplied version would open a second instance of the forgeable-version problem `plan.md` §15 R8 documents on the signup path. `contracts/consent-evaluate.md` agrees: "the **server** resolves the id from the registry at write time". The assertion that survives is therefore the **call shape** — invoked once, with the single argument `"terms_privacy"` — **plus the negative**: the component passes **no** version argument, asserted on `mock.calls[0]` having length 1. The action was NOT reshaped to fit the original wording. Dependencies: T065.

- [X] T070 [P] [P5] Shell-gate render tests at `apps/web/tests/unit/app/authed-layout-consent-gate.test.tsx`. **Done when**: against a **stubbed registry**, a user holding the binding `terms_privacy` version renders the normal shell (`Header` present); a user holding only an earlier version, or none, renders `<TermsReconsentScreen>` and **no** `Header` and **no** `ChatPill`; blocked/not-blocked matches `satisfiesConsent()` exactly in every case (`research.md` §12.2); and — structurally — **no `redirect()` is called on any gate path**, asserted by mocking `next/navigation`'s `redirect` and expecting zero calls for both the blocked and unblocked cases. That last assertion is the one that would catch a future "small refactor" reintroducing the lockout loop. Dependencies: T066.

- [X] T071 [P] [P5] Fail-OPEN tests at `apps/web/tests/unit/app/authed-layout-fail-open.test.tsx`. **Done when**: a consent read that **errors**, one that returns **null**, and one that is otherwise unreadable each render the **normal shell** (not blocked); **and each one emits the `[consent-gate] FAIL-OPEN` line**, asserted on the spied `console.error` including the `userId` and the underlying `error` in the payload; and the happy path emits **no** such line, so the signal means something. Also assert the deliberate asymmetry in a comment and a cross-reference: **this gate fails OPEN while the camera gate (T054) fails CLOSED**, because failing open on Terms costs a user briefly reaching the app before acknowledging, while failing open on camera consent costs a video captured and inferred with no recorded consent. Those are not comparable, so they get opposite defaults, and both are pinned so neither can drift (§7.3). Dependencies: T067.

- [X] T072 [P] [P5] Kill-switch behaviour test at `apps/web/tests/unit/app/authed-layout-kill-switch.test.tsx`. **Done when**: with `CONSENT_ENTRY_GATE_ENABLED` disabled, a user who **would** be blocked renders the **normal shell**, with the consent read **skipped** — **Corrected 2026-07-27 (P5):** this previously accepted "either skipped or ignored". It is skipped, and the flag is short-circuited **before** the `user_consents` read, because a disabled gate that still ran a read that failed would emit the `[consent-gate] FAIL-OPEN` line for a gate nobody is running — destroying the exact signal T067 exists to create, where a steady stream means a real outage. The test asserts `readHeldConsentVersions` has **zero calls** when the flag is off, and separately that a read which *would* have thrown produces **no** FAIL-OPEN line; with it enabled (including by default/absence), the same user is blocked. **An untested kill switch is not a kill switch** — this is the unit-level counterpart to ST-10's manual exercise of the same lever. Dependencies: T066, T064.

- [X] T073 [P] [P5] **Verify** — do not widen — the web-storage guard at `apps/web/tests/unit/lib/legal/no-web-storage.test.ts`. **T059 (P4) already added every directory this feature creates**, so this phase's new file (`components/consent/terms-reconsent-screen.tsx`) is already inside the covered set. **Corrected 2026-07-27 (P5):** this sentence also claimed the modified file `app/(authed)/layout.tsx` was covered. **It is not.** `FEATURE_DIRS` is `app/(public)`, `components/public`, `components/legal`, `components/brand`, `components/consent`, `lib/legal`, `lib/consent` — `app/(authed)` is absent, and deliberately so: the guard is scoped to the directories this feature CREATES, and `app/(authed)/` is a pre-existing app group in which this feature modifies one file. Adding it would pull dozens of unrelated files under a feature-scoped guard, contradicting the guard's own stated design, and would put P5 into the file-level collision with P6 that T059 exists to prevent. FR-051 is satisfied in fact — verified by direct inspection: **zero** occurrences of either API in the layout, or anywhere under `app/(authed)/`. Recorded in the P5 PR body per this task's own escape clause rather than fixed silently. **Done when**: T059's path list is confirmed to cover them; the guard is green with **zero** occurrences of `localStorage` or `sessionStorage` in this phase's added and modified files (FR-051); and — the point of making this a verification — **the test file is NOT touched by this phase**, so P5's PR cannot conflict with P6's over it. **If a directory is genuinely missing from T059's list, add it and say so explicitly in the P5 PR body** rather than silently. Pre-existing occurrences elsewhere stay untouched. Dependencies: T066, T065, T059.

### Ship P5

- [X] T074 [P5] Verify and record **both revert levers**, so P8's ST-10 / ST-10a / ST-10b can be run against them. **Done when**: the gate is confirmed confined to **one file** (`app/(authed)/layout.tsx`) plus pure modules with no other caller, and `git revert <sha>` of the gate commit is confirmed clean and conflict-free on a scratch branch — **actually run, not reasoned about**; the flag lever is confirmed by starting the app with `CONSENT_ENTRY_GATE_ENABLED=false` and reaching a previously blocked authed route; and **both levers, with the exact commit SHA to revert and the exact env var name and value, are written into the P5 PR body** in a section a person under time pressure can act on without reading the diff. Record the honest caveat §7.3 states: a Vercel environment change requires a redeploy to take effect, so the flag lever is **fast, not instant**. Dependencies: T070, T071, T072.

- [X] T075 [P5] Run a **code-review agent** over the P5 diff, against **this phase's own task acceptance criteria** (T063–T074) and **constitution v1.13.0**. **Done when**: the agent has specifically checked that the gate **renders a different tree and never redirects**; that it **fails OPEN** and **logs `[consent-gate] FAIL-OPEN`** with the user id and the error on every fail-open path; that the kill switch **defaults to enabled**; that `proxy.ts` is untouched; that **nothing else ships in this PR** — the diff contains the gate, the screen, the env flag, and their tests, and nothing more; and that no `Claude-Session:` trailer or `claude.ai` URL appears anywhere. Findings go in the PR body and are **fixed before T077**. Dependencies: T074.

- [X] T076 [P5] Run the local phase verification. **Done when**: `npm run -w apps/web lint typecheck test` and `uv run --directory apps/api pytest` are green with the output recorded in the P5 PR body **The verification runs AFTER the final commit of the phase, and the report states the commit SHA it ran against — a verification result without a SHA is not a verification result** (added 2026-07-26, after a P4 report cited a `typecheck` run that predated the file which broke it; the review agent caught the failure, the reporting discipline did not). (Windows: Vitest with `--pool=threads`); and a manual local rehearsal of **ST-10** is done and recorded — append a second, **material** `terms_privacy` revision to a local-only working copy of the registry, sign in, confirm blocked, read both documents in full, sign out successfully, accept, confirm unblocked **with the earlier row still present** (the history is append-only — nothing is rolled forward or re-stamped, §7.4). Revert the local-only registry edit before committing. Dependencies: T075.

- [X] T077 [P5] Open the P5 PR from `p5-app-shell-gate` into `013-public-surface-and-legal`. **Done when**: the **actual diff of every committed file** is shown before committing; commits are per-file with all three co-author trailers; no `Claude-Session:` trailer and no `claude.ai` URL anywhere; the PR body names which design skills ran (T063) and records both design conflicts as open questions; it carries the **two revert levers** verbatim from T074 and the T076 ST-10 rehearsal; it states in its opening line that this PR contains the **highest-blast-radius change in the feature** and **ships alone by design (R2)**; and all three CI checks are green. Dependencies: T076.

**Checkpoint**: a material revision re-prompts everyone whose consent predates it, the gate cannot loop, it fails open, and it says so when it does. Both levers are exercised and written down. **US2 is complete.**

---

## Phase 6: P6 — Landing page (branch `p6-landing-page`)

**Depends on**: **P3** (the `(public)` group, the navbar, the footer, `PUBLIC_DESTINATIONS`).
Runs in parallel with the P4 → P5 track and shares **no source file** with it. The one file it
relates to on that track is `apps/web/tests/unit/lib/legal/no-web-storage.test.ts`: **P4 covers
it once (T059)** — its list already names `components/landing/`, `lib/landing/` and
`app/(public)/`, inert until this phase creates them — and **T109 only verifies, it does not
edit**, so neither PR can conflict with the other over it.

That leaves exactly **one ordering constraint on P4**, and it is a *verification* constraint, not
a build one: **T109 needs T059 merged** to have a path list to check. Everything else in this
phase — all 35 other tasks — builds, tests and reviews with no reference to P4 whatsoever, so the
two tracks genuinely run concurrently and only T109 waits.

**Goal**: `/` becomes the landing page without losing either behaviour it has today, and the
hero story card tells the product's thesis in 17 beats without its outer box moving one pixel.

**Independent test**: signed out, `/` renders the landing page inside the public shell; signed
in, `/` still reaches `/app`; `/?code=…` still forwards to `/auth/callback?code=…`. The layout
stability spec passes at **320 / 375 / 414 / 768 px** with zero outer-dimension drift across the
full cycle and a narration line count of exactly **1** at 320 px for **every** beat.

**Reads**: `contracts/landing-hero-story.md` §9.1 (the primary source) · `plan.md` §10.1 (the
grep discipline), §10.2 (the three forbidden lines), **§10.3 (the approved copy — verbatim)** ·
`research.md` §11 (routing), §12.2 (the proofs) · `plan.md` §15 R5, R6, R9, R11, R12 ·
`plan.md` §13 ST-3, ST-4, ST-5, ST-6, ST-8.

> **This phase is deliberately decomposed into 36 tasks rather than a handful of large ones.**
> It is the largest and least predictable item in the feature and the one Order A discovers
> last (`plan.md` §14.2). Coarse tasks here hide overrun until it is too late to cut scope.

> ### The mock is gitignored — the grep discipline, on every task that reads it
>
> `docs/mockups/serenify-landing-mock.html` (present, 511 KB) is invisible to a default `rg`.
> **Every** search of it must pass `--no-ignore` or scope to `*.html`:
>
> ```
> rg --no-ignore "nothing reaches a manager|anonymised group trends|never a manager" docs/mockups/
> ```
>
> **The mock's three forbidden lines (`:442`, `:550`, `:772`) must NEVER be transcribed.** The
> approved replacements in `plan.md` **§10.3** go in instead, **character-for-character**, and
> are not re-worded at implementation time. The closing beat's **clause order is load-bearing
> and must not be reversed** — chat clause first, so the deletion frame does not bleed backwards
> and imply the conversation was deleted too. It was not: companion chat is **stored**,
> employee-private. Swapping the clauses would make the line false.
>
> The orb is feature **008**'s `apps/web/components/monitor/bloom.tsx`, not 007's. Ren's blue
> (foggy) state is an **approved liberty (FR-022)** — **do not "correct" it** to the monitor's
> band colouring.

### Preconditions

- [X] T078 [P6] Invoke **`hallmark`, with theme selection skipped**, before writing any landing UI. **Theme selection is skipped because Serenify already has a theme** (constitution Principle V). **Done when**: Hallmark has run across the hero, the story card, the "Never" cards, how-it-works and the status statement, having been told the token block is **`apps/web/app/globals.css`** and the theme is **Graphite**; its **#3 locked-tokens** discipline was applied with **no new token invented** — this is the phase most likely to want one, and the answer is that the design changes, not the token block, because a new token needs a constitution amendment this feature must not make (`plan.md` §0.7; note that `--color-on-accent` and `--color-scrim` are **already-used-but-unregistered**, issue **#155**, referenced and **not** fixed here); its **#5 mobile floor** was taken as **320 / 375 / 414 / 768 px** (FR-053, SC-008) rather than re-derived; its **#4 re-drawn-chrome-forbidden** discipline was applied as **FR-052** — no fake browser bar, no phone frame, no fake IDE chrome anywhere on this page, and specifically **no simulated camera preview** in any swap panel; its **#2 honest-copy** discipline was satisfied structurally, because **Hallmark writes no copy here** — every string comes from `lib/landing/copy.ts` (T089/T090) and the three approved `plan.md` §10.3 strings are **verbatim and unrewordable**; and **`frontend-design` was NOT invoked**. **Name in the P6 PR body which skill ran and confirm theme selection was skipped.** Dependencies: T037 (P3 merged).

- [X] T079 [P6] Read the Next 16 guides for **route groups** and the **root `page.tsx`** under `node_modules/next/dist/docs/` before writing any route file in this phase (`apps/web/AGENTS.md`: *"This is NOT the Next.js you know"*; `plan.md` §2; R9). **Done when**: the exact guide paths consulted are named in the P6 PR body, and one specific question is answered **from the docs rather than inferred** — *what happens if both `app/page.tsx` and `app/(public)/page.tsx` exist, and is the fix a move or an addition?* T028's header comment in `app/(public)/layout.tsx:28–30` already records the P3 half of this answer ("P3 deliberately adds no `(public)/page.tsx`, which is the one file that WOULD collide with `app/page.tsx` over `/`"); confirm it against the current docs rather than trusting the comment. Do not infer route-group semantics from Next 14/15 habits. Dependencies: T037.

### Shared definitions extracted first (R5, R6) — small, reviewable, zero behaviour change

- [X] T080 [P] [P6] Create the one band-label definition at `apps/web/lib/bands.ts` (**new file**, FR-015). **Done when**: it exports `BAND_LABEL` exactly as `contracts/landing-hero-story.md` §9.1 fixes it — `tense: "Tense"`, `a_little_tense: "A little tense"`, `at_ease: "At ease"` — typed over the existing `Band` union; it imports nothing from `server-only` so Vitest loads it directly; and `tsc --noEmit` is green. This becomes the **one** definition; the landing readout and the monitor's trend axis both import it, which is precisely "sourced from the app's existing band definitions rather than restated as new literals". Dependencies: T079.

- [X] T081 [P6] Refactor `apps/web/lib/session-trend-geometry.ts` to import `BAND_LABEL` instead of inlining the three literals. **Done when**: the three string literals at `:324–326` inside `axisFor()` — `"Tense"`, `"A little tense"`, `"At ease"` — are replaced by reads from `BAND_LABEL`; **this is a pure literal extraction with ZERO behaviour change** and the existing `session-trend-geometry` unit suite passes **unmodified** — if any existing assertion needs editing, the refactor is wrong and must be reconsidered rather than the test relaxed (R5); the narrow-width axis-sizing comment at `:86`, which reasons about `"A little tense"` fitting in the 84 px min gutter, still describes the shipped behaviour; and nothing else in the file moves. **This is the live monitor's graph** — it lands here, in P6, where it is reviewable in isolation. Dependencies: T080.

- [X] T082 [P6] Add **one optional** `color?: string` prop to `apps/web/components/monitor/bloom.tsx` (R6, FR-021, FR-022). **Done when**: the signature at `:42` becomes `{ tone, className, color }` and the inline style at `:47` uses `color ?? TONE_COLOR[tone]` for the `--bloom` custom property; **every existing call site is unchanged** and continues to omit the prop; the default reproduces today's behaviour **byte-identically** for all four tones; and the existing `tests/unit/components/monitor/bloom.test.tsx` passes **unmodified**. This prop is needed because Bloom sets `--bloom` as an **inline style on its own element**, which an ancestor cannot override — FR-021 forbids reimplementing the orb and a landing-only copy would violate it outright (`plan.md` §16). Nothing else in the component changes: not the reduced-motion branch at `:71–91`, not `TONE_COLOR`, not the `aria-hidden`, not the `color-mix` derivations. Dependencies: T079.

- [X] T083 [P] [P6] Extend `apps/web/tests/unit/components/monitor/bloom.test.tsx` with the default-preservation proof (R6). **Done when**: for **every** `BloomTone` (`ease`, `warming`, `little`, `tense`), rendering **without** `color` yields exactly the `--bloom` value the component produces today, asserted against the `TONE_COLOR` values rather than a hand-copied string; and rendering **with** `color` yields that value instead. The point of the first half is that a future edit to the defaulting cannot silently change the live monitor. Dependencies: T082.

### The root-route takeover (`research.md` §11) — the two existing behaviours must survive

- [X] T084 [P] [P6] Create the pure routing decision at `apps/web/lib/routing/resolve-root-route.ts` (**new file**) — the same technique `resolveCalibrateMode` uses to make a Server Component's load-bearing decision directly testable (`research.md` §11 "Proof"). **Done when**: it exports `resolveRootRoute({ code, isSignedIn })` returning `{ kind: "callback" | "app" | "landing" }`; the precedence is exactly the order §11 fixes — **`?code=` first**, signed-in second, landing last; it imports nothing from `server-only` and touches no Supabase client; and `tsc --noEmit` is green. **`?code=` must be first**: a signed-in user in another tab clicking a recovery link would otherwise be redirected to `/app` and the code lost. Dependencies: T079.

- [X] T085 [P] [P6] Unit table for `resolveRootRoute` at `apps/web/tests/unit/lib/routing/resolve-root-route.test.ts`. **Done when**: `{ code: "abc" } → callback` **including when signed in** (the precedence case that matters); `{ isSignedIn: true } → app`; `{} → landing`; an empty-string `code` is treated as absent (matching today's `code.length > 0` check at `app/page.tsx:21`); and an array-valued `code` (Next's `searchParams` can yield `string[]`) does not produce a `callback`. Dependencies: T084.

- [X] T086 [P6] Perform the root-route takeover: create `apps/web/app/(public)/page.tsx` and **delete `apps/web/app/page.tsx` in the same commit**. **Done when**: only one page resolves to `/` — this is a **move, not an addition**, and both files existing simultaneously is a build-breaking route conflict (§11 "Route-group mechanics"); the new page keeps `export const dynamic = "force-dynamic"` (today at `app/page.tsx:7`; the cost is known and accepted — R11); it drives its terminal branch off `resolveRootRoute`, so the `?code=` forward (today `app/page.tsx:20–23`) and the signed-in redirect to `/app` (today `:25–29`) are preserved **line for line in behaviour**, with only the third branch changing from `redirect("/login")` to rendering the landing page; the landing page therefore renders inside the P3 public shell (`app/(public)/layout.tsx`) with its navbar and footer; and the proxy's onboarding gate still bounces an un-onboarded signed-in user onward exactly as today. **`proxy.ts` is not touched** — §11 rejects moving this into the proxy: its `redirectTo` helper clears `url.search`, which would eat the `?code=`, and it is the highest-blast-radius file in the repo. Dependencies: T084, T079.

- [X] T087 [P] [P6] Append the two narrow root-route checks to the **existing** auth Playwright specs under `apps/web/tests/e2e/` (`research.md` §12.2 — deliberately two checks appended, not a new suite). **Done when**: a signed-in employee visiting `/` lands on `/app`; `/?code=test` redirects to `/auth/callback?code=test`; both run under the existing `playwright.config.ts` (which has the `globalSetup` these need), **not** under `playwright.layout.config.ts` (which has no database by design). The **real** email-link case is ST-8 and is a human check, not this. Dependencies: T086.

### Landing copy — one reviewable surface, transcribed once

- [X] T088 [P6] Do the mock transcription pass for the landing sections, applying the `--no-ignore` grep discipline. **Done when**: the source lines for the hero, the "Never" cards, how-it-works, and the status statement have been located in `docs/mockups/serenify-landing-mock.html` with a search that **actually saw the file** (`rg --no-ignore … docs/mockups/`, verified by non-empty output — a silent zero-match here is the failure mode `plan.md` §10.1 exists to prevent); the three forbidden lines `:442`, `:550`, `:772` are located and **explicitly marked NOT-FOR-TRANSCRIPTION** in the working notes; and the notes record, per string, whether it is transcribed from the mock or is one of the four approved §10.3 replacements. **No copy is written into the repo by this task** — this is the read, and it is separated from the write so the forbidden lines are identified before anything is typed. Dependencies: T079.

- [X] T089 [P6] Create `apps/web/lib/landing/copy.ts` (**new file**) carrying the **three approved §10.3 strings, character-for-character**. **Done when**: the module exists and exports, as named constants: **(1)** the hero lede replacing mock `:442` — the string beginning *"Serenify notices signs of strain during the workday…"*, verbatim from `plan.md` §10.3 Position 1; **(2)** the replacement **"Never"** card — **both** its heading and its body, verbatim from §10.3 Position 2, whose closing sentence is **"Not now, not ever."** and **not** "Not now, not later." (which would read as a deferral of the promise rather than its permanence); **(3)** the closing story beat, verbatim from §10.3 Position 3, **with its two clauses in the approved order — chat clause first**. Each of the three carries a comment naming its §10.3 position and stating that it is **fixed copy under FR-032 and is not re-worded at implementation time**. **These are not paraphrased, not re-punctuated, not re-cased.** If any of them appears to need a change, that is a re-approval request to Mohamed, not an edit (R12). Dependencies: T088.

- [X] T090 [P6] Complete `apps/web/lib/landing/copy.ts` with **every remaining landing string** (same file, separate commit). **Done when**: every string the landing components render is a named exported constant and **there is no string literal in any landing component** — the forbidden-claim review is then a review of one file, not of a component tree (`plan.md` §10.1 item 1); it includes the approved FR-005 hero data-handling line, the how-it-works copy, the retention/status statement (FR-003 — the 90-day retention stated as a **policy**, with **no** claim of an automated purge; BACKLOG **#86** is not owned here), the two CTA labels, the chapter names, and all 17 beats' narration; it carries **zero** numeric quality metrics (FR-004, SC-005); it makes **no** blanket manager-negation claim and **no** on-device-processing claim (FR-002); and it uses the binding terminology — **calibration**, **monitoring session**, **weekly work-environment check-in**, never bare "check-in". Dependencies: T089.

### The story script — data, not control flow

- [X] T091 [P6] Create `apps/web/lib/landing/story-script.ts` (**new file**) — the **17 beats as pure data**. **Done when**: it exports a **frozen** array of 17 beats shaped `{ chapter, durationMs, panel, band, narrationKey, threadOp }` exactly as `contracts/landing-hero-story.md` §9.1 fixes, plus the pure helpers `chaptersOf()`, `firstBeatIndexOfChapter()` and `trimThread(messages, 4)`; the structure matches the transcribed table — chapter 0 beats 1–2 (`quiet`), chapter 1 beats 3–4 (`prompt`), **chapter 2 beat 5 — the false alarm resolved, at no cost** (`resolved`), chapter 3 beats 6–8 (`quiet` → `prompt`), chapter 4 beats 9–13 (`ren`), chapter 5 beats 14–17 (`ren` → `quiet`); total duration ≈ **42.1 s**; the panel set is exactly the four named panels; every `band` value is a member of `BAND_LABEL`'s three keys and nothing else; narration is referenced **by key into `lib/landing/copy.ts`**, never inlined; and it imports nothing from `server-only`. **The false-alarm-before-companion ordering is the page's thesis and is not reorderable** (FR-006, SC-002). Dependencies: T090, T080.

- [X] T092 [P] [P6] Story-script invariant tests at `apps/web/tests/unit/lib/landing/story-script.test.ts` (`research.md` §12.2 "Story invariants"). **Done when**: exactly **17** beats; exactly **6** chapters; total duration ≈ **42 s**; **the chapter containing the resolved false alarm has a strictly lower index than the chapter containing the first companion beat** — asserted as an **invariant, not a convention** (SC-002); the panel set is exactly the four named panels; every band label used is a member of `BAND_LABEL` and nothing else (SC-011); `trimThread` keeps the **4 most recent** messages and drops the oldest; and every `narrationKey` resolves to an actual export of `lib/landing/copy.ts` — a dangling key would render an empty fixed-height row and pass every layout assertion. Dependencies: T091.

### The story card — built region by region, because the geometry is the hard part

- [X] T093 [P6] Build the story card **shell** at `apps/web/components/landing/story-card.tsx` (**new file**), implementing the three-region structure `contracts/landing-hero-story.md` §9.1 fixes. **Done when**: the card is one outer box with `overflow-hidden` whose outer dimensions **never change**; the **READOUT** region is **permanently visible** — `<Bloom>`, the reading label from `BAND_LABEL`, and the trend — at every beat and under reduced motion (FR-007); the **NARRATION** row has a **FIXED height, not a min-height** (FR-009), so its content changing cannot move anything below it; and the **SWAP AREA** is `position: relative` with an **explicit height** (the tallest panel's, measured once per breakpoint) containing four panels each `position: absolute; inset: 0`, with exactly one carrying `data-active` and `aria-hidden` on the other three (FR-010). **The absolute positioning IS the anti-clipping mechanism and flow layout is NOT an acceptable substitute**: an absolutely positioned panel is out of flow, so it cannot push the card's box no matter how tall its content is, and the swap area's explicit height is what fixes the box. `overflow-hidden` on **both** the card and the swap area guarantees no internal scrollbar at any width. Dependencies: T091, T078, T082, T080.

- [X] T094 [P6] Build the **four swap panels** under `apps/web/components/landing/panels/` (**new files**) — `quiet`, `prompt`, `resolved`, `ren`. **Done when**: all four exist as separate components, each rendering only strings from `lib/landing/copy.ts`; each is sized to sit inside the T093 swap area without needing the card to grow; **the `resolved` panel carries the false alarm resolved at no cost**, which is the beat the whole page is built around; **no fake device chrome anywhere** — no simulated browser bar, no phone frame, no fake camera preview (FR-052); no panel renders a number or a probability; and each is correct at 320 px in both themes. Dependencies: T093.

- [X] T095 [P6] Build the **Ren thread** at `apps/web/components/landing/ren-thread.tsx` (**new file**), inside the `ren` panel. **Done when**: it caps at **4 visible bubbles with NO scroll** — the oldest leaves when the cap is reached, driven by `trimThread(messages, 4)` (FR-011); **the card does not resize when the thread trims**, which holds by construction because the thread lives inside an absolutely positioned panel within a fixed-height swap area (FR-008) — assert it rather than assume it; Ren's orb state uses `<Bloom color="var(--color-foggy)" />` via the T082 prop, **the real Graphite token, not a ported mock hex** (FR-057); **this blue state is the approved FR-022 liberty and must NOT be "corrected" to the monitor's band colouring** (flagged for Mohamed's eye in **ST-4**); and the dialogue is **scripted static copy, not a model call** (Principle IV — there is no LLM on this page). Dependencies: T094.

- [X] T096 [P6] Build the **chapter markers** at `apps/web/components/landing/chapter-markers.tsx` (**new file**). **Done when**: six real `<button>` elements sit in a `<nav aria-label="Story chapters">`, each with an accessible name naming its chapter and `aria-current="true"` on the active one; activating one jumps to `firstBeatIndexOfChapter()`; pointer **and** keyboard both activate (a `<button>` gives Enter and Space for free — a `<div role="button">` is a FAIL); each meets the tap-target floor **as amended** — FR-053 carries a **spent 24×24 px exception scoped to exactly this file** (`spec.md` FR-053, amended 2026-07-28 by Mohamed; `docs/DECISIONS.md`, "FR-053 gains a spent 24×24 exception for the chapter markers"), so **24×24 px is correct here and 44×44 is NOT required** — six controls at 44×44 make the cluster 264 px wide however small the dot is drawn, which is the constraint that prompted the amendment; every OTHER interactive element on the public surface stays at 44 px; each carries the app's visible focus ring (FR-055); and — explicitly — **chapter markers only, NO per-beat progress bar** (FR-014; a progress bar was rejected in Non-Goals). Dependencies: T093, T091.

- [X] T097 [P6] Build the **advance and pause mechanism** at `apps/web/components/landing/use-story-clock.ts` (**new file**). **Done when**: advance is **one `setTimeout` chain at ≥1.4 s intervals** — not a `setInterval`, not one timer per beat; pause/resume is **one `IntersectionObserver`** (FR-012) with the repo's known gotcha handled — the observer delivers an initial **synchronous** entry on `observe()` reflecting current visibility, so the implementation holds a `hasDeliveredFirstEntry` ref and **discards that first callback**, leaving only real scroll transitions to drive pause/resume; it **fails safe** — a missing observed element, or one whose measured height is 0 (a collapsed or not-yet-laid-out box), is treated as **visible** and the story keeps playing, because a story frozen forever because a ref was null is worse than one that runs off-screen; and it uses **no** `localStorage`/`sessionStorage`. Resuming must not **jump or double-advance** (ST-6). Dependencies: T093.

- [X] T098 [P6] Implement the **reduced-motion branch** (FR-013, FR-054, SC-010). **Done when**: reduced motion is read through the **repo hook** — `useMediaQuery("(prefers-reduced-motion: reduce)")` from `@/hooks/use-media-query`, built on `useSyncExternalStore`, which **re-subscribes** to the media query; under it **no timer is armed**, **no transition class is applied**, a **static representative beat renders with the readout visible**, and the **chapter markers remain fully functional** so a visitor can step through deliberately; and **no information exists only in motion**. **framer-motion's `useReducedMotion` snapshots at mount and does not re-subscribe — it is FORBIDDEN here** (`bloom.tsx:5` already models the correct choice, importing the repo hook rather than framer's). This is what **ST-5** verifies by toggling reduced motion at the **OS level mid-session** and expecting the story to stop advancing **immediately**. Dependencies: T097.

- [X] T099 [P] [P6] Add the forbidden-import assertion at `apps/web/tests/unit/components/landing/no-framer-reduced-motion.test.ts` — the "lint-style unit check" `contracts/landing-hero-story.md` §9.1 requires. **Done when**: it asserts by source inspection that **no file under `apps/web/components/landing/`** imports `useReducedMotion` from `framer-motion`, and that the story clock imports `useMediaQuery` from `@/hooks/use-media-query`. A comment states why: the framer hook snapshots at mount, so a mid-session OS toggle would be missed and ST-5 would fail on a real device long after CI went green. Dependencies: T098.

### The remaining landing sections

- [X] T100 [P6] Build the **hero** at `apps/web/components/landing/hero.tsx` (**new file**). **Done when**: it renders the approved §10.3 hero lede constant and the approved FR-005 data-handling line beneath it, both from `lib/landing/copy.ts` with **no inline literals**; the two CTAs are labelled **exactly** `"Get started"` (**meadow-filled**) and `"See how it works"` (**outline**) — the labels are fixed by FR-020 and are not re-worded — and **both are centred on mobile**; both are ≥44 px with visible focus indicators and neither label wraps at 320 px (FR-053); it composes the T093 story card; and it uses the existing button component and Graphite tokens rather than new styles (FR-057). Dependencies: T093, T090, T078.

- [X] T101 [P] [P6] Build the **"Never" cards** at `apps/web/components/landing/never-cards.tsx` (**new file**). **Done when**: the three-card grid and the "Never" tag are preserved from the mock, and the card that replaced mock `:547–551` renders the approved §10.3 Position 2 **heading and body verbatim** — *"Never / Read your conversations."* with the body ending **"Not now, not ever."**; **this is a structural replacement, not a body rewrite** — the heading changed too, because the original card's **premise** was the forbidden claim; the replacement carries **no** not-yet-live marker, correctly, because the chat-and-crisis guarantee is a **Principle I invariant** rather than an unbuilt control (FR-001); and neither of the other two cards makes a blanket manager-negation or on-device-processing claim. Dependencies: T089, T090, T078.

- [X] T102 [P] [P6] Build the **how-it-works** section at `apps/web/components/landing/how-it-works.tsx` (**new file**). **Done when**: it renders only `lib/landing/copy.ts` constants; it describes **calibration**, the **monitoring session**, and the **weekly work-environment check-in** using exactly those names (never bare "check-in"); it contains **no fake device chrome** (FR-052) and **no** model performance figure (FR-004); and it is correct at 320/375/414/768 px in both themes. Dependencies: T090, T078.

- [X] T103 [P] [P6] Build the **retention and status statement** at `apps/web/components/landing/status-statement.tsx` (**new file**) — FR-003. **Done when**: it states the **90-day reading retention as a policy** and makes **no claim, promise, or implication of an automated purge** (the purge job is BACKLOG **#86**, unslotted and explicitly not owned here); it states the project's status honestly; and it links to `/privacy` and `/terms` for the full text. Dependencies: T090, T078.

- [X] T104 [P6] Assemble the landing page in `apps/web/app/(public)/page.tsx` and extend the public destinations. **Done when**: the landing branch of T086's page composes hero → "Never" cards → how-it-works → status statement (the team section is **P7** and its slot is left explicit); the page reads **no user data and makes no authenticated call** on the landing branch (spec Assumptions); `apps/web/components/public/destinations.ts` gains the landing anchors the navbar and footer should offer now that `/` is a real page — the file's own header comment at `:13–14` reserves exactly this ("The landing page takes over `/` in P6 and will extend this list then"); **no authed destination is added** — there is no `/app` entry, no role, and no session, which is what makes FR-018 structural; and the existing `tests/unit/components/public/public-shell.test.tsx` (T034) still passes or is extended in the same commit. Dependencies: T100, T101, T102, T103, T086.

### Tests for P6

- [X] T105 [P] [P6] Extend `apps/web/tests/unit/landing/forbidden-claims.test.ts` to walk `apps/web/lib/landing/copy.ts` — the extension the file's own comment at `:99` reserves ("P6 appends `lib/landing/copy.ts` here"). **Done when**: `COPY_MODULES` at `:100–102` gains the landing copy module; **zero** matches for both forbidden families across every exported string; **the mock's three literals stay as negative fixtures at `:131–152` and must still be CAUGHT** — if the detector stops biting, every assertion in the file is passing vacuously; the positive fixtures at `:165–196` still pass, so the scoped chat-and-crisis claim FR-001 permits is not flagged; and the `ALL_STRINGS.length > 50` sanity guard at `:110` still holds against the widened set. Dependencies: T090.

- [X] T106 [P] [P6] Story-card component tests at `apps/web/tests/unit/components/landing/story-card.test.tsx` (`research.md` §12.2 "Unit"). **Done when**: **exactly one** panel carries `data-active` at **every** beat index, 0 through 16 — asserted by stepping the whole script, not spot-checked; the thread **never exceeds 4** bubbles at any beat; the closing beat's narration string matches the approved §10.3 constant **character-for-character** with its **two clauses in the approved order** (chat clause first — reversing them would make the line false); the readout is present at every beat **and** under reduced motion; and under reduced motion no timer is armed and the chapter markers still work. Dependencies: T093, T094, T095, T096, T098.

- [X] T107 [P6] Create the layout stability spec at `apps/web/tests/layout/landing-hero-stability.spec.ts`, under the **existing** `apps/web/playwright.layout.config.ts` — **real browser, real layout, NO database, chromium only** (the config's `testDir` is already `./tests/layout` and it has no `globalSetup`, deliberately; the landing page is unauthenticated so it needs none). **Done when**, at **320, 375, 414 and 768 px**: the card's `getBoundingClientRect()` is recorded, **all 17 beats** are stepped through via the chapter markers plus clock advance, and after each beat `width` and `height` deltas are **exactly 0** (SC-003, FR-008); `scrollWidth === clientWidth` and `scrollHeight === clientHeight` on **both** the card and the swap area, so there is no internal scrolling at any width; the document has **no horizontal overflow** at each width (SC-008); **and — the R12 assertion — at 320 px the narration element renders on exactly ONE line for EVERY beat**, computed as `Math.round(el.scrollHeight / parseFloat(getComputedStyle(el).lineHeight)) === 1`. The approved closing beat (§10.3 Position 3) is the longest narration string and therefore the binding case. **A failure here is a copy-length problem, not a CSS problem** — it means the string, not the layout, must change, and that requires **re-approval from Mohamed**, not a taller row (FR-009, R12). Dependencies: T104, T096, T098.

- [X] T108 [P] [P6] Landing accessibility tests at `apps/web/tests/unit/components/landing/landing-a11y.test.tsx` (SC-009). **Done when**: every interactive element on the landing page is reachable and has an accessible name; the chapter markers expose `aria-current` on the active one; the `<nav aria-label="Story chapters">` is present; the two hero CTAs have their exact FR-020 labels; the `<Bloom>` orb stays `aria-hidden` and decorative, carrying no number; and no element depends on hover alone to convey information. Dependencies: T104.

- [X] T109 [P] [P6] **Promote** — and only promote — the reserved paths in the web-storage guard at `apps/web/tests/unit/lib/legal/no-web-storage.test.ts`. **Corrected 2026-07-26 (see T059's correction):** this task previously said T059's `components/landing/` and `lib/landing/` entries "were inert in P4 and start matching once this phase's files land", and that "the test file is NOT touched by this phase". **Neither is true, by design.** T059 lists those two paths under `RESERVED_FOR_LATER_PHASES` and asserts they do **not** yet exist, so the moment this phase creates either one the guard **fails by name** with the fix in its message. That is deliberate: it makes the promotion CI-enforced rather than remembered, which an inert entry could never do — an inert entry that was silently never populated would have left the landing page unscanned by FR-051 forever. **This phase therefore makes exactly one edit to this file**: move `components/landing/` and `lib/landing/` from `RESERVED_FOR_LATER_PHASES` into `FEATURE_DIRS`. It is one line, the failing test names it, and it is the only change to this file P6 may make. P5 (T073) still touches nothing, because `components/consent/` is already in the scanned list — so the two phases still cannot collide here. **Done when**: both paths are promoted and the reserved list is empty; the guard is green with **zero** occurrences of `localStorage` or `sessionStorage` across them (FR-051) — the story clock (T097) and the reduced-motion branch (T098) are the two most likely places a browser-storage "remember the beat" convenience would creep in, so confirm the guard actually reaches `components/landing/`. *(Corrected 2026-07-27: the trailing clause "and the test file is NOT touched by this phase" is REMOVED. It contradicted this task's own corrected body, which states the phase makes exactly one edit to this file; the 2026-07-26 correction intended to remove it and did not.)* **If `lib/bands.ts` or `lib/routing/` turn out to be uncovered** — T059's list is directory-scoped and these two sit outside it — **add them and say so explicitly in the P6 PR body.** Pre-existing occurrences elsewhere stay untouched. Dependencies: T104, T059.

### Ship P6

- [X] T110 [P6] Run the manual responsive and motion walk. **Done when**: at **320, 375, 414 and 768 px**, in **both themes**, the landing page has no horizontal scrolling, no tap target under 44 px, and no tap target whose label wraps (FR-053, SC-008); every interactive element is reachable by keyboard alone with a visible focus indicator (FR-055); the full ~42 s cycle runs with nothing clipping and no scrollbar inside the card; scrolling the hero out of view and back pauses and resumes without jumping or double-advancing; toggling reduced motion **mid-session** stops the auto-advance immediately; and `/` signed in still reaches `/app`. Results recorded in the P6 PR body. These rehearse **ST-3, ST-5, ST-6 and ST-8**; the real-device and real-email versions remain P8's human pass. Dependencies: T107, T108.

- [X] T111 [P6] Run a **code-review agent** over the P6 diff, against **this phase's own task acceptance criteria** (T078–T110) and **constitution v1.13.0**. **Done when**: the agent has specifically checked that **none of the mock's three forbidden lines was transcribed** and that the four approved §10.3 strings are present **character-for-character** with the closing beat's clause order intact; that the `session-trend-geometry` refactor is a pure literal extraction with the existing suite unmodified (R5); that `bloom.tsx` gained **one optional** prop whose default is byte-identical and that no existing call site changed (R6); that only **one** page owns `/`; that the swap panels use `position: absolute; inset: 0` and not flow layout; that reduced motion goes through the repo `useMediaQuery` and **not** framer's; that there are **no string literals in landing components**; and that no `Claude-Session:` trailer or `claude.ai` URL appears anywhere. Findings go in the PR body and are **fixed before T113**. Dependencies: T110, T105, T106, T109, T099, T083, T085, T087, T092.

- [X] T112 [P6] Run the local phase verification. **Done when**: `npm run -w apps/web lint typecheck test` and `uv run --directory apps/api pytest` are green with the output recorded in the P6 PR body **The verification runs AFTER the final commit of the phase, and the report states the commit SHA it ran against — a verification result without a SHA is not a verification result** (added 2026-07-26, after a P4 report cited a `typecheck` run that predated the file which broke it; the review agent caught the failure, the reporting discipline did not). (Windows: Vitest with `--pool=threads`); `npm run -w apps/web test:layout -- landing-hero-stability` is green at all four widths; and the existing `session-trend-geometry` and `bloom` suites are confirmed green **unmodified**. Dependencies: T111.

- [X] T113 [P6] Open the P6 PR from `p6-landing-page` into `013-public-surface-and-legal`. **Done when**: the **actual diff of every committed file** is shown before committing; commits are per-file with all three co-author trailers; no `Claude-Session:` trailer and no `claude.ai` URL anywhere; the PR body names which design skills ran (T078) and records both design conflicts as open questions; it names the Next 16 guide paths consulted (T079); it records the T110 walk, the T111 findings and the T112 output; it states that `app/page.tsx` was **moved, not copied**, and that the two existing root-route behaviours are preserved; and all three CI checks are green. Dependencies: T112.

**Checkpoint**: `/` is the landing page, both prior root-route behaviours survive, and the card's zero-pixel invariant is machine-proven at four widths. **US1 is complete. P7 is unblocked** — the team section renders inside this page.

---

## Phase 7: P7 — Team section (branch `p7-team-section`)

**Depends on**: **P6** — the team section renders inside the landing page P6 creates.

**Goal**: four people, four outlines, eight real links, and a mapping a visitor can obtain
without ever hovering.

**Independent test**: at 320/375/414/768 px the four name cards, the eight links and the
supervisor credits are readable and operable; activating a name card highlights the matching
silhouette **and the highlight persists**; touching or clicking a silhouette highlights the
matching card; with the photo blocked entirely, nothing collapses.

**Reads**: `contracts/public-surface.md` **§9.2** (the primary source) · `plan.md` §0.2 (the
mapping verification and its residual), §0.4 (the filename case) · `plan.md` §15 R4, R9 ·
`plan.md` §13 **ST-7, ST-14, ST-15**.

### Preconditions

- [X] T114 [P7] Invoke **`hallmark`, with theme selection skipped**, before writing the team section. **Theme selection is skipped because Serenify already has a theme** (constitution Principle V). **Done when**: Hallmark has run against the photo/overlay composition, the name cards and the credits, having been told the token block is **`apps/web/app/globals.css`** and the theme is **Graphite**; its **#3 locked-tokens** discipline was applied with **no new token invented** — the silhouette highlight state in particular must be expressed through existing tokens, since a new one needs a constitution amendment this feature must not make (`plan.md` §0.7); its **#5 mobile floor** was taken as **320 / 375 / 414 / 768 px** (FR-053, SC-008); its **#4 re-drawn-chrome-forbidden** discipline is **FR-052** — the photo is a real photograph in a plain container, with no device frame around it; and **Hallmark writes no copy** — the four names, the caption and the supervisor credits are **verbatim constants** from `lib/landing/copy.ts` (T120) fixed by FR-024 and FR-027. **The design pass must not alter the overlay's geometry**: `preserveAspectRatio="none"` over an exact-aspect box is a correctness constraint from `contracts/public-surface.md` §9.2, not a style choice, and every outline misaligns if it is changed. **`frontend-design` was NOT invoked.** **Name in the P7 PR body which skill ran and confirm theme selection was skipped.** Dependencies: T113 (P6 merged).

- [X] T115 [P7] Read the Next 16 **`next/image` sizing** guide under `node_modules/next/dist/docs/` before writing the photo component (`apps/web/AGENTS.md`; `plan.md` §2; R9). **Done when**: the exact guide path is named in the P7 PR body, and one specific question is answered **from the docs rather than inferred** — *with explicit `width`/`height` plus `className="h-auto w-full"`, what box does the rendered element occupy, and does it carry the source's exact aspect ratio at every width?* That answer is load-bearing: the `preserveAspectRatio="none"` overlay aligns only if it does. Do not infer `next/image` sizing from Next 14/15 habits. Dependencies: T113.

### The asset

- [X] T116 [P7] Produce the cropped team photo at `apps/web/public/team/serenify-team-2026.jpg` (**new file, new directory**). **Done when**: the source `apps/web/public/IMG-20260706-WA0054.jpg` (3024×4032, 1.24 MB — **lowercase `.jpg`**, confirmed on disk; the request's `.JPG` is immaterial on Windows and **material on the Linux build host**, `plan.md` §0.4) is cropped `y = 1100…3300` at full width and downscaled to **exactly 1600×1164**; the output is verified against the mock's embedded image (the base64 at `:624` decodes to 1600×1164; the crop reproduces it to a mean per-channel difference of ≈3.86/255 — JPEG recompression noise, not a different crop, R4); it lands in `public/team/`, following the repo's established feature-asset convention (`public/face-detect/` is the only precedent, and `public/` root holds only Next scaffolding and manifest icons); and **the project poster visible in the photo is NOT cropped or edited to remove its performance figures** — **FR-004 accepts it explicitly and forbids editing them out.** Dependencies: T115.

- [X] T117 [P7] **Delete** `apps/web/public/IMG-20260706-WA0054.jpg` in the same PR. **Done when**: the 1.24 MB original is gone from `public/`; a repo-wide search confirms **nothing references it**; and the build succeeds. It must not ship — anything in `public/` is served. Dependencies: T116.

### The silhouettes — copied verbatim, then frozen

- [X] T118 [P7] Create `apps/web/lib/landing/team-silhouettes.ts` (**new file**) holding the four `SIL` path strings copied **character-for-character** from `docs/mockups/serenify-landing-mock.html` (~line 671). **Done when**: the four paths are transcribed **verbatim** — **re-deriving, re-tracing, reformatting, or regenerating them by any means is forbidden (FR-026)**; the read used `rg --no-ignore` or an explicit `*.html` scope, because the mock is gitignored and a default `rg` sees nothing (`plan.md` §10.1); the keys are `mohamed`, `fatma`, `hebatullah`, `gehad`; and the file's header records **the mapping and how it was verified** — x-ranges strictly ascending `mohamed` (0.34→21.84, leftmost) < `fatma` (22.16→40.59, second) < `hebatullah` (64.91→81.47, **inner right**, the person wearing glasses) < `gehad` (79.47→97.78, **outer right**, rightmost), matching FR-024's required left-to-right card order and the mock's own `TEAM` array at `:807–812`. **It is NOT reversed** (`plan.md` §0.2).

  **AMENDED 2026-07-27 during P7, by Mohamed.** The x-range for `gehad` above is now
  **77.28 → 97.78**, not 79.47 → 97.78, and its path is **re-traced rather than
  verbatim**. The mock covered her whole left edge with one straight segment spanning
  ~28 viewBox units, which sliced across her shoulder and clipped her blazer; FR-026 was
  amended to permit exactly this one re-trace and no more. `mohamed`, `fatma` and
  `hebatullah` are still byte-identical to the mock, and within `gehad` vertices 0–6 and
  everything from `L 83.38 39.05` onward are byte-identical too. The three ascending-order
  checks below are unaffected — `gehad` still starts right of `hebatullah`'s start and
  ends right of its end. See `spec.md` FR-026 for the scope and `lib/landing/team-silhouettes.ts`
  for the account.

  **Record the ST-7 residual in the file header, in these terms**: points 1–3 prove the data is **internally consistent and geometrically correct**; they **cannot** catch a mis-labelling made at tracing time that would be wrong in both the `SIL` keys and FR-024 together. **No artefact in this repository establishes which human being is which name.** That single fact is a **human check, not an automatable one** — smoke test **ST-7**, where Mohamed confirms the inner-right outline highlights **Hebatullah** and the outer-right highlights **Gehad**. Dependencies: T114.

- [X] T119 [P] [P7] Freeze the paths at `apps/web/tests/unit/lib/landing/team-silhouettes.test.ts` (`contracts/public-surface.md` §9.2, R4). **Done when**: each path's **exact character length** and **SHA-256** are asserted against frozen constants, so **any** edit — including a "harmless" reformat or a whitespace normalisation — fails CI; and the x-ranges are asserted **strictly ascending** in the order `mohamed < fatma < hebatullah < gehad`, so a key swap fails CI. Both guards make FR-026 enforceable rather than aspirational. Dependencies: T118.

### The section

- [X] T120 [P] [P7] Add the team strings to `apps/web/lib/landing/copy.ts` (same module P6 created; **no string literals in components**). **Done when**: it exports the four names in FR-024's fixed left-to-right order — **Mohamed Assem Adel · Fatma Alzahraa · Hebatullah · Gehad**; the caption **verbatim**: **"Choose a name to find them in the photo."**; the supervisor credits **verbatim**: **Dr. Lamees Nasser · Dr. Safaa Mouneer**; and the eight external URLs with their accessible names. **Note in the module, so it is never "fixed" by a future reader**: the legal documents use the single form **"Mohamed Assem"** while the team section keeps the full FR-024 spelling **"Mohamed Assem Adel"** — *the two are deliberately different and neither is a typo.* (`/privacy` separately names the data controller as **Mohamed Asem**, FR-046 — a third deliberate form.) Dependencies: T118.

- [X] T121 [P7] Build the photo and overlay at `apps/web/components/landing/team-photo.tsx` (**new file**). **Done when**: it uses `next/image` with **explicit `width={1600} height={1164}`** and `className="h-auto w-full"`, so the container box carries the photo's **exact** aspect ratio (this avoids the `@next/next/no-img-element` lint rule the OG route has to disable, and CSP `img-src 'self'` already covers `/_next/image`); the SVG overlay sits over an **exact-aspect box** with `viewBox="0 0 100 100"` and **`preserveAspectRatio="none"`** — **a hard constraint, not a preference: the `SIL` coordinates are normalised to that exact crop, and any other value misaligns every outline** (§9.2); the overlay is `aria-hidden`, because the name cards are the accessible route and duplicating the people in the SVG would double every person in the tab order; and the silhouette paths carry pointer handlers for the **photo → card** direction (FR-025). Dependencies: T116, T118, T115, T114.

- [X] T122 [P7] Build the name cards and the **bidirectional** highlighting at `apps/web/components/landing/team-cards.tsx` (**new file**) — FR-025, FR-028, Principle VI. **Done when**: each card is a real `<button>` with `aria-pressed`, so **pointer, touch AND keyboard (Enter/Space) all set the active person and the highlight PERSISTS** — which is how **the mapping is obtainable without hover** (SC-009, FR-028); hover and focus additionally *preview* it; activating a silhouette highlights the matching card and activating a card highlights the matching silhouette (**bidirectional**, FR-025); every card carries a **visible focus indicator** (FR-055) and is ≥44 px at 320 px; and the cards render in FR-024's fixed left-to-right order. **A hover-only mapping is a FAIL** — it is unreachable by touch and by keyboard alike. Dependencies: T121, T120.

- [X] T123 [P] [P7] Wire the **eight external links** into the name cards. **Done when**: each of the four people carries a real **GitHub** and a real **LinkedIn** link to their actual profile; **the mock's inert `href="#"` placeholders must NOT ship**; each of the eight carries an accessible name identifying **both the person and the destination** — `aria-label="Mohamed Assem Adel on GitHub"`, `"Mohamed Assem Adel on LinkedIn"`, and so on — so a screen-reader link list distinguishes all eight; and each opens safely (`rel="noopener noreferrer"`). The URLs themselves are confirmed correct by **ST-15**, which is a human check. Dependencies: T122, T120.

- [X] T124 [P] [P7] Render the caption and the supervisor credits. **Done when**: the caption renders **verbatim** — **"Choose a name to find them in the photo."**; the supervisors render **verbatim** — **Dr. Lamees Nasser · Dr. Safaa Mouneer** (FR-027); both come from `lib/landing/copy.ts` with no inline literals; and both are **separate DOM from the photo**, so they survive the photo failing to load. Dependencies: T120, T122.

- [X] T125 [P7] Assemble the team section at `apps/web/components/landing/team-section.tsx` (**new file**) and mount it in `apps/web/app/(public)/page.tsx`. **Done when**: the section composes photo + overlay + cards + links + caption + supervisors and fills the slot T104 left explicit; it is correct at **320/375/414/768 px** in both themes with no horizontal overflow; and **no real teammate name appears anywhere outside this section** — no demo employee, no fixture, no sample manager row uses them (Principle X: the public team section is exactly the use Principle X reserves these names for). Dependencies: T121, T122, T123, T124.

### Tests for P7

- [X] T126 [P] [P7] Team section tests at `apps/web/tests/unit/components/landing/team-section.test.tsx` (`research.md` §12.2 "Accessibility"). **Done when**: it asserts **exactly eight** links, **eight distinct accessible names**, and **zero `href="#"`**; that activating a name card sets `aria-pressed` and **the highlight persists without hover**; that the silhouette overlay is `aria-hidden` and contributes nothing to the tab order; that all four cards are keyboard-reachable with a visible focus indicator; and that the caption and supervisor strings match their approved constants exactly. Dependencies: T125.

- [X] T127 [P] [P7] Photo-failure resilience check (**ST-14**). **Done when**: with the photo **blocked** (a unit test rendering with the image failing, plus a manual DevTools request-block pass on a throttled connection), the **four name cards, the eight links and the supervisor credits remain readable and usable** and **the layout does not collapse** — the section keeps its box rather than shrinking to nothing or overlapping; and the manual pass is recorded in the P7 PR body. This works because the cards and credits are separate DOM from the photo (T124) — assert it rather than assume it. Dependencies: T125.

### Ship P7

- [X] T128 [P7] Run a **code-review agent** over the P7 diff, against **this phase's own task acceptance criteria** (T114–T127) and **constitution v1.13.0**. **Done when**: the agent has specifically checked that the `SIL` paths are **verbatim and frozen** (length + SHA-256 asserted) and that the mapping is **not reversed**; that the overlay uses `preserveAspectRatio="none"` over an exact-aspect box; that the 1.24 MB original is **deleted** and the cropped asset is exactly 1600×1164; that the **poster's performance figures were not edited out** (FR-004); that highlighting is **bidirectional and obtainable without hover**; that the two deliberate name spellings ("Mohamed Assem Adel" in the team section, "Mohamed Assem" in the legal documents) were **not "corrected" into agreement**; and that no `Claude-Session:` trailer or `claude.ai` URL appears anywhere. Findings go in the PR body and are **fixed before T130**. Dependencies: T126, T127, T119.

- [X] T129 [P7] Run the local phase verification. **Done when**: `npm run -w apps/web lint typecheck test` and `uv run --directory apps/api pytest` are green with the output recorded in the P7 PR body **The verification runs AFTER the final commit of the phase, and the report states the commit SHA it ran against — a verification result without a SHA is not a verification result** (added 2026-07-26, after a P4 report cited a `typecheck` run that predated the file which broke it; the review agent caught the failure, the reporting discipline did not). (Windows: Vitest with `--pool=threads`); `npm run -w apps/web test:layout -- landing-hero-stability` is **still** green with the team section on the page; and the responsive walk at 320/375/414/768 px in both themes is redone with the section present. Dependencies: T128.

- [X] T130 [P7] Open the P7 PR from `p7-team-section` into `013-public-surface-and-legal`. **Done when**: the **actual diff of every committed file** is shown before committing; commits are per-file with all three co-author trailers; no `Claude-Session:` trailer and no `claude.ai` URL anywhere; the PR body names which design skills ran (T114), names the `next/image` guide path (T115), records the T127 photo-blocked pass and the T128 findings, and **states the ST-7 residual explicitly** — no repository artefact establishes which human being is which name, so **Mohamed must confirm the inner-right outline is Hebatullah and the outer-right is Gehad** in P8's smoke pass; and all three CI checks are green. Dependencies: T129.

**Checkpoint**: the full public surface is built. **US4 is complete.** Every automatable proof is in place; what remains is the human pass, the deploy, and the closures.

---

## Phase 8: P8 — Wrap (branch `p8-wrap`) — then **merge to `main`**

**Depends on**: **all** of P1–P7.

**Goal**: the human pass automation cannot cover, a deploy protocol with a real abort point,
three issues closed with their BACKLOG entries in the same change, the documentation trail, and
**one** merge to `main`.

**Independent test**: `smoke-tests.md` exists with ST-1 through ST-15 transcribed verbatim and
every one recorded PASS or explained; the hosted database carries the one pending migration and
a throwaway signup completes through the real surface writing exactly one consent row; #75,
#157 and #158 are closed with their BACKLOG entries marked resolved.

**Reads**: `plan.md` **§13** (the ST table — the source of `smoke-tests.md`), §14 (P8's scope),
§15 R8, R11 · `contracts/consent-gates.md` §7.3 (the levers ST-10/10a/10b exercise) ·
`docs/BACKLOG.md` · `docs/DECISIONS.md` · constitution **Principle VII** gate 5 and
**Principle VIII**.

> **#62 is not touched.** It stays open. It is a ⛔ pre-production deploy blocker and the root
> cause of the SC-006 bypass described in **R8**, and it is **out of scope for this feature**.
> **#86** and **#155** are **referenced, not owned**. Any task below that appears to require
> touching #62 is a **stop and report**, not a scope decision.

> **P8 prep — carry into T135's read-only recon, before the deploy.** Next **16.2.6 carries a
> `FormData`-dropping bug**, fixed upstream in **16.2.7** by `[16.2.x] Don't drop FormData entries`
> (#94240, a sync of `facebook/react#36468`) and shipped here by the 16.2.6 → 16.2.11 bump (#176).
> `apps/web/app/(auth)/signup/actions.ts` reads **`terms_privacy_version` off `FormData`** (`:33`),
> and `handle_new_user()` writes a `user_consents` row **only** when the signup metadata carries
> that key (`20260726000000_user_consents.sql:108-112`) — so a dropped entry is a **silently
> missing consent row**, not an error. Before the P8 deploy, run a **READ-ONLY** count on hosted of
> `auth.users` rows with no `user_consents` row of type `terms_privacy`, and record the number.
> **Read-only: a `SELECT` count only — no backfill, no INSERT, no repair.** FR-041 forbids
> backfill, and T137 separately asserts `user_consents` is **empty** post-migration; this count is
> a **measurement to record**, and if it is non-zero that is a finding to report, not a thing to
> fix in P8. Recorded here 2026-07-27 during the #176 bump so it is not lost — **no action now.**

### The human pass

- [X] T131 [P8] Author `specs/013-public-surface-and-legal/smoke-tests.md` from `plan.md` **§13**, transcribing **ST-1 through ST-15 verbatim**. **Done when**: all fifteen rows — including **ST-10a** and **ST-10b**, which carry the longest and most procedurally specific text in the table and must not be summarised — appear with their wording intact, each with a result field, a date field, and space for observations; the file states that it is run by **Mohamed**, results recorded **inline**, **before the feature branch merges to `main`** (Principle VII gate 5). **If authoring reveals a gap §13 does not cover, add it as ST-16+ and STOP AND REPORT the addition — do not quietly edit §13's meaning.** Dependencies: T130 (P7 merged).

- [ ] T132 [P8] **Mohamed runs the smoke tests.** *(Human owner. This is not an automated task and must not be marked done by an agent on the strength of unit tests.)* **Done when**: every one of ST-1 through ST-15 is recorded PASS, or FAIL with the defect filed; specifically including **ST-7** (the silhouette identity — the one fact no repository artefact can establish, §0.2), **ST-4** (Ren's blue orb reads as calm — Mohamed's aesthetic call, and an approved FR-022 liberty that must not be "corrected"), **ST-2** (a **real** confirmation email and a **real** recovery email, viewed in a light client and a dark client), **ST-8** (a **real** Supabase email link landing on `/` with `?code=`), **ST-13** (both documents read end to end against FR-048a), **ST-15** (all eight links resolve to the correct real profiles), and the three gate tests **ST-10 / ST-10a / ST-10b** against the levers T074 recorded. Results are written into `smoke-tests.md` inline. Dependencies: T131.

### Deploy — verified facts, per-step verification, and one abort point

- [ ] T133 [P8] **Backup posture — surface the choice, do not make it.** *(Decision is Mohamed's; this task stops and reports.)* **Done when**: it is recorded that the hosted project **`excukdzjudslbqmkysrc`** (eu-central-1) is on the **Free tier** — **PITR disabled, no automated backups, branching unavailable** — so a **manual `pg_dump` is the only safety net**; the two options are put to Mohamed plainly — **(a)** enable PITR for the deploy window, or **(b)** accept the manual dump — with their costs; and **no deploy step runs until Mohamed answers.** The task is to surface the choice, not to pick. Dependencies: T132.

- [X] T134 [P8] **Verify** the committed rollback SQL still matches the shipped migration. **⚠ The file is already committed and this task does NOT create it.** It lives at **`specs/013-public-surface-and-legal/rollback-user-consents.sql`**, committed to the feature branch on **2026-07-26** at task-generation time rather than being deferred to this phase — it existed only in a prior agent session's temporary scratchpad, which is session-scoped and could have been cleaned long before P8 ran, and a rollback script rewritten weeks later from a description is not a rollback script. It was copied **byte-for-byte** (SHA-256 `3FDD9056…1DB393`, 1,914 bytes); **do not re-derive it, re-format it, or "improve" it.**

  **Done when**: the committed file is confirmed still correct against `supabase/migrations/20260726000000_user_consents.sql` on all three properties — **(1)** it restores `public.handle_new_user()` **FIRST**, verbatim from `supabase/migrations/20260517000030_profile_trigger.sql`, because the 013 version inserts into `user_consents` and dropping the table first would make every new signup raise between the two statements; **(2)** it then `DROP TABLE … CASCADE`s `public.user_consents`, which removes the index, both policies, the `user_consents_no_update` trigger and the FK to `auth.users` in one step and touches no other table; **(3)** it drops the now-orphaned `public.user_consents_immutable()`. **Done when additionally**: its header warning is confirmed **still present and unedited** — **it DESTROYS CONSENT HISTORY; `user_consents` is append-only by design (FR-043b) and is the only record of which wording each person accepted and when, so it MUST be `pg_dump`ed before this is ever run**; and it is re-verified to apply cleanly inside a **rolled-back transaction** against **local** Supabase. **If any of the three properties no longer holds — because the migration changed after 2026-07-26 — STOP AND REPORT rather than editing the rollback to match.** Dependencies: T133.

- [X] T135 [P8] Write the deploy protocol into `smoke-tests.md` (or a sibling `deploy-protocol.md` in the feature directory) from these **verified read-only recon facts**, each of which the protocol re-verifies at run time rather than trusting. **Done when** the protocol records and re-checks: **(a)** exactly **one** migration is pending on hosted — `20260726000000_user_consents` — and **nothing else rides along**; **(b)** `handle_new_user()` has **not drifted** on hosted (byte-identical to `20260517000030_profile_trigger.sql`), so P2's `CREATE OR REPLACE` **reverts nothing** — re-verify by normalised diff immediately before applying, because a drift introduced after recon would be silently overwritten; **(c)** the migration is **additive** — **0 `DROP`, 0 `TRUNCATE`, 0 `ALTER COLUMN`** — and the only existing object whose *definition* changes is `handle_new_user()`; **(d)** `auth.users` **does gain an inbound FK constraint**, so it is **not strictly untouched — expect a brief lock at creation**, and the protocol says when to run it accordingly; **(e)** every step has an explicit verification query and an explicit expected result, so "it seemed fine" is not a valid outcome; **(f)** the rollback path is T134's file, with the `pg_dump` of `user_consents` as its mandatory precondition.

  **And, because serenify.tech is live and taking signups throughout this window:**

  **(g) The live-signup tolerance of the 013 trigger, recorded as a VERIFIED FACT with the guard quoted, not as an assumption.** Pre-013 code on `main` does not send `terms_privacy_version`. The guard is `supabase/migrations/20260726000000_user_consents.sql:108` — `IF NEW.raw_user_meta_data ? 'terms_privacy_version' THEN` — where `?` is the jsonb key-existence operator, so an **absent** key makes the branch false and the consent INSERT is **skipped**: no raise, and live signups are unaffected by the migration. **Re-verify this by reading the deployed function body, not this task**, and paste the quoted guard into the protocol. Record the two intolerant cases alongside it, because they bound how much the seam can take: a key present but **malformed/empty** passes the `?` guard, reaches the INSERT, and **violates the `document_version` format CHECK (`:28`) — SQLSTATE 23514 — which raises**; a key present as **JSON null** yields SQL NULL and **violates NOT NULL (`:27`) — 23502**. `ON CONFLICT DO NOTHING` (`:111`) does **not** swallow either: it handles unique/exclusion violations only. Since `on_auth_user_created` is `AFTER INSERT ON auth.users FOR EACH ROW` (`20260517000030_profile_trigger.sql:27–29`), a raise there **aborts the whole signup**.

  **(h) The migration and the production code deploy are ONE window with a stated maximum gap, migration FIRST.** Write the number down before starting. Migration-first is the safe order and the protocol says why: old code + new schema = the `(g)` skip path, everything works. The reverse — **new code + old schema** — is the bad order: the pre-013 trigger is still live so no consent row is ever written, **and** the P5 shell gate's read hits a table that does not exist, errors, and **fails OPEN for every user** with the `[consent-gate] FAIL-OPEN` line firing continuously — the app stays up while the legal gate is silently off, which is exactly the R2 failure ST-10b exists to make visible. **Never deploy code ahead of this migration.**

  **(i) A named rollback trigger, decided before the window opens, not during it.** **If live signups begin failing at any point after the migration is applied, that is an immediate rollback condition** — `pg_dump` `user_consents`, then run T134's rollback script. It is **not** something to debug in place on a live database while real people cannot create accounts. State the same for a sustained stream of `[consent-gate] FAIL-OPEN` after the code deploy.

  **(j) How live signup health is observed during the window, named specifically** — which log stream and which query, so **"it seemed fine" is not the evidence**. At minimum: the Supabase auth logs for signup errors, a periodic `SELECT count(*) FROM auth.users WHERE created_at > <window start>` compared against the same interval on the preceding day, and a `SELECT count(*) FROM public.profiles WHERE id NOT IN (SELECT id FROM auth.users)`-style consistency check confirming the `profiles` trigger half still fires. Record actual numbers at the start, middle and end of the window. Dependencies: T134.

- [X] T136 [P8] Apply the migration to hosted, step by step. **Done when**: the T133 backup decision is executed (PITR enabled, or the manual `pg_dump` taken and its file path recorded); `supabase/migrations/20260726000000_user_consents.sql` is applied to `excukdzjudslbqmkysrc`; and **each step's verification from T135 is run and its actual output recorded** — not a claim that it passed. **`supabase db reset` MUST NOT be run against the hosted project** — it re-seeds, and those 14 accounts were migrated, not seeded (project memory). Dependencies: T135, T132.

- [X] T137 [P8] Post-migration verification against hosted. **Done when**: the table, the `user_consents_lookup_idx` index, the immutability trigger, `ENABLE` + `FORCE ROW LEVEL SECURITY`, both owner-self policies, and the exact grants (`SELECT, INSERT` to `authenticated` only — **no UPDATE, no DELETE**) are all confirmed present with their actual output recorded; `handle_new_user()` on hosted now matches the 013 definition; **`user_consents` is empty — zero rows — confirming no backfill occurred** (FR-041, §7.4); and existing `profiles`, `window_readings` and `monitoring_sessions` row counts are **unchanged** from a pre-migration snapshot. Dependencies: T136.

- [X] T138 [P8] 🛑 **ABORT POINT — the first throwaway signup, on a PREVIEW deployment pointed at the hosted database.**
  **COMPLETE 2026-07-28.** Evidence: `deploy-log-stage3-2026-07-28.md` (the signup, the negative case, the gate, the cleanup) and `deploy-log-stage3b-2026-07-28.md` (*Agree and continue*, and §6 for the log clause). **The `[consent-gate] FAIL-OPEN` clause held this task open until now, and its earlier reading was wrong**: Stage 3's positive control never emitted, because `app/(auth)/login/actions.ts` returns at the invalid-credentials branch (`:33`) *before* its `console.error` (`:39`), so "the channel is dead" was unfounded in both directions. A valid control (a temporary `/log-probe` route, `d8da2fc`, removed in the same PR) proved console output IS readable — levels distinguished, object payloads intact, and a synthesised `Error` serialising with its stack rather than as `{}`. Filtering the window to `level:error` then returned **exactly one line — the probe itself** — across the whole Stage 3b exercise including *Agree and continue*, `/app` and the deep route `/app/account`. **Satisfied by the Stage 3b re-exercise, not by re-reading Stage 3's window**, which has aged out under Hobby retention; the re-exercise is a superset of those code paths. **A5 remains unsolved and is a separate item** — reading a line on request is not watching for a sustained stream, deferred to #192 and covered meanwhile by the lagging detector in `deploy-protocol.md` §6.4.

  **Name the deployment, because "the deployed product" is ambiguous and, read as production, impossible.** The acknowledgement gate ships in **P4 to the feature branch**, so **serenify.tech does not have it until T148 merges**. Testing it on production before the merge cannot work, and testing it after the merge makes this abort point meaningless — there would be nothing left to abort. **This runs against a Vercel preview deployment of `013-public-surface-and-legal`, configured against the hosted Supabase project `excukdzjudslbqmkysrc`.**

  **That is real code against the real production data store, and the consequences are real.** The throwaway account lands in **production `auth.users`**, its consent row lands in **production `public.user_consents`**, and the `handle_new_user()` trigger that writes them is the live one. Treat every artefact of this test as production data.

  **Done when**: a throwaway account is created through the **preview deployment's own `/signup` page** — not through the API, not through the Supabase dashboard, because the whole point is to exercise the surface SC-006 is claimed for — with the acknowledgement checked, and **all** of the following hold: the account is created; **exactly one** `user_consents` row exists for it, with `consent_key = 'terms_privacy'` and a `document_version` that is a **registry member**; the app-shell gate does **not** block that user; and the server log shows **no** `[consent-gate] FAIL-OPEN` line for those requests. Separately confirm a signup with the box **unchecked** is refused with a reason and creates **no account**.

  **If ANY of these fails, ABORT: do not proceed to T139, do not merge.** Restore from the T133 backup or run the T134 rollback (after `pg_dump`ing `user_consents`), and **stop and report**.

  **Done when additionally — the cleanup is mandatory and evidenced.** The throwaway account **and** its consent row are deleted from production via a privileged path, and **the deletion is recorded with its actual output** — the `DELETE` row counts and a follow-up `SELECT` returning zero for both `auth.users` and `public.user_consents` — pasted into the merge PR body. Note that `user_consents.user_id` is `REFERENCES auth.users(id) ON DELETE CASCADE` (`…_user_consents.sql:25`), so removing the auth user takes the consent row with it; **verify that rather than assuming it**, since the immutability trigger covers UPDATE only and there is no DELETE policy or grant for `authenticated` — this deletion is a privileged operation by design. Dependencies: T137.

### Closures — issue and BACKLOG entry in the same change (Principle VIII)

- [ ] T139 [P] [P8] Close **#75** and mark its `docs/BACKLOG.md` entry resolved **in the same change**. **Done when**: the BACKLOG entry carries the resolution date and the merging PR/commit, **and** GitHub issue #75 is closed with a comment naming the same; neither is done without the other (Principle VIII; on conflict, BACKLOG wins). #75 is the ⛔ pre-production data-processing blocker that closes when `/terms`, `/privacy` **and** the signup consent gate all ship — **P2 + P3 + P4**, all of which have. No `claude.ai` URL in the comment. Dependencies: T138.

- [ ] T140 [P] [P8] Close **#157** and mark its `docs/BACKLOG.md` entry resolved **in the same change**. **Done when**: the BACKLOG entry carries the resolution date and the merging PR/commit, **and** GitHub issue #157 is closed with a comment naming the same; neither is done without the other (Principle VIII; on conflict, BACKLOG wins); and no `claude.ai` URL appears in the comment. Dependencies: T138.

- [ ] T141 [P] [P8] Close **#158** and mark its `docs/BACKLOG.md` entry (`docs/BACKLOG.md:2006–2045`) resolved **in the same change**. **Done when**: the BACKLOG entry carries the resolution date and the merging PR/commit, **and** GitHub issue #158 is closed with a comment naming the same, neither without the other (Principle VIII), with no `claude.ai` URL in the comment; **and additionally** — the condition specific to this issue — the four `README.md` lines T035 fixed in P3 are re-read against `plan.md` §0.3's acceptance conditions before closing — in particular that **line 11 was SPLIT into two sentences and not appended to**, so the permanent Principle I invariant ("never raw video, never chat content") stands **unqualified in its own sentence, outside the marked one**. **P3 shipped the copy fix and deliberately left #158 open until now** (T035's closing instruction). If the split was done as an append, **do not close** — fix it first. Dependencies: T138.

- [X] T142 [P] [P8] Log the **TTFB follow-up** as a BACKLOG candidate — **logged, not built** (R11, `research.md` §11). **Done when**: `docs/BACKLOG.md` carries a new entry scoping the follow-up to **moving ONLY the signed-in redirect into `proxy.ts`** — explicitly **not** the `?code=` forward, whose `redirectTo` helper clears `url.search` and would eat the code; the entry records that `/` stays `force-dynamic` today, that this is near-free for anonymous visitors (no session cookie ⇒ `getUser()` short-circuits without a network round-trip), and that it is a scoped follow-up **only if production TTFB disagrees**; and its GitHub issue is opened in the same change with `(#NN)` recorded on the entry (project CLAUDE.md: never one without the other). **No code is written for it here.** Dependencies: T138.

### Documentation

- [X] T143 [P] [P8] Add the `docs/DECISIONS.md` entries for this feature. **Done when**: the append-only log records the decisions this feature made and closed — **Order A** (legal first, and why); **version identity over timestamp comparison** for re-consent; **the version registry lives in the repo, not in a table**; **the app-shell gate renders in place and fails OPEN while the camera gate fails CLOSED**, and why the two directions differ; **the migration stays one file**; **`decision` admits only `'granted'`**, and that **declining writes nothing, deletes nothing, and is not withdrawal** (feature **018** owns withdrawal); and the **SC-006 residual (R8)** stated honestly — SC-006 holds for 100% of accounts created through the product's own signup surface and **does not hold against a caller bypassing that surface**, whose root cause is **#62**, which **stays open**.

  **Done when additionally — the open-signup posture is recorded as a DECISION, not left as an omission.** The entry must state, in its own words and unmistakably: that the demo deployment at **serenify.tech ships KNOWINGLY with open self-serve signup**; that **#62 stays open DELIBERATELY** until adoption, as an accepted posture for the demo window rather than an oversight or a backlog item that slipped; and that **R8's SC-006 bypass is therefore LIVE and ACCEPTED for that window**, with the blast radius R8 already states — **one forged consent row for the forger's own account, RLS-scoped to `auth.uid()`, no cross-user write, no privilege escalation, and nothing else in the product unlocked by it.** The reason this must be written down: **someone reading R8 later must not conclude this was missed.** R8 describes the bypass as a residual whose root cause "must close before real user data is processed" — a reader who then finds `/signup` open on a live site will reasonably assume the gate was forgotten. It was not; it was weighed and accepted for a demo, and the decision log is where that distinction survives.

  **Done when additionally — the R7 residual is recorded as NARROWER than `plan.md` §15 R7 describes, with the two cases separated.** R7 reads: *"a malformed signup consent version could be written… shape-constrained by two DB CHECKs; a non-registry value never satisfies `satisfiesConsent()`."* That blurs two outcomes which are not the same, established by reading the shipped trigger:
  - **Well-formed but non-registry** (e.g. `terms_privacy@2099-01-01.1`) — **is** written, and is inert exactly as R7 says: `satisfiesConsent` does a membership check (`evaluate.ts:74–77`, `findIndex` → `-1`), so it never satisfies the gate, and the §6.3 reconciliation query lists it.
  - **Malformed** (fails the format regex at `…_user_consents.sql:28`, or JSON `null` against the `NOT NULL` at `:27`) — is **never written at all.** It raises **`23514`** / **`23502`**; `on_auth_user_created` is `AFTER INSERT ON auth.users FOR EACH ROW` (`20260517000030_profile_trigger.sql:27–29`), so the statement aborts and the `auth.users` row is **rolled back — that signup fails outright**. **`ON CONFLICT DO NOTHING` (`:111`) does not swallow it**: it covers unique and exclusion violations only.

  **Do NOT edit `plan.md` to match.** R7 **overstates** a risk rather than understating one, and the plan is not amended mid-build. The DECISIONS entry is where the correction lives. Dependencies: T138.

- [X] T144 [P] [P8] Add the `docs/CHANGELOG.md` entry. **Done when**: it records the public-facing shape of the release — the landing page at `/`, `/terms` and `/privacy`, the public navbar and footer, the two-colour wordmark (**a visible change to three existing surfaces**, R10), the two consent gates, and the app-shell re-consent gate with its kill switch — in the repo's existing changelog voice. Dependencies: T138.

- [ ] T145 [P] [P8] Update `docs/PROGRESS.md`. **Done when**: feature 013 is recorded complete with its eight phases and their PR numbers (#168, #169, #170 for P1–P3, plus P4–P8's), and the three closed issues are noted. Dependencies: T139, T140, T141.

### Merge

- [ ] T146 [P8] Run a **final code-review agent over the whole feature branch** — the accumulated diff of `013-public-surface-and-legal` against `main` — reviewing against **the feature's task acceptance criteria (T001–T145)** and **constitution v1.13.0**. **Done when**: the agent has specifically confirmed the cross-phase invariants no single-phase review could see — that **no `localStorage`/`sessionStorage` was introduced anywhere in this feature** (FR-051) and that the pre-existing occurrences outside it were **not** "fixed"; that the **four approved §10.3 strings** are present character-for-character and the mock's **three forbidden lines** appear nowhere; that the two gates' **opposite fail directions** are both intact; that terminology is correct feature-wide (**calibration** / **monitoring session** / **weekly work-environment check-in**, never bare "check-in"); that **no `Claude-Session:` trailer and no `claude.ai` URL** exists in any commit message on the branch — **this matters most here, because squash-merge concatenates the branch's commit messages by default**; and that the constitution was **not amended** by this feature. Findings go in the merge PR body and are fixed before T148. Dependencies: T143, T144, T145, T142.

- [ ] T147 [P8] Full-feature verification before merge. **Done when**: `npm run -w apps/web lint typecheck test`, `uv run --directory apps/api pytest`, `npm run -w apps/web test:layout` and `npm run -w apps/web test:e2e` are all green on the feature branch head with output recorded **The verification runs AFTER the final commit of the phase, and the report states the commit SHA it ran against — a verification result without a SHA is not a verification result** (added 2026-07-26, after a P4 report cited a `typecheck` run that predated the file which broke it; the review agent caught the failure, the reporting discipline did not).; `supabase db reset` applies cleanly locally; and `smoke-tests.md` shows every ST recorded. Dependencies: T146, T132.

- [ ] T148 [P8] Merge `013-public-surface-and-legal` into `main` — **one merge, at the end**. **Done when**: the PR into `main` is opened, all three CI checks are green, and it is **squash-merged** (`main` enforces linear history — merge commits are rejected; only Mohamed's identity can land it, agent pushes to `main` are rejected by GH006 and that is expected); **the squash-merge message is inspected and any `Claude-Session:` trailer or `claude.ai` URL is stripped before merging** — squash concatenates the branch's commit messages by default and this repository is **public**; the PR body carries the smoke-test results and the deploy record; and after merge, **#62 is confirmed still open and untouched**, and **#86** and **#155** are confirmed still open (referenced, not owned). Dependencies: T147.

**Checkpoint**: feature 013 is complete and on `main`. The public front door, the legal surface, and both consent gates are live; consent is a history; and the one fact no artefact could prove has been confirmed by a person.

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
      Phase 3: P3 Legal + public shell        ✅ MERGED (#170)
              (T020–T037)
              │
  ┌───────────┴───────────┐
  ▼                       ▼
P4 Gates                P6 Landing              ← these two run in PARALLEL
(T038–T062)             (T078–T113)
  │                       │
  ▼                       ▼
P5 Shell gate          P7 Team section
(T063–T077, ALONE)        (T114–T130)
  │                       │
  └───────────┬───────────┘
              ▼
      P8 Wrap  (T131–T148)
              │
              ▼
           main  ← ONE merge, T148
```

- **P1 ∥ P2.** They share no file, no module, and no test. Either may merge first.
- **P3 needs P1** for `<Wordmark>` (T025/T027) and **P2** for the registry (T023/T024). Under
  Order A both precede it anyway (`quickstart.md` "Build sequence").
- **P4 ∥ P6.** Both depend only on P3 (P4 also on P2, which precedes it) and share no source
  file. P4 touches `(auth)/signup/*`, `components/consent/*`, `lib/consent/{copy,read}.ts`, the
  three capture routes and `baseline-section.tsx`. P6 touches `app/page.tsx` →
  `app/(public)/page.tsx`, `lib/{bands,landing,routing}/*`, `components/landing/*`, `bloom.tsx`
  and `session-trend-geometry.ts`.
- **P5 is AFTER P4, not parallel with it.** It consumes two modules P4 creates —
  `components/consent/actions.ts` (T047 → T065) and `lib/consent/read.ts` (T046 → T066) —
  and `plan.md` §14.1 sequences it that way deliberately: **"P5 alone and after P4."**
  **P4 owns both files; P5 consumes them.**
- **P5 ships ALONE.** Running after P4 and shipping alone are different claims and both hold:
  nothing else may enter the P5 PR, or `git revert` stops being a clean one-command rollback
  (R2).
- **P7 needs P6** — the team section renders inside the landing page P6 creates, and it extends
  `lib/landing/copy.ts`, which P6 authors.
- **P8 needs everything**, and merges to `main` exactly once (T148).

### Within-phase order

- **P1**: T002 → {T003, T004, T005, T006, T007} → {T008, T009} → T010.
- **P2**: {T011, T012} → {T013, T014, T016, T017, T018} → T015 → T019.
- **P3**: T020 → T021 → T022 → T023 → T024 → {T025, T026} → T027 → T028 → {T029, T030} → {T031, T032, T033, T034, T035} → T036 → T037.
- **P4**: T038 → T039 → T040 → {T041, T046} → T042 → {T043, T044} → T045 → T047 → T048 → {T049, T050, T051, T052} → {T053, T054, T055, T056, T057, T058, T059} → T060 → T061 → T062.
- **P5**: T063 → T064 → T065 → T066 → T067 → {T068, T069, T070, T071, T072, T073} → T074 → T075 → T076 → T077.
- **P6**: {T078, T079} → {T080, T082, T084} → {T081, T083, T085} → T086 → T087 → T088 → T089 → T090 → T091 → T092 → T093 → T094 → T095 → T096 → T097 → T098 → T099 → {T100, T101, T102, T103} → T104 → {T105, T106, T108, T109} → T107 → T110 → T111 → T112 → T113.
- **P7**: {T114, T115} → T116 → T117 → T118 → {T119, T120} → T121 → T122 → {T123, T124} → T125 → {T126, T127} → T128 → T129 → T130.
- **P8**: T131 → T132 → T133 → T134 → T135 → T136 → T137 → **T138 (ABORT POINT)** → {T139, T140, T141, T142, T143, T144} → T145 → T146 → T147 → T148.

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

**Phase level, P4–P7** — **two tracks, not three**: P4 → P5 on one, P6 → P7 on the other, run
simultaneously. P5 cannot start before P4 lands `components/consent/actions.ts` (T047) and
`lib/consent/read.ts` (T046), and `plan.md` §14.1 sequences it after P4 anyway.

**P4**, after T048 — the three capture routes plus the route back are fully disjoint:

```text
T049  app/(onboarding)/onboarding/page.tsx
T050  app/(authed)/app/calibrate/page.tsx
T051  app/(authed)/app/monitor/page.tsx
T052  components/anchor/baseline-section.tsx + app/(authed)/app/account/page.tsx
```

then the whole test block, all seven in parallel:

```text
T053  tests/unit/lib/auth/signup-consent-gate.test.ts
T054  tests/unit/lib/consent/fail-closed.test.ts
T055  tests/unit/components/consent/decline-writes-nothing.test.tsx
T056  tests/unit/components/consent/camera-consent-gate.test.tsx
T057  tests/unit/components/consent/questionnaire-unaffected.test.tsx
T058  tests/unit/landing/forbidden-claims.test.ts        (extend)
T059  tests/unit/lib/legal/no-web-storage.test.ts        (widen)
```

**P5**, after T067 — six test files, no shared source:

```text
T068  tests/unit/lib/env/consent-entry-gate.test.ts
T069  tests/unit/components/consent/terms-reconsent-screen.test.tsx
T070  tests/unit/app/authed-layout-consent-gate.test.tsx
T071  tests/unit/app/authed-layout-fail-open.test.tsx
T072  tests/unit/app/authed-layout-kill-switch.test.tsx
T073  tests/unit/lib/legal/no-web-storage.test.ts        (widen)
```

**P6**, three independent tracks that only converge at T104. The extraction track (T080–T083)
and the routing track (T084–T087) touch nothing the story track touches, so they can be
reviewed and even landed as separate commits early:

```text
extraction   T080 lib/bands.ts → T081 session-trend-geometry.ts
             T082 bloom.tsx    → T083 bloom.test.tsx
routing      T084 lib/routing/resolve-root-route.ts → T085 its test → T086 the move → T087 e2e
story        T088 mock read → T089/T090 copy → T091/T092 script → T093…T099 the card
sections     T100 hero · T101 never-cards · T102 how-it-works · T103 status   ← four in parallel
```

then, after T104:

```text
T105  tests/unit/landing/forbidden-claims.test.ts        (extend)
T106  tests/unit/components/landing/story-card.test.tsx
T108  tests/unit/components/landing/landing-a11y.test.tsx
T109  tests/unit/lib/legal/no-web-storage.test.ts        (widen)
```

(T107, the layout spec, needs a running dev server and is not parallel with the walk in T110.)

**P7**, after T122:

```text
T123  the eight external links
T124  caption + supervisor credits
```

and after T125: `T126` (a11y + links) ∥ `T127` (photo-blocked resilience). `T119` (frozen
paths) and `T120` (copy) are parallel immediately after T118.

**P8**, after the T138 abort point clears — six closure and documentation tasks, all disjoint:

```text
T139  #75  + docs/BACKLOG.md
T140  #157 + docs/BACKLOG.md
T141  #158 + docs/BACKLOG.md
T142  TTFB follow-up → docs/BACKLOG.md + new issue
T143  docs/DECISIONS.md
T144  docs/CHANGELOG.md
```

Nothing before T138 is parallel. The deploy is a sequence with an abort point, deliberately.

---

## Implementation strategy

**Order A is decided** (`plan.md` §14.2) — legal first, hero later. Do not re-litigate it.

1. **T001** — confirm the checks run. One command.
2. **P1 and P2 in parallel.** P1 is mechanical and near-zero risk; P2 is pure code plus SQL with
   no UI, so its exhaustive evaluator suite and its database gate land before any surface
   depends on them. Nothing can be built on the consent model until the model is proven.
3. **P3.** The legally binding half is written and reviewed while schedule pressure is lowest —
   which is the entire point of Order A, because FR-050 exists to stop legal text being written
   in a hurry. ✅ **P1–P3 are merged** (#168, #169, #170).
4. **Two tracks in parallel: P4 → P5, and P6 → P7. Start P6 on day one.** Order A's one accepted
   cost is that the hero story card, the largest and least predictable item in the feature, is
   discovered last, against the deadline (`plan.md` §14.2). Running the P6 track concurrently
   with the P4 track recovers most of that without re-opening the decision: the legal half is
   already written and reviewed, so nothing is being rushed, and P6's 36 tasks get the calendar
   they need. **If P6 overruns, it is P6 that gets cut** — the sections in T100–T103 are
   separable and the story card is not. #75's deploy blocker closes when P4 merges, independent
   of P6.
5. **P5 follows P4 on the same track, and ships alone.** It consumes two modules P4 creates
   (T046, T047), so it cannot start earlier, and `plan.md` §14.1 sequences it after P4 on
   purpose. Its PR contains the gate, the screen, the env flag and their tests, and nothing
   else. That constraint is the rollback mechanism, not process theatre (R2).
6. **P7 after P6.** It renders inside P6's page and extends P6's copy module.
7. **P8 last, and its deploy is a sequence, not a batch.** T133's backup decision is Mohamed's
   and blocks everything after it. **T138 is a real abort point** — if the first throwaway
   signup through the real surface does not produce exactly one valid consent row with no
   fail-open log line, the answer is to roll back, not to investigate on a live database.
8. **One merge to `main`, at T148**, with the squash message inspected for `Claude-Session:`
   trailers first — squash concatenates the branch's commit messages, and this repository is
   public.

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

**#62 stays open and untouched** (R8, `plan.md` §3 Principle VIII). It is a ⛔ pre-production
deploy blocker and the root cause of the SC-006 bypass, and it is out of scope for this feature.
Any task that appears to require touching it is a **stop and report**, not a scope decision.

**#86** (the reading-retention purge job) and **#155** (`--color-on-accent` / `--color-scrim`
unregistered in Principle V) are **referenced, not owned** — named where they are relevant, and
neither closed nor built here.
