import React from "react";
import { AbsoluteFill } from "remotion";

import { HOME, centre } from "../../app/geometry";
import { HomePage } from "../../app/home";
import { Hover } from "../../app/hover";
import { Pointer } from "../../app/pointer";
import { Camera, shot } from "../Camera";
import { H, W } from "../theme";

/**
 * Beat 6 · "Later" · 0:42.5–0:43.7 · 36 frames
 *
 * ── IT USED TO SIT FOR 38 FRAMES AFTER THE CLICK ────────────────────────────────────
 *
 * The click is at f22 and the beat ran to f60, so **38 of its 60 frames were a locked-off wide of
 * a dashboard on which nothing happened** — the largest dead hold in the film outside the two
 * protected ones, and the frame the second half's slowdown begins on. Nothing in the beat changes
 * after the press: the page does not respond, the camera does not move, and the next surface is
 * beat 7's.
 *
 * It holds **14** now, which is the first half's own post-click band (beat 4 holds 12 after its
 * gate click, beat 1 holds 12 after "Get started"). Everything before the click is untouched —
 * the pointer's travel, the hover and the press are on exactly the frames they were.
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
 *   G = 112            34.4px   shape only — the state the last pass shipped, and it is what
 *                               "34.4px is not enough" refers to
 *   G = 108            40px     the above plus the first line of each label breaking the fold
 *   G = 80             66.3px   ← HERE. Both headings whole, with air under them
 *   G = 60             86.3px   headings AND both subtitles — more page than the note asked for
 *   G = 0             106.3px   two cards sliced through their body copy
 *
 * ── AND 80 IS WHERE THE HEADINGS BECOME WHOLE, MEASURED ON THE RENDER ───────────────
 *
 * The note is *"their headers need to be readable — 'Things that might help' and 'Recent
 * chats'"*, so the control is no longer "how much card is on screen" but **where the heading's
 * own baseline lands against the fold**. Measured on a still of this beat at frame 1304:
 *
 *   G = 60    card top 942 · heading ink 986–1022 · subtitles 1046–1062 · fold 1080
 *   G = 80    card top 974 · heading ink 1017–1053 · subtitle top 1077 · fold 1080
 *
 * At 80 both headings clear the fold by 27px and it is the **subtitles** the page cuts, which is
 * the same relationship the beat always had, one line further down. `Recent chats`' whole header
 * row comes with it — the "with Ren" qualifier and the "+ New chat" control — because they share
 * the heading's line.
 *
 * The move is 32px UP into the gap, and **nothing above it moves**: the check-in card's bottom
 * border is at output y 845 at G = 112 and at G = 80 alike. The greeting is untouched, which is
 * what the note asked to confirm. Nothing collides — the 112 gap was 32px of empty page and this
 * spends exactly that.
 *
 * **It is still not readable ON A PHONE, and that is stated rather than implied.** `CardTitle` is
 * `text-xl` (20px), so at this beat's full 1200 frame it lands at `PHONE_PX(20, 1200)` = **7.03px**
 * — up from the ~5px the body copy reads at, still under the film's own 10px floor. The three
 * things that would clear it are a tighter framing, the in-place emphasis, or a camera move, and
 * all three are excluded here by the beat and by the note. What the shot delivers is a header that
 * can be read at desk size and recognised at phone size.
 *
 * ── AND IT IS A DELIBERATE EXCEPTION TO "NO CONTENT ELEMENT CROPPED AT REST" ────────
 *
 * Recorded so a later pass does not "fix" it. The framing rule bans a content element sliced by
 * the FRAME; this crop is the **page's own fold**, at a shot that is the whole 1200-wide world
 * and involves no framing decision at all. A page that continues past its viewport is what every
 * page does, and beat 3 already shows these same two cards below the fold with the calibration
 * banner in place. The camera crops nothing here.
 */
const SUGGESTIONS_GAP = 80;

export const Beat06Later: React.FC = () => (
  <AbsoluteFill>
    <Camera keys={[{ frame: 0, shot: shot(W / 2, H / 2, W) }]}>
      <HomePage
        clock="10:43 AM"
        overlay={
          <>
            {/* See `SUGGESTIONS_GAP` — the suggestions row sits so that 66.3px of it breaks the
                page's fold: both headings whole with air under them, and the SUBTITLES are what
                the page cuts. Not framed, not emphasised — the fold does the cropping, not the
                camera. `space-y-10` puts the margin on the row itself, so this addresses the row
                rather than the card. */}
            <style>{`[data-probe='help'], [data-probe='chats'] { }
              [data-probe='today'] + div { margin-top: ${SUGGESTIONS_GAP}px !important; }`}</style>
            {/*
             * §2 — it lights before it is pressed. `variant="meadow"`
             * (`todays-checkin-card.tsx:166`), so `hover:opacity-90`, snapped: the shipped
             * `transition-colors` does not cover opacity.
             */}
            <Hover selector="[data-probe='today'] a" treatment="meadow" from={18} to={36} />
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
