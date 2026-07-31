import React from "react";
import { AbsoluteFill } from "remotion";

import { ConfirmatoryPrompt } from "@/components/questionnaire/confirmatory-prompt";

import { BEAT8_WIDE, BEAT9_PROMPT, PHONE, useShotAt } from "../../app/framing";
import { PROMPT, centre, emphasisCapFor } from "../../app/geometry";
import { Hover } from "../../app/hover";
import { MonitorPage, WorldOverlay, WorldPrompt } from "../../app/monitor";
import { useToastIn } from "../../app/motion";
import { Pointer } from "../../app/pointer";
import { Camera, CameraKey } from "../Camera";
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
 * The prompt is `nonModal` and portals to the document body — which is where it belongs
 * visually, since it is sticky beside the stage rather than part of the scrolling column, and
 * which until L14 was also the reason the camera could not look at it.
 */
/**
 * ══ THE FRAMING COMPLAINT, CLOSED ═══════════════════════════════════════════════════
 *
 * **The beat used to click a control the camera was not looking at.** `<Notification/>` portals
 * to `document.body` and is `fixed right-4 … bottom-[…]` (`notification.tsx:186`), so it
 * resolved against the 1920×1080 output frame: the prompt sat bottom-right of the picture no
 * matter where the shot was, the camera held on the orb through the entire question, and the
 * pointer had to be drawn in output pixels to reach it. Everything about the beat was correct
 * except the one thing it is for.
 *
 * `PROMPT` is a world rect now — x 856–1176, y 405–695, the last surface in the pinned right
 * column — and `<WorldPrompt/>` (`monitor.tsx`) projects the portalled node through the
 * camera's own transform each frame. So:
 *
 *  · the camera **pushes in on the prompt**, landing at `BEAT9_PROMPT` (601 world px) where the
 *    three options' 15px copy reads at **10.5px on a phone**, over the floor;
 *  · the prompt is whole in the frame, all four edges, with its last 20px on the camera backdrop
 *    (which is the page's own colour, so the world's bottom edge is invisible);
 *  · the pointer travels in **world coordinates** and is magnified by the camera with everything
 *    else, and the click lands on "Yes, that's me" because both are derived from `PROMPT.yes`.
 *
 * The cursor is drawn in `<WorldOverlay/>` rather than inside `<Camera>` for one structural
 * reason worth naming: the portalled prompt is a `document.body` child at `z-index: 50`, and
 * `<Camera>`'s transform makes its subtree a stacking context — so a cursor inside the camera
 * would be painted UNDER the button it is pressing. `<WorldOverlay/>` is the same transform in a
 * sibling layer above it, so the authoring stays world-space and the stacking works out.
 *
 * A focus ring arriving on an option with nothing touching it would read as a stray keyboard
 * focus rather than as a person deciding, which inverts the one beat whose entire subject is
 * *he was asked and he answered*. The hand is why the click has a cause.
 */
/** One array, used by `<Camera>` AND by the projection — they cannot disagree. */
const KEYS: CameraKey[] = [
  // Picks up beat 8's closing framing and holds four frames past the prompt's arrival — the
  // camera reacts to it rather than anticipating it — then eases in and HOLDS. The click at f66
  // happens 24 frames after the camera has stopped.
  { frame: 0, shot: BEAT8_WIDE },
  { frame: 10, shot: BEAT8_WIDE },
  { frame: 42, shot: BEAT9_PROMPT },
  { frame: 90, shot: BEAT9_PROMPT },
];

export const Beat09Questionnaire: React.FC = () => {
  const enter = useToastIn(6);
  const shot = useShotAt(KEYS);
  const yes = centre(PROMPT.yes);

  // Still tense, picking up exactly where beat 8 left the pose. NOT working — he has stopped to
  // answer, which is the beat. He does not resume until beat 11, and that resumption is what
  // makes "he never stops working" land: there has to be something to resume.
  const pose = useExpression([{ frame: 0, state: "tense" }]);

  return (
    <AbsoluteFill>
      <Camera keys={KEYS}>
        <MonitorPage
          clock="11:30 AM"
          band="tense"
          tension={1}
          climb={1}
          pose={pose}
          // Picks up beat 8 exactly: the raise fired on the first copy change and settled as the
          // second landed, so the block is SEATED when this beat opens. Passing 1 would re-raise
          // it on a cut boundary with nothing causing it.
          emphasis={0}
          emphasisFactor={emphasisCapFor(2)}
          sessionFrom={47 * 60 + 23}
        />
      </Camera>

      {/*
       * The prompt itself. It is rendered OUTSIDE `<Camera>` because Radix portals it to the
       * document body regardless — rendering it inside would be a lie about where the node ends
       * up. `<WorldPrompt/>` is what actually places it, in world coordinates, per frame.
       */}
      <WorldPrompt shot={shot} enter={enter}>
        <ConfirmatoryPrompt
          open
          onConfirm={() => {}}
          onFalseAlarm={() => {}}
          onOpenChat={() => {}}
        />
      </WorldPrompt>

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
        from={60}
        to={90}
      />

      {/* World coordinates, magnified by the camera — see the header for why the layer is a
          sibling of `<Camera>` rather than a child of it. */}
      <WorldOverlay shot={shot}>
        <Pointer
          path={[
            { frame: 34, x: yes.x - 96, y: yes.y + 122 },
            { frame: 60, x: yes.x, y: yes.y },
          ]}
          clicks={[66]}
          visible={{ from: 32 }}
        />
      </WorldOverlay>
    </AbsoluteFill>
  );
};

/** Checked, not asserted — see the table in `framing.ts`. */
export const BEAT09_LEGIBILITY = PHONE.beat9Prompt;
