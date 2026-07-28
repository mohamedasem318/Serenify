import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * T072 — `CONSENT_ENTRY_GATE_ENABLED` actually switches the gate off (§7.3 lever 2).
 *
 * AN UNTESTED KILL SWITCH IS NOT A KILL SWITCH. This is the unit-level counterpart to
 * ST-10's manual exercise of the same lever: the moment it is needed is the moment nobody
 * has time to discover it never worked.
 *
 * THE FLAG IS CHECKED BEFORE THE READ, NOT AFTER, and that is asserted rather than
 * assumed. T072 as written accepted either "the consent read is skipped or ignored"; it
 * is skipped. If the gate were disabled and the read still ran and failed, the
 * `[consent-gate] FAIL-OPEN` line would fire for a gate nobody is running — and that
 * line's entire value is that a steady stream of it means a real outage. Firing it for a
 * deliberately disabled gate destroys the signal T067 exists to create.
 */

const USER_ID = "33333333-3333-4333-8333-333333333333";

vi.mock("@/lib/consent/registry", () => ({
  CONSENT_REGISTRY: {
    terms_privacy: [
      {
        versionId: "terms_privacy@2020-01-01.1",
        publishedOn: "2020-01-01",
        materiality: "material",
        rationale: "stub",
      },
      {
        versionId: "terms_privacy@2020-06-01.1",
        publishedOn: "2020-06-01",
        materiality: "material",
        rationale: "stub — material, so a v1 holder would be blocked",
      },
    ],
    camera_inference: [
      {
        versionId: "camera_inference@2020-01-01.1",
        publishedOn: "2020-01-01",
        materiality: "material",
        rationale: "stub",
      },
    ],
  },
}));

const gate = vi.hoisted(() => ({
  redirect: vi.fn(),
  createClient: vi.fn(),
  env: { consentEntryGateEnabled: true },
}));

vi.mock("next/navigation", () => ({
  redirect: gate.redirect,
  useRouter: () => ({ refresh: vi.fn(), push: vi.fn(), replace: vi.fn() }),
}));
vi.mock("@/lib/supabase/server", () => ({ createClient: gate.createClient }));
vi.mock("@/lib/env/server", () => ({ serverEnv: gate.env }));
vi.mock("@/components/header/header", () => ({
  Header: () => <header data-testid="app-header" />,
}));
vi.mock("@/components/chat-pill", () => ({
  ChatPill: () => <div data-testid="chat-pill" />,
}));
vi.mock("@/app/(authed)/actions", () => ({ signOut: vi.fn() }));

// Spied, not replaced. The real implementation still runs when the gate is enabled, so
// the "would be blocked" half of every case below is genuine rather than staged.
vi.mock("@/lib/consent/read", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/consent/read")>();
  return { ...actual, readHeldConsentVersions: vi.fn(actual.readHeldConsentVersions) };
});

import AuthedLayout from "@/app/(authed)/layout";
import { readHeldConsentVersions } from "@/lib/consent/read";

/** A user holding only the superseded revision — blocked whenever the gate is on. */
function supabaseForBlockedUser() {
  const consentChain: Record<string, unknown> = {
    eq: () => consentChain,
    then: (resolve: (value: unknown) => unknown) =>
      resolve({ data: [{ document_version: "terms_privacy@2020-01-01.1" }], error: null }),
  };

  return {
    auth: {
      getUser: async () => ({ data: { user: { id: USER_ID, email: "kim@example.com" } } }),
    },
    from: (table: string) =>
      table === "user_consents"
        ? { select: () => consentChain }
        : {
            select: () => ({
              eq: () => ({
                maybeSingle: async () => ({ data: { full_name: "Kim", role: "employee" } }),
              }),
            }),
          },
  };
}

beforeEach(() => {
  gate.redirect.mockClear();
  gate.createClient.mockReset().mockResolvedValue(supabaseForBlockedUser());
  vi.mocked(readHeldConsentVersions).mockClear();
  gate.env.consentEntryGateEnabled = true;
});

describe("with the gate ENABLED, this user is blocked", () => {
  it("renders the re-consent screen", async () => {
    render(await AuthedLayout({ children: <div data-testid="route-child" /> }));

    expect(screen.getByRole("heading", { name: /have been revised/i })).toBeInTheDocument();
    expect(screen.queryByTestId("app-header")).not.toBeInTheDocument();
  });

  it("is blocked by DEFAULT — the enabled state is what an absent variable means", async () => {
    // `lib/env/schema.ts` defaults the flag to enabled, so this is the configuration every
    // environment that has never set the variable is in, production included.
    const { serverEnvSchema } = await import("@/lib/env/schema");
    const parsed = serverEnvSchema.safeParse({
      supabaseUrl: "http://127.0.0.1:54321",
      supabaseAnonKey: "x".repeat(120),
    });
    expect(parsed.success && parsed.data.consentEntryGateEnabled).toBe(true);

    gate.env.consentEntryGateEnabled = parsed.success
      ? parsed.data.consentEntryGateEnabled
      : false;
    render(await AuthedLayout({ children: <div /> }));

    expect(screen.getByRole("heading", { name: /have been revised/i })).toBeInTheDocument();
  });
});

describe("with the gate DISABLED, the same user reaches the app", () => {
  beforeEach(() => {
    gate.env.consentEntryGateEnabled = false;
  });

  it("renders the normal shell", async () => {
    render(await AuthedLayout({ children: <div data-testid="route-child" /> }));

    expect(screen.getByTestId("app-header")).toBeInTheDocument();
    expect(screen.getByTestId("route-child")).toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: /have been revised/i })).not.toBeInTheDocument();
  });

  it("SKIPS the user_consents read entirely — it is not run and ignored", async () => {
    render(await AuthedLayout({ children: <div /> }));

    expect(readHeldConsentVersions).not.toHaveBeenCalled();
  });

  it("emits no [consent-gate] FAIL-OPEN line even when the read WOULD have failed", async () => {
    // The reason the ordering matters, asserted directly. A read that never happens
    // cannot fail, so a deliberately disabled gate stays silent and the log line keeps
    // meaning what T067 built it to mean.
    const throwingChain: Record<string, unknown> = {
      eq: () => throwingChain,
      then: (_resolve: unknown, reject: (reason: unknown) => unknown) =>
        reject(new Error("socket hang up")),
    };
    gate.createClient.mockResolvedValue({
      auth: {
        getUser: async () => ({ data: { user: { id: USER_ID, email: "kim@example.com" } } }),
      },
      from: (table: string) =>
        table === "user_consents"
          ? { select: () => throwingChain }
          : {
              select: () => ({
                eq: () => ({
                  maybeSingle: async () => ({ data: { full_name: "Kim", role: "employee" } }),
                }),
              }),
            },
    });

    const consoleError = vi.spyOn(console, "error").mockImplementation(() => {});
    render(await AuthedLayout({ children: <div /> }));

    expect(readHeldConsentVersions).not.toHaveBeenCalled();
    expect(
      consoleError.mock.calls.filter(
        (call) => typeof call[0] === "string" && call[0].startsWith("[consent-gate] FAIL-OPEN"),
      ),
    ).toHaveLength(0);
    consoleError.mockRestore();
  });

  it("still does not redirect", async () => {
    render(await AuthedLayout({ children: <div /> }));
    expect(gate.redirect).not.toHaveBeenCalled();
  });
});

describe("the lever is reversible in the same process", () => {
  it("off then on blocks the same user again", async () => {
    gate.env.consentEntryGateEnabled = false;
    const { unmount } = render(await AuthedLayout({ children: <div /> }));
    expect(screen.getByTestId("app-header")).toBeInTheDocument();
    unmount();

    gate.env.consentEntryGateEnabled = true;
    render(await AuthedLayout({ children: <div /> }));
    expect(screen.getByRole("heading", { name: /have been revised/i })).toBeInTheDocument();
  });
});
