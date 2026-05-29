import { act, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { ANCHOR_BANNER_DISMISS_KEY } from "@/lib/auth-broadcast";

import { CalibrationBanner } from "./calibration-banner";

afterEach(() => sessionStorage.clear());

describe("CalibrationBanner", () => {
  it("renders calm calibration copy linking to /app/calibrate", () => {
    render(<CalibrationBanner />);
    expect(screen.getByText(/Stress detection isn.t active yet/i)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Take a minute to calibrate" })).toHaveAttribute(
      "href",
      "/app/calibrate",
    );
  });

  it("hides for the session when dismissed and records it", () => {
    render(<CalibrationBanner />);
    fireEvent.click(screen.getByRole("button", { name: "Dismiss" }));
    expect(screen.queryByRole("region", { name: "Calibration" })).toBeNull();
    expect(sessionStorage.getItem(ANCHOR_BANNER_DISMISS_KEY)).toBe("1");
  });

  it("stays hidden when already dismissed this session", () => {
    sessionStorage.setItem(ANCHOR_BANNER_DISMISS_KEY, "1");
    render(<CalibrationBanner />);
    expect(screen.queryByRole("region", { name: "Calibration" })).toBeNull();
  });

  it("re-shows after the dismissal key is cleared (sign-out reset path)", () => {
    sessionStorage.setItem(ANCHOR_BANNER_DISMISS_KEY, "1");
    const { rerender } = render(<CalibrationBanner />);
    expect(screen.queryByRole("region", { name: "Calibration" })).toBeNull();

    // What broadcastSignOut / cross-tab-auth do on a sign-out: wipe the key.
    // A storage event then notifies the subscriber and the banner re-renders.
    act(() => {
      sessionStorage.removeItem(ANCHOR_BANNER_DISMISS_KEY);
      window.dispatchEvent(new StorageEvent("storage"));
    });
    rerender(<CalibrationBanner />);
    expect(screen.getByRole("region", { name: "Calibration" })).toBeVisible();
  });

  it("uses no exclamation marks or red accents (Principle V)", () => {
    const { container } = render(<CalibrationBanner />);
    expect(container.textContent).not.toContain("!");
    expect(container.querySelector('[class*="red"]')).toBeNull();
  });
});
