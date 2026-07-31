import React from "react";
import { useCurrentFrame } from "remotion";

import { BreathingOrb } from "@/components/anchor/breathing-guide";
import { FramingOverlay } from "@/components/anchor/framing-overlay";
import { GetReadyCountdown } from "@/components/anchor/get-ready-countdown";
import { GreenRoom } from "@/components/anchor/green-room";
import { Intro } from "@/components/anchor/intro";
import { CaptureProgressBar, RecordingTimer } from "@/components/anchor/recording-timer";
import { RecordingStage } from "@/components/anchor/recording-stage";
import { SuccessState } from "@/components/anchor/success-state";
import { Header } from "@/components/header/header";

import { PROTAGONIST } from "../greybox/copy";
import { CharacterRig, type Pose } from "../greybox/rig";
import {
  BreathPacer,
  CheckDraw,
  IntroPrivacyEmphasis,
  ORB_CYCLE_REAL,
  Ripple,
  useCountdown,
} from "./motion";
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

/**
 * How far the uploading line drops so that it lands on the axis the capture stage occupied —
 * 82px, which is `BEAT5_UPLOADING`'s centre (321.95) less where the bare paragraph falls (240).
 * See the note at its call site.
 */
const UPLOADING_DROP = 82;

export type CalibPhase =
  | "intro"
  | "green-room"
  | "get-ready"
  | "recording"
  | "uploading"
  | "success";

/**
 * The 3 → 2 → 1, actually counting — and counting **once, downward**.
 *
 * ── THE COUNTDOWN THAT RAN BACKWARDS ────────────────────────────────────────────────
 *
 * The previous note here asserted that `<GetReadyCountdown/>`'s `setTimeout` "never fires in a
 * frame-addressed render". **That is false, and it was the bug.** The reduced-motion shim only
 * changes which *variant* a component renders; it does not stop timers, and nothing about a
 * Remotion render stops them either — the renderer keeps ONE live browser page and steps the
 * frame on it, so wall-clock time goes on passing between frames exactly as it does in a browser.
 * `get-ready-countdown.tsx:29-33` is not gated on `reducedMotion` at all: it schedules
 * `setTimeout(… , 1000)` on mount and decrements its own `count` every real second.
 *
 * So two clocks were driving one numeral. The component's `count` ran on the wall clock while
 * `useCountdown`'s `value` ran on the frame, and `key={value}` — which was there to make each
 * number a fresh mount — **re-seeded `count` back up to `value` every time the frame clock
 * stepped**. The result, measured off a frame-by-frame render of f150–f194:
 *
 *     f151-158 "3"   f159-164 "2"   f166-169 "2"   f170-174 "1"   f179-184 "1"   f185+ blank
 *
 * — a count that went 3, 2, back to 2, 1, back to 1, then vanished (the component renders `null`
 * once its own `count` hits 0, `:46`). Rendering the SAME frames as one-off stills, each on a
 * fresh page with no wall clock behind it, gave "3" at f159 and "2" at f170: the frame-derived
 * value, correct. That difference is the whole diagnosis.
 *
 * ── THE FIX: ONE CLOCK ──────────────────────────────────────────────────────────────
 *
 * The numeral on screen is now the frame's, unconditionally. The component still renders — it is
 * the real 128px `role="timer"` box, and its own numeral is *hidden rather than removed* so its
 * grid keeps its layout — and the digit drawn over it carries `get-ready-countdown.tsx:49`'s
 * className character-for-character, so the face, the size, the tabular figures and the drop
 * shadow are the component's own values and cannot drift from them. This is the seam
 * `<BreathPacer/>` already uses one file over, and for the same reason: the component holds the
 * thing we need to drive in React state, and the DOM is the only way in.
 *
 * Keying the mount on the frame instead would also have made every *rendered* frame correct, but
 * it leaves the drift alive whenever a single frame is held for more than a second — a paused
 * Studio, a slow frame — which is precisely the failure being fixed. Hiding the stateful numeral
 * removes the second clock instead of outrunning it.
 *
 * The 300ms zoom-and-fade is unchanged: it is `enter`, on the wrapper, per value.
 */
/** `get-ready-countdown.tsx:49`, verbatim. Quoted, not paraphrased — see above. */
const COUNTDOWN_NUMERAL =
  "font-display text-8xl leading-none tabular-nums text-white drop-shadow-[0_2px_10px_rgba(0,0,0,0.55)]";

const Countdown: React.FC<{ from: number }> = ({ from }) => {
  const { value, enter } = useCountdown(from);
  return (
    <div
      data-countdown
      style={{
        position: "relative",
        opacity: enter,
        // `animate-in … zoom-in-75` — the component's own entrance, which its reduced-motion
        // branch strips. 0.75 → 1 over 300ms.
        scale: 0.75 + 0.25 * enter,
      }}
    >
      {/* The component's own numeral, silenced. `visibility` rather than `display`, so the
          `grid h-32 w-32 place-items-center` box it lives in is untouched. */}
      <style>{`[data-countdown] [role="timer"] > span { visibility: hidden; }`}</style>
      <GetReadyCountdown key={value} from={value} onComplete={() => {}} />
      <span
        aria-hidden
        className={`pointer-events-none absolute inset-0 grid place-items-center ${COUNTDOWN_NUMERAL}`}
      >
        {value}
      </span>
    </div>
  );
};

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
  /** The frame the capture starts on — the breath's zero, so it opens on an inhale. */
  recordingFrom: number;
  /** How long one inhale+exhale runs in this beat. See `useOrbBreath`. */
  breathCycle: number;
}> = ({ phase, pose, gateReady, countdownFrom, recordingFrom, breathCycle }) => (
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
          <Countdown from={countdownFrom} />
        </div>
      </>
    )}

    {phase === "recording" && (
      <>
        <FramingOverlay drift="centred" />
        {/*
         * ── THE ORB BREATHES, AND ITS PACER ALTERNATES ──
         *
         * The reduced-motion shim makes `<BreathingOrb/>` render its static variant: discs held
         * still and a single "Breathe gently" label (`breathing-guide.tsx:32`). That is the
         * behaviour a user who asked their OS for less motion gets, and the film is not that
         * user — the shipped full-motion orb scales its discs on an 8s loop and alternates
         * "Breathe in" / "Breathe out" every four seconds, which is what the beat sheet asked
         * for and what the greybox showed. `<BreathPacer/>` puts both back on the component's
         * own declared numbers. See `motion.tsx`.
         */}
        <div data-orb className="absolute inset-0 grid place-items-center">
          <BreathingOrb />
          <BreathPacer scopeAttr="orb" from={recordingFrom} cycleFrames={breathCycle} />
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
  /** Seconds left on the 60s capture, continuous. Drives the bar and `<RecordingStage/>`. */
  remaining?: number;
  /**
   * The same value, **held** for four frames at a time, for the numerals. See `useCaptureMinute`:
   * at 30× compression a per-frame readout is thirty values a second, which is a texture rather
   * than a number. The bar stays continuous; only the digits are paced.
   */
  shownRemaining?: number;
  /** 0–1, the in-place emphasis on beat 5a's privacy line (§7 / L12). */
  privacyEmphasis?: number;
  /** Frame the success state landed on — the ripple and the check draw from it. */
  successFrom?: number;
  countdownFrom?: number;
  /** Frame the capture starts on. The breath's zero. */
  recordingFrom?: number;
  /**
   * One inhale+exhale, in frames. Beat 5d passes a **third of its window doubled**, so three
   * pacer phases — in, out, in — play inside the compressed minute; see `useOrbBreath` and the
   * arithmetic at `Beat05Calibration.tsx`.
   */
  breathCycle?: number;
  /** World-coordinate layer over everything — the drawn cursor. */
  overlay?: React.ReactNode;
  children?: React.ReactNode;
}> = ({
  clock,
  phase,
  pose,
  gateReady = false,
  remaining = 38,
  shownRemaining = remaining,
  privacyEmphasis = 0,
  successFrom = 0,
  countdownFrom = 0,
  recordingFrom = 0,
  breathCycle = ORB_CYCLE_REAL,
  overlay,
  children,
}) => {
  return (
    <AppShell
      clock={clock}
      url="serenify.tech/app/calibrate"
      overlay={overlay}
      header={
        <Header fullName={PROTAGONIST.fullName} email={PROTAGONIST.email} role="employee" />
      }
    >
      <section className="space-y-6">
        {phase === "intro" && (
          // `data-intro` is the handle the emphasis and the hover both address. The component is
          // untouched; a wrapper is the only seam the video has into a shipped surface.
          <div data-probe="intro" data-intro>
            <Intro onTurnOnCamera={() => {}} />
            <IntroPrivacyEmphasis t={privacyEmphasis} />
          </div>
        )}

        {(phase === "green-room" || phase === "get-ready" || phase === "recording") && (
          <div className={CALIBRATE_COL}>
            {/*
             * The preview itself does NOT breathe. It used to — the monitoring bloom's 6.5s loop
             * was applied to this whole 512×288 box, so the feed, the character and the framing
             * brackets all pulsed together at the wrong period while the orb that is supposed to
             * be breathing sat still. The breath belongs to the orb and is on the orb now.
             */}
            <Preview
              phase={phase}
              pose={pose}
              gateReady={gateReady}
              countdownFrom={countdownFrom}
              recordingFrom={recordingFrom}
              breathCycle={breathCycle}
            />

            {/*
             * ── THE MINUTE, BACK IN FRAME (FR-030) ──
             *
             * `anchor-recorder.tsx:628-632` renders the capture progress bar HUGGING the preview
             * — `mt-2`, directly below it — and this reproduction of the recorder's layout had
             * simply dropped it. That is why the calibration minute stopped reading: the mm:ss
             * readout lives in the controls card further down (FR-031 keeps status *words* off
             * the raw video), which sits outside 5d's framing, so with the bar missing there was
             * nothing on screen saying time was passing and the beat cut to "Setting your
             * baseline…" out of nowhere.
             *
             * The bar is the real component. Its fill is a `transition-[width] duration-1000
             * ease-linear`, which cannot run in a render — but it does not need to: the width is
             * a pure function of `remaining`, and the beat drives `remaining` per frame, so the
             * fill advances every frame instead of once a second. That is smoother than the
             * product and is the compression the sheet already declares (~2s of a 60s process).
             */}
            {/*
             * ── AND THE NUMBERS ARE IN FRAME (§4.2) ──
             *
             * The bar came back last pass and the readout did not, so the compressed minute had
             * a filling bar and nothing that said what it was filling. The point of the sped-up
             * minute is that **a minute is legibly passing**, and a bar alone cannot say "a
             * minute" — it says "some proportion of something".
             *
             * `<RecordingTimer/>` is the real readout and it already renders, in the controls
             * card BELOW the preview (FR-031 keeps status *words* off the raw video). That card
             * starts at world y 492 and 5d's framing ends at 504, so the mm:ss sits **8px under
             * the frame's bottom edge** — visible in the product, out of shot in the beat. Since
             * framing is Pass B's and out of scope here, the readout comes to the shot instead:
             * the same component, on the bar's own row, inside the framing that already exists.
             *
             * FR-031 is honoured rather than worked around. The rule keeps status *words* off the
             * video, and this is neither words nor on the video — it is a numeral beside the bar,
             * below the preview, which is exactly where the bar already lives. The product's own
             * reading of its rule is `<GetReadyCountdown/>`, which puts numerals *over* the feed
             * on the grounds that they are "numbers only".
             *
             * The row is height-capped at 16px so the 20px line box centres inside it: the row
             * then runs y 484–500 and finishes **4px clear** of the frame's 504, where an
             * uncapped row would have landed flush against it. Digits carry no descenders, but a
             * line box kissing the frame edge is the kind of thing that reads as a crop.
             */}
            {phase === "recording" && (
              <div className="mt-2 flex items-center gap-3">
                <div className="flex-1">
                  <CaptureProgressBar remaining={remaining} total={60} />
                </div>
                <div className="flex h-4 shrink-0 items-center">
                  <RecordingTimer remaining={shownRemaining} total={60} />
                </div>
              </div>
            )}

            <div className="mt-4">
              {phase === "green-room" && (
                <div data-probe="greenroom">
                  <GreenRoom
                    guide="active"
                    gate={gateReady ? "ready" : "off-centre"}
                    ready={gateReady}
                    onReady={() => {}}
                    onNotNow={() => {}}
                  />
                </div>
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

{/*
         * Verbatim from `anchor-recorder.tsx:693` — the uploading line REPLACES the capture
         * stage rather than sitting under it, which is the step the greybox used to skip.
         *
         * ── AND IT SAT IN THE TOP QUARTER OF THE FRAME ────────────────────────────────
         *
         * In the product this line appears *where the stage was* — the column above it still
         * carries a heading and the stage's own box, so it lands around the middle of the page.
         * This reproduction replaces the whole stage with the paragraph, so with only its own
         * `py-10` above it the line landed at world y 228–252: a quarter of the way down a frame
         * whose centre is 322, reading as a caption pinned to the top rather than as the app
         * taking over.
         *
         * `UPLOADING_DROP` is the distance from where it falls to where the stage's own centre
         * was, so the line arrives on the axis the preview just left. It is spacing, not copy:
         * the paragraph keeps its verbatim class string and its verbatim words.
         */}
        {phase === "uploading" && (
          <div style={{ paddingTop: UPLOADING_DROP }}>
            <p className="py-10 text-center text-base text-muted" aria-live="polite" role="status">
              Setting your baseline — one calm moment…
            </p>
          </div>
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
