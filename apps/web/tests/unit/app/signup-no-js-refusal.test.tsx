import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen, within } from "@testing-library/react";

import { refusalFromParam } from "@/lib/auth/signup-refusal";
import {
  TERMS_ACK_REQUIRED_MESSAGE,
  TERMS_ACK_STALE_MESSAGE,
} from "@/lib/consent/copy";

/**
 * #184 — the render half of the no-JS refusal contract: SignupForm seeded with a
 * rebuilt refusal (what the signup page passes after a `?state=refused&reason=…`
 * redirect) must surface the SAME copy the JS path shows, through the SAME branches.
 * Before this, every one of these cases re-rendered a blank form with no message —
 * the recorded ST-9 failure.
 */

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }),
}));
// The actions module is "use server" and drags in the server-only Supabase client;
// the form only needs the three referenced callables to exist.
vi.mock("@/app/(auth)/signup/actions", () => ({
  signUp: vi.fn(),
  signUpFromForm: vi.fn(),
  verifySignupOtp: vi.fn(),
}));

import { SignupForm } from "@/app/(auth)/signup/signup-form";

const VERSION = "terms_privacy@2026-07-26.1";

function renderWithReason(reason: string) {
  return render(
    <SignupForm initialRefusal={refusalFromParam(reason)} termsVersionId={VERSION} />,
  );
}

afterEach(cleanup);

describe("SignupForm — a carried no-JS refusal renders visible copy (#184)", () => {
  it("terms: the acknowledgement message renders AT the accept_terms field", () => {
    renderWithReason("terms");
    const note = screen.getByRole("alert");
    expect(note).toHaveTextContent(TERMS_ACK_REQUIRED_MESSAGE);
    // The field-scoped slot, not the generic box — same place the JS path puts it.
    expect(note).toHaveAttribute("id", "accept_terms-error");
    expect(screen.getByLabelText(/i have read/i)).toHaveAttribute("aria-invalid", "true");
  });

  it("stale_terms: the revised-documents message renders", () => {
    renderWithReason("stale_terms");
    expect(screen.getByRole("alert")).toHaveTextContent(TERMS_ACK_STALE_MESSAGE);
  });

  it("exists: the already-has-an-account note renders with its links", () => {
    renderWithReason("exists");
    // Scoped: the form footer carries its own "Sign in" link; the note's is the
    // one the refusal added.
    const note = screen.getByText(/already has an account/i);
    expect(within(note).getByRole("link", { name: /sign in/i })).toBeInTheDocument();
    expect(within(note).getByRole("link", { name: /reset password/i })).toBeInTheDocument();
  });

  it("fields: the generic check-the-fields message renders as an alert", () => {
    renderWithReason("fields");
    expect(screen.getByRole("alert")).toHaveTextContent(/check the fields/i);
  });

  it("error: the generic something-went-wrong message renders as an alert", () => {
    renderWithReason("error");
    expect(screen.getByRole("alert")).toHaveTextContent(/something went wrong/i);
  });

  it("an unknown marker renders a clean form — no alert, no note", () => {
    renderWithReason("not-a-reason");
    expect(screen.queryByRole("alert")).toBeNull();
    expect(screen.queryByText(/already has an account/i)).toBeNull();
  });
});
