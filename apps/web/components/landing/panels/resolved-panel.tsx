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
 *
 * CENTRED, AND AT THE MOCK'S SIZE (2026-07-28). P6 pinned this to the left edge at the
 * card's smallest type, which made the one beat that resolves the story read like a
 * footnote to the three around it. The mock's `.resolved` is `justify-content:center;
 * align-items:center; text-align:center` with a 44 px mark — the panel is a full stop, and
 * it is composed like one. The `max-w-[32ch]` on the body is the mock's own measure, and it
 * is what keeps the centred text from running the full width of the card at `lg`.
 */
export function ResolvedPanel() {
  return (
    <div className="flex h-full flex-col items-center justify-center gap-2 text-center">
      <span
        aria-hidden
        className="grid size-11 place-items-center rounded-full bg-meadow/15 text-meadow"
      >
        <svg
          width="22"
          height="22"
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
      <p className="font-display text-base font-semibold text-ink">{PANEL_RESOLVED_TITLE}</p>
      <p className="max-w-[32ch] text-sm leading-snug text-muted">{PANEL_RESOLVED_BODY}</p>
    </div>
  );
}
