import React from "react";
import { AbsoluteFill, useCurrentFrame } from "remotion";

import { Camera, frameRect, rect, shot } from "../Camera";
import { AppHeader, Desktop } from "../chrome";
import { DASHBOARD } from "../copy";
import { Lift, useLift } from "../lift";
import { COL_W, COL_X, FONT, GREY, H, W } from "../theme";
import { Box, Cursor, Text, TextBlock, useFade } from "../ui";

/**
 * Beat 3 · Dashboard, first arrival · 0:22–0:27 · 150 frames
 *
 * **Arrives by pulling out, not by cutting.** After "Taking you in…" the camera
 * pulls back from the OTP row and the dashboard is simply what is there when it
 * gets wide. Revision 2 panned across the banners on arrival, which was awkward;
 * a pull-out is the natural continuation of a page navigating under a held camera.
 *
 * **Then the lift.** Revision 2 established that this beat has no push-in
 * available: both banners are 1152 wide inside a 1200 viewport, so the tightest
 * framing that holds either whole is the full frame, and the calibration banner's
 * `text-sm` copy lands at ~5px on a phone. The lift solves it without a
 * type-scale liberty — the banner detaches, reflows to a 520px measure at centre
 * frame where the camera *can* frame it tightly, is read at its real 14px, and
 * settles back. Then the click on "Set baseline".
 *
 * COST: 4s → 5s. The lift is a staged move with a settle at the end, and the
 * pull-out from beat 2 eats the first second.
 */

const CALIB_HOME = rect(COL_X, 248, COL_W, 80);
/** Staged: a 520px measure, which is what makes 14px readable at framing 580. */
const CALIB_LIFTED = rect(340, 250, 520, 160);
/** Beat 2's closing framing, so this beat opens exactly where that one ended. */
const OTP_SHOT = shot(600, 326, 432);

export const Beat03Dashboard: React.FC = () => {
  const frame = useCurrentFrame();
  const lift = useLift(46, 20, 106, 20);
  const banner = useFade(18, 6);
  // The navigation lands during the pull-out, which is what makes it read as one
  // continuous move rather than as two shots.
  const onDashboard = frame >= 10;

  return (
    <AbsoluteFill>
      <Camera
        keys={[
          { frame: 0, shot: OTP_SHOT },
          { frame: 30, shot: shot(W / 2, H / 2, W) },
          { frame: 44, shot: shot(W / 2, H / 2, W) },
          { frame: 66, shot: frameRect(CALIB_LIFTED, 30) },
          { frame: 106, shot: frameRect(CALIB_LIFTED, 30) },
          { frame: 128, shot: shot(W / 2, H / 2, W) },
          { frame: 150, shot: shot(W / 2, H / 2, W) },
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
                  <div
                    style={{
                      position: "absolute",
                      inset: 0,
                      display: "flex",
                      flexDirection: "column",
                      justifyContent: "center",
                      gap: 14 + 8 * lift,
                      padding: `0 ${20 + 8 * lift}px`,
                      fontFamily: FONT,
                      boxSizing: "border-box",
                    }}
                  >
                    <div style={{ fontSize: 14, color: GREY.ink, lineHeight: 1.6, maxWidth: 700 }}>
                      {DASHBOARD.calibrationBanner}
                    </div>
                    <div
                      style={{
                        alignSelf: lift > 0.5 ? "flex-start" : "flex-end",
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

              <Cursor x={COL_X + COL_W - 90} y={296} clickAt={138} opacity={lift < 0.05 ? banner : 0} />
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
