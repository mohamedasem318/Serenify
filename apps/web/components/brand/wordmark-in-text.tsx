import { Fragment } from "react";

import { Wordmark } from "@/components/brand/wordmark";

/**
 * Renders a heading string with every occurrence of the product name swapped for the
 * shared `<Wordmark />` (feature 013 — 2026-07-28).
 *
 * WHY THIS EXISTS RATHER THAN A SPAN AT EACH CALL SITE. Six headings across three files
 * contain the word — one on the landing page and five in the two legal documents — and
 * hand-writing the two-tone markup at each of them is precisely the "re-typing the markup
 * at a new site" that FR-029 and Constitution Principle V call a violation. This splits the
 * copy and delegates to the ONE definition in `components/brand/wordmark.tsx`; the
 * wordmark's markup, its colours and its `lowercase` rule are still defined in exactly one
 * place, and this file contains none of them.
 *
 * IT DOES NOT WIDEN FR-029's SITE TABLE, AND FR-029 NOW SAYS SO. That table enumerates the
 * *chrome* surfaces that render the wordmark as a standing brand mark — and, load-bearingly,
 * the two that cannot consume the component and are therefore named hand-sync exceptions. A
 * heading that happens to contain the product name in a sentence is not a new hand-sync
 * exception: it consumes the shared definition, so the rule the table exists to protect —
 * one definition, reused, never re-typed — is satisfied rather than stretched.
 *
 * That reading was accepted and FR-029 was **amended on 2026-07-28** to state it, because
 * "exhaustively" read as a closed list of every place the wordmark may appear. The
 * amendment clarifies rather than allows: in-prose usage through the shared definition is
 * permitted, re-typing the markup at such a site is still a violation, and the hand-sync
 * exceptions remain exactly two.
 *
 * HEADINGS ONLY, AND DELIBERATELY NOT ANYWHERE ELSE. The two-tone treatment was considered
 * for body copy and section labels and rejected: repeated everywhere it becomes wallpaper
 * and costs the hero the effect it is there to carry. The legal documents' contents index
 * is a nav list rather than a heading and is left as plain text for the same reason.
 *
 * THE SPLIT TOKEN IS NOT USER-FACING COPY. `BRAND_WORD` is the needle this searches for,
 * and the string it renders comes from `lib/landing/copy.ts` or `lib/legal/copy.ts`
 * unchanged — so the copy modules stay the single reviewable surface and their strings stay
 * whole for the forbidden-claim walk (FR-002), which reads exports rather than rendered
 * output.
 */

/** The product name as it appears inside prose. Case-sensitive on purpose. */
export const BRAND_WORD = "Serenify";

export function WordmarkInText({ text, className }: { text: string; className?: string }) {
  const parts = text.split(BRAND_WORD);

  // No occurrence: render the string untouched rather than an array of one, so a heading
  // that never mentions the product is byte-identical to what it was before.
  if (parts.length === 1) return <>{text}</>;

  return (
    <>
      {parts.map((part, index) => (
        <Fragment key={index}>
          {part}
          {index < parts.length - 1 && <Wordmark className={className} />}
        </Fragment>
      ))}
    </>
  );
}
