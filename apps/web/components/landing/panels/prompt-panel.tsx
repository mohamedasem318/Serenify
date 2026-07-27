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
 * The header is "Serenify asks" rather than the mock's "Checking in": bare "check-in" is
 * banned outright, and it would have named the wrong surface anyway — this is the
 * monitoring session, not the weekly work-environment check-in.
 */

const OPTIONS: readonly { readonly id: PromptHighlight; readonly label: string }[] = [
  { id: "yes", label: PANEL_PROMPT_OPTION_YES },
  { id: "no", label: PANEL_PROMPT_OPTION_NO },
  { id: "talk", label: PANEL_PROMPT_OPTION_TALK },
];

export function PromptPanel({ highlight }: { highlight?: PromptHighlight }) {
  return (
    <div className="flex h-full flex-col gap-2">
      <p className="text-xs font-medium tracking-wide text-amber-text">{PANEL_PROMPT_HEAD}</p>
      <p className="text-sm leading-snug text-ink">{PANEL_PROMPT_BODY}</p>

      <ul className="mt-auto flex list-none flex-col gap-1.5">
        {OPTIONS.map((option) => {
          const isHighlighted = option.id === highlight;
          return (
            <li
              key={option.id}
              data-option={option.id}
              data-highlighted={isHighlighted ? "true" : undefined}
              className={cn(
                "rounded-md border px-2.5 py-1.5 text-xs transition-colors",
                isHighlighted
                  ? "border-meadow bg-meadow/12 text-ink font-medium"
                  : "border-border bg-bg text-muted",
              )}
            >
              {option.label}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
