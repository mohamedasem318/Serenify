import React from "react";

import {
  CHROME_H,
  CHROME_Y,
  COL_W,
  COL_X,
  FONT,
  GREY,
  H,
  MENUBAR_H,
  MONO,
  VIEWPORT_Y,
  W,
} from "./theme";
import { Box, Text } from "./ui";

/**
 * The window furniture. One browser window for the whole video — tabs switch,
 * the frame never cuts to another device (beat sheet §Continuity) — so this
 * wraps every beat and its state is what carries the continuity.
 */

export type TabId = "serenify" | "mail";

/**
 * The mail app's visual signature. Beat 8's entire meaning hangs on the
 * audience recognising, ~25 seconds later, that the toast is from HIS mail and
 * not from Serenify — if it reads as Serenify notifying him the scene inverts.
 * The disambiguator is this mark, so it is one component used in both places,
 * never two lookalikes.
 */
export const MailMark: React.FC<{ size: number }> = ({ size }) => (
  <div
    style={{
      width: size,
      height: size,
      borderRadius: size * 0.24,
      backgroundColor: GREY.graphite,
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      flexShrink: 0,
    }}
  >
    {/* An envelope flap — a distinct silhouette at any size, which is what
        beat 8 actually needs from it. */}
    <svg width={size * 0.62} height={size * 0.46} viewBox="0 0 62 46">
      <rect x={1} y={1} width={60} height={44} rx={5} fill="none" stroke={GREY.white} strokeWidth={5} />
      <path d="M4 7 L31 27 L58 7" fill="none" stroke={GREY.white} strokeWidth={5} />
    </svg>
  </div>
);

export const MenuBar: React.FC<{ clock: string }> = ({ clock }) => (
  <>
    <Box x={0} y={0} w={W} h={MENUBAR_H} fill={GREY.strong} border={GREY.strong} radius={0} />
    <Text x={22} y={7} size={13} weight={700} color={GREY.white} mono>
      MENU BAR
    </Text>
    <Text x={W - 200} y={7} w={170} size={14} weight={700} color={GREY.white} align="right" mono>
      {clock}
    </Text>
  </>
);

export const BrowserChrome: React.FC<{ tab: TabId; url: string }> = ({ tab, url }) => {
  const serenifyActive = tab === "serenify";

  return (
    <>
      <Box x={0} y={CHROME_Y} w={W} h={CHROME_H} fill={GREY.panel} border={GREY.panel} radius={0} />

      {/* Tab strip. Two tabs for the whole video: the app, and his mail. */}
      <Box
        x={96}
        y={CHROME_Y + 4}
        w={230}
        h={32}
        fill={serenifyActive ? GREY.surface : GREY.panelAlt}
        border={GREY.border}
        radius={7}
      />
      <Text x={112} y={CHROME_Y + 13} size={13} weight={serenifyActive ? 700 : 400} color={GREY.body}>
        Serenify
      </Text>
      <Box
        x={332}
        y={CHROME_Y + 4}
        w={230}
        h={32}
        fill={serenifyActive ? GREY.panelAlt : GREY.surface}
        border={GREY.border}
        radius={7}
      />
      <div style={{ position: "absolute", left: 346, top: CHROME_Y + 12 }}>
        <MailMark size={16} />
      </div>
      <Text x={370} y={CHROME_Y + 13} size={13} weight={serenifyActive ? 400 : 700} color={GREY.body}>
        Mail
      </Text>

      {/* Omnibox. Beat 1's only job is "this is deployed", so the real URL is
          the payload of the beat and is set at a readable size. */}
      <Box x={96} y={CHROME_Y + 42} w={W - 260} h={30} fill={GREY.surface} border={GREY.border} radius={15} />
      <Text x={116} y={CHROME_Y + 49} size={15} color={GREY.body} mono>
        {url}
      </Text>
    </>
  );
};

/** Everything below the chrome. Beats draw into this. */
export const Viewport: React.FC<{ children?: React.ReactNode; fill?: string }> = ({
  children,
  fill = GREY.page,
}) => (
  <>
    <Box x={0} y={VIEWPORT_Y} w={W} h={H - VIEWPORT_Y} fill={fill} border={fill} radius={0} />
    {children}
  </>
);

/**
 * The whole desktop, in one wrapper. Every beat opens with this so the
 * continuity is structural rather than something each beat has to remember.
 */
export const Desktop: React.FC<{
  clock: string;
  tab?: TabId;
  url?: string;
  fill?: string;
  children?: React.ReactNode;
}> = ({ clock, tab = "serenify", url = "serenify.tech", fill, children }) => (
  <>
    <MenuBar clock={clock} />
    <BrowserChrome tab={tab} url={url} />
    <Viewport fill={fill}>{children}</Viewport>
  </>
);

/** The signed-in app header — sticky, wordmark left. */
export const AppHeader: React.FC = () => (
  <>
    <Box x={0} y={VIEWPORT_Y} w={W} h={64} fill={GREY.surface} border={GREY.border} radius={0} />
    <Box x={COL_X} y={VIEWPORT_Y + 18} w={112} h={28} label="wordmark" labelSize={11} fill={GREY.panelAlt} />
    <Box x={COL_X + COL_W - 210} y={VIEWPORT_Y + 20} w={80} h={24} fill={GREY.panelAlt} />
    <Box x={COL_X + COL_W - 120} y={VIEWPORT_Y + 20} w={80} h={24} fill={GREY.panelAlt} />
    <div style={{ position: "absolute", left: COL_X + COL_W - 32, top: VIEWPORT_Y + 16 }}>
      <Box x={0} y={0} w={32} h={32} fill={GREY.fill} radius={16} />
    </div>
  </>
);

/** The public navbar — used by beats 1 and 2 only. */
export const PublicNav: React.FC = () => (
  <>
    <Box x={0} y={VIEWPORT_Y} w={W} h={64} fill={GREY.surface} border={GREY.border} radius={0} />
    <Box x={COL_X} y={VIEWPORT_Y + 18} w={112} h={28} label="wordmark" labelSize={11} fill={GREY.panelAlt} />
    <div
      style={{
        position: "absolute",
        left: COL_X + COL_W - 300,
        top: VIEWPORT_Y + 20,
        display: "flex",
        gap: 16,
        fontFamily: FONT,
        fontSize: 14,
        color: GREY.body,
      }}
    >
      <span>How it works</span>
      <span>Privacy</span>
      <span style={{ fontWeight: 700 }}>Get started</span>
    </div>
  </>
);

/**
 * The corner session readout. The seconds tick because the sheet asks for it —
 * a liveness cue that costs nothing, and on video a frozen timer reads as a
 * still frame.
 */
export const SessionReadout: React.FC<{ x: number; y: number; seconds: number; size?: number }> = ({
  x,
  y,
  seconds,
  size = 26,
}) => {
  const mm = Math.floor(seconds / 60);
  const ss = Math.floor(seconds % 60);
  return (
    <div
      style={{
        position: "absolute",
        left: x,
        top: y,
        fontFamily: MONO,
        fontSize: size,
        fontWeight: 700,
        color: GREY.body,
        whiteSpace: "nowrap",
      }}
    >
      {`Session · ${mm}:${String(ss).padStart(2, "0")}`}
    </div>
  );
};
