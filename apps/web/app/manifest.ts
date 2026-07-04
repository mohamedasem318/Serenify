import type { MetadataRoute } from "next";

/**
 * Web app manifest (Next App Router file convention). Next serves this at
 * `/manifest.webmanifest` and auto-injects `<link rel="manifest" …>` — no
 * manual <head> wiring. Colours are the dark Graphite tokens (`--color-bg`
 * #101214) so the PWA splash/tile matches the favicon and the dark dashboard
 * the wordmark is lifted from. The 192/512 PNGs live in `public/` (stable URLs
 * the manifest can reference); the browser-tab/apple icons come from the sibling
 * `favicon.ico` / `icon.png` / `apple-icon.png` file conventions.
 */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Serenify",
    short_name: "Serenify",
    description: "Workplace stress, gently noticed.",
    start_url: "/",
    display: "standalone",
    background_color: "#101214",
    theme_color: "#101214",
    icons: [
      {
        src: "/icon-192.png",
        sizes: "192x192",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/icon-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "any",
      },
    ],
  };
}
