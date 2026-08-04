import React from "react";
import { AbsoluteFill } from "remotion";
import { useCurrentFrame } from "../../retime";

import { ConfirmatoryPrompt } from "@/components/questionnaire/confirmatory-prompt";

import { BEAT9_PROMPT, COMPOSITE, PHONE, useShotAt } from "../../app/framing";
import { PROMPT, centre } from "../../app/geometry";
import { Hover } from "../../app/hover";
import { LITTLE_AT, MonitorPage, TENSE_AT, WorldOverlay, WorldPrompt } from "../../app/monitor";
import { useDrift, useReading, useToastIn } from "../../app/motion";
import { Pointer } from "../../app/pointer";
import { Camera, CameraKey } from "../Camera";
import { useExpression } from "../rig";

/**
 * Beats 7b–7e · The false alarm · 1,050 frames
 *
 * The pitch cut's new sequence, between beat 7 and beat 8. Spec: the pitch beat sheet §6,
 * `docs/video/serenify-pitch-video-beat-sheet.md`. **It is ONE beat and one continuous shot
 * sequence — no cuts, and it opens on the frame beat 7 ended on.**
 *
 * The story: he concentrates hard on a difficult problem, he frowns at the screen, the reading
 * climbs off his FACE rather than off any event, the confirmatory prompt fires, he answers that
 * he is fine, and he goes back to work at ease. Then beat 8 happens and it is real.
 *
 * The point (§6): the false alarm and the true positive are **identical up to the answer** —
 * same amber, same climb, same copy, same three options, same push-in, same landing. The only
 * difference is which button the cursor goes to. Beat 12's card is a claim in the launch cut and
 * a demonstration in this one because of these thirty-five seconds.
 *
 *   7b    0 –  210   `COMPOSITE`, static.  He settles into `focused`. The reading is at ease.
 *   7c  210 –  510   `COMPOSITE`, static.  The climb: bloom drifts, stateline steps twice.
 *   7d  510 –  810   push to `BEAT9_PROMPT`, land, hold. The prompt; the cursor goes to "No".
 *   7e  810 – 1050   pull back to `COMPOSITE`, hold. The prompt is gone. It comes down on its own.
 *
 * ── EVERY SURFACE IS ALREADY BUILT (§6.1) ───────────────────────────────────────────
 *
 * No new drawn asset, no new component, no new geometry beyond one piece of arithmetic. The
 * shell, the bloom, the stateline, the trend, the viewfinder and the prompt are the same nodes
 * beats 7–9 already mount; the two shots are the same `COMPOSITE` and `BEAT9_PROMPT` from
 * `framing.ts`; the pointer and the option hover are the film's own. The single derivation is
 * `PROMPT.no` — `PROMPT.yes` plus one 44px row and one 8px gap — and it lives in `geometry.ts`
 * beside the rect it is derived from.
 *
 * **`BEAT9_PROMPT` is deliberately shared with beat 9 and must stay shared.** §6 requires the two
 * prompts to look identical up to the answer, and a different landing would be exactly the kind
 * of difference the audience cannot name but does feel. (`BEAT9_OPTIONS` exists for beat 9's own
 * re-framing onto the choice — §6.6 — and is not this beat's.)
 *
 * ── HIS FROWN IS CONCENTRATION, NOT DISTRESS (§6.2) ─────────────────────────────────
 *
 * `focused` is a new named point in the rig's existing thirteen-number space, and the separation
 * from every distress pose is structural: `browInner` is NEGATIVE here — brows drawn together
 * with the inner ends DOWN, which is effort — where the rig's own facial-coding rule fixes
 * `dismayed` and `tense` at positive. The two families sit in disjoint half-spaces on one
 * coordinate, so they cannot be confused at any interpolation on any frame, by construction
 * rather than by care. See `rig.tsx` § `POSE.focused`.
 *
 * The other three axes matter too and all three are in the keys below rather than the vector:
 * he **never stops typing** (`working` is true for all 1,050 frames — beat 8's stop is beat 8's
 * clearest physical marker and spending it here would cost beat 8 that marker), his gaze stays
 * down at the keyboard, and the travel into the pose takes **60 frames**. A face arriving at
 * concentration over two seconds reads as somebody getting STUCK on a problem; a face snapping
 * into it reads as a reaction to something, and nothing has happened to him.
 */
/**
 * ══ THE DISMISSAL MUST NOT IMPLY THE MODEL LEARNS (§6.4) ════════════════════════════
 *
 * The shipped handler (`lib/questionnaire/confirmatory-trigger.ts:424-427`) calls `finalize()`,
 * which sets `visible` false and persists the answer. **There is no toast, no banner, no
 * "thanks", no confirmation text, no state change on the monitoring surface at all.** The prompt
 * simply is not there any more. That is the real dismissal path, so the film adds nothing: the
 * prompt is mounted for `frame < 750` and after the click it is gone.
 *
 * Three prohibitions, each stated because each is a thing somebody will want to add:
 *
 *  · **No acknowledgement of any kind.** A click with no visible response feels unfinished and
 *    that instinct is wrong here. What responds to the click is *the prompt disappearing*, and
 *    7d's last 60 frames exist so that absence has room to register.
 *  · **Nothing on screen that could read as adaptation.** No "learning", no "updated", no
 *    threshold moving visibly, no trend re-drawing its history, no progress toward anything.
 *  · **Nothing about the reading may be tied to the click frame**, and this is the subtle one and
 *    the reason for the hard floor in the keys below. If the bloom started drifting back on the
 *    frame he clicks, the film would have depicted the answer MOVING THE MODEL, which is
 *    precisely what the sequence must not say. The earliest permitted band movement is 7e f45 —
 *    **f855**, 105 frames after the click — with the pull-back finished and him visibly back at
 *    the keyboard for a beat first. The on-screen cause of the descent is *him settling*.
 *
 * (`armFalseAlarmNextSessionSuppression()` does affect a *later* session. Nothing on screen shows
 * it, it is not depicted, and it must not be.)
 */
/** One array, used by `<Camera>` AND by the projection — they cannot disagree. */
const KEYS: CameraKey[] = [
  // Picks up beat 7's closing framing exactly. 7b and 7c are 510 frames of STATIC camera: the
  // whole climb happens on a frame that does not move, which is what makes his face its cause.
  { frame: 0, shot: COMPOSITE },
  // 7d. The camera leaves ten frames AFTER the prompt has arrived — it reacts to it rather than
  // anticipating it, the same relationship beat 9 has with its own entrance.
  { frame: 510, shot: COMPOSITE },
  { frame: 546, shot: BEAT9_PROMPT },
  // …and HOLDS for 264 frames. The prompt is read whole here (§6.3: the audience's first sight
  // of this surface), the pointer travels, the click lands, and the 60 frames after the click
  // are a static camera on the prompt's absence.
  { frame: 810, shot: BEAT9_PROMPT },
  // 7e. The pull-back, finished at f846 — nine frames before anything about the reading is
  // allowed to move, which is §6.4's ordering made into two numbers.
  { frame: 846, shot: COMPOSITE },
  { frame: 1050, shot: COMPOSITE },
];

export const Beat07bFalseAlarm: React.FC = () => {
  const frame = useCurrentFrame();
  const shot = useShotAt(KEYS);
  const no = centre(PROMPT.no);

  // The prompt fires at f500 — ten frames before the camera starts moving. Same entrance curve
  // as beat 9's and the mail toast's: two macOS-shaped surfaces on one screen with two different
  // entrance curves read as two different operating systems.
  const enter = useToastIn(500);

  /**
   * The bloom, on the component's own `transition: background 1.3s ease`, twice — up at 7c f0
   * and back down at 7e f45. It DRIFTS, it never snaps.
   *
   * Written as a difference of two drifts rather than a keyframed value because that is what the
   * component does: each direction is one 1.3s ease from where it was, and composing them keeps
   * both at exactly the shipped duration. Up f210→f249, held, down f855→f894.
   */
  const tension = useDrift(0, 1, 210) - useDrift(0, 1, 855);

  /**
   * ── ONE NUMBER, AND EVERYTHING READS IT (L18) ──────────────────────────────────────
   *
   * The stateline's band and the trend's newest window are both derived from this, so they cannot
   * disagree on any frame. The keys are placed **on** `LITTLE_AT` / `TENSE_AT`, which is what
   * makes each copy change land on the exact frame the sheet gives it while the value in between
   * still moves continuously — the graph walks rather than stepping, and the two step together.
   *
   *   f0   – f210   0.00          7b. At ease throughout, and that IS 7b: the audience registers
   *                               that he looks strained *and* the app still says "You're at ease
   *                               right now", so the climb in 7c is caused by his face rather
   *                               than announced before it.
   *   f330          LITTLE_AT     7c f120 → "You're a little tense" / "A bit of an edge lately."
   *   f410          TENSE_AT      7c f200 → "You're feeling tense" / "This has held a while…"
   *   f510          1.00          7c ends at the top. Amber holds through the whole of 7d.
   *   f855          1.00          **THE HARD FLOOR — §6.4.** The click is at f750 and NOTHING
   *                               about the reading may move for 105 frames after it. If any
   *                               number in this beat has to move, this one may not move earlier.
   *   f930          just under    7e f120 → back to "You're at ease right now".
   *   f990          0.00          settled, with 60 frames of nothing but his breath to end on.
   *
   * The copy, the bands and the thresholds are byte-identical to beat 8's. What differs is the
   * pacing — 10 seconds for the climb where beat 8 gives it about 6.5 — because in beat 8 the
   * climb is intercut with a toast, a clock and a face falling, and here nothing else happens.
   *
   * **The f929 → f930 pair reproduces beat 11's own descent, and for beat 11's reason.** The
   * crossing is one frame wide on purpose: the recovery skips `a_little_tense` because the
   * STATELINE does, and a continuous value that dwelt in between would put the graph in a band
   * the copy was not showing — the exact disagreement one number exists to end.
   */
  const level = useReading([
    { frame: 0, level: 0 },
    { frame: 210, level: 0 },
    { frame: 329, level: LITTLE_AT - 0.01 },
    { frame: 330, level: LITTLE_AT },
    { frame: 409, level: TENSE_AT - 0.02 },
    { frame: 410, level: TENSE_AT },
    { frame: 510, level: 1 },
    { frame: 855, level: 1 },
    { frame: 929, level: TENSE_AT + 0.02 },
    { frame: 930, level: LITTLE_AT - 0.01 },
    { frame: 990, level: 0 },
  ]);

  /**
   * **The history does not un-happen, so the peak is a running maximum rather than `level`.**
   *
   * `peak` defaults to `level` (`monitor.tsx`), which is right for a beat that only climbs — beat
   * 8 takes the default for exactly that reason. This beat climbs AND comes back down, and
   * driving the descent through the peak would flatten the whole drawn line including the stretch
   * that climbed in 7c: the graph would end as if the tense half-minute had never occurred. That
   * is §6.4's "no trend re-drawing its history" as well as `trendPoints`' own invariant. The
   * recovery is a tail, not an erasure, which is what beat 11 spends `peak={1}` on.
   *
   * It is written as the running max rather than a literal 1 because before f510 the session has
   * not peaked yet — pinning it to 1 in 7b would draw a session that had already been tense.
   */
  const peak = frame < 510 ? level : 1;

  /**
   * **A held pose, not a fall**, and that distinction is most of §6.2. Beat 8's `dismayed` is
   * sixteen frames through the whole vector at once, which is what makes it read as a fall; this
   * is a 60-frame travel into a pose he then holds for 780 frames.
   *
   * And he **unsticks at f840–f900, which LEADS the reading by fifteen frames.** That ordering is
   * the sequence's argument: his face settles first and the app follows, so the on-screen cause
   * of the descent is him rather than his answer. The reading's own floor is f855; the face is
   * already moving by then.
   */
  const pose = useExpression([
    // Picks up beat 7 exactly. Same pose, same frame — nothing cuts.
    { frame: 0, state: "content" },
    { frame: 60, state: "focused" },
    { frame: 840, state: "focused" },
    { frame: 900, state: "content" },
  ]);

  return (
    <AbsoluteFill>
      <Camera keys={KEYS}>
        <MonitorPage
          // §6.5 — the sequence sits inside the same story minute beats 7 and 8 both read, and
          // the session readout ticks continuously from beat 7's 47:12 through to beat 8's.
          // Nothing here introduces a second time.
          clock="11:30 AM"
          level={level}
          peak={peak}
          tension={tension}
          pose={pose}
          // **True for all 1,050 frames.** He never stops. Beat 9 sets this false because
          // stopping to answer IS beat 9; here the answer costs him nothing.
          working
          sessionFrom={47 * 60 + 20}
        />
      </Camera>

      {/*
       * The prompt. Rendered OUTSIDE `<Camera>` because Radix portals it to the document body
       * regardless — rendering it inside would be a lie about where the node ends up.
       * `<WorldPrompt/>` is what actually places it, in world coordinates, per frame.
       *
       * **It unmounts on the click and nothing takes its place.** See §6.4 above: the absence IS
       * the response, and the 300 frames of static camera it leaves behind are where that lands.
       */}
      {frame < 750 && (
        <WorldPrompt shot={shot} enter={enter}>
          <ConfirmatoryPrompt
            open
            onConfirm={() => {}}
            onFalseAlarm={() => {}}
            onOpenChat={() => {}}
          />
        </WorldPrompt>
      )}

      {/*
       * "No, I'm okay" lights before it is pressed — `nth-of-type(2)`, the SECOND option, which
       * is the one line of this beat that differs from beat 9. `OPTION`
       * (`confirmatory-prompt.tsx:27`) carries its own
       * `hover:bg-[color-mix(in_srgb,var(--color-foggy)_8%,var(--color-surface))]` over
       * `transition-colors`, so this genuinely eases over 150ms rather than snapping.
       *
       * It opens on f746 — the frame the pointer ARRIVES, because a control acknowledges a cursor
       * that has reached it — and the click lands four frames later, this film's own idiom.
       *
       * No focus ring anywhere: `:focus-visible` cannot fire on a mouse click, and the film must
       * not draw a state the product never shows a mouse user.
       */}
      <Hover
        selector="[data-testid='notification'] button:nth-of-type(2)"
        treatment="promptOption"
        from={746}
        to={762}
      />

      {/* World coordinates, magnified by the camera with everything else. The layer is a SIBLING
          of `<Camera>` rather than a child: the portalled prompt is a `document.body` child at
          `z-index: 50` and `<Camera>`'s transform makes its subtree a stacking context, so a
          cursor inside the camera would be painted UNDER the button it is pressing. */}
      <WorldOverlay shot={shot}>
        <Pointer
          path={[
            { frame: 710, x: no.x - 96, y: no.y + 122 },
            { frame: 746, x: no.x, y: no.y },
          ]}
          clicks={[750]}
          /*
           * It leaves at f810 — 60 frames after the click, on the frame the camera begins
           * pulling back to `COMPOSITE`, and NOT on the click.
           *
           * Both ends of that are deliberate. A cursor parked in frame for the whole of 7e is
           * the only still object in a shot whose subject is him getting back to work, and his
           * hands are on the keyboard by then. But taking it away ON the press would be a
           * visible response to the press, and §6.4 is that the dismissal has none — the prompt
           * unmounting is the only thing the click may cause. Sixty frames later, under a moving
           * camera, it reads as the pointer being done rather than as an answer being
           * acknowledged.
           */
          visible={{ from: 708, to: 810 }}
        />
      </WorldOverlay>
    </AbsoluteFill>
  );
};

/** Checked, not asserted — see the table in `framing.ts`. The two shots are beat 7's and beat
 *  9's, so this beat adds no legibility claim of its own. */
export const BEAT07B_LEGIBILITY = { composite: PHONE.composite, prompt: PHONE.beat9Prompt };
