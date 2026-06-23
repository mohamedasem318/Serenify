/**
 * Feature 009 — pure geometry for the today-card stress trend (no React, no DOM).
 *
 * The load-bearing anti-totem rule (DC-001 / SC-002): the expanded lane plot renders at
 * FIXED PIXEL SCALE — 1 SVG unit = 1 screen pixel. The caller sets the SVG `width` AND a
 * matching `viewBox` width to `LanePlot.width` (= nLanes × laneWidth). Lanes are equal
 * width: `laneWidth = max(LANE_MIN, floor(availableWidth / nLanes))`, so a few sessions
 * FILL the width and many CLAMP to LANE_MIN and overflow (horizontal scroll handled in US4).
 *
 * State encodes by height AND colour: at_ease = meadow (lowest band line), a_little_tense =
 * mid amber line, tense = graphic amber (highest); no_read = a hollow marker on its OWN low
 * lane, never the calm line. Warm-up (leading absent reads) and lost-read (interior absent
 * reads) are FADED segments — never bridged at a fixed level (FR-007 / SC-010). Consecutive
 * same-band windows collapse into one run; a single confident reading is a dot (FR-005).
 *
 * Each session's peak === its `tenor` (the same value the timeline chip uses), so the graph
 * and the chip can never disagree (SC-004) — the geometry never recomputes a max of its own.
 */

export type Band = "at_ease" | "a_little_tense" | "tense";
export type Tenor = Band | "no_read";

// Expanded lane-plot canvas (px). Band Y-centres locked to serenify-008followups-trend-FINAL.html.
export const PLOT_H = 200;
export const STROKE = 3;
export const LANE_MIN = 112;
export const LANE_PAD = 18;

export const BAND_Y: Record<Tenor, number> = {
  tense: 44,
  a_little_tense: 88,
  at_ease: 132,
  no_read: 172,
};

/** Stroke/marker colour per band — CSS var strings, used directly as SVG stroke/fill. */
export const BAND_LINE: Record<Tenor, string> = {
  at_ease: "var(--color-meadow)",
  a_little_tense: "var(--amber-soft-line)",
  tense: "var(--color-amber)",
  no_read: "var(--color-muted)",
};

/**
 * The synced-highlight fill (US3) — a faint, theme-aware wash shared by the lane background
 * (SVG fill) and the timeline row (CSS background) so a lane and its row read as one surface.
 * Neutral by design (mixes the ink token, not a band colour) so the highlight never collides
 * with a band's meaning: subtle dark tint in light mode, subtle light tint in dark mode.
 */
export const HIGHLIGHT_FILL = "color-mix(in srgb, var(--color-ink) 6%, transparent)";

/** Keyboard focus-ring stroke (US3) — the foggy/info blue, distinct from the band palette. */
export const FOCUS_RING = "var(--color-foggy)";

// Collapsed mini step-line canvas — a wide-short thin line (horizontal stretch is fine here).
export const MINI_W = 1000;
export const MINI_H = 48;
export const MINI_Y: Record<Tenor, number> = {
  tense: 12,
  a_little_tense: 24,
  at_ease: 36,
  no_read: 44,
};

export interface SessionSeq {
  sessionId: string;
  /** From RecapSession.tenor — drives the lane peak AND the chip (SC-004). */
  tenor: Tenor;
  /** Ordered per-window bands; `null` = warm-up / skipped / lost read. */
  bands: (Band | null)[];
}

export interface Run {
  band: Band;
  y: number;
  x1: number;
  x2: number;
}

/** A faded stretch (warm-up or lost-read) — rendered eased, NEVER as a solid bridge. */
export interface Fade {
  y: number;
  x1: number;
  x2: number;
}

export interface Lane {
  sessionId: string;
  index: number;
  x0: number;
  tenor: Tenor;
  peakY: number;
  runs: Run[];
  warmup: Fade | null;
  lostReads: Fade[];
  noRead: boolean;
  singleDot: boolean;
  dot: { x: number; y: number } | null;
}

export interface LanePlot {
  laneWidth: number;
  width: number;
  height: number;
  lanes: Lane[];
}

export interface MiniPeak {
  sessionId: string;
  cx: number;
  y: number;
  tenor: Tenor;
  noRead: boolean;
}

// ── implementation ────────────────────────────────────────────────────────────────────

/** Equal-width lanes: fill the width when few, clamp to LANE_MIN (→ overflow) when many. */
export function laneWidthFor(availableWidth: number, nLanes: number): number {
  if (nLanes <= 0) return LANE_MIN;
  return Math.max(LANE_MIN, Math.floor(availableWidth / nLanes));
}

/** Group window rows into per-session ordered band sequences; carry each session's tenor. */
export function toSeqs(
  sessions: { sessionId: string; tenor: Tenor }[],
  rows: { sessionId: string; band: Band | null; capturedAt: string }[],
): SessionSeq[] {
  const sorted = [...rows].sort((a, b) =>
    a.capturedAt < b.capturedAt ? -1 : a.capturedAt > b.capturedAt ? 1 : 0,
  );
  const bySession = new Map<string, (Band | null)[]>();
  for (const r of sorted) {
    const list = bySession.get(r.sessionId) ?? [];
    list.push(r.band);
    bySession.set(r.sessionId, list);
  }
  return sessions.map((s) => ({
    sessionId: s.sessionId,
    tenor: s.tenor,
    bands: bySession.get(s.sessionId) ?? [],
  }));
}

function buildLane(seq: SessionSeq, index: number, lw: number): Lane {
  const x0 = index * lw;
  const innerStart = x0 + LANE_PAD;
  const innerEnd = x0 + lw - LANE_PAD;
  const innerW = innerEnd - innerStart;
  const bands = seq.bands;
  const nWin = bands.length;
  const slotX = (i: number) =>
    nWin <= 1 ? (innerStart + innerEnd) / 2 : innerStart + (i / (nWin - 1)) * innerW;

  const base: Lane = {
    sessionId: seq.sessionId,
    index,
    x0,
    tenor: seq.tenor,
    peakY: BAND_Y[seq.tenor],
    runs: [],
    warmup: null,
    lostReads: [],
    noRead: false,
    singleDot: false,
    dot: null,
  };

  const confIdx = bands.map((b, i) => (b != null ? i : -1)).filter((i) => i >= 0);

  // a fully read-less session → a hollow marker on its OWN low lane, never the calm line
  if (seq.tenor === "no_read" || confIdx.length === 0) {
    return { ...base, noRead: true, peakY: BAND_Y.no_read };
  }

  // a single confident reading → a dot, not a line
  if (confIdx.length === 1) {
    const i = confIdx[0]!;
    const b = bands[i] as Band;
    return { ...base, singleDot: true, dot: { x: slotX(i), y: BAND_Y[b] } };
  }

  // runs: collapse consecutive same-band windows; a null gap or a band change ends a run
  const runs: Run[] = [];
  let cur: { band: Band; startIdx: number; endIdx: number } | null = null;
  const flush = () => {
    if (cur) {
      runs.push({ band: cur.band, y: BAND_Y[cur.band], x1: slotX(cur.startIdx), x2: slotX(cur.endIdx) });
      cur = null;
    }
  };
  for (let i = 0; i < nWin; i++) {
    const b = bands[i];
    if (b == null) {
      flush();
      continue;
    }
    if (cur && cur.band === b) cur.endIdx = i;
    else {
      flush();
      cur = { band: b, startIdx: i, endIdx: i };
    }
  }
  flush();

  // fades from null blocks — eased at a single band level, NEVER bridged across (FR-007)
  const firstC = confIdx[0]!;
  const lastC = confIdx[confIdx.length - 1]!;
  let warmup: Fade | null = null;
  const lostReads: Fade[] = [];
  if (firstC > 0) {
    warmup = { y: BAND_Y[bands[firstC] as Band], x1: slotX(0), x2: slotX(firstC) };
  }
  for (let k = 0; k < confIdx.length - 1; k++) {
    const a = confIdx[k]!;
    const c = confIdx[k + 1]!;
    if (c > a + 1) lostReads.push({ y: BAND_Y[bands[a] as Band], x1: slotX(a), x2: slotX(c) });
  }
  if (lastC < nWin - 1) {
    lostReads.push({ y: BAND_Y[bands[lastC] as Band], x1: slotX(lastC), x2: slotX(nWin - 1) });
  }

  return { ...base, runs, warmup, lostReads };
}

/** The expanded lane plot — fixed-px (width = nLanes × laneWidth = the viewBox width). */
export function buildLanePlot(seqs: SessionSeq[], availableWidth: number): LanePlot {
  const nLanes = seqs.length;
  const lw = laneWidthFor(availableWidth, nLanes);
  return {
    laneWidth: lw,
    width: nLanes * lw,
    height: PLOT_H,
    lanes: seqs.map((s, i) => buildLane(s, i, lw)),
  };
}

/** The collapsed mini step-line — one peak marker per session at its tenor height, ordinal x. */
export function buildMini(seqs: SessionSeq[]): MiniPeak[] {
  const n = seqs.length;
  return seqs.map((s, i) => ({
    sessionId: s.sessionId,
    cx: n <= 0 ? MINI_W / 2 : ((i + 0.5) / n) * MINI_W,
    y: MINI_Y[s.tenor],
    tenor: s.tenor,
    noRead: s.tenor === "no_read",
  }));
}
