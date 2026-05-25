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

import { OtpPanel } from "@/components/ui/auth/otp-panel";

beforeEach(() => {
  replaceMock.mockReset();
  refreshMock.mockReset();
  localStorage.clear();
});

afterEach(() => {
  localStorage.clear();
});

async function enterCodeAndVerify(code = "123456") {
  fireEvent.change(screen.getByLabelText("6-digit code"), {
    target: { value: code },
  });
  fireEvent.click(screen.getByRole("button", { name: "Verify code" }));
}

describe("OtpPanel — cross-tab signin broadcast gate (📌 OTP fix)", () => {
  it("broadcasts signin on a successful verify to an authed destination (/app)", async () => {
    const action = vi.fn().mockResolvedValue({ status: "ok" });
    render(
      <OtpPanel
        email="new@example.com"
        action={action}
        successHref="/app"
        helperText="x"
      />,
    );

    await enterCodeAndVerify();

    await waitFor(() => expect(action).toHaveBeenCalledTimes(1));
    // The signup-confirmation OTP path is a sign-in completion: sibling
    // tabs propagate off the same localStorage marker the form path writes.
    await waitFor(() => {
      expect(parseAuthBroadcast(localStorage.getItem(AUTH_BROADCAST_KEY))).toBe(
        "signin",
      );
    });
    expect(replaceMock).toHaveBeenCalledWith("/app");
  });

  it("does NOT broadcast on a successful verify to the recovery surface (/reset-password)", async () => {
    const action = vi.fn().mockResolvedValue({ status: "ok" });
    render(
      <OtpPanel
        email="reset@example.com"
        action={action}
        successHref="/reset-password"
        helperText="x"
      />,
    );

    await enterCodeAndVerify();

    await waitFor(() => expect(replaceMock).toHaveBeenCalledWith("/reset-password"));
    // Recovery is not a "sign in to use the app" — broadcasting would
    // wrongly pull sibling tabs to /app and regress smoke ST-9.
    expect(localStorage.getItem(AUTH_BROADCAST_KEY)).toBeNull();
  });

  it("does NOT broadcast or navigate when verify fails", async () => {
    const action = vi
      .fn()
      .mockResolvedValue({ status: "invalid", message: "That code didn't match." });
    render(
      <OtpPanel
        email="new@example.com"
        action={action}
        successHref="/app"
        helperText="x"
      />,
    );

    await enterCodeAndVerify();

    await waitFor(() =>
      expect(screen.getByText("That code didn't match.")).toBeInTheDocument(),
    );
    expect(localStorage.getItem(AUTH_BROADCAST_KEY)).toBeNull();
    expect(replaceMock).not.toHaveBeenCalled();
  });
});
