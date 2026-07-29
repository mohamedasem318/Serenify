import React from "react";
import { AbsoluteFill } from "remotion";

import { Camera, frameRect, rect, shot, union } from "../Camera";
import { AppHeader, Desktop } from "../chrome";
import { DASHBOARD } from "../copy";
import { COL_W, COL_X, GREY, H, W } from "../theme";
import { Box, Button, Cursor, Text, TextBlock, useFade } from "../ui";

/**
 * Beat 3 · Dashboard, first arrival · 0:18–0:22 · 120 frames
 *
 * Brief wide to establish the shell — sticky header, wordmark, the 1152px column
 * now nearly filling the frame — then settle on the two banners.
 *
 * LEFT ALIGNMENT IS RESTORED. Revision 1 centred the banner copy because at a
 * 1920 viewport nothing left-aligned in a 1152px banner survived a readable
 * framing. At 1200 the copy sits where the app puts it.
 *
 * BUT: this beat no longer has a push-in, and cannot have one. Both banners are
 * full-bleed — 1152 wide inside a 1200 viewport — so the tightest framing that
 * holds either of them whole IS the full frame. There is nowhere to push to. The
 * camera does what is left: a small vertical reposition to centre both banners.
 * Their copy is `text-sm` (14px, the app's own size), which at a full-frame
 * framing lands at about 5px on a phone.
 *
 * The calibration banner really does pop in post-hydration with no transition,
 * which the sheet flags as possibly reading like a glitch. It is faded here over
 * 6 frames: at 30fps an instant appearance genuinely reads as a dropped frame.
 */

const WELCOME = rect(COL_X, 166, COL_W, 66);
const CALIB = rect(COL_X, 248, COL_W, 80);

export const Beat03Dashboard: React.FC = () => {
  const banner = useFade(14, 6);

  return (
    <AbsoluteFill>
      <Camera
        keys={[
          { frame: 0, shot: shot(W / 2, H / 2, W) },
          { frame: 26, shot: shot(W / 2, H / 2, W) },
          { frame: 96, shot: frameRect(union(WELCOME, CALIB), 24) },
          { frame: 120, shot: frameRect(union(WELCOME, CALIB), 24) },
        ]}
      >
        <Desktop clock="10:23 AM" url="serenify.tech/app">
          <AppHeader />

          {/* Welcome banner — left-aligned, as the app has it. */}
          <Box x={WELCOME.x} y={WELCOME.y} w={WELCOME.w} h={WELCOME.h} fill={GREY.surface} border={GREY.border} radius={10} />
          <Text x={WELCOME.x + 24} y={WELCOME.y + 12} size={24} weight={700}>
            {DASHBOARD.welcomeTitle}
          </Text>
          <Text x={WELCOME.x + 24} y={WELCOME.y + 44} size={14} color={GREY.body}>
            {DASHBOARD.welcomeBody}
          </Text>

          {/* Calibration banner — `p-5`, `text-sm`, `h-11` button. Foggy-tinted
              in the app; a flatter grey here. */}
          <div style={{ opacity: banner }}>
            <Box x={CALIB.x} y={CALIB.y} w={CALIB.w} h={CALIB.h} fill={GREY.panelAlt} border={GREY.graphite} radius={10} />
            <Text x={CALIB.x + 20} y={CALIB.y + 20} w={700} size={14} color={GREY.ink} lineHeight={1.6}>
              {DASHBOARD.calibrationBanner}
            </Text>
            <Button x={CALIB.x + CALIB.w - 182} y={CALIB.y + 18} w={162} h={44} size={14}>
              {DASHBOARD.setBaseline}
            </Button>
          </div>

          {/* The rest of the dashboard exists and is never read. Two columns
              above the `min-[880px]` breakpoint, which 1200 clears comfortably. */}
          <Box x={COL_X} y={352} w={564} h={208} label="today" fill={GREY.surface} />
          <TextBlock x={COL_X + 24} y={396} w={430} lines={4} />
          <Box x={COL_X + 588} y={352} w={564} h={208} label="trend" fill={GREY.surface} />
          <TextBlock x={COL_X + 612} y={396} w={430} lines={4} />

          <Cursor x={CALIB.x + CALIB.w - 90} y={CALIB.y + 30} clickAt={106} opacity={banner} />
        </Desktop>
      </Camera>
    </AbsoluteFill>
  );
};
