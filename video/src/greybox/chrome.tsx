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

/**
 * The omnibox pill, as a rect, so beat 1 can lift it. Shortened from `W - 120` to
 * make room for the clock at the right end of the same row.
 */
export const OMNIBOX = { x: 60, y: CHROME_Y + 34, w: 960, h: 28 } as const;

/**
 * **The clock (liberty L11), and why it lives in the browser toolbar.**
 *
 * Beat 8's payoff is arithmetic the audience does unaided: the clock says 11:30,
 * the boss says "need the report by 12", and nobody is told it is thirty minutes.
 * With no clock legible on screen there is no arithmetic and no payoff, so the
 * clock is load-bearing furniture and it exists **from beat 1** — one continuous
 * screen recording cannot grow new chrome halfway through.
 *
 * The requirements fight each other. It must read in wide shots (~10px on a phone
 * at a full-frame framing, so ~28 world px), it must be inside beat 8's push-in on
 * the toast, and it must not cost page height — the composition is exactly full at
 * 1200×675 and dropping below 1.6× gives back the magnification L7 exists for.
 *
 * Three forms were considered:
 *
 *  · **macOS menu bar** (the honest place). A 24px bar holds at most ~16px of type,
 *    ~6px on a phone in a wide shot, so the bar would have to grow — page height —
 *    and beat 8's push-in would have to reach world y 0, widening it from 590 to
 *    ~711 and dropping the toast's subject line to ~8.3px. Two costs, both real.
 *  · **App header.** Does not exist in beat 1, where the public nav is up.
 *  · **Browser toolbar, right end of the omnibox row.** The chrome is already 68px
 *    of furniture above the page, so a clock in it costs **zero page height**, and
 *    at y 58–88 it sits directly above the toast — beat 8's push-in widens only
 *    590 → 615, about 7%.
 *
 * The toolbar wins on the number that matters most, and its whole cost is that no
 * real browser draws a clock there, plus its 28px against the URL's 14px. Declared.
 *
 * Its right edge is 1176 — the same as the toast's and the viewfinder's, so beat 8
 * frames a vertical stack rather than three unrelated things.
 */
export const CLOCK = { x: 1036, y: 58, w: 140, h: 30 } as const;

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

/**
 * The menu bar. It used to carry the clock at 12px, which is ~4px on a phone in a
 * wide shot and out of frame entirely in beat 8's push-in — see `CLOCK` above for
 * where the clock went and why. There is exactly one clock in this video.
 */
export const MenuBar: React.FC = () => (
  <>
    <Box x={0} y={0} w={W} h={MENUBAR_H} fill={GREY.strong} border={GREY.strong} radius={0} />
    <Text x={16} y={6} size={11} weight={700} color={GREY.white} mono>
      MENU BAR
    </Text>
  </>
);

/**
 * The clock itself. **Plain, and it must stay plain** — it does not pulse, flash,
 * tint or animate beyond the time changing. Beat 8 works because nobody is told it
 * is bad news; emphasis here would convert a discovery into an instruction. There
 * is no colour available for it either: amber and meadow both carry band meaning.
 */
export const ChromeClock: React.FC<{ clock: string }> = ({ clock }) => (
  <Text
    x={CLOCK.x}
    y={CLOCK.y}
    w={CLOCK.w}
    size={28}
    weight={700}
    color={GREY.body}
    align="right"
    lineHeight={1.05}
    mono
  >
    {clock}
  </Text>
);

/** One tab in the strip. `mail` draws the established <MailMark>. */
export interface TabSpec {
  label: string;
  mail?: boolean;
}

const TAB_W = 190;
const TAB_GAP = 4;
export const tabRect = (i: number) => ({ x: 60 + i * (TAB_W + TAB_GAP), y: CHROME_Y + 4, w: TAB_W, h: 26 });
/** The new-tab button, so beat 2 can put a cursor on it and click it. */
export const newTabRect = (tabCount: number) => ({
  x: 60 + tabCount * (TAB_W + TAB_GAP) + 4,
  y: CHROME_Y + 6,
  w: 22,
  h: 22,
});

export const BrowserChrome: React.FC<{
  tabs: TabSpec[];
  active: number;
  url: string;
  clock: string;
  /** While the URL is being typed. */
  caret?: boolean;
}> = ({ tabs, active, url, clock, caret = false }) => (
  <>
    <Box x={0} y={CHROME_Y} w={W} h={CHROME_H} fill={GREY.panel} border={GREY.panel} radius={0} />

    {/* Tab strip. Tabs are OPENED on camera in beat 2, not cut to, so the strip
        is driven by a list rather than by a two-state flag. */}
    {tabs.map((tab, i) => {
      const r = tabRect(i);
      const isActive = i === active;
      return (
        <React.Fragment key={i}>
          <Box
            x={r.x}
            y={r.y}
            w={r.w}
            h={r.h}
            fill={isActive ? GREY.surface : GREY.panelAlt}
            border={GREY.border}
            radius={6}
          />
          {tab.mail ? (
            <div style={{ position: "absolute", left: r.x + 10, top: r.y + 7 }}>
              <MailMark size={13} />
            </div>
          ) : null}
          <Text
            x={r.x + (tab.mail ? 29 : 12)}
            y={r.y + 7}
            size={11}
            weight={isActive ? 700 : 400}
            color={GREY.body}
          >
            {tab.label}
          </Text>
        </React.Fragment>
      );
    })}

    {/* The new-tab button. Beat 2e clicks this. */}
    {(() => {
      const r = newTabRect(tabs.length);
      return (
        <>
          <Box x={r.x} y={r.y} w={r.w} h={r.h} fill={GREY.panel} border={GREY.panel} radius={11} />
          <Text x={r.x} y={r.y + 3} w={r.w} size={15} weight={700} align="center" color={GREY.body}>
            +
          </Text>
        </>
      );
    })()}

    {/* Omnibox. Beat 1 opens on a lifted copy of this, which settles into it. */}
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

    <ChromeClock clock={clock} />
  </>
);

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
  /** Defaults to the single Serenify tab. Beat 2 drives this explicitly. */
  tabs?: TabSpec[];
  active?: number;
  url?: string;
  fill?: string;
  caret?: boolean;
  children?: React.ReactNode;
}> = ({
  clock,
  tabs = [{ label: "Serenify" }],
  active = 0,
  url = "serenify.tech",
  fill,
  caret,
  children,
}) => (
  <>
    <MenuBar />
    <BrowserChrome tabs={tabs} active={active} url={url} clock={clock} caret={caret} />
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
