# UI Contract — Today-Card Trend Components

This feature exposes **UI component contracts** (a frontend app, not a service). The contract is the component prop surface plus the render invariants that the tests assert. No HTTP/API contract changes (the read layer is consumed unchanged).

## Component tree

```
TodayView (orchestrator, client component)
├─ collapsed:  eyebrow · honest headline · TodayMiniTrend · actions(Start, "View today ▾")
└─ expanded:   eyebrow · honest headline · hint · actions(Start, "Hide today ▴")
               · plot row: [ left axis (fixed) | TodayTrendPlot (scrollable, fixed-px) ]
               · divider
               · TodayTimeline
```

## `TodayView` props (consumed from the card; unchanged wiring)

```ts
interface TodayViewProps {
  recap: TodayRecap;          // existing reader output (drives headline, sessions, eyebrow)
  trendRows: TodayTrendRow[]; // existing reader output (per-window sequences)
  expanded: boolean;          // lifted to the card (single toggle)
  onToggle: () => void;
  startHref?: string;         // full-document nav into the capture route (camera Permissions-Policy)
}
```

## Render invariants (asserted by tests — these ARE the acceptance gates)

### Fixed-px (DC-001 / SC-002)
- The plot `<svg>` MUST set `width = nLanes × laneWidth` (px) and `viewBox = "0 0 {sameWidth} {height≈200}"`. The two widths MUST be equal (1 unit = 1px).
- MUST NOT use `preserveAspectRatio="none"` on a small fixed viewBox stretched to `width:100%`.
- `laneWidth ≥ 112`; all lanes equal width; strokes ~3px; **no `<rect>` encodes a band height** (lane backgrounds for highlight are allowed, but carry no band meaning).
- Holds at the desktop drawing area **and** at the 360px floor.

### Axis, not legend (DC-003 / SC-001)
- Exactly four axis level-labels in the fixed left column: `tense`, `a little tense`, `at ease`, `no read`.
- Tension labels use `--color-amber-text`; `at ease` uses `--color-meadow-text`; `no read` uses `--color-muted`. All on the card surface.
- **No** bottom colour legend / swatch list anywhere in the component.

### State encoding (FR-006 / SC-004 / SC-010)
- Height **and** colour per band (table in data-model.md). `at_ease` is the lowest band line; `no_read` is a **hollow** marker on its own lower lane — never on the calm line.
- Each lane's peak colour/marker derives from `RecapSession.tenor` (same value as the chip) — never a separate recomputation.
- Warm-up (leading `band===null`) and lost-read (interior `band===null`) render **faded/eased**, never bridged at a fixed level.
- `bandCount===1` → a single dot.

### Collapsed mini-trend (DC-004 / SC-003)
- A continuous wide-short **step-line**: one peak marker per session at its `tenor` height (colour echoing the headline) joined by faded step connectors. **Not** isolated dots. No-read session → hollow marker on the low lane.

### Headline (FR-001/FR-002 — pending R-2)
- Render `recap.headline.pre` + `hot` + `post`; `hot` (when present) wrapped in `--amber-head` at **font-weight 700**, on the **card surface** (so `#BC7A2A` clears 3:1). When `hot` is null (calm day), no amber keyword.

### Synced highlight (FR-011 / SC-005)
- One active-session id. Mouse hover on a lane OR a row → both highlight (both directions). Keyboard focus on the **plot per-session target** (`tabindex=0`, `role=button`, `aria-label` includes the tenor) → visible focus ring + its timeline row highlights. Rows are NOT separate tab stops.
- All highlight/expand/fade transitions gate on `useMediaQuery('(prefers-reduced-motion: reduce)')`.

### Overflow (FR-014 / SC-006)
- More lanes than fit → component-local horizontal scroll, lanes keep min width (never crushed), right edge-fade when more remains, left edge-fade once scrolled. Scrollbar styling is component-local only.

### Timeline (FR-012 / FR-013)
- One row per session: number, `timeIdentity`, state-coloured **pill** chip (`chipTone` → meadow / amber-tint+amber-text / muted), `timeRange`. Single "Hide today" toggle. **No** "processed, then deleted" line (that stays on the live monitor).

### Privacy (FR-017 / SC-008 / SC-009)
- No probability value in any payload, DOM node, or attribute. Only clock-time digits appear. No new read; whitelist + RLS-as-user unchanged.

## Token contract (added to `globals.css`, both themes — see research R-3)

`--color-amber-text`, `--amber-tint`, `--amber-soft-line`, `--amber-head` (values in research R-3; light amber-text value pending the R-3 fork). `--color-amber` (existing) stays on lines/markers only. Component-local scrollbar + edge-fade utilities.
