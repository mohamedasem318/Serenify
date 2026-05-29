import { describe, expect, it } from "vitest";

import {
  ANCHOR_BYTE_LENGTH,
  ANCHOR_DIM,
  SYNTHETIC_ANCHOR_MODEL_VERSION,
  syntheticAnchorBytes,
  syntheticAnchorHex,
} from "../lib/synthetic-anchor.js";

describe("synthetic anchor (📌 DECISION-17, FR-031/032)", () => {
  it("produces 11832 bytes (2958 little-endian float32)", () => {
    expect(ANCHOR_BYTE_LENGTH).toBe(ANCHOR_DIM * 4);
    expect(syntheticAnchorBytes()).toHaveLength(ANCHOR_BYTE_LENGTH);
  });

  it("is byte-identical across calls (deterministic, FR-032)", () => {
    expect(syntheticAnchorBytes().equals(syntheticAnchorBytes())).toBe(true);
    expect(syntheticAnchorHex()).toBe(syntheticAnchorHex());
  });

  it("emits a \\x-hex bytea literal of the expected shape", () => {
    const hex = syntheticAnchorHex();
    expect(hex.startsWith("\\x")).toBe(true);
    expect(hex.length).toBe(2 + ANCHOR_BYTE_LENGTH * 2); // "\x" + 2 hex chars/byte
    expect(hex.slice(2)).toMatch(/^[0-9a-f]+$/);
  });

  it("is not a constant vector — the PRNG actually varies", () => {
    const buf = syntheticAnchorBytes();
    const first = buf.readFloatLE(0);
    let varies = false;
    for (let i = 1; i < ANCHOR_DIM; i += 1) {
      if (buf.readFloatLE(i * 4) !== first) {
        varies = true;
        break;
      }
    }
    expect(varies).toBe(true);
  });

  it("tags the demo model version (matches docs/MODELS.md + the API)", () => {
    expect(SYNTHETIC_ANCHOR_MODEL_VERSION).toBe(
      "serenify-video-lbptop-motion-rf-calibrated@2.0.0",
    );
  });
});
