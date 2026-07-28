import { expect, test } from "@playwright/test";

/**
 * The public shell's chrome, measured rather than inferred (2026-07-29,
 * `fix/navbar-chrome-and-active-state`).
 *
 * WHY THIS LIVES IN tests/layout AND NOT tests/e2e. `playwright.layout.config.ts` has no
 * `globalSetup` and needs no Supabase, so these run on any machine with a dev server. The
 * `tests/e2e` suite needs a local Supabase AND a `service_role` grant that does not
 * currently exist on any environment — see BACKLOG / issue #208; `globalSetup` aborts at
 * `42501` before a single spec executes. Every fact below is about public-route layout, so
 * the auth-gated suite was never the right home for it regardless.
 *
 * READ THIS BEFORE TRUSTING A GREEN RUN: **CI does not invoke this config.**
 * `.github/workflows/ci.yml` runs lint, typecheck, Vitest and pytest only — "No secrets, no
 * Supabase, no Playwright" (`ci.yml:4`). These are checks a human has to run with
 * `npm run -w apps/web test:layout`. They are a local instrument, not an enforced gate.
 *
 * WHAT IS NOT COVERED HERE. The app header's stickiness (`components/header/header.tsx`)
 * is on `/app`, which is authed, so this config cannot reach it. That property is covered
 * by class-list assertions in `components/header/header.test.tsx` only — the rendered
 * behaviour was measured by hand in real Chromium and recorded in that file's comment and
 * in docs/DECISIONS.md.
 */

const HEADER_PX = 64;

test.describe("public navbar — solid, not translucent", () => {
  test("has no backdrop filter and an opaque background", async ({ page }) => {
    await page.goto("/terms");
    await page.waitForSelector("header");

    const chrome = await page.evaluate(() => {
      const h = document.querySelector("header")!;
      const cs = getComputedStyle(h);
      return {
        backdropFilter: cs.backdropFilter,
        webkitBackdropFilter: (cs as unknown as Record<string, string>)["webkitBackdropFilter"],
        backgroundColor: cs.backgroundColor,
        inlineStyle: h.getAttribute("style"),
        position: cs.position,
        top: cs.top,
        zIndex: cs.zIndex,
        height: cs.height,
      };
    });

    // Two independent mechanisms produced the translucency; assert both are gone.
    expect(chrome.backdropFilter).toBe("none");
    expect(chrome.webkitBackdropFilter ?? "none").toBe("none");
    expect(chrome.inlineStyle ?? "").toBe("");

    // `rgb(...)` with no alpha channel. `rgba(..., 0.88)` or `color-mix(...)` would both
    // serialise with an alpha component here, which is exactly what must not come back.
    expect(chrome.backgroundColor).toMatch(/^rgb\(\d+, \d+, \d+\)$/);

    expect(chrome.position).toBe("sticky");
    expect(chrome.top).toBe("0px");
    expect(chrome.zIndex).toBe("50");
    expect(chrome.height).toBe(`${HEADER_PX}px`);
  });

  test("occludes content scrolling underneath rather than veiling it", async ({ page }) => {
    // The functional test of opacity: sample the bar's own pixels while a dense block of
    // body copy scrolls behind it, and require every one of them to equal the bar's
    // background exactly. An 88 %-opaque bar blends the text through and fails.
    // `/terms` rather than `/` on purpose. Both put dense body copy under the bar, but `/`
    // also runs the hero story's seventeen auto-advancing beats, and every extra worker
    // driving that route in parallel starves `landing-hero-stability.spec.ts` of the
    // real-time it needs between beats. Measured: adding two `/` loads to this suite made
    // that spec time out at 414px and 768px under the config's default worker count, while
    // the same four specs passed both on `main` and on this branch without them. A long
    // scrolling legal document exercises the identical navbar component and costs nothing.
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.goto("/terms");
    await page.waitForSelector("header");
    await page.evaluate(() => window.scrollTo(0, 700));
    await page.waitForTimeout(300);

    // The strip has to be EMPTY BAR — no wordmark, no pills, no buttons — or the bar's own
    // foreground shows up as "extra colours" and the test fails for the wrong reason.
    // Measured at 1280: wordmark ends at x≈105, the destination row starts at x≈465.
    // Sampled vertically inside the 64px bar but above its 1px bottom border.
    const strip = await page.evaluate(() => {
      const h = document.querySelector("header")!;
      const kids = [...h.querySelectorAll("a, button, nav")].map((e) => e.getBoundingClientRect());
      const wordmarkRight = Math.max(...kids.filter((r) => r.left < 300).map((r) => r.right));
      const nextLeft = Math.min(...kids.filter((r) => r.left > wordmarkRight + 8).map((r) => r.left));
      return { x: Math.round(wordmarkRight + 16), width: Math.round(nextLeft - wordmarkRight - 32) };
    });
    expect(strip.width, "no empty gap in the bar to sample").toBeGreaterThan(60);

    const shot = await page.screenshot({ clip: { x: strip.x, y: 10, width: strip.width, height: 36 } });
    const expected = await page.evaluate(() => getComputedStyle(document.querySelector("header")!).backgroundColor);
    const [er, eg, eb] = expected.match(/\d+/g)!.map(Number);

    // Decode the PNG via the browser itself rather than adding an image dependency.
    const distinct = await page.evaluate(async (bytes) => {
      const blob = new Blob([new Uint8Array(bytes)], { type: "image/png" });
      const bmp = await createImageBitmap(blob);
      const c = new OffscreenCanvas(bmp.width, bmp.height);
      const ctx = c.getContext("2d")!;
      ctx.drawImage(bmp, 0, 0);
      const { data } = ctx.getImageData(0, 0, bmp.width, bmp.height);
      const seen = new Set<string>();
      for (let i = 0; i < data.length; i += 4) seen.add(`${data[i]},${data[i + 1]},${data[i + 2]}`);
      return [...seen];
    }, Array.from(shot));

    // The strip is empty bar, so the bar's own background is the only colour that may
    // appear in it. Any second colour is body copy showing through.
    expect(distinct).toEqual([`${er},${eg},${eb}`]);
  });
});

test.describe("legal document — the sticky ToC clears the sticky navbar", () => {
  test("no part of the contents rail sits under the bar at lg", async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.goto("/terms");
    await page.waitForSelector("nav[aria-labelledby='legal-contents']");

    // Two scroll positions: the rail must be pinned at both, not merely clear at the top.
    for (const y of [1200, 3000]) {
      await page.evaluate((yy) => window.scrollTo(0, yy), y);
      await page.waitForTimeout(250);

      const m = await page.evaluate(() => {
        const header = document.querySelector("header")!.getBoundingClientRect();
        const nav = document.querySelector("nav[aria-labelledby='legal-contents']")!;
        const rail = nav.getBoundingClientRect();
        const heading = document.querySelector("#legal-contents")!.getBoundingClientRect();
        return {
          headerBottom: header.bottom,
          railTop: rail.top,
          railBottom: rail.bottom,
          headingTop: heading.top,
          viewportH: window.innerHeight,
          position: getComputedStyle(nav).position,
        };
      });

      expect(m.position).toBe("sticky");
      // Regression: at `lg:top-8` the rail parked at y=32 and the "Contents" heading was
      // entirely under the 64px bar.
      expect(m.railTop).toBeGreaterThanOrEqual(m.headerBottom);
      expect(m.headingTop).toBeGreaterThanOrEqual(m.headerBottom);
      // The max-height reserve must keep the rail inside the viewport, or the offset fix
      // just pushes the overflow to the other end.
      expect(m.railBottom).toBeLessThanOrEqual(m.viewportH);
    }
  });

  test("an anchored section heading lands clear of the bar", async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.goto("/terms");
    const links = page.locator("nav[aria-labelledby='legal-contents'] a");
    await links.first().waitFor();

    const count = await links.count();
    // Walk several, not one: the first few sections can be short enough that the page
    // cannot scroll far enough to expose an insufficient scroll-margin.
    for (const i of [3, 5, Math.min(8, count - 1)]) {
      const href = (await links.nth(i).getAttribute("href"))!;
      await links.nth(i).click();
      await page.waitForTimeout(500);

      const m = await page.evaluate((h) => {
        const section = document.querySelector(h)!;
        const header = document.querySelector("header")!.getBoundingClientRect();
        const heading = section.querySelector("h2")!.getBoundingClientRect();
        return { headerBottom: header.bottom, headingTop: heading.top };
      }, href);

      expect(m.headingTop, `heading for ${href} is under the navbar`).toBeGreaterThanOrEqual(
        m.headerBottom,
      );
    }
  });
});

test.describe("landing anchor", () => {
  test("#how-it-works lands clear of the sticky navbar", async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.goto("/");
    await page.waitForSelector("#how-it-works");

    const cta = page.locator("a[href='#how-it-works']").first();
    if (await cta.count()) {
      await cta.click();
    } else {
      await page.evaluate(() => document.querySelector("#how-it-works")!.scrollIntoView());
    }
    await page.waitForTimeout(600);

    const m = await page.evaluate(() => {
      const header = document.querySelector("header")!.getBoundingClientRect();
      const heading = document.querySelector("#how-it-works h2")!.getBoundingClientRect();
      return { headerBottom: header.bottom, headingTop: heading.top };
    });

    expect(m.headingTop).toBeGreaterThanOrEqual(m.headerBottom);
  });
});
