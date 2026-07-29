import React from "react";
import { AbsoluteFill, interpolate, useCurrentFrame } from "remotion";

import { Camera, frameRect, rect, shot } from "../Camera";
import { Desktop, OMNIBOX, PublicNav } from "../chrome";
import { LANDING } from "../copy";
import { COL_W, COL_X, GREY, H, VIEWPORT_Y, W } from "../theme";
import { Box, Button, Cursor, Text, TextBlock } from "../ui";

/**
 * Beat 1 · Cold open — `serenify.tech` · 0:00–0:05 · 150 frames
 *
 * The beat now shows someone *arriving* at the site rather than already being
 * on it: a blank new tab, the URL typed into the address bar, the page loading.
 * "A website exists" and "someone goes to it" are different statements, and
 * only the second is worth the time.
 *
 * It also ends on a click of the landing page's own **Get started** CTA, which
 * is what carries us into beat 2. No cut — the one-continuous-recording
 * continuity holds, and the primary CTA gets on screen for free.
 *
 * COST: +1s over the sheet's 4s. Typing a URL, loading, reading the hero and
 * clicking through is four actions; the original beat had one.
 */

const URL = "serenify.tech";

/** The hero block — headline, lede, data line, CTAs — framed whole. */
const HERO = rect(280, 176, 640, 258);

export const Beat01ColdOpen: React.FC = () => {
  const frame = useCurrentFrame();

  const typedChars = Math.round(
    interpolate(frame, [14, 44], [0, URL.length], {
      extrapolateLeft: "clamp",
      extrapolateRight: "clamp",
    }),
  );
  const loaded = frame >= 54;

  return (
    <AbsoluteFill>
      <Camera
        keys={[
          { frame: 0, shot: shot(W / 2, H / 2, W) },
          { frame: 12, shot: shot(W / 2, H / 2, W) },
          // The omnibox, framed whole. It is full-bleed furniture, so its own
          // width sets the framing — 1112 wide, i.e. barely a push. `cy` is
          // pinned to half the frame height rather than to the omnibox's centre,
          // because centring on a strip 28px from the top of the world would put
          // most of the frame above the screen.
          { frame: 30, shot: shot(W / 2, 313, 1112) },
          { frame: 52, shot: shot(W / 2, 313, 1112) },
          { frame: 64, shot: shot(W / 2, H / 2, W) },
          // Lands below the public nav rather than through it — 340 is the
          // lowest `cy` that keeps the whole hero block in frame, and it puts
          // the nav's bottom edge exactly at the frame's top.
          { frame: 100, shot: shot(W / 2, 340, frameRect(HERO, 24).w) },
          { frame: 150, shot: shot(W / 2, 340, frameRect(HERO, 24).w) },
        ]}
      >
        <Desktop
          clock="10:20 AM"
          url={URL.slice(0, typedChars)}
          newTab={!loaded}
          caret={!loaded}
          fill={GREY.page}
        >
          {loaded ? (
            <>
              <PublicNav />

              <Text x={HERO.x} y={176} w={HERO.w} size={40} weight={700} align="center" lineHeight={1.2}>
                {LANDING.headlineLead}
                <br />
                <span style={{ color: GREY.graphite }}>{LANDING.headlineAccent}</span>
              </Text>

              <Text x={300} y={290} w={600} size={18} align="center" color={GREY.body}>
                {LANDING.lede}
              </Text>

              <Text x={320} y={358} w={560} size={13} align="center" color={GREY.label}>
                {LANDING.dataLine}
              </Text>

              <Button x={438} y={394} w={150} h={40} size={14}>
                {LANDING.ctaPrimary}
              </Button>
              <Button x={600} y={394} w={162} h={40} size={14} filled={false}>
                {LANDING.ctaSecondary}
              </Button>

              {/* Below the fold: the rest of the page exists, is never read. */}
              <Box x={COL_X} y={545} w={COL_W} h={200} label="hero product shot" fill={GREY.panelAlt} />
              <TextBlock x={COL_X + 40} y={590} w={380} lines={3} />

              {/* Into beat 2 through the product's own CTA, not through a cut. */}
              <Cursor x={556} y={410} clickAt={128} />
            </>
          ) : (
            <>
              {/* A blank new tab. He has not gone anywhere yet. */}
              <Box
                x={W / 2 - 130}
                y={VIEWPORT_Y + 150}
                w={260}
                h={28}
                fill={GREY.panelAlt}
                border={GREY.panelAlt}
                radius={14}
              />
              <Cursor x={OMNIBOX.x + 110} y={OMNIBOX.y + 4} clickAt={6} />
            </>
          )}
        </Desktop>
      </Camera>
    </AbsoluteFill>
  );
};
