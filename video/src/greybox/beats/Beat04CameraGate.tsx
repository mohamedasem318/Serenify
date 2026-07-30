import React from "react";
import { AbsoluteFill, Easing, interpolate, useCurrentFrame } from "remotion";

import { ConsentGatePage } from "../../app/consent";
import { GATE, centre } from "../../app/geometry";
import { Hover } from "../../app/hover";
import { Pointer } from "../../app/pointer";
import { Camera, frameRect, rect, union } from "../Camera";

/**
 * Beat 4 · Camera consent gate · 180 frames
 *
 * ~230 words. Unreadable at any speed. Do not try.
 *
 * ══ IT IS THE REAL GATE NOW ═════════════════════════════════════════════════════════
 *
 * `<CameraConsentGate/>` — the badge, the heading, both bordered `<Facts/>` cards and both
 * buttons, with every string coming from `lib/consent/copy.ts`. The greybox drew the ~230 words
 * as bars, which was defensible while nothing in the beat was readable; what was not defensible
 * is that the ONE line the beat exists to deliver was a hand-typed copy of a shipped string.
 *
 * ══ AND THE SWAP MOVED THE LINE ═════════════════════════════════════════════════════
 *
 * The sheet stages this beat as "one landing holds the key line's card AND the button, both
 * complete", which rests on the privacy pitch being in the card nearest the CTA. **It is not.**
 * It is `CAMERA_GATE_WHAT_HAPPENS[2]` — the third bullet of the FIRST card, 550px further up the
 * page — and the first render after the swap landed on "What declining changes", which is a real
 * card, correctly rendered, and the wrong one.
 *
 * Key-line top to Allow's bottom is 594.8px against a 583px viewport, so **they miss sharing a
 * frame by 11.8px.** No scroll closes it; it is the closest near-miss in the film. So the beat
 * takes two landings inside one continuous move, which is this sheet's own remedy for this
 * class of problem:
 *
 *   f0–96    establish, and the page scrolls under a held camera — which is how a scroll reads
 *   f96–124  push to the key line ALONE, at 566 world px
 *   f124–150 HOLD. 17px of body copy lands at 12.7px on a phone, which is read, not recognised
 *   f150–168 the page scrolls the rest of the way AND the camera pulls to the buttons, together
 *   f172     he clicks "Allow camera and inference"
 *
 * **COST: 5s → 6s**, and it is the second landing. The beat had 5s for four events — establish,
 * scroll, read, click — on the assumption the last two shared a frame. They do not, so the
 * second landing needs its own second. This is the same bill the one-take invariant has paid
 * everywhere else in the film: the cost is paid rather than dodged.
 */

/**
 * Where the page sits while the key line is read.
 *
 * 330, not 380: at 380 the shot's top edge reaches world y 121.6 and catches the sticky app
 * header. The header is full-bleed furniture and the framing rule permits it running off the
 * left and right edges — but a nav bar hanging in the top of a shot whose subject is one
 * paragraph reads as a mis-framing rather than as background. At 330 the frame starts at 171.6,
 * clear of the header's 156.
 */
const SCROLL_A = 330;
/** …and where it sits for the CTA. */
const SCROLL_B = 560;

const shifted = (r: { x: number; y: number; w: number; h: number }, s: number) =>
  rect(r.x, r.y - s, r.w, r.h);

/** The establishing shot: the badge, the heading and the top of the first card. */
const ESTABLISH = frameRect(
  union(GATE.header, rect(GATE.facts1.x, GATE.facts1.y, GATE.facts1.w, 180)),
  24,
);
/** The privacy pitch, alone and whole. */
const KEY = frameRect(shifted(GATE.keyLine, SCROLL_A), 24);
/** Both controls, whole, with the CTA the beat ends on. */
const CTA = frameRect(shifted(GATE.buttons, SCROLL_B), 30);

const ALLOW = centre(shifted(GATE.allow, SCROLL_B));

export const Beat04CameraGate: React.FC = () => {
  const frame = useCurrentFrame();

  const scroll = interpolate(frame, [26, 96, 150, 168], [0, SCROLL_A, SCROLL_A, SCROLL_B], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: Easing.inOut(Easing.cubic),
  });

  return (
    <AbsoluteFill>
      <Camera
        keys={[
          { frame: 0, shot: ESTABLISH },
          // Held while the page scrolls, so the scroll reads as a scroll.
          { frame: 96, shot: ESTABLISH },
          { frame: 124, shot: KEY },
          { frame: 150, shot: KEY },
          { frame: 168, shot: CTA },
          { frame: 180, shot: CTA },
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
                from={168}
                to={180}
              />
              <Pointer
                path={[
                  { frame: 150, x: ALLOW.x + 230, y: ALLOW.y + 120 },
                  { frame: 168, x: ALLOW.x, y: ALLOW.y },
                ]}
                clicks={[172]}
                visible={{ from: 148 }}
              />
            </>
          }
        />
      </Camera>
    </AbsoluteFill>
  );
};
