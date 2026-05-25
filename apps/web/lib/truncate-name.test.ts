import { describe, expect, it } from "vitest";

import { truncateName } from "@/lib/truncate-name";

describe("truncateName", () => {
  it("passes through names shorter than the default 24-char cap", () => {
    expect(truncateName("Jane Doe")).toBe("Jane Doe");
  });

  it("passes through names exactly at the cap", () => {
    const exactly24 = "A".repeat(24);
    expect(truncateName(exactly24)).toBe(exactly24);
    expect(truncateName(exactly24).length).toBe(24);
  });

  it("truncates one character past the cap into ellipsis terminator", () => {
    const twentyFive = "A".repeat(25);
    const result = truncateName(twentyFive);
    expect(result.length).toBe(24);
    expect(result.endsWith("…")).toBe(true);
    expect(result).toBe("A".repeat(23) + "…");
  });

  it("uses the Unicode U+2026 ellipsis, not three ASCII dots", () => {
    const result = truncateName("A".repeat(40));
    expect(result.endsWith("…")).toBe(true);
    expect(result.endsWith("...")).toBe(false);
    expect(result.charCodeAt(result.length - 1)).toBe(0x2026);
  });

  it("honours a custom max length", () => {
    expect(truncateName("Jane Doe", 5)).toBe("Jane…");
    expect(truncateName("Jane Doe", 5).length).toBe(5);
  });

  it("is idempotent for repeated calls with the same input", () => {
    const input = "A very long name that definitely exceeds the cap";
    const a = truncateName(input);
    const b = truncateName(input);
    const c = truncateName(input);
    expect(a).toBe(b);
    expect(b).toBe(c);
  });

  it("produces byte-identical output across repeated invocations (server/client parity contract)", () => {
    const samples = [
      "",
      "A",
      "Jane Doe",
      "A".repeat(23),
      "A".repeat(24),
      "A".repeat(25),
      "A".repeat(60),
      "  spaced  ",
    ];
    const first = samples.map((s) => truncateName(s));
    const second = samples.map((s) => truncateName(s));
    expect(first).toEqual(second);
  });

  it("handles the empty string by returning the empty string", () => {
    expect(truncateName("")).toBe("");
  });
});
