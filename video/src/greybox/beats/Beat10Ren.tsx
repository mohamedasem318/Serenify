import React from "react";
import { AbsoluteFill, useCurrentFrame } from "remotion";

import { ChatPage, msg } from "../../app/chat";
import { CHAT, PHONE_PX, REN_AVATAR, REN_AVATAR_SIZE, centre } from "../../app/geometry";
import { Hover } from "../../app/hover";
import { Pointer } from "../../app/pointer";
import { Camera, frameRect, rect, shot, union } from "../Camera";
import { REN } from "../copy";

/**
 * Beat 10 · Ren · 250 frames
 *
 * A real three-turn exchange, each message legible, appearing one at a time with a real beat
 * between them.
 *
 * ══ PASS B · THE FRAMING IS RECT-DERIVED AGAIN ══════════════════════════════════════
 *
 * This beat had **five hand-typed `shot(cx, cy, w)` values** — 760, 760, 820, 700, 700 — not
 * derived from any measured rect, in a file where every other beat frames `frameRect(...)` over
 * `geometry.ts`. It also carried a camera move DOWN to the composer that the greybox never had,
 * at exactly the frames where the pointer now holds still, so the only motion in the typing
 * window was the camera's.
 *
 * At `1d878b9` the shot plan was three landings, each `frameRect(union(avatar, bubble), 26)`,
 * tied 1:1 to the three turns. That plan is rebuilt here against the real `<ChatShell/>`, all of
 * it measured off this beat's own render:
 *
 *   panel            264, 188   672 × 460      (`mx-auto max-w-2xl h-[460px]`)
 *   conversation hdr 265, 189   670 ×  68.7    ← `<RenAvatar/>` 281, 205.8, 34 × 34
 *   log              265, 257.7 670 × 262.9    bottom border 520.6
 *   turn 1 · Ren     281, 277.7 349.5 × 46.4
 *   turn 2 · him     541.7, 338.1 377.3 × 44.4  (right edge **919**)
 *   turn 3 · Ren     281, 396.4 472.1 × 70.8
 *   composer form    277, 533.6 646 × 44.5     send 879, 533.6 44 × 44
 *   disclaimer       277, 584.1 646 × 15.1     footer bar 265, 611.3 670 × 35.8
 *
 * ── WHAT THE MEASUREMENTS DECIDE, AND IT IS NOT WHAT THE OLD PLAN ASSUMED ───────────
 *
 * The avatar is in the **header**, not on the bubbles (`chat-shell.tsx:432`), so
 * `union(avatar, bubble)` is not a tight rect for two of the three turns: Ren sits at x 270 (at
 * L8's 56px) and **his** reply runs out to x 919, so any landing holding both is ≥ 649 wide
 * before margins. And the composer alone is 646 wide, so **every** shot that contains it is ≥
 * 694 whatever else is in it:
 *
 *   the panel whole, all four edges     672 × 460 → 16:9 forces **888.9** → 15px reads 7.12px
 *   avatar + his bubble + the composer  →  **760** → 8.33px
 *   avatar + all three bubbles          →  **664.9** → 9.52px
 *   Ren's face alone                    →  **360** → the 56px avatar at **65.6px**
 *
 * ══ THE BEAT IS STAGED AROUND HIS FACE NOW, NOT AROUND THE PANEL ════════════════════
 *
 * That table is why the beat used to have no good shot: at every framing wide enough to hold the
 * conversation, Ren is a 30px mark and the chat text is under the phone floor, and the previous
 * pass answered it by punching in on the avatar for **six frames** and pulling straight back out.
 * Six frames is not a shot, it is a twitch — and it was punching in on a 34px circle in `idle`,
 * because L8 had never been built and `<ChatShell/>` mounts the avatar with no props at all.
 *
 * So the beat lands on his face **once, properly**, while he composes the opener — and that is
 * what pays for everything after it. The exchange's own landings still carry him (they have to:
 * his `thinking` and `warm` states have to be on screen when they fire), but they no longer have
 * to *introduce* him, so the beat stops asking one framing to do two jobs.
 *
 * ── THE CAMERA DOES NOT GO TO THE COMPOSER, BECAUSE THE POINTER DOES NOT ───────────
 *
 * `L2` is a single hold from f66 to f162. It contains the composer, the send button, the
 * conversation header and both bubbles, so the typing, the send click and his message landing all
 * happen inside one static frame — which is what the pointer's own fix asks for. A camera that
 * travelled down to the composer while the cursor sat still would be the only thing moving in the
 * shot, and would read as motion the scene does not have.
 *
 * ── WHAT IS GIVEN UP, STATED ───────────────────────────────────────────────────────
 *
 * **Turn 1 is never read above 8.33px.** The old plan gave it its own 480-wide landing at
 * 13.17px; that landing is gone, because it sat between the face hold and the working shot and
 * cost the beat about 0.9s it does not have. Ren's opener is on screen alone in the thread for
 * 82 frames — nearly three seconds — at the same size the film already accepts for turn 2 and
 * for the composer, and the beat's opening now spends its time on the person saying it rather
 * than on the sentence. If it ever reads as unreadable rather than merely small, the landing is
 * `frameRect(union(REN_AVATAR, CHAT.turn1), 60)` at cy 292 and it costs ~26 frames.
 */

/**
 * The composer sits at the bottom of the panel — where the cursor goes and the typing happens.
 *
 * ── AND THIS BEAT'S CURSOR WAS THE ONE IN THE FILM THAT MISSED ──────────────────────
 *
 * Both waypoints were hand-typed rather than measured: the caret at (460, 552) and **send at
 * (872, 552)**. The send button is 44px wide starting at x 879, so the pointer was pressing
 * **seven pixels outside the left edge of the control it was pressing**. It is `CHAT.send`'s
 * centre now, probed against the real `<ChatShell/>` — and re-verified in this pass at
 * (879, 533.6) 44 × 44, which agrees with `geometry.ts` exactly.
 */
const COMPOSER = rect(CHAT.textarea.x, CHAT.textarea.y, CHAT.textarea.w, CHAT.textarea.h);
const SEND_AT = centre(CHAT.send);
/** A caret lands where a caret lands — near the start of the field, on its vertical centre. */
const CARET_AT = { x: CHAT.textarea.x + 62, y: CHAT.textarea.y + CHAT.textarea.h / 2 };

// ── The shots, built off `geometry.ts` § CHAT ───────────────────────────────────────
//
// `CHAT` now carries the conversation header, the avatar, the log and all three turns — not just
// the panel, the composer, the textarea and the send button — so this beat frames the real
// component tree rather than hand-typed `shot(cx, cy, w)` values.

/**
 * **The establishing shot — the panel, whole.** `frameRect` over `CHAT.panel` at margin 20:
 * height governs (500 × 16/9 = 888.9), so all four of its edges sit inside the frame with 108.5px
 * of page either side and the app header entirely out of shot at 168 → 668. It is the only shot
 * in the beat that crops nothing, and it is brief, which is what the governing rule asks of a
 * wide.
 */
const PANEL_WHOLE = frameRect(CHAT.panel, 20);

/**
 * **REN_FACE — the landing this beat is now staged around.**
 *
 * The beat used to punch in on the avatar at f32 and pull back out at f38 — six frames — which
 * does not read as a shot at all, it reads as a twitch. And it was punching in on a 34px circle
 * in `idle`, because the shipped avatar was never enlarged and never given a state, so there was
 * nothing there to land on.
 *
 * Now the camera goes to his face and **stays**, while he composes. `REN_AVATAR` is 56px (L8) and
 * `<RenFace/>` drives the expression from the frame, so the thing being held is a face doing
 * something rather than a mark.
 *
 * **It is placed rather than derived, and both numbers have a reason.** A `frameRect` over the
 * avatar and the name block is ~229 world px — an 8.4× zoom, at which the header's 1px bottom
 * border renders 8px thick and the shot reads as a magnified screenshot rather than as a camera.
 * 300 is a 6.4× zoom — a little tighter than beat 8's clock landing (368, 5.2×), which is the
 * tightest shot in the rest of the film — and it puts the 56px avatar at **78.8px on a phone**,
 * about where the protagonist's own head sits in beat 8's fall.
 *
 *   frame   x 185 – 485   y 156 – 324.75      w = 300, h = 168.75
 *   cx      335, the centre of the avatar and the name block together — not of the avatar alone,
 *           which would put "here to listen" against the frame's right edge
 *   cy      156 + h/2, so the frame's top edge sits on the app header's bottom rather than 34px
 *           inside the browser chrome, which is where centring on the header band would put it
 *   holds   the avatar, "Ren", "here to listen", the conversation header's own bottom border, and
 *           the panel's top-left corner — which is what stops the shot reading as a floating mark
 *   NOT in shot: turn 1's bubble (277.7 – 324.1), by 0.65px, and deliberately — the message
 *           arrives while the camera is on his face and is REVEALED by the move off it. A bubble
 *           half-cut by the frame edge during the hold would be the thing the eye went to.
 */
const REN_FACE = shot(335, 156 + (300 * 9) / 16 / 2, 300);

/**
 * **L2 — turn 2, and everything the pointer does.** Static across the typing and the send.
 *
 * It has to contain the avatar (194.8, now that L8 is applied) and the composer, and the composer
 * is 646 wide, so the floor is ~700. The frame's bottom edge then has a choice of two gutters:
 *
 *   581, between the form (578.1) and the disclaimer (584.1)   → the send button sits 2.9px off
 *                                                                the frame edge, which reads cut
 *   605, between the disclaimer (599.2) and the footer (611.3) → the disclaimer whole and 26.9px
 *                                                                under the send
 *
 * The second is taken: a control pressed 3px from the frame's edge is the exact "landed
 * mid-layout" look this pass exists to remove.
 *
 *   frame   x 220 – 980   y 177.5 – 605      w = 760, h = 427.5
 *   holds   panel side borders, the header AND REN'S FACE, turn 1, turn 2, textarea, send,
 *           disclaimer — everything except the panel's footer row and its bottom border
 *   reads   15px chat text at 8.33px; Ren's 56px avatar at **31.1px**, which is what lets his
 *           `thinking` squint read while he composes the reply
 */
const L2 = { cx: 600, cy: 391.25, w: 760 };

/**
 * **L3 — turn 3, and the protected hold.**
 *
 * The tightest frame that holds Ren's avatar, all three bubbles whole and no sliced text.
 * Turn 2's right edge (919) and the avatar's left (270) fix the width floor at 649 + margins; the
 * frame's bottom edge has to clear the composer's textarea, whose top is at 533.6, and its top
 * edge has to clear the app header at 156. Those two meet at **664.9**.
 *
 *   frame   x 267.6 – 932.4   y 156 – 530      h = 374
 *   holds   panel top border, the header, turns 1, 2 and 3 whole, the log's own bottom border at
 *           520.6 closing the thread — and Ren, so his `warm` state is on screen when it lands
 *   reads   15px chat text at 9.52px
 */
const L3 = { cx: 600, cy: 343, w: 664.9 };

/**
 * ══ THE CLOCK, RESTAGED AROUND HIS FACE ═════════════════════════════════════════════
 *
 *   f0–6      the panel, whole — brief, and the only shot in the beat that crops nothing
 *   f6–24     in, onto REN_FACE
 *   f12       `attentive` — he registers that someone is there
 *   f24–46    HOLD on his face. `thinking` from f30: he is composing, and you watch him do it
 *   f46–66    out to L2 — and turn 1 lands at f60, inside the move, so the message is REVEALED
 *             by the camera opening rather than appearing beside a face nobody is looking at
 *   f60       `attentive` again: he has spoken, and now he is listening
 *   f52–70    the pointer travels to the composer
 *   f72       the caret click, 6 frames after the camera has landed
 *   f74–132   he types. 49 characters at ~25 c/s — hurried, and the hurry is his own behaviour
 *   f138      **the pointer ARRIVES at the send button** and the button lights on that frame
 *   f142      the click, four frames later. The bubble lands with it
 *   f150      `thinking` again, and the typing indicator with it (L9)
 *   f162–186  in to L3
 *   f190      turn 3 lands, and Ren goes `warm` on the same frame
 *   f190–250  the protected hold — 60 frames, untouched
 *
 * ── WHAT THE FACE LANDING BOUGHT, BESIDES THE PERFORMANCE ───────────────────────────
 *
 * The constraint this beat recorded — *any landing holding both the avatar at x 281 and his
 * bubble ending at x 919 is ≥638px wide, which is why turns 2 and 3 read at 8.33 and 9.52px
 * rather than over 10* — was true and was being paid on every shot in the beat, because the
 * avatar had to be in all of them. Landing on the face **once**, properly, is what pays that debt
 * instead: L2 and L3 still carry him (they have to, or his `thinking` and `warm` states play off
 * screen), but the beat no longer needs a wide shot to introduce him.
 *
 * ── AND THE SEND USED TO READ AS A DOUBLE CLICK ─────────────────────────────────────
 *
 * The hover opened at `T.send − 8` while the pointer was still parked in the composer eight
 * frames away — `hover.tsx` addresses the DOM by selector and never reads a coordinate, so
 * nothing stopped it. The button lit, then the cursor crossed it, then the click fired: two
 * separate acknowledgements of one press, which is exactly what a double click looks like.
 *
 * The order is causal now and each step has its own frames: the pointer's travel **ends** at
 * `T.sendArrive`, the hover opens on that frame (a control acknowledges a cursor that has reached
 * it), and the click lands four frames later at `T.send`. §2's rule — *it lights before it is
 * pressed* — is intact; what was wrong was that it lit before it was *reached*.
 *
 * ── AND THE LINE USED TO VANISH FOR FOUR FRAMES BETWEEN THE COMPOSER AND THE BUBBLE ──
 *
 * `draft` clears at `T.send` but the message used to land four frames later, so his typed
 * sentence was on screen nowhere: gone from the composer, not yet a bubble. `bubble` equals
 * `send`.
 */
const T = {
  attentive: 12,
  composing: 30,
  turn1: 60,
  cursorToComposer: 70,
  caretClick: 72,
  typeFrom: 74,
  typeTo: 132,
  /** The pointer's travel ENDS here. The button lights on this frame, not eight before it. */
  sendArrive: 138,
  send: 142,
  /** Lands the same frame the composer clears — see the note above. */
  bubble: 142,
  thinking: 150,
  reply: 190,
} as const;

export const Beat10Ren: React.FC = () => {
  const frame = useCurrentFrame();

  const full = REN.turns[1].text;
  // ~25 characters a second. Never sped to fit — the copy was shortened instead.
  const typed = full.slice(
    0,
    Math.max(
      0,
      Math.round(((frame - T.typeFrom) / (T.typeTo - T.typeFrom)) * full.length),
    ),
  );

  const messages = [
    ...(frame >= T.turn1 ? [msg("t1", "assistant" as const, REN.turns[0].text)] : []),
    ...(frame >= T.bubble ? [msg("t2", "user" as const, REN.turns[1].text)] : []),
    ...(frame >= T.reply ? [msg("t3", "assistant" as const, REN.turns[2].text)] : []),
  ];

  /**
   * ── REN'S ARC, AND EVERY STEP LANDS ON AN EVENT ─────────────────────────────────
   *
   * The states are discrete in the product — `OPEN_EYE_TRANSFORMS` carries no transition — so
   * they snap, and the only way a snap reads as a performance rather than as a glitch is if it
   * is *caused*. Each change here sits on the frame something happens:
   *
   *   idle       → the thread is empty and nothing has been said
   *   attentive  at f12, as the camera arrives on his face
   *   thinking   at f30, inside the hold — this is the composing the beat lands on
   *   attentive  at f60, ON turn 1 landing: he has spoken, now he is listening while the human
   *              types the whole of turn 2
   *   thinking   at f150, with the typing indicator (L9) — the second composing
   *   warm       at f190, ON turn 3. The reply about the music is the one moment the product is
   *              supposed to feel like it knows him, and `warm` is the state the product ships
   *              for exactly that.
   */
  const renState =
    frame >= T.reply
      ? "warm"
      : frame >= T.thinking
        ? "thinking"
        : frame >= T.turn1
          ? "attentive"
          : frame >= T.composing
            ? "thinking"
            : frame >= T.attentive
              ? "attentive"
              : "idle";

  return (
    <AbsoluteFill>
      <Camera
        keys={[
          // The panel, whole — the establishing frame, and the only one that crops nothing.
          { frame: 0, shot: PANEL_WHOLE },
          { frame: 6, shot: PANEL_WHOLE },
          // In on HIS FACE, and hold there while he composes.
          { frame: 24, shot: REN_FACE },
          { frame: 46, shot: REN_FACE },
          // Out to the working shot. Turn 1 lands at f60, inside this move — so the camera
          // opening is what reveals it. Then still: the typing, the send and his bubble all
          // happen inside one static frame.
          { frame: 66, shot: L2 },
          { frame: 162, shot: L2 },
          // In on the thread for turn 3, settled before it arrives at f190.
          { frame: 186, shot: L3 },
          { frame: 250, shot: L3 },
        ]}
      >
        <ChatPage
          clock="11:31 AM"
          messages={messages}
          renState={renState}
          draft={frame >= T.typeFrom && frame < T.send ? typed : ""}
          caret={frame >= T.typeFrom && frame < T.send}
          thinking={frame >= T.thinking && frame < T.reply}
          overlay={
            <>
              {/*
               * §2 — the send button lights AS the pointer reaches it, not eight frames before.
               * **It is the one control in the film with no shipped hover**: `chat-shell.tsx:388`
               * is `bg-foggy text-on-accent transition-opacity disabled:opacity-50`, which is a
               * disabled state and an opacity transition with nothing to trigger it. So this
               * treatment is authored — as the house idiom (`hover:opacity-90`, which every
               * filled `<Button/>` variant ships) rather than as an invention, on an element that
               * already carries the transition to run it. Declared as authored in `hover.tsx`.
               */}
              <Hover
                selector="[data-testid='chat-send']"
                treatment="sendAuthored"
                from={T.sendArrive}
                to={T.send + 12}
              />
              {/*
               * The pointer TRAVELS to the composer, and then to send. Both clicks share a shot
               * with what they cause: the caret lands in the textarea and the typing starts; send
               * is pressed and the bubble appears. Both targets are measured — see the note on
               * `COMPOSER`.
               *
               * ── AND IT USED TO SWIPE ACROSS THE FIELD WHILE HE TYPED ────────────────────
               *
               * The third waypoint used to land before typing ended, so Remotion interpolated the
               * whole leg from the composer to the send button across nearly the entire typing
               * window and the cursor visibly dragged across the text box while he typed —
               * exactly wrong, since a hand on the keyboard is not also dragging the mouse.
               *
               * So there is a fourth waypoint at the composer's OWN position, timed to
               * `T.typeTo`: identical (x, y) across a leg means zero motion. The travel to send
               * then runs `typeTo → sendArrive` and **ends four frames before the click**, which
               * is the other half of the double-click fix — the cursor arrives, the button
               * acknowledges it, and only then is it pressed.
               */}
              <Pointer
                path={[
                  { frame: 0, x: 640, y: 400 },
                  { frame: T.cursorToComposer, x: CARET_AT.x, y: CARET_AT.y },
                  { frame: T.typeTo, x: CARET_AT.x, y: CARET_AT.y },
                  { frame: T.sendArrive, x: SEND_AT.x, y: SEND_AT.y },
                ]}
                clicks={[T.caretClick, T.send]}
              />
            </>
          }
        />
      </Camera>
    </AbsoluteFill>
  );
};

/** Checked, not asserted. `worldSize × 422 / framedWidth`, per landing. */
export const BEAT10_LEGIBILITY = {
  panelWhole: { framedWidth: PANEL_WHOLE.w, chatText: PHONE_PX(15, PANEL_WHOLE.w) },
  /** The face landing. Ren at 56 world px is 65.6px on a phone. */
  renFace: { framedWidth: REN_FACE.w, avatar: PHONE_PX(REN_AVATAR_SIZE, REN_FACE.w) },
  l2: { framedWidth: L2.w, chatText: PHONE_PX(15, L2.w) },
  l3: { framedWidth: L3.w, chatText: PHONE_PX(15, L3.w) },
} as const;

export { COMPOSER };
