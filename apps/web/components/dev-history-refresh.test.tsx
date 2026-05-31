import { render } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { DevHistoryRefresh } from "./dev-history-refresh";

// Inject the two I/O seams: the Next router (navigation) and the Navigation Timing
// entry (how this document was loaded). The component's own logic — the dev gate and
// the `back_forward` check — runs unmocked.
const refresh = vi.fn();
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh }) }));

function navType(type: PerformanceNavigationTiming["type"]) {
  vi.spyOn(performance, "getEntriesByType").mockReturnValue([
    { type } as PerformanceNavigationTiming,
  ]);
}

afterEach(() => {
  refresh.mockClear();
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
});

describe("DevHistoryRefresh (dev-only re-sync after a browser Back/Forward)", () => {
  it("refreshes the route when the page was reached via back/forward (dev)", () => {
    vi.stubEnv("NODE_ENV", "development");
    navType("back_forward");
    render(<DevHistoryRefresh />);
    expect(refresh).toHaveBeenCalledTimes(1);
  });

  it("does nothing on a normal navigation (dev)", () => {
    vi.stubEnv("NODE_ENV", "development");
    navType("navigate");
    render(<DevHistoryRefresh />);
    expect(refresh).not.toHaveBeenCalled();
  });

  it("is a TRUE no-op in production, even on back/forward", () => {
    vi.stubEnv("NODE_ENV", "production");
    navType("back_forward");
    render(<DevHistoryRefresh />);
    expect(refresh).not.toHaveBeenCalled();
  });
});
