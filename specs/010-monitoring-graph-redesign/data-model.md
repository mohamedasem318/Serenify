# Phase 1 Data Model — Live "This session" monitoring-graph (009b)

This feature **adds no persistent entities** and **no new reads**. It consumes the existing read-only `SessionTrendPoint[]` (`getSessionTrend`, RLS-as-user) and derives a **client-only view-model** for rendering. Everything below is pure/derived (lives in `lib/session-trend-geometry.ts`) — unit-testable without Supabase or timers.

## Consumed input (existing, unchanged)

`SessionTrendPoint` (from `lib/api/monitoring-reads.ts`, one capture window):

| Field | Type | Use here |
|---|---|---|
| `id` | string | React key |
| `capturedAt` | ISO-8601 UTC | rolling-window selection (last ~120s) + window ordering; **never rendered as a number** |
| `scored` | boolean | **unused for rendering** (CHK015) — band + skipCause + position fully determine the treatment; documented as ignored |
| `band` | `at_ease \| a_little_tense \| tense \| null` | segment height (`BAND_Y`) + colour (`BAND_LINE`); null ⇒ a no-read window |
| `skipCause` | `low-light \| out-of-frame \| insufficient-face \| our-side \| null` | no-read treatment selection; null-on-null = warming/re-warm |

Input is consumed **as-is**; the SELECT whitelist (`id, captured_at, scored, band, skip_cause`) is unchanged. `label` / `stress_probability` are never selected (FR-020).

## Geometry constants (from the mock — `session-trend-geometry.ts`)

```
H = 210                         # fixed canvas height (viewBox height; width = container px)
BAND_Y   = { tense: 58, a_little_tense: 120, at_ease: 182 }   # distinct Y per band (SC-003)
BAND_LINE= { tense: var(--color-amber),
             a_little_tense: var(--amber-soft-line),          # FR-023 token (not mock placeholder)
             at_ease: var(--color-meadow) }                   # distinct colour per band (SC-003)
NO_READ_COLOR = var(--color-muted)     # warming line + no-clear-read label/fade
FOGGY_COLOR   = var(--color-foggy)     # out-of-frame foggy (gated)
AXIS_GUTTER ≈ 140   RIGHT_MARGIN ≈ 60  # plot area = [axisGutter, W − rightMargin]; RESPONSIVE:
#   below GUTTER_FULL_W (≈560) the gutter/right-margin/label-offset interpolate DOWN to MINs
#   (AXIS_GUTTER_MIN≈84, RIGHT_MARGIN_MIN≈24, LABEL_GUTTER_MIN≈8) at GUTTER_MIN_W (≈320), so the
#   plot keeps width for legible no-read labels at the 360px floor (axis labels retained).
STROKE = 3   WARM_STROKE = 2.5 (dash "2 5", opacity .55)   FADE_OPACITY = .25
NOW_R = 5   HALO_R = 5→13 (pulse)   HIT_R ≥ 22 (≥44px touch target; mock r=15)
WINDOW_MS = 120_000   N_TARGET = 12   MIN_SLOT = <legibility floor, gap-label font 11px>
#   N_TARGET = 12 = 120s ÷ the ~10s capture-WINDOW stride (DEFAULT_STRIDE_MS), NOT the ~12s
#   client poll cadence — the lock count for the fill-to-width pitch (see I4 reconciliation).
```

## Derived view-model

### `WindowSlot` (one capture window → one uniform slot)
| Field | Type | Notes |
|---|---|---|
| `index` | number | 0 = oldest drawn (at the left edge), latest = rightmost (at the right edge) — fill-to-width |
| `x` | number (px) | slot centre = `left + index × pitch`, `pitch = plotWidth / (nDraw − 1)` (fill-to-width); `nDraw === 1` → pinned at the right edge |
| `kind` | `confident \| warming \| foggy \| no_clear_read` | from `band`/`skipCause`/position + gate (R-3) |
| `y` | number \| null | `BAND_Y[band]` for confident; null for no-read |
| `band` | Band \| null | |

### `Treatment` (per no-read run)
| Field | Type | Notes |
|---|---|---|
| `kind` | `warming \| foggy \| no_clear_read` | warming = leading null/null run only |
| `fadeIn` / `fadeOut` | bool | fadeOut requires a **prior confident reading**; a leading/skip-first run is **fade-in only** (FR-013, CHK020) |
| `label` | string | "getting a read" / "step back into frame" (gated) / "no clear read" (FR-022) |
| `color` | token | muted (warming, no-clear-read) / foggy (out-of-frame, gate ON) |

### `NowMarker`
| Field | Type | Notes |
|---|---|---|
| `state` | `live \| parked \| none` | R-4 / FR-004(a/b) |
| `x,y` | number | live = latest confident; parked = last confident reading |
| `fill` | token | live = `BAND_LINE[band]`; parked = `--color-muted` (F6) |
| `pulse` | bool | live && !reducedMotion; parked = false |
| `popup` | string | "you are here" (live) / "last clear read" (parked) |

### `SubtitleState` (FR-024 / R-6)
`confident` → peak-derived summary · `warming` → non-asserting line · `active_no_read` / `all_skipped` → **neutral no-read line** (**"No clear read right now"**, signed off 2026-06-25). Resumes the summary when a confident reading returns. Never asserts a tension level without a current confident reading (SC-013).

## State derivation rules (the honesty core)

1. **Rolling window + fill-to-width:** drop windows with `capturedAt < now − WINDOW_MS`; draw the remaining (capped at the last N_TARGET) **edge-to-edge** with pitch `plotWidth / (nDraw − 1)` — ramp-up fills, locking at `plotWidth / (N_TARGET − 1)` at nDraw = N_TARGET, continuous (no jump); `nDraw === 1` → single dot at the right edge. If the edge-to-edge pitch would fall below `MIN_SLOT` (narrow widths), cap the drawn count (drop oldest) so the pitch stays ≥ MIN_SLOT — never shrink below the floor (FR-002a/SC-012/SC-012a).
2. **warming** = leading run of `band null & skipCause null` **before any confident reading** → dashed muted line (start-only, FR-010/FR-014).
3. **out-of-frame** (`skipCause === "out-of-frame"`): gate ON → foggy; gate OFF (launch) → no_clear_read (FR-015/F7).
4. **no_clear_read** = any other null-band window (low-light/insufficient-face/our-side, re-warm, or gated-off out-of-frame) → muted gap (FR-012/FR-014).
5. **no bridge:** a no-read never draws a flat carried-forward line; fade-out at the prior level, gap, fade-in at the next; **fade-in only** when there is no prior confident reading (FR-013/SC-009).
6. **single / isolated confident reading** → a dot, not a line (FR-019/SC-010). This applies to a whole-session single reading **and** to any **lone confident reading flanked by no-reads** (a run of length 1 between gaps): a single point cannot be a line, so it renders as a dot at its band — extending FR-019's single-reading rule to any isolated confident point.
7. **no confident reading ever** (warming / leading skip / all-skipped) → no now-marker (FR-004b); never render calm/at-ease (SC-010). **Also** (FR-004a × FR-002a rolling-window intersection): when there **is** a prior confident reading but it has **scrolled off the rolling window** so none remains on-screen to anchor to, render **no now-marker** rather than a parked marker pointing off-screen — there is honestly nothing visible to point at. The parked marker (FR-004a) appears only while the last confident reading is still within the drawn window.
8. **zero trend points — or exactly one warming point** (a single `band null & skipCause null` window, no drawable line yet) → text-only empty state (FR-018, 1-warming-point carve-out 2026-06-27; the lone right-edge stub is suppressed, subtitle still warming per FR-024). A warming-only session with **≥2** warming points → the dashed line; an **all-skipped** session (≥1 *skip* point) → a muted no-read state, not empty.

## Out of scope (no change)
Read layer / `getSessionTrend` / RLS / SELECT whitelist / `monitoring_sessions` / `window_readings` schema / the monitor page layout / `globals.css` tokens / any numeric probability.
