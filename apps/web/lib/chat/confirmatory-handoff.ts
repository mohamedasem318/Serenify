/**
 * Feature 012 / US1 — the Ren confirmatory handoff seam.
 *
 * After a confirmatory answer of `confirmed` or `opened_chat`, the prompt opens Ren through
 * the existing chat entry with a query seam (`?handoff=confirmatory_yes|confirmatory_maybe`).
 * The handoff opens a plain new chat with a soft opener prefilled into the composer — it
 * NEVER surfaces recommendation cards (the chat is a calm place to talk, not a suggestion
 * engine). This module is pure so the seam parsing + opener copy are unit-testable.
 */

export type ConfirmatoryHandoff = "confirmatory_yes" | "confirmatory_maybe";

const HANDOFFS: readonly ConfirmatoryHandoff[] = ["confirmatory_yes", "confirmatory_maybe"];

export function isConfirmatoryHandoff(value: unknown): value is ConfirmatoryHandoff {
  return typeof value === "string" && (HANDOFFS as readonly string[]).includes(value);
}

/** A calm, second-person opener seeded into the composer (the user can edit before sending). */
export function confirmatoryHandoffOpener(handoff: ConfirmatoryHandoff): string {
  return handoff === "confirmatory_yes"
    ? "I've been feeling tense for a while and could use a moment to talk it through."
    : "I'm not totally sure how I'm feeling, but something's been weighing on me.";
}

/** Forward contract: the confirmatory handoff path renders NO recommendation cards. */
export const CONFIRMATORY_HANDOFF_SHOWS_RECOMMENDATIONS = false;
