import React from "react";
import { AbsoluteFill } from "remotion";

import { STANDIN } from "../../app/furniture";
import { HomePage } from "../../app/home";
import { Pointer } from "../../app/pointer";
import { Camera, shot } from "../Camera";
import { DASHBOARD } from "../copy";
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
 * The "Start check-in" CTA, in WORLD coordinates.
 *
 * Beat 6's column with no banner puts the welcome header at y 124 (83.1 tall) and the Today card
 * 40px below it, at 247.1 — so the CTA sits inside that card, at its right edge. World
 * coordinates rather than the page's, because a control the cursor has to reach must be in the
 * same space as the cursor; anything placed in `children` resolves against the viewport div and
 * lands 92px low.
 */
const START = { x: 1000, y: 300, w: 152, h: 44 } as const;
const START_AT = { x: START.x + START.w / 2, y: START.y + START.h / 2 };

export const Beat06Later: React.FC = () => (
  <AbsoluteFill>
    <Camera keys={[{ frame: 0, shot: shot(W / 2, H / 2, W) }]}>
      <HomePage
        clock="10:43 AM"
        overlay={
          <>
            {/*
             * The check-in CTA. `<TodaysCheckinCard/>` is a stand-in here — it reads the day's
             * windows from the database as the signed-in user, and with no session it would
             * render an empty state on the beat that is supposed to say the product is live.
             * What the beat needs from it is one button in a known place.
             */}
            <div
              style={{
                position: "absolute",
                left: START.x,
                top: START.y,
                width: START.w,
                height: START.h,
                borderRadius: 8,
                backgroundColor: STANDIN.fill,
                border: `1px solid ${STANDIN.line}`,
                color: STANDIN.ink,
                fontSize: 15,
                fontWeight: 600,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              {DASHBOARD.startCheckIn}
            </div>

            <Pointer
              path={[
                { frame: 0, x: START_AT.x - 190, y: START_AT.y + 120 },
                { frame: 18, x: START_AT.x, y: START_AT.y },
              ]}
              clicks={[22]}
            />
          </>
        }
      />
    </Camera>
  </AbsoluteFill>
);
