import { act, fireEvent, render, screen } from "@testing-library/react";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { afterEach, describe, expect, it } from "vitest";

import { ANCHOR_BANNER_DISMISS_KEY } from "@/lib/auth-broadcast";

import { CalibrationBanner } from "./calibration-banner";

afterEach(() => sessionStorage.clear());

describe("CalibrationBanner", () => {
  it("renders calm calibration copy linking to /app/calibrate", () => {
    render(<CalibrationBanner />);
    expect(screen.getByText(/Stress detection isn.t active yet/i)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Set baseline" })).toHaveAttribute(
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

describe("CalibrationBanner — foggy restyle, no amber (FR-043/046)", () => {
  it("dresses the surface in foggy, with zero amber and no crimson", () => {
    render(<CalibrationBanner />);
    const region = screen.getByRole("region", { name: "Calibration" });
    expect(region.className).toMatch(/border-foggy/);
    expect(region.className).toMatch(/bg-foggy/);
    // amber is reserved for stress/affective signals; this is an attention prompt.
    expect(document.querySelector('[class*="amber"]')).toBeNull();
    expect(document.querySelector('[class*="crimson"]')).toBeNull();
  });

  it("the primary CTA is the FOGGY-filled treatment (dark/ink text), not meadow", () => {
    render(<CalibrationBanner />);
    const cta = screen.getByRole("link", { name: "Set baseline" });
    // foggy fill + dark text in both themes (text-ink light / dark:text-bg dark) — AA.
    expect(cta.className).toMatch(/bg-foggy/);
    expect(cta.className).toMatch(/text-ink/);
    expect(cta.className).toMatch(/dark:text-bg/);
    // never the affirmative meadow, never the default ink-fill, never amber.
    expect(cta.className).not.toMatch(/meadow/);
    expect(cta.className).not.toMatch(/\bbg-ink\b/);
    expect(cta.className).not.toMatch(/amber/);
  });

  it("keeps the CTA a full-document <a href='/app/calibrate'> (not next/link)", () => {
    render(<CalibrationBanner />);
    const cta = screen.getByRole("link", { name: "Set baseline" });
    expect(cta.tagName).toBe("A"); // full document navigation, not a client transition
    expect(cta).toHaveAttribute("href", "/app/calibrate");
  });

  it("the source never uses next/link or router navigation for the CTA (FR-055)", () => {
    // vitest runs with cwd = apps/web; read the source so the "hard navigation"
    // guarantee is a real static check (same guard style as the US6 CTAs).
    const source = readFileSync(
      resolve(process.cwd(), "components/anchor/calibration-banner.tsx"),
      "utf8",
    );
    expect(source).not.toMatch(/from\s+["']next\/link["']/);
    expect(source).not.toMatch(/router\.(push|replace)/);
    expect(source).toContain(`<a href="/app/calibrate">`);
  });
});
