import type { Band } from "@/lib/api/chat-client";
import { cn } from "@/lib/utils";

/**
 * The chat rollup band as a calm chip (Graphite tokens; Principle V). at-ease uses
 * the meadow role; the two tension levels use the amber stress-signal role (amber is
 * for stress only). Crimson is never used here. This chip appears ONLY on chat /
 * recent-chat surfaces — never on a video-derived surface (FR-045/046).
 */

const BANDS: Record<Band, { label: string; text: string; dot: string }> = {
  at_ease: { label: "calm", text: "text-meadow-text", dot: "bg-meadow" },
  a_little_tense: {
    label: "uneasy",
    text: "text-amber-text",
    dot: "bg-[var(--amber-soft-line)]",
  },
  tense: { label: "tense", text: "text-amber-text", dot: "bg-amber-text" },
};

export function BandChip({ band, className }: { band: Band; className?: string }) {
  const spec = BANDS[band];
  return (
    <span
      className={cn("inline-flex items-center gap-1.5 text-[13px] font-semibold", spec.text, className)}
      data-band={band}
    >
      <span aria-hidden className={cn("h-2 w-2 shrink-0 rounded-full", spec.dot)} />
      {spec.label}
    </span>
  );
}
