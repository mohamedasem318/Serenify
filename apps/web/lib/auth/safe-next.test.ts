import { describe, expect, it } from "vitest";

import { isSafeNextPath } from "@/lib/auth/safe-next";

describe("isSafeNextPath — open-redirect validator (📌 slice 2 Finding 1)", () => {
  it.each([
    "/",
    "/app",
    "/app/account",
    "/onboarding",
    "/reset-password",
    "/app?foo=bar",
    "/app#section",
    // The app's only two real `next` values, plus a query+fragment combo.
    "/app?next=/onboarding",
    "/app/account#security",
  ])("accepts the legitimate relative path %s", (next) => {
    expect(isSafeNextPath(next)).toBe(true);
  });

  it.each([
    // Empirically-verified attack vectors, verbatim from the Finding 1 proof.
    // `@evil.com` / `.evil.com` are the two that ACTUALLY broke out under the
    // old `${origin}${next}` concatenation; the rest are neutralised by the
    // prefix but must still be rejected so a future `new URL(next, origin)`
    // refactor can't quietly become exploitable.
    "@evil.com",
    "@evil.com/",
    ".evil.com",
    ".evil.com/phish",
    "evil.com",
    "-evil.com",
    "//evil.com",
    "https://evil.com",
    "javascript:alert(1)",
  ])("rejects the attack vector %s", (next) => {
    expect(isSafeNextPath(next)).toBe(false);
  });

  it.each([
    // Edge cases: empties, backslash variants, mixed traversal.
    "",
    "\\app",
    "/\\..\\..\\etc",
    "\\\\evil.com",
    "  /app", // leading whitespace breaks the ^/ anchor
  ])("rejects the edge case %j", (next) => {
    expect(isSafeNextPath(next)).toBe(false);
  });

  it("rejects null / undefined (coerced to string)", () => {
    // The signature is (next: string), but defence-in-depth: a coerced
    // null/undefined ("null"/"undefined") must not start with "/".
    expect(isSafeNextPath(null as unknown as string)).toBe(false);
    expect(isSafeNextPath(undefined as unknown as string)).toBe(false);
  });
});
