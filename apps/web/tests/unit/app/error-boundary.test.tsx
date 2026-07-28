import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import AppError from "@/app/error";

/**
 * apps/web/app had no error boundary at all before 2026-07-28, so every uncaught
 * error fell through to Next's built-in root fallback — the unstyled "This page
 * couldn't load" screen the sign-out bug surfaced.
 *
 * The leak assertions are the ones worth keeping. An error boundary is exactly
 * where internals escape: the reflex is to render `error.message` "just while we
 * debug", and it survives to production. These fail the moment anything from the
 * error object reaches the DOM.
 */

const BOOM = Object.assign(
  new Error("connect ECONNREFUSED 10.0.0.7:5432 — supabase pooler"),
  { digest: "3341299847" },
);

beforeEach(() => {
  vi.spyOn(console, "error").mockImplementation(() => {});
});

describe("app error boundary", () => {
  it("shows a calm heading rather than Next's default screen", () => {
    render(<AppError error={BOOM} reset={() => {}} />);

    expect(
      screen.getByRole("heading", { name: /this didn’t load/i }),
    ).toBeInTheDocument();
  });

  it("never renders the error message", () => {
    const { container } = render(<AppError error={BOOM} reset={() => {}} />);

    expect(container.textContent).not.toContain("ECONNREFUSED");
    expect(container.textContent).not.toContain("supabase");
    expect(container.textContent).not.toContain("5432");
  });

  it("never renders the digest", () => {
    const { container } = render(<AppError error={BOOM} reset={() => {}} />);

    expect(container.textContent).not.toContain("3341299847");
  });

  it("offers a retry that calls reset", async () => {
    const reset = vi.fn();
    const user = userEvent.setup();
    render(<AppError error={BOOM} reset={reset} />);

    await user.click(screen.getByRole("button", { name: "Try again" }));

    expect(reset).toHaveBeenCalledOnce();
  });

  it("escapes the failed router state with a full navigation, not a soft one", () => {
    render(<AppError error={BOOM} reset={() => {}} />);

    // The router is what just failed; a <Link> soft-nav can land straight back
    // in this same boundary.
    const escape = screen.getByRole("link", { name: "Back to Serenify" });
    expect(escape).toHaveAttribute("href", "/");
  });

  it("keeps both actions at the 44px touch floor", () => {
    render(<AppError error={BOOM} reset={() => {}} />);

    expect(screen.getByRole("button", { name: "Try again" }).className).toMatch(
      /min-h-11/,
    );
    expect(
      screen.getByRole("link", { name: "Back to Serenify" }).className,
    ).toMatch(/min-h-11/);
  });
});
