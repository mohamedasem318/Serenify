import React from "react";
import { AbsoluteFill } from "remotion";
import { useCurrentFrame } from "../../retime";

import { CalibrationBanner } from "@/components/anchor/calibration-banner";

import { AuthPage, CheckEmailSurface } from "../../app/auth";
import { HOME, centre } from "../../app/geometry";
import { HomePage } from "../../app/home";
import { Hover } from "../../app/hover";
import { Pointer } from "../../app/pointer";
import { BEAT4_SEAM } from "../../app/framing";
import { Camera, EASE_DEPART, frameRect, rect, shot } from "../Camera";
import { Lift, useLift } from "../lift";
import { H, W } from "../theme";
import { useFade } from "../ui";
import { BEAT2_SEAM } from "./Beat02Signup";

/**
 * Beat 3 · Dashboard, first arrival · 0:21.6–0:25.6 · 120 frames
 *
 * **Arrives by pulling out, not by cutting.** After "Taking you in…" the camera pulls back from
 * the OTP row and the dashboard is simply what is there when it gets wide.
 *
 * ══ THE BANNERS ARE THE REAL COMPONENTS ═════════════════════════════════════════════
 *
 * `<WelcomeBanner/>` and `<CalibrationBanner/>`, which is exactly what the deferred register
 * lists this beat as owing. Two things the swap settled:
 *
 *  · **The greeting is generated, not written.** `WelcomeBanner` derives "Good morning" from the
 *    hour and the first name from `fullName`, so the film passes a fixed `now` of 10:23 and the
 *    banner produces "Good morning, Youssef" itself. The internal clock and the greeting can no
 *    longer disagree, because only one of them is a string.
 *  · **The calibration banner is 86 tall at 1152 wide**, and its "Set baseline" CTA is a foggy
 *    `<Button/>` at the row's right end — 114 × 44 at x 948.8. The greybox drew a 44px-tall
 *    graphite button 162 wide, in the wrong place.
 *
 * The pop-in is real: the component gates on `useSyncExternalStore` with a server snapshot of
 * "dismissed", so it renders nothing until the client reads `sessionStorage`. At 30fps an
 * instant appearance reads as a dropped frame, so it is faded over six frames on a wrapper. The
 * component is not touched.
 *
 * ══ THE TRAVELLING LIFT (L10) ═══════════════════════════════════════════════════════
 *
 * This beat has no push-in available: the banner is 1152 wide inside a 1200 viewport, so the
 * tightest framing that holds it whole is the full frame, and at the full frame its `text-sm`
 * copy lands at about 5px on a phone. The lift solves it without a type-scale liberty — the
 * banner detaches, travels to a 520px measure at centre frame where the camera *can* frame it
 * tightly, is read at its real 14px, and settles back.
 *
 * **The lifted copy is a re-measure of the real banner, not a redraw of it.** The component is
 * rendered inside the lift at a 520px width; flex reflows the sentence from one line to three
 * and the button stays at the right end, because that is what the component's own
 * `sm:flex-row sm:justify-between` does at a narrower measure. Nothing about it is restated.
 *
 * COST: 5s → 4s. The 20-word sentence was never going to be fully read whatever the hold — the
 * lift buys legibility, not reading time.
 */

/** Where the banner lives in the layout, measured. */
const CALIB_HOME = HOME.calibrationBanner;
/**
 * Staged: a 520px measure, which is what makes the banner's real 14px readable at framing 560.
 *
 * **The height is 108, not 148.** At 520 wide the component reflows to three lines and renders
 * **107.2 tall** — measured off the frame, not assumed — so a 148-tall lift box left 41px of
 * empty container below the banner and pushed the framing 41px further out than the element
 * needed. `Lift` sizes its box from this rect, so the box now tracks what the component actually
 * draws.
 *
 * **And it sits at the world's vertical centre now** (283 + 54 = 337 ≈ 337.5), which is what
 * "travels to centre frame" means. It used to be pushed down to 341 to keep the welcome banner's
 * greeting out of the shot — a workaround for a scrim that was not opaque. See below.
 */
const CALIB_LIFTED = rect(340, 283, 520, 108);

/**
 * ══ THE SEAM OUT OF BEAT 2 ═════════════════════════════════════════════════════════
 *
 * **This was a real defect and it is the one this beat owed.** Beat 2's last shot and this
 * beat's first were byte-identical — `shot(600, 563.1, 432)` — so the camera was continuous, and
 * under a 432px-wide rectangle the *content* swapped in one frame from the green "Verified" pill
 * to two unrelated dashboard card corners. A continuous camera over a discontinuous surface at
 * 4.4× magnification does not read as a page navigation; it reads as a dropped frame.
 *
 * Two changes, and **neither introduces a cut**:
 *
 *  1. **The pull-out starts inside beat 2**, at its f448, so this beat opens at 963.6 rather than
 *     432 — a shot that holds the whole `(auth)` column, which is a width at which a whole-page
 *     change has somewhere to be seen.
 *  2. **This beat holds the verify surface for its first ten frames** while the camera keeps
 *     pulling. The navigation lands at f10, at ~950 world px, where it reads as what it is: the
 *     browser replacing one page with another.
 *
 * The shot below MUST equal `BEAT2_SEAM` in `Beat02Signup.tsx`. It is imported rather than
 * restated so it cannot drift; both derive from the same rect. **It belongs in `framing.ts`** —
 * see the report.
 */
/**
 * **f20, and the exact frame is measured rather than picked.** The dashboard's welcome greeting
 * starts at world x 24, so any frame narrower than ~1150 cuts "Good morning, Youssef" mid-word.
 * At f10 the pull-out is only at 950 and the navigation frame read "…d morning, Youssef" — the
 * seam fix reintroducing the defect it exists to remove. At f20 the camera is at **1188.5**, the
 * welcome banner (24 → 1176) is inside the frame whole, and the change reads as what it is.
 */
const NAVIGATE_AT = 20;
/** Beat 2's f467 shot, so this beat opens exactly where that one ended. */
const SEAM_SHOT = BEAT2_SEAM;

const SET_BASELINE = centre(HOME.setBaseline);

export const Beat03Dashboard: React.FC = () => {
  const frame = useCurrentFrame();
  const lift = useLift(34, 16, 82, 14);
  const banner = useFade(NAVIGATE_AT + 4, 6);
  // The navigation lands during the pull-out, which is what makes it read as one continuous move
  // rather than as two shots — and, now, at a width where the change is legible as a navigation.
  const onDashboard = frame >= NAVIGATE_AT;

  if (!onDashboard) {
    // Beat 2's closing surface, held. `otpFrom` is beat 2's `T.otp` (380) expressed in this
    // beat's clock — beat 2 is 468 frames, so 380 − 468 = −88, and `<OtpChoreography/>` clamps
    // every interpolation to its end state past the timeline. The pill is therefore the same
    // pill, in the same state, on the same frame it was on one frame earlier.
    return (
      <AbsoluteFill>
        <Camera keys={[{ frame: 0, shot: SEAM_SHOT }, { frame: 26, shot: shot(W / 2, H / 2, W) }]}>
          <AuthPage
            clock="10:21 AM"
            url="serenify.tech/signup"
            tabs={[{ label: "Serenify" }, { label: "Mail", mail: true }]}
            active={0}
          >
            <CheckEmailSurface otpFrom={-88} note={1} />
          </AuthPage>
        </Camera>
      </AbsoluteFill>
    );
  }

  return (
    <AbsoluteFill>
      <Camera
        keys={[
          { frame: 0, shot: SEAM_SHOT },
          { frame: 26, shot: shot(W / 2, H / 2, W) },
          { frame: 40, shot: shot(W / 2, H / 2, W) },
          { frame: 60, shot: frameRect(CALIB_LIFTED, 20) },
          { frame: 82, shot: frameRect(CALIB_LIFTED, 20) },
          { frame: 100, shot: shot(W / 2, H / 2, W) },
          // The click at f112, and then the push into beat 4 STARTS HERE — see `BEAT4_SEAM`.
          // "Set baseline" → "Before the camera turns on" used to be a straight cut on a frame
          // where the framing changed too; the navigation now lands inside a move that beat 4
          // finishes.
          //
          // `EASE_DEPART` rather than the default: this segment must hand over to beat 4 AT SPEED,
          // not settle onto the seam. It settling there is what made one gesture read as two.
          { frame: 108, shot: shot(W / 2, H / 2, W), ease: EASE_DEPART },
          { frame: 120, shot: BEAT4_SEAM },
        ]}
      >
        <HomePage
          clock="10:23 AM"
          calibrationBanner
          bannerOpacity={lift > 0.02 ? 0 : banner}
          overlay={
            <>
              {/*
               * A scrim under the lifted banner. Without it the framing on the lifted card
               * catches the welcome banner's edge, and a sliced word in shot is exactly what
               * the framing rule forbids. Washing the page back is also what makes the element
               * read as lifted *off* the page rather than resized on it.
               */}
              <div
                style={{
                  position: "absolute",
                  inset: 0,
                  width: W,
                  height: H,
                  backgroundColor: "var(--color-bg)",
                  /*
                   * **FULLY OPAQUE, and 0.97 was not enough.** The rendered frame at the landing
                   * still carried three legible fragments through the wash — "…oussef" from the
                   * `text-4xl` greeting in the top-left, "…oday is going." and "…ork and checks
                   * in if something comes up." across the bottom — all of them cut by the frame
                   * edges. A 3% transmission of 38px Outfit at full ink is a legible word, and a
                   * sliced word in frame is exactly what this scrim exists to prevent.
                   *
                   * At 1 the wash still reads as a wash rather than as a cut, because it RAMPS:
                   * `lift` carries it 0 → 1 over the travel, so the audience watches the page go
                   * out behind the element that is leaving it. The device is the ramp, not the
                   * residue.
                   */
                  opacity: lift,
                }}
              />

              {/*
               * The banner itself, travelling. It is the REAL component at both measures — the
               * lift moves and resizes its box, and the component reflows inside it.
               */}
              {lift > 0.02 ? (
                <Lift home={CALIB_HOME} lifted={CALIB_LIFTED} t={lift} panel={false}>
                  <div style={{ position: "absolute", inset: 0 }}>
                    <LiftedBanner />
                  </div>
                </Lift>
              ) : null}

              {/*
               * Then the click on "Set baseline", which is what carries us into beat 4 — and the
               * button lights under the pointer before it lands (§2). `variant="foggy"`
               * (`calibration-banner.tsx:93`), so the treatment is `hover:opacity-90`, which the
               * product snaps: `transition-colors` does not cover opacity.
               */}
              <Hover selector="[data-probe='calib'] a" treatment="foggy" from={108} to={120} />
              <Pointer
                path={[
                  { frame: 90, x: SET_BASELINE.x - 190, y: SET_BASELINE.y + 120 },
                  { frame: 108, x: SET_BASELINE.x, y: SET_BASELINE.y },
                ]}
                clicks={[112]}
                visible={{ from: 88 }}
              />
            </>
          }
        />
      </Camera>
    </AbsoluteFill>
  );
};

/**
 * The banner at its lifted measure. It is the same component the page renders, so the lifted
 * copy cannot drift from the seated one — which is the failure a hand-drawn "lifted version"
 * guarantees eventually.
 */
const LiftedBanner: React.FC = () => <CalibrationBanner />;
