import { expect, test } from "@playwright/test";
import type { Page } from "@playwright/test";

/**
 * Real-browser proof that the focus indicator actually paints — both modes, and
 * under mouse as well as keyboard.
 *
 * CAVEAT, same as the #210 layout specs: this file is a LOCAL INSTRUMENT, not a
 * gate. CI's `web` job runs lint + typecheck + vitest only and never invokes
 * `playwright.layout.config.ts`. The CI-enforced half of this change is
 * `tests/unit/focus-indicator-guard.test.ts`.
 *
 * Why a browser is needed at all: the failure mode is not "is the class present"
 * but "does the outline paint". Tailwind v4's `outline-none` sets
 * `--tw-outline-style: none`, so `focus-visible:outline-2` alone sets a width on
 * an outline whose style is still `none` — computed `outlineStyle` stays "none"
 * and nothing renders. Only a real engine shows that; happy-dom cannot.
 */

const MEADOW = { light: "rgb(62, 122, 99)", dark: "rgb(99, 178, 146)" } as const;

/** Routes reachable without a session, and the control each one exercises. */
const SURFACES = [
  { route: "/login", selector: 'input[type="email"]', what: "field.tsx" },
  { route: "/login", selector: 'input[type="password"]', what: "password-input.tsx" },
  { route: "/signup", selector: 'input[type="email"]', what: "field.tsx on signup" },
  { route: "/forgot-password", selector: 'input[type="email"]', what: "forgot-form.tsx" },
] as const;

async function gotoIn(page: Page, route: string, mode: "light" | "dark") {
  // next-themes owns the `.dark` class; seeding its storage key and letting it
  // apply the class avoids racing its reconciliation.
  await page.addInitScript((m) => {
    try {
      window.localStorage.setItem("theme", m);
    } catch {
      /* ignore */
    }
  }, mode);
  await page.goto(route);
  await page.waitForFunction(
    (m) => document.documentElement.classList.contains("dark") === (m === "dark"),
    mode,
    { timeout: 10_000 },
  );
}

async function outlineOf(page: Page, selector: string) {
  await page.waitForTimeout(350); // transition-[...] settles; outline-color is not in the list
  return page.evaluate((sel) => {
    const el = document.querySelector<HTMLElement>(sel);
    if (!el) return null;
    const cs = getComputedStyle(el);
    return {
      focusVisible: el.matches(":focus-visible"),
      style: cs.outlineStyle,
      width: cs.outlineWidth,
      color: cs.outlineColor,
      offset: cs.outlineOffset,
    };
  }, selector);
}

for (const mode of ["light", "dark"] as const) {
  for (const { route, selector, what } of SURFACES) {
    test(`${mode} · ${route} · ${what} paints a 2px meadow outline on keyboard focus`, async ({
      page,
    }) => {
      await gotoIn(page, route, mode);
      await page.waitForSelector(selector, { state: "visible", timeout: 20_000 });

      await page.focus(selector);
      const focused = await outlineOf(page, selector);

      expect(focused, `${selector} not found on ${route}`).not.toBeNull();
      expect(focused!.focusVisible).toBe(true);
      // The bug this guards: style stays "none" when only the width is set.
      expect(focused!.style).toBe("solid");
      expect(focused!.width).toBe("2px");
      expect(focused!.color).toBe(MEADOW[mode]);
      // Flush against the border — an offset reintroduces the two-outlines read.
      expect(focused!.offset).toBe("0px");
    });
  }

  test(`${mode} · the outline also paints under MOUSE click, not just keyboard`, async ({
    page,
  }) => {
    await gotoIn(page, "/login", mode);
    await page.waitForSelector('input[type="email"]', { state: "visible", timeout: 20_000 });

    await page.click('input[type="email"]');
    const clicked = await outlineOf(page, 'input[type="email"]');

    // :focus-visible matches on text-entry controls regardless of modality, so the
    // focus: -> focus-visible: swap does not regress mouse users. Verified, not assumed.
    expect(clicked!.focusVisible).toBe(true);
    expect(clicked!.style).toBe("solid");
    expect(clicked!.color).toBe(MEADOW[mode]);
  });

  test(`${mode} · resting state paints NO outline`, async ({ page }) => {
    await gotoIn(page, "/login", mode);
    await page.waitForSelector('input[type="email"]', { state: "visible", timeout: 20_000 });
    const resting = await outlineOf(page, 'input[type="email"]');
    expect(resting!.style).toBe("none");
  });
}
