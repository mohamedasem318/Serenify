# Feature Specification: Today-Card Stress Trend Visualization (Redesign)

**Feature Branch**: `009-today-card-trend-redesign`

**Created**: 2026-06-22

**Status**: Draft

**Input**: User description: "Today-card stress trend visualization (redesign) — the dashboard check-in card's collapsed (glanceable) and expanded (detailed) today stress-trend surface plus the session timeline. A prior build was rejected for visual-quality failures (legend instead of axis, oversized card, totem bars, bare-dots collapsed view) and dropped; this is the corrected redesign. Visual authority: `serenify-008followups-trend-FINAL.html`."

## Context & Background

The employee dashboard "today" check-in card should show, at a glance and in detail, how the user's stress band moved across each of today's monitoring sessions. A previous implementation was **rejected for visual-quality failures** and removed from the codebase. This feature is the corrected redesign.

The visual source of truth is the approved mock **`serenify-008followups-trend-FINAL.html`** (repo root). Every design constraint below was reconciled against that mock and against the live Graphite tokens in `apps/web/app/globals.css`.

**Data layer already exists.** The owner-scoped reads this feature consumes — `getSessionTrend`, `getTodayTrend`, `getTodayRecap` (and helpers `deriveRecap`, `sessionTenor`) plus the SELECT-whitelist column constants — are **already present on `main`** in `apps/web/lib/api/monitoring-reads.ts`, byte-identical to branch `008-followups-pre-surgery-backup`, and are already wired live in `apps/web/components/home/todays-checkin-card.tsx` (browser-side, run as the signed-in user, no probability read). **This feature consumes the existing reads; it does not re-derive or weaken them.**

This feature redesigns **only** the today card's two visual surfaces (collapsed + expanded) and the session timeline. The within-session live monitoring graph (`components/monitor/session-trend.tsx`) is explicitly **out of scope**.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Glance at today's stress shape (Priority: P1)

An employee opens their dashboard. The today check-in card shows, in its collapsed state, a one-glance summary of the day's stress shape: an honest headline that names the real peak of the day, and a wide-short mini step-line whose colour echoes the headline. The employee understands at a glance whether today was mostly calm, a little tense, or actually reached "tense" — without expanding anything.

**Why this priority**: This is the default, always-visible surface and the core value: an honest, glanceable read of the day. It is a viable MVP on its own — even with no expansion, the collapsed card delivers an accurate day summary.

**Independent Test**: Load the dashboard for a calibrated user who has check-ins today. Verify the collapsed card renders the templated headline (naming the real peak band) and a connected mini step-line (not isolated dots), with the headline keyword colour matching the day's peak band.

**Acceptance Scenarios**:

1. **Given** a user whose day peaked at "tense", **When** the dashboard loads, **Then** the headline uses the amber "tense" keyword wording and the mini step-line rises to the tense level for the relevant session(s).
2. **Given** a user whose day never exceeded "at ease", **When** the dashboard loads, **Then** the headline does **not** use the "tense" amber wording (full amber tense wording appears only if the day actually reached tense), and the mini line stays at the calm level.
3. **Given** any day with at least one check-in, **When** the collapsed card renders, **Then** the mini-trend is a connected step-line carrying each session's peak band over the day — never a row of bare/floating dots.
4. **Given** a session with no clear read, **When** the mini-trend renders that session, **Then** it shows a hollow marker on its own low lane, never a point on the calm line.

---

### User Story 2 - Expand to see each session's stress shape and timeline (Priority: P2)

The employee expands the today card in place. They see each of today's sessions drawn as a step shape across discrete stress bands, with left-axis level labels (no legend), and a timeline list of sessions below — each row carrying a state-coloured chip. The peak band shown for a session in the graph matches that session's timeline chip, so the two never disagree.

**Why this priority**: The detailed view is the payoff after the glance. It depends on US1's surface existing but adds the per-session breakdown and the timeline. Independently demonstrable once the collapsed card is present.

**Independent Test**: Expand the card for a multi-session day. Verify: left axis shows four level labels (tense / a little tense / at ease / no read) and there is no bottom colour legend; each session is a thin horizontal step shape (not a filled vertical bar); the timeline lists every session with a state-coloured chip; each session's drawn peak band equals its chip's tone.

**Acceptance Scenarios**:

1. **Given** the card is collapsed, **When** the employee activates the single "View today" toggle, **Then** the card expands in place to reveal the plot and timeline; activating "Hide today" collapses it again.
2. **Given** an expanded day, **When** the plot renders, **Then** stress level is encoded by **both** height and colour: at ease = meadow (lowest band), a little tense = mid band, tense = highest band; the left axis carries the four level labels and there is **no** bottom colour legend.
3. **Given** a session whose readings hold one band then change, **When** it is drawn, **Then** consecutive same-band windows collapse into a single run and only the transitions are drawn (a step shape with subtly rounded corners); a session with a single confident reading renders as a single dot.
4. **Given** a session whose start is warming up, or that loses the read mid-session, **When** it is drawn, **Then** the warm-up / lost-read stretch **fades / eases**, never bridging at a fixed level across the gap.
5. **Given** a session with no confident read at all, **When** it is drawn, **Then** it appears as a hollow marker on its own dedicated low lane — never on the calm (at-ease) line.
6. **Given** any session, **When** comparing the graph and the timeline, **Then** the band shown as that session's peak in the graph **equals** the band represented by its timeline chip (single source of truth: the session tenor).
7. **Given** the expanded view, **When** rendered, **Then** the recap does **not** show the "processed, then deleted" reassurance line (that line stays on the live monitor), the check-in card stands as its own row/section, and the timeline reads as a list of state-coloured rows.

---

### User Story 3 - Cross-highlight a session and its row (Priority: P3)

By mouse, the employee hovers a session's run/lane in the plot or its corresponding timeline row, and its partner highlights — **both** directions. For keyboard users, the plot's per-session targets are focusable: focusing one shows a visible focus ring and highlights its timeline row (timeline rows are not separate tab stops). Users who prefer reduced motion see the highlight without animated transitions.

**Why this priority**: An accessibility and legibility enhancement layered on the expanded view. Valuable but not required for the day summary to be useful.

**Independent Test**: In the expanded view, hover a lane → its timeline row highlights; hover a row → its lane highlights. Tab to a session via keyboard → a focus ring appears and the partner highlights. Enable "prefers-reduced-motion" → highlights apply with no transition animation.

**Acceptance Scenarios**:

1. **Given** the expanded view with a mouse, **When** the employee hovers a session lane, **Then** the matching timeline row highlights; on hovering a timeline row, the matching lane highlights (both directions).
2. **Given** the expanded view with a keyboard, **When** the employee focuses a **plot session target**, **Then** a visible focus ring appears on it and its **timeline row** highlights. (Timeline rows are not separate keyboard tab stops; keyboard access to the highlight is via the plot targets.)
3. **Given** a user with "prefers-reduced-motion: reduce", **When** highlights toggle, **Then** no transition animation plays (state changes are instant).

---

### User Story 4 - A busy day still reads as shapes, not crushed bars (Priority: P3)

On a day with more sessions than fit the card width, the employee still sees **all** of today's sessions. Lanes hold a minimum width and the session strip scrolls horizontally, with an edge-fade affordance signalling there is more to scroll — the lanes are never crushed into thin vertical bars.

**Why this priority**: Protects the redesign's core anti-failure (no totem/crushed bars) at the high end of session count. Important for correctness at scale, but the common case is a handful of sessions.

**Independent Test**: Render a day with enough sessions to overflow the drawing area (e.g., 11). Verify every session is present, each lane keeps at least the minimum width (none are crushed), the strip scrolls horizontally, and an edge fade appears at the overflowing edge (and at the left edge once scrolled).

**Acceptance Scenarios**:

1. **Given** more sessions than fit the available width, **When** the plot renders, **Then** every session is shown, each lane is at least the minimum width, and the strip becomes horizontally scrollable.
2. **Given** an overflowing strip not yet scrolled, **When** rendered, **Then** a right-edge fade signals more content; **When** scrolled away from the start, a left-edge fade also appears.
3. **Given** any session count from 1 upward, **When** rendered, **Then** no session is ever drawn as a thin filled vertical bar (totem); sessions remain thin horizontal step shapes.

---

### Edge Cases

- **No check-ins today / not calibrated**: out of scope for this feature's surfaces — the existing card already chooses a calibrate-first or empty surface upstream; this feature renders only when there is a recap with at least one session. The redesign must not change that selection logic.
- **Single session, single reading**: renders as a single dot in both the mini-trend and the expanded plot (a one-point "run").
- **Entire session is no-read**: hollow marker on the dedicated no-read lane in both surfaces; never placed on the calm line; its chip tone is the muted "no clear read".
- **Day peaked below tense**: headline keyword reflects the true peak (meadow/calm or "a little tense") and must not use the amber "tense" wording.
- **Day peaked then recovered**: when the day reached a tension peak (tense or a-little-tense) and the most recent session sits at a lower band, the headline surfaces the recovery (e.g. "…then eased") rather than reporting the peak alone; recovery wording never upgrades a sub-tense day to "tense".
- **Warm-up at session start and lost-read mid-session co-occur**: both render as faded/eased stretches; neither bridges at a fixed level.
- **Many sessions (overflow)**: horizontal scroll with min-lane-width and edge fades; all sessions reachable.
- **Reduced motion**: all transitions (expand, highlight, fades) are suppressed.
- **Light theme amber legibility**: graph line colours in the light theme are below the 3:1 non-text contrast guideline against the card surface (see Assumptions A-005) — acceptable because state is **also** encoded by height/position, not colour alone.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The collapsed today card MUST present a glanceable summary: an honest templated headline that names the day's real peak, plus a wide-short **mini step-line** carrying the day's shape (each session's peak band over the day), with the headline keyword colour echoing the day's peak band.
- **FR-002**: The headline MUST use the amber "tense" wording **only** when the day actually reached the tense band; otherwise it MUST reflect the true (lower) peak. **Recovery honesty**: when the day reached a tension peak (tense or a-little-tense) but the **most recent** session sits at a **lower** band than that peak (the user has eased/recovered), the headline MUST surface that recovery (e.g. "…then eased") rather than reporting the peak alone. Recovery wording MUST NOT upgrade a sub-tense day to "tense" — the tense word still appears only when the tense band was actually reached.
- **FR-003**: The collapsed mini-trend MUST render as a connected step-line, never as isolated/floating dots. A no-read session within it MUST appear as a hollow marker on its own low lane, never on the calm line.
- **FR-004**: The card MUST expand and collapse **in place** via a single toggle ("View today" ↔ "Hide today"); the toggle MUST be keyboard-operable and expose its expanded/collapsed state to assistive technology.
- **FR-005**: In the expanded view, each session MUST be drawn as a **step shape** with subtly rounded corners across discrete bands; consecutive same-band windows MUST collapse into one run and only transitions are drawn. A session with a single confident reading MUST render as a single dot.
- **FR-006**: Stress state MUST be encoded by **both height and colour**: at ease = meadow at the lowest band, a little tense = mid band, tense = highest band. No-clear-read MUST be a hollow marker on its own dedicated low lane, never on the calm (at-ease) line.
  - **Rendering clarification (FR-003 / FR-006, US1 fix 2026-06-22)**: the no-read marker's *shape* differs by surface so it never distorts — the **collapsed** mini-trend draws a short **muted dash** (a hollow circle squashes into a stray "0" under the mini strip's stretched `preserveAspectRatio="none"` viewBox), while the **expanded** lane plot keeps the **hollow circle** (fixed-px DC-001 — no stretch, no distortion). Both sit on the dedicated low no-read lane; the honesty rule is unchanged.
- **FR-007**: Warm-up (session start) and lost-read stretches MUST **fade out / ease back** and MUST NOT bridge across the gap at a fixed level. (Pauses are NOT drawn this pass; no pause rows exist yet.)
- **FR-008**: The horizontal axis MUST be **sequence within a session, ordinal between sessions** (not wall-clock). Sessions MUST occupy **equal-width lanes**.
- **FR-009**: Each session's drawn **peak band MUST equal its timeline chip** (both derived from the same session tenor), so the graph and the timeline can never disagree.
- **FR-010**: The expanded view MUST show **level labels on the left axis** (tense / a little tense / at ease / no read) and MUST NOT show a bottom colour legend.
- **FR-011**: A **synced highlight** MUST link a session's run/lane and its timeline row. By **mouse**, hovering either one highlights the other (**both** directions, lane↔row). By **keyboard**, the plot's per-session targets MUST be focusable: focusing one MUST show a visible focus ring and highlight its partner timeline row. Timeline rows are **not** required to be separate keyboard tab stops. In short, the synced highlight is reachable **both directions by mouse, and by keyboard via the plot session targets**.
- **FR-012**: The timeline MUST list sessions as rows, each with a **state-coloured chip** (calm/meadow, tension/amber, no-read/muted tones). The check-in card MUST stand as its own row/section, and there MUST be exactly one "Hide today" toggle.
- **FR-013**: The recap MUST NOT display the "processed, then deleted" reassurance line (that messaging stays on the live monitor).
- **FR-014**: The expanded view MUST show **all** of today's sessions. When they exceed the available width, lanes MUST hold a **minimum width** and the session strip MUST **scroll horizontally** with an **edge-fade affordance** (right edge when more remains; left edge once scrolled) — lanes MUST never be crushed into thin bars.
- **FR-015**: All motion (expand/collapse, highlight, edge fades) MUST honor the user's reduced-motion preference (no transition animation when reduced motion is requested), using the repository's existing media-query mechanism.
- **FR-016**: The client MUST read **per-window band sequences per session** plus an **aggregate session tenor**, via owner-scoped queries executed **as the signed-in user**, honoring the existing **SELECT column whitelist** (the band column is owner-readable; `label` and `stress_probability` are not selected). It MUST consume the existing reads (`getSessionTrend` / `getTodayTrend` / `getTodayRecap`) and MUST NOT re-derive or weaken them.
- **FR-017**: **No stress-probability value MAY reach the client** in any form (payload, DOM, or attribute). The numeric digits that appear are clock times only, never a stress score.
- **FR-018**: Row-level-security-as-user and the SELECT whitelist MUST remain intact everywhere; this feature MUST NOT broaden any read surface.

### Design Constraints (non-negotiable)

> These encode the prior build's specific failures. A build that violates any of them is rejected. All values were reconciled against `serenify-008followups-trend-FINAL.html` and `apps/web/app/globals.css`.

- **DC-001 — Fixed-px rendering (anti-totem)**: The expanded lane plot MUST be drawn at a fixed scale where **1 drawing unit = 1 screen pixel** (the drawing surface's intrinsic width equals its content width — no horizontally stretched coordinate system). This is the root-cause fix for the totem-bar failure.
- **DC-002 — Real proportions**: The plot is a **wide-short** band: full card width (≈1104px desktop drawing area = `max-w-6xl` − 48px padding; ≈280px at the 360px mobile floor) by ≈200px tall. Sessions read as **thin (~3px) horizontal step strokes**, never filled vertical bars. Lane minimum width ≈112px.
- **DC-003 — Axis, not legend**: Level labels live on the **left axis**; there is **no** bottom colour legend.
- **DC-004 — Collapsed is a step-line**: The collapsed view is a **mini step-line**, not bare dots. The expanded card is **compact**, not oversized (sensible height budget ≈200px plot region + timeline).
- **DC-005 — Graphite system**: Card radius **20px** (rounded-2xl), **pill** chips (full-radius), 17px base type, Outfit (display) / Inter (body), mobile-first from a 360px floor, WCAG AA in **both** themes.
- **DC-006 — Amber colour roles (locked tokens, both themes)**: A `--color-amber-text` token MUST be introduced. The amber family has distinct roles that MUST NOT be conflated:

  | Role | Light | Dark | Use |
  |---|---|---|---|
  | Graphic amber (`--color-amber`, existing) | `#C98637` | `#E4AE5C` | tense graph line / markers only — **never small text** |
  | Mid-level line (`--amber-soft-line`) | `#D49A4A` | `#E8BC7A` | "a little tense" graph line only |
  | Chip/label tint (`--amber-tint`) | `#F4E3C6` | `#3B2F19` | chip background for tension rows |
  | Chip/label text (`--color-amber-text`, **new**) | `#8A580F` | `#E6C386` | chip text + axis tension labels |
  | Headline keyword (`--amber-head`) | `#BC7A2A` | `#E4AE5C` | the headline tense word — rendered at **font-weight 700 (bold)** at the 22px display size, so it qualifies as WCAG large text |

- **DC-007 — Verified AA ratios (measured, locked)**: All text passes WCAG AA in both themes; recorded here so the build can be checked, not assumed:

  | Text | Foreground / Background | Ratio | Threshold | Verdict |
  |---|---|---|---|---|
  | Chip text on tint (light) | `#8A580F` on `#F4E3C6` | 4.78:1 | 4.5 (normal) | ✅ |
  | Chip text on tint (dark) | `#E6C386` on `#3B2F19` | 7.79:1 | 4.5 (normal) | ✅ |
  | Axis tension label on card surface (light) | `#8A580F` on `#F4F5F6` | 5.52:1 | 4.5 (normal) | ✅ |
  | Axis tension label on card surface (dark) | `#E6C386` on `#181B1E` | 10.31:1 | 4.5 (normal) | ✅ |
  | Headline keyword (light) | `#BC7A2A` on card surface `#F4F5F6` | 3.23:1 | 3.0 (large text ≥18.66px **at weight 700**) | ✅ |
  | Headline keyword (dark) | `#E4AE5C` on `#181B1E` | 8.65:1 | 3.0 (large text ≥18.66px **at weight 700**) | ✅ |
  | At-ease label (light / dark) | `#346A56` on `#F4F5F6` / `#63B292` on `#181B1E` | 5.76 / 6.85:1 | 4.5 | ✅ |
  | No-read label (light / dark) | `#585D61` on `#F4F5F6` / `#939A9F` on `#181B1E` | 6.10 / 6.06:1 | 4.5 | ✅ |

  Notes: the light headline keyword MUST render on the **card surface** `#F4F5F6` (where it is 3.23:1); against the page background `#EAEBEC` it is 2.95:1 and would fail. The bright graphic amber `#C98637` measures 2.77:1 as small text on the light surface — confirming it is reserved for lines/markers only. The 3:1 basis for the headline keyword is valid **only** because it is bold (weight 700) at 22px (WCAG large text); if the weight is ever reduced below bold, the **4.5:1 normal-text** bar applies and these headline values fail (the light keyword at 3.23:1 would no longer pass).

### Key Entities *(data already modeled in the existing read layer; described here without implementation)*

- **Day recap**: today's summary for the signed-in user — the templated honest headline (names the real peak), the check-in count, a last-read label, and the ordered list of today's sessions. Drives both the collapsed and expanded surfaces.
- **Session (today's monitoring session)**: a single check-in — its ordinal/number and time identity (e.g., "Morning check-in"), its time range, its **peak band / tenor** (one of at-ease, a-little-tense, tense, or no-read), and the **chip label + chip tone** derived from that tenor.
- **Window reading (per session)**: an ordered sequence of windows; each window carries a confident **band** (at-ease / a-little-tense / tense) or **no confident band** (warm-up, skipped, or lost read). The graph's runs and fades are built from this sequence. **No probability is exposed.**
- **Band → visual mapping**: at-ease ↔ meadow (lowest), a-little-tense ↔ mid amber line (mid height), tense ↔ graphic amber (highest), no-read ↔ hollow muted marker on its own low lane.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: In the expanded view, the number of axis level-labels is exactly four (tense / a little tense / at ease / no read) and the number of bottom-legend swatches is **zero**.
- **SC-002**: Sessions render as thin horizontal step strokes, not filled vertical bars: the plot drawing area is wider than it is tall, stroke weight is ~3px, and **no** band is represented by a filled rectangle. Verifiable at both the desktop width and the 360px mobile floor.
- **SC-003**: The collapsed view renders a connected step-line (at least one connecting segment across sessions that have readings), not a set of disconnected dots; the expanded card stays within a sensible height budget (plot region ≈200px tall) and does not read as oversized.
- **SC-004**: For 100% of sessions, the peak band drawn in the graph equals the band represented by that session's timeline chip (no disagreement across any session in any test fixture).
- **SC-005**: The synced highlight works in **both** directions by **mouse** (lane→row and row→lane); by **keyboard**, focusing a plot session target shows a visible focus ring and highlights its timeline row (rows are not separate tab stops); with reduced motion enabled, no transition animation occurs.
- **SC-006**: With more sessions than fit the width, 100% of sessions remain present and reachable by horizontal scrolling, every lane is at least the minimum width (none crushed), and an edge fade is shown at the overflowing edge (and at the left once scrolled).
- **SC-007**: Amber chip text, axis tension labels, and the headline keyword meet WCAG AA in both light and dark themes, at the measured ratios recorded in DC-007 (re-verified at build time, not assumed).
- **SC-008**: No stress-probability value is present anywhere in the client (network payloads, DOM text, or attributes); the only numeric digits shown are clock times.
- **SC-009**: All reads remain owner-scoped and run as the signed-in user, honoring the existing SELECT column whitelist; no read surface is broadened by this feature.
- **SC-010**: The honesty rules hold across fixtures: warm-up and lost-read stretches fade rather than bridge; a fully no-read session shows a hollow marker on its own lane and never on the calm line; the headline never uses the "tense" wording for a day that did not reach tense; and a day that reached a tension peak but whose most recent session sits at a lower band surfaces the recovery (e.g. "…then eased") rather than reporting the peak alone.

## Assumptions

- **A-001**: This feature renders only when the existing check-in card determines there is a recap with ≥1 session for a calibrated user. The card's upstream surface-selection logic (calibrate-first, empty/no-anchor states) is unchanged.
- **A-002**: The within-session live monitoring graph (`components/monitor/session-trend.tsx`) is untouched; the "processed, then deleted" reassurance and any legend remain there, not on the today card.
- **A-003**: The data layer is consumed as-is from `main` (`getSessionTrend` / `getTodayTrend` / `getTodayRecap`, the column-whitelist constants, `deriveRecap`, `sessionTenor`). The backup branch's prior `today-view.tsx` may serve as a structural reference for run/lane geometry and the synced-highlight wiring, but its **rendering approach is the rejected one** and is not reused.
- **A-004**: The dark headline keyword colour was not specified in the brief; per the approved mock it reuses the existing graphic amber `#E4AE5C` (`--amber-head` dark), which measures 8.65:1 on the dark surface (passes large+bold and even normal-text AA).
- **A-005**: Graph **line** colours are graphical objects, and because state is encoded redundantly by height/position they are not held to the 4.5:1 text rule. In the light theme the mid line (`#D49A4A`, 2.26:1) and tense line (`#C98637`, 2.77:1) measure below the 3:1 non-text guideline against the card surface; this is accepted (the mock is the visual authority and height also encodes state) and recorded for awareness. Because graph **line** colours are graphical (not text), they MAY be deepened in a later visual pass to improve light-theme legibility **without** any AA-text penalty — the current values are the mock's, not a hard floor.
- **A-006**: The horizontal session strip carries **its own** thin, styled scrollbar and edge fades as part of this component. App-wide scrollbar restyling is a separate chore and is out of scope.
- **A-007**: This records the resolved FR-011 (not a relaxation of a stricter rule). The synced highlight is reachable **both directions by mouse** (hover a lane or a row); **keyboard** access is via the plot's focusable per-session targets, which show a focus ring and highlight their timeline partner. Timeline rows are intentionally **not** separate keyboard tab stops — this avoids per-row tab-stop bloat and is the accessible design choice.
- **A-008**: "Sessions" are today's monitoring sessions for the signed-in employee, in the user's local day window, as already computed by the existing recap reader.

## Out of Scope

- The within-session live monitoring graph (separate future item).
- App-wide scrollbar styling (separate chore) — only this component's strip scrollbar is in scope.
- Drawing pauses as timeline rows (fast-follow; no pause rows exist yet).
- The preferences feature.
- Any change to the data layer, RLS policies, or the SELECT whitelist.
