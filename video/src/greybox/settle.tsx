import React from "react";
import { continueRender, delayRender, useCurrentFrame } from "remotion";

/**
 * ══ HOLDING EVERY FRAME UNTIL THE PAGE HAS ACTUALLY PAINTED IT ══════════════════════
 *
 * **This exists because the renderer, not the composition, was producing wrong frames.**
 *
 * The symptom was four visual artifacts reported off the shipped render, at ~0:02, ~0:05, ~0:10
 * and ~0:20 — a page jumping down and back up, and stray frames mid-move. They survived a 4×
 * bitrate increase, so they were never compression. And an earlier frame scan hunting whole-frame
 * delta, tile delta and luminance dips found nothing at those sites, because **there is nothing
 * corrupt to find**: every one of those frames is a clean, correct frame of some OTHER moment.
 *
 * What identifies them is not a metric inside one render — it is rendering the film twice.
 * `Greybox` is a pure function of frame, so two renders must be identical. Over frames 0–620:
 *
 *   render                     frames differing from the consensus of the other two
 *   ────────────────────────── ──────────────────────────────────────────────────────
 *   the shipped 10.22 Mbps cut f67, f71, f73, f165, f167, f316, f604      ← all four sites
 *   a re-render, same flags    f55, f122
 *   a re-render, `--gl=swangle` f389, f456
 *
 * Every other frame matched to the encoder's noise floor (median 0.07 of 255). So it is a race,
 * it lands on 0.3–1.1% of frames, it moves between runs, and **it is not the rasteriser** —
 * software ANGLE hit it just as often, only elsewhere.
 *
 * ── WHERE THE RACE IS ───────────────────────────────────────────────────────────────
 *
 * `TimelineContext.js`'s `window.remotion_setFrame` is:
 *
 *     const id = delayRender(...); setFrame(...); requestAnimationFrame(() => continueRender(id));
 *
 * — one animation frame between committing the new frame number and declaring the page ready.
 * The renderer then takes a CDP `Page.captureScreenshot` with `fromSurface: true`, i.e. off the
 * compositor's surface. One rAF is enough for React to render and for layout to run; it is not
 * always enough for the compositor to have produced a new surface, and under eight concurrent
 * tabs it is sometimes well short. When it is short you get the tab's PREVIOUS output, which is
 * why f604 is f596 to the pixel — exactly eight frames back, which is the concurrency.
 * (Remotion's own `screenshot-task.js` names this: *"there is a 0.1% framedrop when rendering
 * under memory pressure"*. Its `DISABLE_FROM_SURFACE` escape hatch is not usable here — it
 * crashes the render on Windows.)
 *
 * The one site that is not a stale surface is the same race one stage earlier: at f165/f167 the
 * hero's `<h1>` had rendered but its accent span was still at `clamp()`'s 2.125rem minimum
 * instead of 3.5rem, so the headline wrapped to two lines instead of three and the copy column —
 * which the hero centres with `lg:items-center` — sat 75px up the frame. That is the "left side
 * jumps down and back up". `landing.tsx` pins the size so the layout cannot depend on a
 * viewport-unit resolution landing before the capture.
 *
 * ── THE FIX ─────────────────────────────────────────────────────────────────────────
 *
 * Give the frame more animation frames before Remotion is allowed to call it ready — using
 * Remotion's own mechanism for exactly that, which this project already reaches for twice
 * (`landing.tsx` § FirstBeat, `monitor.tsx` § TrendSettle). Mounted ONCE for the whole
 * composition rather than per beat, so the hold is uniform and cannot be forgotten by a new beat.
 *
 * The cleanup calls `continueRender` unconditionally, so an unmount can never leave a render
 * hung — the same contract the other two hold to.
 *
 * ── AND IT HAS A SECOND FORM: A STALE *LAYER* RATHER THAN A STALE FRAME ─────────────
 *
 * The music player's scrubber was reported as glitching, and it is this same race one level down.
 * An element with `opacity` plus a transform is promoted to **its own compositor layer**, and a
 * layer can be a frame or two behind while the rest of the picture is current — so the fill and
 * the handle moved backwards for two frames while the elapsed TEXT beside them, which lives in the
 * page's layer, kept counting correctly. Rendering those frames in isolation gave a perfectly even
 * progression, which is what identifies it as the renderer rather than the composition.
 *
 * Two consequences worth carrying:
 *
 *  · **Do not promote a layer you do not need promoted.** `player.tsx` now emits its `opacity` and
 *    `scale` only while the window is actually animating; through the hold it is ordinary painted
 *    content and cannot fall behind the frame it is in.
 *  · **The reconciliation metric must be LOCAL.** A whole-frame mean cannot see this — the player's
 *    window is 0.28% of the picture, so a 20px displacement of it moves the frame mean by ~0.05,
 *    far under any useful threshold. The check that ships this film compares **per-tile** maxima
 *    (60px tiles at 960×540) between two renders, and it caught frames the whole-frame version had
 *    passed.
 */

/**
 * Six, and it is a budget rather than a guess: one rAF is what Remotion already spends and is
 * demonstrably not always enough, and each further one costs a frame of render time on a
 * composition whose frames take far longer than a rAF to produce. Raise it if a diffed pair of
 * renders ever disagrees again — that check is the acceptance test, not the eye.
 */
const SETTLE_TICKS = 6;

/**
 * ── AND THE PITCH CUT NEEDED MORE, WHICH IS THIS FILE'S OWN ACCEPTANCE TEST FIRING ──
 *
 * *"Raise it if a diffed pair of renders ever disagrees again — that check is the acceptance
 * test, not the eye."* It disagreed. Two full renders of the 5,962-frame pitch cut differed at
 * **51 frames (0.86%)** — the launch cut's post-`Settle` rate is ~1 in 2,572 — and the worst of
 * them were not sub-pixel: at output f517 the two renders showed beat 2's signup page at
 * **different scroll positions**, one of them about fourteen frames behind the other. That is the
 * stale-surface race, at the size the launch sheet reported it, on a film 2.4× longer.
 *
 * `ticks` makes the budget per-composition rather than global. **The default is still 6, so the
 * launch cut's render path is unchanged**; the pitch composition passes a larger one. Raising it
 * can only ever remove wrong frames — it changes when the screenshot is taken, never what is
 * drawn — so this is a correctness knob traded against render time, and the pitch cut has the
 * time to spend.
 */
export const PITCH_SETTLE_TICKS = 20;

export const Settle: React.FC<{ ticks?: number }> = ({ ticks = SETTLE_TICKS }) => {
  const frame = useCurrentFrame();
  React.useEffect(() => {
    const handle = delayRender(`settle f${frame}`);
    let raf = 0;
    let left = ticks;
    const tick = () => {
      if (left-- <= 0) {
        continueRender(handle);
        return;
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => {
      cancelAnimationFrame(raf);
      continueRender(handle);
    };
  }, [frame, ticks]);
  return null;
};
