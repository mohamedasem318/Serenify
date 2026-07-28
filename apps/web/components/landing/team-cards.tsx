import { TEAM_MEMBERS } from "@/lib/landing/copy";
import { type TeamKey } from "@/lib/landing/team-silhouettes";
import { cn } from "@/lib/utils";

/**
 * The four name cards, the eight external links, and the bidirectional highlighting
 * (feature 013, US4 — T122 and T123; FR-024, FR-025, FR-028, FR-055, Principle VI).
 *
 * ── THE MAPPING IS OBTAINABLE WITHOUT HOVER ──────────────────────────────────────────
 *
 * That is the whole requirement (SC-009, FR-028), and it is why each name is a real
 * `<button>` carrying `aria-pressed` rather than a `div` with a `:hover` rule. Pointer,
 * touch and keyboard all reach the same activation path, and the highlight PERSISTS
 * after activation — a hover-only mapping is a FAIL, because it is unreachable by touch
 * and by keyboard alike.
 *
 * Hover and focus additionally *preview* the highlight. Preview is transient and does
 * not touch `aria-pressed`: the pressed state reflects what the visitor chose, not what
 * their pointer is passing over. A screen-reader user tabbing through therefore hears
 * the toggle state they set, not an artefact of focus.
 *
 * ── WHY THE CARD IS NOT ITSELF THE BUTTON ────────────────────────────────────────────
 *
 * Each person has three controls: the name toggle and two profile links. A `<button>`
 * may not contain an `<a>` — nested interactive content is invalid HTML and collapses
 * unpredictably for assistive tech and keyboard users. So the CARD is the `<li>`, which
 * carries the visual highlight, and the name button and the two links are siblings
 * inside it. Every acceptance criterion still lands on a real `<button>`: `aria-pressed`,
 * Enter/Space activation, persistence, a visible focus ring, and a ≥44 px target.
 *
 * Hover and focus are handled on the `<li>` so that pointing anywhere on the card — or
 * tabbing to either link — previews that person. React's `onFocus`/`onBlur` map to
 * `focusin`/`focusout`, which bubble, so descendants are covered without extra handlers.
 */

/**
 * The two brand marks, transcribed from the mock. They are inline SVG rather than icons
 * from `lucide-react` because lucide 1.x ships no brand glyphs at all — there is no
 * `Github` or `Linkedin` export to import. Both are `aria-hidden`: the accessible name
 * lives on the anchor, and a second label here would double-read every link.
 */
function GitHubMark() {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden focusable="false" className="size-4">
      <path d="M12 2A10 10 0 0 0 8.84 21.5c.5.08.66-.23.66-.5v-1.7C6.73 19.91 6.14 18 6.14 18c-.45-1.15-1.11-1.46-1.11-1.46-.91-.62.07-.6.07-.6 1 .07 1.53 1.03 1.53 1.03.9 1.52 2.34 1.08 2.91.83.09-.65.35-1.09.63-1.34-2.22-.25-4.55-1.11-4.55-4.95 0-1.09.39-1.99 1.03-2.69-.1-.25-.45-1.27.1-2.65 0 0 .84-.27 2.75 1.03A9.5 9.5 0 0 1 12 6.8c.85 0 1.71.11 2.51.34 1.91-1.3 2.75-1.03 2.75-1.03.55 1.38.2 2.4.1 2.65.64.7 1.03 1.6 1.03 2.69 0 3.85-2.34 4.7-4.57 4.94.36.31.68.92.68 1.85v2.75c0 .27.16.59.67.5A10 10 0 0 0 12 2Z" />
    </svg>
  );
}

function LinkedInMark() {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden focusable="false" className="size-4">
      <path d="M4.98 3.5a2.5 2.5 0 1 1 0 5 2.5 2.5 0 0 1 0-5ZM3 9h4v12H3zM10 9h3.8v1.7h.05c.53-1 1.83-2.05 3.76-2.05 4.02 0 4.76 2.5 4.76 5.75V21h-4v-5.7c0-1.36-.03-3.1-1.9-3.1-1.9 0-2.2 1.48-2.2 3v5.8h-4z" />
    </svg>
  );
}

/** Shared by all eight anchors. 44 px square, so the target clears FR-055 at 320 px. */
const LINK_CHIP =
  "grid size-11 flex-none place-items-center rounded-control border border-border bg-bg " +
  "text-muted transition-colors hover:border-muted hover:text-ink " +
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring " +
  "focus-visible:ring-offset-2 focus-visible:ring-offset-surface";

type TeamCardsProps = {
  /** Highlighted person, pinned or previewed — drives the card's visual state. */
  readonly active: TeamKey | null;
  /** The persistent choice — drives `aria-pressed`, which preview must not touch. */
  readonly pinned: TeamKey | null;
  readonly onPreview: (key: TeamKey | null) => void;
  readonly onToggle: (key: TeamKey) => void;
};

export function TeamCards({ active, pinned, onPreview, onToggle }: TeamCardsProps) {
  return (
    // `minmax(0, 1fr)` via `grid-cols-*` on a min-w-0 child: the tracks must be allowed
    // to shrink below their content, or a long name would force horizontal overflow.
    // One column below 640 px keeps every name on a single line at 320/375/414.
    <ul className="grid list-none gap-3 sm:grid-cols-2 lg:grid-cols-4">
      {TEAM_MEMBERS.map((member) => {
        const key = member.key as TeamKey;
        const on = active === key;
        return (
          <li
            key={key}
            onPointerEnter={() => onPreview(key)}
            onPointerLeave={() => onPreview(null)}
            onFocus={() => onPreview(key)}
            onBlur={() => onPreview(null)}
            className={cn(
              "flex min-w-0 flex-col gap-3 rounded-card border bg-surface p-4 transition-colors",
              // One signal, two tokens deep: the border states the highlight and the
              // tint reinforces it. No transform — four cards lifting on hover is the
              // universal `hover:scale` tell, and it would jitter the row at 320 px.
              on ? "border-meadow bg-meadow/5" : "border-border",
            )}
          >
            <button
              type="button"
              aria-pressed={pinned === key}
              onClick={() => onToggle(key)}
              className={cn(
                "flex min-h-11 min-w-0 items-center rounded-control text-left font-display",
                "text-[15px] font-semibold leading-snug text-ink [overflow-wrap:anywhere]",
                "cursor-pointer focus-visible:outline-none focus-visible:ring-2",
                "focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-surface",
              )}
            >
              {member.name}
            </button>

            <div className="mt-auto flex gap-2">
              <a
                href={member.github}
                target="_blank"
                rel="noopener noreferrer"
                aria-label={member.githubLabel}
                className={LINK_CHIP}
              >
                <GitHubMark />
              </a>
              <a
                href={member.linkedin}
                target="_blank"
                rel="noopener noreferrer"
                aria-label={member.linkedinLabel}
                className={LINK_CHIP}
              >
                <LinkedInMark />
              </a>
            </div>
          </li>
        );
      })}
    </ul>
  );
}
