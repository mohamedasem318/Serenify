import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { Bloom } from "@/components/monitor/bloom";
import { useMediaQuery } from "@/hooks/use-media-query";

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
