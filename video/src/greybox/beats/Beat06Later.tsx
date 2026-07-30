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

export const Beat06Later: React.FC = () => (
  <AbsoluteFill>
    <Camera keys={[{ frame: 0, shot: shot(W / 2, H / 2, W) }]}>
      <HomePage
        clock="10:43 AM"
        overlay={
          <>
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
