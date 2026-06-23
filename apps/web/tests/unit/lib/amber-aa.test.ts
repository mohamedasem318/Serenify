import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

/**
 * Feature 009 — SC-007. The amber stress-signal text tokens MUST clear WCAG AA in BOTH
 * themes (measured, not assumed). DC-007 specifics:
 *   - chip / axis text (`--color-amber-text`) is small text → 4.5:1, on the amber tint AND
 *     on the card surface, both themes;
 *   - the headline keyword (`--amber-head`) is large text (≥18.66px @ weight 700) → 3:1, and
 *     it passes on the CARD SURFACE (#F4F5F6 = 3.23:1) but FAILS on the page background
 *     (#EAEBEC = 2.95:1) — so it MUST render on the card surface, never the page bg.
 * Also a regression guard: globals.css declares the four amber sub-tokens with these exact
 * values in both theme blocks (constitution v1.5.1 Amendment 5).
 */

const channel = (c: number) => {
  const s = c / 255;
  return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
};
const luminance = (hex: string) => {
  const h = hex.replace("#", "");
  const r = parseInt(h.slice(0, 2), 16);
  const g = parseInt(h.slice(2, 4), 16);
  const b = parseInt(h.slice(4, 6), 16);
  return 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b);
};
const ratio = (fg: string, bg: string) => {
  const a = luminance(fg);
  const b = luminance(bg);
  const [hi, lo] = a > b ? [a, b] : [b, a];
  return (hi + 0.05) / (lo + 0.05);
};

// real Graphite surfaces (globals.css)
const SURFACE_LIGHT = "#F4F5F6";
const SURFACE_DARK = "#181B1E";
const PAGE_BG_LIGHT = "#EAEBEC";
const TINT_LIGHT = "#F4E3C6";
const TINT_DARK = "#3B2F19";

describe("amber AA — chip/axis text (--color-amber-text), small text → 4.5:1, both themes", () => {
  it("light #8A580F clears 4.5:1 on the amber tint and the card surface", () => {
    expect(ratio("#8A580F", TINT_LIGHT)).toBeGreaterThanOrEqual(4.5);
    expect(ratio("#8A580F", SURFACE_LIGHT)).toBeGreaterThanOrEqual(4.5);
  });
  it("dark #E6C386 clears 4.5:1 on the amber tint and the card surface", () => {
    expect(ratio("#E6C386", TINT_DARK)).toBeGreaterThanOrEqual(4.5);
    expect(ratio("#E6C386", SURFACE_DARK)).toBeGreaterThanOrEqual(4.5);
  });
});

describe("amber AA — headline keyword (--amber-head), large text → 3:1; surface-only", () => {
  it("light #BC7A2A clears 3:1 on the CARD SURFACE", () => {
    expect(ratio("#BC7A2A", SURFACE_LIGHT)).toBeGreaterThanOrEqual(3.0);
  });
  it("light #BC7A2A FAILS 3:1 on the page background → must render on the card surface, not the page bg", () => {
    expect(ratio("#BC7A2A", PAGE_BG_LIGHT)).toBeLessThan(3.0);
  });
  it("dark #E4AE5C clears 3:1 on the card surface", () => {
    expect(ratio("#E4AE5C", SURFACE_DARK)).toBeGreaterThanOrEqual(3.0);
  });
});

describe("amber AA — globals.css declares the four sub-tokens (both themes, Amendment 5)", () => {
  const css = readFileSync(
    path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../../app/globals.css"),
    "utf8",
  );
  const has = (name: string, value: string) =>
    new RegExp(`${name}\\s*:\\s*${value}`, "i").test(css);

  it("light theme values", () => {
    expect(has("--color-amber-text", "#8A580F")).toBe(true);
    expect(has("--amber-tint", "#F4E3C6")).toBe(true);
    expect(has("--amber-soft-line", "#D49A4A")).toBe(true);
    expect(has("--amber-head", "#BC7A2A")).toBe(true);
  });
  it("dark theme values", () => {
    expect(has("--color-amber-text", "#E6C386")).toBe(true);
    expect(has("--amber-tint", "#3B2F19")).toBe(true);
    expect(has("--amber-soft-line", "#E8BC7A")).toBe(true);
    expect(has("--amber-head", "#E4AE5C")).toBe(true);
  });
});
