import React from "react";
import { AbsoluteFill, useCurrentFrame } from "remotion";

import { Camera, frameRect, rect, shot } from "../Camera";
import { AppHeader, Desktop } from "../chrome";
import { DASHBOARD } from "../copy";
import { Lift, useLift } from "../lift";
import { COL_W, COL_X, FONT, GREY, H, W } from "../theme";
import { Box, Cursor, Text, TextBlock, useFade } from "../ui";

/**
 * Beat 3 · Dashboard, first arrival · 0:22–0:26 · 120 frames
 *
 * **Arrives by pulling out, not by cutting.** After "Taking you in…" the camera
 * pulls back from the OTP row and the dashboard is simply what is there when it
 * gets wide. Revision 2 panned across the banners on arrival, which was awkward;
 * a pull-out is the natural continuation of a page navigating under a held camera.
 *
 * **Then the travelling lift (L10).** This beat has no push-in available: both
 * banners are 1152 wide inside a 1200 viewport, so the tightest framing that holds
 * either whole is the full frame, and the calibration banner's `text-sm` copy lands
 * at ~5px on a phone. The lift solves it without a type-scale liberty — the banner
 * detaches, travels to a 520px measure at centre frame where the camera *can* frame
 * it tightly, is read at its real 14px, and settles back. Then the click on
 * "Set baseline".
 *
 * **THE BANNER IS A ROW, SEATED AND LIFTED.** It used to be a column, so at its
 * seated 80px height its own contents — the sentence and the button — overflowed top
 * and bottom and crossed the banner's edge in the wide shot. The real banner is a row
 * with the button inside it, and a row is what both states are now: text left, button
 * right, both inside the bounds. The lift narrows the measure; it does not reflow the
 * layout, which also means there is no reflow flicker mid-travel.
 *
 * COST: 5s → 4s. It works and it stays, but it was spending about a second more than
 * the beat can afford, and the 20-word sentence was never going to be fully read
 * whatever the hold — the lift buys legibility, not reading time. The travel and the
 * hold are both tighter, and the beat reads as "calibration is required, he clicks".
 */

const CALIB_HOME = rect(COL_X, 248, COL_W, 80);
/**
 * Staged: a 520px measure, which is what makes 14px readable at framing 580.
 *
 * `y` is 341 rather than the banner's own 248 for a framing reason: at 258 the shot
 * on the lifted card reached up to world y 157 and caught the welcome banner's
 * "Good morning, Youssef" — the page scrim reduced it to a ghost but a *sliced word*
 * in shot is what the framing rule exists to forbid, and revision 3 shipped it as a
 * known residual. At 341 the frame starts at 240, below that text entirely, and
 * everything it does catch is grey bars and card edges behind a 0.9 scrim.
 */
const CALIB_LIFTED = rect(340, 341, 520, 124);
/** Beat 2's closing framing, so this beat opens exactly where that one ended. */
const OTP_SHOT = shot(600, 326, 432);

export const Beat03Dashboard: React.FC = () => {
  const frame = useCurrentFrame();
  const lift = useLift(28, 16, 78, 16);
  const banner = useFade(14, 6);
  // The navigation lands during the pull-out, which is what makes it read as one
  // continuous move rather than as two shots.
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
        <Desktop clock="10:23 AM" url={onDashboard ? "serenify.tech/app" : "serenify.tech/verify"}>
          {onDashboard ? (
            <>
              <AppHeader />

              {/* Welcome banner — left-aligned, as the app has it. */}
              <Box x={COL_X} y={166} w={COL_W} h={66} fill={GREY.surface} border={GREY.border} radius={10} />
              <Text x={COL_X + 24} y={178} size={24} weight={700}>
                {DASHBOARD.welcomeTitle}
              </Text>
              <Text x={COL_X + 24} y={210} size={14} color={GREY.body}>
                {DASHBOARD.welcomeBody}
              </Text>

              {/* The rest of the dashboard. Two columns, well above `min-[880px]`. */}
              <Box x={COL_X} y={352} w={564} h={208} label="today" fill={GREY.surface} />
              <TextBlock x={COL_X + 24} y={396} w={430} lines={4} />
              <Box x={COL_X + 588} y={352} w={564} h={208} label="trend" fill={GREY.surface} />
              <TextBlock x={COL_X + 612} y={396} w={430} lines={4} />

              {/*
               * The calibration banner. It really does pop in post-hydration with
               * no transition, which at 30fps reads as a dropped frame — faded
               * over 6 frames. Then it lifts, is read, and settles.
               */}
              {/*
               * A scrim under the lifted banner. Without it the framing on the
               * lifted card catches the welcome banner's bottom edge, and a sliced
               * word ("…ssef") in shot is exactly what the framing rule forbids.
               * Washing the page back is also what makes the element read as
               * lifted *off* the page rather than resized on it.
               */}
              <Box
                x={0}
                y={0}
                w={W}
                h={H}
                fill={GREY.page}
                border={GREY.page}
                radius={0}
                /* 0.9, not 0.7: at 0.7 the welcome banner's ink still showed
                   through as a legible fragment. */
                opacity={0.9 * lift}
              />

              <div style={{ opacity: banner }}>
                <Lift home={CALIB_HOME} lifted={CALIB_LIFTED} t={lift} seatedPanel>
                  {/*
                   * A ROW, in both states — text left, button right, everything
                   * inside the bounds. Flex does the reflow: at 1152 the sentence is
                   * one line, at 520 it is three, and the button never moves relative
                   * to the right edge.
                   */}
                  <div
                    style={{
                      position: "absolute",
                      inset: 0,
                      display: "flex",
                      flexDirection: "row",
                      alignItems: "center",
                      gap: 20,
                      padding: "0 20px",
                      fontFamily: FONT,
                      boxSizing: "border-box",
                    }}
                  >
                    <div style={{ flex: 1, fontSize: 14, color: GREY.ink, lineHeight: 1.55 }}>
                      {DASHBOARD.calibrationBanner}
                    </div>
                    <div
                      style={{
                        flexShrink: 0,
                        width: 162,
                        height: 44,
                        borderRadius: 8,
                        backgroundColor: GREY.graphite,
                        color: GREY.white,
                        fontSize: 14,
                        fontWeight: 700,
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                      }}
                    >
                      {DASHBOARD.setBaseline}
                    </div>
                  </div>
                </Lift>
              </div>

              <Cursor x={COL_X + COL_W - 90} y={296} clickAt={106} opacity={lift < 0.05 ? banner : 0} />
            </>
          ) : (
            // Still the verify screen for the first third of a second, which is
            // what makes the arrival a move rather than a cut.
            <Text x={400} y={378} w={400} size={14} align="center" color={GREY.label}>
              Taking you in…
            </Text>
          )}
        </Desktop>
      </Camera>
    </AbsoluteFill>
  );
};
