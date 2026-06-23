import { expect, test, type Page } from "@playwright/test";

/**
 * Feature 009 / DC-001 — the fixed-px lane plot must respond to the REAL measured wrapper width:
 * a few sessions FILL a wide screen; on a phone the lanes clamp to LANE_MIN and the strip SCROLLS
 * (never stretch, never crush — the totem bug). happy-dom has no layout, so the unit tests can only
 * feed an explicit `availableWidth`; this guard runs a real chromium against the live measurement
 * path (ResizeObserver → laneWidthFor) via the auth-free /today-plot-harness route.
 *
 * NOTE for Polish (009): this IS the e2e 360px-tightening assertion — reference it, don't rewrite.
 *
 * It also pins WHY an earlier spike "saw" a stuck 1008 default: that was an un-hydrated page
 * (127.0.0.1 cross-origin dev-block), not a measurement bug. This config hits `localhost`, which
 * hydrates — so reaching the clamped width below also proves the page is interactive.
 */

const NLANES = 4;
const LANE_MIN = 112; // trend-geometry LANE_MIN
const PLOT_H = 200; // trend-geometry PLOT_H
const HARNESS = "/today-plot-harness";

interface PlotGeometry {
  nLanes: number;
  svgWidthAttr: number;
  viewBox: string | null;
  laneWidthFromAttr: number;
  laneWidthRendered: number; // from a lane-bg bounding rect (catches CSS stretch)
  svgRenderedWidth: number;
  wrapperClientWidth: number;
  scrollWidth: number;
  clientWidth: number;
}

/** Read the plot geometry from the real DOM after the measurement has settled. */
async function readPlot(page: Page): Promise<PlotGeometry> {
  return page.evaluate(
    () =>
      new Promise<PlotGeometry>((resolve) => {
        let frame = 0;
        const tick = () => {
          // let ResizeObserver → setMeasured → re-render settle across a few frames
          if (++frame < 6) return requestAnimationFrame(tick);
          const svg = document.querySelector('[data-testid="plot-svg"]') as SVGSVGElement;
          const scroll = document.querySelector('[data-testid="plot-scroll"]') as HTMLElement;
          const wrapper = scroll.parentElement as HTMLElement; // the measured flex-1 min-w-0 div
          const laneBgs = Array.from(document.querySelectorAll("[data-lane-bg]"));
          const widthAttr = Number(svg.getAttribute("width"));
          const firstLaneBg = laneBgs[0];
          const laneRect = firstLaneBg ? firstLaneBg.getBoundingClientRect().width : NaN; // = laneWidth - 4 user units
          resolve({
            nLanes: laneBgs.length,
            svgWidthAttr: widthAttr,
            viewBox: svg.getAttribute("viewBox"),
            laneWidthFromAttr: widthAttr / laneBgs.length,
            laneWidthRendered: Math.round(laneRect + 4),
            svgRenderedWidth: Math.round(svg.getBoundingClientRect().width),
            wrapperClientWidth: wrapper.clientWidth,
            scrollWidth: scroll.scrollWidth,
            clientWidth: scroll.clientWidth,
          });
        };
        requestAnimationFrame(tick);
      }),
  );
}

/**
 * Wait until the plot reflects the MEASURED wrapper, not the un-measured SSR default. On a narrow
 * wrapper the default (DEFAULT_AVAIL) renders a far-too-wide SVG; the live path clamps it to
 * nLanes×LANE_MIN. On a wide wrapper the SVG simply fits. Both are false until hydrate+measure runs,
 * so this doubles as a hydration gate (a timeout here means the page never went interactive).
 */
async function waitForSettled(page: Page): Promise<void> {
  await page.waitForSelector('[data-testid="plot-svg"]');
  await page.waitForFunction(
    (laneMin) => {
      const svg = document.querySelector('[data-testid="plot-svg"]');
      const scroll = document.querySelector('[data-testid="plot-scroll"]');
      if (!svg || !scroll) return false;
      const w = Number(svg.getAttribute("width"));
      const lanes = document.querySelectorAll("[data-lane-bg]").length;
      const wrapper = (scroll.parentElement as HTMLElement).clientWidth;
      return w === lanes * laneMin || w <= wrapper + 2;
    },
    LANE_MIN,
    { timeout: 15_000 },
  );
}

test.describe("TodayTrendPlot — fixed-px width responds to the viewport (DC-001)", () => {
  test("narrow 360px: lanes clamp to LANE_MIN, svg = n×112, scrolls, no stretch", async ({ page }) => {
    await page.setViewportSize({ width: 360, height: 800 });
    await page.goto(HARNESS);
    await waitForSettled(page);

    const g = await readPlot(page);
    expect(g.nLanes).toBe(NLANES);

    // tightened to the floor — measured BOTH from the width attribute and the rendered rect
    expect(g.laneWidthFromAttr).toBe(LANE_MIN);
    expect(g.laneWidthRendered).toBeGreaterThanOrEqual(LANE_MIN - 1);
    expect(g.laneWidthRendered).toBeLessThanOrEqual(LANE_MIN + 1);

    // SVG width === viewBox width === nLanes × laneWidth (1 unit = 1 px — no stretched viewBox)
    expect(g.svgWidthAttr).toBe(NLANES * LANE_MIN);
    expect(g.viewBox).toBe(`0 0 ${NLANES * LANE_MIN} ${PLOT_H}`);
    expect(Math.abs(g.svgRenderedWidth - NLANES * LANE_MIN)).toBeLessThanOrEqual(1);

    // the fixed-px strip is wider than its wrapper → it SCROLLS (does not stretch/crush)
    expect(g.scrollWidth).toBeGreaterThan(g.clientWidth);
  });

  test("wide 1280px: lanes fill (> LANE_MIN), svg fills wrapper, no overflow, no stretch", async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 900 });
    await page.goto(HARNESS);
    await waitForSettled(page);

    const g = await readPlot(page);
    expect(g.nLanes).toBe(NLANES);

    // fills the available width (strictly above the floor)
    expect(g.laneWidthFromAttr).toBeGreaterThan(LANE_MIN);

    // still fixed-px: width attr is exactly nLanes × laneWidth, rendered px matches (no stretch)
    expect(g.svgWidthAttr).toBe(g.nLanes * g.laneWidthFromAttr);
    expect(Math.abs(g.svgRenderedWidth - g.svgWidthAttr)).toBeLessThanOrEqual(1);
    expect(g.viewBox).toBe(`0 0 ${g.svgWidthAttr} ${PLOT_H}`);

    // fits the wrapper → no horizontal overflow
    expect(g.scrollWidth).toBeLessThanOrEqual(g.clientWidth + 1);
  });

  test("the measured laneWidth tracks the viewport (narrow ≠ wide)", async ({ page }) => {
    await page.setViewportSize({ width: 360, height: 800 });
    await page.goto(HARNESS);
    await waitForSettled(page);
    const narrow = await readPlot(page);

    await page.setViewportSize({ width: 1280, height: 900 });
    await waitForSettled(page);
    const wide = await readPlot(page);

    expect(narrow.laneWidthFromAttr).toBe(LANE_MIN);
    expect(wide.laneWidthFromAttr).toBeGreaterThan(narrow.laneWidthFromAttr);
  });
});

/**
 * Feature 009 / T031 — no first-paint width flash. Before the wrapper is measured (SSR + the very
 * first client paint), `avail` falls back to DEFAULT_AVAIL (1008); on a 360px phone the fixed-px SVG
 * would paint at ~1008 and overflow for the paint(s) before measurement snaps it to n×LANE_MIN.
 * The fix is measure-then-render: hold the slot with a height-reserving placeholder (= PLOT_H, so
 * NO vertical layout shift) and render the SVG only once the width is known.
 *
 * Why JS-disabled rather than a throttled single-frame capture: with scripting off there is no
 * hydration and no ResizeObserver, so the page is frozen at its un-measured server output — a
 * DETERMINISTIC snapshot of "first paint" (no frame-timing flake). If the wide SVG can ever exist
 * pre-measurement it exists here; asserting its absence (and a correctly-sized placeholder) proves
 * the flash is gone. The settled half ("then correct") stays covered by the DC-001 tests above.
 */
test.describe("TodayTrendPlot — no first-paint width flash (T031 / SC-002)", () => {
  test("first paint (JS disabled): no wide SVG exists; a placeholder reserves the plot height", async ({
    browser,
  }) => {
    const context = await browser.newContext({ javaScriptEnabled: false });
    try {
      const page = await context.newPage();
      await page.setViewportSize({ width: 360, height: 800 });
      await page.goto(HARNESS);

      // the 1008-derived (overflowing) SVG must NEVER exist in the un-measured first-paint DOM
      await expect(page.locator('[data-testid="plot-svg"]')).toHaveCount(0);

      // instead, a placeholder holds the slot at the eventual plot height → no horizontal flash
      const placeholder = page.locator('[data-testid="plot-placeholder"]');
      await expect(placeholder).toHaveCount(1);
      const phBox = await placeholder.boundingBox();
      expect(phBox).not.toBeNull();
      expect(Math.abs((phBox?.height ?? 0) - PLOT_H)).toBeLessThanOrEqual(1);

      // the reserved plot region equals PLOT_H — the same height the settled SVG occupies (no CLS)
      const containerBox = await page.locator('[data-testid="today-plot"]').boundingBox();
      expect(Math.abs((containerBox?.height ?? 0) - PLOT_H)).toBeLessThanOrEqual(1);
    } finally {
      await context.close();
    }
  });

  test("no vertical layout shift: the settled plot occupies the same height the placeholder reserved", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 360, height: 800 });
    await page.goto(HARNESS);
    await waitForSettled(page);

    // after hydrate+measure the SVG renders; the plot region is STILL exactly PLOT_H — identical to
    // the placeholder's reserved height, so swapping placeholder → SVG moves nothing vertically.
    const containerBox = await page.locator('[data-testid="today-plot"]').boundingBox();
    expect(Math.abs((containerBox?.height ?? 0) - PLOT_H)).toBeLessThanOrEqual(1);
  });
});
