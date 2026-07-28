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
 * 24×24 px targets — **FR-053's one spent exception, amended 2026-07-28**, and the ONLY
 * sub-44px targets on the public surface. Six controls in one row meant the 44px floor
 * fixed the cluster at 264px wide however small the dot was drawn, because the hit area
 * sets the width; the mock composes ~66px. 24×24 satisfies WCAG 2.5.8 (AA) — a step from
 * AAA to AA on one control, not a drop below conformance — and the markers are a
 * convenience rather than a path, since the story auto-advances without them and every
 * beat is reachable by waiting. The targets sit flush, so a 24px circle centred on one
 * does not intersect its neighbour. The focus ring is the app's own (FR-055), unchanged.
 * They stay fully functional under reduced motion — that is what makes the reduced-motion
 * branch a readable story rather than a frozen one (T098).
 *
 * ── THE RESTING DOT IS `--color-muted`, NOT `--color-border` (2026-07-28) ──────────────
 *
 * A DELIBERATE DIVERGENCE FROM THE MOCK, ON ACCESSIBILITY GROUNDS. The mock's `.dots i`
 * rest on `var(--border)`, and transcribing that is what shipped a control nobody could
 * see: measured against the page, `--color-border` on `--color-bg` is **1.19:1 in light**
 * and **1.25:1 in dark**. WCAG 1.4.11 requires **3:1** for the visible part of a UI
 * component, and these are the story's ONLY control, on a public page.
 *
 * `--color-muted` is an already-registered Graphite token — nothing new — and measures
 * **5.58:1 light / 6.58:1 dark** against the same background. The mock is the authority for
 * how the page looks, not for whether its controls are perceivable.
 *
 * SHAPE FOLLOWS THE MOCK: uniform 6 px round dots that SCALE when active rather than P6's
 * mix of a 20 px pill and 6 px dots, which read as two different controls in one row.
 * The 44 px hit areas are unchanged and set the row's width — see the PR for why the
 * mock's literal 6 px gaps are not reachable while FR-053 stands.
 */
export function ChapterMarkers({
  activeChapter,
  onSelect,
}: {
  activeChapter: number;
  onSelect: (chapter: number) => void;
}) {
  return (
    <nav aria-label={CHAPTER_NAV_LABEL} className="flex items-center justify-center">
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
            className="grid size-6 place-items-center rounded-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-surface"
          >
            <span
              aria-hidden
              className={cn(
                // `transition`, not `transition-all`: transform and colour, never a
                // layout property. The mock's active dot scales rather than stretching.
                "block size-1.5 rounded-full transition duration-300",
                isActive ? "scale-[1.35] bg-meadow" : "bg-muted",
              )}
            />
            <span className="sr-only">{name}</span>
          </button>
        );
      })}
    </nav>
  );
}
