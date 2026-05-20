import { describe, expect, it, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

const { changePasswordMock } = vi.hoisted(() => ({
  changePasswordMock: vi.fn(),
}));

vi.mock("@/app/(authed)/app/account/actions", () => ({
  changePassword: changePasswordMock,
}));

import { SecuritySection } from "@/components/account/security-section";

const STRONG_PW = "BetterPass123";

async function fillForm(
  user: ReturnType<typeof userEvent.setup>,
  values: {
    current?: string;
    next?: string;
    confirm?: string;
  },
) {
  if (values.current !== undefined) {
    await user.type(screen.getByLabelText("Current password"), values.current);
  }
  if (values.next !== undefined) {
    await user.type(screen.getByLabelText("New password"), values.next);
  }
  if (values.confirm !== undefined) {
    await user.type(
      screen.getByLabelText("Confirm new password"),
      values.confirm,
    );
  }
}

describe("SecuritySection", () => {
  beforeEach(() => {
    changePasswordMock.mockReset();
  });

  it("renders the Security heading and inline form fields", () => {
    render(<SecuritySection />);
    expect(
      screen.getByRole("heading", { name: "Security", level: 2 }),
    ).toBeInTheDocument();
    expect(screen.getByLabelText("Current password")).toBeInTheDocument();
    expect(screen.getByLabelText("New password")).toBeInTheDocument();
    expect(screen.getByLabelText("Confirm new password")).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /Save password/ }),
    ).toBeInTheDocument();
  });

  it("does NOT link off-page to /forgot-password (FR-020 amendment)", () => {
    render(<SecuritySection />);
    const links = screen
      .queryAllByRole("link")
      .filter((a) => a.getAttribute("href")?.includes("/forgot-password"));
    expect(links).toHaveLength(0);
  });

  it("renders the live PasswordRequirements checklist", () => {
    render(<SecuritySection />);
    expect(screen.getByText(/At least 8 characters/i)).toBeInTheDocument();
    expect(screen.getByText(/Contains a letter/i)).toBeInTheDocument();
    expect(screen.getByText(/Contains a number/i)).toBeInTheDocument();
  });

  it("blocks submission when the new password is too short", async () => {
    const user = userEvent.setup();
    render(<SecuritySection />);
    await fillForm(user, {
      current: "anything",
      next: "short",
      confirm: "short",
    });
    await user.click(screen.getByRole("button", { name: /Save password/ }));
    await waitFor(() => {
      expect(
        screen.getByText("Password must be at least 8 characters."),
      ).toBeInTheDocument();
    });
    expect(changePasswordMock).not.toHaveBeenCalled();
  });

  it("blocks submission when the new password is missing a number", async () => {
    const user = userEvent.setup();
    render(<SecuritySection />);
    await fillForm(user, {
      current: "anything",
      next: "letterletter",
      confirm: "letterletter",
    });
    await user.click(screen.getByRole("button", { name: /Save password/ }));
    await waitFor(() => {
      expect(
        screen.getByText("Password must contain a number."),
      ).toBeInTheDocument();
    });
    expect(changePasswordMock).not.toHaveBeenCalled();
  });

  it("blocks submission when confirm does not match new", async () => {
    const user = userEvent.setup();
    render(<SecuritySection />);
    await fillForm(user, {
      current: "anything",
      next: STRONG_PW,
      confirm: "Mismatch123",
    });
    await user.click(screen.getByRole("button", { name: /Save password/ }));
    await waitFor(() => {
      expect(screen.getByText("Passwords do not match.")).toBeInTheDocument();
    });
    expect(changePasswordMock).not.toHaveBeenCalled();
  });

  it("surfaces the action's wrong-current-password message verbatim", async () => {
    changePasswordMock.mockResolvedValue({
      status: "invalid",
      message: "Current password doesn't match.",
    });
    const user = userEvent.setup();
    render(<SecuritySection />);
    await fillForm(user, {
      current: "wrong",
      next: STRONG_PW,
      confirm: STRONG_PW,
    });
    await user.click(screen.getByRole("button", { name: /Save password/ }));

    await waitFor(() => {
      expect(screen.getByRole("alert")).toHaveTextContent(
        "Current password doesn't match.",
      );
    });
    expect(changePasswordMock).toHaveBeenCalledTimes(1);
  });

  it("clears the form and shows the success banner after a successful change", async () => {
    changePasswordMock.mockResolvedValue({ status: "ok" });
    const user = userEvent.setup();
    render(<SecuritySection />);
    await fillForm(user, {
      current: "MyCurrent123",
      next: STRONG_PW,
      confirm: STRONG_PW,
    });
    await user.click(screen.getByRole("button", { name: /Save password/ }));

    await waitFor(() => {
      expect(screen.getByRole("status")).toHaveTextContent("Password updated.");
    });

    const passedForm = changePasswordMock.mock.calls[0]![0] as FormData;
    expect(passedForm.get("current_password")).toBe("MyCurrent123");
    expect(passedForm.get("new_password")).toBe(STRONG_PW);
    expect(passedForm.get("confirm_password")).toBe(STRONG_PW);

    // Inputs are wiped on success.
    expect(
      (screen.getByLabelText("Current password") as HTMLInputElement).value,
    ).toBe("");
    expect(
      (screen.getByLabelText("New password") as HTMLInputElement).value,
    ).toBe("");
    expect(
      (screen.getByLabelText("Confirm new password") as HTMLInputElement).value,
    ).toBe("");
  });
});
