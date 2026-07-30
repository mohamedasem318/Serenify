/**
 * Video-side shim for `@/hooks/use-media-query`, aliased in `remotion.config.ts`.
 *
 * ── WHY THIS EXISTS, AND IT IS THE MOST LOAD-BEARING SHIM ────────────────────────────
 *
 * A Remotion render is FRAME-ADDRESSED: the renderer sets the frame, re-renders React, and
 * screenshots. It does not advance wall-clock time by 1/30 s between frames, and it does not
 * seek `requestAnimationFrame`, CSS transitions, or CSS animations. So every animation that
 * measures its own progress against the clock — framer-motion's `animate`, a CSS
 * `transition: background 1.3s`, a `setTimeout` choreography — advances by however long the
 * renderer happened to take on that frame. The output is not reproducible, and worse, it does
 * not match the beat's timing at all: a 1.1 s ripple can finish inside two rendered frames.
 *
 * `apps/web` is full of framer-motion, and it must not be modified for the video (the video is
 * downstream of the product). But every one of those components already ships a **static
 * variant**, gated on `prefers-reduced-motion` — a designed, accessible, reviewed fallback.
 *
 * So the policy is: **take the static variant everywhere, then re-author the component's own
 * declared motion values frame-by-frame at the video layer.** The numbers are not invented —
 * they are read off the component (the bloom's `1.3s ease` band drift, the success ripple's
 * `scale 0.8 → 2.1 / opacity 0.5 → 0` over `1.1s easeOut`) and replayed through `interpolate`.
 * See `src/app/motion.tsx`, which holds those re-authored primitives next to a citation of the
 * component and line they came from.
 *
 * ── THE QUERY IS ANSWERED HONESTLY, NOT BLANKET-TRUE ─────────────────────────────────
 *
 * `components/notification.tsx:119` uses this same hook for a **layout** decision
 * (`max-width: 767px` → the mobile sheet variant rather than the desktop toast). Returning
 * `true` for every query would silently put the video on mobile layouts. Every other call site
 * in the app asks for `prefers-reduced-motion` — verified by grep across
 * `components/`, `lib/`, `app/` — so the two cases are separable by inspecting the query, and
 * the width branch is answered against the video's real 1200 px world.
 *
 * If a new width-dependent query ever appears in `apps/web`, it lands in the final branch and
 * is answered by the real `matchMedia` against the render viewport, which is 1920 wide. That is
 * the right default: the world is a desktop.
 */

/** The video's viewport width in CSS px — `theme.ts`'s `W`, restated so this file imports nothing. */
const WORLD_W = 1200;

export function useMediaQuery(query: string): boolean {
  // Motion: always the static variant. See the header — the video re-authors motion per frame.
  if (query.includes("prefers-reduced-motion")) return true;

  // Layout: answer width queries against the 1200 px world rather than the 1920 px output,
  // because the world is what the components are laid out inside (liberty L7).
  const max = /max-width:\s*(\d+)px/.exec(query);
  if (max) return WORLD_W <= Number(max[1]);
  const min = /min-width:\s*(\d+)px/.exec(query);
  if (min) return WORLD_W >= Number(min[1]);

  if (typeof window === "undefined" || !window.matchMedia) return false;
  return window.matchMedia(query).matches;
}
