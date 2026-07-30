import React from "react";
import { AbsoluteFill, continueRender, delayRender } from "remotion";

import { CalibrationBanner } from "@/components/anchor/calibration-banner";
import { FramingOverlay } from "@/components/anchor/framing-overlay";
import { GreenRoom } from "@/components/anchor/green-room";
import { Intro } from "@/components/anchor/intro";
import { RecordingStage } from "@/components/anchor/recording-stage";
import { SuccessState } from "@/components/anchor/success-state";
import { CameraConsentGate } from "@/components/consent/camera-consent-gate";
import { Header } from "@/components/header/header";
import { WelcomeBanner } from "@/components/home/welcome-banner";
import { OpSurfaces } from "@/components/monitor/op-surfaces";
import { SessionTrend } from "@/components/monitor/session-trend";
import { Viewfinder } from "@/components/monitor/viewfinder";
import { ConfirmatoryPrompt } from "@/components/questionnaire/confirmatory-prompt";

import { trendPoints } from "./app/monitor";

import {
  AppShell,
  CALIBRATE_COL,
  CALIBRATE_PREVIEW,
  MONITOR_COL,
  MONITOR_STAGE,
  WORLD,
} from "./app/shell";

/**
 * **The measurement harness, and it is the reason this pass's framing numbers are numbers.**
 *
 * Three consecutive revisions of the beat sheet logged crop complaints, and all three traced to
 * framing fitted against greybox rectangles that only approximated a component. So no framing
 * number in this pass is derived by eye or by scaling an old one: every rect below is measured
 * off the REAL component, rendered at the REAL 1200px world, in dark, and printed to stdout by
 *
 *   npx remotion still SwapProbe out/probe.png --frame=<n> --port 3412 --log=verbose
 *
 * The numbers it emits are transcribed into `src/app/geometry.ts`, which is what the beats
 * actually frame against. This composition is a tool, not a beat — it is never in the cut.
 *
 * It measures by REAL selectors (`[data-testid="bloom"]`, the stateline's `aria-live` paragraph)
 * rather than by wrappers, because a wrapper around an absolutely-positioned child measures 0×0 —
 * which is exactly what the first attempt at this returned for the viewfinder.
 */

/** What to measure, as [label, selector]. Real component selectors wherever one exists. */
const TARGETS: [string, string][] = [
  ["world", "#probe-world"],
  ["stage", "[data-probe='stage']"],
  ["bloom", "[data-testid='bloom']"],
  ["stateline-head", "[data-probe='ops'] p[aria-live='polite']"],
  ["stateline-sub", "[data-probe='ops'] p[aria-live='polite'] + p"],
  ["controls", "[data-probe='ops'] .mt-7"],
  ["footnote", "[data-probe='ops'] p.mt-8"],
  ["ops-block", "[data-probe='ops'] > div"],
  ["viewfinder", "[data-probe='stage'] [aria-hidden='false'], [data-probe='stage'] [data-pinned]"],
  ["session-trend", "[data-testid='session-trend']"],
  ["trend-svg", "[data-testid='session-trend-svg']"],
  ["trend-measured", "[data-testid='session-trend'] div.w-full"],
  ["trend-subtitle", "[data-testid='session-trend-subtitle']"],
  ["trend-empty", "[data-testid='session-trend-empty']"],
  ["timer-row", "[data-probe='timerrow']"],
  ["welcome", "[data-probe='welcome'] header"],
  ["calibration-banner", "[data-probe='calib'] [role='region']"],
  ["success", "[data-probe='success'] > div"],
  ["success-badge", "[data-probe='success'] .size-24"],
  ["confirmatory", "[data-probe='confirm'] [role='dialog'], [data-probe='confirm'] [role='alertdialog']"],
  ["framing-box", "[data-probe='framing']"],
  ["framing-brackets", "[data-probe='framing'] .aspect-\\[3\\/4\\]"],
  ["header", "[data-probe='header'] header"],
  ["intro", "[data-probe='intro'] > div"],
  ["green-room", "[data-probe='greenroom'] > div"],
  ["recording-stage", "[data-probe='recstage'] > div"],
  ["consent-gate", "[data-probe='gate'] > *"],
];

const Measure: React.FC = () => {
  React.useEffect(() => {
    const handle = delayRender("measure");
    let tries = 0;
    const run = () => {
      if (!document.querySelector("[data-testid='session-trend-svg']") && tries++ < 30) {
        requestAnimationFrame(run);
        return;
      }
      go();
    };
    const go = () => {
      const root = document.getElementById("probe-world")!.getBoundingClientRect();
      const lines: string[] = [];
      for (const [label, sel] of TARGETS) {
        const el = document.querySelector(sel);
        if (!el) {
          lines.push(`RECT ${label.padEnd(20)} — NOT FOUND (${sel})`);
          continue;
        }
        const r = el.getBoundingClientRect();
        lines.push(
          `RECT ${label.padEnd(20)} x=${(r.x - root.x).toFixed(1).padStart(7)} y=${(r.y - root.y).toFixed(1).padStart(7)} w=${r.width.toFixed(1).padStart(7)} h=${r.height.toFixed(1).padStart(7)} r=${(r.x - root.x + r.width).toFixed(1)} b=${(r.y - root.y + r.height).toFixed(1)}`,
        );
      }
      // eslint-disable-next-line no-console
      console.log("\n" + lines.join("\n") + "\n");
      continueRender(handle);
    };
    run();
  }, []);
  return null;
};

export const SwapProbe: React.FC = () => (
  <AbsoluteFill style={{ background: "#000" }}>
    <div id="probe-world" style={{ position: "absolute", top: 0, left: 0, width: WORLD.w }}>
      <AppShell
        url="serenify.tech/app/monitor"
        clock="11:30 AM"
        header={
          <div data-probe="header">
            <Header fullName="Mohamed Asem" email="m@example.com" role="employee" />
          </div>
        }
      >
        {/* The monitoring page, at its REAL layout — max-w-3xl, not the greybox's 700. */}
        <div className={MONITOR_COL}>
          <div data-probe="timerrow" className="mb-3 flex items-center gap-3 px-1">
            <span className="inline-flex min-h-11 items-center gap-1.5 rounded-md px-1 text-sm text-muted">
              <span aria-hidden>←</span> Dashboard
            </span>
            <span className="ml-auto text-sm tabular-nums text-muted">
              Session · <b className="font-semibold text-ink">47:12</b>
            </span>
          </div>

          <div data-probe="stage" className={MONITOR_STAGE}>
            <div className="absolute right-4 top-4 z-10">
              <Viewfinder pinned>
                <div className="absolute inset-0 bg-meadow/20" />
              </Viewfinder>
            </div>
            <div data-probe="ops">
              <OpSurfaces
                state={{ op: "active", band: "at_ease", skipCause: null }}
                onAllow={() => {}}
                onRetryBlocked={() => {}}
              />
            </div>
          </div>

          {/* Measured POPULATED, not empty. The empty card is 101.5 tall and the populated one
              is not — beat 11's wide shot was derived from the empty height and framed the
              plot straight off the bottom edge. */}
          <SessionTrend
            sessionId="probe"
            active={false}
            load={async () => trendPoints({ climb: 1, descend: 0.5 })}
            now={() => Date.UTC(2026, 6, 30, 10, 47, 0)}
          />

          <div data-probe="welcome" className="mt-8">
            <WelcomeBanner fullName="Mohamed" />
          </div>
          <div data-probe="calib" className="mt-6">
            <CalibrationBanner />
          </div>
          <div data-probe="success" className="mt-6">
            <SuccessState onDone={() => {}} />
          </div>
        </div>

        {/* ── Calibration, at its REAL column (max-w-lg = 512) ── register item 5 ──
            The preview is a full-width `aspect-video` box (512×288), with a 3:4 bracket
            guide floating INSIDE it at `h-[78%]`. The greybox drew the whole preview 3:4
            at 240 wide; only the bracket target was ever 3:4. */}
        <div className={`${CALIBRATE_COL} mt-8`}>
          <div data-probe="framing" className={CALIBRATE_PREVIEW}>
            <FramingOverlay showNudge={false} gateReady />
          </div>
          <div data-probe="greenroom" className="mt-4">
            <GreenRoom
              guide="active"
              gate="ready"
              ready
              onReady={() => {}}
              onNotNow={() => {}}
            />
          </div>
          <div data-probe="recstage" className="mt-4">
            <RecordingStage remaining={38} onStop={() => {}} />
          </div>
        </div>

        <div data-probe="intro" className="mt-8">
          <Intro onTurnOnCamera={() => {}} />
        </div>

        {/* Beat 4's gate, at page level — NOT wrapped in an outer card, which is why the
            beat can frame one of its cards whole. */}
        <div data-probe="gate" className="mt-8">
          <CameraConsentGate />
        </div>
        <div data-probe="confirm">
          <ConfirmatoryPrompt open onConfirm={() => {}} onFalseAlarm={() => {}} onOpenChat={() => {}} />
        </div>
      </AppShell>
    </div>
    <Measure />
  </AbsoluteFill>
);
