import React from "react";
import { AbsoluteFill, Easing, interpolate, Series, useCurrentFrame } from "remotion";

import { Camera, shot } from "../Camera";
import { Desktop, MailMark, PublicNav } from "../chrome";
import { EMAIL, OTP, SIGNUP } from "../copy";
import { FORM_W, FORM_X, GREY, MONO, VIEWPORT_Y } from "../theme";
import { Box, Button, Cursor, Text, TextBlock, useFade } from "../ui";

/**
 * Beat 2 · Signup · 0:04–0:16 · 360 frames
 *
 * The credibility spend, chosen deliberately over a 4s montage. Six sub-beats,
 * each its own shot: 2a form (120), 2b consent (30), 2c submit (30), 2d check
 * your email (30), 2e his mail (60), 2f the OTP choreography (90).
 */

// ── Shared signup layout ────────────────────────────────────────────────────
// Real sizes: a 448px form column, which is what makes the push-in ratio honest.

const CARD_X = FORM_X - 32;
const CARD_W = FORM_W + 64;
const CARD_Y = 236;

const FIELD_Y = { name: 334, email: 412, password: 490 } as const;
const CHECKLIST_Y = 548;
const CONSENT_Y = 654;
const SUBMIT_Y = 716;

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
    <Text x={FORM_X} y={y - 18} size={11} weight={700} color={GREY.label} mono style={{ letterSpacing: 1 }}>
      {label}
    </Text>
    <Box
      x={FORM_X}
      y={y}
      w={FORM_W}
      h={44}
      fill={GREY.field}
      border={focused ? GREY.graphite : GREY.border}
      borderWidth={focused ? 2 : 1}
      radius={8}
    />
    <Text x={FORM_X + 14} y={y + 13} size={15} color={GREY.ink}>
      {value}
    </Text>
  </>
);

const SignupCard: React.FC<{
  nameValue: string;
  emailValue: string;
  passwordValue: string;
  /** How many checklist rows have lit. */
  checklistLit: number;
  collapsed: boolean;
  consentTicked: boolean;
  submitLabel: string;
  focused?: "name" | "email" | "password";
}> = ({ nameValue, emailValue, passwordValue, checklistLit, collapsed, consentTicked, submitLabel, focused }) => (
  <>
    <Box x={CARD_X} y={CARD_Y} w={CARD_W} h={564} fill={GREY.surface} border={GREY.border} radius={14} />
    <Text x={FORM_X} y={CARD_Y + 32} size={27} weight={700}>
      {SIGNUP.heading}
    </Text>

    <Field y={FIELD_Y.name} label={SIGNUP.fields[0].label} value={nameValue} focused={focused === "name"} />
    <Field y={FIELD_Y.email} label={SIGNUP.fields[1].label} value={emailValue} focused={focused === "email"} />
    <Field y={FIELD_Y.password} label={SIGNUP.fields[2].label} value={passwordValue} focused={focused === "password"} />

    {/* The live checklist. Rows light one at a time, then the whole thing
        collapses to a single line — a real beat with a real duration. */}
    {collapsed ? (
      <Text x={FORM_X} y={CHECKLIST_Y} size={14} weight={700} color={GREY.body}>
        ✓&nbsp;&nbsp;{SIGNUP.checklistCollapsed}
      </Text>
    ) : (
      SIGNUP.checklist.map((row, i) => (
        <Text
          key={row}
          x={FORM_X}
          y={CHECKLIST_Y + i * 24}
          size={14}
          color={i < checklistLit ? GREY.body : GREY.strong}
          weight={i < checklistLit ? 700 : 400}
        >
          {i < checklistLit ? "✓" : "·"}&nbsp;&nbsp;{row}
        </Text>
      ))
    )}

    {/* Consent. Beat 2b pushes tight enough to read this whole line. */}
    <Box
      x={FORM_X}
      y={CONSENT_Y}
      w={20}
      h={20}
      radius={5}
      fill={consentTicked ? GREY.graphite : GREY.field}
      border={consentTicked ? GREY.graphite : GREY.border}
    />
    {consentTicked ? (
      <Text x={FORM_X + 4} y={CONSENT_Y + 1} size={15} weight={700} color={GREY.white}>
        ✓
      </Text>
    ) : null}
    <Text x={FORM_X + 32} y={CONSENT_Y - 1} w={FORM_W - 32} size={13.5} color={GREY.body} lineHeight={1.5}>
      {SIGNUP.consent}
    </Text>

    <Button x={FORM_X} y={SUBMIT_Y} w={FORM_W}>
      {submitLabel}
    </Button>
  </>
);

// ── 2a · 0:04–0:08 · 120f — the form fills ──────────────────────────────────

const SubA: React.FC = () => {
  const frame = useCurrentFrame();
  const lit = frame >= 80 ? 3 : frame >= 73 ? 2 : frame >= 66 ? 1 : 0;

  return (
    <Camera
      keys={[
        { frame: 0, shot: shot(960, 530, 1200) },
        { frame: 58, shot: shot(960, 428, 580) },
        { frame: 120, shot: shot(960, 556, 580) },
      ]}
    >
      <Desktop clock="10:20 AM" url="serenify.tech/signup">
        <PublicNav />
        <SignupCard
          nameValue={typed(SIGNUP.fields[0].value, frame, 12, 18)}
          emailValue={typed(SIGNUP.fields[1].value, frame, 34, 22)}
          passwordValue={typed(SIGNUP.fields[2].value, frame, 60, 24)}
          checklistLit={lit}
          collapsed={frame >= 92}
          consentTicked={false}
          submitLabel={SIGNUP.submit}
          focused={frame >= 60 ? "password" : frame >= 34 ? "email" : "name"}
        />
      </Desktop>
    </Camera>
  );
};

// ── 2b · 0:08–0:09 · 30f — the consent checkbox ticks ───────────────────────

const SubB: React.FC = () => {
  const frame = useCurrentFrame();

  return (
    <Camera keys={[{ frame: 0, shot: shot(960, 676, 470) }]}>
      <Desktop clock="10:20 AM" url="serenify.tech/signup">
        <PublicNav />
        <SignupCard
          nameValue={SIGNUP.fields[0].value}
          emailValue={SIGNUP.fields[1].value}
          passwordValue={SIGNUP.fields[2].value}
          checklistLit={3}
          collapsed
          consentTicked={frame >= 9}
          submitLabel={SIGNUP.submit}
        />
        <Cursor x={FORM_X + 12} y={CONSENT_Y + 12} clickAt={8} />
      </Desktop>
    </Camera>
  );
};

// ── 2c · 0:09–0:10 · 30f — "Create account" → "Creating account…" ───────────

const SubC: React.FC = () => {
  const frame = useCurrentFrame();

  return (
    <Camera keys={[{ frame: 0, shot: shot(960, 740, 520) }]}>
      <Desktop clock="10:20 AM" url="serenify.tech/signup">
        <PublicNav />
        <SignupCard
          nameValue={SIGNUP.fields[0].value}
          emailValue={SIGNUP.fields[1].value}
          passwordValue={SIGNUP.fields[2].value}
          checklistLit={3}
          collapsed
          consentTicked
          submitLabel={frame >= 11 ? SIGNUP.submitting : SIGNUP.submit}
        />
        <Cursor x={1096} y={SUBMIT_Y + 18} clickAt={10} />
      </Desktop>
    </Camera>
  );
};

// ── 2d · 0:10–0:11 · 30f — "Check your email" ───────────────────────────────
// Register the heading; the sheet says explicitly not to attempt the body.

const SubD: React.FC = () => (
  <Camera keys={[{ frame: 0, shot: shot(960, 424, 800) }]}>
    <Desktop clock="10:20 AM" url="serenify.tech/signup">
      <PublicNav />
      <Box x={CARD_X} y={300} w={CARD_W} h={340} fill={GREY.surface} border={GREY.border} radius={14} />
      <Box x={FORM_X} y={336} w={56} h={56} radius={28} fill={GREY.panel} />
      <Text x={FORM_X} y={418} size={30} weight={700}>
        {SIGNUP.checkEmail}
      </Text>
      <Text x={FORM_X} y={466} w={FORM_W} size={15} color={GREY.body}>
        {SIGNUP.checkEmailBody}
      </Text>
      <TextBlock x={FORM_X} y={540} w={FORM_W} lines={3} />
    </Desktop>
  </Camera>
);

// ── 2e · 0:11–0:13 · 60f — his mail ─────────────────────────────────────────
/**
 * Same window, new tab. The email is real — the shipped Supabase template — and
 * the push-in lands on the 6-digit code.
 *
 * This sub-beat also has a job 25 seconds downstream: it must establish the
 * mail app's visual signature, because beat 8's toast is only unambiguous if
 * the audience recognises the icon. `<MailMark>` is that signature, used here
 * at size and again in the toast.
 */
const SubE: React.FC = () => {
  const frame = useCurrentFrame();
  const opened = frame >= 18;

  return (
    <Camera
      keys={[
        { frame: 0, shot: shot(960, 520, 1700) },
        { frame: 24, shot: shot(1160, 470, 1020) },
        { frame: 58, shot: shot(1160, 584, 600) },
      ]}
    >
      <Desktop clock="10:21 AM" tab="mail" url="mail.example.com" fill={GREY.page}>
        {/* Sidebar + list + message pane */}
        <Box x={0} y={VIEWPORT_Y} w={260} h={976} fill={GREY.panelAlt} border={GREY.panelAlt} radius={0} />
        <div style={{ position: "absolute", left: 28, top: VIEWPORT_Y + 26 }}>
          <MailMark size={34} />
        </div>
        <Text x={72} y={VIEWPORT_Y + 32} size={20} weight={700} color={GREY.body}>
          Mail
        </Text>
        <TextBlock x={28} y={VIEWPORT_Y + 110} w={200} lines={6} gap={26} size={11} />

        <Box x={260} y={VIEWPORT_Y} w={560} h={976} fill={GREY.surface} border={GREY.border} radius={0} />
        {/* The Serenify email — unread, at the top. */}
        <Box x={272} y={VIEWPORT_Y + 16} w={536} h={84} fill={GREY.panelAlt} border={GREY.graphite} radius={8} />
        <Text x={290} y={VIEWPORT_Y + 30} size={16} weight={700}>
          {EMAIL.from}
        </Text>
        <Text x={290} y={VIEWPORT_Y + 56} w={420} size={14} color={GREY.body}>
          {EMAIL.subject}
        </Text>
        <Text x={700} y={VIEWPORT_Y + 30} w={92} size={13} color={GREY.label} align="right">
          {EMAIL.time}
        </Text>
        <TextBlock x={290} y={VIEWPORT_Y + 128} w={500} lines={7} gap={34} size={12} />

        {/* The message pane — a greybox of the shipped template. */}
        <div style={{ opacity: opened ? 1 : 0.18 }}>
          <Text x={880} y={190} w={900} size={26} weight={700}>
            {EMAIL.subject}
          </Text>
          <div style={{ position: "absolute", left: 880, top: 240 }}>
            <MailMark size={30} />
          </div>
          <Text x={922} y={244} size={17} weight={700}>
            {EMAIL.from}
          </Text>
          <Text x={1520} y={246} w={240} size={15} color={GREY.label} align="right">
            {EMAIL.time}
          </Text>

          <Box x={900} y={300} w={520} h={470} fill={GREY.surface} border={GREY.border} radius={12} />
          <Box x={928} y={326} w={90} h={22} label="wordmark" labelSize={10} fill={GREY.panelAlt} />
          <Text x={928} y={372} size={26} weight={700}>
            {EMAIL.headline}
          </Text>
          <Text x={928} y={412} w={464} size={15} color={GREY.body}>
            {EMAIL.body}
          </Text>
          <Button x={1058} y={452} w={160} h={42} size={14}>
            {EMAIL.button}
          </Button>
          <Text x={928} y={520} size={12} weight={700} color={GREY.body}>
            {EMAIL.codeLabel}
          </Text>
          <Box x={928} y={542} w={464} h={54} fill={GREY.field} border={GREY.border} radius={8} />
          <Text
            x={928}
            y={556}
            w={464}
            size={26}
            weight={700}
            align="center"
            mono
            style={{ letterSpacing: 6 }}
          >
            {EMAIL.code}
          </Text>
          <Text x={928} y={628} w={464} size={12} color={GREY.label}>
            {EMAIL.footer}
          </Text>
        </div>
      </Desktop>
    </Camera>
  );
};

// ── 2f · 0:13–0:16 · 90f — the OTP choreography ─────────────────────────────
/**
 * The hero moment of the signup section, played close to real time. Timings
 * straight from the recon, converted at 30fps:
 *
 *   halo sweep 1→6, 130ms each  →  0 – 23.4f
 *   hold 360ms                  → 23.4 – 34.2f
 *   merge 540ms                 → 34.2 – 50.4f
 *   check + "Verified" 560ms    → 50.4 – 67.2f
 *   pill holds 700ms            → 67.2 – 88.2f
 *   "Taking you in…" at 2080ms  → from 62.4f
 *
 * NOTE, and it is a real finding: the sheet gives 2f three seconds and the
 * choreography alone is 2.94s, which leaves no room for the digits to be
 * entered first. They are landed *on* the halo sweep instead — which is what
 * the product does anyway, since the halo is what tracks each arriving digit.
 *
 * Locked-off. No camera move; the animation carries it.
 */
const BOX_W = 56;
const BOX_H = 64;
const GAP = 12;
const ROW_Y = 400;

const SubF: React.FC = () => {
  const frame = useCurrentFrame();

  const merge = interpolate(frame, [34.2, 50.4], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: Easing.inOut(Easing.cubic),
  });
  const verified = interpolate(frame, [50.4, 67.2], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const takingYouIn = useFade(62.4, 10);

  const gap = GAP * (1 - merge);
  const rowW = 6 * BOX_W + 5 * gap;
  const rowX = 960 - rowW / 2;

  return (
    <Camera keys={[{ frame: 0, shot: shot(960, 424, 560) }]}>
      <Desktop clock="10:22 AM" url="serenify.tech/verify">
        <PublicNav />
        <Text x={660} y={324} w={600} size={27} weight={700} align="center">
          {OTP.heading}
        </Text>

        {OTP.digits.map((digit, i) => {
          const landed = frame >= i * 3.9;
          // The halo: a 130ms ring on the box the digit is arriving in.
          const halo = interpolate(frame, [i * 3.9, i * 3.9 + 3.9], [1, 0], {
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
                  left: rowX + i * (BOX_W + gap),
                  top: ROW_Y,
                  width: BOX_W,
                  height: BOX_H,
                  boxSizing: "border-box",
                  // Borders melt as the row becomes one pill. Dropped outright
                  // at the end rather than left at a fraction of a pixel —
                  // Chrome still paints a sub-pixel border as a hairline, which
                  // showed up as six visible seams down the finished pill.
                  border: merge > 0.98 ? "none" : `${1 - merge}px solid ${GREY.border}`,
                  borderRadius: `${outerL}px ${outerR}px ${outerR}px ${outerL}px`,
                  backgroundColor: merge > 0 ? GREY.graphite : GREY.field,
                }}
              />
              {halo > 0.01 ? (
                <div
                  style={{
                    position: "absolute",
                    left: rowX + i * (BOX_W + gap) - 4,
                    top: ROW_Y - 4,
                    width: BOX_W + 8,
                    height: BOX_H + 8,
                    borderRadius: 12,
                    border: `3px solid ${GREY.graphite}`,
                    opacity: halo,
                  }}
                />
              ) : null}
              <div
                style={{
                  position: "absolute",
                  left: rowX + i * (BOX_W + gap),
                  top: ROW_Y + 16,
                  width: BOX_W,
                  textAlign: "center",
                  fontFamily: MONO,
                  fontSize: 30,
                  fontWeight: 700,
                  color: merge > 0.5 ? GREY.white : GREY.ink,
                  opacity: (landed ? 1 : 0) * (1 - verified),
                }}
              >
                {digit}
              </div>
            </React.Fragment>
          );
        })}

        {/* Check + "Verified" cross-fade into the finished pill. */}
        <Text
          x={rowX}
          y={ROW_Y + 18}
          w={rowW}
          size={26}
          weight={700}
          align="center"
          color={GREY.white}
          opacity={verified}
        >
          ✓&nbsp;&nbsp;{OTP.verified}
        </Text>

        <Text x={660} y={498} w={600} size={16} align="center" color={GREY.label} opacity={takingYouIn}>
          {OTP.takingYouIn}
        </Text>
      </Desktop>
    </Camera>
  );
};

export const Beat02Signup: React.FC = () => (
  <AbsoluteFill>
    <Series>
      <Series.Sequence durationInFrames={120} name="2a form">
        <SubA />
      </Series.Sequence>
      <Series.Sequence durationInFrames={30} name="2b consent">
        <SubB />
      </Series.Sequence>
      <Series.Sequence durationInFrames={30} name="2c submit">
        <SubC />
      </Series.Sequence>
      <Series.Sequence durationInFrames={30} name="2d check your email">
        <SubD />
      </Series.Sequence>
      <Series.Sequence durationInFrames={60} name="2e his mail">
        <SubE />
      </Series.Sequence>
      <Series.Sequence durationInFrames={90} name="2f OTP choreography">
        <SubF />
      </Series.Sequence>
    </Series>
  </AbsoluteFill>
);
