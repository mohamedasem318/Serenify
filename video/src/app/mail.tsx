import React from "react";

import { EMAIL } from "../greybox/copy";
import { MAILAPP, OS_FONT, OS_TABULAR, STANDIN } from "./furniture";
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
 */
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

    {/* The email itself. A 560-wide document card — the template's own 520 plus its padding. */}
    <div
      style={{
        marginTop: 20,
        width: 560,
        borderRadius: 12,
        backgroundColor: STANDIN.surface,
        border: `1px solid ${STANDIN.border}`,
        padding: "26px 32px 24px",
        boxSizing: "border-box",
      }}
    >
      {/* The sender's own mark inside the message, as a transactional email opens. Drawn from
          the same component, so it cannot drift from the tab or the toast. */}
      <MailMark size={26} />

      <div style={{ fontSize: 28, fontWeight: 700, color: STANDIN.ink, marginTop: 18 }}>
        {EMAIL.headline}
      </div>
      <div style={{ fontSize: 15, color: STANDIN.body, lineHeight: 1.6, marginTop: 12 }}>
        {EMAIL.body}
      </div>

      <div
        style={{
          marginTop: 20,
          width: 168,
          height: 42,
          borderRadius: 8,
          backgroundColor: STANDIN.fill,
          border: `1px solid ${STANDIN.line}`,
          color: STANDIN.ink,
          fontSize: 15,
          fontWeight: 600,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        {EMAIL.button}
      </div>

      <div style={{ fontSize: 12.5, fontWeight: 500, color: STANDIN.body, marginTop: 22 }}>
        {EMAIL.codeLabel}
      </div>
      {/* The code. 25px at 4px tracking is the template's own, and it is the thing the whole
          beat is travelling toward — so it is the only element here allowed to be loud. */}
      <div
        style={{
          marginTop: 8,
          height: 50,
          borderRadius: 8,
          backgroundColor: STANDIN.field,
          border: `1px solid ${STANDIN.border}`,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontSize: 25,
          fontWeight: 700,
          letterSpacing: 4,
          color: STANDIN.ink,
          fontFeatureSettings: OS_TABULAR,
        }}
      >
        {EMAIL.code}
      </div>

      <div style={{ height: 1, backgroundColor: STANDIN.border, margin: "22px 0 14px" }} />
      <div style={{ fontSize: 12, color: STANDIN.label, lineHeight: 1.6 }}>{EMAIL.footer}</div>
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
