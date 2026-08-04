import React from "react";
import { AbsoluteFill, Easing, interpolate, useCurrentFrame } from "remotion";

import { CARD, CARD_DISPLAY } from "../../app/furniture";
import { Camera, shot } from "../Camera";
import { H, W } from "../theme";

/*
 * Hallmark · component: interstitial-card · genre: editorial · theme: film-furniture (locked)
 * states: n/a — a non-interactive film frame; there is no hover, focus or active in a render
 * contrast: pass — CARD.ink #e8ebee on CARD.field #0b0c0e ≈ 17:1
 * pre-emit critique: P5 H5 E4 S5 R5 V4
 */

/**
 * The four interstitial cards · 60 frames each
 *
 * ══ THE VO IS GONE, SO ON-SCREEN TEXT IS THE FILM'S ONLY NARRATION ══════════════════
 *
 * The Egyptian Arabic voice-over is dropped and LinkedIn autoplays muted, so nothing but type
 * carries the narration now. It goes on **cards** rather than as an overlay, for three reasons
 * that are recorded here so the decision is not re-opened mid-build:
 *
 *  · The film is near-black with dark UI throughout, so overlaid text needs a scrim — and that
 *    scrim would sit on top of surfaces that took nine passes to frame.
 *  · A caption floating over a screen breaks the conceit that you are watching a screen.
 *  · The film already punctuates with a card (beat 12). A card is existing vocabulary; an
 *    overlay would be a new device introduced in the last pass.
 *
 * ── AND THE CARD IS THE TRANSITION ──────────────────────────────────────────────────
 *
 * Where a card sits, it covers the change of composition. That is why these four are at these
 * four seams and nowhere else — see `GreyboxVideo.tsx` § THE FOUR CARDS for the placement
 * argument and for why every other seam is a chain the UI narrates itself.
 *
 * ── ONE SENTENCE ACROSS THE FILM ────────────────────────────────────────────────────
 *
 *   "First it learns what calm looks like. Then it stays quiet. Until something changes.
 *    Then it helps you come back down."
 *
 * Read in order the four lines are one sentence, and they must be kept in that relationship —
 * no line is re-worded on its own. **"First" is load-bearing**: it is what gives the two
 * "Then"s something to continue from, and it is the whole reason the first card exists.
 *
 * ── THE TREATMENT IS BEAT 12'S, ONE SIZE DOWN ───────────────────────────────────────
 *
 * Same face (Outfit, `CARD_DISPLAY`), same weight (500), same tracking (−0.01em), same ground
 * (`CARD.field`, three points deeper than the app's own page), same ink, same centred
 * composition, same 760 framing. They are the same object as the closing card, not a second
 * design.
 *
 * **But beat 12 stays the largest text in the film.** It is 34px world at a 760 framing, which
 * is **18.88px phone-equivalent** (`world × 422 / frameWidth`, the sheet's own arithmetic).
 * These are **27px → 14.99px**, comfortably over the 14px floor and visibly — 79% — under the
 * claim. They are connective tissue; beat 12 is the film's one claim.
 *
 * ── ENTRY AND EXIT ──────────────────────────────────────────────────────────────────
 *
 * A fade with eight pixels of rise, which is beat 12's own gesture, so the four read as one
 * device *and* as the same object as the card they lead to. Deliberately **not** the typewriter
 * — that is reserved for domains, beat 1's omnibox and beat 13's `.tech`, and the bookend is
 * the reason the reservation exists — and deliberately not the end card's wipe.
 *
 * ── DURATION ────────────────────────────────────────────────────────────────────────
 *
 * 60 frames (2.00s): in over f3–f15, **settled and static f15–f48 (33 frames, 1.10s)**, out over
 * f48–f60. Short display text needs time to be read at a glance and then registered, not just
 * decoded, so the settled window is the number that matters and it clears its 1s floor.
 *
 * ── AND THEY ARE OUTPUT FRAMES, NOT AUTHORED ONES ───────────────────────────────────
 *
 * These cards are **not** retimed. They are new material inserted into the *output* timeline in
 * `GreyboxVideo.tsx`, after the Premiere map has been read, so a card runs at exactly the
 * duration written above. Putting them in the authored timeline would have shifted every source
 * frame in `retime.tsx`'s segment table downstream of each insertion — thirteen numbers moved by
 * hand to reproduce a cut that is already approved. See `GreyboxVideo.tsx` § THE CARDS RIDE THE
 * OUTPUT TIMELINE.
 */

/** Every card's full length, in output frames. */
export const INTERSTITIAL_FRAMES = 60;

const LINE = { x: 160, y: 296, w: 880 } as const;

/**
 * ══ THE TWO RAMPS, AND WHY THE DISSOLVING CARD NEEDS ITS OWN ════════════════════════
 *
 * On a **cut** join there is nothing under the card, so the line can start arriving on frame 3
 * while the ground has always been opaque.
 *
 * On the **dissolve** join (the 7 → 8 card) there is a live frame underneath for as long as the
 * ground is transparent — and the first attempt let the line ramp up across that window, which
 * put "Until something changes." **on top of the monitoring shot**, across his face and his own
 * stateline, for about ten frames at each end. That is precisely the floating caption the whole
 * card decision rejected; a dissolve that reintroduces it for twenty frames is worse than the cut
 * it replaces.
 *
 * So the dissolve join is **sequenced, not cross-faded**: the ground comes up first and the line
 * only starts once the picture is gone, and on the way out the line leaves first and the ground
 * follows it. The line is never over the picture on any frame.
 *
 *   join       ground            line              settled          line out      ground out
 *   ────────  ───────────────  ───────────────  ───────────────  ────────────  ─────────────
 *   cut       (always opaque)  f3 → f15         f15 → f48 (1.10s)  f48 → f60    —
 *   dissolve  f0 → f8          f8 → f16         f16 → f46 (1.00s)  f46 → f54    f54 → f60
 *
 * **The line's ramps shorten from 12 frames to 8 to pay for the dissolve**, and the settled
 * window still clears its 1s floor — exactly, at 30 frames. That is the whole cost, and it is why
 * the dissolve is 8 frames rather than the 14 it wants to be: 60 frames minus a 30-frame floor
 * leaves 30 for four ramps.
 *
 * `frames` exists ONLY so the comparison composition can render a shorter variant of this exact
 * card beside the shipped one — see `CardJoinCompare.tsx`. The cut always uses the default, and a
 * shorter card is not shippable as it stands: at 45 the settled window falls under the floor.
 */
export const veilAt = (local: number, frames = INTERSTITIAL_FRAMES): number =>
  Math.min(
    interpolate(local, [0, 8], [0, 1], {
      extrapolateLeft: "clamp",
      extrapolateRight: "clamp",
      easing: Easing.inOut(Easing.cubic),
    }),
    interpolate(local, [frames - 6, frames], [1, 0], {
      extrapolateLeft: "clamp",
      extrapolateRight: "clamp",
      easing: Easing.inOut(Easing.cubic),
    }),
  );

export const Interstitial: React.FC<{
  line: string;
  frames?: number;
  /** Sequence the line after the ground rather than with it. See the ramp table above. */
  dissolve?: boolean;
}> = ({ line, frames = INTERSTITIAL_FRAMES, dissolve = false }) => {
  // Remotion's own hook, deliberately: a card is output-timeline material and is never read
  // through the retime map, so there is no sub-frame remainder to add. See the header.
  const frame = useCurrentFrame();

  const appear = interpolate(frame, dissolve ? [8, 16] : [3, 15], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: Easing.out(Easing.cubic),
  });
  const leave = interpolate(
    frame,
    dissolve ? [frames - 14, frames - 6] : [frames - 12, frames],
    [1, 0],
    {
      extrapolateLeft: "clamp",
      extrapolateRight: "clamp",
      easing: Easing.inOut(Easing.cubic),
    },
  );
  const rise = interpolate(appear, [0, 1], [8, 0]);

  return (
    <AbsoluteFill>
      <Camera keys={[{ frame: 0, shot: shot(W / 2, LINE.y + 20, 760) }]}>
        <div
          style={{ position: "absolute", inset: 0, width: W, height: H, backgroundColor: CARD.field }}
        />

        <div
          style={{
            position: "absolute",
            left: LINE.x,
            top: LINE.y,
            width: LINE.w,
            opacity: Math.min(appear, leave),
            translate: `0px ${rise}px`,
            fontFamily: CARD_DISPLAY,
            fontSize: 27,
            fontWeight: 500,
            lineHeight: 1.3,
            letterSpacing: "-0.01em",
            textAlign: "center",
            color: CARD.ink,
          }}
        >
          {line}
        </div>
      </Camera>
    </AbsoluteFill>
  );
};
