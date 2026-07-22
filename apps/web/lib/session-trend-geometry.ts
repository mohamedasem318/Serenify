/**
 * Feature 010 / 009b — pure geometry + honesty derivation for the live "This session"
 * monitoring graph (no React, no DOM, no Supabase). The component
 * (`components/monitor/session-trend.tsx`) measures its container width and hands it here;
 * everything visual is derived deterministically so the honesty-critical branching is
 * unit-tested in isolation BEFORE any pixel is drawn.
 *
 * ── Preconditions verified at build time (T001) ───────────────────────────────────────
 *   • TOKENS: every colour this module names already exists in `apps/web/app/globals.css`
 *     in BOTH themes — `--color-meadow`, `--amber-soft-line` (FR-023, not the mock
 *     placeholder), `--color-amber`, `--color-muted`, `--color-foggy`. → NO globals.css
 *     change (CHK005).
 *   • LAYOUT: `<SessionTrend>` and the camera card already share the `mx-auto w-full
 *     max-w-3xl` column in `components/monitor/monitoring-session.tsx`, so the matched-pair
 *     width (FR-002) holds with NO page-layout change (CHK018).
 *   • READ LAYER: `getSessionTrend` (`lib/api/monitoring-reads.ts`) is consumed UNCHANGED
 *     (FR-020); no probability reaches the client (FR-017).
 *
 * ── The load-bearing rules ────────────────────────────────────────────────────────────
 *   • FIXED-PX (DC-001 / FR-001 / SC-001): 1 unit = 1px. The caller sets the SVG `width`
 *     AND a matching `viewBox` width to `view.width` — NO stretched viewBox — so the now
 *     marker is a TRUE circle at any width.
 *   • FILL-TO-WIDTH / ROLLING WINDOW (FR-002a / SC-012 / SC-012a): each capture window
 *     (confident AND no-read alike) occupies one EQUAL-width slot; the drawn windows ALWAYS
 *     span the full plot edge-to-edge — earliest at `left`, latest ("now") at the right edge —
 *     with pitch = plotWidth/(nDraw−1). During ramp-up (nDraw < N_TARGET) the few windows
 *     stretch to fill and gently re-space as each poll adds one; at N_TARGET the pitch LOCKS at
 *     plotWidth/(N_TARGET−1) and older windows scroll off the left thereafter (continuous — the
 *     ramp formula equals the locked pitch at nDraw === N_TARGET, no jump). Windows older than
 *     ~2 min scroll off the left; if the edge-to-edge pitch would fall below `MIN_SLOT` the
 *     drawn count is capped (OLDEST dropped) so the pitch stays ≥ MIN_SLOT (legibility wins).
 *   • THREE HONEST NO-READ TREATMENTS (FR-010..FR-015): warming = a leading null/null run
 *     before any confident reading → dashed muted line ("getting a read"); foggy =
 *     out-of-frame, BUILT BUT GATED OFF at launch (`showOutOfFrameFoggy=false`) → only then
 *     "step back into frame"; no_clear_read = every other null (incl. gated-off out-of-frame
 *     and mid-session re-warm) → muted gap. A no-read NEVER bridges the calm line; fades are
 *     STATIC opacity (FR-013), and fade-in only when there is no prior confident reading.
 *   • NOW MARKER (FR-004 / FR-004a / FR-004b): live (recolours to band, pulses) / parked
 *     (solid `--color-muted`, static, "last clear read") / none (no confident reading EVER).
 *   • SUBTITLE (FR-024): never asserts a tension level without a CURRENT confident reading.
 *
 * `scored` is intentionally UNUSED for rendering (CHK015): band + skipCause + position
 * fully determine every treatment. `nowMs` is injected (pure/testable; no `Date.now()` here).
 */

import type { Band } from "@/lib/api/monitoring-client";
import type { SkipCause } from "@/lib/api/monitoring-reads";

// ── Geometry constants (locked to docs/mockups/serenify-live-session-graph-mock.html) ───────────────

/** Fixed canvas height = the viewBox height; width = the container px (set by the caller). */
export const H = 210;

/** Distinct Y per band — tenser = higher (smaller Y). The mock's gridlines (SC-003). */
export const BAND_Y: Record<Band, number> = {
  tense: 58,
  a_little_tense: 120,
  at_ease: 182,
};

/** Distinct colour token per band. Mid band = FR-023 `--amber-soft-line` (not the mock
 *  placeholder), for cross-surface consistency with the 009 today-card. (SC-003) */
export const BAND_LINE: Record<Band, string> = {
  at_ease: "var(--color-meadow)",
  a_little_tense: "var(--amber-soft-line)",
  tense: "var(--color-amber)",
};

/** Warming line + no-clear-read fades/label — muted, NEVER amber (no-read is not stress). */
export const NO_READ_COLOR = "var(--color-muted)";
/** Out-of-frame foggy (attention) — used ONLY when the FR-015 gate is on. */
export const FOGGY_COLOR = "var(--color-foggy)";

/** Plot area = [axisGutter, width − rightMargin]. At wide widths these are the mock values
 *  (gridlines x 140 → 520, W 580); below GUTTER_FULL_W they shrink toward their MINs (see below). */
export const AXIS_GUTTER = 140;
export const RIGHT_MARGIN = 60;
/** Axis label sits this far left of the gutter (mock x=92 with gutter 140). */
export const LABEL_GUTTER = 48;

// Responsive narrow-width axis sizing (FR-002 narrow-width clarification, decided 2026-06-25).
// The fixed 140/60 gutters left only ~86px of plot at the ~286px measured width of a 360px
// viewport (crammed; the foggy label overflowed). Below GUTTER_FULL_W the gutter, right margin,
// and label offset interpolate DOWN to their MINs at GUTTER_MIN_W, so the plot keeps enough
// width for legible no-read labels at the floor. The left axis labels STAY — the min gutter
// (84px) still fits "A little tense" at 11px. Wide widths are unchanged (full mock gutters).
export const AXIS_GUTTER_MIN = 84;
export const RIGHT_MARGIN_MIN = 24;
export const LABEL_GUTTER_MIN = 8;
export const GUTTER_MIN_W = 320; // at/below this width → MIN gutters
export const GUTTER_FULL_W = 560; // at/above this width → full (mock) gutters

export const STROKE = 3; // confident step-line
export const WARM_STROKE = 2.5; // warming dashed line
export const WARM_DASH = "2 5";
export const WARM_OPACITY = 0.55;
export const FADE_OPACITY = 0.25; // static fade flanks (NOT animation — FR-013)
/** A muted, non-band Y for the warming squiggle — deliberately on NO band line so it can
 *  never be misread as a band (mock ~166–178). */
export const WARM_Y = 168;

export const NOW_R = 5; // now-marker dot radius (mock)
export const HALO_R_MIN = 5; // pulse start (mock @keyframes)
export const HALO_R_MAX = 13; // pulse end (mock @keyframes)
/** Touch hit-area radius — ≥22 ⇒ ≥44px target (Principle VI); an INTENDED divergence from
 *  the mock's r=15. (Enforced/asserted in the component layer, T023.) */
export const HIT_R = 22;

export const WINDOW_MS = 120_000; // rolling window ≈ 2 min (FR-002a)
/** The lock count for fill-to-width: 120s ÷ the ~10s capture-WINDOW stride (DEFAULT_STRIDE_MS,
 *  monitoring's scoreable-window cadence) — NOT the ~12s client poll/re-fetch cadence. At nDraw
 *  === N_TARGET the edge-to-edge pitch locks at plotWidth/(N_TARGET−1) (FR-002a / SC-012a). */
export const N_TARGET = 12;
/** One capture-window stride. Equals the recorder's DEFAULT_STRIDE_MS (10s); kept DERIVED from
 *  the local geometry constants so this deliberately-pure module never imports the browser-only
 *  recorder. (WINDOW_MS / N_TARGET = 120_000 / 12 = 10_000 = window-recorder.ts DEFAULT_STRIDE_MS.) */
export const STRIDE_MS = WINDOW_MS / N_TARGET; // 10_000

/** Client re-fetch cadence for `getSessionTrend` — the steady-state poll BACKSTOP (the
 *  event-driven `refreshSignal` carries the fast path). `<SessionTrend>` defaults its `pollMs`
 *  prop to THIS single source of truth, so the freshness horizon below stays in lock-step with
 *  the poll instead of duplicating a 12_000 magic number across the lib/component boundary. */
export const POLL_MS = 12_000;

/**
 * Worst-case HEALTHY per-window processing time, from server upload-arrival (`captured_at`, stamped
 * at the TOP of `score_window` BEFORE probe → anchor → predict → smooth → insert) to the persisted
 * `window_readings` row. So a reading is already this old — at most — the instant it lands, before
 * any client fetch can even see it. Anchored on the DOCUMENTED worst case, COLD window included:
 * BACKLOG #110/#112 (post-PR #113) measured steady-state ~18–22 s/window with a ~27–29 s cold-start
 * spike on window 1. Rounded UP to 30 s — deliberately generous, because false-parking a live read
 * (the active ST-7 bug, FR-004a) is the failure we are fixing, whereas parking a few seconds late
 * on a genuine freeze is a trivial cost. (Laptop figures; the Azure-VM re-measure is warm-up #112,
 * a separate concern from this freshness gate.) */
export const PROCESSING_CEILING_MS = 30_000;

/** Cushion ON TOP of the worst-case healthy read age — absorbs client/server clock skew AND
 *  poll/processing jitter (run-to-run variance + the sub-poll gap before a fresh row is fetched).
 *  Honestly named: NOT skew-only. Keeps a healthy live session comfortably clear of the threshold. */
export const FRESHNESS_MARGIN_MS = 8_000;

/**
 * Live-edge freshness horizon (FR-004a honesty — fix for ST-7 / #117). The marker is "live"
 * (and the subtitle asserts the session summary) ONLY while the latest reading is no older than
 * this; past it the live edge is treated as an (implicit) active no-read so the marker PARKS
 * muted ("last clear read") instead of falsely pulsing "you are here" on a stale reading.
 *
 * Why this matters: out of frame the no-read rows may not reach the client, so the geometry sees
 * a FROZEN confident session while the 1s clock keeps advancing `nowMs`. Deriving "current
 * reading" from "the last point is confident" alone (no age check) kept the marker live on stale
 * data until it scrolled off — the exact dishonesty this redesign exists to prevent.
 *
 * Derived from NAMED constants (no magic number). The worst-case age a HEALTHY freshest reading
 * can legitimately reach before a newer one replaces it = one window still in flight (STRIDE_MS)
 * + that window's processing to insert (PROCESSING_CEILING_MS) + one poll cycle to fetch it
 * (POLL_MS) = 52 s; the FRESHNESS_MARGIN_MS cushion lands the horizon at 60 s — comfortably ABOVE
 * that worst healthy age yet FAR BELOW WINDOW_MS (120 s, scroll-off), so a live session never
 * false-parks while a real freeze still parks long before its last reading slides off the window.
 * (The old 20 s horizon predated the PR-#113 ~18–22 s processing band and false-parked healthy
 * reads as stale — the ST-7 regression.) */
export const STALE_AFTER_MS =
  STRIDE_MS + PROCESSING_CEILING_MS + POLL_MS + FRESHNESS_MARGIN_MS; // 60_000
/** Legibility floor: the edge-to-edge pitch is never shrunk below this — drop oldest instead (SC-012). */
export const MIN_SLOT = 24;

// ── Derived view-model types ───────────────────────────────────────────────────────────

/** Minimal input — `SessionTrendPoint` structurally satisfies it (extra fields ignored). */
export interface TrendInput {
  capturedAt: string; // ISO-8601 UTC; never rendered as a number
  band: Band | null;
  skipCause: SkipCause | null;
}

export interface Pt {
  x: number;
  y: number;
}

export type WindowKind = "confident" | "warming" | "foggy" | "no_clear_read";

export interface WindowSlot {
  /** Index into the time-sorted session (for warming/whole-session reasoning). */
  srcIndex: number;
  /** 0 = oldest DRAWN (at the left edge); the latest = rightmost (at the right edge) — fill-to-width. */
  index: number;
  x: number;
  kind: WindowKind;
  band: Band | null;
  y: number | null;
}

/** A solid confident step-line polyline (one per band stretch; risers included). */
export interface StepLine {
  band: Band;
  color: string;
  points: Pt[];
}

/** An isolated confident reading (a run of length 1) — a dot, not a line (FR-019). */
export interface Dot {
  x: number;
  y: number;
  band: Band;
  color: string;
}

/** A no-read run (consecutive no-read windows) → one of the three honest treatments. */
export interface Treatment {
  kind: "warming" | "foggy" | "no_clear_read";
  label: string;
  color: string;
  x1: number;
  x2: number;
  labelX: number;
  /** The band level the flanking fades sit at (or WARM_Y for warming). */
  level: number;
  /** Warming only — the dashed muted line points (a line, NOT a gap). */
  warmLine?: Pt[];
  /** Static dimmed flank into the gap from the prior confident level (omitted if none —
   *  a leading skip is fade-in only, SC-009). */
  fadeOut?: Pt[];
  /** Static dimmed flank out of the gap into the next confident level (omitted if none). */
  fadeIn?: Pt[];
}

export interface NowMarker {
  state: "live" | "parked" | "none";
  x?: number;
  y?: number;
  band?: Band | null;
  fill?: string;
  pulse: boolean;
  popup?: string;
  ariaLabel?: string;
}

export type SubtitleKind = "empty" | "confident" | "warming" | "no_read";

export interface SubtitleState {
  kind: SubtitleKind;
  text: string;
}

export interface AxisLabel {
  text: string;
  x: number;
  y: number;
  anchor: "end";
}

export interface Gridline {
  x1: number;
  x2: number;
  y: number;
}

export interface SessionTrendView {
  /** Zero trend points → the component renders text-only (FR-018). */
  isEmpty: boolean;
  width: number;
  height: number;
  plot: { left: number; right: number; slotW: number; plotWidth: number };
  slots: WindowSlot[];
  /** True when the rolling window dropped oldest windows for legibility (SC-012). */
  droppedOldest: boolean;
  steps: StepLine[];
  dots: Dot[];
  treatments: Treatment[];
  nowMarker: NowMarker;
  subtitle: SubtitleState;
  /** Confident-reading count across the whole session (1 ⇒ a single dot, FR-019). */
  bandCount: number;
  axis: { labels: AxisLabel[]; gridlines: Gridline[] };
}

export interface BuildOpts {
  /** Rendered container width in px (the caller measures it — T009a). */
  width: number;
  /** Injected clock (ms). Pure/testable — the component passes `Date.now()`. */
  nowMs: number;
  /** FR-015 foggy gate. Default FALSE at launch (out-of-frame → muted no-clear-read). */
  showOutOfFrameFoggy?: boolean;
}

// ── Copy (all signed off — FR-022 labels, FR-024 subtitles) ────────────────────────────

const LABEL = {
  warming: "getting a read",
  foggy: "step back into frame",
  no_clear_read: "no clear read",
} as const;

const SUBTITLE_WARMING = "getting a read";
const SUBTITLE_NO_READ = "No clear read right now";

const RANK: Record<Band, number> = { at_ease: 0, a_little_tense: 1, tense: 2 };

// ── implementation (T004–T008) ─────────────────────────────────────────────────────────

const byCapturedAtAsc = (a: TrendInput, b: TrendInput) =>
  a.capturedAt < b.capturedAt ? -1 : a.capturedAt > b.capturedAt ? 1 : 0;

const lerpClamp = (w: number, wMin: number, wMax: number, vMin: number, vMax: number) =>
  w <= wMin ? vMin : w >= wMax ? vMax : vMin + ((vMax - vMin) * (w - wMin)) / (wMax - wMin);

/** Responsive gutter/margin/label-offset for a given container width (full at wide, MIN at the floor). */
function gutters(width: number): { left: number; rightMargin: number; labelGutter: number } {
  return {
    left: Math.round(lerpClamp(width, GUTTER_MIN_W, GUTTER_FULL_W, AXIS_GUTTER_MIN, AXIS_GUTTER)),
    rightMargin: Math.round(lerpClamp(width, GUTTER_MIN_W, GUTTER_FULL_W, RIGHT_MARGIN_MIN, RIGHT_MARGIN)),
    labelGutter: Math.round(lerpClamp(width, GUTTER_MIN_W, GUTTER_FULL_W, LABEL_GUTTER_MIN, LABEL_GUTTER)),
  };
}

function axisFor(
  left: number,
  right: number,
  labelGutter: number,
): { labels: AxisLabel[]; gridlines: Gridline[] } {
  const lx = left - labelGutter;
  return {
    labels: [
      { text: "Tense", x: lx, y: BAND_Y.tense + 3, anchor: "end" },
      { text: "A little tense", x: lx, y: BAND_Y.a_little_tense + 3, anchor: "end" },
      { text: "At ease", x: lx, y: BAND_Y.at_ease + 3, anchor: "end" },
    ],
    gridlines: [
      { x1: left, x2: right, y: BAND_Y.tense },
      { x1: left, x2: right, y: BAND_Y.a_little_tense },
      { x1: left, x2: right, y: BAND_Y.at_ease },
    ],
  };
}

/**
 * Build the complete render view-model for the live trend. Pure: `width` + `nowMs` (+ the
 * foggy gate) in, a deterministic `SessionTrendView` out.
 */
export function buildSessionTrend(points: TrendInput[], opts: BuildOpts): SessionTrendView {
  const { width, nowMs, showOutOfFrameFoggy = false } = opts;

  // ── plot geometry (fixed-px; 1 unit = 1px) ──
  const g = gutters(width); // responsive at narrow widths (FR-002 narrow-width clarification)
  const left = g.left;
  const right = width - g.rightMargin;
  const plotWidth = Math.max(0, right - left);
  // Nominal pitch for the empty/single-window cases (no fill spans to measure yet) — the locked
  // edge-to-edge pitch at full N_TARGET, floored at MIN_SLOT. The real per-render pitch (when ≥2
  // windows fill the width) is computed below as plotWidth/(nDraw−1) (FR-002a / SC-012a).
  const nominalSlotW = Math.max(MIN_SLOT, plotWidth / Math.max(1, N_TARGET - 1));
  const axis = axisFor(left, right, g.labelGutter);

  const sorted = [...points].sort(byCapturedAtAsc);
  const bandCount = sorted.filter((p) => p.band != null).length;

  if (sorted.length === 0) {
    return {
      isEmpty: true,
      width,
      height: H,
      plot: { left, right, slotW: nominalSlotW, plotWidth },
      slots: [],
      droppedOldest: false,
      steps: [],
      dots: [],
      treatments: [],
      nowMarker: { state: "none", pulse: false },
      subtitle: { kind: "empty", text: "" },
      bandCount: 0,
      axis,
    };
  }

  // session-level facts (FR-004b "ever"; FR-010/FR-014 warming is session-start-only)
  const firstConfidentIdx = sorted.findIndex((p) => p.band != null);
  const everConfident = firstConfidentIdx >= 0;
  // FR-004a freshness (ST-7 / #117): is the LATEST reading recent enough to be the CURRENT read?
  // When it is stale (out of frame, no fresh row arriving while the clock advances) the live edge
  // is an implicit no-read → the marker parks + the subtitle goes neutral, instead of asserting a
  // "you are here" / tension summary on a stale reading. The latest point is the live edge: when
  // any window is drawn it is the rightmost slot (newest timestamp); once it too ages past the
  // 2-min window everything has scrolled off and the marker is NONE regardless.
  const liveEdgeFresh = nowMs - Date.parse(sorted[sorted.length - 1]!.capturedAt) <= STALE_AFTER_MS;

  // ── lone warming stub suppression (FR-010 ≥2-point threshold / FR-018, decided 2026-06-27) ──
  // A warming line needs ≥2 points; a SINGLE warming point would otherwise draw a short dashed
  // stub pinned at the right edge that snaps to a full-width line on the next poll — jarring. So
  // exactly one warming point (warming-only, no confident reading yet → no drawable line) collapses
  // to FR-018's just-started TEXT state (isEmpty), same body as zero points. The subtitle still
  // derives warming ("getting a read") per FR-024 (unchanged). Scope: the warming-only 1-point case
  // ONLY — a lone *skip* point, FR-019's confident dot, and a leading-warming-run-of-1 BEFORE a
  // confident reading (its buildTreatment stub fallback) are all untouched.
  const oneWarmingPoint =
    sorted.length === 1 && sorted[0]!.band == null && sorted[0]!.skipCause == null;
  if (oneWarmingPoint) {
    return {
      isEmpty: true,
      width,
      height: H,
      plot: { left, right, slotW: nominalSlotW, plotWidth },
      slots: [],
      droppedOldest: false,
      steps: [],
      dots: [],
      treatments: [],
      nowMarker: { state: "none", pulse: false },
      subtitle: { kind: "warming", text: SUBTITLE_WARMING },
      bandCount: 0,
      axis,
    };
  }

  // ── rolling window: time-trim (~2 min), then FILL-TO-WIDTH with an N_TARGET / legibility cap ──
  // The drawn windows ALWAYS span the plot edge-to-edge (FR-002a / SC-012a): earliest at `left`,
  // latest ("now") at `right`, pitch = plotWidth/(nDraw−1). Ramp-up (nDraw < N_TARGET) fills and
  // re-spaces as windows arrive; at N_TARGET the pitch LOCKS at plotWidth/(N_TARGET−1) and older
  // windows scroll off — continuous because the ramp formula equals the locked pitch at N_TARGET.
  // Legibility (SC-012): cap the drawn count so the edge-to-edge pitch never falls below MIN_SLOT.
  const cutoff = nowMs - WINDOW_MS;
  const windowed = sorted
    .map((p, i) => ({ p, i }))
    .filter(({ p }) => Date.parse(p.capturedAt) >= cutoff);
  // Max windows we can fill edge-to-edge while keeping pitch ≥ MIN_SLOT (plotWidth/(n−1) ≥ MIN_SLOT).
  const capByLegibility = Math.max(2, Math.floor(plotWidth / MIN_SLOT) + 1);
  const nCap = Math.min(N_TARGET, capByLegibility);
  const nDraw = Math.min(windowed.length, nCap);
  const drawnSrc = windowed.slice(Math.max(0, windowed.length - nDraw));
  const droppedOldest = windowed.length > nDraw;
  // Per-render uniform pitch: plotWidth/(nDraw−1) when ≥2 windows fill the width; else nominal.
  const slotW = nDraw >= 2 ? plotWidth / (nDraw - 1) : nominalSlotW;

  // ── slots (fill-to-width: earliest at the left edge, latest "now" at the right edge) ──
  // A lone window (nDraw === 1) is pinned at the right edge — the pitch formula (÷0) is skipped,
  // and a single confident reading renders as a dot (FR-019) consistent with the now-marker edge.
  const slots: WindowSlot[] = drawnSrc.map(({ p, i }, k) => {
    const x = nDraw === 1 ? right : left + k * slotW;
    if (p.band != null) {
      return { srcIndex: i, index: k, x, kind: "confident", band: p.band, y: BAND_Y[p.band] };
    }
    // warming = a leading null/null run BEFORE any confident reading (session-start-only).
    const isWarming = p.skipCause == null && (firstConfidentIdx === -1 || i < firstConfidentIdx);
    let kind: WindowKind;
    if (isWarming) kind = "warming";
    else if (p.skipCause === "out-of-frame" && showOutOfFrameFoggy) kind = "foggy"; // FR-011/FR-015
    else kind = "no_clear_read"; // every other null incl. gated-off out-of-frame + re-warm
    return { srcIndex: i, index: k, x, kind, band: null, y: null };
  });

  // ── confident step-lines + isolated dots ──
  const steps: StepLine[] = [];
  const dots: Dot[] = [];
  let run: WindowSlot[] = [];
  const flushRun = () => {
    if (run.length === 1) {
      const s = run[0]!;
      dots.push({ x: s.x, y: s.y!, band: s.band!, color: BAND_LINE[s.band!] });
    } else if (run.length >= 2) {
      steps.push(...buildStepLines(run));
    }
    run = [];
  };
  for (const s of slots) {
    if (s.kind === "confident") run.push(s);
    else flushRun();
  }
  flushRun();

  // ── treatments: maximal runs of consecutive SAME-kind no-read slots ──
  const treatments: Treatment[] = [];
  let i = 0;
  while (i < slots.length) {
    const s = slots[i]!;
    if (s.kind === "confident") {
      i++;
      continue;
    }
    let j = i;
    while (j + 1 < slots.length && slots[j + 1]!.kind === s.kind) j++;
    treatments.push(buildTreatment(s.kind, slots.slice(i, j + 1), slots, i, j, slotW));
    i = j + 1;
  }

  return {
    isEmpty: false,
    width,
    height: H,
    plot: { left, right, slotW, plotWidth },
    slots,
    droppedOldest,
    steps,
    dots,
    treatments,
    nowMarker: buildNowMarker(slots, everConfident, liveEdgeFresh),
    subtitle: buildSubtitle(sorted, everConfident, liveEdgeFresh),
    bandCount,
    axis,
  };
}

/** A contiguous run of ≥2 confident slots → step polylines (horizontal stretches + risers),
 *  one polyline per band so each carries its own colour (matches the mock). */
function buildStepLines(run: WindowSlot[]): StepLine[] {
  const lines: StepLine[] = [];
  const band0 = run[0]!.band!;
  let cur: StepLine = { band: band0, color: BAND_LINE[band0], points: [{ x: run[0]!.x, y: run[0]!.y! }] };
  for (let k = 1; k < run.length; k++) {
    const prev = run[k - 1]!;
    const s = run[k]!;
    if (s.band === prev.band) {
      cur.points.push({ x: s.x, y: s.y! });
    } else {
      // step: extend the old level to the transition x, then a coloured riser to the new level
      cur.points.push({ x: s.x, y: prev.y! });
      lines.push(cur);
      cur = {
        band: s.band!,
        color: BAND_LINE[s.band!],
        points: [
          { x: s.x, y: prev.y! },
          { x: s.x, y: s.y! },
        ],
      };
    }
  }
  lines.push(cur);
  return lines;
}

function priorConfident(slots: WindowSlot[], i: number): WindowSlot | null {
  for (let k = i - 1; k >= 0; k--) if (slots[k]!.kind === "confident") return slots[k]!;
  return null;
}
function nextConfident(slots: WindowSlot[], j: number): WindowSlot | null {
  for (let k = j + 1; k < slots.length; k++) if (slots[k]!.kind === "confident") return slots[k]!;
  return null;
}

function buildTreatment(
  kind: WindowKind,
  runSlots: WindowSlot[],
  slots: WindowSlot[],
  i: number,
  j: number,
  slotW: number,
): Treatment {
  const x1 = runSlots[0]!.x;
  const x2 = runSlots[runSlots.length - 1]!.x;
  const labelX = (x1 + x2) / 2;

  if (kind === "warming") {
    // a dashed muted LINE (not a gap), at a non-band Y so it can't read as calm (FR-010)
    let warmLine: Pt[] = runSlots.map((s) => ({ x: s.x, y: WARM_Y }));
    if (warmLine.length === 1) {
      warmLine = [
        { x: x1 - slotW * 0.4, y: WARM_Y },
        { x: x1 + slotW * 0.4, y: WARM_Y },
      ];
    }
    return { kind: "warming", label: LABEL.warming, color: NO_READ_COLOR, x1, x2, labelX, level: WARM_Y, warmLine };
  }

  // gap (foggy / no_clear_read): static dimmed flanks at the flanking confident levels.
  // fade-OUT requires a prior confident level; a leading skip is fade-IN only (FR-013/SC-009).
  const prior = priorConfident(slots, i);
  const next = nextConfident(slots, j);
  const color = kind === "foggy" ? FOGGY_COLOR : NO_READ_COLOR;
  const label = kind === "foggy" ? LABEL.foggy : LABEL.no_clear_read;
  const level = prior ? prior.y! : next ? next.y! : WARM_Y;
  const t: Treatment = { kind: kind as Treatment["kind"], label, color, x1, x2, labelX, level };
  if (prior) t.fadeOut = [{ x: prior.x, y: prior.y! }, { x: x1, y: prior.y! }];
  if (next) t.fadeIn = [{ x: x2, y: next.y! }, { x: next.x, y: next.y! }];
  return t;
}

function buildNowMarker(slots: WindowSlot[], everConfident: boolean, liveEdgeFresh: boolean): NowMarker {
  // no confident reading has EVER occurred → no anchor to mark (FR-004b)
  if (slots.length === 0 || !everConfident) return { state: "none", pulse: false };
  const last = slots[slots.length - 1]!;
  // LIVE only when the live edge is a confident reading AND that reading is FRESH (FR-004a / ST-7).
  // A confident-but-STALE edge (out of frame, no new row while the clock advances) is an implicit
  // active no-read: fall through to park muted, never pulse "you are here" on a stale reading.
  if (last.kind === "confident" && liveEdgeFresh) {
    return {
      state: "live",
      x: last.x,
      y: last.y!,
      band: last.band,
      fill: BAND_LINE[last.band!],
      pulse: true,
      popup: "you are here",
      ariaLabel: "You are here — your current reading",
    };
  }
  // active no-read (a real no-read edge OR a stale confident edge) → park on the last confident
  // reading still on screen (FR-004a). It scrolls off → no anchor → none (FR-004a × FR-002a).
  const pc = priorConfident(slots, slots.length);
  if (!pc) return { state: "none", pulse: false }; // the last confident scrolled off-window
  return {
    state: "parked",
    x: pc.x,
    y: pc.y!,
    band: pc.band,
    fill: NO_READ_COLOR,
    pulse: false,
    popup: "last clear read",
    ariaLabel: "Last clear read — no current reading",
  };
}

function buildSubtitle(sorted: TrendInput[], everConfident: boolean, liveEdgeFresh: boolean): SubtitleState {
  const last = sorted[sorted.length - 1]!;
  if (last.band != null && liveEdgeFresh) {
    // confident AND fresh live edge → the peak-derived session summary (existing behaviour, FR-024).
    // A confident-but-STALE edge falls through to the neutral no-read line below: asserting a
    // tension level (incl. "Settled so far.") without a CURRENT reading is the FR-024/SC-013
    // dishonesty — same root cause as the marker parking (ST-7).
    let peak = 0;
    for (const p of sorted) if (p.band != null) peak = Math.max(peak, RANK[p.band]);
    const text =
      peak >= 2
        ? "A tense stretch in here."
        : peak === 1
          ? "A little tension creeping in."
          : "Settled so far.";
    return { kind: "confident", text };
  }
  // latest is a no-read
  if (!everConfident) {
    const pureWarming = sorted.every((p) => p.band == null && p.skipCause == null);
    if (pureWarming) return { kind: "warming", text: SUBTITLE_WARMING };
    return { kind: "no_read", text: SUBTITLE_NO_READ };
  }
  return { kind: "no_read", text: SUBTITLE_NO_READ };
}
