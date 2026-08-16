import { StrictMode } from "react";
import { act, cleanup, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  REFLECTIVE_GENERATION_BUDGET_MS,
  REFLECTIVE_SKELETON_BUDGET_MS,
  ThingsThatMightHelpCard,
  reflectiveInputFor,
  type ThingsThatMightHelpDeps,
} from "@/components/home/things-that-might-help-card";
import type { Band } from "@/lib/api/monitoring-client";
import {
  REFLECTIVE_COPY_REQUEST_TIMEOUT_MS,
  type ReflectiveCopyResult,
} from "@/lib/api/recommendations-client";
import {
  CARD_DESC_NOTHING_TO_SUGGEST,
  CARD_DESC_NO_READING,
  CARD_TITLE,
} from "@/lib/recommendations/card-strings";
import type { PickRow } from "@/lib/recommendations/episode";
import {
  AT_REST_FORWARD_LINE,
  CALM_FORWARD_LINE,
  NO_READING_YET_LEAD,
  NO_READING_YET_LINE,
  RECOMMENDATION_LIBRARY,
  REFLECTIVE_COPY_MAX_LENGTH,
  buildAtRestFallbackText,
  buildCalmFallbackText,
} from "@/lib/recommendations/library";
import {
  readCachedReflectiveCopy,
  reflectiveCopyCacheKey,
} from "@/lib/recommendations/reflective-copy-cache";
import type { ReflectiveFacts } from "@/lib/recommendations/reflective-copy-validation";
import type { TodayBandReading } from "@/lib/recommendations/recommendation-reads";

/**
 * Feature 014 / T025 + T026 — User Story 3: honest reflection on calm and empty days.
 *
 * Two things are pinned here.
 *
 * **The first-paint contract** (`contracts/reflective-copy.md` §First paint). Its single
 * invariant is that the reflective line is painted ONCE per mounted state and never flips
 * under the reader. Every test below is written to catch a flip, not merely to observe an
 * end state: they assert what is on screen *at each step*, because "the right text
 * eventually" and "the right text without ever showing another one" are different claims
 * and only the second one is the contract.
 *
 * **US3 acceptance scenarios (a)–(d)**, and SC-004's two 100% clauses: with generation
 * failing in every way it can fail, the deterministic string renders, and the card never
 * blocks on it — the shell is on screen while the line is still a skeleton.
 *
 * ── The two Vitest facts this file is written around (same as the T014 suite) ─────────
 * RTL's `waitFor` DEADLOCKS on Vitest fake timers — it polls real time while the component
 * sits on the fake clock — so nothing here waits: everything is driven with `act` +
 * `advanceTimersByTimeAsync` and asserted synchronously. happy-dom carries no stylesheet,
 * so motion claims are asserted on `className`, never with `toBeVisible()`.
 */

// ─────────────────────────────────────────────────────────────────────────────
// Fixtures
// ─────────────────────────────────────────────────────────────────────────────

const AT = (day: number, hour: number, minute: number) =>
  new Date(2026, 7, day, hour, minute).getTime();

const TODAY = 16;
const NOW = AT(TODAY, 14, 30);
const LOCAL_DAY = "2026-08-16";

const reading = (band: Band, hour: number, minute: number, sessionId: string): TodayBandReading => ({
  band,
  atMs: AT(TODAY, hour, minute),
  sessionId,
});

/** Two calm check-ins — the shape scenario (b) needs: a real count and real times. */
const CALM_DAY = [reading("at_ease", 9, 40, "s1"), reading("at_ease", 11, 15, "s2")];

const CALM_FACTS = { checkinCount: 2, times: ["9:40", "11:15"], bandLabels: ["Calm"] };

/** The deterministic LEAD — the builder's output minus its own forward-line suffix. */
const CALM_LEAD = buildCalmFallbackText(CALM_FACTS)
  .slice(0, -CALM_FORWARD_LINE.length)
  .trim();

const CALM_STATE_FACTS: ReflectiveFacts = {
  state: 2,
  ...CALM_FACTS,
  fallbackText: CALM_LEAD,
};

/** A legal re-phrasing: every digit, time and band word below was supplied. */
const VALID_REPHRASING = "All 2 of today's check-ins — 9:40 and 11:15 — read Calm.";

/** An illegal one: 7 check-ins were never reported. */
const FABRICATED_REPHRASING = "Calm at all 7 check-ins today.";

const OPENED_ITEM = RECOMMENDATION_LIBRARY[0]!;

function pickRow(over: Partial<PickRow> = {}): PickRow {
  return {
    id: "pick-1",
    localDay: LOCAL_DAY,
    episodeId: "episode-1",
    itemId: OPENED_ITEM.id,
    category: OPENED_ITEM.category,
    source: "reading",
    suggestedAtMs: AT(TODAY, 14, 0),
    confirmedAtMs: null,
    openedAtMs: AT(TODAY, 14, 20),
    outcome: "helped",
    outcomeAtMs: AT(TODAY, 14, 25),
    swappedAwayAtMs: null,
    ...over,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Harness
// ─────────────────────────────────────────────────────────────────────────────

interface Gen {
  calls: number;
  /** Resolve the pending generation call with this result. */
  resolve: (result: ReflectiveCopyResult) => void;
}

function harness(options: {
  bands?: TodayBandReading[];
  picks?: PickRow[];
  now?: number;
  /** Fixed result; omit to hold the call open and resolve it by hand. */
  result?: ReflectiveCopyResult;
}): { deps: Partial<ThingsThatMightHelpDeps>; gen: Gen } {
  const bands = options.bands ?? [];
  const picks = options.picks ?? [];
  let settle: ((result: ReflectiveCopyResult) => void) | null = null;
  const gen: Gen = {
    calls: 0,
    resolve: (result) => {
      const fn = settle;
      settle = null;
      fn?.(result);
    },
  };

  const deps: Partial<ThingsThatMightHelpDeps> = {
    library: RECOMMENDATION_LIBRARY,
    dwellMs: 2_500,
    now: () => options.now ?? NOW,
    newId: () => "episode-new",
    openRen: () => {},
    loadPicks: async () => picks.map((p) => ({ ...p })),
    loadBands: async () => bands.map((b) => ({ ...b })),
    surfacePick: async () => ({ ok: false, reason: "write_failed" }),
    recordOpened: async () => ({ ok: true, wrote: false }),
    recordOutcome: async () => ({ ok: true, attempts: 1 }),
    swapPick: async () => ({ stamped: false, replacementSurfaced: false, reselected: false }),
    generateReflectiveCopy: () => {
      gen.calls += 1;
      if (options.result) return Promise.resolve(options.result);
      return new Promise<ReflectiveCopyResult>((res) => {
        settle = res;
      });
    },
  };

  return { deps, gen };
}

/** Flush the load → derive chain without ever calling `waitFor`. */
async function settle(rounds = 12) {
  for (let i = 0; i < rounds; i += 1) {
    await act(async () => {
      await Promise.resolve();
    });
  }
}

async function advance(ms: number) {
  await act(async () => {
    await vi.advanceTimersByTimeAsync(ms);
  });
}

async function mount(deps: Partial<ThingsThatMightHelpDeps>, userId = "user-1") {
  const view = render(<ThingsThatMightHelpCard userId={userId} deps={deps} />);
  await settle();
  return view;
}

const leadText = () => screen.getByTestId("resting-lead").textContent ?? "";
const skeleton = () => screen.queryByTestId("reflective-skeleton");
const cardState = () =>
  screen.getByTestId("things-that-might-help").getAttribute("data-card-state");

/**
 * SC-004's zero-fabrication clause at the surface: every number the resting block shows
 * must be one the facts supplied. Reads the rendered text, not the model — the point is
 * what a person can see.
 */
function expectNoFabricatedNumbers(supplied: readonly string[]) {
  const shown = [
    screen.getByTestId("resting-lead").textContent ?? "",
    screen.queryByTestId("resting-line")?.textContent ?? "",
  ].join(" ");
  const allowed = new Set(supplied.join(" ").match(/\d+/g) ?? []);
  for (const run of shown.match(/\d+/g) ?? []) {
    expect(allowed.has(run), `fabricated number ${run} in "${shown}"`).toBe(true);
  }
}

beforeEach(() => {
  vi.useFakeTimers();
  sessionStorage.clear();
});

afterEach(() => {
  cleanup();
  vi.useRealTimers();
  sessionStorage.clear();
});

// ─────────────────────────────────────────────────────────────────────────────
// T025 — the three first-paint tests the contract names
// ─────────────────────────────────────────────────────────────────────────────

describe("first paint — rule 1: a cache hit paints immediately", () => {
  it("skips the skeleton and makes no network call at all", async () => {
    // Warm the cache through the card itself, so the entry is the real one.
    const first = harness({ bands: CALM_DAY, result: { ok: true, text: VALID_REPHRASING } });
    await mount(first.deps);
    expect(leadText()).toBe(VALID_REPHRASING);
    expect(first.gen.calls).toBe(1);
    cleanup();

    const second = harness({ bands: CALM_DAY });
    await mount(second.deps);

    expect(skeleton()).toBeNull();
    expect(leadText()).toBe(VALID_REPHRASING);
    expect(second.gen.calls).toBe(0); // rule 1 — no skeleton, NO network call
  });

  it("keeps the cached line for the rest of the session (FR-022)", async () => {
    const first = harness({ bands: CALM_DAY, result: { ok: true, text: VALID_REPHRASING } });
    await mount(first.deps);
    cleanup();

    const second = harness({ bands: CALM_DAY });
    await mount(second.deps);
    await advance(REFLECTIVE_GENERATION_BUDGET_MS * 2);
    await settle();

    expect(leadText()).toBe(VALID_REPHRASING);
    expect(second.gen.calls).toBe(0);
  });
});

describe("first paint — rule 3: a result inside the budget is the first and only paint", () => {
  it("shows the skeleton, then paints the generated line — the fallback never appears", async () => {
    const h = harness({ bands: CALM_DAY });
    await mount(h.deps);

    // Rule 2 — the shell is up, only the line's slot is waiting.
    expect(cardState()).toBe("2");
    expect(screen.getByText(CARD_TITLE)).toBeTruthy();
    expect(screen.getByTestId("resting-line")).toHaveTextContent(CALM_FORWARD_LINE);
    expect(skeleton()).not.toBeNull();
    expect(screen.getByTestId("resting-lead")).toHaveAttribute("aria-busy", "true");
    expect(leadText()).toBe(""); // the deterministic string has NOT been painted

    await advance(300);
    expect(skeleton()).not.toBeNull();

    await act(async () => {
      h.gen.resolve({ ok: true, text: VALID_REPHRASING });
    });
    await settle();

    expect(skeleton()).toBeNull();
    expect(leadText()).toBe(VALID_REPHRASING);
    expect(screen.getByTestId("resting-lead")).not.toHaveAttribute("aria-busy");

    // And nothing later disturbs it — not the skeleton budget, not the generation budget.
    await advance(REFLECTIVE_GENERATION_BUDGET_MS * 2);
    expect(leadText()).toBe(VALID_REPHRASING);
    expectNoFabricatedNumbers([CALM_LEAD, ...CALM_FACTS.times, "2"]);
  });

  it("caches the line it painted, so the next mount needs no request", async () => {
    const h = harness({ bands: CALM_DAY });
    await mount(h.deps);
    await act(async () => {
      h.gen.resolve({ ok: true, text: VALID_REPHRASING });
    });
    await settle();

    expect(readCachedReflectiveCopy(CALM_STATE_FACTS, LOCAL_DAY)).toBe(VALID_REPHRASING);
  });
});

describe("first paint — rule 4: a late result never replaces the painted fallback", () => {
  it("paints the deterministic string at the budget and lets it stand", async () => {
    const h = harness({ bands: CALM_DAY });
    await mount(h.deps);
    expect(skeleton()).not.toBeNull();

    await advance(REFLECTIVE_SKELETON_BUDGET_MS);

    expect(skeleton()).toBeNull();
    expect(leadText()).toBe(CALM_LEAD);

    // A validated result arrives AFTER the reader stopped waiting but inside the
    // background budget. It is cached, and it does not touch the screen.
    await advance(700);
    await act(async () => {
      h.gen.resolve({ ok: true, text: VALID_REPHRASING });
    });
    await settle();

    expect(leadText()).toBe(CALM_LEAD);
    expect(readCachedReflectiveCopy(CALM_STATE_FACTS, LOCAL_DAY)).toBe(VALID_REPHRASING);

    await advance(REFLECTIVE_GENERATION_BUDGET_MS * 2);
    expect(leadText()).toBe(CALM_LEAD);
  });

  it("serves that late result to the NEXT first paint", async () => {
    const h = harness({ bands: CALM_DAY });
    await mount(h.deps);
    await advance(REFLECTIVE_SKELETON_BUDGET_MS + 700);
    await act(async () => {
      h.gen.resolve({ ok: true, text: VALID_REPHRASING });
    });
    await settle();
    cleanup();

    const next = harness({ bands: CALM_DAY });
    await mount(next.deps);

    expect(skeleton()).toBeNull();
    expect(leadText()).toBe(VALID_REPHRASING);
    expect(next.gen.calls).toBe(0);
  });

  it("keeps a result that arrives past the background budget, but only for the next paint", async () => {
    const h = harness({ bands: CALM_DAY });
    await mount(h.deps);
    await advance(REFLECTIVE_GENERATION_BUDGET_MS + 10);

    await act(async () => {
      h.gen.resolve({ ok: true, text: VALID_REPHRASING });
    });
    await settle();

    // The painted line is untouched — that is the invariant. The text itself is still a
    // validated re-phrasing of this exact state, so it serves the next first paint.
    expect(leadText()).toBe(CALM_LEAD);
    expect(readCachedReflectiveCopy(CALM_STATE_FACTS, LOCAL_DAY)).toBe(VALID_REPHRASING);
  });

  it("caches a validated result that lands after the card is GONE", async () => {
    // Rule 4's "next first paint" outlives this component. A result arriving after
    // unmount is the same text this mount would have shown, so it is kept — only the
    // PAINT is gated on being alive.
    const h = harness({ bands: CALM_DAY });
    await mount(h.deps);
    expect(skeleton()).not.toBeNull();

    cleanup();

    await act(async () => {
      h.gen.resolve({ ok: true, text: VALID_REPHRASING });
    });
    await settle();

    expect(readCachedReflectiveCopy(CALM_STATE_FACTS, LOCAL_DAY)).toBe(VALID_REPHRASING);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// The stranded-skeleton regression (adversarial review, 2026-08-16)
// ─────────────────────────────────────────────────────────────────────────────

describe("an effect re-run at the same fingerprint never strands the skeleton", () => {
  it("survives a mid-flight re-render with fresh-identity, same-content facts and deps", async () => {
    // The prod shape: a background reload hands down a new `bands` array with identical
    // contents, so `facts` and `reflectiveInput` are new OBJECTS at the same fingerprint.
    // Before the fix this tore down the in-flight run and the guard refused to arm a
    // replacement — permanent shimmer, deterministic string never painted.
    const h = harness({ bands: CALM_DAY });
    const view = render(<ThingsThatMightHelpCard userId="user-1" deps={h.deps} />);
    await settle();
    expect(skeleton()).not.toBeNull();

    await act(async () => {
      view.rerender(<ThingsThatMightHelpCard userId="user-1" deps={{ ...h.deps }} />);
    });
    await settle();

    await advance(REFLECTIVE_SKELETON_BUDGET_MS);

    expect(skeleton()).toBeNull();
    expect(leadText()).toBe(CALM_LEAD);
    expect(screen.getByTestId("resting-lead")).not.toHaveAttribute("aria-busy");
    // And it did NOT fire a second request for the same state (FR-022).
    expect(h.gen.calls).toBe(1);
  });

  it("still paints a generated line after a mid-flight re-render", async () => {
    const h = harness({ bands: CALM_DAY });
    const view = render(<ThingsThatMightHelpCard userId="user-1" deps={h.deps} />);
    await settle();

    await act(async () => {
      view.rerender(<ThingsThatMightHelpCard userId="user-1" deps={{ ...h.deps }} />);
    });
    await settle();

    await act(async () => {
      h.gen.resolve({ ok: true, text: VALID_REPHRASING });
    });
    await settle();

    expect(leadText()).toBe(VALID_REPHRASING);
    expect(h.gen.calls).toBe(1);
  });

  it("settles when the fingerprint leaves and returns on a live component (cleanup → re-arm)", async () => {
    // The teardown path, driven deterministically. Dropping `userId` collapses the
    // fingerprint to nothing, which runs the effect's cleanup mid-flight; restoring it
    // brings the SAME fingerprint back on the SAME component instance, so the run guard
    // (a ref) is still holding the dead run. It has to arm a fresh one.
    const h = harness({ bands: CALM_DAY });
    const view = render(<ThingsThatMightHelpCard userId="user-1" deps={h.deps} />);
    await settle();
    expect(skeleton()).not.toBeNull();

    await act(async () => {
      view.rerender(<ThingsThatMightHelpCard userId={undefined} deps={h.deps} />);
    });
    await settle();

    await act(async () => {
      view.rerender(<ThingsThatMightHelpCard userId="user-1" deps={h.deps} />);
    });
    await settle();

    await advance(REFLECTIVE_SKELETON_BUDGET_MS);

    expect(skeleton()).toBeNull();
    expect(leadText()).toBe(CALM_LEAD);
    expect(screen.getByTestId("resting-lead")).not.toHaveAttribute("aria-busy");
  });

  it("settles under StrictMode", async () => {
    // Next 16 leaves `reactStrictMode` on by default and `next.config.ts` does not
    // override it, so this is the shape the app mounts in during development. Note what
    // this does and does not prove: StrictMode double-invokes effects at MOUNT, and at
    // mount this card has not read anything yet, so the fingerprint is still empty and the
    // generation effect is a no-op. The double-invoke therefore never lands on a live
    // request here — which is worth knowing, and is why the test above drives the
    // cleanup → re-arm path directly instead of relying on this one.
    const h = harness({ bands: CALM_DAY });
    render(
      <StrictMode>
        <ThingsThatMightHelpCard userId="user-1" deps={h.deps} />
      </StrictMode>,
    );
    await settle();

    expect(skeleton()).not.toBeNull();
    await advance(REFLECTIVE_SKELETON_BUDGET_MS);

    expect(skeleton()).toBeNull();
    expect(leadText()).toBe(CALM_LEAD);
  });

  it("paints a generated result under StrictMode too", async () => {
    const h = harness({ bands: CALM_DAY, result: { ok: true, text: VALID_REPHRASING } });
    render(
      <StrictMode>
        <ThingsThatMightHelpCard userId="user-1" deps={h.deps} />
      </StrictMode>,
    );
    await settle();

    expect(leadText()).toBe(VALID_REPHRASING);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// T025 — every way generation can fail lands on the deterministic string
// ─────────────────────────────────────────────────────────────────────────────

describe("generation failure always lands on the deterministic string (SC-004)", () => {
  it.each([
    ["a 502 from the endpoint (provider down or no credential)", { ok: false as const, reason: "unavailable" as const }],
    ["a request timeout", { ok: false as const, reason: "timeout" as const }],
    ["a network failure", { ok: false as const, reason: "network" as const }],
    ["a malformed body", { ok: false as const, reason: "malformed" as const }],
    ["no session token", { ok: false as const, reason: "unauthenticated" as const }],
  ])("falls back on %s", async (_label, result) => {
    const h = harness({ bands: CALM_DAY, result });
    await mount(h.deps);

    // Settled immediately: nothing can arrive later to make the wait worth it.
    expect(skeleton()).toBeNull();
    expect(leadText()).toBe(CALM_LEAD);
    expect(screen.getByTestId("resting-line")).toHaveTextContent(CALM_FORWARD_LINE);
    expectNoFabricatedNumbers([CALM_LEAD, ...CALM_FACTS.times, "2"]);
  });

  it("falls back when the generated text fails validation, and caches nothing", async () => {
    const h = harness({ bands: CALM_DAY, result: { ok: true, text: FABRICATED_REPHRASING } });
    await mount(h.deps);

    expect(leadText()).toBe(CALM_LEAD);
    expect(screen.getByTestId("things-that-might-help").textContent).not.toContain("7 check-ins");
    expect(readCachedReflectiveCopy(CALM_STATE_FACTS, LOCAL_DAY)).toBeNull();
    expect(sessionStorage.getItem(reflectiveCopyCacheKey(CALM_STATE_FACTS, LOCAL_DAY))).toBeNull();
  });

  it("falls back when the seam throws rather than returning a result", async () => {
    const { deps } = harness({ bands: CALM_DAY });
    deps.generateReflectiveCopy = () => Promise.reject(new Error("boom"));
    await mount(deps);

    expect(leadText()).toBe(CALM_LEAD);
    expect(screen.queryByRole("alert")).toBeNull();
  });

  it("never blocks: the shell is on screen while the line is still waiting", async () => {
    const h = harness({ bands: CALM_DAY });
    await mount(h.deps);

    expect(cardState()).toBe("2");
    expect(screen.getByText(CARD_TITLE)).toBeTruthy();
    expect(screen.getByTestId("card-description")).toHaveTextContent(CARD_DESC_NOTHING_TO_SUGGEST);
    expect(screen.getByTestId("resting-tile")).toBeTruthy();
    expect(skeleton()).not.toBeNull();
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// T025 — the budgets and the skeleton itself
// ─────────────────────────────────────────────────────────────────────────────

describe("budgets", () => {
  it("is 800 ms for the reader and ≈3.5 s in the background, with the request timeout below", () => {
    expect(REFLECTIVE_SKELETON_BUDGET_MS).toBe(800);
    expect(REFLECTIVE_GENERATION_BUDGET_MS).toBe(3_500);
    // The request must not outlive the budget that is supposed to bound it.
    expect(REFLECTIVE_COPY_REQUEST_TIMEOUT_MS).toBeLessThan(REFLECTIVE_GENERATION_BUDGET_MS);
  });

  it("holds the skeleton for the whole budget and not a tick longer", async () => {
    const h = harness({ bands: CALM_DAY });
    await mount(h.deps);

    await advance(REFLECTIVE_SKELETON_BUDGET_MS - 1);
    expect(skeleton()).not.toBeNull();

    await advance(1);
    expect(skeleton()).toBeNull();
    expect(leadText()).toBe(CALM_LEAD);
  });

  it("the budgets are injectable, so nothing here depends on the shipped numbers", async () => {
    const { deps, gen } = harness({ bands: CALM_DAY });
    deps.reflectiveSkeletonMs = 50;
    deps.reflectiveGenerationMs = 200;
    await mount(deps);

    await advance(49);
    expect(skeleton()).not.toBeNull();
    await advance(1);
    expect(leadText()).toBe(CALM_LEAD);

    await advance(200);
    await act(async () => {
      gen.resolve({ ok: true, text: VALID_REPHRASING });
    });
    await settle();
    // Past the (shortened) background budget the painted line is final; the text is still
    // kept for the next first paint.
    expect(leadText()).toBe(CALM_LEAD);
    expect(readCachedReflectiveCopy(CALM_STATE_FACTS, LOCAL_DAY)).toBe(VALID_REPHRASING);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// The 220 cap bounds what a person READS, not just what was validated
// ─────────────────────────────────────────────────────────────────────────────

describe("the length cap covers the painted pair, not the lead alone", () => {
  it("falls back when a valid lead plus the forward line would overflow the cap", async () => {
    // Passes the validator on its own (no digits, no band words, inside 220) but the pair
    // it would paint is 200 + 1 + 46 = 247 characters.
    const longLead = "x".repeat(200);
    expect(longLead.length).toBeLessThanOrEqual(REFLECTIVE_COPY_MAX_LENGTH);
    expect(`${longLead} ${CALM_FORWARD_LINE}`.length).toBeGreaterThan(REFLECTIVE_COPY_MAX_LENGTH);

    const h = harness({ bands: CALM_DAY, result: { ok: true, text: longLead } });
    await mount(h.deps);

    expect(leadText()).toBe(CALM_LEAD);
    expect(readCachedReflectiveCopy(CALM_STATE_FACTS, LOCAL_DAY)).toBeNull();
  });

  it("still paints a lead that fits once the forward line is counted", async () => {
    const fittingLead = "x".repeat(REFLECTIVE_COPY_MAX_LENGTH - CALM_FORWARD_LINE.length - 1);
    const h = harness({ bands: CALM_DAY, result: { ok: true, text: fittingLead } });
    await mount(h.deps);

    expect(leadText()).toBe(fittingLead);
  });
});

describe("the skeleton", () => {
  it("marks the line busy and animates, in the line's slot only", async () => {
    const h = harness({ bands: CALM_DAY });
    await mount(h.deps);

    const bar = skeleton();
    expect(bar).not.toBeNull();
    expect(bar!.className).toContain("animate-pulse");
    expect(bar).toHaveAttribute("data-motion", "full");
    expect(bar).toHaveAttribute("aria-hidden");
    // The forward line is NOT a skeleton — it is a fixed reviewed constant with nothing
    // to generate, so it paints with the shell.
    expect(screen.getByTestId("resting-line")).toHaveTextContent(CALM_FORWARD_LINE);
  });

  it("is static under prefers-reduced-motion", async () => {
    const original = window.matchMedia;
    window.matchMedia = ((query: string) =>
      ({
        matches: query.includes("prefers-reduced-motion"),
        media: query,
        onchange: null,
        addEventListener: () => {},
        removeEventListener: () => {},
        addListener: () => {},
        removeListener: () => {},
        dispatchEvent: () => false,
      }) as unknown as MediaQueryList) as typeof window.matchMedia;

    try {
      const h = harness({ bands: CALM_DAY });
      await mount(h.deps);
      const bar = skeleton();
      expect(bar).not.toBeNull();
      expect(bar!.className).not.toContain("animate-pulse");
      expect(bar).toHaveAttribute("data-motion", "reduced");
    } finally {
      window.matchMedia = original;
    }
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// T026 — US3 acceptance scenarios (a)–(d)
// ─────────────────────────────────────────────────────────────────────────────

describe("US3 (a) — no readings today: the cause is named, a check-in is offered", () => {
  it("renders state 1 with the cause and the action, and generates nothing", async () => {
    const h = harness({ bands: [], picks: [] });
    await mount(h.deps);

    expect(cardState()).toBe("1");
    expect(screen.getByTestId("card-description")).toHaveTextContent(CARD_DESC_NO_READING);
    expect(screen.getByTestId("resting-lead")).toHaveTextContent(NO_READING_YET_LEAD);
    expect(screen.getByTestId("resting-line")).toHaveTextContent(NO_READING_YET_LINE);
    expect(screen.getByTestId("start-checkin")).toHaveAttribute("href", "/app/monitor");
    // State 1 has no facts of its own — there is nothing to phrase and nothing is asked for.
    expect(h.gen.calls).toBe(0);
    expect(skeleton()).toBeNull();
    expectNoFabricatedNumbers([]);
  });
});

describe("US3 (b) — an all-Calm day with specifics", () => {
  it("states the real count and the real times, then one forward line, with no action", async () => {
    const h = harness({ bands: CALM_DAY, result: { ok: false, reason: "unavailable" } });
    await mount(h.deps);

    expect(cardState()).toBe("2");
    const lead = leadText();
    expect(lead).toContain("2 check-ins");
    expect(lead).toContain("9:40");
    expect(lead).toContain("11:15");
    expect(lead).toContain("Calm");
    expect(screen.getByTestId("resting-line")).toHaveTextContent(CALM_FORWARD_LINE);
    // No action of any kind: state 2 offers nothing to press.
    expect(screen.queryByTestId("start-checkin")).toBeNull();
    expect(screen.queryByTestId("show-me")).toBeNull();
    expect(screen.queryByTestId("swap")).toBeNull();
    expect(screen.queryByTestId("talk-to-ren")).toBeNull();
    expectNoFabricatedNumbers([CALM_LEAD, ...CALM_FACTS.times, "2"]);
  });

  it("counts CHECK-INS, not scored windows — several readings in one session are one", async () => {
    const oneSession = [
      reading("at_ease", 9, 40, "s1"),
      reading("at_ease", 9, 41, "s1"),
      reading("at_ease", 9, 42, "s1"),
    ];
    const h = harness({ bands: oneSession, result: { ok: false, reason: "unavailable" } });
    await mount(h.deps);

    expect(leadText()).toContain("your one check-in");
    expect(leadText()).not.toContain("3");
  });
});

describe("US3 (c) — no true specific line: state 1's SHAPE, never a generic affirmation", () => {
  it("reflectiveInputFor returns null when the builder has no specific to state", () => {
    // The card's gate. `null` means "there is nothing true and specific to say", which is
    // what routes state 2 to state 1's shape — and it also means nothing is generated,
    // because a generator with no facts could only invent them.
    expect(
      reflectiveInputFor(2, { checkinCount: 0, times: [], bandLabels: [] }, {}),
    ).toBeNull();
    expect(reflectiveInputFor(9, CALM_FACTS, {})).toBeNull(); // nothing was tried
    expect(reflectiveInputFor(2, CALM_FACTS, {})).not.toBeNull();
    expect(reflectiveInputFor(1, CALM_FACTS, {})).toBeNull(); // not a generating state
    expect(reflectiveInputFor(3, CALM_FACTS, {})).toBeNull();
  });

  it("the state-2 fallback shape is state 1's, carrying only the forward line", () => {
    // The builder's own contract, which is what the card's null branch renders.
    expect(buildCalmFallbackText({ checkinCount: 0, times: [], bandLabels: [] })).toBe(
      CALM_FORWARD_LINE,
    );
  });

  it("state 9 with nothing opened rests on the forward line alone, and generates nothing", async () => {
    // The reachable instance of the same rule: a day with pick history but nothing opened
    // has no true "you tried X" line, so there is nothing to phrase.
    const h = harness({
      bands: CALM_DAY,
      picks: [pickRow({ openedAtMs: null, outcome: "didnt_help" })],
    });
    await mount(h.deps);

    expect(cardState()).toBe("9");
    expect(leadText()).toBe(AT_REST_FORWARD_LINE);
    expect(h.gen.calls).toBe(0);
    expect(skeleton()).toBeNull();
    expectNoFabricatedNumbers([]);
  });
});

describe("US3 (d) — the provider is down", () => {
  it("renders the deterministic fallback in state 2 and in state 9", async () => {
    const calm = harness({ bands: CALM_DAY, result: { ok: false, reason: "unavailable" } });
    await mount(calm.deps);
    expect(leadText()).toBe(CALM_LEAD);
    cleanup();

    const atRest = harness({
      bands: CALM_DAY,
      picks: [pickRow()],
      result: { ok: false, reason: "unavailable" },
    });
    await mount(atRest.deps);

    expect(cardState()).toBe("9");
    const expected = buildAtRestFallbackText({
      ...CALM_FACTS,
      triedItemTitle: OPENED_ITEM.title,
      triedAtLabel: "2:20",
    })
      .slice(0, -AT_REST_FORWARD_LINE.length)
      .trim();
    expect(leadText()).toBe(expected);
    // It names what was tried, and does NOT claim the day is over.
    expect(leadText()).toContain(OPENED_ITEM.title);
    expect(screen.getByTestId("resting-line")).toHaveTextContent(AT_REST_FORWARD_LINE);
    expectNoFabricatedNumbers([expected, "2:20"]);
  });

  it("shows no error surface on any failure path", async () => {
    const h = harness({ bands: CALM_DAY, result: { ok: false, reason: "network" } });
    await mount(h.deps);

    const text = screen.getByTestId("things-that-might-help").textContent ?? "";
    expect(text).not.toMatch(/error|failed|unavailable|try again|sorry|couldn't/i);
    expect(text).not.toContain("!");
    expect(screen.queryByRole("alert")).toBeNull();
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// State 9's bundle is no wider than its own sentence (FR-021)
// ─────────────────────────────────────────────────────────────────────────────

describe("state 9 hands over only what its line claims", () => {
  it("zeroes the day's counts, times and bands in the bundle", async () => {
    const input = reflectiveInputFor(9, CALM_FACTS, {
      title: OPENED_ITEM.title,
      atLabel: "2:20",
    });

    expect(input).not.toBeNull();
    // The state-9 lead says "You tried X at Y." and nothing else — so nothing else goes.
    expect(input!.checkinCount).toBe(0);
    expect(input!.times).toEqual([]);
    expect(input!.bandLabels).toEqual([]);
    expect(input!.triedItemTitle).toBe(OPENED_ITEM.title);
    expect(input!.triedAtLabel).toBe("2:20");
  });

  it("rejects a sentence that bolts the day's facts onto what was tried", async () => {
    // The exact weakening this narrowing exists for: every number and band word below is
    // TRUE of the day, and none of them is claimed by the fallback being re-phrased.
    const hostile = `You tried ${OPENED_ITEM.title} at 2:20, after a Tense stretch across your 2 check-ins.`;
    const h = harness({
      bands: CALM_DAY,
      picks: [pickRow()],
      result: { ok: true, text: hostile },
    });
    await mount(h.deps);

    expect(cardState()).toBe("9");
    const expected = buildAtRestFallbackText({
      ...CALM_FACTS,
      triedItemTitle: OPENED_ITEM.title,
      triedAtLabel: "2:20",
    })
      .slice(0, -AT_REST_FORWARD_LINE.length)
      .trim();
    expect(leadText()).toBe(expected);
    expect(screen.getByTestId("things-that-might-help").textContent).not.toContain("Tense");
  });

  it("still accepts a re-phrasing that stays inside what was tried", async () => {
    const legal = `${OPENED_ITEM.title} was what you reached for at 2:20 today.`;
    const h = harness({
      bands: CALM_DAY,
      picks: [pickRow()],
      result: { ok: true, text: legal },
    });
    await mount(h.deps);

    expect(cardState()).toBe("9");
    expect(leadText()).toBe(legal);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// The day boundary (FR-019 — free, via the fingerprint)
// ─────────────────────────────────────────────────────────────────────────────

describe("the local day boundary", () => {
  it("regenerates on a new day rather than reusing yesterday's sentence", async () => {
    const first = harness({ bands: CALM_DAY, result: { ok: true, text: VALID_REPHRASING } });
    await mount(first.deps);
    expect(leadText()).toBe(VALID_REPHRASING);
    cleanup();

    const tomorrow = CALM_DAY.map((r) => ({ ...r, atMs: r.atMs + 24 * 60 * 60 * 1000 }));
    const next = harness({
      bands: tomorrow,
      now: NOW + 24 * 60 * 60 * 1000,
      result: { ok: false, reason: "unavailable" },
    });
    await mount(next.deps);

    expect(next.gen.calls).toBe(1); // a new key — yesterday's entry cannot answer for today
    expect(leadText()).toBe(CALM_LEAD);
  });
});
