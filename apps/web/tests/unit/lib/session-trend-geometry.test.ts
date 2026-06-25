import { describe, expect, it } from "vitest";

import {
  AXIS_GUTTER,
  BAND_LINE,
  BAND_Y,
  FADE_OPACITY,
  FOGGY_COLOR,
  H,
  MIN_SLOT,
  NO_READ_COLOR,
  RIGHT_MARGIN,
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
 *   SC-011 now-marker live / parked / none                SC-012 rolling window, uniform slot, drop-oldest
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

// ── SC-012: rolling window, uniform slot, right-anchored, drop-oldest ──────────────────
describe("rolling window + uniform slot, right-anchored (SC-012)", () => {
  const many = (n: number, stride = 10) =>
    Array.from({ length: n }, (_, i) => pt((n - 1 - i) * stride, "at_ease")); // oldest → newest

  it("the latest window is right-anchored at the plot's right edge", () => {
    const v = build(many(5), 580);
    expect(v.slots.at(-1)!.x).toBe(v.plot.right);
  });
  it("slots are uniformly spaced by a STABLE slot width (independent of window count)", () => {
    const a = build(many(3), 580);
    const b = build(many(8), 580);
    expect(a.plot.slotW).toBe(b.plot.slotW); // stable spacing regardless of read frequency
    const xs = b.slots.map((s) => s.x);
    for (let i = 1; i < xs.length; i++) expect(xs[i]! - xs[i - 1]!).toBeCloseTo(b.plot.slotW, 6);
  });
  it("a young session draws its few windows clustered at the RIGHT (ramp-up, CHK012)", () => {
    const v = build(many(3), 580);
    expect(v.slots).toHaveLength(3);
    expect(v.slots[0]!.x).toBeCloseTo(v.plot.right - 2 * v.plot.slotW, 6);
  });
  it("windows older than the ~2-min window scroll off the left edge", () => {
    const v = build([pt(300, "tense"), pt(20, "at_ease"), pt(10, "at_ease"), pt(0, "at_ease")], 580);
    expect(v.slots).toHaveLength(3); // the 300s-old window is gone
  });
  it("never shrinks the slot below MIN_SLOT — drops the oldest instead (legibility wins)", () => {
    const v = build(many(12), 360); // 12 windows within 2 min, narrow viewport
    expect(v.plot.slotW).toBeGreaterThanOrEqual(MIN_SLOT);
    expect(v.droppedOldest).toBe(true);
    expect(v.slots.length).toBeLessThan(12);
    expect(v.slots.at(-1)!.x).toBe(v.plot.right); // still right-anchored after dropping
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

// ── FR-018: empty (zero trend points) is distinct from warming/all-skipped ────────────
describe("empty vs warming discriminator (FR-018)", () => {
  it("zero trend points → isEmpty, no slots, no marker", () => {
    const v = build([], 580);
    expect(v.isEmpty).toBe(true);
    expect(v.slots).toHaveLength(0);
    expect(v.nowMarker.state).toBe("none");
    expect(v.subtitle.kind).toBe("empty");
  });
  it("a warming-only session (≥1 point) is NOT empty", () => {
    expect(build([pt(0, null, null)], 580).isEmpty).toBe(false);
  });
});
