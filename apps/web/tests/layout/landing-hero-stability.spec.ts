import { expect, test } from "@playwright/test";

/**
 * T107 (feature 013, US1) — the hero card's zero-drift proof
 * (`research.md` §12.2; SC-003, SC-008, FR-008, FR-009).
 *
 * REAL BROWSER, REAL LAYOUT, NO DATABASE. Runs under `playwright.layout.config.ts`, whose
 * `testDir` is already `./tests/layout` and which deliberately has no `globalSetup` — the
 * landing page is unauthenticated, so it needs none.
 *
 * WHAT IS BEING PROVED. The card plays seventeen beats whose content varies wildly in
 * height — a four-bubble conversation against a one-line "Set aside" — and the outer box
 * must not move by a single pixel through any of it. That property comes from the swap
 * area's explicit height plus panels on `position: absolute; inset: 0`; if anyone ever
 * "simplifies" that to flow layout it will still look fine at one width on one beat and
 * fail here.
 *
 * THE NARRATION ASSERTION IS AMENDED FROM T107 AS WRITTEN, on Mohamed's ruling of
 * 2026-07-27. The original required ONE line at 320 px for every beat. That is not
 * achievable at any legible size: the approved §10.3 Position 3 string measures 379.8 px
 * at `--text-xs`, the smallest token that exists, against roughly 260 px of card at a
 * 320 px viewport — and it still overflows with zero padding. The copy is approved and
 * fixed (FR-032), so the layout rule moved instead: the row is fixed at TWO lines below
 * 768 px and ONE line at and above it, fixed at every width and never content-dependent,
 * which is what FR-009 actually guarantees. Below 768 px this asserts the row height is
 * CONSTANT across all seventeen beats and that no string exceeds two lines; at 768 px it
 * asserts one line. Recorded in `docs/DECISIONS.md`.
 */

const WIDTHS = [320, 375, 414, 768] as const;
const BEATS = 17;

interface Sample {
  readonly beat: number;
  readonly cardWidth: number;
  readonly cardHeight: number;
  readonly cardScrolls: boolean;
  readonly swapScrolls: boolean;
  readonly narrationRowHeight: number;
  readonly narrationLines: number;
  readonly documentOverflows: boolean;
  readonly threadClipped: number;
  readonly activePanelClipped: boolean;
}

for (const width of WIDTHS) {
  test(`the hero card does not drift at ${width}px`, async ({ page }) => {
    test.setTimeout(120_000);

    await page.setViewportSize({ width, height: 900 });
    await page.goto("/");

    const card = page.getByTestId("story-card");
    await card.waitFor();
    // The clock pauses off-screen by design (FR-012), so the card has to stay visible or
    // the story never advances and this spec would pass by never stepping.
    await card.scrollIntoViewIfNeeded();

    const samples: Sample[] = [];

    for (let beat = 0; beat < BEATS; beat++) {
      await page.locator(`[data-testid="story-card"][data-beat="${beat}"]`).waitFor({
        timeout: 30_000,
      });

      samples.push(
        await page.evaluate((beatIndex) => {
          const query = (id: string) =>
            document.querySelector<HTMLElement>(`[data-testid="${id}"]`);
          const cardEl = query("story-card");
          const swapEl = query("story-swap");
          const rowEl = query("story-narration-row");
          const textEl = query("story-narration");
          if (!cardEl || !swapEl || !rowEl || !textEl) throw new Error("card regions missing");

          const rect = cardEl.getBoundingClientRect();
          const lineHeight = parseFloat(getComputedStyle(textEl).lineHeight);
          const root = document.documentElement;

          /*
           * CONTENT CLIPPING — the check the drift assertions structurally cannot make.
           *
           * The panels are absolutely positioned inside an `overflow-hidden` box, which is
           * exactly what guarantees zero drift — and it also means content that does not
           * fit is silently destroyed rather than overflowing or scrolling. Every
           * assertion above stays green while a bubble sits outside the panel. This one
           * measures the bubbles against the panel box, which is the only way to see it.
           * A review found the Ren thread clipped at all four widths against a spec that
           * was passing 5/5.
           */
          const activePanel = document.querySelector<HTMLElement>("[data-panel][data-active]");
          const panelRect = activePanel?.getBoundingClientRect();
          const thread = document.querySelector<HTMLElement>('[data-testid="ren-thread"]');
          const bubblesOutside =
            thread && panelRect
              ? Array.from(thread.querySelectorAll("li")).filter((li) => {
                  const r = li.getBoundingClientRect();
                  return r.bottom > panelRect.bottom + 0.5 || r.top < panelRect.top - 0.5;
                }).length
              : 0;

          return {
            beat: beatIndex,
            // Rounded to a tenth: sub-pixel jitter from fractional viewport scaling is
            // not drift, and asserting raw floats would make this flaky rather than strict.
            cardWidth: Math.round(rect.width * 10) / 10,
            cardHeight: Math.round(rect.height * 10) / 10,
            cardScrolls:
              cardEl.scrollWidth > cardEl.clientWidth || cardEl.scrollHeight > cardEl.clientHeight,
            swapScrolls:
              swapEl.scrollWidth > swapEl.clientWidth || swapEl.scrollHeight > swapEl.clientHeight,
            narrationRowHeight: Math.round(rowEl.getBoundingClientRect().height * 10) / 10,
            narrationLines: Math.round(textEl.scrollHeight / lineHeight),
            documentOverflows: root.scrollWidth > root.clientWidth,
            threadClipped: bubblesOutside,
            activePanelClipped: activePanel
              ? activePanel.scrollHeight > activePanel.clientHeight + 1
              : false,
          };
        }, beat),
      );
    }

    expect(samples).toHaveLength(BEATS);
    const first = samples[0]!;

    // ── SC-003 / FR-008: the outer box moves by exactly zero, on both axes ──
    for (const sample of samples) {
      expect(sample.cardWidth, `beat ${sample.beat}: card width drifted`).toBe(first.cardWidth);
      expect(sample.cardHeight, `beat ${sample.beat}: card height drifted`).toBe(first.cardHeight);
    }

    // ── No internal scrolling on the card or the swap area, at any beat ──
    for (const sample of samples) {
      expect(sample.cardScrolls, `beat ${sample.beat}: the card scrolls internally`).toBe(false);
      expect(sample.swapScrolls, `beat ${sample.beat}: the swap area scrolls internally`).toBe(
        false,
      );
    }

    // ── FR-011 / FR-008: nothing is CLIPPED. Zero drift is not the same as visible. ──
    for (const sample of samples) {
      expect(
        sample.threadClipped,
        `beat ${sample.beat}: ${sample.threadClipped} Ren bubble(s) fall outside the panel ` +
          `box. FR-011 requires 4 VISIBLE bubbles with no scroll — clipped is neither.`,
      ).toBe(0);
      expect(
        sample.activePanelClipped,
        `beat ${sample.beat}: the active panel's content overflows its box and is being ` +
          `cut off by overflow-hidden. The swap area is too short for the tallest panel.`,
      ).toBe(false);
    }

    // ── SC-008: no horizontal overflow anywhere on the document ──
    for (const sample of samples) {
      expect(sample.documentOverflows, `beat ${sample.beat}: the document scrolls sideways`).toBe(
        false,
      );
    }

    // ── FR-009: the narration row's height is FIXED — the guarantee that survives ──
    for (const sample of samples) {
      expect(
        sample.narrationRowHeight,
        `beat ${sample.beat}: the narration row changed height, so its content can move ` +
          `everything below it`,
      ).toBe(first.narrationRowHeight);
    }

    // ── The line-count rule, per the 2026-07-27 amendment ──
    if (width >= 768) {
      for (const sample of samples) {
        expect(sample.narrationLines, `beat ${sample.beat}: narration wrapped at ${width}px`).toBe(
          1,
        );
      }
    } else {
      for (const sample of samples) {
        expect(
          sample.narrationLines,
          `beat ${sample.beat}: narration needs ${sample.narrationLines} lines at ${width}px, ` +
            `and the row holds two. This is a COPY-LENGTH problem, not a CSS one.`,
        ).toBeLessThanOrEqual(2);
      }
    }
  });
}

test("every panel really is out of flow — the anti-clipping mechanism, asserted", async ({
  page,
}) => {
  // The property the zero-drift result depends on. Without this, a future refactor to flow
  // layout could still pass the drift check on a day when every panel happened to be
  // shorter than the swap area, and fail silently later on a longer conversation.
  await page.setViewportSize({ width: 320, height: 900 });
  await page.goto("/");
  await page.getByTestId("story-card").waitFor();

  const layout = await page.evaluate(() => {
    const swap = document.querySelector<HTMLElement>('[data-testid="story-swap"]');
    if (!swap) throw new Error("swap area missing");
    const panels = Array.from(swap.querySelectorAll<HTMLElement>("[data-panel]"));
    return {
      swapPosition: getComputedStyle(swap).position,
      swapOverflow: getComputedStyle(swap).overflow,
      panelCount: panels.length,
      panels: panels.map((panel) => {
        const style = getComputedStyle(panel);
        return {
          position: style.position,
          inset: [style.top, style.right, style.bottom, style.left].join(" "),
        };
      }),
    };
  });

  expect(layout.swapPosition).toBe("relative");
  expect(layout.swapOverflow).toBe("hidden");
  expect(layout.panelCount).toBe(4);
  for (const panel of layout.panels) {
    expect(panel.position).toBe("absolute");
    expect(panel.inset).toBe("0px 0px 0px 0px");
  }
});
