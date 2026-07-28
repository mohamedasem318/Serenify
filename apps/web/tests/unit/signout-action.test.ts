import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * The sign-out Server Action — session scope, and what happens when revoke fails.
 *
 * Two separate concerns, both previously unhandled:
 *
 * 1. SCOPE. `supabase.auth.signOut()` defaults to `{ scope: "global" }`
 *    (GoTrueClient), which revokes the refresh token for every session of this
 *    user on every device. Signing out of a laptop should not end the session on
 *    a phone. This does NOT change cross-tab behaviour — sibling tabs share one
 *    cookie jar, one refresh token and therefore one session, so "local" ends
 *    theirs too. It is a cross-DEVICE fix, not a fix for the sign-out race.
 *
 * 2. FAILED REVOKE. supabase-js clears the local session only when the logout
 *    request succeeds or fails with 401/403/404. On anything else — a network
 *    timeout surfaces as AuthRetryableFetchError, which is not an AuthApiError —
 *    `_signOut` returns early WITHOUT clearing, and `_removeSession` is private,
 *    so there is no public API to force it. The old code discarded the return
 *    value entirely and redirected anyway, which left the user holding valid
 *    cookies on /login — where proxy.ts bounced them straight back to /app. That
 *    is the "sometimes a refresh doesn't land on the login screen" symptom.
 */

const mocks = vi.hoisted(() => ({
  signOut: vi.fn(),
  getAll: vi.fn(),
  del: vi.fn(),
  redirect: vi.fn(),
}));

vi.mock("@/lib/supabase/server", () => ({
  createClient: async () => ({ auth: { signOut: mocks.signOut } }),
}));

vi.mock("next/headers", () => ({
  cookies: async () => ({ getAll: mocks.getAll, delete: mocks.del }),
}));

vi.mock("next/navigation", () => ({ redirect: mocks.redirect }));

const { signOut } = await import("@/app/(authed)/actions");

/** A realistic jar: the base session cookie, one chunk, and an unrelated cookie. */
function jar() {
  return [
    { name: "sb-excukdzjudslbqmkysrc-auth-token", value: "a" },
    { name: "sb-excukdzjudslbqmkysrc-auth-token.0", value: "b" },
    { name: "serenify-theme", value: "dark" },
  ];
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.signOut.mockResolvedValue({ error: null });
  mocks.getAll.mockReturnValue(jar());
});

describe("signOut server action", () => {
  it("revokes only this session, not every device", async () => {
    await signOut();

    expect(mocks.signOut).toHaveBeenCalledWith({ scope: "local" });
  });

  it("clears the auth cookies itself when the revoke fails", async () => {
    mocks.signOut.mockResolvedValue({
      error: { name: "AuthRetryableFetchError", status: 0, message: "fetch failed" },
    });

    await signOut();

    const deleted = mocks.del.mock.calls.map(([name]) => name);
    expect(deleted).toEqual([
      "sb-excukdzjudslbqmkysrc-auth-token",
      "sb-excukdzjudslbqmkysrc-auth-token.0",
    ]);
  });

  it("leaves non-Supabase cookies alone when clearing", async () => {
    mocks.signOut.mockResolvedValue({
      error: { name: "AuthRetryableFetchError", status: 0, message: "fetch failed" },
    });

    await signOut();

    expect(mocks.del.mock.calls.map(([name]) => name)).not.toContain("serenify-theme");
  });

  // Regression guard — green before this change too. Kept because the failure
  // branch above adds an early exit that a careless edit could return through.
  it("still redirects to /login when the revoke fails", async () => {
    mocks.signOut.mockResolvedValue({
      error: { name: "AuthRetryableFetchError", status: 0, message: "fetch failed" },
    });

    await signOut();

    expect(mocks.redirect).toHaveBeenCalledWith("/login");
  });

  it("does not touch cookies when the revoke succeeds", async () => {
    await signOut();

    expect(mocks.del).not.toHaveBeenCalled();
    expect(mocks.redirect).toHaveBeenCalledWith("/login");
  });
});
