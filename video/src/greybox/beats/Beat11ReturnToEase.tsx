import React from "react";
import { AbsoluteFill, Easing, interpolate, useCurrentFrame } from "remotion";

import { BEAT11_WIDE, PHONE } from "../../app/framing";
import { RAW, VIEWFINDER } from "../../app/geometry";
import { useHover } from "../../app/hover";
import { MonitorPage } from "../../app/monitor";
import { useDrift } from "../../app/motion";
import { MusicPlayer, PLAY_CENTRE, PLAYER_WIN } from "../../app/player";
import { Pointer } from "../../app/pointer";
import { Camera, frameRect, union } from "../Camera";
import { useExpression } from "../rig";
import { H, W } from "../theme";

/**
 * ── THE PLAYER OVER THE WHOLE COMPOSITION ───────────────────────────────────────────
 *
 * The window opens over the page and the composition sits behind and beside it, so the beat's
 * first landing holds all of it: he opens a player, and you can see it is him doing it, on the
 * screen the last three beats were on.
 *
 * **It unions the STAGE CARD, not the stateline block** — the previous version framed the block
 * alone and the frame's left edge ran through the card, which is a content element cropped on
 * one side and reads as a crop rather than as ground. The card is 448 wide and the whole union is
 * only 876, so holding it whole costs nothing:
 *
 *   union   x 300.0 – 1176.0   (876.0)   ← the player, the card (trend included), the viewfinder
 *           y 188.0 –  669.4   (481.4)
 *   frameRect(m=20) → w = max(876 + 40, 521.4 × 16/9) = 927.0
 *
 * At L16 that is `COMPOSITE`'s own width to the pixel — the card's height governs both — so the
 * move off the player is a pan of 38px rather than a zoom, which is the smallest last move the
 * film's demo has ever ended on.
 *
 * Placed on the page's own top edge for the same reason `COMPOSITE` is: centred on the union it
 * would reach world y 169, showing a band of page above the card that the composite does not.
 */
const playerFrame = frameRect(union(union(PLAYER_WIN, VIEWFINDER), RAW.stage), 20);
const BEAT11_PLAYER = { ...playerFrame, cy: 156 + (playerFrame.w * 9) / 16 / 2 };

/**
 * Beat 11 · Return to ease · 234 frames
 *
 * He acts on it, in order: opens a music player and plays the track, puts headphones on, and
 * music notes drift around him while he starts moving with it — small, a head nod, not a dance
 * number. No audio; the cut must work silent regardless, because the VO is Arabic narration
 * laid over a locked cut later.
 *
 * **HE EASES *OVER* THE WORK, NOT INSTEAD OF IT.** He never leaves the keyboard: he is typing
 * again from the moment the player closes, through the nod, the drift and the recovery. Without
 * that, the beat reads as the stress app telling an employee to listen to music instead of
 * doing an urgent report — the worst available misreading, and the audience is managers.
 *
 * ══ IT ALL RESOLVES IN ONE SETTLED FRAME NOW — L15 ══════════════════════════════════
 *
 * The sheet has always wanted the bloom's drift, the stateline's return and the trend's descent
 * to resolve together in one shot that lands and holds. For three revisions the answer was that
 * they cannot: bloom top to trend bottom was 985.9px against a 519px viewport, so the trend was a
 * separate landing reached by scrolling the page 580px while the camera pulled out, and the
 * film's last idea arrived in a picture that had only just stopped moving.
 *
 * **L15 makes it one picture.** The orb comes down to 176, the Pause/End controls go, and the
 * trend joins the pinned column under his face — so the whole act fits inside the page's own
 * viewport and `COMPOSITE` holds the orb, the stateline, the trend and the viewfinder together.
 * The beat has TWO landings instead of three, the page never scrolls, and everything the beat
 * exists to show happens inside a camera that stopped at f98:
 *
 *   · **player + composition** (f18–f66) — he opens it, and it is visibly him doing it.
 *   · **the composite** (f98 to the end) — headphones, the notes, the nod, the bloom's drift back
 *     to meadow, the stateline's return AND the trend's descent, on a camera that has stopped.
 *
 * **The player and the trend are still never co-framed**, and that is unchanged: the player
 * window sits over the middle of the page and the beat's first landing is on it. What has changed
 * is that leaving it is a single move onto a shot that then never moves again.
 *
 *   f6–f46   the pointer travels to the transport; the click is at f24
 *   f66      the window has finished closing (f50–f64), the camera starts across
 *   f98      the camera LANDS on the composite and does not move again in this beat
 *   f100     he nods
 *   f106     the drift begins — bloom amber → meadow, 1.3s, framed
 *   f128     the copy returns to "at ease"
 *   f150     the trend's tail walks back down (39f) — in the same frame as the reading
 *   f190–234 the linger. Nothing moves but his breath and the nod.
 *
 * ══ THE MUSIC PLAYER IS DRAWN NOW ═══════════════════════════════════════════════════
 *
 * It was a STAND-IN through the component pass — deferred-register item 7, deliberately — and it
 * is not one any more. `app/player.tsx` draws the window this beat always described: a real
 * transport with prev / play-pause / next glyphs, a scrubber carrying elapsed and total time,
 * original album art from `app/albumart.tsx`, and the track and artist named on screen. The
 * geometry it exports (`PLAYER_WIN`, `PLAY_CENTRE`) is what this file frames and aims the pointer
 * at, so the camera and the hand read the component's own numbers instead of a copy of them.
 *
 * **It is generic, and that is decided (liberty L2b).** Not Spotify, not Apple Music, not a clone
 * of either — a desktop player window of a kind that has existed since Winamp. The naming is the
 * load-bearing part: Billie Jean and Michael Jackson on screen are the evidence Ren knew his
 * taste, and none of that needs a branded interface underneath it.
 *
 * **The artwork is ORIGINAL, and that is a requirement rather than a preference.** No real sleeve
 * is reproduced, approximated or referenced, for three reasons that stack: the film is
 * **promotional**, which is the fair-use factor that cuts hardest and cuts against us; the sleeve
 * is a **copyright separate from the recording**, so not playing the song does nothing for it; and
 * the sleeve in question is a **photograph of a person**, so likeness rights put a second
 * rightsholder on top of the first. The full reasoning lives next to the art, in `albumart.tsx`.
 *
 * The window's `z-index: 80` — the fix for the viewfinder punching a webcam feed through the
 * corner of a window he had just opened — moved into `player.tsx` with the component, and the bug
 * it closes is recorded there. It is not re-derived here.
 */

export const Beat11ReturnToEase: React.FC = () => {
  const frame = useCurrentFrame();

  // It finishes closing at f64, two frames before the camera starts across — so the window is
  // never cropped by a frame edge while it is still on screen.
  const open = interpolate(frame, [0, 14, 50, 64], [0, 1, 1, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: Easing.inOut(Easing.cubic),
  });
  const trackProgress = interpolate(frame, [24, 64], [0, 0.18], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  /**
   * ── THE PLAY BUTTON LIGHTS BEFORE HE PRESSES IT (§2) ────────────────────────────────
   *
   * §2's finding, in this beat exactly: *the cursor arrives at a control and the control does
   * nothing until the click.* The pointer lands on the transport at f20 and clicks at f24, and
   * across those four frames the button used to sit inert — so the press read as an effect that
   * happened near the cursor rather than as the cursor doing something to a button that had
   * already acknowledged it.
   *
   * The window opens at **f18**, two frames before the arrow settles, because a real pointer
   * crosses a control's edge before it stops moving and a light that arrives *with* the stop reads
   * as triggered by the stop. It closes at **f52**, the waypoint that carries the pointer off the
   * window — the click sits inside the window rather than at its end, since a hand is still over a
   * button while it presses it.
   *
   * **This uses `useHover`, not `<Hover/>`, and the distinction is the point.** The player is an
   * AUTHORED surface — the video owns its markup — so there is no shipped `apps/web` rule to
   * reproduce and no shipped element for a scoped stylesheet to address by selector. The treatment
   * applied at the far end (`player.tsx`'s `TransportButton`) is therefore the house
   * `hover:opacity-90` idiom every filled `<Button/>` variant in the product carries, on the same
   * 150ms ramp — so the drawn control and the shipped ones light at the same rate, and nobody
   * later reads this as evidence that a transport button ships a hover.
   */
  const playHover = useHover(18, 46);

  // amber → meadow, on the component's own 1.3s ease. It drifts where it can be SEEN — inside
  // the second landing's hold (f98–f146), before the camera and the page start travelling.
  const tension = 1 - useDrift(0, 1, 106);

  /**
   * **THE TAIL WALKS BACK DOWN — the history does not un-happen.**
   *
   * `climb` stays at 1 and `descend` animates. Driving the descent by lowering `climb` instead
   * flattens the WHOLE line, including the stretch that climbed during beat 8 — so the graph
   * ends as if the tense half-hour had never occurred, which is both dishonest and the opposite
   * of the beat's point. The recovery is a tail, not an erasure.
   */
  const descend = useDrift(0, 1, 150);

  // tense → easing over 30 frames, starting as the headphones go on. Slower than the fall on
  // purpose: coming back takes longer than going down. NOT the beat-7 expression — quieter,
  // relieved, a bit amused at himself.
  const pose = useExpression([
    { frame: 0, state: "tense" },
    { frame: 68, state: "tense" },
    { frame: 98, state: "easing" },
  ]);

  return (
    <AbsoluteFill>
      <Camera
        keys={[
          { frame: 0, shot: { cx: W / 2, cy: H / 2, w: W } },
          // 1 · the player AND his face. He opens it; it is visibly him doing it.
          { frame: 18, shot: BEAT11_PLAYER },
          { frame: 66, shot: BEAT11_PLAYER },
          // 2 · …and that is the last move in the film's demo. The composite holds the orb, the
          // stateline, the trend AND his face, so the headphones, the notes, the nod, the drift
          // back to meadow, the copy's return and the tail walking back down all play inside one
          // frame that stopped 136 frames before the beat ends.
          { frame: 98, shot: BEAT11_WIDE },
          { frame: 234, shot: BEAT11_WIDE },
        ]}
      >
        <MonitorPage
          clock="11:30 AM"
          band={frame >= 128 ? "at_ease" : "tense"}
          tension={tension}
          climb={1}
          descend={descend}
          pose={pose}
          // Back at the keyboard from the moment the player closes, and he does not stop again.
          working={frame >= 56}
          headphones={frame >= 68}
          nod={frame >= 100}
          notesFrom={78}
          sessionFrom={47 * 60 + 33}
          overlay={
            <>
              <MusicPlayer
                open={open}
                playing={frame >= 24}
                progress={trackProgress}
                playHover={playHover}
              />
              {/*
               * He presses play. Beat 11 opens on an interface appearing and a track starting,
               * and without a hand on it the sequence reads as the app doing it to him — which
               * is the exact inversion the whole beat is staged to prevent. The pointer travels
               * to the transport, presses it, and the progress bar starts on the click.
               */}
              <Pointer
                path={[
                  { frame: 6, x: PLAY_CENTRE.x - 170, y: PLAY_CENTRE.y + 120 },
                  { frame: 20, x: PLAY_CENTRE.x, y: PLAY_CENTRE.y },
                  { frame: 46, x: PLAY_CENTRE.x + 260, y: PLAY_CENTRE.y + 210 },
                ]}
                clicks={[24]}
                visible={{ from: 4, to: 56 }}
              />
            </>
          }
        />
      </Camera>
    </AbsoluteFill>
  );
};

/** Checked, not asserted — see the table in `framing.ts`. */
export const BEAT11_LEGIBILITY = PHONE.beat11Wide;
