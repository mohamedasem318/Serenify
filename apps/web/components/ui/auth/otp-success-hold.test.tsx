import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, fireEvent, render, screen } from "@testing-library/react";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

/**
 * #190 — the verification tick has to HOLD, not dissolve.
 *
 * On a correct code the pill reads "✓ Verified" and then fades to opacity 0
 * before navigation. The tick vanishes because step 4 of the choreography
 * deliberately dissolves it, not because the timing is short. These tests pin
 * the corrected shape:
 *
 *   sweep 780 → pause 360 → merge 540 (pill at ~1680) → hold 560 → HOLD 700
 *   → router.replace at ~2940
 *
 * Same wall time, same handoff moment; the pill is simply opaque for ~1260ms
 * instead of dissolving through half of it. A muted note fades in beneath it at
 * ~2080ms, and a "Continue" escape hatch replaces that note 4s after
 * router.replace was called — a state that should never be reached on a healthy
 * flow.
 *
 * TIMERS: fake, driven with `advanceTimersByTimeAsync` inside `act`, never
 * RTL's `waitFor`. RTL's fake-timer detection keys off a `jest` global that
 * does not exist under Vitest, so `waitFor` would poll on real intervals while
 * the component's `await wait(ms)` chain sat frozen — a deadlock, not a flake.
 *
 * OPACITY IS ASSERTED BY CLASS, NOT BY `toBeVisible()`. jsdom loads no
 * stylesheet, so a Tailwind `opacity-0` computes to "" and jest-dom reads the
 * element as visible. Class inspection is the honest proxy here; the real
 * painted result is a Playwright concern (and #208 has the e2e suite down).
 */

const { replaceMock, refreshMock } = vi.hoisted(() => ({
  replaceMock: vi.fn(),
  refreshMock: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace: replaceMock, refresh: refreshMock }),
}));

const { useMediaQueryMock } = vi.hoisted(() => ({
  useMediaQueryMock: vi.fn<(query: string) => boolean>(),
}));

vi.mock("@/hooks/use-media-query", () => ({
  useMediaQuery: useMediaQueryMock,
}));

import { OtpPanel } from "@/components/ui/auth/otp-panel";

/** playSuccess() start → router.replace, full motion. */
const FULL_MOTION_MS = 2940;
/** playSuccess() start → the muted note's entrance, full motion. */
const NOTE_AT_MS = 2080;
/** playSuccess() start → router.replace, reduced motion. Must NOT grow. */
const REDUCED_MOTION_MS = 650;
/** router.replace → the "Continue" escape hatch. */
const STALL_MS = 4000;

function setReducedMotion(reduced: boolean) {
  useMediaQueryMock.mockImplementation(
    (query: string) => query === "(prefers-reduced-motion: reduce)" && reduced,
  );
}

/** <div wrapper> > <motion.div row> > <input> — the wrapper that used to fade. */
function boxesWrapper() {
  return screen.getByLabelText("Digit 1").parentElement!.parentElement!;
}

function typeCode(code: string) {
  [...code].forEach((digit, i) => {
    fireEvent.change(screen.getByLabelText(`Digit ${i + 1}`), {
      target: { value: digit },
    });
  });
}

/** Advance the clock, flushing the promise chain in playSuccess as we go. */
async function tick(ms: number) {
  await act(async () => {
    await vi.advanceTimersByTimeAsync(ms);
  });
}

function renderSignup() {
  return render(
    <OtpPanel
      email="new@example.com"
      action={vi.fn().mockResolvedValue({ status: "ok" })}
      successHref="/app"
      successNote="Taking you in…"
      helperText="x"
    />,
  );
}

beforeEach(() => {
  vi.useFakeTimers();
  replaceMock.mockReset();
  refreshMock.mockReset();
  useMediaQueryMock.mockReset();
  setReducedMotion(false);
  localStorage.clear();
});

afterEach(() => {
  vi.useRealTimers();
  localStorage.clear();
});

describe("#190 — the pill holds instead of fading", () => {
  it("is still on screen and fully opaque at the moment navigation fires", async () => {
    renderSignup();
    typeCode("123456");
    await tick(FULL_MOTION_MS);

    expect(replaceMock).toHaveBeenCalledWith("/app");
    // The tick is the whole point: it must survive to the handoff.
    expect(screen.getByText("Verified")).toBeInTheDocument();
    // …and it must not have been dissolved on the way there.
    expect(boxesWrapper().className).not.toMatch(/\bopacity-0\b/);
  });

  it("never carries a fade transition on the wrapper at any point in the sequence", async () => {
    renderSignup();
    typeCode("123456");

    for (const at of [0, 780, 1680, 2240, 2940]) {
      await tick(at === 0 ? 0 : 1);
      expect(
        boxesWrapper().className,
        `wrapper carried a fade at ~${at}ms`,
      ).not.toMatch(/transition-opacity|\bopacity-0\b/);
      await tick(at === 0 ? 0 : 0);
    }
    await tick(FULL_MOTION_MS);
    expect(boxesWrapper().className).not.toMatch(
      /transition-opacity|\bopacity-0\b/,
    );
  });

  it("leaves no dead `faded` state behind in the choreography source", () => {
    // The fade was the only consumer of `visual.faded`. Deleting the behaviour
    // without deleting the state would leave an unreferenced field that reads
    // as "this still fades" to the next person in the file.
    const here = path.dirname(fileURLToPath(import.meta.url));
    const code = readFileSync(path.join(here, "otp-boxes.tsx"), "utf8")
      // Comments are stripped first: the file's own prose explains that the
      // fade was removed and why, which is exactly the wrong thing to fail on.
      .replace(/\/\*[\s\S]*?\*\//g, "")
      .replace(/\/\/[^\n]*/g, "");
    expect(code).not.toMatch(/\bfaded\b/);
  });
});

describe("#190 — the muted note beneath the pill", () => {
  it("is mounted but transparent before its entrance, then fades in", async () => {
    renderSignup();
    typeCode("123456");

    // Slot is reserved from the start of the sequence so the note's own
    // entrance causes no layout shift.
    await tick(NOTE_AT_MS - 100);
    const early = screen.getByText("Taking you in…");
    expect(early.className).toMatch(/\bopacity-0\b/);
    expect(early.className).toMatch(/transition-opacity/);

    await tick(200);
    expect(screen.getByText("Taking you in…").className).toMatch(
      /\bopacity-100\b/,
    );

    // Still there when the handoff happens.
    await tick(FULL_MOTION_MS - NOTE_AT_MS);
    expect(screen.getByText("Taking you in…")).toBeInTheDocument();
    expect(replaceMock).toHaveBeenCalledWith("/app");
  });

  it("uses the signup caller's words", async () => {
    renderSignup();
    typeCode("123456");
    await tick(FULL_MOTION_MS);
    expect(screen.getByText("Taking you in…")).toBeInTheDocument();
  });

  it("uses the recovery caller's words", async () => {
    render(
      <OtpPanel
        email="reset@example.com"
        action={vi.fn().mockResolvedValue({ status: "ok" })}
        successHref="/reset-password"
        successNote="One moment…"
        helperText="x"
      />,
    );
    typeCode("123456");
    await tick(FULL_MOTION_MS);

    expect(screen.getByText("One moment…")).toBeInTheDocument();
    expect(screen.queryByText("Taking you in…")).not.toBeInTheDocument();
    expect(replaceMock).toHaveBeenCalledWith("/reset-password");
  });

  it("shows no note at all while the user is still entering a code", () => {
    renderSignup();
    typeCode("12345");
    expect(screen.queryByText("Taking you in…")).not.toBeInTheDocument();
  });
});

describe("#190 — the 4s Continue escape hatch", () => {
  it("does not exist at any point before navigation is attempted", async () => {
    renderSignup();
    typeCode("123456");

    for (const step of [780, 900, 400, 560, 300]) {
      await tick(step);
      expect(
        screen.queryByRole("link", { name: "Continue" }),
        "Continue leaked into the healthy animation",
      ).not.toBeInTheDocument();
    }
    expect(replaceMock).toHaveBeenCalledWith("/app");
  });

  it("still does not exist just under 4s after navigation was attempted", async () => {
    renderSignup();
    typeCode("123456");
    await tick(FULL_MOTION_MS);
    await tick(STALL_MS - 100);

    expect(screen.queryByRole("link", { name: "Continue" })).not.toBeInTheDocument();
    expect(screen.getByText("Taking you in…")).toBeInTheDocument();
  });

  it("replaces the muted note 4s after navigation silently failed to happen", async () => {
    renderSignup();
    typeCode("123456");
    await tick(FULL_MOTION_MS);
    await tick(STALL_MS);

    const escape = screen.getByRole("link", { name: "Continue" });
    expect(escape).toHaveAttribute("href", "/app");
    // It REPLACES the note — two competing messages would be worse than one.
    expect(screen.queryByText("Taking you in…")).not.toBeInTheDocument();
  });

  it("is a real control: 44px hit target and a visible focus indicator", async () => {
    renderSignup();
    typeCode("123456");
    await tick(FULL_MOTION_MS + STALL_MS);

    const escape = screen.getByRole("link", { name: "Continue" });
    expect(escape.className).toMatch(/\bmin-h-11\b/);
    // The link idiom from #210/#215, not the text-entry outline idiom from #212.
    expect(escape.className).toMatch(/focus-visible:ring-2\b/);
    expect(escape.className).toMatch(/focus-visible:ring-ring\b/);
  });

  it("points at the recovery destination on the recovery flow", async () => {
    render(
      <OtpPanel
        email="reset@example.com"
        action={vi.fn().mockResolvedValue({ status: "ok" })}
        successHref="/reset-password"
        successNote="One moment…"
        helperText="x"
      />,
    );
    typeCode("123456");
    await tick(FULL_MOTION_MS + STALL_MS);

    expect(screen.getByRole("link", { name: "Continue" })).toHaveAttribute(
      "href",
      "/reset-password",
    );
  });

  it("does not survive unmount — the timer is cleared, not left pending", async () => {
    const { unmount } = renderSignup();
    typeCode("123456");
    await tick(FULL_MOTION_MS);
    // Navigation has been attempted; the 4s timer is armed and pending.
    expect(vi.getTimerCount()).toBeGreaterThan(0);

    unmount();
    expect(vi.getTimerCount()).toBe(0);
  });
});

describe("#190 — reduced motion", () => {
  it("keeps the existing 650ms total and does not lengthen the wait", async () => {
    setReducedMotion(true);
    renderSignup();
    typeCode("123456");

    await tick(REDUCED_MOTION_MS - 50);
    expect(replaceMock).not.toHaveBeenCalled();
    await tick(100);
    expect(replaceMock).toHaveBeenCalledWith("/app");
  });

  it("shows the note immediately, with no fade transition on it", async () => {
    setReducedMotion(true);
    renderSignup();
    typeCode("123456");
    await tick(0);

    const note = screen.getByText("Taking you in…");
    expect(note.className).toMatch(/\bopacity-100\b/);
    expect(note.className).not.toMatch(/transition-opacity/);
  });

  it("holds the pill through the handoff, same as full motion", async () => {
    setReducedMotion(true);
    renderSignup();
    typeCode("123456");
    await tick(REDUCED_MOTION_MS);

    expect(replaceMock).toHaveBeenCalledWith("/app");
    expect(screen.getByText("Verified")).toBeInTheDocument();
    expect(boxesWrapper().className).not.toMatch(/\bopacity-0\b/);
  });

  it("still offers the 4s escape hatch", async () => {
    setReducedMotion(true);
    renderSignup();
    typeCode("123456");
    await tick(REDUCED_MOTION_MS);

    expect(screen.queryByRole("link", { name: "Continue" })).not.toBeInTheDocument();
    await tick(STALL_MS);
    expect(screen.getByRole("link", { name: "Continue" })).toHaveAttribute(
      "href",
      "/app",
    );
  });
});
