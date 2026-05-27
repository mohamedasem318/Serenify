import { describe, expect, it, vi, beforeEach } from "vitest";
import { render, waitFor } from "@testing-library/react";

import {
  ANCHOR_BROADCAST_KEY,
  AUTH_BROADCAST_KEY,
  AUTH_SIGNIN_COOKIE,
  parseAuthBroadcast,
} from "@/lib/auth-broadcast";

const { pushMock, refreshMock, pathnameHolder, signOutMock } = vi.hoisted(() => ({
  pushMock: vi.fn(),
  refreshMock: vi.fn(),
  pathnameHolder: { value: "/login" as string },
  signOutMock: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: pushMock, refresh: refreshMock }),
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

function clearAllCookies() {
  for (const entry of document.cookie.split("; ")) {
    const name = entry.split("=")[0];
    if (name) {
      document.cookie = `${name}=; Max-Age=0; Path=/`;
    }
  }
}

beforeEach(() => {
  pushMock.mockReset();
  refreshMock.mockReset();
  signOutMock.mockReset();
  signOutMock.mockResolvedValue({ error: null });
  pathnameHolder.value = "/login";
  localStorage.clear();
  clearAllCookies();
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

describe("CrossTabAuth — anchor capture broadcast (FR-034)", () => {
  it.each(["/onboarding", "/app/calibrate"])(
    "refreshes when an anchor-captured marker arrives on %s",
    (pathname) => {
      pathnameHolder.value = pathname;
      render(<CrossTabAuth />);
      fireStorage({ key: ANCHOR_BROADCAST_KEY, newValue: "captured:123" });
      expect(refreshMock).toHaveBeenCalledTimes(1);
      expect(pushMock).not.toHaveBeenCalled();
    },
  );

  it.each(["/app", "/app/account", "/login"])(
    "does NOT refresh for an anchor marker on %s",
    (pathname) => {
      pathnameHolder.value = pathname;
      render(<CrossTabAuth />);
      fireStorage({ key: ANCHOR_BROADCAST_KEY, newValue: "captured:123" });
      expect(refreshMock).not.toHaveBeenCalled();
    },
  );

  it("ignores an anchor key with an unrecognised value", () => {
    pathnameHolder.value = "/onboarding";
    render(<CrossTabAuth />);
    fireStorage({ key: ANCHOR_BROADCAST_KEY, newValue: "garbage" });
    expect(refreshMock).not.toHaveBeenCalled();
  });

  it("does not refresh on an auth broadcast", () => {
    pathnameHolder.value = "/onboarding";
    render(<CrossTabAuth />);
    fireStorage({ key: AUTH_BROADCAST_KEY, newValue: "signin:123" });
    expect(refreshMock).not.toHaveBeenCalled();
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

describe("CrossTabAuth — callback signin cookie bridge (📌 ST-8)", () => {
  it.each(["/app", "/onboarding"])(
    "emits a signin broadcast on mount at %s when the callback cookie is present",
    (pathname) => {
      pathnameHolder.value = pathname;
      document.cookie = `${AUTH_SIGNIN_COOKIE}=1; Path=/`;

      const { unmount } = render(<CrossTabAuth />);

      // The mount effect wrote the cross-tab marker that sibling tabs
      // react to — the same marker the form path writes.
      const written = localStorage.getItem(AUTH_BROADCAST_KEY);
      expect(parseAuthBroadcast(written)).toBe("signin");
      // The consuming tab navigates via its own callback redirect, not
      // via the storage listener — no self-push here.
      expect(pushMock).not.toHaveBeenCalled();

      // One-shot: a fresh mount consumes nothing further (cookie cleared).
      unmount();
      localStorage.clear();
      render(<CrossTabAuth />);
      expect(localStorage.getItem(AUTH_BROADCAST_KEY)).toBeNull();
    },
  );

  it("does not emit on mount when the callback cookie is absent (form path)", () => {
    pathnameHolder.value = "/app";
    render(<CrossTabAuth />);
    expect(localStorage.getItem(AUTH_BROADCAST_KEY)).toBeNull();
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
