import React from "react";
import { AbsoluteFill, Easing, interpolate, useCurrentFrame } from "remotion";

import { AuthPage, CheckEmailSurface, SignupSurface } from "../../app/auth";
import { STANDIN } from "../../app/furniture";
import { SIGNUP as G, VERIFY, centre } from "../../app/geometry";
import { Hover, useHover } from "../../app/hover";
import { MAIL_MESSAGE, MAIL_ROW, MailClient } from "../../app/mail";
import { OTP_TIMELINE } from "../../app/otp";
import { Pointer } from "../../app/pointer";
import { Desktop, StandIn, newTabRect, tabRect } from "../../app/shell";
import { Camera, frameRect, rect, shot } from "../Camera";
import { PROTAGONIST, SIGNUP } from "../copy";
import { H, VIEWPORT_Y, W } from "../theme";

/**
 * Beat 2 · Signup · 0:06–0:21.6 · 468 frames
 *
 * **ONE TAKE.** The sub-beats are phases of a single continuous shot. Nothing is cut to: the pan
 * from the password field to the consent row is a pan, the form → "Check your email" change is
 * animated on camera, the new tab is opened, the mail provider is navigated to, the email is
 * clicked open, and the tab switch back is performed.
 *
 * ══ THE SURFACES ARE THE REAL COMPONENTS ════════════════════════════════════════════
 *
 * `<Field/>`, `<PasswordRequirements/>`, `<TermsAcknowledgementField/>`, `<Wordmark/>` and
 * `<OtpBoxes/>`. Three things about the real signup surface contradict what the greybox drew,
 * and all three are in `geometry.ts`:
 *
 *  · **There is no card.** `app/(auth)/layout.tsx` — "no card chrome — the page IS the surface".
 *  · **There is no public navbar.** The `(auth)` group's shell is a `max-w-md` column with the
 *    wordmark and the theme toggle, and nothing else. Beat 2 was showing a bar that does not
 *    exist on `/signup`.
 *  · **The column is 818.5 tall in a 583px viewport**, so it scrolls — the submit button sits
 *    79.5px below the fold. That is the product's behaviour at this world, and the beat scrolls
 *    to it rather than pretending the form fits.
 *
 * ══ AND THE MAIL CLIENT IS DRAWN — REGISTER ITEM 1, CLOSED ══════════════════════════
 *
 * It was four labelled rectangles with the email's text over them, and the whole rendered message
 * was drawn at `opacity: 0.16` before the click — a **ghost**. That is what the register flagged:
 * the beat is "he opens the email and finds the code", and a click that uncovers something the
 * audience has been looking at for two seconds reveals nothing.
 *
 * `<MailClient/>` (`src/app/mail.tsx`) is the asset the register said the fix belonged to, and it
 * has **two genuinely different states** rather than one at two opacities — the empty-selection
 * state every mail client ships, then the message. Nothing of the email is in the DOM before the
 * click. It stays generic in branding (L2b) and specific in content: a real sidebar, a real list
 * with five plausible neighbours around the unread one, and the shipped confirmation template's
 * own copy and type scale.
 *
 * ══ 2f — THE OTP MERGE, AND IT IS FRAME-ADDRESSED ═══════════════════════════════════
 *
 * The register carried this as the one component that could not be absorbed. It is absorbed:
 * `<OtpChoreography/>` drives the shipped `<OtpBoxes/>` to its own synchronous end state through
 * its public `playSuccess()` handle, then re-authors every declared value per frame — the halo
 * sweep, the merge's transforms, the meadow fills, the corner radii, the digits clearing and the
 * pill's fade. Including the 1.5px overlap, which turns out to be derivable rather than
 * measurable. See `src/app/otp.tsx` for the whole argument.
 *
 * The timeline below is `STEP`'s, converted at 30fps, and it plays at real speed.
 */

// ── The mail client's two landings ──────────────────────────────────────────────────
//
// Both come from `mail.tsx`'s own exported geometry rather than from numbers restated here, so a
// change to the client cannot silently leave the camera framing where the client used to be.
// They are offset by `VIEWPORT_Y` because the client is drawn inside the page, below the chrome.

const LIST_ROW = rect(MAIL_ROW.x, MAIL_ROW.y + VIEWPORT_Y, MAIL_ROW.w, MAIL_ROW.h);
const EMAIL_CARD = rect(
  MAIL_MESSAGE.x,
  MAIL_MESSAGE.y + VIEWPORT_Y,
  MAIL_MESSAGE.w,
  MAIL_MESSAGE.h,
);

// ── Phase clock ─────────────────────────────────────────────────────────────────────

const T = {
  nameFrom: 24,
  emailFrom: 46,
  passwordFrom: 70,
  /** The page scrolls to bring the consent row and the submit button above the fold. */
  scrollFrom: 104,
  scrollTo: 130,
  consentTick: 136,
  submitPress: 148,
  /** The form cross-fades to the "Check your email" state. */
  checkEmail: 156,
  newTabClick: 200,
  mailUrlFrom: 218,
  mailEnter: 238,
  mailLoaded: 246,
  openEmail: 278,
  serenifyTabClick: 344,
  /** `playSuccess()`'s zero. The camera arrives as the first digits land. */
  otp: 380,
} as const;

/** Reveals a string left-to-right, so a field looks typed rather than pasted. */
const typed = (value: string, frame: number, from: number, over: number) => {
  const shown = Math.round(
    interpolate(frame, [from, from + over], [0, value.length], {
      extrapolateLeft: "clamp",
      extrapolateRight: "clamp",
    }),
  );
  return value.slice(0, shown);
};

/**
 * How far the page has scrolled. `SIGNUP.col` is 818.5 tall against a 583px viewport, so the
 * consent row and the submit button are genuinely below the fold at rest — 145 brings both into
 * the viewport with the password checklist still visible above them, which is what the 2b–2c pan
 * needs to travel between.
 *
 * It is bounded on both sides and neither bound is taste. Below ~135 the submit button's own
 * bottom edge is still under the fold and the pan lands on a sliced control. Above ~150 the
 * "Already have an account? Sign in" line rises INTO the viewport and is then sliced by it — a
 * sliced line of text is always a failure, and this one is a footnote the beat has no reason to
 * show. 145 puts the submit 17px clear of the fold and keeps that line below it.
 */
const SIGNUP_SCROLL = 145;

const scrolledRect = (r: ReturnType<typeof rect>, s: number) => rect(r.x, r.y - s, r.w, r.h);

// ── The take ────────────────────────────────────────────────────────────────────────

export const Beat02Signup: React.FC = () => {
  const frame = useCurrentFrame();

  const onMail = frame >= T.newTabClick + 4 && frame < T.serenifyTabClick + 8;
  const mailLoaded = frame >= T.mailLoaded;
  const onVerify = frame >= T.serenifyTabClick + 8;

  const tabs =
    onMail || onVerify || frame >= T.newTabClick + 4
      ? [{ label: "Serenify" }, mailLoaded ? { label: "Mail", mail: true } : { label: "New tab" }]
      : [{ label: "Serenify" }];
  const active = onMail ? 1 : 0;

  const url = onVerify
    ? "serenify.tech/signup"
    : onMail
      ? mailLoaded
        ? "mail.example.com"
        : (() => {
            const target = "mail.example.com";
            const n = Math.round(
              interpolate(frame, [T.mailUrlFrom, T.mailEnter], [0, target.length], {
                extrapolateLeft: "clamp",
                extrapolateRight: "clamp",
              }),
            );
            return target.slice(0, n);
          })()
      : "serenify.tech/signup";

  // Down to the consent row and the submit button, then back up as the card becomes the short
  // "Check your email" state — which is 442 tall and needs no scroll at all.
  const scroll = interpolate(
    frame,
    [T.scrollFrom, T.scrollTo, T.checkEmail, T.checkEmail + 20],
    [0, SIGNUP_SCROLL, SIGNUP_SCROLL, 0],
    { extrapolateLeft: "clamp", extrapolateRight: "clamp", easing: Easing.inOut(Easing.cubic) },
  );

  // The form → check-your-email change, animated. Both states are real components, so the
  // cross-fade is between two real surfaces rather than between two drawings of one.
  const swap = interpolate(frame, [T.checkEmail, T.checkEmail + 20], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: Easing.inOut(Easing.cubic),
  });

  const note = interpolate(
    frame,
    [T.otp + OTP_TIMELINE.noteAt, T.otp + OTP_TIMELINE.noteAt + 9],
    [0, 1],
    { extrapolateLeft: "clamp", extrapolateRight: "clamp" },
  );

  const password = typed(SIGNUP.fields[2].value, frame, T.passwordFrom, 22);
  const focus =
    frame >= T.consentTick
      ? null
      : frame >= T.passwordFrom
        ? ("password" as const)
        : frame >= T.emailFrom
          ? ("email" as const)
          : ("full_name" as const);

  // Where the two clicks land, in world coordinates, after the page has scrolled under them.
  const consentAt = centre(scrolledRect(G.consentBox, SIGNUP_SCROLL));
  const submitAt = centre(scrolledRect(G.submit, SIGNUP_SCROLL));

  /** The list row lights as the pointer reaches it, six frames before the click (§2). */
  const rowHover = useHover(T.openEmail - 6, T.openEmail + 20);

  return (
    <AbsoluteFill>
      <Camera
        keys={[
          // A · establish the whole form column
          { frame: 0, shot: frameRect(G.section, 24) },
          { frame: 20, shot: frameRect(G.section, 24) },
          // B · push to the field group; the fields fill and the checklist lights
          { frame: 64, shot: frameRect(G.fieldGroup, 20) },
          { frame: 96, shot: frameRect(G.fieldGroup, 20) },
          // C · PAN down to consent + submit, which the page scroll has brought above the fold.
          // Both clicks happen in this shot.
          { frame: 130, shot: frameRect(scrolledRect(G.consentAndSubmit, SIGNUP_SCROLL), 40) },
          { frame: 152, shot: frameRect(scrolledRect(G.consentAndSubmit, SIGNUP_SCROLL), 40) },
          // D · the surface animates to "Check your email"
          { frame: 178, shot: frameRect(VERIFY.section, 26) },
          { frame: 192, shot: frameRect(VERIFY.section, 26) },
          // E · out to the chrome to open a tab, then into his mail
          { frame: 214, shot: shot(W / 2, H / 2, W) },
          { frame: 246, shot: shot(W / 2, H / 2, W) },
          { frame: 268, shot: frameRect(LIST_ROW, 24) },
          { frame: 286, shot: frameRect(LIST_ROW, 24) },
          { frame: 318, shot: frameRect(EMAIL_CARD, 44) },
          { frame: 340, shot: frameRect(EMAIL_CARD, 6) },
          // F · performed tab switch back — the pull-out and the tab click coincide
          { frame: 360, shot: shot(W / 2, H / 2, W) },
          // G · the wide hold, so the audience sees the screen it is on
          { frame: 370, shot: shot(W / 2, H / 2, W) },
          // H · in on the OTP row, arriving as the first digits land
          { frame: 388, shot: frameRect(VERIFY.otpRow, 40) },
          { frame: 468, shot: frameRect(VERIFY.otpRow, 40) },
        ]}
      >
        {onMail ? (
          <Desktop
            clock={mailLoaded ? "10:21 AM" : "10:20 AM"}
            url={url}
            tabs={tabs}
            active={active}
            fill={STANDIN.page}
            overlay={
              <Pointer
                path={[
                  { frame: T.openEmail - 30, x: LIST_ROW.x + 250, y: LIST_ROW.y + 120 },
                  // The row's measured centre, not a point near it.
                  {
                    frame: T.openEmail - 6,
                    x: LIST_ROW.x + LIST_ROW.w / 2,
                    y: LIST_ROW.y + LIST_ROW.h / 2,
                  },
                  // …and the tab's, likewise. It was landing 15px left of centre.
                  {
                    frame: T.serenifyTabClick - 16,
                    x: tabRect(0).x + tabRect(0).w / 2,
                    y: tabRect(0).y + tabRect(0).h / 2,
                  },
                ]}
                clicks={[T.openEmail, T.serenifyTabClick]}
                visible={{ from: T.mailLoaded }}
              />
            }
          >
            {mailLoaded ? (
              // The client fills the page below the chrome. `opened` is the click and nothing of
              // the message exists before it — register item 1. `rowHover` is the pointer
              // arriving on the row six frames earlier (§2).
              <MailClient opened={frame >= T.openEmail} rowHover={rowHover} />
            ) : (
              // A blank new tab, being navigated. The action is the payload.
              <StandIn
                x={W / 2 - 130}
                y={150}
                w={260}
                h={28}
                radius={14}
                fill={STANDIN.panelAlt}
                border={STANDIN.panelAlt}
              />
            )}
          </Desktop>
        ) : (
          <AuthPage
            clock={frame >= T.mailLoaded ? "10:21 AM" : "10:20 AM"}
            url={url}
            tabs={tabs}
            active={active}
            overlay={
              <>
                {/*
                 * ── §2 · WHAT LIGHTS HERE, AND WHAT HONESTLY CANNOT ──
                 *
                 * "Create account" is the `(auth)` submit — `signup-form.tsx:255`'s
                 * `hover:opacity-90` over its own `transition-opacity`, which makes it the ONE
                 * hover in the film the product actually eases. (Everywhere else the same
                 * declaration snaps, because the `<Button/>` base transitions colours only.)
                 *
                 * **The consent checkbox ships no hover at all**, and that is a finding rather
                 * than an omission here. `terms-acknowledgement-field.tsx:93` gives the input
                 * `cursor-pointer`, a `focus-visible` ring and nothing else; its 44px `<label>`
                 * wrapper carries no treatment either. A native checkbox's hover is the browser's
                 * own rendering, which is not something the product declares and not something
                 * this film can reproduce without inventing it. So the tick has a cursor, a
                 * press and a ring, and no hover — which is what the product does.
                 */}
                <Hover
                  selector="[data-signup] > div > button[type='button']"
                  treatment="submitAuth"
                  from={T.submitPress - 8}
                  to={T.checkEmail}
                />
                {/* The consent tick and the submit press — one shot, two clicks, with the hand
                    travelling between them. */}
                <Pointer
                  path={[
                    { frame: T.consentTick - 26, x: consentAt.x + 130, y: consentAt.y + 70 },
                    { frame: T.consentTick - 4, x: consentAt.x, y: consentAt.y },
                    { frame: T.submitPress - 6, x: submitAt.x, y: submitAt.y },
                  ]}
                  clicks={[T.consentTick, T.submitPress]}
                  visible={{ from: T.consentTick - 30, to: T.checkEmail + 6 }}
                />
                {/* The new-tab button, clicked — at its CENTRE. It was landing on (x+6, y+4) of
                    a 22 × 22 target, which is inside the box but visibly in its top-left corner
                    rather than on the `+`. */}
                <Pointer
                  path={[
                    { frame: T.newTabClick - 22, x: newTabRect(1).x + 90, y: newTabRect(1).y + 70 },
                    {
                      frame: T.newTabClick - 6,
                      x: newTabRect(1).x + newTabRect(1).w / 2,
                      y: newTabRect(1).y + newTabRect(1).h / 2,
                    },
                  ]}
                  clicks={[T.newTabClick]}
                  visible={{ from: T.newTabClick - 26, to: T.newTabClick + 12 }}
                />
              </>
            }
          >
            {/*
             * The two states cross-fade in place, which is 2d's requirement: the change is SHOWN
             * rather than cut to. Both are real surfaces, so this is a cross-fade between two
             * components rather than between two drawings of one — and the shorter state's own
             * height is what the camera lands on afterwards.
             */}
            <div style={{ position: "relative", marginTop: -scroll }}>
              {swap < 1 ? (
                <div style={{ opacity: 1 - Math.min(1, swap * 1.6) }}>
                  <SignupSurface
                    fullName={typed(PROTAGONIST.fullName, frame, T.nameFrom, 18)}
                    email={typed(PROTAGONIST.email, frame, T.emailFrom, 20)}
                    password={password}
                    focus={focus}
                    consent={frame >= T.consentTick}
                    submitting={frame >= T.submitPress}
                  />
                </div>
              ) : null}
              {swap > 0 ? (
                <div
                  style={{
                    position: swap < 1 ? "absolute" : "static",
                    left: 0,
                    right: 0,
                    top: 0,
                    opacity: Math.max(0, swap * 1.6 - 0.6),
                  }}
                >
                  <CheckEmailSurface
                    otpFrom={onVerify ? T.otp : undefined}
                    note={onVerify ? note : 0}
                  />
                </div>
              ) : null}
            </div>
          </AuthPage>
        )}
      </Camera>
    </AbsoluteFill>
  );
};
