import React from "react";
import { AbsoluteFill } from "remotion";

import { HOME, centre } from "../../app/geometry";
import { HomePage } from "../../app/home";
import { Hover } from "../../app/hover";
import { Pointer } from "../../app/pointer";
import { Camera, shot } from "../Camera";
import { H, W } from "../theme";

/**
 * Beat 6 · "Later" · 0:43–0:45 · 60 frames
 *
 * Continues straight from beat 5, which lands on the dashboard itself. The calibration banner is
 * gone — **that absence is the beat's visible content** — and he clicks "Start check-in".
 *
 * It is the same component as beat 3 with one flag off, which is what makes the absence read: the
 * `space-y-10` column closes up and everything below the missing banner moves up by 126, exactly
 * as the product does when `has_anchor` flips. A separately-drawn "beat 6 dashboard" could not
 * have produced that, and would have drifted from beat 3 the first time either was touched.
 *
 * **The "later that morning" line is GONE.** No replacement.
 *
 * **Shot:** locked on the full frame, and it has to be — the dashboard column is `max-w-6xl`
 * (1152) at x 24–1176, so any tighter framing slices the greeting. See `SUGGESTIONS_GAP` below
 * for what fixed the cut containers instead.
 *
 * The time jump is DECIDED and out of scope: the toolbar clock reads 10:43 here and 11:30 in
 * beat 7, and the session timer reads `47:12`, so the information is on screen and consistent —
 * but it will still play as continuous time and that is fine. Do not spend anything on it.
 */

/**
 * ── THE CTA IS THE CARD'S OWN NOW, AND IT USED TO BE A DRAWN RECTANGLE ──────────────
 *
 * The beat drew its own 152 × 44 "Start check-in" button, floating over the page at (1000, 300),
 * and clicked that — because `<TodaysCheckinCard/>` underneath it was a grey skeleton with no
 * button in it. Both are gone. The card renders its real static-default state, which is the state
 * that **ships this CTA**, and the pointer travels to the control's measured centre.
 *
 * The old position was not even close: the real CTA is 126.3 × 40 at **(49, 399.6)** — bottom
 * LEFT of the card, where the component puts it (`CardContent … flex flex-col items-start`) —
 * against a drawn button at the top right. The beat was clicking empty page.
 */
const START = centre(HOME.startCheckIn);

/**
 * ── THE TWO CARDS AT THE BOTTOM WERE CUT BY THE PAGE, NOT BY THE CAMERA ─────────────
 *
 * With the calibration banner gone everything below it moves up by 126 — which is the beat's
 * whole visible content — and that is also what dragged the suggestions row into the viewport:
 *
 *   welcome            188 – 271.1
 *   today's check-in   311.1 – 528.6
 *   the row            568.6 – 744.9      ← the fold is at 675
 *
 * So **106px of two cards sat in shot with their bottom halves below the page's own edge.** No
 * framing could fix it: the column is 1152 wide at x 24–1176, so any frame tight enough to end
 * above the row slices the greeting, and the greeting is a line of type. (Beat 3 never had the
 * problem — with the banner present the row starts at 694.6, already below the fold.)
 *
 * The gap under the check-in card is widened for the film so the row clears the fold entirely:
 * **146.4px is the exact amount** (744.9 − 675 + the 40 the gap already carries would put its top
 * at 675.0), and 150 is used so nothing lands on the edge itself. The row is still in the DOM and
 * still real — it is simply below the fold, where beat 3 already has it, and a page that
 * continues past its own viewport is what every page does.
 *
 * The visible cost is ~146px of empty page under the check-in card. That reads as page; two cards
 * sliced in half read as a rendering fault.
 */
const SUGGESTIONS_GAP = 150;

export const Beat06Later: React.FC = () => (
  <AbsoluteFill>
    <Camera keys={[{ frame: 0, shot: shot(W / 2, H / 2, W) }]}>
      <HomePage
        clock="10:43 AM"
        overlay={
          <>
            {/* See `SUGGESTIONS_GAP` — the suggestions row is pushed clear of the page's fold
                so it is below it entirely rather than cut in half by it. `space-y-10` puts the
                margin on the row itself, so this addresses the row rather than the card. */}
            <style>{`[data-probe='help'], [data-probe='chats'] { }
              [data-probe='today'] + div { margin-top: ${SUGGESTIONS_GAP}px !important; }`}</style>
            {/*
             * §2 — it lights before it is pressed. `variant="meadow"`
             * (`todays-checkin-card.tsx:166`), so `hover:opacity-90`, snapped: the shipped
             * `transition-colors` does not cover opacity.
             */}
            <Hover selector="[data-probe='today'] a" treatment="meadow" from={18} to={40} />
            <Pointer
              path={[
                { frame: 0, x: START.x + 190, y: START.y + 120 },
                { frame: 18, x: START.x, y: START.y },
              ]}
              clicks={[22]}
            />
          </>
        }
      />
    </Camera>
  </AbsoluteFill>
);
