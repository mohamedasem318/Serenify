import React from "react";
import { AbsoluteFill, Easing, interpolate, useCurrentFrame } from "remotion";

import { useDrift } from "../actors";
import { Camera, frameRect, union } from "../Camera";
import { CLOCK, MailMark } from "../chrome";
import { TOAST } from "../copy";
import { useEmphasis } from "../lift";
import { useExpression } from "../rig";
import { monitorWide, MonitorSurface, SESSION_BASE, TOAST_BOX, VIEWFINDER } from "../surfaces";
import { GREY } from "../theme";
import { Box, Text } from "../ui";

/**
 * Beat 8 · The email · 0:49–0:55.7 · 200 frames
 *
 * The core beat, and the largest single allocation in the video. No cutaway, no
 * cut — one continuous camera move that goes in on the toast and his face, then
 * eases back out to catch the bloom drift and the stateline changes. Cutting
 * between those two framings would break the cause-and-effect that is the whole
 * point of the beat.
 *
 * The order is load-bearing, and is what the frame numbers below encode:
 *   the toast lands and is read  → f6–f70
 *   HIS FACE FALLS               → f70–f86, and it happens at the TIGHT framing
 *   the bloom drifts             → f104 + 39 frames (1.3s ease — it drifts, it
 *                                  does not snap)
 *   the stateline steps twice    → f130, f156, both under one raise
 *   the trend climbs and recolours
 *
 * The toast stays up throughout.
 *
 * **THE CAMERA NOW HOLDS TIGHT THROUGH THE FALL — 180 → 200 frames.** The rig spike
 * surfaced this and it was invisible before it: the camera used to arrive tight at f48
 * and start pulling out immediately, so by f78, where the face fell, the shot was
 * already ~930px wide and his head was ~45px on a phone. The most important fifteen
 * frames in the video were playing at the size where the rig reads least. The hold now
 * runs f36–f92 and the whole fall is inside it, at ~100px of head. The 20 extra frames
 * are what keeps the second stateline change (f156) readable rather than paying for the
 * fall out of it.
 *
 * ── THE THREE-WAY FRAMING QUESTION, AND WHAT IT COST ────────────────────────
 *
 * The push-in must hold the notification and his face together (L2, load-bearing).
 * The emphasis rule wants the stateline in frame when its copy changes. **No single
 * framing does both**, and the reason is geometry, not craft: the stateline block
 * sits at world x 270–670 and the toast/viewfinder stack at x 856–1176. A shot
 * holding all three spans 906px of world, i.e. 2.0× against the wide shot's 1.75× —
 * barely a push-in, with the toast's subject line at ~6px on a phone. The beat's own
 * key text would become unreadable to keep a device on screen.
 *
 * So it is split across the one continuous move the beat already had:
 *   · **tight** (f36–f92) holds clock + toast + face. The toast is READ here and the
 *     face falls here.
 *   · **wide** (f130 on) holds the whole card, the viewfinder, and the toast still up
 *     — the stateline changes twice here, with the emphasis raised.
 *
 * What was given up: at the wide framing the toast is *present* but not *readable*.
 * That is the right thing to lose — it was read seconds earlier at 3.1×, and after
 * that its job is to still be up while the reading falls, which the wide shot does.
 *
 * The tight shot also forces the emphasis handoff: it frames from world x 708 and the
 * raised block's right edge is at x 800, so a block raised across the beat-7 join put
 * a sliced word in this beat's key shot. Beat 7 settles; this beat raises **once**,
 * at f96 as the camera lands wide, and that one raise carries BOTH copy changes
 * (f104, f138) before settling at f158. No yo-yo, which is the hard constraint.
 *
 * **The clock is in the tight shot** (see `CLOCK` in `chrome.tsx`), which is what
 * makes the beat's arithmetic possible: 11:30 and "by 12", side by side, unremarked.
 * Adding it widened the tight shot 590 → 615, about 4%.
 */

const Toast: React.FC<{ slide: number }> = ({ slide }) => (
  <div style={{ translate: `${(1 - slide) * 320}px 0px`, opacity: slide }}>
    <Box
      x={TOAST_BOX.x}
      y={TOAST_BOX.y}
      w={TOAST_BOX.w}
      h={TOAST_BOX.h}
      fill={GREY.surface}
      border={GREY.graphite}
      borderWidth={2}
      radius={10}
    />
    {/*
     * The disambiguator. A generic toast beside the Serenify viewfinder can read
     * as *Serenify* notifying him, which would invert the scene — so this is the
     * same <MailMark> established in 2e, at 30px rather than a subtler size,
     * because the sheet says to fix any ambiguity by growing the icon and never
     * by moving the toast (the adjacency is liberty L2 and is load-bearing).
     */}
    <div style={{ position: "absolute", left: TOAST_BOX.x + 12, top: TOAST_BOX.y + 12 }}>
      <MailMark size={30} />
    </div>
    <Text x={TOAST_BOX.x + 50} y={TOAST_BOX.y + 12} size={13} weight={700} color={GREY.body}>
      {TOAST.app} · {TOAST.when}
    </Text>
    <Text x={TOAST_BOX.x + 50} y={TOAST_BOX.y + 30} size={15} weight={700}>
      {TOAST.sender}
    </Text>
    <Text x={TOAST_BOX.x + 12} y={TOAST_BOX.y + 56} w={TOAST_BOX.w - 24} size={14} color={GREY.ink} lineHeight={1.3}>
      {TOAST.subject}
    </Text>
  </div>
);

/** Clock + toast + face, as one vertical stack. All three right-aligned to 1176. */
const NOTICE = union(CLOCK, union(TOAST_BOX, VIEWFINDER));

export const Beat08Email: React.FC = () => {
  const frame = useCurrentFrame();

  const slide = interpolate(frame, [6, 22], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: Easing.out(Easing.cubic),
  });

  // 1.3s at 30fps. The honest transition, and it looks better than a snap. It starts
  // as the camera begins pulling out, so the drift is seen rather than spent behind
  // the tight shot — the bloom is at world x 470 and not in the tight frame at all.
  const tension = useDrift(104, 39);
  const climb = useDrift(116, 60);
  /**
   * **THE FALL, as a keyframed transition rather than a state flip.**
   *
   * `falling` used to be a *state* the face switched into, which is the thing the rig
   * exists to make impossible: on a face, switching reads as a jump cut. It is now 14
   * frames of continuous travel through the whole pose vector at once — brows lifting
   * at the inner ends, eyes widening, jaw going slack, head and shoulders sinking —
   * and then a slower settle into `tense` under the second stateline change.
   *
   * He also stops typing at f70 and does not start again in this beat. That is what
   * makes beat 11's "he never stopped working" land: there is something to resume.
   */
  const pose = useExpression([
    { frame: 0, state: "content" },
    { frame: 70, state: "content" },
    { frame: 86, state: "dismayed" },
    { frame: 110, state: "dismayed" },
    { frame: 148, state: "tense" },
  ]);
  const stateline = frame >= 156 ? "tense" : frame >= 130 ? "little" : "ease";

  /** One rise as the camera lands wide, two copy changes, one settle. */
  const emphasis = useEmphasis(126, 18, 182, 16);

  const wide = monitorWide(20);
  const tight = frameRect(NOTICE, 12);

  return (
    <AbsoluteFill>
      <Camera
        keys={[
          // Continuity with beat 7's closing framing.
          { frame: 0, shot: wide },
          { frame: 14, shot: frameRect(NOTICE, 80) },
          { frame: 36, shot: tight },
          // HOLD. The toast is read and the face falls, both at ~3.1×.
          { frame: 92, shot: tight },
          { frame: 130, shot: wide },
          { frame: 200, shot: monitorWide(14) },
        ]}
      >
        <MonitorSurface
          clock={TOAST.clock}
          tension={tension}
          stateline={stateline}
          climb={climb}
          pose={pose}
          working={frame < 70}
          emphasis={emphasis}
          sessionFrom={SESSION_BASE + 4}
        >
          <Toast slide={slide} />
        </MonitorSurface>
      </Camera>
    </AbsoluteFill>
  );
};
