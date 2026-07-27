"use client";

import { CHAPTER_NAMES, CHAPTER_NAV_LABEL } from "@/lib/landing/copy";
import { cn } from "@/lib/utils";

/**
 * The story's navigation (feature 013, US1 — T096; FR-014).
 *
 * CHAPTER MARKERS ONLY — THERE IS NO PER-BEAT PROGRESS BAR. One was explicitly rejected
 * in Non-Goals: it would turn a story into a loading bar, inviting the visitor to watch
 * the bar rather than read the beats, and it implies a completion the page does not want.
 *
 * REAL `<button>` ELEMENTS, NOT `<div role="button">`. A button gives Enter, Space, focus
 * order and the disabled semantics for free; a div with a role gives the announcement and
 * none of the behaviour, and passes a shallow a11y check while failing a keyboard user.
 * Pointer and keyboard therefore both activate with no key handling written here at all.
 *
 * ≥44×44 px on touch viewports (FR-053): the visible dot is small, but the button's hit
 * area is padded out to the full target and the focus ring is the app's own (FR-055).
 * They stay fully functional under reduced motion — that is what makes the reduced-motion
 * branch a readable story rather than a frozen one (T098).
 */
export function ChapterMarkers({
  activeChapter,
  onSelect,
}: {
  activeChapter: number;
  onSelect: (chapter: number) => void;
}) {
  return (
    <nav aria-label={CHAPTER_NAV_LABEL} className="flex items-center justify-center gap-0.5">
      {CHAPTER_NAMES.map((name, chapter) => {
        const isActive = chapter === activeChapter;
        return (
          <button
            key={name}
            type="button"
            onClick={() => onSelect(chapter)}
            aria-current={isActive ? "true" : undefined}
            data-chapter={chapter}
            // The hit area is the button; the dot is only what you see.
            className="grid size-11 place-items-center rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-surface"
          >
            <span
              aria-hidden
              className={cn(
                "block h-1.5 rounded-full transition-all",
                isActive ? "w-5 bg-meadow" : "w-1.5 bg-border",
              )}
            />
            <span className="sr-only">{name}</span>
          </button>
        );
      })}
    </nav>
  );
}
