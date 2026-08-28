import { describe, expect, it } from "vitest";

import * as cardStrings from "@/lib/recommendations/card-strings";

/**
 * Feature 014 — the voice-mechanics guard for the card's SURFACE strings.
 *
 * `library.ts` has T006 watching it. This module holds the rest of the words a person reads
 * on the card — the four descriptions, the control labels, the outcome question — and until
 * this file existed nothing watched those at all. Same mechanics, same rules (FR-028 /
 * Principle V), applied to every exported string without naming them one by one, so a
 * string added later is covered the moment it is exported.
 *
 * This guards MECHANICS only. Content safety is Mohamed's line-by-line review (the T005
 * gate), and these strings still want it — see the module's own review-status note.
 */

// Widened to `string` on purpose: the module's exports are literal types, so a narrowing
// predicate would be narrower than its own parameter and would not compile.
const exported: Array<[string, string]> = Object.entries(
  cardStrings as Record<string, unknown>,
).flatMap(([name, value]) => (typeof value === "string" ? [[name, value] as [string, string]] : []));

describe("card-strings — every exported string", () => {
  it("exports only strings (no accidental helper or object)", () => {
    expect(exported).toHaveLength(Object.keys(cardStrings).length);
  });

  it("is non-empty and carries no leading or trailing whitespace", () => {
    for (const [name, value] of exported) {
      expect(value.length, name).toBeGreaterThan(0);
      expect(value, name).toBe(value.trim());
    }
  });

  it("contains no exclamation mark anywhere (FR-028 — no cheerleading, no urgency)", () => {
    for (const [name, value] of exported) expect(value, name).not.toContain("!");
  });

  it("carries no placeholder token left over from the mock", () => {
    for (const [name, value] of exported) {
      expect(value, name).not.toMatch(/\b(lorem|ipsum|tbd|todo|placeholder|xxx)\b/i);
      expect(value, name).not.toMatch(/\{\{|\}\}|<[a-z]+>/i);
    }
  });

  it("never names a band — the card above states it once, and this one never restates it", () => {
    for (const [name, value] of exported) {
      for (const band of ["Calm", "Uneasy", "Tense"]) expect(value, name).not.toContain(band);
    }
  });

  it("uses none of the alarmist or clinical vocabulary the reflective-copy contract forbids", () => {
    for (const [name, value] of exported) {
      expect(value, name).not.toMatch(/\b(alert|abnormal|elevated risk|detected|diagnos)/i);
    }
  });
});
