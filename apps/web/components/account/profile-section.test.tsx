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
      expect(screen.getByText("Name can't be empty")).toBeInTheDocument();
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

  it("surfaces an alert with the server's invalid message and skips router.refresh", async () => {
    updateProfileMock.mockResolvedValue({
      status: "invalid",
      message: "Keep it under 60 characters",
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
        "Keep it under 60 characters",
      );
    });
    expect(routerRefreshMock).not.toHaveBeenCalled();
  });
});
