import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

const { mq } = vi.hoisted(() => ({ mq: vi.fn(() => true) }));
vi.mock("@/hooks/use-media-query", () => ({ useMediaQuery: () => mq() }));

import { QuestionnaireResultIcon } from "@/components/questionnaire/questionnaire-result-icon";

/** T053 — the smiley draw-in renders its FINAL state (no draw animation) under reduced motion. */

afterEach(cleanup);

describe("smiley draw-in reduced-motion", () => {
  it("omits the draw animation class when reduced motion is preferred", () => {
    mq.mockReturnValue(true);
    render(<QuestionnaireResultIcon kind="smiley" message="Glad that helped." />);
    expect(screen.getByTestId("questionnaire-result")).toHaveAttribute("data-motion", "reduced");
    expect(screen.getByTestId("qri-draw-path").getAttribute("class") ?? "").not.toContain("qri-draw");
    expect(screen.getByText("Glad that helped.")).toBeInTheDocument();
  });

  it("applies the draw animation class when motion is allowed", () => {
    mq.mockReturnValue(false);
    render(<QuestionnaireResultIcon kind="smiley" message="Glad that helped." />);
    expect(screen.getByTestId("questionnaire-result")).toHaveAttribute("data-motion", "full");
    expect(screen.getByTestId("qri-draw-path").getAttribute("class") ?? "").toContain("qri-draw");
  });
});
