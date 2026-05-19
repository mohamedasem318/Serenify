import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";

import LoginPage from "@/app/(auth)/login/page";

vi.mock("@/app/(auth)/login/login-form", () => ({
  LoginForm: () => <div data-testid="login-form" />,
}));

const NOTICE_COPY =
  "Your activation link expired. Please sign in below.";

describe("LoginPage", () => {
  it("renders the expired-link notice when ?error=expired_link", async () => {
    const ui = await LoginPage({
      searchParams: Promise.resolve({ error: "expired_link" }),
    });
    render(ui);

    const notice = screen.getByRole("status");
    expect(notice).toHaveTextContent(NOTICE_COPY);
  });

  it("renders no notice when the error param is absent", async () => {
    const ui = await LoginPage({
      searchParams: Promise.resolve({}),
    });
    render(ui);

    expect(screen.queryByRole("status")).toBeNull();
  });

  it("renders no notice for unknown error values", async () => {
    const ui = await LoginPage({
      searchParams: Promise.resolve({ error: "something_else" }),
    });
    render(ui);

    expect(screen.queryByRole("status")).toBeNull();
  });
});
