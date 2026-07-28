import { describe, expect, it } from "vitest";

import * as consentCopy from "@/lib/consent/copy";
import * as landingCopy from "@/lib/landing/copy";
import * as legalCopy from "@/lib/legal/copy";

/**
 * T031 — FR-002's two forbidden claim families, asserted absent from every string this
 * feature publishes.
 *
 * Lives under `tests/unit/landing/` because `plan.md` §10.1 fixes this path and **P6
 * extends this same file** to cover `lib/landing/copy.ts` as well. In P3 there is one
 * copy module to walk; the walker and the pattern list are already written to take more.
 *
 * NO MOCK READ HAPPENS HERE. The three negative fixtures below are transcribed from
 * `plan.md` §10.2, which quotes all three verbatim. `plan.md` §10.1 restricts reading
 * `docs/mockups/serenify-landing-mock.html` to P6 and P7, and this test does not need it:
 * a fixture proving the detector bites is a fixture, wherever it was copied from.
 *
 * The fixtures are the point. A forbidden-claim assertion that has never been shown to
 * fail is decoration — it passes just as happily against a detector that matches nothing.
 * Each of the mock's three lines is run through the detector and asserted to be CAUGHT,
 * so the same test file proves both that the shipped copy is clean and that the thing
 * checking it works.
 *
 * The patterns are deliberately targeted rather than broad. FR-001 permits exactly one
 * "reaches a manager" claim — the scoped chat-and-crisis one — and a heuristic wide
 * enough to catch every possible paraphrase of the blanket claim would also catch the
 * permitted one. `research.md` §12.2 makes the same call for T032's membership check:
 * precision over breadth, so a failure always means something real.
 */

// ── Family (a): on-device / in-browser video processing ──────────────────────
//
// FALSE for this system. Video IS transmitted to the inference service; the clip is
// deleted after the read rather than never sent. Claiming otherwise is the single most
// tempting lie a privacy page for this product could tell, because it is the reassurance
// a reader most wants to hear.

const ON_DEVICE_PATTERNS: readonly RegExp[] = [
  /\bvideo\b[^.!?]{0,40}\b(never|does\s?n[o']?t|doesn't)\b[^.!?]{0,20}\bleaves?\b/i,
  /\bnever leaves your\b[^.!?]{0,20}\b(device|browser|computer|machine|phone|laptop)\b/i,
  /\b(frames?|video|footage)\b[^.!?]{0,50}\b(processed|analys(ed|is)|analyz(ed|is)|scored)\b[^.!?]{0,30}\b(in|on)\s+your\s+(browser|device|computer|machine|phone)\b/i,
  /\bon[-\s]?device\b[^.!?]{0,20}\b(processing|inference|analysis|scoring)\b/i,
  /\bprocessed\b[^.!?]{0,20}\b(locally|on your device|in your browser)\b/i,
  /\b(stays?|remains?|kept)\b[^.!?]{0,20}\bon your (device|computer|phone|machine)\b/i,
];

// ── Family (b): a BLANKET "nothing reaches a manager" claim ──────────────────
//
// Also false, and false in the more dangerous direction. Stress-trend summaries ARE
// manager-visible by default in the designed end-state, so a blanket negation is a
// promise this system breaks the day that view ships (Principle I, public-communication
// rule). The scoped chat-and-crisis claim FR-001 permits is the ONLY form this may take,
// and the positive-fixture test below pins that distinction down.

const BLANKET_MANAGER_PATTERNS: readonly RegExp[] = [
  /\bnever a manager\b/i,
  /\bnothing\b[^.!?]{0,80}\breach(es|ing)?\b[^.!?]{0,30}\b(manager|team lead|employer|admin)/i,
  /\bshow a manager your\b/i,
  /\banonymi[sz]ed group trends\b/i,
  /\bnot your individual readings\b/i,
  /\b(manager|team lead)\b[^.!?]{0,60}\bsees?\b[^.!?]{0,50}\band nothing else\b/i,
];

const ALL_PATTERNS: readonly { readonly family: string; readonly pattern: RegExp }[] = [
  ...ON_DEVICE_PATTERNS.map((pattern) => ({ family: "on-device video processing", pattern })),
  ...BLANKET_MANAGER_PATTERNS.map((pattern) => ({ family: "blanket manager negation", pattern })),
];

/** Every match a string trips, named by family and pattern. Empty means clean. */
function violations(text: string): string[] {
  return ALL_PATTERNS.filter(({ pattern }) => pattern.test(text)).map(
    ({ family, pattern }) => `${family} — ${pattern}`,
  );
}

/**
 * Every string reachable from a copy module's exports, with the export path that led to
 * it. Walks nested structures because the section arrays hold blocks which hold either a
 * paragraph or a list of items — a shallow `Object.values` sweep would check the named
 * constants and silently skip everything rendered through `LegalSection`.
 */
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

// P6 appends `lib/landing/copy.ts` here (plan.md §10.1) — done, below.
const COPY_MODULES: readonly { readonly name: string; readonly module: unknown }[] = [
  { name: "lib/legal/copy.ts", module: legalCopy },
  // T105 (P6). The landing page is the surface a stranger meets first and the one with
  // the strongest pull toward reassurance, so it is the likeliest place for either
  // forbidden family to reappear. Walking it here rather than reviewing components by eye
  // is the whole point of confining landing copy to one module (plan.md §10.1 item 1).
  { name: "lib/landing/copy.ts", module: landingCopy },
  // T058 (P4). The camera gate's wording is the single most tempting place in the
  // product to tell family (a)'s lie — it is the surface asking permission to use a
  // webcam, where "the video never leaves your machine" is exactly the reassurance a
  // reader most wants. It does leave. This walks that module too.
  { name: "lib/consent/copy.ts", module: consentCopy },
];

const ALL_STRINGS = COPY_MODULES.flatMap(({ name, module }) => collectStrings(module, name));

describe("the copy modules are actually being walked", () => {
  it("finds a substantial number of strings, so a passing suite is not an empty sweep", () => {
    // Guards the failure mode where the walker breaks, finds nothing, and every
    // assertion below passes vacuously.
    expect(ALL_STRINGS.length).toBeGreaterThan(50);
  });

  it("reaches strings nested inside the section structures, not just the named constants", () => {
    const nested = ALL_STRINGS.filter((entry) => entry.path.includes("_SECTIONS["));
    expect(nested.length).toBeGreaterThan(20);
  });
});

describe("FR-002: no forbidden claim appears in any published string", () => {
  it("every string is clean, and a failure names the string and the family it tripped", () => {
    const offenders = ALL_STRINGS.filter((entry) => violations(entry.text).length > 0).map(
      (entry) => `${entry.path}: ${violations(entry.text).join("; ")}\n    "${entry.text}"`,
    );
    expect(offenders, `forbidden claim(s) found:\n  ${offenders.join("\n  ")}`).toEqual([]);
  });
});

// ── Negative fixtures — the mock's three lines, quoted from plan.md §10.2 ─────

describe("the detector catches the mock's three forbidden lines", () => {
  const FIXTURES: readonly { readonly where: string; readonly text: string }[] = [
    {
      where: "mock :442 — the hero lede",
      text:
        "Serenify notices signs of strain during the workday and checks in with the person — " +
        "never a manager. What happens next is always their call.",
    },
    {
      where: "mock :547–551 — the Never card heading",
      text: "Show a manager your readings.",
    },
    {
      where: "mock :547–551 — the Never card body",
      text:
        "A team lead sees anonymised group trends and nothing else. Not your individual " +
        "readings, not your conversations, not a name attached to a bad afternoon.",
    },
    {
      where: "mock :772 — the closing story beat",
      text: "Nothing here ever reaches a manager.",
    },
  ];

  it.each(FIXTURES)("catches $where", ({ text }) => {
    expect(
      violations(text),
      "this fixture must be CAUGHT — if it is not, the detector has stopped biting and " +
        "every assertion above is passing vacuously",
    ).not.toEqual([]);
  });
});

// ── Positive fixtures — the claims FR-001 permits, which must NOT be flagged ──

describe("the detector does not flag the claims FR-001 permits", () => {
  it("passes the scoped chat-and-crisis claim as shipped in the Privacy Policy", () => {
    // The ONLY form the "reaches a manager" claim may take (FR-001). Scoped to companion
    // chat and crisis disclosures, stated unconditionally because it is a Principle I
    // invariant rather than an unbuilt control. Taken from the shipped copy, not
    // paraphrased, so re-wording it into a blanket claim later fails here.
    expect(violations(legalCopy.PRIVACY_CHAT_P1)).toEqual([]);
    expect(legalCopy.PRIVACY_CHAT_P1).toMatch(
      /never reach(es)? a manager, an administrator, or an employer/i,
    );
  });

  it("passes the crisis passage, which negates notification without negating visibility", () => {
    expect(violations(legalCopy.PRIVACY_CRISIS_P2)).toEqual([]);
  });

  it("passes the manager-visibility passages, which state the visibility rather than deny it", () => {
    for (const passage of legalCopy.MANAGER_VISIBILITY_PASSAGES) {
      expect(violations(passage), `flagged: "${passage}"`).toEqual([]);
    }
  });

  it("passes the consent gate's own camera wording, which also says video IS transmitted", () => {
    // T058. Same inverse risk as the Privacy Policy passage below, but sharper here:
    // this is the text a person reads in the moment they decide. Its first fact is
    // pinned so a later "reassuring" rewrite fails rather than ships.
    const facts = consentCopy.CAMERA_GATE_WHAT_HAPPENS;
    for (const fact of facts) {
      expect(violations(fact), `flagged: "${fact}"`).toEqual([]);
    }
    expect(facts[0]).toMatch(/video is transmitted/i);
  });

  it("the consent gate's wording mentions no manager at all", () => {
    // Not "makes no forbidden manager claim" — mentions none. The gate asks one
    // question, and a visibility claim bolted onto it would be a digression at best.
    for (const value of Object.values(consentCopy)) {
      const text = Array.isArray(value) ? value.join(" ") : String(value);
      expect(text).not.toMatch(/manager|team lead|employer|supervisor/i);
    }
  });

  it("passes the camera passage, which says video IS transmitted", () => {
    // The inverse risk: a detector tuned only for the forbidden phrasing could be
    // satisfied by copy that says nothing at all. This passage makes the true claim
    // explicitly, so its wording is pinned.
    expect(violations(legalCopy.PRIVACY_CAMERA_P2)).toEqual([]);
    expect(legalCopy.PRIVACY_CAMERA_P2).toMatch(/video is transmitted/i);
    expect(legalCopy.PRIVACY_CAMERA_P2).toMatch(
      /the reading is not computed on your device|not.{0,30}on your device/i,
    );
  });

  it("passes the landing page's replacement Never card, the scoped claim FR-001 permits", () => {
    // T105 (P6). This card is the ONLY place the landing page says anything about who
    // sees what, and it is the approved §10.3 Position 2 string. It must pass — if the
    // detector ever flags it, the detector has widened into the permitted claim and
    // every other assertion in this file is suspect.
    expect(violations(landingCopy.NEVER_CARD_CHAT_BODY)).toEqual([]);
    expect(landingCopy.NEVER_CARD_CHAT_BODY).toMatch(
      /never reaches a manager, an admin, or an employer/i,
    );
    // The trap §10.3 names: "Not now, not later." would read as a deferral of the
    // promise rather than its permanence.
    expect(landingCopy.NEVER_CARD_CHAT_BODY.endsWith("Not now, not ever.")).toBe(true);
  });
});

// ── T105 (P6) — the landing-specific invariants ──────────────────────────────

describe("FR-004 / SC-005: the landing copy quotes no model performance figure", () => {
  const LANDING_STRINGS = collectStrings(landingCopy, "lib/landing/copy.ts");

  it("has no digit adjacent to a quality metric", () => {
    // The number nobody should be able to quote back at us. Retention days and a window
    // length are facts about the system; an F1 or an accuracy is a claim about the model,
    // and research.md §12.2 makes its absence a copy invariant.
    const METRIC = /(F1|AUC|ROC|recall|accuracy|precision)[^.!?]{0,20}[0-9]|[0-9][^.!?]{0,20}(F1|AUC|ROC|recall|accuracy|precision)|[0-9]\s*%/i;
    const offenders = LANDING_STRINGS.filter((entry) => METRIC.test(entry.text)).map(
      (entry) => `${entry.path}: "${entry.text}"`,
    );
    expect(offenders, `numeric quality metric(s):\n  ${offenders.join("\n  ")}`).toEqual([]);
  });

  it("keeps 'subject-disjoint' and keeps it free of numbers", () => {
    // The honest half of the same invariant: the detector must not be satisfiable by copy
    // that simply says nothing about evaluation.
    const note = landingCopy.STATUS_NOTE;
    expect(note).toMatch(/subject-disjoint/i);
    expect(note).not.toMatch(/[0-9]/);
  });
});

describe("terminology is binding across the landing copy", () => {
  const LANDING_STRINGS = collectStrings(landingCopy, "lib/landing/copy.ts");

  it("never uses a bare 'check-in' for the weekly work-environment check-in", () => {
    // "calibration" / "monitoring session" / "weekly work-environment check-in" are the
    // three names, and the third is the one that decays: the mock used bare "check-in" in
    // two places, both meaning the monitoring session's prompt rather than the
    // questionnaire — the word was wrong twice over.
    const BARE = /check[-\s]?in/i;
    const FULL = /weekly work-environment check-in/i;
    const offenders = LANDING_STRINGS.filter(
      (entry) => BARE.test(entry.text) && !FULL.test(entry.text),
    )
      // The approved §10.3 hero lede contains the VERB "checks in with the person". It is
      // fixed copy under FR-032, unrewordable, and names no questionnaire.
      .filter((entry) => entry.text !== landingCopy.HERO_LEDE)
      .map((entry) => `${entry.path}: "${entry.text}"`);

    expect(offenders, `bare "check-in":\n  ${offenders.join("\n  ")}`).toEqual([]);
  });

  it("names all three surfaces somewhere on the page", () => {
    const all = LANDING_STRINGS.map((entry) => entry.text).join(" ");
    expect(all).toMatch(/calibration/i);
    expect(all).toMatch(/monitoring session/i);
    expect(all).toMatch(/weekly work-environment check-in/i);
  });
});

describe("the approved §10.3 strings are present character-for-character", () => {
  it("the hero lede is the approved Position 1 string", () => {
    expect(landingCopy.HERO_LEDE).toBe(
      "Serenify notices signs of strain during the workday and checks in with the person first. What happens next is always their call.",
    );
  });

  it("the Never card is the approved Position 2 heading and body", () => {
    expect(landingCopy.NEVER_CARD_CHAT_HEADING).toBe("Read your conversations.");
    expect(landingCopy.NEVER_CARD_CHAT_BODY).toBe(
      "What you say to Ren is yours. Companion chat, and anything you disclose in a crisis, never reaches a manager, an admin, or an employer. Not now, not ever.",
    );
  });

  it("the closing beat is the approved Position 3 string, clauses in the approved order", () => {
    expect(landingCopy.STORY_CLOSING_BEAT).toBe(
      "What you said stays yours. The video was read and forgotten.",
    );
    // Chat clause FIRST. Reversed, the deletion frame bleeds backwards and implies the
    // conversation was deleted too — it was not, so the line would be false.
    expect(landingCopy.STORY_CLOSING_BEAT.indexOf("stays yours")).toBeLessThan(
      landingCopy.STORY_CLOSING_BEAT.indexOf("read and forgotten"),
    );
  });
});
