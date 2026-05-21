import { describe, expect, it, vi, beforeEach } from "vitest";
import { render, waitFor } from "@testing-library/react";

import { AUTH_BROADCAST_KEY } from "@/lib/auth-broadcast";

const { pushMock, pathnameHolder, signOutMock } = vi.hoisted(() => ({
  pushMock: vi.fn(),
  pathnameHolder: { value: "/login" as string },
  signOutMock: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: pushMock }),
  usePathname: () => pathnameHolder.value,
}));

vi.mock("@/lib/supabase/client", () => ({
  createClient: () => ({
    auth: { signOut: signOutMock },
  }),
}));

import { CrossTabAuth } from "@/components/cross-tab-auth";

function fireStorage({
  key,
  newValue,
}: {
  key: string | null;
  newValue: string | null;
}) {
  // happy-dom supports StorageEvent dispatch.
  const event = new StorageEvent("storage", {
    key: key ?? undefined,
    newValue: newValue ?? undefined,
  });
  window.dispatchEvent(event);
}

beforeEach(() => {
  pushMock.mockReset();
  signOutMock.mockReset();
  signOutMock.mockResolvedValue({ error: null });
  pathnameHolder.value = "/login";
});

describe("CrossTabAuth — signin broadcast navigation gate (FR-046)", () => {
  it.each([
    ["/", "/app"],
    ["/login", "/app"],
    ["/signup", "/app"],
    ["/forgot-password", "/app"],
    ["/reset-password", "/app"],
  ])(
    "signin broadcast on %s navigates to %s",
    (pathname, expectedTarget) => {
      pathnameHolder.value = pathname;
      render(<CrossTabAuth />);
      fireStorage({ key: AUTH_BROADCAST_KEY, newValue: "signin:123" });
      expect(pushMock).toHaveBeenCalledTimes(1);
      expect(pushMock).toHaveBeenCalledWith(expectedTarget);
    },
  );

  it.each(["/app", "/app/account", "/onboarding"])(
    "signin broadcast on %s does NOT navigate",
    (pathname) => {
      pathnameHolder.value = pathname;
      render(<CrossTabAuth />);
      fireStorage({ key: AUTH_BROADCAST_KEY, newValue: "signin:123" });
      expect(pushMock).not.toHaveBeenCalled();
    },
  );
});

describe("CrossTabAuth — signout broadcast navigation gate (FR-046)", () => {
  it.each([
    ["/app", "/login"],
    ["/app/account", "/login"],
    ["/onboarding", "/login"],
  ])(
    "signout broadcast on %s clears the local session then navigates to %s",
    async (pathname, expectedTarget) => {
      pathnameHolder.value = pathname;
      render(<CrossTabAuth />);
      fireStorage({ key: AUTH_BROADCAST_KEY, newValue: "signout:456" });
      // First: local signOut is called to clear cookies before
      // navigation (proxy-race guard).
      await waitFor(() => {
        expect(signOutMock).toHaveBeenCalledTimes(1);
      });
      // Then: navigate.
      await waitFor(() => {
        expect(pushMock).toHaveBeenCalledTimes(1);
        expect(pushMock).toHaveBeenCalledWith(expectedTarget);
      });
    },
  );

  it.each(["/login", "/signup", "/forgot-password", "/reset-password", "/"])(
    "signout broadcast on %s does NOT navigate or call local signOut",
    async (pathname) => {
      pathnameHolder.value = pathname;
      render(<CrossTabAuth />);
      fireStorage({ key: AUTH_BROADCAST_KEY, newValue: "signout:456" });
      // Give microtasks a chance to settle in case the handler
      // mistakenly fires.
      await new Promise((r) => setTimeout(r, 0));
      expect(pushMock).not.toHaveBeenCalled();
      expect(signOutMock).not.toHaveBeenCalled();
    },
  );

  it("navigates even if local signOut rejects (auth-server unreachable)", async () => {
    signOutMock.mockRejectedValueOnce(new Error("network down"));
    pathnameHolder.value = "/app";
    render(<CrossTabAuth />);
    fireStorage({ key: AUTH_BROADCAST_KEY, newValue: "signout:789" });
    await waitFor(() => {
      expect(pushMock).toHaveBeenCalledWith("/login");
    });
  });
});

describe("CrossTabAuth — non-broadcast storage events", () => {
  it("ignores storage events on unrelated keys", () => {
    pathnameHolder.value = "/login";
    render(<CrossTabAuth />);
    fireStorage({ key: "some-other-key", newValue: "signin:123" });
    expect(pushMock).not.toHaveBeenCalled();
  });

  it("ignores storage events on our key with an unrecognised value", () => {
    pathnameHolder.value = "/login";
    render(<CrossTabAuth />);
    fireStorage({ key: AUTH_BROADCAST_KEY, newValue: "garbage:789" });
    expect(pushMock).not.toHaveBeenCalled();
  });

  it("ignores storage events on our key with null newValue (item removed)", () => {
    pathnameHolder.value = "/app";
    render(<CrossTabAuth />);
    fireStorage({ key: AUTH_BROADCAST_KEY, newValue: null });
    expect(pushMock).not.toHaveBeenCalled();
  });
});

describe("CrossTabAuth — subscription lifecycle", () => {
  it("does not navigate before any storage event fires", () => {
    pathnameHolder.value = "/login";
    render(<CrossTabAuth />);
    expect(pushMock).not.toHaveBeenCalled();
  });

  it("removes the listener on unmount (no late navigation)", () => {
    pathnameHolder.value = "/login";
    const { unmount } = render(<CrossTabAuth />);
    unmount();
    fireStorage({ key: AUTH_BROADCAST_KEY, newValue: "signin:999" });
    expect(pushMock).not.toHaveBeenCalled();
  });

  it("re-attaches listener after pathname change (subsequent events fire)", async () => {
    // Mount at /login, navigate to /app via separate prop change.
    pathnameHolder.value = "/login";
    const { rerender } = render(<CrossTabAuth />);
    // Fire signin at /login -> navigates to /app.
    fireStorage({ key: AUTH_BROADCAST_KEY, newValue: "signin:1" });
    expect(pushMock).toHaveBeenCalledWith("/app");
    pushMock.mockReset();

    // Pathname changes to /app -> listener re-subscribes with new pathname.
    pathnameHolder.value = "/app";
    rerender(<CrossTabAuth />);
    // Fire signout at /app -> local signOut then navigates to /login.
    fireStorage({ key: AUTH_BROADCAST_KEY, newValue: "signout:2" });
    await waitFor(() => {
      expect(pushMock).toHaveBeenCalledWith("/login");
    });
  });
});
