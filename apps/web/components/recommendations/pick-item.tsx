"use client";

import type { ReactNode } from "react";

import { DURATION_OPENED_LABEL } from "@/lib/recommendations/card-strings";
import type { LibraryItem, RecommendationCategory } from "@/lib/recommendations/library";
import { cn } from "@/lib/utils";

/**
 * Feature 014 — THE shared item block (T011).
 *
 * One component renders the pick everywhere it appears: the home card
 * (`things-that-might-help-card.tsx`) and, from Phase 5, the in-session
 * `ConfirmedPickCard`. That is not a tidiness preference — it is how "same pick, same
 * words" (FR-011, plan Risk 4) holds BY CONSTRUCTION rather than by two surfaces being
 * kept in step by hand. Give both surfaces the same `LibraryItem` and they cannot disagree.
 *
 * Everything a person reads here is the library's own text, rendered VERBATIM (FR-004):
 * title, why-line, duration pill, numbered steps, foot-note. Nothing is truncated,
 * re-cased, summarised or generated. The only string this component owns is the pill's
 * "opened" swap, which lives in `card-strings.ts` with the rest of the surface copy.
 *
 * ── Hallmark (plan §UI design contract) ──────────────────────────────────────────────
 * Tokens by name only; Outfit (`font-display`) for the title, Inter everywhere else. The
 * derived surfaces are `color-mix` of locked tokens exactly as the approved mock defines
 * them — no new colour enters the system here. **No band chip**: the check-in card above
 * already stated the band once, and repeating it doubles the alarm (FR-013). No crimson.
 *
 * Prominence (`prominent`, card state 4) is the mock's FIVE small moves and nothing else:
 * amber rail, tint wash, warm tile, 17→19 px title, and — supplied by the caller, since
 * this component owns no actions — the meadow-filled primary. There is no sixth move and
 * no louder alternative.
 *
 * Actions and the outcome footer arrive as `children` so the item block stays purely about
 * the item. The home card and the confirmed card wire different controls into the same
 * geometry; the words above them never differ.
 */

// ─────────────────────────────────────────────────────────────────────────────
// Tile glyphs — one per category, decorative (aria-hidden), never a status signal
// ─────────────────────────────────────────────────────────────────────────────

const GLYPH_PROPS = {
  viewBox: "0 0 24 24",
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 2,
  strokeLinecap: "round",
  strokeLinejoin: "round",
} as const;

/**
 * The five category glyphs. Line-art in the app's existing icon language (the same
 * 24-box, 2-weight, round-cap vocabulary as the monitor and questionnaire surfaces), so
 * the tile gives the item a shape without inventing a second iconography.
 */
export function CategoryGlyph({ category }: { category: RecommendationCategory }) {
  return (
    <svg {...GLYPH_PROPS} aria-hidden className="size-[21px]">
      {category === "breathing_grounding" && (
        <>
          <circle cx="12" cy="12" r="3" />
          <circle cx="12" cy="12" r="7" strokeOpacity={0.6} />
          <circle cx="12" cy="12" r="10.5" strokeOpacity={0.3} />
        </>
      )}
      {category === "movement" && (
        <>
          <path d="M12 4.5v6" />
          <path d="m7.5 8 4.5 2.5L16.5 8" />
          <path d="M8 20l4-5 4 5" />
          <circle cx="12" cy="3" r="0.6" />
        </>
      )}
      {category === "sensory_reset" && (
        <>
          <rect x="3.5" y="3.5" width="17" height="17" rx="2.5" />
          <path d="M3.5 12h17" />
          <path d="M12 3.5v17" />
        </>
      )}
      {category === "taking_a_break" && (
        <>
          <circle cx="12" cy="12" r="9" />
          <path d="M12 7v5l3 2" />
        </>
      )}
      {category === "connection" && (
        <>
          <path d="M20 14a2 2 0 0 1-2 2H8l-4 3.5V6a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2Z" />
          <path d="M8.5 10h7" />
        </>
      )}
    </svg>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// The item block
// ─────────────────────────────────────────────────────────────────────────────

export interface PickItemProps {
  /** The reviewed library entry. Every word below is this object's, verbatim. */
  item: LibraryItem;
  /** Card state 4 — the mock's five small moves. Never a new treatment. */
  prominent?: boolean;
  /** Card state 5 — instructions visible. */
  expanded?: boolean;
  /** The pick has been opened, so the duration pill reads "opened" (mock panel 6). */
  opened?: boolean;
  /** Actions / outcome footer, supplied by the hosting surface. */
  children?: ReactNode;
  className?: string;
}

export function PickItem({
  item,
  prominent = false,
  expanded = false,
  opened = false,
  children,
  className,
}: PickItemProps) {
  return (
    <div
      data-testid="pick-item"
      data-item-id={item.id}
      data-prominent={prominent ? "true" : "false"}
      data-expanded={expanded ? "true" : "false"}
      className={cn(
        "relative overflow-hidden rounded-card border px-3.5 py-4",
        prominent
          ? "border-[var(--amber-soft-line)] bg-[color-mix(in_srgb,var(--amber-tint)_42%,var(--color-surface))] pl-[17px]"
          : "border-border bg-bg",
        className,
      )}
    >
      {/* The amber rail — move 1 of 5. Decorative; the state is announced by the copy. */}
      {prominent && (
        <span
          aria-hidden
          data-testid="pick-item-rail"
          className="absolute inset-y-0 left-0 w-[3px] bg-[var(--amber-soft-line)]"
        />
      )}

      <div className="flex items-start gap-3">
        <span
          aria-hidden
          data-testid="pick-item-tile"
          className={cn(
            "grid size-10 flex-none place-items-center rounded-[11px]",
            prominent
              ? "bg-[color-mix(in_srgb,var(--amber-tint)_70%,var(--color-surface))] text-amber-text"
              : "bg-[color-mix(in_srgb,var(--color-muted)_10%,var(--color-surface))] text-muted",
          )}
        >
          <CategoryGlyph category={item.category} />
        </span>

        <div className="min-w-0 flex-1">
          <div className="flex items-baseline gap-2">
            <h4
              data-testid="pick-item-title"
              className={cn(
                "min-w-0 flex-1 font-display font-semibold leading-tight tracking-[-0.005em] text-ink [overflow-wrap:anywhere]",
                prominent ? "text-[19px]" : "text-[17px]",
              )}
            >
              {item.title}
            </h4>
            <span
              data-testid="pick-item-duration"
              className={cn(
                "flex-none whitespace-nowrap rounded-full border bg-surface px-[9px] py-[3px] text-xs font-semibold tracking-[0.02em]",
                prominent
                  ? "border-[var(--amber-soft-line)] text-amber-text"
                  : "border-border text-muted",
              )}
            >
              {opened ? DURATION_OPENED_LABEL : item.durationLabel}
            </span>
          </div>
          <p
            data-testid="pick-item-why"
            className={cn(
              "mt-1.5 leading-relaxed",
              prominent ? "text-[14.5px] text-ink" : "text-sm text-muted",
            )}
          >
            {item.whyLine}
          </p>
        </div>
      </div>

      {expanded && (
        <>
          <ol
            data-testid="pick-item-steps"
            className={cn(
              "mt-4 list-none border-t pt-4",
              prominent ? "border-[var(--amber-soft-line)]" : "border-border",
            )}
          >
            {item.steps.map((step, index) => (
              // Steps are fixed reviewed copy in a fixed declared order — the index IS the
              // stable identity here; nothing reorders, inserts or filters them at runtime.
              <li key={index} className="mt-2.5 flex gap-[9px] first:mt-0">
                <span
                  aria-hidden
                  className="mt-px grid size-[21px] flex-none place-items-center rounded-full border border-border bg-surface font-display text-xs font-bold text-muted"
                >
                  {index + 1}
                </span>
                <span className="min-w-0 flex-1 text-[14.5px] leading-relaxed text-ink">
                  {step}
                </span>
              </li>
            ))}
          </ol>
          {item.footNote && (
            <p
              data-testid="pick-item-footnote"
              className="mt-4 text-[13.5px] italic leading-relaxed text-muted"
            >
              {item.footNote}
            </p>
          )}
        </>
      )}

      {children}
    </div>
  );
}
