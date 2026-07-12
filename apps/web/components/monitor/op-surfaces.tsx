"use client";

import { Camera, CameraOff, CircleDashed, CloudOff, Focus, LogIn } from "lucide-react";

import { CauseChip } from "@/components/anchor/cause-chip";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

import { Bloom } from "./bloom";
import {
  heldBloomTone,
  liveDisplay,
  type CameraErrorKind,
  type MonitorState,
  type StatelineTone,
} from "./use-monitoring-session";

/**
 * The monitoring stage surfaces — US1 (T030 + the calibrate-first patch) + US2 (T039):
 * permission / warming-up / active (live band) / **out-of-frame** / **paused** / blocked /
 * the skipped-read note / calibrate-first (no-anchor). Plus the lifecycle controls
 * (Pause / Resume / End) the orchestrator wires.
 *
 * Colour discipline (Principle V, roles taken verbatim from the approved mock):
 *  - permission = MEADOW — an affirmative "let's start" invitation (meadow icon + the
 *    meadow "Allow camera access" CTA), NOT an error;
 *  - blocked = FOGGY icon (attention), neutral "Try again";
 *  - calibrate-first = MEADOW icon (calm/affirmative — calibration is a forward next
 *    step, not an error) with a MEADOW "Start calibration" CTA (the mock's `btn-primary`):
 *    the whole panel reads as an invitation, never an error, never amber/foggy;
 *  - the skipped-read note = FOGGY (a couldn't-read, never amber);
 *  - **out-of-frame = FOGGY** (we've lost sight of you — attention, never amber: a
 *    coverage/presence cue is not a stress signal, FR-007/FR-022); the bloom dims but holds
 *    its last colour;
 *  - **paused = neutral** (a calm break, ink stateline, muted body — never amber/foggy);
 *  - amber appears ONLY on the stress bands (a-little-tense / tense statelines).
 * NO number/gauge anywhere — the bloom is ambient and the band is the only signal (FR-015).
 *
 * FR-024 reassurance has TWO authoritative homes, one per surface:
 *  - permission panel → "Your manager never sees your video." (who sees it; traces to the mock);
 *  - active reading card → "Processed just for you — analyzed, then deleted." (what happens to
 *    it — the Principle I privacy-by-architecture line). This second placement resolves
 *    /speckit-analyze U1 (FR-024 had no authoritative home on the live surface); the mock is
 *    intent-only, so the active footnote is a deliberate addition, not a deviation. It is a
 *    quiet MUTED footnote (never a stress/attention colour) and never a number (FR-015).
 */

const STATELINE_CLASS: Record<StatelineTone, string> = {
  meadow: "text-meadow-text", // at-ease — calm/affirmative
  amber: "text-amber", // a-little-tense / tense — the stress bands
  muted: "text-muted", // warming-up — neutral, not amber
};

function PermissionPanel({
  onAllow,
  starting,
}: {
  onAllow: () => void;
  starting: boolean;
}) {
  return (
    <div className="mx-auto flex max-w-md flex-col items-center gap-2 text-center">
      <span className="mb-2 grid size-16 place-items-center rounded-2xl bg-meadow/15 text-meadow">
        <Camera className="size-7" strokeWidth={1.75} aria-hidden />
      </span>
      <h2 className="font-display text-2xl text-ink">Serenify needs your camera</h2>
      <p className="text-pretty text-base leading-relaxed text-muted">
        Reads facial cues to gauge stress while you work. Your manager never sees your video.
      </p>
      <div className="mt-5 max-w-full" aria-live="polite" aria-atomic="true">
        <Button
          onClick={onAllow}
          disabled={starting}
          variant="meadow"
          className="h-12 max-w-full px-6 text-base"
        >
          {starting ? "Waking Serenify..." : "Allow camera access"}
        </Button>
      </div>
    </div>
  );
}

/**
 * Honest per-`err.name` copy for the three camera-access failures (FR-022; mirrors the
 * calibration recorder's CameraAccessState). FOGGY attention, never amber — the camera
 * isn't a stress signal. No generic "blocked" catch-all: a busy device and a missing
 * device each get their own gentle fix.
 */
const CAMERA_ERROR_COPY: Record<CameraErrorKind, { heading: string; body: string }> = {
  blocked: {
    // Sticky-denied camera (008-followups copy): heading + body read as the full sentence
    // "Camera access is blocked. Turn it back on in your browser's site settings, then try again."
    heading: "Camera access is blocked",
    body: "Turn it back on in your browser's site settings, then try again.",
  },
  busy: {
    heading: "Your camera’s in use",
    body:
      "Another app or browser tab may have the camera open. Close it, then try again.",
  },
  "no-device": {
    heading: "No camera found",
    body: "Serenify couldn’t find a camera. Connect one, then try again.",
  },
  insecure: {
    // Non-secure origin (008-followups copy): the camera needs an https context.
    heading: "A secure connection is needed",
    body: "This page needs a secure (https) connection to use your camera.",
  },
};

function BlockedPanel({
  kind,
  onRetry,
}: {
  kind: CameraErrorKind;
  onRetry: () => void;
}) {
  const { heading, body } = CAMERA_ERROR_COPY[kind];
  return (
    <div className="mx-auto flex max-w-md flex-col items-center gap-2 text-center">
      <span className="mb-2 grid size-16 place-items-center rounded-2xl bg-foggy/15 text-foggy">
        <CameraOff className="size-7" strokeWidth={1.75} aria-hidden />
      </span>
      <h2 className="font-display text-2xl text-ink">{heading}</h2>
      <p className="text-pretty text-base leading-relaxed text-muted">{body}</p>
      <div className="mt-5">
        <Button onClick={onRetry} variant="outline" className="h-12 px-6 text-base">
          Try again
        </Button>
      </div>
    </div>
  );
}

/**
 * No stored anchor (create-session 409 `no_anchor`): the employee must calibrate FIRST —
 * no global/fabricated baseline is ever substituted (SC-004). Calibration is a forward,
 * affirmative next step (not stress, not an error), so the icon takes the MEADOW
 * semantic token (calm/affirmative — matching its MEADOW "Start calibration" CTA), never
 * a hardcoded hex and never amber/foggy.
 */
function CalibrateFirstPanel() {
  return (
    <div className="mx-auto flex max-w-md flex-col items-center gap-2 text-center">
      <span className="mb-2 grid size-16 place-items-center rounded-2xl bg-meadow/15 text-meadow">
        <CircleDashed className="size-7" strokeWidth={1.75} aria-hidden />
      </span>
      <h2 className="font-display text-2xl text-ink">Calibrate first</h2>
      <p className="text-pretty text-base leading-relaxed text-muted">
        Serenify needs a quick one-minute baseline before it can read your stress.
      </p>
      <div className="mt-5">
        {/* Plain <a> (NOT next/link): a full document navigation is REQUIRED so
            /app/calibrate loads under its own `camera=(self)` Permissions-Policy — the
            same idiom the calibration banner uses. A client-side <Link> would keep the
            monitor route's camera policy active and break getUserMedia on arrival. */}
        <Button asChild variant="meadow" className="h-12 px-6 text-base">
          <a href="/app/calibrate">Start calibration</a>
        </Button>
      </div>
    </div>
  );
}

/**
 * The sign-in expired and could not be refreshed, so window uploads can no longer carry a
 * valid token (a 401, or an un-refreshable browser session). Scoring STOPS here on an honest
 * surface rather than freezing a healthy-looking band silently — the recurring "frozen band"
 * smoke break. FOGGY attention (never amber — an auth lapse is not a stress signal), and the
 * recovery path is explicit: a full-document `<a>` to /login re-establishes the session (a
 * client-side <Link> would keep this route's auth-less context). Mirrors BlockedPanel's shape.
 */
function SignedOutPanel() {
  return (
    <div className="mx-auto flex max-w-md flex-col items-center gap-2 text-center">
      <span className="mb-2 grid size-16 place-items-center rounded-2xl bg-foggy/15 text-foggy">
        <LogIn className="size-7" strokeWidth={1.75} aria-hidden />
      </span>
      <h2 className="font-display text-2xl text-ink">Your sign-in expired</h2>
      <p className="text-pretty text-base leading-relaxed text-muted">
        Scoring paused because your sign-in timed out. Sign in again to continue your check-in.
      </p>
      <div className="mt-5">
        <Button asChild variant="outline" className="h-12 px-6 text-base">
          <a href="/login">Sign in again</a>
        </Button>
      </div>
    </div>
  );
}

/**
 * The backend couldn't be reached to start the session (the create call's fetch threw, or it
 * returned a 5xx). This is the SERVICE being down — NOT the camera — so it gets its own honest
 * surface instead of the misleading "Camera access is blocked · turn it back on in your
 * browser settings" copy (which sent users to fix a camera that was never the problem). FOGGY
 * attention (a connectivity blip is not a stress signal, never amber), with a "Try again"
 * retry that re-attempts the create (the camera is never opened until a session is confirmed).
 * Mirrors BlockedPanel's shape; the icon + copy point at the connection, not the webcam.
 */
function ServiceUnavailablePanel({ onRetry }: { onRetry: () => void }) {
  return (
    <div className="mx-auto flex max-w-md flex-col items-center gap-2 text-center">
      <span className="mb-2 grid size-16 place-items-center rounded-2xl bg-foggy/15 text-foggy">
        <CloudOff className="size-7" strokeWidth={1.75} aria-hidden />
      </span>
      <h2 className="font-display text-2xl text-ink">Can&apos;t reach Serenify right now</h2>
      <p className="text-pretty text-base leading-relaxed text-muted">
        We couldn&apos;t reach the check-in service to start your session. It&apos;s usually a
        brief blip — try again in a moment.
      </p>
      <div className="mt-5">
        <Button onClick={onRetry} variant="outline" className="h-12 px-6 text-base">
          Try again
        </Button>
      </div>
    </div>
  );
}

/** A skipped read: the bloom holds the last band; a calm FOGGY note names a likely
 *  cause + gentle fix via the shared CauseChip. Never amber (it's attention, not stress). */
function SkipNote({ cause }: { cause: React.ComponentProps<typeof CauseChip>["cause"] }) {
  return (
    <div className="mt-5 w-full max-w-md space-y-2 text-left" role="status" aria-live="polite">
      <p className="text-sm font-semibold text-ink">Couldn&apos;t get a clear read</p>
      <CauseChip cause={cause} />
    </div>
  );
}

/**
 * The lifecycle controls (US2 — T038). 44 px-min touch targets; the mock's button roles:
 * Pause / End are quiet outline ghosts, Resume is the meadow primary (the one affirmative
 * action on the paused surface). Available on every live-ish state, never on the panels.
 */
// Controls stack full-width at narrow widths (≥360 px, big tap targets) and become a
// centred row at sm+ (Principle VI / FR-025). Layout-only — the handlers are unchanged.
const CONTROLS_ROW =
  "mt-7 flex w-full max-w-xs flex-col gap-3 sm:max-w-none sm:flex-row sm:flex-wrap sm:items-center sm:justify-center";
const CONTROL_BTN = "h-11 w-full px-5 sm:w-auto";

function LiveControls({ onPause, onEnd }: { onPause: () => void; onEnd: () => void }) {
  return (
    <div className={CONTROLS_ROW}>
      <Button onClick={onPause} variant="outline" className={CONTROL_BTN}>
        Pause
      </Button>
      <Button onClick={onEnd} variant="outline" className={CONTROL_BTN}>
        End session
      </Button>
    </div>
  );
}

function PausedControls({ onResume, onEnd }: { onResume: () => void; onEnd: () => void }) {
  return (
    <div className={CONTROLS_ROW}>
      <Button onClick={onResume} variant="meadow" className={CONTROL_BTN}>
        Resume
      </Button>
      <Button onClick={onEnd} variant="outline" className={CONTROL_BTN}>
        End session
      </Button>
    </div>
  );
}

/** The class that dims the held bloom on out-of-frame / paused (mock `.bloom.dim`). */
const DIM_BLOOM = "opacity-40 saturate-50 transition-[opacity,filter] duration-700";

function LiveStage({
  state,
  onPause,
  onEnd,
}: {
  state: MonitorState;
  onPause: () => void;
  onEnd: () => void;
}) {
  const d = liveDisplay(state);
  return (
    <div className="flex flex-col items-center text-center">
      <Bloom tone={d.tone} />
      {/* The state line — the bloom carries the feel, this carries the meaning. A live
          region so band changes are announced; NO number is ever rendered (FR-015). */}
      <p
        aria-live="polite"
        className={cn("mt-6 font-display text-3xl tracking-tight", STATELINE_CLASS[d.statelineTone])}
      >
        {d.head}
      </p>
      <p className="mt-1.5 max-w-[42ch] text-base text-muted">{d.sub}</p>
      {state.skipCause && <SkipNote cause={state.skipCause} />}
      <LiveControls onPause={onPause} onEnd={onEnd} />
      {/* FR-024 reassurance footnote — bottom of the reading card, below the band (constitution:
          all text lives in the card, never on the raw video). Quiet MUTED secondary token, small
          and low-emphasis; mt-8 keeps clear of the band so it reads as a calm footnote, not an
          alert. Shown on every live state (warming-up + bands) — not on calibrate-first/permission. */}
      <p className="mt-8 text-xs text-muted">Processed just for you — analyzed, then deleted.</p>
    </div>
  );
}

/**
 * Out-of-frame (US2 — T039): the auto-pause surface. The bloom dims but keeps its last
 * colour; the stateline + the foggy prompt are the attention cue (FOGGY, never amber —
 * a presence cue is not a stress signal). The self-view (force-revealed by the viewfinder)
 * is the user's mirror to re-centre; capture auto-resumes the moment they return.
 */
function OutOfFrameStage({
  state,
  onPause,
  onEnd,
}: {
  state: MonitorState;
  onPause: () => void;
  onEnd: () => void;
}) {
  return (
    <div className="flex flex-col items-center text-center">
      <Bloom tone={heldBloomTone(state)} className={DIM_BLOOM} />
      <p aria-live="polite" className="mt-6 font-display text-3xl tracking-tight text-foggy">
        Waiting for you
      </p>
      <div
        role="status"
        aria-live="polite"
        className="mt-6 flex w-full max-w-md items-start gap-3 rounded-2xl border border-foggy/40 bg-foggy/10 px-4 py-3.5 text-left"
      >
        <Focus className="mt-0.5 size-5 shrink-0 text-foggy" strokeWidth={1.75} aria-hidden />
        <div>
          <p className="text-sm font-semibold text-ink">We&apos;ve lost sight of you</p>
          <p className="mt-0.5 text-sm text-muted">
            Move back into frame and Serenify picks up where you left off.
          </p>
        </div>
      </div>
      <LiveControls onPause={onPause} onEnd={onEnd} />
    </div>
  );
}

/**
 * Paused (US2 — T039): the manual break. Camera off (no self-view), bloom dimmed; a calm,
 * neutral surface — never amber/foggy (a break is not stress or an error). Resume is the
 * meadow affirmative; End closes out to the dashboard.
 */
function PausedStage({
  state,
  onResume,
  onEnd,
}: {
  state: MonitorState;
  onResume: () => void;
  onEnd: () => void;
}) {
  return (
    <div className="flex flex-col items-center text-center">
      <Bloom tone={heldBloomTone(state)} className={DIM_BLOOM} />
      <p className="mt-6 font-display text-3xl tracking-tight text-ink">Paused — taking a break</p>
      <p className="mt-1.5 max-w-[42ch] text-base text-muted">
        Your camera is off. Resume whenever you&apos;re ready.
      </p>
      <PausedControls onResume={onResume} onEnd={onEnd} />
    </div>
  );
}

export function OpSurfaces({
  state,
  starting = false,
  onAllow,
  onRetryBlocked,
  onPause = () => {},
  onResume = () => {},
  onEnd = () => {},
}: {
  state: MonitorState;
  starting?: boolean;
  onAllow: () => void;
  onRetryBlocked: () => void;
  /** US2 lifecycle handlers (optional so the US1 panels render standalone in tests). */
  onPause?: () => void;
  onResume?: () => void;
  onEnd?: () => void;
}) {
  switch (state.op) {
    case "permission":
      return <PermissionPanel onAllow={onAllow} starting={starting} />;
    case "blocked":
      return <BlockedPanel kind={state.cameraError ?? "blocked"} onRetry={onRetryBlocked} />;
    case "signed-out":
      return <SignedOutPanel />;
    case "service-unavailable":
      return <ServiceUnavailablePanel onRetry={onRetryBlocked} />;
    case "calibrate-first":
      return <CalibrateFirstPanel />;
    case "out-of-frame":
      return <OutOfFrameStage state={state} onPause={onPause} onEnd={onEnd} />;
    case "paused":
      return <PausedStage state={state} onResume={onResume} onEnd={onEnd} />;
    case "ended":
      // Terminal — the orchestrator navigates to the dashboard (mock-gap #6: no standalone
      // ended screen). Render nothing during the brief unmount window.
      return null;
    default:
      // warming-up | active — the live bloom stage.
      return <LiveStage state={state} onPause={onPause} onEnd={onEnd} />;
  }
}
