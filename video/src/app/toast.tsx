import React from "react";

import { TOAST as COPY } from "../greybox/copy";
import { TOAST as T, OS_FONT, OS_TABULAR } from "./furniture";
import { TOAST as BOX } from "./geometry";
import { MailMark } from "./shell";
import { useToastIn } from "./motion";

/**
 * ══ THE MAIL NOTIFICATION — AUTHORED FURNITURE, IN DARK ═════════════════════════════
 *
 * Not a Serenify component and never will be, so it has no shipped dark variant to inherit and
 * had to be designed. It takes its values from `furniture.ts`, which is deliberately decoupled
 * from the app's palette — a browser and a mail client are not part of this product, and if
 * Serenify's tokens are ever revised the operating system around it must not move with them.
 *
 * ── THE MATERIAL ────────────────────────────────────────────────────────────────────
 *
 * macOS dark notifications are a vibrancy panel: translucent, blurred, with a catch-light along
 * the top and left where the material picks up the desktop behind it. A real `backdrop-filter`
 * buys nothing here — what sits behind this toast is the app's near-black page, so blurring it
 * produces the same flat dark at twice the render cost. So the material is faked the honest
 * way: a solid panel a few points above the page plus the hairline edge, which is what reads as
 * vibrancy at the size this is actually seen.
 *
 * **What the flat pass got wrong was being flat.** A single fill is the tell of a drawn panel:
 * real vibrancy samples what is behind it, so it always carries some top-to-bottom direction. The
 * panel is now a two-stop vertical gradient of 2.7 L\* (`furniture.ts` § TOAST) — under the
 * threshold at which anyone can name it as a gradient, and enough that the material stops reading
 * as a rectangle of one colour. That matters more here than almost anywhere else in the film,
 * because beat 8's tightest framing magnifies this toast ~4.2×.
 *
 * ── THE ICON IS A DISAMBIGUATOR, NOT A DECORATION ───────────────────────────────────
 *
 * Beat 8's one real hazard is that a generic toast beside the Serenify viewfinder reads as
 * *Serenify* notifying him, which inverts the entire scene. The sheet's answer is the mail mark
 * established in beat 2e, ~25 seconds earlier — and its instruction is explicit: fix any
 * ambiguity by making the icon **larger and more prominent, never by moving the toast**, because
 * the adjacency is liberty L2 and is load-bearing.
 *
 * In dark, shape alone is a weaker signal than it was in the grey pass, because everything is
 * low-contrast. So the mark also carries a hue — steel-indigo, chosen by elimination against
 * every colour that already means something in this product (see `furniture.ts` § MAIL). The
 * result is that the toast differs from Serenify in shape AND hue, which is a stronger
 * disambiguation than the grey pass could offer at all.
 *
 * The instruction is taken literally in this pass: the mark goes from 30px to **38px**, which is
 * the size a macOS banner's app icon actually is relative to its panel, and is the only lever the
 * sheet permits.
 *
 * ── THE SUBJECT LINE IS THE POINT OF THE WHOLE BEAT ─────────────────────────────────
 *
 * Everything else here is set dressing. Beat 8 exists so the audience reads "need the report by
 * **12**" against a toolbar clock reading "11:**30** AM" and does the subtraction themselves —
 * nobody in the film ever says *thirty minutes*. So the subject holds 14px (it lands at 12.8px on
 * a phone in the beat's clock framing, well over the ~10px floor — `framing.ts:67`) and it is the
 * one element allowed two lines.
 */

/**
 * ── THE APP ICON IS A SQUIRCLE, AND IT IS CLIPPED RATHER THAN REDRAWN ───────────────
 *
 * On macOS an application icon is a **superellipse**, not a rounded rect, and at the size beat 8
 * magnifies this to the difference is not subtle — a circular corner beside the real thing is one
 * of the clearest tells that a piece of chrome was drawn.
 *
 * `<MailMark/>` cannot be changed to do this. It is **a shared contract with beat 2**: the tab
 * strip, the mail client's sidebar, the message header and this toast all render the one
 * definition (`shell.tsx:112`), and the entire disambiguation depends on the audience recognising
 * the same mark ~25 seconds later. Forking it, or giving it a shape prop that only one of five
 * call sites uses, would put the drift back that the single definition exists to prevent.
 *
 * So the toast's instance is **wrapped and clipped**, not re-drawn. The mark's hue and glyph are
 * untouched and byte-identical to beat 2's; only the silhouette this one call site presents them
 * in changes, which is exactly what a real OS does — the same artwork, masked into the platform's
 * icon shape. The scoped stylesheet that flattens the mark's own `borderRadius` is the same
 * mechanism `motion.tsx` uses three times over to reach into a component it must not fork
 * (`BreathPacer`, `CheckDraw`, `IntroPrivacyEmphasis`); `!important` is required only because the
 * radius it overrides is an inline style, which no stylesheet rule outranks otherwise.
 *
 * `n = 5` is the exponent the Apple icon shape sits closest to. Sampled as a polygon rather than
 * fitted with Béziers because the error is what matters and it is nil: 128 segments on a 19px
 * radius leaves a sagitta of 0.006px, which survives the 4.2× magnification with three orders of
 * magnitude to spare.
 */
const squirclePath = (size: number, n = 5, steps = 128): string => {
  const r = size / 2;
  const d: string[] = [];
  for (let i = 0; i < steps; i += 1) {
    const t = (i / steps) * Math.PI * 2;
    const c = Math.cos(t);
    const s = Math.sin(t);
    const x = r + r * Math.sign(c) * Math.abs(c) ** (2 / n);
    const y = r + r * Math.sign(s) * Math.abs(s) ** (2 / n);
    d.push(`${i === 0 ? "M" : "L"}${x.toFixed(2)} ${y.toFixed(2)}`);
  }
  return `path("${d.join(" ")} Z")`;
};

/** The app icon's edge. A macOS banner icon is ~36–38pt against a ~76pt panel; this is 38/104. */
const ICON_PX = 38;
const ICON_CLIP = squirclePath(ICON_PX);

/**
 * ── THE PANEL'S CORNER, WHICH IS GENEROUS BY THE STANDARD OF ITS HEIGHT ─────────────
 *
 * 18 against a 104-tall panel — a ratio of 0.17, which is where a modern macOS banner sits and is
 * noticeably rounder than the 14 the flat pass used. A notification is a small floating capsule
 * rather than a card, and the corner is most of what says so; at 14 it read as a dialog.
 *
 * It is a paint value only. **The `TOAST` rect in `geometry.ts:228` is untouched** — beat 8's
 * three framings are all derived from it (`framing.ts` BEAT8_CLOCK / BEAT8_FACE / BEAT8_WIDE), so
 * moving it by a pixel restages the beat.
 */
const PANEL_RADIUS = 18;

/**
 * ── THE LAYOUT, AND THE HEIGHT IT HAS TO LIVE INSIDE ────────────────────────────────
 *
 * 320×104, fixed (`geometry.ts:220-228`). Everything below is measured against the 104:
 *
 *   12  padding-top
 *   15  the app row      — 12px × 1.25
 *    2  margin
 *   18  the sender       — 14px × 1.3
 *    2  margin
 *   36  the subject      — 14px × 1.28, TWO lines
 *   12  padding-bottom
 *   ──
 *   97  against 104 — 7px of slack, split evenly by `alignItems: center`
 *
 * The text column is what is left after the icon: 320 − 14 − 14 − 38 − 12 = **242px**.
 *
 * ── THE SUBJECT TAKES TWO LINES, AND THAT IS THE MEASURED FACT, NOT A FALLBACK ──────
 *
 * "Deadline moved up — need the report by 12" measures **289.95px** at 14px Inter 400 (measured in
 * Chromium against the loaded face, not estimated). It does not fit on one 242px line and it never
 * did — `geometry.ts:221` is explicit that this is why the panel is 104 tall rather than the
 * greybox's 82. It breaks cleanly and almost evenly: "Deadline moved up —" at 145.4 and "need the
 * report by 12" at 140.6, both comfortably inside 242.
 *
 * **Two lines is also what a real banner does**, so nothing is being tolerated here: macOS clamps
 * the body of a notification at two lines and ellipsises the rest, which is precisely the
 * `-webkit-line-clamp: 2` below. The clamp is protection against a future copy edit, not against
 * this copy — at 242px the current string uses both lines with room and is not truncated.
 *
 * Shrinking the subject to force one line was considered and rejected: 13px still measures 269px,
 * so it would not fit either, and it would push the film's single most important line under the
 * size the beat's own framing arithmetic was built on.
 */
export const MailToast: React.FC<{ startFrame: number }> = ({ startFrame }) => {
  const { x, opacity } = useToastIn(startFrame);

  return (
    <div
      style={{
        position: "absolute",
        left: BOX.x,
        top: BOX.y,
        width: BOX.w,
        height: BOX.h,
        translate: `${x}px 0`,
        opacity,
        zIndex: 40,
        borderRadius: PANEL_RADIUS,
        // The material. A two-stop vertical gradient, not a fill — see the note at the top of the
        // file. `backgroundColor` stays as the base so the panel is never transparent for a frame
        // if the gradient fails to parse on some renderer.
        backgroundColor: T.panel,
        backgroundImage: `linear-gradient(180deg, ${T.panelTop} 0%, ${T.panel} 100%)`,
        // The catch-light. One hairline on the top and left only — a full border reads as a
        // drawn box, an edge on the light side reads as a material.
        boxShadow: `inset 1px 1px 0 ${T.edge}, 0 10px 28px ${T.shadow}`,
        fontFamily: OS_FONT,
        boxSizing: "border-box",
        padding: "12px 14px",
        display: "flex",
        alignItems: "center",
        gap: 12,
      }}
    >
      <style>{`[data-toast-icon] > div { border-radius: 0 !important; }`}</style>
      <span
        data-toast-icon=""
        style={{
          display: "block",
          width: ICON_PX,
          height: ICON_PX,
          flexShrink: 0,
          clipPath: ICON_CLIP,
        }}
      >
        <MailMark size={ICON_PX} />
      </span>

      <div style={{ minWidth: 0, flex: 1 }}>
        {/*
         * ── THE APP NAME ROW STAYS, AND IT IS NOT NOSTALGIA ──
         *
         * Modern macOS banners usually drop the app name and let the icon carry the attribution.
         * **This one keeps it**, because in this film the icon is not merely attribution — it is
         * the single control that stops beat 8 reading as *Serenify* notifying him, and the word
         * "Mail" is a second, unambiguous, language-level statement of the same thing for anyone
         * who does not parse a 38px envelope at phone size. Two cheap signals of the one fact the
         * beat cannot afford to get wrong is the right trade; a strictly current banner is not.
         */}
        <div
          style={{
            fontSize: 12,
            lineHeight: 1.25,
            color: T.meta,
            letterSpacing: 0.2,
            display: "flex",
            justifyContent: "space-between",
            alignItems: "baseline",
            gap: 8,
          }}
        >
          <span style={{ fontWeight: 600 }}>{COPY.app}</span>
          {/*
           * The relative time. Tabular figures even though today's copy is the word "now": this
           * is the timestamp slot, and the moment it becomes "2m" or "11:30" a proportional
           * numeral would reflow the row against the "Mail" label opposite it. Same reasoning as
           * the toolbar clock's — `furniture.ts` § OS_TABULAR.
           */}
          <span
            style={{ fontWeight: 500, fontFeatureSettings: OS_TABULAR, flexShrink: 0 }}
          >
            {COPY.when}
          </span>
        </div>

        {/* The sender — semibold, and the panel's brightest text. `nowrap` + ellipsis is
            protection only: "Ahmed Hassan" measures 103.6px against a 242px column. */}
        <div
          style={{
            fontSize: 14,
            lineHeight: 1.3,
            fontWeight: 600,
            color: T.title,
            marginTop: 2,
            letterSpacing: 0.1,
            whiteSpace: "nowrap",
            overflow: "hidden",
            textOverflow: "ellipsis",
          }}
        >
          {COPY.sender}
        </div>

        {/*
         * The subject — the line beat 8 exists to make readable, at 14px, over two lines, clamped
         * the way a real banner clamps its body.
         *
         * `OS_TABULAR` is on it for a reason specific to this beat: the "12" in this line and the
         * "11:30" in the toolbar clock are the two numbers the audience subtracts, they are on
         * screen together in BEAT8_CLOCK, and the clock is already set in tabular figures
         * (`shell.tsx:277`). Drawing them from the same numeral set is what makes them read as
         * two readings of one clock rather than as two bits of unrelated type.
         */}
        <div
          style={{
            fontSize: 14,
            lineHeight: 1.28,
            color: T.body,
            marginTop: 2,
            fontFeatureSettings: OS_TABULAR,
            display: "-webkit-box",
            WebkitBoxOrient: "vertical",
            WebkitLineClamp: 2,
            overflow: "hidden",
          }}
        >
          {COPY.subject}
        </div>
      </div>
    </div>
  );
};
