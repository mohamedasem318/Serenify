import React from "react";

import { SLEEVE } from "./furniture";

/*
 * Hallmark · component: album-sleeve · genre: atmospheric · theme: film-furniture (locked)
 * states: n/a — a non-interactive film asset
 * contrast: n/a — it is a picture, not a surface carrying text
 * pre-emit critique: P5 H4 E5 S5 R5 V4
 */

/**
 * ══ THE ALBUM ART — ORIGINAL, AND THAT IS A REQUIREMENT ═════════════════════════════
 *
 * **No real sleeve is reproduced, approximated, redrawn, recoloured or referenced.** The
 * reasoning is worth keeping next to the code rather than only in the beat sheet, because the
 * temptation to "just make it look a bit like the real one" is exactly what the rule exists to
 * stop:
 *
 *  · The film is **promotional**, not educational or critical — which is the fair-use factor that
 *    cuts hardest, and it cuts against us.
 *  · The sleeve is a **separate copyrighted work** from the recording. Not playing the song does
 *    nothing for it; the two rights are unrelated.
 *  · The specific sleeve is a **photograph of a person**, so likeness rights sit on top of the
 *    copyright and a second rightsholder exists.
 *
 * Original art costs nothing, matches the palette, and cannot get a launch post flagged. The
 * track title and the artist's name stay on screen (liberty L2b) and are load-bearing — they are
 * the evidence Ren knew his taste — but naming a track with no audio and no lyrics is a different
 * exposure from drawing its cover, and only the second is being avoided.
 *
 * ── WHAT IT HAS TO SURVIVE ──────────────────────────────────────────────────────────
 *
 * It is on screen for about two seconds, at 160px in a 600px window, inside a shot that is
 * itself ~648 world px wide — so on a phone the sleeve is roughly **62px square**. Anything with
 * fine detail becomes noise at that size, and anything with a focal point smaller than a few
 * percent of the square disappears entirely. So it is built from four elements only, each of
 * which reads as a silhouette:
 *
 *   a vertical field        the ground, and the thing that carries the palette
 *   one offset disc         the focal object — high enough contrast to survive 62px
 *   a soft halo behind it   what stops the disc reading as a sticker
 *   three horizon bands     the only "detail", at a scale that still reads as three marks
 *
 * ── AND IT DOES NOT WEAR A BAND COLOUR ──────────────────────────────────────────────
 *
 * Meadow and amber carry stress readings in this product and foggy is Serenify's own attention
 * colour, so a cover in any of the three would look like it was asserting something — and this
 * one sits about 200px from a bloom that genuinely is asserting something. The palette is the
 * furniture's cool quadrant (`SLEEVE` in `furniture.ts`), the same family the mail mark was
 * resolved into by the same elimination.
 *
 * The disc is the one warm value on it, and it is a bone/clay rather than a gold — far enough
 * from amber that the two never read as the same colour even when the bloom is amber.
 */
export const AlbumArt: React.FC<{ size: number; radius?: number }> = ({ size, radius = 6 }) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 100 100"
    aria-hidden
    style={{ display: "block", borderRadius: radius }}
  >
    <defs>
      {/* The field. Two stops only — a third would be invisible at 62px and would just cost a
          gradient interpolation per frame. */}
      <linearGradient id="sleeve-field" x1="0" y1="0" x2="0.35" y2="1">
        <stop offset="0%" stopColor={SLEEVE.skyTop} />
        <stop offset="100%" stopColor={SLEEVE.skyBottom} />
      </linearGradient>

      {/* The halo, as a radial fading to fully transparent. This is what keeps the disc sitting
          IN the field rather than on top of it — without it the disc reads as a pasted circle,
          which is the single most common way an abstract cover looks unfinished. */}
      <radialGradient id="sleeve-halo" cx="0.5" cy="0.5" r="0.5">
        <stop offset="0%" stopColor={SLEEVE.halo} stopOpacity={0.55} />
        <stop offset="55%" stopColor={SLEEVE.halo} stopOpacity={0.16} />
        <stop offset="100%" stopColor={SLEEVE.halo} stopOpacity={0} />
      </radialGradient>

      {/* The bands are clipped to the square so their ends are cut by the sleeve edge rather than
          tapering inside it — a band that stops short reads as a scratch, a band that runs off
          the edge reads as a horizon. */}
      <clipPath id="sleeve-clip">
        <rect x="0" y="0" width="100" height="100" />
      </clipPath>
    </defs>

    <g clipPath="url(#sleeve-clip)">
      <rect x="0" y="0" width="100" height="100" fill="url(#sleeve-field)" />

      {/* Offset above and left of centre. Dead-centre reads as a target rather than as a
          composition, and the offset is what leaves room for the bands below it. */}
      <circle cx="42" cy="38" r="34" fill="url(#sleeve-halo)" />
      <circle cx="42" cy="38" r="15.5" fill={SLEEVE.disc} />

      {/* Three marks, descending in length and opacity, running off the right edge. They are the
          only thing on the sleeve that could be called detail, and at 62px they resolve to three
          strokes — which is the intended reading at every size. */}
      <g fill={SLEEVE.band}>
        <rect x="16" y="70" width="84" height="2.4" opacity={0.85} />
        <rect x="30" y="79" width="70" height="2.4" opacity={0.55} />
        <rect x="47" y="88" width="53" height="2.4" opacity={0.3} />
      </g>

      {/* A hairline inset, so the sleeve has an edge of its own against the player's panel. Real
          cover art is a printed object sitting on a surface; without an edge it reads as a hole
          cut in the window. */}
      <rect
        x="0.5"
        y="0.5"
        width="99"
        height="99"
        fill="none"
        stroke="rgba(255,255,255,0.09)"
        strokeWidth="1"
      />
    </g>
  </svg>
);
