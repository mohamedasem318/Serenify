import React from "react";
import { AbsoluteFill, Easing, interpolate, useCurrentFrame } from "remotion";

import { Wordmark } from "@/components/brand/wordmark";

import { CARD, CARD_DISPLAY, CARD_LINE } from "../../app/furniture";
import { useDarkRoot } from "../../app/shell";
import { Camera, shot } from "../Camera";
import { END_CARD } from "../copy";
import { H, W } from "../theme";

/*
 * Hallmark · component: end-card · genre: editorial · theme: film-furniture (locked)
 * states: n/a — a non-interactive film frame
 * contrast: pass — CARD.ink #e8ebee and CARD.muted #a6acb2 on CARD.field #0b0c0e ≈ 17:1 / 9:1
 * faces: 2 — Outfit (mark + .tech) · Nunito (the line). Inter no longer appears on this card.
 * pre-emit critique: P5 H5 E5 S5 R5 V4
 */

/**
 * Beat 13 · End card · 1:16.5 – 1:21.0 · 136 frames
 *
 * **A sequence, not a static frame.** Three timed events:
 *
 *   1. the wordmark reveals             f0–36
 *   2. "take care of yourself" appears  f44–62
 *   3. the wordmark DUPLICATES and the copy travels down to the domain line f72–94,
 *      then `.tech` types onto the end of it f96–108
 *
 * ══ THE WORDMARK IS THE WORDMARK NOW ════════════════════════════════════════════════
 *
 * It was a grey rectangle labelled "wordmark reveal", and that is the one placeholder in this
 * film that could not be allowed to ship: **`components/brand/wordmark.tsx` is the single
 * definition of the mark inside the React tree, and re-typing its markup at a new site is a
 * constitutional violation** (Principle V, Amendment 17). A drawn box is not a violation, but it
 * is worse in the way that matters here — the last frame of a launch film is the one frame that
 * is *about* the brand, and it was showing a placeholder.
 *
 * So the mark is `<Wordmark/>`, with its two-colour `seren` / `ify` split coming from
 * `--color-ink` and `--color-meadow-text` rather than from anything restated here. Three
 * consequences, all of them the point:
 *
 *  · The reveal is a **clip**, not a fill. A left-to-right `inset()` wipe uncovers the real
 *    glyphs, so what is revealed is the mark itself rather than a rectangle standing in for it.
 *  · **The two-colour split can finally be judged at domain size** — the open question the sheet
 *    records against `DERIVE`. The derived copy is the same component at 22px, so the answer is
 *    now visible in the render instead of deferred to "when the real wordmark lands".
 *  · The duplicate that travels is a **second `<Wordmark/>`**, not a box that stands for one. It
 *    can shrink and move because it is type, and type scales.
 *
 * ── WHY THE TYPEWRITER IS USED ONCE, AND ON A URL ───────────────────────────────────
 *
 * All three elements used to type on, which made typing the card's house style rather than a
 * gesture. It is now the opposite: the only thing that types is a **domain**, and beat 1 opens
 * the film by typing a domain into an omnibox. The film is bookended by the same action, and the
 * typewriter comes to mean *the things a person types* rather than "here is some text".
 *
 * That is also why **"take care of yourself" no longer types.** It is the sentimental line and
 * it should not be competing with a mechanical effect, so it fades up with a short rise. It is
 * also not Outfit and not bold — it is subordinate to the mark above it by design, and setting
 * it in the display face at 700 made it argue with the wordmark for the frame. A wipe was the
 * alternative reveal and was rejected for being the same *kind* of effect: the point is to
 * isolate the typewriter.
 *
 * ── AND IT IS NUNITO NOW, NOT INTER ─────────────────────────────────────────────────
 *
 * Picked off `endcard-compare.png` against Fraunces and Instrument Serif: the *curvier* answer
 * rather than the warmer-serif one. It replaces Inter here rather than joining it, so the card
 * is two faces — Outfit for the mark and the domain, Nunito for the line — and the one place in
 * the film where the product stops talking and a person does is the one place with a rounded
 * face on it. Size, weight, colour and leading are untouched; only the family moves, and the
 * wordmark and `.tech` are byte-identical to what they were. See `furniture.ts` § CARD_LINE.
 *
 * **The card sits on `CARD.field`**, three points below the app's own page, which is the whole
 * of how the film says "we have stepped outside the product" — no transition, no rule, no label.
 * Both closing cards were drawing on the app's background instead, so the signal was designed
 * and never spent.
 *
 * **Permission to fall back is one flag.** `DERIVE = false` reverts to typing `serenify.tech`
 * whole, which is exactly the previous treatment. Two things to watch: whether the travel reads
 * as *derivation* or as a stray word moving, and whether the seren/ify split survives at domain
 * size — the second is now judgeable.
 */

/** Set false to fall back to typing `serenify.tech` whole. See the header. */
const DERIVE = true;

/**
 * ── THE REVEAL IS DOUBLED, AND EVERYTHING KEEPS ITS SPACING ─────────────────────────
 *
 * The wipe ran 30 frames — exactly one second — and was taken to 36 (1.20s) last pass. That was
 * **"a touch", and the note is that it needs considerably more than a touch**: this is the last
 * image in the film and it should be able to be watched arriving, not merely registered.
 *
 * It is **72 frames (2.40s)** — double the last value, 2.4× the original. Nothing about the move
 * changes: the same left-to-right `inset()`, the same `inOut(cubic)`. What changes is that the
 * mark now takes as long to unveil as a held shot elsewhere in the film takes to read, which is
 * the pace an end card is entitled to. The settle is stretched with it (see `settle` below) so
 * the arrival itself has room rather than snapping shut at the end of a long wipe.
 *
 * The other three events shift by the same **+42** so every gap between them is unchanged — the
 * line still lands two frames after the mark has settled, the duplicate still detaches ten
 * frames after the line has arrived, the domain still types at ~12 c/s. Only the wipe is slower;
 * the sequence after it plays at exactly the rhythm that was signed off.
 *
 *   wipe            f0 – f72
 *   line            f80 – f98
 *   the duplicate   f108 – f130
 *   `.tech` types   f132 – f144, caret out at f154
 *   held card       f154 – f172        ← the same 18 frames the last pass left
 *
 * **The beat grows 136 → 172 (+36) and the film with it.** It is the last beat, so nothing is
 * pushed and no hold anywhere else is spent: `GREYBOX_DURATION` carries the +36.
 */
const SHIFT = 42;
const REVEAL_FROM = 0;
const REVEAL_TO = 30 + SHIFT;
const LINE_FROM = 38 + SHIFT;
const LINE_TO = 56 + SHIFT;
/** The duplicate detaches, shrinks and travels to the domain line. */
const DUP_FROM = 66 + SHIFT;
const DUP_TO = 88 + SHIFT;
/** ~12 c/s for five characters. Slower than a word would be typed, which reads deliberate. */
const TECH_FROM = 90 + SHIFT;
const TECH_TO = 102 + SHIFT;
/** The whole-domain fallback, at the treatment this beat used to have. */
const DOMAIN_FROM = 78 + SHIFT;
const DOMAIN_TO = 102 + SHIFT;

/**
 * The mark's own box. 72px of Outfit at `text-7xl`, centred — measured rather than guessed so the
 * duplicate's travel lands where the domain row actually is.
 */
const MARK = { size: 72, y: 218 } as const;
/** The derived copy's size on the domain row. Small enough to read as a URL, large enough that
 *  the seren/ify split is judgeable — which is the open question this move exists to answer. */
const DERIVED = { size: 22 } as const;
const TECH = ".tech";
const ROW_Y = 384;

/** Reveals a string left-to-right, one character at a time. */
const typeOn = (value: string, frame: number, from: number, to: number) =>
  value.slice(
    0,
    Math.round(
      interpolate(frame, [from, to], [0, value.length], {
        extrapolateLeft: "clamp",
        extrapolateRight: "clamp",
      }),
    ),
  );

export const Beat13EndCard: React.FC = () => {
  const frame = useCurrentFrame();
  // This beat renders no `Desktop`, so nothing else puts `.dark` on the document element — and
  // `<Wordmark/>`'s `text-ink` then resolves to the LIGHT #1C2023 on a near-black card. The mark
  // was present, correct, and invisible.
  useDarkRoot();

  const wipe = interpolate(frame, [REVEAL_FROM, REVEAL_TO], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: Easing.inOut(Easing.cubic),
  });
  // Stretched with the wipe — 14 frames of settle at the end of a 36-frame reveal read as part of
  // the same arrival; at the end of a 72-frame one they read as a flinch. 26 frames, overlapping
  // the wipe's last sixteen and finishing ten after it, keeps the proportion the move had.
  const settle = interpolate(frame, [REVEAL_TO - 16, REVEAL_TO + 10], [1.04, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: Easing.out(Easing.cubic),
  });

  /** 2 · it appears rather than types. Fade plus a short rise, and nothing else. */
  const lineIn = interpolate(frame, [LINE_FROM, LINE_TO], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: Easing.out(Easing.cubic),
  });

  /** 3 · the duplicate's travel, as one eased parameter driving size and position together. */
  const travel = interpolate(frame, [DUP_FROM, DUP_TO], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: Easing.inOut(Easing.cubic),
  });
  const dupSize = MARK.size + (DERIVED.size - MARK.size) * travel;
  const dupY = MARK.y + (ROW_Y - MARK.y) * travel;

  const tech = typeOn(TECH, frame, TECH_FROM, TECH_TO);
  const techCaret = frame >= TECH_FROM && frame < TECH_TO + 10;

  const domain = typeOn(END_CARD.domain, frame, DOMAIN_FROM, DOMAIN_TO);
  const domainCaret = frame >= DOMAIN_FROM && frame < DOMAIN_TO + 10;

  return (
    <AbsoluteFill>
      <Camera keys={[{ frame: 0, shot: shot(W / 2, 312, 760) }]}>
        <div
          style={{ position: "absolute", inset: 0, width: W, height: H, backgroundColor: CARD.field }}
        />

        {/*
         * 1 · the wordmark reveal.
         *
         * A left-to-right `inset()` clip, not a fill: the wipe uncovers the REAL glyphs, so what
         * arrives is the mark rather than a rectangle that stands for it. The settle is a 4%
         * scale rather than the old 5% — at 72px of Outfit a 5% overshoot is 3.6px of travel on
         * a letterform, which reads as a wobble rather than as weight arriving.
         */}
        <div
          style={{
            position: "absolute",
            left: 0,
            top: MARK.y,
            width: W,
            textAlign: "center",
            scale: settle,
            transformOrigin: "50% 50%",
            clipPath: `inset(0 ${(1 - wipe) * 100}% 0 0)`,
          }}
        >
          <Wordmark className="text-7xl leading-none" />
        </div>

        {/*
         * 3a · the duplicate, drawn BEFORE the line so it passes **behind** it.
         *
         * The travel from the wordmark to the domain row is almost vertical and the line sits
         * across the middle of it; in front and fully opaque it blanked half of "take care of
         * yourself" for most of the move. Behind the text and dipped to under half opacity in
         * transit, the line stays readable and the mark reads as settling rather than as
         * something barrelling past.
         */}
        {DERIVE && frame >= DUP_FROM ? (
          <div
            style={{
              position: "absolute",
              left: 0,
              top: dupY,
              width: W,
              textAlign: "center",
              fontSize: dupSize,
              lineHeight: 1,
              opacity: interpolate(travel, [0, 0.18, 0.82, 1], [1, 0.45, 0.45, 1]),
            }}
          >
            {/*
             * ── THE SUFFIX IS IN THE SAME ROW, NOT BESIDE IT ──
             *
             * `.tech` was drawn as its own absolutely-positioned block at a guessed offset from
             * centre, so it landed ON TOP of the derived mark rather than after it — the two
             * were centred independently and both wanted the middle of the frame. They are one
             * inline row now, centred as a unit, so the suffix cannot help but sit where the
             * mark ends however wide the mark measures.
             *
             * The row re-centres as the five characters land, which drifts the mark ~15px left
             * over 0.4s. That is not a defect to design out: it is what makes the domain read as
             * being ASSEMBLED out of the brand rather than as two things that happened to line
             * up, which is the entire claim the move exists to make.
             */}
            {/*
             * ── `.tech` IS IN THE BRAND FACE (§6.2) ──
             *
             * It was Geist Mono, which broke the one claim the whole move exists to make: the
             * domain **derives from the wordmark**, and a domain that switches typeface halfway
             * through has not derived from anything — it has had a suffix stuck onto it. The
             * mark is Outfit, so the suffix is Outfit, and `serenify.tech` reads as one word set
             * once.
             *
             * It also loses the two-point size drop. That existed to compensate for Geist Mono's
             * larger apparent size beside Outfit; with both in Outfit there is nothing to
             * compensate for, and `inherit` is what makes the row genuinely one line of type
             * rather than two sizes that happen to sit together. The colour stays `CARD.domain`
             * — a shade under the mark's ink, so the suffix is subordinate to the brand without
             * being a different material.
             */}
            <span style={{ display: "inline-flex", alignItems: "baseline" }}>
              <Wordmark className="leading-none" />
              <span
                style={{
                  fontFamily: CARD_DISPLAY,
                  fontSize: "inherit",
                  fontWeight: 600,
                  letterSpacing: "-0.01em",
                  color: CARD.domain,
                  lineHeight: 1,
                }}
              >
                {DERIVE ? tech : domain}
                {(DERIVE ? techCaret : domainCaret) ? (
                  <span style={{ color: CARD.muted }}>|</span>
                ) : null}
              </span>
            </span>
          </div>
        ) : null}

        {/* 2 · then this appears. No typing, no wipe — see the header. */}
        <div
          style={{
            position: "absolute",
            left: 220,
            top: 322,
            width: 760,
            textAlign: "center",
            fontFamily: CARD_LINE,
            fontSize: 26,
            fontWeight: 400,
            lineHeight: 1.4,
            color: CARD.muted,
            opacity: lineIn,
            translate: `0px ${(1 - lineIn) * 8}px`,
          }}
        >
          {END_CARD.line}
        </div>

        {/* 3b · the whole-domain fallback, for when `DERIVE` is off. With `DERIVE` on, the
            suffix is part of the derived row above so it cannot land anywhere but after it. */}
        {DERIVE ? null : (
          <div
            style={{
              position: "absolute",
              left: 0,
              top: ROW_Y + 1,
              width: W,
              textAlign: "center",
              // The fallback path takes the brand face too — see §6.2 above. A `DERIVE = false`
              // revert must not quietly reintroduce the mono.
              fontFamily: CARD_DISPLAY,
              fontSize: DERIVED.size,
              fontWeight: 600,
              letterSpacing: "-0.01em",
              color: CARD.domain,
            }}
          >
            {domain}
            {domainCaret ? <span style={{ color: CARD.muted }}>|</span> : null}
          </div>
        )}
      </Camera>
    </AbsoluteFill>
  );
};
