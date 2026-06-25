# Phase 0 Research — Live "This session" monitoring-graph redesign (009b)

All decisions reconciled against the signed-off mock `serenify-live-session-graph-mock.html`, the live tokens in `apps/web/app/globals.css`, the existing read layer `apps/web/lib/api/monitoring-reads.ts` (`getSessionTrend`), the existing geometry precedent `apps/web/lib/trend-geometry.ts` (feature 009), and constitution v1.8.0. The spec is already clarified + checklist-resolved (F1–F7); this file pins the implementation decisions and folds the 11 deferred checklist items.

---

## R-1 — Fixed-pixel SVG rendering (the anti-totem technique) — DECIDED

**Decision.** Same load-bearing rule as feature 009 (DC-001): **1 SVG unit = 1 screen pixel.** The `<svg>` gets `width = W` (px, the rendered container width) **and** a matching `viewBox="0 0 W H"` (H fixed). Because intrinsic width == viewBox width there is **no scaling**, so the now-marker dot renders a **true circle** at any width (SC-001) and strokes keep their px weight.

**Forbidden (the totem/oval bug).** The current `session-trend.tsx` uses `viewBox="0 0 100 40"` + `preserveAspectRatio="none"` stretched to `width:100%` — this ovals every marker; it is the rejected approach this feature exists to replace.

**Difference from 009.** 009 is a multi-session **lane field** (run-collapsed lanes, width = nLanes × laneWidth, horizontal scroll). This live graph is a **single continuous step-line** across **one** session's capture windows, width = the container width (fixed), with a rolling window (R-2) rather than scroll. So a **new** pure module `session-trend-geometry.ts` is warranted (different model), not a reuse of `trend-geometry.ts`.

**Mock geometry (the build target — from `serenify-live-session-graph-mock.html`).** viewBox `0 0 580 210`. Band Y-centres: `tense = 58`, `a_little_tense = 120`, `at_ease = 182`; gridlines at those Y. Left axis gutter: labels right-aligned at x≈92, gridlines/plot from x≈140 to x≈520 (right margin ≈60). Step-line stroke `3`, linejoin/linecap round. Warming dashed line stroke `2.5`, `stroke-dasharray "2 5"`, opacity `.55`. No-read fade segments: static opacity `.25` (NOT animation). Now-marker: dot r=5 (fill = band colour), pulse halo r 5→13 (`svpulse` 2.4s), hit-circle r=15. Reduced-motion: halo static r=8 opacity .22.

**Dynamic width.** W is read at runtime from the rendered container (`ResizeObserver` + ref, re-render on resize — Edge Case "Container resize"). H stays fixed (210). The plot area is `[gutter, W − rightMargin]`; the gutter/right-margin are constants from the mock. Axis label/gridline Y are constants.

**Rationale.** DC-001 decouples drawing scale from container width; fixed-px is the only technique that guarantees a true circle + crisp strokes at any width.

**Alternatives considered.** Recharts (`ResponsiveContainer` stretches to width:100% → reintroduces the bug; rejected — Amendment 7 carve-out authorizes inline SVG for exactly this bespoke affective micro-viz). A stretched small viewBox (today's rejected approach).

---

## R-2 — Rolling window + uniform slot per capture window (F1) — DECIDED

**Decision (from clarify F1 + spec FR-002a/SC-012).** The x-axis is a **uniform slot per capture window**: every capture window — confident **and** no-read — occupies one equal-width slot. The drawn set is a **rolling window of the most recent ~120 seconds** of windows.

Concretely (`session-trend-geometry.ts`):
- **Window selection:** keep windows with `capturedAt` within `[now − 120_000ms, now]`.
- **Fixed slot width:** `slotW = floor(plotWidth / N_target)`, `N_target ≈ 12` (≈120s at the 10s capture stride). Slot width is **stable** regardless of how many windows are currently present (CHK016).
- **Right-anchored (CHK012):** the latest window sits in the rightmost slot (now-marker at the right edge, FR-002a); earlier windows fill leftward; a session younger than the window draws its few windows in the rightmost slots with blank space to the left.
- **Honest gap width:** because slots are uniform and capture windows are ~uniform duration, a no-read gap's width = its **count of consecutive no-read windows** = an honest elapsed-time proxy (a longer outage is a wider gap), **without** a continuous time axis. *(This is the resolution of the checklist's time-proportional-vs-even-spacing contradiction: even-spaced per window, which equals time-proportional because windows are uniform.)*
- **Legibility wins (CHK023):** define `MIN_SLOT` (the legibility floor; gap-label font pinned at 11px per mock). If `plotWidth / N_target < MIN_SLOT`, **reduce N_target (drop oldest windows)** rather than shrink `slotW`.

**Rationale.** A live session grows unboundedly while the width is fixed (FR-002); a rolling window bounds the drawn set and keeps the no-read gap labels (≈90–116px in the mock) legible. Uniform slots reconcile "stable spacing" with "honest gaps".

**Alternatives considered.** Continuous time-proportional axis (long outages dominate the width; rejected). Even-spacing collapsing each no-read run to one fixed-width gap (loses elapsed-time honesty; rejected). Both were the explicit checklist fork that F1 closed.

---

## R-3 — The three no-read treatments + derivation (US2, FR-009–FR-015) — DECIDED

**Decision.** The pure module derives, per window (and per run), one **treatment** from `band` + `skipCause` + position, exactly per the spec's locked rules:

| Condition | Treatment | Render |
|---|---|---|
| `band` set | confident segment | step-line at `BAND_Y[band]`, colour = `BAND_LINE[band]` |
| `band` null **&** `skipCause` null, **leading run** (no confident reading yet) | **warming** | dashed muted line (`--color-muted`, stroke 2.5, dash "2 5", opacity .55), label "getting a read" — start-only |
| `band` null **&** `skipCause === "out-of-frame"`, **gate ON** | **foggy** (out-of-frame) | fade-out → gap → fade-in, foggy label "step back into frame" (`--color-foggy`) — **gated OFF at launch** |
| `band` null **&** any skipCause (incl. out-of-frame when **gate OFF**), mid-session | **no-clear-read** | fade-out → gap → fade-in, muted label "no clear read" (`--color-muted`) |
| `band` null **&** `skipCause` null **after** a confident reading (re-warm) | **no-clear-read** | muted gap (never a dashed line — FR-014) |

- **Leading-skip generalization (CHK020):** the fade-out half requires a **prior confident reading**; the derivation keys off "no prior confident reading" (position-based), so a **skip-first** session with no warming run is **fade-in only** too (not just "after warming"). FR-013.
- **Fades are static opacity, not motion (F4/FR-013):** the "fade out → fade in" is the mock's `.fade` class at ~0.25 opacity on the flanking segments — no temporal animation → SC-006 satisfied by construction.
- **Foggy gate (F7/FR-015):** a single `showOutOfFrameFoggy` boolean (default `false`) governs **routing** (foggy vs muted), **copy** (the out-of-frame string), and the **legend key** (R-5) together. Injectable as a component prop (like `load`/`active`/`pollMs`) so both gate states are unit-testable.

**Rationale.** This is the honesty-critical core; the current component flattens all no-reads into one gap and discards `skipCause` + the warming signal (both already on every `SessionTrendPoint`). The derivation lives in the pure module so each case is a unit test.

---

## R-4 — The "now" marker state machine (FR-004 / FR-004a / FR-004b) — DECIDED

**Decision.** The marker has three states, derived from the live edge:

| Live edge | Marker |
|---|---|
| confident band | **live**: dot at the reading, `fill = BAND_LINE[band]` (recolours per band), gentle pulse (reduced-motion → static halo), popup "you are here", r=5 |
| active no-read **with ≥1 prior confident reading** | **parked**: stays at the last confident reading; **solid `--color-muted` fill** (F6 — not band-coloured), **no halo/pulse** (static), popup "last clear read", same radius (r=5) |
| **no confident reading has *ever* occurred** (warming, leading skip, or all-skipped) | **none**: no marker at all (F2/FR-004b) |

- **F6 (parked rendering):** solid `--color-muted` fill, no halo, same radius — pins the previously-unspecified parked appearance.
- **Accessibility:** keyboard-focusable; popup on hover **and** focus **and** tap (focus-within); accessible label reflects live-confident vs parked-stale; touch hit-area ≥44×44 on touch viewports (Principle VI; the mock's r=15 ≈30px must grow).

**Rationale.** Parking on a stale reading while still claiming "you are here" is the exact dishonesty the redesign removes; muting + relabelling keeps a visual anchor without asserting a current band.

---

## R-5 — Legend gating + tokens (FR-021 / FR-023, CHK005) — DECIDED

**Decision.** The legend reuses the **same tokens as the lines** (no new token, no `globals.css` change):
- Band keys: at ease = `--color-meadow`, **a little tense = `--amber-soft-line`** (CHK005 — the FR-023 token, matching the line, **not** the mock's `#CF9A4F` placeholder), tense = `--color-amber`.
- No-read keys **follow the FR-015 gate (F7)**: at launch the legend shows **two** — *warming up* (muted) and *no clear read* (muted); the **foggy "stepped out of frame"** key is **omitted** until the gate flips on (then three). Same `showOutOfFrameFoggy` condition as the treatment + copy.

**Confirmed:** every needed token exists in `globals.css` both themes — `--color-meadow`, `--color-amber`, `--color-foggy`, `--color-muted`, `--amber-soft-line`. So **no palette amendment** (unlike 009's R-3 fork).

---

## R-6 — Subtitle honesty states (FR-024 / SC-013) — DECIDED (rule) / R-7 (wording pending)

**Finding (from the code).** The current `session-trend.tsx` computes the subtitle **inline** from the peak rank — `peakRank>=2 → "A tense stretch in here." / ===1 → "A little tension creeping in." / else "Settled so far."` — with **no** warming/no-read honesty (it would say "Settled so far." while warming or all-skipped: the FR-024 bug).

**Decision (rule, F5).** Move subtitle derivation into the pure module with four states:
- **confident** (live edge confident): peak-derived session-summary line (existing behaviour).
- **warming** (no confident reading ever): a non-asserting line.
- **active no-read** (live edge no-read, prior confident readings): **switch to a neutral no-read line** (no tension word); **resume** the summary when a confident reading returns.
- **fully read-less / all-skipped** (no confident reading ever, not warming): the same neutral no-read line.

**Rationale.** The subtitle must not assert a tension level when there is no current confident reading (honesty-critical; mirrors 009's `deriveHeadline` fork).

---

## R-7 — FR-024 neutral-subtitle wording — RESOLVED 2026-06-25

**The rule is decided (R-6); only the exact neutral string(s) are open.** Per the task brief, surfaced here and **not** finalized in this plan. The wording rides along with the FR-022 sign-off (FR-022's three labels are already approved: "getting a read" / "step back into frame" / "no clear read").

**Proposed options (Mohamed picks; voice = calm, no period, no number — Principle V):**
- **Warming line:** reuse FR-022's **"getting a read"** (already approved; matches the mock) — recommended, no new string.
- **Active no-read / all-skipped neutral line** (the open one):
  - (a) **"No clear read right now"** — present-tense, mirrors FR-022's "no clear read". *Recommended* (consistent vocabulary).
  - (b) **"Waiting for a clear read"** — softer, continuous.
  - (c) a single shared neutral line reused for both warming and no-read (e.g. just "Getting a read") — simplest, but blurs warming vs mid-session no-read.

**Resolved (2026-06-25):** Mohamed chose **(a) "No clear read right now"** for the active-no-read / all-skipped neutral line; warming keeps **"getting a read"**. `data-model.md` / `contracts` updated to the final string. No copy item remains pending for `/speckit-tasks`.

---

## R-8 — Amendment 7 coverage (the optional one-line example edit) — DECIDED: not required

**Finding.** Amendment 7's charting carve-out names "feature 009's employee today-card stress trend" as the example, but scopes the exception to the **technique** — bespoke affective micro-visualizations using hand-authored inline SVG with pixel-exact, non-stretched rendering (DC-001) — and its **rationale explicitly cites `session-trend.tsx` as existing precedent on `main`.** The live graph reuses that exact technique.

**Decision.** The live graph is **already covered**; no amendment is required for compliance. A one-line PATCH adding the live graph as a **second named example** is optional doc-polish — captured as an **optional** task in `/speckit-tasks` (Mohamed's call), **not** a gate. *(This matches the spec's own "Constitution alignment" recon note.)*

---

## R-9 — Testing approach mapped to Success Criteria — DECIDED

| SC | Layer | Check |
|---|---|---|
| SC-001 true circles | geometry unit + RTL | SVG `width` attr == viewBox width (1:1) → no stretch; now-marker is a `<circle>`; assert at 360px floor **and** the `max-w-3xl` width |
| SC-002 matched-pair width | RTL/structure | the trend fills its container; same column as the camera card (no narrower max-width) |
| SC-003 band identifiable (CHK022) | geometry unit | each band → **distinct Y** (`BAND_Y`) **and distinct colour token** (`BAND_LINE`); + by-eye smoke check |
| SC-004 two/three no-read treatments | geometry unit + RTL | gate OFF → warming dashed line + muted gap (2 visible); gate ON → + foggy gap (3); each visually/textually distinct |
| SC-005 keyboard popup | RTL | now-marker focusable; popup appears on focus (not hover-only) |
| SC-006 reduced-motion | RTL | reduced-motion → no pulse (static halo); no-read fades are static opacity (no animation node) |
| SC-007 no probability | RTL/grep | **no numeric value of any kind** in the DOM; reader selects no probability column |
| SC-008 never "step back into frame" when unreliable | geometry unit | gate OFF → out-of-frame routes to muted "no clear read"; the foggy string never renders |
| SC-009 no bridged gap / leading fade-in-only | geometry unit | no flat carried-forward line across a gap; a skip with no prior confident reading → fade-in only |
| SC-010 single-dot / read-less honesty | geometry unit | 1 confident reading → a dot, not a line; all-skipped → no-read state, never calm |
| SC-011 parked marker | geometry unit + RTL | active no-read w/ prior confident → muted+static+"last clear read"; no confident ever → no marker |
| SC-012 rolling window (F1) | geometry unit | >N_target windows → only the last ~120s drawn; uniform slot width stable; gap width = consecutive no-read-window count; drop-oldest before MIN_SLOT |
| SC-013 subtitle honesty | geometry unit | no tension word during warming / active no-read / all-skipped; resumes summary on a confident reading |

Plus the existing monitor/employee Playwright happy-path (extend: a no-read treatment renders; zero numbers), and a human `smoke-tests.md` at implement (light/dark by eye, 360px no-crush, keyboard focus + popup, reduced-motion, a real live session that warms → reads → steps out → returns).

---

## Open items carried to the plan
- **R-7** (FR-024 neutral-subtitle wording) → **RESOLVED 2026-06-25**: "No clear read right now".
- **Pre-existing polling vs WebSocket** → out of scope; logged for Mohamed's awareness (plan Complexity Tracking).
- **Amendment 7 example edit** → optional doc-polish task only (R-8); not required.
