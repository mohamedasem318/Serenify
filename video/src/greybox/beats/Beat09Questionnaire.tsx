import React from "react";
import { AbsoluteFill, useCurrentFrame } from "remotion";

import { ConfirmatoryPrompt } from "@/components/questionnaire/confirmatory-prompt";

import { BEAT8_WIDE, COMPOSITE } from "../../app/framing";
import { MonitorPage } from "../../app/monitor";
import { useToastIn } from "../../app/motion";
import { Camera } from "../Camera";
import { useExpression } from "../rig";

/**
 * Beat 9 · Confirmatory questionnaire · 90 frames
 *
 * He answers, and confirms the stress is real — the TRUE-POSITIVE branch. The landing hero
 * deliberately shows the false alarm; that inversion is intentional and is not reconciled.
 *
 * ── THE COMPONENT SWAP ──────────────────────────────────────────────────────────────
 *
 * The prompt is now the real `<ConfirmatoryPrompt/>`, which is the real `<Notification/>`
 * underneath — so the title, the body, the three options, the shape and the dark treatment are
 * the product's rather than drawn approximations. The copy was already verbatim in the greybox;
 * what is new is that the surface is.
 *
 * `<Notification/>` chooses between a desktop toast and a mobile sheet on
 * `useMediaQuery("(max-width: 767px)")` (`notification.tsx:119`). That is the one query the
 * media-query shim answers HONESTLY rather than forcing — it is a layout decision, not a motion
 * one — and it resolves against the 1200px world, so the video gets the desktop variant. A
 * blanket reduced-motion shim would have silently put the whole film on mobile layouts, and it
 * would have looked like a design choice rather than a bug.
 *
 * Its entrance is framer-motion and so cannot run in a frame-addressed render. It takes the
 * shipped static variant and the video re-authors the slide from the frame — the same curve the
 * mail toast uses, deliberately: two macOS-shaped toasts on one screen with two different
 * entrance curves read as two different operating systems.
 *
 * The prompt is `nonModal` and portals to the document body, so it is placed in the world
 * overlay layer rather than in the page, which is also where it belongs visually — it is
 * sticky, beside the stage, not part of the scrolling column.
 */
export const Beat09Questionnaire: React.FC = () => {
  const frame = useCurrentFrame();
  const enter = useToastIn(6);

  // Still tense, picking up exactly where beat 8 left the pose. NOT working — he has stopped to
  // answer, which is the beat. He does not resume until beat 11, and that resumption is what
  // makes "he never stops working" land: there has to be something to resume.
  const pose = useExpression([{ frame: 0, state: "tense" }]);

  return (
    <AbsoluteFill>
      <Camera
        keys={[
          // Picks up beat 8's closing framing, then eases in on the prompt.
          { frame: 0, shot: BEAT8_WIDE },
          { frame: 34, shot: COMPOSITE },
          { frame: 90, shot: COMPOSITE },
        ]}
      >
        <MonitorPage
          clock="11:30 AM"
          band="tense"
          tension={1}
          climb={1}
          pose={pose}
          emphasis={1}
          sessionFrom={47 * 60 + 23}
          overlay={
            <div style={{ translate: `${enter.x}px 0`, opacity: enter.opacity }}>
              <ConfirmatoryPrompt
                open
                onConfirm={() => {}}
                onFalseAlarm={() => {}}
                onOpenChat={() => {}}
              />
            </div>
          }
        />
      </Camera>
    </AbsoluteFill>
  );
};
