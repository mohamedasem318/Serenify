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
 *   the row            528.6 + G          ← the fold is at 675
 *
 * So **148px of two cards sat in shot with their bottom halves below the page's own edge.** No
 * framing could fix it: the column is 1152 wide at x 24–1176, so any frame tight enough to end
 * above the row slices the greeting, and the greeting is a line of type. (Beat 3 never had the
 * problem — with the banner present the row starts below the fold already.)
 *
 * ── AND PUSHING THEM ALL THE WAY OUT WAS THE WRONG ANSWER ───────────────────────────
 *
 * The gap was **150**, which put the row's top at 718.6 and the two cards off the page entirely.
 * The beat then read as a dashboard with nothing under the check-in card, which is not what the
 * product's own page looks like — "Things that might help" and "Recent chats" exist and the shot
 * should say so.
 *
 * The gap is the whole control, and the relationship was **measured off the render rather than
 * taken from the recon's arithmetic**, which was 42px optimistic about where the row starts:
 *
 *   G = 150 (before)   0px      not there at all
 *   G = 148            0px      exactly on the fold
 *   G = 118            30px     top border, corner radius, a sliver
 *   G = 108            40px     the above plus the first line of each label breaking the fold
 *   G = 70             76.3px   measured — too much; both headings and their subtitles show
 *   G = 0              148px    two cards sliced in half — the state that was rejected
 *
 * **112 shows 34.4px, measured on the render** — enough that the cards exist, not enough that
 * either is framed or
 * emphasised. At the full 1200 frame anything inside them reads at ~5px, so what is on screen is
 * shape rather than reading, which is the whole ask.
 *
 * ── AND IT IS A DELIBERATE EXCEPTION TO "NO CONTENT ELEMENT CROPPED AT REST" ────────
 *
 * Recorded so a later pass does not "fix" it. The framing rule bans a content element sliced by
 * the FRAME; this crop is the **page's own fold**, at a shot that is the whole 1200-wide world
 * and involves no framing decision at all. A page that continues past its viewport is what every
 * page does, and beat 3 already shows these same two cards below the fold with the calibration
 * banner in place. The camera crops nothing here.
 */
const SUGGESTIONS_GAP = 112;

export const Beat06Later: React.FC = () => (
  <AbsoluteFill>
    <Camera keys={[{ frame: 0, shot: shot(W / 2, H / 2, W) }]}>
      <HomePage
        clock="10:43 AM"
        overlay={
          <>
            {/* See `SUGGESTIONS_GAP` — the suggestions row sits so that 34.4px of it breaks the
                page's fold: enough to show the two cards exist, not enough to frame either.
                `space-y-10` puts the margin on the row itself, so this addresses the row rather
                than the card. */}
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
