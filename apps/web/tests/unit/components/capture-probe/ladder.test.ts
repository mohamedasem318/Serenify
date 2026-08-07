import { describe, expect, it } from "vitest";

import {
  bitrateLabel,
  extensionFor,
  makeClip,
  maxChunkGap,
  summarizeStep,
  voidReasonFor,
  LADDER_TARGETS_BPS,
  RETAINED_TARGETS_BPS,
  type LadderStep,
  type TrackSettingsSummary,
} from "@/components/capture-probe/ladder";

/**
 * The bitrate ladder's decision rules. The void rule is the load-bearing one: a past
 * probe run silently recorded 480x640 instead of 720p and produced a wire-weight figure
 * that had to be withdrawn. These tests pin the two ways that can happen — the operating
 * point being wrong from the start, and the camera downshifting mid-recording.
 */

const AT_720: TrackSettingsSummary = {
  width: 1280,
  height: 720,
  frameRate: 15,
  facingMode: "user",
  aspectRatio: 1.777,
};

/** iPhone grants the 720-class mode rotated — the short side is the invariant. */
const PORTRAIT_720: TrackSettingsSummary = { ...AT_720, width: 720, height: 1280 };

describe("voidReasonFor", () => {
  it("passes a landscape 720p recording that held steady", () => {
    expect(voidReasonFor(AT_720, AT_720)).toBeNull();
  });

  it("passes portrait 720x1280 — the short side is what matters, not the width", () => {
    expect(voidReasonFor(PORTRAIT_720, PORTRAIT_720)).toBeNull();
  });

  it("voids the 480p case that produced the withdrawn wire-weight figure", () => {
    const at480: TrackSettingsSummary = { ...AT_720, width: 480, height: 640 };
    expect(voidReasonFor(at480, at480)).toMatch(/not the 720-class production operating point/);
  });

  it("voids a resolution downshift that happens mid-recording", () => {
    const after: TrackSettingsSummary = { ...AT_720, width: 640, height: 480 };
    expect(voidReasonFor(AT_720, after)).toMatch(/drifted mid-recording/);
  });

  it("voids a frame-rate change mid-recording even at a steady resolution", () => {
    expect(voidReasonFor(AT_720, { ...AT_720, frameRate: 7.5 })).toMatch(/drifted mid-recording/);
  });

  it("voids when the camera reports no settings at all", () => {
    expect(voidReasonFor(null, AT_720)).toBe("camera settings unreadable");
    expect(voidReasonFor(AT_720, null)).toBe("camera settings unreadable");
  });

  it("voids when settings exist but carry no resolution", () => {
    const noRes: TrackSettingsSummary = { ...AT_720, width: null, height: null };
    expect(voidReasonFor(noRes, noRes)).toBe("camera reported no resolution");
  });
});

describe("the ladder itself", () => {
  it("descends, starts unset, and brackets Chrome wire parity from below", () => {
    expect(LADDER_TARGETS_BPS[0]).toBeNull();
    const set = LADDER_TARGETS_BPS.slice(1) as number[];
    expect(set).toEqual([...set].sort((a, b) => b - a));
    // 0.75 Mbit/s is desktop Chrome VP9 parity; something lower must follow it so the
    // usable floor is bracketed from both sides rather than only from above.
    expect(set).toContain(750_000);
    expect(Math.min(...set)).toBeLessThan(750_000);
  });

  it("retains three clips, and every retained target is a rung of the ladder", () => {
    expect(RETAINED_TARGETS_BPS).toHaveLength(3);
    for (const target of RETAINED_TARGETS_BPS) {
      expect(LADDER_TARGETS_BPS).toContain(target);
    }
  });
});

describe("maxChunkGap", () => {
  it("measures the first gap from recorder start, not from the first chunk", () => {
    // A recorder that stalls 9 s before its first flush has a 9 s gap, not a 1 s one.
    expect(maxChunkGap([{ t: 9_000, bytes: 1 }, { t: 10_000, bytes: 1 }])).toBe(9_000);
  });

  it("finds the widest interior gap", () => {
    const chunks = [10_000, 20_000, 38_000].map((t) => ({ t, bytes: 1 }));
    expect(maxChunkGap(chunks)).toBe(18_000);
  });

  it("returns null when there is nothing to compare", () => {
    expect(maxChunkGap([])).toBeNull();
    expect(maxChunkGap([{ t: 10_000, bytes: 1 }])).toBeNull();
  });
});

describe("makeClip", () => {
  const step = (targetBps: number | null, target: string): LadderStep => ({
    target,
    targetBps,
    reflectedVideoBitsPerSecond: null,
    grantedBefore: AT_720,
    grantedAfter: AT_720,
    void: false,
  });

  it("names the file after the rate it was recorded at and the real container", () => {
    const clip = makeClip(
      step(1_500_000, "1.50 Mbit/s"),
      new Blob([new Uint8Array(8)], { type: "video/mp4" }),
      "1.50 Mbit/s",
    );
    expect(clip.fileName).toBe("serenify-probe-1500kbps.mp4");
    expect(clip.file.type).toBe("video/mp4");
    expect(clip.substitutedFor).toBeUndefined();
  });

  it("uses the webm extension when the recorder produced webm", () => {
    const clip = makeClip(
      step(null, "unset (encoder default)"),
      new Blob([new Uint8Array(8)], { type: "video/webm;codecs=vp9" }),
      "unset (encoder default)",
    );
    expect(clip.fileName).toBe("serenify-probe-baseline.webm");
  });

  it("records the substitution when a neighbour stands in for a void rung", () => {
    const clip = makeClip(
      step(2_000_000, "2.00 Mbit/s"),
      new Blob([new Uint8Array(8)], { type: "video/mp4" }),
      "1.50 Mbit/s",
    );
    // The file must never claim to be the rung that was asked for.
    expect(clip.fileName).toBe("serenify-probe-2000kbps.mp4");
    expect(clip.label).toBe("2.00 Mbit/s");
    expect(clip.substitutedFor).toBe("1.50 Mbit/s");
  });
});

describe("report formatting", () => {
  it("labels the unset rung distinctly from any numeric target", () => {
    expect(bitrateLabel(null)).toBe("unset (encoder default)");
    expect(bitrateLabel(750_000)).toBe("0.75 Mbit/s");
  });

  it("falls back to .bin rather than guessing an unknown container", () => {
    expect(extensionFor("video/x-matroska")).toBe("bin");
    expect(extensionFor("")).toBe("bin");
  });

  it("leads a void step's summary line with the reason", () => {
    const line = summarizeStep({
      target: "0.75 Mbit/s",
      targetBps: 750_000,
      reflectedVideoBitsPerSecond: 750_000,
      grantedBefore: AT_720,
      grantedAfter: AT_720,
      effectiveMbps: 0.74,
      mediaSeconds: 25,
      wallSeconds: 25.1,
      chunkCount: 3,
      void: true,
      voidReason: "settings drifted mid-recording",
    });
    expect(line.startsWith("VOID (settings drifted mid-recording)")).toBe(true);
  });

  it("reports an unmeasurable bitrate as unmeasurable rather than as zero", () => {
    const line = summarizeStep({
      target: "0.50 Mbit/s",
      targetBps: 500_000,
      reflectedVideoBitsPerSecond: 500_000,
      grantedBefore: AT_720,
      grantedAfter: AT_720,
      effectiveMbps: null,
      mediaSeconds: null,
      chunkCount: 0,
      void: true,
      voidReason: "media duration unreadable",
    });
    expect(line).toContain("effective bitrate unmeasurable");
    expect(line).toContain("media duration unreadable");
    expect(line).not.toContain("0.00 Mbit/s");
  });
});
