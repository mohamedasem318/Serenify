import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

vi.mock("@/hooks/use-media-query", () => ({ useMediaQuery: () => false }));

import { NotificationsPlaceholder } from "@/components/account/notifications-placeholder";
import { SessionEndFeedbackCard } from "@/components/questionnaire/session-end-feedback-card";

/**
 * T041 — session-end account route targets. `suggestion_didnt_help` routes to /app/account
 * (plain — no preferences anchor exists yet) and `needed_quiet` routes to
 * /app/account#notifications, which the notifications placeholder anchors via id="notifications".
 */

describe("session-end route targets", () => {
  it("suggestion_didnt_help routes to /app/account (plain, no anchor)", async () => {
    const navigate = vi.fn();
    const user = userEvent.setup();
    render(<SessionEndFeedbackCard userId="u" monitoringSessionId="s" save={vi.fn()} navigate={navigate} />);
    await user.click(screen.getByRole("button", { name: /Something was off/ }));
    await user.click(screen.getByRole("button", { name: /suggestion didn.t help/i }));
    await user.click(screen.getByRole("button", { name: /Update preferences/i }));
    expect(navigate).toHaveBeenCalledWith("/app/account");
    // It must NOT carry a preferences hash — no preferences section exists yet.
    expect(navigate).not.toHaveBeenCalledWith(expect.stringContaining("#preferences"));
  });

  it("needed_quiet routes to /app/account#notifications", async () => {
    const navigate = vi.fn();
    const user = userEvent.setup();
    render(<SessionEndFeedbackCard userId="u" monitoringSessionId="s" save={vi.fn()} navigate={navigate} />);
    await user.click(screen.getByRole("button", { name: /Something was off/ }));
    await user.click(screen.getByRole("button", { name: /needed quiet time/i }));
    await user.click(screen.getByRole("button", { name: /Notification settings/i }));
    expect(navigate).toHaveBeenCalledWith("/app/account#notifications");
  });
});

describe("notifications placeholder anchor", () => {
  it("exposes id='notifications' so the #notifications anchor resolves", () => {
    const { container } = render(<NotificationsPlaceholder />);
    const section = container.querySelector("section#notifications");
    expect(section).not.toBeNull();
  });
});
