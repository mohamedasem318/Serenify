# Implementation Plan: Live "This session" monitoring-graph redesign (009b)

**Branch**: `010-monitoring-graph-redesign` | **Date**: 2026-06-25 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `specs/010-monitoring-graph-redesign/spec.md`

**Visual authority**: `serenify-live-session-graph-mock.html` (repo root, signed off by Mohamed — "match this"). **Constitution**: v1.8.0 governs (Principle VIII slot `009b`; Amendment 7 charting carve-out; DC-001 fixed-px).

## Summary

Redesign the live **"This session"** within-session monitoring graph — the card below the camera stage on the monitor page (`apps/web/components/monitor/session-trend.tsx`) shown while an employee is actively recorded. The work is **frontend-only inside `apps/web`**: it **consumes the existing, unchanged read layer** (`getSessionTrend` in `lib/api/monitoring-reads.ts`, already wired in `monitoring-session.tsx`) and re-renders it. No RLS, auth, data-model, API, or whitelist change; no probability reaches the client.

It is **not purely visual** — it adds real state handling the current component discards: it starts consuming `skipCause` and the warming-vs-skip distinction, splits no-reads into three honest treatments (warming dashed line · out-of-frame foggy gap · no-clear-read muted gap), and it is **honesty-critical** (the graph must never assert something the pipeline can't know).

The technical core is the same **fixed-pixel SVG rendering** as feature 009 (DC-001: 1 SVG unit = 1 screen pixel, intrinsic `width` == `viewBox` width, **no** stretched viewBox), but the geometry differs: this is a **single continuous step-line across one session's capture windows** (band → colour, band → height) on a **uniform slot per capture window** x-axis with a **rolling ~2-minute window** (decided in clarify/checklist: F1), not 009's run-collapsed per-session lanes. A single live **"now" marker** sits at the right edge and recolours to the current band (parks muted + static during an active no-read).

The redesign **replaces** today's stretched coordinate space (`viewBox="0 0 100 40"` + `preserveAspectRatio="none"` — the totem/oval bug) and today's single meadow line + lone amber peak dot.

**No data-layer, page-layout, or token changes are required** — the camera card and the trend card already share the monitor page's `max-w-3xl` column (matched-pair width holds by existing layout), and every colour token the mock needs (`--color-meadow/amber/foggy/muted`, `--amber-soft-line`) already exists in `globals.css` in both themes. The work is a clean internal swap of one component plus one new pure geometry module.

**All copy is now signed off** (2026-06-25): the FR-024 neutral no-read subtitle line = **"No clear read right now"** (research R-7); FR-022's three no-read labels were already approved ("getting a read" / "step back into frame" / "no clear read"). No copy decision remains open.

## Technical Context

**Language/Version**: TypeScript (strict) on Next.js 16 (App Router), React; Tailwind CSS v4.

**Primary Dependencies**: existing `lib/api/monitoring-reads.ts` `getSessionTrend` (consumed as-is); repo reduced-motion hook (`hooks/use-media-query.ts` / `usePrefersReducedMotion`, as feature 009 used); a `ResizeObserver`/ref to read the rendered container width for fixed-px; hand-authored inline SVG (NOT Recharts — Amendment 7 carve-out). No new runtime dependencies, no new tokens.

**Storage**: N/A — read-only client consumption of the existing Supabase RLS SELECT (`SESSION_TREND_COLUMNS = "id, captured_at, scored, band, skip_cause"`) run as the signed-in user. No schema, RLS, or whitelist change.

**Testing**: Vitest + React Testing Library (component + a new pure-geometry unit module — the bulk of the Success-Criteria mapping); the existing monitor/employee Playwright happy-path extended lightly (no-read treatment renders, no probability). `smoke-tests.md` authored at implement time (Constitution VII / gate 5).

**Target Platform**: Web (Vercel). Mobile-first from a 360px viewport floor up to desktop; light + dark equal-priority.

**Project Type**: Web application — frontend-only change within `apps/web`, one component + one pure module.

**Performance Goals**: static SVG re-rendered on the existing ~12s poll; the only animation is the now-marker pulse (CSS), suppressed under reduced-motion; 60fps interaction. The rolling window caps the drawn windows (~10–12), so the SVG stays small regardless of session length.

**Constraints (non-negotiable, from spec + DC-001)**: fixed-px rendering (1 unit = 1px, no stretched viewBox → true circles, SC-001); fill the container width / matched pair with the camera stage (FR-002/SC-002); uniform slot per capture window + rolling ~2-min window (FR-002a/SC-012); amber = stress only, foggy = attention (gated), warming/no-clear-read = muted, **no red** (FR-016); no numeric probability ever (FR-017/SC-007); RLS-as-user + SELECT whitelist intact (FR-020).

**Scale/Scope**: one session, growing live; the rolling window bounds the drawn set to the most recent ~2 minutes (~10–12 windows at the 10s capture stride); older windows scroll off / drop oldest before slots shrink below the legibility floor (FR-002a).

## Constitution Check

*GATE: evaluated against constitution v1.8.0. Re-checked after Phase 1 design (unchanged — no new violations introduced).*

| Principle | Verdict | Notes |
|---|---|---|
| **I. Privacy by Architecture** (NON-NEGOTIABLE) | ✅ PASS | Consumes the existing owner-scoped `getSessionTrend` read run **as the signed-in user**; **no probability** reaches the client (FR-017/SC-007); SELECT whitelist intact (`band`/`skip_cause` owner-readable; `label`/`stress_probability` never selected); no new read surface; no raw signals. This is the employee's **own** live self-view (not manager-facing), so the manager-visibility invariants are not engaged. Privacy review note below (gate 6). |
| **II. Subject-Disjoint ML Eval** (NON-NEGOTIABLE) | ✅ N/A | No model training/eval; pure read + render. |
| **III. Modality Isolation** | ✅ N/A | Frontend only; no modality package touched. |
| **IV. LLM Provider Abstraction** | ✅ N/A | No LLM. |
| **V. Calm-First Design** | ✅ PASS | Amber = stress signal (bands), foggy = attention (out-of-frame, **gated OFF at launch** FR-015), warming + no-clear-read = muted; **no red anywhere** (FR-016); voice calm (no exclamation, no alarmist copy). **No palette change** — every token the mock needs already exists in `globals.css` both themes (incl. `--amber-soft-line` from 009, reused per FR-023). No amendment required. |
| **VI. Responsive & Accessible** | ✅ PASS | Mobile-first 360px floor → desktop; light+dark in tandem; **reduced-motion** suppresses the now-marker pulse → static halo (FR-006/SC-006) and the no-read "fades" are static opacity (not motion, FR-013); now-marker keyboard-reachable with focus-visible popup + accessible label (FR-007/FR-008/SC-005); touch target ≥44px (the now-marker hit-area is r=15 ≈30px in the mock → **must be enlarged to ≥44×44 on touch viewports** — design note, CHK-adjacent). |
| **VII. Mandatory Testing Per PR** | ✅ PASS (strategy defined) | Vitest+RTL + a new pure-geometry unit module mapped to SC-001…SC-013; existing monitor Playwright happy-path extended; `smoke-tests.md` at implement time. |
| **VIII. Spec-Driven Workflow** | ✅ PASS | `spec.md` + this `plan.md` present; `tasks.md` + `smoke-tests.md` follow. Slot `009b` ratified (Amendment 10). BACKLOG↔Issues: the foggy-gate trigger is already back-referenced in issue #100 + `docs/BACKLOG.md`. |
| **IX. Secrets Discipline** (NON-NEGOTIABLE) | ✅ N/A | No secrets, env, or private hostnames touched. |
| **X. Dataset Stewardship** (NON-NEGOTIABLE) | ✅ N/A | No StressID frames/figures; renders the employee's own derived bands only; no real-teammate names as fixtures. |

**Pre-existing transport note (not introduced by this feature):** Architecture Constraints state live signal streams "travel over WebSockets, not polling." The current `session-trend.tsx` (and its wiring in `monitoring-session.tsx`) **polls** `getSessionTrend` every ~12s — this predates this feature (shipped in 008) and is **consumed unchanged** here (the redesign touches rendering + state-derivation, not transport). It is **out of scope** for this frontend redesign and is recorded as known drift for a future transport feature, not a blocker for `009b`. See Complexity Tracking. *Surfaced for Mohamed's awareness.*

**Privacy review (gate 6):** This feature reads the signed-in employee's own live band/skip sequence through the existing RLS-as-user reader and renders it. It introduces no new query, selects no probability or label column, and exposes no raw signal. Principle I invariants hold; **no numeric value of any kind appears** (the live graph shows no clock axis and no numbers — FR-017/SC-007).

**Gate result:** No hard blockers. Proceed. One copy decision (FR-024 neutral subtitle wording) and the pre-existing polling note are flagged for Mohamed; the brief stops at the plan for his review.

## Project Structure

### Documentation (this feature)

```text
specs/010-monitoring-graph-redesign/
├── spec.md                       # clarified + checklist-resolved (F1–F7)
├── plan.md                       # this file
├── research.md                   # Phase 0 — decisions + the 11 folded checklist items + FR-024 wording fork
├── data-model.md                 # Phase 1 — consumed (read-only) view-model + no-read derivation
├── quickstart.md                 # Phase 1 — run + verify
├── contracts/
│   └── session-trend-ui.md       # Phase 1 — component prop + render-invariant contract
├── checklists/requirements.md    # pre-plan quality gate (done; 12 resolved / 3 PASS / 11 folded here)
└── tasks.md                      # /speckit-tasks (NOT created here)
```

### Source Code (repository root) — frontend-only, within `apps/web`

```text
apps/web/
├── components/monitor/
│   ├── monitoring-session.tsx          # CONSUME as-is. Mounts <SessionTrend> at :643 inside the shared
│   │                                   #   `mx-auto w-full max-w-3xl` column with the camera card (:603).
│   │                                   #   Matched-pair width (FR-002/SC-002) holds by this existing layout —
│   │                                   #   NO page-layout change (unlike 009). Injects load/active/pollMs already.
│   └── session-trend.tsx               # REPLACE internals: fixed-px continuous step-line + now-marker +
│                                       #   three no-read treatments + honest subtitle + gated foggy. Reads its
│                                       #   rendered width (ResizeObserver/ref). Adds a `showOutOfFrameFoggy`
│                                       #   prop (F7 gate, default false) alongside existing load/active/pollMs.
├── lib/
│   ├── api/monitoring-reads.ts         # CONSUME as-is (getSessionTrend, SessionTrendPoint, SkipCause).
│   └── session-trend-geometry.ts       # NEW (pure, no React/DOM): rolling-window trim (last ~2 min),
│                                       #   uniform-slot layout, band→Y step-line points, no-read treatment
│                                       #   derivation (warming/foggy/no-clear-read + leading-skip fade-in-only),
│                                       #   now-marker state (live/parked/none), subtitle-state derivation.
└── tests/unit/
    ├── lib/session-trend-geometry.test.ts          # NEW: geometry + treatment + subtitle-state units (SC mapping)
    └── components/monitor/session-trend.test.tsx   # REWRITE to the new surface + SC mapping (replaces today's tests)

apps/web/tests/e2e/                      # existing monitor/employee role e2e — extend lightly (no-read renders; no number)
specs/010-monitoring-graph-redesign/smoke-tests.md   # NEW at implement time (Constitution VII / gate 5)
```

**Structure Decision**: Single-app frontend change under `apps/web`, mirroring feature 009's split: the presentational component (`session-trend.tsx`) is **fully replaced** internally, and all branch-y, honesty-critical logic moves into one **pure geometry/derivation module** (`session-trend-geometry.ts`) so the Success Criteria are unit-testable in isolation without a Supabase round-trip or timers. The read layer, the monitor page, and `globals.css` are **untouched**. This is materially smaller than 009 (one session's step-line, not a multi-session lane field; no page promotion; no token additions).

## Deferred checklist items — folded into the plan (the 11 from `checklists/requirements.md`)

Each was deferred from the pre-plan audit as "minor / plan-level"; here is the pinned decision for each (full rationale in research.md):

| CHK | Item | Decision (where it lands) |
|---|---|---|
| CHK005 | "a little tense" legend swatch colour | Reuse `--amber-soft-line` (FR-023 token), matching the line — **not** the mock placeholder. No new token. (contract: legend) |
| CHK012 | partial-window / ramp-up x-positioning | **Right-anchored**: slot width is fixed (= plotWidth / N_target); early session draws its few windows in the rightmost slots, blank to the left; now-marker always at the right edge. (geometry) |
| CHK013 | live-update transitions between polls | No bespoke enter animation; re-render on the existing poll, now-marker moves to the new right-edge window. Only motion = the pulse (reduced-motion → none). (component) |
| CHK014 | popup dismissal on touch | Driven by focus/blur (`:focus-within`, per mock); tap focuses → popup shows, tap-away/blur → hides. No explicit close control. (contract: now-marker) |
| CHK015 | `scored` flag role | Unused for rendering — band + skipCause + position fully determine every treatment; documented as ignored. (data-model) |
| CHK016 | "~2 min" precision | Window = capture windows with `capturedAt` within the last **120s**; target capacity **N_target ≈ 12** at the 10s capture stride (drives fixed slot width). (geometry) |
| CHK017 | "supported container width" range | **360px viewport floor** (Principle VI) up to the `max-w-3xl` (~768px) column; component reads its actual rendered width. (geometry/contract) |
| CHK018 | matched-pair reference element | The monitor page's shared `mx-auto w-full max-w-3xl` column (camera card + trend card already occupy it) — holds by existing layout, **no page change**. (structure) |
| CHK020 | "leading skip" definition breadth | Generalize: the fade-in-only rule keys off **"no prior confident reading"** (position-based), covering a skip-first session with no warming run, not only "after warming". (data-model derivation) |
| CHK022 | SC-003 measurability | Re-read as a **deterministic-encoding** check: geometry unit asserts each band → distinct Y **and** distinct colour token; by-eye confirmation in `smoke-tests.md`. (tests) |
| CHK023 | SC-012 "legible" threshold | Define a **MIN_SLOT** floor (the legibility threshold) + pin the gap-label font (11px per mock); when plotWidth / N_target < MIN_SLOT, **drop oldest** (shrink N_target) rather than the slot. (geometry) |

## Complexity Tracking

> No constitution violations require justification (no amendment, no new token, no stack deviation beyond the already-ratified Amendment 7 carve-out). The rows below are **awareness/governance items**, not blockers.

| Item | Status | Note |
|---|---|---|
| **Amendment 7 — add the live graph as a 2nd named example** | OPTIONAL — my judgment: **not required** | Amendment 7's carve-out is scoped to the **technique** (bespoke affective micro-viz, inline SVG, DC-001), and its rationale already cites `session-trend.tsx` as existing precedent on `main`. The live graph reuses the technique → it is **already covered**. A one-line PATCH adding it as a second named example is optional doc-polish only; captured as an **optional** task in `/speckit-tasks`, Mohamed's call — **not** a gate for this feature. |
| **Pre-existing polling vs WebSocket** | Out of scope; pre-existing drift | The component polls `getSessionTrend` (~12s), consumed unchanged. Architecture Constraints prefer WebSockets for live streams; this predates 009b and is not touched here. Recommend a future transport feature; logged for Mohamed's awareness, not fixed in this frontend redesign. |
| **FR-024 neutral no-read subtitle wording** | RESOLVED 2026-06-25 | Mohamed chose **"No clear read right now"** (research R-7). Spec + artifacts updated. No copy item remains open. |
| **Touch-target ≥44px for the now-marker** | Design note (Principle VI) | The mock's hit-circle is r=15 (~30px); on touch viewports it must be enlarged to ≥44×44. Captured as a contract invariant; no governance impact. |

## Next step

Stop at the plan for Mohamed's review (per the task brief). The FR-024 neutral-subtitle wording is now signed off (**"No clear read right now"**, research R-7), so **no copy decision remains open** — ready for `/speckit-tasks`. `smoke-tests.md` is authored during `/speckit-implement`.
