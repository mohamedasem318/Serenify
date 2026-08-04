import React from "react";
import { useCurrentFrame } from "../retime";

import { ChatShell } from "@/components/chat/chat-shell";
import { RenAvatar, type RenState } from "@/components/chat/ren-avatar";
import { Header } from "@/components/header/header";
import type { ChatMessage, ConversationDetail } from "@/lib/api/chat-client";

import { SANS } from "../fonts";
import { PROTAGONIST } from "../greybox/copy";
import { CHAT, REN_AVATAR, REN_AVATAR_SIZE } from "./geometry";
import { sec } from "./motion";
import { AppShell, VIEWPORT_Y } from "./shell";

/**
 * ══ REN'S CHAT, AS THE REAL SHELL ═══════════════════════════════════════════════════
 *
 * The bubbles, the composer, the send button, Ren's avatar and header, the disclaimer and every
 * radius, colour and measure are `<ChatShell/>`'s. Nothing about the conversation surface is
 * drawn any more.
 *
 * ── TWO THINGS THE REAL COMPONENT SETTLED THAT THE SHEET HAD WRONG ──────────────────
 *
 * 1. **There is no per-bubble avatar, and there should not be one.** The sheet asks for Ren's
 *    avatar "anchored to each Ren bubble", reasoning that the squared `rounded-bl-sm` corner is
 *    where it would sit. The real surface does not do that — `<RenAvatar/>` lives in the
 *    CONVERSATION HEADER (`chat-shell.tsx:385`) beside the name and "here to listen", and the
 *    bubbles carry no avatar at all.
 *
 *    That is better for the beat, not worse. The header is on screen for the entire exchange by
 *    construction, so L8's enlarged avatar is never lost after turn 1 — which is the actual
 *    requirement the sheet was trying to meet. And ownership stops depending on a visual pairing
 *    the audience has to infer: the header says "Ren" in words, and the bubbles keep the app's
 *    own left/right, bordered/filled conventions. The one thing this beat cannot afford is
 *    ambiguity about which side is Ren, and named-in-the-header beats
 *    inferred-from-a-circle.
 *
 * 2. **The composer is real, so the restructure below is possible at all.** `handoffOpener`
 *    (`chat-shell.tsx:96`) seeds the composer's value — it exists for feature 012's confirmatory
 *    handoff, where Ren is opened with a soft opener already in the box for the user to edit.
 *    The video drives it per frame to type into the real composer rather than into a drawn one.
 *
 * ── WHY IT REMOUNTS ─────────────────────────────────────────────────────────────────
 *
 * `handoffOpener` is read into `useState` once, so a changing prop does not move the composer.
 * The wrapper therefore keys the shell on the typed length, remounting it as each character
 * lands. That is cheap here — the shell holds no animation state worth preserving and every
 * message it shows comes from `initialDetail`, which is itself computed from the frame — and it
 * is the only way to type into the real component without modifying `apps/web`.
 */

const conversation = {
  id: "video",
  title: "Checking in",
  state: "open" as const,
  rollupBand: null,
  messageCount: 0,
  lastMessageAt: null,
  createdAt: "2026-07-30T11:30:00.000Z",
  updatedAt: "2026-07-30T11:30:00.000Z",
};

export const msg = (id: string, role: ChatMessage["role"], content: string): ChatMessage => ({
  id,
  role,
  content,
  createdAt: "2026-07-30T11:30:00.000Z",
});

/**
 * ── THE CARET, MEASURED — NOT THE REAL DOM ONE ───────────────────────────────────────
 *
 * `<ChatShell/>`'s textarea does carry a real caret, but two things about it defeat a
 * frame-addressed render:
 *
 *  · The blink is wall-clock time (`animation`/UA default), not frame time, so a still render
 *    cannot reproduce its phase — it is either arbitrarily on or arbitrarily off, never the
 *    thing the frame actually asks for.
 *  · The wrapper remounts the shell on every keystroke (see the note above `ChatPage`), so
 *    `composerRef.current?.focus()` re-runs on a brand-new node each time — and focusing a
 *    textarea whose value was set programmatically (not typed) lands the caret at the START of
 *    the value, not the end. That is the actual "pinned to the left" bug: it is not a render
 *    glitch, it is the real component doing exactly what `.focus()` on a fresh node does.
 *
 * So the real caret is hidden (`caret-color: transparent`, scoped to the composer by its own
 * `data-testid`) and this one is drawn in its place, at a position derived from `draft` itself
 * rather than from the DOM. Measuring the typed run's width needs the composer's REAL font —
 * Inter, `text-[15px]`, weight 400 (`chat-shell.tsx:371`) — so a canvas `measureText` is used
 * rather than a per-character guess: it is synchronous (no ref, no layout effect, no async wait),
 * so it is exactly as frame-stable as everything else in this file, and it reads the same glyph
 * metrics the render's own Chromium will actually paint, because `fonts.ts` has the same Inter
 * face loaded into the document before any frame is allowed to render.
 */
const COMPOSER_FONT = `400 15px "${SANS}"`;
/** 1px border + `px-3.5` (14px) — `chat-shell.tsx:371` — where the typed text itself begins. */
const COMPOSER_TEXT_INSET = 15;

let measureCtx: CanvasRenderingContext2D | null | undefined;

const measureTypedWidth = (text: string): number => {
  if (measureCtx === undefined) {
    measureCtx =
      typeof document === "undefined" ? null : document.createElement("canvas").getContext("2d");
  }
  // A per-character estimate, and only ever a fallback: `fonts.ts` gates the whole render on
  // Inter being loaded, so a real render never reaches this branch.
  if (!measureCtx) return text.length * 8.2;
  measureCtx.font = COMPOSER_FONT;
  return measureCtx.measureText(text).width;
};

/** The platform's own caret blink is ~530ms a half-phase; frame-driven here for determinism. */
const CARET_BLINK_HALF = sec(0.53);

const ComposerCaret: React.FC<{ text: string }> = ({ text }) => {
  const frame = useCurrentFrame();
  const on = Math.floor(frame / CARET_BLINK_HALF) % 2 === 0;
  const height = 18;
  return (
    <>
      <style>{`[data-testid="chat-composer-input"] { caret-color: transparent; }`}</style>
      {on ? (
        <div
          aria-hidden
          style={{
            position: "absolute",
            left: CHAT.textarea.x + COMPOSER_TEXT_INSET + measureTypedWidth(text),
            top: CHAT.textarea.y + (CHAT.textarea.h - height) / 2,
            width: 1,
            height,
            // `--color-ink` dark (`globals.css:148`) — the video is dark throughout.
            backgroundColor: "#E2E5E8",
          }}
        />
      ) : null}
    </>
  );
};


/**
 * ══ REN HAS A FACE, AND IT PERFORMS — L8, BUILT ═════════════════════════════════════
 *
 * **He was inert in his own beat.** `<ChatShell/>` mounts `<RenAvatar/>` with no props
 * (`chat-shell.tsx:447`), so he rendered at the shipped 34px default, in `idle`, for the whole
 * exchange: a 34px circle that blinked on a wall-clock CSS loop while a message appeared beside
 * it. He is the companion the product is built around and he had less presence than the mail
 * notification in beat 8.
 *
 * `<RenAvatar/>` ships **four real states** (`ren-avatar.tsx:52`) and they are not decorative:
 * `attentive` opens the eyes 1.22× and lifts them, `thinking` shrinks them to 0.62× and drops
 * them down-right — a squint, away from the reader — and `warm` drops the open pair entirely and
 * leaves the closed, smiling one. Those are the product's own numbers
 * (`OPEN_EYE_TRANSFORMS`, `:40-50`), measured values from the signed-off design, and this beat
 * uses them rather than inventing an expression.
 *
 * **The film uses two of the four.** `attentive` is dropped entirely (2026-07-31): the 1.22×
 * eye-scale is right at the 34px the product draws it at and reads as a stare at four times
 * that, and the film is the only place the avatar is ever seen large. `idle` goes with it —
 * beat 10's Ren is composing or he has just answered, and neither is idle. See
 * `Beat10Ren.tsx` § REN'S ARC.
 *
 * ── THE SEAM: SUPPRESS THE SHIPPED ONE, DRAW THE FRAME-ADDRESSED ONE OVER IT ────────
 *
 * `apps/web` is never modified for the video, and `<ChatShell/>` forwards no avatar prop — so the
 * shell's own copy is hidden with a scoped `visibility: hidden` (which keeps its 34px box in the
 * flex row, so "Ren" and "here to listen" do not move) and this one is drawn in the world
 * overlay at `REN_AVATAR`. Exactly the seam `calibrate.tsx` uses on the countdown numeral and
 * `otp.tsx` uses on the merge: the component keeps every path, colour and class it ships with;
 * only which instance is on screen changes.
 *
 * ── AND THE BLINK BECOMES A FUNCTION OF THE FRAME ───────────────────────────────────
 *
 * Ren's blink is a **7s infinite CSS animation** crossfading two eye groups
 * (`globals.css:310-321`) — wall-clock, not frame time, so in a render it landed wherever the
 * previous frame's capture happened to leave it. `<StillMotion/>` (`motion.tsx`) pins both pairs
 * at their resting opacities, which is the product's own reduced-motion answer and is correct as
 * a default; here the two opacities are re-authored per frame instead, so he blinks on the
 * film's clock. `[data-ren-face] .ren-eyes-*` outranks `StillMotion`'s `.ren-eyes-*` on
 * specificity, which is how a beat opts back in.
 *
 * A `warm` Ren carries neither class — he is closed permanently — so the rules below simply do
 * not apply to him, which is what the product does too.
 */
/** ~150ms closed, every ~5s. Human, and rare enough that two blinks fit the beat. */
const BLINK_PERIOD = sec(5);
const BLINK_CLOSED = 4;

const RenFace: React.FC<{ state: RenState }> = ({ state }) => {
  const frame = useCurrentFrame();
  const closed = frame % BLINK_PERIOD >= BLINK_PERIOD - BLINK_CLOSED;
  return (
    <>
      <style>{`
        [data-renshell] svg[data-ren-state] { visibility: hidden; }
        [data-ren-face] .ren-eyes-open   { opacity: ${closed ? 0 : 1} !important; }
        [data-ren-face] .ren-eyes-closed { opacity: ${closed ? 1 : 0} !important; }
      `}</style>
      <div
        data-ren-face
        style={{ position: "absolute", left: REN_AVATAR.x, top: REN_AVATAR.y, zIndex: 6 }}
      >
        <RenAvatar size={REN_AVATAR_SIZE} state={state} />
      </div>
    </>
  );
};

export const ChatPage: React.FC<{
  clock: string;
  messages: ChatMessage[];
  /** What is currently in the composer. Drives the real textarea via `handoffOpener`. */
  draft?: string;
  /**
   * L9 — the typing indicator the app does not have. The video depicts a later feature.
   *
   * It names the TURN being composed rather than taking a boolean, because the dots have to be
   * drawn in the slot the message will land in. A `null` means Ren is not composing; being
   * `thinking` is not the same thing (he is `thinking` for most of beat 10, including while the
   * human types, and dots for all of that would be a lie about the surface).
   */
  composing?: "turn1" | "turn3" | null;
  /** Ren's own expression (L8). `<ChatShell/>` forwards no such prop — see `<RenFace/>`. */
  renState?: RenState;
  /** Draws the measured caret at the end of `draft` and blinks it. Only meaningful while typing. */
  caret?: boolean;
  /** World-coordinate layer — the drawn cursor. */
  overlay?: React.ReactNode;
}> = ({
  clock,
  messages,
  draft = "",
  composing = null,
  caret = false,
  renState = "idle",
  overlay,
}) => {
  const detail: ConversationDetail = {
    conversation: { ...conversation, messageCount: messages.length },
    messages,
  };

  return (
    <AppShell
      clock={clock}
      url="serenify.tech/app/chat"
      overlay={
        <>
          <RenFace state={renState} />
          {overlay}
          {caret ? <ComposerCaret text={draft} /> : null}
        </>
      }
      header={
        <Header fullName={PROTAGONIST.fullName} email={PROTAGONIST.email} role="employee" />
      }
    >
      <div
        data-renshell
        className="mx-auto h-[460px] w-full max-w-2xl overflow-hidden rounded-2xl border border-border"
      >
        <ChatShell
          key={`draft-${draft.length}-msgs-${messages.length}`}
          variant="panel"
          initialConversations={[detail.conversation]}
          initialDetail={detail}
          handoffOpener={draft || undefined}
        />
      </div>

      {/*
       * ── L9 · THE TYPING INDICATOR ──
       *
       * The app has no typing indicator, and the sheet is explicit that this is a DECIDED
       * liberty rather than a fidelity defect: without it, Ren's `thinking` state is dead air
       * rather than a legible state. It is authored here, over the real shell, and it is
       * deliberately the only thing in this beat that is not the product's.
       *
       * **It is drawn in the slot its own message will land in**, so the dots are replaced by
       * the thing they were announcing. It used to be one hard-coded (320, 300) — which happens
       * to be turn 3's row, correct for the one window the beat then had and wrong for turn 1's.
       * Both are `CHAT` rects now.
       */}
      {composing ? <TypingIndicator slot={composing === "turn1" ? CHAT.turn1 : CHAT.turn3} /> : null}

      {/*
       * ── THE EMPTY-THREAD GREETING IS SUPPRESSED WHILE REN IS COMPOSING HIS FIRST LINE ──
       *
       * `<ChatShell/>` renders `emptyGreeting` whenever the log has no messages
       * (`chat-shell.tsx:424`) — in the panel variant, a second `<RenAvatar/>` and "Hi, I'm Ren ·
       * A calm place to think out loud." That is correct for a thread a person opened and wrong
       * for this one: **Ren speaks first here**, and a greeting sitting under a typing indicator
       * is two openings at once, with a sliced line of the greeting's body copy at the landing's
       * bottom edge.
       *
       * It is only ever on screen for the 52 frames before turn 1 lands, and only in this beat.
       * Same seam as `<RenFace/>`'s own `visibility: hidden` above — the component keeps every
       * class it ships with; the film chooses which of its states is on screen.
       */}
      {composing === "turn1" ? (
        <style>{`[data-renshell] .overflow-auto > .justify-center { display: none; }`}</style>
      ) : null}
    </AppShell>
  );
};

/**
 * Three dots on the app's own bubble geometry — `self-start`, bordered, `rounded-bl-sm`.
 *
 * ── AND THE DOTS MOVE, WHICH IS THE ENTIRE POINT OF THE LIBERTY ─────────────────────
 *
 * They used to carry a **static** stagger — `opacity: 0.35 + 0.45 · (1 − i/2)`, one fixed value
 * each — which is a photograph of a typing indicator. Held for 34 frames beside a completely
 * still frame, a typing indicator that does not animate is not a weaker version of the device: it
 * is three dots of different greys, and it reads as decoration rather than as a state.
 *
 * L9's whole justification is that Ren's `thinking` state is otherwise **dead air** — the liberty
 * exists to make a state legible AS a state, and only motion does that. So the stagger becomes a
 * travelling wave: the same three opacities, on a 0.9s loop, each dot a third of a cycle behind
 * the last. That is the universal form of this indicator, and the frame is what drives it, so it
 * is deterministic across a Studio scrub and a CLI render like everything else in `motion.tsx`.
 *
 * It stays the one authored thing in this beat. Everything else on screen is `<ChatShell/>`.
 */
const DOT_CYCLE = sec(0.9);

const TypingIndicator: React.FC<{ slot: { x: number; y: number } }> = ({ slot }) => {
  const frame = useCurrentFrame();
  return (
    <div
      // World coordinates, less the viewport offset — the containing block is `Desktop`'s
      // viewport div, which starts at `VIEWPORT_Y`. Same subtraction the pinned surfaces make.
      style={{ position: "absolute", left: slot.x, top: slot.y - VIEWPORT_Y, zIndex: 5 }}
      className="flex w-fit items-center gap-1.5 rounded-2xl rounded-bl-sm border border-border bg-surface px-3.5 py-3"
    >
      {[0, 1, 2].map((i) => {
        // Each dot is a third of a cycle behind the one before it. The triangle wave is the same
        // 0→1→0 shape the bloom's breath uses, so the two pieces of looping motion in the film
        // share an idiom.
        const phase = (((frame - (i * DOT_CYCLE) / 3) % DOT_CYCLE) + DOT_CYCLE) / DOT_CYCLE % 1;
        const tri = phase < 0.5 ? phase * 2 : (1 - phase) * 2;
        return (
          <span
            key={i}
            className="block size-1.5 rounded-full bg-muted"
            style={{
              // The same range the static stagger spanned — 0.35 to 0.8 — now travelled rather
              // than assigned, so the indicator's resting weight is unchanged.
              opacity: 0.35 + 0.45 * tri,
              scale: 0.88 + 0.12 * tri,
            }}
          />
        );
      })}
    </div>
  );
};
