/**
 * Greybox constants — the world the camera looks at.
 *
 * This pass answers exactly one question: does the pacing work. So there is no
 * palette here beyond greys, and the two band colours below are built ONLY
 * because the meadow→amber drift is a 1.3s timing event rather than decoration.
 * Nothing here is meant to survive to the real render.
 *
 * ── THE WORLD IS 1200×675, NOT 1920×1080 ────────────────────────────────────
 *
 * The product is rendered at a **1200px-wide viewport** and the whole desktop is
 * scaled 1.6× to fill the 1920×1080 output. It is a screen recording of a
 * 1200×675 screen, blown up — not a 1920 screen with dead gutter in it.
 *
 * 1200 is not a guess. `apps/web` uses **no `xl:` or `2xl:` utilities anywhere**;
 * its highest breakpoint is `lg:` (1024px), plus a single custom `min-[880px]`
 * on the dashboard's secondary-card grid. So every viewport at or above 1024px
 * renders an identical layout. The content column is `max-w-6xl` (1152px) inside
 * `px-4 sm:px-6` (24px a side at ≥640), so it reaches its designed cap at
 * exactly 1152 + 48 = **1200px**. That makes 1200 the smallest viewport at which
 * the column is at full designed width: the largest possible content with zero
 * layout compromise. Below it the column shrinks and line lengths stop matching
 * what the app ships; above it, every extra pixel is dead gutter.
 *
 * The effect is 1.6× of free magnification before any push-in — content fills
 * ~96% of the frame instead of ~60%.
 *
 * Everything is still authored at real app pixel sizes: a 448px signup column
 * really is 448px here, `text-sm` really is 14px, the stateline really is 30px.
 * Only the frame changed.
 */

import { DISPLAY, MONO_FAMILY, SANS } from "../fonts";

export const FPS = 30;
/** World width = the rendered viewport width. Scaled 1.6× to a 1920 output. */
export const W = 1200;
export const H = 675;

/**
 * Grey ramp. Named by role, not by lightness, so beats read at the call site.
 *
 * ── DARK, AS OF THE COMPONENT PASS ──────────────────────────────────────────────────
 *
 * The film is dark now. Every Serenify surface takes its colour from the app's own `:root.dark`
 * tokens, so this ramp only dresses what is left: the surfaces that are still deliberately
 * stand-ins (the mail client, the music player), the two closing cards, and any greybox
 * furniture a beat has not yet been rebuilt around. Those have to read as **dark-mode grey**,
 * not as light-mode grey sitting in a dark film — a stand-in in the wrong mode is louder than a
 * stand-in, because the eye reads the mismatch before it reads the placeholder.
 *
 * **These are not the old values inverted.** Perceptual lightness is not symmetric about the
 * midpoint, so flipping a light ramp gives muddy mid-greys with the wrong spacing between steps.
 * This is built upward from the app's own dark page (`#101214`) the way the light ramp was built
 * downward from its page, and it is kept a touch flatter than the OS chrome in `furniture.ts` so
 * a stand-in never out-reads a real component sitting beside it.
 *
 * `white` and `black` keep their names and swap their jobs: `white` is now the brightest ink
 * available on a dark field rather than a paper colour. The names are left alone because every
 * call site reads them as roles, and renaming them would be a large diff that changes nothing.
 */
export const GREY = {
  black: "#08090a",
  page: "#101214",
  surface: "#181b1e",
  panel: "#22262a",
  panelAlt: "#1e2225",
  field: "#191c1f",
  fill: "#2f3439",
  strong: "#3a4046",
  graphite: "#6b7278",
  line: "#3a4046",
  border: "#2a2f34",
  ink: "#e2e5e8",
  body: "#a8aeb4",
  label: "#878e94",
  ghost: "#2c3136",
  white: "#f2f4f6",
} as const;

/**
 * The only two non-grey values in the whole pass. The bloom drifts
 * meadow → amber → meadow on a 1.3s ease and that drift is a pacing event, so
 * it is built for real. Both are the shipped `apps/web` tokens.
 */
export const BAND = {
  meadow: "#3E7A63",
  amber: "#C98637",
} as const;

/**
 * The greybox's own type, and it is no longer a fallback stack.
 *
 * These were `Arial` and `Consolas` — a placeholder from the pass where every screen was a grey
 * rectangle and the typeface was beside the point. It stopped being beside the point the moment
 * real components appeared next to them: an Arial label against an Inter component is the loudest
 * thing in the frame. They now point at the same loaded faces as everything else (`src/fonts.ts`),
 * so whatever is still greybox at least sets in the film's typeface.
 */
export const FONT = `${SANS}, system-ui, sans-serif`;
export const MONO = `${MONO_FAMILY}, ui-monospace, monospace`;
/** The app's display face, for anything greybox that stands in for a heading or the wordmark. */
export const DISPLAY_FONT = `${DISPLAY}, sans-serif`;

// ── Window furniture ────────────────────────────────────────────────────────
// One browser window for the whole video — tabs switch, the frame never cuts to
// another device (beat sheet §Continuity) — so these are constants every beat
// sits inside.

/** macOS menu bar. Exists mainly to carry the clock beat 8 depends on. */
export const MENUBAR_H = 24;
export const CHROME_Y = MENUBAR_H;
/** Tab strip (30) + omnibox row (38). */
export const CHROME_H = 68;
export const VIEWPORT_Y = MENUBAR_H + CHROME_H;
export const VIEWPORT_H = H - VIEWPORT_Y;

/** `max-w-6xl` (1152) inside `sm:px-6` (24). At a 1200 viewport it exactly fits. */
export const COL_W = 1152;
export const COL_X = (W - COL_W) / 2;

/** The signup form column. */
export const FORM_W = 448;
export const FORM_X = (W - FORM_W) / 2;

/**
 * Phone-legibility floor, as a function rather than folklore.
 *
 * A 1920-wide frame viewed at 422px (phone width) scales by 422/1920; a push-in
 * that frames `framedWidth` world-pixels magnifies by 1920/framedWidth. So a
 * world type size lands on a phone at `size × 422 / framedWidth`, and ~10px is
 * the floor at which a line is read rather than merely recognised.
 *
 *   fw 1200 → ×0.35   fw 840 → ×0.50   fw 700 → ×0.60
 *   fw  560 → ×0.75   fw 500 → ×0.84   fw 420 → ×1.00
 */
export const PHONE_PX = (worldSize: number, framedWidth: number) => (worldSize * 422) / framedWidth;
