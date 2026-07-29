import { describe, expect, it, vi } from "vitest";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

// The theme toggle is the app header's component, reused here so the two bars match
// (FR-018). It owns its own accessible name and has its own coverage; stubbing it keeps
// this suite about the public shell rather than about next-themes' hydration dance.
vi.mock("@/app/theme-toggle", () => ({
  ThemeToggle: () => (
    <button type="button" aria-label="Switch to dark mode" data-testid="theme-toggle" />
  ),
}));

vi.mock("next/navigation", () => ({
  usePathname: () => "/terms",
}));

// The sign-out server action, stubbed the same way `header/profile-dropdown.test.tsx`
// stubs it — importing the real module pulls `next/headers` into a happy-dom process
// that has no request to read cookies from.
vi.mock("@/app/(authed)/actions", () => ({ signOut: vi.fn() }));

import { PUBLIC_DESTINATIONS } from "@/components/public/destinations";
import { PublicFooter } from "@/components/public/public-footer";
import { PublicMobileNav } from "@/components/public/public-mobile-nav";
import { PublicNavbar } from "@/components/public/public-navbar";

/**
 * T034 — the public shell's accessibility and its one approved copy string
 * (SC-008/SC-009 for the shell; FR-018, FR-019, FR-023).
 *
 * The shell is the first thing a stranger meets and the only navigation a signed-out
 * visitor has, so the assertions here are about whether it can be operated at all: does
 * every control have a name a screen reader can announce, and is there anything on this
 * signed-out surface that points into the application?
 */

/** Every element a keyboard or screen reader would land on, in DOM order. */
function interactiveElements(container: HTMLElement): HTMLElement[] {
  return Array.from(container.querySelectorAll<HTMLElement>("a[href], button"));
}

/** The name a screen reader would announce: aria-label first, else the text content. */
function accessibleName(element: HTMLElement): string {
  return (element.getAttribute("aria-label") ?? element.textContent ?? "").trim();
}

describe("PublicNavbar", () => {
  it("gives every interactive element an accessible name", () => {
    const { container } = render(<PublicNavbar />);
    const elements = interactiveElements(container);

    expect(elements.length).toBeGreaterThan(0);
    for (const element of elements) {
      expect(
        accessibleName(element),
        `an interactive element in the navbar has no accessible name: ${element.outerHTML}`,
      ).not.toBe("");
    }
  });

  it("links the wordmark to / with a label that says where it goes", () => {
    render(<PublicNavbar />);
    const home = screen.getByLabelText("Serenify home");
    expect(home).toHaveAttribute("href", "/");
    expect(home).toHaveTextContent("serenify");
  });

  it("gives the wordmark link a 44 px tap target (FR-053)", () => {
    // Regression. The T036 walk measured this link at 81×24 in a real browser: the app
    // header's equivalent has the same gap, so copying the app header faithfully — which
    // FR-018 requires — reproduced the defect rather than avoiding it.
    render(<PublicNavbar />);
    expect(screen.getByLabelText("Serenify home").className).toMatch(/\bmin-h-11\b/);
  });

  it("exposes every public destination", () => {
    const { container } = render(<PublicNavbar />);
    const hrefs = Array.from(container.querySelectorAll("a[href]")).map((a) =>
      a.getAttribute("href"),
    );
    for (const { href } of PUBLIC_DESTINATIONS) {
      expect(hrefs).toContain(href);
    }
  });

  /**
   * FR-018's leak protection, kept at exactly its original strictness.
   *
   * FR-018 (spec.md:379) says the public navbar carries "no dashboard or authed links".
   * As of 2026-07-29 that is **superseded for the signed-in case only** — a signed-in
   * viewer now gets "Go to app" and the profile dropdown (docs/DECISIONS.md). What FR-018
   * was actually guarding is untouched and asserted below without conditions: an authed
   * destination must never reach a visitor who has no session.
   *
   * THE ORIGINAL COMMENT NAMED THE FAILURE AND IT IS STILL LIVE: somebody
   * "de-duplicating" this component and the app header into one that takes an optional
   * session, at which point an authed destination reaches a signed-out page. That risk
   * went UP with this change, not down, because the component now has a signed-in branch
   * to get wrong. So the signed-out case is asserted across all three ways of expressing
   * "no viewer" — omitted, `undefined`, and `null` — because a merged component that
   * defaults its session parameter, or that branches on a truthiness test that a null
   * profile object would pass, fails on at least one of them.
   */
  describe("signed out — exposes NO dashboard or authed link anywhere (FR-018)", () => {
    const noViewer = [
      ["prop omitted", <PublicNavbar key="omitted" />],
      ["viewer={undefined}", <PublicNavbar key="undef" viewer={undefined} />],
      ["viewer={null}", <PublicNavbar key="null" viewer={null} />],
    ] as const;

    it.each(noViewer)("%s → no authed href", (_label, element) => {
      const { container } = render(element);
      const hrefs = Array.from(container.querySelectorAll("a[href]")).map(
        (a) => a.getAttribute("href") ?? "",
      );

      expect(hrefs.length).toBeGreaterThan(0);
      for (const href of hrefs) {
        expect(href, `authed destination on the public navbar: ${href}`).not.toMatch(
          /^\/app(\/|$)|^\/onboarding(\/|$)|^\/auth(\/|$)/,
        );
      }
    });

    it.each(noViewer)("%s → no authed vocabulary in the rendered text", (_label, element) => {
      const { container } = render(element);
      expect(container.textContent).not.toMatch(
        /\b(dashboard|sign out|my account|profile)\b/i,
      );
    });

    it.each(noViewer)("%s → no avatar trigger at all", (_label, element) => {
      // The dropdown's trigger is the thing that HOLDS the authed destinations, and it
      // is rendered by a Radix portal that only mounts its content on open — so the two
      // assertions above cannot see /app/account or "Sign out" while the menu is closed.
      // Asserting the trigger's absence is what actually covers them here.
      render(element);
      expect(screen.queryByLabelText("Open profile menu")).toBeNull();
    });

    it("still offers the two doors IN, which is the signed-out surface's whole job", () => {
      render(<PublicNavbar />);
      expect(screen.getByRole("link", { name: "Sign in" })).toHaveAttribute("href", "/login");
      expect(screen.getByRole("link", { name: "Sign up" })).toHaveAttribute("href", "/signup");
    });
  });

  /**
   * Signed in — the bug this change fixes.
   *
   * A pre-013 user meets the re-consent gate, opens /terms from it (in a new tab, by
   * design — `terms-reconsent-screen.tsx:104`), and the site greets them as a stranger.
   * There are ~20 production accounts and every pre-013 one meets that gate.
   */
  describe("signed in", () => {
    const viewer = { fullName: "Amira Hassan", email: "amira@example.com" } as const;

    it("offers a direct way back into the application", () => {
      render(<PublicNavbar viewer={viewer} />);
      expect(screen.getByRole("link", { name: "Go to app" })).toHaveAttribute("href", "/app");
    });

    it("shows the profile dropdown, with the viewer's initials", () => {
      render(<PublicNavbar viewer={viewer} />);
      expect(screen.getByLabelText("Open profile menu")).toHaveTextContent("AH");
    });

    it("carries Account and Sign out inside the dropdown", async () => {
      render(<PublicNavbar viewer={viewer} />);
      await userEvent.click(screen.getByLabelText("Open profile menu"));

      expect(screen.getByTestId("profile-dropdown-account")).toHaveAttribute(
        "href",
        "/app/account",
      );
      expect(screen.getByTestId("profile-dropdown-signout")).toBeInTheDocument();
    });

    it("shows NEITHER Sign in NOR Sign up", () => {
      // The actual reported defect. Both must be gone, not merely de-emphasised.
      render(<PublicNavbar viewer={viewer} />);
      expect(screen.queryByRole("link", { name: "Sign in" })).toBeNull();
      expect(screen.queryByRole("link", { name: "Sign up" })).toBeNull();
    });

    it("keeps the theme toggle and the public destinations", () => {
      // The signed-in branch replaces the auth pair and nothing else.
      const { container } = render(<PublicNavbar viewer={viewer} />);
      expect(screen.getByTestId("theme-toggle")).toBeInTheDocument();

      const hrefs = Array.from(container.querySelectorAll("a[href]")).map((a) =>
        a.getAttribute("href"),
      );
      for (const { href } of PUBLIC_DESTINATIONS) {
        expect(hrefs).toContain(href);
      }
    });

    it("gives 'Go to app' a 44 px target whose label cannot wrap (FR-053)", () => {
      render(<PublicNavbar viewer={viewer} />);
      const cls = screen.getByRole("link", { name: "Go to app" }).className;
      expect(cls).toMatch(/\bh-11\b/);
      expect(cls).toMatch(/whitespace-nowrap/);
    });

    it("hides 'Go to app' below 420 px, where the bar has no room for it", () => {
      // Same budget the signed-out bar spends on Sign up: at 320 px the row already
      // carries a hamburger, a wordmark, a theme toggle and now a 44 px avatar. The
      // sheet carries it at every width instead (asserted in the PublicMobileNav block).
      render(<PublicNavbar viewer={viewer} />);
      const cls = screen.getByRole("link", { name: "Go to app" }).className;
      expect(cls).toMatch(/\bhidden\b/);
      expect(cls).toMatch(/min-\[420px\]:inline-flex/);
    });
  });

  it("renders the theme toggle, matching the app header's placement", () => {
    render(<PublicNavbar />);
    expect(screen.getByTestId("theme-toggle")).toBeInTheDocument();
  });

  /**
   * At widths where only one auth control fits, that control must be SIGN IN.
   *
   * P3 kept Sign up, following the mock. On the landing page that leaves a returning
   * visitor with no door at all on a phone — the hero's CTA is the signup path, so a
   * navbar Sign up is the second signup control on the screen while Sign in has none.
   *
   * Asserted on the class list rather than by measuring: happy-dom does not run the
   * Tailwind build, so `hidden` / `min-[420px]:inline-flex` is the honest thing to read.
   */
  describe("the narrow-width auth control (below 420 px)", () => {
    function authLink(label: string): HTMLElement {
      const link = screen.getByRole("link", { name: label });
      // The utility pair lives on the Button that wraps the link via `asChild`, which
      // merges its className onto the anchor itself.
      return link;
    }

    it("keeps Sign in visible at every width", () => {
      render(<PublicNavbar />);
      expect(authLink("Sign in").className).not.toMatch(/\bhidden\b/);
    });

    it("hides Sign up below 420 px, where the hero already carries the signup path", () => {
      render(<PublicNavbar />);
      const signUp = authLink("Sign up").className;
      expect(signUp).toMatch(/\bhidden\b/);
      expect(signUp).toMatch(/min-\[420px\]:inline-flex/);
    });

    it("still offers BOTH doors in the sheet, at every width (FR-019)", async () => {
      // The bar's width budget is not the sheet's problem — whichever control the bar
      // drops, the hamburger must still carry it. The panel is unmounted until opened,
      // so this has to actually open it rather than query a closed Sheet.
      render(<PublicMobileNav />);
      await userEvent.click(screen.getByLabelText("Open menu"));

      expect(screen.getByRole("link", { name: "Sign in" })).toHaveAttribute("href", "/login");
      expect(screen.getByRole("link", { name: "Sign up" })).toHaveAttribute("href", "/signup");
    });
  });

  /**
   * The desktop destination row marks the page you are on.
   *
   * `aria-current="page"` is the machine-readable half and is asserted first because it is
   * the half that is not optional. The visible half is a `bg-surface` pill and nothing
   * else — the underline that PR #188 added was removed on 2026-07-29 so this row renders
   * identically to `CenterNav`. That trade (a weak, colour-only indicator, shared with the
   * app bar rather than fixed in one place) was ruled on explicitly; see
   * `public-desktop-nav.tsx`'s comment and docs/DECISIONS.md.
   *
   * ASSERTED AS CONCRETE PROPERTIES, not by string-comparing this component against
   * `CenterNav`. A comparison would pass whenever both drift together, which is the likely
   * failure mode given they are meant to move as a pair. `components/header/center-nav.test.tsx`
   * asserts the same three facts about the other component independently.
   */
  describe("the desktop nav marks the current page", () => {
    // The module-level mock puts the pathname at /terms.
    function publicPills(container: HTMLElement): HTMLElement[] {
      return Array.from(
        container.querySelectorAll<HTMLElement>("nav[aria-label='Public pages'] a"),
      );
    }

    it("sets aria-current='page' on exactly the current destination", () => {
      const { container } = render(<PublicNavbar />);
      const current = container.querySelectorAll("a[aria-current='page']");

      expect(current.length).toBe(1);
      expect(current[0]).toHaveAttribute("href", "/terms");
    });

    it("marks it with bg-surface", () => {
      const { container } = render(<PublicNavbar />);
      const current = container.querySelector<HTMLElement>("a[aria-current='page']");

      expect(current?.className).toMatch(/\bbg-surface\b/);
    });

    it("leaves the inactive destinations without the active fill", () => {
      const { container } = render(<PublicNavbar />);
      const inactive = publicPills(container).filter(
        (a) => a.getAttribute("aria-current") === null,
      );

      expect(inactive.length).toBeGreaterThan(0);
      for (const link of inactive) {
        // `hover:bg-surface` is on every pill; match the bare utility, not a substring.
        expect(link.className.split(/\s+/)).not.toContain("bg-surface");
      }
    });

    it("carries no underline on any destination, current or not", () => {
      // Dropped 2026-07-29 to mirror CenterNav exactly. Asserted in both directions so a
      // future edit cannot quietly restore the divergence from either side.
      const { container } = render(<PublicNavbar />);
      const pills = publicPills(container);

      expect(pills.length).toBeGreaterThan(0);
      for (const link of pills) {
        expect(link.className).not.toMatch(/\bunderline\b/);
      }
    });

    it("gives every destination a 44 px tap target (FR-053)", () => {
      // The one property that did NOT move to match CenterNav's original: FR-053 requires
      // 44 px here and its single exception is spent (spec.md, amended 2026-07-28), so
      // CenterNav was raised to h-11 instead of this row being lowered to h-9.
      const { container } = render(<PublicNavbar />);
      for (const link of publicPills(container)) {
        expect(link.className).toMatch(/\bh-11\b/);
        expect(link.className).not.toMatch(/\bh-9\b/);
      }
    });

    it("uses rounded-md and the ink resting colour", () => {
      const { container } = render(<PublicNavbar />);
      for (const link of publicPills(container)) {
        expect(link.className).toMatch(/\brounded-md\b/);
        expect(link.className).toMatch(/\btext-ink\b/);
      }
    });

    it("does not mark Home on a descendant route", () => {
      // Every path starts with "/", so a prefix match on Home would light it up on
      // /terms and /privacy too. This is the assertion that catches that.
      const { container } = render(<PublicNavbar />);
      const home = container.querySelector<HTMLElement>("a[href='/']:not([aria-label])");

      expect(home?.getAttribute("aria-current")).toBeNull();
    });
  });

  /**
   * The bar itself is SOLID and STICKY (2026-07-29).
   *
   * The translucency — an inline `color-mix` over 88 % `--color-bg` plus `backdrop-blur-md`,
   * both copied from the landing mock — was removed. The inline `style` was a colour
   * declaration bypassing the token utilities, which is what FR-057 exists to prevent, and
   * an 88 % veil over scrolling body copy bought nothing. The mock is spent as the authority
   * for this element's background specifically; see docs/DECISIONS.md 2026-07-29.
   *
   * The blur and the alpha are asserted separately because they are two independent
   * mechanisms and removing one while leaving the other would still be translucent.
   */
  describe("the bar's chrome", () => {
    function banner(): HTMLElement {
      render(<PublicNavbar />);
      return screen.getByRole("banner");
    }

    it("carries NO backdrop blur", () => {
      expect(banner().className).not.toMatch(/backdrop-blur/);
    });

    /*
     * THE INLINE `color-mix` STYLE IS NOT ASSERTED HERE, DELIBERATELY. The obvious test —
     * `expect(banner().getAttribute("style")).toBe("")` — was written, run against `main`,
     * and PASSED there, which makes it worthless: happy-dom's CSS parser rejects
     * `color-mix(in srgb, …)` as an unknown value and drops it, so the attribute is empty
     * whether or not the component sets it. A test that cannot go red is not a test.
     * Real Chromium keeps the declaration, so the assertion lives in
     * `tests/layout/public-chrome.spec.ts` instead, where it means something.
     */
    it("uses the opaque bg-bg token, the same one the app header uses", () => {
      const cls = banner().className;
      expect(cls).toMatch(/\bbg-bg\b/);
      expect(cls).not.toMatch(/\/\d{1,2}\b/); // no `bg-bg/88`-style alpha suffix
    });

    it("stays sticky at the top, at z-50, at 64 px", () => {
      const cls = banner().className;
      expect(cls).toMatch(/\bsticky\b/);
      expect(cls).toMatch(/\btop-0\b/);
      expect(cls).toMatch(/\bz-50\b/);
      expect(cls).toMatch(/\bh-16\b/);
    });
  });
});

describe("PublicMobileNav", () => {
  it("labels the trigger exactly 'Open menu' (FR-019)", () => {
    render(<PublicMobileNav />);
    // Exact string: the app's own hamburger uses it, and a visitor who later signs in
    // should meet the same control with the same name.
    const trigger = screen.getByLabelText("Open menu");
    expect(trigger).toBeInTheDocument();
    expect(trigger.tagName).toBe("BUTTON");
  });

  it("gives the trigger a 44 px tap target (FR-053)", () => {
    render(<PublicMobileNav />);
    const trigger = screen.getByLabelText("Open menu");
    expect(trigger.className).toMatch(/\bh-11\b/);
    expect(trigger.className).toMatch(/\bw-11\b/);
  });

  it("carries a visible focus indicator (FR-055)", () => {
    render(<PublicMobileNav />);
    expect(screen.getByLabelText("Open menu").className).toMatch(/focus-visible:ring-2/);
  });

  /**
   * The sheet is a SECOND surface, and the bug moves into it if it is left alone.
   *
   * Below 420 px the bar drops its one wide control — Sign up when signed out, "Go to
   * app" when signed in — so at the narrowest widths this panel is the only place that
   * control exists. It therefore has to know about the session too.
   */
  describe("signed in", () => {
    const viewer = { fullName: "Amira Hassan", email: "amira@example.com" } as const;

    it("offers 'Go to app' instead of the two doors in", async () => {
      render(<PublicMobileNav viewer={viewer} />);
      await userEvent.click(screen.getByLabelText("Open menu"));

      expect(screen.getByRole("link", { name: "Go to app" })).toHaveAttribute("href", "/app");
      expect(screen.queryByRole("link", { name: "Sign in" })).toBeNull();
      expect(screen.queryByRole("link", { name: "Sign up" })).toBeNull();
    });

    it("keeps every public destination in the page list", async () => {
      render(<PublicMobileNav viewer={viewer} />);
      await userEvent.click(screen.getByLabelText("Open menu"));

      for (const { label } of PUBLIC_DESTINATIONS) {
        expect(screen.getByRole("link", { name: label })).toBeInTheDocument();
      }
    });
  });

  describe("signed out — the sheet leaks nothing either (FR-018)", () => {
    it.each([
      ["prop omitted", <PublicMobileNav key="omitted" />],
      ["viewer={null}", <PublicMobileNav key="null" viewer={null} />],
    ])("%s → no authed href in the open sheet", async (_label, element) => {
      const { baseElement } = render(element);
      await userEvent.click(screen.getByLabelText("Open menu"));

      // `baseElement`, not `container`: Radix portals the panel to document.body.
      const hrefs = Array.from(baseElement.querySelectorAll("a[href]")).map(
        (a) => a.getAttribute("href") ?? "",
      );
      expect(hrefs.length).toBeGreaterThan(0);
      for (const href of hrefs) {
        expect(href, `authed destination in the public sheet: ${href}`).not.toMatch(
          /^\/app(\/|$)|^\/onboarding(\/|$)|^\/auth(\/|$)/,
        );
      }
    });
  });
});

describe("PublicFooter", () => {
  it("links to both /terms and /privacy (FR-023)", () => {
    const { container } = render(<PublicFooter />);
    const hrefs = Array.from(container.querySelectorAll("a[href]")).map((a) =>
      a.getAttribute("href"),
    );
    expect(hrefs).toContain("/terms");
    expect(hrefs).toContain("/privacy");
  });

  it("renders the approved copyright line EXACTLY (plan.md §10.3)", () => {
    render(<PublicFooter />);
    // Asserted as an exact string, so a re-worded copyright line fails CI rather than
    // shipping. `© 2026 Serenify` is the only approved-copy string in this phase and it
    // is fixed character for character — no institutional attribution, no em-dash suffix.
    expect(screen.getByText("© 2026 Serenify")).toBeInTheDocument();
  });

  it("carries no institutional attribution (plan.md §0.6)", () => {
    const { container } = render(<PublicFooter />);
    // §0.6's resolution: the Privacy Policy names Mohamed Asem as the individual data
    // controller, so a footer naming a university reads as a contradicting entity claim.
    expect(container.textContent).not.toMatch(/university|capital|inc\.|ltd|llc|©.*—/i);
  });

  it("renders the wordmark", () => {
    const { container } = render(<PublicFooter />);
    expect(container.textContent).toContain("serenify");
  });

  it("gives every footer link an accessible name and a 44 px target", () => {
    const { container } = render(<PublicFooter />);
    const nav = container.querySelector<HTMLElement>("nav[aria-label='Legal']");
    expect(nav).not.toBeNull();

    const links = within(nav as HTMLElement).getAllByRole("link");
    expect(links.length).toBe(PUBLIC_DESTINATIONS.length);
    for (const link of links) {
      expect(accessibleName(link)).not.toBe("");
      expect(link.className).toMatch(/min-h-11/);
      // Regression, both axes. The T036 walk measured "Terms" at 41 px WIDE while it
      // passed the height floor — a short label makes an inline-flex link narrower than
      // the 44 px target even when its height is right.
      expect(link.className).toMatch(/min-w-11/);
      // FR-053: a tap target's label must not wrap to two lines.
      expect(link.className).toMatch(/whitespace-nowrap/);
    }
  });
});
