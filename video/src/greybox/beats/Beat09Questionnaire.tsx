import React from "react";
import { AbsoluteFill, useCurrentFrame } from "remotion";

import { Camera, frameRect, union } from "../Camera";
import { QUESTIONNAIRE } from "../copy";
import { CARD, MonitorSurface, PROMPT, SESSION_BASE, VIEWFINDER } from "../surfaces";
import { GREY } from "../theme";
import { Box, Cursor, Text, useFade } from "../ui";

/**
 * Beat 9 · Confirmatory questionnaire · 0:48–0:51 · 90 frames
 *
 * He answers, and confirms the stress is real — the TRUE-POSITIVE branch. The
 * landing hero deliberately shows the false alarm; that inversion is intentional
 * and is not reconciled anywhere.
 *
 * TIGHTENED: revision 1 held the prompt for 120 frames and did not click until
 * f90, so the beat sat on a read the audience had finished two seconds earlier.
 * The read is quick, so the click follows quickly — the prompt lands at f6, the
 * click is at f40, and the beat is now 90 frames. −1s.
 *
 * The copy is verbatim from `components/questionnaire/confirmatory-prompt.tsx`.
 * The sheet says this was never recon'd; the surface turned out to exist and be
 * signed off.
 */
export const Beat09Questionnaire: React.FC = () => {
  const frame = useCurrentFrame();
  const appear = useFade(6, 8);
  const answered = frame >= 44;

  return (
    <AbsoluteFill>
      <Camera
        keys={[
          // Picks up beat 8's closing framing, then lands on the prompt whole.
          { frame: 0, shot: frameRect(union(CARD, VIEWFINDER), 14) },
          { frame: 30, shot: frameRect(PROMPT, 24) },
          { frame: 90, shot: frameRect(PROMPT, 24) },
        ]}
      >
        <MonitorSurface
          clock="11:30 AM"
          tension={1}
          stateline="tense"
          climb={1}
          face="tense"
          sessionFrom={SESSION_BASE + 10}
        >
          <div style={{ opacity: appear }}>
            <Box
              x={PROMPT.x}
              y={PROMPT.y}
              w={PROMPT.w}
              h={PROMPT.h}
              fill={GREY.surface}
              border={GREY.graphite}
              borderWidth={2}
              radius={10}
            />
            <Box x={PROMPT.x + 16} y={PROMPT.y + 16} w={18} h={18} radius={4} fill={GREY.panel} />
            <Text x={PROMPT.x + 42} y={PROMPT.y + 15} size={16} weight={700}>
              {QUESTIONNAIRE.title}
            </Text>
            <Text x={PROMPT.x + 16} y={PROMPT.y + 46} w={PROMPT.w - 32} size={14} color={GREY.body} lineHeight={1.5}>
              {QUESTIONNAIRE.body}
            </Text>

            {QUESTIONNAIRE.options.map((option, i) => {
              const chosen = answered && i === QUESTIONNAIRE.chosen;
              return (
                <React.Fragment key={option}>
                  <Box
                    x={PROMPT.x + 16}
                    y={PROMPT.y + 116 + i * 42}
                    w={PROMPT.w - 32}
                    h={34}
                    radius={8}
                    fill={chosen ? GREY.graphite : GREY.page}
                    border={chosen ? GREY.graphite : GREY.border}
                  />
                  <Box x={PROMPT.x + 28} y={PROMPT.y + 124 + i * 42} w={16} h={16} radius={4} fill={GREY.panel} />
                  <Text
                    x={PROMPT.x + 54}
                    y={PROMPT.y + 124 + i * 42}
                    size={13}
                    weight={chosen ? 700 : 400}
                    color={chosen ? GREY.white : GREY.ink}
                  >
                    {option}
                  </Text>
                </React.Fragment>
              );
            })}

            <Cursor x={PROMPT.x + 232} y={PROMPT.y + 126} clickAt={42} />
          </div>
        </MonitorSurface>
      </Camera>
    </AbsoluteFill>
  );
};
