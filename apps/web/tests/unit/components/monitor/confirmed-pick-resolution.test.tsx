import { act, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

import type { MinimalWindowRecorder } from "@/components/monitor/window-recorder";
import type { SubmitWindowResult } from "@/lib/api/monitoring-client";
import type { PickOutcome } from "@/lib/recommendations/engine";
import type { PickRow } from "@/lib/recommendations/episode";
import { RECOMMENDATION_LIBRARY } from "@/lib/recommendations/library";
import type { TodayBandReading } from "@/lib/recommendations/recommendation-reads";

/**
 * Feature 014 / US2 — T018: the HOST wiring that turns "Yes, that's me" into a pick.
 *
 * Why this file exists at all: the 012 confirmatory path has unit coverage at the hook level
 * and none at the host level, and the plan names host-wiring races as this feature's residual
 * risk (Risk 1). Everything below therefore drives the REAL `MonitoringSession` — real state
 * machine, real trigger, real reducers — and fakes only the network seams. Nothing here
 * reaches into the resolution logic directly; if the wiring is wrong, these fail.
 *
 * ── How the clock is driven ──────────────────────────────────────────────────────────
 * `useConfirmatoryTrigger` reads `Date.now()` for its sustained-tense floor. Vitest fake
 * timers would also capture the monitor's own intervals (elapsed clock, strides, warm-up) and
 * make this suite about timer bookkeeping instead of about resolution. So the clock is moved
 * with `vi.spyOn(Date, "now")` and the strides are fired by hand — real timers throughout.
 */

vi.mock("@/lib/face-detect/use-framing-guide", () => ({
  useFramingGuide: () => ({ guide: "unavailable", gate: "ready", ready: true, drift: "centred" }),
}));

// happy-dom carries no stylesheet and the Notification surface reads useMediaQuery; pin it to
// the desktop / full-motion branch so the card's DOM is stable.
vi.mock("@/hooks/use-media-query", () => ({ useMediaQuery: () => false }));

// The 012 prompt lifecycle is a network write. Stub it so a prompt can actually become
// visible — without this `createPrompt` resolves null and `handleShow` bails, which is why the
// host path has never been reachable in a unit test before.
const promptCalls: Array<{ kind: string }> = [];
const answeredCalls: Array<{ promptId: string; outcome: string }> = [];
vi.mock("@/lib/api/questionnaire-client", () => ({
  createConfirmatoryPrompt: vi.fn(async (input: { kind: string }) => {
    promptCalls.push({ kind: input.kind });
    return { ok: true as const, data: { id: `prompt-${promptCalls.length}` } };
  }),
  resolveConfirmatoryAnswered: vi.fn(async (promptId: string, outcome: string) => {
    answeredCalls.push({ promptId, outcome });
    return { ok: true as const };
  }),
  resolveConfirmatoryExpired: vi.fn(async () => ({ ok: true as const })),
}));

import { MonitoringSession, type MonitoringDeps } from "@/components/monitor/monitoring-session";

beforeAll(() => {
  Object.defineProperty(HTMLMediaElement.prototype, "srcObject", {
    configurable: true,
    get() {
      return null;
    },
    set() {},
  });
  Object.defineProperty(HTMLMediaElement.prototype, "play", {
    configurable: true,
    writable: true,
    value: () => Promise.resolve(),
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Fixtures
// ─────────────────────────────────────────────────────────────────────────────

/** A JWT whose `sub` is the owner id the host reads locally (no round-trip). */
const TOKEN = `x.${btoa(JSON.stringify({ sub: "user-1" })).replace(/=+$/, "")}.y`;

const DAY_START = new Date(2026, 7, 18, 9, 0, 0).getTime();
const LOCAL_DAY = "2026-08-18";

/** The engine's deterministic choice for an afternoon `a_little_tense`/`tense` day. */
const ITEM = RECOMMENDATION_LIBRARY[0]!;

const band = (atMs: number, b: TodayBandReading["band"] = "tense"): TodayBandReading => ({
  band: b,
  atMs,
  sessionId: "s1",
});

function pickRow(over: Partial<PickRow> = {}): PickRow {
  const itemId = over.itemId ?? ITEM.id;
  const entry = RECOMMENDATION_LIBRARY.find((i) => i.id === itemId)!;
  return {
    id: "pick-existing",
    localDay: LOCAL_DAY,
    episodeId: "episode-existing",
    itemId,
    category: entry.category,
    source: "reading",
    suggestedAtMs: DAY_START,
    confirmedAtMs: null,
    openedAtMs: null,
    outcome: null,
    outcomeAtMs: null,
    swappedAwayAtMs: null,
    ...over,
  };
}

interface Harness {
  deps: Partial<MonitoringDeps>;
  rows: PickRow[];
  calls: {
    inserted: Array<{ itemId: string; source: string; episodeId: string }>;
    attached: string[];
    opened: string[];
    outcomes: Array<{ pickId: string; outcome: PickOutcome }>;
    navigated: string[];
    reads: number;
  };
  fireStride: () => void;
  setClock: (ms: number) => void;
  setBand: (b: "tense" | "a_little_tense") => void;
  release?: () => void;
}

function harness(options: {
  picks?: PickRow[];
  bands?: TodayBandReading[];
  failInsert?: boolean;
  failRead?: boolean;
  /** Hold the FIRST read open so a same-flush double invoke can be exercised. */
  gateFirstRead?: boolean;
  /** `a_little_tense` drives #134's MILD trigger, whose answer leaves the tense budget open. */
  startBand?: "tense" | "a_little_tense";
} = {}): Harness {
  const rows: PickRow[] = [...(options.picks ?? [])];
  const bands = options.bands ?? [band(DAY_START + 60_000)];
  const calls: Harness["calls"] = {
    inserted: [],
    attached: [],
    opened: [],
    outcomes: [],
    navigated: [],
    reads: 0,
  };

  let clock = DAY_START;
  /** The band every scored window reports — switched to drive a mild-then-tense session. */
  let liveBand: "tense" | "a_little_tense" = options.startBand ?? "tense";
  const nowSpy = vi.spyOn(Date, "now").mockImplementation(() => clock);

  let rec: MinimalWindowRecorder | null = null;
  let insertSeq = 0;
  let releaseFirstRead: (() => void) | null = null;
  const firstReadGate = options.gateFirstRead
    ? new Promise<void>((resolve) => {
        releaseFirstRead = resolve;
      })
    : null;
  let gateArmed = options.gateFirstRead === true;

  const deps: Partial<MonitoringDeps> = {
    isSecureContext: () => true,
    getUserMedia: vi.fn(
      async () => ({ getTracks: () => [{ stop: () => {} }] }) as unknown as MediaStream,
    ),
    getSession: vi.fn(async () => ({ accessToken: TOKEN })),
    createSession: vi.fn(async () => ({ ok: true, sessionId: "sid", modelVersion: "m" }) as const),
    submitWindow: vi.fn(
      async (): Promise<SubmitWindowResult> => ({
        ok: true,
        outcome: {
          outcome: "reading",
          band: liveBand,
          capturedAt: new Date(clock).toISOString(),
        },
      }),
    ),
    createRecorder: () => {
      rec = {
        state: "inactive",
        mimeType: "video/webm",
        ondataavailable: null,
        onstop: null,
        start() {
          this.state = "recording";
        },
        stop() {
          this.state = "inactive";
        },
      };
      return rec;
    },
    createDetector: async () => null,
    strideMs: 10_000,
    sessionTrendLoad: async () => [],
    navigate: (path) => calls.navigated.push(path),

    // ── 014 seams ────────────────────────────────────────────────────────────────────
    now: () => clock,
    newId: () => `episode-new-${insertSeq + 1}`,
    loadTodayPicks: async () => {
      calls.reads += 1;
      if (gateArmed && firstReadGate) {
        gateArmed = false;
        await firstReadGate;
      }
      if (options.failRead) throw new Error("read failed");
      return rows.map((r) => ({ ...r }));
    },
    loadTodayBands: async () => bands.map((b) => ({ ...b })),
    surfacePick: async (input) => {
      const entry = RECOMMENDATION_LIBRARY.find((i) => i.id === input.itemId);
      if (!entry) return { ok: false, reason: "unknown_item" };
      calls.inserted.push({
        itemId: input.itemId,
        source: input.source,
        episodeId: input.episodeId,
      });
      if (options.failInsert) return { ok: false, reason: "write_failed" };
      insertSeq += 1;
      rows.push(
        pickRow({
          id: `pick-new-${insertSeq}`,
          itemId: input.itemId,
          episodeId: input.episodeId,
          source: input.source,
          suggestedAtMs: clock,
        }),
      );
      return {
        ok: true,
        row: {
          user_id: input.userId,
          local_day: input.localDay,
          episode_id: input.episodeId,
          item_id: entry.id,
          category: entry.category,
          source: input.source,
        },
      };
    },
    attachConfirmation: async (pickId) => {
      calls.attached.push(pickId);
      const row = rows.find((r) => r.id === pickId);
      if (row) row.confirmedAtMs = clock;
      return { ok: true };
    },
    recordOpened: async (pick) => {
      if (pick.openedAtMs !== null) return { ok: true, wrote: false };
      calls.opened.push(pick.id);
      const row = rows.find((r) => r.id === pick.id);
      if (row) row.openedAtMs = clock;
      return { ok: true, wrote: true };
    },
    recordOutcome: async (pickId, outcome) => {
      calls.outcomes.push({ pickId, outcome });
      return { ok: true, attempts: 1 };
    },
  };

  return {
    deps,
    rows,
    calls,
    fireStride: () => rec?.ondataavailable?.({ data: new Blob(["x"]) } as BlobEvent),
    setClock: (ms) => {
      clock = ms;
      nowSpy.mockImplementation(() => clock);
    },
    setBand: (b) => {
      liveBand = b;
    },
    release: releaseFirstRead ?? undefined,
  } as Harness;
}

/** Let the promise chains inside the host settle without ever calling `waitFor`. */
async function settle(rounds = 14) {
  for (let i = 0; i < rounds; i += 1) {
    await act(async () => {
      await Promise.resolve();
    });
  }
}

/**
 * Start the session and drive 20 s of sustained tense so the real trigger shows the real
 * prompt — the only way to reach `resolveToRecommendation` through the host.
 */
async function driveToPrompt(h: Harness) {
  render(<MonitoringSession deps={h.deps} />);
  await act(async () => {
    fireEvent.click(screen.getByRole("button", { name: /allow camera access/i }));
  });
  await settle();

  await act(async () => {
    h.fireStride();
  });
  await settle();

  h.setClock(DAY_START + 20_000);
  await act(async () => {
    h.fireStride();
  });
  await settle();

  expect(screen.getByText("Checking in")).toBeInTheDocument();
}

async function confirm() {
  await act(async () => {
    fireEvent.click(screen.getByRole("button", { name: /yes, that's me/i }));
  });
  await settle();
}

afterEach(() => {
  vi.restoreAllMocks();
  promptCalls.length = 0;
  answeredCalls.length = 0;
});

beforeEach(() => {
  promptCalls.length = 0;
  answeredCalls.length = 0;
});

// ─────────────────────────────────────────────────────────────────────────────

describe("T018 — attach vs insert (Ruling C)", () => {
  it("ATTACHES to today's active pick — updates confirmed_at, never a second row", async () => {
    const h = harness({ picks: [pickRow()] });
    await driveToPrompt(h);

    await confirm();

    expect(h.calls.attached).toEqual(["pick-existing"]);
    expect(h.calls.inserted).toEqual([]);
    expect(h.rows).toHaveLength(1);
    expect(h.rows[0]!.confirmedAtMs).not.toBeNull();
  });

  it("attaching keeps the SAME episode and spends no budget", async () => {
    const h = harness({ picks: [pickRow({ episodeId: "episode-existing" })] });
    await driveToPrompt(h);

    await confirm();

    expect(h.rows[0]!.episodeId).toBe("episode-existing");
    expect(h.rows).toHaveLength(1);
  });

  it("INSERTS with source='confirmed' when today has no active pick", async () => {
    const h = harness({ picks: [] });
    await driveToPrompt(h);

    await confirm();

    expect(h.calls.inserted).toHaveLength(1);
    expect(h.calls.inserted[0]!.source).toBe("confirmed");
    // The stamp is a second write, because the INSERT surface carries identity + provenance
    // only — the end state is the contract's row either way.
    expect(h.calls.attached).toHaveLength(1);
    expect(h.rows[0]!.confirmedAtMs).not.toBeNull();
  });

  it("starts a NEW episode when the prior one closed on an outcome", async () => {
    const closed = pickRow({
      id: "pick-closed",
      episodeId: "episode-closed",
      openedAtMs: DAY_START + 10_000,
      outcome: "helped",
      outcomeAtMs: DAY_START + 20_000,
    });
    const h = harness({ picks: [closed] });
    await driveToPrompt(h);

    await confirm();

    expect(h.calls.inserted).toHaveLength(1);
    expect(h.calls.inserted[0]!.episodeId).not.toBe("episode-closed");
  });

  it("CONTINUES the open episode when a pick was swapped away and no replacement landed", async () => {
    const swept = pickRow({
      id: "pick-swapped",
      episodeId: "episode-open",
      swappedAwayAtMs: DAY_START + 10_000,
    });
    const h = harness({ picks: [swept] });
    await driveToPrompt(h);

    await confirm();

    expect(h.calls.inserted).toHaveLength(1);
    expect(h.calls.inserted[0]!.episodeId).toBe("episode-open");
  });
});

describe("T018 — idempotence under a same-flush double invoke", () => {
  /**
   * A GENUINE double-press, not a simulated one. The answered prompt stays mounted through
   * the primitive's exit transition, so the button is still clickable for a moment after the
   * first press — which is exactly the window T016 identified. Both clicks land in one `act`,
   * so the second `resolveToRecommendation` runs while the first is still awaiting its read.
   */
  it("two presses in ONE flush produce one insert and one row", async () => {
    const h = harness({ picks: [], gateFirstRead: true });
    await driveToPrompt(h);

    await act(async () => {
      const yes = screen.getByRole("button", { name: /yes, that's me/i });
      fireEvent.click(yes);
      fireEvent.click(yes);
    });
    // Release the held first read; both invocations are now past their entry point.
    await act(async () => {
      h.release?.();
      await Promise.resolve();
    });
    await settle();

    expect(h.calls.inserted).toHaveLength(1);
    expect(h.rows).toHaveLength(1);
    expect(h.calls.attached).toHaveLength(1);
  });

  it("two presses in one flush ATTACH once, never twice", async () => {
    const h = harness({ picks: [pickRow()], gateFirstRead: true });
    await driveToPrompt(h);

    await act(async () => {
      const yes = screen.getByRole("button", { name: /yes, that's me/i });
      fireEvent.click(yes);
      fireEvent.click(yes);
    });
    await act(async () => {
      h.release?.();
      await Promise.resolve();
    });
    await settle();

    expect(h.calls.attached).toEqual(["pick-existing"]);
    expect(h.calls.inserted).toEqual([]);
    expect(h.rows).toHaveLength(1);
  });
});

describe("T018 — the card, the slot, and no navigation", () => {
  it("mounts ConfirmedPickCard in place, with the pick's words", async () => {
    const h = harness({ picks: [pickRow()] });
    await driveToPrompt(h);

    await confirm();

    expect(screen.getByTestId("confirmed-pick-card")).toBeInTheDocument();
    expect(screen.getByTestId("pick-item-title")).toHaveTextContent(ITEM.title);
    expect(screen.getByTestId("pick-item")).toHaveAttribute("data-prominent", "true");
  });

  it("does NOT navigate — FR-011, and the confirmatory_yes handoff is gone", async () => {
    const h = harness({ picks: [pickRow()] });
    await driveToPrompt(h);

    await confirm();

    expect(h.calls.navigated).toEqual([]);
    expect(screen.getByTestId("confirmed-pick-card")).toBeInTheDocument();
  });

  /**
   * Slot exclusivity, stated precisely rather than loosely.
   *
   * The two surfaces are never CONTROLLED open together — the card's `open` prop is
   * `!confirmatory.visible`, so the state that drives them is mutually exclusive by
   * construction. What the DOM shows for ~200 ms afterwards is the shared `Notification`
   * primitive's exit transition: `AnimatePresence` keeps the answered prompt mounted while it
   * fades. That is the same crossfade every Notification consumer gets, and in production the
   * resolution takes several network round trips, so the prompt has long since left before the
   * card arrives. The test asserts both halves: the card is up, and once the transition
   * finishes the prompt is genuinely gone — they do not persist together.
   */
  it("prompt and card never occupy the slot at the same time", async () => {
    const h = harness({ picks: [pickRow()] });
    await driveToPrompt(h);
    expect(screen.getByText("Checking in")).toBeInTheDocument();
    expect(screen.queryByTestId("confirmed-pick-card")).toBeNull();

    await confirm();

    expect(screen.getByTestId("confirmed-pick-card")).toBeInTheDocument();
    // Let the primitive's exit transition finish (real timers throughout this suite).
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 400));
    });
    expect(screen.queryByText("Checking in")).toBeNull();
    expect(screen.getByTestId("confirmed-pick-card")).toBeInTheDocument();
  });

  it("records the answer as answered/confirmed exactly once", async () => {
    const h = harness({ picks: [pickRow()] });
    await driveToPrompt(h);

    await confirm();

    expect(answeredCalls).toEqual([{ promptId: "prompt-1", outcome: "confirmed" }]);
  });

  it("dismissing the card writes nothing", async () => {
    const h = harness({ picks: [pickRow()] });
    await driveToPrompt(h);
    await confirm();

    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Dismiss" }));
    });
    await settle();

    expect(screen.queryByTestId("confirmed-pick-card")).toBeNull();
    expect(h.calls.outcomes).toEqual([]);
    expect(h.calls.opened).toEqual([]);
  });

  it("wires the open-write and the outcome-write to the client", async () => {
    const h = harness({ picks: [pickRow()] });
    await driveToPrompt(h);
    await confirm();

    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: /show me/i }));
    });
    await settle();
    expect(h.calls.opened).toEqual(["pick-existing"]);

    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: /close/i }));
    });
    await settle();
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Yes" }));
    });
    await settle();

    expect(h.calls.outcomes).toEqual([{ pickId: "pick-existing", outcome: "helped" }]);
  });
});

describe("T018 — FR-014: a new confirmed detection discards a pending outcome question", () => {
  /**
   * Reaching a SECOND confirmation in one session is only possible via the mild trigger
   * first: #134's tense-senior budget means a tense answer burns both budgets, so a
   * tense-first session can never prompt again. So this drives 60 s of `a_little_tense` (the
   * MILD prompt, which spends only the mild budget), answers it, walks the card to its
   * pending outcome question, and only then drives 20 s of sustained `tense` for the second
   * prompt. Without that ordering the scenario is unreachable and the test would be vacuous.
   */
  it("removes the stale question WITHOUT writing an outcome, and attaches", async () => {
    const h = harness({ picks: [pickRow()], startBand: "a_little_tense" });

    render(<MonitoringSession deps={h.deps} />);
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: /allow camera access/i }));
    });
    await settle();

    // 60 s of sustained a_little_tense → the MILD prompt.
    await act(async () => {
      h.fireStride();
    });
    await settle();
    h.setClock(DAY_START + 60_000);
    await act(async () => {
      h.fireStride();
    });
    await settle();
    expect(screen.getByText("Checking in")).toBeInTheDocument();
    expect(promptCalls[0]!.kind).toBe("mild");

    await confirm();
    expect(h.calls.attached).toEqual(["pick-existing"]);

    // Walk the card to its pending outcome question.
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: /show me/i }));
    });
    await settle();
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: /close/i }));
    });
    await settle();
    expect(screen.getByTestId("outcome-prompt")).toBeInTheDocument();

    // A NEW confirmed detection arrives while that question is pending — 20 s sustained tense.
    h.setBand("tense");
    h.setClock(DAY_START + 200_000);
    await act(async () => {
      h.fireStride();
    });
    await settle();
    h.setClock(DAY_START + 220_000);
    await act(async () => {
      h.fireStride();
    });
    await settle();

    // The scenario must actually be reachable — a silent skip here would make this vacuous.
    expect(screen.getByText("Checking in")).toBeInTheDocument();
    expect(promptCalls[1]!.kind).toBe("tense");

    await confirm();

    // The stale question is gone because the card remounted — and nothing was recorded.
    expect(screen.queryByTestId("outcome-prompt")).toBeNull();
    expect(h.calls.outcomes).toEqual([]);
    // The row is still active, so it ATTACHES — never a second row (Ruling C).
    expect(h.calls.inserted).toEqual([]);
    expect(h.rows).toHaveLength(1);
    expect(h.calls.attached).toEqual(["pick-existing", "pick-existing"]);
    // The card is still on screen — the person is not left with nothing.
    expect(screen.getByTestId("confirmed-pick-card")).toBeInTheDocument();
  });
});

describe("T018 — errors are swallowed (FR-030)", () => {
  it("a thrown read renders no error and no card", async () => {
    const h = harness({ picks: [pickRow()], failRead: true });
    await driveToPrompt(h);

    await confirm();

    expect(screen.queryByTestId("confirmed-pick-card")).toBeNull();
    expect(screen.queryByRole("alert")).toBeNull();
    const text = document.body.textContent ?? "";
    expect(text).not.toMatch(/error|failed|something went wrong|try again/i);
  });

  it("a failed INSERT renders no error and no card", async () => {
    const h = harness({ picks: [], failInsert: true });
    await driveToPrompt(h);

    await confirm();

    expect(h.calls.inserted).toHaveLength(1);
    expect(screen.queryByTestId("confirmed-pick-card")).toBeNull();
    expect(screen.queryByRole("alert")).toBeNull();
  });

  it("still records the confirmatory answer even when the resolution fails", async () => {
    const h = harness({ picks: [pickRow()], failRead: true });
    await driveToPrompt(h);

    await confirm();

    // The answer and the suggestion are separate concerns: 012's row is written regardless.
    expect(answeredCalls).toEqual([{ promptId: "prompt-1", outcome: "confirmed" }]);
  });
});
