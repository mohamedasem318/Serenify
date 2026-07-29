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

export const FPS = 30;
/** World width = the rendered viewport width. Scaled 1.6× to a 1920 output. */
export const W = 1200;
export const H = 675;

/** Grey ramp. Named by role, not by lightness, so beats read at the call site. */
export const GREY = {
  black: "#0f1113",
  page: "#e4e5e7",
  surface: "#eef0f1",
  panel: "#d2d4d7",
  panelAlt: "#dadce0",
  field: "#e0e2e4",
  fill: "#b6b9bc",
  strong: "#9b9ea1",
  graphite: "#7b7f83",
  line: "#8d9195",
  border: "#b9bcbf",
  ink: "#1f2225",
  body: "#4a4f53",
  label: "#5f6468",
  ghost: "#c6c9cc",
  white: "#f7f8f9",
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

export const FONT = "Arial, Helvetica, sans-serif";
export const MONO = 'Consolas, "Courier New", monospace';

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
