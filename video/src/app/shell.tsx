import React from "react";

import { OS, OS_FONT, OS_TABULAR, STANDIN } from "./furniture";

/**
 * ── THE WORLD, AND THE REAL APP SHELL INSIDE IT ─────────────────────────────────────
 *
 * The world is 1200×675 scaled 1.6× to the 1920×1080 output (liberty L7) — a screen recording
 * of a 1200px screen, blown up, not a 1920px browser with dead gutter. 1200 is the smallest
 * viewport at which the app's `max-w-6xl` column is at full designed width, and `apps/web` has
 * no `xl:`/`2xl:` utilities at all, so nothing reflows between 1200 and 1920.
 *
 * ── WHY THE LAYOUT IS RESTATED HERE RATHER THAN IMPORTED ────────────────────────────
 *
 * `app/(authed)/layout.tsx` is an async Server Component: it awaits a Supabase client, reads
 * the user, reads the profile, and runs the Terms/Privacy consent gate. None of that can run in
 * a Remotion bundle, and none of it is visual. So what is reproduced here is only its **layout
 * contract** — the classNames, verbatim, with a citation each. Anything with real visual
 * substance (the header, the banners, the stage) is the real component.
 *
 * Every class string below is quoted from the app. If one drifts, the video's framing numbers go
 * stale silently, which is precisely the failure this pass exists to end — so they are pulled
 * out as named constants rather than inlined at call sites, and each carries its source.
 */

export const WORLD = { w: 1200, h: 675 } as const;

/** macOS menu bar. Exists mainly so the window has a top; the clock lives in the toolbar (L11). */
export const MENUBAR_H = 24;
/** Tab strip (30) + omnibox row (38). */
export const CHROME_H = 68;
export const CHROME_Y = MENUBAR_H;
export const VIEWPORT_Y = MENUBAR_H + CHROME_H;

/** `app/(authed)/layout.tsx:` the app header — `sticky top-0 z-50 flex h-16 …`. h-16 = 64. */
export const HEADER_H = 64;
/** `app/(authed)/layout.tsx:` `<main className="flex-1 px-4 pt-6 sm:px-6 sm:pt-8">`. At ≥640: 24 / 32. */
export const MAIN_PX = 24;
export const MAIN_PT = 32;

/**
 * `components/monitor/monitoring-session.tsx:803` — the monitoring stage card, verbatim.
 *
 * **This is register item 2.** The greybox drew a 700-wide card and widened the gap between the
 * orb/stateline and the trend so the emphasis would not overlap the bloom — which fixed a video
 * problem by changing the product's layout. This is the product's own spacing: `max-w-3xl`
 * (768), `min-h-[480px]` at sm, `px-10 pb-10 pt-16`, `rounded-3xl`. Nothing is padded.
 *
 * **The class string is still the product's, verbatim.** L15's three adaptations — the shorter
 * top band, the shorter bottom pad and the released `min-height` — are applied by the scoped
 * stylesheet in `monitor.tsx` § `<StageLayout/>` rather than by editing this string, so the
 * divergence from the shipped card lives in exactly one place and can be read as a list.
 */
export const MONITOR_STAGE =
  "relative flex min-h-[420px] flex-col items-center justify-center overflow-hidden " +
  "rounded-3xl border border-border bg-surface px-6 pb-6 pt-16 shadow-soft " +
  "sm:min-h-[480px] sm:px-10 sm:pb-10";

/**
 * `monitoring-session.tsx:782` — the monitor page column. The app ships `max-w-3xl` (768).
 *
 * ── L14 NARROWED IT TO `max-w-lg` (512); L15 TAKES IT ONE MORE STEP TO `max-w-md` (448) ──
 *
 * Measured, not preferred, at both steps. At the shipped 768 the populated trend card's bottom
 * was 1227.4 and the bloom's top 309 — **918.4px of stack** against a 675-tall world, which no
 * 16:9 frame ≤1200 world px can hold; L14's 512 is what freed the page from x 856 rightward and
 * gave the viewfinder, the toast and the prompt somewhere to be pinned.
 *
 * **448 is what makes the gutter a number rather than a coincidence.** `mx-auto` centres it at
 * **376 – 824**, and the pinned column begins at 856 — so the gap between the card and everything
 * in that column is exactly `PINNED_GAP`, 32. At 512 it was zero: the card ended where the column
 * began, and the confirmatory prompt sat flush against it while carrying 30.7px of air above
 * itself. Two gutters on one element, and the tighter one was nothing.
 *
 * Both widths are the app's own steps — `max-w-lg` is the calibration column
 * (`anchor-recorder.tsx:570`) and `max-w-md` is the `(auth)` column
 * (`app/(auth)/layout.tsx`) — so neither is a number invented for the film. And the bloom is
 * centred, so it lands on x 600 at 768, at 512 and at 448 alike: what moves is the empty page
 * either side of it. What DOES change at 448 is the stateline's own measure — the card's content
 * width goes 430 → 366, and the two-line `tense` sub was re-checked there rather than assumed
 * (`geometry.ts` § statelineSubTense).
 */
export const MONITOR_COL = "mx-auto w-full max-w-md";

/** `components/anchor/anchor-recorder.tsx:570` — the calibration column. `max-w-lg` = 512. */
export const CALIBRATE_COL = "mx-auto w-full max-w-lg";

/**
 * `anchor-recorder.tsx:578` — the calibration preview. **Register item 5 in one line:** it is a
 * full-width `aspect-video` box, so at a 512 column it is 512×288. The greybox drew it 3:4 at
 * 240 wide. The 3:4 thing is the bracket GUIDE floating inside it
 * (`framing-overlay.tsx:82`, `aspect-[3/4] h-[78%]`), which is genuinely 3:4 — the box never was.
 */
export const CALIBRATE_PREVIEW =
  "relative aspect-video w-full overflow-hidden rounded-card bg-ink/5";

// ── The OS furniture ────────────────────────────────────────────────────────────────

/** The omnibox pill. Shortened from the full width to make room for the clock on the same row. */
export const OMNIBOX = { x: 60, y: CHROME_Y + 34, w: 960, h: 28 } as const;

/**
 * The toolbar clock (liberty L11). Right edge 1176 — shared with the toast and the viewfinder so
 * beat 8 frames one vertical stack rather than three unrelated things.
 *
 * **Plain, and it stays plain.** No pulse, flash, tint or animation beyond the time changing:
 * beat 8 works because nobody is told it is bad news, and emphasis would convert a discovery
 * into an instruction. There is no colour available for it either — meadow and amber both carry
 * band meaning. In dark it is the one furniture value allowed to break the ramp's lightness
 * band, because it has to read at ~10px on a phone in a wide shot (see `furniture.ts`).
 */
export const CLOCK = { x: 1036, y: 58, w: 140, h: 30 } as const;

const TAB_W = 190;
const TAB_GAP = 4;
export const tabRect = (i: number) => ({
  x: 60 + i * (TAB_W + TAB_GAP),
  y: CHROME_Y + 4,
  w: TAB_W,
  h: 26,
});
export const newTabRect = (tabCount: number) => ({
  x: 60 + tabCount * (TAB_W + TAB_GAP) + 4,
  y: CHROME_Y + 6,
  w: 22,
  h: 22,
});

/**
 * The mail app's visual signature. Beat 8's whole meaning hangs on the audience recognising,
 * ~25 seconds later, that the toast is from HIS mail and not from Serenify — if it reads as
 * Serenify notifying him, the scene inverts. So it is ONE component used in both places, never
 * two lookalikes.
 *
 * In dark it gains a HUE as well as a shape, because at low contrast shape alone is a weaker
 * disambiguator than it was in the grey pass. The hue is chosen by elimination — not red, not
 * meadow/amber (band meaning), not foggy (that IS Serenify's attention colour, so a foggy icon
 * reads as Serenify). See `furniture.ts` § MAIL.
 */
export const MailMark: React.FC<{ size: number }> = ({ size }) => (
  <div
    style={{
      width: size,
      height: size,
      borderRadius: size * 0.24,
      backgroundColor: "#5C6E9C",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      flexShrink: 0,
    }}
  >
    <svg width={size * 0.62} height={size * 0.46} viewBox="0 0 62 46">
      <rect x={1} y={1} width={60} height={44} rx={5} fill="none" stroke="#E8ECF2" strokeWidth={5} />
      <path d="M4 7 L31 27 L58 7" fill="none" stroke="#E8ECF2" strokeWidth={5} />
    </svg>
  </div>
);

export interface TabSpec {
  label: string;
  mail?: boolean;
}

const Box: React.FC<{
  x: number;
  y: number;
  w: number;
  h: number;
  fill: string;
  radius?: number;
  border?: string;
  borderWidth?: number;
}> = ({ x, y, w, h, fill, radius = 0, border, borderWidth = 1 }) => (
  <div
    style={{
      position: "absolute",
      left: x,
      top: y,
      width: w,
      height: h,
      backgroundColor: fill,
      borderRadius: radius,
      boxSizing: "border-box",
      ...(border ? { border: `${borderWidth}px solid ${border}` } : null),
    }}
  />
);

/**
 * The browser chrome, in dark.
 *
 * The chrome is LIGHTER than the page it frames, which is correct: `--color-bg` in dark is
 * `#101214`, darker than any real browser's dark chrome, so the chrome reads as a bezel around
 * the page and the page stays the subject. The whole ramp is held inside a nine-point lightness
 * band so no seam in it is stronger than an edge inside the product.
 */
export const BrowserChrome: React.FC<{
  tabs: TabSpec[];
  active: number;
  url: string;
  clock: string;
  caret?: boolean;
}> = ({ tabs, active, url, clock, caret = false }) => (
  <>
    <Box x={0} y={0} w={WORLD.w} h={MENUBAR_H} fill={OS.menubar} />
    <Box x={0} y={CHROME_Y} w={WORLD.w} h={CHROME_H} fill={OS.bar} />
    {/* The seam under the chrome. A dark UI separates by shadow, not by a light rule. */}
    <Box x={0} y={VIEWPORT_Y - 1} w={WORLD.w} h={1} fill={OS.seam} />

    {tabs.map((tab, i) => {
      const r = tabRect(i);
      const isActive = i === active;
      return (
        <React.Fragment key={i}>
          <Box
            x={r.x}
            y={r.y}
            w={r.w}
            h={r.h}
            fill={isActive ? OS.tabActive : OS.tabIdle}
            radius={6}
          />
          {/* The catch-light on the active tab's top edge — what makes it read as raised. */}
          {isActive ? <Box x={r.x + 6} y={r.y} w={r.w - 12} h={1} fill={OS.lift} /> : null}
          {tab.mail ? (
            <div style={{ position: "absolute", left: r.x + 10, top: r.y + 7 }}>
              <MailMark size={13} />
            </div>
          ) : null}
          <div
            style={{
              position: "absolute",
              left: r.x + (tab.mail ? 29 : 12),
              top: r.y + 7,
              fontFamily: OS_FONT,
              fontSize: 11,
              fontWeight: isActive ? 600 : 400,
              color: isActive ? OS.label : OS.faint,
              whiteSpace: "nowrap",
            }}
          >
            {tab.label}
          </div>
        </React.Fragment>
      );
    })}

    {(() => {
      const r = newTabRect(tabs.length);
      return (
        <div
          style={{
            position: "absolute",
            left: r.x,
            top: r.y,
            width: r.w,
            height: r.h,
            display: "grid",
            placeItems: "center",
            fontFamily: OS_FONT,
            fontSize: 15,
            fontWeight: 400,
            color: OS.faint,
          }}
        >
          +
        </div>
      );
    })()}

    {/* Omnibox. Beat 1 opens on a lifted copy of this, which settles into it. */}
    <Box
      x={OMNIBOX.x}
      y={OMNIBOX.y}
      w={OMNIBOX.w}
      h={OMNIBOX.h}
      fill={OS.tabActive}
      radius={14}
      border={caret ? OS.lift : OS.seam}
      borderWidth={caret ? 2 : 1}
    />
    {/*
     * ── THE OMNIBOX AND THE CLOCK ARE SYSTEM UI SANS, NOT MONO (§6.1) ──
     *
     * Both were Geist Mono, on the reasoning that an address bar and a ticking clock want stable
     * digit widths. The premise is right and the conclusion was not: **no mainstream browser sets
     * its omnibox in a monospace face.** Chrome, Safari and Firefox all use the system UI font,
     * and a monospaced address bar is one of the clearest tells of a browser that was *drawn* —
     * which is the one thing this chrome cannot afford to be, since its whole job is to be
     * unremarkable enough to read as the audience's own machine.
     *
     * The digit-width argument survives and is met properly: `OS_TABULAR` turns on Inter's own
     * tabular figures, so the clock's minutes tick without the row reflowing and the omnibox keeps
     * proportional letters. That is what a browser does, and it costs a font-feature declaration
     * rather than a second family. Full argument in `furniture.ts` § OS_FONT.
     */}
    <div
      style={{
        position: "absolute",
        left: OMNIBOX.x + 16,
        top: OMNIBOX.y + 6,
        fontFamily: OS_FONT,
        fontFeatureSettings: OS_TABULAR,
        fontSize: 14,
        color: OS.label,
        whiteSpace: "nowrap",
      }}
    >
      {url}
      {caret ? <span style={{ color: OS.clock }}>|</span> : null}
    </div>

    <div
      style={{
        position: "absolute",
        left: CLOCK.x,
        top: CLOCK.y,
        width: CLOCK.w,
        fontFamily: OS_FONT,
        fontFeatureSettings: OS_TABULAR,
        fontSize: 28,
        fontWeight: 700,
        // Inter is a little wider than Geist Mono at this size and the clock is a fixed-width
        // right-aligned box, so the tracking comes in slightly to keep "11:30 AM" off the
        // omnibox's right edge. Nothing else about it moves — it stays plain, un-tinted and
        // un-animated (L11), because emphasis here would turn beat 8's discovery into an
        // instruction.
        letterSpacing: -0.4,
        lineHeight: 1.05,
        color: OS.clock,
        textAlign: "right",
      }}
    >
      {clock}
    </div>
  </>
);

/**
 * The whole desktop: OS chrome + the page below it. Every beat opens with this, so the
 * continuity — one browser window for the whole film — is structural rather than something
 * each beat has to remember.
 *
 * `.dark` is set here, once. The app's dark mode is class-based (`next-themes`
 * `attribute="class"`, `globals.css:12`), so a single class on the wrapper swaps every token
 * underneath. That is the whole of the dark-mode swap for real components — they were built for
 * it, and nothing in the video overrides a token.
 */
/**
 * ── DARK MODE GOES ON `:root`, NOT ON A WRAPPER ─────────────────────────────────────
 *
 * The app's dark palette is a token swap under **`:root.dark`** (`globals.css:145`), so the
 * class has to land on the document element. `@custom-variant dark (&:where(.dark, .dark *))`
 * (`globals.css:12`) makes `dark:` UTILITIES work from any ancestor, which is why a `.dark` on
 * a nested div looks like it should be enough — and it is not: it switches the handful of
 * `dark:` utilities and leaves every `--color-*` token on its light value. The first render of
 * this pass came out fully light with correctly-swapped `dark:text-bg` on the OTP pill, which
 * is exactly that failure and is very easy to miss.
 *
 * `useLayoutEffect` rather than `useEffect` so the class is on the element BEFORE the first
 * paint of frame 0 — an effect would let one frame through light.
 *
 * **Exported because two beats need it without a `Desktop`.** Beats 12 and 13 leave the browser
 * entirely, so they render no shell — and the end card renders the real `<Wordmark/>`, whose
 * `text-ink` resolved to the LIGHT `#1C2023` on a near-black card. The mark was there, correct
 * and effectively invisible. Any beat that renders an `apps/web` component outside `Desktop` has
 * to call this.
 */
export const useDarkRoot = () => {
  React.useLayoutEffect(() => {
    document.documentElement.classList.add("dark");
    return () => document.documentElement.classList.remove("dark");
  }, []);
};

export const Desktop: React.FC<{
  clock: string;
  tabs?: TabSpec[];
  active?: number;
  url?: string;
  caret?: boolean;
  /** A page background override, for the drawn stand-in pages (mail, music). */
  fill?: string;
  /**
   * Drawn in WORLD coordinates, over both the chrome and the page — the layer an OS
   * notification actually lives on. Anything positioned inside `children` resolves against the
   * viewport div instead, which is offset by `VIEWPORT_Y`; the mail toast was 92px low before
   * this existed, and the framing derived from its measured rect was wrong by the same amount.
   */
  overlay?: React.ReactNode;
  children?: React.ReactNode;
}> = ({
  clock,
  tabs = [{ label: "Serenify" }],
  active = 0,
  url = "serenify.tech",
  caret,
  fill,
  overlay,
  children,
}) => {
  useDarkRoot();
  return (
  <div
    style={{
      position: "absolute",
      inset: 0,
      width: WORLD.w,
      height: WORLD.h,
      overflow: "hidden",
      backgroundColor: fill ?? "var(--color-bg)",
    }}
  >
    <BrowserChrome tabs={tabs} active={active} url={url} clock={clock} caret={caret} />
    <div
      style={{
        position: "absolute",
        left: 0,
        top: VIEWPORT_Y,
        width: WORLD.w,
        height: WORLD.h - VIEWPORT_Y,
        backgroundColor: fill ?? "var(--color-bg)",
        overflow: "hidden",
      }}
    >
      {children}
    </div>
    {overlay}
  </div>
  );
};

/**
 * The signed-in app shell. `Header` is the real component, and `main`'s padding is the real
 * layout's. The header is `sticky top-0` in the app; inside a fixed-height film frame there is
 * no scroll, so it is simply the first thing in the column — same visual result, no fake scroll
 * container.
 */
export const AppShell: React.FC<{
  clock: string;
  url?: string;
  tabs?: TabSpec[];
  active?: number;
  children?: React.ReactNode;
  /** Rendered above `main`, inside the viewport — the real `<Header/>` when a beat wants it. */
  header?: React.ReactNode;
  /** World-coordinate layer over everything — OS notifications, the drawn cursor. */
  overlay?: React.ReactNode;
}> = ({ clock, url = "serenify.tech/app", tabs, active, header, overlay, children }) => (
  <Desktop clock={clock} url={url} tabs={tabs} active={active} overlay={overlay}>
    {header}
    <div style={{ paddingLeft: MAIN_PX, paddingRight: MAIN_PX, paddingTop: MAIN_PT }}>{children}</div>
  </Desktop>
);

/** A dark stand-in rectangle, for the surfaces this pass deliberately leaves undrawn. */
export const StandIn: React.FC<{
  x: number;
  y: number;
  w: number;
  h: number;
  radius?: number;
  fill?: string;
  border?: string;
  label?: string;
}> = ({ x, y, w, h, radius = 8, fill = STANDIN.panel, border = STANDIN.border, label }) => (
  <div
    style={{
      position: "absolute",
      left: x,
      top: y,
      width: w,
      height: h,
      backgroundColor: fill,
      border: `1px solid ${border}`,
      borderRadius: radius,
      boxSizing: "border-box",
      display: label ? "grid" : undefined,
      placeItems: label ? "center" : undefined,
      fontFamily: OS_FONT,
      fontSize: 10,
      letterSpacing: 0.6,
      textTransform: "uppercase",
      color: STANDIN.label,
    }}
  >
    {label}
  </div>
);
