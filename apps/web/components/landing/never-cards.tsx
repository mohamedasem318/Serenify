import {
  NEVER_CARD_CHAT_BODY,
  NEVER_CARD_CHAT_HEADING,
  NEVER_CARD_DECIDE_BODY,
  NEVER_CARD_DECIDE_HEADING,
  NEVER_CARD_VIDEO_BODY,
  NEVER_CARD_VIDEO_HEADING,
  NEVER_SECTION_HEADING,
  NEVER_SECTION_SUB,
  NEVER_TAG,
} from "@/lib/landing/copy";

/**
 * The three "Never" cards (feature 013, US1 — T101).
 *
 * The three-card grid and the "Never" tag are preserved from the mock. The SECOND card is
 * the approved §10.3 Position 2 replacement, heading and body verbatim — a STRUCTURAL
 * replacement rather than a body rewrite, because the original card's PREMISE ("Show a
 * manager your readings.") was the forbidden claim. Rewriting only its body would have
 * left the heading asserting the thing Amendment 17 bans.
 *
 * It carries NO not-yet-live marker, and that is correct rather than an oversight: the
 * chat-and-crisis guarantee is a Principle I INVARIANT, not an unbuilt control (FR-001).
 * A marker would imply it is waiting on work.
 *
 * Neither of the other two makes a blanket manager-negation or an on-device-processing
 * claim. Card 1 says frames ARE sent for inference, which is the true statement and the
 * opposite of family (a)'s most tempting lie.
 */

const CARDS = [
  { heading: NEVER_CARD_VIDEO_HEADING, body: NEVER_CARD_VIDEO_BODY },
  { heading: NEVER_CARD_CHAT_HEADING, body: NEVER_CARD_CHAT_BODY },
  { heading: NEVER_CARD_DECIDE_HEADING, body: NEVER_CARD_DECIDE_BODY },
] as const;

export function NeverCards() {
  return (
    <section className="border-t border-border bg-surface/40">
      <div className="mx-auto w-full max-w-5xl px-4 py-14 sm:px-6">
        <h2 className="font-display text-2xl font-semibold text-ink sm:text-3xl">
          {NEVER_SECTION_HEADING}
        </h2>
        <p className="mt-3 max-w-prose text-base text-muted">{NEVER_SECTION_SUB}</p>

        <ul className="mt-8 grid list-none gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {CARDS.map((card) => (
            <li
              key={card.heading}
              className="flex min-w-0 flex-col rounded-lg border border-border bg-bg p-5"
            >
              <span className="w-fit rounded-full bg-crimson/10 px-2.5 py-0.5 text-xs font-medium tracking-wide text-crimson">
                {NEVER_TAG}
              </span>
              <h3 className="mt-3 text-base font-semibold text-ink [overflow-wrap:anywhere]">
                {card.heading}
              </h3>
              <p className="mt-2 text-sm leading-relaxed text-muted">{card.body}</p>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
