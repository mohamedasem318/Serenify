import React from "react";
import { AbsoluteFill, Easing, interpolate } from "remotion";
import { useCurrentFrame } from "../../retime";

import { CARD, CARD_DISPLAY } from "../../app/furniture";
import { PHONE_PX } from "../../app/geometry";
import { Camera, shot } from "../Camera";
import { H, W } from "../theme";

/*
 * Hallmark · NOT INVOKED, deliberately. This is a film frame, not a web page: Hallmark forbids
 * re-drawn browser chrome, which beat 1 is built on, and its token and theme systems fight this
 * cut's locked film furniture. The card takes beat 12's and the end card's tokens unchanged.
 * contrast: pass — CARD.ink #e8ebee on CARD.field #0b0c0e ≈ 17:1, CARD.muted #a6acb2 on
 * CARD.field #0b0c0e ≈ 8.9:1
 */

/**
 * Beat R · The roadmap timeline · 240 frames (8s), between beat 11 and beat 12
 *
 * Spec: `docs/video/serenify-pitch-video-beat-sheet.md` §8.
 *
 * ══ THE TWO-COLUMN TEXT GRID IS GONE, AND THIS IS WHAT REPLACED IT ══════════════════
 *
 * The first version of this card was three rows of `Next` / `Then` / `Then` flush left in a
 * two-column grid. It was rejected: a list of three sentences is a *slide*, and a slide eight
 * seconds before beat 12's one claim is the second of a pair whatever its alignment.
 *
 * **A horizontal timeline. Four nodes. A drawn spine, left to right.** A timeline says "these are
 * in an order and you are at the start of it" with its geometry, before a word is read — which is
 * the one thing the card exists to say and the one thing three rows of text could only assert.
 *
 * ── THE STATE IS CARRIED BY THE DRAWING, BECAUSE THE PALETTE HAS NOTHING TO SPARE ───
 *
 * The obvious way to mark "shipped" against "coming" is colour, and **there is no colour
 * available.** Meadow, amber and crimson all carry a band meaning in this product; foggy is Ren's
 * structural colour; there is no red anywhere in this film. Spending any of them here would put a
 * reading on a card that is not about a reading.
 *
 * So the contrast is in the ink and the stroke, and it is absolute rather than a shade:
 *
 *   · **Node 1 is SOLID and its segment of the spine is solid.** It is shipped.
 *   · **Nodes 2–4 are HOLLOW and their spine is broken** — a 6/10 dash at `CARD.muted`.
 *
 * A filled dot on a drawn line against three open rings on a dotted one needs no legend and no
 * word, which is the test this had to pass: the card must not spend a line of copy explaining its
 * own notation.
 *
 * ── AND ANCHORING ON THE SHIPPED MODALITY IS WHAT MAKES THE OTHER THREE CREDIBLE ────
 *
 * `Now · Face` is the first node, and it is the reason the card works. Three future nodes on
 * their own are a wish list; three future nodes hanging off a solid one that the audience has
 * just watched work for three minutes are a direction. It is also the one modality the first
 * version never mentioned.
 *
 * ══ THIS COPY IS AUTHORED ═══════════════════════════════════════════════════════════
 *
 * Every other word in the film is verbatim from `apps/web` or from `lib/landing/copy.ts`. There
 * is no app copy about a roadmap, because a roadmap is not a product surface. This card is the
 * film's SECOND authored element, after the one authored hover treatment on the chat send
 * button. **It must never be back-ported into `apps/web`** and must never be mistaken for
 * `lib/landing/copy.ts` in a later pass.
 *
 * The rows name **signals, not outcomes**: no present-tense verb with Serenify as its subject, no
 * progressive ("we're building…"), no claim of accuracy or improvement. `Now` / `Next` / `Then` /
 * `Then` carries the tense structurally, so no row reads as a shipped capability out of context —
 * and node 1, the one that *is* a shipped capability, is the one marked `Now`.
 *
 * **Row 4 must not depend on the reader counting anything.** An earlier draft said "all three",
 * which is ambiguous the moment row 3 names three signals of its own; it names the modalities.
 *
 * **Row 3's label is `Physiology`, not `Physiological signals`** — measured, not guessed. At this
 * framing the longer label pushes the row to five wrapped lines and its block into the frame's
 * bottom edge. Taken as step (1) of §8's own fallback order: shorten the label before the em-dash
 * first, never shrink the type. The list after the dash is untouched.
 */
const NODES: readonly { tense: string; item: string; shipped?: boolean }[] = [
  { tense: "Now", item: "Face — how strain shows in a face", shipped: true },
  { tense: "Next", item: "Voice — strain in how something is said" },
  { tense: "Then", item: "Physiology — heart rate, breathing, skin conductance" },
  { tense: "Then", item: "Face, voice and body read as one signal" },
];

/**
 * ── THE FRAMING AND THE TYPE ARE ONE DECISION, AND IT IS ARITHMETIC ─────────────────
 *
 * Four columns is what forces the framing wider than beat 12's 760, and the framing is what sets
 * the type size, because the floor is a *phone-equivalent* number: `PHONE_PX(s, w) = s·422/w`, so
 * a wider frame needs bigger type to clear 14px. At **1040** the floor is 34.5px world, and 35px
 * gives **14.20px** — over the floor, and visibly under beat 12's 34px/18.88px, which is the
 * other half of the constraint.
 *
 * The columns then have to be wide enough that no single word overflows one. 35px Outfit runs
 * about 19px a character, so the longest unbroken word in the copy — `conductance`, 11 characters
 * — needs ~212px, and the columns are **235**. That is the check that decides whether a row is
 * allowed to keep its wording (§8's fallback order), and it is why row 3's label shortened.
 *
 * The frame's vertical centre is placed on the CONTENT's — the tense markers' top edge at 200 to
 * the deepest column's last line at 512, so cy 356 — rather than on the world's. Centring on 379
 * left the block visibly top-weighted, which is the same class of correction `COMPOSITE` and
 * `BEAT5_SUCCESS` make by placing their top edges.
 *
 *   frame     x  80 – 1120   y 63.5 – 648.5      1040 × 585
 *   content   x 100 – 1100                       4 × 235 + 3 × 20, 20px clear each side
 *   nodes        x 111, 366, 621, 876            column left + the node's own radius
 */
const FRAME_W = 1040;
const SIZE = 35;
const COL_W = 235;
const COL_GAP = 20;
const COL_X0 = 100;
const NODE_R = 11;
const SPINE_Y = 290;
/** Column i's left edge, and the centre of its node. */
const colX = (i: number) => COL_X0 + i * (COL_W + COL_GAP);
const nodeX = (i: number) => colX(i) + NODE_R;

/** Checked, not asserted — the same discipline as `framing.ts`' table. */
export const BEATR_LEGIBILITY = { row: PHONE_PX(SIZE, FRAME_W) };

/**
 * ── THE REVEAL IS SEQUENTIAL, SO THE TIMELINE IS READ IN ITS OWN DIRECTION ──────────
 *
 * A timeline that arrives whole is a diagram; one that draws itself left to right is a direction
 * of travel, and the direction is the content. Each node's spine segment draws first and the node
 * and its text land on the end of it, which is the order a line is actually drawn in.
 *
 * Node 1 opens the card (there is no segment before it). The last node lands at f126 — 4.2s in,
 * leaving 102 frames settled before the exit, so the whole timeline is on screen and still for
 * more than three seconds. Entry and exit are the interstitials' own gesture, a fade with eight
 * pixels of rise, not the typewriter (reserved for domains) and not the end card's wipe.
 */
const REVEAL: readonly { seg: [number, number] | null; node: number }[] = [
  { seg: null, node: 0 },
  { seg: [24, 42], node: 42 },
  { seg: [60, 78], node: 78 },
  { seg: [96, 114], node: 114 },
];
const FADE = 12;

const ease = (frame: number, from: number, to: number) =>
  interpolate(frame, [from, to], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: Easing.out(Easing.cubic),
  });

export const BeatRRoadmap: React.FC = () => {
  const frame = useCurrentFrame();

  const leave = interpolate(frame, [240 - FADE, 240], [1, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: Easing.inOut(Easing.cubic),
  });

  return (
    <AbsoluteFill>
      <Camera keys={[{ frame: 0, shot: shot(W / 2, 356, FRAME_W) }]}>
        <div
          style={{ position: "absolute", inset: 0, width: W, height: H, backgroundColor: CARD.field }}
        />

        {/* The spine. Three segments, drawn between the nodes rather than as one line, because
            the first is solid and the other two are broken — and because each has to draw on its
            own frames. `x2` is animated rather than a dash offset: a dashed line drawn by a dash
            offset fights its own pattern. */}
        <svg
          width={W}
          height={H}
          style={{ position: "absolute", inset: 0 }}
          aria-hidden
        >
          {REVEAL.map((r, i) => {
            if (!r.seg) return null;
            const x0 = nodeX(i - 1) + NODE_R + 10;
            const x1 = nodeX(i) - NODE_R - 10;
            const t = ease(frame, r.seg[0], r.seg[1]);
            return (
              <line
                key={i}
                x1={x0}
                y1={SPINE_Y}
                x2={x0 + (x1 - x0) * t}
                y2={SPINE_Y}
                // The first segment is node 1's, so it is SOLID: it is the shipped stretch of the
                // line. Everything after it is broken.
                stroke={i === 1 ? CARD.ink : CARD.muted}
                strokeWidth={i === 1 ? 3 : 2}
                strokeDasharray={i === 1 ? undefined : "6 10"}
                strokeLinecap="round"
                opacity={(i === 1 ? 0.85 : 0.5) * leave}
              />
            );
          })}
          {REVEAL.map((r, i) => {
            const t = ease(frame, r.node, r.node + FADE);
            const solid = NODES[i].shipped;
            return (
              <circle
                key={i}
                cx={nodeX(i)}
                cy={SPINE_Y}
                r={NODE_R}
                fill={solid ? CARD.ink : "none"}
                stroke={solid ? CARD.ink : CARD.muted}
                strokeWidth={2.5}
                opacity={t * leave}
              />
            );
          })}
        </svg>

        {NODES.map((n, i) => {
          const t = ease(frame, REVEAL[i].node, REVEAL[i].node + FADE);
          const common = {
            position: "absolute" as const,
            left: colX(i),
            width: COL_W,
            opacity: t * leave,
            translate: `0px ${interpolate(t, [0, 1], [8, 0])}px`,
            fontFamily: CARD_DISPLAY,
            fontSize: SIZE,
            fontWeight: 500,
            lineHeight: 1.3,
            letterSpacing: "-0.01em",
          };
          return (
            <React.Fragment key={n.tense + i}>
              {/* The tense marker sits ABOVE the spine and the item below it, so the line runs
                  between them and every column reads top-down in the same order. */}
              <div style={{ ...common, top: 200, color: CARD.muted }}>{n.tense}</div>
              <div style={{ ...common, top: 330, color: CARD.ink }}>{n.item}</div>
            </React.Fragment>
          );
        })}
      </Camera>
    </AbsoluteFill>
  );
};
