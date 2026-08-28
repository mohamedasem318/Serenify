import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { buildAtRestFallbackText, buildCalmFallbackText } from "@/lib/recommendations/library";
import {
  REFLECTIVE_COPY_CACHE_PREFIX,
  clearReflectiveCopyCache,
  readCachedReflectiveCopy,
  reflectiveCopyCacheKey,
  writeCachedReflectiveCopy,
} from "@/lib/recommendations/reflective-copy-cache";
import type { ReflectiveFacts } from "@/lib/recommendations/reflective-copy-validation";

/**
 * Feature 014 — T022. The cache's contract, stated as behaviour:
 *   • same state, same day → one generation, then reuse (FR-022);
 *   • a new day → a new key, so yesterday's sentence can never be served (FR-019);
 *   • only validated text is ever stored, and only validated text is ever handed back;
 *   • storage trouble is a cache miss, never an exception.
 */

const CALM_BASE = { checkinCount: 3, times: ["9:40", "11:15"], bandLabels: ["Calm"] };

const calmFacts = (): ReflectiveFacts => ({
  state: 2,
  ...CALM_BASE,
  fallbackText: buildCalmFallbackText(CALM_BASE),
});

const AT_REST_BASE = {
  checkinCount: 2,
  times: ["9:40"],
  bandLabels: ["Uneasy"],
  triedItemTitle: "Box breathing",
  triedAtLabel: "2:20",
};

const atRestFacts = (): ReflectiveFacts => ({
  state: 9,
  ...AT_REST_BASE,
  fallbackText: buildAtRestFallbackText(AT_REST_BASE),
});

const DAY = "2026-08-16";
const NEXT_DAY = "2026-08-17";

const VALID_CALM_TEXT = "Calm at all 3 check-ins today, 9:40 and 11:15.";

beforeEach(() => {
  sessionStorage.clear();
});

afterEach(() => {
  vi.restoreAllMocks();
  sessionStorage.clear();
});

describe("reflectiveCopyCacheKey — the fingerprint", () => {
  it("is namespaced so it cannot collide with another feature's session key", () => {
    expect(reflectiveCopyCacheKey(calmFacts(), DAY)).toMatch(
      new RegExp(`^${REFLECTIVE_COPY_CACHE_PREFIX.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}`),
    );
  });

  it("is stable for the same state regardless of how the object was built", () => {
    // Object key ORDER is a property of construction, not of meaning — the key must not
    // move because a caller spread the fields differently.
    const a: ReflectiveFacts = {
      state: 2,
      checkinCount: 3,
      times: ["9:40", "11:15"],
      bandLabels: ["Calm"],
      fallbackText: "x",
    };
    const b: ReflectiveFacts = {
      fallbackText: "x",
      bandLabels: ["Calm"],
      times: ["9:40", "11:15"],
      checkinCount: 3,
      state: 2,
    };
    expect(reflectiveCopyCacheKey(a, DAY)).toBe(reflectiveCopyCacheKey(b, DAY));
  });

  it("ignores fallbackText — it is derived, so a copy edit must not evict live tabs", () => {
    const withOther: ReflectiveFacts = { ...calmFacts(), fallbackText: "a different wording" };
    expect(reflectiveCopyCacheKey(withOther, DAY)).toBe(reflectiveCopyCacheKey(calmFacts(), DAY));
  });

  it("changes with the state number", () => {
    const asNine: ReflectiveFacts = { ...calmFacts(), state: 9 };
    expect(reflectiveCopyCacheKey(asNine, DAY)).not.toBe(reflectiveCopyCacheKey(calmFacts(), DAY));
  });

  it("changes with the check-in count, the times and the band labels", () => {
    const base = reflectiveCopyCacheKey(calmFacts(), DAY);
    expect(reflectiveCopyCacheKey({ ...calmFacts(), checkinCount: 4 }, DAY)).not.toBe(base);
    expect(reflectiveCopyCacheKey({ ...calmFacts(), times: ["9:40"] }, DAY)).not.toBe(base);
    expect(reflectiveCopyCacheKey({ ...calmFacts(), bandLabels: ["Tense"] }, DAY)).not.toBe(base);
  });

  it("changes with the state-9 fields", () => {
    const base = reflectiveCopyCacheKey(atRestFacts(), DAY);
    expect(
      reflectiveCopyCacheKey({ ...atRestFacts(), triedItemTitle: "Feet on the floor" }, DAY),
    ).not.toBe(base);
    expect(reflectiveCopyCacheKey({ ...atRestFacts(), triedAtLabel: "9:40" }, DAY)).not.toBe(base);
  });

  it("distinguishes an absent optional field from an empty string", () => {
    const absent = reflectiveCopyCacheKey(calmFacts(), DAY);
    const empty = reflectiveCopyCacheKey({ ...calmFacts(), triedItemTitle: "" }, DAY);
    expect(empty).not.toBe(absent);
  });

  it("changes with the local day (FR-019 comes free)", () => {
    expect(reflectiveCopyCacheKey(calmFacts(), NEXT_DAY)).not.toBe(
      reflectiveCopyCacheKey(calmFacts(), DAY),
    );
  });
});

describe("write → read round trip (FR-022)", () => {
  it("hands back the same text for the same state and day, with no regeneration", () => {
    const facts = calmFacts();
    expect(writeCachedReflectiveCopy(VALID_CALM_TEXT, facts, DAY)).toBe(true);
    expect(readCachedReflectiveCopy(facts, DAY)).toBe(VALID_CALM_TEXT);
    // A second, independently-built facts object with the same content still hits.
    expect(readCachedReflectiveCopy(calmFacts(), DAY)).toBe(VALID_CALM_TEXT);
  });

  it("misses on a different day, so yesterday's sentence is never served (FR-019)", () => {
    const facts = calmFacts();
    writeCachedReflectiveCopy(VALID_CALM_TEXT, facts, DAY);
    expect(readCachedReflectiveCopy(facts, NEXT_DAY)).toBeNull();
  });

  it("misses on a state change", () => {
    const facts = calmFacts();
    writeCachedReflectiveCopy(VALID_CALM_TEXT, facts, DAY);
    expect(readCachedReflectiveCopy({ ...facts, state: 9 }, DAY)).toBeNull();
  });

  it("misses on a changed fact (a fourth check-in lands)", () => {
    const facts = calmFacts();
    writeCachedReflectiveCopy(VALID_CALM_TEXT, facts, DAY);
    expect(readCachedReflectiveCopy({ ...facts, checkinCount: 4 }, DAY)).toBeNull();
  });

  it("keeps state 2 and state 9 in separate slots at the same time", () => {
    const calm = calmFacts();
    const rest = atRestFacts();
    const restText = "Box breathing was what you reached for at 2:20 today.";
    writeCachedReflectiveCopy(VALID_CALM_TEXT, calm, DAY);
    writeCachedReflectiveCopy(restText, rest, DAY);
    expect(readCachedReflectiveCopy(calm, DAY)).toBe(VALID_CALM_TEXT);
    expect(readCachedReflectiveCopy(rest, DAY)).toBe(restText);
  });

  it("reads null when nothing was ever written", () => {
    expect(readCachedReflectiveCopy(calmFacts(), DAY)).toBeNull();
  });
});

describe("only validated text is ever cached, or ever returned", () => {
  it("refuses to store a fabrication", () => {
    const facts = calmFacts();
    expect(writeCachedReflectiveCopy("Calm at all 8 check-ins today.", facts, DAY)).toBe(false);
    expect(sessionStorage.getItem(reflectiveCopyCacheKey(facts, DAY))).toBeNull();
    expect(readCachedReflectiveCopy(facts, DAY)).toBeNull();
  });

  it("refuses to store an exclamation mark, empty text, or oversized text", () => {
    const facts = calmFacts();
    expect(writeCachedReflectiveCopy("Calm at all 3 check-ins today!", facts, DAY)).toBe(false);
    expect(writeCachedReflectiveCopy("   ", facts, DAY)).toBe(false);
    expect(writeCachedReflectiveCopy("a".repeat(221), facts, DAY)).toBe(false);
    expect(readCachedReflectiveCopy(facts, DAY)).toBeNull();
  });

  it("treats a tampered stored value as a miss rather than as text to paint", () => {
    // sessionStorage is writable by anyone with devtools open; a read that skipped
    // validation would be a way straight around SC-004.
    const facts = calmFacts();
    sessionStorage.setItem(reflectiveCopyCacheKey(facts, DAY), "Tense at 47 check-ins!");
    expect(readCachedReflectiveCopy(facts, DAY)).toBeNull();
  });

  it("treats an empty stored value as a miss", () => {
    const facts = calmFacts();
    sessionStorage.setItem(reflectiveCopyCacheKey(facts, DAY), "");
    expect(readCachedReflectiveCopy(facts, DAY)).toBeNull();
  });
});

describe("storage trouble never throws", () => {
  // Spied on the INSTANCE, not `Storage.prototype`: happy-dom's storage object carries
  // its own methods, so a prototype spy silently never fires and the test would pass
  // while proving nothing.
  // …and restored by hand: `vi.restoreAllMocks()` does not reach a spy installed on
  // happy-dom's proxied storage instance, so leaving it to the global afterEach would
  // leak a throwing storage into every later test in the file.
  it("returns a miss when getItem throws", () => {
    const spy = vi.spyOn(window.sessionStorage, "getItem").mockImplementation(() => {
      throw new Error("SecurityError");
    });
    try {
      expect(() => readCachedReflectiveCopy(calmFacts(), DAY)).not.toThrow();
      expect(readCachedReflectiveCopy(calmFacts(), DAY)).toBeNull();
    } finally {
      spy.mockRestore();
    }
  });

  it("returns false when setItem throws (quota / private mode)", () => {
    const spy = vi.spyOn(window.sessionStorage, "setItem").mockImplementation(() => {
      throw new Error("QuotaExceededError");
    });
    try {
      expect(() => writeCachedReflectiveCopy(VALID_CALM_TEXT, calmFacts(), DAY)).not.toThrow();
      expect(writeCachedReflectiveCopy(VALID_CALM_TEXT, calmFacts(), DAY)).toBe(false);
    } finally {
      spy.mockRestore();
    }
  });

  it("validates BEFORE touching storage, so a rejection needs no storage at all", () => {
    const spy = vi.spyOn(window.sessionStorage, "setItem");
    try {
      expect(writeCachedReflectiveCopy("Calm at all 8 check-ins today.", calmFacts(), DAY)).toBe(
        false,
      );
      expect(spy).not.toHaveBeenCalled();
    } finally {
      spy.mockRestore();
    }
  });
});

describe("clearReflectiveCopyCache", () => {
  it("drops this cache's entries and leaves other session keys alone", () => {
    sessionStorage.setItem("serenify.some-other-feature", "keep me");
    writeCachedReflectiveCopy(VALID_CALM_TEXT, calmFacts(), DAY);
    writeCachedReflectiveCopy(VALID_CALM_TEXT, calmFacts(), NEXT_DAY);

    clearReflectiveCopyCache();

    expect(readCachedReflectiveCopy(calmFacts(), DAY)).toBeNull();
    expect(readCachedReflectiveCopy(calmFacts(), NEXT_DAY)).toBeNull();
    expect(sessionStorage.getItem("serenify.some-other-feature")).toBe("keep me");
  });
});
