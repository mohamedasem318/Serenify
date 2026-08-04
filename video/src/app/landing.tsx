import React from "react";
import { continueRender, delayRender } from "remotion";
import { useCurrentFrame } from "../retime";

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
 * ── THE STORY CARD OPENS ON ITS OWN FIRST BEAT, AND THAT TAKES CORRECTION (item 4.1) ─
 *
 * `useStoryClock` (`use-story-clock.ts:58-153`) starts at `useState(0)` — `STORY_BEATS[0]`,
 * chapter 0, the "quiet" panel on the "at_ease" band, narration "A normal morning. Nothing to
 * report." (`story-script.ts:88-95`) — which is exactly what a full-motion visitor's first
 * paint shows. Left alone that would be a static, reproducible frame for free, the same way
 * the rest of this render is: `useStoryClock` is a `setTimeout` chain, which is the class of
 * thing a frame-addressed render cannot run, and under the forced reduced-motion shim it
 * **arms no timer at all** (`use-story-clock.ts:141-150`).
 *
 * But the shim also flips a SECOND effect: `use-story-clock.ts:125-129` moves the index to
 * `REPRESENTATIVE_BEAT_INDEX = 2` whenever `prefers-reduced-motion` reads true — the reduced-
 * motion fallback's OWN choice of what to show a visitor who never scrolls or clicks a chapter
 * marker. `shims/use-media-query.ts:44` forces that reading for the whole film (deliberately —
 * see that file), so without correction this beat opens on `STORY_BEATS[2]`: the "prompt"
 * panel, "tense" band — the stressed card, and a different beat than the one the page's own
 * first paint shows.
 *
 * `<FirstBeat/>`, below, undoes exactly that second effect — through the product's own chapter-
 * marker control, since `apps/web` cannot take a video-only prop. See its docstring.
 *
 * ── THE NAVBAR IS SIGNED OUT, AND THAT IS THE POINT ─────────────────────────────────
 *
 * `<PublicNavbar/>` takes an optional viewer and renders Sign in / Sign up when there is none.
 * He does not have an account yet — beat 2 is him making one — so no viewer is passed. Its
 * `ThemeToggle` renders the moon-or-sun button from `next-themes`; there is no provider in this
 * bundle, so `useTheme()` returns undefined and the component's own `mounted` guard renders its
 * stable placeholder. That is the shipped first-paint appearance, not a broken one.
 */

/**
 * ── FORCING THE STORY CARD ONTO `STORY_BEATS[0]` (item 4.1) ─────────────────────────
 *
 * apps/web MUST NOT change for this: no new prop on `<StoryCard/>`, no touching
 * `REPRESENTATIVE_BEAT_INDEX`, no touching `useStoryClock`. So the correction goes through the
 * product's OWN control — `<ChapterMarkers/>` (`components/landing/chapter-markers.tsx:58-77`)
 * renders one real `<button data-chapter={n}>` per chapter, wired to
 * `onSelect(chapter) => goTo(firstBeatIndexOfChapter(chapter))`. Chapter 0's first beat IS
 * index 0 (`story-script.ts:88-95` is the first entry tagged `chapter: 0`), and `goTo`
 * (`use-story-clock.ts:69-75`) sets `hasProgressed.current = true` on every call — the exact
 * latch the reduced-motion effect checks before it is allowed to fire
 * (`use-story-clock.ts:126`, `!hasProgressed.current`). Clicking that button both lands on
 * beat 0 AND permanently disarms the effect that would otherwise select beat 2, and it does so
 * without arming a timer: `goTo` only calls `setIndex`.
 *
 * EITHER EFFECT ORDER CONVERGES ON BEAT 0, so this needs no coordination with
 * `use-story-clock.ts:125-129`, only proof that one of them has already run:
 *
 *  · If the reduced-motion effect fires first, index becomes 2 while `hasProgressed` is still
 *    false. This click then sets index back to 0 and latches `hasProgressed` — nothing can move
 *    it again afterwards, because the only other write to `index` is the reduced-motion effect,
 *    and its own guard is now closed.
 *  · If this click fires first, `hasProgressed` is already true by the time the reduced-motion
 *    effect runs, so `use-story-clock.ts:126`'s guard skips it outright — index never leaves 0.
 *
 * Modeled on `<TrendSettle/>` (`app/monitor.tsx:175-204`): `delayRender` holds the frame, a
 * `requestAnimationFrame` loop polls the real DOM rather than counting a fixed number of ticks
 * (bounded at the same 40-try budget), and the cleanup calls `continueRender` unconditionally so
 * an unmount never leaves the render hung. What it polls for is
 * `[data-testid="story-card"][data-beat="0"]` — the story card's OWN reported state, proof the
 * correction has actually landed in the DOM, not just that a click event was dispatched.
 * Checking that first, before clicking anything, is what makes this idempotent across all 180
 * frames of the beat: once beat 0 is showing, every later frame's effect exits on its first line
 * and never touches the button again.
 */
const FirstBeat: React.FC = () => {
  const frame = useCurrentFrame();
  React.useEffect(() => {
    const handle = delayRender(`landing-first-beat f${frame}`);
    let raf = 0;
    let tries = 0;
    const wait = () => {
      const onBeatZero =
        document.querySelector('[data-testid="story-card"]')?.getAttribute("data-beat") === "0";
      if (onBeatZero || tries++ > 40) {
        continueRender(handle);
        return;
      }
      // Only one `<ChapterMarkers/>` renders on this page, so the plain selector is unambiguous.
      document.querySelector<HTMLButtonElement>('button[data-chapter="0"]')?.click();
      raf = requestAnimationFrame(wait);
    };
    raf = requestAnimationFrame(wait);
    return () => {
      cancelAnimationFrame(raf);
      continueRender(handle);
    };
  }, [frame]);
  return null;
};

/**
 * ── PINNING THE HEADLINE, BECAUSE A `vw` CLAMP CAN BE CAUGHT HALF-RESOLVED ──────────
 *
 * `hero.tsx:52` sizes the headline `clamp(2.125rem, 5.6vw, 3.5rem)`. Two frames of the shipped
 * cut — f165 and f167, the "Get started" click — came out with the `<h1>` at 3.5rem but its
 * `<span class="text-meadow-text">` still at the 2.125rem **minimum**, so "asks before it
 * decides." fitted on one line instead of two, the copy column lost a line, and `lg:items-center`
 * re-centred the whole column 75px up the frame and back. That is the reported *"the landing
 * page's left side jumps down and back up"*, and it is a render-time race — see
 * `greybox/settle.tsx` for the measurement that separates it from the composition.
 *
 * `<Settle/>` gives the resolution more animation frames, but a layout that can only be right
 * *after* an asynchronous viewport-unit resolution is the wrong thing to be racing at all. So the
 * one viewport-dependent size in the film is made a constant.
 *
 * **It changes nothing that is drawn.** The render viewport is 1920 wide, so `5.6vw` is 107.52px
 * and the clamp has been pinned to its 3.5rem maximum on every correct frame already; 56px is
 * what the film has always shown, now stated rather than derived. (It is also why the headline is
 * 56 here and not the 67.2 a real 1200px browser gives: `vw` is the OUTPUT viewport, not the
 * 1200px world. That is pre-existing and is not changed by this — only made visible.)
 *
 * `apps/web` is untouched: this is a scoped stylesheet against the film's own `data-public`
 * wrapper, the same seam `motion.tsx` and `hover.tsx` use into every other shipped surface.
 */
const HeroTypePinned: React.FC = () => (
  <style>{`[data-public] h1 { font-size: 56px !important; }`}</style>
);

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
    <HeroTypePinned />
    <div className={PUBLIC_SHELL} style={{ marginTop: -scroll }}>
      <PublicNavbar />
      {/* `data-public` is the handle beat 1's hover addresses. The components are untouched — a
          wrapper is the only seam the video has into a shipped surface. */}
      <main className="flex-1" data-public>
        <Hero />
      </main>
    </div>
    <FirstBeat />
    {children}
  </Desktop>
);
