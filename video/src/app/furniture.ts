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
 *
 * ── AND IT IS A GRADIENT, BECAUSE A REAL ONE NEVER IS FLAT ──────────────────────────
 *
 * One flat fill is what gives a drawn panel away. Real vibrancy samples what is behind it, and
 * what is behind a notification in the top-right of a desktop is never uniform, so the material
 * always carries a faint top-to-bottom direction even over a plain wall. `panelTop` → `panel` is
 * that direction and nothing more: **2.7 L\* units** across 104px, which is under the threshold at
 * which a viewer can name it as a gradient and is exactly enough that the panel stops reading as
 * a rectangle of one colour. Beat 8 magnifies this toast ~4.2× (`framing.ts` § BEAT8_CLOCK), so a
 * flat fill is seen at 320×104 world px blown up to roughly 1330×430 — the size at which flatness
 * becomes the most obvious thing on screen.
 */
export const TOAST = {
  /**
   * The material's base, and the gradient's BOTTOM stop. Unchanged from the flat pass, so the
   * toast's mass and its contrast against every text token below are exactly as measured.
   */
  panel: "#2b2e32",
  /** The gradient's TOP stop. Deliberately tiny: 2.7 L\* above `panel`. See above. */
  panelTop: "#2f3237",
  /** The catch-light on the top/left edge. This is what makes it read as a floating material. */
  edge: "#3d4247",
  /**
   * The drop shadow's colour. Tokenised rather than inlined for the same reason every other
   * value here is: it is a colour on a piece of furniture, and the furniture's colours live in
   * one file. Deep and soft — a notification floats above the desktop, it is not welded to it.
   */
  shadow: "rgba(0,0,0,0.55)",
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
 * ── THE APPLICATION RAMP ────────────────────────────────────────────────────────────
 *
 * Originally the greybox stand-ins' ramp. **Nothing stands in any more** — the mail client and
 * the music player are drawn applications now (`mail.tsx`, `player.tsx`) and this is the ramp
 * they are built from. The name is kept because every value in it is unchanged and re-pointing
 * ~40 call sites to a renamed constant would have been a diff about nothing.
 *
 * It is a genuine dark ramp (a lift from the page, not a drop from white), NOT the old light
 * `GREY` values inverted: inverting a light ramp gives muddy mid-greys with the wrong lightness
 * spacing, because perceptual lightness is not symmetric about the midpoint.
 *
 * These sit a touch flatter than the OS chrome so a non-Serenify application never out-reads the
 * real product component beside it — which matters more now that they are finished rather than
 * less. A well-drawn mail client competing with the monitoring stage would be a worse failure
 * than the grey rectangle was.
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
 * ── THE MAIL CLIENT AND THE MUSIC PLAYER ────────────────────────────────────────────
 *
 * The film's two drawn *applications*, as opposed to the browser chrome around them. They build
 * out of `STANDIN` above and add only what a rectangle never needed: the states a list has, the
 * hairline a titlebar has, and the one accent each app is allowed.
 *
 * ── THE ACCENT IS THE APP'S IDENTITY, AND IT IS CHOSEN THE SAME WAY THE MAIL MARK WAS ──
 *
 * Every colour that means something in this product is unavailable — meadow and amber carry band
 * readings, foggy IS Serenify's attention colour, red and crimson are forbidden outright. The
 * mail mark resolved that by elimination and landed on steel-indigo at 250° (see MAIL above), and
 * the mail client simply inherits it: the unread dot, the selected row and the icon are one hue,
 * which is what makes the app read as *an* app rather than as a grey list.
 *
 * The player takes the **same hue one step cooler and deeper**. Two non-Serenify applications on
 * the same desktop should look like they come from the same operating system without looking like
 * the same program, and a shared hue at two values is how a real OS achieves that.
 */
export const MAILAPP = {
  /** The sidebar — deeper than the list, as every three-pane mail client draws it. */
  rail: "#141719",
  /** The message list column. */
  list: "#181b1e",
  /** The reading pane — the lightest of the three, because it is the subject. */
  pane: "#1b1f22",
  /** A list row at rest. */
  row: "#1e2226",
  /** The selected row. Steel-indigo at low saturation — present, never loud. */
  rowSelected: "#26303f",
  /** The unread dot and the folder-count pills. */
  accent: "#5C6E9C",
  /** Hairline between panes. Darker than either — a dark UI separates by shadow. */
  divider: "#0f1113",
} as const;

export const PLAYERUI = {
  /** The window body. */
  window: "#1a1e21",
  /** The title bar, a shade up so the window reads as having a head. */
  titlebar: "#22272b",
  /** The catch-light along the window's top edge. */
  edge: "#333a40",
  /** The transport's secondary buttons (previous / next) at rest. */
  control: "#2b3136",
  /** The play/pause button — filled, because it is the one control that matters. */
  primary: "#e4e8ec",
  /** The glyph inside the filled play button. Near-black, so it reads as a solid key. */
  onPrimary: "#14181b",
  /** The unplayed remainder of the scrubber. */
  track: "#2e343a",
  /** The elapsed portion, and the scrub handle. */
  elapsed: "#8fa4c4",
} as const;

/**
 * ── THE ALBUM ART'S PALETTE, AND WHY IT IS NOT A DESIGN CHOICE ──────────────────────
 *
 * **The artwork is ORIGINAL and abstract, and that is a hard requirement rather than a
 * preference.** The film is promotional rather than educational, which is the factor that cuts
 * hardest against a fair-use argument; the sleeve is a separate copyrighted work from the
 * recording, so not playing the song does nothing for it; and the sleeve in question is a
 * photograph of a person, so likeness rights sit on top of the copyright. Original art costs
 * nothing and removes the question. **No reproduction, no near-reproduction, nothing "inspired
 * by" and nothing recoloured.**
 *
 * The song title and the artist's name stay on screen — that is decided (L2b) and load-bearing,
 * since the naming is the evidence Ren knew his taste. Naming a track with no audio and no lyrics
 * is a different exposure from drawing its cover, and only the second one is being avoided here.
 *
 * The palette is the furniture's own cool quadrant, for the same reason everything else here is:
 * a cover wearing meadow or amber beside a bloom that means meadow or amber would look like it
 * was asserting a stress reading.
 */
export const SLEEVE = {
  /** Top of the field. */
  skyTop: "#3d4a72",
  /** …and its bottom, where it sinks toward the window behind it. */
  skyBottom: "#141a2b",
  /** The disc. Warmer than the field but still nowhere near amber. */
  disc: "#c9b9a6",
  /** The disc's halo. */
  halo: "#6e7ba6",
  /** The horizon bands across the lower third. */
  band: "#8a93b8",
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
 * ships and is therefore right on its own merits, not merely already loaded. See `src/fonts.ts`.
 *
 * ── THE OMNIBOX AND THE CLOCK ARE NOT MONO, AND THAT WAS A REAL ERROR ───────────────
 *
 * They were set in Geist Mono, on the stated reasoning that "a browser's address bar and a
 * ticking clock both want stable digit widths". The premise is fine and the conclusion does not
 * follow: **no mainstream browser does this.** Chrome, Safari and Firefox all set the address bar
 * in the system UI font, and a monospaced omnibox is one of the most recognisable tells of a
 * *drawn* browser — which is the one thing this chrome cannot afford to be, since its whole job
 * is to be unremarkable enough that the audience reads it as their own machine.
 *
 * The instinct underneath it was right — a browser is not Serenify, so it must not wear Outfit —
 * and it is unaffected: `OS_FONT` is Inter either way. The mistake was answering "not the
 * product's face" with a face no browser uses instead of the face every browser uses.
 *
 * **The digit-width argument survives, and is met properly.** Stable digits are a numerals
 * problem, not a typeface problem: `OS_TABULAR` turns on Inter's own tabular-figure feature, so
 * the clock's minutes tick without the row reflowing and the omnibox keeps proportional letters.
 * That is what a browser actually does, and it costs a font-feature declaration rather than a
 * whole second family.
 *
 * `OS_MONO` is kept and is now used by **nothing in the film**. It is left in place deliberately:
 * Geist Mono is still loaded for the probe compositions, and re-deriving "which mono, and why"
 * the next time a genuinely monospaced surface appears is a worse trade than four lines of dead
 * constant. If a surface ever needs it, the reasoning above is why it must not be the omnibox.
 */
export const OS_FONT = `${SANS}, system-ui, sans-serif`;
/** Tabular figures, for the clock and any other furniture numeral that must not reflow. */
export const OS_TABULAR = '"tnum" 1, "lnum" 1';
export const OS_MONO = `${MONO_FAMILY}, ui-monospace, monospace`;
/** The two closing cards' display line and the wordmark. The app's own display face. */
export const CARD_DISPLAY = `${DISPLAY}, sans-serif`;
/** Body type on the closing cards — subordinate to the mark above it, so never the display face. */
export const SANS_STACK = `${SANS}, system-ui, sans-serif`;
