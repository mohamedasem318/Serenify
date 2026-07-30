import React from "react";
import { AbsoluteFill, Easing, interpolate, useCurrentFrame } from "remotion";

import { BEAT11_WIDE, COMPOSITE } from "../../app/framing";
import { OS_FONT, STANDIN } from "../../app/furniture";
import { SCROLL, VIEWFINDER, emphasisCapFor, scrolled } from "../../app/geometry";
import { MonitorPage } from "../../app/monitor";
import { useDrift, useEmphasis } from "../../app/motion";
import { Pointer } from "../../app/pointer";
import { StandIn } from "../../app/shell";
import { Camera, frameRect, rect } from "../Camera";
import { PLAYER } from "../copy";
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
 * The music player stays a STAND-IN this pass — register item 7, deliberately.
 */

const WIN = rect(300, 220, 600, 280);

/** The transport's play button — `WIN.x + 254`, `WIN.y + 177`, 44 × 44. Its centre. */
const PLAY = { x: WIN.x + 276, y: WIN.y + 199 } as const;

/**
 * The music player — a STAND-IN, in dark.
 *
 * Register item 7 keeps it a stand-in this pass. What it owed was to stop reading as a
 * light-mode rectangle sitting in a dark film, which it now does via the `STANDIN` ramp — a
 * genuine dark ramp rather than the old light values inverted, because perceptual lightness is
 * not symmetric about the midpoint and inverting a light ramp yields muddy mid-greys with the
 * wrong spacing.
 *
 * **The track is named on screen and the naming is the point** — it is the evidence Ren knew
 * him. Under liberty L2b the player is generic while Billie Jean and Michael Jackson are named.
 * The album art stays a labelled block: when it is drawn it must be ORIGINAL, never a
 * reproduction of a real sleeve, and authoring it belongs to the assets pass.
 */
const MusicPlayer: React.FC<{ open: number; playing: boolean; progress: number }> = ({
  open,
  playing,
  progress,
}) => (
  <div
    style={{
      opacity: open,
      scale: 0.94 + open * 0.06,
      transformOrigin: "50% 50%",
      fontFamily: OS_FONT,
      /*
       * ── IT IS AN APPLICATION WINDOW, SO IT SITS ABOVE EVERYTHING ──
       *
       * The player was layered between the page and the viewfinder: the browser page painted
       * under it and the viewfinder painted OVER it, so a window he had just opened had a webcam
       * feed punched through its corner. It reads as a rendering fault rather than as depth,
       * because nothing in an operating system behaves that way — a foreground window occludes
       * the browser and everything inside it.
       *
       * The cause was ordering rather than intent. `<Viewfinder/>` is `z-10` inside the
       * monitoring stage and the overlay layer carries no stacking of its own, so the two
       * competed on DOM order in a shared context. 80 clears the viewfinder and the app header's
       * `z-50` alike, and sits below the pointer's 90 — a cursor is above every window.
       */
      position: "relative",
      zIndex: 80,
    }}
  >
    <StandIn x={WIN.x} y={WIN.y} w={WIN.w} h={WIN.h} radius={12} fill={STANDIN.surface} />
    <StandIn x={WIN.x} y={WIN.y} w={WIN.w} h={32} radius={0} fill={STANDIN.panel} />
    <div
      style={{
        position: "absolute",
        left: WIN.x + 14,
        top: WIN.y + 9,
        fontSize: 14,
        fontWeight: 700,
        color: STANDIN.body,
      }}
    >
      {PLAYER.app}
    </div>

    <StandIn
      x={WIN.x + 24}
      y={WIN.y + 52}
      w={160}
      h={160}
      radius={8}
      fill={STANDIN.panelAlt}
      label="album art"
    />

    <div
      style={{
        position: "absolute",
        left: WIN.x + 208,
        top: WIN.y + 62,
        width: 360,
        fontSize: 26,
        fontWeight: 700,
        color: STANDIN.ink,
      }}
    >
      {PLAYER.track}
    </div>
    <div
      style={{
        position: "absolute",
        left: WIN.x + 208,
        top: WIN.y + 102,
        width: 360,
        fontSize: 17,
        color: STANDIN.body,
      }}
    >
      {PLAYER.artist}
    </div>

    <StandIn x={WIN.x + 208} y={WIN.y + 152} w={360} h={5} radius={3} fill={STANDIN.ghost} border={STANDIN.ghost} />
    <StandIn
      x={WIN.x + 208}
      y={WIN.y + 152}
      w={360 * progress}
      h={5}
      radius={3}
      fill={STANDIN.line}
      border={STANDIN.line}
    />

    <StandIn x={WIN.x + 208} y={WIN.y + 182} w={34} h={34} radius={17} fill={STANDIN.panelAlt} />
    <StandIn x={WIN.x + 254} y={WIN.y + 177} w={44} h={44} radius={22} fill={STANDIN.fill} border={STANDIN.line} />
    <div
      style={{
        position: "absolute",
        left: WIN.x + 254,
        top: WIN.y + 188,
        width: 44,
        textAlign: "center",
        fontSize: 17,
        color: STANDIN.ink,
      }}
    >
      {playing ? "❚❚" : "▶"}
    </div>
    <StandIn x={WIN.x + 310} y={WIN.y + 182} w={34} h={34} radius={17} fill={STANDIN.panelAlt} />
  </div>
);

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
          { frame: 20, shot: frameRect(WIN, 24) },
          { frame: 52, shot: frameRect(WIN, 24) },
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
              <MusicPlayer open={open} playing={frame >= 24} progress={trackProgress} />
              {/*
               * He presses play. Beat 11 opens on an interface appearing and a track starting,
               * and without a hand on it the sequence reads as the app doing it to him — which
               * is the exact inversion the whole beat is staged to prevent. The pointer travels
               * to the transport, presses it, and the progress bar starts on the click.
               */}
              <Pointer
                path={[
                  { frame: 6, x: PLAY.x - 170, y: PLAY.y + 120 },
                  { frame: 20, x: PLAY.x, y: PLAY.y },
                  { frame: 52, x: PLAY.x + 260, y: PLAY.y + 210 },
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
