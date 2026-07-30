import React from "react";

import { Hero } from "@/components/landing/hero";
import { PublicNavbar } from "@/components/public/public-navbar";

import { Desktop, type TabSpec } from "./shell";

/**
 * ══ THE LANDING PAGE, AS THE REAL COMPONENTS ════════════════════════════════════════
 *
 * Beat 1's only job is *this is deployed*, and a drawn approximation of a landing page cannot
 * make that claim — it is the one beat where "the real thing exists" IS the content. So the
 * public navbar and the hero are the shipped components, at the real 1200px world.
 *
 * ── WHAT THE REAL COMPONENTS TURNED OUT TO BE ───────────────────────────────────────
 *
 * The greybox drew a centred 640-wide block: headline, lede, data line, two buttons. Three
 * things about the real hero are different and all of them matter to the shot:
 *
 *  · **It is TWO COLUMNS at this world.** `hero.tsx:48` is `flex-col lg:flex-row`, and 1200 is
 *    well past `lg` (1024) — so the copy column and the story card sit side by side, not
 *    stacked. The greybox's centred block does not exist at any viewport ≥ 1024.
 *  · **The headline is a `clamp(2.125rem, 5.6vw, 3.5rem)`**, which at 1200 resolves to 67.2px —
 *    not the greybox's 40. The hero reads considerably larger than it was drawn.
 *  · **There is a live story card beside it**, `<StoryCard/>`, which is a whole second product
 *    surface: a bloom, a readout, a narration line and four swapping panels.
 *
 * ── THE STORY CARD IS DETERMINISTIC HERE, FOR FREE ──────────────────────────────────
 *
 * `useStoryClock` is a `setTimeout` chain, which is exactly the class of thing a frame-addressed
 * render cannot run — but it needs no special handling, because under the forced reduced-motion
 * shim it **arms no timer at all** (`use-story-clock.ts:139-150`) and lands on
 * `REPRESENTATIVE_BEAT_INDEX = 2`, the beat where the system stops and asks. That is a static,
 * reproducible frame, and it is also the right one: it is the beat the component itself picks
 * when it has to show one, and it is the product's thesis — which is what beat 1 is establishing.
 *
 * ── THE NAVBAR IS SIGNED OUT, AND THAT IS THE POINT ─────────────────────────────────
 *
 * `<PublicNavbar/>` takes an optional viewer and renders Sign in / Sign up when there is none.
 * He does not have an account yet — beat 2 is him making one — so no viewer is passed. Its
 * `ThemeToggle` renders the moon-or-sun button from `next-themes`; there is no provider in this
 * bundle, so `useTheme()` returns undefined and the component's own `mounted` guard renders its
 * stable placeholder. That is the shipped first-paint appearance, not a broken one.
 */

/** `app/(public)/layout.tsx:66` — the public shell's column. */
export const PUBLIC_SHELL = "flex min-h-dvh flex-col bg-bg";

export const LandingPage: React.FC<{
  clock: string;
  url?: string;
  tabs?: TabSpec[];
  caret?: boolean;
  /** How far the page is scrolled. The landing page is far taller than one viewport. */
  scroll?: number;
  /** World-coordinate layer — the drawn cursor, the lifted omnibox. */
  overlay?: React.ReactNode;
  children?: React.ReactNode;
}> = ({ clock, url = "serenify.tech", tabs, caret, scroll = 0, overlay, children }) => (
  <Desktop clock={clock} url={url} tabs={tabs} caret={caret} overlay={overlay}>
    <div className={PUBLIC_SHELL} style={{ marginTop: -scroll }}>
      <PublicNavbar />
      <main className="flex-1">
        <Hero />
      </main>
    </div>
    {children}
  </Desktop>
);
