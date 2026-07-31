import React from "react";

import { Wordmark } from "@/components/brand/wordmark";

import { EMAIL } from "../greybox/copy";
import { CARD_DISPLAY, MAILAPP, OS_FONT, OS_TABULAR, STANDIN } from "./furniture";
import { MailMark } from "./shell";

/*
 * Hallmark · component: mail-client · genre: modern-minimal · theme: film-furniture (locked)
 * states: rest · unread · selected · hover (the list row, driven by `hovered`)
 * contrast: pass — ink #dfe3e7 on pane #1b1f22 ≈ 12.4:1, body #a8aeb4 ≈ 6.1:1,
 *   label #878e94 on row #1e2226 ≈ 4.6:1
 * deviation declared: Hallmark gate 47 (re-drawn chrome) overridden — this is the film's
 *   diegetic set, not a marketing bezel. Same declaration as `furniture.ts`.
 * pre-emit critique: P5 H5 E4 S5 R4 V4
 */

/**
 * ══ THE MAIL CLIENT — A DRAWN APPLICATION, NOT A STAND-IN ═══════════════════════════
 *
 * Beat 2e. It is the film's only non-Serenify *application* that carries readable content, and
 * until this pass it was four labelled grey rectangles with the email's text laid over them. That
 * was defensible while every surface in the film was grey; beside a real `<OtpBoxes/>` and a real
 * `<Hero/>` it read as the one unfinished thing on screen.
 *
 * **It is generic, and that is decided (liberty L2b).** Not Gmail, not Outlook, not a clone of
 * anything — a three-pane mail client of the kind every desktop mail application has been since
 * about 1996. Drawing a branded one would add clutter the story does not need and a trade-dress
 * question it definitely does not need. What it must be is *specific*: a real sidebar with real
 * folders, a real list with real senders, a real reading pane. Generic in branding, never in
 * content.
 *
 * ══ THE READING PANE IS EMPTY UNTIL THE MESSAGE IS CLICKED ══════════════════════════
 *
 * **This is deferred-register item 1, and it is the reason this component exists at this size.**
 * The greybox drew the whole rendered email at `opacity: 0.16` before the click — a ghost — so
 * the click revealed something that was already on screen. The beat is "he opens the email and
 * finds the code"; a click that uncovers a thing the audience has been looking at for two seconds
 * reveals nothing, and the beat's whole payload is the reveal.
 *
 * So the pane has **two genuinely different states** rather than one state at two opacities:
 *
 *   before   the empty-selection state every mail client ships — a centred glyph and a line
 *            telling you to pick a message. Nothing of the email is present in the DOM.
 *   after    the message: header block, then the rendered body.
 *
 * The register's instruction was "do not patch the greybox — this is a requirement on the drawn
 * asset". This is the drawn asset, and this is the requirement met.
 *
 * ── THE EMPTY STATE IS DRAWN, NOT BLANK ─────────────────────────────────────────────
 *
 * A blank pane and an *empty state* are different things, and the difference is exactly the
 * difference between software and a wireframe. Real mail clients put something in the middle of
 * an unselected reading pane, and so does this: a large, low-contrast envelope and one muted
 * line. It also does a second job the beat needs — it makes the pane's boundary visible before
 * anything is in it, so the click reads as filling a *place* rather than as summoning a panel.
 *
 * ══ THE ICON IS A CONTRACT WITH BEAT 8 ══════════════════════════════════════════════
 *
 * `<MailMark/>` is imported rather than redrawn. Beat 8's toast leans on the audience recognising
 * this mark ~25 seconds later — if the toast reads as *Serenify* notifying him, that beat inverts
 * — so there is exactly one definition of it and both sites use that one. Two lookalikes would
 * drift the first time either was touched, and the drift would be invisible until the film was
 * cut together.
 *
 * It appears three times here on purpose: the tab (via `BrowserChrome`), the sidebar's app row,
 * and the sender avatar on the selected list row. Establishing it three times in six seconds is
 * what buys the recognition later.
 */

/** The three panes, in world coordinates below the browser chrome. */
export const MAIL_LAYOUT = {
  rail: { x: 0, w: 176 },
  list: { x: 176, w: 328 },
  pane: { x: 504, w: 696 },
} as const;

/** Folder rows in the sidebar. Generic, and deliberately dull — nobody reads these. */
const FOLDERS: readonly { label: string; count?: number; active?: boolean }[] = [
  { label: "Inbox", count: 3, active: true },
  { label: "Starred" },
  { label: "Sent" },
  { label: "Drafts", count: 1 },
  { label: "Archive" },
  { label: "Bin" },
];

/**
 * The list, with the Serenify message at the top and unread.
 *
 * **The other rows are real messages, not bars.** A list whose only populated row is the one the
 * story needs reads as a diagram of a mail client; a list with five plausible neighbours reads as
 * somebody's actual inbox with one new thing at the top of it. They are dull on purpose — no
 * jokes, no names the audience might try to parse, nothing that competes with the row being
 * clicked. Costing five lines of data to stop the surface reading as a mock-up is a good trade.
 */
const OTHER_ROWS: readonly { from: string; subject: string; time: string }[] = [
  { from: "Nadia Fahmy", subject: "Re: sprint notes — Thursday", time: "9:52 AM" },
  { from: "Design weekly", subject: "What shipped this week", time: "8:31 AM" },
  { from: "Ahmed Hassan", subject: "Q3 reporting pack", time: "Yesterday" },
  { from: "Payroll", subject: "Your July payslip is ready", time: "Yesterday" },
  { from: "Karim Sobhy", subject: "Lunch Thursday?", time: "Mon" },
];

const Rail: React.FC = () => (
  <div
    style={{
      position: "absolute",
      left: MAIL_LAYOUT.rail.x,
      top: 0,
      width: MAIL_LAYOUT.rail.w,
      bottom: 0,
      backgroundColor: MAILAPP.rail,
      borderRight: `1px solid ${MAILAPP.divider}`,
      padding: "16px 12px",
      boxSizing: "border-box",
    }}
  >
    <div style={{ display: "flex", alignItems: "center", gap: 9, padding: "0 4px 16px" }}>
      <MailMark size={22} />
      <span style={{ fontSize: 14, fontWeight: 600, color: STANDIN.ink, letterSpacing: 0.1 }}>
        Mail
      </span>
    </div>

    {FOLDERS.map((f) => (
      <div
        key={f.label}
        style={{
          display: "flex",
          alignItems: "center",
          height: 30,
          padding: "0 10px",
          marginBottom: 2,
          borderRadius: 7,
          // The active folder carries the app's own accent at low saturation. One accent, used
          // for one thing — see `furniture.ts` § MAILAPP.
          backgroundColor: f.active ? MAILAPP.rowSelected : "transparent",
          fontSize: 12.5,
          fontWeight: f.active ? 600 : 400,
          color: f.active ? STANDIN.ink : STANDIN.label,
        }}
      >
        <span style={{ flex: 1 }}>{f.label}</span>
        {f.count ? (
          <span
            style={{
              fontSize: 11,
              fontWeight: 600,
              color: f.active ? STANDIN.ink : STANDIN.label,
              fontFeatureSettings: OS_TABULAR,
            }}
          >
            {f.count}
          </span>
        ) : null}
      </div>
    ))}
  </div>
);

/**
 * A list row.
 *
 * `hovered` is what §2 asks for on every clickable thing in the film: real software lights up
 * under a pointer, and its absence is why a click can read as disconnected from the thing it
 * lands on. This surface is authored, so unlike the `apps/web` controls there is no shipped
 * treatment to reproduce — the treatment is one step of the same ramp the selected state uses,
 * which is what a list hover is in every mail client ever made.
 */
const Row: React.FC<{
  x: number;
  y: number;
  w: number;
  from: string;
  subject: string;
  time: string;
  unread?: boolean;
  selected?: boolean;
  hovered?: number;
  avatar?: boolean;
}> = ({ x, y, w, from, subject, time, unread, selected, hovered = 0, avatar }) => {
  const base = selected ? MAILAPP.rowSelected : MAILAPP.row;
  return (
    <div
      style={{
        position: "absolute",
        left: x,
        top: y,
        width: w,
        height: 64,
        borderRadius: 8,
        backgroundColor: base,
        // The hover lift, interpolated rather than switched, so the row lights over the
        // component's own 150ms rather than snapping between two frames.
        boxShadow: hovered > 0 ? `inset 0 0 0 999px rgba(255,255,255,${0.045 * hovered})` : undefined,
        boxSizing: "border-box",
        padding: "11px 12px",
        display: "flex",
        gap: 10,
      }}
    >
      {/* The unread rail. A dot in the gutter is how every mail client says "new", and it is
          what makes the row the audience is about to watch be clicked the obvious one. */}
      <div style={{ width: 8, paddingTop: 5, flexShrink: 0 }}>
        {unread ? (
          <div style={{ width: 7, height: 7, borderRadius: 4, backgroundColor: MAILAPP.accent }} />
        ) : null}
      </div>

      {avatar ? (
        <div style={{ paddingTop: 1, flexShrink: 0 }}>
          <MailMark size={20} />
        </div>
      ) : null}

      <div style={{ minWidth: 0, flex: 1 }}>
        <div style={{ display: "flex", alignItems: "baseline", gap: 8 }}>
          <span
            style={{
              flex: 1,
              fontSize: 13.5,
              fontWeight: unread ? 700 : 500,
              color: unread ? STANDIN.ink : STANDIN.body,
              whiteSpace: "nowrap",
              overflow: "hidden",
              textOverflow: "ellipsis",
            }}
          >
            {from}
          </span>
          <span
            style={{
              fontSize: 11,
              color: STANDIN.label,
              flexShrink: 0,
              fontFeatureSettings: OS_TABULAR,
            }}
          >
            {time}
          </span>
        </div>
        <div
          style={{
            marginTop: 3,
            fontSize: 12.5,
            fontWeight: unread ? 500 : 400,
            color: unread ? STANDIN.body : STANDIN.label,
            whiteSpace: "nowrap",
            overflow: "hidden",
            textOverflow: "ellipsis",
          }}
        >
          {subject}
        </div>
      </div>
    </div>
  );
};

/** Where the Serenify row sits. Beats point the cursor at this, so it is exported. */
export const MAIL_ROW = { x: 190, y: 96, w: 300, h: 64 } as const;
/** The reading pane's content column — what beat 2e's second landing frames. */
export const MAIL_MESSAGE = { x: 536, y: 88, w: 560, h: 470 } as const;

/**
 * The empty reading pane. **Register item 1's whole point** — before the click there is nothing
 * of the message here, not a faded copy of it.
 */
const EmptyPane: React.FC = () => (
  <div
    style={{
      position: "absolute",
      left: MAIL_LAYOUT.pane.x,
      top: 0,
      width: MAIL_LAYOUT.pane.w,
      bottom: 0,
      display: "flex",
      flexDirection: "column",
      alignItems: "center",
      justifyContent: "center",
      gap: 18,
    }}
  >
    <svg width={78} height={58} viewBox="0 0 62 46" aria-hidden>
      <rect
        x={1}
        y={1}
        width={60}
        height={44}
        rx={5}
        fill="none"
        stroke={STANDIN.line}
        strokeWidth={3}
      />
      <path d="M4 7 L31 27 L58 7" fill="none" stroke={STANDIN.line} strokeWidth={3} />
    </svg>
    <div style={{ fontSize: 14, color: STANDIN.label }}>Select a message to read</div>
  </div>
);

/**
 * The message, once it has been opened.
 *
 * Copy AND type scale come from `supabase/templates/confirmation.html` via `EMAIL` in `copy.ts` —
 * 30px headline, 16px body, 25px code at 4px tracking. The beat sheet is explicit that 2e must
 * show real email content rather than a blurred placeholder, and that pulling the shipped
 * template is free fidelity.
 *
 * The email card is drawn as a card **inside** the pane, which is what an HTML email actually
 * looks like in a mail client: a fixed-width, differently-styled document sitting in the client's
 * own chrome. Rendering it edge-to-edge would have made the mail client and the email indivisible
 * and lost the one visual cue that says "this is a message, not a page".
 *
 * ── THE CARD IS THE TEMPLATE'S OWN 520px, ROW BY ROW ─────────────────────────────────
 *
 * `confirmation.html`'s `.panel` is `max-width:520px`, and it is not one uniform inset: the
 * wordmark/headline/body block, the button, the code block and the footer each carry their own
 * top/bottom padding (30/10, 20/16, 10/0, 28/30 — see the row comments below), which is what gives
 * the real email its rhythm instead of one even gutter. That row structure is reproduced here
 * rather than collapsed into a single padding value, and the button's row is what makes it centred
 * rather than flush left.
 *
 * ── THE CARD IS DRAWN IN THE TEMPLATE'S OWN DARK VALUES, NOT THE CLIENT'S FURNITURE ──
 *
 * `confirmation.html` ships a real `@media (prefers-color-scheme: dark)` block — this is not the
 * film inventing a dark reading of a light template, it is the template's own author-specified
 * dark appearance, and it is the one an actual dark mail client renders. Its hex values are used
 * verbatim below (`EMAIL_DOC`) rather than the mail client's `STANDIN`/`MAILAPP` ramp: those exist
 * for the *client's* chrome, and `furniture.ts` is explicit that they must never leak into a
 * document the client is merely hosting. The wordmark is the one element that gets this for free —
 * `<Wordmark/>`'s `text-ink`/`text-meadow-text` already resolve to the template's own dark hex
 * under this scene's `.dark` root, so it needs no local override to match.
 */
const EMAIL_DOC = {
  /** `.panel` background, dark-mode override — `confirmation.html:15`. */
  panel: "#181B1E",
  /** `.panel` border and `.divider`, dark-mode override — `confirmation.html:15,21`. */
  border: "#23272B",
  /** `.panel`'s `border-top` and the button fill — the template's one accent, dark-mode override
   *  — `confirmation.html:15,23`. Green, never red. */
  accent: "#63B292",
  /** `.headline` / `.code` text, dark-mode override — `confirmation.html:19,22`, and the same
   *  value `<Wordmark/>`'s `text-ink` resolves to under `.dark` (`globals.css`). */
  ink: "#E2E5E8",
  /** `.body-copy` / `.muted`, dark-mode override — `confirmation.html:20`. */
  muted: "#939A9F",
  /** `.code` background, dark-mode override — the page's own bg, so the code reads as a cut-out
   *  rather than a filled box — `confirmation.html:22`. */
  codeBg: "#101214",
  /** `.button` text on the accent fill, dark-mode override — `confirmation.html:23`. */
  buttonInk: "#101214",
} as const;

const Message: React.FC = () => (
  <div
    style={{
      position: "absolute",
      left: MAIL_LAYOUT.pane.x,
      top: 0,
      width: MAIL_LAYOUT.pane.w,
      bottom: 0,
      padding: "22px 32px",
      boxSizing: "border-box",
    }}
  >
    <div style={{ fontSize: 21, fontWeight: 700, color: STANDIN.ink, lineHeight: 1.25 }}>
      {EMAIL.subject}
    </div>

    <div style={{ display: "flex", alignItems: "center", gap: 10, marginTop: 14 }}>
      <MailMark size={30} />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 13.5, fontWeight: 700, color: STANDIN.ink }}>{EMAIL.from}</div>
        <div style={{ fontSize: 12, color: STANDIN.label, marginTop: 1 }}>
          to {"youssef.kamal@example.com"}
        </div>
      </div>
      <div style={{ fontSize: 12, color: STANDIN.label, fontFeatureSettings: OS_TABULAR }}>
        {EMAIL.time}
      </div>
    </div>

    <div style={{ height: 1, backgroundColor: MAILAPP.divider, margin: "16px 0 0" }} />

    {/* The email itself — 520px, the template's own `.panel` width and its own dark colours. */}
    <div
      style={{
        marginTop: 20,
        width: 520,
        borderRadius: 12,
        backgroundColor: EMAIL_DOC.panel,
        border: `1px solid ${EMAIL_DOC.border}`,
        borderTop: `4px solid ${EMAIL_DOC.accent}`,
        boxSizing: "border-box",
        overflow: "hidden",
      }}
    >
      {/* Row 1 — the email's OWN header. This is `<Wordmark/>`, never the mail client's envelope
          mark: the message is FROM Serenify, so its document carries Serenify's mark, exactly as
          `confirmation.html:42` puts it first inside the card. `MailMark` stays where it
          legitimately belongs — the tab, the sidebar, the sender avatar above, the beat-8 toast —
          and only ever this one site, inside the email's own body, was wrong. */}
      <div style={{ padding: "30px 28px 10px" }}>
        <div style={{ fontSize: 24, lineHeight: 1, marginBottom: 28 }}>
          <Wordmark />
        </div>
        <div
          style={{
            fontFamily: CARD_DISPLAY,
            fontSize: 30,
            fontWeight: 700,
            lineHeight: 1.18,
            color: EMAIL_DOC.ink,
            marginBottom: 12,
          }}
        >
          {EMAIL.headline}
        </div>
        <div style={{ fontSize: 16, lineHeight: 1.6, color: EMAIL_DOC.muted }}>{EMAIL.body}</div>
      </div>

      {/* Row 2 — the CTA, CENTRED (`confirmation.html:48-50` wraps it in `align="center"`; the
          greybox pass left it flush left against the card's edge, which is the second defect this
          pass fixes). Sized to its own text and padding, not a fixed box, matching the template's
          inline-block button. */}
      <div style={{ padding: "20px 28px 16px", textAlign: "center" }}>
        <div
          style={{
            display: "inline-block",
            backgroundColor: EMAIL_DOC.accent,
            color: EMAIL_DOC.buttonInk,
            borderRadius: 8,
            padding: "14px 20px",
            fontSize: 15,
            fontWeight: 700,
          }}
        >
          {EMAIL.button}
        </div>
      </div>

      {/* Row 3 — the fallback code and its label. 25px at 4px tracking is the template's own, and
          it is the thing the whole beat is travelling toward — so it is the loudest thing in the
          card besides the button. `confirmation.html:53-56`. */}
      <div style={{ padding: "10px 28px 0" }}>
        <div style={{ fontSize: 13, fontWeight: 500, color: EMAIL_DOC.muted, marginBottom: 10 }}>
          {EMAIL.codeLabel}
        </div>
        <div
          style={{
            boxSizing: "border-box",
            backgroundColor: EMAIL_DOC.codeBg,
            border: `1px solid ${EMAIL_DOC.border}`,
            borderRadius: 8,
            padding: "14px 16px",
            fontSize: 25,
            fontWeight: 700,
            letterSpacing: 4,
            textAlign: "center",
            color: EMAIL_DOC.ink,
            fontFeatureSettings: OS_TABULAR,
          }}
        >
          {EMAIL.code}
        </div>
      </div>

      {/* Row 4 — the divider and the fallback disclaimer. `confirmation.html:59-62`. */}
      <div style={{ padding: "28px 28px 30px" }}>
        <div style={{ borderTop: `1px solid ${EMAIL_DOC.border}`, marginBottom: 18 }} />
        <div style={{ fontSize: 13, lineHeight: 1.6, color: EMAIL_DOC.muted }}>{EMAIL.footer}</div>
      </div>
    </div>
  </div>
);

/**
 * The whole client.
 *
 * `opened` is the click; `rowHover` is the pointer arriving on the row a few frames before it
 * (§2 — every control the cursor touches lights up before the click lands).
 */
export const MailClient: React.FC<{ opened: boolean; rowHover?: number }> = ({
  opened,
  rowHover = 0,
}) => (
  <div
    style={{
      position: "absolute",
      inset: 0,
      backgroundColor: MAILAPP.pane,
      fontFamily: OS_FONT,
      overflow: "hidden",
    }}
  >
    <Rail />

    {/* The list column. */}
    <div
      style={{
        position: "absolute",
        left: MAIL_LAYOUT.list.x,
        top: 0,
        width: MAIL_LAYOUT.list.w,
        bottom: 0,
        backgroundColor: MAILAPP.list,
        borderRight: `1px solid ${MAILAPP.divider}`,
      }}
    />
    <div
      style={{
        position: "absolute",
        left: MAIL_LAYOUT.list.x + 14,
        top: 18,
        fontSize: 15,
        fontWeight: 700,
        color: STANDIN.ink,
      }}
    >
      Inbox
    </div>
    <div
      style={{
        position: "absolute",
        left: MAIL_LAYOUT.list.x + 14,
        top: 44,
        fontSize: 11.5,
        color: STANDIN.label,
      }}
    >
      3 unread
    </div>

    <Row
      x={MAIL_ROW.x}
      y={MAIL_ROW.y}
      w={MAIL_ROW.w}
      from={EMAIL.from}
      subject={EMAIL.subject}
      time={EMAIL.time}
      unread
      selected={opened}
      hovered={rowHover}
      avatar
    />
    {OTHER_ROWS.map((r, i) => (
      <Row
        key={r.subject}
        x={MAIL_ROW.x}
        y={MAIL_ROW.y + 70 * (i + 1)}
        w={MAIL_ROW.w}
        from={r.from}
        subject={r.subject}
        time={r.time}
        unread={i === 0}
      />
    ))}

    {/* ── REGISTER ITEM 1 ── Two states, not one state at two opacities. */}
    {opened ? <Message /> : <EmptyPane />}
  </div>
);
