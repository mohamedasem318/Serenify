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
AXIS_GUTTER ≈ 140   RIGHT_MARGIN ≈ 60  # plot area = [AXIS_GUTTER, W − RIGHT_MARGIN]
STROKE = 3   WARM_STROKE = 2.5 (dash "2 5", opacity .55)   FADE_OPACITY = .25
NOW_R = 5   HALO_R = 5→13 (pulse)   HIT_R ≥ 22 (≥44px touch target; mock r=15)
WINDOW_MS = 120_000   N_TARGET ≈ 10   MIN_SLOT = <legibility floor, gap-label font 11px>
```

## Derived view-model

### `WindowSlot` (one capture window → one uniform slot)
| Field | Type | Notes |
|---|---|---|
| `index` | number | 0 = oldest drawn, right-anchored so latest = rightmost |
| `x` | number (px) | slot centre = `(W − RIGHT_MARGIN) − (lastIndex − index) × slotW` |
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

1. **Rolling window:** drop windows with `capturedAt < now − WINDOW_MS`; if `(W−AXIS_GUTTER−RIGHT_MARGIN)/N_TARGET < MIN_SLOT`, reduce N_TARGET (drop oldest) — never shrink the slot (FR-002a/SC-012).
2. **warming** = leading run of `band null & skipCause null` **before any confident reading** → dashed muted line (start-only, FR-010/FR-014).
3. **out-of-frame** (`skipCause === "out-of-frame"`): gate ON → foggy; gate OFF (launch) → no_clear_read (FR-015/F7).
4. **no_clear_read** = any other null-band window (low-light/insufficient-face/our-side, re-warm, or gated-off out-of-frame) → muted gap (FR-012/FR-014).
5. **no bridge:** a no-read never draws a flat carried-forward line; fade-out at the prior level, gap, fade-in at the next; **fade-in only** when there is no prior confident reading (FR-013/SC-009).
6. **single / isolated confident reading** → a dot, not a line (FR-019/SC-010). This applies to a whole-session single reading **and** to any **lone confident reading flanked by no-reads** (a run of length 1 between gaps): a single point cannot be a line, so it renders as a dot at its band — extending FR-019's single-reading rule to any isolated confident point.
7. **no confident reading ever** (warming / leading skip / all-skipped) → no now-marker (FR-004b); never render calm/at-ease (SC-010). **Also** (FR-004a × FR-002a rolling-window intersection): when there **is** a prior confident reading but it has **scrolled off the rolling window** so none remains on-screen to anchor to, render **no now-marker** rather than a parked marker pointing off-screen — there is honestly nothing visible to point at. The parked marker (FR-004a) appears only while the last confident reading is still within the drawn window.
8. **zero trend points** → text-only empty state (FR-018); a warming-only/all-skipped session (≥1 point) is a no-read state, not empty.

## Out of scope (no change)
Read layer / `getSessionTrend` / RLS / SELECT whitelist / `monitoring_sessions` / `window_readings` schema / the monitor page layout / `globals.css` tokens / any numeric probability.
