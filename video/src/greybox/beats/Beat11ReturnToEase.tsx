import React from "react";
import { AbsoluteFill, Easing, interpolate } from "remotion";
import { useCurrentFrame } from "../../retime";

import { BEAT11_WIDE, PHONE } from "../../app/framing";
import { RAW, VIEWFINDER } from "../../app/geometry";
import { useHover } from "../../app/hover";
import { LITTLE_AT, MonitorPage, TENSE_AT } from "../../app/monitor";
import { useDrift, useReading } from "../../app/motion";
import { MusicPlayer, PLAY_CENTRE, PLAYER_WIN } from "../../app/player";
import { Pointer } from "../../app/pointer";
import { usePitch } from "../../pitch-context";
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
 * ── AND THEN IT PUNCHES IN, BECAUSE THE TRACK STARTING IS THE PAYOFF ────────────────
 *
 * The shot above is the *establishing* one — he opens a player, and you can see it is him doing
 * it. It is 916 world px wide, which is a wide framing for a 600px window, and the note is exact
 * about what that costs: **"It is the moment Ren's suggestion pays off and it currently sits in a
 * loose wide framing."** So the click has a consequence now — the camera goes to the player.
 *
 * `frameRect(PLAYER_WIN, 20)` gives the width by the framing rule's own arithmetic: 640, holding
 * a 600-wide window with 20px of clearance each side. A 1.43× punch, and at 640 the window is very
 * nearly the only thing in frame.
 *
 * ── THE VERTICAL IS PLACED, AND THE REASON IS THE TREND ─────────────────────────────
 *
 * `frameRect` would centre 360px of frame on the window and land at y 180–540. **The trend's top
 * edge is at 474**, and the window's bottom is at 500 — 26px apart — so *no* frame that holds the
 * window whole can exclude the trend. The geometry forbids it, the same way beat 4's card cannot
 * be held whole and magnified at 16:9.
 *
 * What can be minimised is how much of it shows, so the frame's bottom edge is placed at the
 * window's own bottom plus the same 20px margin the sides get:
 *
 *   frame   x 280 – 920   y 160 – 520
 *   window  x 300 – 900   y 220 – 500      20px left, right and below; the slack goes UP
 *   above   the stage card's top border (188) and its empty top band — page, not content
 *   below   20px of the card under the window, which is where the trend's heading begins
 *
 * Twenty pixels of page below a window is a frame edge falling on background, which is what a
 * frame edge is allowed to do. Forty — which is what centring gives — starts to read as a second
 * object cut in half.
 */
const BEAT11_PLAYER_LANDING = (() => {
  const f = frameRect(PLAYER_WIN, 20);
  return { ...f, cy: PLAYER_WIN.y + PLAYER_WIN.h + 20 - (f.w * 9) / 32 };
})();

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
 * ── AND THERE ARE THREE LANDINGS NOW, BECAUSE THE TRACK STARTING IS A MOMENT ────────
 *
 * The establishing shot held for 48 frames and nothing in it changed after the click, so the one
 * event the beat is named for — *he presses play and the music goes on* — happened in a 916-wide
 * frame and then simply continued. The camera goes to the player on the click now. See
 * `BEAT11_PLAYER_LANDING` above for the framing and for why its bottom edge is placed rather than
 * centred.
 *
 *   f6–f46   the pointer travels to the transport; the click is at f24
 *   f18–f24  the establishing shot, held across the click
 *   f24–f42  THE PUNCH IN — 916 → 640, beginning on the click
 *   f42–f60  held on the player. The scrubber runs; this is the payoff
 *   f56–f70  the window closes, overlapping the camera's departure at f60
 *   f60–f98  the pull-out to the composite
 *   f68      the headphones go on — deliberately while he is out of frame. It is a hard swap
 *            (`rig.tsx`: `{headphones ? <Headphones/> : null}`), and a pop nobody sees is a pop
 *            that never happened
 *   f98      the camera LANDS on the composite and does not move again in this beat
 *   f100     he nods
 *   f106     the drift begins — bloom amber → meadow, 1.3s, framed
 *   f128     the copy returns to "at ease" — and the trend's newest reading with it, same frame
 *   f170     the tail has finished walking down
 *   f190–234 the linger. Nothing moves but his breath and the nod.
 *
 * **The closing hold is untouched: 136 frames, f98 to the end.** The punch is paid for entirely
 * out of the establishing hold and out of the window's close overlapping the move instead of
 * preceding it.
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
  // null outside the pitch composition, where each beat keeps its own constant.
  const readout = usePitch().session?.beat11;
  const frame = useCurrentFrame();

  /**
   * It used to finish closing at f64, two frames before the camera started across, so that the
   * window was never cropped by a frame edge while it was still on screen. **That constraint is
   * satisfied differently now and the two motions can overlap.** From f42 the camera is at
   * `BEAT11_PLAYER_LANDING`, where the window sits inside the frame with 20px of margin, and the
   * pull-out only ever makes the frame bigger — so there is no frame in the beat that crops it.
   *
   * The close therefore runs f56–f70 and the camera leaves at f60: the window shrinks away AS the
   * camera widens, one gesture, and the page it was covering is revealed by the move rather than
   * after it.
   */
  const open = interpolate(frame, [0, 14, 56, 70], [0, 1, 1, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: Easing.inOut(Easing.cubic),
  });
  const trackProgress = interpolate(frame, [24, 70], [0, 0.18], {
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
   * `peak` stays at 1 and `level` animates. Driving the descent by lowering the peak instead
   * flattens the WHOLE line, including the stretch that climbed during beat 8 — so the graph
   * ends as if the tense half-hour had never occurred, which is both dishonest and the opposite
   * of the beat's point. The recovery is a tail, not an erasure.
   *
   * ── AND IT USED TO ARRIVE 1.4 SECONDS AFTER EVERYTHING ELSE ────────────────────────
   *
   * The graph was a separate authored ramp — `descend = useDrift(0, 1, 150)` — against a
   * stateline that returned at f128 and a bloom that finished drifting at f145. So it **started**
   * 22 frames after the copy had already said "at ease" and did not finish until f189: the orb
   * and the stateline resolved and the graph caught up nearly two seconds later. That is the
   * reported lag, and it was not an offset to nudge — it was a second clock. See `monitor.tsx`
   * § ONE READING, READ TWICE.
   *
   * `level` is now the same number the stateline reads, and its keys are placed so the copy's
   * return frame IS the graph's:
   *
   *   f0–f106     1.00        tense, held
   *   f106–f127   → 0.68      the tail starts walking down AS THE BLOOM DRIFTS, inside the band
   *   f128        0.27        → "at ease", and the newest window crosses with it, same frame
   *   f170        0.00        the tail settles, well inside the closing hold
   *
   * The crossing is one frame wide on purpose: the recovery skips `a_little_tense` because the
   * **stateline does**, and a continuous value that dwelt in between would put the graph in a band
   * the copy was not showing — the exact disagreement being fixed. The step is 0.41 of the plot on
   * the newest windows, and it lands on the frame the copy changes and inside the bloom's own
   * drift, so the beat's three resolutions happen together rather than in sequence.
   */
  const level = useReading([
    { frame: 0, level: 1 },
    { frame: 106, level: 1 },
    { frame: 127, level: TENSE_AT + 0.02 },
    { frame: 128, level: LITTLE_AT - 0.01 },
    { frame: 170, level: 0 },
  ]);

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
          // …held across the click at f24, so the press and what it causes are one shot.
          { frame: 24, shot: BEAT11_PLAYER },
          // 2 · THE TRACK STARTS AND THE CAMERA GOES TO IT. The punch begins ON the click — it
          // is the click's consequence, not a separate idea — and lands 18 frames later.
          { frame: 42, shot: BEAT11_PLAYER_LANDING },
          // HOLD. Eighteen frames of the player at 640, the scrubber running, before anything
          // else moves. This is the payoff the note asked for.
          { frame: 60, shot: BEAT11_PLAYER_LANDING },
          // 3 · …and that is the last move in the film's demo. The composite holds the orb, the
          // stateline, the trend AND his face, so the headphones, the notes, the nod, the drift
          // back to meadow, the copy's return and the tail walking back down all play inside one
          // frame that stopped 136 frames before the beat ends.
          //
          // **The closing hold is UNCHANGED at 136 frames.** The punch is paid for out of the
          // establishing shot's own 48-frame hold, which was the loosest thing in the beat, and
          // out of the window's close overlapping this move rather than preceding it.
          { frame: 98, shot: BEAT11_WIDE },
          { frame: 234, shot: BEAT11_WIDE },
        ]}
      >
        <MonitorPage
          clock={readout?.clock ?? "11:30 AM"}
          level={level}
          peak={1}
          tension={tension}
          pose={pose}
          // Back at the keyboard from the moment the player closes, and he does not stop again.
          working={frame >= 56}
          headphones={frame >= 68}
          nod={frame >= 100}
          notesFrom={78}
          // 48:36 under the pitch cut — see `pitch-context.tsx` § THE INTERNAL CLOCK.
          sessionFrom={readout?.from ?? 47 * 60 + 33}
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
                  // The hand comes off the button toward the keyboard. It used to travel to
                  // (+260, +210), which is world y 637 — fine under the 916 establishing shot and
                  // 117px BELOW the punch-in's bottom edge, so the cursor would have slid out of
                  // the frame it was travelling in. It now finishes inside `BEAT11_PLAYER_LANDING`
                  // (x 280–920, y 160–520) with room for its own height.
                  { frame: 46, x: PLAY_CENTRE.x + 170, y: PLAY_CENTRE.y + 56 },
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
