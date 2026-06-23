---
description: "Task list — feature 009 today-card stress trend redesign"
---

# Tasks: Today-Card Stress Trend Visualization (Redesign)

**Input**: Design documents from `specs/009-today-card-trend-redesign/`
**Branch**: `009-today-card-trend-redesign`
**Prerequisites**: plan.md, spec.md (amended `c990b45`; FR-002/SC-010 recovery extension), research.md (forks resolved), data-model.md, contracts/today-trend-ui.md. Decisions: `docs/DECISIONS.md` 2026-06-22 + 2026-06-23 (headline rework — recovery + copy/voice); constitution v1.5.1 (Amendments 5+6).

**Tests**: INCLUDED — Constitution VII mandates tests per PR and the spec/research request TDD with a Success-Criteria map. Write tests first; ensure they FAIL before implementing.

**Visual authority**: `serenify-008followups-trend-FINAL.html`. **Scope**: frontend-only within `apps/web`. No data-layer/RLS/whitelist change; no probability to client. The within-session monitor graph, app-wide scrollbar styling, pause rows, and preferences are OUT of scope.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: can run in parallel (different files, no dependency on an incomplete task)
- **[Story]**: US1 (P1, MVP) / US2 (P2) / US3 (P3) / US4 (P3); Setup/Foundational/Polish carry no story label

---

## Phase 1: Setup

**Purpose**: scaffolding so TDD imports resolve (red), no behavior yet.

- [x] T001 [P] Create typed skeleton modules with empty exports so test files can import them (TDD red): `apps/web/lib/trend-geometry.ts`, `apps/web/components/home/today-trend-plot.tsx`, `apps/web/components/home/today-mini-trend.tsx`, `apps/web/components/home/today-timeline.tsx`.
- [x] T002 [P] Add shared geometry constants to `apps/web/lib/trend-geometry.ts` skeleton: band→Y map `{tense:44, a_little_tense:88, at_ease:132, no_read:172}`, `PLOT_H=200`, `STROKE=3`, `LANE_MIN=112`, `LANE_PAD=18`, and band→line-colour token map (`at_ease`→`--color-meadow`, `a_little_tense`→`--amber-soft-line`, `tense`→`--color-amber`, `no_read`→hollow `--color-muted`). Values locked to the mock.

**Checkpoint**: empty modules importable; constants in place.

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: amber tokens + the pure geometry that EVERY story renders from. **⚠️ No story work begins until this phase is green.**

- [x] T003 [P] Amber-AA contrast unit test in `apps/web/tests/unit/lib/amber-aa.test.ts` (TDD): compute WCAG ratios for the locked hexes and assert thresholds, **both themes** — `--color-amber-text` `#8A580F` on tint `#F4E3C6` (≥4.5) AND on card surface `#F4F5F6` (≥4.5) light; `#E6C386` on `#3B2F19` AND `#181B1E` (≥4.5) dark; `--amber-head` `#BC7A2A` on card surface `#F4F5F6` (≥3.0, large text ≥18.66px @700) light and **assert it FAILS on page bg `#EAEBEC`** (2.95<3.0 → must never render there, per DC-007); `#E4AE5C` on `#181B1E` (≥3.0) dark. Also parse `apps/web/app/globals.css` and assert the four tokens are declared with these exact values in both theme blocks (SC-007 regression guard).
- [x] T004 [P] Add the four amber sub-tokens to `apps/web/app/globals.css` in **both** themes (light `@theme` + dark `:root.dark`): `--color-amber-text` (`#8A580F` / `#E6C386`), `--amber-tint` (`#F4E3C6` / `#3B2F19`), `--amber-soft-line` (`#D49A4A` / `#E8BC7A`), `--amber-head` (`#BC7A2A` / `#E4AE5C`). `--color-amber-text` MUST use the `--color-*` prefix (Tailwind v4 generates `text-amber-text`); the graphic-only `--amber-tint`/`--amber-soft-line`/`--amber-head` may be plain custom properties consumed via arbitrary values. Leave `--color-amber` (lines/markers only) unchanged. Makes T003 pass.
- [x] T005 [P] Pure `trend-geometry` unit tests in `apps/web/tests/unit/lib/trend-geometry.test.ts` (TDD): run-collapse (consecutive same-band windows → one run; only transitions drawn); `bandCount===1` → single dot; **fixed-px width** `W === nLanes × laneWidth` with `laneWidth ≥ 112` and `viewBoxWidth === W` (1 unit = 1px, no stretch — SC-002); each lane's peak === `RecapSession.tenor` (SC-004); warm-up (leading `band===null`) and lost-read (interior `band===null`) → faded/eased segments that are **never bridged** at a fixed level (SC-010); fully read-less session → hollow no-read marker on its own lane, never the calm line (SC-006/SC-010).
- [x] T006 Implement `apps/web/lib/trend-geometry.ts` (pure, no React) to pass T005 — run-collapse, lane layout, fixed-px `W`/laneWidth, band→Y, warm-up/lost-read segmenting, per-session peak from `tenor`, mini-trend per-session peak markers + connectors. Depends on T005.

**Checkpoint**: tokens AA-verified; geometry green. Stories can start.

---

## Phase 3: User Story 1 — Glance at today's stress shape (Priority: P1) 🎯 MVP

**Goal**: collapsed card — honest three-level headline + wide-short mini step-line.

**Independent Test**: load the dashboard for a calibrated user with check-ins today → collapsed card shows the templated headline naming the real peak (amber "tense" wording ONLY when tense was reached) and a connected mini step-line (not dots), keyword colour echoing the peak.

### Tests (write first, must FAIL)

- [x] T007 [P] [US1] Honest three-level headline unit tests in `apps/web/tests/unit/lib/monitoring-reads.test.ts` (update existing headline cases): a day peaking at **a_little_tense** → `hot` reflects "a little tense" and MUST NOT contain "tense" as the level word; a day reaching **tense** → `hot` says "tense"; a **calm** day → `hot` is null (no amber keyword); the chosen peak names the real tensest session (FR-002/SC-010). *(Three-level honesty shipped; the headline **rework** — recovery branch + copy/voice — is added in T029/T030.)*
- [x] T008 [P] [US1] `today-mini-trend` RTL test in `apps/web/tests/unit/components/home/today-mini-trend.test.tsx`: renders a connected step-line (≥1 connector segment), **not** isolated dots (SC-003); a no-read session → hollow marker on the low lane, never the calm line; per-session peak colour matches `tenor`.
- [x] T009 [P] [US1] `today-view` collapsed RTL test in `apps/web/tests/unit/components/home/today-view.test.tsx` (rewrite): headline renders `pre`+`hot`+`post` with `hot` wrapped in the `--amber-head` (weight 700) keyword on the **card surface** (assert it is inside the card, not on the page background); calm day → no amber keyword; mini-trend present; single "View today" toggle exposes `aria-expanded`.

### Implementation

- [x] T010 [US1] Honest three-level copy change in `deriveHeadline` (`apps/web/lib/api/monitoring-reads.ts`) — emit calm wording (no `hot`) for at-ease, "a little tense …" for an a-little-tense peak, "tense …" only when the tense band is reached; supersedes the old FR-022 "any stress reads as tense". **Presentation copy only** — no read/RLS/whitelist/probability change. Makes T007 pass. (Confirmed single-surface: feeds only the today card.) *(↘ Extended by T030 (headline rework): recovery "…then eased" branch + second-person voice + no-period + amber-bare-descriptor + same-part-of-day collapse + impersonal no-read.)*
- [x] T011 [US1] Implement `apps/web/components/home/today-mini-trend.tsx` — wide-short mini step-line from `trend-geometry`; per-session peak markers + faded connectors; colour per band token; no-read hollow marker. Depends on T006; makes T008 pass.
- [x] T012 [US1] Implement the collapsed surface in `apps/web/components/home/today-view.tsx` — eyebrow (check-in count + last-read), honest headline render (`--amber-head` weight 700, on card surface), actions (Start check-in full-nav `<a>` + single toggle), mount `<TodayMiniTrend>`. Clean swap — delete the pre-`[3]` collapsed rendering. Depends on T010, T011; makes T009 pass.

**Checkpoint**: MVP — collapsed honest glance works and is independently testable.

---

## Phase 4: User Story 2 — Expand to see each session's shape + timeline (Priority: P2)

**Goal**: in-place expanded view — fixed-px lane plot + left axis levels (no legend) + state-coloured timeline; peak == chip.

**Independent Test**: expand a multi-session day → four left-axis labels and no bottom legend; each session a thin horizontal step shape (not a bar); timeline lists every session with a state-coloured chip; drawn peak band == chip tone.

### Tests (write first, must FAIL)

- [x] T013 [P] [US2] `today-trend-plot` RTL test in `apps/web/tests/unit/components/home/today-trend-plot.test.tsx`: SVG `width` attr === viewBox width === `nLanes × laneWidth`, **no** `preserveAspectRatio="none"`, **no** `<rect>` encodes a band, strokes ~3px — asserted at a desktop width AND at a 360px viewport (SC-002); exactly four axis level-labels and **zero** legend swatches (SC-001); band height+colour mapping; warm-up/lost-read render faded, never bridged, and a fully no-read session is a hollow marker on its own lane (SC-010); each lane's peak colour matches its chip tone (SC-004).
- [x] T014 [P] [US2] `today-timeline` RTL test in `apps/web/tests/unit/components/home/today-timeline.test.tsx`: one row per session with a state-coloured **pill** chip (meadow / amber-tint+amber-text / muted) from `RecapSession.chipTone`/`chipLabel`; row carries time identity + range; **no** "processed, then deleted" line (FR-013).
- [x] T015 [P] [US2] No-probability privacy test in `apps/web/tests/unit/components/home/today-view.privacy.test.tsx`: the rendered expanded DOM contains no stress-probability value/attribute; only clock-time digits appear (SC-008); the consumed readers select no probability column (whitelist unchanged, SC-009).

### Implementation

- [x] T016 [US2] Make the today check-in card its own **full-width row** in `apps/web/app/(authed)/app/page.tsx` (spec FR-012): promote `<TodaysCheckinCard>` out of the `md:grid-cols-[3fr_2fr]` column into a full-width row spanning the `max-w-6xl` container, and relocate the two secondary cards (`<ThingsThatMightHelpCard>`, `<RecentChatsCard>`) into a row/grid **below** it. **Prerequisite for the US2 plot proportions** — a half-width column would cramp the lanes and break the mock's ~1104px desktop drawing-area match (DC-002). Verified by the dashboard e2e (T025). Blocks T017.
- [x] T017 [US2] Implement `apps/web/components/home/today-trend-plot.tsx` — **fixed-px** lane plot (DC-001: SVG `width = nLanes × laneWidth`, matching `viewBox`, height ≈200; NO stretched viewBox) + fixed left-axis column with the four level labels (amber-text / meadow-text / muted on the card surface); ~3px step strokes per band token (meadow / amber-soft-line / amber); warm-up + lost-read fades; no-read hollow marker; lane peak from `tenor`. Depends on T006 and T016 (the full-width row gives the plot its real ~1104px drawing area); makes T013 pass.
- [x] T018 [US2] Implement `apps/web/components/home/today-timeline.tsx` — state-coloured pill chip rows (amber-tint bg + amber-text; meadow; muted), session number + time identity + range; **omit** the reassurance line. Depends on T014.
- [x] T019 [US2] Add the expanded surface to `apps/web/components/home/today-view.tsx` — in-place expand/collapse (height transition gated on `useMediaQuery('(prefers-reduced-motion: reduce)')`), divider, mount `<TodayTrendPlot>` + `<TodayTimeline>`; single "Hide today" toggle. Clean swap — delete the pre-`[3]` expanded rendering. Depends on T012, T017, T018; makes T015 pass.

**Checkpoint**: collapsed + expanded both work; graph and timeline agree.

---

## Phase 5: User Story 3 — Cross-highlight a session and its row (Priority: P3)

**Goal**: bidirectional synced highlight (mouse) + keyboard via the plot session targets, with a focus ring and reduced-motion respected.

**Independent Test**: hover a lane → its row highlights; hover a row → its lane highlights; Tab to a plot session target → focus ring + its row highlights; reduced-motion → no transition animation.

### Tests (write first, must FAIL)

- [X] T020 [P] [US3] Synced-highlight RTL test in `apps/web/tests/unit/components/home/today-view.highlight.test.tsx`: mouse-enter a lane → matching row gets the active state; mouse-enter a row → matching lane gets it (both directions); focus a plot per-session target (`role=button`, `tabindex=0`, `aria-label` includes the tenor) → visible focus ring + its row active; rows are NOT separate tab stops; with reduced motion, no transition class is applied (SC-005).

### Implementation

- [X] T021 [US3] Wire the synced highlight in `apps/web/components/home/today-view.tsx` (single active-session id) across `today-trend-plot.tsx` (focusable per-session targets + focus ring + lane-bg highlight) and `today-timeline.tsx` (row hover highlight); gate all transitions on `useMediaQuery`. Depends on T017, T018, T019, T020.

**Checkpoint**: highlight reachable both directions by mouse and by keyboard via the plot targets.

---

## Phase 6: User Story 4 — Busy day reads as shapes, not crushed bars (Priority: P3)

**Goal**: all sessions shown; min-lane-width; horizontal scroll + edge fades; never crushed.

**Independent Test**: render an overflowing day (≥11 sessions) → all present, each lane ≥ min width, strip scrolls, right edge-fade shown (left after scrolling).

### Tests (write first, must FAIL)

- [X] T022 [P] [US4] Overflow RTL test in `apps/web/tests/unit/components/home/today-trend-plot.overflow.test.tsx`: busy fixture → plot `W` > wrapper width, every lane ≥ `LANE_MIN` (none crushed), all sessions in the DOM, right edge-fade present and left edge-fade after a simulated scroll (SC-006).

### Implementation

- [X] T023 [US4] Add overflow handling to `apps/web/components/home/today-trend-plot.tsx` — scrollable wrapper with a **component-local** thin styled scrollbar + left/right edge-fade overlays + overflow/scrolled detection; enforce `LANE_MIN`. Add the component-local scrollbar/fade utilities to `apps/web/app/globals.css` (NOT app-wide). Depends on T017, T022.

**Checkpoint**: all four stories independently functional.

---

## Phase 7: Polish & Cross-Cutting

- [ ] T024 [P] Clean-swap audit: remove any orphaned pre-`[3]` rendering from `apps/web/components/home/today-view.tsx`; update/replace `apps/web/tests/unit/components/home/todays-checkin-card.us4.test.tsx` to the new surfaces; confirm `apps/web/components/home/todays-checkin-card.tsx` wiring is unchanged (still loads recap+trend RLS-as-user and renders `<TodayView>`).
- [ ] T025 [P] Extend employee Playwright e2e `apps/web/tests/e2e/employee-dashboard-shell.spec.ts` — assert the today card expands/collapses and the expanded view shows axis level-labels with **no** bottom legend (happy path; Constitution VII role e2e).
- [ ] T026 Author `specs/009-today-card-trend-redesign/smoke-tests.md` (Constitution VII / gate 5) — human checks: light+dark amber legibility (flip to light to judge the amber text), **at 360px the plot renders at its INTRINSIC width and SCROLLS — never stretches or crushes into bars** + visible edge-fade (carry-forward from US2/T017: the no-stretch rule is asserted only at the SVG-attribute level by unit tests; a browser can still stretch via CSS, which jsdom can't catch — so this is a mandatory human check), keyboard focus ring + reduced-motion, a real multi-session day, warm-up/lost-read/no-read honesty, and that the headline keyword sits on the card surface (never the page bg). Mohamed runs + records results.
- [ ] T027 [P] Append a 009 implementation entry to `docs/PROGRESS.md`.
- [ ] T028 Run `apps/web` lint + typecheck + full Vitest + the extended Playwright e2e; walk `quickstart.md` at desktop AND 360px; fix any regression. Confirm SC-001…SC-010 all covered.
- [ ] T031 [P] Eliminate the first-paint width flash on the today-card lane plot in `apps/web/components/home/today-trend-plot.tsx` — on SSR + the first client paint, `avail` falls back to `DEFAULT_AVAIL` (1008, line 42) because `measured` is still `null`, so on a narrow viewport the SVG paints at the ~1008-derived (overflowing) width for the paint(s) before the client measures and snaps to the true width (settled state already correct via the a7be539 avail-width spike — only first paint is wrong; most visible at 360px, the iOS/Safari gate, so the one place it'd be seen). **Recommended fix: measure-then-render** — do NOT render the lane-plot SVG until client measurement is available (`measured != null`); render a height-reserving placeholder in its slot so there is NO vertical layout shift; headline + timeline render normally, only the width-dependent SVG waits. **CC must confirm this is viable first — else STOP and report, do not ship a worse trade.** Acceptance: (1) first paint at 360px is never wide — the 1008-derived overflowing SVG must **never exist in the DOM**; pick the robust Playwright assertion (SSR-response check, JS-disabled check, or "SVG absent until measured, then correct") and **report which you used and why**, avoiding a flaky single-frame capture; (2) **no vertical layout shift** (load-bearing guard) — the plot container/placeholder reserves the same height before and after the SVG appears; assert container/placeholder height is stable (measure-then-render is acceptable ONLY if it does not trade the horizontal flash for a vertical jump); (3) reduced-motion respected — the placeholder introduces no new animation (no spinner/shimmer, keep it calm per Graphite; a static reserved space is fine); (4) settled behavior unchanged — 360px still tightens to 112 and scrolls, 1280px still fills, the existing a7be539 layout guards stay green. **TDD: write the failing assertion first** (current first paint is wide / SSR markup carries the 1008-derived width), then implement; new assertions belong in the auth-free layout spec `apps/web/tests/layout/today-plot-tightening.spec.ts` (`npm run test:layout`), **NOT** happy-dom unit tests (happy-dom has no layout or SSR/hydration distinction). Depends on US2 (T017, expanded plot) + the a7be539 layout guard. Built in the Polish `/speckit-implement` run alongside the remaining Polish tasks (T024–T028); do NOT implement yet.

---

## Phase 8: US1 headline rework (follow-up — copy/voice + recovery branch)

**Goal**: rework the today-card headline on top of the now-shipped three-level honesty (T007/T010): add the recovery branch and lock the copy/voice. **Behavior + presentation**: the recovery ("…then eased") branch is a **behavior** change (009 FR-002 / SC-010 extension); voice / no-period / amber-scope / same-part-of-day / impersonal-no-read are **presentation copy** (`docs/DECISIONS.md` 2026-06-23). Single-surface (`deriveHeadline` → today card only); no read / RLS / SELECT-whitelist / probability change.

**Independent Test**: feed `deriveHeadline` a recovered day (a tension peak followed by a lower most-recent band) → the headline surfaces the recovery, not the peak alone, and never says "tense" unless tense was actually reached; a same-part-of-day calm→tension day collapses the second clause to time-neutral wording; every headline is second-person with no trailing period; the no-read line stays impersonal.

### Tests (write first, must FAIL)

- [X] T029 [P] [US1] Headline rework unit tests in `apps/web/tests/unit/lib/monitoring-reads.test.ts` (extend T007's cases — TDD, write red first): **recovery** — a day that reached a tension peak (tense or a-little-tense) whose **most recent** session is at a **lower** band surfaces the recovery (an "…then eased"-style trailing clause) rather than reporting the peak alone, and recovery wording **never** upgrades a sub-tense day to "tense" (FR-002 / SC-010 extension); **voice** — headlines are second-person and carry **no trailing period**; **amber scope** — the `hot` span is the bare state descriptor only ("tense" / "a little tense"), with the part-of-day in `pre`/`post`, never inside `hot`; **same-part-of-day collapse** — when the calm phase and the peak phase share a part of day the second clause is time-neutral (no repeated part-of-day word), and both parts are named only when they differ; **no-read** — "No clear read today" stays impersonal (no "your", no period). Behavior-level assertions; do not pin exact strings beyond these invariants.

### Implementation

- [X] T030 [US1] Headline rework in `deriveHeadline` (`apps/web/lib/api/monitoring-reads.ts`) — extend the honest three-level copy (T010) with: the **recovery branch** ("…then eased" when the most-recent band is below the day's tension peak), **second-person voice**, **no trailing period**, the **amber `hot` = bare-descriptor** narrowing (part-of-day moves to `pre`/`post`), the **same-part-of-day collapse** for calm→tension arcs, and the **impersonal** no-read line. **Presentation copy + recovery behavior only** — no read / RLS / SELECT-whitelist / probability change; still single-surface (today card only). Depends on T029; refines T010. **Report the final exact strings for Mohamed's last eyeball before close-out.**

**Checkpoint**: headline reworked — recovery surfaced, voice / period / amber-scope / same-part-of-day copy locked, honesty intact; final strings reported for sign-off.

---

## Dependencies & Execution Order

- **Setup (T001–T002)** → no deps.
- **Foundational (T003–T006)** → after Setup; **blocks all stories**. T003+T004 (amber) and T005+T006 (geometry) are two independent [P] tracks; within each, test precedes/then impl (T004 makes T003 pass; T006 makes T005 pass).
- **US1 (T007–T012)** → after Foundational. MVP.
- **US2 (T013–T019)** → after Foundational; reuses the orchestrator from US1 (T019 depends on T012). The full-width row (T016) blocks the plot (T017) so the lanes get their real ~1104px drawing area.
- **US3 (T020–T021)** → after US2 (needs plot + timeline + expanded orchestrator).
- **US4 (T022–T023)** → after US2 (needs the plot, T017).
- **Polish (T024–T028)** → after all desired stories.
- **Headline rework (T029–T030)** → follow-up after US1 (extends the shipped T007/T010). TDD: test (T029) precedes impl (T030). Independent of US2–US4 — touches only `deriveHeadline` + its unit test; can land any time after US1.

### Within each story
Tests first (must fail) → implementation. Geometry (T006) before any component that renders it. Components before the orchestrator wiring.

### Parallel opportunities
- Setup: T001 ∥ T002.
- Foundational: the amber track (T003 then T004) ∥ the geometry track (T005 then T006).
- Story tests marked [P] run together (e.g. T013 ∥ T014 ∥ T015).
- US3 and US4 may proceed in parallel once US2 is complete (different files: highlight wiring vs overflow), coordinating on `today-trend-plot.tsx`.

## Parallel Example: Foundational

```text
Track A (amber):     T003 (amber-aa.test.ts) → T004 (globals.css tokens)
Track B (geometry):  T005 (trend-geometry.test.ts) → T006 (trend-geometry.ts)
# A and B run concurrently; both must be green before Phase 3.
```

## Implementation Strategy

### MVP first (US1 only)
1. Phase 1 Setup → 2. Phase 2 Foundational (CRITICAL) → 3. Phase 3 US1 → **STOP & validate** the collapsed honest glance → demo.

### Incremental delivery
US1 (collapsed MVP) → US2 (expanded + timeline) → US3 (synced highlight) → US4 (overflow). Each adds value without breaking the prior; run the matching SC checks at each checkpoint.

## Notes
- Tests are TDD (write red first) per Constitution VII; commit after each task or logical group.
- The backup branch `008-followups-pre-surgery-backup` `today-view.tsx` is a **structural reference only** (run-collapse, lane/run geometry, synced-highlight wiring) — its rendering/proportions are the rejected approach and MUST NOT be carried over.
- Privacy invariant throughout: no new read, no probability to client, SELECT whitelist + RLS-as-user intact (SC-008/SC-009).
- `smoke-tests.md` (T026) is the Constitution gate-5 artifact; Mohamed signs it off before merge to `main`.

## Success-Criteria coverage map
- SC-001 axis-not-legend → T013, T025
- SC-002 shapes-not-bars @ desktop+360px → T005, T013, T016 (full-width row → real drawing area)
- SC-003 collapsed-is-a-line → T008
- SC-004 peak == chip → T005, T013
- SC-005 synced highlight (mouse both-ways + keyboard via plot target) → T020
- SC-006 overflow / min-lane → T005, T022
- SC-007 amber AA both themes (incl. headline on card surface, not page bg) → T003
- SC-008 no probability to client → T015
- SC-009 RLS-as-user / whitelist intact → T015, T024
- SC-010 honesty (warm-up/lost-read fade; no-read on own lane; headline never overstates; recovery surfaced) → T005, T007, T013, T029
