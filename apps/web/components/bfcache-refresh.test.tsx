import { render } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { BfcacheRefresh } from "./bfcache-refresh";

// Inject only the I/O seam: the Next router (navigation). The real handler logic —
// the `event.persisted` guard and listener lifecycle — runs unmocked.
const refresh = vi.fn();
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh }) }));

function firePageShow(persisted: boolean) {
  const event = new Event("pageshow");
  Object.defineProperty(event, "persisted", { value: persisted, configurable: true });
  window.dispatchEvent(event);
}

afterEach(() => refresh.mockClear());

describe("BfcacheRefresh", () => {
  it("re-syncs the route on a bfcache restore (pageshow + persisted)", () => {
    render(<BfcacheRefresh />);
    firePageShow(true);
    expect(refresh).toHaveBeenCalledTimes(1);
  });

  it("does nothing on a normal / fresh load (persisted false)", () => {
    render(<BfcacheRefresh />);
    firePageShow(false);
    expect(refresh).not.toHaveBeenCalled();
  });

  it("removes the listener on unmount", () => {
    const { unmount } = render(<BfcacheRefresh />);
    unmount();
    firePageShow(true);
    expect(refresh).not.toHaveBeenCalled();
  });
});
