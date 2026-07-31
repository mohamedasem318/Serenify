import { loadFont as loadGeistMono } from "@remotion/google-fonts/GeistMono";
import { loadFont as loadInter } from "@remotion/google-fonts/Inter";
import { loadFont as loadNunito } from "@remotion/google-fonts/Nunito";
import { loadFont as loadOutfit } from "@remotion/google-fonts/Outfit";

/**
 * ══ THE TYPEFACE, AND WHY IT HAS TO BE LOADED EXPLICITLY ════════════════════════════
 *
 * `apps/web` gets Inter and Outfit from `next/font/google` in `app/layout.tsx` — a build-time
 * mechanism that injects `@font-face` rules and a `--font-sans` / `--font-display` variable pair
 * into the document. **None of that exists in a Remotion bundle.** There is no Next layout, no
 * font loader, and no `@font-face` anywhere: `globals.css` declares
 *
 *     --font-sans:    "Inter", system-ui, sans-serif;
 *     --font-display: "Outfit", sans-serif;
 *
 * and both families simply fail to resolve, so every real component silently falls back to
 * `system-ui`. That is why the film read as greybox even on the beats that were already using
 * real components: the components were real and the letters were not.
 *
 * So the families are registered here, under **exactly the names `globals.css` asks for**. That
 * is the whole trick — nothing overrides a token, no component is given a `fontFamily`, and
 * `font-display` / `font-sans` keep resolving through the app's own variables. The app's
 * typography becomes correct by the families existing.
 *
 * ── IT MUST BE VERIFIED IN THE RENDER, NOT IN THE PREVIEW ───────────────────────────
 *
 * A font that resolves in Studio and falls back in a headless render is the classic version of
 * this bug, and it is invisible until someone opens the mp4. `loadFont()` is safe against it by
 * construction: it takes a `delayRender()` handle per face and only releases it once
 * `FontFace.load()` has resolved, so the renderer cannot screenshot a frame before the bytes are
 * in. Calling it at module scope — imported by `Root.tsx`, which every entry point reaches —
 * means the handles are taken before the first composition mounts.
 *
 * Weights and subsets are named rather than left to default. Unqualified, `loadFont()` fetches
 * every weight of every subset (Inter alone is nine weights × several subsets), which is dozens
 * of network round-trips per render and is what the library's own "too many requests" warning is
 * about. `latin` is all the film contains: the Arabic VO is an audio track laid over a locked
 * cut, and nothing in the picture is Arabic.
 *
 * ── THE FURNITURE GETS A REAL FACE TOO ──────────────────────────────────────────────
 *
 * The browser chrome, the mail toast and the two closing cards are authored — they have no
 * `apps/web` counterpart and were using CSS system stacks, which in headless Chromium on a
 * render box resolve to whatever that box happens to have. That is the same defect as the
 * components' fallback, just with nobody to blame it on, and a stand-in in a fallback face reads
 * as unfinished next to a real component.
 *
 * They take **Inter**, not Outfit. `furniture.ts` records the rule that the film's operating
 * system is not Serenify and must not wear Serenify's display face, and that rule is intact:
 * Inter is a neutral UI grotesque of exactly the kind every desktop OS actually uses, so it is
 * the right face on its own merits and not merely the one that was already loaded. Outfit stays
 * where the app puts it — headings, the wordmark, the two closing cards' display line.
 *
 * The mono is **Geist Mono**, and it is the one face in the film with no counterpart in the
 * product at all. The app has no mono token; the omnibox URL and the toolbar clock do, because
 * a browser's address bar and a ticking clock both want stable digit widths. It is chosen to sit
 * beside Inter without asserting anything — a neutral grotesque mono, no ligatures on screen, no
 * personality to notice.
 */

const inter = loadInter("normal", { weights: ["400", "500", "600", "700"], subsets: ["latin"] });
const outfit = loadOutfit("normal", { weights: ["400", "500", "600", "700"], subsets: ["latin"] });
const geistMono = loadGeistMono("normal", { weights: ["400", "700"], subsets: ["latin"] });
/**
 * **One line in the whole film wears this** — "take care of yourself" on the end card. It is a
 * rounded humanist sans, chosen off `endcard-compare.png` against Fraunces and Instrument Serif:
 * the *curvier* answer rather than the warmer-serif one. A single weight, because a single line
 * needs one.
 *
 * It does not add a third face to that card — it REPLACES Inter there, so the end card is Outfit
 * (the mark and the domain) plus Nunito (the line) and nothing else. Inter stays everywhere else
 * in the film, including beat 12's closing card.
 */
const nunito = loadNunito("normal", { weights: ["400"], subsets: ["latin"] });

/** `"Inter"` — the family name `--font-sans` resolves to. */
export const SANS = inter.fontFamily;
/** `"Outfit"` — the family name `--font-display` resolves to. */
export const DISPLAY = outfit.fontFamily;
/** `"Geist Mono"` — furniture only; the product has no mono. */
export const MONO_FAMILY = geistMono.fontFamily;
/** `"Nunito"` — the end card's one line, and nothing else in the film. */
export const ROUNDED = nunito.fontFamily;

/**
 * Every face, as one promise. Nothing awaits this in the film — `loadFont()` already holds a
 * `delayRender` handle per face, which is the mechanism that actually gates the render — but the
 * probe compositions await it so a measurement is never taken against fallback metrics. A rect
 * measured in `system-ui` and stored in `geometry.ts` would be wrong by a line height and would
 * look like a layout bug for the rest of the project's life.
 */
export const fontsReady = (): Promise<unknown> =>
  Promise.all([
    inter.waitUntilDone(),
    outfit.waitUntilDone(),
    geistMono.waitUntilDone(),
    nunito.waitUntilDone(),
  ]);
