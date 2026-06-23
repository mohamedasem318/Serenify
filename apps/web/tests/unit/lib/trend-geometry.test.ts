import { describe, expect, it } from "vitest";

import {
  BAND_Y,
  LANE_MIN,
  PLOT_H,
  buildLanePlot,
  buildMini,
  laneWidthFor,
  toSeqs,
  type Band,
  type SessionSeq,
} from "@/lib/trend-geometry";

/**
 * Feature 009 — pure geometry (foundational, T005). Anti-drift coverage:
 *   SC-002 fixed-px width (W = nLanes × laneWidth, no stretch; few fill, many clamp to 112)
 *   SC-004 lane peak === tenor
 *   SC-010 warm-up / lost-read are faded (never bridged); a fully no-read session is a hollow
 *          marker on its OWN low lane, never the calm line
 *   FR-005 run-collapse (consecutive same band → one run) + single-dot
 */

const seq = (sessionId: string, tenor: SessionSeq["tenor"], bands: (Band | null)[]): SessionSeq => ({
  sessionId,
  tenor,
  bands,
});

describe("laneWidthFor — fill vs clamp (precision point 2)", () => {
  it("few sessions FILL the available width (laneWidth > LANE_MIN, no dead space)", () => {
    expect(laneWidthFor(1104, 6)).toBe(184); // floor(1104/6)
    expect(6 * laneWidthFor(1104, 6)).toBeLessThanOrEqual(1104);
    expect(laneWidthFor(1104, 6)).toBeGreaterThan(LANE_MIN);
  });
  it("many sessions CLAMP to LANE_MIN and overflow", () => {
    expect(laneWidthFor(1104, 11)).toBe(LANE_MIN); // floor(1104/11)=100 → clamp 112
    expect(11 * laneWidthFor(1104, 11)).toBeGreaterThan(1104);
  });
  it("guards a zero session count", () => {
    expect(laneWidthFor(1104, 0)).toBe(LANE_MIN);
  });
});

describe("buildLanePlot — fixed-px width is 1 unit = 1px (SC-002)", () => {
  const seqsN = (n: number) =>
    Array.from({ length: n }, (_, i) => seq(`s${i}`, "at_ease", ["at_ease"]));

  it("width === nLanes × laneWidth and fills at low counts", () => {
    const plot = buildLanePlot(seqsN(6), 1104);
    expect(plot.laneWidth).toBe(184);
    expect(plot.width).toBe(6 * 184); // 1104 — viewBox width MUST match this
    expect(plot.height).toBe(PLOT_H);
  });
  it("clamps and overflows at high counts", () => {
    const plot = buildLanePlot(seqsN(11), 1104);
    expect(plot.laneWidth).toBe(LANE_MIN);
    expect(plot.width).toBe(11 * LANE_MIN); // 1232 > 1104
  });
});

describe("buildLanePlot — run-collapse + single dot (FR-005)", () => {
  it("collapses consecutive same-band windows into one run; draws only transitions", () => {
    const plot = buildLanePlot([seq("a", "a_little_tense", ["at_ease", "at_ease", "a_little_tense"])], 1104);
    const lane = plot.lanes[0]!;
    expect(lane.runs.map((r) => r.band)).toEqual(["at_ease", "a_little_tense"]);
    expect(lane.singleDot).toBe(false);
  });
  it("a single confident reading is a dot, not a line", () => {
    const plot = buildLanePlot([seq("a", "a_little_tense", ["a_little_tense"])], 1104);
    const lane = plot.lanes[0]!;
    expect(lane.singleDot).toBe(true);
    expect(lane.dot).not.toBeNull();
    expect(lane.runs).toHaveLength(0);
    expect(lane.dot!.y).toBe(BAND_Y.a_little_tense);
  });
});

describe("buildLanePlot — peak === tenor (SC-004)", () => {
  it("each lane's peakY is the tenor's height, never a recomputed max", () => {
    const plot = buildLanePlot([seq("a", "tense", ["at_ease", "tense"])], 1104);
    expect(plot.lanes[0]!.tenor).toBe("tense");
    expect(plot.lanes[0]!.peakY).toBe(BAND_Y.tense);
  });
});

describe("buildLanePlot — honesty: warm-up + lost-read fade, never bridge (SC-010)", () => {
  it("a leading absent stretch is a warm-up fade at the first band's level (not a bridge)", () => {
    const lane = buildLanePlot([seq("a", "tense", [null, "tense", "tense"])], 1104).lanes[0]!;
    expect(lane.warmup).not.toBeNull();
    expect(lane.warmup!.y).toBe(BAND_Y.tense);
    expect(lane.runs).toHaveLength(1);
    expect(lane.runs[0]!.band).toBe("tense");
  });
  it("an interior gap is a lost-read fade — the band is NOT bridged into one solid run", () => {
    const lane = buildLanePlot([seq("a", "at_ease", ["at_ease", null, "at_ease"])], 1104).lanes[0]!;
    expect(lane.lostReads).toHaveLength(1);
    expect(lane.lostReads[0]!.y).toBe(BAND_Y.at_ease);
    expect(lane.runs).toHaveLength(2); // two at_ease runs, NOT one bridged run
  });
});

describe("buildLanePlot — a fully no-read session sits on its own low lane (SC-010)", () => {
  it("renders a hollow marker at the no_read level, never on the calm line", () => {
    const lane = buildLanePlot([seq("late", "no_read", [null, null])], 1104).lanes[0]!;
    expect(lane.noRead).toBe(true);
    expect(lane.peakY).toBe(BAND_Y.no_read);
    expect(lane.peakY).not.toBe(BAND_Y.at_ease);
    expect(lane.runs).toHaveLength(0);
  });
});

describe("toSeqs — groups rows by session in capture order, carries tenor", () => {
  it("orders each session's bands by capturedAt and passes tenor through", () => {
    const iso = (h: number, m: number) => new Date(2026, 5, 21, h, m).toISOString();
    const sessions = [{ sessionId: "a", tenor: "tense" as const }];
    const rows = [
      { sessionId: "a", band: "tense" as Band | null, capturedAt: iso(14, 10) },
      { sessionId: "a", band: "at_ease" as Band | null, capturedAt: iso(13, 35) },
    ];
    const seqs = toSeqs(sessions, rows);
    expect(seqs).toHaveLength(1);
    expect(seqs[0]!.tenor).toBe("tense");
    expect(seqs[0]!.bands).toEqual(["at_ease", "tense"]); // sorted by time
  });
});

describe("buildMini — one peak marker per session for the collapsed step-line (SC-003)", () => {
  it("maps each session to its tenor height at an ordinal x", () => {
    const peaks = buildMini([
      seq("m", "at_ease", ["at_ease"]),
      seq("a", "tense", ["tense"]),
      seq("late", "no_read", [null]),
    ]);
    expect(peaks).toHaveLength(3);
    expect(peaks[1]!.tenor).toBe("tense");
    expect(peaks[2]!.noRead).toBe(true);
    expect(peaks[0]!.cx).toBeLessThan(peaks[1]!.cx); // ordinal left→right
  });
});
