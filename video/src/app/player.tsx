import React from "react";

import { PLAYER } from "../greybox/copy";
import { AlbumArt } from "./albumart";
import { OS_FONT, OS_TABULAR, PLAYERUI, STANDIN } from "./furniture";

/*
 * Hallmark · component: music-player · genre: atmospheric · theme: film-furniture (locked)
 * states: rest · hover · pressed (the transport, driven by `hover` / the pointer's own ring)
 * contrast: pass — ink #dfe3e7 on window #1a1e21 ≈ 12.9:1, body #a8aeb4 ≈ 6.4:1,
 *   onPrimary #14181b on primary #e4e8ec ≈ 15.1:1
 * deviation declared: Hallmark gate 47 (re-drawn chrome) overridden — the film's diegetic set.
 * pre-emit critique: P5 H5 E5 S4 R5 V4
 */

/**
 * ══ THE MUSIC PLAYER — A DRAWN APPLICATION, NOT A STAND-IN ══════════════════════════
 *
 * Beat 11. Deferred-register item 7 kept it a stand-in through the component pass, and what it
 * was is worth stating plainly because it is what this replaces: a play button flanked by two
 * empty circles, a labelled block where the artwork goes, and a bar with no times on it. Three
 * circles in a row where two of them are blank does not read as a transport — it reads as a
 * transport that has not been drawn yet, which is exactly what it was.
 *
 * **It is generic, and that is decided (liberty L2b).** Not Spotify, not Apple Music, not a clone
 * of either — a desktop player window of the kind that has existed continuously since Winamp.
 * Cloning a specific branded interface would carry a trade-dress problem the story gains nothing
 * from. The goal is that it reads as **competent music software**, not as any particular app.
 *
 * ── WHAT MAKES A TRANSPORT READ AS A TRANSPORT ──────────────────────────────────────
 *
 * Three things, and the stand-in had none of them:
 *
 *  1. **Real glyphs.** Previous and next are the double-triangle-and-bar every player has drawn
 *     for forty years; play/pause is the triangle and the two bars. They are SVG paths rather
 *     than text glyphs — the stand-in used `▶` and `❚❚`, which are *characters*, so their weight
 *     and metrics came from whatever face was resolving and neither one is centred in its own
 *     em box. That is why the old play button's glyph sat visibly low.
 *  2. **A hierarchy.** Play/pause is filled and larger; previous and next are quiet and smaller.
 *     Three identical circles say "three equal things"; a real transport has one primary.
 *  3. **A scrubber with numbers on both ends.** A bar with no times is a progress indicator; a
 *     bar with elapsed on the left and total on the right is a *position* in a piece of music,
 *     which is the thing that makes the window read as playing something.
 *
 * ── THE TIMES ARE REAL, AND THE TRACK LENGTH IS THE REAL ONE ────────────────────────
 *
 * 4:54. That is the released length of the track named on screen, and using it costs nothing —
 * a made-up duration on a named song is the kind of small wrongness that is invisible to almost
 * everyone and jarring to anyone who knows. Naming the track is decided and load-bearing (L2b);
 * it is the evidence Ren knew his taste. **The artwork is the thing that must not be reproduced**
 * — see `albumart.tsx` for why that line is drawn where it is.
 *
 * ── AND IT SITS ABOVE EVERYTHING, WHICH WAS A REAL BUG ──────────────────────────────
 *
 * Retained from the stand-in and still true: the window was layered between the page and the
 * viewfinder, so a window he had just opened had a webcam feed punched through its corner.
 * Nothing in an operating system behaves that way, so it read as a rendering fault rather than as
 * depth. `z-index: 80` clears the viewfinder's `z-10` and the app header's `z-50`, and sits below
 * the pointer's 90 — a cursor is above every window.
 */

/** The window. Beats frame this and aim the pointer into it, so the geometry is exported. */
export const PLAYER_WIN = { x: 300, y: 220, w: 600, h: 280 } as const;

/** The transport row's controls, in world coordinates. `PLAY` is what beat 11 clicks. */
export const TRANSPORT = {
  prev: { x: PLAYER_WIN.x + 216, y: PLAYER_WIN.y + 190, d: 34 },
  play: { x: PLAYER_WIN.x + 264, y: PLAYER_WIN.y + 182, d: 50 },
  next: { x: PLAYER_WIN.x + 330, y: PLAYER_WIN.y + 190, d: 34 },
} as const;

/** The centre of the play button — where the cursor lands and the click rings. */
export const PLAY_CENTRE = {
  x: TRANSPORT.play.x + TRANSPORT.play.d / 2,
  y: TRANSPORT.play.y + TRANSPORT.play.d / 2,
} as const;

/** Released length of the named track. See the header — a real duration on a real title. */
const TOTAL_SECONDS = 4 * 60 + 54;

const mmss = (s: number) => {
  const safe = Math.max(0, Math.floor(s));
  return `${Math.floor(safe / 60)}:${String(safe % 60).padStart(2, "0")}`;
};

/**
 * The transport glyphs.
 *
 * Drawn on a 24-unit box and centred in it, so a glyph is centred in its button by construction
 * rather than by an offset somebody eyeballed. `skip` is the double triangle plus its bar; the
 * bar is on the trailing side for next and the leading side for previous, which is the only
 * difference between the two and is why one path serves both under a mirror.
 */
const SkipGlyph: React.FC<{ size: number; colour: string; back?: boolean }> = ({
  size,
  colour,
  back,
}) => (
  <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden style={{ display: "block" }}>
    <g fill={colour} transform={back ? "translate(24,0) scale(-1,1)" : undefined}>
      <path d="M4 6.2 L12.4 12 L4 17.8 Z" />
      <path d="M11.6 6.2 L20 12 L11.6 17.8 Z" />
      <rect x="20.4" y="6" width="2.4" height="12" rx="0.6" />
    </g>
  </svg>
);

const PlayGlyph: React.FC<{ size: number; colour: string; paused: boolean }> = ({
  size,
  colour,
  paused,
}) =>
  paused ? (
    <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden style={{ display: "block" }}>
      {/* Optically centred: a triangle's visual centre sits left of its bounding box's, so it is
          nudged right by ~1 unit. Centring the box instead is what makes a play button look
          slightly wrong in a way nobody can name. */}
      <path d="M8.6 5.4 L19 12 L8.6 18.6 Z" fill={colour} />
    </svg>
  ) : (
    <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden style={{ display: "block" }}>
      <g fill={colour}>
        <rect x="7.6" y="5.6" width="3.4" height="12.8" rx="1.1" />
        <rect x="13" y="5.6" width="3.4" height="12.8" rx="1.1" />
      </g>
    </svg>
  );

/** A circular transport button. `hover` is §2's requirement, applied to an authored control. */
const TransportButton: React.FC<{
  box: { x: number; y: number; d: number };
  filled?: boolean;
  hover?: number;
  children: React.ReactNode;
}> = ({ box, filled, hover = 0, children }) => (
  <div
    style={{
      position: "absolute",
      left: box.x,
      top: box.y,
      width: box.d,
      height: box.d,
      borderRadius: box.d / 2,
      backgroundColor: filled ? PLAYERUI.primary : PLAYERUI.control,
      display: "grid",
      placeItems: "center",
      // Authored surface, so there is no shipped hover to reproduce — this is the same idiom the
      // app uses on every filled control (`hover:opacity-90`, `button.tsx`), which keeps the two
      // kinds of software on screen behaving alike without the furniture borrowing a token.
      opacity: 1 - 0.1 * hover,
      boxShadow: filled ? "0 2px 8px rgba(0,0,0,0.45)" : undefined,
    }}
  >
    {children}
  </div>
);

export const MusicPlayer: React.FC<{
  /** 0–1 window open/close, driven by the beat. */
  open: number;
  playing: boolean;
  /** 0–1 through the track. */
  progress: number;
  /** 0–1, the pointer arriving on the play button before it presses it (§2). */
  playHover?: number;
}> = ({ open, playing, progress, playHover = 0 }) => {
  const elapsed = TOTAL_SECONDS * progress;
  const barX = PLAYER_WIN.x + 216;
  const barY = PLAYER_WIN.y + 150;
  const barW = 352;

  return (
    <div
      style={{
        opacity: open,
        scale: 0.94 + open * 0.06,
        transformOrigin: "50% 50%",
        fontFamily: OS_FONT,
        position: "relative",
        // See the header — a foreground window occludes the browser and everything in it.
        zIndex: 80,
      }}
    >
      {/* The window. A real drop shadow rather than a border is what says "floating above the
          browser" — a 1px outline at this size reads as a panel drawn on the page. */}
      <div
        style={{
          position: "absolute",
          left: PLAYER_WIN.x,
          top: PLAYER_WIN.y,
          width: PLAYER_WIN.w,
          height: PLAYER_WIN.h,
          borderRadius: 12,
          backgroundColor: PLAYERUI.window,
          boxShadow: `inset 0 1px 0 ${PLAYERUI.edge}, 0 22px 60px rgba(0,0,0,0.6)`,
          overflow: "hidden",
        }}
      >
        {/* Title bar, with the traffic lights every macOS window has. They are the cheapest
            possible signal that this is a WINDOW and not a panel inside the page — which is the
            distinction the beat needs, since he "opens a music player". Colourless: red, amber
            and green all mean something in this product, and a window control wearing one would
            be the only place in the film a band colour appeared without meaning it. */}
        <div
          style={{
            position: "absolute",
            inset: "0 0 auto 0",
            height: 34,
            backgroundColor: PLAYERUI.titlebar,
            display: "flex",
            alignItems: "center",
            paddingLeft: 13,
            gap: 7,
          }}
        >
          {[0, 1, 2].map((i) => (
            <div
              key={i}
              style={{
                width: 10,
                height: 10,
                borderRadius: 5,
                backgroundColor: STANDIN.line,
                opacity: 0.8,
              }}
            />
          ))}
          <div
            style={{
              flex: 1,
              textAlign: "center",
              paddingRight: 51,
              fontSize: 12,
              fontWeight: 600,
              color: STANDIN.label,
            }}
          >
            {PLAYER.app}
          </div>
        </div>
      </div>

      {/* Artwork. Original abstract work — see `albumart.tsx` for why that is not negotiable. */}
      <div style={{ position: "absolute", left: PLAYER_WIN.x + 26, top: PLAYER_WIN.y + 66 }}>
        <AlbumArt size={172} radius={8} />
      </div>

      {/* Title and artist. The naming is the point of the beat — it is the evidence Ren knew
          him — so the title takes the largest type in the window and the artist sits under it. */}
      <div
        style={{
          position: "absolute",
          left: PLAYER_WIN.x + 216,
          top: PLAYER_WIN.y + 68,
          width: 356,
          fontSize: 27,
          fontWeight: 700,
          color: STANDIN.ink,
          lineHeight: 1.15,
          letterSpacing: -0.2,
        }}
      >
        {PLAYER.track}
      </div>
      <div
        style={{
          position: "absolute",
          left: PLAYER_WIN.x + 216,
          top: PLAYER_WIN.y + 104,
          width: 356,
          fontSize: 16,
          color: STANDIN.body,
        }}
      >
        {PLAYER.artist}
      </div>

      {/* The scrubber. */}
      <div
        style={{
          position: "absolute",
          left: barX,
          top: barY,
          width: barW,
          height: 5,
          borderRadius: 3,
          backgroundColor: PLAYERUI.track,
        }}
      />
      <div
        style={{
          position: "absolute",
          left: barX,
          top: barY,
          width: barW * progress,
          height: 5,
          borderRadius: 3,
          backgroundColor: PLAYERUI.elapsed,
        }}
      />
      {/* The handle. A bar with a handle on it is draggable; a bar without one is a readout, and
          this one is supposed to be a control he could scrub. It only exists once playback has
          started, which is also true of the position it marks. */}
      {progress > 0 ? (
        <div
          style={{
            position: "absolute",
            left: barX + barW * progress - 5,
            top: barY - 3,
            width: 11,
            height: 11,
            borderRadius: 6,
            backgroundColor: PLAYERUI.primary,
            boxShadow: "0 1px 4px rgba(0,0,0,0.5)",
          }}
        />
      ) : null}

      {/* Elapsed and total, tabular so the row cannot reflow as the seconds tick. */}
      <div
        style={{
          position: "absolute",
          left: barX,
          top: barY + 12,
          width: barW,
          display: "flex",
          justifyContent: "space-between",
          fontSize: 12,
          color: STANDIN.label,
          fontFeatureSettings: OS_TABULAR,
        }}
      >
        <span>{mmss(elapsed)}</span>
        <span>{mmss(TOTAL_SECONDS)}</span>
      </div>

      {/* The transport. */}
      <TransportButton box={TRANSPORT.prev}>
        <SkipGlyph size={17} colour={STANDIN.ink} back />
      </TransportButton>
      <TransportButton box={TRANSPORT.play} filled hover={playHover}>
        <PlayGlyph size={24} colour={PLAYERUI.onPrimary} paused={!playing} />
      </TransportButton>
      <TransportButton box={TRANSPORT.next}>
        <SkipGlyph size={17} colour={STANDIN.ink} />
      </TransportButton>
    </div>
  );
};
