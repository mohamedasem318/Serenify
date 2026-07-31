import React from "react";
import { AbsoluteFill, Easing, interpolate, useCurrentFrame } from "remotion";

import { ConsentGatePage } from "../../app/consent";
import { BEAT4_ESTABLISH, BEAT4_SEAM } from "../../app/framing";
import { centre, GATE } from "../../app/geometry";
import { Hover } from "../../app/hover";
import { Pointer } from "../../app/pointer";
import { Camera, rect, shot } from "../Camera";

/**
 * Beat 4 · Camera consent gate · 120 frames
 *
 * ~230 words. Unreadable at any speed. Do not try.
 *
 * ══ PASS B · THE GATE'S GEOMETRY WAS 64px HIGH, AND THAT IS WHY IT LANDED MID-LAYOUT ══
 *
 * Every rect in `geometry.ts` § GATE used to sit **exactly 64px above where the component
 * renders** — `section` 124 vs 188, `header` 148 vs 212, `facts1` 372.4 vs 436.4, `facts2` 812.6
 * vs 876.6, `buttons` 1161.9 vs 1225.9, `keyLine` 615.1 vs 679.1. 64 is `HEADER_H`: the gate was
 * probed **without the sticky `<Header/>` mounted**, which is the identical defect `geometry.ts`
 * already documents for `HOME` ("every y here was 64px high"). **`GATE` now carries the fix** —
 * this beat frames it directly rather than keeping a locally-corrected copy.
 *
 * The visible symptom was exactly what a 64px error produces: a landing derived from `keyLine`
 * framed 64px of the wrong page, so f150 held a wall of body copy sliced at the top and bottom
 * edges with **no card border anywhere in shot**.
 *
 * ══ AND THE KEY LINE IS `text-sm` (14px), NOT 17 ═════════════════════════════════════
 *
 * `Facts`' items are `text-pretty text-sm leading-relaxed` (`camera-consent-gate.tsx:149`). The
 * sheet's "17px copy reads at 12.7px on a phone" was derived from a size the component does not
 * use, and it is what made a 566-wide landing look sufficient. At 14px the same shot reads at
 * **10.4px**, and the framing rule's cost is real rather than free:
 *
 *   the whole card, all four edges     568 × 416.2 → 16:9 forces **≥ 740 world px** → ≤ 7.98px
 *   its list + bottom border           568 × 362.7 → **659** → **8.96px**
 *   its list alone                     518 × 331.8 → **611** →  9.67px
 *
 * There is no framing that holds a bordered edge of this card and clears the 10px floor — the
 * card is 568 wide in a 1200 world, so 16:9 charges 740px of width for its 416px of height. The
 * landing takes **659** (its list, its bottom border and both side borders, with the frame's top
 * edge in the 12px gutter under the heading and its bottom edge 4px under the card's own border)
 * because a whole visible edge is the acceptance criterion and 8.96 vs 9.67 is not a reading.
 *
 * ══ AND THE BEAT NOW HAS TWO LANDINGS, NOT THREE — IT WAS LINGERING ════════════════
 *
 * It used to establish, scroll, **pull out, push in on the privacy line and hold 34 frames on
 * it**, then fling to the buttons: five movements and 180 frames for a beat whose content is a
 * long page and a button. The middle landing is gone.
 *
 * **The reason is not pacing alone — it is that the claim was being made twice.** This landing
 * held "Nothing is kept. There is no bucket, no table, and no file path where a clip lands.", and
 * beat 5a lands on "Your video isn't stored — only the calm reading it produces." **Same claim,
 * two beats apart**, which makes the second read as a repeat rather than as a promise. Only one
 * of them can be the film's privacy moment, and it is 5a's: the line is tighter, it reads at
 * 10.01px against this one's 8.96, and it lands at the moment the camera is actually about to
 * turn on, which is when a privacy claim carries weight. This beat keeps the page — 230 words of
 * it, visibly scrolling, which is the beat's real content — and hands the sentence to 5a.
 *
 * `BEAT4_LINE` is deleted from `framing.ts` with it; nothing else framed it.
 *
 *   f0–14     establish · badge, heading, lede and the first card's own heading, all whole
 *             (the camera arrives here out of beat 3's move — see `BEAT4_SEAM`)
 *   f14–72    the page scrolls under a held camera — which is how a scroll reads
 *   f72–104   the page flings to its bottom AND the camera pulls to the buttons, together
 *   f108      he clicks "Allow camera and inference"
 */

/**
 * ── THE TWO SCROLL POSITIONS, BOTH DERIVED ─────────────────────────────────────────
 *
 * `A` is gone with the key-line landing — the beat scrolls once, straight through, rather than
 * stopping halfway to read a sentence beat 5a now carries.
 *
 * `B` = 682.9 is the page scrolled to its **bottom**: the gate is 1169.9 tall from y 188, so its
 * last pixel is 1357.9 and the viewport's is 675. That is what makes the CTA landing composable —
 * the frame's bottom edge and the page's own bottom edge coincide at 675, so the shot has no dead
 * space under the buttons and no seam where it ends.
 */
const SCROLL_B = 1357.9 - 675;

const shifted = (r: { x: number; y: number; w: number; h: number }, s: number) =>
  rect(r.x, r.y - s, r.w, r.h);

/**
 * The establishing shot and the key-line landing are `BEAT4_ESTABLISH` and `BEAT4_LINE` in
 * `framing.ts` — both built from `GATE`, now that it carries the sticky header's 64px. Framed
 * here rather than duplicated locally, the way every other beat frames its shots.
 */

/**
 * **The CTA landing**, and its bottom edge is the page's.
 *
 * At `SCROLL_B` the gate's last pixel and the viewport's last pixel are both at world y 675, so a
 * frame whose bottom edge is 675 ends exactly where the page does — no dead backdrop under the
 * buttons, no seam. `frameRect` on the buttons alone would centre 353px of frame on a 108px block
 * and hang 98.6px of nothing below it, which is why this one is placed rather than derived.
 *
 *   frame   x 271.1 – 928.9   y 305 – 675
 *   holds   the second card's last three bullets whole (its top edge is above the frame, its
 *           bottom border at 519 inside it), then both controls, then the page's own end
 *   edge    top 305 sits in the 12px gutter between that card's first and second bullets
 *   reads   the button's 16px label at 10.3px on a phone
 */
const CTA = shot(600, 490, 657.8);

const ALLOW = centre(shifted(GATE.allow, SCROLL_B));

export const Beat04CameraGate: React.FC = () => {
  const frame = useCurrentFrame();

  // The scroll and the push-in OVERLAP by six frames on purpose: if the page settled on the
  // exact frame the camera started, there would be one still frame of a card sliced by the
  // establishing shot's bottom edge. Six frames of shared motion removes it.
  // ONE continuous scroll to the page's bottom, held under an establishing camera and finished
  // under the pull to the buttons. It used to stop at 250 for 58 frames while the camera read a
  // line — see the header.
  const scroll = interpolate(frame, [14, 104], [0, SCROLL_B], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: Easing.inOut(Easing.cubic),
  });

  return (
    <AbsoluteFill>
      <Camera
        keys={[
          // Beat 3's push-in arrives here — the surface changed under a moving camera rather
          // than on a cut. See `BEAT4_SEAM`.
          { frame: 0, shot: BEAT4_SEAM },
          { frame: 14, shot: BEAT4_ESTABLISH },
          // Held while the page scrolls, so the scroll reads as a scroll.
          { frame: 72, shot: BEAT4_ESTABLISH },
          { frame: 104, shot: CTA },
          { frame: 120, shot: CTA },
        ]}
      >
        <ConsentGatePage
          clock="10:24 AM"
          scroll={scroll}
          overlay={
            <>
              {/* §2 — "Allow camera and inference" is `variant="meadow"`
                  (`camera-consent-gate.tsx:121`), so `hover:opacity-90`, snapped: the shipped
                  `transition-colors` does not cover opacity. The window opens as the pointer
                  lands and stays open across the click. */}
              <Hover
                selector="[data-probe='gate'] button"
                treatment="meadow"
                from={106}
                to={120}
              />
              {/* The travel starts after the camera has landed, so the cursor is never drawn
                  outside the frame it is travelling in — at f160 the camera is still flinging and
                  a waypoint down at the buttons would be off-shot until it arrives. */}
              <Pointer
                path={[
                  { frame: 96, x: ALLOW.x + 190, y: ALLOW.y + 78 },
                  { frame: 106, x: ALLOW.x, y: ALLOW.y },
                ]}
                clicks={[108]}
                visible={{ from: 94 }}
              />
            </>
          }
        />
      </Camera>
    </AbsoluteFill>
  );
};
