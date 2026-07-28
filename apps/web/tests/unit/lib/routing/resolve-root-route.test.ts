import { describe, expect, it } from "vitest";

import { resolveRootRoute } from "@/lib/routing/resolve-root-route";

/**
 * T085 (feature 013, US1) — the root route's three outcomes, and the one ordering
 * question that actually has a wrong answer.
 *
 * P6 takes `/` over for the landing page. Two of its three branches are behaviours
 * FR-017 protects and must survive that takeover unchanged, so they are proved here
 * rather than only in a browser: `research.md` §12.2 puts the weight on this table and
 * appends only two narrow Playwright checks (T087) on top.
 */

describe("resolveRootRoute", () => {
  it("forwards a `?code=` to the callback", () => {
    expect(resolveRootRoute({ code: "abc" })).toEqual({ kind: "callback", code: "abc" });
  });

  it("forwards a `?code=` EVEN WHEN SIGNED IN — the precedence case that matters", () => {
    // The reason §11 puts `?code=` first. A visitor already signed in in another tab
    // clicks a recovery link; if the signed-in branch won, they would be bounced to
    // /app and the code would be gone — an unrecoverable dead end on the one link
    // whose entire purpose is recovering an account.
    expect(resolveRootRoute({ code: "abc", isSignedIn: true })).toEqual({
      kind: "callback",
      code: "abc",
    });
  });

  it("sends a signed-in visitor to the application", () => {
    expect(resolveRootRoute({ isSignedIn: true })).toEqual({ kind: "app" });
  });

  it("renders the landing page for everyone else", () => {
    expect(resolveRootRoute({})).toEqual({ kind: "landing" });
  });

  it("treats an EMPTY-STRING code as absent, matching today's `code.length > 0` check", () => {
    // `app/page.tsx:21` before the takeover. `/?code=` with nothing after it is not a
    // link worth forwarding — the callback would fail the exchange and strand the user
    // on an error instead of the page they asked for.
    expect(resolveRootRoute({ code: "" })).toEqual({ kind: "landing" });
    expect(resolveRootRoute({ code: "", isSignedIn: true })).toEqual({ kind: "app" });
  });

  it("does not forward an ARRAY-valued code — Next's searchParams can yield string[]", () => {
    // `/?code=a&code=b` parses to `["a", "b"]`. There is no single code to exchange and
    // choosing one is a guess about which link the visitor meant, so this falls through
    // to the ordinary branches exactly as today's `typeof code === "string"` guard does.
    expect(resolveRootRoute({ code: ["a", "b"] })).toEqual({ kind: "landing" });
    expect(resolveRootRoute({ code: ["a", "b"], isSignedIn: true })).toEqual({ kind: "app" });
    expect(resolveRootRoute({ code: [] })).toEqual({ kind: "landing" });
  });

  it("is total over the shapes Next can hand it", () => {
    // Guards the vacuous case: every input above returns SOME route, so a future edit
    // that adds a fourth branch or an early `undefined` return fails here.
    const inputs = [
      {},
      { code: undefined },
      { code: "" },
      { code: "abc" },
      { code: ["a"] },
      { isSignedIn: false },
      { isSignedIn: true },
      { code: "abc", isSignedIn: true },
    ];
    for (const input of inputs) {
      expect(["callback", "app", "landing"]).toContain(resolveRootRoute(input).kind);
    }
  });
});
