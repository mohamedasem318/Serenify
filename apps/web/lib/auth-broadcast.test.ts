import { afterEach, beforeEach, describe, expect, it } from "vitest";

import {
  AUTH_BROADCAST_KEY,
  AUTH_SIGNIN_COOKIE,
  consumePendingSignIn,
  destinationBroadcastsSignIn,
  parseAuthBroadcast,
} from "@/lib/auth-broadcast";

function clearAllCookies() {
  for (const entry of document.cookie.split("; ")) {
    const name = entry.split("=")[0];
    if (name) {
      document.cookie = `${name}=; Max-Age=0; Path=/`;
    }
  }
}

beforeEach(() => {
  localStorage.clear();
  clearAllCookies();
});

afterEach(() => {
  localStorage.clear();
  clearAllCookies();
});

describe("destinationBroadcastsSignIn — server-side gate (📌 ST-8)", () => {
  it.each(["/app", "/app/", "/app/account", "/onboarding", "/onboarding/step"])(
    "broadcasts for the authed destination %s",
    (next) => {
      expect(destinationBroadcastsSignIn(next)).toBe(true);
    },
  );

  it.each([
    "/reset-password",
    "/login",
    "/signup",
    "/forgot-password",
    "/",
    // Guard against a prefix-match false positive: a path that merely
    // starts with the substring "/app" but is a different route.
    "/application",
    "/apple",
  ])("does NOT broadcast for %s", (next) => {
    expect(destinationBroadcastsSignIn(next)).toBe(false);
  });
});

describe("consumePendingSignIn — client-side cookie bridge (📌 ST-8)", () => {
  it("emits a signin broadcast and clears the cookie when the marker is present", () => {
    document.cookie = `${AUTH_SIGNIN_COOKIE}=1; Path=/`;

    consumePendingSignIn();

    // The marker localStorage write is what sibling tabs' CrossTabAuth
    // listeners react to (parseAuthBroadcast === "signin").
    const written = localStorage.getItem(AUTH_BROADCAST_KEY);
    expect(written).not.toBeNull();
    expect(parseAuthBroadcast(written)).toBe("signin");

    // One-shot: a second consume (e.g. a remount) does not re-emit,
    // because the marker was cleared.
    localStorage.clear();
    consumePendingSignIn();
    expect(localStorage.getItem(AUTH_BROADCAST_KEY)).toBeNull();
  });

  it("is a no-op when the marker cookie is absent (the form path)", () => {
    consumePendingSignIn();
    expect(localStorage.getItem(AUTH_BROADCAST_KEY)).toBeNull();
  });

  it("does not fire for an unrelated cookie", () => {
    document.cookie = "serenify-theme=dark; Path=/";
    consumePendingSignIn();
    expect(localStorage.getItem(AUTH_BROADCAST_KEY)).toBeNull();
  });
});
