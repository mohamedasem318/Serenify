/**
 * Greybox constants — the world the camera looks at.
 *
 * This pass answers exactly one question: does the pacing work. So there is no
 * palette here beyond greys, and the two band colours below are built ONLY
 * because the meadow→amber drift is a 1.3s timing event rather than decoration.
 * Nothing else is coloured. Nothing here is meant to survive to the real render.
 *
 * Everything is authored at real app pixel sizes inside a 1920×1080 "world" —
 * a 448px signup column really is 448px wide here — and legibility comes from
 * the camera pushing in, exactly as it will in the finished video. Sizing the
 * text up to be readable in a wide shot would test the wrong thing.
 */

export const FPS = 30;
export const W = 1920;
export const H = 1080;

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

// ── World layout ────────────────────────────────────────────────────────────
// One browser window, one continuous screen recording (beat sheet §Continuity),
// so the menu bar and browser chrome are constants every beat sits inside.

/** macOS menu bar. Exists mainly to carry the clock beat 8 depends on. */
export const MENUBAR_H = 28;
export const CHROME_Y = MENUBAR_H;
/** Tab strip + omnibox. */
export const CHROME_H = 76;
export const VIEWPORT_Y = MENUBAR_H + CHROME_H;
export const VIEWPORT_H = H - VIEWPORT_Y;

/** The app's 1152px content column, floating in wide gutters. */
export const COL_W = 1152;
export const COL_X = (W - COL_W) / 2;

/** The signup form column. */
export const FORM_W = 448;
export const FORM_X = (W - FORM_W) / 2;
