import { describe, expect, it, vi, beforeEach } from "vitest";

import { signUpSchema } from "@/lib/auth/schemas";
import { TERMS_ACK_REQUIRED_MESSAGE } from "@/lib/consent/copy";

/**
 * T053 — the signup gate, asserted at both layers it exists in: the schema shape that
 * makes an unacknowledged submission unparseable, and the action's rejection contract
 * that makes an unparseable submission create no account.
 *
 * The load-bearing assertion in the first half is the NEGATIVE one — that no default
 * value can satisfy `accept_terms`. FR-033 is not "there is a checkbox"; it is "the
 * acknowledgement is an active choice". A schema that accepted a missing field as false
 * would still render a checkbox and would still be broken.
 */

const VALID_VERSION = "terms_privacy@2026-07-26.1";

const credentials = {
  email: "alex@example.com",
  password: "Goodpass1",
  full_name: "Alex",
};

describe("signUpSchema — accept_terms cannot be satisfied by a default (FR-033)", () => {
  it("rejects a payload where accept_terms is simply OMITTED", () => {
    // The one that matters most. An unchecked HTML checkbox submits NOTHING, so this is
    // the exact shape a real unacknowledged submission has. If a default ever made this
    // parse, every visitor would be silently consented on submit.
    const result = signUpSchema.safeParse({
      ...credentials,
      terms_privacy_version: VALID_VERSION,
    });
    expect(result.success).toBe(false);
  });

  it.each([
    ["off", "off"],
    ["false (string)", "false"],
    ["empty string", ""],
    ["boolean false", false],
    ["boolean true", true],
    ["null", null],
    ["undefined", undefined],
    ["the number 1", 1],
    ["'ON' in the wrong case", "ON"],
  ])("rejects accept_terms = %s", (_label, value) => {
    const result = signUpSchema.safeParse({
      ...credentials,
      accept_terms: value,
      terms_privacy_version: VALID_VERSION,
    });
    expect(result.success).toBe(false);
  });

  it("accepts ONLY the literal string 'on'", () => {
    const result = signUpSchema.safeParse({
      ...credentials,
      accept_terms: "on",
      terms_privacy_version: VALID_VERSION,
    });
    expect(result.success).toBe(true);
  });

  it("carries the field-scoped message §7.1 fixes, on the accept_terms path", () => {
    const result = signUpSchema.safeParse({
      ...credentials,
      terms_privacy_version: VALID_VERSION,
    });
    expect(result.success).toBe(false);
    if (result.success) return;

    const issue = result.error.issues.find((i) => i.path[0] === "accept_terms");
    expect(issue, "the failure must be attributed to accept_terms, not to the form").toBeDefined();
    expect(issue?.message).toBe(TERMS_ACK_REQUIRED_MESSAGE);
  });
});

describe("signUpSchema — terms_privacy_version is required", () => {
  it.each([
    ["omitted", undefined],
    ["empty", ""],
  ])("rejects a %s version id", (_label, value) => {
    const payload: Record<string, unknown> = { ...credentials, accept_terms: "on" };
    if (value !== undefined) payload.terms_privacy_version = value;
    expect(signUpSchema.safeParse(payload).success).toBe(false);
  });
});

// ── The action's rejection contract ──────────────────────────────────────────
//
// The schema proves a bad submission cannot parse. This half proves that a submission
// which cannot parse never reaches supabase.auth.signUp — which is the claim that
// actually matters, because "no account is created" is the acceptance criterion, not
// "the parse failed".

const signUpMock = vi.fn();
const createClientMock = vi.fn(async () => ({ auth: { signUp: signUpMock } }));

vi.mock("@/lib/supabase/server", () => ({
  createClient: () => createClientMock(),
}));

vi.mock("@/lib/env/server", () => ({
  serverEnv: { siteUrl: "https://example.test" },
}));

function formOf(entries: Record<string, string>): FormData {
  const form = new FormData();
  for (const [key, value] of Object.entries(entries)) form.set(key, value);
  return form;
}

describe("signUp() — an unacknowledged submission creates nothing", () => {
  beforeEach(() => {
    signUpMock.mockReset();
    createClientMock.mockClear();
    signUpMock.mockResolvedValue({ data: { user: { identities: [{}] } }, error: null });
  });

  it("returns a field-scoped validation result and never calls supabase.auth.signUp", async () => {
    const { signUp } = await import("@/app/(auth)/signup/actions");

    const result = await signUp(
      formOf({ ...credentials, terms_privacy_version: VALID_VERSION }),
    );

    expect(result).toMatchObject({ status: "validation", field: "accept_terms" });
    // The whole point. Not "it returned an error" — "no account exists".
    expect(signUpMock).not.toHaveBeenCalled();
  });

  it("returns stale_terms for a version that is not the current one, and creates nothing", async () => {
    const { signUp } = await import("@/app/(auth)/signup/actions");

    const result = await signUp(
      formOf({
        ...credentials,
        accept_terms: "on",
        terms_privacy_version: "terms_privacy@2020-01-01.1",
      }),
    );

    expect(result).toEqual({ status: "stale_terms" });
    expect(signUpMock).not.toHaveBeenCalled();
  });

  it("passes the SERVER's version id into options.data, never the form's", async () => {
    const { signUp } = await import("@/app/(auth)/signup/actions");
    const { currentRevision } = await import("@/lib/consent/evaluate");

    await signUp(
      formOf({ ...credentials, accept_terms: "on", terms_privacy_version: VALID_VERSION }),
    );

    expect(signUpMock).toHaveBeenCalledTimes(1);
    const options = signUpMock.mock.calls[0]?.[0]?.options;
    // The metadata KEY is load-bearing: handle_new_user() reads exactly this name, and
    // a different one writes no consent row at all.
    expect(options.data.terms_privacy_version).toBe(
      currentRevision("terms_privacy").versionId,
    );
    expect(options.data.full_name).toBe("Alex");
  });
});
