# Research — 014-recommendations

**Date**: 2026-08-14 · **Spec**: [spec.md](spec.md) · All spec clarifications were resolved
2026-08-14; this file records the plan-level decisions the spec deliberately left open.

## R-1 — The item library is an in-repo reviewed module, not a DB table

**Decision**: `apps/web/lib/recommendations/library.ts` — a pure constants module: 15 items,
5 fixed categories (`breathing_grounding`, `movement`, `sensory_reset`, `taking_a_break`,
`connection`), each item `{ id, category, title, whyLine, durationLabel, steps[], footNote? }`.
Rendered verbatim (FR-004). Item contents are a separate authoring pass Mohamed reviews line
by line against FR-007–FR-009 + Principle V voice rules; the plan ships the module shape and
placeholder-free reviewed content before merge.

**Rationale**: The consent registry precedent (`apps/web/lib/consent/registry.ts`, 013
research §6.3): human-reviewed text belongs where a PR diff shows it next to its
classification. A DB table would need seeding, RLS, and an editorial pipeline for content
that changes only by review. The engine is client-side (R-10), so no server lookup is needed.

**Alternatives**: DB table (rejected: review-by-migration is worse than review-by-diff;
creates an unowned write path); JSON file (rejected: loses TS type safety over categories,
which are load-bearing for 015).

## R-2 — One `recommendation_picks` table; signals are columns, not event rows

**Decision**: One row per surfaced pick. `opened_at` (the engagement record, FR-015),
`outcome` + `outcome_at` (`helped` / `didnt_help`, FR-016/17), `swapped_away_at` (the
preference signal, FR-017) are distinct columns — "didn't help" and "swapped away" can never
be conflated (SC-007). `local_day date` is client-computed from the today-card day semantics
(`localDayWindow`, `monitoring-reads.ts:190`), following the client-computed
`iso_week_start` precedent in `weekly_checkin_cadence`. `episode_id uuid` is client-generated
at episode start and shared by every pick in the episode. `confirmed_at` records a confirmed
detection attaching to the pick (prominence, not identity — FR-018's "same pick, only
prominence changes"). Full shape: [data-model.md](data-model.md).

**Rationale**: The lifecycle is linear per pick (suggested → maybe opened → maybe outcome |
maybe swapped away), so columns + CHECK constraints express it more verifiably than an event
log, and 015 reads both signals from one row. Mirrors `questionnaire_confirmatory_prompts`'
lifecycle-in-one-row shape.

**Alternatives**: Append-only event table (rejected: reconstructing "the active pick" from
events reimplements the state machine in SQL; CHECKs can't guard cross-row invariants);
per-day summary row (rejected: loses per-pick signals 015 needs).

## R-3 — Budget and episode rules live in the browser; the DB backstops what an index can express

**Decision**: The three-pick episode budget, the non-repeat-within-day rule, and episode
start/end (FR-018) are enforced in a pure TS reducer (012 precedent: the confirmatory
trigger's pure reducers, D-1/D-8). The DB backstops the invariants an index can state: a
partial unique index enforces **one active pick per (user, day)** (`WHERE outcome IS NULL AND
swapped_away_at IS NULL`) — the FR-003 one-item-at-a-time rule — mirroring the #132/D-11
partial-unique-index pattern. The three-per-episode *count* is not DB-mirrored: a count cap
cannot be a unique index, and the 012 budget precedent (#127) is likewise browser-enforced
with the DB catching only the uniqueness-shaped slice.

**Rationale**: Pure reducers are deterministically testable (SC-001/SC-002); D-11 showed the
DB mirror should express exactly what an index can say, no more.

## R-4 — Reflective copy: apps/api endpoint → `llm_client`, JSON `{ "text" }`, TS validator, deterministic fallback, sessionStorage cache

**Decision**:
- **Transport**: a new FastAPI endpoint `POST /recommendations/reflective-copy`
  (forwarded-JWT auth like `/chat/*`), called from a typed client module
  (`apps/web/lib/api/recommendations-client.ts`). apps/web never touches a vendor SDK
  (Principle IV); the endpoint calls the existing `llm_client` `ProviderRegistry` via
  `get_llm_client()` — Groq primary, LM Studio fallback, transient retry, **no new
  provider** (FR-024).
- **Prompt**: a new versioned file `packages/llm-client/prompts/reflective_copy.txt`,
  registered in the closed `PromptId` literal + `PROMPT_IDS` (`prompts.py:19–34`).
  `response_format="json_object"`, contract `{ "text": string }`, parsed with the scorer's
  defensive `extract_json_object` (handles reasoning leakage / fences).
- **Inputs**: only the precomputed facts bundle (FR-020/FR-023) — counts, formatted times,
  band display labels, tried-item titles, the deterministic fallback string. No raw
  readings, no chat content, no user name.
- **Validation before display**: a pure TS module (`reflective-copy-validation.ts`) run
  client-side where the fallback lives: every digit run, time-like token, and band word in
  the output must appear in the supplied facts; no exclamation marks; length cap. Any
  violation → the deterministic string (FR-021, SC-004). Testable in Vitest without a
  provider.
- **Failure/timeout**: card-level budget ~3.5 s (endpoint timeout below it); any error,
  timeout, parse or validation failure renders the fallback. The card never blocks and has
  no error state (FR-030).
- **Cache** (FR-022): sessionStorage keyed by a fingerprint of `(state, facts, local day)`;
  same fingerprint → reuse, changed fingerprint → one regeneration. Day boundary changes the
  fingerprint, so FR-019's reset is free. Precedent: the auto-title generate-once-and-keep
  null-check (`chat_orchestrator.py:352–359`) for "once per state change", and 012's
  browser-local stores for per-surface state.
- **First paint** (added 2026-08-15): text never flips under the reader — cache hit paints
  immediately; cache miss shows an 800 ms skeleton line; on expiry the fallback paints and
  stands for that mounted state, a late result serving only future first paints via the
  cache. Full rules: [contracts/reflective-copy.md](contracts/reflective-copy.md) §First paint.

**Alternatives**: Next.js route with a Groq key (rejected: Principle IV — all LLM access
through `packages/llm-client`); DB-persisted copy (rejected: copy is ephemeral per state per
day; a column invites the generated text to outlive its facts); server-side validation only
(rejected: the fallback decision is client-side, so the validator must run where the
decision is made — and a pure TS module is directly unit-testable against SC-004).

## R-5 — The 012 change is a host-wiring dep swap; the pinned reducers do not change

**Decision**: `useConfirmatoryTrigger`'s pure reducers (`reduceOutcome`,
`reduceDwellElapsed`, `markResolvedConsumingBudget`, `markResolvedRearm`) are untouched —
the #127/#130/#132/#134 guarantee tests stay byte-for-byte green. The only changes: the
hook's `onConfirm` calls `finalize({answered, confirmed})` exactly as today, then a new dep
`resolveToRecommendation(pick)` instead of `openRen("confirmatory_yes")`; `openRen` remains
for `confirmatory_maybe`. Details: [contracts/confirmatory-resolution.md](contracts/confirmatory-resolution.md).

**Rationale**: D-6 dwell, D-8/D-11 budget semantics, false-alarm next-session suppression,
and the single-resolution guard all live in the reducers and `finalize` — leaving them
unchanged is how they are preserved, and SC-006 pins it.

## R-6 — The in-session surface is a `Notification`-slot card, inside the existing precedent

**Decision**: `ConfirmedPickCard` renders through the shared `Notification` primitive
(`components/notification.tsx`) — the exact surface the confirmatory prompt already uses on
that page (`w-80` fixed corner card on desktop, bottom sheet on mobile, stacked above the
chat pill via `--chat-pill-offset`). Dismissible (unlike the prompt), non-modal. It carries
the same pick, same words as home state 4, an expandable instructions view (open = the
engagement record), and the inline outcome question once instructions close. No new
positioning system, no new panel type. Verdict on the brief's stop-condition: the
requirement **fits inside the precedent** — this is the same footprint as the confirmatory
prompt it replaces the resolution of.

## R-7 — Ren's pick-awareness reuses the `recent_read_line` mechanism

**Decision**: A `current_pick_line` helper in apps/api (sibling of
`chat_video_context.recent_read_line`): reads the owner's active pick title for today via
the forwarded-JWT client (fail-soft → empty string), renders one fixed hedged sentence, and
passes it through `render_prompt("ren", …)` via a new documented `{current_pick_line}`
variable in `ren.txt`. Contextual awareness only — no behavioural change, no recommendation
cards in chat (`CONFIRMATORY_HANDOFF_SHOWS_RECOMMENDATIONS` stays `false`).

## R-8 — Preferences seam: an injected `PreferenceSource` returning a neutral default

**Decision**: `apps/web/lib/recommendations/preference-source.ts` exports
`type PreferenceSource = { categoryAffinity(category: Category): number }` and
`neutralPreferenceSource` (returns the same weight for every category). The engine takes a
`PreferenceSource` parameter; v1 always passes the neutral source. 015 replaces the source
module, not the engine (FR-006). Mirrors 012's `shouldOfferSessionEndFeedback` sampling
seam.

## R-9 — Legal updates and the materiality judgment

**Decision**: Privacy Policy changes in `apps/web/lib/legal/copy.ts` (same PR, FR-026):
a new data-class bullet in `what-serenify-handles` (`PRIVACY_CATEGORIES_ITEMS`), a
recommendation-records retention clause in `what-is-kept` beside `PRIVACY_RETENTION_P2`
using the same "a policy, not a mechanism" framing (FR-027), and an explicit
never-manager-visible sentence (FR-025) following the `PRIVACY_CHAT_P1` "permanent and
unconditional" precedent. Terms of Service: reviewed; no text change expected (the new class
changes disclosure, not the agreement mechanics) — the review is recorded either way.
Copy must pass `copy-invariants.test.ts` (no numeric metrics, no `%`, marker rules).

**Materiality**: **decided material by Mohamed, 2026-08-15** (plan.md §Legal;
`docs/DECISIONS.md` 2026-08-15). `terms_privacy@2026-08-15.1` appended and
snapshot-locked; `camera_inference` untouched. Precedents weighed: #198 (material: the
words defining what a consent covers changed) vs Amendment 23 (non-material: a rename
inside an existing category).

## R-10 — Selection engine: category-first deterministic rules, expressible over categories

**Decision**: `apps/web/lib/recommendations/engine.ts`, pure function:
`selectPick({ dayBands, timeOfDay, todayHistory, preferences, library }) → LibraryItem | null`.
Two stages: (1) rank categories by fixed rules (band tenor + time of day + preference
affinity as a tie-shaping weight, stable tiebreak by declared category order); (2) within
the top eligible category, pick the first item by declared order that the day's non-repeat
exclusions allow; if a category is exhausted, fall through to the next. No randomness, no
clock reads inside the engine (`now` injected), no model (FR-002/FR-005). Identical inputs →
identical pick (SC-001). The crisis domain is unreachable by construction: the engine can
only return members of the reviewed library (FR-007).
