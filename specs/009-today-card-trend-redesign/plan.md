# Implementation Plan: Today-Card Stress Trend Visualization (Redesign)

**Branch**: `009-today-card-trend-redesign` | **Date**: 2026-06-22 | **Spec**: [spec.md](./spec.md) (amended @ `c990b45`)

**Input**: Feature specification from `specs/009-today-card-trend-redesign/spec.md`

**Visual authority**: `serenify-008followups-trend-FINAL.html` (repo root). **Constitution**: v1.5.2 governs.

## Summary

Rebuild the employee dashboard's today check-in card's **collapsed** (glanceable) and **expanded** (detailed) stress-trend surfaces plus the session timeline, correcting the dropped build's visual-quality failures. The work is **frontend-only inside `apps/web`**: it **consumes the existing, unchanged read layer** (`getTodayRecap` / `getTodayTrend` / `getSessionTrend`, the SELECT-whitelist constants, `deriveRecap` / `sessionTenor` in `lib/api/monitoring-reads.ts`, already wired in `components/home/todays-checkin-card.tsx`) and re-renders it.

The technical core — and the place the prior build failed — is the **fixed-pixel SVG rendering** of the expanded lane plot: **1 SVG unit = 1 screen pixel**, with the SVG's intrinsic `width` set to `nLanes × laneWidth` px and a `viewBox` of the *same* width (height fixed ≈200px). The forbidden anti-pattern is a small fixed `viewBox` stretched to `width:100%` — that horizontal stretch *is* the totem bug. Sessions render as thin (~3px) horizontal step strokes in equal-width lanes (min ≈112px); overflow → component-local horizontal scroll + edge fades.

State encodes by **height AND colour** via amber-family sub-tokens added to `globals.css` (`--color-amber-text`, `--amber-tint`, `--amber-soft-line`, `--amber-head`), with all text re-verified against WCAG AA in both themes. Bright graphic amber stays on lines/markers only.

**Two decision forks surfaced — both RESOLVED** (Mohamed signed off 2026-06-22; see `docs/DECISIONS.md` 2026-06-22 "009 fork resolutions" and Constitution Amendments 5–7). Original forks — see [research.md](./research.md) R-2 and R-3:
1. **Headline honesty**: the existing `deriveHeadline` emits "tense" wording for *any* stress band, conflicting with FR-002/SC-010 (tense wording only when the tense band is reached).
2. **Amber palette governance**: new amber sub-tokens + the light amber-text value (`#8A580F` per mock vs `#7E5310` per constitution) need a `docs/DECISIONS.md` entry and likely a MINOR constitution amendment.

## Technical Context

**Language/Version**: TypeScript (strict) on Next.js 16 (App Router), React; Tailwind CSS v4.

**Primary Dependencies**: existing `lib/api/monitoring-reads.ts` reads (consumed as-is); repo `hooks/use-media-query.ts` (reduced-motion); hand-authored inline SVG for the trend (NOT Recharts — see Constitution Check §V / Complexity Tracking). No new runtime dependencies.

**Storage**: N/A — read-only client consumption of existing Supabase RLS SELECTs run as the signed-in user. No schema, RLS, or whitelist change.

**Testing**: Vitest + React Testing Library (component + pure-geometry units, the bulk of the Success-Criteria mapping); the existing employee Playwright e2e (`tests/e2e/employee-dashboard-shell.spec.ts`) for the dashboard happy path; a unit-level WCAG-AA contrast assertion over the amber tokens (SC-007, re-verified not assumed); a human `smoke-tests.md` authored at implement time (Constitution VII / gate 5).

**Target Platform**: Web (Vercel). Mobile-first from a 360px floor up to desktop; light + dark equal-priority.

**Project Type**: Web application — frontend-only change within `apps/web`.

**Performance Goals**: static SVG + CSS-token-driven highlight; no per-frame JS animation; 60fps interaction; reduced-motion suppresses all transitions.

**Constraints (non-negotiable, from spec DC-001…DC-007)**: fixed-px rendering (1 unit = 1px, no stretched viewBox); wide-short plot (≈1104px desktop drawing area, ≈280px at 360px floor, ≈200px tall); ~3px strokes; lane min ≈112px; axis level-labels, no legend; WCAG AA both themes; no probability to client; RLS-as-user + SELECT whitelist intact.

**Scale/Scope**: a handful to ~a dozen sessions/day; overflow handled by horizontal scroll with min-lane-width (never crushed).

## Constitution Check

*GATE: evaluated against constitution v1.5.2. Re-checked after Phase 1 (unchanged — no new violations introduced by the design).*

| Principle | Verdict | Notes |
|---|---|---|
| **I. Privacy by Architecture** (NON-NEGOTIABLE) | ✅ PASS | Consumes existing owner-scoped reads run **as the signed-in user**; **no probability** reaches the client (FR-017/SC-008); SELECT whitelist intact (band owner-readable; `label`/`stress_probability` never selected); no new read surface; no raw signals. This is the employee's **own** self-view (not a manager-facing surface), so the manager-visibility invariants are not engaged. Privacy review note recorded below (gate 6). |
| **II. Subject-Disjoint ML Eval** (NON-NEGOTIABLE) | ✅ N/A | No model training/eval; pure read + render. |
| **III. Modality Isolation** | ✅ N/A | Frontend only; no modality package touched. |
| **IV. LLM Provider Abstraction** | ✅ N/A | No LLM. |
| **V. Calm-First Design** | ⚠️ PASS w/ governance items | Amber = stress signal, meadow = calm, muted = no-read; soft-tint amber treatment honored; **red not used**; voice unchanged. **Three items need a `docs/DECISIONS.md` entry (and possibly a MINOR amendment), see Complexity Tracking:** (V-a) new amber sub-tokens + light amber-text value `#8A580F` vs constitution `#7E5310`; (V-b) card radius **20px** exceeds the stated "8–16px" range (pre-existing on-main drift, matches mock); (V-c) hand-authored SVG instead of the stack's Recharts. |
| **VI. Responsive & Accessible** | ✅ PASS | Mobile-first 360px (DC-002/005); light+dark in tandem; **reduced-motion via `useMediaQuery`** (FR-015); visible focus ring + keyboard-reachable plot session targets (FR-011); touch targets ≥44px (lane hits are ≥112×~172px; the toggle/CTA must keep ≥44px — design note). |
| **VII. Mandatory Testing Per PR** | ✅ PASS (strategy defined) | Vitest+RTL + pure-geometry units mapped to SC-001…SC-010; existing employee Playwright happy-path; AA-contrast unit assertion; `smoke-tests.md` at implement time. |
| **VIII. Spec-Driven Workflow** | ✅ PASS | `spec.md` + this `plan.md` present; `tasks.md` + `smoke-tests.md` follow. The two forks + three §V items will be logged append-only in `docs/DECISIONS.md` at implement start. |
| **IX. Secrets Discipline** (NON-NEGOTIABLE) | ✅ N/A | No secrets, env, or private hostnames touched. |
| **X. Dataset Stewardship** (NON-NEGOTIABLE) | ✅ N/A | No StressID frames/figures; renders the employee's own derived bands only. No real-teammate names used as fixtures. |

**Privacy review (gate 6):** This feature reads the signed-in employee's own band sequences + session tenor through the existing RLS-as-user readers and renders them. It introduces no new query, selects no probability or label column, and exposes no raw signal. Principle I invariants hold; the only digits shown are clock times (SC-008).

**Gate result:** No hard blockers. Proceed, with the §V governance items and the two forks flagged for Mohamed's sign-off before `/speckit-implement` (the brief stops at the plan for his review).

## Project Structure

### Documentation (this feature)

```text
specs/009-today-card-trend-redesign/
├── spec.md              # amended @ c990b45
├── plan.md              # this file
├── research.md          # Phase 0 — decisions + the two forks
├── data-model.md        # Phase 1 — consumed (read-only) view-model
├── quickstart.md        # Phase 1 — run + verify
├── contracts/
│   └── today-trend-ui.md  # Phase 1 — component prop + render-invariant contract
└── tasks.md             # /speckit-tasks (NOT created here)
```

### Source Code (repository root) — frontend-only, within `apps/web`

```text
apps/web/
├── app/
│   ├── globals.css                         # MODIFY: add amber sub-tokens (both themes) +
│   │                                       #   component-local scrollbar/edge-fade utilities
│   └── (authed)/app/page.tsx               # MODIFY (US2/FR-012): the check-in card becomes its OWN
│                                           #   full-width row (max-w-6xl); the two secondary cards
│                                           #   (suggestions, recent chats) move to a row/grid BELOW.
│                                           #   PREREQUISITE for the US2 plot proportions — a half-width
│                                           #   column would cramp the lanes and break the ~1104px mock match.
├── components/home/
│   ├── todays-checkin-card.tsx             # unchanged wiring (loads recap+trend, RLS-as-user,
│   │                                       #   renders <TodayView/>); surface-selection logic kept
│   ├── today-view.tsx                      # REPLACE internals: collapsed + expanded orchestrator,
│   │                                       #   honest headline render, single toggle, synced-highlight
│   │                                       #   state. Clean swap — no orphaned old rendering.
│   ├── today-trend-plot.tsx                # NEW: fixed-px lane plot (DC-001) + left axis labels
│   ├── today-mini-trend.tsx                # NEW: collapsed wide-short mini step-line
│   └── today-timeline.tsx                  # NEW: state-coloured chip rows + synced highlight
├── lib/
│   ├── api/monitoring-reads.ts             # CONSUME as-is. (Fork R-2 may touch deriveHeadline ONLY
│   │                                       #   as a copy change — pending Mohamed's decision.)
│   └── trend-geometry.ts                   # NEW (pure): run-collapse, lane layout, band→Y map,
│                                           #   fixed-px width calc, warm-up/lost-read segmenting.
└── tests/unit/
    ├── lib/trend-geometry.test.ts          # NEW: geometry units (SC-002/003/004 logic)
    ├── lib/amber-aa.test.ts                # NEW: WCAG-AA contrast assertion over amber tokens (SC-007)
    └── components/home/
        ├── today-view.test.tsx             # REWRITE to the new surfaces + SC mapping
        └── todays-checkin-card.us4.test.tsx# UPDATE if the card↔view contract shifts

apps/web/tests/e2e/employee-dashboard-shell.spec.ts   # existing role e2e — extend lightly (expand/collapse, no-legend)
specs/009-today-card-trend-redesign/smoke-tests.md     # NEW at implement time (Constitution VII / gate 5)
```

**Structure Decision**: Single-app frontend change under `apps/web`. The current `today-view.tsx` rendering (the pre-`[3]` v5-mock build with stretched viewBox + wall-clock x + meadow-only strokes) is **fully replaced**; the orchestrator is split into three presentational children + one pure geometry module so the anti-drift Success Criteria are unit-testable in isolation. The data-loading card (`todays-checkin-card.tsx`) and the read layer are untouched. The dashboard page (`app/(authed)/app/page.tsx`) IS modified in US2: the check-in card is promoted to its **own full-width row** (the two secondary cards move below) per FR-012 — a prerequisite for the expanded plot's proportions, since a half-width column would cramp the lanes and break the ~1104px mock match. The backup branch's `today-view.tsx` is consulted as a **structural reference only** (run-collapse logic, lane/run geometry, synced-highlight wiring) — its rendering/proportions (stretched viewBox, totem rects, bottom legend) are the rejected approach and are **not** carried over.

## Complexity Tracking

> Governance items, **all RESOLVED 2026-06-22** (Mohamed's sign-off; `docs/DECISIONS.md` 2026-06-22 "009 fork resolutions"): **V-c** → Decision 4 + Constitution **Amendment 7** (inline-SVG carve-out ratified; Recharts stays the locked default); **V-a** → Decision 2 + **Amendment 5** (amber sub-tokens; light amber-text `#8A580F` adopted); **V-b** → Decision 3 + **Amendment 6** (card-radius range widened 8–16px → 8–20px); **R-2** → Decision 1 (honest three-level `deriveHeadline`). None blocked the plan. Severity is informational — the patches happen regardless of label.

| Item | Why needed | Simpler alternative & why insufficient |
|---|---|---|
| **V-c: hand-authored SVG, not Recharts** (stack-locked chart lib) | DC-001 requires fixed-px rendering where the SVG's intrinsic width = content width. Recharts' `ResponsiveContainer` stretches to `width:100%` — structurally the totem bug this feature exists to fix. | Recharts: rejected — its responsive model is incompatible with the non-negotiable anti-totem requirement. Precedent exists on `main` (today-view + session-trend already use inline SVG). Log a DECISIONS.md entry scoping "bespoke affective micro-viz → inline SVG" rather than amending the stack table. |
| **V-a: amber sub-tokens + light amber-text `#8A580F`** | DC-006 needs distinct amber roles (line / mid-line / tint / text / headline) that don't exist yet; `--color-amber-text` must be AA-safe as small text, which bright `--color-amber` is not (2.77:1). | Reuse `--color-amber` for text: rejected (fails AA). Use constitution's `#7E5310`: **viable** (5.32:1 on tint, higher than `#8A580F`'s 4.78:1) and needs no amendment — but diverges from the approved mock's chosen warmth. **Fork R-3** — Mohamed picks: adopt `#7E5310` (no amendment) **or** amend the constitution's amber-text value to `#8A580F`. Either way, register the sub-tokens via a MINOR amendment + DECISIONS.md. |
| **V-b: card radius 20px vs "8–16px"** | DC-005 + the approved mock + existing on-main cards (`session-trend.tsx` uses `rounded-2xl` = 20px) all use 20px. | Reduce to 16px: rejected (contradicts the approved mock and would make this card inconsistent with shipped cards). This is **pre-existing drift** (the 007 visual redesign moved cards to 20px without updating Principle V's radius range). Recommend a PATCH amendment widening the range to include 20px; not introduced by this feature. |
| **R-2: headline honesty (FR-002 vs `deriveHeadline`)** | Spec FR-002/SC-010 require "tense" wording only when the tense band is reached; existing `deriveHeadline` emits "tense {partOfDay}" for any stress band. | Leave as-is: rejected — violates the feature's central "honest header" promise. **Fork** — Mohamed picks: (a) a scoped copy change to `deriveHeadline` (presentation copy only; not a read/RLS/whitelist change) so an a-little-tense-only day reads "a little tense"; or (b) relax FR-002 to match the existing "amber = stress at a glance" behavior. Recommendation: (a). |

## Next step

Stop at the plan for Mohamed's review (per the task brief). After sign-off on the forks, run `/speckit-tasks`. `smoke-tests.md` is authored during `/speckit-implement`.
