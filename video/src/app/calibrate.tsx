import React from "react";
import { useCurrentFrame } from "remotion";

import { BreathingOrb } from "@/components/anchor/breathing-guide";
import { FramingOverlay } from "@/components/anchor/framing-overlay";
import { GetReadyCountdown } from "@/components/anchor/get-ready-countdown";
import { GreenRoom } from "@/components/anchor/green-room";
import { Intro } from "@/components/anchor/intro";
import { RecordingStage } from "@/components/anchor/recording-stage";
import { SuccessState } from "@/components/anchor/success-state";
import { Header } from "@/components/header/header";

import { CharacterRig, type Pose } from "../greybox/rig";
import { useBreath, CheckDraw, Ripple } from "./motion";
import { AppShell, CALIBRATE_COL, CALIBRATE_PREVIEW } from "./shell";

/**
 * ══ THE CALIBRATION PAGE, AS THE REAL COMPONENTS ════════════════════════════════════
 *
 * `<CalibrateRecorder/>` itself is not used — it owns `getUserMedia`, a `MediaRecorder`, the
 * face detector, a `/healthz` probe and four network paths, none of which can exist in a
 * frame-addressed render. Its **layout** is reproduced from `anchor-recorder.tsx:558-690`
 * (class strings quoted in `shell.tsx`), and every part with visual substance is the real
 * component: `<Intro/>`, `<FramingOverlay/>`, `<GreenRoom/>`, `<GetReadyCountdown/>`,
 * `<BreathingOrb/>`, `<RecordingStage/>`, `<SuccessState/>`.
 *
 * ── REGISTER ITEM 5, IN ONE LINE ────────────────────────────────────────────────────
 *
 * The preview is a full-width **`aspect-video`** box — 512 × 288 in the `max-w-lg` column — with
 * a **3:4 bracket guide floating inside it** at `aspect-[3/4] h-[78%]`, i.e. 168.5 × 224.6.
 * The greybox drew the whole preview 3:4 at 240 wide. The *bracket target* was always genuinely
 * 3:4 and 5b was faithful to it; the *box* never was.
 *
 * Going faithful is not cosmetic. The bracket target is only **33% of the box's width**, so
 * where he sits inside the frame is now a visible fact rather than an inset inside a 3:4 box
 * his face already filled — which is precisely why the register expected the change to "let the
 * centering nudge land harder". It does, and for a measurable reason.
 */

export type CalibPhase =
  | "intro"
  | "green-room"
  | "get-ready"
  | "recording"
  | "uploading"
  | "success";

/**
 * The preview box. The character fills it, and the rig sizes itself off the box's ASPECT rather
 * than its pixels — so the same component that fills the 16:9 monitoring viewfinder fills this
 * 16:9 one with no second set of numbers. Under the old 3:4 greybox box it was re-framing to a
 * portrait crop; at 16:9 it simply does what the monitoring beats do.
 */
const Preview: React.FC<{
  phase: CalibPhase;
  pose: Pose;
  gateReady: boolean;
  countdownFrom: number;
}> = ({ phase, pose, gateReady }) => (
  <div className={CALIBRATE_PREVIEW}>
    {/* `anchor-recorder.tsx:580` — the feed is eased to softened for get-ready and recording
        (FR-013), sharp in the green room. The blur is the component's own `blur-[2px]`. */}
    <div
      style={{
        position: "absolute",
        inset: 0,
        filter: phase === "get-ready" || phase === "recording" ? "blur(2px)" : undefined,
      }}
    >
      <CharacterRig x={0} y={0} w={512} h={288} pose={pose} uid="calib" />
    </div>

    {phase === "green-room" && <FramingOverlay showNudge={false} gateReady={gateReady} />}

    {phase === "get-ready" && (
      <>
        <FramingOverlay showNudge={false} />
        <div className="absolute inset-0 grid place-items-center bg-ink/10">
          <GetReadyCountdown onComplete={() => {}} />
        </div>
      </>
    )}

    {phase === "recording" && (
      <>
        <FramingOverlay drift="centred" />
        <div className="absolute inset-0 grid place-items-center">
          <BreathingOrb />
        </div>
      </>
    )}
  </div>
);

export const CalibratePage: React.FC<{
  clock: string;
  phase: CalibPhase;
  pose: Pose;
  gateReady?: boolean;
  /** Seconds left on the 60s capture. Drives the real `<RecordingStage/>`. */
  remaining?: number;
  /** Frame the success state landed on — the ripple and the check draw from it. */
  successFrom?: number;
  countdownFrom?: number;
  children?: React.ReactNode;
}> = ({
  clock,
  phase,
  pose,
  gateReady = false,
  remaining = 38,
  successFrom = 0,
  countdownFrom = 0,
  children,
}) => {
  const breath = useBreath();

  return (
    <AppShell
      clock={clock}
      url="serenify.tech/app/calibrate"
      header={<Header fullName="Mohamed Asem" email="mohamed@serenify.tech" role="employee" />}
    >
      <section className="space-y-6">
        {phase === "intro" && <Intro onTurnOnCamera={() => {}} />}

        {(phase === "green-room" || phase === "get-ready" || phase === "recording") && (
          <div className={CALIBRATE_COL}>
            {/* The breathing orb's own framer loop cannot run in a render, so the component
                takes its static variant and the breath is re-applied here from the frame, on
                the values `breathing-guide.tsx` declares. */}
            <div
              style={
                phase === "recording"
                  ? { scale: breath.scale, transformOrigin: "50% 50%" }
                  : undefined
              }
            >
              <Preview phase={phase} pose={pose} gateReady={gateReady} countdownFrom={countdownFrom} />
            </div>

            <div className="mt-4">
              {phase === "green-room" && (
                <GreenRoom
                  guide="active"
                  gate={gateReady ? "ready" : "off-centre"}
                  ready={gateReady}
                  onReady={() => {}}
                  onNotNow={() => {}}
                />
              )}
              {phase === "get-ready" && (
                <div className="flex flex-col items-center gap-3 text-center">
                  <p className="text-sm text-muted">Beginning now — settle in.</p>
                </div>
              )}
              {phase === "recording" && (
                <RecordingStage remaining={remaining} onStop={() => {}} />
              )}
            </div>
          </div>
        )}

        {/* Verbatim from `anchor-recorder.tsx:693` — the uploading line REPLACES the capture
            stage rather than sitting under it, which is the step the greybox used to skip. */}
        {phase === "uploading" && (
          <p className="py-10 text-center text-base text-muted" aria-live="polite" role="status">
            Setting your baseline — one calm moment…
          </p>
        )}

        {phase === "success" && (
          <div data-calib-success style={{ position: "relative" }}>
            {/*
             * ── REGISTER ITEM 4's MOTION ──
             *
             * Under forced reduced motion the real component renders no ripple at all
             * (`success-state.tsx:29`) and a complete check path, which is the right static base.
             * Both are put back from the frame, on the component's OWN declared values — the
             * ripple at `scale 0.8 → 2.1 / opacity 0.5 → 0` over 1.1s easeOut, and the check as a
             * dash-offset sweep over 0.5s after a 0.1s delay, which is what framer's `pathLength`
             * compiles to anyway.
             */}
            <CheckDraw scopeAttr="calib-success" startFrame={successFrom} />
            <div
              style={{
                position: "absolute",
                left: "50%",
                top: 24,
                width: 96,
                height: 96,
                translate: "-50% 0",
                pointerEvents: "none",
              }}
            >
              <Ripple startFrame={successFrom} />
            </div>
            <SuccessState onDone={() => {}} />
          </div>
        )}
      </section>
      {children}
    </AppShell>
  );
};

export { useCurrentFrame };
