import { describe, expect, it } from "vitest";

import {
  AXIS_GUTTER,
  AXIS_GUTTER_MIN,
  BAND_LINE,
  BAND_Y,
  FADE_OPACITY,
  FOGGY_COLOR,
  H,
  MIN_SLOT,
  N_TARGET,
  NO_READ_COLOR,
  RIGHT_MARGIN,
  STALE_AFTER_MS,
  WINDOW_MS,
  buildSessionTrend,
  type TrendInput,
} from "@/lib/session-trend-geometry";
import type { Band } from "@/lib/api/monitoring-client";
import type { SkipCause } from "@/lib/api/monitoring-reads";

/**
 * Feature 010 / 009b — pure geometry + honesty derivation (Foundational, T003).
 * Authored TDD-red before T004–T008. Maps to the spec Success Criteria:
 *   SC-001/002 fixed-px (width == viewBox; plot bounds)   SC-003 band by colour + height
 *   SC-004 distinct no-read treatments (gate OFF vs ON)   SC-008 never "step back" when gated off
 *   SC-009 no bridged gap; leading skip = fade-in only    SC-010 single dot; all-skipped ≠ calm
 *   SC-011 now-marker live / parked / none                SC-012 rolling window lock + drop-oldest
 *   SC-012a ramp-up fill-to-width (edge-to-edge; continuous at the N_TARGET lock)
 *   SC-013 subtitle honesty
 */

const NOW = Date.UTC(2026, 5, 25, 12, 0, 0);
const at = (secsAgo: number) => new Date(NOW - secsAgo * 1000).toISOString();
const pt = (secsAgo: number, band: Band | null, skipCause: SkipCause | null = null): TrendInput => ({
  capturedAt: at(secsAgo),
  band,
  skipCause,
});
const build = (points: TrendInput[], width = 580, showOutOfFrameFoggy = false) =>
  buildSessionTrend(points, { width, nowMs: NOW, showOutOfFrameFoggy });
/** n confident windows, oldest → newest, one per `stride` seconds (default the ~10s window stride). */
const many = (n: number, stride = 10) =>
  Array.from({ length: n }, (_, i) => pt((n - 1 - i) * stride, "at_ease"));

// ── SC-003: band encoded by distinct height AND distinct colour ───────────────────────
describe("constants — each band has a distinct Y and a distinct token (SC-003)", () => {
  it("distinct Y per band (tenser = higher = smaller Y)", () => {
    expect(BAND_Y.tense).toBeLessThan(BAND_Y.a_little_tense);
    expect(BAND_Y.a_little_tense).toBeLessThan(BAND_Y.at_ease);
    expect(new Set(Object.values(BAND_Y)).size).toBe(3);
  });
  it("distinct colour token per band; mid band is the pinned --amber-soft-line (FR-023)", () => {
    expect(new Set(Object.values(BAND_LINE)).size).toBe(3);
    expect(BAND_LINE.a_little_tense).toBe("var(--amber-soft-line)");
    expect(BAND_LINE.at_ease).toBe("var(--color-meadow)");
    expect(BAND_LINE.tense).toBe("var(--color-amber)");
  });
});

// ── SC-001 / SC-002: fixed-px width is 1 unit = 1px ───────────────────────────────────
describe("fixed-px width — view.width === the container width (SC-001/SC-002)", () => {
  it("exposes width = the container px (the caller sets svg width AND viewBox to this)", () => {
    expect(build([pt(0, "at_ease")], 580).width).toBe(580);
    expect(build([pt(0, "at_ease")], 360).width).toBe(360);
    expect(build([pt(0, "at_ease")], 768).width).toBe(768);
  });
  it("height is the fixed canvas height; plot spans [AXIS_GUTTER, width − RIGHT_MARGIN]", () => {
    const v = build([pt(0, "at_ease")], 580);
    expect(v.height).toBe(H);
    expect(v.plot.left).toBe(AXIS_GUTTER);
    expect(v.plot.right).toBe(580 - RIGHT_MARGIN);
  });
});

// ── FR-002 narrow-width: responsive axis gutter (full at wide, reduced at the 360px floor) ──
describe("responsive axis gutter (FR-002 narrow-width clarification)", () => {
  it("uses the full mock gutters at a wide width (~768)", () => {
    const v = build([pt(0, "at_ease")], 768);
    expect(v.plot.left).toBe(AXIS_GUTTER); // 140
    expect(v.plot.right).toBe(768 - RIGHT_MARGIN); // 708
    expect(v.plot.plotWidth).toBe(768 - AXIS_GUTTER - RIGHT_MARGIN); // 568
  });
  it("shrinks the gutter + right margin at the 360px floor so the plot keeps width for labels", () => {
    const v = build([pt(0, "at_ease")], 360);
    expect(v.plot.left).toBeLessThan(AXIS_GUTTER); // gutter shrank below 140
    expect(v.plot.left).toBeGreaterThanOrEqual(AXIS_GUTTER_MIN); // but still fits "A little tense"
    expect(360 - v.plot.right).toBeLessThan(RIGHT_MARGIN); // right margin shrank below 60
    // materially wider than the legacy fixed 140/60 plot (160px) — the launch no-read label
    // ("no clear read", ≈81px) fits at the floor
    expect(v.plot.plotWidth).toBeGreaterThan(200);
  });
  it("shrinks monotonically as width narrows, clamping to the min below GUTTER_MIN_W", () => {
    const wide = build([pt(0, "at_ease")], 768).plot.left;
    const mid = build([pt(0, "at_ease")], 440).plot.left;
    const narrow = build([pt(0, "at_ease")], 300).plot.left;
    expect(wide).toBeGreaterThanOrEqual(mid);
    expect(mid).toBeGreaterThanOrEqual(narrow);
    expect(narrow).toBe(AXIS_GUTTER_MIN); // 300 ≤ GUTTER_MIN_W → clamped to the min
  });
});

// ── SC-012: rolling window — steady-state lock + drop-oldest ──────────────────────────
describe("rolling window — steady-state lock + drop-oldest (SC-012)", () => {
  it("the latest ('now') window sits at the plot's right edge", () => {
    const v = build(many(5), 580);
    expect(v.slots.at(-1)!.x).toBeCloseTo(v.plot.right, 6);
  });
  it("at/over N_TARGET windows the pitch LOCKS at plotWidth/(N_TARGET−1), stable as it grows", () => {
    const a = build(many(13), 580); // ≥ N_TARGET → locked
    const b = build(many(15), 580); // more windows, same lock (no compression as the session grows)
    expect(a.slots).toHaveLength(N_TARGET);
    expect(b.slots).toHaveLength(N_TARGET);
    expect(a.plot.slotW).toBeCloseTo(a.plot.plotWidth / (N_TARGET - 1), 6);
    expect(a.plot.slotW).toBeCloseTo(b.plot.slotW, 6); // STABLE once locked (SC-012)
    expect(a.droppedOldest).toBe(true);
    const xs = a.slots.map((s) => s.x);
    for (let i = 1; i < xs.length; i++) expect(xs[i]! - xs[i - 1]!).toBeCloseTo(a.plot.slotW, 6);
  });
  it("windows older than the ~2-min rolling window scroll off the left edge", () => {
    const v = build([pt(300, "tense"), pt(20, "at_ease"), pt(10, "at_ease"), pt(0, "at_ease")], 580);
    expect(v.slots).toHaveLength(3); // the 300s-old window is gone
  });
  it("never lets the edge-to-edge pitch fall below MIN_SLOT — drops the oldest instead", () => {
    const v = build(many(12), 360); // 12 windows within 2 min, narrow viewport
    expect(v.plot.slotW).toBeGreaterThanOrEqual(MIN_SLOT);
    expect(v.droppedOldest).toBe(true);
    expect(v.slots.length).toBeLessThan(12);
    expect(v.slots.at(-1)!.x).toBeCloseTo(v.plot.right, 6); // latest still at the right edge
  });
});

// ── SC-012a: ramp-up fill-to-width (2026-06-27) ───────────────────────────────────────
describe("ramp-up fill-to-width (SC-012a)", () => {
  it("count = 2 → earliest at the LEFT edge, latest at the RIGHT edge", () => {
    const v = build(many(2), 580);
    expect(v.slots).toHaveLength(2);
    expect(v.slots[0]!.x).toBeCloseTo(v.plot.left, 6);
    expect(v.slots.at(-1)!.x).toBeCloseTo(v.plot.right, 6);
  });
  it("count = 3 → evenly fills the full width: left, mid, right", () => {
    const v = build(many(3), 580);
    const { left, right, plotWidth } = v.plot;
    const xs = v.slots.map((s) => s.x);
    expect(xs[0]).toBeCloseTo(left, 6);
    expect(xs[1]).toBeCloseTo(left + plotWidth / 2, 6);
    expect(xs[2]).toBeCloseTo(right, 6);
  });
  it("count = 6 → uniform pitch = plotWidth/(count−1), spanning edge-to-edge", () => {
    const v = build(many(6), 580);
    const pitch = v.plot.plotWidth / 5;
    expect(v.plot.slotW).toBeCloseTo(pitch, 6);
    const xs = v.slots.map((s) => s.x);
    expect(xs[0]).toBeCloseTo(v.plot.left, 6);
    expect(xs.at(-1)).toBeCloseTo(v.plot.right, 6);
    for (let i = 1; i < xs.length; i++) expect(xs[i]! - xs[i - 1]!).toBeCloseTo(pitch, 6);
  });
  it("ramp-up COMPRESSES as windows arrive (pitch shrinks 3 → 8 windows) — by-design re-spacing", () => {
    const three = build(many(3), 580).plot.slotW;
    const eight = build(many(8), 580).plot.slotW;
    expect(three).toBeGreaterThan(eight); // distinct from the steady-state lock (SC-012)
  });
  it("CONTINUITY: the ramp pitch at count = N_TARGET equals the locked pitch (no jump)", () => {
    const atTarget = build(many(N_TARGET), 580); // exactly N_TARGET windows (all within 120s)
    expect(atTarget.slots).toHaveLength(N_TARGET);
    const rampPitch = atTarget.plot.plotWidth / (N_TARGET - 1);
    const lockedPitch = build(many(15), 580).plot.slotW; // > N_TARGET → locked
    expect(atTarget.plot.slotW).toBeCloseTo(rampPitch, 6);
    expect(atTarget.plot.slotW).toBeCloseTo(lockedPitch, 6); // continuous at the lock point
  });
  it("count > N_TARGET → only the last N_TARGET windows render, oldest dropped, 'now' at right", () => {
    const v = build(many(20), 580);
    expect(v.slots).toHaveLength(N_TARGET);
    expect(v.droppedOldest).toBe(true);
    expect(v.slots.at(-1)!.x).toBeCloseTo(v.plot.right, 6);
    expect(v.nowMarker.x).toBeCloseTo(v.plot.right, 6);
  });
  it("now-marker x === the right edge across every count ≥ 2", () => {
    for (const n of [2, 3, 7, N_TARGET, 18]) {
      const v = build(many(n), 580);
      expect(v.nowMarker.x).toBeCloseTo(v.plot.right, 6);
    }
  });
  it("count = 1 → a single dot pinned at the right edge, no pitch formula (FR-019)", () => {
    const v = build(many(1), 580);
    expect(v.slots).toHaveLength(1);
    expect(v.dots).toHaveLength(1);
    expect(v.steps).toHaveLength(0);
    expect(v.slots[0]!.x).toBeCloseTo(v.plot.right, 6);
    expect(v.dots[0]!.x).toBeCloseTo(v.plot.right, 6);
  });
  it("uniform slots under fill: a k-window no-read run's centre-span = (k−1)×pitch (∝ k)", () => {
    // ramp-up session: confident → 3 consecutive no-read windows → confident (5 windows total)
    const v = build(
      [
        pt(40, "at_ease"),
        pt(30, null, "low-light"),
        pt(20, null, "low-light"),
        pt(10, null, "low-light"),
        pt(0, "at_ease"),
      ],
      580,
    );
    expect(v.slots).toHaveLength(5);
    const pitch = v.plot.plotWidth / 4; // count − 1 = 4
    expect(v.plot.slotW).toBeCloseTo(pitch, 6);
    const gap = v.treatments.find((t) => t.kind === "no_clear_read")!;
    // 3 no-read slots at indices 1,2,3 → centre-span (3−1)×pitch; each occupies one pitch-wide slot
    expect(gap.x2 - gap.x1).toBeCloseTo(2 * pitch, 6);
  });
});

// ── SC-003 / SC-010: step-line band encoding + single dot ─────────────────────────────
describe("confident step-line — colour = band, height = band (SC-003)", () => {
  it("emits step polylines whose colour + Y match the bands", () => {
    const v = build([pt(30, "at_ease"), pt(20, "at_ease"), pt(10, "a_little_tense"), pt(0, "tense")], 580);
    const colours = new Set(v.steps.map((s) => s.color));
    expect(colours.has(BAND_LINE.tense)).toBe(true);
    const tenseSeg = v.steps.find((s) => s.band === "tense")!;
    expect(tenseSeg.points.every((p) => p.y === BAND_Y.tense || p.y === BAND_Y.a_little_tense)).toBe(true);
  });
});

describe("single confident reading → a dot, not a line (SC-010 / FR-019)", () => {
  it("renders one dot, no step polyline, bandCount 1", () => {
    const v = build([pt(0, "a_little_tense")], 580);
    expect(v.dots).toHaveLength(1);
    expect(v.steps).toHaveLength(0);
    expect(v.bandCount).toBe(1);
    expect(v.dots[0]!.y).toBe(BAND_Y.a_little_tense);
  });
});

// ── SC-010: a fully read-less session is a no-read state, never calm ──────────────────
describe("all-skipped session → no-read, never calm/at-ease (SC-010)", () => {
  it("no confident geometry, no marker, treatments are muted no-clear-read", () => {
    const v = build([pt(20, null, "low-light"), pt(10, null, "our-side"), pt(0, null, "insufficient-face")], 580);
    expect(v.dots).toHaveLength(0);
    expect(v.steps).toHaveLength(0);
    expect(v.slots.some((s) => s.kind === "confident")).toBe(false);
    expect(v.nowMarker.state).toBe("none");
    expect(v.treatments.every((t) => t.kind === "no_clear_read")).toBe(true);
  });
});

// ── SC-004 / SC-008: three honest treatments + the foggy gate ─────────────────────────
describe("warming — a dashed muted line, not a gap (SC-004)", () => {
  it("a leading null/null run is a warming treatment with a dashed line and no marker", () => {
    const v = build([pt(20, null, null), pt(10, null, null), pt(0, "at_ease")], 580);
    const warm = v.treatments.find((t) => t.kind === "warming")!;
    expect(warm).toBeDefined();
    expect(warm.label).toBe("getting a read");
    expect(warm.color).toBe(NO_READ_COLOR);
    expect(warm.warmLine && warm.warmLine.length).toBeGreaterThan(0);
    expect(warm.fadeOut).toBeUndefined();
  });
});

describe("out-of-frame foggy gate (SC-004 / SC-008 / FR-015)", () => {
  const session = [pt(30, "at_ease"), pt(20, null, "out-of-frame"), pt(10, null, "out-of-frame"), pt(0, "at_ease")];

  it("gate OFF (launch): out-of-frame routes to the MUTED no-clear-read — never foggy", () => {
    const v = build(session, 580, false);
    expect(v.treatments.some((t) => t.kind === "foggy")).toBe(false);
    expect(v.treatments.some((t) => t.label === "step back into frame")).toBe(false);
    const gap = v.treatments.find((t) => t.kind === "no_clear_read")!;
    expect(gap.label).toBe("no clear read");
    expect(gap.color).toBe(NO_READ_COLOR);
  });
  it("gate ON: the same out-of-frame skip renders the FOGGY treatment", () => {
    const v = build(session, 580, true);
    const foggy = v.treatments.find((t) => t.kind === "foggy")!;
    expect(foggy).toBeDefined();
    expect(foggy.label).toBe("step back into frame");
    expect(foggy.color).toBe(FOGGY_COLOR);
  });
});

// ── SC-009: no bridged gap; leading skip = fade-in only ───────────────────────────────
describe("no-read never bridges the calm line (SC-009)", () => {
  it("an interior no-read fades out AND in; no step polyline spans the gap", () => {
    const v = build([pt(30, "at_ease"), pt(20, null, "low-light"), pt(10, null, "low-light"), pt(0, "at_ease")], 580);
    const gap = v.treatments.find((t) => t.kind === "no_clear_read")!;
    expect(gap.fadeOut).toBeDefined();
    expect(gap.fadeIn).toBeDefined();
    expect(gap.fadeOut!.every((p) => p.x <= gap.x1)).toBe(true);
    // confident slots are split into two separate runs (before/after) — never one bridged line
    expect(v.steps.every((s) => s.points.every((p) => p.x <= gap.x1 || p.x >= gap.x2))).toBe(true);
  });
  it("fades are static opacity, not animation (FR-013)", () => {
    expect(FADE_OPACITY).toBeLessThan(1);
  });
  it("a LEADING skip (warming → skip → first reading) is fade-IN only (no fade-out half)", () => {
    const v = build([pt(30, null, null), pt(20, null, "out-of-frame"), pt(0, "a_little_tense")], 580);
    const skip = v.treatments.find((t) => t.kind === "no_clear_read")!;
    expect(skip).toBeDefined();
    expect(skip.fadeOut).toBeUndefined(); // nothing to fade out of (no prior confident)
    expect(skip.fadeIn).toBeDefined();
  });
});

// ── SC-011: now-marker live / parked / none ───────────────────────────────────────────
describe("now-marker state machine (SC-011)", () => {
  it("LIVE on a confident live edge: recolours to band, pulses, 'you are here', at right edge", () => {
    const v = build([pt(10, "a_little_tense"), pt(0, "tense")], 580);
    expect(v.nowMarker.state).toBe("live");
    expect(v.nowMarker.fill).toBe(BAND_LINE.tense);
    expect(v.nowMarker.pulse).toBe(true);
    expect(v.nowMarker.popup).toBe("you are here");
    expect(v.nowMarker.x).toBe(v.plot.right);
    expect(v.nowMarker.y).toBe(BAND_Y.tense);
  });
  it("PARKED on an active no-read with a prior confident: muted, static, 'last clear read'", () => {
    const v = build([pt(20, "at_ease"), pt(10, "tense"), pt(0, null, "low-light")], 580);
    expect(v.nowMarker.state).toBe("parked");
    expect(v.nowMarker.fill).toBe(NO_READ_COLOR);
    expect(v.nowMarker.pulse).toBe(false);
    expect(v.nowMarker.popup).toBe("last clear read");
    expect(v.nowMarker.y).toBe(BAND_Y.tense); // last confident reading
    expect(v.nowMarker.x).toBeLessThan(v.plot.right); // not the live edge
  });
  it("NONE whenever no confident reading has EVER occurred (warming/leading-skip/all-skipped)", () => {
    expect(build([pt(10, null, null), pt(0, null, null)], 580).nowMarker.state).toBe("none");
    expect(build([pt(10, null, null), pt(0, null, "out-of-frame")], 580).nowMarker.state).toBe("none");
    expect(build([pt(0, null, "our-side")], 580).nowMarker.state).toBe("none");
  });
  it("PARKED when exactly one confident reading is followed by an active no-read — single-reading park (SC-010 / FR-004a / ST-7)", () => {
    // The lone confident dot is a valid park anchor (SC-010 / FR-019); the marker must not
    // disappear just because there is only one prior reading.
    const v = build([pt(10, "at_ease"), pt(0, null, "out-of-frame")], 580);
    expect(v.nowMarker.state).toBe("parked");
    expect(v.nowMarker.fill).toBe(NO_READ_COLOR);
    expect(v.nowMarker.pulse).toBe(false);
    expect(v.nowMarker.popup).toBe("last clear read");
    // The lone confident still renders as a dot (FR-019), never a step line
    expect(v.dots).toHaveLength(1);
    expect(v.steps).toHaveLength(0);
  });
  it("PARKED when the lone confident reading is flanked by no-reads on both sides (SC-010)", () => {
    const v = build([pt(20, null, "low-light"), pt(10, "tense"), pt(0, null, "low-light")], 580);
    expect(v.nowMarker.state).toBe("parked");
    expect(v.nowMarker.fill).toBe(NO_READ_COLOR);
    expect(v.nowMarker.y).toBe(BAND_Y.tense);
    expect(v.dots).toHaveLength(1);
    expect(v.steps).toHaveLength(0);
  });
});

// ── SC-013: subtitle honesty ──────────────────────────────────────────────────────────
describe("subtitle never asserts a tension level without a current confident reading (SC-013)", () => {
  it("confident live edge → the peak-derived session summary", () => {
    expect(build([pt(10, "at_ease"), pt(0, "tense")], 580).subtitle).toEqual({
      kind: "confident",
      text: "A tense stretch in here.",
    });
    expect(build([pt(0, "at_ease")], 580).subtitle.text).toBe("Settled so far.");
  });
  it("active no-read (prior confident) → the neutral no-read line, no tension word", () => {
    const v = build([pt(10, "tense"), pt(0, null, "low-light")], 580);
    expect(v.subtitle.kind).toBe("no_read");
    expect(v.subtitle.text).toBe("No clear read right now");
  });
  it("warming-only → a non-asserting line", () => {
    const v = build([pt(10, null, null), pt(0, null, null)], 580);
    expect(v.subtitle.kind).toBe("warming");
    expect(v.subtitle.text).toBe("getting a read");
  });
  it("all-skipped → the neutral no-read line", () => {
    const v = build([pt(0, null, "our-side")], 580);
    expect(v.subtitle.kind).toBe("no_read");
    expect(v.subtitle.text).toBe("No clear read right now");
  });
});

// ── ST-7 / FR-004a / #117: out-of-frame freshness — a STALE confident edge parks, not "live" ──
// Repro of the live bug: a confident session is on screen, the employee steps out of frame, and
// NO new readings arrive (the no-read rows aren't reaching the client). The wall clock keeps
// advancing (the parent's 1s elapsed-clock re-renders the card), so `nowMs` marches forward over
// a FROZEN set of confident points. The marker must NOT keep claiming "you are here" (live) on a
// stale reading (the exact dishonesty FR-004a forbids) — it must PARK muted ("last clear read")
// while the last confident reading is still in-window, and only go NONE once it scrolls off.
describe("out-of-frame freshness — stale live edge parks, not live (ST-7 / FR-004a / #117)", () => {
  // a frozen confident session whose LATEST reading is `latestSecsAgo` old vs the build's NOW,
  // stepping back one ~10s stride per older reading (all within the 2-min window unless said).
  const frozen = (count: number, latestSecsAgo: number, stride = 10): TrendInput[] =>
    Array.from({ length: count }, (_, i) => pt(latestSecsAgo + (count - 1 - i) * stride, "at_ease"));

  it("STALE_AFTER_MS is a few capture strides — well under the 2-min window, above the 12s poll", () => {
    const stride = WINDOW_MS / N_TARGET; // ~10s
    expect(STALE_AFTER_MS).toBeGreaterThan(12_000); // no flicker against the 12s poll backstop
    expect(STALE_AFTER_MS).toBeGreaterThanOrEqual(stride);
    expect(STALE_AFTER_MS).toBeLessThan(WINDOW_MS); // parks long before the reading scrolls off
  });

  it("a STALE confident live edge (no fresh reading) PARKS muted — NOT live (ST-7)", () => {
    const v = build(frozen(6, 65), 580); // latest reading 65s old → past the 60s horizon, all six still in-window
    expect(v.nowMarker.state).toBe("parked");
    expect(v.nowMarker.fill).toBe(NO_READ_COLOR);
    expect(v.nowMarker.pulse).toBe(false);
    expect(v.nowMarker.popup).toBe("last clear read");
    expect(v.nowMarker.x).toBeCloseTo(v.plot.right, 6); // on the last (stale) confident reading
    expect(v.nowMarker.y).toBe(BAND_Y.at_ease);
  });

  it("the step-line PERSISTS while the stale readings are still in-window (not a hollow frame)", () => {
    const v = build(frozen(6, 65), 580);
    expect(v.isEmpty).toBe(false);
    expect(v.slots).toHaveLength(6); // all six are < 2 min old → all drawn
    expect(v.steps.length).toBeGreaterThanOrEqual(1); // the line is still there
  });

  it("a FRESH confident live edge stays LIVE — no false park within one window", () => {
    const v = build(frozen(6, 12), 580); // latest reading only 12s old → fresh
    expect(v.nowMarker.state).toBe("live");
    expect(v.nowMarker.pulse).toBe(true);
    expect(v.nowMarker.popup).toBe("you are here");
    expect(v.nowMarker.fill).toBe(BAND_LINE.at_ease);
  });

  it("marker → NONE only once the last confident reading scrolls off the 2-min window", () => {
    const v = build(frozen(4, 200), 580); // every reading > 2 min old → all scrolled off
    expect(v.slots).toHaveLength(0);
    expect(v.nowMarker.state).toBe("none");
  });

  it("advancing nowMs over a FROZEN confident session: live → parked → none", () => {
    const session = many(18); // 18 confident, latest at NOW (oldest 170s ago)
    const at = (offsetMs: number) =>
      buildSessionTrend(session, { width: 580, nowMs: NOW + offsetMs });

    const fresh = at(12_000); // 12s after the last reading → still fresh
    expect(fresh.nowMarker.state).toBe("live");

    const stale = at(70_000); // 70s after → stale (past the 60s horizon), but readings still in-window
    expect(stale.nowMarker.state).toBe("parked");
    expect(stale.steps.length).toBeGreaterThanOrEqual(1); // line persists through the park
    expect(stale.isEmpty).toBe(false);

    const gone = at(130_000); // 130s after → the last reading has scrolled off
    expect(gone.slots).toHaveLength(0);
    expect(gone.nowMarker.state).toBe("none");
  });

  it("the subtitle drops the tension summary on a STALE edge (FR-024 / SC-013)", () => {
    // "Settled so far." asserts a calm level we no longer currently have — must go neutral.
    const v = build(frozen(6, 65), 580);
    expect(v.subtitle.kind).toBe("no_read");
    expect(v.subtitle.text).toBe("No clear read right now");
  });

  it("a single confident reading: FRESH = live 'you are here'; STALE = parked 'last clear read'", () => {
    const live = build([pt(2, "a_little_tense")], 580); // 2s old → live single dot
    expect(live.nowMarker.state).toBe("live");
    expect(live.nowMarker.popup).toBe("you are here");
    expect(live.dots).toHaveLength(1);

    const parked = build([pt(70, "a_little_tense")], 580); // 70s old → stale single dot (past the 60s horizon)
    expect(parked.nowMarker.state).toBe("parked");
    expect(parked.nowMarker.popup).toBe("last clear read");
    expect(parked.nowMarker.fill).toBe(NO_READ_COLOR);
    expect(parked.dots).toHaveLength(1); // still a dot (FR-019), just parked-muted
  });

  it("never-confident frozen session stays NONE regardless of age (FR-004b)", () => {
    expect(build([pt(40, null, "out-of-frame"), pt(30, null, "out-of-frame")], 580).nowMarker.state).toBe("none");
  });
});

// ── FR-018 / FR-010: empty (0 points OR 1 warming point) vs the ≥2-point dashed line ──
describe("empty vs warming discriminator (FR-018 / FR-010)", () => {
  it("zero trend points → isEmpty, no slots, no marker", () => {
    const v = build([], 580);
    expect(v.isEmpty).toBe(true);
    expect(v.slots).toHaveLength(0);
    expect(v.nowMarker.state).toBe("none");
    expect(v.subtitle.kind).toBe("empty");
  });
  it("exactly ONE warming point → the just-started TEXT state, lone stub suppressed", () => {
    const v = build([pt(0, null, null)], 580);
    expect(v.isEmpty).toBe(true); // collapses to FR-018 text body — no lone right-edge stub
    expect(v.slots).toHaveLength(0);
    expect(v.treatments).toHaveLength(0);
    expect(v.steps).toHaveLength(0);
    expect(v.nowMarker.state).toBe("none");
    expect(v.subtitle.kind).toBe("warming"); // FR-024 subtitle unchanged
    expect(v.subtitle.text).toBe("getting a read");
  });
  it("TWO+ warming points → NOT empty; a full-width dashed warming line (no stub phase)", () => {
    const v = build([pt(10, null, null), pt(0, null, null)], 580);
    expect(v.isEmpty).toBe(false);
    const warm = v.treatments.find((t) => t.kind === "warming")!;
    expect(warm.warmLine).toBeDefined();
    expect(warm.warmLine!).toHaveLength(2);
    expect(warm.warmLine![0]!.x).toBeCloseTo(v.plot.left, 6); // left edge …
    expect(warm.warmLine!.at(-1)!.x).toBeCloseTo(v.plot.right, 6); // … to right edge (fills width)
  });
  it("a single SKIP point (not warming) is unchanged — NOT the empty text", () => {
    const v = build([pt(0, null, "our-side")], 580);
    expect(v.isEmpty).toBe(false); // out of scope: all-skipped 1-point keeps its no-read treatment
    expect(v.treatments.some((t) => t.kind === "no_clear_read")).toBe(true);
  });
  it("a confident single reading is unchanged — a dot, NOT the empty text (FR-019)", () => {
    const v = build([pt(0, "at_ease")], 580);
    expect(v.isEmpty).toBe(false);
    expect(v.dots).toHaveLength(1);
  });
});
