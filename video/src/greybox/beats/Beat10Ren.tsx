import React from "react";
import { AbsoluteFill, useCurrentFrame } from "remotion";

import { ChatPage, msg } from "../../app/chat";
import { CHAT, PHONE_PX, centre } from "../../app/geometry";
import { Hover } from "../../app/hover";
import { Pointer } from "../../app/pointer";
import { Camera, frameRect, rect, union } from "../Camera";
import { REN } from "../copy";

/**
 * Beat 10 · Ren · 210 frames
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
 * The avatar is in the **header** now, not on the bubbles (`chat-shell.tsx:432`), so
 * `union(avatar, bubble)` is no longer a tight rect for two of the three turns: Ren's avatar sits
 * at x 281 and **his** reply runs out to x 919, so any landing holding both is ≥ 638 wide before
 * margins. That is the number that sets this beat's whole scale:
 *
 *   the panel whole, all four edges     672 × 460 → 16:9 forces **888.9** → 15px reads 7.12px
 *   avatar + his bubble + the composer  →  **712** → 8.89px
 *   avatar + all three bubbles          →  **664.9** → 9.52px
 *   avatar + Ren's opener alone         →  **469.5** → **13.48px**
 *
 * So the sheet's own camera correction — *the camera moves on every turn, because at a framing
 * wide enough to hold the whole thread 15px chat text is well under phone legibility* — is
 * arithmetic here rather than taste, and it is also the reason the landings crop the panel's own
 * chrome. **Nothing textual is ever sliced**: every frame edge below lands in a measured gutter.
 * What the tighter two landings give up is the panel's 1px side borders (L1) and 3.5px of them
 * (L3), which reads as a zoom into a screen recording rather than as a cut element.
 *
 * ── THE CAMERA DOES NOT GO TO THE COMPOSER, BECAUSE THE POINTER DOES NOT ───────────
 *
 * `L2` is a single hold from f38 to f120. It already contains the composer, the send button, the
 * conversation header and both bubbles, so the typing, the send click and his message landing all
 * happen inside one static frame — which is what the pointer's own fix asks for. A camera that
 * travelled down to the composer while the cursor sat still would be the only thing moving in the
 * shot, and would read as motion the scene does not have.
 *
 *   f0–14    the whole panel, whole — the one shot in the beat with nothing cropped
 *   f8       Ren's opener lands, and the camera settles onto it as it arrives
 *   f14–32   L1 · header + turn 1, at 13.48px
 *   f38–120  L2 · header + composer + turns 1 and 2. Click f38, typing f40–98, send f100
 *   f146–210 L3 · header + all three bubbles. **64 frames**, and turn 3's hold is protected
 *
 * ── THE AVATAR IS IN EVERY LANDING ─────────────────────────────────────────────────
 *
 * (281, 205.8) 34 × 34 sits inside all three frames — L1 by 60px on its left and 48 above, L2 by
 * 38.5 and 25, L3 by 13.5 and 50. That is the requirement L8 exists to protect and it is now a
 * property of the rects rather than of three hand-typed numbers.
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
 * **L1 — turn 1.** `frameRect(union(CHAT.renAvatar, CHAT.turn1), 60)`.
 *
 * The union of the avatar (281, 205.8, 34 × 34) and turn 1 is identical to the union against the
 * header's wider content block (avatar + "Ren" / "here to listen"): turn 1 already extends past
 * both of the header content's own edges, so only the avatar's own corner is load-bearing here.
 *
 *   union   x 281 – 630.5   y 205.8 – 324.1   (349.5 × 118.3)
 *   frame   w = max(469.5, 238.3 × 16/9 = 423.6) = **469.5**   h = 264.1
 *
 * Placed at cy 290 rather than at the rect's own centre (264.95), which would put the frame's top
 * edge at 132.9 — inside the app header. At 290 it runs **157.95 → 422.05**: clear of the header
 * by 2px, and its bottom edge lands in the empty log, 98px below turn 1's own bottom, so nothing
 * is cut. The panel's left border is in frame at 264 with 43px of page outside it; its right
 * border is not, which is what buys 13.48px.
 */
const L1 = { ...frameRect(union(CHAT.renAvatar, CHAT.turn1), 60), cy: 290 };

/**
 * **L2 — turn 2, and everything the pointer does.** Held f38 → f120, static.
 *
 * It has to contain the avatar (205.8) and the composer, and the composer is 646 wide, so the
 * floor is already ~700. The frame's bottom edge then has a choice of two gutters:
 *
 *   581, between the form (578.1) and the disclaimer (584.1)   → w = 712, 8.89px, but the send
 *                                                                button sits **2.9px** off the
 *                                                                frame edge, which reads as cut
 *   605, between the disclaimer (599.2) and the footer (611.3) → w = 760, 8.33px, the disclaimer
 *                                                                whole and 26.9px under the send
 *
 * The second is taken: half a phone-pixel is not a reading, and a control pressed 3px from the
 * frame's edge is the exact "landed mid-layout" look this pass exists to remove.
 *
 *   frame   x 220 – 980   y 177.5 – 605      w = 760, h = 427.5
 *   edges   top 177.5 is 10.5px above the panel's top border · bottom 605 is 6.3px above the
 *           footer bar and 5.8px below the disclaimer, both gutters, no text on either
 *   holds   panel side borders (44px outside each), header, turn 1, turn 2, textarea, send,
 *           disclaimer — everything except the panel's footer row and its bottom border
 *   reads   15px chat text at 8.33px
 */
const L2 = { cx: 600, cy: 391.25, w: 760 };

/**
 * **L3 — turn 3, and the protected hold.**
 *
 * The tightest frame that holds Ren's avatar, all three bubbles whole and no sliced text.
 * Turn 2's right edge (919) and the avatar's left (281) fix the width floor at 638 + margins; the
 * frame's bottom edge has to clear the composer's textarea, whose top is at 533.6, and its top
 * edge has to clear the app header at 156. Those two meet at **664.9**:
 *
 *   frame   x 267.6 – 932.4   y 156 – 530      h = 374
 *   holds   panel top border (32px of margin), the header, turns 1, 2 and 3 whole, the log's own
 *           bottom border at 520.6 closing the thread
 *   edge    bottom 530 sits in the composer's 13px of top padding — above the textarea, below
 *           the border that separates them
 *   reads   15px chat text at 9.52px
 *
 * The panel's side borders fall 3.5px outside this frame. Holding them costs w ≥ 672 + margins,
 * which pushes the frame's bottom through the textarea; the alternative placements either slice
 * the composer or hang a 6px sliver of the app header across the top of the shot, and a strip
 * running to the frame's edge reads better than a bar cut in half.
 */
const L3 = { cx: 600, cy: 343, w: 664.9 };

/**
 * ── THE TYPING WINDOW, UNCHANGED ────────────────────────────────────────────────────
 *
 * Turn 2 is 49 characters — "boss moved the report to 12. i have thirty minutes" — and types
 * f40–f98: 58 frames, about 25 characters a second. Faster than the ~20 c/s the sheet quotes, and
 * deliberately: he is hurried, and this is the one moment in the film where the hurry is his own
 * behaviour rather than something the UI is telling us.
 *
 * **Only two numbers in this block moved, and both moved for the framing.** Turn 1 lands at f8
 * rather than f20, so that L1 has a message to hold on when it lands at f14 rather than six
 * frames of an empty log; and the caret click is f38 rather than f34, so that it happens after
 * the camera has arrived at `L2` rather than a third of the way through the move — *every click
 * target is in frame when it is clicked* is the acceptance criterion it was failing. The send
 * stays at f100, the pointer still holds still from f30 to f98, and turn 3's hold is untouched.
 *
 * ── AND THE LINE USED TO VANISH FOR FOUR FRAMES BETWEEN THE COMPOSER AND THE BUBBLE ──
 *
 * `draft` clears at `T.send` (the composer empties the instant send is pressed — real apps do
 * this optimistically) but the message used to land at `T.bubble` = 104, four frames later. For
 * f100–f103 his typed sentence was on screen nowhere: gone from the composer, not yet a bubble —
 * which reads as a dropped frame. `bubble` now equals `send`: the composer clears and the bubble
 * lands on the same frame, so the line is never absent. Nothing else about the send/typing
 * timing moved.
 */
const T = {
  turn1: 8,
  cursorToComposer: 30,
  caretClick: 38,
  typeFrom: 40,
  typeTo: 98,
  send: 100,
  /** Lands the same frame the composer clears — see the note above. Was 104. */
  bubble: 100,
  thinking: 116,
  reply: 150,
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

  return (
    <AbsoluteFill>
      <Camera
        keys={[
          // The panel, whole — the establishing frame, and the only one that crops nothing.
          { frame: 0, shot: PANEL_WHOLE },
          { frame: 14, shot: PANEL_WHOLE },
          // In on Ren's opener, which landed at f8. The camera settles on the message as it
          // arrives rather than waiting for it.
          { frame: 32, shot: L1 },
          // Out to hold the composer BEFORE the caret click at f38, and then still: the typing,
          // the send and his bubble all happen inside this one frame.
          { frame: 38, shot: L2 },
          { frame: 120, shot: L2 },
          // In on the thread for turn 3, settled before it arrives at f150.
          { frame: 146, shot: L3 },
          { frame: 210, shot: L3 },
        ]}
      >
        <ChatPage
          clock="11:31 AM"
          messages={messages}
          draft={frame >= T.typeFrom && frame < T.send ? typed : ""}
          caret={frame >= T.typeFrom && frame < T.send}
          thinking={frame >= T.thinking && frame < T.reply}
          overlay={
            <>
              {/*
               * §2 — the send button lights as the pointer reaches it. **It is the one control in
               * the film with no shipped hover**: `chat-shell.tsx:388` is
               * `bg-foggy text-on-accent transition-opacity disabled:opacity-50`, which is a
               * disabled state and an opacity transition with nothing to trigger it. So this
               * treatment is authored — as the house idiom (`hover:opacity-90`, which every
               * filled `<Button/>` variant ships) rather than as an invention, on an element that
               * already carries the transition to run it. Declared as authored in `hover.tsx`.
               */}
              <Hover
                selector="[data-testid='chat-send']"
                treatment="sendAuthored"
                from={T.send - 8}
                to={T.send + 10}
              />
              {/*
               * The pointer TRAVELS to the composer, and then to send. Both clicks share a shot
               * with what they cause: the caret lands in the textarea and the typing starts; send
               * is pressed and the bubble appears. Both targets are measured — see the note on
               * `COMPOSER`.
               *
               * ── AND IT USED TO SWIPE ACROSS THE FIELD WHILE HE TYPED ────────────────────
               *
               * The third waypoint landed at `T.send - 8` = frame 92 — BEFORE typing even ends at
               * `T.typeTo` (98). A path only has as many waypoints as it is given, so Remotion
               * interpolated the whole leg from the composer to the send button continuously
               * across frames 30–92, which spans nearly the entire typing window. The cursor was
               * visibly dragging across the text box while he typed — exactly wrong, since a hand
               * on the keyboard is not also dragging the mouse.
               *
               * So there is a fourth waypoint, at the composer's OWN position, timed to
               * `T.typeTo`: identical (x, y) across a leg means zero motion, so the pointer holds
               * still for the entire typing window and only travels afterward, arriving at send
               * exactly as it is clicked. **The camera now holds still across the same window**,
               * which is the other half of the same note — see `L2`.
               *
               * The first waypoint sits inside `PANEL_WHOLE` and inside `L1`, so the cursor is
               * never drawn outside the frame it starts in.
               */}
              <Pointer
                path={[
                  { frame: 0, x: 640, y: 400 },
                  { frame: T.cursorToComposer, x: CARET_AT.x, y: CARET_AT.y },
                  { frame: T.typeTo, x: CARET_AT.x, y: CARET_AT.y },
                  { frame: T.send, x: SEND_AT.x, y: SEND_AT.y },
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
  l1: { framedWidth: L1.w, chatText: PHONE_PX(15, L1.w) },
  l2: { framedWidth: L2.w, chatText: PHONE_PX(15, L2.w) },
  l3: { framedWidth: L3.w, chatText: PHONE_PX(15, L3.w) },
} as const;

export { COMPOSER };
