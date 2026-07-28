import { Bloom } from "@/components/monitor/bloom";
import { RenThread, type ThreadMessage } from "@/components/landing/ren-thread";
import { PANEL_REN_FOOTNOTE, PANEL_REN_NAME, PANEL_REN_SUBTITLE } from "@/lib/landing/copy";

/**
 * The `ren` swap panel — the companion conversation (T094, T095).
 *
 * REN'S ORB IS FEATURE 008'S `<Bloom>`, REUSED AND NOT REIMPLEMENTED (FR-021). It is
 * passed `var(--color-foggy)` through the optional `color` prop T082 added — the REAL
 * Graphite token, not a hex ported out of the mock (FR-057). The prop exists precisely
 * because Bloom sets `--bloom` as an inline style on its own element, which no ancestor
 * can override.
 *
 * THE BLUE IS AN APPROVED LIBERTY (FR-022) AND MUST NOT BE "CORRECTED" to the monitor's
 * band colouring. On the monitoring stage the orb's colour carries the reading; here it
 * carries who is speaking. Flagged for Mohamed's eye in ST-4 because foggy's semantic
 * role under Principle V is attention.
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
        <Bloom tone="ease" color="var(--color-foggy)" className="size-7 sm:size-7" />
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
