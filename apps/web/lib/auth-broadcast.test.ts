import { afterEach, beforeEach, describe, expect, it } from "vitest";

import {
  ANCHOR_BANNER_DISMISS_BROADCAST_KEY,
  ANCHOR_BANNER_DISMISS_KEY,
  ANCHOR_BROADCAST_KEY,
  AUTH_BROADCAST_KEY,
  AUTH_SIGNIN_COOKIE,
  RECALIBRATION_PROMPT_DONE_KEY,
  broadcastAnchorBannerDismissed,
  broadcastAnchorCaptured,
  broadcastSignOut,
  clearAnchorBannerDismissal,
  consumePendingSignIn,
  hasCompletedRecalibrationPrompt,
  destinationBroadcastsSignIn,
  parseAnchorBannerDismissBroadcast,
  parseAnchorBroadcast,
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
  sessionStorage.clear();
  clearAllCookies();
});

afterEach(() => {
  localStorage.clear();
  sessionStorage.clear();
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

describe("anchor capture broadcast (📌 DECISION-15, FR-034)", () => {
  it("writes a captured marker that parseAnchorBroadcast recognizes", () => {
    broadcastAnchorCaptured();
    const written = localStorage.getItem(ANCHOR_BROADCAST_KEY);
    expect(written).not.toBeNull();
    expect(written?.startsWith("captured:")).toBe(true);
    expect(parseAnchorBroadcast(written)).toBe(true);
  });

  it("uses its own key, distinct from the auth broadcast", () => {
    broadcastAnchorCaptured();
    expect(localStorage.getItem(AUTH_BROADCAST_KEY)).toBeNull();
  });

  it("rejects null, unrelated, and auth markers", () => {
    expect(parseAnchorBroadcast(null)).toBe(false);
    expect(parseAnchorBroadcast("signin:123")).toBe(false);
    expect(parseAnchorBroadcast("garbage")).toBe(false);
  });
});

describe("anchor banner dismissal broadcast (ST-17 cross-tab sync, 2026-05-28)", () => {
  it("writes a dismissed marker that parseAnchorBannerDismissBroadcast recognizes", () => {
    broadcastAnchorBannerDismissed();
    const written = localStorage.getItem(ANCHOR_BANNER_DISMISS_BROADCAST_KEY);
    expect(written).not.toBeNull();
    expect(written?.startsWith("dismissed:")).toBe(true);
    expect(parseAnchorBannerDismissBroadcast(written)).toBe(true);
  });

  it("uses a key distinct from the per-tab sessionStorage dismissal key", () => {
    // The sessionStorage key (per-tab, session-only) and the localStorage
    // broadcast key (cross-tab signal) must NOT collide: storage events for
    // sessionStorage don't propagate across tabs, so the cross-tab effect
    // requires a separate localStorage write.
    broadcastAnchorBannerDismissed();
    expect(localStorage.getItem(ANCHOR_BANNER_DISMISS_KEY)).toBeNull();
    expect(sessionStorage.getItem(ANCHOR_BANNER_DISMISS_KEY)).toBeNull();
  });

  it("rejects null, unrelated, and other broadcast markers", () => {
    expect(parseAnchorBannerDismissBroadcast(null)).toBe(false);
    expect(parseAnchorBannerDismissBroadcast("captured:123")).toBe(false);
    expect(parseAnchorBannerDismissBroadcast("signin:1")).toBe(false);
    expect(parseAnchorBannerDismissBroadcast("garbage")).toBe(false);
  });
});

describe("calibration banner session reset (📌 ST-11 FR-023/024)", () => {
  it("clearAnchorBannerDismissal removes the dismissal key from sessionStorage", () => {
    sessionStorage.setItem(ANCHOR_BANNER_DISMISS_KEY, "1");
    clearAnchorBannerDismissal();
    expect(sessionStorage.getItem(ANCHOR_BANNER_DISMISS_KEY)).toBeNull();
  });

  it("is a no-op when the key is already absent", () => {
    clearAnchorBannerDismissal();
    expect(sessionStorage.getItem(ANCHOR_BANNER_DISMISS_KEY)).toBeNull();
  });

  it("broadcastSignOut clears the dismissal key alongside writing the auth marker", () => {
    // Simulates the smoke ST-11 sequence: user dismissed → user signs out →
    // the dismissal MUST be wiped so the next sign-in re-renders the banner.
    sessionStorage.setItem(ANCHOR_BANNER_DISMISS_KEY, "1");
    broadcastSignOut();
    expect(sessionStorage.getItem(ANCHOR_BANNER_DISMISS_KEY)).toBeNull();
    expect(parseAuthBroadcast(localStorage.getItem(AUTH_BROADCAST_KEY))).toBe("signout");
  });
});

describe("recalibration prompt latch (2026-08-10)", () => {
  it("is not set until a capture happens", () => {
    expect(hasCompletedRecalibrationPrompt()).toBe(false);
  });

  it("a capture retires the prompt permanently in this browser", () => {
    broadcastAnchorCaptured();
    expect(localStorage.getItem(RECALIBRATION_PROMPT_DONE_KEY)).toBe("1");
    expect(hasCompletedRecalibrationPrompt()).toBe(true);
  });

  it("rides the SAME call the sibling-tab refresh uses, so it cannot drift", () => {
    // Both effects come out of one function. If a future change moves the latch to a
    // recalibration-only call site, a first-time capture would stop retiring the
    // prompt and that user would be nagged forever.
    broadcastAnchorCaptured();
    expect(parseAnchorBroadcast(localStorage.getItem(ANCHOR_BROADCAST_KEY))).toBe(true);
    expect(hasCompletedRecalibrationPrompt()).toBe(true);
  });

  it("SURVIVES sign-out — it records the anchor, not the session", () => {
    broadcastAnchorCaptured();
    broadcastSignOut();
    // The session dismissal is reset by sign-out; the latch must not be, or every
    // sign-out would resurrect a prompt the user has already acted on.
    expect(sessionStorage.getItem(ANCHOR_BANNER_DISMISS_KEY)).toBeNull();
    expect(hasCompletedRecalibrationPrompt()).toBe(true);
  });

  it("lives in localStorage, not the per-tab sessionStorage", () => {
    // "Permanently" has to outlive the tab. sessionStorage would silently downgrade
    // the guarantee to "until this tab closes".
    broadcastAnchorCaptured();
    expect(sessionStorage.getItem(RECALIBRATION_PROMPT_DONE_KEY)).toBeNull();
  });

  it("reads false rather than throwing when storage is unavailable", () => {
    const getItem = Storage.prototype.getItem;
    Storage.prototype.getItem = () => {
      throw new Error("sandboxed");
    };
    try {
      // A false negative costs one extra dismissible prompt; a throw here would take
      // down the dashboard render. Treat the honest failure as "not done".
      expect(hasCompletedRecalibrationPrompt()).toBe(false);
    } finally {
      Storage.prototype.getItem = getItem;
    }
  });
});
