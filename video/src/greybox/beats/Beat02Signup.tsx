import React from "react";
import { AbsoluteFill, Easing, interpolate, useCurrentFrame } from "remotion";

import { Camera, frameRect, rect, shot, union } from "../Camera";
import { Desktop, MailMark, newTabRect, PublicNav, tabRect } from "../chrome";
import { EMAIL, OTP, SIGNUP } from "../copy";
import { FORM_W, FORM_X, GREY, H, MONO, VIEWPORT_Y, W } from "../theme";
import { Box, Button, Cursor, Text, TextBlock } from "../ui";

/**
 * Beat 2 · Signup · 0:06–0:21.6 · 468 frames
 *
 * **ONE TAKE.** This beat used to be six `Series.Sequence`s, each with its own
 * camera — which meant five cuts inside a single beat. It is now one continuous
 * shot: one `<Camera>`, one scene, driven by frame number. Nothing is cut to.
 *
 * · The move from the password field and its checklist down to the consent row is
 *   a **pan**.
 * · The consent tick and the "Create account" press happen in the **same shot**.
 * · The form → "Check your email" change is **animated on camera**, not cut to.
 * · The new tab is **opened**, the mail provider is **navigated to**, the email is
 *   **clicked open**. All performed.
 * · The tab switch back to Serenify is **performed** too — a cut was allowed here
 *   and was not needed; the click costs half a second and keeps the invariant
 *   whole.
 * · A **wide hold** on the verify screen before pushing in on the OTP row, so the
 *   audience sees which screen it is on.
 *
 * COST: 13s → 16s → **15.6s**. Every second of it is a performed action that used to
 * be a cut — opening a tab, typing a URL, waiting for a page, clicking a message open.
 * This is the expensive beat the no-cut invariant was always going to produce. The 12
 * frames back come out of the wide hold on the verify screen, not out of any action.
 */

// ── Layout ──────────────────────────────────────────────────────────────────

const CARD = rect(344, 166, 512, 470);
const FIELD_GROUP = rect(376, 228, 448, 266);
const CONSENT_ROW = rect(376, 510, 448, 44);
const SUBMIT_ROW = rect(376, 570, 448, 42);
const CHECK_CARD = rect(344, 200, 512, 250);
const LIST_ROW = rect(180, 104, 310, 62);
const EMAIL_CARD = rect(560, 190, 520, 400);

const FIELD_Y = { name: 246, email: 316, password: 386 } as const;
const CHECKLIST_Y = 440;

// ── Phase clock ─────────────────────────────────────────────────────────────
// Every state change in the beat, in one table, so the whole 16s reads as a
// timeline rather than as scattered magic numbers.

const T = {
  nameFrom: 24,
  emailFrom: 46,
  passwordFrom: 70,
  checklist: [76, 82, 88],
  collapse: 96,
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
  /**
   * The OTP choreography's zero. It sits AFTER the wide hold and inside the last
   * third of the push-in — the camera arrives as the first digits land. Starting
   * it any earlier put the halo sweep on screen at full frame, where six 52px
   * boxes are too small to see it happen, which wasted the best motion in the
   * product on a wide shot.
   *
   * Pulled 388 → 380 with the wide hold, which is shortened by 10 frames. The greybox
   * verify screen is sparse and stays sparse — the real page brings the heading, the
   * body copy, the halo sweep and the meadow fills, and dressing the greybox to fill
   * the wait would test furniture that is not shipping. So the wait got shorter
   * instead of fuller.
   */
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

const Field: React.FC<{ y: number; label: string; value: string; focused?: boolean }> = ({
  y,
  label,
  value,
  focused,
}) => (
  <>
    <Text x={FORM_X} y={y - 15} size={10} weight={700} color={GREY.label} mono style={{ letterSpacing: 1 }}>
      {label}
    </Text>
    <Box
      x={FORM_X}
      y={y}
      w={FORM_W}
      h={40}
      fill={GREY.field}
      border={focused ? GREY.graphite : GREY.border}
      borderWidth={focused ? 2 : 1}
      radius={8}
    />
    <Text x={FORM_X + 12} y={y + 12} size={15} color={GREY.ink}>
      {value}
    </Text>
  </>
);

// ── The signup screen ───────────────────────────────────────────────────────

const SignupScreen: React.FC<{ frame: number }> = ({ frame }) => {
  const lit = frame >= T.checklist[2] ? 3 : frame >= T.checklist[1] ? 2 : frame >= T.checklist[0] ? 1 : 0;
  const collapsed = frame >= T.collapse;
  const consentTicked = frame >= T.consentTick;
  const submitting = frame >= T.submitPress;
  const focused = frame >= T.passwordFrom ? "password" : frame >= T.emailFrom ? "email" : "name";

  // The form → check-your-email change, animated. The card's height eases to the
  // shorter state while the two contents cross-fade through each other.
  const swap = interpolate(frame, [T.checkEmail, T.checkEmail + 20], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: Easing.inOut(Easing.cubic),
  });
  const cardY = CARD.y + (CHECK_CARD.y - CARD.y) * swap;
  const cardH = CARD.h + (CHECK_CARD.h - CARD.h) * swap;

  return (
    <>
      <PublicNav />
      <Box x={CARD.x} y={cardY} w={CARD.w} h={cardH} fill={GREY.surface} border={GREY.border} radius={12} />

      {/* The form. */}
      <div style={{ opacity: 1 - Math.min(1, swap * 1.6) }}>
        <Text x={FORM_X} y={CARD.y + 12} size={24} weight={700}>
          {SIGNUP.heading}
        </Text>

        <Field y={FIELD_Y.name} label={SIGNUP.fields[0].label} value={typed(SIGNUP.fields[0].value, frame, T.nameFrom, 18)} focused={focused === "name"} />
        <Field y={FIELD_Y.email} label={SIGNUP.fields[1].label} value={typed(SIGNUP.fields[1].value, frame, T.emailFrom, 20)} focused={focused === "email"} />
        <Field y={FIELD_Y.password} label={SIGNUP.fields[2].label} value={typed(SIGNUP.fields[2].value, frame, T.passwordFrom, 22)} focused={focused === "password"} />

        {collapsed ? (
          <Text x={FORM_X} y={CHECKLIST_Y} size={13} weight={700} color={GREY.body}>
            ✓&nbsp;&nbsp;{SIGNUP.checklistCollapsed}
          </Text>
        ) : (
          SIGNUP.checklist.map((row, i) => (
            <Text
              key={row}
              x={FORM_X}
              y={CHECKLIST_Y + i * 20}
              size={13}
              color={i < lit ? GREY.body : GREY.strong}
              weight={i < lit ? 700 : 400}
            >
              {i < lit ? "✓" : "·"}&nbsp;&nbsp;{row}
            </Text>
          ))
        )}

        <Box
          x={FORM_X}
          y={514}
          w={18}
          h={18}
          radius={4}
          fill={consentTicked ? GREY.graphite : GREY.field}
          border={consentTicked ? GREY.graphite : GREY.border}
        />
        {consentTicked ? (
          <Text x={FORM_X + 3} y={514} size={13} weight={700} color={GREY.white}>
            ✓
          </Text>
        ) : null}
        <Text x={FORM_X + 26} y={512} w={FORM_W - 26} size={12.5} color={GREY.body} lineHeight={1.5}>
          {SIGNUP.consent}
        </Text>

        <Button x={SUBMIT_ROW.x} y={SUBMIT_ROW.y} w={SUBMIT_ROW.w} h={SUBMIT_ROW.h} size={15}>
          {submitting ? SIGNUP.submitting : SIGNUP.submit}
        </Button>
      </div>

      {/* "Check your email", fading up through the form. */}
      <div style={{ opacity: Math.max(0, swap * 1.6 - 0.6) }}>
        <Box x={FORM_X} y={228} w={44} h={44} radius={22} fill={GREY.panel} />
        <Text x={FORM_X} y={292} size={26} weight={700}>
          {SIGNUP.checkEmail}
        </Text>
        <Text x={FORM_X} y={332} w={FORM_W} size={13} color={GREY.body}>
          {SIGNUP.checkEmailBody}
        </Text>
        <TextBlock x={FORM_X} y={392} w={FORM_W} lines={2} />
      </div>

      {/* Consent tick, then submit — one shot, two clicks. */}
      <Cursor x={FORM_X + 10} y={524} clickAt={T.consentTick - 2} opacity={frame < T.consentTick + 6 ? 1 : 0} />
      <Cursor x={720} y={584} clickAt={T.submitPress - 2} opacity={frame >= T.consentTick + 6 && frame < T.checkEmail ? 1 : 0} />
    </>
  );
};

// ── His mail ────────────────────────────────────────────────────────────────
/**
 * Rebuilt as performed actions. The email itself is the shipped Supabase template
 * (`supabase/templates/confirmation.html`) at that template's own type scale —
 * 520px card, 30px headline, 16px body, 25px code at 4px tracking. Generic in
 * *branding* (L2b), never in content.
 */
const MailScreen: React.FC<{ frame: number }> = ({ frame }) => {
  const opened = frame >= T.openEmail;

  return (
    <>
      <Box x={0} y={VIEWPORT_Y} w={170} h={H - VIEWPORT_Y} fill={GREY.panelAlt} border={GREY.panelAlt} radius={0} />
      <div style={{ position: "absolute", left: 20, top: VIEWPORT_Y + 18 }}>
        <MailMark size={24} />
      </div>
      <Text x={52} y={VIEWPORT_Y + 22} size={15} weight={700} color={GREY.body}>
        Mail
      </Text>
      <TextBlock x={20} y={VIEWPORT_Y + 70} w={130} lines={6} gap={18} size={8} />

      <Box x={170} y={VIEWPORT_Y} w={330} h={H - VIEWPORT_Y} fill={GREY.surface} border={GREY.border} radius={0} />
      {/* The Serenify email — unread, at the top of the list. */}
      <Box
        x={LIST_ROW.x}
        y={LIST_ROW.y}
        w={LIST_ROW.w}
        h={LIST_ROW.h}
        fill={GREY.panelAlt}
        border={GREY.graphite}
        radius={7}
      />
      <Text x={LIST_ROW.x + 14} y={LIST_ROW.y + 11} size={14} weight={700}>
        {EMAIL.from}
      </Text>
      <Text x={LIST_ROW.x + 200} y={LIST_ROW.y + 12} w={96} size={11} color={GREY.label} align="right">
        {EMAIL.time}
      </Text>
      <Text x={LIST_ROW.x + 14} y={LIST_ROW.y + 33} w={282} size={12} color={GREY.body}>
        {EMAIL.subject}
      </Text>
      <TextBlock x={LIST_ROW.x + 14} y={LIST_ROW.y + 84} w={282} lines={6} gap={26} size={8} />
      <Cursor
        x={LIST_ROW.x + 240}
        y={LIST_ROW.y + 34}
        clickAt={T.openEmail - 4}
        opacity={frame < T.openEmail + 8 ? 1 : 0}
      />

      <div style={{ opacity: opened ? 1 : 0.16 }}>
        <Text x={530} y={116} w={560} size={20} weight={700}>
          {EMAIL.subject}
        </Text>
        <div style={{ position: "absolute", left: 530, top: 150 }}>
          <MailMark size={22} />
        </div>
        <Text x={562} y={152} size={14} weight={700}>
          {EMAIL.from}
        </Text>
        <Text x={960} y={153} w={130} size={12} color={GREY.label} align="right">
          {EMAIL.time}
        </Text>

        <Box
          x={EMAIL_CARD.x}
          y={EMAIL_CARD.y}
          w={EMAIL_CARD.w}
          h={EMAIL_CARD.h}
          fill={GREY.surface}
          border={GREY.border}
          radius={12}
        />
        <Box x={588} y={212} w={78} h={22} label="wordmark" labelSize={9} fill={GREY.panelAlt} />
        <Text x={588} y={250} size={30} weight={700}>
          {EMAIL.headline}
        </Text>
        <Text x={588} y={296} w={464} size={16} color={GREY.body} lineHeight={1.6}>
          {EMAIL.body}
        </Text>
        <Button x={738} y={352} w={164} h={40} size={15}>
          {EMAIL.button}
        </Button>
        <Text x={588} y={422} size={13} weight={500} color={GREY.body}>
          {EMAIL.codeLabel}
        </Text>
        <Box x={588} y={444} w={464} h={48} fill={GREY.field} border={GREY.border} radius={8} />
        <Text x={588} y={456} w={464} size={25} weight={700} align="center" mono style={{ letterSpacing: 4 }}>
          {EMAIL.code}
        </Text>
        <Box x={588} y={514} w={464} h={1} fill={GREY.border} border={GREY.border} radius={0} />
        <Text x={588} y={528} w={464} size={13} color={GREY.label} lineHeight={1.6}>
          {EMAIL.footer}
        </Text>
      </div>
    </>
  );
};

// ── The OTP choreography ────────────────────────────────────────────────────
/**
 * Timings from `components/ui/auth/otp-boxes.tsx`, converted at 30fps and offset
 * by `T.otp`:
 *
 *   halo sweep 1→6, 130ms each  →  0 – 23.4f
 *   hold 360ms                  → 23.4 – 34.2f
 *   merge 540ms                 → 34.2 – 50.4f
 *   check + "Verified" 560ms    → 50.4 – 67.2f
 *   pill HOLDS 700ms (#190)     → 67.2 – 88.2f
 *   "Taking you in…" at 2080ms  → from 62.4f
 *
 * The digits land ON the halo sweep (there is no room to enter them first, and
 * the halo is what tracks each arriving digit anyway), and they clear ON the
 * merge — the component applies `text-transparent` on the same state flip that
 * fills the boxes.
 *
 * **The seams are gone, and the fix is the component's own.** `meltTogether()`
 * slides the boxes to a 1.5px *overlap* rather than to abutment, precisely because
 * six same-colour fills that merely touch expose a hairline of page background at
 * fractional widths and high DPR. Revision 2 dropped the borders at full merge and
 * still had six seams, because abutting rects antialias against each other. The
 * overlap makes a seam impossible.
 */
const BOX_W = 52;
const BOX_H = 52;
const GAP = 8;
/** `OVERLAP` in `otp-boxes.tsx`. Meadow over meadow → invisible; grey over grey here. */
const OVERLAP = 1.5;
const OTP_ROW = rect(424, 300, 6 * BOX_W + 5 * GAP, BOX_H);

const VerifyScreen: React.FC<{ frame: number }> = ({ frame }) => {
  const t = frame - T.otp;

  const merge = interpolate(t, [34.2, 50.4], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: Easing.inOut(Easing.cubic),
  });
  const verified = interpolate(t, [50.4, 67.2], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const takingYouIn = interpolate(t, [62.4, 72.4], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  // Step shrinks from box+gap to box−overlap, so the finished pill is continuous.
  const step = BOX_W + GAP * (1 - merge) - OVERLAP * merge;
  const rowW = 5 * step + BOX_W;
  const rowX = W / 2 - rowW / 2;

  return (
    <>
      <PublicNav />
      <Text x={400} y={246} w={400} size={24} weight={700} align="center">
        {OTP.heading}
      </Text>

      {OTP.digits.map((digit, i) => {
        const landed = t >= i * 3.9;
        const halo = interpolate(t, [i * 3.9, i * 3.9 + 3.9], [1, 0], {
          extrapolateLeft: "clamp",
          extrapolateRight: "clamp",
        });
        const outerL = i === 0 ? 8 + 20 * merge : 8 * (1 - merge);
        const outerR = i === 5 ? 8 + 20 * merge : 8 * (1 - merge);

        return (
          <React.Fragment key={i}>
            <div
              style={{
                position: "absolute",
                left: rowX + i * step,
                top: OTP_ROW.y,
                width: BOX_W,
                height: BOX_H,
                boxSizing: "border-box",
                border: merge > 0.98 ? "none" : `${1 - merge}px solid ${GREY.border}`,
                borderRadius: `${outerL}px ${outerR}px ${outerR}px ${outerL}px`,
                backgroundColor: merge > 0 ? GREY.graphite : GREY.field,
              }}
            />
            {halo > 0.01 && landed ? (
              <div
                style={{
                  position: "absolute",
                  left: rowX + i * step - 3,
                  top: OTP_ROW.y - 3,
                  width: BOX_W + 6,
                  height: BOX_H + 6,
                  borderRadius: 11,
                  border: `3px solid ${GREY.graphite}`,
                  opacity: halo,
                }}
              />
            ) : null}
            <div
              style={{
                position: "absolute",
                left: rowX + i * step,
                top: OTP_ROW.y + 12,
                width: BOX_W,
                textAlign: "center",
                fontFamily: MONO,
                fontSize: 26,
                fontWeight: 500,
                color: GREY.ink,
                opacity: (landed ? 1 : 0) * (1 - merge),
              }}
            >
              {digit}
            </div>
          </React.Fragment>
        );
      })}

      <Text
        x={rowX}
        y={OTP_ROW.y + 16}
        w={rowW}
        size={18}
        weight={700}
        align="center"
        color={GREY.white}
        opacity={verified}
      >
        ✓&nbsp;&nbsp;{OTP.verified}
      </Text>

      <Text x={400} y={378} w={400} size={14} align="center" color={GREY.label} opacity={takingYouIn}>
        {OTP.takingYouIn}
      </Text>
    </>
  );
};

// ── The take ────────────────────────────────────────────────────────────────

export const Beat02Signup: React.FC = () => {
  const frame = useCurrentFrame();

  const onMail = frame >= T.newTabClick + 4 && frame < T.serenifyTabClick + 8;
  const mailLoaded = frame >= T.mailLoaded;
  const onVerify = frame >= T.serenifyTabClick + 8;

  const tabs = onMail || onVerify || frame >= T.newTabClick + 4
    ? [{ label: "Serenify" }, mailLoaded ? { label: "Mail", mail: true } : { label: "New tab" }]
    : [{ label: "Serenify" }];
  const active = onMail ? 1 : 0;

  const url = onVerify
    ? "serenify.tech/verify"
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

  return (
    <AbsoluteFill>
      <Camera
        keys={[
          // A · establish the whole signup card
          { frame: 0, shot: frameRect(CARD, 24) },
          { frame: 20, shot: frameRect(CARD, 24) },
          // B · push to the field group; the fields fill
          { frame: 64, shot: frameRect(FIELD_GROUP, 16) },
          { frame: 96, shot: frameRect(FIELD_GROUP, 16) },
          // C · PAN down to consent + submit. Both clicks in this shot.
          { frame: 130, shot: frameRect(union(CONSENT_ROW, SUBMIT_ROW), 44) },
          { frame: 152, shot: frameRect(union(CONSENT_ROW, SUBMIT_ROW), 44) },
          // D · the card animates to "Check your email"
          { frame: 178, shot: frameRect(CHECK_CARD, 24) },
          { frame: 192, shot: frameRect(CHECK_CARD, 24) },
          // E · out to the chrome to open a tab, then into his mail
          { frame: 214, shot: shot(W / 2, H / 2, W) },
          { frame: 246, shot: shot(W / 2, H / 2, W) },
          { frame: 268, shot: frameRect(LIST_ROW, 24) },
          { frame: 286, shot: frameRect(LIST_ROW, 24) },
          { frame: 318, shot: frameRect(EMAIL_CARD, 44) },
          { frame: 340, shot: frameRect(EMAIL_CARD, 6) },
          // F · performed tab switch back — the pull-out and the tab click coincide
          { frame: 360, shot: shot(W / 2, H / 2, W) },
          // G · the wide hold, so the audience sees the screen it is on. Shortened
          // by 10 frames against a screen this sparse — see T.otp.
          { frame: 370, shot: shot(W / 2, H / 2, W) },
          // H · in on the OTP row, arriving as the first digits land
          { frame: 388, shot: frameRect(OTP_ROW, 40) },
          { frame: 468, shot: frameRect(OTP_ROW, 40) },
        ]}
      >
        <Desktop clock={frame >= T.mailLoaded ? "10:21 AM" : "10:20 AM"} tabs={tabs} active={active} url={url}>
          {onVerify ? (
            <VerifyScreen frame={frame} />
          ) : onMail ? (
            mailLoaded ? (
              <MailScreen frame={frame} />
            ) : (
              // A blank new tab, being navigated. The action is the payload.
              <Box
                x={W / 2 - 130}
                y={VIEWPORT_Y + 150}
                w={260}
                h={28}
                fill={GREY.panelAlt}
                border={GREY.panelAlt}
                radius={14}
              />
            )
          ) : (
            <SignupScreen frame={frame} />
          )}

          {/* The new-tab button being clicked, and the Serenify tab being
              clicked back. Both performed on camera. */}
          {frame >= T.newTabClick - 14 && frame < T.newTabClick + 10 ? (
            <Cursor
              x={newTabRect(1).x + 6}
              y={newTabRect(1).y + 4}
              clickAt={T.newTabClick}
            />
          ) : null}
          {frame >= T.serenifyTabClick - 14 && frame < T.serenifyTabClick + 10 ? (
            <Cursor x={tabRect(0).x + 80} y={tabRect(0).y + 10} clickAt={T.serenifyTabClick} />
          ) : null}
        </Desktop>
      </Camera>
    </AbsoluteFill>
  );
};
