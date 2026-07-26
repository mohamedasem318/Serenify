import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { TermsReconsentScreen } from "@/components/consent/terms-reconsent-screen";

/**
 * T069 — the re-consent screen, with FR-043d ASSERTED rather than trusted.
 *
 * This screen is the entire experience of a blocked user: no header, no navigation, no
 * route out of it. Every guarantee FR-043d makes — both documents readable in full, a
 * working sign-out — is therefore load-bearing in a way it would not be on a surface the
 * user could simply navigate away from. So each one is a test, not a comment.
 *
 * THE NEGATIVE ASSERTIONS ARE THE POINT OF THIS FILE. That no decline control exists, and
 * that the write action is called with NO version argument, are both properties a
 * plausible, well-meaning refactor would break while every positive assertion still
 * passed.
 */

const VERSION_ID = "terms_privacy@2026-07-26.1";

const refresh = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh, push: vi.fn(), replace: vi.fn() }),
}));

// `<SignOutButton>` imports the real `signOut` server action, which reaches the Supabase
// server client and `next/headers`. Stubbing the action lets the REAL button render — the
// thing under assertion — without dragging a request context into a unit test.
vi.mock("@/app/(authed)/actions", () => ({ signOut: vi.fn() }));

beforeEach(() => {
  refresh.mockClear();
});

afterEach(() => {
  vi.clearAllMocks();
});

function renderScreen(onGrant = vi.fn(async () => ({ status: "ok" }) as const)) {
  render(<TermsReconsentScreen versionId={VERSION_ID} onGrant={onGrant} />);
  return onGrant;
}

describe("FR-043d — a blocked user can still read both documents in full", () => {
  it.each([
    ["Terms of Service", "/terms"],
    ["Privacy Policy", "/privacy"],
  ])("links to the %s at %s, in a new tab", (document, href) => {
    renderScreen();
    const link = screen.getByRole("link", {
      name: new RegExp(`${document}.*new tab`, "i"),
    });

    expect(link).toHaveAttribute("href", href);
    expect(link).toHaveAttribute("target", "_blank");
    // `noopener` specifically: a new tab opened without it can reach back through
    // `window.opener` from a document the app does not control.
    expect(link.getAttribute("rel")).toContain("noopener");
  });

  it("both accessible names identify the document AND say it opens in a new tab", () => {
    renderScreen();
    // A new tab that is not announced is a surprise for a screen-reader user, who has no
    // visual cue that focus did not move. Naming both facts is the requirement.
    const names = screen
      .getAllByRole("link")
      .map((link) => link.getAttribute("aria-label") ?? link.textContent ?? "");

    expect(names).toHaveLength(2);
    expect(names.some((name) => /terms of service/i.test(name) && /new tab/i.test(name))).toBe(
      true,
    );
    expect(names.some((name) => /privacy policy/i.test(name) && /new tab/i.test(name))).toBe(
      true,
    );
  });

  it("opens them in a new tab so the accept control is still there on return", () => {
    // Stated as its own case because the REASON is the requirement. A same-tab navigation
    // would unmount the only surface from which consent can be recorded.
    renderScreen();
    for (const link of screen.getAllByRole("link")) {
      expect(link).toHaveAttribute("target", "_blank");
    }
  });
});

describe("FR-043d — a blocked user can still sign out", () => {
  it("renders a sign-out control with an accessible name", () => {
    renderScreen();
    expect(screen.getByRole("button", { name: /sign out/i })).toBeInTheDocument();
  });

  it("the sign-out control submits a form — it is not gated by this render", () => {
    // `signOut` is a server action invoked by POST. A form submission reaches it whatever
    // the layout decided to render, which is what makes the guarantee structural.
    renderScreen();
    const signOut = screen.getByRole("button", { name: /sign out/i });
    expect(signOut).toHaveAttribute("type", "submit");
    expect(signOut.closest("form")).not.toBeNull();
  });
});

describe("there is NO decline control", () => {
  it("renders exactly two buttons: accept and sign out", () => {
    renderScreen();
    const names = screen.getAllByRole("button").map((button) => button.textContent ?? "");

    expect(names).toHaveLength(2);
    expect(names.some((name) => /agree and continue/i.test(name))).toBe(true);
    expect(names.some((name) => /sign out/i.test(name))).toBe(true);
  });

  it.each(["decline", "not now", "no thanks", "reject", "disagree", "cancel", "skip"])(
    "renders no %s control",
    (label) => {
      // Declining is the ABSENCE of accepting. It writes nothing, deletes nothing, and is
      // not withdrawal — feature 018 owns that (§7.5, FR-042). A decline button would have
      // to do something, and there is nothing honest for it to do.
      renderScreen();
      expect(
        screen.queryByRole("button", { name: new RegExp(label, "i") }),
      ).not.toBeInTheDocument();
      expect(
        screen.queryByRole("link", { name: new RegExp(label, "i") }),
      ).not.toBeInTheDocument();
    },
  );
});

describe("accepting", () => {
  it("invokes the write action exactly ONCE, with the consent key as its only argument", () => {
    // CORRECTED TASK TEXT. T069 as written asserted the action is "invoked exactly once
    // with a registry-resolved version id". It has no version parameter, deliberately and
    // structurally: `components/consent/actions.ts:24-48` resolves `document_version` from
    // the registry INSIDE the action precisely so no caller can name the revision a record
    // is written against, which would open a second instance of the forgeable-version
    // problem `plan.md` §15 R8 documents on the signup path. The assertion that survives
    // is the call shape — one argument, the key — plus the negative below.
    const onGrant = vi.fn(async () => ({ status: "ok" }) as const);
    renderScreen(onGrant);

    return userEvent.click(screen.getByRole("button", { name: /agree and continue/i })).then(
      () => {
        expect(onGrant).toHaveBeenCalledTimes(1);
        expect(onGrant).toHaveBeenCalledWith("terms_privacy");
      },
    );
  });

  it("passes NO version argument — the version is not the caller's to name", async () => {
    const onGrant = vi.fn(async () => ({ status: "ok" }) as const);
    renderScreen(onGrant);

    await userEvent.click(screen.getByRole("button", { name: /agree and continue/i }));

    const call = onGrant.mock.calls[0];
    expect(call).toHaveLength(1);
    expect(call?.[0]).toBe("terms_privacy");
  });

  it("refreshes on success, so the app itself is the confirmation", async () => {
    renderScreen();
    await userEvent.click(screen.getByRole("button", { name: /agree and continue/i }));
    expect(refresh).toHaveBeenCalledTimes(1);
  });

  it("surfaces a failed write and does not refresh", async () => {
    const onGrant = vi.fn(async () => ({ status: "error" }) as const);
    renderScreen(onGrant);

    await userEvent.click(screen.getByRole("button", { name: /agree and continue/i }));

    expect(await screen.findByRole("alert")).toHaveTextContent(/not saved/i);
    expect(refresh).not.toHaveBeenCalled();
  });
});

describe("the version id is displayed, not submitted", () => {
  it("shows the server-resolved revision the acknowledgement will record", () => {
    renderScreen();
    expect(screen.getByText(new RegExp(VERSION_ID))).toBeInTheDocument();
  });
});

describe("accessibility floor (FR-053)", () => {
  it("every interactive element is natively focusable and never removed from tab order", () => {
    renderScreen();
    const interactive = [...screen.getAllByRole("link"), ...screen.getAllByRole("button")];
    expect(interactive.length).toBeGreaterThan(0);

    for (const element of interactive) {
      expect(["A", "BUTTON"]).toContain(element.tagName);
      expect(element.getAttribute("tabindex")).not.toBe("-1");
    }
  });

  it("every interactive element carries a visible focus indicator", () => {
    // Asserted on the class list rather than on computed styles: happy-dom does not
    // evaluate the Tailwind build, so the honest thing to check is that each control
    // declares a focus ring at all — the utility that produces one cannot be absent.
    renderScreen();
    const interactive = [...screen.getAllByRole("link"), ...screen.getAllByRole("button")];

    for (const element of interactive) {
      expect(element.className).toMatch(/focus-visible:ring-2/);
    }
  });
});
