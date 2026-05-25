/**
 * Validates that a `next` redirect parameter is a safe same-origin relative
 * path.
 *
 * Background: `NextResponse.redirect(`${origin}${next}`)` is NOT
 * same-origin-safe via string concatenation alone. See
 * docs/security/02-auth-cookies-broadcast.md Finding 1 — empirical proof that
 * `next=@evil.com` (userinfo break-out) and `next=.evil.com` (subdomain
 * extension) escape the intended origin because `origin` carries no trailing
 * slash. The near-miss safety of the current concatenation is accidental; the
 * idiomatic `new URL(next, origin)` refactor would turn it into an
 * immediately-exploitable open redirect.
 *
 * This is the single, audited `next`-validator. ANY future auth-flow `next`
 * consumer (additional callback variants, future redirect-after-action
 * patterns) MUST route through this helper before constructing a redirect URL.
 * Ad-hoc per-entry-point checks are a regression surface; this one is not. See
 * the DECISIONS.md entry dated 2026-05-25 (slice 2 auth hardening).
 */
export function isSafeNextPath(next: string): boolean {
  // Require a single leading slash (NOT "//", which the lookahead rejects), no
  // backslashes, and no scheme/userinfo. Everything after the leading slash is
  // restricted to path / query / fragment characters. The leading-slash anchor
  // is what guarantees `${origin}${next}` stays same-origin; the character
  // allow-list is belt-and-braces.
  return /^\/(?!\/)[\w\-./~!$&'()*+,;=:@%?#]*$/.test(next);
}
