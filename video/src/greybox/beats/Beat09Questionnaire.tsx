import React from "react";
import { AbsoluteFill, useCurrentFrame } from "remotion";

import { ConfirmatoryPrompt } from "@/components/questionnaire/confirmatory-prompt";

import { BEAT8_WIDE, COMPOSITE } from "../../app/framing";
import { PROMPT_SCREEN, centre, emphasisCapFor } from "../../app/geometry";
import { Hover } from "../../app/hover";
import { MonitorPage } from "../../app/monitor";
import { useToastIn } from "../../app/motion";
import { Pointer } from "../../app/pointer";
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
/**
 * ── THE CLICK HAS A CAUSE NOW, AND IT HAS TO LIVE IN SCREEN SPACE ───────────────────
 *
 * A focus ring arriving on "Yes, that's me" with nothing touching it reads as a stray keyboard
 * focus rather than as a person deciding — which inverts the one beat whose entire subject is
 * *he was asked and he answered*. So the pointer travels to the option and presses it.
 *
 * It is drawn OUTSIDE `<Camera>`, in output pixels, and that is forced rather than chosen.
 * `<Notification/>` portals to `document.body` and is `fixed right-4 … bottom-[…]`
 * (`notification.tsx:186`), so it resolves against the 1920×1080 frame and is outside the
 * camera's transform entirely — a wrapper cannot move it, because the portal escapes the
 * wrapper. A world-space cursor would therefore travel to where the prompt *would* be if the
 * prompt were in the world, and miss it by the whole camera transform. **That the prompt sits
 * bottom-right of the frame regardless of where the camera is looking is the known framing
 * complaint, and Pass B owns it**; what is fixed here is only that the click has a cause.
 */
export const Beat09Questionnaire: React.FC = () => {
  const frame = useCurrentFrame();
  const enter = useToastIn(6);
  const yes = centre(PROMPT_SCREEN.yes);

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
          // Picks up beat 8 exactly: the block is still notionally raised, and the factor is
          // the two-line `tense` copy's cap — which is ~1, so it reads as settled. Passing 0
          // instead would be a second settle the audience has already watched.
          emphasis={1}
          emphasisFactor={emphasisCapFor(2)}
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

      {/*
       * §2 — "Yes, that's me" lights before it is pressed. The prompt's options are not
       * `<Button/>`s: `OPTION` (`confirmatory-prompt.tsx:27`) is its own class list with
       * `hover:bg-[color-mix(in_srgb,var(--color-foggy)_8%,var(--color-surface))]` over
       * `transition-colors`, so this one genuinely EASES over 150ms rather than snapping.
       * `:first-of-type` because the three options share a class list and only the first is
       * touched — the sheet's true-positive branch.
       */}
      <Hover
        selector="[data-testid='notification'] button:first-of-type"
        treatment="promptOption"
        from={56}
        to={90}
      />

      {/* Screen space, outside the camera — see the header. */}
      <Pointer
        path={[
          { frame: 26, x: yes.x - 210, y: yes.y + 150 },
          { frame: 56, x: yes.x, y: yes.y },
        ]}
        clicks={[62]}
        visible={{ from: 24 }}
      />
    </AbsoluteFill>
  );
};
