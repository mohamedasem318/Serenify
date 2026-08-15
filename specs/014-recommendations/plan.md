# Implementation Plan: Recommendations — "Things that might help"

**Branch**: `014-recommendations` | **Date**: 2026-08-14 | **Spec**: [spec.md](spec.md)

**Input**: Feature specification from `specs/014-recommendations/spec.md` (all
clarifications resolved 2026-08-14). Supporting artifacts: [research.md](research.md),
[data-model.md](data-model.md), [quickstart.md](quickstart.md),
[contracts/recommendation-storage-rls.md](contracts/recommendation-storage-rls.md),
[contracts/reflective-copy.md](contracts/reflective-copy.md),
[contracts/confirmatory-resolution.md](contracts/confirmatory-resolution.md),
[contracts/selection-engine.md](contracts/selection-engine.md).
Behaviour/states reference: the approved mock
`docs/mockups/serenify-014-things-that-might-help-mock.html` (gitignored; grep with
`--no-ignore`; item copy in it is placeholder).

## Summary

Fill the shipped-but-empty "Things that might help" card
(`components/home/things-that-might-help-card.tsx`) with a deterministic selection engine
over a 15-item in-repo reviewed library; opening an item is the engagement record, one
outcome question follows, swaps are a distinct signal. Feature 012's "Yes, that's me" path
resolves to the recommendation (in-session `ConfirmedPickCard` + prominent home state 4)
instead of the Ren handoff. Reflective copy in states 2/9 is generated through the existing
011 LLM path with a validated deterministic fallback. One new owner-only table
(`recommendation_picks`); Privacy Policy updated in the same PR.

## Technical Context

**Language/Version**: TypeScript strict (Next.js 16 App Router) · Python 3.12 (FastAPI)
**Primary Dependencies**: existing only — `@supabase/ssr` browser client (owner-RLS reads/
writes), `packages/llm-client` (Groq gpt-oss-120b primary / LM Studio fallback), shadcn/ui
+ Tailwind v4, Lucide. **No new dependency, no new provider.**
**Storage**: Supabase Postgres — one new migration (`recommendation_picks`); library and
prompts are in-repo files. **Testing**: Vitest + RTL, Playwright e2e, pytest
(apps/api + packages/llm-client), migration-audit static gates + live RLS probe.
**Target Platform**: Vercel (web) + Azure Container Apps (api); works with api down
(fallback copy) — the card's core loop is web+DB only.
**Project Type**: web app feature inside the existing monorepo.
**Performance Goals**: card renders from the existing home-page reads without new blocking
requests; generation budget ≈ 3.5 s then fallback; selection is O(library).
**Constraints**: no error state on the surface (FR-030); no interruption (FR-013); day
semantics = today-card local day; 360 px minimum viewport.
**Scale/Scope**: single-user surfaces; 15-item library; ~10 new modules + 1 migration +
1 endpoint. No open NEEDS CLARIFICATION items.

## Constitution Check (v1.17.2)

| Principle | Compliance |
|---|---|
| **I — Privacy by Architecture** | New data class is owner-private by structure: FORCE RLS, owner-only policies, no manager/admin/team-lead/aggregate/service-role path, column-scoped UPDATE grants (contracts/recommendation-storage-rls.md). Generator receives precomputed facts only — no raw readings, no chat content (FR-023). No manager-facing surface is touched. **Privacy-review note (gate 6): Principle I invariants hold — nothing in this feature reaches any manager-facing layer, and recommendation records join chat content in the never-visible class (FR-025).** |
| **II — ML evaluation** | Not touched — no model, no inference change. The engine is rules, not a model (FR-002). |
| **III — Modality isolation** | Not touched. |
| **IV — LLM Provider Abstraction** | All generation through `packages/llm-client` behind the existing `LLMProvider`/`ProviderRegistry`; new prompt is a versioned file registered in `PromptId`; zero vendor SDK imports in app code; provider swap stays config-only. |
| **V — Calm-First Design** | Card implements the approved Graphite mock: existing tokens only, amber = the only prominence treatment (state 4), no crimson on this surface, no exclamation marks, outcome acknowledgement identical in both directions ("Noted."), no grading. Copy validator enforces the voice rules on generated text (FR-028). |
| **VI — Responsive & Accessible** | Mock is drawn at 390 px and specifies the 360 px wrap; 44 px targets; both modes designed in tandem (mock carries both palettes); `prefers-reduced-motion` collapses the result-ring animation; D-6 dwell states are non-interactive so no focus traps. |
| **VII — Testing** | Vitest (engine, states, validator, hook wiring), pytest (endpoint, prompt contract), Playwright e2e (SC-005 loop), RLS static gate + live probe, untouched 012 suites as the SC-006 regression net. `smoke-tests.md` follows at tasks stage. |
| **VIII — Spec-Driven** | This plan; DECISIONS/PROGRESS/CHANGELOG/BACKLOG entries with the PR; **Privacy Policy + ToS reviewed and updated in the same PR** (§Legal). No constitution amendment needed or made. |
| **IX — Secrets** | **One new secret** (Amendment 3, 2026-08-16, reversing this row's original "no new secret / existing `GROQ_API_KEY`" position): `GROQ_API_KEY_REFLECTIVE_COPY` — a second credential to the SAME provider, so reflective-copy generation cannot consume Ren's rate limits. Ren's path, key, and limits unchanged. The secret is placed by Mohamed at deploy time; the code ships tolerating its absence (request-time provider error → non-200 → the deterministic fallback renders; the card never breaks and the code never resolves Ren's key). |
| **X — Dataset stewardship** | Not touched. |

**Gate result**: PASS — no violations, Complexity Tracking not needed.

## Project Structure

### Documentation (this feature)

```text
specs/014-recommendations/
├── plan.md              # this file
├── research.md          # R-1…R-10 plan decisions
├── data-model.md        # recommendation_picks + in-repo shapes
├── quickstart.md
├── contracts/
│   ├── recommendation-storage-rls.md
│   ├── reflective-copy.md
│   ├── confirmatory-resolution.md
│   └── selection-engine.md
└── tasks.md             # /speckit-tasks output (NOT created by /speckit-plan)
```

### Source code (new ● / modified ○)

```text
supabase/migrations/
● <ts>_recommendation_picks.sql          # table + CHECKs + partial unique + RLS + grants

apps/web/lib/recommendations/
● library.ts                             # 15 reviewed items, 5 fixed categories (R-1)
● engine.ts                              # deterministic selection (contracts/selection-engine.md)
● episode.ts                             # episode/budget/non-repeat reducer + day filter
● preference-source.ts                   # neutral v1 seam for 015 (R-8)
● reflective-copy-validation.ts          # SC-004 validator (pure)
● reflective-copy-cache.ts               # sessionStorage fingerprint cache (FR-022)
apps/web/lib/api/
● recommendations-client.ts              # typed pick writes (Supabase) + reflective-copy fetch (api)
apps/web/components/recommendations/
● pick-item.tsx                          # shared item block: tile/title/dur/why/steps (mock)
● recommendation-card-states.tsx         # the ten states' presentational shells
● confirmed-pick-card.tsx                # in-session Notification-slot surface (R-6)
apps/web/components/home/
○ things-that-might-help-card.tsx        # placeholder → the stateful card (attachment point)
apps/web/components/monitor/
○ monitoring-session.tsx                 # resolveToRecommendation wiring + ConfirmedPickCard mount
apps/web/lib/questionnaire/
○ confirmatory-trigger.ts                # dep swap ONLY (reducers untouched — contracts/confirmatory-resolution.md)
apps/web/lib/legal/
○ copy.ts                                # Privacy Policy additions (§Legal)
apps/web/lib/consent/
○ registry.ts                            # ONLY after Mohamed's materiality decision (§Legal)

apps/api/app/routers/
● recommendations.py                     # POST /recommendations/reflective-copy
apps/api/app/services/
● reflective_copy.py                     # facts→prompt→validate-shape (contracts/reflective-copy.md)
● chat_pick_context.py                   # current_pick_line (R-7, chat_video_context pattern)
○ chat_orchestrator.py                   # pass current_pick_line into render_prompt("ren", …)

packages/llm-client/
● prompts/reflective_copy.txt            # versioned prompt file
○ src/llm_client/prompts.py              # PromptId + PROMPT_IDS registration
○ prompts/ren.txt                        # {current_pick_line} fenced block beside {recent_read_line}
```

**Structure Decision**: everything web-side lives under new `lib/recommendations/` +
`components/recommendations/` directories (clean seam for 015); the only edits to shipped
012 files are the host wiring and the trigger dep swap.

## Architecture & component reuse

- **Data flow**: home card reads today's picks + today's bands through the existing
  owner-RLS browser reads (`monitoring-reads.ts` pattern; day = `localDayWindow`). The
  card is a client component like `todays-checkin-card.tsx`, with injectable deps for
  tests. FR-019's day reset is query-time filtering by `local_day` — nothing stored to
  clear (data-model §3).
- **State machine**: one pure reducer (`episode.ts`) drives all ten states from
  `(today's picks, today's bands, in-flight UI events)`; the ten states are exactly the
  approved mock's; no eleventh state, no error state (SC-002, FR-030).
- **Reuse, not reinvention**: `Card`/`CardTitle` shells (existing home cards),
  `QuestionnaireResultIcon` + its dwell timing for states 7/8 (D-6 precedent, FR-029),
  the `Notification` primitive for the in-session surface, `RenAvatar` for the Ren row
  (locked mark, foggy — Amendment 18/19 permits it only on Ren entry points), `BAND_LABEL`
  for any band vocabulary. The pick item block is one shared component rendered by both
  the home card and `ConfirmedPickCard` — "same pick, same words" is by construction.
- **Failed writes** (FR-030): outcome UPDATE retries once then degrades silently; nothing
  on the surface ever renders as an error. **Swap ordering is RULED (Mohamed, 2026-08-15,
  "Ruling B")** and is forced by the schema, not chosen: `rp_one_active_per_user_day` is a
  partial unique index and the two writes are separate PostgREST requests with no
  transaction, so insert-first would collide with the still-active outgoing row. Therefore
  — (1) stamp the outgoing pick's `swapped_away_at` **first**, then INSERT the
  replacement; (2) if the INSERT fails, **re-run the engine once** to refresh the card,
  which now sees the declined pick and produces a new one (indistinguishable from a
  successful swap, since swap has no ceremony); (3) if that also fails, keep the previous
  pick on screen and stop — no retry loop, no error surface; (4) the stamp is **never
  reversed**; (5) **a failed swap does NOT consume a budget slot** (Amendment 2026-08-16,
  reversing the position accepted 2026-08-15 — a person must not lose a suggestion
  because a write failed on our side; the stamp stands as signal and non-repeat
  exclusion, but budget consumption counts replacement rows that actually landed, so it
  can no longer be derived from stamp count alone). Full text:
  [contracts/recommendation-storage-rls.md](contracts/recommendation-storage-rls.md)
  §Swap write ordering.

## The 012 coordinator change (highest-regression area)

Full contract: [contracts/confirmatory-resolution.md](contracts/confirmatory-resolution.md).
In one paragraph: the pure reducers and their #127/#130/#132/#134 pinned tests are not
edited; `onConfirm` keeps persisting the answer through `finalize` (budget semantics D-8/
D-11 intact, dwell machinery D-6 intact, false-alarm suppression intact) and then invokes a
new `resolveToRecommendation` dep instead of `openRen("confirmatory_yes")`; the monitor
host attaches/creates the pick row and mounts `ConfirmedPickCard` in the same
`Notification` slot the prompt occupied — same footprint as the existing chat-pill /
confirmatory-prompt precedent, so the brief's stop-condition ("materially larger surface")
is not tripped. The seam module keeps parsing `confirmatory_yes` tolerantly but the monitor
no longer produces it; chat renders no recommendation cards. FR-014: a new confirmed
detection removes a pending outcome prompt without writing.

## Generation with fallback (states 2 and 9)

Full contract: [contracts/reflective-copy.md](contracts/reflective-copy.md). The
deterministic strings (authored with the library, reviewed the same way) are the source of
truth; the generator — the existing 011 client via one new apps/api endpoint and one new
versioned prompt — receives only the precomputed facts bundle.

**Second credential (Amendment 3, 2026-08-16)**: reflective-copy generation calls the same
provider (Groq — FR-024 stands, no new provider) through a **separate credential from
Ren's**, `GROQ_API_KEY_REFLECTIVE_COPY`, so copy generation does not consume Ren's rate
limits. Verified shape (read-only recon of the 011 path): `load_config()` reads
`GROQ_API_KEY` from the environment into a frozen `ProviderEndpoint`, and apps/api's
`get_llm_client()` is an `@lru_cache` singleton — so the change is purely **additive in
`apps/api/app/services/llm_client.py`**: a second cached accessor
(`get_reflective_copy_llm_client()`) that rebuilds the config with
`primary.api_key = GROQ_API_KEY_REFLECTIVE_COPY or None` and **no fallback provider** for
this path. Zero edits to `packages/llm-client`; Ren's accessor, construction, retries, and
limits are untouched. The resolver must never read `GROQ_API_KEY` — absent or invalid, the
provider raises at request time, the endpoint returns non-200, and the client renders the
deterministic string (FR-030). Configuration sites: `apps/api/.env` (local),
`apps/api/.env.example` (documented block), and the `serenify-api` Container App
env/secret set by CLI (no IaC exists in-repo). CI needs nothing — tests must not require a
real key.

The generator receives only the precomputed facts bundle (counts, formatted times,
band labels, tried-item title, the fallback string itself) and may only re-phrase it. A
pure client-side validator rejects any output containing a number, time-token, or band
word not present in the facts (plus voice-rule violations), falling back deterministically;
provider slow/down/invalid → fallback within the ~3.5 s budget; the result is cached in
sessionStorage keyed by a facts fingerprint so an unchanged state never regenerates.
**First paint**: the reflective line paints once per mounted state and never flips under
the reader — cache hit paints immediately; a cache miss shows a skeleton line for at most
**800 ms** (the sibling today card paints in one local round trip with no skeleton at
all, so the wait must stay a blink on that same clock; ~4× tighter than the generation
budget); on expiry the deterministic string paints and stands, and a late generated
result goes to the cache only, serving the next first paint, never the one on screen
(contracts/reflective-copy.md §First paint).
Ren's pick-awareness (out-of-scope-adjacent, FR: awareness only) reuses the
`recent_read_line` mechanism with a new `{current_pick_line}` variable.

## Schema, RLS, and the seam

Full shape: [data-model.md](data-model.md) +
[contracts/recommendation-storage-rls.md](contracts/recommendation-storage-rls.md). One
table, `recommendation_picks`, in the 011 owner-only posture: ENABLE+FORCE RLS, owner
SELECT/INSERT/UPDATE, **no** DELETE/manager/admin/service-role policy; column-scoped
UPDATE grants make identity columns immutable, and the migration carries an explicit
`REVOKE ALL … FROM service_role`.

**Standing invariant — no admin-key path, ever.** 014's table is unreachable by
`service_role`. Every read and every write goes through the end user's own authenticated
session under RLS (forwarded JWT + publishable anon key). No future task, fixture,
endpoint, script, or migration may introduce an admin-key or service-key path to this
data — not for convenience, not for a test, not for an admin screen. Widening it is a
spec change, not an implementation-time judgement call.

This replaces an earlier note in this section claiming service_role "holds no SELECT or
UPDATE (no DML at all) on any public table in this project", so nothing needed closing.
That was a local observation over-generalised to the deploy target. Read live on
2026-08-15 against the linked cloud project: `pg_default_acl` there grants `service_role`
full `arwdDxtm` on new public tables, every existing public table's `relacl` already
carries it, and `rolbypassrls = true` for the role. **BYPASSRLS defeats RLS but not
grants** — so on cloud the owner-only policies constrain that role not at all, and the
explicit revoke is the only boundary that holds. It ships in
`20260815090000_recommendation_picks.sql` and is pinned by
`test_service_role_is_explicitly_revoked`. Reasoning and the deferred repo-wide sweep:
`docs/DECISIONS.md` 2026-08-15.

Dismissal
(`swapped_away_at`) and "didn't help" (`outcome`) are separate columns and can never
merge. `category` is denormalised onto each row so 015 can read category-level signals
without joining the in-repo library; selection is category-first
(contracts/selection-engine.md); the `PreferenceSource` interface is the 015 seam — the
source swaps, the engine does not. Budget/episode/non-repeat are browser reducers with a
partial-unique DB backstop for the one-active-pick invariant (R-3). Retention: ninety
days as policy-not-mechanism (FR-027) — no purge job exists or is promised.

## UI design contract (Hallmark)

Produced under the `hallmark` skill. Pre-flight: this is a **system-managed project** —
constitution Principle V + `apps/web/app/globals.css` are the locked design system, and
the approved mock itself carries a Hallmark component stamp
(`component: recommendation card · genre: inherited · states: 8-state check · pre-emit
critique P5 H5 E5 S5 R4 V4`). Scope is **component**, so macrostructure/theme rotation is
skipped by rule; no `frontend-design`, no `design:*` plugins. The binding contract:

- Implement the mock **as approved**: tokens by name only (no new colours; derived
  surfaces are `color-mix` of locked tokens as the mock defines), Outfit for item titles,
  Inter elsewhere, radius/shadow per existing card language.
- The 8-state discipline carries into code: every control ships
  default/hover/focus-visible/active/disabled/loading states as the mock's control-state
  panel specifies; **error and success are deliberately absent from controls** — success
  is the result ring (states 7/8), error does not exist on this surface (FR-030). This is
  a documented deviation-by-design, not an omission.
- Prominence (state 4) is exactly the mock's five small moves (amber rail, tint wash,
  warm tile, 17→19 px title, meadow-filled primary) — never a new treatment.
- The filled meadow CTA appears only in state 4; elsewhere outlined (the check-in card
  above owns the page's filled primary). The Ren row is foggy with the locked ≥24 px
  mark. No band chip on the card (the band is stated once, above).
- `ConfirmedPickCard` inherits the `Notification` surface's existing geometry and modes;
  it introduces no new positioning or panel vocabulary.
- Motion: only the mock's `qri-pop`/`qri-draw` plus the shipped fade class — which is
  `qri-fadeup` in `globals.css`; the mock's local CSS calls it `qri-fade`, and the
  "reused from `QuestionnaireResultIcon`" clause governs over the mock's local name
  (correction 2026-08-16, found at T012 implementation) — and the state-10 fade; all
  under `prefers-reduced-motion`; swap has deliberately **no** ceremony.

## Pause from the in-session card (scope addition — Mohamed, 2026-08-15)

Several library items ask the person to leave the desk. Today the only in-session choices
are ignore it or end the session, so acting on the suggestion costs them the session.
`ConfirmedPickCard` therefore gains a pause action.

**This adds a second entry point to shipped machinery, not new machinery.** Verified in
the code: `handlePause` / `handleResume` in
`components/monitor/monitoring-session.tsx` stop and reacquire the camera and PATCH
`status='paused'` / `'active'` on the **same** session row; a neutral `PausedStage`
already renders; **no migration is needed** — the `status` CHECK already accepts
`'paused'`.

Rules:

- **Not per-item.** No logic decides which items "need" a pause. Every card exposes it.
- **One control, not two.** The single control becomes a **resume** action while the
  session is paused. There is never a second competing pause affordance. The card renders
  outside the op-surface switch, so it stays visible on the paused surface beside the
  existing Resume/End controls.
- **Pausing is not an answer to the confirmatory prompt** — no budget spend, no confirm,
  no dismiss, no false-alarm suppression. This is structurally true rather than carefully
  maintained: the 012 budget is only ever spent via `finalize`, called from the three
  answer handlers, and pause never calls `finalize`. The confirmatory machinery and its
  pinned suites are untouched by pausing.
- **Selection stays unaware of session state.** The engine has no input for "is a session
  live" and none may be added without a spec change. Pause is the answer to
  leave-the-desk items; it is not a selection rule.
- The control is Hallmark-governed. The **home card is unaffected**.

*Accepted, not fixed here*: resuming can auto-expire a still-visible confirmatory prompt —
post-resume warm-up readings are non-sustaining, which expires a shown prompt as
`signal_drop` at no budget cost and re-arms it. A pre-existing quirk of the shipped pause
button, and moot for this card, which only exists after the prompt already resolved.

Tasks: **T036** (the control) and **T037** (the server-side smoothing-buffer drop on
pause, feature-008 code with a gate inside the task).

## Legal documents (same PR — Principle VIII standing rule)

**Privacy Policy** (`apps/web/lib/legal/copy.ts`):

1. `what-serenify-handles` — add a data-class bullet to `PRIVACY_CATEGORIES_ITEMS`:
   suggestion records — what was suggested, what was opened, whether it helped, what was
   swapped away; private to the individual.
2. `what-is-kept` — extend the retention passage beside `PRIVACY_RETENTION_P2`:
   recommendation records kept ninety days, matching monitoring readings, **same "a
   policy, not a mechanism" framing verbatim in spirit** — no purge job runs today and
   none is promised (FR-027); the record is derived from a reading and does not outlive
   its parent's stated period.
3. `what-a-manager-can-see` — one sentence adding suggestion records to the
   never-visible class, in the `PRIVACY_CHAT_P1` "permanent and unconditional"
   register (FR-025).

4. **Correct four published passages that are false against infrastructure credentials
   — RULED (Mohamed, 2026-08-15), MERGE-BLOCKING within 014, folded into T031.** The
   evidence is the same cloud verification recorded above: on the deploy target
   `service_role` holds full `arwdDxtm` on public tables and both `service_role` and
   `postgres` have `rolbypassrls = true`. Against that, three passages currently overclaim
   and one is literally-true-but-misleading:
   - `PRIVACY_SECURITY_P1` — claims database rules bind the database's own owner (cloud
     `postgres` has BYPASSRLS, so they do not); claims consent records are "read by their
     owner and by no one else" and "cannot be deleted at all, by anyone" (cloud
     `service_role` / `postgres` can read and delete them). The UPDATE-blocking trigger is
     real, so **"cannot be edited" stays**.
   - `PRIVACY_MANAGER_DEFAULT` — "visible to you and to nobody else", stated absolutely;
     false against infrastructure credentials.
   - `PRIVACY_CHAT_P1` — "no second rule granting anyone else a way in" is literally true
     and still misleading: a role exists that needs no rule.

   **Manner of correction — do not simply delete the false sentences.** State plainly that
   infrastructure credentials exist and what they can reach, in the register the policy
   already uses for the Groq disclosure and for the missing purge job: name the thing, say
   what it means, do not dress it up. **Claims about managers, admins, and the employer
   stay absolute** — those are true, and weakening them would be its own inaccuracy. The
   corrections ride the already-material `terms_privacy@2026-08-15.1` revision; no new
   registry entry. And the new suggestion-records sentence (item 3 above) must take the
   **manager/admin/employer shape**, never the "no way in exists" shape — the latter is
   exactly what broke here.

New copy must pass `copy-invariants.test.ts` (no numeric quality metrics, no `%`, no
placeholder tokens, marker rules). **Terms of Service**: reviewed against the change; no
text change expected — the new class alters disclosure (a Privacy Policy concern), not
the agreement mechanics, consent list, or liability posture. The review outcome is
recorded in the PR/DECISIONS either way.

**Materiality — DECIDED (Mohamed, 2026-08-15): material**, for `terms_privacy` only;
`camera_inference` untouched. Applied in the plan-amendment pass:
`terms_privacy@2026-08-15.1` appended to `lib/consent/registry.ts` with
`materiality: "material"` + rationale, `published-revisions.snapshot.json` regenerated
(existing entries byte-identical; guard suites green, 132/132). Reasoning — including the
counter-reading (additive disclosure of owner-private derived data, the Amendment 23
shape) and why it was rejected (the band rename reworded an existing value while this
revision discloses recording no accepted text mentioned; the prompt-fatigue argument
rested on proximity to the 2026-08-12/13 re-prompts, which this feature's merge will not
have) — is recorded in `docs/DECISIONS.md` 2026-08-15. Implementation note: the copy.ts
wording this revision describes lands in this same PR (the 013 publishing rule); everyone
whose acceptance predates the revision is re-prompted once it ships.

## Library authoring — an explicit, gated step

Authoring the fifteen items is **its own step with its own gate**, not a ride-along of
the UI work, and `/speckit-tasks` must emit it as such:

- **What is authored**: for each of the fifteen items — title, one-line description
  (`whyLine`), duration label, step-by-step instructions, category assignment (three per
  category across the five fixed categories). Written directly into
  `lib/recommendations/library.ts` in the reviewed shape (data-model §1).
- **Sequenced before UI wiring**: the card, `pick-item.tsx`, and `ConfirmedPickCard` are
  built against the real strings, so the layout is exercised by real title lengths, real
  step counts, and real duration labels — never placeholders. (The deterministic
  fallback strings for states 2/9 are authored and reviewed in the same pass.)
- **The gate is Mohamed's line-by-line review**, not a checkbox: every item is read and
  approved by him before it lands. The review checklist is the spec's content
  invariants, each checked per item: no physical discomfort as a coping technique (no
  ice, no cold shock, no snapping, no pain — FR-008), no substances including caffeine
  (FR-008), nothing clinical, outcome-claiming, or requiring leaving the workplace
  (FR-009), nothing touching crisis territory (FR-007), and the calm-first voice rules
  (FR-028 / Principle V). SC-008: zero shipped items in violation.
- The PR cannot merge with placeholder item copy (spec gate: no placeholder tokens); an
  unreviewed library is treated as placeholder.

## Risks

1. **012 regression** — mitigated by not editing the reducers, pinning via the existing
   #127/#130/#132/#134 + SC-006 suites, and a dep-swap-only diff in
   `confirmatory-trigger.ts`. Residual: host-wiring races in `monitoring-session.tsx`
   (the file is large); covered by the FR-014 interruption tests and e2e.
2. **Generated-copy fabrication** — the validator is deny-by-default (any unmatched
   number/time/band → fallback); worst case is the deterministic string, which is the
   contract's source of truth anyway.
3. **Episode/budget edge cases** (mid-episode confirmation, state-8 no-replacement,
   non-repeat-beats-budget) — all encoded as table-driven reducer tests before UI wiring;
   the spec's FR-018 paragraph is the test fixture list.
4. **"Same pick, same words" drift** between monitor and home — structurally prevented:
   one shared `pick-item.tsx` rendering one pick row against one library entry.
5. **Library authoring** — now an explicit gated step (§Library authoring), sequenced
   before UI wiring and gated on Mohamed's line-by-line review; the PR cannot merge with
   placeholder or unreviewed item copy.
6. **Consent revision shipped ahead of its wording** — the registry entry
   (`terms_privacy@2026-08-15.1`) is on the branch now; the copy.ts wording it describes
   MUST land before this branch's PR merges, or the binding revision would point at text
   that does not exist. Tracked as the §Legal implementation note; the branch is not
   mergeable without it.

## Backlog candidates (recorded, not done — scope clamp)

- 90-day purge **mechanism** for `recommendation_picks` + readings (existing unslotted
  BACKLOG #86 already covers the class; add this table to it when it lands).
- Today-card headline change — explicitly out of scope here (spec non-goal).
- `Secure` cookie flag / unrelated cleanups noticed in adjacent files — none opened.
