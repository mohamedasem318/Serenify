import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

const webRoot = resolve(__dirname, "../..");

describe("Serenify social metadata", () => {
  it("publishes canonical Open Graph and Twitter metadata for production", () => {
    const source = readFileSync(resolve(webRoot, "app/layout.tsx"), "utf8");

    expect(source).toContain('metadataBase: new URL("https://serenify.tech")');
    expect(source).toContain('alternates: { canonical: "/" }');
    expect(source).toContain("openGraph:");
    expect(source).toContain('url: "https://serenify.tech"');
    expect(source).toContain('siteName: "Serenify"');
    expect(source).toContain('images: ["/opengraph-image"]');
    expect(source).toContain("twitter:");
    expect(source).toContain('card: "summary_large_image"');
  });

  it("defines a fixed Graphite social image with the brand and description", () => {
    const source = readFileSync(
      resolve(webRoot, "app/opengraph-image.tsx"),
      "utf8",
    );

    expect(source).toContain("width: 1200");
    expect(source).toContain("height: 630");
    expect(source).toContain('contentType = "image/png"');
    expect(source).toContain("icon-512.png");
    expect(source).toContain("Workplace stress, gently noticed.");
    expect(source).toContain('background: "#101214"');
  });

  it("hand-syncs the two-colour wordmark with the dark token values", () => {
    const source = readFileSync(
      resolve(webRoot, "app/opengraph-image.tsx"),
      "utf8",
    );

    // Hand-sync exception 1 (constitution Principle V, Wordmark): Satori
    // cannot load Outfit, so this card cannot consume
    // components/brand/wordmark.tsx and the split is typed by hand. The
    // card is dark-themed (asserted above via background #101214), so
    // both halves carry the DARK token values.
    expect(source).toMatch(/#E2E5E8"\s*\}\}\s*>\s*seren\s*</);
    expect(source).toMatch(/#63B292"\s*\}\}\s*>\s*ify\s*</);

    // A single-node wordmark would mean the split was reverted.
    expect(source).not.toMatch(/>\s*serenify\s*</);

    // Satori requires display:flex on any element with more than one
    // child — the wrapper now has two.
    expect(source).toMatch(
      /display: "flex",\s*fontSize: 58,[\s\S]*?<span style=\{\{ color: "#E2E5E8" \}\}>/,
    );
  });
});
