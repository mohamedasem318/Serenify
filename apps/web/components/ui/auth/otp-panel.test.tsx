import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";

import { AUTH_BROADCAST_KEY, parseAuthBroadcast } from "@/lib/auth-broadcast";

const { replaceMock, refreshMock } = vi.hoisted(() => ({
  replaceMock: vi.fn(),
  refreshMock: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace: replaceMock, refresh: refreshMock }),
}));

// Reduced motion is read through the repo's own useMediaQuery (NOT framer's
// useReducedMotion). The mock is query-aware so tests can force the
// reduced-motion branch — where the verified pill is shown directly and the
// sweep/merge/lift are skipped — independently of viewport queries.
const { useMediaQueryMock } = vi.hoisted(() => ({
  useMediaQueryMock: vi.fn<(query: string) => boolean>(),
}));

vi.mock("@/hooks/use-media-query", () => ({
  useMediaQuery: useMediaQueryMock,
}));

import { OtpPanel } from "@/components/ui/auth/otp-panel";

function setReducedMotion(reduced: boolean) {
  useMediaQueryMock.mockImplementation(
    (query: string) => query === "(prefers-reduced-motion: reduce)" && reduced,
  );
}

function boxes() {
  return [1, 2, 3, 4, 5, 6].map(
    (n) => screen.getByLabelText(`Digit ${n}`) as HTMLInputElement,
  );
}

/** Type one digit per box, in order — completing the 6th auto-submits. */
function typeCode(code: string) {
  [...code].forEach((digit, i) => {
    fireEvent.change(screen.getByLabelText(`Digit ${i + 1}`), {
      target: { value: digit },
    });
  });
}

beforeEach(() => {
  replaceMock.mockReset();
  refreshMock.mockReset();
  useMediaQueryMock.mockReset();
  setReducedMotion(false);
  localStorage.clear();
});

afterEach(() => {
  localStorage.clear();
});

describe("OtpPanel — reduced motion (FR-026)", () => {
  it("shows the verified pill directly and navigates, with no merge/lift to wait on", async () => {
    setReducedMotion(true);
    const action = vi.fn().mockResolvedValue({ status: "ok" });
    render(
      <OtpPanel
        email="new@example.com"
        action={action}
        successHref="/app"
        successNote="Taking you in…"
        helperText="x"
      />,
    );

    typeCode("123456");

    await waitFor(() => expect(action).toHaveBeenCalledTimes(1));
    // The verified pill is presented directly under reduced motion …
    await waitFor(() => expect(screen.getByText("Verified")).toBeInTheDocument());
    // … and the success handoff still runs.
    await waitFor(() => expect(replaceMock).toHaveBeenCalledWith("/app"), {
      timeout: 2000,
    });
  });
});

describe("OtpPanel — success navigation + cross-tab broadcast gate (📌 OTP fix)", () => {
  it("navigates to /app and broadcasts signin on a successful signup verify", async () => {
    setReducedMotion(true);
    const action = vi.fn().mockResolvedValue({ status: "ok" });
    render(
      <OtpPanel
        email="new@example.com"
        action={action}
        successHref="/app"
        successNote="Taking you in…"
        helperText="x"
      />,
    );

    typeCode("123456");

    await waitFor(() => expect(action).toHaveBeenCalledTimes(1));
    // The signup-confirmation OTP path is a sign-in completion: sibling tabs
    // propagate off the same localStorage marker the form path writes.
    await waitFor(() =>
      expect(parseAuthBroadcast(localStorage.getItem(AUTH_BROADCAST_KEY))).toBe(
        "signin",
      ),
    );
    await waitFor(() => expect(replaceMock).toHaveBeenCalledWith("/app"), {
      timeout: 2000,
    });
  });

  it("navigates to /reset-password WITHOUT broadcasting on a recovery verify", async () => {
    setReducedMotion(true);
    const action = vi.fn().mockResolvedValue({ status: "ok" });
    render(
      <OtpPanel
        email="reset@example.com"
        action={action}
        successHref="/reset-password"
        successNote="One moment…"
        helperText="x"
      />,
    );

    typeCode("123456");

    await waitFor(
      () => expect(replaceMock).toHaveBeenCalledWith("/reset-password"),
      { timeout: 2000 },
    );
    // Recovery is not a "sign in to use the app" — broadcasting would wrongly
    // pull sibling tabs to /app and regress smoke ST-9.
    expect(localStorage.getItem(AUTH_BROADCAST_KEY)).toBeNull();
  });
});

describe("OtpPanel — wrong code (FR-015, FR-025)", () => {
  it("shows the foggy notice, clears all six digits, and refocuses box 1", async () => {
    setReducedMotion(true);
    const action = vi
      .fn()
      .mockResolvedValue({ status: "invalid", message: "That code didn't match." });
    render(
      <OtpPanel
        email="new@example.com"
        action={action}
        successHref="/app"
        successNote="Taking you in…"
        helperText="x"
      />,
    );

    typeCode("000000");

    // Notice appears (the message is the action's, rendered in the foggy box).
    await waitFor(() =>
      expect(screen.getByText("That code didn't match.")).toBeInTheDocument(),
    );
    // After the (skipped) sway, every box is cleared and box 1 holds focus.
    await waitFor(() => {
      expect(boxes().every((b) => b.value === "")).toBe(true);
    });
    await waitFor(() =>
      expect(document.activeElement).toBe(screen.getByLabelText("Digit 1")),
    );
    expect(replaceMock).not.toHaveBeenCalled();
    expect(localStorage.getItem(AUTH_BROADCAST_KEY)).toBeNull();
  });
});

describe("OtpPanel — input behaviour", () => {
  it("paste of a 6-digit string fills all six boxes", () => {
    // A pending action keeps the boxes mounted with their values so the fill is
    // observable (completion auto-submits, but the action never resolves here).
    const action = vi.fn(() => new Promise<never>(() => {}));
    render(
      <OtpPanel
        email="new@example.com"
        action={action}
        successHref="/app"
        successNote="Taking you in…"
        helperText="x"
      />,
    );

    fireEvent.paste(screen.getByLabelText("Digit 1"), {
      clipboardData: { getData: () => "029417" },
    });

    expect(boxes().map((b) => b.value)).toEqual([
      "0",
      "2",
      "9",
      "4",
      "1",
      "7",
    ]);
  });

  it("does not call the verify action while fewer than six digits are entered", () => {
    const action = vi.fn().mockResolvedValue({ status: "ok" });
    render(
      <OtpPanel
        email="new@example.com"
        action={action}
        successHref="/app"
        successNote="Taking you in…"
        helperText="x"
      />,
    );

    typeCode("12345"); // five digits — sub-6 submit is blocked

    expect(action).not.toHaveBeenCalled();
  });
});
