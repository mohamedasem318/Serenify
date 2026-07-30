import React from "react";
import { AbsoluteFill, Easing, interpolate, useCurrentFrame } from "remotion";

import { AuthPage, CheckEmailSurface, SignupSurface } from "../../app/auth";
import { OS_FONT, STANDIN } from "../../app/furniture";
import { SIGNUP as G, VERIFY, centre } from "../../app/geometry";
import { OTP_TIMELINE } from "../../app/otp";
import { Pointer } from "../../app/pointer";
import { Desktop, MailMark, StandIn, newTabRect, tabRect } from "../../app/shell";
import { Camera, frameRect, rect, shot, union } from "../Camera";
import { EMAIL, PROTAGONIST, SIGNUP } from "../copy";
import { H, VIEWPORT_Y, W } from "../theme";
import { Box, Text, TextBlock } from "../ui";

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
 * The mail client is the one surface here that is still drawn, deliberately: it is a non-Serenify
 * stand-in and the assets pass owns it. Deferred register item 1 (the reading pane must be empty
 * until the message is clicked) is still its requirement and is still not patched here.
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

// ── The mail client — still a stand-in, and still not patched (register item 1) ──────

const LIST_ROW = rect(180, 104, 310, 62);
const EMAIL_CARD = rect(560, 190, 520, 400);

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

// ── His mail ────────────────────────────────────────────────────────────────────────

const MailScreen: React.FC<{ frame: number }> = ({ frame }) => {
  const opened = frame >= T.openEmail;

  return (
    <>
      <StandIn x={0} y={VIEWPORT_Y} w={170} h={H - VIEWPORT_Y} radius={0} fill={STANDIN.panelAlt} />
      <div style={{ position: "absolute", left: 20, top: VIEWPORT_Y + 18 }}>
        <MailMark size={24} />
      </div>
      <Text x={52} y={VIEWPORT_Y + 22} size={15} weight={700} color={STANDIN.body}>
        Mail
      </Text>
      <TextBlock x={20} y={VIEWPORT_Y + 70} w={130} lines={6} gap={18} size={8} />

      <StandIn x={170} y={VIEWPORT_Y} w={330} h={H - VIEWPORT_Y} radius={0} fill={STANDIN.surface} />
      {/* The Serenify email — unread, at the top of the list. */}
      <StandIn
        x={LIST_ROW.x}
        y={LIST_ROW.y}
        w={LIST_ROW.w}
        h={LIST_ROW.h}
        radius={7}
        fill={STANDIN.panelAlt}
        border={STANDIN.line}
      />
      <Text x={LIST_ROW.x + 14} y={LIST_ROW.y + 11} size={14} weight={700} color={STANDIN.ink}>
        {EMAIL.from}
      </Text>
      <Text x={LIST_ROW.x + 200} y={LIST_ROW.y + 12} w={96} size={11} color={STANDIN.label} align="right">
        {EMAIL.time}
      </Text>
      <Text x={LIST_ROW.x + 14} y={LIST_ROW.y + 33} w={282} size={12} color={STANDIN.body}>
        {EMAIL.subject}
      </Text>
      <TextBlock x={LIST_ROW.x + 14} y={LIST_ROW.y + 84} w={282} lines={6} gap={26} size={8} />

      <div style={{ opacity: opened ? 1 : 0.16 }}>
        <Text x={530} y={116} w={560} size={20} weight={700} color={STANDIN.ink}>
          {EMAIL.subject}
        </Text>
        <div style={{ position: "absolute", left: 530, top: 150 }}>
          <MailMark size={22} />
        </div>
        <Text x={562} y={152} size={14} weight={700} color={STANDIN.ink}>
          {EMAIL.from}
        </Text>
        <Text x={960} y={153} w={130} size={12} color={STANDIN.label} align="right">
          {EMAIL.time}
        </Text>

        <StandIn
          x={EMAIL_CARD.x}
          y={EMAIL_CARD.y}
          w={EMAIL_CARD.w}
          h={EMAIL_CARD.h}
          radius={12}
          fill={STANDIN.surface}
        />
        <Box x={588} y={212} w={78} h={22} label="wordmark" labelSize={9} fill={STANDIN.panelAlt} />
        <Text x={588} y={250} size={30} weight={700} color={STANDIN.ink}>
          {EMAIL.headline}
        </Text>
        <Text x={588} y={296} w={464} size={16} color={STANDIN.body} lineHeight={1.6}>
          {EMAIL.body}
        </Text>
        <div
          style={{
            position: "absolute",
            left: 738,
            top: 352,
            width: 164,
            height: 40,
            borderRadius: 8,
            backgroundColor: STANDIN.fill,
            border: `1px solid ${STANDIN.line}`,
            color: STANDIN.ink,
            fontFamily: OS_FONT,
            fontSize: 15,
            fontWeight: 600,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          {EMAIL.button}
        </div>
        <Text x={588} y={422} size={13} weight={500} color={STANDIN.body}>
          {EMAIL.codeLabel}
        </Text>
        <StandIn x={588} y={444} w={464} h={48} radius={8} fill={STANDIN.field} />
        <Text
          x={588}
          y={456}
          w={464}
          size={25}
          weight={700}
          align="center"
          mono
          color={STANDIN.ink}
          style={{ letterSpacing: 4 }}
        >
          {EMAIL.code}
        </Text>
        <StandIn x={588} y={514} w={464} h={1} radius={0} fill={STANDIN.border} border={STANDIN.border} />
        <Text x={588} y={528} w={464} size={13} color={STANDIN.label} lineHeight={1.6}>
          {EMAIL.footer}
        </Text>
      </div>
    </>
  );
};

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
                  { frame: T.openEmail - 6, x: LIST_ROW.x + 150, y: LIST_ROW.y + 34 },
                  { frame: T.serenifyTabClick - 16, x: tabRect(0).x + 80, y: tabRect(0).y + 12 },
                ]}
                clicks={[T.openEmail, T.serenifyTabClick]}
                visible={{ from: T.mailLoaded }}
              />
            }
          >
            {mailLoaded ? (
              <div style={{ position: "absolute", left: 0, top: -VIEWPORT_Y, width: W, height: H }}>
                <MailScreen frame={frame} />
              </div>
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
                {/* The new-tab button, clicked. */}
                <Pointer
                  path={[
                    { frame: T.newTabClick - 22, x: newTabRect(1).x + 90, y: newTabRect(1).y + 70 },
                    { frame: T.newTabClick - 6, x: newTabRect(1).x + 6, y: newTabRect(1).y + 4 },
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
