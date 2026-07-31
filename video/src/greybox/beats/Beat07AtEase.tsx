import React from "react";
import { AbsoluteFill } from "remotion";

import { COMPOSITE, PHONE } from "../../app/framing";
import { MonitorPage } from "../../app/monitor";
import { Camera } from "../Camera";
import { useExpression } from "../rig";

/**
 * Beat 7 · Working, at ease · 120 frames
 *
 * The "before". The audience needs the settled state registered or the fall in beat 8 has
 * nothing to fall from.
 *
 * ── WHAT L15 CHANGED HERE ───────────────────────────────────────────────────────────
 *
 * **The composite holds four things now, not three** — the orb, the stateline, the trend and his
 * face — and the stage card is whole inside it for the first time. The page does not scroll, the
 * emphasis does not fire, and the beat is one push onto one shot that the next four beats keep.
 *
 * ── AND THE STATELINE NO LONGER GROWS ────────────────────────────────────────────────
 *
 * L12's in-place raise is off the statelines. It existed to carry the 17px sub over the phone
 * legibility floor at a 884.8-wide composite; the composite is 840 and the head reads at 18.1px,
 * so the device was decorating a line that is legible at rest. It is unchanged elsewhere — beat
 * 5a's privacy line still takes it. See `geometry.ts` § THE EMPHASIS LEAVES THE STATELINE.
 *
 * ── WHAT L14 CHANGED BEFORE THAT ────────────────────────────────────────────────────
 *
 * The composite is now bloom + stateline + **the pinned viewfinder at x 856–1176**, and the
 * page column is `max-w-lg` (512) rather than `max-w-3xl` (768). The bloom does not move — it
 * is centred, so 512 lands it at exactly the 456–744 it occupied at 768 — and what changes is
 * that the viewfinder is no longer an overlay inside a scrolling card. It cannot be covered by
 * the mail toast (beat 8's defect), and it cannot be scrolled off (beat 11's).
 *
 * The page sits at `SCROLL.monitor` = 28 and does not move for three whole beats. That is not a
 * device — the real monitoring page is ~1100px tall below the chrome against a 583px viewport,
 * so it scrolls in the product too — and 28 is what puts the card top at 160, which is what
 * gives L12's raise its room. The old value was 40 and was the ONLY value that worked, because
 * the `Session · MM:SS` readout sat in a row above the card under a sticky header; that row is
 * inside the card's own `pt-16` band now, and the constraint went with it.
 *
 * **The emphasis cannot cover the bloom, and it cannot by construction rather than by
 * arrangement.** It grows downward from the stateline block's own top edge, so the top never
 * moves; the real `mt-6` puts 24px between the bloom's bottom and that edge and nothing in the
 * video is allowed to spend it.
 *
 * ── AND IT NOW FIRES ON A HELD FRAME ────────────────────────────────────────────────
 *
 * The beat used to push in across all 120 frames with the raise firing at f36, so the block grew
 * while the camera was still travelling and the two movements cancelled — the device read as
 * softer than it is. The push now lands at **f60** and the beat holds for its whole second half;
 * the raise fires inside that hold. Same shot, same duration, no cut.
 */
export const Beat07AtEase: React.FC = () => {
  // Content throughout. This is the face beat 8 has to fall FROM, so it is held rather than
  // played. He is working — gaze down at the keyboard, the shoulders carrying the typing.
  const pose = useExpression([{ frame: 0, state: "content" }]);

  return (
    <AbsoluteFill>
      <Camera
        keys={[
          { frame: 0, shot: { ...COMPOSITE, w: COMPOSITE.w + 90 } },
          // The push LANDS here, and the beat holds. The raise fires inside the hold.
          { frame: 60, shot: COMPOSITE },
          { frame: 120, shot: COMPOSITE },
        ]}
      >
        <MonitorPage
          clock="11:30 AM"
          band="at_ease"
          tension={0}
          climb={0}
          pose={pose}
          working
        />
      </Camera>
    </AbsoluteFill>
  );
};

/** Legibility, checked rather than asserted. See `framing.ts` for the table this feeds. */
export const BEAT07_LEGIBILITY = PHONE.composite;
