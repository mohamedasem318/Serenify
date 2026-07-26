import { fireEvent, render, screen, within } from "@testing-library/react";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { BaselineSection } from "./baseline-section";

/**
 * Honest RTL for the account "Your calm baseline" section (T025, 📌 DECISION-22/23,
 * FR-036/037/041/055). The section is pure presentation over a server-passed
 * `hasAnchor` boolean, so the real assertions are: it reflects whether-set (and
 * NOTHING else — no date), the replace heads-up is honest, and the recalibrate CTA
 * is a FULL-DOCUMENT `<a href>` (not next/link) so the per-route camera
 * Permissions-Policy applies. The last is enforced both at runtime (the rendered
 * anchor) and statically (the source never imports next/link or router-pushes).
 */

function mockMatchMedia(matches: boolean) {
  window.matchMedia = vi.fn().mockImplementation((query: string) => ({
    matches,
    media: query,
    onchange: null,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    addListener: vi.fn(),
    removeListener: vi.fn(),
    dispatchEvent: vi.fn(),
  }));
}

const RECALIBRATE_HREF = "/app/calibrate?mode=recalibrate";

beforeEach(() => mockMatchMedia(false));
afterEach(() => vi.restoreAllMocks());

describe("BaselineSection — whether-set only (FR-036/041, DECISION-23)", () => {
  it("reflects a set baseline as set, with no date or timestamp surfaced", () => {
    render(<BaselineSection hasAnchor />);
    expect(screen.getByRole("heading", { name: /your calm baseline/i })).toBeInTheDocument();
    expect(screen.getByText(/baseline set/i)).toBeInTheDocument();
    // whether-set ONLY: never a capture date/time/"captured"/"ago" (DECISION-23).
    expect(
      screen.queryByText(/\b\d{4}\b|\d{1,2}:\d{2}|captured|ago|last set|on \w+ \d/i),
    ).toBeNull();
  });

  it("reflects an unset baseline as not set", () => {
    render(<BaselineSection hasAnchor={false} />);
    expect(screen.getByText(/not set yet/i)).toBeInTheDocument();
  });

  it("never implies live monitoring or check-ins are running (FR-040)", () => {
    const { container } = render(<BaselineSection hasAnchor />);
    expect(container.textContent ?? "").not.toMatch(
      /monitor|check-in|tracking|detect|active now|watching/i,
    );
    expect(container.textContent ?? "").not.toContain("!");
  });
});

describe("BaselineSection — the camera-consent route back (T052, research.md §6.4)", () => {
  it("renders exactly as before when the prop is omitted, so P3's output is unchanged", () => {
    // The byte-for-byte guarantee T052 asks for, asserted rather than assumed: an
    // omitted prop must produce the same markup as an explicitly-allowed one.
    const withoutProp = render(<BaselineSection hasAnchor={false} />).container.innerHTML;
    const explicitlyAllowed = render(
      <BaselineSection hasAnchor={false} cameraConsent="allowed" />,
    ).container.innerHTML;
    expect(withoutProp).toBe(explicitlyAllowed);
  });

  it("says nothing about camera consent while consent is present", () => {
    const { container } = render(<BaselineSection hasAnchor cameraConsent="allowed" />);
    expect(container.textContent ?? "").not.toMatch(/camera-and-inference|permission/i);
    expect(screen.queryByRole("link", { name: /review camera permission/i })).toBeNull();
  });

  it("gains one line naming the consent, and the control that opens it, when absent", () => {
    render(<BaselineSection hasAnchor={false} cameraConsent="blocked" />);
    expect(screen.getByText(/camera-and-inference permission/i)).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: /review camera permission/i }),
    ).toBeInTheDocument();
  });

  it("offers ONE destination, not a duplicate CTA beside it", () => {
    // Both controls would point at the same href, and "Set your baseline" would promise
    // a capture that cannot start yet. The honest label is the only one shown.
    render(<BaselineSection hasAnchor={false} cameraConsent="blocked" />);
    expect(screen.queryByRole("link", { name: /set your baseline/i })).toBeNull();
    expect(screen.getAllByRole("link")).toHaveLength(1);
  });

  it("stays calm — no alarm, no exclamation, no implication of live monitoring", () => {
    const { container } = render(<BaselineSection hasAnchor={false} cameraConsent="blocked" />);
    expect(container.textContent ?? "").not.toContain("!");
    expect(container.textContent ?? "").not.toMatch(/denied|blocked|refused|must|required/i);
  });
});

describe("BaselineSection — replace heads-up (FR-037)", () => {
  it("opens an honest heads-up before replacing an existing baseline", () => {
    render(<BaselineSection hasAnchor />);
    expect(screen.queryByRole("dialog")).toBeNull(); // not until asked
    fireEvent.click(screen.getByRole("button", { name: /set a new baseline/i }));

    const dialog = screen.getByRole("dialog");
    expect(within(dialog).getByText(/replaces the baseline you have now/i)).toBeInTheDocument();
    // both choices present: forward + the quiet back-out
    expect(within(dialog).getByRole("link", { name: /set new baseline/i })).toBeInTheDocument();
    expect(within(dialog).getByRole("button", { name: /keep current/i })).toBeInTheDocument();
  });

  it("'Keep current' is a neutral back-out that does not launch the flow", () => {
    render(<BaselineSection hasAnchor />);
    fireEvent.click(screen.getByRole("button", { name: /set a new baseline/i }));

    const keepCurrent = screen.getByRole("button", { name: /keep current/i });
    // it cannot navigate (a <button>, never a link) → it can't launch the flow
    expect(keepCurrent.tagName).toBe("BUTTON");
    // non-destructive: never the crimson destructive treatment (FR-037)
    expect(keepCurrent.className).not.toMatch(/destructive|crimson/);

    fireEvent.click(keepCurrent);
    // backing out closes the heads-up — the forward CTA is gone again
    expect(screen.queryByRole("link", { name: /set new baseline/i })).toBeNull();
  });
});

describe("BaselineSection — full-document recalibrate navigation (FR-055, DECISION-16)", () => {
  it("the heads-up 'Set new baseline' is a plain <a href> to ?mode=recalibrate", () => {
    render(<BaselineSection hasAnchor />);
    fireEvent.click(screen.getByRole("button", { name: /set a new baseline/i }));

    const cta = screen.getByRole("link", { name: /set new baseline/i });
    expect(cta.tagName).toBe("A"); // full document navigation, not a client transition
    expect(cta).toHaveAttribute("href", RECALIBRATE_HREF);
    expect(cta.className).not.toMatch(/destructive|crimson/); // calm/forward surface
  });

  it("when no baseline is set, the CTA navigates straight in as a full-document <a href>", () => {
    render(<BaselineSection hasAnchor={false} />);
    const cta = screen.getByRole("link", { name: /set your baseline/i });
    expect(cta.tagName).toBe("A");
    expect(cta).toHaveAttribute("href", RECALIBRATE_HREF);
  });

  it("the consent route-back is a full-document <a href> too (T052)", () => {
    render(<BaselineSection hasAnchor={false} cameraConsent="blocked" />);
    const cta = screen.getByRole("link", { name: /review camera permission/i });
    // Same invariant as the recalibrate CTAs, for the same reason: a soft-nav into a
    // capture route keeps the previous route's camera=() Permissions-Policy.
    expect(cta.tagName).toBe("A");
    expect(cta).toHaveAttribute("href", RECALIBRATE_HREF);
  });

  it("the source never uses next/link or router navigation for the recalibrate entry", () => {
    // vitest runs with cwd = apps/web; read the source straight off disk so the
    // "must be a hard navigation" guard is a real static check, not an inference.
    const source = readFileSync(
      resolve(process.cwd(), "components/anchor/baseline-section.tsx"),
      "utf8",
    );
    expect(source).not.toMatch(/from\s+["']next\/link["']/);
    expect(source).not.toMatch(/router\.(push|replace)/);
    expect(source).toContain(`<a href={RECALIBRATE_HREF}>`);
  });
});
