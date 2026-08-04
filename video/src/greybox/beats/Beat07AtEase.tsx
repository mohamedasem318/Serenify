import React from "react";
import { AbsoluteFill } from "remotion";

import { COMPOSITE, PHONE } from "../../app/framing";
import { MonitorPage } from "../../app/monitor";
import { Camera } from "../Camera";
import { useExpression } from "../rig";

/**
 * Beat 7 · Working, at ease · 72 frames
 *
 * The "before". The audience needs the settled state registered or the fall in beat 8 has
 * nothing to fall from.
 *
 * ══ IT WAS THE SLOWEST BEAT IN THE FILM AND NOTHING HAPPENED IN IT ══════════════════
 *
 * At 120 it was **a 60-frame push followed by a 60-frame hold with no event in either half** —
 * L15 took the stateline's raise off this beat and nothing replaced it, so the note that the
 * push "lands at f60 and the raise fires inside the hold" describes a raise that no longer
 * exists. Two numbers say how far out of band that is: the film's own camera moves run 22 frames
 * at the median, and this one spent 60 on a **10% push** (974 → 884.4); and the first half's dead
 * dwell — settled frames with nothing changing — runs 6 frames at the median, and this one held
 * 60.
 *
 * It is **36 and 36**. The push is still the film's longest move, which a settle onto a calm
 * frame is entitled to, and the hold is still the film's longest dead one outside the two
 * protected reads — which the beat the whole fall depends on is also entitled to. What is gone
 * is the second of those being doubled on top of the first.
 *
 * **Nothing is cut that has to be READ.** The stateline is legible for the whole beat, not only
 * after the landing: the push travels 974 → 884.4, so the head runs 15.6px → 17.18px on a phone
 * and never approaches the floor. The copy is on screen for 72 frames — 2.4s on a three-word head
 * and a one-line sub.
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
 * legibility floor at a 884.8-wide composite; the composite is 927 and the head reads at 16.4px,
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
 * softer than it is. The push was split off from the hold for that reason and the split survives
 * the raise's removal: the camera lands, and the beat holds. Same shot, no cut.
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
          // The push LANDS here, and the beat holds for the same 36 frames it travelled for.
          { frame: 36, shot: COMPOSITE },
          { frame: 72, shot: COMPOSITE },
        ]}
      >
        <MonitorPage
          clock="11:30 AM"
          // At ease: one number, and everything reads it. See `monitor.tsx`
          // § ONE READING, READ TWICE.
          level={0}
          tension={0}
          pose={pose}
          working
        />
      </Camera>
    </AbsoluteFill>
  );
};

/** Legibility, checked rather than asserted. See `framing.ts` for the table this feeds. */
export const BEAT07_LEGIBILITY = PHONE.composite;
