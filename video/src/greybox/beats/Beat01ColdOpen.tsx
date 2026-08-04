import React from "react";
import { AbsoluteFill, interpolate } from "remotion";
import { useCurrentFrame } from "../../retime";

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
 * ══ THE HERO BLOCK IS CENTRED IN THE FRAME, AND THE DATA LINE IS WHAT PAYS FOR IT ═══
 *
 * The shot used to frame the whole copy column — headline, lede, both CTAs **and the data line**
 * — and then **shift the frame left** so `<StoryCard/>` stayed out of it. That shift is the
 * off-centre reading: the frame is 741.9 wide for a 510-wide column, and the clamp put 183 of the
 * 232px of slack on the left and 49 on the right. The column's centre line sat **71.9 world px
 * right of the frame's**, which at 2.588× is **186px of a 1920 frame** — a 486px left gutter
 * against a 114px right one.
 *
 * ── CENTRING IT ON THE FULL COLUMN IS GEOMETRICALLY IMPOSSIBLE, AND THAT IS ARITHMETIC ──
 *
 * The column is 369.3 tall, so 16:9 charges **at least 656.5** of width for it at zero margin.
 * Centred on the column (cx 319) that puts the frame's right edge at 647.3 at best and 690 at the
 * shot's real size — and the story card's left border is at **626**. So *every* centred frame that
 * holds the whole column whole reaches into the card: 21.3 world px in the best case, 63.9 at
 * margin 24, which is the card's border, the corner of its bloom and two sliced lines of its
 * narration. Rendered and confirmed, not derived: `out/hero-centred.png`.
 *
 * ── SO THE BLOCK BEING CENTRED IS THE ONE WITHOUT THE DATA LINE ────────────────────
 *
 * Headline, lede and both CTAs — 325.3 tall rather than 369.3, which is what drops the 16:9 floor
 * far enough to fit. `FR-024`'s data line ("Your camera is read, then forgotten. Only the reading
 * is kept.") sits **below** the frame's bottom edge, wholly out rather than sliced, which is the
 * framing rule's own alternative to cropping. Its idea is not lost from the film: beat 4 is a
 * whole beat of camera consent and beat 5a's privacy line takes the in-place emphasis at full
 * amplitude.
 *
 * ── AND THE WIDTH IS DERIVED FROM THE CARD, NOT PICKED ─────────────────────────────
 *
 * `HERO_W` is the **widest centred frame whose right edge still clears the card's left border**,
 * so the margin around the block is the largest the geometry allows rather than a number chosen
 * to fit. It comes out at 610, i.e. **8.9 world px of clearance on all four sides** — 28px of a
 * 1920 frame — and the push is 3.15× rather than 2.59×, so the 67.2px headline reads at 46.5px on
 * a phone instead of 38.2.
 *
 *   frame        x  14.0 – 624.0   y 266.0 – 609.1
 *   block        x  64.0 – 574.0   y 274.9 – 600.2      centred, 8.9 clear on every side
 *   story card   x 626.0                                 2.0 clear of the frame's right edge
 *   data line    y 620 –                                 10.9 below the frame's bottom edge
 */
const HERO_BLOCK = rect(
  LANDING.heroCopy.x,
  LANDING.heroCopy.y,
  LANDING.heroCopy.w,
  LANDING.ctaGetStarted.y + LANDING.ctaGetStarted.h - LANDING.heroCopy.y,
);
const HERO_CX = HERO_BLOCK.x + HERO_BLOCK.w / 2;
/** The widest centred frame whose right edge still clears the story card's left border by 2. */
const HERO_W = 2 * (LANDING.storyCard.x - 2 - HERO_CX);
const HERO_SHOT = shot(HERO_CX, HERO_BLOCK.y + HERO_BLOCK.h / 2, HERO_W);
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
                {/*
                 * It rises into frame from BELOW, which is the only edge that is reliably
                 * off-frame while the camera is still pulling in — everything to the left, right
                 * and above is inside the wider intermediate frames. The tighter landing (609.1
                 * rather than 668.2 at the bottom) is why both numbers moved: the travel starts
                 * 12 frames earlier so it still crosses the frame edge as the camera settles at
                 * f124 rather than ten frames after it, and `visible` opens at f118, where the
                 * cursor is still 10px under the closing frame's own bottom edge.
                 */}
                <Pointer
                  path={[
                    { frame: 96, x: CTA.x + 260, y: CTA.y + 56 },
                    { frame: 152, x: CTA.x, y: CTA.y },
                  ]}
                  clicks={[168]}
                  visible={{ from: 118 }}
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
