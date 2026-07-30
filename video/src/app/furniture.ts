import { DISPLAY, MONO_FAMILY, SANS } from "../fonts";

/*
 * Hallmark · component: os-furniture + closing-cards · genre: modern-minimal (chrome) + editorial (cards)
 * theme: dedicated non-Serenify dark block · anchor hue: steel-indigo 250°
 * states: n/a (non-interactive film set — no hover/focus/active surface exists in a render)
 * contrast: pass · deviation declared: Hallmark gate 47 (re-drawn chrome) overridden — this
 *   chrome is the film's diegetic set, not a marketing bezel. See the beat sheet's Continuity
 *   invariant and liberty L11.
 */

/**
 * The video's **non-Serenify furniture**, in dark. Everything in this file is authored: it has
 * no counterpart in `apps/web`, so it has no shipped dark variant to inherit and had to be
 * designed.
 *
 * ── WHY THIS IS NOT THE APP'S PALETTE, AND MUST NEVER BECOME IT ──────────────────────
 *
 * The obvious shortcut is to draw the browser chrome with `--color-surface` and the toast with
 * `--color-border`. That is wrong, and not on taste: **a browser is not part of Serenify.** If
 * the product's palette is ever revised, the operating system around it must not move with it —
 * the whole premise of the film is that Serenify is a page inside someone else's software. So
 * the furniture carries its own named ramp, and the only values shared with the app are the two
 * band colours, which are shared because they are *quoted* rather than reused (the toast never
 * uses them; see BAND_MEANING below).
 *
 * ── THE DARK CHROME IS LIGHTER THAN THE PAGE, AND THAT IS CORRECT ────────────────────
 *
 * `--color-bg` in dark is `#101214`, which is darker than any real browser's dark chrome. So
 * the chrome sits ABOVE the page in lightness and reads as a bezel around it — which is exactly
 * what macOS dark Chrome does, and it is what keeps the page reading as the subject rather than
 * as a hole. The whole furniture ramp is held inside a **nine-point lightness band** (L* 11–20)
 * so that no seam in it is stronger than an edge inside the product, which is the same
 * discipline the character's office backdrop is built on.
 *
 * The one deliberate exception is `clock`, which has to be read at ~10px on a phone in a wide
 * shot (liberty L11) and therefore has to clear the band.
 */

/**
 * ── THE OS CHROME RAMP ──────────────────────────────────────────────────────────────
 *
 * Named by role. `bar` is the toolbar field, `tabIdle` the unfocused tabs, `tabActive` the
 * focused tab and the omnibox pill (one value on purpose — in dark Chrome the active tab and
 * the omnibox read as the same raised surface, and giving them two values invents a
 * distinction no browser draws).
 */
export const OS = {
  /** The menu bar. Deepest thing on screen — it is furniture about furniture. */
  menubar: "#0a0b0c",
  /** The toolbar + tab strip field. */
  bar: "#191b1d",
  /** Unfocused tabs — the strip, one point up so the tab shape exists at all. */
  tabIdle: "#1d1f22",
  /** The focused tab AND the omnibox pill. Same value deliberately; see above. */
  tabActive: "#25282b",
  /** Seams between chrome elements. Darker than the bar — a dark UI separates by shadow. */
  seam: "#0e0f11",
  /** A hairline lift on the top edge of a raised chrome surface. */
  lift: "#31353a",
  /** Chrome label text — tab titles, the omnibox URL. Recessive by design. */
  label: "#8d9398",
  /** Chrome text that has to be found rather than read (the new-tab +). */
  faint: "#61666b",
  /**
   * The toolbar clock (L11). It BREAKS the furniture's lightness band on purpose: it has to
   * read at ~10px on a phone in a full-frame shot, which nothing inside the band can do. It is
   * still colourless and still un-animated — the sheet is explicit that emphasis here would
   * convert a discovery into an instruction.
   */
  clock: "#b9bfc4",
} as const;

/**
 * ── THE NOTIFICATION TOAST ──────────────────────────────────────────────────────────
 *
 * macOS dark notifications are a vibrancy panel: translucent, blurred, with a light hairline on
 * the top and left where the material catches. A real `backdrop-filter` buys nothing here —
 * what sits behind the toast is the app's near-black page, so blurring it produces the same
 * flat dark. So the material is faked the honest way: a solid panel a few points above the
 * page, plus the hairline. That reads as vibrancy at the size it is actually seen.
 */
export const TOAST = {
  panel: "#2b2e32",
  /** The catch-light on the top/left edge. This is what makes it read as a floating material. */
  edge: "#3d4247",
  /** The app name row — "Mail · now". */
  meta: "#9aa1a7",
  /** The sender. */
  title: "#e6e9ec",
  /** The subject line — the thing beat 8 exists to make readable. */
  body: "#cdd2d7",
} as const;

/**
 * ── THE MAIL APP'S HUE, AND IT IS A DISAMBIGUATOR NOT A DECORATION ──────────────────
 *
 * Beat 8's one real hazard is that a generic toast beside the Serenify viewfinder reads as
 * *Serenify* notifying him, which inverts the scene. The beat sheet's answer is the mail icon
 * established in 2e — same shape, same colour, ~25 seconds earlier.
 *
 * In dark, shape alone is weaker than it was in the grey pass, because everything is
 * low-contrast. So the icon carries a HUE as well, and the hue is chosen by elimination:
 *
 *   · not red — forbidden outright anywhere in this product
 *   · not meadow, not amber — both carry band meaning; a mail icon wearing one would look like
 *     it was asserting a stress reading
 *   · not foggy — foggy IS Serenify's attention colour, so a foggy icon reads as Serenify,
 *     which is the exact misread the icon exists to prevent
 *   · not crimson — destructive-action semantics
 *
 * What is left is the cool quadrant between foggy and violet. Steel-indigo at 250° is far
 * enough from foggy's 197° to read as a different app rather than a tint of the same one, and
 * it is desaturated enough not to become the brightest thing in a dark frame.
 */
export const MAIL = {
  icon: "#5C6E9C",
  glyph: "#E8ECF2",
} as const;

/**
 * ── THE GREYBOX STAND-INS, IN DARK ──────────────────────────────────────────────────
 *
 * Whatever is still a rectangle after this pass — the mail client's page, the music player —
 * has to read as dark-mode grey rather than as light-mode grey sitting in a dark film, which
 * is the specific failure the pass was told to avoid. So this is a genuine dark ramp (a lift
 * from the page, not a drop from white), NOT the old `GREY` values inverted: inverting a
 * light ramp gives you muddy mid-greys with the wrong lightness spacing, because perceptual
 * lightness is not symmetric about the midpoint.
 *
 * These are deliberately a touch flatter than the OS chrome so a stand-in never out-reads the
 * real product component beside it.
 */
export const STANDIN = {
  page: "#121416",
  surface: "#1a1d20",
  panel: "#22262a",
  panelAlt: "#1e2225",
  field: "#191c1f",
  border: "#2a2f34",
  line: "#3a4046",
  fill: "#2f3439",
  ink: "#dfe3e7",
  body: "#a8aeb4",
  label: "#878e94",
  ghost: "#2c3136",
} as const;

/**
 * ── THE TWO CLOSING CARDS ───────────────────────────────────────────────────────────
 *
 * Beat 12 (the subtitle) and beat 13 (the end card) are the only moments the film leaves the
 * browser. They sit on a field DEEPER than the app's own `#101214` — three points down — which
 * is what says "we have stepped outside the product" without a transition, a rule, or a label.
 * It is the cheapest possible signal and it costs no time.
 *
 * Both are framed at 760 (the sheet), so they read as one closing movement rather than two
 * cards. Type is `--font-display` (Outfit) at a generous measure; no ornament, no eyebrow, no
 * rule. The subtitle card deliberately does not type on — the end card types exactly one thing,
 * a domain, and that is the film's bookend with beat 1.
 */
export const CARD = {
  field: "#0b0c0e",
  ink: "#e8ebee",
  /** "take care of yourself" — subordinate to the wordmark above it. */
  muted: "#a6acb2",
  /** The derived domain line. */
  domain: "#c6ccd2",
} as const;

/**
 * The bands, restated for the one place the furniture legitimately quotes the product: nothing.
 *
 * This constant exists to be READ, not used. It records that the furniture must never wear
 * meadow or amber, so that the next person to add a piece of furniture does not reach for an
 * accent and pick one of the two colours that carry a stress reading in this product. If you
 * find yourself importing this, you are about to make a mistake.
 */
export const BAND_MEANING = {
  meadow: "at ease — affirmative. NEVER on furniture.",
  amber: "stress. NEVER on furniture.",
  foggy: "attention, and it is SERENIFY'S. Never on the mail app — see MAIL above.",
} as const;

/**
 * Furniture type. **The film's OS is not Serenify, so it does not use Outfit** — that rule is
 * unchanged and is the reason these are two constants rather than one.
 *
 * What changed is that both are now REAL, LOADED faces rather than CSS system stacks. A system
 * stack resolves against whatever the render box happens to have installed, which is the same
 * failure mode as a component falling back to `system-ui` — the film's set was in a fallback
 * typeface, and a stand-in in a fallback face reads as unfinished beside a real component.
 *
 * `OS_FONT` is **Inter**, which is a neutral UI grotesque of exactly the kind every desktop OS
 * ships and is therefore right on its own merits, not merely already loaded. `OS_MONO` is
 * **Geist Mono**, the one face in the film with no counterpart in the product: `apps/web` has no
 * mono token, and the omnibox URL and the toolbar clock both want stable digit widths. See
 * `src/fonts.ts`.
 */
export const OS_FONT = `${SANS}, system-ui, sans-serif`;
export const OS_MONO = `${MONO_FAMILY}, ui-monospace, monospace`;
/** The two closing cards' display line and the wordmark. The app's own display face. */
export const CARD_DISPLAY = `${DISPLAY}, sans-serif`;
/** Body type on the closing cards — subordinate to the mark above it, so never the display face. */
export const SANS_STACK = `${SANS}, system-ui, sans-serif`;
