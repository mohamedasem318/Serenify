import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

vi.mock("@/hooks/use-media-query", () => ({ useMediaQuery: () => false }));

import {
  SessionEndFeedbackCard,
  type SessionEndFeedbackCardProps,
} from "@/components/questionnaire/session-end-feedback-card";

type SaveFn = NonNullable<SessionEndFeedbackCardProps["save"]>;

/**
 * T040 — privacy: session-end free text and the `ren_too_robotic` signal are stored ONLY as
 * employee-private product feedback (via `save`), never passed to Ren or any manager
 * aggregate. The card has no Ren/manager surface at all — the only navigation it can perform
 * is within /app/account, never to chat/Ren or a manager view.
 */

function setup() {
  const save = vi.fn<SaveFn>(async () => ({ ok: true as const, data: { id: "f1" } }));
  const navigate = vi.fn();
  render(<SessionEndFeedbackCard userId="u1" monitoringSessionId="s1" save={save} navigate={navigate} />);
  return { save, navigate, user: userEvent.setup() };
}

describe("session-end product feedback stays employee-private", () => {
  it("ren_too_robotic is stored via the private client and never routed to Ren/manager", async () => {
    const { save, navigate, user } = setup();
    await user.click(screen.getByRole("button", { name: /Something was off/ }));
    await user.click(screen.getByRole("button", { name: /too.robotic/i }));

    // Stored once, employee-private (status submitted, owner-scoped fields only).
    expect(save).toHaveBeenCalledTimes(1);
    expect(save).toHaveBeenCalledWith(
      expect.objectContaining({ userId: "u1", monitoringSessionId: "s1", reason: "ren_too_robotic" }),
    );
    // No navigation at all (no Ren, no manager view).
    expect(navigate).not.toHaveBeenCalled();
  });

  it("free text reaches only the private save call; no chat/Ren/manager navigation", async () => {
    const { save, navigate, user } = setup();
    await user.click(screen.getByRole("button", { name: /Something was off/ }));
    await user.click(screen.getByRole("button", { name: /Something else/i }));
    await user.type(screen.getByLabelText("Tell us what felt off"), "Ren felt scripted");
    await user.click(screen.getByRole("button", { name: /Send/i }));

    const payload = save.mock.calls.at(-1)![0];
    expect(payload.freeText).toBe("Ren felt scripted");
    expect(payload.reason).toBe("something_else");
    // The free text never becomes a chat/Ren navigation or a manager call.
    for (const [path] of navigate.mock.calls) {
      expect(String(path)).not.toMatch(/chat|ren|manager|team/i);
    }
  });

  it("the card source imports no chat/Ren or manager aggregate path", async () => {
    const { readFileSync } = await import("node:fs");
    const { fileURLToPath } = await import("node:url");
    const path = await import("node:path");
    const src = readFileSync(
      path.resolve(
        path.dirname(fileURLToPath(import.meta.url)),
        "../../../../components/questionnaire/session-end-feedback-card.tsx",
      ),
      "utf8",
    ).replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");
    expect(src).not.toContain("chat-client");
    expect(src).not.toContain("confirmatory-handoff");
    expect(src).not.toContain("getWeeklySummary");
    expect(src).not.toContain("submitWeeklyCheckin");
  });
});
