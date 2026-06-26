# UI Contract — Live "This session" monitoring graph

This feature exposes a **UI component contract** (a frontend app, not a service). The contract is the `SessionTrend` prop surface plus the render invariants the tests assert. No HTTP/API contract changes (the read layer is consumed unchanged).

## Component

```
SessionTrend (client component)
└─ card: "This session" title · honest subtitle · fixed-px SVG (step-line + no-read treatments + now-marker) · band+no-read legend
```

## `SessionTrend` props (existing wiring + one new gate prop)

```ts
interface SessionTrendProps {
  sessionId: string;
  active?: boolean;                                   // keep polling while live (default true) — EXISTING
  load?: (sessionId: string) => Promise<SessionTrendPoint[]>; // injectable reader (default getSessionTrend) — EXISTING
  pollMs?: number;                                    // poll cadence (default 12_000) — EXISTING
  showOutOfFrameFoggy?: boolean;                      // NEW (F7/FR-015): foggy gate, default FALSE at launch.
                                                      //   Governs out-of-frame routing + copy + legend key together.
                                                      //   Injectable so gate-OFF and gate-ON are both unit-testable.
}
```

No change to how `monitoring-session.tsx` mounts it (it already passes `sessionId`/`active`/`load`); `showOutOfFrameFoggy` defaults to false, so the mount site needs no change at launch.

## Render invariants (asserted by tests — these ARE the acceptance gates)

### Fixed-px (DC-001 / SC-001 / SC-002)
- The `<svg>` MUST set `width = W` (px, the rendered container width) and `viewBox = "0 0 W 210"`; the two widths MUST be equal (1 unit = 1px). MUST NOT use `preserveAspectRatio="none"` on a small fixed viewBox.
- The now-marker MUST be a true `<circle>` (1:1) at the 360px floor **and** at the `max-w-3xl` (~768px) column.
- The graph fills its container width and imposes no narrower max-width (matched pair with the camera card above — same `max-w-3xl` column).

### Rolling window + fill-to-width slots (F1 / FR-002a / SC-012 / SC-012a)
- Only windows within the last ~120s are drawn; each capture window (confident **and** no-read) occupies one **equal-width** slot. **N_target = 12** = the lock count (120s ÷ the ~10s capture-**window stride**, NOT the ~12s client poll cadence).
- **Fill-to-width** (CHK012, decided 2026-06-27): the drawn windows **always span the full plot edge-to-edge** — earliest at `left`, latest ("now") at the **right edge** — with pitch `= plotWidth / (nDraw − 1)`. During **ramp-up** (nDraw < N_target) the few windows stretch to fill and gently re-space as each new window arrives; at **N_target** the pitch **locks** at `plotWidth / (N_target − 1)` and older windows scroll off the left thereafter. The ramp-up pitch equals the locked pitch at nDraw = N_target → continuous, no jump. `count === 1` → a single dot pinned at the right edge (FR-019), the pitch formula not applied.
- A no-read gap's width is proportional to its count of consecutive no-read windows (each occupies one pitch-width slot). If the edge-to-edge pitch would fall below `MIN_SLOT` (narrow widths), the drawn count is capped (oldest dropped) so the pitch stays ≥ MIN_SLOT — never shrink the slot below the floor (CHK023).

### Step-line state encoding (FR-003 / SC-003)
- Continuous step-line; **colour encodes band** (at ease `--color-meadow`, a little tense `--amber-soft-line`, tense `--color-amber`), **height encodes tension** (`BAND_Y`; tenser = higher). Each band → distinct Y **and** distinct token.
- `bandCount === 1` → a single dot, not a line (SC-010).

### Three no-read treatments (US2 / FR-010–FR-015 / SC-004 / SC-008 / SC-009)
- **warming** (leading null/null run, before any confident reading): dashed muted line ("getting a read") — a line, not a gap; start-only.
- **no-clear-read** (any other null-band window): fade-out → gap → fade-in, muted label "no clear read". At launch this also covers **out-of-frame** (gate OFF).
- **foggy** (out-of-frame, **only when `showOutOfFrameFoggy` true**): fade-out → gap → fade-in, foggy label "step back into frame".
- A no-read NEVER bridges the calm line; **fade-in only** when there is no prior confident reading (leading/skip-first). Fades are **static opacity** (`.25`), not animation.
- Mid-session re-warm (null/null after a confident reading) → no-clear-read gap, never a dashed line (FR-014).

### Now-marker (US1/US3 / FR-004(a/b) / SC-011)
- **live** (live edge confident): dot, `fill = BAND_LINE[band]` (recolours), gentle pulse, popup "you are here".
- **parked** (active no-read w/ ≥1 prior confident): last confident reading, **solid `--color-muted` fill** (F6), **no pulse/halo**, popup "last clear read".
- **none**: no marker whenever no confident reading has **ever** occurred (warming / leading skip / all-skipped).
- Reveals popup on hover **and** focus **and** tap (focus-within); dismiss on blur/tap-away (CHK014). Keyboard-focusable; accessible label reflects live vs parked. Hit-area ≥44×44 on touch viewports (Principle VI).
- Reduced-motion: static halo, no pulse (SC-006).

### Subtitle honesty (FR-024 / SC-013)
- `confident` → peak-derived summary; `warming` → non-asserting line; `active_no_read` / `all_skipped` → **neutral no-read line** (**"No clear read right now"**); resumes the summary on a confident reading. Never a tension word without a current confident reading.

### Legend (FR-021 / CHK005)
- Band keys: at ease (`--color-meadow`), a little tense (`--amber-soft-line`), tense (`--color-amber`).
- No-read keys follow the gate: **two** at launch (warming, no clear read); the **foggy "stepped out of frame"** key appears only when `showOutOfFrameFoggy` is true.

### Empty / privacy (FR-018 / FR-017 / SC-007)
- Zero trend points → text-only ("Your trend builds as readings come in."), no axes/line. A warming-only/all-skipped session (≥1 point) is a no-read state, not empty.
- **No numeric value of any kind** in any DOM node or attribute. No new read; whitelist + RLS-as-user unchanged.
