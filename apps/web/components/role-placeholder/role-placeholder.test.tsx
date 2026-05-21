import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";

import { RolePlaceholder } from "@/components/role-placeholder/role-placeholder";

// Decision-M locked subtitle from the employee welcome banner — the
// placeholder must NOT render this; it would mean an employee got
// rendered by the manager branch (or vice versa).
const EMPLOYEE_SUBTITLE = "A space to check in with yourself.";

describe("RolePlaceholder — team_lead variant", () => {
  it("renders the locked Decision L heading", () => {
    render(<RolePlaceholder role="team_lead" />);
    expect(
      screen.getByRole("heading", {
        name: "Your team-lead view is coming together.",
        level: 1,
      }),
    ).toBeInTheDocument();
  });

  it("renders the locked Decision L subtitle", () => {
    render(<RolePlaceholder role="team_lead" />);
    expect(
      screen.getByText(
        "We're building something that respects your team's privacy. Check back soon.",
      ),
    ).toBeInTheDocument();
  });

  it("does NOT render the admin copy variant", () => {
    render(<RolePlaceholder role="team_lead" />);
    expect(
      screen.queryByText("Your admin view is in progress."),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByText(/Org-wide tools land in a later release/),
    ).not.toBeInTheDocument();
  });

  it("renders the Sign out button", () => {
    render(<RolePlaceholder role="team_lead" />);
    expect(
      screen.getByRole("button", { name: "Sign out" }),
    ).toBeInTheDocument();
  });
});

describe("RolePlaceholder — admin variant", () => {
  it("renders the locked Decision L heading", () => {
    render(<RolePlaceholder role="admin" />);
    expect(
      screen.getByRole("heading", {
        name: "Your admin view is in progress.",
        level: 1,
      }),
    ).toBeInTheDocument();
  });

  it("renders the locked Decision L subtitle", () => {
    render(<RolePlaceholder role="admin" />);
    expect(
      screen.getByText(
        "Org-wide tools land in a later release. Account settings are available below.",
      ),
    ).toBeInTheDocument();
  });

  it("does NOT render the team_lead copy variant", () => {
    render(<RolePlaceholder role="admin" />);
    expect(
      screen.queryByText("Your team-lead view is coming together."),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByText(/respects your team's privacy/),
    ).not.toBeInTheDocument();
  });

  it("renders the Sign out button", () => {
    render(<RolePlaceholder role="admin" />);
    expect(
      screen.getByRole("button", { name: "Sign out" }),
    ).toBeInTheDocument();
  });
});

describe("RolePlaceholder — manager-only contract guards", () => {
  it("does NOT render the employee welcome-banner subtitle (team_lead)", () => {
    render(<RolePlaceholder role="team_lead" />);
    expect(screen.queryByText(EMPLOYEE_SUBTITLE)).not.toBeInTheDocument();
  });

  it("does NOT render the employee welcome-banner subtitle (admin)", () => {
    render(<RolePlaceholder role="admin" />);
    expect(screen.queryByText(EMPLOYEE_SUBTITLE)).not.toBeInTheDocument();
  });

  // The chat pill is gated employee-only at the (authed) layout
  // level (13be4f2 / FR-035). RolePlaceholder itself never mounts
  // it. This assertion exercises the contract from the component's
  // perspective: no pill in this rendered subtree under any role.
  it("does NOT render the chat pill on the team_lead variant", () => {
    render(<RolePlaceholder role="team_lead" />);
    expect(
      screen.queryByRole("button", { name: "Chat" }),
    ).not.toBeInTheDocument();
    expect(screen.queryByTestId("chat-pill")).not.toBeInTheDocument();
  });

  it("does NOT render the chat pill on the admin variant", () => {
    render(<RolePlaceholder role="admin" />);
    expect(
      screen.queryByRole("button", { name: "Chat" }),
    ).not.toBeInTheDocument();
    expect(screen.queryByTestId("chat-pill")).not.toBeInTheDocument();
  });
});
