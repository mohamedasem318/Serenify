import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { Bloom, TONE_COLOR } from "@/components/monitor/bloom";
import { useMediaQuery } from "@/hooks/use-media-query";

import type { BloomTone } from "@/components/monitor/use-monitoring-session";

/** Feature 008 / US1 — T035: band→colour on the bloom + reduced-motion suppression. */

vi.mock("@/hooks/use-media-query", () => ({ useMediaQuery: vi.fn(() => false) }));
const mockedUseMediaQuery = vi.mocked(useMediaQuery);

describe("Bloom", () => {
  beforeEach(() => mockedUseMediaQuery.mockReturnValue(false));

  it("maps the band tone to the bloom colour role", () => {
    const { rerender } = render(<Bloom tone="ease" />);
    expect(screen.getByTestId("bloom")).toHaveAttribute("data-tone", "ease");
    rerender(<Bloom tone="little" />);
    expect(screen.getByTestId("bloom")).toHaveAttribute("data-tone", "little");
    rerender(<Bloom tone="tense" />);
    expect(screen.getByTestId("bloom")).toHaveAttribute("data-tone", "tense");
    rerender(<Bloom tone="warming" />);
    expect(screen.getByTestId("bloom")).toHaveAttribute("data-tone", "warming");
  });

  it("breathes when motion is allowed", () => {
    mockedUseMediaQuery.mockReturnValue(false);
    render(<Bloom tone="ease" />);
    expect(screen.getByTestId("bloom")).toHaveAttribute("data-motion", "animated");
  });

  it("suppresses the breathing under prefers-reduced-motion", () => {
    mockedUseMediaQuery.mockReturnValue(true);
    render(<Bloom tone="ease" />);
    expect(screen.getByTestId("bloom")).toHaveAttribute("data-motion", "static");
  });

  it("renders no number / gauge text (decorative, aria-hidden)", () => {
    render(<Bloom tone="tense" />);
    const bloom = screen.getByTestId("bloom");
    expect(bloom).toHaveAttribute("aria-hidden");
    expect(bloom.textContent ?? "").not.toMatch(/[0-9]/);
  });
});

/**
 * Feature 013 / US1 — T083 (R6): the OPTIONAL `color` prop, and the proof that omitting
 * it leaves the live monitor exactly where it was.
 *
 * The first half is the one that matters. `bloom.tsx` is a SHIPPED monitor component and
 * 013 touches it only because `--bloom` is an inline style an ancestor cannot override
 * (FR-021 forbids the landing page reimplementing the orb). The defaulting is therefore
 * the whole risk surface: `color ?? TONE_COLOR[tone]` is one keystroke away from
 * `color` alone, or from a different fallback, and either would repaint every band on the
 * live monitoring stage with nothing else failing. Asserting against the imported
 * `TONE_COLOR` rather than a hand-copied string is deliberate — the fixture then tracks
 * the palette (which is allowed to move, via the Graphite tokens) while still pinning the
 * DEFAULTING (which is not).
 */

const ALL_TONES: readonly BloomTone[] = ["ease", "warming", "little", "tense"];

/** The rendered `--bloom` custom property — the single value this prop can affect. */
function renderedBloomColor(): string {
  return (screen.getByTestId("bloom") as HTMLElement).style.getPropertyValue("--bloom");
}

describe("Bloom — the optional `color` prop (T083)", () => {
  beforeEach(() => mockedUseMediaQuery.mockReturnValue(false));

  it.each(ALL_TONES)(
    "omitting `color` still yields TONE_COLOR for tone %s — the live monitor is untouched",
    (tone) => {
      render(<Bloom tone={tone} />);
      expect(renderedBloomColor()).toBe(TONE_COLOR[tone]);
    },
  );

  it.each(ALL_TONES)("passing `color` overrides the tone default for tone %s", (tone) => {
    render(<Bloom tone={tone} color="var(--color-foggy)" />);
    expect(renderedBloomColor()).toBe("var(--color-foggy)");
    expect(renderedBloomColor()).not.toBe(TONE_COLOR[tone]);
  });

  it("the four tone defaults are distinct enough that the assertion above can fail", () => {
    // Guards the vacuous case: if every TONE_COLOR entry were the same string, the
    // per-tone assertions would pass against a component that ignored `tone` entirely.
    expect(new Set(Object.values(TONE_COLOR)).size).toBeGreaterThan(1);
  });
});
