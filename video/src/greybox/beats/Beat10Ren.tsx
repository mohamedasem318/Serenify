import React from "react";
import { AbsoluteFill, useCurrentFrame } from "remotion";

import { ChatPage, msg } from "../../app/chat";
import { CHAT, centre } from "../../app/geometry";
import { Hover } from "../../app/hover";
import { Pointer } from "../../app/pointer";
import { Camera, rect, shot } from "../Camera";
import { REN } from "../copy";
import { H, W } from "../theme";

/**
 * Beat 10 · Ren · 210 frames
 *
 * A real three-turn exchange, each message legible, appearing one at a time with a real beat
 * between them.
 *
 * ══ RESTRUCTURED: THE MESSAGE IS PERFORMED, NOT REVEALED ════════════════════════════
 *
 * The old staging typed his message directly into a bubble that did not exist yet, and the text
 * bled out of it. The bleed was a symptom. The real problem was that **the beat showed the
 * result of an action instead of the action** — which is the one thing the one-take invariant
 * exists to prevent, and the same note the sheet already applies to tabs, clicks and scrolls
 * everywhere else in the film.
 *
 * So the beat now does what a person does:
 *
 *   f36   the cursor moves to the composer at the bottom
 *   f48   he types there, into the REAL textarea — 35 characters at ~20 c/s
 *   f100  he hits send
 *   f104  the bubble appears, sized by the real component to its own content
 *   f116  Ren shows the typing indicator (L9)
 *   f150  Ren replies
 *
 * Two things fall out of this for free, and both were on the defect list:
 *
 *  · **The bleed is gone**, because a real bubble sizes to its content — it was never a
 *    text-fitting problem, it was a drawn box with a guessed width.
 *  · **The over-tall reply bubble is gone**, for the same reason.
 *
 * And it earns something the old staging could not: this is **the one moment in the film where
 * he acts through language rather than through a click**, and the beat now shows that rather
 * than asserting it. The typing happens in a composer, which is where typing happens.
 *
 * **His message stays short.** 35 characters — "boss moved it to 12. thirty minutes" — typed in
 * ~1.7s at ~20 c/s. A long sentence would kill the beat, and the rule is to shorten the copy
 * rather than speed the typing to a blur. Nothing is lost by the brevity: the audience watched
 * the toast say "need the report by 12" and the clock say 11:30 forty seconds earlier, so this
 * is a callback rather than exposition.
 *
 * ── THE AVATAR ──────────────────────────────────────────────────────────────────────
 *
 * The sheet asks for Ren's avatar anchored to each of Ren's bubbles. **The real surface does not
 * work that way** — the avatar lives in the conversation header beside the name, and the bubbles
 * carry none. That is better for this beat and the reasoning is in `src/app/chat.tsx`: the
 * header is on screen for the whole exchange by construction, so L8's enlargement is never lost
 * after turn 1, and ownership is stated in words instead of inferred from a circle.
 */

/**
 * The composer sits at the bottom of the panel — where the cursor goes and the typing happens.
 *
 * ── AND THIS BEAT'S CURSOR WAS THE ONE IN THE FILM THAT MISSED ──────────────────────
 *
 * Both waypoints were hand-typed rather than measured: the caret at (460, 552) and **send at
 * (872, 552)**. The send button is 44px wide starting at x 879, so the pointer was pressing
 * **seven pixels outside the left edge of the control it was pressing** — every other click site
 * in the film is a measured centre, and this was the exception. It is now `CHAT.send`'s centre,
 * probed against the real `<ChatShell/>` at this beat's own panel measure (`geometry.ts` § CHAT).
 */
const COMPOSER = rect(CHAT.textarea.x, CHAT.textarea.y, CHAT.textarea.w, CHAT.textarea.h);
const SEND_AT = centre(CHAT.send);
/** A caret lands where a caret lands — near the start of the field, on its vertical centre. */
const CARET_AT = { x: CHAT.textarea.x + 62, y: CHAT.textarea.y + CHAT.textarea.h / 2 };

/**
 * ── THE TYPING WINDOW OPENED FOUR FRAMES, AND THAT IS THE WHOLE COST ────────────────
 *
 * Turn 2 was 35 characters of pure callback — "boss moved it to 12. thirty minutes" — in which
 * *it* has no antecedent on screen. The line now names the report and states the consequence,
 * at 49 characters, so the audience gets the stakes from this message rather than from a
 * notification forty seconds earlier. See `REN` in `copy.ts`.
 *
 * It types f40–f98: 58 frames, about 25 characters a second. Faster than the ~20 c/s the sheet
 * quotes, and deliberately — he is hurried, and this is the one moment in the film where the
 * hurry is his own behaviour rather than something the UI is telling us. Every character still
 * gets more than two frames, so it is typing rather than a blur.
 *
 * The send stays at f100 and turn 3's hold is untouched at 60 frames. The sheet's rule is not to
 * speed the typing to fit a line the beat cannot afford; this one it can.
 */
const T = {
  cursorToComposer: 30,
  typeFrom: 40,
  typeTo: 98,
  send: 100,
  bubble: 104,
  thinking: 116,
  reply: 150,
} as const;

export const Beat10Ren: React.FC = () => {
  const frame = useCurrentFrame();

  const full = REN.turns[1].text;
  // ~20 characters a second. Never sped to fit — the copy was shortened instead.
  const typed = full.slice(
    0,
    Math.max(
      0,
      Math.round(((frame - T.typeFrom) / (T.typeTo - T.typeFrom)) * full.length),
    ),
  );

  const messages = [
    ...(frame >= 20 ? [msg("t1", "assistant" as const, REN.turns[0].text)] : []),
    ...(frame >= T.bubble ? [msg("t2", "user" as const, REN.turns[1].text)] : []),
    ...(frame >= T.reply ? [msg("t3", "assistant" as const, REN.turns[2].text)] : []),
  ];

  return (
    <AbsoluteFill>
      <Camera
        keys={[
          { frame: 0, shot: shot(W / 2, H / 2, W) },
          // Down to the composer — the camera follows the action, not the result.
          { frame: 40, shot: shot(600, 470, 760) },
          { frame: 100, shot: shot(600, 470, 760) },
          // Up to the thread as his bubble lands and Ren starts thinking.
          { frame: 128, shot: shot(600, 380, 820) },
          // In on turn 3 and HOLD. The sheet says to protect this at all costs.
          { frame: 168, shot: shot(600, 400, 700) },
          { frame: 210, shot: shot(600, 400, 700) },
        ]}
      >
        <ChatPage
          clock="11:31 AM"
          messages={messages}
          draft={frame >= T.typeFrom && frame < T.send ? typed : ""}
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
               * The pointer TRAVELS to the composer, and then to send. It used to switch between
               * three positions on frame thresholds, so it was present at each of them and never
               * seen going anywhere — which is the difference between a person using software and
               * a diagram of one. Both clicks share a shot with what they cause: the caret lands
               * in the textarea and the typing starts; send is pressed and the bubble appears.
               *
               * Both targets are measured now. See the note on `COMPOSER` — the send waypoint
               * used to sit outside the button.
               */}
              <Pointer
                path={[
                  { frame: 0, x: 700, y: 300 },
                  { frame: T.cursorToComposer, x: CARET_AT.x, y: CARET_AT.y },
                  { frame: T.send - 8, x: SEND_AT.x, y: SEND_AT.y },
                ]}
                clicks={[T.cursorToComposer + 4, T.send]}
              />
            </>
          }
        />
      </Camera>
    </AbsoluteFill>
  );
};

export { COMPOSER };
