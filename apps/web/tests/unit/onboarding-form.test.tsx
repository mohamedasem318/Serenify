import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

// Hoisted so the vi.mock factories can reference them safely.
const { completeOnboarding } = vi.hoisted(() => ({ completeOnboarding: vi.fn() }));
const { replace } = vi.hoisted(() => ({ replace: vi.fn() }));

vi.mock("@/app/(onboarding)/onboarding/actions", () => ({ completeOnboarding }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ replace, push: vi.fn() }) }));
vi.mock("@/components/anchor/anchor-recorder", () => ({
  AnchorRecorder: () => <div data-testid="anchor-recorder" />,
}));

import { OnboardingForm } from "@/app/(onboarding)/onboarding/onboarding-form";

beforeEach(() => {
  completeOnboarding.mockReset();
  replace.mockReset();
});

function submitName(name = "Jordan Lee") {
  fireEvent.change(screen.getByLabelText("Full name"), { target: { value: name } });
  fireEvent.click(screen.getByRole("button", { name: "Continue" }));
}

describe("OnboardingForm", () => {
  it("does not render the recorder before the name is submitted", () => {
    render(<OnboardingForm />);
    expect(screen.queryByTestId("anchor-recorder")).toBeNull();
  });

  it("advances an employee to the anchor recorder on { status: 'ok' }", async () => {
    completeOnboarding.mockResolvedValue({ status: "ok" });
    render(<OnboardingForm />);
    submitName();
    await waitFor(() =>
      expect(screen.getByTestId("anchor-recorder")).toBeInTheDocument(),
    );
  });

  it("stays on the name step and shows the error when the action does not return ok", async () => {
    // Managers redirect server-side (no result reaches the form), so they never
    // advance to the recorder either; the manager redirect is covered e2e (T055).
    completeOnboarding.mockResolvedValue({
      status: "error",
      message: "We couldn't save that — try again.",
    });
    render(<OnboardingForm />);
    submitName();
    await waitFor(() =>
      expect(screen.getByRole("alert")).toHaveTextContent("We couldn't save that — try again."),
    );
    expect(screen.queryByTestId("anchor-recorder")).toBeNull();
  });
});
