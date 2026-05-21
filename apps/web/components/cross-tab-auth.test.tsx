import { describe, expect, it, vi, beforeEach } from "vitest";
import { render } from "@testing-library/react";

import { AUTH_BROADCAST_KEY } from "@/lib/auth-broadcast";

const { pushMock, pathnameHolder } = vi.hoisted(() => ({
  pushMock: vi.fn(),
  pathnameHolder: { value: "/login" as string },
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: pushMock }),
  usePathname: () => pathnameHolder.value,
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
    "signout broadcast on %s navigates to %s",
    (pathname, expectedTarget) => {
      pathnameHolder.value = pathname;
      render(<CrossTabAuth />);
      fireStorage({ key: AUTH_BROADCAST_KEY, newValue: "signout:456" });
      expect(pushMock).toHaveBeenCalledTimes(1);
      expect(pushMock).toHaveBeenCalledWith(expectedTarget);
    },
  );

  it.each(["/login", "/signup", "/forgot-password", "/reset-password", "/"])(
    "signout broadcast on %s does NOT navigate",
    (pathname) => {
      pathnameHolder.value = pathname;
      render(<CrossTabAuth />);
      fireStorage({ key: AUTH_BROADCAST_KEY, newValue: "signout:456" });
      expect(pushMock).not.toHaveBeenCalled();
    },
  );
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

  it("re-attaches listener after pathname change (subsequent events fire)", () => {
    // Mount at /login, navigate to /app via separate prop change.
    // Simulating pathname change requires re-rendering with the
    // new pathnameHolder value before firing the next event.
    pathnameHolder.value = "/login";
    const { rerender } = render(<CrossTabAuth />);
    // Fire signin at /login -> navigates to /app.
    fireStorage({ key: AUTH_BROADCAST_KEY, newValue: "signin:1" });
    expect(pushMock).toHaveBeenCalledWith("/app");
    pushMock.mockReset();

    // Pathname changes to /app -> listener re-subscribes with new pathname.
    pathnameHolder.value = "/app";
    rerender(<CrossTabAuth />);
    // Fire signout at /app -> navigates to /login.
    fireStorage({ key: AUTH_BROADCAST_KEY, newValue: "signout:2" });
    expect(pushMock).toHaveBeenCalledWith("/login");
  });
});
