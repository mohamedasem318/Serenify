import { cleanup, render, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  evaluateGate,
  initialGateDebounce,
  SET_DEBOUNCE_MS,
  toFramingSignal,
  type FaceBox,
  type GateDebounce,
  type GateVerdict,
} from "@/lib/face-detect/framing";

import { FramingOverlay } from "./framing-overlay";
import { GreenRoom } from "./green-room";

/**
 * Gate-clear timing invariant (green-room sync bug). The three affirmative signals
 * the user reads at the moment the soft gate clears MUST flip together:
 *   1. the helper line "You're all set"          (green-room.tsx)
 *   2. the enabled "I'm ready" button            (green-room.tsx)
 *   3. the meadow brackets + check on the preview (framing-overlay.tsx)
 *
 * The regression: the helper line keyed off the RAW per-frame verdict (`gate ===
 * "ready"`), while the button + brackets key off the CONFIRMED, debounced signal
 * (`ready`, held for SET_DEBOUNCE_MS). So the line said "all set" up to ~500 ms
 * before the button enabled and the brackets affirmed.
 *
 * This drives SYNTHETIC detector frames through the REAL gate/debounce logic
 * (`toFramingSignal` + `evaluateGate` — not mocked green) to produce the live
 * (verdict, ready) timeline, then renders the REAL components wired EXACTLY as the
 * orchestrator does in the steady green room (guide "active", healthGate "ok"), and
 * asserts all three transition at the one confirmed boundary.
 */

function mockMatchMedia(matches: boolean) {
  window.matchMedia = vi.fn().mockImplementation((query: string) => ({
    matches,
    media: query,
    onchange: null,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    addListener: vi.fn(),
    removeListener: vi.fn(),
    dispatchEvent: vi.fn(),
  }));
}

beforeEach(() => mockMatchMedia(false));
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

// A well-framed, well-lit, confident synthetic detection (dead-centre).
const GOOD_BOX: FaceBox = { cx: 0.5, cy: 0.5, w: 0.3, h: 0.5, score: 0.9 };
const LIT = 200; // luma well above LUMA_MIN

/** Run the REAL soft gate + debounce over a timeline of good detector frames. */
function runGoodTimeline(times: number[]): { at: number; verdict: GateVerdict; ready: boolean }[] {
  let deb: GateDebounce = initialGateDebounce;
  return times.map((at) => {
    const r = evaluateGate(toFramingSignal(GOOD_BOX, LIT, at), deb);
    deb = r.next;
    return { at, verdict: r.verdict, ready: r.ready };
  });
}

/**
 * Derive the three production UI signals from a single gate frame, wiring them as
 * the orchestrator does (steady green room: guide "active", healthGate "ok" — so the
 * bracket affirmative `guide === "active" && ready && healthGate !== "down"` and the
 * "I'm ready" `ready` prop both reduce to `ready`). GreenRoom and FramingOverlay
 * render in SEPARATE trees so the meadow check (`.bg-meadow`) can't be confused with
 * the meadow-variant button (which also carries `bg-meadow`).
 */
function deriveUi({ verdict, ready }: { verdict: GateVerdict; ready: boolean }) {
  const affirmed = ready; // orchestrator: guide active && ready && healthGate !== "down"

  const room = render(
    <GreenRoom guide="active" gate={verdict} ready={ready} onReady={() => {}} onNotNow={() => {}} />,
  );
  const allSet = within(room.container).queryByText(/you.re all set/i) !== null;
  const button = within(room.container).getByRole("button", { name: /i.m ready/i }) as HTMLButtonElement;
  const buttonEnabled = !button.disabled;
  room.unmount();

  const overlay = render(<FramingOverlay drift="centred" showNudge={false} gateReady={affirmed} />);
  const meadowCheck = overlay.container.querySelector(".bg-meadow") !== null;
  overlay.unmount();

  return { allSet, buttonEnabled, meadowCheck };
}

describe("green-room gate-clear sync (helper text never leads the button / brackets)", () => {
  it("flips 'You're all set' + 'I'm ready' + meadow check together at the confirmed boundary", () => {
    // Good frames straddling SET_DEBOUNCE_MS: the verdict is "ready" from frame 0,
    // but `ready` (confirmed) only at/after the debounce.
    const timeline = runGoodTimeline([
      0,
      140,
      280,
      420,
      SET_DEBOUNCE_MS, // confirmed boundary
      SET_DEBOUNCE_MS + 140,
    ]);

    // Guard: the real gate gives a genuine lead window (verdict ready before ready),
    // otherwise this test would be vacuously green.
    expect(timeline.some((f) => f.verdict === "ready" && !f.ready)).toBe(true);
    expect(timeline.some((f) => f.ready)).toBe(true);

    for (const frame of timeline) {
      const { allSet, buttonEnabled, meadowCheck } = deriveUi(frame);

      // The invariant: the affirmative line must NEVER lead the button or the
      // brackets — all three equal the one confirmed signal, frame by frame.
      expect(
        { at: frame.at, allSet, buttonEnabled, meadowCheck },
        `frame@${frame.at}ms (verdict=${frame.verdict}, ready=${frame.ready})`,
      ).toEqual({ at: frame.at, allSet: frame.ready, buttonEnabled: frame.ready, meadowCheck: frame.ready });
    }
  });

  it("during the held-but-unconfirmed window shows a calm hold, not the affirmative", () => {
    // The first good frame: verdict "ready", but not yet confirmed.
    const firstGood = runGoodTimeline([0])[0]!;
    expect(firstGood).toMatchObject({ verdict: "ready", ready: false });

    render(
      <GreenRoom guide="active" gate={firstGood.verdict} ready={firstGood.ready} onReady={() => {}} onNotNow={() => {}} />,
    );
    expect(screen.queryByText(/you.re all set/i)).toBeNull();
    expect(screen.getByRole("button", { name: /i.m ready/i })).toBeDisabled();
  });

  it("detector-unavailable: ready WITHOUT a confirmed-set signal, and no 'all set' affirmative", () => {
    // No detector ⇒ guide "unavailable", gate bypassed (ready=true). Readiness must
    // NOT hinge on a confirmed gate-set that never fires here, and there is no
    // affirmative (we don't claim "set" for a frame we can't see — FR-011).
    const room = render(
      <GreenRoom guide="unavailable" gate="ready" ready onReady={() => {}} onNotNow={() => {}} />,
    );
    expect(screen.getByRole("button", { name: /i.m ready/i })).toBeEnabled();
    expect(screen.getByText(/no live guide — you can still record/i)).toBeInTheDocument();
    expect(screen.queryByText(/you.re all set/i)).toBeNull();

    // And the orchestrator's bracket affirmative stays off for the bypass (guide is
    // not "active"), so no meadow check rides the unavailable readiness.
    const overlay = render(<FramingOverlay drift="centred" showNudge={false} gateReady={false} />);
    expect(overlay.container.querySelector(".bg-meadow")).toBeNull();
    overlay.unmount();
    room.unmount();
  });
});
