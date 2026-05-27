import { fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { CalibrationBanner } from "./calibration-banner";

const DISMISS_KEY = "serenify-anchor-banner-dismissed";

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
    expect(sessionStorage.getItem(DISMISS_KEY)).toBe("1");
  });

  it("stays hidden when already dismissed this session", () => {
    sessionStorage.setItem(DISMISS_KEY, "1");
    render(<CalibrationBanner />);
    expect(screen.queryByRole("region", { name: "Calibration" })).toBeNull();
  });

  it("uses no exclamation marks or red accents (Principle V)", () => {
    const { container } = render(<CalibrationBanner />);
    expect(container.textContent).not.toContain("!");
    expect(container.querySelector('[class*="red"]')).toBeNull();
  });
});
