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
 * The window furniture, at a 1200×675 world. One browser window for the whole
 * video — tabs switch, the frame never cuts to another device (beat sheet
 * §Continuity) — so this wraps every beat and its state carries the continuity.
 */

export type TabId = "serenify" | "mail";

/** The omnibox pill, as a rect, so beat 1 can frame it. */
export const OMNIBOX = { x: 60, y: CHROME_Y + 34, w: W - 120, h: 28 } as const;

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
    {/* An envelope flap — a distinct silhouette at any size, which is all beat 8
        actually needs from it. */}
    <svg width={size * 0.62} height={size * 0.46} viewBox="0 0 62 46">
      <rect x={1} y={1} width={60} height={44} rx={5} fill="none" stroke={GREY.white} strokeWidth={5} />
      <path d="M4 7 L31 27 L58 7" fill="none" stroke={GREY.white} strokeWidth={5} />
    </svg>
  </div>
);

export const MenuBar: React.FC<{ clock: string }> = ({ clock }) => (
  <>
    <Box x={0} y={0} w={W} h={MENUBAR_H} fill={GREY.strong} border={GREY.strong} radius={0} />
    <Text x={16} y={6} size={11} weight={700} color={GREY.white} mono>
      MENU BAR
    </Text>
    <Text x={W - 150} y={6} w={134} size={12} weight={700} color={GREY.white} align="right" mono>
      {clock}
    </Text>
  </>
);

export const BrowserChrome: React.FC<{
  tab: TabId;
  url: string;
  /** Beat 1 opens on a blank new tab; the second tab does not exist yet. */
  newTab?: boolean;
  /** Beat 1's caret, while the URL is being typed. */
  caret?: boolean;
}> = ({ tab, url, newTab = false, caret = false }) => {
  const serenifyActive = tab === "serenify";

  return (
    <>
      <Box x={0} y={CHROME_Y} w={W} h={CHROME_H} fill={GREY.panel} border={GREY.panel} radius={0} />

      {/* Tab strip. Two tabs for the whole video: the app, and his mail. */}
      <Box
        x={60}
        y={CHROME_Y + 4}
        w={190}
        h={26}
        fill={serenifyActive ? GREY.surface : GREY.panelAlt}
        border={GREY.border}
        radius={6}
      />
      <Text x={72} y={CHROME_Y + 11} size={11} weight={serenifyActive ? 700 : 400} color={GREY.body}>
        {newTab ? "New tab" : "Serenify"}
      </Text>
      {newTab ? null : (
        <>
          <Box
            x={254}
            y={CHROME_Y + 4}
            w={190}
            h={26}
            fill={serenifyActive ? GREY.panelAlt : GREY.surface}
            border={GREY.border}
            radius={6}
          />
          <div style={{ position: "absolute", left: 264, top: CHROME_Y + 11 }}>
            <MailMark size={13} />
          </div>
          <Text x={283} y={CHROME_Y + 11} size={11} weight={serenifyActive ? 400 : 700} color={GREY.body}>
            Mail
          </Text>
        </>
      )}

      {/* Omnibox. Beat 1's only job is *this is deployed*, so this is where that
          beat opens — the URL is typed here rather than already being there. */}
      <Box
        x={OMNIBOX.x}
        y={OMNIBOX.y}
        w={OMNIBOX.w}
        h={OMNIBOX.h}
        fill={GREY.surface}
        border={caret ? GREY.graphite : GREY.border}
        borderWidth={caret ? 2 : 1}
        radius={14}
      />
      <Text x={OMNIBOX.x + 16} y={OMNIBOX.y + 7} size={14} color={GREY.body} mono>
        {url}
        {caret ? <span style={{ color: GREY.ink }}>|</span> : null}
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
  newTab?: boolean;
  caret?: boolean;
  children?: React.ReactNode;
}> = ({ clock, tab = "serenify", url = "serenify.tech", fill, newTab, caret, children }) => (
  <>
    <MenuBar clock={clock} />
    <BrowserChrome tab={tab} url={url} newTab={newTab} caret={caret} />
    <Viewport fill={fill}>{children}</Viewport>
  </>
);

/** Header height, shared by the app header and the public nav. */
export const HEADER_H = 52;

/** The signed-in app header — sticky, wordmark left. */
export const AppHeader: React.FC = () => (
  <>
    <Box x={0} y={VIEWPORT_Y} w={W} h={HEADER_H} fill={GREY.surface} border={GREY.border} radius={0} />
    <Box x={COL_X} y={VIEWPORT_Y + 15} w={86} h={22} label="wordmark" labelSize={9} fill={GREY.panelAlt} />
    <Box x={COL_X + COL_W - 180} y={VIEWPORT_Y + 16} w={64} h={20} fill={GREY.panelAlt} />
    <Box x={COL_X + COL_W - 104} y={VIEWPORT_Y + 16} w={64} h={20} fill={GREY.panelAlt} />
    <Box x={COL_X + COL_W - 28} y={VIEWPORT_Y + 13} w={26} h={26} radius={13} fill={GREY.fill} />
  </>
);

/** The public navbar — used by beats 1 and 2 only. */
export const PublicNav: React.FC = () => (
  <>
    <Box x={0} y={VIEWPORT_Y} w={W} h={HEADER_H} fill={GREY.surface} border={GREY.border} radius={0} />
    <Box x={COL_X} y={VIEWPORT_Y + 15} w={86} h={22} label="wordmark" labelSize={9} fill={GREY.panelAlt} />
    <div
      style={{
        position: "absolute",
        left: COL_X + COL_W - 250,
        top: VIEWPORT_Y + 18,
        display: "flex",
        gap: 14,
        fontFamily: FONT,
        fontSize: 12,
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
  size = 16,
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
