import { RenAvatar } from "@/components/chat/ren-avatar";
import { RenThread, type ThreadMessage } from "@/components/landing/ren-thread";
import { PANEL_REN_FOOTNOTE, PANEL_REN_NAME, PANEL_REN_SUBTITLE } from "@/lib/landing/copy";

/**
 * The `ren` swap panel — the companion conversation (T094, T095).
 *
 * REN IS THE APP'S FRAMED "R", REUSED AND NOT REIMPLEMENTED (2026-07-28). It was a second
 * `<Bloom>` at 28 px, which repeated the readout's own orb a few centimetres above it and
 * read as a duplicate of the reading rather than as a person speaking. The companion chat
 * has always identified Ren with a framed letter, so the landing page now shows the same
 * mark the visitor will meet inside the product.
 *
 * REUSED THE WAY THE ORB WAS. `RenAvatar` was a private function inside `chat-shell.tsx`;
 * it moved to `components/chat/ren-avatar.tsx` so both surfaces consume ONE definition,
 * rather than the landing page importing the whole chat shell — or, worse, restating a
 * 28 px circle with an "R" in it. Same reasoning FR-021 gives for the orb. Nothing under
 * `app/(authed)/` was touched.
 *
 * THE BLUE IS AN APPROVED LIBERTY (FR-022) AND MUST NOT BE "CORRECTED" to the monitor's
 * band colouring. It arrives through `color`, a prop added here exactly as T082 added
 * `Bloom`'s and for the same reason — the fill is otherwise a utility class no caller can
 * override — and its value is `var(--color-foggy)`, the REAL Graphite token that already
 * carries Ren's state on this card, not a hex ported out of the mock (FR-057). The hero
 * readout's orb still goes foggy on these beats, so the blue-orb state FR-022 protects is
 * unchanged; what changed is that Ren is no longer a second orb. Flagged for Mohamed's eye
 * in ST-4 because foggy's semantic role under Principle V is attention.
 *
 * The AI disclosure stays on the surface: Ren is named as a companion and explicitly not
 * a substitute for professional care.
 */
export function RenPanel({
  messages,
  reducedMotion,
}: {
  messages: readonly ThreadMessage[];
  /** Threaded through from the story clock — see `ren-thread.tsx` (T099). */
  reducedMotion: boolean;
}) {
  return (
    <div className="flex h-full flex-col gap-2">
      <div className="flex items-center gap-2">
        {/* 28 px is the box the Bloom occupied, so the header's height is unchanged. */}
        <RenAvatar size={28} color="var(--color-foggy)" className="text-xs" />
        <div className="leading-tight">
          <p className="text-xs font-medium text-ink">{PANEL_REN_NAME}</p>
          <p className="text-[0.6875rem] text-muted">{PANEL_REN_SUBTITLE}</p>
        </div>
      </div>

      <RenThread messages={messages} reducedMotion={reducedMotion} />

      <p className="mt-auto text-[0.6875rem] leading-snug text-muted">{PANEL_REN_FOOTNOTE}</p>
    </div>
  );
}
