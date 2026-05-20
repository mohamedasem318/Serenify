import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";

vi.mock("@/app/(authed)/actions", () => ({
  signOut: vi.fn(),
}));

import { SignOutButton } from "@/components/sign-out-button";

describe("SignOutButton", () => {
  it("renders a submit button labelled 'Sign out' by default", () => {
    render(<SignOutButton />);
    const button = screen.getByRole("button", { name: "Sign out" });
    expect(button).toHaveAttribute("type", "submit");
  });

  it("renders inside a <form> whose action is the signOut server action", () => {
    render(<SignOutButton />);
    const button = screen.getByRole("button", { name: "Sign out" });
    const form = button.closest("form");
    expect(form).not.toBeNull();
  });

  it("forwards the variant prop onto the underlying Button", () => {
    render(<SignOutButton variant="ghost" />);
    const button = screen.getByRole("button", { name: "Sign out" });
    expect(button.className).toMatch(/hover:bg-accent/);
  });

  it("accepts custom children to override the default label", () => {
    render(<SignOutButton>Log out</SignOutButton>);
    expect(
      screen.getByRole("button", { name: "Log out" }),
    ).toBeInTheDocument();
  });
});
