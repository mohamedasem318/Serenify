import React from "react";
import { AbsoluteFill, useCurrentFrame } from "remotion";

import { ChatPage, msg } from "../../app/chat";
import { Camera, rect, shot } from "../Camera";
import { REN } from "../copy";
import { H, W } from "../theme";
import { Cursor } from "../ui";

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

/** The composer sits at the bottom of the panel — where the cursor goes and the typing happens. */
const COMPOSER = rect(300, 520, 600, 64);

const T = {
  cursorToComposer: 36,
  typeFrom: 48,
  typeTo: 100,
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
        />
        {/* The cursor moves to the composer, then to send. The click and its consequence share
            a shot, which is the invariant. */}
        <Cursor
          x={frame >= T.send ? 872 : frame >= T.cursorToComposer ? 420 : 700}
          y={frame >= T.cursorToComposer ? 552 : 300}
          clickAt={T.send}
        />
      </Camera>
    </AbsoluteFill>
  );
};

export { COMPOSER };
