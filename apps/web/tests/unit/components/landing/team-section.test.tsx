import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";

import { TeamSection } from "@/components/landing/team-section";
import {
  TEAM_CAPTION,
  TEAM_MEMBERS,
  TEAM_SUPERVISORS_LABEL,
  TEAM_SUPERVISORS_LINE,
} from "@/lib/landing/copy";
import { TEAM_KEYS } from "@/lib/landing/team-silhouettes";

/**
 * T126 and T127 — the team section (`research.md` §12.2 "Accessibility"; ST-14).
 *
 * ── READ THIS BEFORE TRUSTING A GREEN RUN ────────────────────────────────────────────
 *
 * These assertions are about STRUCTURE, NAMES and BEHAVIOUR. They say nothing whatsoever
 * about GEOMETRY. jsdom counts DOM nodes, and DOM nodes have no layout: every assertion
 * in this file passes just as happily against an overlay that is offset, mirrored,
 * letterboxed, or attached to the wrong person. `toBeInTheDocument()` on a `<path>` is
 * not evidence that the path lands on a human being.
 *
 * The alignment check is visual, at 320/375/414/768 px, and the identity check — which
 * human is which name — is smoke test ST-7 and cannot be automated at all. Do not report
 * this file green as evidence that the overlay lines up.
 */

/** The one `<svg>` in the section: the silhouette overlay. */
function overlay(container: HTMLElement): SVGSVGElement {
  const svg = container.querySelector("svg[viewBox='0 0 100 100']");
  expect(svg, "the silhouette overlay is missing").not.toBeNull();
  return svg as SVGSVGElement;
}

describe("T126: the eight external links", () => {
  it("renders exactly eight links, and not one more", () => {
    const { container } = render(<TeamSection />);
    const links = container.querySelectorAll("a[href]");
    expect(links).toHaveLength(8);
  });

  it("gives all eight distinct accessible names identifying person AND destination", () => {
    const { container } = render(<TeamSection />);
    const names = Array.from(container.querySelectorAll("a[href]")).map((a) =>
      a.getAttribute("aria-label"),
    );

    // Distinct, so a screen reader's link list can tell all eight apart rather than
    // reading "GitHub" four times.
    expect(new Set(names).size).toBe(8);

    for (const member of TEAM_MEMBERS) {
      expect(names).toContain(member.githubLabel);
      expect(names).toContain(member.linkedinLabel);
      // Both halves of the requirement: the person and the destination.
      expect(member.githubLabel).toContain(member.name);
      expect(member.githubLabel).toMatch(/GitHub$/);
      expect(member.linkedinLabel).toContain(member.name);
      expect(member.linkedinLabel).toMatch(/LinkedIn$/);
    }
  });

  it("ships zero inert placeholders — the mock's href='#' must not reach production", () => {
    const { container } = render(<TeamSection />);
    expect(container.querySelectorAll('a[href="#"]')).toHaveLength(0);
    for (const a of Array.from(container.querySelectorAll("a[href]"))) {
      expect(a.getAttribute("href")).toMatch(/^https:\/\//);
    }
  });

  it("opens every external link safely", () => {
    const { container } = render(<TeamSection />);
    for (const a of Array.from(container.querySelectorAll("a[href]"))) {
      expect(a.getAttribute("rel"), `${a.getAttribute("aria-label")} rel`).toBe(
        "noopener noreferrer",
      );
      expect(a.getAttribute("target")).toBe("_blank");
    }
  });

  it("points each link at the URL recorded in copy.ts", () => {
    render(<TeamSection />);
    for (const member of TEAM_MEMBERS) {
      expect(screen.getByLabelText(member.githubLabel)).toHaveAttribute(
        "href",
        member.github,
      );
      expect(screen.getByLabelText(member.linkedinLabel)).toHaveAttribute(
        "href",
        member.linkedin,
      );
    }
  });

  /**
   * FROZEN, and deliberately duplicated rather than imported.
   *
   * The assertion above is circular on its own: it renders an anchor FROM
   * `member.github` and then checks the anchor's href EQUALS `member.github`, which is
   * true no matter what the constant says. A typo in `copy.ts` — `hebatullah003` mistyped
   * as `hebatullah03` — keeps every test in this file green while a public page sends a
   * visitor to a stranger's account or a 404.
   *
   * These eight literals are what breaks that circle. They are transcribed from the URLs
   * Mohamed supplied directly on 2026-07-27, which is also the source `copy.ts` used.
   * Six match `spec.md` FR-024's table character-for-character; Hebatullah's and Gehad's
   * LinkedIn carry a trailing slash the table omits, which is what he supplied and is
   * correct — see the note in `copy.ts`.
   *
   * If a change makes this fail, the change is wrong. Re-baselining the table restores
   * the circularity and defeats the point.
   */
  const FROZEN_URLS: Readonly<Record<string, readonly [string, string]>> = {
    mohamed: [
      "https://github.com/mohamedasem318",
      "https://www.linkedin.com/in/mohamedasem318/",
    ],
    fatma: [
      "https://github.com/Fatma-Alzahraaa",
      "https://www.linkedin.com/in/fatma-al-zahraa-emad-326b64234",
    ],
    hebatullah: [
      "https://github.com/hebatullah003",
      "https://www.linkedin.com/in/hebatullah-elgazoly-308ab2243/",
    ],
    gehad: [
      "https://github.com/gehaddmohamedd",
      "https://www.linkedin.com/in/gehad-mohamed-2a4946252/",
    ],
  };

  it("pins all eight URLs to frozen literals, so a typo cannot pass CI", () => {
    expect(Object.keys(FROZEN_URLS)).toEqual(TEAM_MEMBERS.map((m) => m.key));
    for (const member of TEAM_MEMBERS) {
      const [github, linkedin] = FROZEN_URLS[member.key]!;
      expect(member.github, `${member.name} GitHub`).toBe(github);
      expect(member.linkedin, `${member.name} LinkedIn`).toBe(linkedin);
    }
  });

  it("renders those frozen URLs, so the freeze reaches the DOM and not just the module", () => {
    const { container } = render(<TeamSection />);
    const hrefs = Array.from(container.querySelectorAll("a[href]")).map((a) =>
      a.getAttribute("href"),
    );
    expect(hrefs.sort()).toEqual(Object.values(FROZEN_URLS).flat().sort());
  });
});

describe("T126: the mapping is obtainable without hover", () => {
  it("renders four real buttons, one per person, in FR-024's fixed order", () => {
    render(<TeamSection />);
    const buttons = screen.getAllByRole("button");
    expect(buttons).toHaveLength(4);
    expect(buttons.map((b) => b.textContent)).toEqual(TEAM_MEMBERS.map((m) => m.name));
  });

  it("starts with nothing pressed", () => {
    render(<TeamSection />);
    for (const member of TEAM_MEMBERS) {
      expect(screen.getByRole("button", { name: member.name })).toHaveAttribute(
        "aria-pressed",
        "false",
      );
    }
  });

  it("sets aria-pressed on click AND the highlight persists once the pointer leaves", async () => {
    const user = userEvent.setup();
    render(<TeamSection />);
    const card = screen.getByRole("button", { name: "Hebatullah El Gazoly" });

    await user.click(card);
    expect(card).toHaveAttribute("aria-pressed", "true");

    // The whole requirement (FR-028, SC-009): move the pointer somewhere else and the
    // choice survives. A hover-only mapping fails right here.
    await user.unhover(card);
    await user.hover(document.body);
    expect(card).toHaveAttribute("aria-pressed", "true");
  });

  it("is operable by keyboard alone — Enter and Space both activate", async () => {
    const user = userEvent.setup();
    render(<TeamSection />);
    const first = screen.getByRole("button", { name: TEAM_MEMBERS[0].name });

    first.focus();
    await user.keyboard("{Enter}");
    expect(first).toHaveAttribute("aria-pressed", "true");

    await user.keyboard(" ");
    expect(first, "Space toggles it back off").toHaveAttribute("aria-pressed", "false");
  });

  it("pins exactly one person at a time", async () => {
    const user = userEvent.setup();
    render(<TeamSection />);
    const a = screen.getByRole("button", { name: TEAM_MEMBERS[0].name });
    const b = screen.getByRole("button", { name: TEAM_MEMBERS[3].name });

    await user.click(a);
    await user.click(b);
    expect(a).toHaveAttribute("aria-pressed", "false");
    expect(b).toHaveAttribute("aria-pressed", "true");
  });

  it("does not write hover or focus into aria-pressed", async () => {
    const user = userEvent.setup();
    render(<TeamSection />);
    const card = screen.getByRole("button", { name: TEAM_MEMBERS[1].name });

    // Preview is transient state and must not masquerade as the visitor's choice.
    await user.hover(card);
    expect(card).toHaveAttribute("aria-pressed", "false");
    card.focus();
    expect(card).toHaveAttribute("aria-pressed", "false");
  });

  it("keeps all twelve controls keyboard-reachable with a visible focus indicator", () => {
    const { container } = render(<TeamSection />);
    const controls = Array.from(
      container.querySelectorAll<HTMLElement>("a[href], button"),
    );
    expect(controls).toHaveLength(12); // 4 name buttons + 8 profile links

    for (const el of controls) {
      // Nothing is taken out of the tab order.
      expect(el.getAttribute("tabindex")).not.toBe("-1");
      // FR-055. jsdom cannot paint a ring, so the class that draws it is asserted
      // instead — this catches a removal, not a mis-render.
      expect(el.className, `${el.textContent || el.getAttribute("aria-label")}`).toContain(
        "focus-visible:ring-2",
      );
    }
  });
});

describe("T126: the overlay is decorative and stays out of the way", () => {
  it("marks the silhouette overlay aria-hidden", () => {
    const { container } = render(<TeamSection />);
    expect(overlay(container)).toHaveAttribute("aria-hidden");
  });

  it("contributes nothing to the tab order and no second copy of each person", () => {
    const { container } = render(<TeamSection />);
    const svg = overlay(container);

    // No focusable node inside the overlay — the cards are the accessible route, and
    // duplicating the people here would put every person in the tab order twice.
    expect(svg.querySelectorAll("a, button, [tabindex]")).toHaveLength(0);
    // Exactly four people are announced, not eight.
    expect(screen.getAllByRole("button")).toHaveLength(4);
  });

  it("keeps preserveAspectRatio='none' — a correctness constraint, not a style choice", () => {
    const { container } = render(<TeamSection />);
    // The SIL coordinates are normalised to the 1600×1164 crop. Any other value
    // reintroduces letterboxing and shifts every outline off its person (§9.2).
    expect(overlay(container)).toHaveAttribute("preserveAspectRatio", "none");
  });

  it("draws all four outlines, each carrying pointer affordance", () => {
    const { container } = render(<TeamSection />);
    const svg = overlay(container);
    // Three paths per person: glow, crisp outline, transparent hit area.
    expect(svg.querySelectorAll("path")).toHaveLength(TEAM_KEYS.length * 3);
    expect(svg.querySelectorAll('path[fill="transparent"]')).toHaveLength(
      TEAM_KEYS.length,
    );
  });
});

describe("T126: activating a silhouette highlights its card (FR-025, photo → card)", () => {
  it("pins the matching card when its outline is clicked", async () => {
    const user = userEvent.setup();
    const { container } = render(<TeamSection />);
    const hits = Array.from(
      overlay(container).querySelectorAll<SVGPathElement>('path[fill="transparent"]'),
    );
    expect(hits).toHaveLength(4);

    // Index 2 is `hebatullah` — the third key in FR-024's fixed order.
    await user.click(hits[2] as unknown as Element);

    expect(
      screen.getByRole("button", { name: "Hebatullah El Gazoly" }),
      "clicking the inner-right outline must press the third card",
    ).toHaveAttribute("aria-pressed", "true");
    expect(
      screen.getByRole("button", { name: "Gehad Mohamed" }),
      "and must not press anyone else",
    ).toHaveAttribute("aria-pressed", "false");
  });
});

describe("T126: the fixed copy renders exactly as approved", () => {
  it("renders the caption verbatim", () => {
    render(<TeamSection />);
    expect(screen.getByText(TEAM_CAPTION)).toBeInTheDocument();
    // Pinned against the constant drifting, not just against the render.
    expect(TEAM_CAPTION).toBe("Choose a name to find them in the photo.");
  });

  it("renders both supervisor credits verbatim (FR-027)", () => {
    render(<TeamSection />);
    expect(screen.getByText(TEAM_SUPERVISORS_LABEL)).toBeInTheDocument();
    expect(screen.getByText(TEAM_SUPERVISORS_LINE)).toBeInTheDocument();
    // Pinned as a literal, separator included. FR-027 fixes the rendered line, and
    // asserting it against `TEAM_SUPERVISORS.join(" · ")` would only prove the join
    // ran — not that the middle dot is the character FR-027 asks for.
    expect(TEAM_SUPERVISORS_LINE).toBe("Dr. Lamees Nasser · Dr. Safaa Mouneer");
  });

  it("keeps the two deliberate spellings of the first name apart", () => {
    render(<TeamSection />);
    // The team section carries the full FR-024 form; the legal documents use
    // "Mohamed Assem" throughout. Two shipped forms, deliberately different, and
    // reconciling them breaks a tested invariant in `lib/legal/copy.ts`. (FR-046's
    // single-s "Mohamed Asem" ships nowhere — see the note in `lib/landing/copy.ts`.)
    expect(screen.getByRole("button", { name: "Mohamed Assem Adel" })).toBeInTheDocument();
    expect(TEAM_MEMBERS[0].name).toBe("Mohamed Assem Adel");
  });
});

describe("T127 (ST-14): the section survives the photo failing to load", () => {
  it("keeps the cards, links and credits OUTSIDE the photo's container", () => {
    const { container } = render(<TeamSection />);
    const img = container.querySelector("img");
    expect(img).not.toBeNull();

    // The container that can fail is the photo's own wrapper. Assert it rather than
    // assume it: everything a visitor needs must be a sibling, not a descendant.
    const photoBox = (img as HTMLImageElement).parentElement as HTMLElement;
    const inside = within(photoBox);

    expect(inside.queryAllByRole("button")).toHaveLength(0);
    expect(photoBox.querySelectorAll("a[href]")).toHaveLength(0);
    expect(inside.queryByText(TEAM_CAPTION)).toBeNull();
    expect(inside.queryByText(TEAM_SUPERVISORS_LINE)).toBeNull();
  });

  it("leaves everything readable and operable after the image errors", async () => {
    const user = userEvent.setup();
    const { container } = render(<TeamSection />);
    const img = container.querySelector("img") as HTMLImageElement;

    // Simulate the request failing the way a blocked or 404'd asset does.
    img.dispatchEvent(new Event("error"));

    expect(container.querySelectorAll("a[href]")).toHaveLength(8);
    expect(screen.getAllByRole("button")).toHaveLength(4);
    expect(screen.getByText(TEAM_CAPTION)).toBeInTheDocument();
    expect(screen.getByText(TEAM_SUPERVISORS_LINE)).toBeInTheDocument();

    // Still operable, not merely still present.
    const card = screen.getByRole("button", { name: TEAM_MEMBERS[2].name });
    await user.click(card);
    expect(card).toHaveAttribute("aria-pressed", "true");
  });

  it("keeps the photo's box reserved so the layout cannot collapse", () => {
    const { container } = render(<TeamSection />);
    const img = container.querySelector("img") as HTMLImageElement;

    // `next/image` emits the intrinsic width/height, from which the browser computes
    // `aspect-ratio` and reserves the box before — and regardless of whether — the
    // bytes arrive. Combined with `h-auto w-full` that is what stops a failed image
    // from shrinking the section to nothing.
    expect(img.getAttribute("width")).toBe("1600");
    expect(img.getAttribute("height")).toBe("1164");
    expect(img.className).toContain("h-auto");
    expect(img.className).toContain("w-full");
    // And the alt text still describes the group when the pixels never arrive.
    expect(img.getAttribute("alt")).toBeTruthy();
  });
});
