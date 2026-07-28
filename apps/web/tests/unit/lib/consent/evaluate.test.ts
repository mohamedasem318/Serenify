import { readFileSync } from "node:fs";
import path from "node:path";

import { beforeEach, describe, expect, it, vi } from "vitest";

import type { ConsentRevision, ConsentTextKey } from "@/lib/consent/registry";

/**
 * T015 — the exhaustive evaluator suite (`research.md` §12.2).
 *
 * Every registry SHAPE crossed with every HELD-VERSION case, each cell asserting the
 * boolean. This is deliberately not an e2e suite: reproducing "publish a revision, then
 * observe 100% of pre-existing users re-prompted" in a browser means seeding users,
 * mutating a module between runs, and racing session state — the exact conditions under
 * which this repo's e2e has gone green while the behaviour was broken (`research.md`
 * §12.3). The evaluator is pure, so it is provable at a layer that cannot lie about
 * timing, and it can be exhaustive where a browser suite cannot.
 *
 * Isolation is by module-mocking `registry.ts`. The evaluator's three signatures take no
 * registry parameter and must not gain one (`contracts/consent-evaluate.md`) — the
 * public surface both gates depend on is not widened for the convenience of a test.
 *
 * The expected `currentIndex` / `bindingIndex` on each shape are stated BY HAND rather
 * than computed, so this table is an independent statement of the contract. Deriving
 * them with the implementation's own rule would make the suite agree with any bug it
 * happens to contain.
 */

const { mockRegistry } = vi.hoisted(() => ({
  mockRegistry: { terms_privacy: [], camera_inference: [] } as Record<
    ConsentTextKey,
    readonly ConsentRevision[]
  >,
}));

vi.mock("@/lib/consent/registry", () => ({ CONSENT_REGISTRY: mockRegistry }));

const { bindingRevision, currentRevision, satisfiesConsent } = await import(
  "@/lib/consent/evaluate"
);

// ── Fixtures ─────────────────────────────────────────────────────────────────

const KEY: ConsentTextKey = "terms_privacy";
const OTHER_KEY: ConsentTextKey = "camera_inference";

/** Well-formed per the database's CHECK regex, but never a registry member (R7/R8). */
const UNKNOWN_ID = "terms_privacy@2099-12-31.1";

function rev(
  key: ConsentTextKey,
  publishedOn: string,
  seq: number,
  materiality: ConsentRevision["materiality"],
): ConsentRevision {
  return {
    versionId: `${key}@${publishedOn}.${seq}`,
    publishedOn,
    materiality,
    rationale: `fixture — ${materiality}`,
  };
}

const M1 = rev(KEY, "2026-01-01", 1, "material");
const M2 = rev(KEY, "2026-02-01", 1, "material");
const C2 = rev(KEY, "2026-02-01", 2, "cosmetic");
const C3 = rev(KEY, "2026-03-01", 1, "cosmetic");
const C4 = rev(KEY, "2026-04-01", 1, "cosmetic");
const M3 = rev(KEY, "2026-05-01", 1, "material");

type Shape = {
  readonly name: string;
  readonly entries: readonly ConsentRevision[];
  /** The newest published revision — what a prompted user is shown. */
  readonly currentIndex: number;
  /** The newest MATERIAL revision — what a user must hold at or after. */
  readonly bindingIndex: number;
};

const SHAPES: readonly Shape[] = [
  { name: "first-ever revision", entries: [M1], currentIndex: 0, bindingIndex: 0 },
  { name: "material after material", entries: [M1, M2], currentIndex: 1, bindingIndex: 1 },
  { name: "cosmetic after material", entries: [M1, C2], currentIndex: 1, bindingIndex: 0 },
  {
    name: "several cosmetics after one material",
    entries: [M1, C2, C3, C4],
    currentIndex: 3,
    bindingIndex: 0,
  },
  { name: "material after cosmetic", entries: [M1, C2, M3], currentIndex: 2, bindingIndex: 2 },
];

/** The five held-version cases of `research.md` §12.2. */
const HELD_CASES = ["none", "the binding one", "one before", "one after", "an unknown id"] as const;
type HeldCase = (typeof HELD_CASES)[number];

/**
 * The held ids for a case, or `null` when the shape structurally has no such position —
 * there is nothing before the binding revision when it is first, and nothing after it
 * when it is last. Those cells are asserted as structurally absent rather than skipped,
 * so the cross product stays honest.
 */
function heldFor(shape: Shape, held: HeldCase): readonly string[] | null {
  const at = (i: number) => shape.entries[i]?.versionId ?? null;
  switch (held) {
    case "none":
      return [];
    case "the binding one":
      return [at(shape.bindingIndex)].filter((id): id is string => id !== null);
    case "one before":
      return shape.bindingIndex > 0 ? [at(shape.bindingIndex - 1) as string] : null;
    case "one after":
      return shape.bindingIndex < shape.entries.length - 1
        ? [at(shape.bindingIndex + 1) as string]
        : null;
    case "an unknown id":
      return [UNKNOWN_ID];
  }
}

/** The contract's answer for each cell, stated independently of the implementation. */
const EXPECTED: Record<HeldCase, boolean> = {
  none: false, // no record at all — the absence IS the state (research.md §6.4)
  "the binding one": true, // holding exactly the requirement satisfies it
  "one before": false, // a material revision moved the requirement past this
  "one after": true, // cosmetic descent — a later version still satisfies
  "an unknown id": false, // a non-registry id is inert, however well-formed
};

beforeEach(() => {
  mockRegistry.terms_privacy = [];
  mockRegistry.camera_inference = [];
});

function load(entries: readonly ConsentRevision[]) {
  mockRegistry.terms_privacy = entries;
}

// ── currentRevision / bindingRevision, per shape ─────────────────────────────

describe.each(SHAPES)("shape: $name", (shape) => {
  const expectedCurrent = shape.entries[shape.currentIndex] as ConsentRevision;
  const expectedBinding = shape.entries[shape.bindingIndex] as ConsentRevision;

  it("currentRevision is the newest published revision", () => {
    load(shape.entries);
    expect(currentRevision(KEY).versionId).toBe(expectedCurrent.versionId);
  });

  it("bindingRevision is the newest material revision", () => {
    load(shape.entries);
    expect(bindingRevision(KEY).versionId).toBe(expectedBinding.versionId);
    expect(bindingRevision(KEY).materiality).toBe("material");
  });

  // ── The cross product: this shape × every held-version case ────────────────

  describe.each(HELD_CASES)("held: %s", (held) => {
    it(`satisfiesConsent is ${EXPECTED[held]}`, () => {
      load(shape.entries);
      const ids = heldFor(shape, held);

      if (ids === null) {
        // Structurally absent, and the reason is asserted rather than assumed.
        if (held === "one before") {
          expect(
            shape.bindingIndex,
            `"${shape.name}" can only lack a revision before the binding one if it IS the first`,
          ).toBe(0);
        } else {
          expect(
            shape.bindingIndex,
            `"${shape.name}" can only lack a revision after the binding one if it IS the last`,
          ).toBe(shape.entries.length - 1);
        }
        return;
      }

      expect(satisfiesConsent(KEY, ids), `held ${JSON.stringify(ids)}`).toBe(EXPECTED[held]);
    });
  });
});

// ── The two behavioural claims the cross product exists to prove ─────────────

describe("a cosmetic revision published after the binding one re-prompts nobody", () => {
  it("everyone holding the binding revision still satisfies after one cosmetic", () => {
    load([M1, C2]);
    expect(satisfiesConsent(KEY, [M1.versionId])).toBe(true);
    expect(bindingRevision(KEY).versionId).toBe(M1.versionId);
    // The requirement did not move, even though what a NEW user is shown did.
    expect(currentRevision(KEY).versionId).toBe(C2.versionId);
  });

  it("still satisfies after several cosmetics", () => {
    load([M1, C2, C3, C4]);
    for (const held of [[M1.versionId], [C2.versionId], [C3.versionId], [C4.versionId]]) {
      expect(satisfiesConsent(KEY, held), `held ${held[0]}`).toBe(true);
    }
    expect(bindingRevision(KEY).versionId).toBe(M1.versionId);
  });
});

describe("a material revision re-prompts everybody holding only earlier versions", () => {
  it("every pre-existing holder is re-prompted when a material revision lands", () => {
    load([M1, C2, M3]);
    // Every version published before the new material one — none of them satisfies.
    for (const held of [[M1.versionId], [C2.versionId], [M1.versionId, C2.versionId]]) {
      expect(satisfiesConsent(KEY, held), `held ${held.join(", ")}`).toBe(false);
    }
    // And holding the new one does.
    expect(satisfiesConsent(KEY, [M3.versionId])).toBe(true);
    expect(satisfiesConsent(KEY, [M1.versionId, C2.versionId, M3.versionId])).toBe(true);
  });

  it("re-prompts a holder of the immediately preceding material revision", () => {
    load([M1, M2]);
    expect(satisfiesConsent(KEY, [M1.versionId])).toBe(false);
    expect(satisfiesConsent(KEY, [M2.versionId])).toBe(true);
  });
});

// ── A non-registry version id never satisfies the gate (R7/R8) ───────────────

describe("a well-formed but non-registry version id never satisfies the gate", () => {
  it.each(SHAPES)("$name", (shape) => {
    load(shape.entries);
    expect(satisfiesConsent(KEY, [UNKNOWN_ID])).toBe(false);
  });

  it("does not satisfy even when mixed with other unknown ids", () => {
    load([M1, C2]);
    expect(satisfiesConsent(KEY, [UNKNOWN_ID, "terms_privacy@2026-01-01.9"])).toBe(false);
  });

  it("an id belonging to the other consented text does not satisfy", () => {
    mockRegistry.terms_privacy = [M1];
    mockRegistry.camera_inference = [rev(OTHER_KEY, "2026-01-01", 1, "material")];
    expect(satisfiesConsent(KEY, ["camera_inference@2026-01-01.1"])).toBe(false);
  });

  it("an unknown id alongside a satisfying one is simply ignored", () => {
    load([M1, C2]);
    expect(satisfiesConsent(KEY, [UNKNOWN_ID, M1.versionId])).toBe(true);
  });
});

// ── An empty entry list throws rather than returning undefined ───────────────

describe("an empty entry list throws", () => {
  it.each([
    ["currentRevision", () => currentRevision(KEY)],
    ["bindingRevision", () => bindingRevision(KEY)],
    ["satisfiesConsent", () => satisfiesConsent(KEY, [])],
  ] as const)("%s throws, naming the key", (_name, call) => {
    expect(call).toThrowError(/no published revision for consent key "terms_privacy"/i);
  });

  it("throws for camera_inference independently of terms_privacy", () => {
    mockRegistry.terms_privacy = [M1];
    expect(() => currentRevision(OTHER_KEY)).toThrowError(/camera_inference/);
    expect(() => currentRevision(KEY)).not.toThrow();
  });

  it("throws rather than returning undefined — the return type is non-optional", () => {
    let returned: unknown = "sentinel";
    try {
      returned = currentRevision(KEY);
    } catch {
      returned = "threw";
    }
    expect(returned).toBe("threw");
  });
});

// ── The gate reads version identity only — never a clock ────────────────────

describe("version identity is the only input", () => {
  it("ignores publication dates entirely: an out-of-order date changes no answer", () => {
    // Same shape as "cosmetic after material", but the cosmetic claims an EARLIER
    // publication date than the material one it follows. A timestamp rule would answer
    // differently; index order is what decides, so the answers are unchanged.
    const backdatedCosmetic: ConsentRevision = { ...C2, publishedOn: "2020-01-01" };
    load([M1, backdatedCosmetic]);
    expect(bindingRevision(KEY).versionId).toBe(M1.versionId);
    expect(satisfiesConsent(KEY, [M1.versionId])).toBe(true);
    expect(satisfiesConsent(KEY, [backdatedCosmetic.versionId])).toBe(true);
  });

  it("gives the same answer regardless of when it is called", () => {
    load([M1, C2, M3]);
    const first = satisfiesConsent(KEY, [C2.versionId]);
    vi.useFakeTimers();
    try {
      vi.setSystemTime(new Date("2099-01-01T00:00:00Z"));
      expect(satisfiesConsent(KEY, [C2.versionId])).toBe(first);
      vi.setSystemTime(new Date("1999-01-01T00:00:00Z"));
      expect(satisfiesConsent(KEY, [C2.versionId])).toBe(first);
    } finally {
      vi.useRealTimers();
    }
    expect(first).toBe(false);
  });

  it("the module references no clock and no decided_at at all", () => {
    // The behavioural checks above can only sample instants; this is the whole surface.
    // T013's done-when: the evaluator reads registry indices only, and references
    // neither `decided_at` nor any wall clock (research.md §6.2).
    const source = readFileSync(
      path.join(process.cwd(), "lib/consent/evaluate.ts"),
      "utf8",
    ).replace(/\/\*[\s\S]*?\*\/|\/\/.*$/gm, ""); // strip comments — they name these on purpose
    for (const forbidden of ["decided_at", "Date", "now(", "performance", "publishedOn"]) {
      expect(source, `evaluate.ts must not reference ${forbidden}`).not.toContain(forbidden);
    }
  });

  it("an empty held list is false, not an error, once a revision is published", () => {
    load([M1]);
    expect(satisfiesConsent(KEY, [])).toBe(false);
  });
});
