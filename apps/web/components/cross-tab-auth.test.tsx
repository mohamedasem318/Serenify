import { describe, expect, it, vi, beforeEach } from "vitest";
import { render } from "@testing-library/react";

type AuthEvent =
  | "SIGNED_IN"
  | "SIGNED_OUT"
  | "TOKEN_REFRESHED"
  | "USER_UPDATED";
type AuthCallback = (event: AuthEvent, session: unknown) => void;

const { onAuthStateChangeMock, unsubscribeMock, pushMock, pathnameHolder } =
  vi.hoisted(() => ({
    onAuthStateChangeMock: vi.fn<
      (cb: AuthCallback) => {
        data: { subscription: { unsubscribe: () => void } };
      }
    >(),
    unsubscribeMock: vi.fn(),
    pushMock: vi.fn(),
    pathnameHolder: { value: "/login" as string },
  }));

vi.mock("@/lib/supabase/client", () => ({
  createClient: () => ({
    auth: { onAuthStateChange: onAuthStateChangeMock },
  }),
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: pushMock }),
  usePathname: () => pathnameHolder.value,
}));

import { CrossTabAuth } from "@/components/cross-tab-auth";

let lastCallback: AuthCallback | null = null;

function bootSubscription() {
  onAuthStateChangeMock.mockImplementation((cb) => {
    lastCallback = cb;
    return { data: { subscription: { unsubscribe: unsubscribeMock } } };
  });
}

function fire(event: AuthEvent) {
  if (!lastCallback) throw new Error("listener not subscribed yet");
  lastCallback(event, null);
}

beforeEach(() => {
  onAuthStateChangeMock.mockReset();
  unsubscribeMock.mockReset();
  pushMock.mockReset();
  pathnameHolder.value = "/login";
  lastCallback = null;
});

describe("CrossTabAuth — SIGNED_IN navigation gate (FR-046)", () => {
  it.each([
    ["/", "/app"],
    ["/login", "/app"],
    ["/signup", "/app"],
    ["/forgot-password", "/app"],
    ["/reset-password", "/app"],
  ])(
    "SIGNED_IN on %s navigates to %s",
    (pathname, expectedTarget) => {
      bootSubscription();
      pathnameHolder.value = pathname;
      render(<CrossTabAuth />);
      fire("SIGNED_IN");
      expect(pushMock).toHaveBeenCalledTimes(1);
      expect(pushMock).toHaveBeenCalledWith(expectedTarget);
    },
  );

  it.each(["/app", "/app/account", "/onboarding"])(
    "SIGNED_IN on %s does NOT navigate",
    (pathname) => {
      bootSubscription();
      pathnameHolder.value = pathname;
      render(<CrossTabAuth />);
      fire("SIGNED_IN");
      expect(pushMock).not.toHaveBeenCalled();
    },
  );
});

describe("CrossTabAuth — SIGNED_OUT navigation gate (FR-046)", () => {
  it.each([
    ["/app", "/login"],
    ["/app/account", "/login"],
    ["/onboarding", "/login"],
  ])("SIGNED_OUT on %s navigates to %s", (pathname, expectedTarget) => {
    bootSubscription();
    pathnameHolder.value = pathname;
    render(<CrossTabAuth />);
    fire("SIGNED_OUT");
    expect(pushMock).toHaveBeenCalledTimes(1);
    expect(pushMock).toHaveBeenCalledWith(expectedTarget);
  });

  it.each(["/login", "/signup", "/forgot-password", "/reset-password", "/"])(
    "SIGNED_OUT on %s does NOT navigate",
    (pathname) => {
      bootSubscription();
      pathnameHolder.value = pathname;
      render(<CrossTabAuth />);
      fire("SIGNED_OUT");
      expect(pushMock).not.toHaveBeenCalled();
    },
  );
});

describe("CrossTabAuth — TOKEN_REFRESHED is always silent", () => {
  it.each([
    "/",
    "/login",
    "/signup",
    "/forgot-password",
    "/reset-password",
    "/app",
    "/app/account",
    "/onboarding",
  ])("TOKEN_REFRESHED on %s does NOT navigate", (pathname) => {
    bootSubscription();
    pathnameHolder.value = pathname;
    render(<CrossTabAuth />);
    fire("TOKEN_REFRESHED");
    expect(pushMock).not.toHaveBeenCalled();
  });
});

describe("CrossTabAuth — other events are silent", () => {
  it("USER_UPDATED does NOT navigate (cross-tab password change scenario)", () => {
    // Same-context cross-tab password changes propagate as USER_UPDATED,
    // NOT SIGNED_OUT, because the new session is shared via localStorage.
    // The cross-tab listener should ignore USER_UPDATED.
    bootSubscription();
    pathnameHolder.value = "/app";
    render(<CrossTabAuth />);
    fire("USER_UPDATED");
    expect(pushMock).not.toHaveBeenCalled();
  });
});

describe("CrossTabAuth — subscription lifecycle", () => {
  it("subscribes exactly once on mount", () => {
    bootSubscription();
    render(<CrossTabAuth />);
    expect(onAuthStateChangeMock).toHaveBeenCalledTimes(1);
  });

  it("unsubscribes on unmount", () => {
    bootSubscription();
    const { unmount } = render(<CrossTabAuth />);
    expect(unsubscribeMock).not.toHaveBeenCalled();
    unmount();
    expect(unsubscribeMock).toHaveBeenCalledTimes(1);
  });
});
