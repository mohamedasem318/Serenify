import React from "react";
import { AbsoluteFill, interpolate, useCurrentFrame } from "remotion";

import { Camera, frameRect, rect, shot } from "../Camera";
import { Desktop, OMNIBOX, PublicNav } from "../chrome";
import { LANDING } from "../copy";
import { Lift, useLift } from "../lift";
import { COL_W, COL_X, FONT, GREY, H, MONO, W } from "../theme";
import { Box, Button, Cursor, Text, TextBlock } from "../ui";

/**
 * Beat 1 · Cold open — `serenify.tech` · 0:00–0:06 · 180 frames
 *
 * **The lift is the opening shot, and this beat is the model for the other two.**
 * The address bar starts alone at centre frame, large — 440 wide instead of the
 * 1080 it really is, which is what lets the camera frame it at 500 and put its
 * real 14px URL at ~12px on a phone. `serenify.tech` is typed into it. Then it
 * travels up and settles into its real position in the browser chrome as the page
 * loads, and the camera pulls out with it.
 *
 * The video's first action is a person deciding to go somewhere.
 *
 * Then a push toward the hero, and the beat ends on a click of the landing page's
 * own **Get started** CTA, which carries us into beat 2. No cut.
 *
 * COST: 5s → 6s. The lift buys legibility the camera could not, but it is a
 * staged move with a settle at the end of it, and that takes about a second.
 */

const URL = "serenify.tech";

/** Staged: narrow enough that the camera can frame it and the 14px URL reads. */
const OMNIBOX_LIFTED = rect(380, 288, 440, 52);
/** The hero block — headline, lede, data line, CTAs — framed whole. */
const HERO = rect(280, 176, 640, 258);

export const Beat01ColdOpen: React.FC = () => {
  const frame = useCurrentFrame();

  // Seated by f74. The page paints at f62, mid-travel, so the two read as one
  // event: he commits to the address, and the site arrives.
  const lift = useLift(-1, 1, 48, 26);
  const typedChars = Math.round(
    interpolate(frame, [8, 40], [0, URL.length], {
      extrapolateLeft: "clamp",
      extrapolateRight: "clamp",
    }),
  );
  const loaded = frame >= 62;

  return (
    <AbsoluteFill>
      <Camera
        keys={[
          { frame: 0, shot: frameRect(OMNIBOX_LIFTED, 30) },
          { frame: 46, shot: frameRect(OMNIBOX_LIFTED, 30) },
          { frame: 74, shot: shot(W / 2, H / 2, W) },
          { frame: 90, shot: shot(W / 2, H / 2, W) },
          // Lands below the public nav rather than through it.
          { frame: 124, shot: shot(W / 2, 340, frameRect(HERO, 24).w) },
          { frame: 180, shot: shot(W / 2, 340, frameRect(HERO, 24).w) },
        ]}
      >
        {/* The real omnibox stays empty: the lifted one is what is being typed
            into, and it settles back into this slot. */}
        <Desktop
          clock="10:20 AM"
          url=""
          tabs={[{ label: loaded ? "Serenify" : "New tab" }]}
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

              {/* Into beat 2 through the product's own CTA, not through a cut. The
                  click moved later (f158 → f168): the page was lingering ~0.7s after
                  it, which is dead time in the opening beat. Free — no duration
                  changed. */}
              <Cursor x={556} y={410} clickAt={168} />
            </>
          ) : null}

          {/*
           * The lifted address bar. Sits above the page either way.
           *
           * ONE SHAPE, ONE RADIUS. This used to be two nested shapes — the lift's
           * own panel at a fixed radius 10, and the pill inside it at 14→26 — so
           * the container's corners sat visibly outside the input at both ends.
           * The pill IS the panel now: `panelStyle` carries the fill, the border and
           * the growing radius, and the child draws only the text. The shadow that
           * says "detached" still comes from the panel.
           */}
          <Lift
            home={OMNIBOX}
            lifted={OMNIBOX_LIFTED}
            t={lift}
            panelStyle={{
              backgroundColor: GREY.surface,
              border: `1px solid ${GREY.border}`,
              borderRadius: 14 + 12 * lift,
              opacity: 1,
            }}
          >
            <div
              style={{
                position: "absolute",
                inset: 0,
                display: "flex",
                alignItems: "center",
                paddingLeft: 14 + 4 * lift,
                fontFamily: MONO,
                fontSize: 14,
                color: GREY.body,
                boxSizing: "border-box",
              }}
            >
              {URL.slice(0, typedChars)}
              {typedChars < URL.length || !loaded ? (
                <span style={{ color: GREY.ink, fontFamily: FONT }}>|</span>
              ) : null}
            </div>
          </Lift>
        </Desktop>
      </Camera>
    </AbsoluteFill>
  );
};
