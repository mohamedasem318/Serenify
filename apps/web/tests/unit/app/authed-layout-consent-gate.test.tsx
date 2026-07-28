import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * T070 — the app-shell entry gate renders a DIFFERENT TREE, and never redirects (§7.3).
 *
 * The last assertion in this file is the one worth the most. `redirect` is mocked and
 * expected to be called ZERO times on every gate path, blocked and unblocked alike. A
 * redirect-based gate can loop — `redirect("/consent")` bounces forever if the destination
 * sits inside the gated group, or if the proxy and the layout disagree about who is
 * responsible — and a loop in the one layout every authed route renders through is a
 * total product lockout. Rendering in place cannot loop. That assertion is what would
 * catch a future "small refactor" reintroducing it.
 *
 * The registry is STUBBED with two material `terms_privacy` revisions, so a user holding
 * only the first is genuinely re-prompted. The real registry publishes one revision today
 * and would make every "holds an earlier version" case unreachable.
 */

const USER_ID = "11111111-1111-4111-8111-111111111111";

/** Two MATERIAL revisions: holding only v1 must therefore re-prompt (FR-043a). */
const V1 = "terms_privacy@2020-01-01.1";
const V2 = "terms_privacy@2020-06-01.1";

vi.mock("@/lib/consent/registry", () => ({
  CONSENT_REGISTRY: {
    terms_privacy: [
      {
        versionId: "terms_privacy@2020-01-01.1",
        publishedOn: "2020-01-01",
        materiality: "material",
        rationale: "stub — the first revision of a text is material by definition",
      },
      {
        versionId: "terms_privacy@2020-06-01.1",
        publishedOn: "2020-06-01",
        materiality: "material",
        rationale: "stub — material, so holders of only v1 are re-prompted",
      },
    ],
    camera_inference: [
      {
        versionId: "camera_inference@2020-01-01.1",
        publishedOn: "2020-01-01",
        materiality: "material",
        rationale: "stub — not exercised by the shell gate",
      },
    ],
  },
}));

const gate = vi.hoisted(() => {
  const redirect = vi.fn();
  const createClient = vi.fn();
  const env = { consentEntryGateEnabled: true };
  return { redirect, createClient, env };
});

vi.mock("next/navigation", () => ({
  redirect: gate.redirect,
  useRouter: () => ({ refresh: vi.fn(), push: vi.fn(), replace: vi.fn() }),
}));

vi.mock("@/lib/supabase/server", () => ({ createClient: gate.createClient }));
vi.mock("@/lib/env/server", () => ({ serverEnv: gate.env }));

// Stubbed so the assertion is about the SHELL, not about the header's own dependency
// graph (theme provider, dropdown primitives, client navigation).
vi.mock("@/components/header/header", () => ({
  Header: () => <header data-testid="app-header" />,
}));
vi.mock("@/components/chat-pill", () => ({
  ChatPill: () => <div data-testid="chat-pill" />,
}));
vi.mock("@/app/(authed)/actions", () => ({ signOut: vi.fn() }));

import AuthedLayout from "@/app/(authed)/layout";
import { satisfiesConsent } from "@/lib/consent/evaluate";

/** A Supabase double whose `user_consents` read returns exactly these version ids. */
function supabaseHolding(heldVersionIds: readonly string[]) {
  const consentRows = heldVersionIds.map((document_version) => ({ document_version }));
  const consentChain: Record<string, unknown> = {
    eq: () => consentChain,
    then: (resolve: (value: unknown) => unknown) =>
      resolve({ data: consentRows, error: null }),
  };

  return {
    auth: {
      getUser: async () => ({ data: { user: { id: USER_ID, email: "alex@example.com" } } }),
    },
    from: (table: string) =>
      table === "user_consents"
        ? { select: () => consentChain }
        : {
            select: () => ({
              eq: () => ({
                maybeSingle: async () => ({
                  data: { full_name: "Alex", role: "employee" },
                }),
              }),
            }),
          },
  };
}

async function renderShell(heldVersionIds: readonly string[]) {
  gate.createClient.mockResolvedValue(supabaseHolding(heldVersionIds));
  render(await AuthedLayout({ children: <div data-testid="route-child" /> }));
}

beforeEach(() => {
  gate.redirect.mockClear();
  gate.createClient.mockReset();
  gate.env.consentEntryGateEnabled = true;
});

describe("a user who holds the binding revision reaches the normal shell", () => {
  it("renders the Header and the route's own children", async () => {
    await renderShell([V2]);

    expect(screen.getByTestId("app-header")).toBeInTheDocument();
    expect(screen.getByTestId("route-child")).toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: /have been revised/i })).not.toBeInTheDocument();
  });

  it("holding BOTH revisions is also satisfied — history is a set, not a slot", async () => {
    await renderShell([V1, V2]);
    expect(screen.getByTestId("app-header")).toBeInTheDocument();
  });
});

describe("a user whose consent predates the binding revision is blocked", () => {
  it.each([
    ["holding only the earlier revision", [V1]],
    ["holding nothing at all", []],
    ["holding a well-formed id that is not in the registry", ["terms_privacy@2099-12-31.1"]],
    ["holding another key's revision", ["camera_inference@2020-01-01.1"]],
  ])("renders the re-consent screen when %s", async (_label, held) => {
    await renderShell(held);

    expect(screen.getByRole("heading", { name: /have been revised/i })).toBeInTheDocument();
    // Not hidden, not disabled — NOT IN THE TREE. The blocked user's shell has no header
    // to navigate from and no chat pill to open.
    expect(screen.queryByTestId("app-header")).not.toBeInTheDocument();
    expect(screen.queryByTestId("chat-pill")).not.toBeInTheDocument();
    expect(screen.queryByTestId("route-child")).not.toBeInTheDocument();
  });

  it("hands the screen the CURRENT revision, not the binding one", async () => {
    // They are the same id in this stub, but the distinction is real: a cosmetic revision
    // published after the binding one is what the user is shown and what gets recorded.
    await renderShell([]);
    expect(screen.getByText(new RegExp(V2))).toBeInTheDocument();
  });
});

describe("blocked/not-blocked matches satisfiesConsent() exactly", () => {
  it.each([
    [[V2]],
    [[V1, V2]],
    [[V1]],
    [[]],
    [["terms_privacy@2099-12-31.1"]],
    [["camera_inference@2020-01-01.1"]],
    [[V1, "terms_privacy@2099-12-31.1"]],
  ])("held=%j", async (held) => {
    await renderShell(held);

    const satisfied = satisfiesConsent("terms_privacy", held);
    const shellRendered = screen.queryByTestId("app-header") !== null;

    // The gate is exactly the evaluator, negated. Any divergence here means the layout
    // grew a second opinion about consent (`research.md` §12.2).
    expect(shellRendered).toBe(satisfied);
  });
});

describe("THE GATE NEVER REDIRECTS", () => {
  it("calls redirect() zero times when the user is BLOCKED", async () => {
    await renderShell([]);
    expect(screen.getByRole("heading", { name: /have been revised/i })).toBeInTheDocument();
    expect(gate.redirect).not.toHaveBeenCalled();
  });

  it("calls redirect() zero times when the user is ALLOWED", async () => {
    await renderShell([V2]);
    expect(screen.getByTestId("app-header")).toBeInTheDocument();
    expect(gate.redirect).not.toHaveBeenCalled();
  });

  it("calls redirect() zero times when the gate is disabled", async () => {
    gate.env.consentEntryGateEnabled = false;
    await renderShell([]);
    expect(gate.redirect).not.toHaveBeenCalled();
  });
});

describe("the pre-existing unauthenticated redirect is untouched", () => {
  it("still redirects to /login when there is no user", async () => {
    // The one redirect in this layout predates the gate and stays exactly as it was.
    // Asserted here so "the gate never redirects" can never be satisfied by deleting it.
    //
    // The real `redirect()` throws to unwind the render, and the mock is made to do the
    // same for this case only — otherwise execution would carry on past a branch that in
    // production always ends there, and the test would be asserting a shape the app never
    // has.
    const unwind = new Error("NEXT_REDIRECT");
    gate.redirect.mockImplementationOnce(() => {
      throw unwind;
    });
    gate.createClient.mockResolvedValue({
      auth: { getUser: async () => ({ data: { user: null } }) },
      from: () => ({
        select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: null }) }) }),
      }),
    });

    await expect(AuthedLayout({ children: <div /> })).rejects.toBe(unwind);

    expect(gate.redirect).toHaveBeenCalledWith("/login");
  });
});
