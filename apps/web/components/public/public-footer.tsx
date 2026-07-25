import Link from "next/link";

import { Wordmark } from "@/components/brand/wordmark";
import { PUBLIC_DESTINATIONS } from "@/components/public/destinations";

/**
 * Feature 013 — the public footer (T026, FR-023).
 *
 * A single banded row above a hairline rule: wordmark left, the legal links right, the
 * copyright beneath. Four atoms and no more, because four atoms is genuinely all this
 * footer is allowed to carry — `plan.md` §10.3 fixes the copyright line verbatim and it
 * is the ONLY approved copy string in this phase, so any archetype needing a tagline, a
 * closing statement, or a newsletter form would have meant inventing copy that P6 and P7
 * own. The four-column link grid was the other option and is the most recognisable
 * generated-footer shape there is; with two links it would also have been a lie about how
 * much site there is.
 *
 * **`© 2026 Serenify` is verbatim, character for character.** No institutional
 * attribution, no "Capital University", no em-dash suffix. This resolves `plan.md` §0.6:
 * the Privacy Policy names Mohamed Asem as the individual data controller, and a footer
 * naming a university reads as an entity claim that contradicts it. The academic context
 * belongs in the team section and in the documents' StressID licensing note, both of
 * which say it properly. `tests/unit/components/public/public-shell.test.tsx` asserts the
 * string exactly, so a re-worded copyright line fails CI rather than shipping.
 *
 * Links are `min-h-11 min-w-11` (44×44) with `whitespace-nowrap`: at 320 px the row wraps
 * between the links rather than inside a label (FR-053). `min-w-11` is not decorative —
 * measured at 320 px, "Terms" rendered 41 px wide and failed the target-size floor on the
 * horizontal axis while passing it on the vertical.
 */
export function PublicFooter() {
  return (
    <footer className="mt-auto border-t border-border bg-bg">
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-4 px-4 py-8 sm:px-6 sm:py-10">
        <div className="flex flex-wrap items-center justify-between gap-x-6 gap-y-3">
          <Wordmark className="text-xl leading-none" />
          <nav aria-label="Legal">
            <ul className="flex flex-wrap items-center gap-x-6 gap-y-1">
              {PUBLIC_DESTINATIONS.map(({ href, label }) => (
                <li key={href}>
                  <Link
                    href={href}
                    className="inline-flex min-h-11 min-w-11 items-center justify-center whitespace-nowrap text-sm text-muted transition-colors hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
                  >
                    {label}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>
        </div>
        {/* Approved copy, fixed verbatim in plan.md §10.3. Do not re-word. */}
        <p className="text-sm text-muted">© 2026 Serenify</p>
      </div>
    </footer>
  );
}
