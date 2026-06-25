---
description: "Task list for the live 'This session' monitoring-graph redesign (009b)"
---

# Tasks: Live "This session" monitoring-graph redesign (009b)

**Input**: Design documents from `specs/010-monitoring-graph-redesign/`
**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/session-trend-ui.md, quickstart.md (all present)

**Scope (from the approved plan)**: frontend-only inside `apps/web`. **One component replaced** (`components/monitor/session-trend.tsx`) + **one new pure module** (`lib/session-trend-geometry.ts`) + their tests. **No** backend / schema / RLS / API / page-layout / `globals.css` tasks (all confirmed unchanged). Visual target: `serenify-live-session-graph-mock.html`.

**Tests**: included (Constitution VII). Per the brief, the **pure geometry/derivation module and its unit tests come BEFORE the component rewrite** — the honesty-critical branching is unit-tested in isolation first (Foundational phase).

**Format**: `[ID] [P?] [Story?] Description` — [P] = different file, no dependency on an incomplete task. SC tags map each task to spec Success Criteria for traceability.

> **Parallelism note (read first):** this redesign centers on **one component file** (`session-trend.tsx`) and **one module file** (`session-trend-geometry.ts`), so most tasks are **serialized by file** (few [P]). The real critical path is Foundational (the pure module + its tests) → then the three story slices render incrementally on top. This is expected for a single-component redesign, not a missed parallelization.

---

## Phase 1: Setup

**Purpose**: Confirm the no-op surfaces the plan relies on, so later tasks don't drift into them.

- [x] T001 Verify preconditions and record in a short note at the top of `apps/web/lib/session-trend-geometry.ts` (to be created in T002): all mock tokens already exist in `apps/web/app/globals.css` both themes (`--color-meadow/amber/foggy/muted`, `--amber-soft-line`) → **no `globals.css` change** [CHK005]; `<SessionTrend>` and the camera card already share the `mx-auto w-full max-w-3xl` column in `apps/web/components/monitor/monitoring-session.tsx` → **no page-layout change**, matched-pair width holds [CHK018]; the read layer (`getSessionTrend`) is consumed unchanged.

---

## Phase 2: Foundational (Blocking Prerequisites — the pure honesty-critical core)

**Purpose**: Build and unit-test the entire pure geometry/derivation module BEFORE any component rendering. ⚠️ **No component (US) work may begin until this phase is green.**

- [x] T002 Create `apps/web/lib/session-trend-geometry.ts` scaffold: mock-derived constants (`H=210`, `BAND_Y {tense:58, a_little_tense:120, at_ease:182}`, `BAND_LINE` token map, `AXIS_GUTTER≈140`, `RIGHT_MARGIN≈60`, `STROKE=3`, `WARM_STROKE=2.5`/dash/opacity, `FADE_OPACITY=.25`, `NOW_R=5`, `HALO_R`, `HIT_R`, `WINDOW_MS=120000`, `N_TARGET≈12`, `MIN_SLOT`) and exported types (`WindowSlot`, `Treatment`, `NowMarker`, `SubtitleState`). Document that `scored` is **unused for rendering** [CHK015]. [research R-1; CHK016, CHK017, CHK023]
- [x] T003 Write the geometry unit-test suite (TDD — author first, expect red) in `apps/web/tests/unit/lib/session-trend-geometry.test.ts`, with cases mapped to: SC-001 (width==viewBox invariant at 360px & ~768px), SC-003 (each band → distinct Y **and** distinct token), SC-004 (treatment distinctness, gate OFF vs ON), SC-008 (out-of-frame routes muted when gate OFF; foggy string absent), SC-009 (no bridged gap; leading/skip-first → fade-in only), SC-010 (single dot; all-skipped → no-read not calm), SC-011 (now-marker live/parked/none), SC-012 (rolling window, uniform slot, drop-oldest before MIN_SLOT), SC-013 (subtitle states). [CHK020, CHK022]
- [x] T004 Implement rolling-window trim (last `WINDOW_MS`) + **uniform-slot, right-anchored** layout (slot width = plotWidth / N_target; drop oldest before shrinking below `MIN_SLOT`) in `apps/web/lib/session-trend-geometry.ts`. [F1; FR-002a; **SC-012**; CHK012, CHK016, CHK023]
- [x] T005 Implement band→Y step-line point builder + single-confident-reading dot rule in `apps/web/lib/session-trend-geometry.ts`. [FR-003, FR-019; **SC-003, SC-010**]
- [x] T006 Implement no-read **treatment derivation** (warming = leading null/null run only; out-of-frame → foggy when gated ON else no-clear-read; everything-else null → no-clear-read incl. mid-session re-warm; fade-out requires a prior confident reading else **fade-in only**; fades are static opacity) in `apps/web/lib/session-trend-geometry.ts`. [research R-3; FR-009–FR-015; **SC-004, SC-008, SC-009**; CHK020]
- [x] T007 Implement **now-marker state machine** (`live` = recolour to band; `parked` = solid `--color-muted`, no pulse, "last clear read", only with ≥1 prior confident reading; `none` = no confident reading ever) in `apps/web/lib/session-trend-geometry.ts`. [research R-4; FR-004/004a/004b; **SC-011**; F6]
- [x] T008 Implement **subtitle-state derivation** (confident → peak summary; warming → non-asserting; active-no-read & all-skipped → neutral **"No clear read right now"**; resume summary on a confident reading) in `apps/web/lib/session-trend-geometry.ts`. [research R-6/R-7; FR-024; **SC-013**]

**Checkpoint**: `npx vitest run --pool=threads tests/unit/lib/session-trend-geometry.test.ts` green. The honesty-critical logic is proven before any pixel is drawn.

---

## Phase 3: User Story 1 — Read your live stress trend at a glance (Priority: P1) 🎯 MVP

**Goal**: A fixed-px continuous step-line (band → colour + height) with a single live "now" marker that recolours to the current band; true circles at any width; fills the container.

**Independent Test**: a session of mixed at-ease/a-little-tense/tense readings renders coloured/height-correct segments, the now-marker sits at the latest reading in its band colour, and every marker is a true circle at any container width.

- [x] T009a [US1] **Container-width measurement** in `apps/web/components/monitor/session-trend.tsx`: measure the rendered container width via `ResizeObserver`/ref and expose the measured width `W` to the render; handle mount-before-observer-fires and 0-width-on-mount (no render / safe fallback until a real width arrives). [FR-002; **SC-002**; CHK017]
- [x] T009b [US1] **Fixed-px `<svg>` shell** in `apps/web/components/monitor/session-trend.tsx` (depends on T009a): render the `<svg>` with `width=W` **and** matching `viewBox="0 0 W 210"` (no `preserveAspectRatio` stretch); draw gridlines + left axis labels (Tense / A little tense / At ease); keep the existing ~12s poll-driven re-render (no bespoke enter animation) [CHK013]; consume the geometry module. Keep `sessionId`/`active`/`load`/`pollMs` wiring. [FR-001, FR-002; **SC-001, SC-002**; CHK013, CHK017]
- [x] T010 [US1] Render the continuous **step-line** (segment colour = `BAND_LINE[band]`, height = `BAND_Y[band]`) and the single-dot case; render the confident-state subtitle (existing peak summary) in `session-trend.tsx`. [FR-003, FR-019; **SC-003, SC-010**]
- [x] T011 [US1] Render the **live now-marker** at the right edge (dot recolours to band; gentle CSS pulse) and **remove the old amber peak dot** in `session-trend.tsx`. [FR-004, FR-005, FR-006; **SC-011** (live)]
- [x] T012 [US1] Render the **band legend** (at ease = `--color-meadow`, a little tense = `--amber-soft-line`, tense = `--color-amber`) in `session-trend.tsx`. [FR-021 (bands); CHK005]
- [x] T013 [US1] RTL tests for US1 in `apps/web/tests/unit/components/monitor/session-trend.test.tsx` (rewrite the existing suite): now-marker is a true `<circle>` and svg `width`==viewBox width at 360px & ~768px; step-line segment colours/heights; now-marker recolour; fills container; no `preserveAspectRatio="none"`. [**SC-001, SC-002, SC-003**]

**Checkpoint**: US1 is a usable, correct live graph on its own (MVP).

---

## Phase 4: User Story 2 — Understand the three no-read states honestly (Priority: P2)

**Goal**: warming dashed line, no-clear-read muted gap, and the out-of-frame foggy gap (built but gated OFF at launch) — each honest and distinct; no gap ever bridged.

**Independent Test**: drive (a) leading no-read start, (b) mid-session out-of-frame, (c) low-light/our-side skip; gate OFF → two visible treatments (dashed + muted gaps, out-of-frame shown muted); gate ON → out-of-frame shows the foggy gap.

- [x] T014 [US2] Render the **warming dashed muted line** ("getting a read") for the leading null/null run (no now-marker during warming) in `session-trend.tsx`. [FR-010; **SC-004**]
- [x] T015 [US2] Render the **no-clear-read muted gap** (static-opacity fade-out → gap → fade-in; muted label "no clear read"); leading/skip-first → **fade-in only**; mid-session re-warm → muted gap (never dashed) in `session-trend.tsx`. [FR-012, FR-013, FR-014; **SC-004, SC-009**; CHK020]
- [x] T016 [US2] Build the **out-of-frame foggy treatment** ("step back into frame", foggy colour) **fully per the mock but gated** behind a new `showOutOfFrameFoggy` prop (default **false** → out-of-frame routes to the muted gap) in `session-trend.tsx`. [FR-011, FR-015; **SC-008**; F7]
- [x] T017 [US2] Gate the **foggy legend key** on `showOutOfFrameFoggy` (launch: two no-read keys — warming + no clear read; gate ON: add "stepped out of frame") in `session-trend.tsx`. [FR-021 (no-read keys); F7]
- [x] T018 [US2] Fix the **empty vs warming discriminator**: zero trend points → text-only ("Your trend builds…"); ≥1 point warming-only/all-skipped → no-read state, **not** the empty text in `session-trend.tsx`. [FR-018; F3]
- [x] T019 [US2] RTL tests for US2 in `session-trend.test.tsx`: gate OFF → warming dashed + muted gap, out-of-frame renders muted (no "step back into frame" string anywhere); gate ON → foggy gap with foggy label; no flat bridged line across a gap; leading skip → fade-in only; empty (0 points) vs warming (≥1) discriminator. [**SC-004, SC-008, SC-009**; CHK020]

**Checkpoint**: US1 + US2 both work independently; the three honest treatments are correct under both gate states.

---

## Phase 5: User Story 3 — Inspect the current reading + full accessibility (Priority: P3)

**Goal**: the "you are here" / "last clear read" popup (hover/focus/tap), parked-marker behavior, keyboard + reduced-motion + ≥44px touch target, and honest subtitle wiring.

**Independent Test**: keyboard-only, tab to the now-marker → popup on focus; hover and tap also show it; reduced-motion → no animation; during an active no-read the marker is parked muted/static reading "last clear read".

- [ ] T020 [US3] Now-marker **popup**: "you are here" (live) / "last clear read" (parked); reveal on hover, focus, **and** tap via `:focus-within`; dismiss on blur/tap-away in `session-trend.tsx`. [FR-007; **SC-005**; CHK014]
- [ ] T021 [US3] Render the **parked now-marker** (active no-read with ≥1 prior confident reading): solid `--color-muted` fill, **static** (no pulse/halo), popup "last clear read"; resume full band colour + pulse + "you are here" on a confident reading in `session-trend.tsx`. [FR-004a; **SC-011**; F6]
- [ ] T022 [US3] **Keyboard + reduced-motion a11y**: marker focusable (popup on focus, not hover-only), accessible label reflecting live-confident vs parked-stale; reduced-motion → static halo (no pulse) and the no-read fades stay static (no animation) in `session-trend.tsx`. [FR-006, FR-008; **SC-005, SC-006**]
- [ ] T023 [US3] **Enlarge the now-marker hit-area to ≥44×44 on touch viewports** — an intended divergence from the mock's r=15 hit-circle (Principle VI touch-target) in `session-trend.tsx`. [Principle VI; explicit design note]
- [ ] T024 [US3] Wire the **honest subtitle** in the component from the geometry subtitle-state: confident summary / warming line / neutral **"No clear read right now"** in `session-trend.tsx`. [FR-024; **SC-013**]
- [ ] T025 [US3] RTL tests for US3 in `session-trend.test.tsx`: focus → popup; hover/tap → popup; parked marker muted+static+"last clear read"; reduced-motion → no animation node; touch hit-area ≥44px; subtitle never asserts a tension level during warming/active-no-read. [**SC-005, SC-006, SC-011, SC-013**]

**Checkpoint**: all three user stories independently functional.

---

## Phase 6: Polish & Cross-Cutting Concerns

- [ ] T026 [P] Extend the existing monitor/employee Playwright happy-path in `apps/web/tests/e2e/` to assert a no-read treatment renders and **no numeric value of any kind** appears in the graph. [**SC-007**]
- [ ] T027 [P] Author `specs/010-monitoring-graph-redesign/smoke-tests.md` (Constitution VII / gate 5): light/dark by eye, 360px no-crush, keyboard focus + popup, reduced-motion, and a live warm → read → out-of-frame → return session.
- [ ] T028 Final verification: `cd apps/web && npm run lint && npx tsc --noEmit && npx vitest run --pool=threads tests/unit/lib/session-trend-geometry.test.ts tests/unit/components/monitor/session-trend.test.tsx` (Windows: `--pool=threads` per project memory); confirm the SC-001…SC-013 coverage map below is fully satisfied.
- [ ] T029 [P] **[OPTIONAL — leave optional per review; do not drop]** Amendment 7 doc-polish: add the live graph as a **second named example** in the charting carve-out (constitution Technology Stack row + `docs/DECISIONS.md`), PATCH bump. The live graph is already covered by the technique-scoped carve-out (research R-8), so this is **not** a gate — Mohamed's call. [research R-8]

---

## Dependencies & Execution Order

- **Setup (T001)** → no dependencies.
- **Foundational (T002–T008)** → depends on T001; **BLOCKS all user stories**. Order: T002 (scaffold) → T003 (tests, red) → T004–T008 (impl to green; same file, sequential).
- **US1 (T009–T013)** → depends on Foundational. MVP.
- **US2 (T014–T019)** → depends on Foundational; builds on the US1 component shell (same file, so sequential after US1 in practice) but is an independently testable increment.
- **US3 (T020–T025)** → depends on Foundational; builds on the US1/US2 component (same file).
- **Polish (T026–T029)** → after the stories it validates; T028 last. T029 optional/independent.

### Parallel Opportunities (limited — single-file redesign)
- **T026, T027, T029** are [P] (distinct files: e2e spec, smoke-tests.md, constitution/docs).
- Everything else is **serialized by file**: the geometry module (T004–T008 in `session-trend-geometry.ts`) and the component (T009–T024 in `session-trend.tsx`) are each one file. This is expected, not a gap.

---

## Success-Criteria coverage map (traceability)

| SC | Tasks |
|---|---|
| SC-001 true circles / fixed-px | T003, T009b, T013 |
| SC-002 matched-pair width | T009a, T009b, T013 |
| SC-003 band by colour+height | T003, T005, T010, T013 |
| SC-004 distinct no-read treatments | T003, T006, T014, T015, T016, T019 |
| SC-005 keyboard popup | T020, T022, T025 |
| SC-006 reduced-motion | T022, T025 |
| SC-007 no probability | T026 (+ inherent: no number rendered anywhere) |
| SC-008 never "step back into frame" when unreliable | T003, T006, T016, T019 |
| SC-009 no bridged gap / leading fade-in-only | T003, T006, T015, T019 |
| SC-010 single dot / read-less honesty | T003, T005, T010, T018 |
| SC-011 parked now-marker | T003, T007, T011, T021, T025 |
| SC-012 rolling window / uniform slot | T003, T004 |
| SC-013 subtitle honesty | T003, T008, T024, T025 |

## Folded checklist decisions (traceability)

| CHK | Task(s) |
|---|---|
| CHK005 legend swatch token | T001, T012 |
| CHK012 right-anchored ramp-up | T004 |
| CHK013 poll re-render, no bespoke transition | T009b |
| CHK014 popup focus/blur dismiss | T020 |
| CHK015 `scored` unused | T002 |
| CHK016 120s / N_target≈12 | T002, T004 |
| CHK017 360→~768px supported widths | T002, T009a, T009b |
| CHK018 shared `max-w-3xl` referent | T001 |
| CHK020 position-based leading-skip | T006, T015, T019 |
| CHK022 deterministic-encoding read of SC-003 | T003 |
| CHK023 MIN_SLOT legibility floor | T002, T004 |

---

## Implementation Strategy

- **MVP**: Setup → Foundational → US1 (T001–T013). Stop and validate the legible live trend + true-circle now-marker before layering honesty states.
- **Incremental**: add US2 (the three honest no-read treatments) → add US3 (inspection + a11y) → Polish.
- **TDD spine**: T003 (geometry tests) is authored red first and drives T004–T008; each story's RTL test (T013/T019/T025) locks that story's SCs.

## Notes
- One copy item is finalized (FR-024 neutral subtitle = "No clear read right now"); FR-022's three labels are approved — **no open copy decisions**.
- The foggy treatment (T016/T017) is **full work even though it ships invisible** (gated OFF at launch, FR-015) — budget for it.
- Commit after each task or logical group; local feature-branch commits are fine (Constitution VIII).
- `smoke-tests.md` (T027) is Mohamed's manual gate after `/speckit-implement`.
