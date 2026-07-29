import React from "react";
import { AbsoluteFill, useCurrentFrame } from "remotion";

import { Camera, shot } from "../Camera";
import { QUESTIONNAIRE } from "../copy";
import { GREY } from "../theme";
import { MonitorSurface, RAIL_X, SESSION_BASE } from "../surfaces";
import { Box, Cursor, Text, useFade } from "../ui";

/**
 * Beat 9 · Confirmatory questionnaire · 0:46–0:50 · 120 frames
 *
 * He answers, and confirms the stress is real — the TRUE-POSITIVE branch. The
 * landing hero deliberately shows the false alarm; that inversion is
 * intentional and is not reconciled anywhere.
 *
 * The sheet says this copy was never recon'd and to greybox it with
 * placeholder. It turns out the surface already exists and is signed off, so
 * the strings here are verbatim from
 * `apps/web/components/questionnaire/confirmatory-prompt.tsx` — one fewer thing
 * to write before the real render.
 */

const CARD = { x: RAIL_X, y: 556, w: 480, h: 400 } as const;

export const Beat09Questionnaire: React.FC = () => {
  const frame = useCurrentFrame();
  const appear = useFade(8, 10);
  const answered = frame >= 92;

  return (
    <AbsoluteFill>
      <Camera
        keys={[
          // Picks up beat 8's closing framing, then goes to the prompt.
          { frame: 0, shot: shot(1030, 462, 1490) },
          { frame: 38, shot: shot(1400, 756, 700) },
          { frame: 120, shot: shot(1400, 756, 700) },
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
              x={CARD.x}
              y={CARD.y}
              w={CARD.w}
              h={CARD.h}
              fill={GREY.surface}
              border={GREY.graphite}
              borderWidth={2}
              radius={14}
            />
            <Box x={CARD.x + 20} y={CARD.y + 22} w={22} h={22} radius={5} fill={GREY.panel} />
            <Text x={CARD.x + 52} y={CARD.y + 20} size={23} weight={700}>
              {QUESTIONNAIRE.title}
            </Text>
            <Text x={CARD.x + 20} y={CARD.y + 62} w={CARD.w - 40} size={20} color={GREY.body} lineHeight={1.5}>
              {QUESTIONNAIRE.body}
            </Text>

            {QUESTIONNAIRE.options.map((option, i) => {
              const chosen = answered && i === QUESTIONNAIRE.chosen;
              return (
                <React.Fragment key={option}>
                  <Box
                    x={CARD.x + 20}
                    y={CARD.y + 176 + i * 64}
                    w={CARD.w - 40}
                    h={52}
                    radius={10}
                    fill={chosen ? GREY.graphite : GREY.page}
                    border={chosen ? GREY.graphite : GREY.border}
                  />
                  <Box x={CARD.x + 36} y={CARD.y + 191 + i * 64} w={22} h={22} radius={5} fill={GREY.panel} />
                  <Text
                    x={CARD.x + 70}
                    y={CARD.y + 190 + i * 64}
                    size={19}
                    weight={chosen ? 700 : 400}
                    color={chosen ? GREY.white : GREY.ink}
                  >
                    {option}
                  </Text>
                </React.Fragment>
              );
            })}

            <Cursor x={CARD.x + 372} y={CARD.y + 198} clickAt={90} />
          </div>
        </MonitorSurface>
      </Camera>
    </AbsoluteFill>
  );
};
