import { expect, test } from "@playwright/test";

const HARNESS = "/cold-start-harness";

function luminance(rgb: number[]) {
  const channels = rgb.map((value) => {
    const normalized = value / 255;
    return normalized <= 0.04045
      ? normalized / 12.92
      : Math.pow((normalized + 0.055) / 1.055, 2.4);
  });
  return 0.2126 * channels[0]! + 0.7152 * channels[1]! + 0.0722 * channels[2]!;
}

function parseRgb(value: string) {
  const values = value.match(/[\d.]+/g)?.slice(0, 3).map(Number);
  if (!values || values.length !== 3) throw new Error(`Cannot parse color: ${value}`);
  return values;
}

for (const viewport of [
  { name: "360px", width: 360, height: 800 },
  { name: "desktop", width: 1440, height: 900 },
]) {
  for (const theme of ["light", "dark"] as const) {
    test(`${viewport.name} ${theme}: wake action fits, clears copy, and passes AA`, async ({ page }) => {
      await page.setViewportSize(viewport);
      await page.goto(HARNESS);
      await page.evaluate((dark) => {
        document.documentElement.classList.toggle("dark", dark);
      }, theme === "dark");

      const result = await page.evaluate(() => {
        const button = document.querySelector("button[disabled]") as HTMLElement;
        const panel = button.closest(".max-w-md") as HTMLElement;
        const paragraph = panel.querySelector("p") as HTMLElement;
        const buttonBox = button.getBoundingClientRect();
        const panelBox = panel.getBoundingClientRect();
        return {
          documentWidth: document.documentElement.scrollWidth,
          viewportWidth: window.innerWidth,
          buttonHeight: buttonBox.height,
          buttonTop: buttonBox.top,
          buttonScrollWidth: button.scrollWidth,
          buttonClientWidth: button.clientWidth,
          buttonScrollHeight: button.scrollHeight,
          buttonClientHeight: button.clientHeight,
          paragraphBottom: paragraph.getBoundingClientRect().bottom,
          panelLeft: panelBox.left,
          panelRight: panelBox.right,
          foreground: getComputedStyle(button).color,
          background: getComputedStyle(button).backgroundColor,
        };
      });

      expect(result.documentWidth).toBeLessThanOrEqual(result.viewportWidth);
      expect(result.buttonHeight).toBeGreaterThanOrEqual(44);
      expect(result.buttonScrollWidth).toBeLessThanOrEqual(result.buttonClientWidth);
      expect(result.buttonScrollHeight).toBeLessThanOrEqual(result.buttonClientHeight);
      expect(result.buttonTop).toBeGreaterThanOrEqual(result.paragraphBottom);
      expect(result.panelLeft).toBeGreaterThanOrEqual(0);
      expect(result.panelRight).toBeLessThanOrEqual(result.viewportWidth);

      const foreground = luminance(parseRgb(result.foreground));
      const background = luminance(parseRgb(result.background));
      const contrast =
        (Math.max(foreground, background) + 0.05) /
        (Math.min(foreground, background) + 0.05);
      expect(contrast).toBeGreaterThanOrEqual(4.5);
    });
  }
}
