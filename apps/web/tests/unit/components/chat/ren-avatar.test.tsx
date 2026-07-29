import { afterEach, describe, expect, it } from "vitest";
import { cleanup, render } from "@testing-library/react";

import { RenAvatar, type RenState } from "@/components/chat/ren-avatar";

afterEach(cleanup);

/**
 * Guards the three things about Ren that are locked rather than chosen: the colour, the
 * path data, and the 24px floor.
 *
 * WHY THIS FILE EXISTS. The mark had no test before, and the exact drift it guards
 * against already happened once — a `color` prop let the chat surface ship a meadow Ren
 * while the landing page shipped a foggy one, from ONE component. Constitution
 * Amendment 18 makes foggy the rule; this is what makes the rule fail loudly instead of
 * being re-litigated at a call site.
 *
 * The path strings below are DELIBERATE DUPLICATES of the component's. That is the whole
 * point: the mark is measured design data, so a test that imported the constants would
 * pass no matter how they were edited. If you are here because these assertions failed
 * after you touched the paths, the paths are what is wrong, not the test.
 */

const BODY_PATH_HEAD = "M 54.78 3.41 c -3.74 0.77 -8.14 2.79 -11.31 5.19";
const OPEN_LEFT_HEAD = "M 48.06 22.46 c -1.09 0.74 -1.53 1.28 -2.4 3.09";
const OPEN_RIGHT_HEAD = "M 69.43 21.96 c -2.79 1.23 -4.54 4.97 -4.54 9.7";
const CLOSED_LEFT_HEAD = "M 24.4 29.74 c -1.25 1.57 -0.27 5.04 2.14 7.72";
const CLOSED_RIGHT_HEAD = "M 54.74 29.74 c -1.52 1.92 0.76 7.12 4.06 9.43";

function paths(container: HTMLElement) {
  return Array.from(container.querySelectorAll("path"));
}

describe("RenAvatar — the locked mark", () => {
  it("fills the body with the foggy token and never a band-scale accent", () => {
    const { container } = render(<RenAvatar />);
    const body = paths(container).find((p) => p.getAttribute("d")?.startsWith(BODY_PATH_HEAD));

    expect(body).toBeDefined();
    expect(body!.getAttribute("class")).toContain("fill-foggy");
    // meadow/amber/crimson carry band or outcome meaning — Ren must not wear one.
    expect(container.innerHTML).not.toMatch(/fill-(meadow|amber|crimson)/);
  });

  it("gives the eyes the filled-accent foreground pair, in both modes", () => {
    const { container } = render(<RenAvatar />);
    const groups = Array.from(container.querySelectorAll("g"));

    expect(groups.length).toBeGreaterThan(0);
    for (const g of groups) {
      expect(g.getAttribute("class")).toContain("fill-on-accent");
      expect(g.getAttribute("class")).toContain("dark:fill-bg");
    }
  });

  it.each([24, 28, 34, 38, 54])("renders at its live call-site size %ipx", (size) => {
    const { container } = render(<RenAvatar size={size} />);
    const svg = container.querySelector("svg")!;

    expect(svg.getAttribute("width")).toBe(String(size));
    expect(svg.getAttribute("height")).toBe(String(size));
  });

  it.each([1, 12, 23])("clamps %ipx up to the 24px floor rather than rendering a smudge", (size) => {
    const { container } = render(<RenAvatar size={size} />);
    const svg = container.querySelector("svg")!;

    expect(svg.getAttribute("width")).toBe("24");
    expect(svg.getAttribute("height")).toBe("24");
  });

  it("keeps a 0 0 100 100 viewBox so every size is the same drawing", () => {
    const { container } = render(<RenAvatar size={96} />);
    expect(container.querySelector("svg")!.getAttribute("viewBox")).toBe("0 0 100 100");
  });

  it("is decorative — the surfaces that render it already name Ren in text", () => {
    const { container } = render(<RenAvatar />);
    expect(container.querySelector("svg")!.getAttribute("aria-hidden")).toBe("true");
  });

  describe("the four states", () => {
    it("draws idle with the untransformed open pair", () => {
      const { container } = render(<RenAvatar state="idle" />);
      const open = paths(container).filter((p) =>
        p.getAttribute("d")?.startsWith(OPEN_LEFT_HEAD) || p.getAttribute("d")?.startsWith(OPEN_RIGHT_HEAD),
      );

      expect(open).toHaveLength(2);
      for (const p of open) expect(p.getAttribute("transform")).toBeNull();
    });

    it("draws attentive with the measured 1.22 scale", () => {
      const { container } = render(<RenAvatar state="attentive" />);
      const all = paths(container);

      expect(all.find((p) => p.getAttribute("d")?.startsWith(OPEN_LEFT_HEAD))!.getAttribute("transform"))
        .toBe("translate(-11.17,-6.87) scale(1.22)");
      expect(all.find((p) => p.getAttribute("d")?.startsWith(OPEN_RIGHT_HEAD))!.getAttribute("transform"))
        .toBe("translate(-15.66,-6.89) scale(1.22)");
    });

    it("draws thinking with the measured 0.62 scale", () => {
      const { container } = render(<RenAvatar state="thinking" />);
      const all = paths(container);

      expect(all.find((p) => p.getAttribute("d")?.startsWith(OPEN_LEFT_HEAD))!.getAttribute("transform"))
        .toBe("translate(19.29,11.87) scale(0.62)");
      expect(all.find((p) => p.getAttribute("d")?.startsWith(OPEN_RIGHT_HEAD))!.getAttribute("transform"))
        .toBe("translate(27.05,11.91) scale(0.62)");
    });

    it("draws warm as the closed pair alone, with no open eyes behind it", () => {
      const { container } = render(<RenAvatar state="warm" />);
      const all = paths(container);

      expect(all.some((p) => p.getAttribute("d")?.startsWith(OPEN_LEFT_HEAD))).toBe(false);
      expect(all.some((p) => p.getAttribute("d")?.startsWith(OPEN_RIGHT_HEAD))).toBe(false);
      expect(all.find((p) => p.getAttribute("d")?.startsWith(CLOSED_LEFT_HEAD))!.getAttribute("transform"))
        .toBe("translate(27.85,7.93) scale(0.667)");
      expect(all.find((p) => p.getAttribute("d")?.startsWith(CLOSED_RIGHT_HEAD))!.getAttribute("transform"))
        .toBe("translate(27.98,8.03) scale(0.667)");
    });
  });

  describe("the blink", () => {
    it.each<RenState>(["idle", "attentive", "thinking"])(
      "puts both pairs in the DOM for %s so the blink is an opacity swap, not a re-render",
      (state) => {
        const { container } = render(<RenAvatar state={state} />);

        expect(container.querySelector(".ren-eyes-open")).not.toBeNull();
        expect(container.querySelector(".ren-eyes-closed")).not.toBeNull();
      },
    );

    it("does not animate a warm Ren, which is already closed", () => {
      const { container } = render(<RenAvatar state="warm" />);

      expect(container.querySelector(".ren-eyes-open")).toBeNull();
      expect(container.querySelector(".ren-eyes-closed")).toBeNull();
    });
  });
});
