# Security Slice 3 — Privileged Endpoints + Non-Auth Server Actions + Form-Surface XSS

> **Audit-only.** This document records findings; it applies no fixes. Mohamed
> reviews these with claude.ai, decides which to apply, and a follow-up Claude
> Code session lands the approved fixes on this same branch
> (`security/03-privileged-endpoints-and-input-validation`). No application,
> migration, or config code is changed by the commit that introduces this doc.

## Summary

This slice audited the remaining application-layer surface on top of the slice-1
DB guards and slice-2 auth-flow guards:

- the **`POST /api/admin/invite` Route Handler** — method discipline, authN/authZ
  layering, body validation, error-response hygiene, CSRF posture, race behavior
  (the SQL it calls was audited in slice 1; this slice is the handler itself);
- every **non-auth Server Action** (`completeOnboarding`, `updateProfile`,
  `signOut`; `changePassword` cross-referenced from slice 2);
- the **form-surface XSS** sweep (`dangerouslySetInnerHTML`, attribute/URL
  interpolation, markdown/HTML renderers);
- **`full_name` end-to-end** — every write path's validation and every render
  path's escaping (closes slice-1 Finding 7).

**Headline posture: solid. No exploitable hole found; the residual is six `low`
defense-in-depth / hygiene / consistency items.** The privilege-relevant
controls are correct and were verified *empirically* against the running dev
server, not just read:

- `POST /api/admin/invite` is the only exported verb (GET/PUT/DELETE/PATCH →
  **405**), verifies the JWT via `getUser()` (**401** unauthenticated), gates on
  the caller's `profiles.role` in the handler (**403** for a non-admin — even
  with `role:"admin"` in the body) *and* re-checks `is_admin()` in the SECURITY
  DEFINER RPCs (slice-1 backstop). The caller-session-client RPC pattern
  (Decision 2026-05-17) is intact.
- A `full_name` of `<img src=x onerror="window.__xss=1">` is **stored verbatim**
  (no DB/trigger sanitization — as slice 1 documented) and **rendered escaped**
  (`&lt;img`) at every surface — no `<img>` element materialized, `window.__xss`
  never set, no dialog fired. React auto-escaping holds end-to-end.

**The most important adjudication is an empirical *down*-grade.** A reviewing
subagent rated the absent Origin check on the invite Route Handler `med`. An
empirical request carrying the admin's real session cookie with
`Origin: https://evil.com` returned **201** — which *looks* like a live CSRF.
But that request was issued through Playwright's `APIRequestContext`, which is
**not a browser and does not enforce `SameSite`**. A real cross-site browser
`fetch` would *not* attach the `SameSite=Lax` `sb-*` session cookie to a
cross-site POST, so the browser-level CSRF is already blocked by the same
control slice 2 relied on. The 201 proves only that the *handler performs no
Origin validation* — defense-in-depth, `low`, not a reachable exploit (Finding 1).

**Finding counts by severity:** `critical` 0 · `high` 0 · `med` 0 · `low` 6
(6 total).

| # | Title | Severity |
|---|-------|----------|
| 1 | `/api/admin/invite` performs no Origin/Referer check (Route Handler CSRF defense-in-depth; `SameSite=Lax` is the real control) | low |
| 2 | Raw Supabase/RPC `error.message` + Zod `issues` forwarded to the client in `/api/admin/invite` error branches | low |
| 3 | `/api/admin/invite` validates the body *before* authN/authZ — schema-shape leak to unauthenticated callers + pre-auth work | low |
| 4 | `completeOnboarding` forwards raw Supabase `error.message` to the client | low |
| 5 | `full_name` length cap inconsistent across write paths (account `max(60)` vs signup/onboarding `max(120)`) + no single source of truth | low |
| 6 | `full_name` accepts arbitrary character classes / control chars / RTL-override / has no hard upper cap (render-safe; integrity & UX defense-in-depth) | low |

---

## Findings

## Finding 1: `/api/admin/invite` performs no Origin/Referer check (Route Handler CSRF defense-in-depth)

- **Severity**: `low`
- **Surface**: `apps/web/app/api/admin/invite/route.ts` (whole handler — no Origin/Referer read anywhere); `apps/web/proxy.ts:91` skips the onboarding gate for `/api/*` but adds no API CSRF protection.
- **What**: Next.js **Server Actions** get an automatic same-origin check from the framework (slice 2 Audited-clean #10 relied on this for every auth mutation). **Route Handlers do not.** `POST /api/admin/invite` is the one state-mutating mutation in the app that is a Route Handler, and it performs no explicit `Origin`/`Referer` validation. The `sb-*` session cookie is `SameSite=Lax` (slice-2 cookie inventory).
- **Why it's a risk — and why it is `low`, not `med`**: A reviewing subagent rated this `med`. The empirical test (below) sent the admin's real session cookie with `Origin: https://evil.com` and got **201** — which superficially reads as a working CSRF. **It is not**, because the request was issued via Playwright's `APIRequestContext`, which is not a browser and does not apply `SameSite` rules; it attaches the stored cookie to any request regardless of origin. A genuine cross-site browser attack — `fetch("https://serenify.tech/api/admin/invite", { method:"POST", credentials:"include", … })` served from `evil.com` — would **not** send the `SameSite=Lax` `sb-*` cookie (Lax attaches cookies only on top-level GET navigations, never on a cross-site POST/`fetch`), so the handler would see no session and return **401**. The browser-level CSRF is therefore already blocked by `SameSite=Lax`, the same control slice 2 leaned on. The 201 proves only that the handler does no Origin validation of its own. Residual exposure that keeps this a (low) finding rather than nothing:
  - **Belt-and-suspenders gap**: the sole CSRF control is a cookie attribute; an explicit Origin check is the standard second layer for a privileged endpoint and is cheap.
  - **Same-site subdomain attacker**: `SameSite=Lax` does not isolate sibling subdomains. If an attacker ever controls a page on a sibling of the production registrable domain, the cookie *is* sent; an Origin allowlist would still reject it.
  - **Forward risk**: feature 011 (admin dashboard) will add a browser UI that POSTs here; adding the check now is cheaper than retrofitting once a real client exists, and avoids a future dev "relaxing" `SameSite` and silently opening this.
- **Suggested fix** (fix pass, not this slice): add an Origin allowlist at the top of the handler (before body parsing), reusing `SITE_URL`:

  ```ts
  const origin = request.headers.get("origin");
  const allowed = process.env.SITE_URL ?? "http://localhost:3000";
  if (origin !== null && origin !== allowed) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }
  ```

  (Allow a `null`/absent Origin so same-origin server-to-server and non-CORS clients are not broken; reject only a *present, mismatched* Origin. Pair with Finding 3's auth-first reordering so the Origin check sits alongside the authN gate.)
- **Status**: `open (fix pass pending — Mohamed adjudicates)`.

## Finding 2: Raw Supabase/RPC `error.message` + Zod `issues` forwarded to the client in `/api/admin/invite`

- **Severity**: `low`
- **Surface**: `apps/web/app/api/admin/invite/route.ts:33` (`issues: parsed.error.issues`), `:67-77` (`detail: message` on invite error / 409), `:99` (`detail: roleErr.message`), `:116` (`detail: mgrErr.message`).
- **What**: Several response branches forward third-party error text or Zod internals to the client:
  - **Zod issues** (`:33`) — the 400 body includes the full `ZodIssue[]`, which for the email field leaks the *entire email regex source* (verified empirically — see Verification). Combined with Finding 3 (validation runs pre-auth), an unauthenticated caller gets this.
  - **Raw RPC error** (`:99`, `:116`) — empirically, a nonexistent `manager_id` returns `500 {"…","error":"manager_update_failed","detail":"manager profile not found: 00000000-0000-0000-0000-000000000000"}`: the SECURITY DEFINER RPC's internal `RAISE` text *and* the echoed UUID reach the client.
  - **Raw GoTrue error** (`:67-77`) — empirically, two *concurrent* invites for the same email return one `201` and one `500 {"error":"invite_failed","detail":"Database error saving new user"}`. The `/already/i` 409 branch only catches the *sequential* duplicate; the concurrent race falls through to the 500 fallback and surfaces the raw GoTrue string.
- **Why it's a risk**: error-hygiene, **not remotely exploitable** — only an authenticated admin reaches the 500 paths, and the leaked strings (constraint/RPC text, "Database error saving new user") are low-value schema hints rather than secrets. But it is the exact pattern slice 2 Finding 8 fixed for the auth actions (raw `error.message` → fixed generic message + server-side log), and consistency matters: a privileged endpoint should not widen its blast radius by handing internal error text to its callers, and the regex/issues leak to *unauthenticated* callers (via Finding 3) is gratuitous.
- **Suggested fix** (fix pass): for the 500 branches, `console.error` the raw `roleErr`/`mgrErr`/`inviteErr` server-side and return `{ user_id?, error: "<code>" }` with no `detail`. For the 400 branch, drop `issues` (or reduce to the offending `path`s) and return a fixed message. Mirror slice-2 Finding 8's resolution.
- **Status**: `open (fix pass pending — Mohamed adjudicates)`.

## Finding 3: `/api/admin/invite` validates the body before authN/authZ

- **Severity**: `low`
- **Surface**: `apps/web/app/api/admin/invite/route.ts:23-36` (JSON parse + `adminInviteSchema.safeParse`) run *before* `:39-55` (`getUser()` + admin-role gate).
- **What**: The handler parses and validates the request body before it checks authentication or authorization. Verified empirically: an **unauthenticated** caller with a bad/empty body gets **400 `validation_failed`** with full Zod `issues` (including the email regex), while an unauthenticated caller with a *valid* body gets **401**.
- **Why it's a risk**: an unauthenticated attacker can fingerprint the exact request schema (field names, types, the email regex, the `role` enum values) by toggling the body and reading 400-vs-401 — free reconnaissance with zero credentials, and the endpoint does parsing/validation work for unauthenticated callers. Low in practice (the schema is also in the public source tree, and the work is a cheap in-memory parse), but "authenticate before doing work / before emitting detailed errors" is the correct posture for a privileged endpoint, and the fix also closes the Finding-2 issues leak to anonymous callers.
- **Suggested fix** (fix pass): move the `getUser()` + admin-role gate to the top; parse/validate the body only after the caller is confirmed to be an admin. Then unauthenticated → 401, non-admin → 403, and only verified admins ever see a 400 with validation detail. (Combine with Finding 1's Origin check at the same point.)
- **Status**: `open (fix pass pending — Mohamed adjudicates)`.

## Finding 4: `completeOnboarding` forwards raw Supabase `error.message` to the client

- **Severity**: `low`
- **Surface**: `apps/web/app/(onboarding)/onboarding/actions.ts:39` (`return { status: "error", message: error.message }`).
- **What**: On a DB-update failure, `completeOnboarding` returns the raw Supabase/Postgres `error.message` to the client. Its sibling `updateProfile` (`account/actions.ts:53-57`) — which writes the *same* `full_name` column — correctly returns a fixed generic string (`"We couldn't save that — try again."`). The two write paths to one column handle the error branch differently.
- **Why it's a risk**: same class as slice-2 Finding 8 and Finding 2 above — error hygiene, **not** an active leak. The write here is a plain `full_name` text update scoped to `user.id`; a DB error is unusual, and the caller is already authenticated. But a raw Postgres string (e.g. an unexpected RLS/constraint message) could surface internal names, and the inconsistency with `updateProfile` is a latent footgun.
- **Suggested fix** (fix pass): mirror `updateProfile` — `console.error(error)` server-side and return a fixed generic message. (Folds naturally into a shared error-hygiene convention with Findings 2 and slice-2 Finding 8.)
- **Status**: `open (fix pass pending — Mohamed adjudicates)`.

## Finding 5: `full_name` length cap inconsistent across write paths + no single source of truth

- **Severity**: `low`
- **Surface**: `apps/web/lib/auth/schemas.ts:19` (`signUpSchema` `max(120)`), `:71` (`onboardingSchema` `max(120)`) vs `apps/web/app/(authed)/app/account/actions.ts:10-16` (`updateProfileSchema` `max(60)`) and the duplicated client schema + `maxLength={60}` in `apps/web/components/account/profile-section.tsx:23-29,129`.
- **What**: Three independently-defined `full_name` constraints disagree on the maximum length: signup and onboarding allow **120**; the account update path allows **60**. The DB column is unbounded `text` (no `CHECK`). There is no shared `full_name` schema — the rule is written in four places.
- **Why it's a risk**: **not a security exploit** (OWASP A04 insecure-design / data-integrity). Reachable deterministically with no attacker: a user who sets a 61–120-char name at signup or onboarding (allowed) later lands on `/app/account` where the form's `max(60)` rejects their *existing* name — they cannot save any profile edit until they shorten it. Verified empirically: an 80-char `full_name` persists to `profiles` via the signup/onboarding-equivalent path; the account schema's `max(60)` would reject the same value. The deeper issue is the absent single source of truth — a future change to the rule must be made in four spots or they drift again.
- **Suggested fix** (fix pass): pick one authoritative cap (120 is the less-breaking choice given data may already be stored at that length), export a single `fullNameSchema` from `lib/auth/schemas.ts`, and consume it in `updateProfileSchema`, `profile-section.tsx` (schema + `maxLength`), and the onboarding/signup schemas. Optionally add a DB `CHECK (char_length(full_name) <= 120)` as the backstop (ties to Finding 6).
- **Status**: `open (fix pass pending — Mohamed adjudicates)`. Closes the length half of slice-1 Finding 7.

## Finding 6: `full_name` accepts arbitrary character classes / control chars / RTL-override and has no hard upper cap

- **Severity**: `low`
- **Surface**: every `full_name` write schema — `signUpSchema`/`onboardingSchema`/`updateProfileSchema` — uses only `.trim().min(1).max(N)`; no character-class restriction, control-char/null-byte rejection, RTL-override (`U+202E`) handling, or DB-level length `CHECK`. The `handle_new_user()` trigger forwards `raw_user_meta_data->>'full_name'` unsanitized (slice-1 Finding 7).
- **What**: `full_name` is stored exactly as supplied. Empirically, `<img src=x onerror="window.__xss=1">` and a `<svg onload=…>` fragment were stored verbatim, and an 80-char value persisted with no DB cap.
- **Why it's a risk**: **the dangerous answers are negative**, which is the point of recording this as the closure of slice-1 Finding 7:
  - **No XSS** — every render path is JSX text content; React auto-escapes. Verified end-to-end (banner, dropdown, account avatar) — stored markup rendered as `&lt;img…`, no element created, no script ran (see Audited-clean and Verification).
  - **No SQLi** — values are bound parameters, never interpolated into SQL (slice 1).

  The residual is **integrity / UX / DoS-adjacent**, all `low`:
  - **RTL-override / bidi control chars** can spoof how a name renders in a manager/admin list (a social-engineering / display-integrity concern), and are a UX nuisance.
  - **Control chars / null bytes** stored in a display field are an integrity smell.
  - **No hard upper cap** at the DB layer: the app schemas cap length, but a non-form writer (a future Server Action, a job, or a direct trigger path) without the Zod gate could persist an arbitrarily large string into an unbounded `text` column.
- **Suggested fix** (fix pass): tighten the shared `fullNameSchema` (Finding 5) — keep it permissive enough for real names (letters incl. diacritics, spaces, hyphens, apostrophes, periods) but strip/reject C0/C1 control chars and bidi-override codepoints, and add a DB `CHECK (char_length(full_name) <= 120)` as the layer-independent backstop. Render escaping stays the primary XSS control; this is defense-in-depth + integrity.
- **Status**: `open (fix pass pending — Mohamed adjudicates)`. Closes the character-class half of slice-1 Finding 7; the render-escape half is recorded under Audited-clean.

---

## Audited and clean

Affirmative record — each surface below was examined (and, where marked, verified
empirically against the running dev server) and returned no finding. This section
is the most-cited part of slices 1–2 for future readers; kept explicit.

1. **HTTP method discipline** — only `POST` is exported from `route.ts`; `GET`/`PUT`/`DELETE`/`PATCH` all return **405** with an empty body (Next.js auto-405 for unexported verbs). *Empirically verified.*
2. **AuthN via `getUser()`** — `route.ts:40-45` reads the session through the SSR client and verifies the JWT against the auth server with `getUser()` (not the spoofable `getSession()`); unauthenticated → clean **401 `{"error":"unauthenticated"}`**. *Empirically verified.*
3. **AuthZ — two layers** — the handler reads the caller's `profiles.role` and short-circuits with **403** before any Supabase dispatch (`route.ts:47-55`); the downstream SECURITY DEFINER RPCs re-check `is_admin()` in Postgres (slice-1 backstop). A non-admin sending `role:"admin"` is rejected at the handler with **403** — *empirically verified* (the body's role never reaches the privilege layer for a non-admin).
4. **Caller-session-client RPC pattern intact** — Decision 2026-05-17 verified still true (cross-ref slice-1 Audited-clean #14): the service-role `admin` client is used *only* for `auth.admin.inviteUserByEmail`; `admin_update_role`/`admin_update_manager` go through the caller's session client so `auth.uid()` resolves to the verified admin. A valid admin invite returns **201 `{user_id}`** including `role:"admin"` targets. *Empirically verified.*
5. **Email / role / manager_id validation** — `adminInviteSchema` enforces `z.string().email()`, `role` ∈ `{employee,team_lead,admin}` (enum), `manager_id` `z.string().uuid()` (optional). Bad email, missing email, invalid role, and a JSON non-object body all return **400**. *Empirically verified.*
6. **Zod strip mode is safe here** — `adminInviteSchema` is `z.object()` (not `.strict()`), so unknown keys are silently dropped. Empirically, a body with extra `injected:"x"` and `isAdmin:true` returned **201** with the extra keys ignored — `parsed.data` carries only the three declared fields, so no smuggled field (e.g. a forged `isAdmin`) reaches Supabase. (Behavior recorded so the silent-ignore is a known property, not a surprise; not a vulnerability.)
7. **Service-role client scope** — `lib/supabase/admin.ts` is `server-only`-guarded and used solely by the invite handler (cross-ref slice-1 Audited-clean #15); no rogue caller.
8. **`SITE_URL` redirect target** — `redirectTo: \`${siteUrl}/auth/callback\`` is built from a server-side env var, not client input — no open-redirect on the invite path (the `?next=` open-redirect surface was slice 2 / `isSafeNextPath`).
9. **`updateProfile` (account) — clean** — server-side Zod before the DB call; write scoped to `user.id` from `getUser()` (no client-supplied id); generic error message; `revalidatePath` for the header refresh. RLS is the DB backstop (slice 1).
10. **`changePassword` — cross-referenced, no new issue** — slice-2 audited the throwaway-anon-client re-auth and generic errors as model-correct; re-read this slice, nothing new.
11. **`signOut` — clean** — no user input; session-scoped SSR client (cannot sign out another user); redirects to `/login`.
12. **Authorization scoping across all non-auth actions** — every write (`completeOnboarding`, `updateProfile`) is `.eq("id", user.id)` against the verified `getUser()` identity; no action accepts a client-supplied target id; the proxy onboarding gate prevents an already-onboarded user from re-reaching the form.
13. **Single `dangerouslySetInnerHTML` is a static constant** — `app/layout.tsx:43` `__html` is a hardcoded theme-localStorage-migration IIFE string with zero runtime/user interpolation. Confirmed safe.
14. **No dangerous attribute/URL interpolation** — grep of `apps/web` found no user input flowing into `href`/`src`/`action`/`formAction`/`style`/`data-*` via template literals. The only dynamic `href={href}` (`center-nav.tsx:36`, `mobile-menu.tsx:52`) come from a compile-time `DESTINATIONS` constant; `data-variant`/`data-met` are literal/boolean. No URL path is built from user input.
15. **No markdown/HTML renderer** — `marked`/`react-markdown`/`markdown-to-jsx`/`DOMParser`/`innerHTML` absent from `apps/web` and `package.json`. No JSON-LD/structured-data `<script>` blob carries user input.
16. **`full_name` renders are all escaped** — `WelcomeBanner` `<h1>{heading}</h1>`, `ProfileDropdown` `{displayName}` + avatar `{initials}`, `ProfileSection` avatar `{initials}`, onboarding/account form messages — all JSX **text content**, React-escaped. *Empirically verified*: a stored `<img src=x onerror=…>` rendered as `&lt;img`, produced zero `<img>` elements, never set `window.__xss`, and fired no dialog.
17. **`/api/admin/invite` carries no `full_name`** — `adminInviteSchema` has only `email`/`role`/`manager_id`; invited users get `full_name = NULL` and are routed to `/onboarding` on first login. No `full_name` write surface is introduced by the invite path.
18. **Form-message reflection is safe** — `submitState.message` / `errors.*.message` rendered in `profile-section.tsx` and `onboarding-form.tsx` are hardcoded server-action strings or static Zod messages, never the user's raw input echoed back.

---

## Out of scope this slice

Routed elsewhere; recorded so nothing is silently dropped.

- **Invite partial-success / idempotency** (noted slice-1 Out-of-scope): the 3-step invite is non-transactional; a step-3/4 failure leaves the invited user at `role='employee'` with manual recovery and no idempotency key. The 500 body returns the invited `user_id` (UUID, to the issuing admin only). Cross-referenced here (the *error-shape* of those 500s is Finding 2); the partial-success *semantics* remain a handler-design item, not a slice-3 security finding.
- **Invite audit log** (feature-level, not a security finding) — the handler records nothing about *who invited whom*. Flagged for visibility; the caller and invitee user-ids are both in hand at success. → BACKLOG candidate for feature 011 (admin dashboard).
- **Per-admin rate limiting on `/api/admin/invite`** — the handler adds none and relies on Supabase `auth.admin.*` limits. Sanity-checked only; the quota deep-dive is **slice 7**.
- **`role`-string drift** (slice-1 Audited-clean #18) — `route.ts:53`'s `callerProfile?.role !== "admin"` string and the `is_admin()` enum literal must stay in sync if the enum is ever renamed. Non-authoritative (DB `is_admin()` is the real gate). Noted, not a finding.
- **Secrets handling** → slice 4. (Observed in passing: `SITE_URL`/`NEXT_PUBLIC_SUPABASE_*`/`SUPABASE_SERVICE_ROLE_KEY` read from env; no hardcoded secret in the audited files — full sweep is slice 4.)
- **Sentry / PostHog telemetry PII scrubbing** → slice 5. **Content Security Policy header** → slice 5 (the right place to harden the `httpOnly:false` cookie exposure from slice-2 Finding 2 and to add a second layer under the React-escaping XSS control).
- **Dependency audit** → slice 6. **Rate-limit quota deep-dive** → slice 7. **`proxy.ts` middleware** → slice 2.
- **Forward-looking broadcast CI guard** → BACKLOG ("Auth-broadcast audit needs a forward-looking guard"), a dedicated quality slice.
- **Production Supabase Cloud dashboard config** — not auditable from the repo (slice-2 caveat stands).

---

## Verification approach

Empirical results below were produced by a throwaway Playwright spec
(`apps/web/tests/e2e/_slice3-empirical.spec.ts`, **not committed** — deleted after
the run) executed against the already-running local dev server
(`http://localhost:3000`, reused via `reuseExistingServer`) with the Playwright
`globalSetup` test admin (`test-admin@example.com`). Requests used Playwright's
`APIRequestContext`: `page.request.*` inherits the signed-in page's cookies;
`playwright.request.newContext()` is cookie-less for the unauthenticated vectors;
and — critically for Finding 1 — `APIRequestContext` lets you set a forged
`Origin` header and does **not** enforce `SameSite` the way a real browser does.

> **Environment note**: the local Supabase was already running. Slice-3 vectors
> (invite-handler behavior, `full_name` store/render) do not depend on the
> slice-2 `[auth]` config (`max_frequency`, password floor, `secure_password_change`),
> so a `supabase stop && supabase start` to re-pick-up that config was not
> required for this audit. Any future slice that *does* touch auth config must
> restart per the slice-2 DECISIONS note (`db reset` alone does not regenerate
> the gotrue container env).

### (a) `POST /api/admin/invite` — verbatim status + body

```
# --- unauthenticated (cookie-less context) ---
V-noauth valid-body      → 401  {"error":"unauthenticated"}
V-noauth bad-email       → 400  {"error":"validation_failed","issues":[{...,"format":"email","pattern":"/^(?!\\.)(?!.*\\.\\.)([A-Za-z0-9_'+\\-\\.]*)[A-Za-z0-9_+-]@([A-Za-z0-9][A-Za-z0-9\\-]*\\.)+[A-Za-z]{2,}$/","path":["email"],"message":"Invalid email address"}]}
V-noauth empty-body      → 400  {"error":"validation_failed","issues":[{"expected":"string",...,"path":["email"]},{"code":"invalid_value","values":["employee","team_lead","admin"],"path":["role"]}]}
GET  → 405 (empty body)   PUT → 405   DELETE → 405   PATCH → 405

# --- admin session ---
V-admin valid employee   → 201  {"user_id":"d66416f5-..."}
V-admin role=admin       → 201  {"user_id":"48248404-..."}        # admin may create admin
V-admin bad-email        → 400  validation_failed (email regex leaked in issues)
V-admin empty-body       → 400  validation_failed (email + role issues)
V-admin invalid-role     → 400  validation_failed (role enum leaked)
V-admin non-object body  → 400  {"error":"validation_failed","issues":[{"expected":"object",...}]}
V-admin extra-fields     → 201  {"user_id":"724f2424-..."}        # injected/isAdmin keys silently stripped (Zod non-strict)
V-admin Origin:evil.com  → 201  {"user_id":"97dd48fc-..."}        # ⚠ Finding 1 — see caveat below
V-admin bad-manager      → 500  {"user_id":"66927482-...","error":"manager_update_failed","detail":"manager profile not found: 00000000-0000-0000-0000-000000000000"}   # Finding 2
V-admin dupe #1 (parallel)→ 201  {"user_id":"6340b6b3-..."}
V-admin dupe #2 (parallel)→ 500  {"error":"invite_failed","detail":"Database error saving new user"}   # Finding 2 (concurrent race bypasses the /already/i → 409 branch)

# --- non-admin (employee) session ---
V-employee role=admin    → 403  {"error":"forbidden"}             # handler gate stops escalation
```

> **Finding-1 caveat (the key adjudication)**: the `Origin: https://evil.com →
> 201` result was produced by `APIRequestContext`, which is **not a browser** and
> sends the stored cookie regardless of `SameSite`. It proves the *handler* does
> no Origin validation; it does **not** prove a browser-exploitable CSRF. A real
> cross-site `fetch` from `evil.com` would not attach the `SameSite=Lax` `sb-*`
> cookie to a cross-site POST, so the handler would return 401. Hence `low`, not
> `med`.

> The "non-object body" 400 above was the closest reachable test of the
> malformed-JSON path: Playwright JSON-encodes a string argument, so `request.json()`
> parsed it to a JSON *string* (→ Zod `invalid_type`, 400) rather than throwing.
> The true unparseable-body path returns `400 {"error":"invalid_json"}` per the
> `try/catch` at `route.ts:24-28`; both map to 400.

### (d) `full_name` injection — verbatim (stored vs rendered)

Payload seeded via the admin client (drives `handle_new_user`), then signed in
and rendered; a second payload submitted through the account form:

```
STORED full_name           = "<img src=x onerror=\"window.__xss=1\">"     verbatim-match = true
BANNER  <h1> textContent    = "Good evening, <img"
BANNER  <h1> innerHTML       = "Good evening, &lt;img"                      # escaped
injected img[src=x] count   = 0
window.__xss                = undefined
dialogFired                 = false
DROPDOWN name innerHTML      = "&lt;img src=x onerror=\"win…"               # escaped + truncated

# account-update write path, payload "<svg onload=\"window.__xss2=1\">":
ACCT-UPDATE stored full_name = "<img src=x onerror=\"window.__xss=1\"><svg onload=\"window.__xs"   # stored unsanitized; clamped to 60 chars by the client maxLength=60 (Finding 5)
window.__xss2               = undefined
dialogFired (post-acct)     = false

# length inconsistency (Finding 5):
80-char full_name stored len = 80     # signup/onboarding-equivalent path accepts >60; account schema max(60) would reject the same value
```

Conclusion: `full_name` is stored **verbatim / unsanitized** (no DB or trigger
filtering — slice-1 Finding 7 confirmed) and rendered **escaped** at every
surface (React auto-escaping) — no script execution, no element injection, no
dialog. The account-update value was stored unsanitized too and likewise
rendered inert. (The `ACCT-UPDATE` value shows the prior name concatenated with
the new payload clamped to 60 chars — a `maxLength` interaction in the test
harness, not a handler behavior; the security-relevant facts — stored
unsanitized, rendered inert — hold.)

### (c) Form-surface XSS — grep patterns (run from `apps/web`)

```bash
grep -rn "dangerouslySetInnerHTML" . --include="*.tsx" --include="*.ts"   # one hit: app/layout.tsx:43 (static constant)
grep -rn 'href={`\|src={`\|action={`\|formAction={`' . --include="*.tsx"  # none
grep -rn 'href={[^}]*\${' . --include="*.tsx"                              # none
grep -rn "marked\|markdown-to-jsx\|react-markdown\|DOMParser\|innerHTML" . --include="*.tsx" --include="*.ts"  # none
grep -rn "full_name\|fullName\|displayName\|firstName\|initials" . --include="*.tsx"   # render-path enumeration (all JSX text)
```

### Re-running this audit

A future Claude can recreate the empirical run: with the local Supabase up and
the dev server on `:3000`, recreate the throwaway spec from the vectors above
(sign in as the `globalSetup` admin, use `page.request.post` for authed vectors
and `playwright.request.newContext()` for unauthenticated ones, and assert on the
`@@@`-logged status/body), run `npx playwright test <spec> --project=chromium`,
then delete the spec. Do **not** commit the throwaway spec.
