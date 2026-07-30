import React from "react";
import { AbsoluteFill, interpolate, useCurrentFrame } from "remotion";

import { LANDING, centre } from "../../app/geometry";
import { OS, OS_FONT, OS_TABULAR } from "../../app/furniture";
import { Hover } from "../../app/hover";
import { LandingPage } from "../../app/landing";
import { Pointer } from "../../app/pointer";
import { OMNIBOX } from "../../app/shell";
import { Camera, frameRect, rect, shot } from "../Camera";
import { Lift, useLift } from "../lift";
import { H, W } from "../theme";

/**
 * Beat 1 · Cold open — `serenify.tech` · 0:00–0:06 · 180 frames
 *
 * **The lift is the opening shot, and this beat is the model for the other two.** The address
 * bar starts alone at centre frame, large — 440 wide instead of the 1080 it really is, which is
 * what lets the camera frame it at 500 and put its real 14px URL at ~12px on a phone.
 * `serenify.tech` is typed into it. Then it travels up and settles into its real position in the
 * browser chrome as the page loads, and the camera pulls out with it.
 *
 * The video's first action is a person deciding to go somewhere.
 *
 * ══ THE PAGE IS THE REAL LANDING PAGE NOW ═══════════════════════════════════════════
 *
 * This beat's only job is *this is deployed*, and it is the one beat where a drawn approximation
 * cannot make the claim at all — a rectangle that says "hero product shot" is a picture of a
 * plan. `<PublicNavbar/>` and `<Hero/>` are the shipped components, and the hero brings a whole
 * second product surface with it: `<StoryCard/>`, with a live bloom, a readout and a narration
 * line. See `src/app/landing.tsx` for why that card is deterministic here for free.
 *
 * ── AND THE SHOT FOLLOWS THE COMPONENT, BECAUSE THE RECTANGLE IT USED TO FRAME IS GONE ──
 *
 * The greybox drew a centred 640-wide block and framed it. The real hero is 1120 across in two
 * columns, its headline is 67.2px rather than 40, and its copy column is 510 wide sitting at
 * x 64 — so the old shot would have framed the gap between the two columns. `frameRect` over the
 * measured copy column is what a landing needs to be: headline, lede, both CTAs and the data
 * line, all four edges inside the frame.
 *
 * ── THE OMNIBOX READS NOW ───────────────────────────────────────────────────────────
 *
 * Its text was `OS.label` (#8d9398) — recessive by design for a URL nobody reads, which is wrong
 * for the one URL in the film that the audience is *watching being typed*. Lifted, it is the
 * subject of the shot, so it takes `OS.clock`, the one furniture value allowed to clear the
 * ramp's lightness band. Seated afterwards it is chrome again and drops back to `OS.label` —
 * the same treatment a browser gives a focused versus an unfocused address bar.
 *
 * ── AND IT IS NOT MONOSPACED ANY MORE (§6.1) ────────────────────────────────────────
 *
 * It was Geist Mono, on the reasoning that an address bar wants stable digit widths. **No
 * mainstream browser sets its omnibox in a monospace face** — Chrome, Safari and Firefox all use
 * the system UI font — and a monospaced address bar is one of the most recognisable tells of a
 * *drawn* browser, which is the one thing this chrome cannot afford to be. It is `OS_FONT`
 * (Inter) with tabular figures, which is what a browser actually does. The full argument is in
 * `furniture.ts` § OS_FONT.
 */

const URL = "serenify.tech";

/** Staged: narrow enough that the camera can frame it and the 14px URL reads. */
const OMNIBOX_LIFTED = rect(380, 288, 440, 52);

/**
 * The hero's copy column, measured — headline, lede, both CTAs and the data line, all four edges
 * inside the frame.
 *
 * **Then shifted left so the story card stays out of it.** `frameRect` is 742 wide here because
 * the column is 369 tall and 16:9 charges for the height; centred on the column that puts the
 * frame's right edge at 690, and `<StoryCard/>`'s left edge is at 626 — so the shot caught 64px
 * of the card, including a sliced line of its narration. A sliced line of text is always a
 * failure. The frame is the same SIZE; only its centre moves, and what it gives up on the left
 * is page background the camera's own backdrop matches exactly.
 */
const HERO_SHOT = (() => {
  const base = frameRect(LANDING.heroCopy, 24);
  const maxRight = LANDING.storyCard.x - 8;
  return { ...base, cx: Math.min(base.cx, maxRight - base.w / 2) };
})();
const CTA = centre(LANDING.ctaGetStarted);

export const Beat01ColdOpen: React.FC = () => {
  const frame = useCurrentFrame();

  // Seated by f74. The page paints at f62, mid-travel, so the two read as one event: he commits
  // to the address, and the site arrives.
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
          { frame: 124, shot: HERO_SHOT },
          { frame: 180, shot: HERO_SHOT },
        ]}
      >
        {loaded ? (
          <LandingPage
            clock="10:20 AM"
            url=""
            tabs={[{ label: "Serenify" }]}
            overlay={
              // Into beat 2 through the product's own CTA, not through a cut. The hand travels
              // in from the right of the hero, arrives on "Get started", and presses it — and
              // the button lights as it lands (§2). `variant="meadow"` (`hero.tsx:60`), so
              // `hover:opacity-90`, snapped: `transition-colors` does not cover opacity.
              <>
                <Hover
                  selector="[data-public] a[href='/signup']"
                  treatment="meadow"
                  from={152}
                  to={180}
                />
                <Pointer
                  path={[
                    { frame: 108, x: CTA.x + 240, y: CTA.y + 96 },
                    { frame: 152, x: CTA.x, y: CTA.y },
                  ]}
                  clicks={[168]}
                  visible={{ from: 104 }}
                />
              </>
            }
          />
        ) : (
          // A blank new tab, mid-navigation. The lifted omnibox is the whole frame.
          <LandingPage clock="10:20 AM" url="" tabs={[{ label: "New tab" }]}>
            <div style={{ position: "absolute", inset: 0, backgroundColor: "var(--color-bg)" }} />
          </LandingPage>
        )}

        {/*
         * The lifted address bar, above everything.
         *
         * ONE SHAPE, ONE RADIUS. This used to be two nested shapes — the lift's own panel at a
         * fixed radius 10, and the pill inside it at 14→26 — so the container's corners sat
         * visibly outside the input at both ends. The pill IS the panel now: `panelStyle`
         * carries the fill, the border and the growing radius, and the child draws only the
         * text. The shadow that says "detached" still comes from the panel.
         */}
        <Lift
          home={OMNIBOX}
          lifted={OMNIBOX_LIFTED}
          t={lift}
          panelStyle={{
            backgroundColor: OS.tabActive,
            border: `${1 + lift}px solid ${lift > 0.5 ? OS.lift : OS.seam}`,
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
              fontFamily: OS_FONT,
              fontFeatureSettings: OS_TABULAR,
              fontSize: 14,
              // Lifted, this is the subject of the shot and reads at `OS.clock`; seated it is
              // chrome again and drops to `OS.label`. Same treatment a browser gives a focused
              // versus an unfocused address bar.
              color: lift > 0.5 ? OS.clock : OS.label,
              boxSizing: "border-box",
            }}
          >
            {URL.slice(0, typedChars)}
            {typedChars < URL.length || !loaded ? (
              <span style={{ color: OS.clock }}>|</span>
            ) : null}
          </div>
        </Lift>
      </Camera>
    </AbsoluteFill>
  );
};
