import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

const { mq } = vi.hoisted(() => ({ mq: vi.fn(() => true) }));
vi.mock("@/hooks/use-media-query", () => ({ useMediaQuery: () => mq() }));

import { QuestionnaireResultIcon } from "@/components/questionnaire/questionnaire-result-icon";

/** T056 — the muted skip wind + message appear WITHOUT pop/fade movement under reduced motion. */

afterEach(cleanup);

describe("muted skip reduced-motion", () => {
  it("omits the pop/fade classes when reduced motion is preferred", () => {
    mq.mockReturnValue(true);
    render(<QuestionnaireResultIcon kind="muted" message="No problem — another time." />);
    const wrap = screen.getByTestId("questionnaire-result");
    expect(wrap).toHaveAttribute("data-motion", "reduced");
    // The ring (the only child div) carries no pop, and the message no fade-up.
    const ring = wrap.querySelector("div");
    expect(ring?.getAttribute("class") ?? "").not.toContain("qri-pop");
    expect(screen.getByTestId("questionnaire-result-message").getAttribute("class") ?? "").not.toContain(
      "qri-fadeup",
    );
    // The wind is shown statically (kind=muted).
    expect(wrap).toHaveAttribute("data-kind", "muted");
  });

  it("applies pop + fade when motion is allowed", () => {
    mq.mockReturnValue(false);
    render(<QuestionnaireResultIcon kind="muted" message="No problem — another time." />);
    const wrap = screen.getByTestId("questionnaire-result");
    expect(wrap.querySelector("div")?.getAttribute("class") ?? "").toContain("qri-pop");
    expect(screen.getByTestId("questionnaire-result-message").getAttribute("class") ?? "").toContain(
      "qri-fadeup",
    );
  });
});
