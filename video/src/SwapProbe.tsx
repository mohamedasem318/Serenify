import React from "react";
import { AbsoluteFill, continueRender, delayRender } from "remotion";

import { CalibrationBanner } from "@/components/anchor/calibration-banner";
import { FramingOverlay } from "@/components/anchor/framing-overlay";
import { GreenRoom } from "@/components/anchor/green-room";
import { Intro } from "@/components/anchor/intro";
import { RecordingStage } from "@/components/anchor/recording-stage";
import { SuccessState } from "@/components/anchor/success-state";
import { ChatShell } from "@/components/chat/chat-shell";
import { CameraConsentGate } from "@/components/consent/camera-consent-gate";
import { Header } from "@/components/header/header";
import { ThingsThatMightHelpCard } from "@/components/home/things-that-might-help-card";
import { TodaysCheckinCard } from "@/components/home/todays-checkin-card";
import { WelcomeBanner } from "@/components/home/welcome-banner";
import { Hero } from "@/components/landing/hero";
import { OpSurfaces } from "@/components/monitor/op-surfaces";
import { SessionTrend } from "@/components/monitor/session-trend";
import { Viewfinder } from "@/components/monitor/viewfinder";
import { PublicNavbar } from "@/components/public/public-navbar";
import { ConfirmatoryPrompt } from "@/components/questionnaire/confirmatory-prompt";

import { AuthShell, CheckEmailSurface, SignupSurface } from "./app/auth";
import { HOME_COL, RecentChatsEmpty as RecentChatsEmptyProbe } from "./app/home";
import { TREND, TREND_GAP, TREND_NATURAL_W, TREND_SCALE } from "./app/geometry";
import { MEASURE_SCALE_ATTR } from "./app/measure-patch";
import { StageLayout, trendPoints } from "./app/monitor";
import { fontsReady } from "./fonts";

/** The chat panel needs a conversation to render its composer. Shape only; no messages. */
const PROBE_CONVERSATION = {
  id: "probe",
  title: "Checking in",
  state: "open" as const,
  rollupBand: null,
  messageCount: 0,
  lastMessageAt: null,
  createdAt: "2026-07-30T11:30:00.000Z",
  updatedAt: "2026-07-30T11:30:00.000Z",
};

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
  // The `tense` copy is the WIDEST of the three and the only one that wraps, so it — not the
  // `at_ease` copy the probe happens to render above — is what every horizontal framing number
  // has to clear, at rest AND raised 1.25×. Measuring only `at_ease` is how the emphasis came to
  // be derived against a block 105px narrower than the one it fires on.
  ["stateline-head-tense", "[data-probe='ops-tense'] p[aria-live='polite']"],
  ["stateline-sub-tense", "[data-probe='ops-tense'] p[aria-live='polite'] + p"],
  ["ops-block", "[data-probe='ops'] > div"],
  ["viewfinder", "[data-probe='stage'] [aria-hidden='false'], [data-probe='stage'] [data-pinned]"],
  // ── The trend, in BOTH of the places it exists (L16) ──
  //
  // `trend-natural` is the card at `TREND_NATURAL_W`, which is the width it is DRAWN at; its
  // height is what `RAW.trendNatural.h` carries and every number in the composite descends from
  // it. `trend-in-card` is the same card scaled into the stage card, which is where the film
  // actually puts it — so what is measured is what the beats render, including the fact that the
  // wrapper's scale is divided back out of the component's own self-measurement.
  ["ops-wrapper", "[data-probe='ops']"],
  ["trend-box", "[data-probe='trendcard']"],
  ["trend-in-card", "[data-probe='trendcard'] [data-testid='session-trend']"],
  ["trend-in-card-svg", "[data-probe='trendcard'] [data-testid='session-trend-svg']"],
  ["trend-natural", "[data-probe='trendnat'] [data-testid='session-trend']"],
  ["trend-natural-svg", "[data-probe='trendnat'] [data-testid='session-trend-svg']"],
  ["trend-measured", "[data-probe='trendnat'] [data-testid='session-trend'] div.w-full"],
  ["trend-subtitle", "[data-probe='trendnat'] [data-testid='session-trend-subtitle']"],
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
  // 4.3 — the push-in on "Turn on camera" was cropping the FIRST guideline row's icon tile.
  // The window it has to land inside is [this row's top, the helper line's bottom], and neither
  // end had ever been measured.
  ["intro-row-1", "[data-probe='intro'] ul > li:first-child"],
  ["intro-helper", "[data-probe='intro'] > div > div:last-child > p"],
  ["green-room", "[data-probe='greenroom'] > div"],
  ["recording-stage", "[data-probe='recstage'] > div"],
  ["consent-gate", "[data-probe='gate'] > *"],
  ["gate-header", "[data-probe='gate'] header"],
  ["gate-facts-1", "[data-probe='gate'] section > div:nth-of-type(1)"],
  ["gate-facts-2", "[data-probe='gate'] section > div:nth-of-type(2)"],
  ["gate-buttons", "[data-probe='gate'] section > div:last-child"],
  // The privacy pitch — "Nothing is kept. There is no bucket, no table, and no file path where a
  // clip lands." It is the THIRD bullet of the FIRST card (`CAMERA_GATE_WHAT_HAPPENS[2]`), not
  // anything in the second one. The beat had been landing on "What declining changes".
  ["gate-key-line", "[data-probe='gate'] section > div:nth-of-type(1) li:nth-child(3)"],

  // ── The controls the cursor has to travel to (§4) ──────────────────────────────────
  //
  // A drawn pointer that lands NEAR a button is worse than none — it reads as a miss. So every
  // click site in the film is measured off the control it lands on, exactly as every framing
  // number is, and the beats add the component's own page offset.
  ["btn-turn-on-camera", "[data-probe='intro'] button"],
  ["btn-im-ready", "[data-probe='greenroom'] button"],
  ["btn-back-to-home", "[data-probe='success'] button"],
  ["btn-allow-camera", "[data-probe='gate'] button"],
  ["btn-set-baseline", "[data-probe='calib'] a"],
  // `<Notification/>` portals to the document body, so it is NOT under `[data-probe='confirm']`
  // — the first attempt at this measured nothing and reported "NOT FOUND", which is exactly what
  // a portal looks like from a scoped selector. Its own testid is the honest handle.
  ["confirmatory", "[data-testid='notification']"],
  ["btn-yes-thats-me", "[data-testid='notification'] button"],

  // ── Beats 1, 2, 3 and 6's surfaces ────────────────────────────────────────────────
  ["public-navbar", "[data-probe='public'] header"],
  ["hero", "[data-probe='public'] main > section"],
  ["hero-copy", "[data-probe='public'] main > section > div > div:first-child"],
  ["hero-headline", "[data-probe='public'] h1"],
  ["hero-cta", "[data-probe='public'] main a[href='/signup']"],
  ["story-card", "[data-probe='public'] main > section > div > div:last-child"],

  ["auth-col", "[data-probe='signup'] > div"],
  ["auth-wordmark", "[data-probe='signup'] header"],
  ["signup-form", "[data-probe='signup'] section"],
  ["signup-heading", "[data-probe='signup'] h1"],
  ["signup-fields", "[data-probe='signup'] section > div:last-child"],
  ["field-name", "[data-probe='signup'] #full_name"],
  ["field-email", "[data-probe='signup'] #email"],
  ["field-password", "[data-probe='signup'] #password"],
  ["password-rules", "[data-probe='signup'] #password-requirements"],
  ["consent-row", "[data-probe='signup'] #accept_terms"],
  ["btn-create-account", "[data-probe='signup'] section > div > button[type='button']"],
  ["signup-consent-block", "[data-probe='signup'] section > div > div:nth-of-type(2)"],

  ["check-email", "[data-probe='verify'] section"],
  ["check-email-heading", "[data-probe='verify'] h1"],
  ["otp-panel", "[data-probe='verify'] section > section"],
  ["otp-row", "[data-probe='verify'] [data-otp] > div"],
  ["otp-box-0", "[data-probe='verify'] [data-otp] input:nth-child(1)"],
  ["otp-box-5", "[data-probe='verify'] [data-otp] input:nth-child(6)"],

  ["home-col", "[data-probe='home'] > div"],
  ["home-welcome", "[data-probe='home'] [data-probe='welcome'] header"],
  ["home-calib", "[data-probe='home'] [role='region']"],
  ["home-calib-cta", "[data-probe='home'] [role='region'] a"],

  // ── The assets pass's additions ────────────────────────────────────────────────────
  //
  // Beat 10's composer, because its cursor was the one in the film that genuinely MISSED.
  // The send button's centre was being guessed at (872, 552) against an actual (901, 577) —
  // 40px away from a 44px control, so the click landed outside the thing it was clicking.
  // Everything else in the film is measured; this was the exception and it showed.
  ["chat-panel", "[data-probe='chat'] > div"],
  ["chat-composer", "[data-probe='chat'] form"],
  ["chat-textarea", "[data-probe='chat'] textarea"],
  ["chat-send", "[data-testid='chat-send']"],
  ["chat-conv-header", "[data-probe='chat'] [data-probe='convhead'], [data-probe='chat'] form"],

  // The dashboard's real empty states (§5). Their heights are what the beat-3 and beat-6
  // layouts stack on, and the skeleton cards they replace were 196 / 168 by invention.
  ["card-today", "[data-probe='cards'] [data-probe='today'] > div"],
  // The "Start check-in" CTA inside it — the control beat 6 ends on. It had been clicking a
  // grey rectangle, because until this pass the card WAS a grey rectangle.
  ["btn-start-checkin", "[data-probe='cards'] [data-probe='today'] a"],
  ["card-help", "[data-probe='cards'] [data-probe='help'] > div"],
  ["card-chats", "[data-probe='cards'] [data-probe='chats'] > div"],

  // Beat 5a's privacy line — the one §7 raises. It is the only direct `p` child of the
  // intro's root, which is what makes it addressable without a class the video cannot add.
  ["intro-privacy", "[data-probe='intro'] > div > p"],
  ["intro-cta-block", "[data-probe='intro'] > div > div:last-child"],
];

const Measure: React.FC = () => {
  React.useEffect(() => {
    const handle = delayRender("measure", { timeoutInMilliseconds: 60000 });
    let tries = 0;
    const run = () => {
      if (!document.querySelector("[data-testid='session-trend-svg']") && tries++ < 30) {
        requestAnimationFrame(run);
        return;
      }
      // **Measure in the real typeface or do not measure.** Every rect below is a text box or
      // contains one, and Inter and Outfit have different metrics from `system-ui` — a rect
      // taken against a fallback face is wrong by a line height and would then look like a
      // layout bug for the rest of the project's life. `loadFont()` already gates the render,
      // but a probe that reads the DOM in an effect can outrun it.
      void fontsReady().then(() => document.fonts.ready).then(go);
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
        {/* The monitoring page, at the FILM's L15 layout — `max-w-md` (448), the 176 orb, the
            readout inside the card's shortened top band, the sub's two reserved lines and no
            Pause/End controls.
            `<StageLayout/>` is the one component both this probe and `MonitorPage` render, so
            what is measured here is what the beats draw; a probe that measured the shipped
            spacing while the film drew something else is the exact failure this file exists to
            end, and it is how the 22px toast/viewfinder overlap survived a whole pass. */}
        <StageLayout />
        <div className={MONITOR_COL}>
          <div data-probe="stage" data-emph className={MONITOR_STAGE}>
            <div
              data-probe="timerrow"
              className="absolute inset-x-10 top-1 z-10 flex items-center gap-3"
            >
              <span className="inline-flex min-h-11 items-center gap-1.5 rounded-md px-1 text-sm text-muted">
                <span aria-hidden>←</span> Dashboard
              </span>
              <span className="ml-auto text-sm tabular-nums text-muted">
                Session · <b className="font-semibold text-ink">47:12</b>
              </span>
            </div>
            {/* The viewfinder is measured for its own UNSCALED size only — in the film it is
                pinned in the right column at `VIEWFINDER`, outside the scrolling card. */}
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
            {/* The trend, INSIDE the card (L16) — laid out exactly as `monitor.tsx` does, because
                the stage card's height is now a function of it and every framing number descends
                from that height. */}
            <div
              data-probe="trendcard"
              style={{ width: TREND.w, height: TREND.h, marginTop: TREND_GAP, flexShrink: 0 }}
            >
              <div
                {...{ [MEASURE_SCALE_ATTR]: TREND_SCALE }}
                style={{ width: TREND_NATURAL_W, transformOrigin: "top left", scale: TREND_SCALE }}
              >
                <SessionTrend
                  sessionId="probe"
                  active={false}
                  load={async () => trendPoints({ climb: 1, descend: 0.5 })}
                  now={() => Date.UTC(2026, 6, 30, 10, 47, 0)}
                />
              </div>
            </div>
          </div>

          {/* The same card again on the `tense` band, for the ONE thing that differs: the sub
              wraps to two lines at `max-w-[42ch]` and is therefore much wider than the `at_ease`
              copy. Its y is meaningless (it is a second card further down the probe page); its
              x and w are what beat 8's and beat 9's horizontal clearances are checked against. */}
          <div data-emph className={`${MONITOR_STAGE} mt-6`}>
            <div data-probe="ops-tense">
              <OpSurfaces
                state={{ op: "active", band: "tense", skipCause: null }}
                onAllow={() => {}}
                onRetryBlocked={() => {}}
              />
            </div>
          </div>

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

        {/* Measured POPULATED, not empty — and at `TREND_NATURAL_W`, which is the width the film
            DRAWS it at before scaling it into the stage card (L16). A card measured at 512 and
            drawn at 768 is the same class of error as a rect probed without the sticky header. */}
        <div data-probe="trendnat" style={{ width: TREND_NATURAL_W }}>
          <SessionTrend
            sessionId="probe-natural"
            active={false}
            load={async () => trendPoints({ climb: 1, descend: 0.5 })}
            now={() => Date.UTC(2026, 6, 30, 10, 47, 0)}
          />
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

        {/* ── Beats 1, 2, 3 and 6 ───────────────────────────────────────────────────
            Measured inside the same `#probe-world`, so their numbers are in the same
            coordinate space as everything above. Each is offset by whatever page
            position its beat gives it; what is measured here is the component's own
            size and its internal geometry, which is what the framing needs. */}
        <div data-probe="public" className="mt-8">
          <PublicNavbar />
          <main>
            <Hero />
          </main>
        </div>

        <div data-probe="signup" className="mt-8">
          <AuthShell>
            <SignupSurface
              fullName="Youssef Kamal"
              email="youssef.kamal@example.com"
              password="quietmornings7"
              consent
            />
          </AuthShell>
        </div>

        <div data-probe="verify" className="mt-8">
          <AuthShell>
            <CheckEmailSurface otpFrom={0} />
          </AuthShell>
        </div>

        <div data-probe="home" className="mt-8">
          <div className={HOME_COL}>
            <CalibrationBanner />
            <WelcomeBanner fullName="Youssef Kamal" now={new Date(2026, 6, 30, 10, 23)} />
          </div>
        </div>

        {/* ── The assets pass ──────────────────────────────────────────────────────
            Beat 10's composer, at the beat's own panel measure, so the send button's
            centre is measured rather than guessed. The film wraps `<ChatShell/>` in a
            `max-w-2xl` panel of a fixed height; anything else would put the composer at a
            different y and the number would be wrong in a way nobody would notice. */}
        <div data-probe="chat" className="mt-8">
          <div className="mx-auto h-[460px] w-full max-w-2xl overflow-hidden rounded-2xl border border-border">
            <ChatShell
              variant="panel"
              initialConversations={[PROBE_CONVERSATION]}
              initialDetail={{ conversation: PROBE_CONVERSATION, messages: [] }}
            />
          </div>
        </div>

        {/* The dashboard's real empty states (§5), at the real grid. */}
        <div data-probe="cards" className="mt-8">
          <div className={HOME_COL}>
            <div data-probe="today">
              <TodaysCheckinCard />
            </div>
            <div className="grid grid-cols-1 items-start gap-6 min-[880px]:grid-cols-2">
              <div data-probe="help">
                <ThingsThatMightHelpCard />
              </div>
              <div data-probe="chats">
                <RecentChatsEmptyProbe />
              </div>
            </div>
          </div>
        </div>
      </AppShell>
    </div>
    <Measure />
  </AbsoluteFill>
);
