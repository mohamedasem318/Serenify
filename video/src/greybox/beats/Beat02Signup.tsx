import React from "react";
import { AbsoluteFill, Easing, interpolate, Series, useCurrentFrame } from "remotion";

import { Camera, frameRect, rect, shot } from "../Camera";
import { Desktop, MailMark, PublicNav } from "../chrome";
import { EMAIL, OTP, SIGNUP } from "../copy";
import { FORM_W, FORM_X, GREY, H, MONO, VIEWPORT_Y, W } from "../theme";
import { Box, Button, Cursor, Text, TextBlock, useFade } from "../ui";

/**
 * Beat 2 · Signup · 0:05–0:18 · 390 frames
 *
 * The credibility spend, chosen deliberately over a 4s montage. Six sub-beats,
 * each landing on a complete element: 2a form (120), 2b consent (30), 2c submit
 * (30), 2d check your email (30), 2e his mail (90), 2f the OTP choreography (90).
 *
 * COST: 2e went 60 → 90 frames (+1s). Under the framing rule the email needs
 * three landings — the unread list row, the whole rendered email, then the code
 * — and 2s could not hold them.
 */

// ── Shared signup layout ────────────────────────────────────────────────────
// Real sizes: a 448px form column inside a 1200px viewport.

const CARD = rect(344, 166, 512, 470);
/** Labels + the three fields + the live checklist, as one complete element. */
const FIELD_GROUP = rect(376, 228, 448, 266);
const CONSENT_ROW = rect(376, 510, 448, 44);
const SUBMIT_ROW = rect(376, 570, 448, 42);

const FIELD_Y = { name: 246, email: 316, password: 386 } as const;
const CHECKLIST_Y = 440;

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
    <Box x={CARD.x} y={CARD.y} w={CARD.w} h={CARD.h} fill={GREY.surface} border={GREY.border} radius={12} />
    {/* 12px of card padding rather than 20: the 2a field-group landing tops out
        at y 212, and at 20 the heading's descenders were sliced by the frame
        edge — a text fragment, which is the one thing the framing rule forbids. */}
    <Text x={FORM_X} y={CARD.y + 12} size={24} weight={700}>
      {SIGNUP.heading}
    </Text>

    <Field y={FIELD_Y.name} label={SIGNUP.fields[0].label} value={nameValue} focused={focused === "name"} />
    <Field y={FIELD_Y.email} label={SIGNUP.fields[1].label} value={emailValue} focused={focused === "email"} />
    <Field y={FIELD_Y.password} label={SIGNUP.fields[2].label} value={passwordValue} focused={focused === "password"} />

    {/* The live checklist. Rows light one at a time, then the whole thing
        collapses to a single line — a real beat with a real duration. */}
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
          color={i < checklistLit ? GREY.body : GREY.strong}
          weight={i < checklistLit ? 700 : 400}
        >
          {i < checklistLit ? "✓" : "·"}&nbsp;&nbsp;{row}
        </Text>
      ))
    )}

    {/* Consent. Beat 2b lands on this row so the whole line reads. */}
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
      {submitLabel}
    </Button>
  </>
);

// ── 2a · 120f — the form fills ──────────────────────────────────────────────

const SubA: React.FC = () => {
  const frame = useCurrentFrame();
  const lit = frame >= 80 ? 3 : frame >= 73 ? 2 : frame >= 66 ? 1 : 0;

  return (
    <Camera
      keys={[
        // The whole card, then the field group. Both complete elements.
        { frame: 0, shot: frameRect(CARD, 24) },
        { frame: 14, shot: frameRect(CARD, 24) },
        { frame: 62, shot: frameRect(FIELD_GROUP, 16) },
        { frame: 120, shot: frameRect(FIELD_GROUP, 16) },
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

// ── 2b · 30f — the consent checkbox ticks ───────────────────────────────────

const SubB: React.FC = () => {
  const frame = useCurrentFrame();

  return (
    <Camera keys={[{ frame: 0, shot: frameRect(CONSENT_ROW, 40) }]}>
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
        <Cursor x={FORM_X + 10} y={524} clickAt={8} />
      </Desktop>
    </Camera>
  );
};

// ── 2c · 30f — "Create account" → "Creating account…" ───────────────────────

const SubC: React.FC = () => {
  const frame = useCurrentFrame();

  return (
    <Camera keys={[{ frame: 0, shot: frameRect(SUBMIT_ROW, 48) }]}>
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
        <Cursor x={720} y={584} clickAt={10} />
      </Desktop>
    </Camera>
  );
};

// ── 2d · 30f — "Check your email" ───────────────────────────────────────────
// Register the heading; the sheet says explicitly not to attempt the body.

const CHECK_CARD = rect(344, 200, 512, 250);

const SubD: React.FC = () => (
  <Camera keys={[{ frame: 0, shot: frameRect(CHECK_CARD, 24) }]}>
    <Desktop clock="10:20 AM" url="serenify.tech/signup">
      <PublicNav />
      <Box
        x={CHECK_CARD.x}
        y={CHECK_CARD.y}
        w={CHECK_CARD.w}
        h={CHECK_CARD.h}
        fill={GREY.surface}
        border={GREY.border}
        radius={12}
      />
      <Box x={FORM_X} y={228} w={44} h={44} radius={22} fill={GREY.panel} />
      <Text x={FORM_X} y={292} size={26} weight={700}>
        {SIGNUP.checkEmail}
      </Text>
      <Text x={FORM_X} y={332} w={FORM_W} size={13} color={GREY.body}>
        {SIGNUP.checkEmailBody}
      </Text>
      <TextBlock x={FORM_X} y={392} w={FORM_W} lines={2} />
    </Desktop>
  </Camera>
);

// ── 2e · 90f — his mail ─────────────────────────────────────────────────────
/**
 * Same window, new tab. The email is the shipped Supabase template
 * (`supabase/templates/confirmation.html`) at that template's own type sizes —
 * 30px headline, 16px body, 25px code with 4px tracking — so this is a real
 * email with a sender, a subject, a timestamp, a body and a code, not a
 * placeholder in an envelope shape. Generic in *branding* (L2b), not in content.
 *
 * Two landings, each a complete element: the unread row in the list, then the
 * whole rendered email, which is held with a slow push that ends tighter.
 *
 * A third landing on the code block was built and then removed: at any framing
 * tight enough to enlarge the code, the frame edge cut through the body line
 * above it. The whole-card landing already renders the code legibly, so the push
 * stays inside the card instead — the sheet's "the push-in lands on the code" is
 * honoured by where the move *ends*, not by cropping to it.
 *
 * This sub-beat also has a job 25 seconds downstream: it must establish the mail
 * app's visual signature, because beat 8's toast is only unambiguous if the
 * audience recognises the icon. `<MailMark>` is that signature, used here at
 * size and again in the toast.
 */
const LIST_ROW = rect(180, 104, 310, 62);
const EMAIL_CARD = rect(560, 190, 520, 400);

const SubE: React.FC = () => {
  const frame = useCurrentFrame();
  const opened = frame >= 34;

  return (
    <Camera
      keys={[
        { frame: 0, shot: shot(W / 2, H / 2, W) },
        { frame: 18, shot: frameRect(LIST_ROW, 24) },
        { frame: 38, shot: frameRect(LIST_ROW, 24) },
        { frame: 58, shot: frameRect(EMAIL_CARD, 44) },
        { frame: 90, shot: frameRect(EMAIL_CARD, 6) },
      ]}
    >
      <Desktop clock="10:21 AM" tab="mail" url="mail.example.com">
        {/* Sidebar + list + message pane */}
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
        <Cursor x={LIST_ROW.x + 240} y={LIST_ROW.y + 34} clickAt={30} />

        {/* The message pane — a greybox of the shipped template, at its sizes. */}
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
          <Text
            x={588}
            y={456}
            w={464}
            size={25}
            weight={700}
            align="center"
            mono
            style={{ letterSpacing: 4 }}
          >
            {EMAIL.code}
          </Text>
          <Box x={588} y={514} w={464} h={1} fill={GREY.border} border={GREY.border} radius={0} />
          <Text x={588} y={528} w={464} size={13} color={GREY.label} lineHeight={1.6}>
            {EMAIL.footer}
          </Text>
        </div>
      </Desktop>
    </Camera>
  );
};

// ── 2f · 90f — the OTP choreography ─────────────────────────────────────────
/**
 * The hero moment of the signup section, played close to real time. Timings from
 * `components/ui/auth/otp-boxes.tsx`, converted at 30fps:
 *
 *   halo sweep 1→6, 130ms each  →  0 – 23.4f
 *   hold 360ms                  → 23.4 – 34.2f
 *   merge 540ms                 → 34.2 – 50.4f
 *   check + "Verified" 560ms    → 50.4 – 67.2f
 *   pill HOLDS 700ms (#190)     → 67.2 – 88.2f
 *   "Taking you in…" at 2080ms  → from 62.4f
 *
 * The sheet gives 2f three seconds and the choreography alone is 2.94s, so there
 * is no room for the digits to be entered first. They are landed *on* the halo
 * sweep instead — which is what the product does anyway, since the halo is what
 * tracks each arriving digit.
 *
 * DIGITS CLEAR ON THE MERGE, not after it. Revision 1 held them until "Verified"
 * faded in, which looked broken. The real component applies `text-transparent`
 * on the *same* state flip that fills the boxes, with a 500ms colour transition
 * — so the digits fade out across the merge and there is never a moment where
 * they sit inside a filled pill. There is no gap in the shipped component.
 *
 * Locked-off. No camera move; the animation carries it.
 */
const BOX_W = 52;
const BOX_H = 52;
const GAP = 8;
const OTP_ROW = rect(424, 300, 6 * BOX_W + 5 * GAP, BOX_H);

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
  const rowX = W / 2 - rowW / 2;

  return (
    <Camera keys={[{ frame: 0, shot: frameRect(OTP_ROW, 40) }]}>
      <Desktop clock="10:22 AM" url="serenify.tech/verify">
        <PublicNav />
        <Text x={400} y={246} w={400} size={24} weight={700} align="center">
          {OTP.heading}
        </Text>

        {OTP.digits.map((digit, i) => {
          const landed = frame >= i * 3.9;
          // The halo: a 130ms ring on the box the digit is arriving in.
          const halo = interpolate(frame, [i * 3.9, i * 3.9 + 3.9], [1, 0], {
            extrapolateLeft: "clamp",
            extrapolateRight: "clamp",
          });
          // Outer corners round to 28px; inner corners melt to 0.
          const outerL = i === 0 ? 8 + 20 * merge : 8 * (1 - merge);
          const outerR = i === 5 ? 8 + 20 * merge : 8 * (1 - merge);

          return (
            <React.Fragment key={i}>
              <div
                style={{
                  position: "absolute",
                  left: rowX + i * (BOX_W + gap),
                  top: OTP_ROW.y,
                  width: BOX_W,
                  height: BOX_H,
                  boxSizing: "border-box",
                  // Borders melt as the row becomes one pill. Dropped outright at
                  // the end rather than left at a fraction of a pixel — Chrome
                  // paints a sub-pixel border as a hairline, which showed up as
                  // six visible seams down the finished pill.
                  border: merge > 0.98 ? "none" : `${1 - merge}px solid ${GREY.border}`,
                  borderRadius: `${outerL}px ${outerR}px ${outerR}px ${outerL}px`,
                  backgroundColor: merge > 0 ? GREY.graphite : GREY.field,
                }}
              />
              {halo > 0.01 ? (
                <div
                  style={{
                    position: "absolute",
                    left: rowX + i * (BOX_W + gap) - 3,
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
                  left: rowX + i * (BOX_W + gap),
                  top: OTP_ROW.y + 12,
                  width: BOX_W,
                  textAlign: "center",
                  fontFamily: MONO,
                  fontSize: 26,
                  fontWeight: 500,
                  color: GREY.ink,
                  // Cleared BY the merge, exactly as the real component does it.
                  opacity: (landed ? 1 : 0) * (1 - merge),
                }}
              >
                {digit}
              </div>
            </React.Fragment>
          );
        })}

        {/* Check + "Verified" (text-lg) cross-fade onto the finished pill. */}
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
      <Series.Sequence durationInFrames={90} name="2e his mail">
        <SubE />
      </Series.Sequence>
      <Series.Sequence durationInFrames={90} name="2f OTP choreography">
        <SubF />
      </Series.Sequence>
    </Series>
  </AbsoluteFill>
);
