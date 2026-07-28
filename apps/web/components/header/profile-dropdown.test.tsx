import { describe, expect, it, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

const { signOutMock } = vi.hoisted(() => ({ signOutMock: vi.fn() }));
vi.mock("@/app/(authed)/actions", () => ({
  signOut: signOutMock,
}));

import { ProfileDropdown } from "@/components/header/profile-dropdown";

describe("ProfileDropdown", () => {
  beforeEach(() => {
    signOutMock.mockClear();
  });

  it("renders the avatar trigger with initials derived from full_name", () => {
    render(
      <ProfileDropdown
        fullName="Jane Doe"
        email="jane@demo.serenify.local"
      />,
    );
    const trigger = screen.getByLabelText("Open profile menu");
    expect(trigger).toHaveTextContent("JD");
  });

  it("falls back to email-local-part initials when full_name is null", () => {
    render(
      <ProfileDropdown fullName={null} email="alex@demo.serenify.local" />,
    );
    expect(screen.getByLabelText("Open profile menu")).toHaveTextContent("AL");
  });

  it("derives two-letter initials from a single-token name", () => {
    render(
      <ProfileDropdown fullName="Cher" email="cher@demo.serenify.local" />,
    );
    expect(screen.getByLabelText("Open profile menu")).toHaveTextContent("CH");
  });

  it("opens on click and shows exactly three items in the documented order", async () => {
    const user = userEvent.setup();
    render(
      <ProfileDropdown
        fullName="Jane Doe"
        email="jane@demo.serenify.local"
      />,
    );

    await user.click(screen.getByLabelText("Open profile menu"));

    const name = screen.getByTestId("profile-dropdown-name");
    const account = screen.getByTestId("profile-dropdown-account");
    const signOut = screen.getByTestId("profile-dropdown-signout");

    expect(name).toHaveTextContent("Jane Doe");
    expect(account).toHaveAttribute("href", "/app/account");
    expect(signOut).toHaveTextContent("Sign out");

    const order = [name, account, signOut].map((el) =>
      el.compareDocumentPosition(account),
    );
    expect(
      name.compareDocumentPosition(account) &
        Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeGreaterThan(0);
    expect(
      account.compareDocumentPosition(signOut) &
        Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeGreaterThan(0);
    expect(order).toBeDefined();
  });

  it("truncates the display name to 24 characters with a Unicode ellipsis", async () => {
    const user = userEvent.setup();
    render(
      <ProfileDropdown
        fullName="Aaaaaaaaaaaaaaaaaaaaaaaaaaaa Bbbbbb"
        email="long@demo.serenify.local"
      />,
    );

    await user.click(screen.getByLabelText("Open profile menu"));

    const name = screen.getByTestId("profile-dropdown-name");
    expect(name.textContent).toMatch(/…$/);
    expect(name.textContent?.length).toBe(24);
  });

  it("triggers the sign-out form submit when the Sign out item is selected", async () => {
    const user = userEvent.setup();
    render(
      <ProfileDropdown
        fullName="Jane Doe"
        email="jane@demo.serenify.local"
      />,
    );

    await user.click(screen.getByLabelText("Open profile menu"));
    const signOut = screen.getByTestId("profile-dropdown-signout");

    const form = document.querySelector("form");
    expect(form).not.toBeNull();
    const requestSubmitSpy = vi.spyOn(form!, "requestSubmit");

    await user.click(signOut);

    expect(requestSubmitSpy).toHaveBeenCalledTimes(1);
  });

  it("shows a pending label on the item once sign-out is under way", async () => {
    const user = userEvent.setup();
    render(
      <ProfileDropdown fullName="Jane Doe" email="jane@demo.serenify.local" />,
    );

    await user.click(screen.getByLabelText("Open profile menu"));
    await user.click(screen.getByTestId("profile-dropdown-signout"));

    // The item is a sibling of the form, outside the Radix portal, so
    // useFormStatus cannot see it — this is its equivalent signal.
    expect(screen.getByTestId("profile-dropdown-signout")).toHaveTextContent(
      "Signing out…",
    );
  });

  it("disables the item while signing out, so it cannot fire twice", async () => {
    const user = userEvent.setup();
    render(
      <ProfileDropdown fullName="Jane Doe" email="jane@demo.serenify.local" />,
    );

    await user.click(screen.getByLabelText("Open profile menu"));
    await user.click(screen.getByTestId("profile-dropdown-signout"));

    expect(screen.getByTestId("profile-dropdown-signout")).toHaveAttribute(
      "data-disabled",
    );
  });

  it("gives both menu items a 44px touch target", async () => {
    const user = userEvent.setup();
    render(
      <ProfileDropdown fullName="Jane Doe" email="jane@demo.serenify.local" />,
    );

    await user.click(screen.getByLabelText("Open profile menu"));

    expect(screen.getByTestId("profile-dropdown-account").className).toMatch(
      /min-h-11/,
    );
    expect(screen.getByTestId("profile-dropdown-signout").className).toMatch(
      /min-h-11/,
    );
  });
});
