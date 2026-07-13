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
    expect(source).toMatch(/>\s*serenify\s*</);
    expect(source).toContain("Workplace stress, gently noticed.");
    expect(source).toContain('background: "#101214"');
  });
});
