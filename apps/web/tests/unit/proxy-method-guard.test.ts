import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * The proxy route-gate must apply to document navigations ONLY (GET/HEAD).
 *
 * Why this file exists — the production sign-out bug (2026-07-28). Server Functions
 * are not separate routes: Next dispatches them as a POST to the route they are used
 * on, so `proxy.ts`'s matcher covers them. When the session was revoked mid-flight
 * (a sibling tab broadcasting sign-out completes its own logout in ~100ms while the
 * originating tab's Server Action is still in flight), the gate saw `!user` on a
 * protected path and answered with `NextResponse.redirect(...)` — which defaults to
 * **307**, and 307 preserves method and body. The browser therefore re-POSTed the
 * Server Action to `/login`, where the action id does not resolve:
 *
 *     POST /app  ->  307  ->  POST /login  ->  404 "Server action not found."
 *
 * `server-action-reducer.js` then throws E394 (the response is neither RSC nor an
 * `x-action-redirect`), which surfaces as Next's root error screen — "This page
 * couldn't load". Reproduced against production before the fix.
 *
 * A 303 does NOT fix this: the followed GET still returns a non-RSC response with no
 * `x-action-redirect` header, so the same E394 throw fires with different copy. The
 * only correct transport for an action is the action's OWN response — a redirect at
 * the proxy layer is invisible to the router, because `fetch` follows it silently.
 *
 * Skipping the gate for non-navigations loses nothing: every Server Action reachable
 * on a protected path already performs its own `getUser()` check and handles the
 * no-session case itself (account, chat, onboarding, consent, sign-out). Next's own
 * guidance says exactly this — "Always verify authentication and authorization inside
 * each Server Function rather than relying on Proxy alone"
 * (node_modules/next/dist/docs/01-app/03-api-reference/03-file-conventions/proxy.md).
 *
 * The GET cases below are the regression half: the gate must keep working for real
 * navigations. A future "simplification" that drops the method check entirely would
 * turn these green and the POST cases red.
 */

const USER_ID = "11111111-1111-4111-8111-111111111111";

const mocks = vi.hoisted(() => ({
  getUser: vi.fn(),
  from: vi.fn(),
}));

vi.mock("@/lib/env/client", () => ({
  clientEnv: {
    supabaseUrl: "http://127.0.0.1:54321",
    supabaseAnonKey: "x".repeat(120),
    apiUrl: "http://127.0.0.1:8000",
  },
}));

vi.mock("@supabase/ssr", () => ({
  createServerClient: () => ({
    auth: { getUser: mocks.getUser },
    from: mocks.from,
  }),
}));

const { NextRequest } = await import("next/server");
const { proxy } = await import("@/proxy");

/** Signed out. */
function noUser() {
  mocks.getUser.mockResolvedValue({ data: { user: null } });
}

/** Signed in; `fullName: null` means the onboarding gate would fire on a GET. */
function withUser(fullName: string | null) {
  mocks.getUser.mockResolvedValue({ data: { user: { id: USER_ID } } });
  mocks.from.mockReturnValue({
    select: () => ({
      eq: () => ({ maybeSingle: async () => ({ data: { full_name: fullName } }) }),
    }),
  });
}

function request(method: string, path: string) {
  return new NextRequest(new URL(`https://serenify.tech${path}`), { method });
}

/** A gate redirect is a 3xx carrying a Location. Pass-through is 200, no Location. */
function redirectTarget(response: Response): string | null {
  const location = response.headers.get("location");
  return location ? new URL(location).pathname : null;
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("proxy route gate — non-navigation requests", () => {
  it("does not redirect a Server Action POST on a protected path when signed out", async () => {
    noUser();

    const response = await proxy(request("POST", "/app"));

    // The whole bug: a redirect here becomes a re-POSTed action.
    expect(redirectTarget(response)).toBeNull();
    expect(response.status).toBe(200);
  });

  it("does not redirect a Server Action POST when the profile needs onboarding", async () => {
    withUser(null);

    const response = await proxy(request("POST", "/app"));

    expect(redirectTarget(response)).toBeNull();
  });

  it("skips the profiles lookup entirely on a non-navigation request", async () => {
    withUser(null);

    await proxy(request("POST", "/app"));

    // The onboarding gate is redirect-only, so on a POST the query is pure latency —
    // one round trip to Frankfurt on every Server Action call.
    expect(mocks.from).not.toHaveBeenCalled();
  });
});

describe("proxy route gate — navigations still gated", () => {
  it("redirects a signed-out GET on a protected path to /login", async () => {
    noUser();

    const response = await proxy(request("GET", "/app"));

    expect(redirectTarget(response)).toBe("/login");
  });

  it("redirects a GET to /onboarding when full_name is null", async () => {
    withUser(null);

    const response = await proxy(request("GET", "/app"));

    expect(redirectTarget(response)).toBe("/onboarding");
  });

  it("redirects a signed-in GET on an auth page to /app", async () => {
    withUser("Omar Nabil");

    const response = await proxy(request("GET", "/login"));

    expect(redirectTarget(response)).toBe("/app");
  });
});
