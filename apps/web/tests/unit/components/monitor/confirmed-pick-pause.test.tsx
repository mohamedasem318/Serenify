import { act, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

import type { MinimalWindowRecorder } from "@/components/monitor/window-recorder";
import type { SessionStatus, SubmitWindowResult } from "@/lib/api/monitoring-client";
import type { PickOutcome } from "@/lib/recommendations/engine";
import type { PickRow } from "@/lib/recommendations/episode";
import { RECOMMENDATION_LIBRARY } from "@/lib/recommendations/library";
import type { TodayBandReading } from "@/lib/recommendations/recommendation-reads";

/**
 * Feature 014 / US2 — T036: the pause/resume control on `ConfirmedPickCard`, at HOST level.
 *
 * Sibling to `confirmed-pick-resolution.test.tsx` (T018), which owns the resolution wiring;
 * this file owns the ONE thing T036 adds — a second entry point to feature 008's shipped
 * pause/resume — and the single claim that makes it safe: **pausing is not an answer.**
 * The card sits inside the 012 confirmatory flow, one DOM node away from the machinery that
 * spends the shared three-pick budget, so "this button writes nothing" cannot be argued from
 * the component in isolation. It is asserted here, through the real host, real reducers, real
 * trigger — the same harness shape T018 uses, duplicated rather than extracted because the
 * T018 suite is pinned and must stay byte-unchanged.
 *
 * What "writes nothing" means concretely, and how each is observed:
 *   • no `finalize`      → `resolveConfirmatoryAnswered` / `…Expired` are never called again
 *                          (the trigger's ONLY network effects — `finalize` is module-private);
 *   • no `openRen`       → `deps.navigate` is never called (openRen is a navigate to /app/chat);
 *   • no outcome write   → `recordOutcome` is never called;
 *   • no budget spend    → `surfacePick` is never called (the budget is only ever spent by an
 *                          insert), and no re-confirm via `attachConfirmation`;
 *   • no false-alarm suppression → suppression rides on a `false_alarm` finalize, which is the
 *                          first bullet: the answered log stays exactly `["confirmed"]`.
 * The only side effect a pause may have is feature 008's own `patchStatus`.
 *
 * ── The T037 consequence (warm-up honesty) ──────────────────────────────────────────
 * The server now drops the session's smoothing buffer on `status='paused'`, so every resume
 * honestly re-climbs cold-start (~90-105 s) instead of banding 3/4 pre-pause video. The last
 * test pins what the person sees across that: the stage returns to the warm-up copy and the
 * pre-pause band is gone from the live surface. That already holds by existing design —
 * `liveDisplay` keys off `op`, and `op` is `warming-up` after a RESUME — and this test is what
 * keeps it holding, since `state.band` still carries the pre-pause value at that moment.
 */

vi.mock("@/lib/face-detect/use-framing-guide", () => ({
  useFramingGuide: () => ({ guide: "unavailable", gate: "ready", ready: true, drift: "centred" }),
}));

// happy-dom carries no stylesheet and the Notification surface reads useMediaQuery; pin it to
// the desktop / full-motion branch so the card's DOM is stable.
vi.mock("@/hooks/use-media-query", () => ({ useMediaQuery: () => false }));

const promptCalls: Array<{ kind: string }> = [];
const answeredCalls: Array<{ promptId: string; outcome: string }> = [];
const expiredCalls: string[] = [];
vi.mock("@/lib/api/questionnaire-client", () => ({
  createConfirmatoryPrompt: vi.fn(async (input: { kind: string }) => {
    promptCalls.push({ kind: input.kind });
    return { ok: true as const, data: { id: `prompt-${promptCalls.length}` } };
  }),
  resolveConfirmatoryAnswered: vi.fn(async (promptId: string, outcome: string) => {
    answeredCalls.push({ promptId, outcome });
    return { ok: true as const };
  }),
  resolveConfirmatoryExpired: vi.fn(async (promptId: string) => {
    expiredCalls.push(promptId);
    return { ok: true as const };
  }),
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
// Fixtures — the T018 harness shape plus a `patchStatus` spy (the one write a
// pause IS allowed to make).
// ─────────────────────────────────────────────────────────────────────────────

const TOKEN = `x.${btoa(JSON.stringify({ sub: "user-1" })).replace(/=+$/, "")}.y`;
const DAY_START = new Date(2026, 7, 18, 9, 0, 0).getTime();
const LOCAL_DAY = "2026-08-18";
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
    patched: SessionStatus[];
  };
  fireStride: () => void;
  setClock: (ms: number) => void;
}

function harness(): Harness {
  const rows: PickRow[] = [];
  const bands = [band(DAY_START + 60_000)];
  const calls: Harness["calls"] = {
    inserted: [],
    attached: [],
    opened: [],
    outcomes: [],
    navigated: [],
    patched: [],
  };

  let clock = DAY_START;
  const nowSpy = vi.spyOn(Date, "now").mockImplementation(() => clock);

  let rec: MinimalWindowRecorder | null = null;
  let insertSeq = 0;

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
        outcome: { outcome: "reading", band: "tense", capturedAt: new Date(clock).toISOString() },
      }),
    ),
    patchStatus: vi.fn(async (_sessionId: string, status: SessionStatus) => {
      calls.patched.push(status);
      return { ok: true };
    }),
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

    now: () => clock,
    newId: () => `episode-new-${insertSeq + 1}`,
    loadTodayPicks: async () => rows.map((r) => ({ ...r })),
    loadTodayBands: async () => bands.map((b) => ({ ...b })),
    surfacePick: async (input) => {
      const entry = RECOMMENDATION_LIBRARY.find((i) => i.id === input.itemId);
      if (!entry) return { ok: false, reason: "unknown_item" };
      calls.inserted.push({
        itemId: input.itemId,
        source: input.source,
        episodeId: input.episodeId,
      });
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

/** Start the session, drive 20 s of sustained tense, answer "Yes, that's me" → the card. */
async function driveToConfirmedPick(h: Harness) {
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

  await act(async () => {
    fireEvent.click(screen.getByRole("button", { name: /yes, that's me/i }));
  });
  await settle();

  expect(screen.getByTestId("confirmed-pick-card")).toBeInTheDocument();
}

const card = () => screen.getByTestId("confirmed-pick-card");
const sessionControl = () => screen.getByTestId("session-pause");

async function clickSessionControl() {
  await act(async () => {
    fireEvent.click(sessionControl());
  });
  await settle();
}

/** The confirmatory machinery, frozen the moment the card appears. */
function machinerySnapshot(h: Harness) {
  return JSON.stringify({
    answered: answeredCalls,
    expired: expiredCalls,
    navigated: h.calls.navigated,
    outcomes: h.calls.outcomes,
    inserted: h.calls.inserted,
    attached: h.calls.attached,
  });
}

afterEach(() => {
  vi.restoreAllMocks();
  promptCalls.length = 0;
  answeredCalls.length = 0;
  expiredCalls.length = 0;
});

beforeEach(() => {
  promptCalls.length = 0;
  answeredCalls.length = 0;
  expiredCalls.length = 0;
});

// ─────────────────────────────────────────────────────────────────────────────
// Pausing is not an answer
// ─────────────────────────────────────────────────────────────────────────────

describe("T036 — pause/resume from the confirmed pick card", () => {
  it("pausing writes nothing to the confirmatory machinery — no finalize, no openRen, no outcome, no budget spend", async () => {
    const h = harness();
    await driveToConfirmedPick(h);

    // The confirm itself is the ONE finalize this flow is allowed; freeze everything here.
    expect(answeredCalls).toEqual([{ promptId: "prompt-1", outcome: "confirmed" }]);
    const before = machinerySnapshot(h);

    await clickSessionControl();

    expect(machinerySnapshot(h)).toBe(before);
    // Spelled out, so a failure names the thing that broke rather than a diff of one blob:
    expect(answeredCalls).toEqual([{ promptId: "prompt-1", outcome: "confirmed" }]); // no finalize
    expect(expiredCalls).toEqual([]); // and no expiry finalize either
    expect(h.calls.navigated).toEqual([]); // no openRen handoff to Ren
    expect(h.calls.outcomes).toEqual([]); // no outcome write
    expect(h.calls.inserted).toHaveLength(1); // the confirmed pick only — no second spend
    expect(h.calls.attached).toEqual(["pick-new-1"]); // no re-confirm
  });

  it("pausing routes ONLY to feature 008's own pause — patchStatus('paused')", async () => {
    const h = harness();
    await driveToConfirmedPick(h);
    const patchesBefore = [...h.calls.patched];

    await clickSessionControl();

    expect(h.calls.patched).toEqual([...patchesBefore, "paused"]);
  });

  it("the ONE control swaps to Resume while paused and back to Pause on resume", async () => {
    const h = harness();
    await driveToConfirmedPick(h);

    expect(sessionControl()).toHaveAttribute("data-paused", "false");
    expect(sessionControl()).toHaveTextContent("Pause");

    await clickSessionControl();
    expect(sessionControl()).toHaveAttribute("data-paused", "true");
    expect(sessionControl()).toHaveTextContent("Resume");

    await clickSessionControl();
    expect(sessionControl()).toHaveAttribute("data-paused", "false");
    expect(sessionControl()).toHaveTextContent("Pause");
    expect(h.calls.patched).toEqual(["paused", "active"]);
  });

  it("resuming from the card writes nothing to the confirmatory machinery either", async () => {
    const h = harness();
    await driveToConfirmedPick(h);
    const before = machinerySnapshot(h);

    await clickSessionControl(); // pause
    await clickSessionControl(); // resume

    expect(machinerySnapshot(h)).toBe(before);
  });

  it("the card contributes exactly ONE session control, and never a second Pause affordance", async () => {
    const h = harness();
    await driveToConfirmedPick(h);

    // Live: the card's Pause + the LiveStage's Pause are the only two in the document, and
    // exactly one of them is the card's.
    expect(within(card()).getAllByRole("button", { name: /^(pause|resume)$/i })).toHaveLength(1);

    await clickSessionControl(); // → paused

    // Paused: the card's control has become RESUME and stands beside PausedControls' Resume.
    // The claim T036 makes is about PAUSE — there must not be one anywhere while paused, or
    // the two surfaces would be offering opposite actions at the same time.
    expect(within(card()).getAllByRole("button", { name: /^(pause|resume)$/i })).toHaveLength(1);
    expect(within(card()).getByRole("button", { name: /^resume$/i })).toBeInTheDocument();
    expect(screen.queryAllByRole("button", { name: /^pause$/i })).toEqual([]);
    expect(screen.getAllByRole("button", { name: /^resume$/i })).toHaveLength(2); // card + stage
    expect(screen.getByText(/paused — taking a break/i)).toBeInTheDocument();
  });

  // ───────────────────────────────────────────────────────────────────────────
  // The T037 consequence: a resume must not present the pre-pause band as current
  // ───────────────────────────────────────────────────────────────────────────

  it("after a resume the stage shows the warm-up copy, not the pre-pause band", async () => {
    const h = harness();
    await driveToConfirmedPick(h);

    // A band is genuinely showing before the pause (the session drove sustained `tense`).
    expect(screen.getByText("Looking tense")).toBeInTheDocument();

    await clickSessionControl(); // pause
    await clickSessionControl(); // resume

    // The server dropped its smoothing buffer on the pause (apps/api T037), so no band is
    // owed until 4 fresh scored windows land. The surface must say so rather than re-paint
    // the pre-pause read — even though `state.band` still holds `tense` at this moment.
    expect(screen.getByText("Getting a read on things")).toBeInTheDocument();
    expect(screen.queryByText("Looking tense")).not.toBeInTheDocument();

    // And the card itself echoes no band at all, in either direction — it never has.
    expect(within(card()).queryByText(/looking (calm|uneasy|tense)/i)).toBeNull();
  });
});
