<!--
SYNC IMPACT REPORT
==================
Version change: (initial) → 1.0.0
Bump rationale: First ratification of the Serenify constitution. No prior
version exists; therefore this is a MAJOR-equivalent initial publication.

Principles defined (10):
  I.    Privacy by Architecture (NON-NEGOTIABLE)
  II.   Subject-Disjoint ML Evaluation (NON-NEGOTIABLE)
  III.  Modality Isolation
  IV.   LLM Provider Abstraction
  V.    Calm-First Design Language
  VI.   Responsive & Accessible by Default
  VII.  Mandatory Testing Per PR
  VIII. Spec-Driven Workflow
  IX.   Secrets Discipline (NON-NEGOTIABLE)
  X.    Dataset Stewardship (NON-NEGOTIABLE)

Sections added:
  - Technology Stack (Locked)
  - Architecture Constraints
  - Development Workflow & Quality Gates
  - Governance

Sections removed: none (no prior file content).

Template alignment audit:
  ✅ .specify/templates/plan-template.md — "Constitution Check" is a generic
     gate; the per-feature plan will reference these principles by number.
     No structural change required.
  ✅ .specify/templates/spec-template.md — generic; no constitution-specific
     placeholders to update.
  ✅ .specify/templates/tasks-template.md — generic; testing tasks expected
     to enforce Principle VII when /speckit-tasks runs.
  ⚠ docs/DECISIONS.md, docs/PROGRESS.md, docs/CHANGELOG.md, docs/MODELS.md
     — referenced by this constitution but not yet created. To be authored
     during feature 001 setup.
  ⚠ CLAUDE.md — exists; verify it does not contradict Principle V/VI
     visual or voice guidance during the next /speckit-plan cycle.

Deferred TODOs: none. All placeholders concretely filled.

Amendment 1: 1.0.0 → 1.1.0 (2026-05-20, MINOR)
Bump rationale: Principle V palette addition (`--color-crimson`) +
scope clarification on the "red is forbidden anywhere" rule. Red
remains forbidden on affective and ambient surfaces; it is now
permitted on destructive action surfaces using the Mist & Meadow
`crimson` token. Triggered by feature 003 implementation — the
shadcn button primitive's `destructive` variant requires a
foreground color that achieves WCAG AA contrast on the variant's
background in both modes; amber failed dark-mode AA at 1.4:1,
crimson + bg-as-foreground passes at ~5–6:1.

Affected templates: none. The amendment refines an existing rule and
adds one palette token; no template references the rule literally.

Cross-references:
- docs/DECISIONS.md entry 2026-05-20
- docs/CHANGELOG.md entry 2026-05-20
- specs/003-employee-dashboard-shell/plan.md Decision B
- specs/003-employee-dashboard-shell/contracts/shadcn-mapping.md

Amendment 2: 1.1.0 → 1.2.0 (2026-05-27, MINOR)
Bump rationale: Video modality switched from rPPG to LBP-TOP + Motion
features with per-user delta calibration. The new model
(`serenify-video-lbptop-motion-rf-calibrated` v2.0.0) requires 60s
inference windows (was 30s) and 60s calibration baseline (was ~90s).
The 30s configuration was empirically shown to collapse stress-class
recall from 0.83 to 0.61 on subject-disjoint LOSO; 60s is the locked
production mode. Triggered by retirement of the rPPG notebook due to a
subject-leakage bug discovered late in feature 004 prep; replacement is
the LBP-TOP + Motion pipeline. The "rPPG" language is also dropped from
Principle II in favor of modality-agnostic "video pipeline" wording —
the principle generalizes cleanly without naming a specific feature
family. MINOR bump: refinement of an existing rule (timing parameters +
terminology); no new principles, no removed principles, no structural
change.

Affected templates: none. Audited .specify/templates/{plan,spec,tasks}-
template.md for the touched values (`rPPG`, `30-second`, `90-second`,
`60-second`, window/baseline/calibration language) — zero matches; the
templates reference Principle II by number, not by literal timing text,
so no template edit is required.

Scope note: "rPPG" is dropped from Principle II's body only. It is
intentionally retained as historical/architectural context in Principle I
(`rPPG-derived` raw-signal clause) and Principle III (`webcam + rPPG
pipeline` package description); those are out of scope for this amendment.

Cross-references:
- docs/DECISIONS.md entry 2026-05-27
- docs/CHANGELOG.md entry 2026-05-27

Amendment 3: 1.2.0 → 1.3.0 (2026-05-27, MINOR)
Bump rationale: Principle III's `packages/ml-video/` description updated from
"webcam + rPPG pipeline" to "video stress pipeline (LBP-TOP + motion features,
per-user delta calibration)" to reflect the actual implementation that feature
004 creates. Principle VIII's provisional feature ordering slot for 004 is
renamed from `004-webcam-and-rppg` to `004-onboarding-video-anchor` to match
the actual spec slug. Triggered by feature 004 (onboarding video anchor flow)
— the post-rPPG model is LBP-TOP + Motion with per-user delta calibration,
documented in `docs/MODEL_HANDOFF.md` and `docs/MODELS.md`. Ride-along
amendment with the first commit of feature 004. MINOR bump: refinement of an
existing rule (package description + slug rename); no new principles, no
removed principles, no structural change.

Affected templates: none. Audited .specify/templates/{plan,spec,tasks}-
template.md for the touched strings (`rPPG`, `webcam`, `004-webcam-and-rppg`,
`ml-video`); the templates reference principles by number, not by these
literal strings, so no template edit is required.

Cross-references:
- docs/DECISIONS.md entry 2026-05-27
- docs/CHANGELOG.md entry 2026-05-27

Amendment 4: 1.3.0 → 1.4.0 (2026-06-17, MINOR)
Bump rationale: Visual redesign (feature 007-visual-redesign). Principle V's
palette VALUES are replaced with the deeper, less-desaturated "Graphite" (D5)
values (light + dark), and the display typeface changes from DM Serif Display
to Outfit (Inter unchanged for body/UI). The semantic role system is
UNCHANGED — meadow = calm/affirmative, foggy = attention/error, amber =
stress/affective signal only, crimson = destructive only; the token names
(--color-meadow/foggy/amber/crimson) are unchanged. Two contrast-driven rules
are added to Principle V: (a) filled meadow/foggy action surfaces take
near-white foreground in light and the bg token in dark (deepened accents fail
AA with ink), replacing the prior ink-on-accent treatment; (b) the amber
stress signal becomes a soft-tint notice treatment (tint background + deep
same-family text) — solid-amber-with-ink is forbidden. Principle VIII's
provisional ordering is corrected (006 realized as calibration-capture-quality;
007-visual-redesign inserted; downstream provisional slots shift +1), which
moves the feature-number cross-references in Principle III (fusion 015→017) and
Principle IV (audio 013→015). MINOR bump: refinement of existing rules +
expanded guidance; no new principle, no removed principle, no structural change.

Affected templates: none. Audited .specify/templates/{plan,spec,tasks}-
template.md for palette/font literals (hex values, "DM Serif Display", "Mist &
Meadow") and feature-number strings; templates reference principles by number,
not by these literals, so no template edit is required.

Cross-references:
- docs/DECISIONS.md entries 2026-06-17
- docs/CHANGELOG.md entry 2026-06-17
- specs/007-visual-redesign/ (spec to follow)

Amendment 5: 1.4.0 → 1.5.0 (2026-06-22, MINOR)
Bump rationale: Principle V palette — register four amber sub-tokens for the
stress-signal role used by feature 009's today-card trend visualization:
`--color-amber-text` (light `#8A580F` / dark `#E6C386`), `--amber-tint`
(`#F4E3C6` / `#3B2F19`), `--amber-soft-line` (`#D49A4A` / `#E8BC7A`), and
`--amber-head` (`#BC7A2A` / `#E4AE5C`). The documented light amber-text value is
updated `#7E5310` → `#8A580F` (the approved-mock warmth; measured ~4.78:1 on the
tint, passes WCAG AA; dark `#E6C386` unchanged). Bright graphic `--color-amber`
remains lines/markers only (fails small-text AA at 2.77:1). The amber semantic
role is unchanged — these are sub-values within the locked amber family for
AA-safe text and multi-level graph encoding. MINOR bump: additive tokens + one
value refinement; no new/removed principle, no structural change.

Affected templates: none. Audited .specify/templates/{plan,spec,tasks}-
template.md for amber hex literals — zero matches; templates reference Principle
V by number, not by literal palette values.

Cross-references:
- docs/DECISIONS.md entry 2026-06-22
- docs/CHANGELOG.md entry 2026-06-22
- specs/009-today-card-trend-redesign/{plan.md, research.md R-3}

Amendment 6: 1.5.0 → 1.5.1 (2026-06-22, PATCH)
Bump rationale: Principle V visual finish — corner-radius range widened
8–16px → 8–20px to match the 20px (`rounded-2xl`) cards shipped since the 007
visual redesign and used by feature 009's today card. Documentation catch-up to
existing practice; no behavioral rule change. PATCH bump: clarification only; no
new/removed principle, no structural change.

Affected templates: none.

Cross-references:
- docs/DECISIONS.md entry 2026-06-22
- docs/CHANGELOG.md entry 2026-06-22

Amendment 7: 1.5.1 → 1.5.2 (2026-06-23, PATCH)
Bump rationale: Technology Stack (Locked), Charts row — ratify a narrow,
already-decided carve-out (`docs/DECISIONS.md` 2026-06-22, Decision 4): bespoke
affective micro-visualizations — specifically feature 009's employee today-card
stress trend — MAY use hand-authored inline SVG. The load-bearing reason is
bespoke geometry: the trend is a custom lane-geometry visualization
(run-collapsed lanes, a custom stress-band-to-Y encoding, no-read markers, a
step-line) that is not one of Recharts' standard chart types, so building it in
Recharts would mean working against the library's chart abstractions rather than
with them. It also requires pixel-exact, non-stretched rendering (DC-001: 1 SVG
unit = 1 screen pixel). The carve-out is narrow: Recharts remains the locked
default for standard dashboard data charts, and a general charting-library
substitution still requires its own amendment. Precedent already exists on `main`
(`today-view.tsx`, `session-trend.tsx`). PATCH bump: documents an existing
decision and scopes one locked-stack row; no new/removed principle, no structural
change, and no library substitution for standard charts.

Affected templates: none. The .specify/templates/{plan,spec,tasks}-template.md
reference the locked stack by section, not by the "Recharts" literal; no template
edit is required.

Cross-references:
- docs/DECISIONS.md entry 2026-06-22 (Decision 4)
- specs/009-today-card-trend-redesign/{plan.md V-c, research.md}

Amendment 8: 1.5.2 → 1.6.0 (2026-06-23, MINOR)
Bump rationale: Principle VIII's provisional ordering is reconciled with built
reality and reordered, and two new planned features are added. (1) `009` is
realized as `009-today-card-trend-redesign` — the slot previously reserved for
the questionnaire — and `008-followups` was a follow-up branch that held no slot
of its own. (2) `010-llm-client-and-chatbot` moves ahead of the questionnaire
and recommendations because the LLM client is a shared dependency for both the
chatbot and the recommendations engine — building it first unblocks both.
(3) Two new planned features are added: `013-personalization-onboarding`
(captures personal de-stress preferences that feed recommendations;
recommendations v1 ships generic behind a defined preferences seam, so this
lands as an additive layer) and `015-preferences-hub` (app/locale settings:
language, theme, default camera, timezone). Downstream slots shift accordingly,
and two feature-number cross-references are updated: Principle IV audio
`015 → 018`, Principle III fusion `017 → 020`. MINOR bump: two new planned
features plus a reorder of the provisional ordering materially change the
guidance; no new or removed principle, no structural change.

Affected templates: none. Audited .specify/templates/{plan,spec,tasks}-
template.md for the touched strings — the old slugs (`009-questionnaire`,
`010-llm-client-and-chatbot`, `011-recommendations`,
`012-privacy-controls-and-transparency`, `013-team-lead-dashboard`,
`014-admin-dashboard`, `015-audio-modality`, `016-physio-modality`,
`017-fusion`) and the literals `feature 015` / `feature 017` — zero matches;
the templates reference principles by number, not by these literal slugs or
feature numbers, so no template edit is required.

Cross-references:
- docs/DECISIONS.md entry 2026-06-23
- docs/CHANGELOG.md entry 2026-06-23

Amendment 9: 1.6.0 → 1.7.0 (2026-06-24, MINOR)
Bump rationale: Principle VIII gains a backlog-governance bullet (grouped with the
existing DECISIONS/PROGRESS/CHANGELOG logging bullets): follow-up items deferred from
features live in `docs/BACKLOG.md` (the source of truth) and are mirrored 1:1 to GitHub
Issues — opened when a follow-up is logged, closed when it is fixed, both in the same
change; Issues never diverge from BACKLOG, and BACKLOG wins on conflict. Label taxonomy
and operational detail live in `docs/DECISIONS.md`. Triggered by the BACKLOG.md → GitHub
Issues migration prep (the BACKLOG↔Issues mirror contract). MINOR bump: new guidance added
to an existing principle; no principle removed or restructured, no other section changed.

Affected templates: none. Audited .specify/templates/{plan,spec,tasks,checklist,
constitution}-template.md for any reference to Principle VIII's content (BACKLOG, GitHub
Issues, the DECISIONS/PROGRESS/CHANGELOG logging rules) — zero matches; the templates
reference principles by number, not by these literal logging-doc rules, so no template
edit is required (consistent with the Amendment 8 audit).

Cross-references:
- docs/DECISIONS.md entry 2026-06-24
- docs/CHANGELOG.md entry 2026-06-24
- CLAUDE.md "Backlog ↔ Issues" section
- docs/BACKLOG.md (cleanup ride-along: stale headers flipped to merged, status
  normalizations, manager-visibility item merge, feature-number remap)

Amendment 10: 1.7.0 → 1.8.0 (2026-06-25, MINOR)
Bump rationale: Principle VIII's provisional ordering gains one new planned slot —
`009b-monitoring-graph-redesign` — inserted immediately after the shipped
`009-today-card-trend-redesign` and before `010-llm-client-and-chatbot`. The slot is the
live "This session" within-session monitoring graph
(`apps/web/components/monitor/session-trend.tsx`) scoped out of feature 009; it is
design-locked (a signed-off HTML reference exists) and pending spec. Two deliberate
non-actions: slots `010`–`020` are NOT renumbered, and the shipped `009` is NOT renamed
to `009a` — its branch / PR #25 / CHANGELOG history is fixed, so relabeling it would
create constitution↔git drift; the `b` suffix already implies `009` is the original. The
roadmap label is decoupled from the real branch number, which SpecKit auto-assigns at
`/speckit-specify` time regardless of the slug. MINOR bump: a new planned feature added to
the provisional ordering materially extends the guidance (consistent with Amendment 8); no
new/removed principle, no structural change.

Affected templates: none. Audited .specify/templates/{plan,spec,tasks,checklist,
constitution}-template.md for the touched strings (`009b`, `monitoring-graph-redesign`,
`session-trend`, the ordering slug list) — zero matches; the templates reference Principle
VIII by number, not by these literal slugs or feature numbers, so no template edit is
required (consistent with the Amendment 8/9 audits).

Cross-references:
- docs/DECISIONS.md entry 2026-06-25
- docs/CHANGELOG.md entry 2026-06-25
- apps/web/components/monitor/session-trend.tsx (the surface to be redesigned)

Amendment 11: 1.8.0 → 1.8.1 (2026-06-27, PATCH)
Bump rationale: Pure documentation catch-up — the monitoring-graph redesign shipped
(merged to `main` via PR #118, squash `6b8653e`, with its own `specs/010-…` folder, US1–US3,
and 726 unit tests), so its Principle VIII roadmap label is reconciled with git reality: the
`009b-monitoring-graph-redesign` interstitial becomes the canonical `010-monitoring-graph-redesign`
(and the "scoped out of 009 … pending spec" parenthetical is dropped — it has a spec and shipped),
cascading the unstarted tail up by one (`010`→`011` … `020`→`021`). Two live feature-number
cross-references move with the tail: Principle IV audio `018 → 019`, Principle III fusion
`020 → 021`. PATCH (not Amendment 8's MINOR): this adds NO new slot, removes NO principle, and
changes NO rule or guidance — it only relabels existing provisional slots to match the shipped
feature number, a non-semantic reconcile. Risk is low: every renumbered downstream slot is
unstarted, so no branch / PR / spec folder is affected (the shipped `001`–`010` keep their numbers).
The Amendment 10 narrative above is left as written (it is the dated record of why `009b` was the
right call at the time — historical, not live).

Affected templates: none. The .specify/templates/{plan,spec,tasks,checklist,constitution}-
template.md files reference Principle VIII by number, not by these slugs or feature numbers, so no
template edit is required (consistent with the Amendment 8/9/10 audits).

Cross-references:
- docs/DECISIONS.md entry 2026-06-27
- docs/CHANGELOG.md entry 2026-06-27
- specs/010-monitoring-graph-redesign/ (the shipped feature this reconciles to)
- PR #118 (squash 6b8653e) — the merge that made the slot canonical

Amendment 12: 1.8.1 → 1.9.0 (2026-06-28, MINOR)
Bump rationale: (1) Technology Stack + Principle IV provider swap — Groq is
deprecating `llama-3.3-70b-versatile` (shutdown 2026-08-16), so the primary
LLM moves to `openai/gpt-oss-120b` (reasoning_effort=low) and the fallback
from Gemma-3-4B to `openai/gpt-oss-20b` via LM Studio. gpt-oss is Groq's
stated consolidation target (deprecation-resilient) and supports strict
JSON-schema structured outputs, which the scorer relies on. (2) Principle I
gains two disclosure invariants: companion chat content is employee-private
(never reaches manager/admin), and a crisis disclosure never triggers any
manager/admin/employer notification and is never persisted — crisis routes
to external resources only. Triggered by feature 011 (llm-client-and-chatbot)
prompt-tuning lock. MINOR bump: a stack substitution plus materially expanded
Principle I guidance; no new/removed principle, no structural change.

Affected templates: none. The .specify/templates/{plan,spec,tasks,checklist,
constitution}-template.md reference principles by number and the stack by
section, not by the provider literals or these invariants; no template edit
is required (consistent with the Amendment 8–11 audits).

Cross-references:
- docs/DECISIONS.md entries 2026-06-28
- docs/CHANGELOG.md entry 2026-06-28
- specs/011-llm-client-and-chatbot/ (spec to follow)

Amendment 13: 1.9.0 → 1.10.0 (2026-06-30, MINOR)
Bump rationale: Principle I gains a new privacy invariant for feature 012's
weekly work-environment check-in. This is a distinct employee-submitted data
class (overall sentiment and, when negative, a roadblock selection plus a
desired-support selection), separate from stress signals. Manager visibility is
limited to anonymized team-level aggregates; individual attributed answers MUST
NEVER reach the manager-facing layer. Minimum-headcount suppression and related
small-team aggregation hardening are explicitly deferred for the demo build but
are REQUIRED before any real employee data is collected. MINOR bump: materially
expanded Principle I guidance; no new/removed principle, no structural change.

Affected templates: none. Audited .specify/templates/{plan,spec,tasks,checklist,
constitution}-template.md for the touched literals (`work-environment`, `weekly
employee check-in`, `overall sentiment`, `roadblock`, `desired-support`,
`anonymized`, `minimum-headcount`, `team-level aggregate`, `manager-facing layer`,
`employee-submitted`) — zero matches; the templates reference principles by
number, not by these literal privacy-invariant terms, so no template edit is
required (consistent with the Amendment 8–12 audits).

Cross-references:
- docs/DECISIONS.md entry 2026-06-30
- docs/CHANGELOG.md entry 2026-06-30
- docs/BACKLOG.md work-environment-feedback anonymization-hardening item
- specs/012-questionnaire/ (spec to follow)

Amendment 14: 1.10.0 → 1.11.0 (2026-07-12, MINOR)
Bump rationale: Azure for Students and the existing Azure Container App replace
the previously planned DigitalOcean Droplet for backend and ML serving. The
locked stack now authorizes FastAPI on Azure Container Apps, and Principle IX
authorizes Azure's production secret panel alongside Vercel and Supabase. This
is a locked-stack substitution and therefore a MINOR bump; no principle is
added or removed and no section is restructured.

Affected templates: none. Audited .specify/templates/{plan,spec,tasks}-template.md
and .specify/templates/commands/*.md for `DigitalOcean`, `Azure Container Apps`,
backend/ML hosting, and production secret-panel literals — no propagation is
required. Audited CLAUDE.md and AGENTS.md; neither contains a conflicting live
hosting or secret-panel reference. Historical DigitalOcean references remain
unchanged.

Cross-references:
- docs/DECISIONS.md entry 2026-07-12

Amendment 15: 1.11.0 → 1.11.1 (2026-07-22, PATCH)
Bump rationale: the Transactional email stack row carried the transitional caveat
"Supabase email until Resend domain verified". That condition is now satisfied —
Resend is live in production as Supabase's custom SMTP provider, configured in the
Supabase dashboard. The row is updated to state the delivered arrangement. PATCH
(not MINOR): this is NOT a stack substitution — Resend was already the named
production choice; only a now-satisfied precondition is removed. No principle is
added, removed, or restructured, and no behavioral rule changes.

Note for future auditors: Resend correctly has zero footprint in this repository —
no API key, no SDK, no calling code. It is wired beneath Supabase Auth as an SMTP
provider, so mail delivery changes are a dashboard + DNS concern, not a code
concern. Absence from the repo is the intended architecture, not missing work.

Affected templates: none. Audited .specify/templates/{plan,spec,tasks}-template.md
and .specify/templates/commands/*.md for transactional-email and SMTP literals — no
propagation is required.

Cross-references:
- docs/DECISIONS.md entry 2026-07-22

Amendment 16: 1.11.1 → 1.12.0 (2026-07-24, MINOR)
Bump rationale: Two changes to Principle VIII's provisional ordering plus one new
standing rule. (1) A new slot `013-public-surface-and-legal` is inserted — scope:
the public landing page, `/terms`, `/privacy`, the site footer, and the signup
consent gate. (2) `privacy-controls-and-transparency` is moved to sit AFTER
`team-lead-dashboard`, fixing a latent dependency inversion: it governs what an
employee lets their team lead see, so it cannot meaningfully ship before the
team-lead dashboard it constrains exists, yet it previously sat ahead of it.
Accepted consequence, stated plainly: with this ordering `017-team-lead-dashboard`
ships with hardcoded default visibility scopes and
`018-privacy-controls-and-transparency` retrofits employee-facing controls onto it
— the alternative was leaving the inversion in place (tracked as GitHub issue #152
and a `docs/BACKLOG.md` entry). The unstarted tail renumbers accordingly:
`recommendations` 013→014, `personalization-onboarding` 014→015; `preferences-hub`
and `team-lead-dashboard` keep 016/017; `admin-dashboard` 018→019, `audio-modality`
019→020, `physio-modality` 020→021, `fusion` 021→022. Two live body cross-references
move with the tail: Principle IV audio `019 → 020`, Principle III fusion
`021 → 022`. (3) Principle VIII gains a standing rule, grouped with the existing
DECISIONS/PROGRESS/CHANGELOG/BACKLOG logging bullets: whenever a feature changes
what data is collected, where it goes, who can see it, or how long it is retained,
the Privacy Policy and Terms of Service MUST be reviewed and updated in the same PR
(mirrored verbatim into `CLAUDE.md`). MINOR bump: a new planned slot, a reorder of
the provisional ordering, and new guidance added to an existing principle all
materially extend the guidance (consistent with Amendments 8/9/10/13); no principle
is added, removed, or restructured, and no numbered section changes.

Affected templates: none. Audited .specify/templates/{plan,spec,tasks,checklist,
constitution}-template.md for the affected slugs (`recommendations`,
`personalization-onboarding`, `preferences-hub`, `team-lead-dashboard`,
`privacy-controls-and-transparency`, `admin-dashboard`, `audio-modality`,
`physio-modality`, `fusion`, `public-surface-and-legal`), the feature-number
literals `013`–`022`, and the new rule's terms (`Privacy Policy`, `Terms of
Service`, `retention`). The only hit is a generic `[NEEDS CLARIFICATION: retention
period not specified]` example FR in spec-template.md — an illustrative placeholder
in the template's "marking unclear requirements" block, not a reference to this
rule or any feature — so no template edit is required (consistent with the
Amendment 8–15 audits: templates reference principles by number, not by these
literals). Recorded here so the next auditor does not re-flag the coincidental
`retention` match.

Cross-reference sweep (outside the constitution): forward-looking feature-number
references in shipped `specs/*/` are NOT retro-edited by this ordering change,
consistent with Amendments 8 and 11 — those spec docs are point-in-time records and
the constitution's ordering list is the source of truth for a feature's current
number. The stale specs/011 and specs/012 references (recommendations 013→014,
personalization 014→015) were identified and deliberately left; specs/004's
audio=013 / physio=014 / fusion=015 labels are pre-existing drift unrelated to this
amendment and also left. `docs/BACKLOG.md` — the forward-routing source of truth —
WAS reconciled in place: its number-bearing references were corrected (admin
018→019, privacy 015→018) keeping each durable slug; item #86 (90-day purge job)
was clarified as unslotted (explicitly NOT owned by 013); and BACKLOG:599's
`008/010/014` list was left as pre-existing ambiguous drift. Detail in
docs/DECISIONS.md 2026-07-24.

Cross-references:
- docs/DECISIONS.md entry 2026-07-24
- docs/CHANGELOG.md entry 2026-07-24
- CLAUDE.md (Privacy Policy / Terms of Service rule mirrored verbatim)
- GitHub issue #152 / docs/BACKLOG.md (accepted 017→018 ordering consequence)

Amendment 17: 1.12.0 → 1.13.0 (2026-07-24, MINOR)
Bump rationale: Two changes on two existing principles, landed as ONE amendment
because both answer blocking open questions in the same feature spec
(013-public-surface-and-legal: OQ-3 and OQ-1) and land in one PR — consistent with
Amendment 12, which likewise paired unrelated Principle IV/stack and Principle I
changes on a single feature trigger. Amendment atomicity here tracks the landing
event, not the topic.

(1) Principle V gains a **Wordmark** block. `serenify` is canonized as a two-colour
treatment — `seren` in the `ink` token, `ify` in the `meadow-text` token —
lowercase, no terminal punctuation, defined ONCE as a single shared component and
reused at every site that renders it inside the web app's React tree. Two classes
of render site sit outside that tree and cannot consume the component (the
`next/og` social card, since Satori cannot load the app's fonts; and the Supabase
transactional email templates, which are inline-styled HTML), so they are an
explicit hand-sync carve-out rather than a rule the codebase violates on day one.
The lowercase sentence MOVES out of the Typography block into Wordmark rather than
being duplicated — two places stating one rule is two places to drift. For the same
reason the Wordmark block does NOT restate that the wordmark is set in Outfit;
Typography, two sentences above, already assigns Outfit to the wordmark.

This adds NO new token and changes NO token value; it fixes an application rule for
an existing element. It does register `--color-meadow-text` (light `#346A56` / dark
`#63B292`) in Principle V for the first time: the token shipped in feature 007
(docs/DECISIONS.md 2026-06-18) but was never named here, even though this palette is
declared "locked, no additions without amendment". Two sibling 007 tokens,
`--color-on-accent` and `--color-scrim`, are in the same unregistered position and
are deliberately NOT fixed here — out of scope for this amendment, logged to
docs/BACKLOG.md and GitHub issue #155 to ride along with whichever amendment next
touches Principle V. The wordmark rule goes in the constitution rather than only in
DECISIONS because the constitution is read on every SpecKit feature — a wordmark
rule holds against drift only where it is enforced.

(2) Principle I gains a public-communication rule. Principle I's SUBSTANCE IS
UNCHANGED: per-individual manager visibility with the employee-controlled
granularity slider remains the intended end-state, and no invariant is edited. The
new rule governs only how that end-state may be described in public-facing or
user-facing text — it MUST be described honestly, controls that are not yet live
MUST be marked not-yet-live, and it MUST NOT be flattened in the other direction
either: chat content and crisis disclosures genuinely never reach a
manager/admin/employer, while stress-trend summaries ARE manager-visible by default
at the `summary only` granularity. That granularity default is NOT introduced here —
it is quoted from the existing Principle I slider bullet, which has carried
"`summary only` (DEFAULT)" since the 1.0.0 ratification. A copy-discipline rule must
not be the place a new substantive default first appears. This resolves the 013
spec's blocking OQ-1 by choosing its Option B and constraining how B is written —
NOT by amending Principle I, which was Option A.

MINOR bump: materially expanded guidance on two existing principles (Governance's
MINOR definition; consistent with Amendments 5/12/13); no principle is added,
removed, or restructured, and no numbered section changes. Moving the lowercase
sentence between two sub-blocks of Principle V is not a structural change — MAJOR is
scoped to removing a principle or a numbered section. Hand-edited (not via
/speckit-constitution) to preserve the curated Sync Impact Report history, per the
Amendment 10 precedent.

New live body cross-reference: Principle I now names feature 018
(`privacy-controls-and-transparency`). This is the THIRD feature-number reference in
the principle bodies — future Principle VIII ordering amendments must move it
alongside Principle IV's audio 020 and Principle III's fusion 022. The slug is
carried with the number so a renumber stays greppable by slug.

Affected templates: none. Audited .specify/templates/{plan,spec,tasks,checklist,
constitution}-template.md for `wordmark`, `two-colour`/`two-color`, `lowercase`,
`Principle V`, `Principle I`, `manager visibility`, `Graphite`, `meadow`,
`meadow-text`, `ink`, `--color-ink`, and `serenify` — zero substantive matches. The
only hits are coincidental substrings of `ink` inside the words "link"/"Link" at
checklist-template.md:5,39, plan-template.md:3, and spec-template.md:19 — ordinary
markdown link boilerplate, unrelated to the palette token. Recorded so the next
auditor does not re-flag them (same practice as Amendment 16's `retention` note).

Cross-reference sweep (outside the constitution): reported in full in
docs/DECISIONS.md 2026-07-24 (Amendment 17) and deliberately NOT bulk-edited in this
amendment. Four README.md lines state manager visibility or the privacy slider as
present-tense product fact without a not-yet-live marker; three lines in the
signed-off landing mock carry exactly the flattened "nothing reaches a manager"
claim the new rule forbids — that mock is gitignored and untracked, so it cannot be
edited by a PR and the rule instead binds at transcription time, when 013's landing
copy is written from it. Four live user-facing strings were checked and are already
compliant and MUST NOT be "corrected".

Cross-references:
- docs/DECISIONS.md entry 2026-07-24 (Amendment 17)
- docs/CHANGELOG.md entry 2026-07-24 (Amendment 17)
- docs/BACKLOG.md "From constitution Amendment 17" section / GitHub issue #155
- specs/013-public-surface-and-legal/spec.md OQ-1 (resolved: Option B) and OQ-3
  (resolved: yes, an amendment is required)
- docs/mockups/serenify-landing-mock.html:92,422 (source of the `seren`/`ify` split;
  untracked — see docs/mockups/README.md)
- docs/DECISIONS.md 2026-06-18 (`--color-meadow-text` origin, feature 007)

Amendment 18: 1.13.0 → 1.14.0 (2026-07-29, MINOR)
Bump rationale: One change on one existing principle (V), landed on the feature
that gives Ren a drawn avatar. Two permissions are written as two separate
bullets rather than one, because they have different scopes and must not be read
as a single rule — the first is product-wide for a class of mark, the second is
a single named surface. Collapsing them would let a later reader take the narrow
one as licence for the broad one.

Principle V's Palette block gains two bullets. (1) An identity mark MUST NOT use
a band- or outcome-carrying accent (meadow, amber, crimson), and Ren's mark
specifically MUST be foggy. This RATIFIES PRACTICE THAT ALREADY SHIPS:
apps/web/components/landing/panels/ren-panel.tsx has rendered a foggy Ren in
production since feature 013, passed through `RenAvatar`'s `color` prop, and was
flagged at the time (that file's docstring, ST-4) precisely because foggy's
registered role is attention. The amendment resolves that open flag by making
the practice a rule instead of a liberty. The same feature removes the `color`
prop that made the divergence possible, so the mark is foggy by construction and
not by call-site choice. The rule on the CLASS is the prohibition, not a
foggy-forever requirement — foggy is merely the only accent outside the band
scale today. (2) Within Ren's chat surface only, the primary action MAY be
foggy. Scoped to one surface and stated as a non-generalizing exception.

This adds NO new token and changes NO token value; both bullets are application
rules for existing tokens. It DOES register two shipped-but-unregistered tokens
in Principle V's palette block for the first time: `--color-on-accent` (light
`#F8F9FA`; dark uses the `bg` token — it does not swap) and `--color-scrim`
(`rgba(28, 32, 35, 0.60)`, fixed in both modes). Both shipped in feature 007 and
have been in use since, but the palette is declared "locked, no additions
without amendment" and never named them. Amendment 17 identified the gap,
closed it for a third 007 token (`--color-meadow-text`) because the new Wordmark
rule depended on that token, and deferred these two to "whichever amendment next
touches Principle V" as a ride-along — this IS that amendment, and the
dependency is the same shape: the identity-mark bullet above cites
`--color-on-accent` as the light-mode foreground, so leaving it unregistered
would have this amendment name a token the palette does not admit exists.
Documentation only — NEITHER VALUE IS CHANGED. Closes the gap logged at
docs/BACKLOG.md "From constitution Amendment 17" and GitHub issue #155.

MINOR bump: materially expanded guidance on one existing principle (Governance's
MINOR definition; consistent with Amendments 5/12/13/17); no principle is added,
removed, or restructured, and no numbered section changes. Registering two
tokens does not raise the bump — Amendment 17 registered `--color-meadow-text`
under a MINOR for the same reason. Hand-edited (not via /speckit-constitution)
to preserve the curated Sync Impact Report history, per the Amendment 10
precedent.

Affected templates: none. Audited .specify/templates/{plan,spec,tasks,checklist,
constitution}-template.md for `foggy`, `meadow`, `accent`, `identity mark`,
`avatar`, `Ren`, `chat surface`, `primary action`, and `Principle V` — zero
matches, substantive or coincidental.

Cross-references:
- docs/DECISIONS.md entry 2026-07-29 (Amendment 18)
- docs/CHANGELOG.md entry 2026-07-29 (Amendment 18)
- apps/web/components/chat/ren-avatar.tsx (the single shared mark)
- docs/BACKLOG.md "From constitution Amendment 17" / GitHub issue #155
  (`--color-on-accent` + `--color-scrim` registration gap — CLOSED here)
- docs/DECISIONS.md 2026-06-17 (filled-accent CTA foreground, feature 007)

Amendment 19: 1.14.0 → 1.15.0 (2026-07-30, MINOR)
Bump rationale: Widens Amendment 18's second bullet, one day after it landed.
Recorded plainly rather than folded in silently: Amendment 18 wrote the exception
at the level of a single CONTROL ("the primary forward action (the composer's
send control)"), and applying it immediately showed that was the wrong level.
Recolouring the send control alone left seven other meadow elements on the same
screen — the sent-message bubbles, the "Say hello" empty-state button, the
composer focus ring, the "Open full history" link, the "Try again" and end-chat
links, and the rename input's focus border — each of which then read as the
defect the exception was written to prevent. The rationale was always cohesion
across a surface; the wording just failed to say so.

Two changes. (1) The exception is restated at SURFACE level and made a
consistency requirement, not merely a permission: a surface adopting foggy takes
it across all its accent-carrying elements. (2) It extends to controls whose sole
purpose is to open Ren — today the floating chat pill. The pill is Ren-branded,
and after Amendment 18 a meadow pill opened a foggy panel, which is the same
incoherence one level out. The extension is written to reach the CONTROL and not
its host surface: a dashboard carrying a foggy Ren pill keeps meadow for its own
actions, which is the boundary that keeps this from becoming general licence.

This adds NO new token and changes NO token value; `--color-foggy` serves every
new site directly. Notably no `--color-foggy-text` is needed — the meadow role
required a deepened `--color-meadow-text` because raw meadow reads 4.61:1 as
small text on surface, marginal for AA; raw foggy reads 5.15:1 light and 7.68:1
dark and needs no sibling. Every ratio in the migration improves on the meadow it
replaces: focus rings 4.22 → 4.71 light and 7.43 → 8.34 dark, accent text links
5.76 → 5.15 light (both clear AA) and 7.68 dark, the pill's dark outlined chip
6.8 → 7.68, filled surfaces 4.78 → 5.33 light and 8.34 dark. No AA regression at
any site.

MINOR bump: materially expanded guidance on one existing principle (Governance's
MINOR definition; consistent with Amendments 5/12/13/17/18); no principle is
added, removed, or restructured. Rewording an exception admitted one amendment
earlier is not a MAJOR event — the permission's scope grows, its boundary is
restated more tightly, and no other rule weakens. Hand-edited (not via
/speckit-constitution) to preserve the curated Sync Impact Report history, per
the Amendment 10 precedent.

Affected templates: none. Audited .specify/templates/{plan,spec,tasks,checklist,
constitution}-template.md for `foggy`, `meadow`, `accent`, `chat surface`,
`entry point`, `primary action`, and `Principle V` — zero matches.

Cross-references:
- docs/DECISIONS.md entry 2026-07-30 (Amendment 19)
- docs/CHANGELOG.md entry 2026-07-30 (Amendment 19)
- .specify/memory/constitution.md Amendment 18 (the bullet this replaces)
- apps/web/components/chat/chat-shell.tsx, apps/web/components/chat-pill.tsx

Amendment 20: 1.15.0 → 1.16.0 (2026-08-05, MINOR)
Bump rationale: Principle V palette — register the control-boundary token
`--color-control` (light `#7D8083`; dark deliberately the seam value
`#23272B`), splitting boundaries into decorative seams (`--color-border`,
values unchanged) and control boundaries. In LIGHT mode the control boundary
MUST clear WCAG 1.4.11's 3:1 against adjacent surfaces (measured
3.39:1/3.67:1 vs bg/surface — the value settled at the 2026-07-29 review of
the #209 scope correction). In DARK mode the quiet boundary is a deliberate
aesthetic adjudication made at ratification: the 3:1 dark candidate
(`#6C7074`, per that same review) and the mathematical floor (`#64686B`,
3.07:1) were both built, shown side-by-side against the quiet dark form, and
rejected on looks — the grey rims broke the dark surface's calm. Dark labeled
inputs are identified by label + fill under 1.4.11's
component-identification reading; the residual — empty OTP digit boxes at
~1.15:1 in dark — is recorded as an accepted cost, not an oversight, and is
re-adjudicable by changing one token value. Closes the #209 defect class:
in light mode the `@theme inline` self-reference had collapsed every
`border-border` to currentColor ink, masking that the designed seam value
sat at ~1.2:1 on control boundaries (the consent checkbox and OTP boxes are
empty controls whose border is the whole affordance). Landed after #211
(focus-indicator consistency) per the ordering the BACKLOG entry records.
MINOR bump: additive token, no role change, no principle added, removed, or
restructured (consistent with Amendment 5's amber sub-token registration).
Hand-edited (not via /speckit-constitution) to preserve the curated Sync
Impact Report history, per the Amendment 10 precedent.

Affected templates: none. Audited .specify/templates/{plan,spec,tasks,checklist,
constitution}-template.md for `border`, `control`, `1.4.11`, `boundary`, and
`Principle V` — zero substantive matches (templates reference Principle V by
number, not by literal palette values).

Cross-references:
- docs/DECISIONS.md entry 2026-08-05 (Amendment 20 / #209)
- docs/CHANGELOG.md entry 2026-08-05
- docs/BACKLOG.md #209 (scope-corrected entry; "values settled at review")
- GitHub issues #209 (this fix), #211 (the ordering dependency, closed
  2026-07-29)
- apps/web/app/globals.css (the token block + the deleted self-reference)

Amendment 21: 1.16.0 → 1.17.0 (2026-08-05, MINOR)
Bump rationale: Principle V palette — register the empty-affordance control
boundary `--color-control-strong` (light `#7D8083`, sharing the control value;
dark `#6C7074`, the 2026-07-29 review's 3:1 dark candidate, registered here
for a narrower job than the one Amendment 20 rejected it for). The token's
contract: a control whose border is its WHOLE affordance — no
label-per-element, no content, no fill — MUST clear WCAG 1.4.11's 3:1 in
BOTH modes, dark included. This refines Amendment 20's dark adjudication
rather than reversing it: labeled, filled controls keep the quiet dark
boundary (identified by label + fill); the visible boundary is reserved for
controls that have nothing else. First consumer: the consent checkbox, which
also becomes custom-rendered (`appearance-none` + a drawn glyph) this date —
the UA-drawn box had ignored author borders entirely (computed width 0 in
Chromium) and painted a browser-chosen rim outside the token system, so no
token could reach it until rendering was taken over. Adjudicated from a
three-way side-by-side (browser-drawn / quiet / 3:1) by Mohamed. The OTP
digit boxes remain on Amendment 20's recorded quiet-dark residual pending
their own adjudication; they are the natural next consumer of this token.
MINOR bump: additive token + one control's adoption; no principle added,
removed, or restructured (Amendment 5/20 precedent). Hand-edited per the
Amendment 10 precedent.

Affected templates: none (templates reference Principle V by number, not by
literal palette values — re-checked; zero matches).

Cross-references:
- docs/DECISIONS.md entry 2026-08-05 (Amendment 21 / checkbox)
- docs/CHANGELOG.md entry 2026-08-05 (Amendment 21)
- .specify/memory/constitution.md Amendment 20 (the adjudication this refines)
- apps/web/components/consent/terms-acknowledgement-field.tsx
- apps/web/app/globals.css (`--color-control-strong`)

Amendment 22: 1.17.0 → 1.17.1 (2026-08-12, PATCH)
Bump rationale: Principle I terminology, following #198. Two bullets used
"check-in" for things that are not the camera session, and Principle I was
the LAST place in the project still doing so — the app, both legal
documents, the consent gates, Ren's prompt and feature 013's spec all moved
on 2026-08-12, leaving the rulebook contradicting the surfaces it governs.

(a) "the weekly employee check-in" → "the weekly work-environment survey".
The renamed concept, matching the shipped copy. No change to the invariant
the bullet carries: it is still a distinct employee-submitted class, still
reaches the manager-facing layer ONLY as an anonymized team-level
aggregate, and minimum-headcount suppression is still a pre-real-data
requirement.

(b) "a discreet check-in flag" → "a discreet talk request", plus one
sentence disambiguating it. This was NOT a find-and-replace: "check-in
flag" named a THIRD thing — neither the camera session nor the survey, but
an employee-initiated, content-free signal to a manager. It needed a real
name, so it got the one its own button already says. "Talk request" mirrors
the control's label ("I'd like to talk") so the thing and the button that
makes it share a vocabulary. "Conversation request" was rejected:
"conversation" is already the companion's word in the Privacy Policy
("Companion conversation"), and a manager-directed request must not read as
a request to talk to Ren. "Flag" was rejected outright — it reads as
something recorded ABOUT an employee, when this is something the employee
asked for, and that inversion is exactly the surveillance framing Principle
I exists to refuse.

Nothing to rename in code. "check-in flag" appears nowhere outside this
file, and the "I'd like to talk" button is unbuilt — a reserved layout slot
(spec 003 FR-006) and explicitly out of scope in spec 011. This amendment
touches normative prose only; no identifier, column, component, or route.

PATCH bump: terminology clarification. No principle added, removed, or
restructured; no requirement changed in force or scope (Amendment 6/7/11
precedent). Hand-edited per the Amendment 10 precedent. Approved explicitly
by Mohamed on 2026-08-12, and folded into the open PR #258 rather than a
second one, at his instruction.

Affected templates: none. Re-ran the Amendment 13 audit over
.specify/templates/{plan,spec,tasks,checklist,constitution}-template.md for
the touched literals (`check-in`, `weekly employee check-in`, `check-in
flag`, `work-environment`, `survey`, `talk request`) — zero matches; the
templates reference principles by number, not by these literals, so no
template edit is required (consistent with the Amendment 8–13 and 21
audits).

Cross-references:
- docs/DECISIONS.md entry 2026-08-12 (#198, and the Amendment 22 follow-up)
- docs/CHANGELOG.md entry 2026-08-12 (Amendment 22)
- docs/BACKLOG.md — "Terminology" section, #198
- specs/013-public-surface-and-legal/plan.md §11 (the amended spec rule)
- apps/web/lib/legal/copy.ts, apps/web/lib/consent/copy.ts (the shipped copy)
- GitHub #198, PR #258
-->

# Serenify Constitution

Serenify is a multi-modal workplace stress detection web platform built as a
graduation project by Fatma Al-Zahraa Emad, Gehad Mohamed, Hebatullah El
Gazoly, and Mohamed Assem (dashboard lead) at the domain `serenify.tech`. It
is trained and demonstrated on the StressID dataset (Inria + EURECOM,
NeurIPS 2023 Datasets & Benchmarks Track) under a non-commercial academic
license — research and demonstration only.

This document is the project rulebook. Every pull request, feature spec,
plan, task list, and design artifact MUST comply. Violations are blocking.
Conflicts between this constitution and any other document are resolved in
favor of the constitution unless an amendment is logged per the Governance
section.

## Core Principles

### I. Privacy by Architecture (NON-NEGOTIABLE)

Privacy is engineered into the data flow, not bolted on by policy. The
following invariants MUST hold at all times:

- Raw video frames, raw audio waveforms, and raw physiological waveforms
  (rPPG-derived or sensor-derived) MUST NEVER leave the device or backend
  inference layer to reach the manager-facing layer. Managers see only
  graded stress levels, aggregates, and trends derived downstream of model
  inference.
- Per-individual stress trends ARE visible to a direct manager. This is an
  intentional product decision aligned with Serenify's "be heard and felt"
  philosophy — not a surveillance tool. Employees control granularity via a
  three-position privacy slider: `full detail` / `summary only` (DEFAULT) /
  `off during specified hours`.
- Voluntary work-environment feedback — the weekly work-environment survey (an
  overall sentiment and, when negative, a roadblock selection plus a
  desired-support selection) — is a distinct employee-submitted class, separate
  from stress signals. It reaches the manager-facing layer ONLY as an
  anonymized, team-level aggregate, NEVER as an individual employee's
  attributed answer. The aggregation hardening that makes this robust on small
  teams (minimum-headcount suppression, so a tally cannot be traced back to one
  person) is a tracked pre-real-data privacy requirement: deferred for the demo
  build, REQUIRED before any real employee data is collected.
- Every employee MUST have access to a "this is what your manager sees right
  now" transparency view from their settings page, rendering the exact data
  visible to their direct manager.
- An opt-in "I'd like to talk" button MUST surface a discreet talk request
  to the direct manager. It MUST NOT reveal what triggered the request. A
  talk request is neither a check-in nor a survey response: it carries no
  reading, no answer, and no reason — only that the employee asked.
- Conversations with the in-app companion (chat text, titles, and any
  derived stress band) are employee-private content. They MUST NEVER reach
  the manager-facing or admin-facing layer — the same boundary as raw
  signals. A chat-derived band appears only on the owning employee's own
  surfaces.
- A crisis disclosure (suicidal ideation, self-harm, or intent to harm
  others) MUST NEVER trigger any manager, admin, or employer notification,
  and MUST NEVER be persisted as a stored property of a conversation.
  Crisis support routes only to verified external resources or a person the
  user themselves chooses. Routing a mental-health crisis into the employer
  chain is a permanent, non-negotiable prohibition.
- **Public-communication rule.** Any public-facing or user-facing text that
  describes manager visibility — landing page, legal documents, consent
  surfaces, marketing copy — MUST describe the end-state above honestly, and
  MUST mark any control that is not yet live as not yet live. It MUST NOT
  imply a control exists before it ships: the three-position privacy slider
  and the transparency view arrive with feature 018
  (`privacy-controls-and-transparency`), and copy written before then MUST say
  so. It MUST NOT overclaim in the other direction either. Companion chat
  content and crisis disclosures genuinely never reach a manager, admin, or
  employer; stress-trend summaries ARE manager-visible by default, at the
  `summary only` granularity. That distinction MUST be preserved in copy and
  MUST NOT be flattened into a blanket "nothing reaches a manager." A privacy
  promise published to the public is durable: copy that promises less
  visibility than this principle designs becomes a lie the day that
  visibility ships.
- Manager hierarchy: a direct manager sees their direct reports only.
  Skip-level managers and above see only aggregated org-wide data and MUST
  NEVER see individual employees.
- The 12 StressID subjects who withheld image-diffusion consent — subject
  IDs `dmbd, 45lx, cxj0, 5f7t, y9z6, u3v9, 7m3c, x1q3, 9j3o, c3m7, a1k9,
  h8s1` — MUST NEVER have their video frames surfaced in any public-facing
  demo, screenshot, screencast, thesis figure, marketing site, or
  documentation.

**Rationale**: Workplace stress monitoring is a high-trust domain. Any
ambiguity about what leaves the device, what a manager sees, or what a
subject consented to is unacceptable. These rules are architectural, not
configurable.

### II. Subject-Disjoint ML Evaluation (NON-NEGOTIABLE)

Reported model metrics MUST come from subject-disjoint splits keyed on
subject ID — `LeaveOneGroupOut` (LOSO) or `GroupKFold`. Random
record-level splits are forbidden for any reported number.

Additional ML rules:

- Per-subject baseline normalization is REQUIRED for physiological features:
  every subject's feature vectors MUST be centered against that subject's
  Baseline/Relax recording before training or evaluation.
- Per-user calibration is REQUIRED at runtime. Every user completes a
  ~60-second calm baseline on first login. All predictions delivered to the
  app MUST be deltas from that baseline, not absolute thresholds. Calibration
  data lives in the user's Supabase row.
- Inference at deployment time MUST use rolling 60-second windows with a
  10-second stride for the video pipeline. Shorter windows degrade recall on
  the stress class for the production model; the window duration is set by the
  model contract documented in `docs/MODELS.md`.
- Pre-trained model artifacts MUST live in `packages/ml-*/models/` and MUST
  have a versioned entry in `docs/MODELS.md` recording: model name, training
  date, evaluation method, macro-F1, per-class recall, confusion matrix
  link, and dataset version. Models without a `docs/MODELS.md` entry MUST
  NOT be loaded in production.

**Rationale**: StressID is small and subject-correlated. Random splits leak
identity and inflate metrics, producing models that fail on unseen users.
Per-subject normalization and per-user calibration absorb between-subject
variance and let the system generalize beyond the dataset.

### III. Modality Isolation

Each input modality is isolated into its own package, behind a common
inference interface:

- `packages/ml-video/` — video stress pipeline (LBP-TOP + motion features, per-user delta calibration)
- `packages/ml-audio/` — vocal stress features
- `packages/ml-physio/` — direct sensor signals (HR, EDA, etc.)

Each package MUST expose the same inference contract (input shape, output
schema, confidence/quality signal). Adding a new modality MUST be a config
change in the inference service plus a new package — never a rewrite of
shared code. Cross-modality fusion lives in a separate fusion layer (see
feature 022) and consumes the common interface only.

**Rationale**: Modalities arrive at different times (video first, then
audio, then physio, then fusion). Coupling them would force every modality
addition to thrash the inference service. Isolation also makes per-modality
testing tractable.

### IV. LLM Provider Abstraction

All LLM access MUST go through a single `LLMProvider` adapter interface in
`packages/llm-client/`. Application code MUST NEVER import a vendor SDK
directly.

- Primary provider: Groq — `openai/gpt-oss-120b` via API, run at
  `reasoning_effort="low"`. (gpt-oss is a reasoning model; its reasoning
  returns in a separate field, and the adapter MUST tolerate occasional
  leakage of reasoning into `content` with a defensive extractor.)
- Fallback provider: local LM Studio (`openai/gpt-oss-20b`, same model
  family as primary) exposed via Cloudflare Tunnel.
- Provider selection MUST be controllable by config — swapping providers
  MUST NOT require code changes outside `packages/llm-client/`.
- All prompts MUST live as versioned files in
  `packages/llm-client/prompts/`. Inline prompt strings in application code
  are a constitutional violation.
- The chatbot MUST implement dual-mode stress detection: a cheap per-message
  stress-score prompt (every turn) and a session-level rollup prompt (every
  N turns) that reconciles with the physiological signal stream.

**Fine-tuning clause (open decision, must close before audio modality lands
in feature 020):** Default is prompting-only. If the team chooses to
fine-tune later, the fine-tuned model MUST (a) be served behind the same
`LLMProvider` interface so app code does not change, (b) be evaluated on a
documented held-out set with metrics published in `docs/MODELS.md`, and
(c) NEVER be trained on real Serenify user data — only public or synthetic
data is permissible. The open decision MUST be logged in
`docs/DECISIONS.md` until resolved.

**Rationale**: Provider lock-in and prompt sprawl are the two failure modes
for LLM-driven products. The adapter and versioned prompt directory
neutralize both. The training-data restriction protects user trust.

### V. Calm-First Design Language

Serenify's surface MUST feel calm. Calm is enforced by these
non-negotiable rules:

**Palette — "Graphite"** (refreshed values of the former "Mist & Meadow"
system; locked, no additions without amendment). Semantic role token names are
unchanged — only the values are deepened. Light and dark are designed in tandem
and every documented pairing meets WCAG AA:
- Light: bg `#EAEBEC`, surface `#F4F5F6`, ink `#1C2023`, muted `#585D61`,
  meadow accent `#3E7A63`, foggy accent `#356E88`, amber `#C98637`,
  crimson `#894A4E`, border `#D7D9DC`, control border `#7D8083`.
- Dark: bg `#101214`, surface `#181B1E`, text `#E2E5E8`, muted `#939A9F`,
  meadow accent `#63B292`, foggy accent `#74B6CE`, amber `#E4AE5C`,
  crimson `#C98589`, border `#23272B`, control border `#23272B` (deliberately
  the seam value — see the boundary-split bullet), empty-affordance control
  border `#6C7074` (Amendment 21).
- **Boundary split (Amendment 20):** `--color-border` is the decorative seam —
  dividers, card outlines, chrome hairlines — deliberately quiet.
  `--color-control` is the control boundary — text inputs, textareas, the
  consent checkbox, OTP digit boxes, and outlined controls, where the border
  is part or all of the affordance. In LIGHT mode it MUST clear 3:1
  (WCAG 1.4.11) against its adjacent surfaces, and a resting control never
  wears the seam token there. In DARK mode the control boundary deliberately
  keeps the quiet seam value: the 3:1 dark candidates were built and rejected
  on looks at ratification (Amendment 20's bump rationale records the
  adjudication and the accepted OTP-box residual). Every control site reads
  through the token, so the dark call is re-adjudicable in one place.
  **Empty-affordance refinement (Amendment 21):** a control whose border is
  its WHOLE affordance — no label-per-element, no content, no fill — takes
  `--color-control-strong` (light `#7D8083`, dark `#6C7074`) and MUST clear
  3:1 in BOTH modes: the quiet-dark permission above rests on label + fill
  identifying the control, which an empty box does not have. Adopted by the
  consent checkbox (custom-rendered, since the UA-drawn box ignored author
  tokens); the OTP digit boxes remain on the recorded quiet-dark residual
  pending their own adjudication.
- **Filled-accent foregrounds (AA):** on filled meadow or foggy action surfaces
  (primary and attention CTAs) the foreground text MUST be near-white in light
  mode and the `bg` token in dark mode. The deepened accents fail AA with ink
  foreground; this replaces the prior ink-on-accent treatment. Soft accent
  tints (e.g. a `foggy/10` attention banner) keep ink-token text.
- **Supporting tokens (registered here, values unchanged from feature 007):**
  `--color-on-accent` (the near-white filled-accent foreground above; light
  `#F8F9FA`, and in dark mode the `bg` token is used instead — this token does
  NOT swap) and `--color-scrim` (`rgba(28, 32, 35, 0.60)` — Graphite ink at 60%,
  fixed in both modes). Both shipped in feature 007 and have been in use since;
  they are named here for the first time to close the registration gap that
  Amendment 17 identified and deferred. Documentation only — neither value
  changes.
- **Identity marks and the band scale.** A mark that identifies a persistent
  non-human entity in the product MUST NOT use an accent that carries band or
  outcome meaning — currently `meadow`, `amber`, or `crimson`. A meadow Ren
  sitting beside a stress reading looks like it is asserting that reading is
  calm; the mark would encode a state it does not have. **Ren's mark MUST be
  `foggy`**, in both modes, at every site that renders it. This RATIFIES
  EXISTING PRACTICE: a foggy Ren already ships in production on the landing
  page's companion panel. `foggy` is today the only accent outside the band
  scale, which is why it is the one Ren wears — but the rule on the class is
  the prohibition above, not a requirement that every future identity mark be
  foggy specifically. This permission is scoped to identity marks: it does NOT
  make `foggy` available as a decorative or brand fill for ordinary surfaces,
  and `foggy`'s attention/error role in Principle V is otherwise unchanged.
  Filled identity marks take the filled-accent foreground pair above —
  `--color-on-accent` in light, the `bg` token in dark (measured on filled
  foggy: 5.33:1 light, 8.34:1 dark).
- **Named exception — Ren's chat surface and its entry points may be foggy.**
  Ren's chat surface, and the controls whose sole purpose is to open it, MAY use
  filled or text `foggy` in place of `meadow` for accent-carrying elements —
  primary actions, sent-message bubbles, accent text links, and focus
  indicators. Where the surface takes this treatment it MUST take it
  CONSISTENTLY: a surface that leaves some accent controls meadow and turns
  others foggy is worse than either, because a lone meadow control among foggy
  ones reads as a defect rather than as emphasis. That cohesion — not a
  preference for the hue — is the entire justification, and it is why this
  permission is stated at the level of a surface rather than of a control.
  THIS IS ONE NAMED SURFACE, NOT A LOOSENING. `meadow` remains the required
  fill for primary and forward actions everywhere else in the product, and
  `foggy` remains unavailable for forward actions on any other surface. The
  entry-point clause reaches only controls that exist to open Ren — today the
  floating chat pill — and does NOT extend foggy to the surfaces those controls
  happen to float over: a dashboard hosting a foggy Ren pill keeps meadow for
  its own actions. A future surface wanting this treatment needs its own
  amendment, not a reading of this one. Nothing about `meadow`'s
  calm/affirmative role changes.
- **Amber stress signal:** the amber role is a soft-tint notice treatment — a
  light amber tint background with deep same-family text (light: tint `#F4E3C6`
  / text `#8A580F`; dark: tint `#3B2F19` / text `#E6C386`), alongside amber as
  a graphic/indicator hue (values above). Dark ink on a solid-amber fill is
  forbidden (fails AA and reads muddy). The amber family is tokenized for the
  stress-signal role (Amendment 5): `--color-amber-text` (chip + label text;
  light `#8A580F` / dark `#E6C386`; AA-safe small text on the tint and the card
  surface), `--amber-tint` (chip background; `#F4E3C6` / `#3B2F19`),
  `--amber-soft-line` (the mid "a little tense" graph line; `#D49A4A` /
  `#E8BC7A`), and `--amber-head` (headline keyword at weight 700 — large text;
  `#BC7A2A` / `#E4AE5C`). The bright graphic `--color-amber` is for graph
  lines/markers ONLY, never small text (it fails small-text AA at 2.77:1).
- **Red is forbidden on affective and ambient surfaces** — stress detection
  states, physiological indicators, charts, status badges, notifications, and
  any in-product affective copy or imagery. Stress signals use the amber role
  (above) in both modes. Red IS permitted on **destructive action surfaces**
  (delete-account, leave-team, revoke-session, inline destructive text links)
  using the Mist & Meadow `crimson` token, because hiding visual urgency on
  irreversible user actions is hostile design. The `red`, `#FF0000` family, and
  any hue in the 340–20° red sector MUST NOT appear on affective or ambient
  surfaces; only the documented `crimson` token may appear on destructive
  action surfaces.

**Visual finish**:
- Flat base. Optional 3–5% paper-noise texture on the page background ONLY,
  toggled via a `--texture-opacity` CSS variable.
- No glassmorphism anywhere — not in cards, modals, navs, or overlays.
- Elevation MUST use 0.5px borders and a soft `0 1px 2px rgba(0,0,0,0.04)`
  shadow. Aggressive lifts and large drop shadows are forbidden.
- Corner radii are 8–20px (the 20px `rounded-2xl` card radius was admitted in
  Amendment 6 to match the 007 redesign and shipped cards). Sharp corners
  (≤4px) are forbidden on interactive surfaces.
- Whitespace is generous; cramming is a violation. White space signals
  calm.

**Typography**: Inter for all UI/body text. Outfit is the display/heading
typeface — wordmark, page and section headings, card titles, and large numerals
— and MUST NOT be used for body, buttons, labels, or chart text. Outfit and
Inter are both self-hosted under the SIL Open Font License; DM Serif Display is
retired.

**Wordmark**: `serenify` is a **two-colour** wordmark — `seren` in the `ink`
token, `ify` in the `meadow-text` token — always lowercase, and never carrying
a dot or other terminal punctuation. Within the web app's React tree it MUST be
defined **once**, as a single shared component, and reused at every site that
renders it; re-typing the markup at a new site is a violation. Two classes of
render site sit outside that tree and cannot consume the component — the
`next/og` social card (Satori cannot load the app's fonts) and the Supabase
transactional email templates (inline-styled HTML) — so they MUST be kept in
sync by hand, and any change to the wordmark MUST update them in the same PR.

This introduces **no new token and changes no token value**: `ink` is in the
palette above, and `--color-meadow-text` (light `#346A56` / dark `#63B292` —
the AA-safe small-meadow text added by feature 007, `docs/DECISIONS.md`
2026-06-18) is named here for the first time, closing a gap where a shipped
Graphite token had never been registered in this principle. What changes is an
application rule for an existing element.

**Iconography**: Lucide library only. Stroke weight MUST be consistent
across the surface.

**Voice & copy**:
- Calm, not perky. No exclamation marks in default copy.
- Never alarmist. Prefer "noticed something" over "detected". Avoid
  clinical or warning language ("alert", "abnormal", "elevated risk").
- First-person plural is acceptable occasionally ("we're seeing this
  trend") — Serenify is a partner, not a surveillance system.
- Never moralize. Suggest, don't prescribe. ("Want to take a break?" not
  "You should take a break.")

**Rationale**: A stress-detection product that looks or sounds alarming is
self-defeating. The palette and voice are the product's primary
intervention — they must not betray the goal.

### VI. Responsive & Accessible by Default

Every screen MUST function correctly at 360px minimum viewport width and
adapt cleanly up to desktop. Mobile-first responsive design is required.

- Touch targets MUST be ≥ 44×44px on touch-capable viewports.
- Both light and dark modes are equal-priority. They MUST be designed in
  tandem — no "we'll add dark mode later" shortcuts.
- `prefers-color-scheme` MUST be respected by default, with a manual
  override available to the user.
- `prefers-reduced-motion` MUST be respected. Framer Motion is permitted
  but only when motion is subtle and opt-out is wired. Heavy parallax,
  large translate animations, and auto-playing motion are forbidden.

**Rationale**: Employees access wellness tools across phones and desktops,
in offices and at home. Excluding mobile or motion-sensitive users is
inconsistent with the brand stance of "be heard and felt."

### VII. Mandatory Testing Per PR

Every PR MUST ship with tests appropriate to the layer it touches. Merges
without passing tests are forbidden.

- **Backend**: pytest for FastAPI routes and ML pipeline functions. Target
  coverage ≥ 70% on business logic (router handlers, pipeline transforms,
  service modules). UI glue and boilerplate are exempt from the 70% floor
  but MUST still have at least one happy-path test where they exist.
- **Frontend**: Vitest + React Testing Library for component logic.
  Playwright provides one end-to-end happy-path test per role (`employee`,
  `team_lead`, `admin`). These three Playwright tests are part of the CI
  gate.
- **ML packages**: pytest with locked fixture-based regression tests on
  representative StressID feature vectors. The fixtures MUST catch
  preprocessing regressions (e.g., a baseline-normalization bug would
  change the fixture output and fail the test).
- **Smoke tests**: every feature MUST ship with a `smoke-tests.md` in its
  `specs/NNN-feature-slug/` folder listing human-validated checks
  (e.g., webcam permission flow on Safari, low-light signal quality,
  mobile viewport behavior). Mohamed runs these manually after
  `/speckit.implement` completes; results MUST be recorded in the file.

**Rationale**: ML systems with multi-stage preprocessing fail silently in
ways that unit tests miss. Fixture-locked regression tests, role-scoped
e2e, and human smoke tests together catch the failure modes that any one
layer alone would miss.

### VIII. Spec-Driven Workflow

Serenify is built with SpecKit. Work proceeds spec → plan → tasks →
implement, in that order. Implementation without a spec is forbidden.

- Each feature lives in `specs/NNN-feature-slug/` and MUST contain
  `spec.md`, `plan.md`, `tasks.md`, and `smoke-tests.md`.
- Decisions are logged append-only in `docs/DECISIONS.md`. Decisions are
  never deleted; reversals are appended as new entries that reference the
  original.
- Progress is tracked in `docs/PROGRESS.md`.
- Spec amendments (deviations from an approved spec discovered during
  implementation) are logged in `docs/CHANGELOG.md`, since SpecKit itself
  has no formal amendment mechanism.
- Follow-up items deferred from features live in `docs/BACKLOG.md` (the source
  of truth) and are mirrored 1:1 to GitHub Issues — opened when the follow-up is
  logged, closed when it is fixed, both in the same change. Issues never diverge
  from BACKLOG; on conflict, BACKLOG wins. Label taxonomy and operational detail
  are recorded in `docs/DECISIONS.md`.
- Whenever a feature changes what data is collected, where it goes, who can
  see it, or how long it is retained, the Privacy Policy and Terms of Service
  MUST be reviewed and updated in the same PR.
- Claude Code MAY commit and push its own work directly to feature
  branches. Mohamed reviews PRs/commits before merging branches to `main`.
- Provisional feature ordering (subject to change; record changes in
  `docs/CHANGELOG.md`):
  `001-auth-and-roles`, `002-demo-seed-data`,
  `003-employee-dashboard-shell`, `004-onboarding-video-anchor`,
  `005-per-user-calibration`, `006-calibration-capture-quality`,
  `007-visual-redesign`, `008-stress-inference-service`,
  `009-today-card-trend-redesign`,
  `010-monitoring-graph-redesign`,
  `011-llm-client-and-chatbot`,
  `012-questionnaire`, `013-public-surface-and-legal`,
  `014-recommendations`, `015-personalization-onboarding`,
  `016-preferences-hub`, `017-team-lead-dashboard`,
  `018-privacy-controls-and-transparency`, `019-admin-dashboard`,
  `020-audio-modality`, `021-physio-modality`, `022-fusion`.

**Rationale**: A four-person team building an ML product needs a single
source of truth per feature. Spec-driven development makes scope explicit,
makes decisions auditable, and prevents the "what were we building again?"
failure that kills graduation projects.

### IX. Secrets Discipline (NON-NEGOTIABLE)

Secrets MUST NEVER appear in the repository.

- `.env.local`, `.env.production`, and any `*.env` file MUST be gitignored.
- Production secrets are set in the Vercel, Azure, and Supabase
  environment-variable panels — never in code, never in committed config,
  never in CI workflow YAML in plaintext.
- Hardcoded API keys, hostnames pointing at private services, database
  connection strings, JWT signing secrets, or LLM API tokens in any
  committed file are a constitutional violation. Review MUST block the
  merge and the secret MUST be rotated immediately.
- Mohamed's personal secrets reference file at
  `<local secrets file>` is reference-only and MUST NEVER
  be pasted into the repository, into commits, into PR descriptions, into
  issue comments, or into any committed documentation. Claude Code MUST
  NOT read from or echo this file into any committed artifact.

**Rationale**: Leaked credentials are the highest-impact, hardest-to-undo
mistake in a public graduation-project repo. Treating any secret in a
diff as a hard block — not a warning — is the only reliable defense.

### X. Dataset Stewardship (NON-NEGOTIABLE)

The StressID dataset is licensed for non-commercial academic use only.

- No Serenify-derived product feature may be commercialized while it uses
  StressID data, directly or indirectly (including fine-tuned weights and
  derived statistics).
- The 12 subjects who withheld image-diffusion consent (listed in
  Principle I) MUST NEVER appear in public-facing artifacts of any kind:
  screenshots, screencasts, thesis figures, posters, presentations,
  marketing pages, social posts, or external documentation. This applies
  to derived visualizations too (e.g., a face-keypoint overlay over one of
  their frames).
- Demo accounts in the application MUST use synthetic names. The real
  teammate names (Fatma, Gehad, Hebatullah, Mohamed) are reserved for the
  public "About / Team" page only and MUST NOT be used as demo employees,
  test fixtures, or sample manager rows.

**Rationale**: A signed academic license is a real obligation. Violating
consent terms — even unintentionally, on a single thesis figure — is the
kind of mistake that ends academic careers and reputations.

## Technology Stack (Locked)

The following stack is locked. Any substitution requires a constitutional
amendment (see Governance) and a decision entry in `docs/DECISIONS.md`.

| Layer                | Technology                                                |
|----------------------|-----------------------------------------------------------|
| Frontend             | Next.js 16 (App Router; `proxy.ts` replaces `middleware.ts`) on Vercel |
| Backend + ML serving | FastAPI on Azure Container Apps (Azure for Students)            |
| Database / Auth / Storage / Realtime | Supabase (Postgres-based)                  |
| Primary LLM          | Groq — `openai/gpt-oss-120b` (`reasoning_effort=low`) via API |
| Fallback LLM         | Local LM Studio (`openai/gpt-oss-20b`) via Cloudflare Tunnel |
| Transactional email  | Resend, live as Supabase Auth's custom SMTP provider (dashboard-configured; no repo footprint by design) |
| DNS / CDN / Tunnel   | Cloudflare (free tier)                                    |
| Error tracking       | Sentry                                                    |
| Product analytics    | PostHog Cloud                                             |
| CI/CD                | GitHub Actions                                            |
| Component library    | shadcn/ui (install deferred until feature 003 per `docs/DECISIONS.md`) |
| Styling              | Tailwind CSS v4                                           |
| Icons                | Lucide                                                    |
| Charts               | Recharts                                                  |
| Animation            | Framer Motion (sparingly, `prefers-reduced-motion` respected) |
| Type system (FE)     | TypeScript strict mode                                    |
| Type system (BE)     | Python type hints + Pydantic                              |

**Charting carve-out (Amendment 7):** Recharts is the locked default for standard
dashboard data charts. A narrow exception applies to bespoke affective
micro-visualizations — specifically feature 009's employee today-card stress
trend — which MAY use hand-authored inline SVG. The reason is bespoke geometry:
the trend is a custom lane-geometry visualization (run-collapsed lanes, a custom
stress-band-to-Y encoding, no-read markers, a step-line) that is not a standard
Recharts chart type, so expressing it in Recharts would mean working against the
library's chart abstractions; it also requires pixel-exact, non-stretched
rendering (DC-001: 1 SVG unit = 1 screen pixel). This exception does NOT authorize
a general charting-library substitution, which still requires its own amendment.
Origin: `docs/DECISIONS.md` 2026-06-22 (Decision 4).

TypeScript strict mode and Python type hints are mandatory across all
application code. `any` (TS) and untyped `Any`/`dict` (Python) MUST be
justified in code review if introduced.

## Architecture Constraints

**Repository structure (target):**

```text
serenify/
├── .specify/memory/constitution.md
├── specs/NNN-feature-slug/{spec.md, plan.md, tasks.md, smoke-tests.md}
├── docs/{DECISIONS.md, PROGRESS.md, CHANGELOG.md, MODELS.md}
├── CLAUDE.md
├── apps/web/                    # Next.js frontend
├── apps/api/                    # FastAPI backend
└── packages/{ml-video, ml-audio, ml-physio, llm-client}
```

Deviations from this layout require a decision entry in
`docs/DECISIONS.md`.

**Transport rules:**

- Frontend talks to backend via a typed API client. Untyped `fetch` calls
  in application code are forbidden.
- Real-time prediction streams and live signal-quality indicators travel
  over WebSockets, not polling.

**Boundary rule:**

- Raw signal data (frames, audio buffers, raw waveforms) MUST stay within
  the backend inference layer. Any module outside `apps/api/` and
  `packages/ml-*` that touches a raw signal type is a constitutional
  violation and MUST be flagged in review.

## Development Workflow & Quality Gates

The following gates MUST pass before a feature branch may be merged to
`main`:

1. **Spec gate** — `spec.md`, `plan.md`, `tasks.md`, and `smoke-tests.md`
   all exist in `specs/NNN-feature-slug/` and are populated (no
   placeholder bracket tokens remain).
2. **Constitution Check** — the plan's Constitution Check section
   explicitly addresses each affected principle. Violations require a
   `Complexity Tracking` entry justifying them.
3. **Test gate** — backend (pytest), frontend (Vitest + RTL), Playwright
   role e2e (where touched), and ML fixture tests all pass in CI.
4. **Secrets scan** — no new `*.env*` files, no hardcoded keys, no
   pointers to private services in committed code (Principle IX).
5. **Smoke test gate** — Mohamed has signed off on `smoke-tests.md` for
   the feature, with results recorded in the file.
6. **Privacy review** — for any feature touching signal capture, signal
   transport, manager-facing views, or aggregation: an explicit note in
   `plan.md` confirming Principle I invariants hold.
7. **Mohamed's review** — Claude Code may push to feature branches;
   Mohamed reviews and approves the merge to `main`.

## Governance

This constitution supersedes all other practices, conventions, and
preferences in the repository. Where `CLAUDE.md`, agent-specific guides,
or informal team conventions conflict with this document, the constitution
wins.

**Amendments:**

- Any team member may propose an amendment by opening a PR that modifies
  `.specify/memory/constitution.md` and adds an entry to
  `docs/DECISIONS.md` describing the change and rationale.
- Amendments require approval from Mohamed (project lead).
- The amendment PR MUST update the version line at the bottom of this
  file per semantic versioning:
  - **MAJOR** — removal or backward-incompatible redefinition of a
    principle, or removal of a numbered section.
  - **MINOR** — addition of a new principle or section, or materially
    expanded guidance.
  - **PATCH** — clarifications, wording, typos, non-semantic refinements.
- The Sync Impact Report HTML comment at the top of this file MUST be
  updated to reflect the change.
- Any templates referencing changed content MUST be updated in the same
  PR, or explicitly listed as deferred in the Sync Impact Report.

**Compliance review:**

- Every PR description SHOULD reference any principle it materially
  intersects with (e.g., "Touches Principles I, V, VII").
- Mohamed performs a final compliance read before merging to `main`.
- Quarterly (every ~3 months while the project is active) a brief
  retro entry in `docs/PROGRESS.md` confirms the constitution is still
  reflecting reality. Drift discovered in retro MUST be resolved via
  amendment, not silence.

**Authority of this document:**

- This file is the rulebook that gates every future PR.
- Claude Code, all human contributors, and any automated tooling MUST
  treat the principles above as binding. Where a principle is marked
  NON-NEGOTIABLE, even a unanimous team override requires a logged
  amendment first — the rule must change in writing before behavior may.

**Version**: 1.17.1 | **Ratified**: 2026-05-16 | **Last Amended**: 2026-08-12
