import React from "react";
import { AbsoluteFill, useCurrentFrame } from "remotion";

import { CalibrationBanner } from "@/components/anchor/calibration-banner";

import { HOME, centre } from "../../app/geometry";
import { HomePage } from "../../app/home";
import { Pointer } from "../../app/pointer";
import { Camera, frameRect, rect, shot } from "../Camera";
import { Lift, useLift } from "../lift";
import { H, W } from "../theme";
import { useFade } from "../ui";

/**
 * Beat 3 · Dashboard, first arrival · 0:21.6–0:25.6 · 120 frames
 *
 * **Arrives by pulling out, not by cutting.** After "Taking you in…" the camera pulls back from
 * the OTP row and the dashboard is simply what is there when it gets wide.
 *
 * ══ THE BANNERS ARE THE REAL COMPONENTS ═════════════════════════════════════════════
 *
 * `<WelcomeBanner/>` and `<CalibrationBanner/>`, which is exactly what the deferred register
 * lists this beat as owing. Two things the swap settled:
 *
 *  · **The greeting is generated, not written.** `WelcomeBanner` derives "Good morning" from the
 *    hour and the first name from `fullName`, so the film passes a fixed `now` of 10:23 and the
 *    banner produces "Good morning, Youssef" itself. The internal clock and the greeting can no
 *    longer disagree, because only one of them is a string.
 *  · **The calibration banner is 86 tall at 1152 wide**, and its "Set baseline" CTA is a foggy
 *    `<Button/>` at the row's right end — 114 × 44 at x 948.8. The greybox drew a 44px-tall
 *    graphite button 162 wide, in the wrong place.
 *
 * The pop-in is real: the component gates on `useSyncExternalStore` with a server snapshot of
 * "dismissed", so it renders nothing until the client reads `sessionStorage`. At 30fps an
 * instant appearance reads as a dropped frame, so it is faded over six frames on a wrapper. The
 * component is not touched.
 *
 * ══ THE TRAVELLING LIFT (L10) ═══════════════════════════════════════════════════════
 *
 * This beat has no push-in available: the banner is 1152 wide inside a 1200 viewport, so the
 * tightest framing that holds it whole is the full frame, and at the full frame its `text-sm`
 * copy lands at about 5px on a phone. The lift solves it without a type-scale liberty — the
 * banner detaches, travels to a 520px measure at centre frame where the camera *can* frame it
 * tightly, is read at its real 14px, and settles back.
 *
 * **The lifted copy is a re-measure of the real banner, not a redraw of it.** The component is
 * rendered inside the lift at a 520px width; flex reflows the sentence from one line to three
 * and the button stays at the right end, because that is what the component's own
 * `sm:flex-row sm:justify-between` does at a narrower measure. Nothing about it is restated.
 *
 * COST: 5s → 4s. The 20-word sentence was never going to be fully read whatever the hold — the
 * lift buys legibility, not reading time.
 */

/** Where the banner lives in the layout, measured. */
const CALIB_HOME = HOME.calibrationBanner;
/**
 * Staged: a 520px measure, which is what makes 14px readable at framing 580.
 *
 * `y` is 341 rather than the banner's own 124 for a framing reason: higher up, the shot on the
 * lifted card reaches into the welcome banner and catches a sliced word, which is what the
 * framing rule exists to forbid. At 341 everything the frame catches above it is card edges
 * behind a 0.9 scrim.
 */
const CALIB_LIFTED = rect(340, 341, 520, 148);
/** Beat 2's closing framing, so this beat opens exactly where that one ended. */
const OTP_SHOT = shot(600, 563.1, 432);

const SET_BASELINE = centre(HOME.setBaseline);

export const Beat03Dashboard: React.FC = () => {
  const frame = useCurrentFrame();
  const lift = useLift(28, 16, 78, 16);
  const banner = useFade(14, 6);
  // The navigation lands during the pull-out, which is what makes it read as one continuous move
  // rather than as two shots.
  const onDashboard = frame >= 8;

  return (
    <AbsoluteFill>
      <Camera
        keys={[
          { frame: 0, shot: OTP_SHOT },
          { frame: 24, shot: shot(W / 2, H / 2, W) },
          { frame: 34, shot: shot(W / 2, H / 2, W) },
          { frame: 56, shot: frameRect(CALIB_LIFTED, 30) },
          { frame: 78, shot: frameRect(CALIB_LIFTED, 30) },
          { frame: 100, shot: shot(W / 2, H / 2, W) },
          { frame: 120, shot: shot(W / 2, H / 2, W) },
        ]}
      >
        <HomePage
          clock="10:23 AM"
          calibrationBanner={onDashboard}
          bannerOpacity={lift > 0.02 ? 0 : banner}
          overlay={
            <>
              {/*
               * A scrim under the lifted banner. Without it the framing on the lifted card
               * catches the welcome banner's edge, and a sliced word in shot is exactly what
               * the framing rule forbids. Washing the page back is also what makes the element
               * read as lifted *off* the page rather than resized on it.
               */}
              <div
                style={{
                  position: "absolute",
                  inset: 0,
                  width: W,
                  height: H,
                  backgroundColor: "var(--color-bg)",
                  /*
                   * 0.97, not 0.9. At 0.9 the welcome banner's `text-4xl` greeting still came
                   * through the wash as a legible fragment — "…oussef" hanging in the top-left
                   * of the shot — and a sliced word in frame is exactly what the scrim exists
                   * to prevent. The greybox got away with 0.9 because its greeting was a small
                   * grey run of text; the real `<WelcomeBanner/>` is 38px of Outfit at full ink.
                   */
                  opacity: 0.97 * lift,
                }}
              />

              {/*
               * The banner itself, travelling. It is the REAL component at both measures — the
               * lift moves and resizes its box, and the component reflows inside it.
               */}
              {lift > 0.02 ? (
                <Lift home={CALIB_HOME} lifted={CALIB_LIFTED} t={lift} panel={false}>
                  <div style={{ position: "absolute", inset: 0 }}>
                    <LiftedBanner />
                  </div>
                </Lift>
              ) : null}

              {/* Then the click on "Set baseline", which is what carries us into beat 4. */}
              <Pointer
                path={[
                  { frame: 90, x: SET_BASELINE.x - 190, y: SET_BASELINE.y + 120 },
                  { frame: 108, x: SET_BASELINE.x, y: SET_BASELINE.y },
                ]}
                clicks={[112]}
                visible={{ from: 88 }}
              />
            </>
          }
        />
      </Camera>
    </AbsoluteFill>
  );
};

/**
 * The banner at its lifted measure. It is the same component the page renders, so the lifted
 * copy cannot drift from the seated one — which is the failure a hand-drawn "lifted version"
 * guarantees eventually.
 */
const LiftedBanner: React.FC = () => <CalibrationBanner />;
