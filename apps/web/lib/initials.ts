/**
 * Derives the two-character avatar initials per Decision K.
 *
 * Rules in priority order:
 *   1. If fullName has 2+ whitespace-separated tokens, return first
 *      letter of the first token + first letter of the last token,
 *      uppercased.
 *   2. If fullName has exactly one token, return the first two
 *      letters of that token, uppercased.
 *   3. If fullName is null/empty, fall back to the first two letters
 *      of the email's local-part, uppercased.
 *   4. If the email local-part is also empty (shouldn't happen for
 *      a real account), return "?".
 *
 * Pure function — no Intl, no Date, no env reads. Same SSR/CSR
 * output for the same inputs, matching truncate-name's contract so
 * the header avatar (Server-rendered) and the account-page profile
 * avatar (Client-rendered) cannot diverge on hydration.
 */
export function deriveInitials(
  fullName: string | null,
  email: string,
): string {
  if (fullName) {
    const tokens = fullName.trim().split(/\s+/).filter(Boolean);
    if (tokens.length >= 2) {
      const first = tokens[0]!;
      const last = tokens[tokens.length - 1]!;
      return (first[0]! + last[0]!).toUpperCase();
    }
    if (tokens.length === 1) {
      const only = tokens[0]!;
      return (only.slice(0, 2) || only[0] || "").toUpperCase();
    }
  }
  const local = email.split("@")[0] ?? "";
  return (local.slice(0, 2) || "?").toUpperCase();
}
