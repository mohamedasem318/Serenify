import {
  PANEL_PROMPT_BODY,
  PANEL_PROMPT_HEAD,
  PANEL_PROMPT_OPTION_NO,
  PANEL_PROMPT_OPTION_TALK,
  PANEL_PROMPT_OPTION_YES,
} from "@/lib/landing/copy";
import type { PromptHighlight } from "@/lib/landing/story-script";
import { cn } from "@/lib/utils";

/**
 * The `prompt` swap panel — the monitoring session stopping to ask (T094).
 *
 * THE OPTIONS ARE NOT BUTTONS, DELIBERATELY. This is an illustration of a prompt, not a
 * working one: a real `<button>` here would be a control that announces itself to a
 * screen reader, takes focus in the tab order, and then does nothing when activated.
 * That is a worse lie than a static picture. They render as list items with the beat's
 * highlight marked via `data-highlighted`, so the only interactive elements on the whole
 * card remain the chapter markers (T108).
 *
 * The header is "Serenify asks" rather than the mock's "Checking in". That was originally
 * a rule fix — bare "check-in" was banned outright — and since 2026-08-12 (#198) it is no
 * longer one: "check-in" now means exactly this surface, the monitoring session. The
 * header stays anyway, on its own merits. The beat is Serenify interrupting mid-session
 * to put a question to the person, and naming the actor and the act says more than
 * naming the container they are both inside.
 *
 * ── THE PANEL CARRIES ITS OWN SURFACE, AND THAT IS THE POINT (2026-07-28) ──────────────
 *
 * P6 rendered this on the same neutral `bg-bg` box every other panel uses, which made the
 * one beat the whole page is built around look like the three beats around it. The mock
 * tints it: an `--amber-tint` ground, an amber hairline, and a tracked amber header — the
 * card visibly CHANGES STATE when the system stops to ask, which is the moment the page
 * exists to show. The story card's shared wrapper skips its neutral ground for this one
 * panel so the two boxes do not nest; this root then fills the same `inset-0` footprint,
 * which is the mock's `.panel.prompt` exactly.
 *
 * THE HIGHLIGHT COLOUR TRACKS THE OPTION, NOT THE BEAT. Declining is meadow and asking to
 * talk is foggy, matching both the mock and Principle V's reading of the two colours —
 * foggy is Ren's colour everywhere else on this card, so the "talk" option previewing it
 * is the same vocabulary, not a second one. The unhighlighted options dim rather than
 * disappear, so the choice on offer stays legible as a choice.
 *
 * Every colour here is an existing Graphite token (FR-057); the tints are `color-mix` over
 * those tokens at the mock's percentages and introduce no new named value.
 */

/** The mock's three leading glyphs: a pulse for yes, a check for no, a bubble for talk. */
const GLYPH: Record<PromptHighlight, React.ReactNode> = {
  yes: <path d="M3 12h4l3-9 4 18 3-9h4" />,
  no: <path d="M20 6 9 17l-5-5" />,
  talk: <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />,
};

const OPTIONS: readonly {
  readonly id: PromptHighlight;
  readonly label: string;
  /** Resting glyph colour, and the tint the option takes when it is the one chosen. */
  readonly glyph: string;
  readonly hot: string;
}[] = [
  {
    id: "yes",
    label: PANEL_PROMPT_OPTION_YES,
    glyph: "text-amber",
    hot: "border-amber bg-amber/12",
  },
  {
    id: "no",
    label: PANEL_PROMPT_OPTION_NO,
    glyph: "text-meadow",
    hot: "border-meadow bg-meadow/12",
  },
  {
    id: "talk",
    label: PANEL_PROMPT_OPTION_TALK,
    glyph: "text-foggy",
    hot: "border-foggy bg-foggy/12",
  },
];

export function PromptPanel({ highlight }: { highlight?: PromptHighlight }) {
  return (
    <div
      className="flex h-full flex-col justify-center gap-2 rounded-md border p-3 sm:p-3.5"
      style={{
        background: "color-mix(in srgb, var(--amber-tint) 68%, var(--color-surface))",
        borderColor: "color-mix(in srgb, var(--color-amber) 30%, transparent)",
      }}
    >
      <p className="flex items-center gap-1.5 text-[0.6875rem] font-semibold tracking-[0.09em] text-amber-text uppercase">
        <svg
          aria-hidden
          width="13"
          height="13"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.2"
          strokeLinecap="round"
          strokeLinejoin="round"
          className="shrink-0"
        >
          <path d="M3 12h4l3-9 4 18 3-9h4" />
        </svg>
        {PANEL_PROMPT_HEAD}
      </p>
      <p className="text-sm leading-snug text-ink">{PANEL_PROMPT_BODY}</p>

      <ul className="mt-1 flex list-none flex-col gap-1.5">
        {OPTIONS.map((option) => {
          const isHighlighted = option.id === highlight;
          const isDimmed = highlight !== undefined && !isHighlighted;
          return (
            <li
              key={option.id}
              data-option={option.id}
              data-highlighted={isHighlighted ? "true" : undefined}
              className={cn(
                // `transition`, not `transition-all`: Tailwind's default property set is
                // colour, opacity, shadow and transform — never a layout property.
                "flex items-center gap-2 rounded-md border px-2.5 py-1.5 text-xs transition duration-300",
                isHighlighted
                  ? `${option.hot} translate-x-[3px] font-medium text-ink`
                  : "border-border bg-surface text-ink",
                isDimmed && "opacity-[0.32]",
              )}
            >
              <svg
                aria-hidden
                width="13"
                height="13"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.2"
                strokeLinecap="round"
                strokeLinejoin="round"
                className={cn("shrink-0", option.glyph)}
              >
                {GLYPH[option.id]}
              </svg>
              {option.label}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
