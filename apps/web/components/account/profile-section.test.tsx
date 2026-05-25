import { describe, expect, it, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

const { updateProfileMock, routerRefreshMock } = vi.hoisted(() => ({
  updateProfileMock: vi.fn(),
  routerRefreshMock: vi.fn(),
}));

vi.mock("@/app/(authed)/app/account/actions", () => ({
  updateProfile: updateProfileMock,
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: routerRefreshMock }),
}));

import { ProfileSection } from "@/components/account/profile-section";

describe("ProfileSection", () => {
  beforeEach(() => {
    updateProfileMock.mockReset();
    routerRefreshMock.mockReset();
  });

  it("renders the initial full_name in the editor and the email as read-only text", () => {
    render(
      <ProfileSection
        initialFullName="Jane Doe"
        email="jane@demo.serenify.local"
      />,
    );
    const input = screen.getByLabelText("Full name") as HTMLInputElement;
    expect(input.value).toBe("Jane Doe");
    expect(screen.getByText("jane@demo.serenify.local")).toBeInTheDocument();
    // Email is plain text, not an input.
    expect(
      screen.queryByRole("textbox", { name: /email/i }),
    ).not.toBeInTheDocument();
  });

  it("renders the avatar with initials derived from the initial full_name", () => {
    render(
      <ProfileSection
        initialFullName="Jane Doe"
        email="jane@demo.serenify.local"
      />,
    );
    // The avatar fallback span carries the initials text.
    expect(screen.getByText("JD")).toBeInTheDocument();
  });

  it("updates the avatar initials live as the user types", async () => {
    const user = userEvent.setup();
    render(
      <ProfileSection
        initialFullName="Jane Doe"
        email="jane@demo.serenify.local"
      />,
    );
    const input = screen.getByLabelText("Full name");
    await user.clear(input);
    await user.type(input, "Alex Kim");
    await waitFor(() => {
      expect(screen.getByText("AK")).toBeInTheDocument();
    });
  });

  it("blocks submission with the calm-voice empty-name message", async () => {
    const user = userEvent.setup();
    render(
      <ProfileSection
        initialFullName="Jane Doe"
        email="jane@demo.serenify.local"
      />,
    );
    const input = screen.getByLabelText("Full name");
    await user.clear(input);
    await user.click(screen.getByRole("button", { name: /Save changes/ }));
    await waitFor(() => {
      expect(screen.getByText("Please enter your name.")).toBeInTheDocument();
    });
    expect(updateProfileMock).not.toHaveBeenCalled();
  });

  it("calls updateProfile, renders success state, and refreshes the route on success", async () => {
    updateProfileMock.mockResolvedValue({ status: "ok" });
    const user = userEvent.setup();
    render(
      <ProfileSection
        initialFullName="Jane Doe"
        email="jane@demo.serenify.local"
      />,
    );
    const input = screen.getByLabelText("Full name");
    await user.clear(input);
    await user.type(input, "Jane Smith");
    await user.click(screen.getByRole("button", { name: /Save changes/ }));

    await waitFor(() => {
      expect(updateProfileMock).toHaveBeenCalledTimes(1);
    });
    const passedForm = updateProfileMock.mock.calls[0]![0] as FormData;
    expect(passedForm.get("full_name")).toBe("Jane Smith");

    await waitFor(() => {
      expect(screen.getByRole("status")).toHaveTextContent("Saved.");
    });
    expect(routerRefreshMock).toHaveBeenCalledTimes(1);
  });

  it("re-baselines the form after a successful save so the OLD name reads as a valid new change", async () => {
    updateProfileMock.mockResolvedValue({ status: "ok" });
    const user = userEvent.setup();
    render(
      <ProfileSection
        initialFullName="Jane Doe"
        email="jane@demo.serenify.local"
      />,
    );

    // First save: Jane Doe → Jane Smith.
    const input = screen.getByLabelText("Full name");
    const button = screen.getByRole("button", { name: /Save changes/ });
    await user.clear(input);
    await user.type(input, "Jane Smith");
    await user.click(button);
    await waitFor(() => {
      expect(screen.getByRole("status")).toHaveTextContent("Saved.");
    });

    // Save button is now disabled (form is clean against the new baseline).
    await waitFor(() => {
      expect(button).toBeDisabled();
    });

    // Type the OLD name back. This MUST count as a change — the bug
    // was that isDirty compared to the stale initial baseline and the
    // Save button stayed disabled.
    await user.clear(input);
    await user.type(input, "Jane Doe");
    await waitFor(() => {
      expect(button).not.toBeDisabled();
    });
  });

  it("surfaces an alert with the server's invalid message and skips router.refresh", async () => {
    updateProfileMock.mockResolvedValue({
      status: "invalid",
      message: "Name must be 120 characters or fewer.",
    });
    const user = userEvent.setup();
    render(
      <ProfileSection
        initialFullName="Jane Doe"
        email="jane@demo.serenify.local"
      />,
    );
    const input = screen.getByLabelText("Full name");
    await user.clear(input);
    await user.type(input, "Jane Smith");
    await user.click(screen.getByRole("button", { name: /Save changes/ }));

    await waitFor(() => {
      expect(screen.getByRole("alert")).toHaveTextContent(
        "Name must be 120 characters or fewer.",
      );
    });
    expect(routerRefreshMock).not.toHaveBeenCalled();
  });
});
