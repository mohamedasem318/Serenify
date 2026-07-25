import { currentRevision } from "@/lib/consent/evaluate";
import {
  LEGAL_REVIEW_NOTICE_BODY,
  LEGAL_REVIEW_NOTICE_HEADING,
  type LegalSection,
} from "@/lib/legal/copy";

/**
 * Feature 013 — the shared chrome both legal documents render inside (T024).
 *
 * Plain TSX over Graphite tokens: no MDX dependency and no typography plugin
 * (`contracts/public-surface.md` §9.3). A four-thousand-word document is a layout
 * problem, not a content problem, and the layout decisions here are the ones that make
 * it readable rather than merely present:
 *
 *  - **One column, measured.** Prose is capped at `max-w-[68ch]` with `leading-relaxed`.
 *    Line length is the single biggest lever on long-form readability, and an
 *    unconstrained column on a wide monitor is unreadable no matter how good the type is.
 *  - **The index is a left rail, and it is FIRST in the DOM.** At `lg` it becomes sticky
 *    beside the prose; below `lg` it stacks above it. Left rather than right specifically
 *    so that DOM order and visual order agree — a right rail would make a keyboard user
 *    tab into the contents *after* the whole document, or force a grid reorder that puts
 *    focus order and reading order out of step (WCAG 2.4.3).
 *  - **Every section is a real `<section>` with a real `<h2>`.** The anchors are not
 *    decorative: they are what lets a screen-reader user jump by heading and what makes
 *    `/privacy#what-a-manager-can-see` a citable link. Nothing here is a styled `<div>`.
 *  - **`scroll-mt-20`** on each section, so an anchor jump does not park the heading
 *    underneath the 64 px fixed-height navbar.
 *
 * The version identifier and publication date are READ FROM THE REGISTRY, never
 * hard-coded — `currentRevision("terms_privacy")` is the same source the consent gate
 * evaluates against, so the version a reader is shown cannot drift from the version the
 * system records them as having accepted (`contracts/public-surface.md` §9.3).
 *
 * The no-legal-review notice (FR-047) is a bordered notice at the TOP of the document,
 * above the first section and after nothing but the title. It is deliberately not a
 * footnote: a reader who stops after the first screen must still have seen it.
 */

const MONTHS = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
] as const;

/**
 * `2026-07-26` → `26 July 2026`.
 *
 * Formatted by hand rather than through `Intl`/`toLocaleDateString` on purpose: those
 * depend on the runtime's locale data, which is not guaranteed identical between the Node
 * server and the browser, and a publication date that renders differently in the two is a
 * hydration mismatch on a legal document. Falls back to the raw ISO string rather than
 * throwing — a malformed date is caught by T014's guards, not by the renderer.
 */
function formatPublicationDate(isoDate: string): string {
  const [year, month, day] = isoDate.split("-");
  const monthName = MONTHS[Number(month) - 1];
  if (!year || !day || !monthName) return isoDate;
  return `${Number(day)} ${monthName} ${year}`;
}

type LegalDocumentProps = {
  readonly title: string;
  readonly lede: string;
  readonly sections: readonly LegalSection[];
};

export function LegalDocument({ title, lede, sections }: LegalDocumentProps) {
  const revision = currentRevision("terms_privacy");

  return (
    <div className="mx-auto w-full max-w-6xl px-4 py-10 sm:px-6 sm:py-14">
      <header className="max-w-[68ch]">
        <h1 className="font-display text-3xl leading-tight tracking-tight text-ink [overflow-wrap:anywhere] sm:text-4xl">
          {title}
        </h1>
        {/* The registry is the source of both values. Neither is written by hand here. */}
        <p className="mt-3 text-sm text-muted">
          <span className="font-medium text-ink">{revision.versionId}</span>
          <span aria-hidden="true"> · </span>
          Published {formatPublicationDate(revision.publishedOn)}
        </p>
        <p className="mt-5 text-base leading-relaxed text-muted">{lede}</p>
      </header>

      {/*
       * FR-047 — unmissable, at the top, bordered, never a footnote. `role="note"` with
       * an accessible name so a screen reader announces it as a distinct aside rather
       * than letting it blur into the opening prose.
       */}
      <aside
        role="note"
        aria-labelledby="legal-review-notice"
        className="mt-8 max-w-[68ch] rounded-card border border-foggy/30 bg-foggy/10 p-5 sm:p-6"
      >
        <h2
          id="legal-review-notice"
          className="font-display text-lg leading-snug text-ink [overflow-wrap:anywhere]"
        >
          {LEGAL_REVIEW_NOTICE_HEADING}
        </h2>
        <p className="mt-2 text-sm leading-relaxed text-ink">{LEGAL_REVIEW_NOTICE_BODY}</p>
      </aside>

      <div className="mt-12 lg:grid lg:grid-cols-[15rem_minmax(0,1fr)] lg:items-start lg:gap-x-12">
        {/*
         * Index first in the DOM so keyboard order matches reading order at every width.
         * Sticky only at `lg`, where there is room beside the prose; below that it is an
         * ordinary block above the document.
         */}
        <nav
          aria-labelledby="legal-contents"
          className="mb-10 lg:sticky lg:top-20 lg:mb-0 lg:max-h-[calc(100dvh-6rem)] lg:overflow-y-auto"
        >
          <h2
            id="legal-contents"
            className="text-xs font-semibold uppercase tracking-widest text-muted"
          >
            Contents
          </h2>
          <ul className="mt-3 border-t border-border">
            {sections.map((section) => (
              <li key={section.id} className="border-b border-border">
                <a
                  href={`#${section.id}`}
                  className="flex min-h-11 items-center py-2 text-sm leading-snug text-muted transition-colors hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
                >
                  {section.heading}
                </a>
              </li>
            ))}
          </ul>
        </nav>

        <article className="max-w-[68ch]">
          {sections.map((section) => (
            <section key={section.id} id={section.id} className="scroll-mt-20 pt-10 first:pt-0">
              <h2 className="font-display text-xl leading-snug text-ink [overflow-wrap:anywhere] sm:text-2xl">
                {section.heading}
              </h2>
              {section.blocks.map((block, index) =>
                block.kind === "p" ? (
                  <p
                    key={index}
                    className="mt-4 text-base leading-relaxed text-muted [overflow-wrap:anywhere]"
                  >
                    {block.text}
                  </p>
                ) : (
                  <ul key={index} className="mt-4 space-y-3">
                    {block.items.map((item) => (
                      <li
                        key={item}
                        className="border-l-2 border-border pl-4 text-base leading-relaxed text-muted [overflow-wrap:anywhere]"
                      >
                        {item}
                      </li>
                    ))}
                  </ul>
                ),
              )}
            </section>
          ))}
        </article>
      </div>
    </div>
  );
}
