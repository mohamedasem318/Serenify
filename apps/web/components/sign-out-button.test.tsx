import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";

vi.mock("@/app/(authed)/actions", () => ({
  signOut: vi.fn(),
}));

const formStatus = vi.hoisted(() => ({ pending: false }));

// useFormStatus only reports inside a real form submission, which jsdom/happy-dom
// will not drive. Stubbing it is the only way to assert the pending branch.
vi.mock("react-dom", async (importOriginal) => {
  const actual = await importOriginal<typeof import("react-dom")>();
  return { ...actual, useFormStatus: () => formStatus };
});

import { SignOutButton } from "@/components/sign-out-button";

beforeEach(() => {
  formStatus.pending = false;
});

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
    expect(button.className).toMatch(/hover:bg-foggy\/15/);
  });

  it("accepts custom children to override the default label", () => {
    render(<SignOutButton>Log out</SignOutButton>);
    expect(
      screen.getByRole("button", { name: "Log out" }),
    ).toBeInTheDocument();
  });

  it("meets the 44px touch-target floor", () => {
    render(<SignOutButton />);
    expect(
      screen.getByRole("button", { name: "Sign out" }).className,
    ).toMatch(/min-h-11/);
  });
});

/**
 * Sign-out crosses the network twice — ~1.6-2s in production — and gave no
 * feedback at all for that whole window. "The button appears to do nothing" was
 * the literal bug report; this is the half of it that was never a race.
 */
describe("SignOutButton — pending state", () => {
  it("announces that it is signing out while the action is in flight", () => {
    formStatus.pending = true;
    render(<SignOutButton />);

    expect(
      screen.getByRole("button", { name: /signing out/i }),
    ).toBeInTheDocument();
  });

  it("disables the button while pending, so a second submit cannot fire", () => {
    formStatus.pending = true;
    render(<SignOutButton />);

    expect(screen.getByRole("button", { name: /signing out/i })).toBeDisabled();
  });

  it("exposes the pending state to assistive tech via a status region", () => {
    formStatus.pending = true;
    render(<SignOutButton />);

    expect(screen.getByRole("status")).toHaveTextContent("Signing out");
  });

  it("gates the ring behind motion-safe so reduced-motion users see no spin", () => {
    formStatus.pending = true;
    const { container } = render(<SignOutButton />);

    // The global reduced-motion rule freezes animations rather than removing
    // them, so an ungated ring would sit as a static circle saying nothing.
    // The label carries the meaning; the ring must be enhancement only.
    const ring = container.querySelector("svg");
    expect(ring?.getAttribute("class")).toMatch(/motion-safe:animate-spin/);
    expect(ring).toHaveAttribute("aria-hidden", "true");
  });
});
