import { render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/**
 * T071 — the shell gate FAILS OPEN, and says so out loud (§7.3, R2).
 *
 * THE ASYMMETRY IS DELIBERATE AND BOTH DIRECTIONS ARE PINNED. This gate fails **OPEN**;
 * the camera gate fails **CLOSED** (`tests/unit/lib/consent/fail-closed.test.ts`, T054).
 * The question either way is what a failure costs. Failing open on Terms costs a user
 * briefly reaching the app before acknowledging, and they meet the gate on their next
 * navigation. Failing open on camera consent costs a video captured and inferred with no
 * recorded consent. Those are not comparable, so they get opposite defaults — and both
 * are asserted so neither can quietly drift toward the other.
 *
 * THE LOG LINE IS HALF THE REQUIREMENT. A *transient* read failure is what fail-open is
 * for. A *persistent* one — an RLS policy wrong after a migration, a dropped grant, a
 * renamed column — silently disables the Terms gate for every user while the app looks
 * perfectly healthy. Every fail-open path therefore emits `[consent-gate] FAIL-OPEN`, and
 * the happy path emits nothing, so a steady stream of the line means an outage rather
 * than noise.
 *
 * The three failure modes are driven through the REAL `lib/consent/read.ts` rather than by
 * mocking its return, because two of them — a null `data` and a client that throws — are
 * shapes that module is responsible for normalising. Mocking the result would assert the
 * layout against a shape the read might have stopped producing.
 */

const USER_ID = "22222222-2222-4222-8222-222222222222";
const LOG_PREFIX = "[consent-gate] FAIL-OPEN";

vi.mock("@/lib/consent/registry", () => ({
  CONSENT_REGISTRY: {
    terms_privacy: [
      {
        versionId: "terms_privacy@2020-01-01.1",
        publishedOn: "2020-01-01",
        materiality: "material",
        rationale: "stub",
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

import AuthedLayout from "@/app/(authed)/layout";

/**
 * A Supabase double whose `user_consents` read fails in one of the four ways the gate has
 * to survive. `profiles` always succeeds, so a failure below is unambiguously the consent
 * read's.
 */
type FailureMode = "errors" | "null-data" | "throws" | "unreadable-rows" | "ok-empty";

function supabaseFailing(mode: FailureMode) {
  const consentChain: Record<string, unknown> = {
    eq: () => consentChain,
    then: (resolve: (value: unknown) => unknown, reject: (reason: unknown) => unknown) => {
      switch (mode) {
        case "errors":
          // A Postgrest error — a dropped grant, a renamed column, an RLS policy that
          // rejects rather than filters.
          return resolve({
            data: null,
            error: { code: "42501", message: "permission denied for table user_consents" },
          });
        case "null-data":
          // No error and no rows array. Not a shape the client documents, which is why
          // read.ts refuses to read it as "consented to nothing".
          return resolve({ data: null, error: null });
        case "unreadable-rows":
          // A 2xx response whose body is not a list of rows at all.
          return resolve({ data: { unexpected: "shape" }, error: null });
        case "throws":
          // A network failure, an aborted request, a client that rejects.
          return reject(new Error("socket hang up"));
        case "ok-empty":
          return resolve({ data: [], error: null });
      }
    },
  };

  return {
    auth: {
      getUser: async () => ({ data: { user: { id: USER_ID, email: "sam@example.com" } } }),
    },
    from: (table: string) =>
      table === "user_consents"
        ? { select: () => consentChain }
        : {
            select: () => ({
              eq: () => ({
                maybeSingle: async () => ({ data: { full_name: "Sam", role: "employee" } }),
              }),
            }),
          },
  };
}

let consoleError: ReturnType<typeof vi.spyOn>;

beforeEach(() => {
  gate.redirect.mockClear();
  gate.createClient.mockReset();
  gate.env.consentEntryGateEnabled = true;
  consoleError = vi.spyOn(console, "error").mockImplementation(() => {});
});

afterEach(() => {
  consoleError.mockRestore();
});

/** Every `console.error` call whose first argument is the fail-open line. */
function failOpenCalls() {
  return consoleError.mock.calls.filter(
    (call) => typeof call[0] === "string" && call[0].startsWith(LOG_PREFIX),
  );
}

async function renderWith(mode: FailureMode) {
  gate.createClient.mockResolvedValue(supabaseFailing(mode));
  render(await AuthedLayout({ children: <div data-testid="route-child" /> }));
}

describe("every read failure renders the NORMAL shell — the gate fails OPEN", () => {
  it.each([
    ["a read that ERRORS", "errors"],
    ["a read that returns NULL", "null-data"],
    ["a read that is otherwise UNREADABLE", "unreadable-rows"],
    ["a client that THROWS", "throws"],
  ])("%s does not block the user", async (_label, mode) => {
    await renderWith(mode as FailureMode);

    expect(screen.getByTestId("app-header")).toBeInTheDocument();
    expect(screen.getByTestId("route-child")).toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: /have been revised/i })).not.toBeInTheDocument();
  });
});

describe("every fail-open path emits the log line", () => {
  it.each([
    ["a read that ERRORS", "errors"],
    ["a read that returns NULL", "null-data"],
    ["a read that is otherwise UNREADABLE", "unreadable-rows"],
    ["a client that THROWS", "throws"],
  ])("%s emits [consent-gate] FAIL-OPEN exactly once", async (_label, mode) => {
    await renderWith(mode as FailureMode);

    const calls = failOpenCalls();
    expect(calls).toHaveLength(1);
    expect(calls[0]?.[0]).toBe(
      "[consent-gate] FAIL-OPEN: terms_privacy gate disabled for this request",
    );
  });

  it.each([
    ["a read that ERRORS", "errors"],
    ["a read that returns NULL", "null-data"],
    ["a read that is otherwise UNREADABLE", "unreadable-rows"],
    ["a client that THROWS", "throws"],
  ])("%s carries the user id and the underlying error", async (_label, mode) => {
    await renderWith(mode as FailureMode);

    const payload = failOpenCalls()[0]?.[1] as {
      userId?: string;
      reason?: string;
      error?: unknown;
    };

    // The user id is what turns "the gate is off somewhere" into "the gate is off for
    // these accounts", which is the difference between a log line and an investigation.
    expect(payload?.userId).toBe(USER_ID);

    // `error` is never null on any fail-open path — read.ts synthesises one even for the
    // null-data case (`lib/consent/read.ts:97-99`), so this holds for all four modes.
    expect(payload?.error).toBeDefined();
    expect(payload?.error).not.toBeNull();

    // CHOSEN PAYLOAD SHAPE. `reason` sits alongside `error`, not instead of it. `Error`'s
    // `message` and `stack` are non-enumerable, so `JSON.stringify(new Error("x"))` is
    // `"{}"` — in a structured log pipeline the SYNTHESISED-error mode is the one most
    // likely to arrive as an empty object, and that is precisely the mode a persistent
    // RLS defect produces. A plain string always survives serialisation.
    expect(payload?.reason).toBe("consent-read-unreadable");
  });
});

describe("a gate that THROWS also fails open, under its own reason", () => {
  it("logs reason=gate-threw and renders the normal shell", async () => {
    // The evaluator throws on a key with no published revision. Uncaught, that is a crash
    // in the one layout every authed route renders through — the exact lockout this gate
    // is built to be incapable of.
    vi.resetModules();
    vi.doMock("@/lib/consent/registry", () => ({
      CONSENT_REGISTRY: { terms_privacy: [], camera_inference: [] },
    }));

    const { default: LayoutWithEmptyRegistry } = await import("@/app/(authed)/layout");
    gate.createClient.mockResolvedValue(supabaseFailing("ok-empty"));

    render(await LayoutWithEmptyRegistry({ children: <div data-testid="route-child" /> }));

    expect(screen.getByTestId("app-header")).toBeInTheDocument();

    const payload = failOpenCalls()[0]?.[1] as { userId?: string; reason?: string };
    expect(payload?.reason).toBe("gate-threw");
    expect(payload?.userId).toBe(USER_ID);

    vi.doUnmock("@/lib/consent/registry");
    vi.resetModules();
  });
});

describe("the happy path is SILENT, so the signal means something", () => {
  it("a successful read that blocks emits no fail-open line", async () => {
    gate.createClient.mockResolvedValue(supabaseFailing("ok-empty"));
    render(await AuthedLayout({ children: <div /> }));

    // Zero rows is a real, expected answer meaning *not consented* — every pre-existing
    // user has exactly this (§7.4). It blocks, and it is not a failure.
    expect(screen.getByRole("heading", { name: /have been revised/i })).toBeInTheDocument();
    expect(failOpenCalls()).toHaveLength(0);
  });

  it("a successful read that allows emits no fail-open line", async () => {
    const consentChain: Record<string, unknown> = {
      eq: () => consentChain,
      then: (resolve: (value: unknown) => unknown) =>
        resolve({ data: [{ document_version: "terms_privacy@2020-01-01.1" }], error: null }),
    };
    gate.createClient.mockResolvedValue({
      auth: {
        getUser: async () => ({ data: { user: { id: USER_ID, email: "sam@example.com" } } }),
      },
      from: (table: string) =>
        table === "user_consents"
          ? { select: () => consentChain }
          : {
              select: () => ({
                eq: () => ({
                  maybeSingle: async () => ({ data: { full_name: "Sam", role: "employee" } }),
                }),
              }),
            },
    });

    render(await AuthedLayout({ children: <div data-testid="route-child" /> }));

    expect(screen.getByTestId("app-header")).toBeInTheDocument();
    expect(failOpenCalls()).toHaveLength(0);
  });
});
