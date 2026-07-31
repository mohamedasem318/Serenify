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
 * **REN_TURN1 — his face AND his opening line, in one landing.**
 *
 * The beat used to punch in on the avatar at f32 and pull back out at f38 — six frames — which
 * does not read as a shot at all, it reads as a twitch. The pass after that gave him a real
 * 300-wide face landing and held it, and deliberately kept turn 1 **out** of frame (by 0.65px),
 * revealing the bubble with the move off his face. That paid for the performance and left the
 * opener itself never read above **8.33px** — its widest framing in the cut was L2's 760.
 *
 * **One framing holds both, comfortably, and the constraint that said otherwise was about the
 * wrong bubble.** `CHAT_OWNERSHIP_SPAN` — the ≥638px floor — pairs the avatar with *his* reply,
 * which is `self-end` and runs to x 919. Ren's own opener is `self-start` and ends at **630.5**:
 *
 *   union(REN_AVATAR, CHAT.turn1)   x 270.0 – 630.5   (360.5)
 *                                   y 194.8 – 324.1   (129.3)
 *   frameRect(m=40)                 w = max(440.5, 209.3 × 16/9 = 372.1) = **440.5**  (width governs)
 *
 * At 440.5 turn 1 reads at **14.37px** on a phone — 1.7× the 8.33 it had — and the avatar at
 * **40.2px**. The panel's right edge runs off frame, which every beat-10 landing except the 889
 * establisher already does.
 *
 * ── AND THE WIDTH IS SET BY THE BUBBLE, NOT BY THE AVATAR ──────────────────────────
 *
 * Which is what makes L8's size a free variable here: turn 1's right edge governs the union, so
 * the landing is 434.5 at a 48px avatar and 432.5 at 36. The three variants Mohamed is choosing
 * between are the same shot with a different face in it, not three different shots.
 *
 * **The message now lands INSIDE this hold rather than being revealed by the move off it** — Ren
 * composes it on screen (`thinking`, with the typing indicator in turn 1's own slot), it arrives,
 * and it is read at the size the recon found. That is the whole of §3.2.
 *
 * ── AND THE TOP EDGE IS PLACED, NOT CENTRED ────────────────────────────────────────
 *
 * Width governs, so the frame is 243.8 tall against a 129.3 union and the slack has to go
 * somewhere. Centred it lands at y 137.5, which puts 18.5px of the sticky app header — and a
 * slice of one of its icon buttons — across the top of the shot. `cy` puts the top edge on
 * **156**, the header's own bottom, exactly as `COMPOSITE` and `BEAT5_SUCCESS` do: the union
 * keeps 38.8px above and 75.7 below, all of it the chat panel's own empty log, and nothing of
 * the header is in frame.
 */
const renTurn1Frame = frameRect(union(REN_AVATAR, CHAT.turn1), 40);
const REN_TURN1 = { ...renTurn1Frame, cy: 156 + (renTurn1Frame.w * 9) / 16 / 2 };

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
 * ══ THE CLOCK, RESTAGED AROUND THE OPENER ═══════════════════════════════════════════
 *
 *   f0–6      the panel, whole — brief, and the only shot in the beat that crops nothing
 *   f6–24     in, onto REN_TURN1
 *   f0–52     `thinking`, with the typing indicator in turn 1's own slot: he is composing, and
 *             you watch him do it from the first frame of the beat
 *   f24–88    HOLD on the landing
 *   f52       turn 1 lands, into the frame that was already holding the slot it lands in, and is
 *             read at **14.37px** — 36 frames, 1.2s, before the camera moves
 *   f88–108   out to L2
 *   f100–114  the pointer travels to the composer
 *   f116      the caret click, 8 frames after the camera has landed
 *   f118–210  he types. **78 characters** at ~25 c/s — hurried, and the hurry is his own
 *   f216      **the pointer ARRIVES at the send button** and the button lights on that frame
 *   f220      the click, four frames later. The bubble lands with it
 *   f228      `thinking` again, and the typing indicator with it (L9), now in turn 3's slot
 *   f244–268  in to L3
 *   f272      turn 3 lands, and Ren closes his eyes on the same frame
 *   f272–332  the protected hold — 60 frames, untouched
 *
 * ── THE BEAT GOES 250 → 332, AND BOTH REASONS ARE THE BRIEF'S ──────────────────────
 *
 *  · **His message is 78 characters, not 49.** At the beat's own ~25 c/s that is 92 frames of
 *    typing rather than 58. The rate is not raised to absorb it — *never sped to fit* — so the
 *    beat carries the +34.
 *  · **Turn 1 is now read rather than revealed.** It lands inside a 440.5 hold and gets 36
 *    frames there, where before it appeared during the move out and was never read above 8.33px.
 *    That is the other +48.
 *
 * Nothing was cut to pay for either. The protected 60-frame hold on turn 3 is untouched.
 *
 * ── WHAT THE LANDING BOUGHT, BESIDES THE PERFORMANCE ───────────────────────────────
 *
 * The constraint this beat recorded — *any landing holding both the avatar and his bubble ending
 * at x 919 is ≥638px wide, which is why turns 2 and 3 read at 8.33 and 9.52px rather than over
 * 10* — is about **turn 2**. It was being quoted at turn 1 as well, and turn 1 is `self-start`
 * and 288px narrower. Ren's own opener escapes the constraint entirely; his reply does not.
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
  turn1: 52,
  cursorToComposer: 114,
  caretClick: 116,
  typeFrom: 118,
  /** 92 frames for 78 characters — 25.4 c/s, the same rate the 49-character line was typed at. */
  typeTo: 210,
  /** The pointer's travel ENDS here. The button lights on this frame, not eight before it. */
  sendArrive: 216,
  send: 220,
  /** Lands the same frame the composer clears — see the note above. */
  bubble: 220,
  thinking: 228,
  reply: 272,
} as const;

/** The beat's own length, so the last camera key and `Root.tsx` cannot drift apart. */
export const BEAT10_FRAMES = 332;

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
   * ── REN'S ARC — TWO STATES, AND `attentive` IS GONE ─────────────────────────────
   *
   * **`attentive` is dropped from the film entirely** (decided 2026-07-31). At the size the face
   * landing holds him it reads as unsettling rather than as attention: `OPEN_EYE_TRANSFORMS`
   * scales the pair to **1.22×** and lifts them, which at a conversational scale is a stare. It
   * is a good state at the 34px the product ships it at and a bad one at four times that, and the
   * film is the only place it is ever seen large. It appears nowhere now.
   *
   * What is left is the arc the beat actually has:
   *
   *   thinking   from f0 — he is composing his opener, and the typing indicator says so. It runs
   *              through turn 1 landing at f52 and does not change when it does: he has spoken,
   *              and now he is waiting on a person who is typing, which is the same state
   *   thinking   through the whole of turn 2's typing and through his own composing of turn 3 —
   *              one continuous state, not two, because nothing happens between them that would
   *              cause a change
   *   warm       at f272, ON turn 3. **The eyes close.** `warm` drops the open pair entirely and
   *              leaves the closed, smiling one (`ren-avatar.tsx:90`), so the moment the Michael
   *              Jackson suggestion lands is the moment his eyes shut — which is the product's
   *              own state for exactly this and the only expression change in the beat.
   *
   * The states are discrete in the product — `OPEN_EYE_TRANSFORMS` carries no transition — so
   * they snap, and the one snap left sits on the frame its message arrives.
   */
  const renState = frame >= T.reply ? "warm" : "thinking";

  /**
   * L9's indicator follows what Ren is actually doing, and it is only ever up while he is
   * COMPOSING — not while he is merely `thinking`. He is `thinking` for 272 of the beat's 332
   * frames; dots for all of them would be a lie about the surface and a moving element under
   * every other thing the beat is trying to show.
   *
   * Two windows, each ending on the message it was promising: f0 → turn 1, and the second
   * composing → turn 3. Each draws in the slot its own bubble will occupy, so the dots are
   * replaced by the thing they were announcing rather than sitting somewhere else on the page.
   */
  const composingTurn1 = frame < T.turn1;
  const composingTurn3 = frame >= T.thinking && frame < T.reply;

  return (
    <AbsoluteFill>
      <Camera
        keys={[
          // The panel, whole — the establishing frame, and the only one that crops nothing.
          { frame: 0, shot: PANEL_WHOLE },
          { frame: 6, shot: PANEL_WHOLE },
          // In on his face AND the slot his opener will land in, and HOLD there across the
          // landing: he composes, the line arrives at f52, and it is read at 14.37px.
          { frame: 24, shot: REN_TURN1 },
          { frame: 88, shot: REN_TURN1 },
          // Out to the working shot. Then still: the typing, the send and his bubble all
          // happen inside one static frame.
          { frame: 108, shot: L2 },
          { frame: 244, shot: L2 },
          // In on the thread for turn 3, settled before it arrives at f272.
          { frame: 268, shot: L3 },
          { frame: BEAT10_FRAMES, shot: L3 },
        ]}
      >
        <ChatPage
          clock="11:31 AM"
          messages={messages}
          renState={renState}
          draft={frame >= T.typeFrom && frame < T.send ? typed : ""}
          caret={frame >= T.typeFrom && frame < T.send}
          composing={composingTurn1 ? "turn1" : composingTurn3 ? "turn3" : null}
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
                  // It sets off during the move off the landing, so it is already travelling by
                  // the time L2 settles rather than starting from a dead stop inside it.
                  { frame: 100, x: 640, y: 400 },
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
  /**
   * The landing that holds his face AND his opener. The line reads at **14.37px** against the
   * 8.33 it had at L2, which is the whole of §3.2; the avatar's figure moves with L8's size.
   */
  renTurn1: {
    framedWidth: REN_TURN1.w,
    avatar: PHONE_PX(REN_AVATAR_SIZE, REN_TURN1.w),
    chatText: PHONE_PX(15, REN_TURN1.w),
  },
  l2: { framedWidth: L2.w, chatText: PHONE_PX(15, L2.w) },
  l3: { framedWidth: L3.w, chatText: PHONE_PX(15, L3.w) },
} as const;

export { COMPOSER };
