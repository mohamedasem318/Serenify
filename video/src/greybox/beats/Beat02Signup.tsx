import React from "react";
import { AbsoluteFill, Easing, interpolate, useCurrentFrame } from "remotion";

import { AuthPage, CheckEmailSurface, SignupSurface } from "../../app/auth";
import { STANDIN } from "../../app/furniture";
import { SIGNUP as G, VERIFY, centre } from "../../app/geometry";
import { Hover, useHover } from "../../app/hover";
import { MAIL_ROW, MailClient } from "../../app/mail";
import { OTP_TIMELINE } from "../../app/otp";
import { Pointer } from "../../app/pointer";
import { Desktop, StandIn, newTabRect, tabRect } from "../../app/shell";
import { Camera, Shot, frameRect, rect, shot } from "../Camera";
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

/**
 * ══ THE MAIL CLIENT'S TWO LANDINGS — RE-MEASURED, NOT INHERITED ═════════════════════
 *
 * `mail.tsx` exports `MAIL_ROW` and `MAIL_MESSAGE`, and this beat used to frame straight off
 * them. `MAIL_ROW` is still right. **`MAIL_MESSAGE` is not**, and it was producing the worst
 * crop in the film: it says the reading pane's content column is `560 × 470 at (536, 88)`, which
 * was the guessed card width from before the client was rebuilt against
 * `supabase/templates/confirmation.html`. The shipped card is **520 wide** and it is **taller
 * than the pane**.
 *
 * Measured off the rendered frame (full-world still, screen ÷ 1.6, colour-edge scan on the
 * card's own `#63B292` top border, `#181B1E` fill and `#23272B` border against the pane's
 * `#1B1F22`):
 *
 *   card left / right    536.25 → 1056.25      (520 wide, exactly the template's `.panel`)
 *   card top             230.7                 (world, at pane scroll 0)
 *   card bottom          712.4                 → **37.4px BELOW the page fold at 675**
 *
 * So the whole-card landing the sheet asks for is not available at rest: the client clips at the
 * viewport and the email's footer line was being sliced by the window, then framed and magnified
 * by a camera that had been told the card ended at 558.
 *
 * ── THE PANE SCROLLS, WHICH IS WHAT A MAIL CLIENT DOES ──────────────────────────────
 *
 * 52px of it. That is the smallest scroll that puts the card whole inside the viewport with the
 * frame's bottom edge landing exactly on the window's own bottom edge (712.4 − 52 + 14 of margin
 * = 674.4 ≈ 675), and it is small enough that the message's sender row and the divider above the
 * card scroll cleanly out of the shot rather than being cut by it. The subject line goes with
 * them — 114 → 62, entirely above the viewport top, so it is scrolled away rather than sliced.
 *
 * `<MailClient/>` takes no scroll prop and is not this pass's file to change, so the pane is
 * translated through a scoped selector on its last child — the same technique `auth.tsx` uses to
 * drive `#accept_terms` and `hover.tsx` uses for every hover in the film. **A `paneScroll` prop
 * on `<MailClient/>` and a corrected `MAIL_MESSAGE` both belong in `mail.tsx`** — see the report.
 */
const MAIL_CARD = rect(536.25, 230.7, 520, 482.5);
/** How far the reading pane is scrolled once the message is open. */
const MAIL_PANE_SCROLL = 52;
/** The card where the camera actually finds it, once the pane has scrolled. */
const MAIL_CARD_SCROLLED = rect(
  MAIL_CARD.x,
  MAIL_CARD.y - MAIL_PANE_SCROLL,
  MAIL_CARD.w,
  MAIL_CARD.h,
);

const LIST_ROW = rect(MAIL_ROW.x, MAIL_ROW.y + VIEWPORT_Y, MAIL_ROW.w, MAIL_ROW.h);

// ── Phase clock ─────────────────────────────────────────────────────────────────────

const T = {
  nameFrom: 24,
  emailFrom: 46,
  passwordFrom: 76,
  /** The page scrolls again, 45 → 145, to bring the consent row and the submit above the fold. */
  scrollFrom: 110,
  scrollTo: 132,
  consentTick: 140,
  submitPress: 152,
  /** The form cross-fades to the "Check your email" state. */
  checkEmail: 162,
  newTabClick: 214,
  mailUrlFrom: 224,
  mailEnter: 240,
  mailLoaded: 246,
  openEmail: 272,
  serenifyTabClick: 354,
  /** `playSuccess()`'s zero. The camera arrives ten frames into the halo sweep. */
  otp: 380,
} as const;

/**
 * How long the tab switch takes to resolve. It was 8; at 5 the verify surface is up five frames
 * after the click rather than eight, which is what buys 2f its wide hold back — the tail of this
 * beat is the tightest budget in the film and every frame between the tab click and the OTP push
 * is a frame the audience spends working out which screen it is on.
 */
const TAB_SWITCH_LAG = 5;

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
 * ══ THE PAGE SCROLLS TWICE, AND THE FIRST ONE IS NEW ════════════════════════════════
 *
 * `SIGNUP.col` is 818.5 tall against a 583px viewport, so the form does not fit and the beat has
 * always scrolled to reach the submit. What it did not do was scroll for the **checklist**, and
 * that was a defect the measured frame made unarguable:
 *
 *   `<PasswordRequirements/>` renders THREE rows until the password validates, and at scroll 0
 *   they sit at world y 647 / 668.9 / 690.8 against a fold at **675**. Row 2 was sliced by the
 *   window and row 3 was under it — so 2a's establish and 2b's landing both showed a cut line of
 *   type, and two of the three rows the sheet says must light "row by row" were never on screen.
 *
 * `2b` = **45**. The smallest scroll that clears the three-row block (bottom ≈ 704 − 45 = 659, 16
 * clear of the fold) and the largest that leaves the form below the `(auth)` shell's own wordmark
 * — the shell header does not scroll with the children, so past ~62 the heading slides under it.
 *
 * `2c` = **145**, unchanged and still bounded on both sides by measurement rather than taste:
 * below ~135 the submit's own bottom edge is under the fold; above ~150 the "Already have an
 * account? Sign in" footnote rises into the viewport and is sliced by it.
 */
const SCROLL_2B = 45;
const SIGNUP_SCROLL = 145;

const scrolledRect = (r: ReturnType<typeof rect>, s: number) => rect(r.x, r.y - s, r.w, r.h);

/**
 * ══ THE LANDINGS ═══════════════════════════════════════════════════════════════════
 *
 * Every rect below is where the element **renders**, measured off a full-world still (screen ÷
 * 1.6) rather than taken from a probe that happened to catch a different component state. Two of
 * `geometry.ts`'s `SIGNUP` rects were measured against the COLLAPSED checklist and are 35–45px
 * short of the state 2a and 2b actually show; `VERIFY.section` is 52px taller than the surface
 * this film renders. Corrections are local, and listed for promotion.
 */

/** `SIGNUP.fieldPassword`'s 106.4 is the collapsed one-line state. Expanded it is 141.4. */
const RULES_BOTTOM_EXPANDED = 704;

/** The whole browser window. Used wherever the beat has to reach the chrome. */
const WINDOW: Shot = shot(W / 2, H / 2, W);

/**
 * **2a · establish.**
 *
 * It used to be `frameRect(SIGNUP.section, 24)` = 1128.9 wide, framing a rect that runs to world
 * 846.5 inside a viewport that ends at **675**: a third of the frame was empty page below the
 * window, and in the middle of that frame the password checklist's second row was cut in half by
 * the fold.
 *
 *   frame  x 160 → 1040   y 146 → 641   (w 880)
 *
 * The bottom edge is placed in the **8px gutter** between the password input's bottom (634.8) and
 * the checklist's first row (box top 642.8, ink 647), so the checklist — the one thing on this
 * surface the page's own fold is cutting at scroll 0 — is entirely outside the shot rather than
 * sliced inside it. The top edge is 10 above the wordmark and 54 below the page's own top, so no
 * browser chrome is in frame to be cut either. Everything it holds is whole: wordmark, theme
 * toggle, heading, subtitle, all three labels and all three inputs. Heading reads at 17.3px on a
 * phone.
 *
 * The hold ends at f16 and the page scrolls to 45 from there, which is what lets the NEXT
 * landing hold the checklist whole. Nothing is ever framed across the fold.
 */
const SIGNUP_ESTABLISH: Shot = shot(600, 393.5, 880);

/**
 * **2b · the field group** — labels, all three fields and the three-row checklist, whole.
 *
 *   content  400 → 800   ×   325.2 → 659.2   (at scroll 45)
 *   frameRect(m=20) → w = max(440, 374 × 16/9) = 664.9
 *   frame    y 305.2 → 679.2 — 15.7 clear of the subtitle above, 4.2 past the world's bottom
 *            edge, which is invisible because the page and the camera backdrop are one colour.
 */
const FIELD_GROUP: Shot = frameRect(
  scrolledRect(rect(G.fieldName.x, G.fieldName.y, G.fieldName.w, RULES_BOTTOM_EXPANDED - G.fieldName.y), SCROLL_2B),
  20,
);

/**
 * **2b · the push onto the password field, where the checklist has to READ.**
 *
 * At the field-group framing the 13px rows land at **8.2px on a phone**, under the floor. This
 * holds the email field, the password field and the checklist — every one of them whole — at
 * 479.3, where they land at **11.4px**. Its bottom edge is the window's own (675.0).
 */
const PASSWORD_SHOT: Shot = frameRect(
  scrolledRect(rect(G.fieldEmail.x, G.fieldEmail.y, G.fieldEmail.w, RULES_BOTTOM_EXPANDED - G.fieldEmail.y), SCROLL_2B),
  16,
);

/**
 * **2b–2c · the consent row and the submit.**
 *
 *   content  400 → 800   ×   417.6 → 657.5   (at scroll 145)
 *   frameRect(m=16) → w = 483.4, frame y 401.6 → 673.5
 *
 * The old shot was `frameRect(consentAndSubmit, 40)` — 480 wide with its TOP EDGE at 463.75,
 * which is inside the password input (441.8 → 489.8): the pan landed on a sliced control, which
 * is the exact defect the 145 scroll was chosen to avoid at the other end. This holds the
 * password field, its checklist line, the acknowledgement and the button, all four edges in.
 *
 * **And it is genuinely a pan.** 479.3 → 483.4 is no zoom at all; what travels is the page,
 * under a camera that barely moves. That is what reaching a below-the-fold submit looks like.
 */
const CONSENT_SHOT: Shot = frameRect(
  scrolledRect(rect(G.fieldPassword.x, G.fieldPassword.y, G.fieldPassword.w, G.submit.y + G.submit.h - G.fieldPassword.y), SIGNUP_SCROLL),
  16,
);

/**
 * **2d · "Check your email", whole.**
 *
 * `VERIFY.section` says 442.1 tall (260 → 702.1) and the surface this film renders ends at
 * **649.5** — the probe caught a taller variant. Framed on it, 2d put 78px of empty page under
 * the panel and reached 53px past the window. Measured, the content is 260 → 649.5.
 */
const VERIFY_BOTTOM = 649.5;
const VERIFY_SHOT: Shot = frameRect(
  rect(VERIFY.heading.x, VERIFY.heading.y, VERIFY.heading.w, VERIFY_BOTTOM - VERIFY.heading.y),
  24,
);

/**
 * **2e · the unread row.**
 *
 * `frameRect(LIST_ROW, 24)` was 348 wide with its edges at y 122.1 and 317.9 — through the
 * "Inbox" heading at the top and through the neighbour row's subject at the bottom. Two sliced
 * elements on the shot whose whole job is one row.
 *
 * The list is 300 wide and the rows are stacked on a 70px pitch with 6px gutters, so at 16:9 no
 * frame around one row can hold its neighbours whole — the frame is ~174 tall for a 64px row. So
 * **all four edges are placed in gutters**, which is the only arrangement at this geometry that
 * cuts nothing:
 *
 *   top     152     in the gap between "3 unread" (ends ~150) and row 0 (188.1)
 *   bottom  326     in the 6px gutter between row 1 (ends 321.9) and row 2 (328.1)
 *   left    185.4   between the rail's border (175) and the rows' left edge (190)
 *   right   494.7   between the rows' right edge (490) and the reading pane's divider (504)
 *
 * **The right edge is the one that matters and it is the one that was missed.** At 590 the frame
 * reached into the reading pane, so from the click onward it held the opened message's subject
 * and sender cut in half — "Confi", "Se", "to" — three sliced lines, on the shot that exists to
 * show one row. At 494.7 the pane is outside the frame entirely, the click's visible consequence
 * is the row's own selected state, and the message is met by the camera as it pulls out.
 *
 *   frame  w 309.3, h 174 · sender 18.4px, subject 17.1px on a phone
 */
const LIST_SHOT: Shot = shot(340, 239, 309.3);

/**
 * **2e · the email, whole — the landing that was broken.**
 *
 * Framed on `MAIL_CARD_SCROLLED` with 14 of margin: 907.6 wide, frame y 164.7 → 675.2, so the
 * bottom edge is the window's own and the card sits 14 clear of it. The frame's left edge is
 * pinned to 182 rather than centred on the card, because a card-centred frame starts at 342 and
 * cuts the message list's rows in half — 907.6 is wider than the reading pane, so the frame has
 * to spend its surplus on either the list or on backdrop past the window, and the list column
 * whole is the honest half of that trade: it is what says "this is a mail client".
 *
 *   holds   the whole email document card, the six list rows, the pane divider
 *   reads   code 11.6px, headline 13.9px on a phone
 */
const CARD_TIGHT: Shot = (() => {
  const framed = frameRect(MAIL_CARD_SCROLLED, 14);
  return { ...framed, cx: 182 + framed.w / 2 };
})();

/**
 * **2f · the OTP panel, whole.**
 *
 * It was `frameRect(VERIFY.otpRow, 40)` — 432 wide, top edge at 441.6, which runs through the
 * FIRST LINE of the panel's own helper copy and cuts the panel itself in half. The six boxes now
 * exist from the moment "Check your email" lands, so there is a code field on screen through the
 * whole hold and it has to be shown as one thing. This is the panel, all four edges in, with the
 * pill (52 tall) at 43px on a phone and every line in the panel above 11.
 */
const OTP_PANEL: Shot = frameRect(VERIFY.panel, 16);

/**
 * **THE SEAM INTO BEAT 3.** `Beat03Dashboard.tsx` opens on this exact shot and holds this exact
 * surface for its first ten frames. Keep the two in step — see the note there. The rect is the
 * `(auth)` column from the wordmark to the panel's bottom, which is the widest thing in this
 * beat that is still a composed shot rather than the whole window.
 */
export const BEAT2_SEAM: Shot = frameRect(rect(400, 156, 400, VERIFY_BOTTOM - 156), 24);

// ── The take ────────────────────────────────────────────────────────────────────────

export const Beat02Signup: React.FC = () => {
  const frame = useCurrentFrame();

  const onMail = frame >= T.newTabClick + 4 && frame < T.serenifyTabClick + TAB_SWITCH_LAG;
  const mailLoaded = frame >= T.mailLoaded;
  const onVerify = frame >= T.serenifyTabClick + TAB_SWITCH_LAG;

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

  // Two scrolls, one direction: 45 early, so the three-row checklist clears the fold before the
  // camera ever lands on it; then 145, to reach the consent row and the submit; then back to 0 as
  // the surface becomes the short "Check your email" state, which needs no scroll at all.
  const scroll = interpolate(
    frame,
    [16, 38, T.scrollFrom, T.scrollTo, T.checkEmail, T.checkEmail + 20],
    [0, SCROLL_2B, SCROLL_2B, SIGNUP_SCROLL, SIGNUP_SCROLL, 0],
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

  const paneScroll = interpolate(frame, [T.openEmail + 6, T.openEmail + 28], [0, MAIL_PANE_SCROLL], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: Easing.inOut(Easing.cubic),
  });

  return (
    <AbsoluteFill>
      <Camera
        keys={[
          // A · establish — the whole window. The page scrolls 45 under it (f4–f28) so the
          // three-row checklist clears the fold before any landing frames it.
          { frame: 0, shot: SIGNUP_ESTABLISH },
          { frame: 16, shot: SIGNUP_ESTABLISH },
          // B · the field group, whole; then a push onto the password field where the checklist
          // lights row by row and is actually legible.
          { frame: 48, shot: FIELD_GROUP },
          { frame: 70, shot: FIELD_GROUP },
          { frame: 88, shot: PASSWORD_SHOT },
          { frame: 110, shot: PASSWORD_SHOT },
          // C · the PAN to consent + submit. The camera holds its measure; the page scrolls
          // 45 → 145 under it. Both clicks happen in this shot.
          { frame: 134, shot: CONSENT_SHOT },
          { frame: 158, shot: CONSENT_SHOT },
          // D · the surface animates to "Check your email"; the camera lands on the result.
          { frame: 182, shot: VERIFY_SHOT },
          { frame: 196, shot: VERIFY_SHOT },
          // E · out to the chrome BEFORE the new-tab button is pressed. It used to be pressed at
          // f200 while the frame's top edge was at world 190 — the control was 130px above the
          // shot that was clicking it.
          { frame: 206, shot: WINDOW },
          { frame: 250, shot: WINDOW },
          { frame: 264, shot: LIST_SHOT },
          { frame: 282, shot: LIST_SHOT },
          // …out again, so the message is met at page scale, then the slow push onto it.
          { frame: 296, shot: WINDOW },
          { frame: 306, shot: WINDOW },
          { frame: 324, shot: CARD_TIGHT },
          { frame: 336, shot: CARD_TIGHT },
          // F · performed tab switch back. The pull-out COMPLETES before the tab is pressed.
          { frame: 346, shot: WINDOW },
          // G · the wide hold, so the audience sees the screen it is on
          { frame: 366, shot: WINDOW },
          // H · in on the OTP panel
          { frame: 390, shot: OTP_PANEL },
          { frame: 448, shot: OTP_PANEL },
          // I · THE SEAM. The pull-out into beat 3 starts here, inside this beat, so that the
          // navigation lands at a width where it reads as a page change rather than as a glitch
          // frame under a 432px-wide shot. Beat 3 opens on this exact shot and holds this exact
          // surface for ten more frames.
          { frame: 467, shot: BEAT2_SEAM },
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
                  // It stays on the row through the whole push onto the email…
                  {
                    frame: T.serenifyTabClick - 14,
                    x: LIST_ROW.x + LIST_ROW.w / 2,
                    y: LIST_ROW.y + LIST_ROW.h / 2,
                  },
                  // …and travels to the tab's measured centre only once the camera is back at
                  // the whole window, so the travel is on screen and the click has a cause.
                  {
                    frame: T.serenifyTabClick - 4,
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
              <div data-mailpane style={{ position: "absolute", inset: 0 }}>
                <style>{`[data-mailpane] > div > div:last-child { transform: translateY(${-paneScroll}px); }`}</style>
                <MailClient opened={frame >= T.openEmail} rowHover={rowHover} />
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
                    rather than on the `+`.
                    **And it is only shown once the camera can see it.** The waypoints used to
                    start 22 frames early, while the shot was still tight on the verify surface
                    130px below the tab strip, so the travel played entirely off-frame and the
                    press arrived from nowhere. They start at f200 now, which is where the
                    pull-out first has the chrome in frame. */}
                <Pointer
                  path={[
                    { frame: T.newTabClick - 14, x: newTabRect(1).x + 90, y: newTabRect(1).y + 70 },
                    {
                      frame: T.newTabClick - 4,
                      x: newTabRect(1).x + newTabRect(1).w / 2,
                      y: newTabRect(1).y + newTabRect(1).h / 2,
                    },
                  ]}
                  clicks={[T.newTabClick]}
                  visible={{ from: T.newTabClick - 16, to: T.newTabClick + 12 }}
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
                  {/* `otpFrom` is passed unconditionally: the six-box row must be present and
                      visible on this surface from the moment "Check your email" lands (frame
                      `T.checkEmail`), not only once the take is back on this tab at `onVerify`.
                      `<OtpChoreography/>` already renders the idle, unlit boxes correctly for
                      any frame before its `startFrame` (`t < 0` clamps every interpolation to
                      its rest value) — the gate here was only ever hiding that state. `note`
                      resolves to 0 on its own before `OTP_TIMELINE.noteAt`, so it needs no
                      separate gate either. */}
                  <CheckEmailSurface otpFrom={T.otp} note={note} />
                </div>
              ) : null}
            </div>
          </AuthPage>
        )}
      </Camera>
    </AbsoluteFill>
  );
};
