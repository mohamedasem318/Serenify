# Phase 1 Data Model — Today-Card Stress Trend Redesign

**This feature adds no schema, no migration, and no new read.** It consumes the **existing** view-model already exported by `apps/web/lib/api/monitoring-reads.ts` and returned by the existing RLS-as-user readers. This document records the **shape the components consume** (read-only) so the rendering and tests bind to a stable contract — not to introduce new persistence.

## Source of truth (existing, unchanged)

- Reader: `getTodayRecap(userId)` → `TodayRecap` (used by the card; drives both surfaces).
- Reader: `getTodayTrend(userId)` → `TodayTrendRow[]` (per-window band sequence for all of today's retrospective sessions).
- Reader: `getSessionTrend(sessionId)` → `SessionTrendPoint[]` (per-window for one session — used by the out-of-scope monitor graph; **not** needed here, listed for completeness).
- SELECT whitelist constants (unchanged): `SESSION_TREND_COLUMNS`, `TODAY_TREND_COLUMNS`, `RECAP_SESSION_COLUMNS`. **`band` is owner-readable; `label` and `stress_probability` are never selected.**

## Consumed entities

### `TodayRecap` (drives collapsed + expanded)
| Field | Type | Use in this feature |
|---|---|---|
| `sessions` | `RecapSession[]` | chronological retrospective sessions (fresh-live excluded) → lanes, mini peaks, timeline rows |
| `headline` | `TemplatedHeadline` `{pre, hot, post}` | honest header; render `hot` in `--amber-head` (weight 700) on the **card surface**; `hot` is null on a calm day. **See research R-2 fork** (the "tense" wording honesty). |
| `daySpan` | `{startMs,endMs} \| null` | **not used** for x-position any more — x is ordinal, not wall-clock (FR-008). May still inform the "last read" copy. |
| `lastReadLabel` | `string \| null` | eyebrow meta ("last read 3:05") |
| `checkinCount` | `number` | eyebrow meta ("6 check-ins") |
| `peakSessionId` / `peakAtMs` | `string\|null` / `number\|null` | day-level peak (already only set when stress was reached); informs the headline/peak emphasis. Not an x-coordinate. |

### `RecapSession` (one per lane + one per timeline row)
| Field | Type | Use |
|---|---|---|
| `sessionId` | `string` | stable key linking lane ↔ row for the synced highlight |
| `number` | `number` | 1-based ordinal; the lane label and row number |
| `timeIdentity` | `string` | "Morning/Afternoon/… check-in" (row label) |
| `timeRange` | `string` | "2:05 – 2:18" (row meta) |
| **`tenor`** | `SessionTenor` = `Band \| "no_read"` | **single source for the lane peak AND the chip** (SC-004). `at_ease \| a_little_tense \| tense \| no_read`. |
| `chipLabel` | `string` | "at ease" / "a little tense" / "ended tense" / "a tense stretch" / "no clear read" |
| `chipTone` | `ChipTone` = `meadow\|amber\|muted` | chip colour (meadow / amber-tint+amber-text / muted) |
| `readLess` | `boolean` | true → render the hollow no-read marker on its own lane, never on the calm line |
| `bandCount` | `number` | `1` → render a single dot, not a line (FR-005) |
| `phrase` | `string` | optional short row phrase ("climbed steadily", "eased off") |

### `TodayTrendRow` (the per-window sequence → step runs)
| Field | Type | Use |
|---|---|---|
| `sessionId` | `string` | group rows into per-session sequences |
| `capturedAt` | `string` (ISO) | **ordering only** (sort within a session); NOT an x-coordinate (x is ordinal index) |
| `band` | `Band \| null` | `at_ease\|a_little_tense\|tense` → step height+colour; **`null`** = warm-up / skipped / lost-read → a faded/eased segment or a run break (never bridged) |
| `scored` | `boolean` | window was scored |
| `skipCause` | `SkipCause \| null` | `low-light\|out-of-frame\|insufficient-face\|our-side` — informs honesty phrasing only |

> **Privacy invariant:** `band` is the most sensitive field that reaches the client, by existing whitelist design. `stress_probability` / `label` are not in any select and MUST stay out (FR-017/SC-008).

## Derived (in-component) view-model — NEW, pure, in `lib/trend-geometry.ts`

These are **computed from the above at render time** (no persistence). Unit-tested in isolation.

### `LanePlot`
```
LanePlot = {
  laneWidth: number          // fixed px (≥112); equal for all lanes
  width: number              // nLanes × laneWidth  (== SVG width attr == viewBox width)  ← DC-001
  height: number             // ≈200
  lanes: Lane[]
}
```

### `Lane` (one session)
```
Lane = {
  sessionId: string
  index: number              // ordinal x slot (FR-008: sequence within, ordinal between)
  tenor: SessionTenor        // from RecapSession.tenor (SC-004)
  runs: Run[]                // consecutive same-band windows collapsed; only transitions drawn (FR-005)
  warmup?: FadeSegment       // leading band===null stretch → eased-in, not bridged (FR-007)
  lostReads: FadeSegment[]   // interior band===null gaps → faded dashes, not bridged (FR-007)
  noRead: boolean            // whole session read-less → one hollow marker on the no-read lane (FR-006)
  singleDot: boolean         // bandCount===1 → a dot, not a line (FR-005)
}
Run = { band: Band; xStart: number; xEnd: number; y: number }   // y from band: tense<little<ease<noread
```

### `MiniTrend` (collapsed)
```
MiniTrend = one peak marker per session (a short horizontal step segment at the session's `tenor` height,
            colour echoing the headline), connected by faded step connectors → a CONTINUOUS step-line
            (never bare dots, FR-003). No-read session → a hollow marker on the low lane.
```

### Band → Y / colour mapping (locked to the mock)
| Band / state | Y (on 200px canvas) | Line colour token |
|---|---|---|
| `tense` | 44 (highest) | `--color-amber` |
| `a_little_tense` | 88 | `--amber-soft-line` |
| `at_ease` | 132 (lowest band) | `--color-meadow` |
| `no_read` | 172 (own lane) | hollow, `--color-muted` stroke |

No state is ever encoded by a filled rectangle (SC-002).
