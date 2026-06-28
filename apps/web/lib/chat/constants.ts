/**
 * One source for the bot name (FR-006) and the persistent companion disclaimer
 * (FR-018). "Ren" is defined once here and never duplicated as hardcoded copy across
 * unrelated component files; the disclaimer composes it so the approved wording stays
 * exact while the name has a single home.
 */
export const BOT_NAME = "Ren";

export const CHAT_DISCLAIMER = `${BOT_NAME} is an AI companion, not a substitute for professional care.`;
