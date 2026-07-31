import React from "react";
import { AbsoluteFill } from "remotion";

import { COMPOSITE, PHONE } from "../../app/framing";
import { MonitorPage } from "../../app/monitor";
import { useEmphasis } from "../../app/motion";
import { Camera } from "../Camera";
import { useExpression } from "../rig";

/**
 * Beat 7 · Working, at ease · 120 frames
 *
 * The "before". The audience needs the settled state registered or the fall in beat 8 has
 * nothing to fall from.
 *
 * ── WHAT L14 CHANGED HERE ───────────────────────────────────────────────────────────
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
  // The block goes up, is read, and settles HERE — beat 8 raises its own, once, covering both
  // of its copy changes. The join was tried and the framing does not allow it.
  const emphasis = useEmphasis([
    { frame: 0, up: 0 },
    { frame: 60, up: 0 },
    { frame: 76, up: 1 },
    { frame: 104, up: 1 },
    { frame: 120, up: 0 },
  ]);

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
          emphasis={emphasis}
        />
      </Camera>
    </AbsoluteFill>
  );
};

/** Legibility, checked rather than asserted. See `framing.ts` for the table this feeds. */
export const BEAT07_LEGIBILITY = PHONE.composite;
