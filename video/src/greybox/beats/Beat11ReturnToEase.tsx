import React from "react";
import { AbsoluteFill, Easing, interpolate, useCurrentFrame } from "remotion";

import { BEAT11_WIDE, COMPOSITE } from "../../app/framing";
import { SCROLL, VIEWFINDER, emphasisCapFor, scrolled } from "../../app/geometry";
import { useHover } from "../../app/hover";
import { MonitorPage } from "../../app/monitor";
import { useDrift, useEmphasis } from "../../app/motion";
import { MusicPlayer, PLAY_CENTRE, PLAYER_WIN } from "../../app/player";
import { Pointer } from "../../app/pointer";
import { Camera, frameRect } from "../Camera";
import { useExpression } from "../rig";
import { H, W } from "../theme";

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
 * ══ THE ONE THING THE REAL PAGE'S HEIGHT FORCED ═════════════════════════════════════
 *
 * The sheet wants the bloom's drift, the stateline's return and the trend's descent to resolve
 * together in one wide shot that lands and holds. **At the real geometry they cannot be on
 * screen together**, and this was measured rather than judged:
 *
 *   bloom top → trend bottom            664.2 px   (`geometry.ts`, from the probe)
 *   viewport below the sticky header    519.0 px
 *                                       ─────────
 *                                       145 px short — at every scroll, at every framing
 *
 * No camera move buys page height, and the alternative — padding the layout until it fits — is
 * exactly what register item 2 exists to undo. The greybox only ever fitted because it drew a
 * 476-tall card where the product has a 607.7-tall one.
 *
 * **So the causal ORDER survives and the static wide shot does not.** The bloom drifts and the
 * stateline returns while both are framed; then the camera pulls out AND the page scrolls, in
 * one continuous move, landing on stateline + trend for the descent. That is the sheet's own
 * order with the camera following the story instead of waiting for it — and the closing linger
 * lands on the trend, which is the thing the beat exists to show.
 *
 *   f108  he nods
 *   f130  the drift begins — bloom amber → meadow, 1.3s, while it is still framed
 *   f138  the emphasis rises; f146 the copy returns to "at ease"
 *   f150  the camera starts out and the page starts down, together
 *   f180  it lands wide on stateline + trend
 *   f182  the trend's tail walks back down (52f)
 *   f214  everything has stopped travelling
 *   f214–234  the linger. Nothing moves but his breath and the nod.
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

  const open = interpolate(frame, [0, 14, 58, 72], [0, 1, 1, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: Easing.inOut(Easing.cubic),
  });
  const trackProgress = interpolate(frame, [24, 72], [0, 0.18], {
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
  const playHover = useHover(18, 52);

  // amber → meadow, on the component's own 1.3s ease. It drifts where it can be SEEN — while
  // the bloom is still framed, before the camera and the page start travelling.
  const tension = 1 - useDrift(0, 1, 130);

  /**
   * **THE TAIL WALKS BACK DOWN — the history does not un-happen.**
   *
   * `climb` stays at 1 and `descend` animates. Driving the descent by lowering `climb` instead
   * flattens the WHOLE line, including the stretch that climbed during beat 8 — so the graph
   * ends as if the tense half-hour had never occurred, which is both dishonest and the opposite
   * of the beat's point. The recovery is a tail, not an erasure.
   */
  const descend = useDrift(0, 1, 182);

  /**
   * The third firing of the emphasis rule (L12), and the same retiming beat 8 needed: the raise
   * begins **on** the copy change at f146, not eight frames before it. The audience has learned
   * by now that when the block moves the reading changed, and that only holds if the movement is
   * caused by the change rather than merely near it.
   */
  const emphasis = useEmphasis([
    { frame: 0, up: 0 },
    { frame: 146, up: 0 },
    { frame: 162, up: 1 },
    { frame: 200, up: 1 },
    { frame: 214, up: 0 },
  ]);

  /**
   * The copy returns to the one-line `at_ease` sub, so the full 1.25× is available again — it
   * comes back as the two-line `tense` copy leaves. The interpolation is what stops the block
   * jumping size on the frame the band flips.
   */
  const emphasisFactor = interpolate(frame, [140, 152], [emphasisCapFor(2), emphasisCapFor(1)], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: Easing.inOut(Easing.cubic),
  });

  // tense → easing over 30 frames, starting as the headphones go on. Slower than the fall on
  // purpose: coming back takes longer than going down. NOT the beat-7 expression — quieter,
  // relieved, a bit amused at himself.
  const pose = useExpression([
    { frame: 0, state: "tense" },
    { frame: 74, state: "tense" },
    { frame: 104, state: "easing" },
  ]);

  // The page travels WITH the camera, in the same continuous move. See the header — the bloom
  // and the trend cannot share a screen at this world, so the shot follows the causal chain down
  // rather than trying to hold everything at once.
  const scroll = interpolate(frame, [150, 180], [SCROLL.monitor, SCROLL.trend], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: Easing.inOut(Easing.cubic),
  });

  return (
    <AbsoluteFill>
      <Camera
        keys={[
          { frame: 0, shot: { cx: W / 2, cy: H / 2, w: W } },
          { frame: 20, shot: frameRect(PLAYER_WIN, 24) },
          { frame: 52, shot: frameRect(PLAYER_WIN, 24) },
          // Wide on the viewfinder, not tight: the headphones, the drifting notes and the head
          // nod all need room, and cropping to the face loses what makes the beat work.
          { frame: 84, shot: frameRect(scrolled(VIEWFINDER, SCROLL.monitor), 100) },
          { frame: 130, shot: frameRect(scrolled(VIEWFINDER, SCROLL.monitor), 100) },
          // The drift and the return play here, both framed.
          { frame: 150, shot: COMPOSITE },
          // …and OUT, landing with 54 frames still to run. This is the payoff.
          { frame: 180, shot: BEAT11_WIDE },
          { frame: 234, shot: BEAT11_WIDE },
        ]}
      >
        <MonitorPage
          clock="11:30 AM"
          band={frame >= 146 ? "at_ease" : "tense"}
          tension={tension}
          climb={1}
          descend={descend}
          scroll={scroll}
          pose={pose}
          // Back at the keyboard from the moment the player closes, and he does not stop again.
          working={frame >= 62}
          headphones={frame >= 74}
          nod={frame >= 108}
          notesFrom={84}
          emphasis={emphasis}
          emphasisFactor={emphasisFactor}
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
                  { frame: 52, x: PLAY_CENTRE.x + 260, y: PLAY_CENTRE.y + 210 },
                ]}
                clicks={[24]}
                visible={{ from: 4, to: 62 }}
              />
            </>
          }
        />
      </Camera>
    </AbsoluteFill>
  );
};
