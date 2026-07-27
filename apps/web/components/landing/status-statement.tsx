import Link from "next/link";

import {
  RETENTION_BODY,
  RETENTION_HEADING,
  RETENTION_LINK_PRIVACY,
  RETENTION_LINK_TERMS,
  STATUS_HEADING,
  STATUS_MODALITIES,
  STATUS_NOTE,
  STATUS_SUB,
} from "@/lib/landing/copy";
import { cn } from "@/lib/utils";

/**
 * Retention and honest status (feature 013, US1 — T103; FR-003).
 *
 * THE RETENTION LINE IS A POLICY STATEMENT AND NOTHING MORE. It says readings are kept
 * for 90 days under the retention policy; it does NOT claim, promise or imply that
 * anything is deleted automatically, because nothing is — the purge job is BACKLOG #86,
 * unslotted, and explicitly not owned by this feature. "Are kept for" describes the rule
 * without asserting a mechanism that does not exist, and the difference matters: a
 * promise of automatic deletion would be the second-most tempting lie this page could
 * tell, after on-device processing.
 *
 * The status half is the honest one: three modalities researched, ONE live. The note
 * keeps "subject-disjoint" and keeps it free of numbers — §12.2 makes its number-free
 * presence a copy invariant, and a figure next to it would be exactly the model
 * performance claim FR-004 forbids.
 *
 * Both legal documents are linked for the full text, which is also what makes the short
 * statement here safe to keep short.
 */
export function StatusStatement() {
  return (
    <section className="border-t border-border bg-surface/40">
      <div className="mx-auto w-full max-w-5xl px-4 py-14 sm:px-6">
        <h2 className="font-display text-2xl font-semibold text-ink sm:text-3xl">
          {STATUS_HEADING}
        </h2>
        <p className="mt-3 max-w-prose text-base text-muted">{STATUS_SUB}</p>

        <ul className="mt-8 grid list-none gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {STATUS_MODALITIES.map((modality) => (
            <li
              key={modality.name}
              className="flex min-w-0 flex-col rounded-lg border border-border bg-bg p-5"
            >
              <div className="flex flex-wrap items-center gap-2">
                <h3 className="text-base font-semibold text-ink">{modality.name}</h3>
                <span
                  className={cn(
                    "rounded-full px-2.5 py-0.5 text-xs font-medium",
                    modality.state === "Live"
                      ? "bg-meadow/12 text-meadow-text"
                      : "bg-border/60 text-muted",
                  )}
                >
                  {modality.state}
                </span>
              </div>
              <p className="mt-2 text-sm leading-relaxed text-muted">{modality.body}</p>
            </li>
          ))}
        </ul>

        <p className="mt-8 max-w-prose text-sm leading-relaxed text-muted">{STATUS_NOTE}</p>

        <div className="mt-10 rounded-lg border border-border bg-bg p-5">
          <h3 className="text-base font-semibold text-ink">{RETENTION_HEADING}</h3>
          <p className="mt-2 max-w-prose text-sm leading-relaxed text-muted">{RETENTION_BODY}</p>
          <p className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-sm">
            <Link href="/privacy" className="text-meadow-text underline underline-offset-4">
              {RETENTION_LINK_PRIVACY}
            </Link>
            <Link href="/terms" className="text-meadow-text underline underline-offset-4">
              {RETENTION_LINK_TERMS}
            </Link>
          </p>
        </div>
      </div>
    </section>
  );
}
