import { PANEL_RESOLVED_BODY, PANEL_RESOLVED_TITLE } from "@/lib/landing/copy";

/**
 * The `resolved` swap panel — THE BEAT THE WHOLE PAGE IS BUILT AROUND (T094).
 *
 * The false alarm is resolved AT NO COST. This is why the story shows a declined prompt
 * before it ever shows the companion: the product's argument is not that the chat is
 * good, it is that being wrong costs the person nothing, which is what makes the asking
 * safe to accept. The ordering is asserted as an invariant in T092, not left to whoever
 * edits the script next.
 *
 * No device chrome, no number, no probability (FR-052, FR-004).
 */
export function ResolvedPanel() {
  return (
    <div className="flex h-full flex-col items-start justify-center gap-2">
      <span
        aria-hidden
        className="grid size-8 place-items-center rounded-full bg-meadow/15 text-meadow"
      >
        <svg
          width="18"
          height="18"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.3"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M20 6 9 17l-5-5" />
        </svg>
      </span>
      <p className="text-sm font-medium text-ink">{PANEL_RESOLVED_TITLE}</p>
      <p className="text-xs leading-snug text-muted">{PANEL_RESOLVED_BODY}</p>
    </div>
  );
}
