import React from "react";
import { AbsoluteFill, Easing, interpolate, useCurrentFrame } from "remotion";

import { BEAT11_NEAR, BEAT11_WIDE, PHONE } from "../../app/framing";
import { SCROLL, STATELINE_BLOCK, VIEWFINDER, scrolled } from "../../app/geometry";
import { useHover } from "../../app/hover";
import { MonitorPage } from "../../app/monitor";
import { useDrift, useEmphasis } from "../../app/motion";
import { MusicPlayer, PLAY_CENTRE, PLAYER_WIN } from "../../app/player";
import { Pointer } from "../../app/pointer";
import { Camera, frameRect, union } from "../Camera";
import { useExpression } from "../rig";
import { H, W } from "../theme";

/**
 * ── THE PLAYER AND HIS FACE, IN ONE FRAME ───────────────────────────────────────────
 *
 * The window opens over the page and the viewfinder sits to its right, so the beat's first
 * landing holds both: he opens a player, and you can see it is him doing it. Before L14 the
 * viewfinder was an overlay inside the scrolling card at x 743–1063, and this union was 763 wide
 * against the player's own 648 — a difference too small to be worth the face. Pinned at
 * 856–1176 the union is 876, the shot is 924, and the face still lands at 54.7px on a phone.
 *
 * **The stateline is in the union and it costs nothing**, which was found on a render rather
 * than derived. The player + viewfinder union is 876 wide and only 288 tall, so its WIDTH
 * governs the 16:9 frame — the shot is 924 either way, and centring it on the two of them alone
 * put its bottom edge at 615.9, straight through the second line of the `tense` sub at 604–630.
 * Adding the block to the union moves the frame's centre down 65px and crops nothing; the shot
 * does not get one pixel wider for it.
 */
const BEAT11_PLAYER = frameRect(
  union(union(PLAYER_WIN, VIEWFINDER), scrolled(STATELINE_BLOCK, SCROLL.monitor)),
  24,
);

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
 * ══ WHAT IT HOLDS, AND WHAT IT HONESTLY CANNOT ══════════════════════════════════════
 *
 * The sheet wants the bloom's drift, the stateline's return and the trend's descent to resolve
 * together in one wide shot that lands and holds. **The bloom and the trend cannot be on screen
 * together**, and this is measured rather than judged:
 *
 *   bloom top → trend bottom           1028.7 px
 *   viewport below the sticky header    519.0 px
 *
 * No camera move buys page height, and padding the layout until it fits is exactly what register
 * item 2 exists to undo. So the causal ORDER survives and the single static shot does not — the
 * beat has three landings inside ONE continuous move, and the camera never cuts.
 *
 * **What L14 changes is which pairs are available.** The viewfinder no longer scrolls, so it can
 * be in every one of the three:
 *
 *   · **player + face** (924 wide, f18–f66) — he opens it, and it is visibly him doing it.
 *   · **the reading + face** (777, f98–f146) — headphones, the notes, the nod, the bloom's drift
 *     back to meadow and the stateline's return, all framed together.
 *   · **the trend + face** (872, f180 on) — the payoff. Before L14 scrolling to the trend took
 *     his face off the screen and the closing frame held a graph and nothing else.
 *
 * **The player, the trend and the face are never in one frame, and that is stated rather than
 * implied.** Not because the union is too wide — it is 916, which is affordable — but because
 * the trend is 853px down the page while the player is open, so no framing can contain both: the
 * page has to scroll to bring the trend up, and the scroll is what the third landing IS. This was
 * never true at the greybox either; the player's opacity was already 0 by f72 while the payoff
 * landed at f160, so the two were never actually co-framed there.
 *
 *   f6–f46   the pointer travels to the transport; the click is at f24
 *   f66      the window has finished closing (f50–f64), the camera starts across
 *   f100     he nods
 *   f106     the drift begins — bloom amber → meadow, 1.3s, while it is still framed
 *   f128     the copy returns to "at ease" and the emphasis rises ON it
 *   f146     the camera starts out and the page starts down, together
 *   f180     it lands wide on the trend + the viewfinder
 *   f184     the trend's tail walks back down (39f)
 *   f223–234 the linger. Nothing moves but his breath and the nod.
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
  const descend = useDrift(0, 1, 184);

  /**
   * The third firing of the emphasis rule (L12): the raise begins **on** the copy change at
   * f128, inside the second landing's hold. The audience has learned by now that when the block
   * moves the reading changed, and that only holds if the movement is caused by the change
   * rather than merely near it — and if the camera is not moving underneath it.
   *
   * **No factor is passed any more.** Beat 11 used to interpolate from `emphasisCapFor(2)` to
   * `emphasisCapFor(1)` because the two-line `tense` copy could only be raised 1.01× and the
   * one-line `at_ease` copy 1.25×, so the block would have jumped size on the frame the band
   * flipped. The sub reserves two lines now, both caps are 1.25, and the interpolation had
   * nothing left to smooth.
   */
  const emphasis = useEmphasis([
    { frame: 0, up: 0 },
    { frame: 128, up: 0 },
    { frame: 144, up: 1 },
    { frame: 200, up: 1 },
    { frame: 214, up: 0 },
  ]);

  // tense → easing over 30 frames, starting as the headphones go on. Slower than the fall on
  // purpose: coming back takes longer than going down. NOT the beat-7 expression — quieter,
  // relieved, a bit amused at himself.
  const pose = useExpression([
    { frame: 0, state: "tense" },
    { frame: 68, state: "tense" },
    { frame: 98, state: "easing" },
  ]);

  // The page travels WITH the camera, in the same continuous move. See the header — the bloom
  // and the trend cannot share a screen at this world, so the shot follows the causal chain down
  // rather than trying to hold everything at once.
  const scroll = interpolate(frame, [146, 180], [SCROLL.monitor, SCROLL.trend], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: Easing.inOut(Easing.cubic),
  });

  return (
    <AbsoluteFill>
      <Camera
        keys={[
          { frame: 0, shot: { cx: W / 2, cy: H / 2, w: W } },
          // 1 · the player AND his face. He opens it; it is visibly him doing it.
          { frame: 18, shot: BEAT11_PLAYER },
          { frame: 66, shot: BEAT11_PLAYER },
          // 2 · the reading and his face. The headphones, the notes, the nod, the bloom's drift
          // back to meadow and the stateline's return all play inside this hold, on a camera
          // that is not moving — which is what makes the emphasis land rather than cancel.
          { frame: 98, shot: BEAT11_NEAR },
          { frame: 146, shot: BEAT11_NEAR },
          // 3 · …and OUT, the page scrolling with the lens, landing with 54 frames still to run.
          // The trend card whole, WITH his face beside it. This is the payoff, and it settles.
          { frame: 180, shot: BEAT11_WIDE },
          { frame: 234, shot: BEAT11_WIDE },
        ]}
      >
        <MonitorPage
          clock="11:30 AM"
          band={frame >= 128 ? "at_ease" : "tense"}
          tension={tension}
          climb={1}
          descend={descend}
          scroll={scroll}
          pose={pose}
          // Back at the keyboard from the moment the player closes, and he does not stop again.
          working={frame >= 56}
          headphones={frame >= 68}
          nod={frame >= 100}
          notesFrom={78}
          emphasis={emphasis}
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
