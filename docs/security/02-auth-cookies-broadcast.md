# Security Slice 2 — Auth Flows + Cookies + Cross-Tab Broadcast + Open Redirect

> **Audit-only.** This document records findings; it applies no fixes. Mohamed
> reviews these with claude.ai, decides which to apply, and a follow-up Claude
> Code session lands the approved fixes on this same branch
> (`security/02-auth-cookies-broadcast`). No application or config code is
> changed by the commit that introduces this doc.

## Summary

This slice audited the application-layer auth surfaces that sit on top of the
slice-1 DB guards: every auth-completing Server Action and Route Handler
(`signIn`, `signUp`, `requestPasswordReset`, `updatePassword`, `verifySignupOtp`,
`verifyResetOtp`, `/auth/callback`, the inline `changePassword`, sign-out), the
cross-tab broadcast plumbing (`auth-broadcast.ts`, `CrossTabAuth`), every cookie
the app sets, session lifecycle (refresh / sign-out / expiry), the `?next=`
open-redirect surface, the `proxy.ts` routing gate, and the `[auth]` sections of
`supabase/config.toml`.

**Headline posture: solid, with one real open-redirect bug.** The authorization
gate is correct — `proxy.ts` verifies the JWT against the auth server
(`getUser()`, not `getSession()`) and reads `full_name` from the **database**,
not a JWT claim, so a forged claim cannot reach `/app` while onboarding is
incomplete. Sign-out invalidates server-side. The inline change-password re-auth
is correctly isolated on a throwaway anon client. The `bdf1463` cross-tab audit
table still matches reality (no drift).

**The one finding that matters** is an open redirect on `/auth/callback?next=`:
the redirect is built by **string-concatenating** `${origin}${next}`, which the
audit subagents *unanimously* (and incorrectly) judged to force same-origin.
Empirical testing disproves that — `next=@evil.com` redirects to `evil.com`
(userinfo break-out) and `next=.evil.com` to the attacker subdomain
`serenify.tech.evil.com`. It is rated **med** rather than **high** only because
exploitation is gated behind a successful PKCE code exchange in the victim's own
browser (see Finding 1). Everything else is `low` defense-in-depth / config
hardening.

**Finding counts by severity:** `critical` 0 · `high` 0 · `med` 1 · `low` 7
(8 total).

| # | Title | Severity |
|---|-------|----------|
| 1 | Open redirect via `?next=` host/userinfo break-out in `/auth/callback` (`${origin}${next}` is **not** same-origin-safe) | med |
| 2 | `sb-*` session cookies set without `Secure` (and `HttpOnly:false` — by design) | low |
| 3 | `AUTH_SIGNIN_COOKIE` set without `Secure` | low |
| 4 | `auth.email.max_frequency = "1s"` permits email flooding | low |
| 5 | `resendConfirmation` Server Action accepts an unvalidated email argument | low |
| 6 | Password floor mismatch — Supabase `min=6`/no-requirements vs app Zod `min=8`+letter+digit | low |
| 7 | `secure_password_change=false` + `/reset-password` changes password with no re-auth backstop | low |
| 8 | Raw Supabase `error.message` forwarded to the client in fallback branches | low |

---

## Findings

## Finding 1: Open redirect via `?next=` host/userinfo break-out in `/auth/callback`

- **Severity**: `med`
- **Surface**: `apps/web/app/auth/callback/route.ts:30,36,50` — `const next = searchParams.get("next") ?? "/app";` then `NextResponse.redirect(\`${origin}${next}\`)`.
- **What**: The post-exchange redirect target is built by **string concatenation** of the trusted `origin` (e.g. `https://serenify.tech`, no trailing slash) with the raw, attacker-influenceable `next` query parameter. There is **no** validation of `next` — no allowlist, no relative-path check, no scheme/`//` rejection. The only "protection" is the implicit origin prefix, and it does **not** hold. Because `origin` has no trailing slash, an attacker-supplied `next` that does not begin with `/`, `?`, or `#` extends or breaks out of the authority component:
  - `next=@evil.com` → `https://serenify.tech@evil.com` → host **`evil.com`** (the `serenify.tech` is parsed as userinfo).
  - `next=.evil.com/phish` → `https://serenify.tech.evil.com/phish` → host **`serenify.tech.evil.com`** (an attacker-controlled subdomain if they own `evil.com`; no browser userinfo warning).
- **Why it's a risk**: A classic open redirect on a *trusted auth domain* is a phishing primitive — a link that visibly originates at `serenify.tech` lands the user on the attacker's site (e.g. a fake "your session expired, re-enter your password" page) *after* a successful sign-in, maximizing credibility. **Why it is `med`, not `high`**: the redirect at line 36/50 only executes after `exchangeCodeForSession(code)` succeeds (lines 32–34 bail with `?error=expired_link` when `code` is missing; lines 60–62 bail on exchange error). The `code` is a single-use PKCE authorization code, and PKCE binds it to the `code_verifier` cookie set in the browser that *initiated* the flow. So an attacker cannot pass the gate using a code they generated (the victim's browser lacks the matching verifier), and the legitimate Supabase email link carries an app-fixed `next` the attacker cannot alter. Practical weaponization therefore requires the victim to both initiate an auth flow *and* be steered to an attacker-crafted callback URL carrying their own valid code — a strong precondition.
  - **Escalation note**: this would be a clean **`high`** open redirect if `next` ever became reachable without the PKCE valid-code precondition — e.g. if a non-PKCE `token_hash` callback variant, a magic-link path, or any unauthenticated redirect consumer is added later that reuses this concatenation pattern.
  - **Latent regression risk** (the more dangerous angle): the current near-miss safety is *accidental*. The idiomatic refactor `new URL(next, origin)` would turn this into an immediately-exploitable open redirect with no precondition — `new URL("https://evil.com", "https://serenify.tech")` resolves to `https://evil.com`. With no centralized validator, that one-line "cleanup" is a silent footgun.
- **Empyrical proof**: see [Verification approach](#verification-approach) — `node` URL-parse harness, verbatim output. All three audit subagents independently asserted "no open redirect / forces same-origin"; the harness disproves it.
- **Suggested fix** (fix pass, not this slice): introduce a single centralized validator and use it at every `next` entry point (today only the callback, but `forgot-password/actions.ts` and any future flow should route through it). Reject anything that is not a single-leading-slash relative path:

  ```ts
  // apps/web/lib/auth/safe-next.ts
  export function isSafeNextPath(next: string): boolean {
    // single leading slash, not "//", no backslashes, no scheme/userinfo.
    return /^\/(?!\/)[\w\-./~!$&'()*+,;=:@%]*$/.test(next);
  }
  ```

  ```ts
  // callback/route.ts
  const raw = searchParams.get("next") ?? "/app";
  const next = isSafeNextPath(raw) ? raw : "/app";
  ```

  Centralizing also fixes the proliferation/regression concern the audit plan
  called out: ad-hoc per-entry-point checks are a regression surface; one
  audited helper is not. (Note: `destinationBroadcastsSignIn()` in
  `auth-broadcast.ts` already prefix-matches `next` for the broadcast gate but is
  **not** a redirect-safety validator — don't conflate them.)
- **Status**: `open — audit only`

## Finding 2: `sb-*` session cookies set without `Secure` (and `HttpOnly:false` — by design)

- **Severity**: `low`
- **Surface**: cookie attributes originate from `@supabase/ssr@0.10.3` `DEFAULT_COOKIE_OPTIONS` (`node_modules/@supabase/ssr/dist/main/utils/constants.js:4-11`), forwarded verbatim by the `setAll` callbacks in `apps/web/lib/supabase/server.ts:15-19`, `apps/web/proxy.ts:41-49`, and `apps/web/app/auth/callback/route.ts:46-54`. No `cookieOptions` override is passed anywhere.
- **What**: `DEFAULT_COOKIE_OPTIONS` is `{ path:"/", sameSite:"lax", httpOnly:false, maxAge:34560000 }`. The app forwards these unchanged, so the `sb-*` access/refresh/PKCE-verifier cookies are set with **no `Secure` attribute** and **`HttpOnly:false`**. A grep of the library confirms it never sets `secure` (zero occurrences).
- **Why it's a risk** — *and why the obvious fix is wrong*:
  - **`HttpOnly:false` is by design, not a bug.** `apps/web/lib/supabase/client.ts` calls `createBrowserClient(url, key)` with **no** cookie adapter. Per `@supabase/ssr`'s `cookies.js` (lines 54, 130-142), in that configuration the browser client reads the session straight from `document.cookie` (`getAll = () => documentCookieGetAll()`). The cookie-based SSR model therefore *requires* `HttpOnly:false` so the client can hydrate the session and run client-side auth calls (e.g. `cross-tab-auth.tsx`'s `createClient().auth.signOut()`). **Setting `httpOnly:true` would break the browser client** — so the naive hardening is a footgun. The real mitigation for the XSS-token-theft exposure this creates is XSS prevention (React auto-escaping — already in force; a future CSP — slice 5), short access-token TTL (`jwt_expiry=3600`, already set), and refresh-token rotation (already on). This is an accepted architectural property of `@supabase/ssr`, documented here so a future reviewer doesn't "fix" it and break auth.
  - **`Secure` absence is the genuine (low) gap.** Over HTTPS-only production (Vercel forces `http→https` + HSTS) the cookies are never actually transmitted in clear, so live exploitability is minimal. But absence of `Secure` is still a best-practice miss, and unlike `httpOnly`, adding `secure` is **safe** (does not break the browser client).
- **Suggested fix** (fix pass): pass an explicit `cookieOptions` to all three `createServerClient` constructions adding only `secure: process.env.NODE_ENV === "production"` (leave `httpOnly:false`, `sameSite:"lax"`, `path:"/"` as the library sets them). Do **not** set `httpOnly:true`.
- **Verification caveat**: attributes were confirmed from library source + the verbatim-forwarding call sites (authoritative for what the *app* sets). The one thing not auditable from the repo: a production reverse-proxy/CDN could rewrite `Set-Cookie` to add `Secure`. Recommend a one-time live-cookie-jar check (see Verification approach) to confirm prod reality.
- **Status**: `open — audit only`

## Finding 3: `AUTH_SIGNIN_COOKIE` set without `Secure`

- **Severity**: `low`
- **Surface**: `apps/web/app/auth/callback/route.ts:77-82` (set); `apps/web/lib/auth-broadcast.ts:154` (clear).
- **What**: The `serenify-auth-signin` cross-tab bridge cookie is set with `{ path:"/", maxAge:60, httpOnly:false, sameSite:"lax" }` — no `Secure`.
- **Why it's a risk**: minimal. **The value is the non-sensitive literal `"1"`** — not session data or PII; it is purely a one-shot "a sign-in just completed, emit the broadcast" trigger (confirmed by reading the set site and `consumePendingSignIn`). `httpOnly:false` is *required* here (CrossTabAuth reads it from `document.cookie`) and is appropriate given the value carries no secret. The residual is a privacy/timing side-channel over HTTP (a network observer could see the marker appear). The set/clear attribute pair was checked and is **consistent** (`Path=/`, `SameSite=Lax` match) — there is no undeletable-cookie mismatch.
- **Suggested fix** (fix pass): add `secure: process.env.NODE_ENV === "production"` to the set options; no change to the clear string (Secure isn't part of deletion matching).
- **Status**: `open — audit only`

## Finding 4: `auth.email.max_frequency = "1s"` permits email flooding

- **Severity**: `low`
- **Surface**: `supabase/config.toml:233` (`[auth.email] max_frequency = "1s"`).
- **What**: The minimum interval between auth emails (confirmation resend, password-reset link) to one address is 1 second — effectively no per-account cooldown.
- **Why it's a risk**: an attacker who knows a victim's address can drive `requestPasswordReset` / `resendConfirmation` in a loop to flood the victim's inbox (email-bombing / harassment). It is not an account-compromise vector. It pairs with Finding 5 (the unvalidated `resendConfirmation`) to widen the abuse window. **Scope caveat**: this is the **local CLI config**; production email rate limits are governed by the Supabase Cloud dashboard + the Resend provider and are not auditable from the repo. This file is, however, the reference operators copy from.
- **Suggested fix** (fix pass): raise to `"60s"` (industry norm) or at minimum `"30s"`; confirm the Cloud dashboard matches. Full rate-limit posture is a slice-7 deep-dive; this is the in-scope config sanity item.
- **Status**: `open — audit only`

## Finding 5: `resendConfirmation` Server Action accepts an unvalidated email argument

- **Severity**: `low`
- **Surface**: `apps/web/app/(auth)/login/actions.ts:41-44`.
- **What**: `export async function resendConfirmation(email: string)` takes a bare string (not `FormData`) and passes it straight to `supabase.auth.resend({ type:"signup", email })` with **no Zod/format validation** — the only Server Action in the auth surface that skips the validation every sibling action performs. As an exported `"use server"` function it is a callable POST endpoint.
- **Why it's a risk**: an attacker scripting calls with arbitrary addresses can ask Supabase to (re)send signup-confirmation emails — an email-abuse/spam vector (amplified by Finding 4's `1s` frequency). Two mitigants keep it `low`: Next.js Server Actions verify the `Origin` header, so casual cross-site invocation is blocked (an attacker must script same-origin POSTs); and `resend({type:"signup"})` only dispatches for an address with a genuinely pending unconfirmed signup (Supabase no-ops/errors otherwise — the error is swallowed). No account-existence oracle is returned to the caller (the action returns `void`).
- **Suggested fix** (fix pass): validate before calling Supabase, mirroring the codebase pattern — e.g. `if (!signInSchema.shape.email.safeParse(email).success) return;` — and rely on the Finding 4 frequency tightening for rate control.
- **Status**: `open — audit only`

## Finding 6: Password floor mismatch — Supabase `min=6`/no-requirements vs app Zod `min=8`+letter+digit

- **Severity**: `low`
- **Surface**: `supabase/config.toml:185` (`minimum_password_length = 6`), `:188` (`password_requirements = ""`) vs `apps/web/lib/auth/schemas.ts` (`signUpSchema`/`resetPasswordSchema`/`changePasswordSchema` all enforce `min(8)` + a letter + a digit).
- **What**: The server-side (Supabase) password floor is **weaker** than the app-layer (Zod) floor. Supabase alone would accept a 6-character, letters-only password.
- **Why it's a risk**: defense-in-depth only — **not exploitable today**. Every password-setting path in the app (`signUp`, `updatePassword`, `changePassword`) runs the Zod schema server-side in the Server Action before calling Supabase, so the stricter rule is always enforced. The gap is latent: a future Server Action that calls `updateUser({password})` without re-running Zod (cf. Finding 7's `/reset-password` already calls `updateUser` directly) would silently accept a weak password, with no DB-level backstop. This is the same class as slice-1 Finding 7 ("app validates, DB doesn't").
- **Suggested fix** (fix pass): set `minimum_password_length = 8` and `password_requirements = "letters_digits"` in `config.toml` (and the Cloud dashboard) to align the server floor with the app policy.
- **Status**: `open — audit only`

## Finding 7: `secure_password_change=false` + `/reset-password` changes password with no re-auth backstop

- **Severity**: `low`
- **Surface**: `supabase/config.toml:231` (`secure_password_change = false`); `apps/web/app/(auth)/reset-password/actions.ts:30-32` (`updatePassword` → `updateUser({password})` with no current-password check). Contrast the correct pattern at `apps/web/app/(authed)/app/account/actions.ts:111-129` (inline change-password re-auths via a throwaway anon client first).
- **What**: There are two password-change paths with **asymmetric** protection. The account-page inline form (`changePassword`) verifies the current password before `updateUser` — correct. The `/reset-password` form (`updatePassword`) calls `updateUser` with **no** re-auth, relying entirely on the caller holding a recovery-scoped session. Because `proxy.ts` intentionally does **not** bounce signed-in users off `/reset-password` (it's excluded from `AUTH_PAGES`, lines 19-26), a *normally*-authenticated user can navigate there and change their password without the current-password challenge the account page enforces. With `secure_password_change=false`, Supabase applies no recent-auth requirement either.
- **Why it's a risk**: account-takeover hardening, not a remote exploit — it requires an already-authenticated session (e.g. an unlocked/borrowed device, or a session-stealing follow-on). The recovery flow itself is *correctly* re-auth-free (the email link proved ownership). The gap is that the same endpoint also serves a stale normal session. Realistic exploitability is low; recovery sessions are short-lived.
- **Suggested fix** (fix pass): set `secure_password_change = true` — in a recovery flow the user just authenticated (so `updateUser` is allowed), while a stale normal session is forced to re-authenticate, closing the bypass for both paths at the Supabase layer at no cost to the legitimate recovery UX. Re-verify the recovery flow still completes after enabling (FLAG FOR EMPIRICAL VERIFICATION — recovery-session "recently authenticated" window).
- **Status**: `open — audit only`

## Finding 8: Raw Supabase `error.message` forwarded to the client in fallback branches

- **Severity**: `low`
- **Surface**: `apps/web/app/(auth)/login/actions.ts:35`, `apps/web/app/(auth)/signup/actions.ts:52`, `apps/web/app/(auth)/reset-password/actions.ts:34` (all `return { status:"error", message: error.message }`).
- **What**: When a Supabase auth error does not match the guarded patterns (`/invalid.*credentials/i`, `/email.*not.*confirmed/i`, `/already|registered|exists/i`), the raw vendor `error.message` is returned and rendered verbatim (login renders it at `login-form.tsx:131`).
- **Why it's a risk**: error-hygiene, **not an enumeration leak today**. The two credential outcomes that *would* enable enumeration ("no such user" vs "wrong password") are both normalized by Supabase to `"Invalid login credentials"` and caught by the regex *before* the raw fallback, so they map to the same generic `{status:"invalid"}` UI ("Those details didn't match an account…"). The fallback only surfaces non-credential errors (e.g. rate-limit text like "For security purposes, you can only request this after N seconds"). The concern is fragility: the enumeration safety depends on regex-matching a third-party's error strings, which a Supabase wording change could silently break, and leaking raw internal messages is poor hygiene.
- **Suggested fix** (fix pass): return a fixed generic message (e.g. "Something went wrong — please try again.") from all three fallbacks and log the raw `error` server-side only. (The `changePassword` action already does this correctly.)
- **Status**: `open — audit only`

### Minor notes (documented, not numbered findings)

- **Sign-in `unconfirmed` branch echoes the email** (`login/actions.ts:29-31` → `{status:"unconfirmed", email}`, rendered as "Confirm your email first…"). This distinguishes a *registered-but-unconfirmed* account from other outcomes — a narrow enumeration surface. It is gated by needing **correct credentials** (Supabase returns "Email not confirmed" only when email+password validate but the address is unconfirmed; a wrong password yields "Invalid login credentials"), so its enumeration value is limited. *FLAG FOR EMPIRICAL VERIFICATION*: confirm gotrue requires a correct password to emit "Email not confirmed". Accepted as a deliberate UX trade-off (the user just typed the email themselves).
- **Signup "email already has an account"** (`signup-form.tsx:113`) is intentional account-existence disclosure — the standard, widely-accepted signup-form trade-off (the user supplied the email and needs actionable guidance). Documented for completeness; not flagged.
- **MFA/TOTP is disabled** (`config.toml` `[auth.mfa.totp]`). Not a defect for this product stage; noted for a future compliance pass.

---

## Audited and clean

Affirmative record — each surface below was examined and returned no finding.
(This section was the most-cited part of slice 1 for future readers; kept explicit.)

1. **`proxy.ts` — `full_name` source of truth is the DB, not a JWT claim** (`proxy.ts:84-88`). The onboarding gate runs `supabase.from("profiles").select("full_name")…`; identity comes from `getUser()` (lines 56-58), which **verifies the JWT against the auth server** (not the spoofable `getSession()`). A forged/manipulated cookie or claim cannot reach `/app` while `full_name` is null. No JWT-claim shortcut exists.
2. **`proxy.ts` — session refresh precedes the routing branches.** `getUser()` (which refreshes an expired-but-refreshable token and re-writes cookies via `setAll`) runs *before* the `!user && isProtected` check, so a just-expired-refreshable token is not wrongly bounced to `/login`.
3. **`proxy.ts` — `url.search=""` stripping is safe.** Every redirect clears the query string; nothing depends on a query param surviving a proxy redirect. This is *why* the `AUTH_SIGNIN_COOKIE` bridge is a cookie (survives the `/app→/onboarding` bounce) rather than a query param — design is internally consistent (`auth-broadcast.ts:36-43`).
4. **`proxy.ts` — matcher coverage.** `config.matcher` excludes only `_next/static`, `_next/image`, `favicon.ico`, and static image extensions — all non-application assets carrying no session state. `/api/*` **is** matched (gets session refresh) but is intentionally skipped by the onboarding `full_name` check (`!pathname.startsWith("/api/")`); the unauth→`/login` gate applies only to `PROTECTED_PREFIXES=['/app','/onboarding']`, so API routes self-gate (`/api/admin/invite` is slice 3). No protected page route slips through unmatched.
5. **`proxy.ts` — two-tab sign-out race.** The server-side `getUser()` re-check on every navigation is the authoritative gate; the client `broadcastSignOut()` is a proactive convenience. Even if the broadcast races or fails, a sibling tab is caught and redirected to `/login` on its next request. Layered correctly.
6. **`/reset-password` excluded from `AUTH_PAGES`** (`proxy.ts:19-26`) — correct; including it would bounce a recovery-session user to `/app` and break the password-update step.
7. **`account/actions.ts` — throwaway anon-client re-auth is truly isolated** (`:111-125`). The current-password check uses `createClient` from `@supabase/supabase-js` (not the SSR client) with `{ auth:{ autoRefreshToken:false, persistSession:false } }` and **no cookie adapter** — it writes no cookies, the in-memory session is GC'd when the action returns, and a failed *or* successful verify cannot leak into or rotate the user's real `@supabase/ssr` session. This is the model pattern (cf. Finding 7's contrast).
8. **Sign-out completeness** (`apps/web/app/(authed)/actions.ts`). Calls `supabase.auth.signOut()` (server round-trip → refresh-token revoked server-side, `sb-*` cleared via `Set-Cookie`), then `redirect("/login")`. `broadcastSignOut()` fires from the client submit handlers *before* the action runs (correct ordering — marker lands while the session is still attached). The already-issued access-token JWT remains valid until its ≤1h expiry — a fundamental JWT property, not a defect; mitigated by `jwt_expiry=3600`.
9. **`forgot-password/actions.ts` is non-enumerating** — always returns `{status:"ok"}` regardless of whether the address is registered ("If <email> is registered, we've sent a link…"); Supabase errors swallowed by design (FR-007). No account-existence oracle.
10. **CSRF posture.** All auth mutations are Next.js Server Actions (Origin-header verified by the framework by default). `/auth/callback` is a `GET` Route Handler whose only side effect is a single-use PKCE code exchange (replay → `?error=expired_link`); no CSRF-able state-change. No path bypasses or weakens the default protection.
11. **`consumePendingSignIn()` fail-safe** (`auth-broadcast.ts:141-155`). Absent cookie → `undefined` → early return; empty `name=` value → falsy → early return. Reads the *value* (not just key presence) so a lingering empty entry under happy-dom can't re-broadcast. One-shot and idempotent.
12. **`CrossTabAuth` dedupe/race** (`components/cross-tab-auth.tsx`). Keyed on `event.key === AUTH_BROADCAST_KEY`; reads `event.newValue` (the exact value at fire time); navigation is gated on the *current* pathname so a rapid signin→signout pair produces signin-nav then signout-nav (correct), with no stale navigation after a route change.
13. **`destinationBroadcastsSignIn()` recovery exclusion** (`auth-broadcast.ts:121-128`). Returns `true` only for `/app`(/`…`) and `/onboarding`(/`…`); `next=/reset-password` is excluded, so the recovery flow does not spuriously pull sibling tabs to `/app` (preserves smoke ST-9). Covered by `auth-broadcast.test.ts`.
14. **`AUTH_SIGNIN_COOKIE` value sensitivity + set/clear consistency.** Value is the literal `"1"` (non-sensitive marker). Set (`route.ts:77`) and clear (`auth-broadcast.ts:154`) agree on `Path=/`,`SameSite=Lax` — no undeletable-cookie mismatch. (Only the missing `Secure` is flagged — Finding 3.)
15. **Supabase config — sane security defaults.** `enable_confirmations=true` (matches production requirement) ✓; `enable_refresh_token_rotation=true` ✓ (replay detection on); `refresh_token_reuse_interval=10` ✓ (narrow grace window); `jwt_expiry=3600` ✓ (1h, well under the 1-week max); `additional_redirect_urls` are **exact** localhost/127.0.0.1 entries for `/auth/callback` + `/reset-password` only — **no wildcards, no external domains** ✓; `enable_anonymous_sign_ins=false` ✓; `double_confirm_changes=true` ✓.
16. **Rate-limit defaults (sanity check only; deep-dive → slice 7).** `sign_in_sign_ups=30/5min`, `token_verifications=30/5min`, `token_refresh=150/5min`, `otp_length=6`, `otp_expiry=3600` — all sane for this surface; nothing obviously unsafe. (A 6-digit OTP with a 1h expiry and 30 verifications/5min/IP yields a negligible brute-force probability.)
17. **`next` is never logged.** Grep of `apps/web` for `console.`/`logger.`/`Sentry.` returned zero matches near the callback or any `next` use — no untrusted-value logging concern.
18. **Login/signup pages do not forward `?next=` into a post-login redirect.** `login/page.tsx` reads only `params.error`; `signup/page.tsx` reads only `params.state`/`params.email` (reflected into a form value — React-escaped, no XSS). `login-form` hardcodes `router.replace("/app")`. The only app-set `next` values are `/app` (callback default) and `/reset-password` (`forgot-password/actions.ts:33`), both server-side constants.
19. **All Server Actions validate server-side.** Every auth action runs its Zod schema (`signInSchema`, `signUpSchema`, `resetPasswordSchema`, `changePasswordSchema`, `verifyOtpSchema` — `^\d{6}$`) inside the action before any Supabase call. The sole exception is `resendConfirmation` (Finding 5).

---

## Cookie inventory

| Cookie | Set by (`file:line`) | SameSite | Secure | HttpOnly | Path | Max-Age | Value sensitivity |
|---|---|---|---|---|---|---|---|
| `sb-*` (access / refresh / PKCE-verifier; may chunk) | `@supabase/ssr` defaults, forwarded by `server.ts:15`, `proxy.ts:41`, `callback/route.ts:46` | `Lax` | **absent** (Finding 2) | `false` (by design — browser client reads it) | `/` | 400d (library default) | **sensitive** (JWT + refresh token) |
| `serenify-auth-signin` | `callback/route.ts:77` (set) / `auth-broadcast.ts:154` (clear) | `Lax` | **absent** (Finding 3) | `false` (intentional — CrossTabAuth reads it) | `/` | 60s | non-sensitive marker (`"1"`) |

> `serenify-theme` is **localStorage**, not a cookie — listed only to avoid confusion; no audit needed.

---

## Session lifecycle

- **Access-token refresh** — handled by `@supabase/ssr` via `proxy.ts`'s `getUser()` on every matched request; refreshed cookies are written back through `setAll`. Not bypassed for any application route (matcher excludes only static assets — Audited-clean #4).
- **Sign-out** — server-side invalidation present (`supabase.auth.signOut()`), not a local-cookie-only clear (Audited-clean #8). Stolen-cookie residual: the already-issued JWT survives until ≤1h expiry (inherent JWT trade-off; narrow `jwt_expiry`).
- **Expiry mid-page / stale cookie** — an expired-but-refreshable token is transparently refreshed in `proxy.ts` before routing; an expired non-refreshable session yields `user=null` → clean redirect to `/login` (proxy step 2). *FLAG FOR EMPIRICAL VERIFICATION*: confirm against the running server that the proxy redirect fully precedes any RSC render (no half-render/500). Reasoned-clean from source; not reproduced live this slice.

---

## Out of scope this slice

Routed elsewhere; recorded so nothing is silently dropped.

- **`/api/admin/invite` HTTP handler** (→ slice 3). Its SQL was audited in slice 1; the handler robustness/error-shape is slice 3.
- **`full_name` input validation + stored-XSS at render** (→ slice 3 / frontend) — carried from slice-1 Finding 7. Note: the signup `?email=` reflection (`signup/page.tsx`) is React-escaped (no XSS) but the broader render-time sanitization story is slice 3.
- **Profile name-edit and other non-auth Server Actions** (→ slice 3).
- **Secrets handling** (→ slice 4). Observed in passing: `SITE_URL`/`NEXT_PUBLIC_SUPABASE_*` are read from env, no hardcoded secrets in the audited files — but the full sweep is slice 4.
- **Sentry / PostHog telemetry PII scrubbing** (→ slice 5). Also: a future **CSP** is the right place to harden the `HttpOnly:false` exposure of Finding 2.
- **Rate-limit quota deep-dive** (→ slice 7). The in-scope *sanity* check is done (Audited-clean #16, Finding 4).
- **Production Supabase Cloud dashboard config** (`site_url`, additional redirect URLs, rate limits, password policy) — **not auditable from the repo**. `config.toml` is the local CLI config; production values live in the dashboard and must be verified there separately. This is a genuine audit gap, not a clean result.

---

## Verification approach

Commands, scripts, and steps a future Claude can re-run to confirm this audit.

### Finding 1 — open-redirect proof (`node`, deterministic, no server needed)

`NextResponse.redirect(\`${origin}${next}\`)` is `new URL(\`${origin}${next}\`)` under the hood. Harness + **verbatim output** from this audit:

```js
// origin has NO trailing slash, exactly as callback/route.ts derives it
const origin = "https://serenify.tech";
for (const next of ["@evil.com","@evil.com/",".evil.com",".evil.com/phish","evil.com","-evil.com","//evil.com","/legit/path"]) {
  try { const u = new URL(`${origin}${next}`);
    console.log(next, "=> host=", u.host, u.host!=="serenify.tech"?"*** ATTACKER HOST ***":"(safe)");
  } catch(e){ console.log(next, "=> THROWS", e.constructor.name); }
}
```

```text
next="@evil.com"        => host=evil.com                  *** ATTACKER-CONTROLLED HOST ***
next="@evil.com/"       => host=evil.com                  *** ATTACKER-CONTROLLED HOST ***
next=".evil.com"        => host=serenify.tech.evil.com    *** ATTACKER-CONTROLLED HOST ***
next=".evil.com/phish"  => host=serenify.tech.evil.com    *** ATTACKER-CONTROLLED HOST ***
next="evil.com"         => host=serenify.techevil.com     *** ATTACKER-CONTROLLED HOST ***
next="-evil.com"        => host=serenify.tech-evil.com    *** ATTACKER-CONTROLLED HOST ***
next="//evil.com"       => host=serenify.tech  path=//evil.com   (same-origin)
next="https://evil.com" => host=serenify.techhttps path=//evil.com (bogus host, not evil.com)
next="javascript:..."   => THROWS TypeError
next="/legit/path"      => host=serenify.tech  (same-origin)
```

Takeaway: `//evil.com`, scheme-bearing, and `javascript:` are NOT clean off-origin redirects (the prefix neutralizes them), but `@evil.com` (userinfo) and `.evil.com` (subdomain) ARE. The concatenation is not a same-origin guarantee.

Live confirmation (after fix, or to demo the bug) — needs a valid code, so easiest via the e2e harness or a real signup link; substitute the captured `code`:

```bash
curl -sI "http://localhost:3000/auth/callback?code=<VALID_CODE>&next=@evil.com" | grep -i location
# vuln: Location: http://localhost:3000@evil.com   |   fixed: Location: http://localhost:3000/app
```

### Finding 2/3 — cookie attributes

Source-level (authoritative for what the app sets):

```bash
# library default (httpOnly:false, no secure):
sed -n '4,11p' node_modules/@supabase/ssr/dist/main/utils/constants.js
# library never sets secure:
grep -rn "secure" node_modules/@supabase/ssr/dist/main/   # expect: no matches
# browser client reads document.cookie when no adapter is passed (=> httpOnly must stay false):
grep -n "document.cookie\|documentCookieGetAll" node_modules/@supabase/ssr/dist/main/cookies.js
```

Live cookie-jar (recommended one-time; confirms prod/infra reality not in repo): `npm run dev`, sign in, DevTools → Application → Cookies → inspect `sb-*` and `serenify-auth-signin` for `Secure`/`HttpOnly`/`SameSite`/`Max-Age`.

### Config sanity (Findings 4/6/7)

```bash
grep -nE "max_frequency|minimum_password_length|password_requirements|secure_password_change|enable_confirmations|enable_refresh_token_rotation|jwt_expiry|additional_redirect_urls" supabase/config.toml
```

### Broadcast-table drift check (section c)

```bash
# every session-completing call — cross-reference against the bdf1463 table:
grep -rn "signInWithPassword\|verifyOtp\|exchangeCodeForSession\|signUp\|signInWithOtp" apps/web --include=*.ts --include=*.tsx | grep -v "\.test\.\|\.spec\."
# every broadcast emit/bridge:
grep -rn "broadcastSignIn\|broadcastSignOut\|AUTH_SIGNIN_COOKIE\|destinationBroadcastsSignIn" apps/web --include=*.ts --include=*.tsx
```

Result this slice: the `bdf1463` table matches reality (see below).

---

## `bdf1463` broadcast-audit table — re-verified: **MATCHES REALITY (no drift)**

Re-derived from source as of slice-2 start; every auth-completing path is accounted for, and no path the table references was removed/renamed.

| # | Path | Session-completing call | Broadcast mechanism | Verdict |
|---|------|------------------------|---------------------|---------|
| 1 | Form sign-in (`login/actions.ts`) | `signInWithPassword` | client `broadcastSignIn()` in `login-form.tsx` | ✓ correct |
| 2 | Email-link / invite (`/auth/callback`) | `exchangeCodeForSession` | server `AUTH_SIGNIN_COOKIE` (`route.ts:77`) → `consumePendingSignIn()` | ✓ correct |
| 3 | Signup OTP (`OtpPanel`, `successHref="/app"`) | `verifyOtp(type:"signup")` | client `broadcastSignIn()` in `otp-panel.tsx`, gated by `destinationBroadcastsSignIn("/app")=true` | ✓ correct |
| 4 | Recovery OTP (`OtpPanel`, `successHref="/reset-password"`) | `verifyOtp(type:"recovery")` | intentionally silent — gate returns `false` | ✓ correct |
| 5 | Recovery email-link (`?next=/reset-password`) | `exchangeCodeForSession` | intentionally silent — gate returns `false` | ✓ correct |
| 6 | Account re-auth (`account/actions.ts`) | `signInWithPassword` on throwaway anon client | exempt — verification, not a sign-in; no session/cookies established | ✓ correct |
| 7 | `signInWithOtp` / magic-link / passwordless | — | none exist in the repo | ✓ correct |

**Forward-looking guard still missing** (BACKLOG "Auth-broadcast audit needs a
forward-looking guard, not a one-time snapshot"): this table is again a manual
snapshot. A future PR adding an auth-completing path could regress cross-tab
propagation silently. Recommend (a future quality slice, not a security fix) a
CI grep-guard: any module referencing `signInWithPassword`/`verifyOtp`/
`exchangeCodeForSession` must also reference `broadcastSignIn`/`AUTH_SIGNIN_COOKIE`,
with an allowlist for `account/actions.ts` (re-auth, not a sign-in).
