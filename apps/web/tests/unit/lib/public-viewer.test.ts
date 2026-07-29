import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/**
 * `readPublicViewer` — the auth read behind the public navbar's signed-in state.
 *
 * THIS SUITE IS MOSTLY ABOUT THE FAILURE PATH, and that is deliberate. `/terms` and
 * `/privacy` are legally load-bearing: a blocked user is entitled to read both documents
 * in full (FR-043d), and the re-consent screen links into them as its only way out. A
 * wrong navbar on those routes is a nuisance. A route that 500s because an auth call
 * timed out is a real problem, and it is the failure this function exists to make
 * impossible.
 *
 * So: every path returns. Nothing here throws, and nothing here is allowed to start
 * throwing later without turning a test red.
 */

const createClient = vi.hoisted(() => vi.fn());
vi.mock("@/lib/supabase/server", () => ({ createClient }));

import { readPublicViewer } from "@/lib/public-viewer";

/** A Supabase double whose two calls are individually programmable. */
function client({
  user,
  userThrows,
  profile,
  profileThrows,
}: {
  user?: { id: string; email?: string } | null;
  userThrows?: boolean;
  profile?: { full_name: string | null } | null;
  profileThrows?: boolean;
} = {}) {
  return {
    auth: {
      getUser: vi.fn(async () => {
        if (userThrows) throw new Error("auth unreachable");
        return { data: { user: user ?? null }, error: null };
      }),
    },
    from: vi.fn(() => ({
      select: vi.fn(() => ({
        eq: vi.fn(() => ({
          maybeSingle: vi.fn(async () => {
            if (profileThrows) throw new Error("profiles unreadable");
            return { data: profile ?? null, error: null };
          }),
        })),
      })),
    })),
  };
}

let errorSpy: ReturnType<typeof vi.spyOn>;

beforeEach(() => {
  errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
});

afterEach(() => {
  vi.clearAllMocks();
  errorSpy.mockRestore();
});

describe("readPublicViewer", () => {
  it("returns the viewer's name and email when signed in", async () => {
    createClient.mockResolvedValue(
      client({
        user: { id: "u1", email: "amira@example.com" },
        profile: { full_name: "Amira Hassan" },
      }),
    );

    await expect(readPublicViewer()).resolves.toEqual({
      fullName: "Amira Hassan",
      email: "amira@example.com",
    });
  });

  it("returns null for a signed-out visitor, without reading profiles", async () => {
    // The common case on these routes. A stranger must cost one short-circuited
    // getUser() and nothing else — no profiles round trip for a row that cannot exist.
    const supabase = client({ user: null });
    createClient.mockResolvedValue(supabase);

    await expect(readPublicViewer()).resolves.toBeNull();
    expect(supabase.from).not.toHaveBeenCalled();
  });

  it("still returns the viewer when the profiles row is missing", async () => {
    // A signed-in user with no profile row is mid-onboarding, not a failure. The
    // dropdown falls back to the email for both the label and the initials.
    createClient.mockResolvedValue(
      client({ user: { id: "u1", email: "new@example.com" }, profile: null }),
    );

    await expect(readPublicViewer()).resolves.toEqual({
      fullName: null,
      email: "new@example.com",
    });
  });

  describe("fails open, and says so", () => {
    it("returns null instead of throwing when the auth read throws", async () => {
      createClient.mockResolvedValue(client({ userThrows: true }));

      await expect(readPublicViewer()).resolves.toBeNull();
      expect(errorSpy).toHaveBeenCalledWith(
        expect.stringContaining("[public-viewer] FAIL-OPEN"),
        expect.anything(),
      );
    });

    it("returns null instead of throwing when the profiles read throws", async () => {
      createClient.mockResolvedValue(
        client({ user: { id: "u1", email: "a@example.com" }, profileThrows: true }),
      );

      await expect(readPublicViewer()).resolves.toBeNull();
      expect(errorSpy).toHaveBeenCalled();
    });

    it("returns null instead of throwing when the client cannot be constructed", async () => {
      // Covers a missing/invalid env at module boundary — the one failure that happens
      // before any query is even attempted.
      createClient.mockRejectedValue(new Error("no supabase env"));

      await expect(readPublicViewer()).resolves.toBeNull();
      expect(errorSpy).toHaveBeenCalled();
    });
  });
});
