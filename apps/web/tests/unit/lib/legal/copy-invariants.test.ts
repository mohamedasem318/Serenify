import { describe, expect, it } from "vitest";

import * as legalCopy from "@/lib/legal/copy";
import { MANAGER_VISIBILITY_PASSAGES, NOT_YET_LIVE_MARKERS } from "@/lib/legal/copy";

/**
 * T032 — the copy invariants that make FR-048a and FR-004 enforceable rather than
 * remembered (`contracts/public-surface.md` §9.3 items 2–3; `research.md` §12.2).
 *
 * FR-048a is the requirement in this feature most likely to be satisfied sloppily: it is
 * satisfied by a paragraph reading a particular way, which nothing normally checks. The
 * mechanism is a membership check over named constants rather than a regex heuristic over
 * prose — so it has no false positives, and a failure always means the copy actually
 * broke the rule.
 *
 * Guard (b) is what stops the mechanism being defeated. Guard (a) alone is trivially
 * satisfiable by emptying `MANAGER_VISIBILITY_PASSAGES` — every member of an empty list
 * carries its marker. So (b) asserts the list is non-empty AND that every member is a
 * string genuinely exported under its own name from the module, which means a passage
 * cannot be quietly dropped from the list while remaining in the document.
 */

/** Every string reachable from the module's exports, with the path that led to it. */
function collectStrings(
  value: unknown,
  path: string,
  found: { path: string; text: string }[] = [],
): { path: string; text: string }[] {
  if (typeof value === "string") {
    found.push({ path, text: value });
  } else if (Array.isArray(value)) {
    value.forEach((item, index) => collectStrings(item, `${path}[${index}]`, found));
  } else if (value && typeof value === "object") {
    for (const [key, inner] of Object.entries(value)) {
      collectStrings(inner, `${path}.${key}`, found);
    }
  }
  return found;
}

const ALL_STRINGS = collectStrings(legalCopy, "copy");

/** The module's own top-level string exports, keyed by export name. */
const NAMED_STRING_EXPORTS = new Map<string, string>(
  Object.entries(legalCopy).filter((entry): entry is [string, string] => typeof entry[1] === "string"),
);

// ── (a) every manager-visibility passage carries its marker, in its own text ──

describe("(a) FR-048a: the not-yet-live marker sits at the point of use", () => {
  it.each(MANAGER_VISIBILITY_PASSAGES.map((passage, index) => ({ index, passage })))(
    "passage $index contains an approved marker within its own text",
    ({ passage }) => {
      const carried = NOT_YET_LIVE_MARKERS.filter((marker) => passage.includes(marker));
      expect(
        carried,
        "This passage describes what a manager sees and carries NO not-yet-live marker of " +
          "its own. A marker in a distant forward-looking section does not satisfy FR-048a: " +
          "a reader who reads only this paragraph must not come away believing a manager " +
          `can see their trend today.\n\nPassage:\n"${passage}"\n\n` +
          `Approved markers:\n${NOT_YET_LIVE_MARKERS.map((m) => `  - ${m}`).join("\n")}`,
      ).not.toEqual([]);
    },
  );

  it("states the visibility plainly rather than only denying it", () => {
    // FR-048a forbids softening in BOTH directions. A passage that carried a marker but
    // never said a manager sees anything would satisfy (a) while breaking the
    // requirement it exists to serve.
    const joined = MANAGER_VISIBILITY_PASSAGES.join(" ");
    expect(joined).toMatch(/summary only/i);
    expect(joined).toMatch(/direct manager/i);
    expect(joined).toMatch(/stress-trend summary/i);
  });

  it("never states manager visibility in unqualified present tense", () => {
    // "your manager sees" / "managers see" is the exact false claim FR-048a names: no
    // manager-facing surface exists, so it is untrue of the system as shipped, and it
    // tells an employee they are watched today when they are not.
    //
    // Narrow on purpose. It does NOT flag "In the designed end-state, a direct manager
    // sees their direct reports", because that clause carries its own framing and is the
    // clearest way to state the design — FR-048a forbids softening in both directions, so
    // a rule broad enough to ban every present-tense verb would push the copy toward the
    // vagueness the requirement exists to prevent. What is caught is the possessive,
    // reader-addressed form, which reads as a statement about today no matter what
    // surrounds it. This already caught one real defect: PRIVACY_MANAGER_CONTROLS
    // originally paired "will show you" with "what your manager sees".
    for (const passage of MANAGER_VISIBILITY_PASSAGES) {
      expect(passage, `unqualified present tense in: "${passage}"`).not.toMatch(
        /\byour manager sees\b|\bmanagers see\b|\ba manager sees your\b/i,
      );
    }
  });
});

// ── (b) the list cannot be silently emptied or detached from the document ────

describe("(b) the passage list is real and cannot be quietly emptied", () => {
  it("is non-empty", () => {
    // Without this, (a) passes vacuously the moment someone deletes the list's contents.
    expect(MANAGER_VISIBILITY_PASSAGES.length).toBeGreaterThan(0);
  });

  it("every member is genuinely exported from lib/legal/copy.ts under its own name", () => {
    const exportedValues = new Set(NAMED_STRING_EXPORTS.values());
    for (const passage of MANAGER_VISIBILITY_PASSAGES) {
      expect(
        exportedValues.has(passage),
        `a member of MANAGER_VISIBILITY_PASSAGES is not a named export — it was inlined ` +
          `into the list instead of referencing the constant the document renders, so the ` +
          `document and the list can now drift apart:\n"${passage}"`,
      ).toBe(true);
    }
  });

  it("every listed passage is actually rendered in the Privacy Policy", () => {
    // The other half of the same drift: a passage could be listed, exported, and never
    // rendered — satisfying both checks while the real document says something else.
    const rendered = collectStrings(legalCopy.PRIVACY_SECTIONS, "PRIVACY_SECTIONS").map(
      (entry) => entry.text,
    );
    for (const passage of MANAGER_VISIBILITY_PASSAGES) {
      expect(
        rendered.includes(passage),
        `listed in MANAGER_VISIBILITY_PASSAGES but never rendered:\n"${passage}"`,
      ).toBe(true);
    }
  });

  it("markers are declared and each one is used by at least one passage", () => {
    expect(NOT_YET_LIVE_MARKERS.length).toBeGreaterThan(0);
    for (const marker of NOT_YET_LIVE_MARKERS) {
      const users = MANAGER_VISIBILITY_PASSAGES.filter((passage) => passage.includes(marker));
      expect(users.length, `approved marker is never used: "${marker}"`).toBeGreaterThan(0);
    }
  });
});

// ── (c) zero numeric quality metrics anywhere (FR-004, SC-005) ───────────────

describe("(c) FR-004: no numeric quality metric appears in any published string", () => {
  const METRIC_WORDS = "F1|AUC|ROC|recall|accuracy|precision";
  const METRIC_PATTERNS: readonly RegExp[] = [
    new RegExp(`\\b(?:${METRIC_WORDS})\\b[^.!?]{0,25}\\d`, "i"),
    new RegExp(`\\d[^.!?]{0,25}\\b(?:${METRIC_WORDS})\\b`, "i"),
    /\d\s*(?:%|per\s?cent|percent)/i,
    /(?:%|per\s?cent|percent)\s*\d/i,
  ];

  it("no string pairs a digit with a quality-metric word", () => {
    const offenders = ALL_STRINGS.filter((entry) =>
      METRIC_PATTERNS.some((pattern) => pattern.test(entry.text)),
    ).map((entry) => `${entry.path}: "${entry.text}"`);
    expect(offenders, `numeric quality metric(s) found:\n  ${offenders.join("\n  ")}`).toEqual([]);
  });

  it("no percentage sign appears at all", () => {
    const offenders = ALL_STRINGS.filter((entry) => entry.text.includes("%")).map(
      (entry) => entry.path,
    );
    expect(offenders).toEqual([]);
  });
});

// ── (d) the evaluation METHOD is named, without numbers ─────────────────────

describe("(d) FR-004: subject-disjoint is named and carries no numbers", () => {
  it("appears in the published copy", () => {
    const mentions = ALL_STRINGS.filter((entry) => /subject-disjoint/i.test(entry.text));
    expect(
      mentions.length,
      "the evaluation method must be named — FR-004 removes the numbers, not the method",
    ).toBeGreaterThan(0);
  });

  it("carries no digit anywhere near it", () => {
    const mentions = ALL_STRINGS.filter((entry) => /subject-disjoint/i.test(entry.text));
    for (const { path, text } of mentions) {
      expect(text, `${path} pairs a number with the evaluation method`).not.toMatch(
        /subject-disjoint[^.!?]{0,60}\d|\d[^.!?]{0,60}subject-disjoint/i,
      );
    }
  });
});

// ── The controller contact is real, with no placeholder left (FR-046) ───────

describe("FR-046: the data controller is named, with no placeholder", () => {
  it("names Mohamed Asem as an individual and gives the real contact address", () => {
    const joined = ALL_STRINGS.map((entry) => entry.text).join(" ");
    expect(joined).toMatch(/Mohamed Asem, as an individual/);
    expect(joined).toContain("mohamedasem318@gmail.com");
  });

  it("leaves no placeholder token anywhere", () => {
    const offenders = ALL_STRINGS.filter((entry) =>
      /\bTBD\b|\bTODO\b|\[insert|\{\{|XXX|PLACEHOLDER|lorem ipsum/i.test(entry.text),
    ).map((entry) => `${entry.path}: "${entry.text}"`);
    expect(offenders).toEqual([]);
  });
});

// ── FR-047: the no-legal-review notice actually says what it must ───────────

describe("FR-047: the draft status is stated unmissably", () => {
  it("names the absence of qualified legal review and what it blocks", () => {
    const notice = `${legalCopy.LEGAL_REVIEW_NOTICE_HEADING} ${legalCopy.LEGAL_REVIEW_NOTICE_BODY}`;
    expect(notice).toMatch(/not been reviewed by a qualified lawyer|without qualified legal review/i);
    expect(notice).toMatch(/before .{0,40}real|non-demonstration/i);
  });
});
