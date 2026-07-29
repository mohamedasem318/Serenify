import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";

import { ForgotForm } from "@/app/(auth)/forgot-password/forgot-form";

// The two Server Action modules reach `@/lib/supabase/server` and the
// `server-only` env binding, neither of which imports under Vitest. This
// suite is about what the sent state *says*, so both are stubbed at the
// module boundary.
vi.mock("@/app/(auth)/forgot-password/actions", () => ({
  requestPasswordReset: vi.fn(),
  requestPasswordResetFromForm: vi.fn(),
}));
vi.mock("@/app/(auth)/reset-password/actions", () => ({
  verifyResetOtp: vi.fn(),
}));

// OtpPanel owns a router, timers and a media query — all tested in its own
// suite. Here it stands in as the thing that renders `helperText`, because
// that string is the copy under test.
vi.mock("@/components/ui/auth/otp-panel", () => ({
  OtpPanel: ({ helperText }: { helperText: string }) => (
    <div data-testid="otp-panel">{helperText}</div>
  ),
}));

const EMAIL = "deleted-account@example.com";

function renderSentState() {
  render(<ForgotForm initialSent initialEmail={EMAIL} />);
  return document.body.textContent ?? "";
}

describe("forgot-password sent state — honesty without enumeration", () => {
  // The defect: the body copy hedges ("If <email> is registered…") while the
  // OTP helper asserts an email exists. Someone whose account was deleted
  // reads both on one screen and believes the definite one.
  it("never asserts that an email exists", () => {
    const text = renderSentState();

    expect(text).not.toMatch(/\bthe email (also )?includes\b/i);
    expect(screen.getByTestId("otp-panel").textContent).toMatch(
      /\bif it arrives\b/i,
    );
  });

  // The dead end: an address with no account can enter codes forever. Every
  // failure says "that code didn't match. Try again, or request a fresh
  // email" — a loop with no exit. The exit is signup.
  it("offers a way out for an address that has no account", () => {
    renderSentState();

    const signupLinks = screen
      .getAllByRole("link")
      .filter((a) => a.getAttribute("href") === "/signup");

    expect(signupLinks).not.toHaveLength(0);
  });

  // Guard, not a fix: the hedge is the whole reason this surface is vague.
  // It is security theatre given signup discloses existence outright, but it
  // is *deliberate* theatre — see docs/DECISIONS.md 2026-07-29.
  it("keeps the conditional hedge on the body copy", () => {
    const text = renderSentState();

    expect(text).toMatch(/if\b[\s\S]*\bis registered\b/i);
  });

  // Guard: nothing added here may resolve which case the reader is in.
  it("never discloses whether the address is registered", () => {
    const text = renderSentState();

    expect(text).not.toMatch(
      /\b(no account|not registered|isn't registered|doesn't exist|no such account)\b/i,
    );
  });
});
