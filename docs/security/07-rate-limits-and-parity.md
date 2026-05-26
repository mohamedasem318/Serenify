# Security Slice 7 — Rate-Limit Verification + Cloud-Dashboard Parity Consolidation

> **Audit-only.** This document records findings; it applies no fixes and changes
> no application or config code. Mohamed reviewed these with claude.ai; the
> decisions are recorded in [Adjudication (2026-05-26)](#adjudication-2026-05-26),
> and a follow-up Claude Code session lands them on this same branch
> (`security/07-rate-limits-and-parity`). Per that adjudication, **no functional
> config or code change is owed** — the fix-pass outcomes are documentation only:
> a binding deploy-blocker invariant + policy notes in `docs/DECISIONS.md`,
> reminder comments in `route.ts` and `config.toml`, the slices-0–7
> `PROJECT_SYSTEM_PROMPT.md` wrap-up, and Mohamed mirroring the consolidated parity
> checklist into the Supabase Cloud dashboard manually.

## Summary

This slice closes the rate-limit surface (OWASP A04 insecure-design / A07
identification-and-authentication-failures, rate-limiting axis) and consolidates
the Cloud-dashboard parity status carried across slices 1–6. It audited:

- every Supabase GoTrue rate-limit setting in `supabase/config.toml`
  `[auth.rate_limit]` + `[auth.email]` and the endpoint each governs;
- the `/api/admin/invite` privileged Route Handler's rate-limit exposure
  (service-role admin calls vs the per-IP user buckets);
- every auth-relevant Server Action and the Supabase bucket it inherits — plus
  the `changePassword` throwaway-anon-client `signInWithPassword` edge case;
- the absence of any custom application-layer rate limiter (`proxy.ts`,
  Server Actions, route handlers);
- the `/signup` posture — **open self-serve or invite-only?**

**Headline posture: rate-limit configuration is sound and matches GoTrue
defaults; no exploitable, unauthenticated rate-limit hole.** The auth Server
Actions correctly inherit per-IP GoTrue buckets, `max_frequency=60s` (slice 2)
is the right per-account email cooldown, and a 6-digit OTP under
`token_verifications=30/5min/IP` + `otp_expiry=3600` is infeasible to
brute-force online.

**The one substantive code-level finding is the `/signup` posture: signup is
OPEN.** Any anonymous visitor can self-serve an email-confirmed `employee`
account; there is no invite-token gate, no `invites` table, and no
profiles-pre-existence check. The admin-invite email link is a *parallel*
privileged path (the only route to `team_lead`/`admin`), **not** the sole way
in. This is characterized below and routed to the feature backlog — closing it
is non-trivial feature work, not a security fix-pass change.

Two `low` hardening items (an app-layer throttle on `/api/admin/invite`; the
production `email_sent` re-tune) and an informational distributed-stuffing note
round out the findings. A durable custom rate limiter is recommended for
production and deferred to a backlog quality slice.

**Finding counts by severity:** `critical` 0 · `high` 0 · `med` 1 · `low` 3 ·
`informational` 1 (5 total). One audited-clean edge case (`changePassword`
bucket) and the parity checklist (process) are recorded separately.

| # | Title | Severity |
|---|-------|----------|
| 1 | `/signup` is OPEN self-serve — any anonymous visitor can mint an email-confirmed `employee` account (no invite gate) | med¹ |
| 2 | `/api/admin/invite` has no app-layer throttle; service-role invites bypass GoTrue's per-IP buckets (only email rate caps abuse, and it may not prevent `auth.users` row + role creation) | low |
| 3 | `email_sent = 2/hour` is per-IP and too aggressive once production SMTP is wired (false-positive lockouts behind shared NAT); currently inert locally | low |
| 4 | `signOut` / `updateProfile` / `completeOnboarding` make no rate-limited auth call — app-layer-unthrottled, self-scoped DB writes under RLS | low |
| 5 | No CAPTCHA + per-IP-only buckets ⇒ distributed credential-stuffing against a single account is not bounded per-account | informational |

> ¹ **Finding 1 severity is dual-lens** (see [`/signup` posture](#signup-posture--open-vs-invite-only)). It is **Low–Med under the thesis / pre-prod lens that applies today** and rises to **High before any real-tenant production launch**. Tabled as `med` (the bridge value) to signal a product decision is owed before prod, without crying wolf at the current stage. Per the DECISIONS "severity is informational" principle, the rating drives *prioritization* here because the fix is **deferred to feature backlog**, not applied this pass.

---

## Fix-pass summary (2026-05-26)

The follow-up Claude Code session landed the adjudicated outcomes on this branch.
**No finding produced a functional code or config-value change** — the slice is
documentation plus two inline reminder comments. Per-finding routing:

- **F1** (`/signup` open self-serve) → **routed to BACKLOG**
  (`docs/BACKLOG.md` → "`/signup` is open self-serve — gate to invite-only",
  ⛔-tagged); **production deploy-blocker** per DECISIONS 2026-05-26 (Security
  slice 7, choice 1). Stays `med` today under the dual-lens framing; rises to
  `high` the day a production deploy is contemplated.
- **F2** (`/api/admin/invite` app-layer throttle) → **deferred to feature 011**
  per DECISIONS 2026-05-26 (choice 3); inline pointer added at
  `apps/web/app/api/admin/invite/route.ts:37`. Durable Supabase-table limiter is
  the recommended shape; BACKLOG "App-layer rate limiting" entry tracks it.
- **F3** (`email_sent` production value) → **deferred to SMTP-wiring** per
  DECISIONS 2026-05-26; inline pointer added at `supabase/config.toml:204`. Held
  at default `2` (inert locally — SMTP disabled) until the provider quota is known.
- **F4** (unthrottled self-scoped DB-write Server Actions) → **accepted as
  designed** per DECISIONS 2026-05-26 (choice 4): RLS is the throttle ceiling for
  self-scoped DB writes (`updateProfile`, `completeOnboarding`, `signOut`).
- **F5** (no CAPTCHA / per-IP-only buckets) → **deferred** per DECISIONS
  2026-05-26 (choice 5); trigger to revisit: sustained credential-stuffing in
  production logs OR the production-launch readiness review, whichever fires
  first. `[auth.captcha]` stays commented out in `config.toml`.

**Parity:** the Cloud-dashboard parity checklist is consolidated across slices
1–7 above; Mohamed applies + verifies it manually before any production deploy
(it cannot be read from the repo). The parity-mirroring policy (mirror the full
`[auth.rate_limit]` block including inert settings) is codified in DECISIONS
2026-05-26.

**References:** DECISIONS entry **2026-05-26 — Security slice 7: rate-limit
posture + Cloud-dashboard parity**; CHANGELOG entry **2026-05-26 — security:
slice 7 — rate-limit verification + Cloud-dashboard parity consolidation**.

### Test results (2026-05-26)

A docs-and-comments slice should not regress tests, and it did not. The change
is provably comment-only — `git diff` shows `route.ts` gained five `//` comment
lines (executable code byte-identical) and `config.toml` gained four `#` comment
lines (`email_sent = 2` value unchanged) — so it cannot alter any runtime or auth
behavior.

- **`supabase db reset`** — all 8 migrations apply cleanly (the first two
  attempts hit a transient storage-container health flake; the third was clean —
  infra, not migrations).
- **Vitest (`apps/web`)** — **227 passed** (24 files). The trailing "failed to
  terminate forks worker (EPERM)" line is the known Windows worker force-kill, not
  a test failure.
- **Vitest seed suite (`SUPABASE_INTEGRATION=1`)** — **32 passed** (4 files).
- **`npm audit`** — only the accepted postcss `</style>` line (2 moderate,
  DECISIONS 2026-05-17 / slice 6), as expected.
- **Playwright e2e matrix (chromium + firefox + webkit)** — **50 passed / 7
  failed of 57** (the 57 total matches the slice-6 baseline). The 7 failures are
  **non-deterministic environmental flakes**, confirmed:
  - The failing specs **differed across runs** — `reset-password.spec.ts:66`
    and `:87` *failed* in the matrix but *passed* on isolated re-run, while `:45`
    did the reverse. A real regression is deterministic; this is not.
  - All failures are timeouts in the documented flaky set (`admin-seeded`,
    `cross-tab-auth-sync`, `reset-password` — the timing-sensitive auth/checklist
    specs), and the matrix took **22 min vs the ~3-min baseline**, the signature of
    the `next dev` memory-bloat / monotonic-slowdown issue (`docs/BACKLOG.md`)
    compounded by Docker-container churn from the `supabase db reset` retries.
  - The Vitest unit + integration suites, which exercise the actual schemas and
    logic directly, are fully green.

  **No e2e behavior changed** (the diff is comment-only). Mohamed can re-confirm
  the clean matrix count by running it once against a freshly-restarted Supabase
  stack + dev server per the BACKLOG workaround; the failures are not introduced
  by this slice.

---

## Adjudication (2026-05-26)

Mohamed reviewed these findings with claude.ai. A follow-up CC session lands the
outcomes on this branch — but **no finding produced an immediate functional code
or config change.** Every outcome is a deliberate deferral, a deploy-blocker
invariant, or a policy codification. The decisions below are the binding record
the fix pass implements.

1. **Finding 1 (`/signup` OPEN) — keep open for thesis/demo; lock as a
   Pre-Production Deploy Blocker.** Routing to the feature backlog is correct —
   closing `/signup` is non-trivial feature work (invite-token model, token field
   + UI, expiry handling). What this adds beyond a backlog item is an **explicit,
   binding gate**: a production launch with real user signals **MUST NOT** happen
   while `/signup` is open. The fix pass codifies this in `docs/DECISIONS.md` as a
   binding invariant, and the slices-0–7 `PROJECT_SYSTEM_PROMPT.md` wrap-up
   surfaces it as a **Pre-Production Deploy Blocker** (not merely deferred work).
   This deploy gate is the mechanism that enforces the High-at-production
   re-rating of the dual-lens severity — the thesis-lens Low–Med holds only
   *because* the gate guarantees the posture cannot reach a real-tenant launch
   unaddressed.

2. **Finding 2 (`/api/admin/invite` per-admin throttle) — hold for feature 011.**
   Calibrating a per-admin / per-IP limit without a real UI is arbitrary: today's
   exposure requires a valid admin session, and feature 011 (admin-dashboard) will
   define the legitimate invite-usage patterns the limit should be sized against.
   The fix pass adds a short **inline comment in `route.ts`** noting the future
   throttle so anyone touching the handler is reminded. The BACKLOG entry stays,
   addressed-by feature 011.

3. **Finding 3 (`email_sent` value) — defer to SMTP-wiring.** Locking a value
   without the production provider's quota is arbitrary, and the setting is inert
   locally (SMTP disabled). The fix pass adds an explicit
   `# Re-tune at SMTP-wiring per slice 7 F3` **comment at `config.toml`'s
   `email_sent` line** so the deferral is not lost; the value stays `2` until
   custom SMTP is configured, at which point it is re-tuned against the chosen
   provider's quota (and mirrored to the dashboard).

4. **Inert rate-limit mirroring (parity checklist) — yes, mirror.** Mirroring the
   currently-inert settings (`anonymous_users`, `sms_sent`, and the rest of the
   `[auth.rate_limit]` block) into the Cloud dashboard is cheap insurance against a
   future feature-enable (anon sign-ins, SMS) accidentally landing on an unset or
   over-permissive limit. The [parity checklist](#cloud-dashboard-parity-checklist)
   already lists them; the fix pass codifies "**mirror the full `[auth.rate_limit]`
   block, including inert settings**" as a policy in `docs/DECISIONS.md`.

---

## Rate-limit inventory table

The headline artifact. Every Supabase GoTrue rate-limit setting, the endpoint(s)
it governs, its bucket key, and whether it suits Serenify's threat model. **All
`[auth.rate_limit]` numeric buckets are keyed by client IP**; `max_frequency` is
the only per-account control. Values confirmed against `supabase/config.toml`
lines 184–244. There is **no application-layer rate limiting anywhere** — every
limit below is GoTrue's, not the app's.

| Setting (`config.toml`) | Value | Endpoint(s) governed (`/auth/v1/*`) | GoTrue default | Bucket | Appropriate for Serenify? |
|---|---|---|---|---|---|
| `sign_in_sign_ups` (`:212`) | 30 / 5 min | `/token?grant_type=password` (sign-in) · `/signup` | 30 / 5 min | **per-IP** (excludes anon) | **Yes — audited-clean.** Matches default; sane for a small org tool. Per-IP, not per-email (see distinction note). |
| `token_verifications` (`:214`) | 30 / 5 min | `/verify` (email-confirm + recovery OTP) · `/otp` magic-link verify | 30 / 5 min | **per-IP** | **Yes — audited-clean.** 30/5min/IP vs a 6-digit code (10⁶) + `otp_expiry=3600` ⇒ negligible online brute-force. |
| `token_refresh` (`:210`) | 150 / 5 min | `/token?grant_type=refresh_token` | 150 / 5 min | **per-IP** | **Yes — audited-clean.** High by design; session refresh is frequent + legitimate. Not a meaningful abuse surface. |
| `max_frequency` (`[auth.email]`, `:240`) | 60 s | min interval between any two confirmation/recovery/resend emails **to the same address** | 1 s (raised in slice 2 → 60 s) | **per-address** | **Yes — audited-clean (slice-2 hardening).** The only per-account email control; blunts inbox-harassment loops. |
| `email_sent` (`:204`) | 2 / hour | `/recover` · `/resend` · `/otp` (magic-link send) · signup confirmation email | 2 / hour (built-in service applies its own fixed low cap) | **per-IP**, **only when custom SMTP is configured** | **Adjust for production (Finding 3).** Inert locally (SMTP commented out, `:247-254`). 2/hr/IP is aggressive once SMTP lands — shared-NAT false positives. |
| `anonymous_users` (`:208`) | 30 / hour | anonymous `/signup` | 30 / hour | per-IP | **N/A — inert.** `enable_anonymous_sign_ins = false` (`:181`). Mirror anyway for defense-in-depth. |
| `sms_sent` (`:206`) | 30 / hour | SMS OTP send | 30 / hour | per-phone | **N/A — inert.** SMS disabled (`[auth.sms.twilio] enabled=false`, `:300`). |
| `web3` (`:216`) | 30 / 5 min | Web3 / SIWS login | 30 / 5 min | per-IP | **N/A — inert.** Web3 disabled (`[auth.web3.solana] enabled=false`, `:349`). |
| *(no setting)* `[auth.captcha]` (`:218-222`) | **commented out** | bot mitigation on signup/sign-in/email | n/a | n/a | **Informational (Finding 5).** No CAPTCHA. The standard mitigation for per-IP-evasion via distributed sources. Acceptable for current threat model; flag for prod. |

### per-IP vs per-address — the load-bearing distinction

- The numeric `[auth.rate_limit]` buckets are keyed by **source IP**.
  `sign_in_sign_ups = 30/5min` means *30 sign-in **or** sign-up requests from one
  IP*, regardless of which email(s) they target. An attacker spraying 30 distinct
  emails from one IP exhausts the same budget as 30 attempts on one email.
  Conversely, a **distributed** attacker (botnet / rotating IPs) gets a fresh
  30-per-5min budget *per source IP* — the per-IP model does **not** protect a
  single targeted account from a distributed credential-stuffing campaign
  (Finding 5).
- `max_frequency = 60s` is the **only per-address** control — it caps how often a
  *given account* can be sent another confirmation/recovery email, independent of
  source IP. This is the correct axis for email-flooding defense (an attacker
  cannot spam `victim@example.com`'s inbox by rotating IPs).

---

## Per-endpoint analysis

### Auth Server Actions — inherited GoTrue buckets

Server Actions get no automatic rate limiting from Next.js or Supabase. Each
inherits GoTrue's limit **only for the Supabase auth call it forwards to** — the
Server Action wrapper itself can be invoked at any rate; the limit kicks in only
when (and if) it reaches Supabase.

| Server Action (`file:line`) | Supabase auth call | Inherited bucket | Sufficient? |
|---|---|---|---|
| `signUp` — `(auth)/signup/actions.ts:38` | `auth.signUp` → `/signup` (+ confirmation email) | `sign_in_sign_ups` (30/5min/IP) **and** `max_frequency`/`email_sent` for the email | **Yes — informational.** Bounded per-IP; confirmation email gated per-address by `max_frequency`. (Open-signup *posture* is Finding 1, a separate axis.) |
| `signIn` — `(auth)/login/actions.ts` | `auth.signInWithPassword` → `/token?grant_type=password` | `sign_in_sign_ups` (30/5min/IP) | **Yes — informational.** Generic error shapes (slice 2) avoid enumeration. Per-IP distributed-stuffing caveat → Finding 5. |
| `requestPasswordReset` — `(auth)/forgot-password/actions.ts` | `auth.resetPasswordForEmail` → `/recover` (email) | `email_sent` (SMTP) + `max_frequency` 60s/address | **Yes — informational.** Always returns `ok` (anti-enumeration, FR-007); flooding blunted per-address. |
| `updatePassword` (reset apply) — `(auth)/reset-password/actions.ts` | `auth.updateUser({password})` then `signOut` | no dedicated bucket; the **recovery session** that authorizes it was gated upstream by `token_verifications`/`email_sent` | **Yes — informational.** Reaching it needs a valid recovery session (rate-limited at verify/email). `secure_password_change=true` enforces recent-auth (slice 2). |
| `resendConfirmation` — `(auth)/login/actions.ts` | `auth.resend({type:"signup"})` → `/resend` (email) | `email_sent` (SMTP) + `max_frequency` 60s/address | **Yes — audited-clean.** Slice-2 added Zod email validation; `max_frequency` is the real control. |
| `verifySignupOtp` — `(auth)/signup/actions.ts:108` | `auth.verifyOtp({type:"signup"})` → `/verify` | `token_verifications` (30/5min/IP) | **Yes — informational.** 30/5min/IP vs 10⁶ code space + 1h expiry ⇒ infeasible. |
| `verifyResetOtp` — `(auth)/reset-password/actions.ts` | `auth.verifyOtp({type:"recovery"})` → `/verify` | `token_verifications` (30/5min/IP) | **Yes — informational.** Same reasoning. |
| `changePassword` (account inline) — `(authed)/app/account/actions.ts` | `signInWithPassword` on a **throwaway anon client**, then `updateUser({password})` | reverify shares the `sign_in_sign_ups` per-IP bucket (see below); `updateUser` has no dedicated bucket | **Yes — audited-clean.** See the edge-case analysis below. |
| `signOut` — `(authed)/actions.ts` | `auth.signOut()` (token revoke) | **no rate-limited bucket** | **Gap → Finding 4 (informational).** Unthrottled at app layer; only destroys the caller's own session — no abuse value. |
| `updateProfile` — `(authed)/app/account/actions.ts` | **none** — `getUser()` (JWT verify) + `profiles` UPDATE via RLS | **no rate-limited auth-mutation bucket** | **Gap → Finding 4 (low).** Self-scoped (`.eq("id", user.id)`) DB write under RLS; `full_name` length-CHECK-bounded (slice 3). |
| `completeOnboarding` — `(onboarding)/onboarding/actions.ts` | **none** — `getUser()` + `profiles` UPDATE via RLS | **no rate-limited auth-mutation bucket** | **Gap → Finding 4 (low).** Same as `updateProfile`. |

> **Precision note** (the brief said `updateProfile`/`completeOnboarding` "make
> no Supabase auth call"): both call `supabase.auth.getUser()`, which *does*
> reach GoTrue to verify the JWT — but `getUser()` is a verification read, not a
> rate-limited *mutation* (`sign_in_sign_ups`/`token_refresh`/
> `token_verifications`), and the state change is a PostgREST `profiles.update()`
> no GoTrue quota governs. The conclusion (these write paths are unthrottled at
> both the app layer and the relevant auth-mutation layer) stands. RLS is a
> *correctness* control, not a *rate* control.

### `changePassword` throwaway-anon-client `signInWithPassword` — audited-clean

`changePassword` reverifies the current password by constructing a fresh
`@supabase/supabase-js` anon client (no persistence, no cookie writes — the
slice-2/slice-3 model-correct pattern) and calling
`signInWithPassword({ email, password: current })` on it, then `updateUser`.

**Bucket determination:** that reverify call hits `/auth/v1/token?grant_type=password`
exactly like a normal login. GoTrue keys `sign_in_sign_ups` by **client IP** —
**not** by user, session, or anon-client instance. Using a throwaway client does
**not** get it a separate bucket (the IP is unchanged). So the reverification
**consumes the shared `sign_in_sign_ups` per-IP budget (30/5min)** alongside
every other sign-in/sign-up from that IP.

**Abuse implication — none reachable:**
- Brute-forcing the *old* password via this path burns the same shared per-IP
  budget as direct login brute force after ~30 attempts/5min — **no
  amplification**.
- Reaching `changePassword` requires an **already-valid authenticated session**
  (it's an `(authed)` action gated by `getUser()`). An attacker holding a valid
  session has no incentive to brute-force the victim's old password.
- Benign side effect: a user who fat-fingers their current password several times
  draws down the same IP bucket that governs login — negligible under shared NAT.

**Verdict:** audited-clean. The design choice is sound; the bucket-sharing is
expected GoTrue behavior with no realistic abuse path. No change.

### `/api/admin/invite` rate-limit analysis (Finding 2)

**Surface:** `apps/web/app/api/admin/invite/route.ts` (whole handler).

**(i) Supabase layer — service-role admin calls bypass the per-IP user buckets.**
The invite is issued via the **service-role admin client**
(`createAdminClient()` → `admin.auth.admin.inviteUserByEmail(...)`, `route.ts:84-91`).
Service-role calls to GoTrue's **admin API** (`/auth/v1/admin/*`) are **not**
subject to `sign_in_sign_ups` / `token_verifications` / etc. — those govern the
public end-user surface. At the Supabase layer the only realistic cap on invite
volume is **email-sending**: each invite dispatches an email, bounded by
`email_sent` (when custom SMTP is configured) or the built-in service's fixed low
cap. There is **no GoTrue per-call throttle on the admin invite endpoint** beyond
email rate.

**(ii) Application layer — no throttle (confirmed).** Re-read of `route.ts`: the
handler runs four gates — authenticate (`:42`), authorize admin (`:53`), Origin
allowlist (`:62`), Zod validation (`:75`) — then calls `inviteUserByEmail` + two
SECURITY DEFINER RPCs. **No per-admin, per-IP, or per-route rate limiting,
counter, or debounce anywhere.** Confirmed also by the repo-wide grep (section d).
After passing the gates an admin can call the endpoint as fast as the network and
downstream latency allow.

**(iii) Threat model — abused/compromised admin session mass-inviting.** The cap
is set by the email subsystem, not the route:
- *Locally / no custom SMTP:* the built-in email service's fixed low cap throttles
  invite emails — but note `inviteUserByEmail` may **create the `auth.users` row
  even when the email send is rate-limited**, so row creation is faster than the
  email cap implies.
- *Production with `email_sent = 2/hour`:* invite emails capped ~2/hour/IP, but
  again the user row (then promotable to any role, including `admin`, via
  `admin_update_role`) may be created regardless. **The privilege-escalation
  angle — inviting attacker-controlled emails directly as `admin`/`manager` — is
  the more serious consequence than email volume.**
- Blast radius is gated by requiring a **valid admin session** (auth+authz at
  `:42-55`) + same-origin/absent Origin (`:62`) — a **post-compromise / insider**
  scenario, not unauthenticated.

**(iv) Recommendation — add a per-admin (secondary per-IP) throttle. Severity:
low (trending med).** Service-role invites bypass GoTrue's per-IP buckets, so the
per-IP login/signup limits give this endpoint *zero* coverage — it is the one
privileged mutation in the app with **no effective rate ceiling under its own
control**. A cheap upper bound (e.g. **20 invites/min and 100/hour per admin
user-id**, IP as a secondary key) bounds the damage window of an abused admin
session and yields a clean abuse signal (throttle-trip logs) for detection.
Keying by **admin user-id** (not just IP) is correct because the route bypasses
the per-IP buckets and a stable-IP admin is the realistic actor. Rated **low** in
isolation (exploitation needs an already-compromised admin; the auth/authz/Origin
gates are solid), trending **med** given it creates accounts + assigns roles with
no other layer capping it. **Routed to the backlog** (it is the single most
defensible rate-limit addition surfaced here) rather than treated as a live hole.

> **Adjudication (2026-05-26):** **hold for feature 011** — calibrating a
> per-admin/per-IP limit without a real admin UI is arbitrary, and today's
> exposure requires a valid admin session. The fix pass adds a reminder comment in
> `route.ts`; the BACKLOG entry is addressed-by feature 011. See
> [Adjudication](#adjudication-2026-05-26) #2.

---

## Custom rate-limiting recommendation

### Gap analysis (verified — there is no custom limiter)

`proxy.ts` (the Next 16 renamed middleware) does CSP-nonce generation, Supabase
session refresh via `getUser()`, and the auth/onboarding routing gate — **no
counter, token bucket, time-window check, or throttle of any kind**. A repo-wide
grep across `apps/web` for the limiter tokens `ratelimit`/`rate-limit`/
`rate_limit`/`throttle`/`limiter`/`Upstash`/`@vercel/kv`/`ioredis`/`bottleneck`
returns **zero** matches (the bare token `rate` matches only "gene**rate**d" /
"hyd**rate**s" in comments — confirmed false positives). No rate-limit/Redis/KV
package is declared in either `package.json`. **The only rate-limiting that exists
is GoTrue's `[auth.rate_limit]` + `max_frequency`.**

Endpoints with no app-layer ceiling above GoTrue's defaults: `/api/admin/invite`
(Finding 2) and the DB-write Server Actions `updateProfile` / `completeOnboarding`
(Finding 4, which inherit no GoTrue mutation limit at all).

### Implementation options & trade-offs

1. **In-memory `Map` on the Edge runtime** — simplest, zero deps, single-instance
   only. **Does NOT survive across serverless/Edge instances** (each Vercel
   invocation may hit a different isolate → per-instance counter, trivially
   bypassed under distributed load). A coarse local speed bump, not a real control.
2. **Supabase DB table + RLS** (a `rate_limit_events` table or an atomic
   `SECURITY DEFINER` increment RPC) — **durable and shared across all
   instances**; consistent with the app's "Postgres is the source of truth"
   posture (RLS + SECURITY DEFINER RPCs already in use); auditable. **Heavyweight
   for sub-second decisions** (a DB round-trip per gated request; high-frequency
   counters risk a write hotspot). Correctly sized for the **coarse, low-frequency**
   surfaces here (admin invites, profile writes), not per-keystroke paths.
3. **Vercel KV / Upstash Redis** (`@upstash/ratelimit`) — Edge-compatible,
   low-latency, the idiomatic real-world fit for distributed rate limiting. **Adds
   an external dependency + new paid infra / secret to manage.**

### Recommendation (thesis / pre-prod)

- **Document the gap** (this finding) as the authoritative record.
- **For production, recommend the durable Supabase-table approach (option 2)** —
  it matches the existing architecture, needs no new external infra, and is sized
  correctly for these coarse endpoints.
- **Defer implementation to a backlog quality slice.** This is hardening, not a
  reachable critical exploit (invite is admin-gated; profile writes are
  self-scoped). It does not need to land this slice. **Do NOT introduce Vercel KV
  / Upstash this slice** — premature external dependency for a pre-prod thesis app.
- **CAPTCHA (Turnstile / hCaptcha)** is out of the current threat-model scope, but
  flagged as a future option for `/signup` if it stays open — the commented-out
  `[auth.captcha]` block (`config.toml:218-222`) is ready to wire and would blunt
  automated signup/email-send abuse better than a pure rate limiter (Finding 5).

**Severity: informational** (documented gap; no reachable exploit; durable fix +
the Finding-2 throttle deferred to backlog).

---

## Cloud-dashboard parity checklist

**Why this exists:** `supabase/config.toml` is the **local CLI config only**. It
does **not** auto-apply to the hosted/Cloud project — every security-relevant
`[auth]` setting must be mirrored **by hand** in the Supabase Cloud dashboard. CC
**cannot read the Cloud dashboard from the repo**, so the dashboard state below is
unverifiable from here. **Mohamed must verify each item in the dashboard before
any production deploy.** Each item is annotated with its originating slice and the
`config.toml` line it mirrors.

### Auth → Providers → Email (cooldown)
- [ ] **Email send cooldown — `max_frequency = 60s`** *(slice 2, Finding 4 — `config.toml:240`)*. Minimum interval between auth emails to one address; blunts inbox-flooding via resend / password-reset loops.

### Auth → Rate Limits  *(NEW parity flag this slice — see note)*
- [ ] **`token_refresh = 150`** (sessions refreshed / 5 min / IP) *(verify — `:210`)*
- [ ] **`sign_in_sign_ups = 30`** (sign-up + sign-in / 5 min / IP) *(verify — `:212`)*
- [ ] **`token_verifications = 30`** (OTP / magic-link verifications / 5 min / IP) *(verify — `:214`)*
- [ ] **`anonymous_users = 30`** (/ hr / IP — moot today, `enable_anonymous_sign_ins=false`, but mirror for defense-in-depth) *(verify — `:208`)*
- [ ] **`sms_sent = 30`** (/ hr — moot today, SMS disabled, but mirror) *(verify — `:206`)*
- [ ] **`email_sent = 2`** (/ hr — SMTP-gated; **re-evaluate the value** against the production SMTP/Resend provider quota per Finding 3 before mirroring) *(verify — `:204`)*

> **NEW this slice:** `[auth.rate_limit]` is local-only, so these six were never
> affirmatively confirmed against the Cloud dashboard (they were sanity-checked
> clean in slice 2, Audited-clean #16). They default to GoTrue's built-in values,
> so the dashboard may already match — the action is **confirm**, not necessarily
> change (except `email_sent`, which Finding 3 flags for a value re-evaluation at
> production-SMTP time).
>
> **Adjudication (2026-05-26):** mirror the **full block including the inert
> settings** (`anonymous_users`, `sms_sent`, web3) — cheap insurance against a
> future feature-enable accidentally landing on an unset/over-permissive limit.
> The fix pass codifies "mirror the full `[auth.rate_limit]` block" as a policy in
> `docs/DECISIONS.md`. See [Adjudication](#adjudication-2026-05-26) #4.

### Auth → Policies (password)
- [ ] **Minimum password length = 8** *(slice 2, Finding 6 — `config.toml:186`)*
- [ ] **Password requirements = require letters + digits** *(slice 2, Finding 6 — `config.toml:190`)*
- [ ] **Enable "Secure password change" (require recent authentication)** *(slice 2, Finding 7 — `config.toml:236`)*. Forces a stale, non-recently-authenticated session to re-authenticate before a password change; recovery sessions count as recent auth and are unaffected.

### Auth → URL Configuration (redirect allowlist)
- [ ] **Site URL** = the **production** origin (the dashboard value; `config.toml:154` is the local `http://localhost:3000`).
- [ ] **Allowed Redirect URLs** list **only production Serenify origins — no wildcards** *(`config.toml:161-166` lists exact localhost/127.0.0.1 entries; the dashboard must list the production `https://` equivalents)*.
- [ ] **Both `/auth/callback` AND `/reset-password` paths present** for each production origin. (Supabase silently falls back to `site_url` — sending users to `/` — when an `emailRedirectTo` isn't in the list; a missing `/reset-password` would break recovery.)

### Slices with ZERO Cloud-dashboard parity items (affirmative record)
- [x] **Slice 1 (RLS + SECURITY DEFINER)** — n/a (in-repo migration SQL).
- [x] **Slice 3 (privileged endpoints + input validation)** — n/a (handler code, Server Action, Zod schema, migration; no `[auth]` config touched).
- [x] **Slice 4 (secrets handling)** — n/a. Env *values* already live in the platform dashboards (Principle IX); this slice only changed how the app *reads* them (boot-time validation). Confirmed by DECISIONS 2026-05-26 (slice 4).
- [x] **Slice 5 (CSP + aux headers)** — **ZERO**. All changes in-repo (`proxy.ts`, `next.config.ts`, `layout.tsx`, `providers.tsx`, `lib/zod.ts`). Confirmed by DECISIONS 2026-05-26 (slice 5). *(Vercel may inject HSTS at the edge — platform config, not a `config.toml` mirror, no conflict.)*
- [x] **Slice 6 (dependency hygiene)** — **ZERO**. All changes in-repo (`package.json` / `package-lock.json` / docs). Confirmed by DECISIONS 2026-05-26 (slice 6).

### Cross-check result
Slices 2, 3, 5, 6, the DECISIONS log, and CHANGELOG were re-read (incl. PR #7's
original checklist). **No prior parity item was missed.** Every manual
Cloud-dashboard item originates in **slice 2** (email cooldown, password
floor + requirements, secure password change, redirect allowlist). The **one new
flag this consolidation adds** is the **Auth → Rate Limits** block (six values),
because `[auth.rate_limit]` is local-only and was never affirmatively confirmed
against the hosted project. The local `config.toml` is the **reference operators
copy from**; it is **not** the production source of truth.

---

## `/signup` posture — open vs invite-only

**Determination: OPEN.** Any fully anonymous visitor can self-serve an account
through `/signup`. The application adds **no** invite gate on top of Supabase.
The only friction is mandatory email confirmation (`enable_confirmations = true`),
which proves control of the submitted mailbox but does not restrict *who* may sign
up. Every self-serve account lands at role `employee` with the full employee RLS
surface. The `/api/admin/invite` path (admin-only; `inviteUserByEmail` + role
promotion) is a **parallel, additive** path — the only way to mint a
`team_lead`/`admin` — but **not** the only way *in*.

### Traced path (anonymous visitor → account)
1. **`apps/web/proxy.ts`** — `/signup` is an `AUTH_PAGES` entry; the only rule
   touching it bounces an *already-authenticated* user to `/app`. There is **no**
   rule blocking an *anonymous* visitor. `PROTECTED_PREFIXES` is only `/app` +
   `/onboarding`. No `middleware.ts` exists; `proxy.ts` is the sole edge gate.
2. **`(auth)/signup/page.tsx` + `signup-form.tsx`** — public page, no auth check.
   Form collects `full_name`, `email`, `password` only.
3. **`(auth)/signup/actions.ts:19-45`** (`signUp`) — Zod-validates with
   `signUpSchema`, then calls `supabase.auth.signUp({ email, password,
   options.data.full_name })` at **`:38`**. **No invite check, no profiles
   pre-existence check, no token.** (`signUpFromForm`, `:76-82`, is the no-JS
   wrapper, identical behavior.)
4. **`lib/auth/schemas.ts` `signUpSchema`** — fields are exactly `email`,
   `password`, `full_name`. **No invite-token field.**
5. **Supabase** creates `auth.users` → the `on_auth_user_created` trigger fires.
6. **`supabase/migrations/20260517000030_profile_trigger.sql:16-21`**
   (`handle_new_user`) inserts a `public.profiles` row with `role` **hard-coded to
   `'employee'::public.user_role`** (`:20`). The trigger comment (`:4-7`)
   deliberately ignores client-supplied `role`/`manager_id` in
   `raw_user_meta_data`, so a self-signup **cannot** escalate to `admin`/`team_lead`
   via metadata — privileged roles only come from `admin_update_role`.

**No `invites` table exists.** Grep across `supabase/migrations/` for
`invite`/`invitation`/`invite_token`/`invited` matches only comments referencing
the `/api/admin/invite` route handler — no `CREATE TABLE` for invites/allowlist.

### Answers to the five questions
1. **Anonymous visitor → account via `supabase.auth.signUp`?** — **YES.**
   `signup-form` → `signUp` (`actions.ts:19`) → `supabase.auth.signUp` (`:38`).
   The proxy never blocks anonymous `/signup`.
2. **Any check against an invites table / pre-existing profiles row before
   `signUp`?** — **NO.** `signUp` does Zod validation then goes straight to
   Supabase. No `.from("invites")`, no `.from("profiles")` lookup, no token. No
   invites table exists.
3. **Email must pre-exist anywhere?** — **NO.** Any well-formed, not-already-
   registered email is accepted (the `/already|registered|exists/i` branch handles
   the *duplicate* case; a brand-new email proceeds to creation).
4. **Role assigned + what it gets** — **`employee`** (hard-coded, trigger `:20`).
   `employee` gets SELECT/UPDATE on its **own** profile row (`role`/`manager_id`
   frozen by the RLS `WITH CHECK`) + whatever feature tables grant `authenticated`.
   So a self-serve attacker gets an authenticated, RLS-scoped employee session —
   **not** admin — but a real foothold inside the tenant.
5. **Email confirmation required, and does it change risk?** — **YES**
   (`enable_confirmations = true`; OTP fallback `verifySignupOtp`). It **raises the
   bar slightly** — the attacker must control the mailbox they submit, so they
   can't claim *someone else's* email — but does **NOT** prevent anyone with *any*
   email they control from getting a working `employee` account. It gates *email
   ownership*, not *authorization to join the org*.

### Severity — dual lens
| Lens | Severity | Rationale |
|---|---|---|
| **Thesis / pre-prod** (today; not taking real users) | **Low–Med** | Open signup is the expected default for a demo/thesis build; no real data at stake. The `employee` cap + RLS + email confirmation bound the blast radius. Surface-and-track. |
| **Production B2B employee-tool intent** | **High** | For a workplace-stress tool meant for *invited employees only*, open self-serve signup is a Day-1 trust/tenancy violation: any internet stranger mints a logged-in `employee` account, consuming a seat + gaining the authenticated RLS surface. The "stress data is employee-private" model assumes accounts map to real, vetted staff — open signup breaks that assumption. |

**Recommended lens:** the thesis lens (**Low–Med**) applies **today** given the
thesis framing in `CLAUDE.md`/specs, but this **MUST be re-rated to High before
any real-tenant production launch.** Both lenses are recorded so the thesis lens
does not hide the production-blocker nature. Tabled as `med` (Finding 1) as the
honest bridge.

### Routing recommendation — FEATURE BACKLOG, not this slice's fix pass
The fix is non-trivial **feature** work, not a hardening tweak: an invites table
(or reusing the admin-invite flow as the *sole* entry), an invite-token field + UI
on `/signup`, server-side token validation against the email, token-expiry
handling, "invalid/expired invite" error states — plus a product decision on
whether `/signup` should exist at all vs. funneling everyone through
`/api/admin/invite`. That is design + schema + UI + tests, well outside an audit
fix-pass. The audit's job is to surface and characterize, which this does. Routed
to **`docs/BACKLOG.md` → security slice 7** (added with this doc).

> **Adjudication (2026-05-26):** keep `/signup` open for the thesis/demo stage, but
> **lock it as a Pre-Production Deploy Blocker** — a real-tenant production launch
> MUST NOT proceed while signup is open. Codified as a binding invariant in
> `docs/DECISIONS.md` + surfaced in the `PROJECT_SYSTEM_PROMPT.md` wrap-up. See
> [Adjudication](#adjudication-2026-05-26) #1.

---

## Audited and clean

Affirmative record — each surface examined and returned no finding.

1. **Rate-limit defaults match GoTrue and suit the surface** — `sign_in_sign_ups`,
   `token_verifications`, `token_refresh` all at default and sane (inventory
   table). 6-digit OTP + 1h expiry + 30 verifications/5min/IP ⇒ negligible
   brute-force probability (re-affirms slice-2 Audited-clean #16, now the
   deep-dive).
2. **`max_frequency = 60s` is the correct per-account email control** (slice 2) —
   per-address, IP-independent; the right axis for inbox-flooding defense.
3. **`changePassword` reverify** consumes the shared per-IP sign-in bucket with no
   amplification, and is reachable only with a valid session — audited-clean (full
   analysis above).
4. **`secure_password_change = true`, `enable_refresh_token_rotation = true`,
   `refresh_token_reuse_interval = 10`, `jwt_expiry = 3600`** — verified present
   and sane (re-confirms slice-2 Audited-clean #15); these bound the value of any
   rate-limit-evasion outcome.
5. **No app-layer rate limiter exists** and none is silently mis-configured — the
   absence is documented and intentional (not a stale/broken limiter), with the
   durable approach recommended for prod.
6. **Anonymous / SMS / web3 rate-limit settings are inert** because their features
   are disabled (`enable_anonymous_sign_ins=false`, SMS/web3 providers
   `enabled=false`) — no live surface; mirrored to the dashboard for
   defense-in-depth only.
7. **`handle_new_user` cannot be privilege-escalated via signup metadata** — role
   is hard-coded `'employee'`; client-supplied `role`/`manager_id` in
   `raw_user_meta_data` are ignored by design (trigger `:4-7`). The open-signup
   finding is about *account creation*, **not** role escalation — that control is
   sound.

---

## Out of scope this slice

Routed elsewhere; recorded so nothing is silently dropped.

- **Closing `/signup` to invite-only** (Finding 1) → **feature backlog** (added to
  `docs/BACKLOG.md` → security slice 7), and (adjudicated) **a binding
  Pre-Production Deploy Blocker** codified in `docs/DECISIONS.md` +
  `PROJECT_SYSTEM_PROMPT.md`. Non-trivial feature work, not a security fix-pass
  change.
- **App-layer rate limiter** (Finding 2 invite throttle + the durable
  Supabase-table limiter for the unthrottled DB-write actions) → **backlog**
  (added to `docs/BACKLOG.md` → security slice 7). The invite throttle is
  (adjudicated) **held for feature 011** with a reminder comment in `route.ts`. No
  Vercel KV / Upstash this slice.
- **Production `email_sent` value re-tune** (Finding 3) → (adjudicated)
  **deferred to SMTP-wiring**; the fix pass adds a `# Re-tune at SMTP-wiring per
  slice 7 F3` comment at the `config.toml` `email_sent` line. Not actioned now
  (inert locally); carried in the parity checklist for the dashboard.
- **Bot detection / CAPTCHA (Turnstile/hCaptcha)** — out of the current
  threat-model scope; flagged as a future option for `/signup` (Finding 5).
- **Production Supabase Cloud-dashboard application** — Mohamed applies the
  consolidated parity checklist manually; not auditable from the repo.
- **Forward-looking auth-broadcast CI guard** and **ST-9 recovery-submit e2e** —
  existing BACKLOG items, unrelated to rate limits; noted for completeness.

---

## Verification approach

Commands and steps a future Claude can re-run to confirm this audit. **This slice
needed no empirical server hits** — the rate-limit posture is fully determinable
from `config.toml` + the GoTrue per-IP/per-address bucket model, and the
`/signup` posture is conclusive from code reading (an open `enable_signup=true` +
no app gate + no invites table is dispositive). The slice-3 throwaway-Playwright
vector matrix is the model **if** a future change makes a limit's behavior
genuinely in doubt; it was not needed here.

### Rate-limit config inventory
```bash
# every GoTrue rate-limit + email-cooldown setting, with line numbers:
grep -nE "sign_in_sign_ups|token_verifications|token_refresh|email_sent|sms_sent|anonymous_users|web3|max_frequency|enable_signup|enable_anonymous_sign_ins|enable_confirmations|secure_password_change|minimum_password_length|password_requirements" supabase/config.toml
# confirm CAPTCHA is unconfigured (commented out):
grep -n "auth.captcha" supabase/config.toml
```

### Custom rate-limiter gap (expect: no matches)
```bash
# middleware + whole app — any throttle/limiter/Redis/KV?
grep -rniE "ratelimit|rate-limit|rate_limit|throttle|limiter|upstash|@vercel/kv|ioredis|bottleneck" apps/web --include=*.ts --include=*.tsx
grep -niE '"(@upstash/ratelimit|@vercel/kv|ioredis|bottleneck)"' apps/web/package.json package.json
```

### `/signup` posture (expect: open; no invite gate)
```bash
# the signUp action calls supabase.auth.signUp with no invite/profiles lookup:
grep -n "supabase.auth.signUp\|from(\"invites\")\|from(\"profiles\")\|invite_token" "apps/web/app/(auth)/signup/actions.ts"
# no invites table anywhere in migrations:
grep -rniE "create table.*(invite|invitation|allowlist)" supabase/migrations
# role is hard-coded employee on self-signup:
grep -n "user_role\|raw_user_meta_data\|role" supabase/migrations/20260517000030_profile_trigger.sql
# Supabase allows open signup:
grep -n "enable_signup" supabase/config.toml   # => true (both [auth] and [auth.email])
```

### `/api/admin/invite` no app-layer throttle (expect: none)
```bash
grep -niE "ratelimit|throttle|counter|debounce|token bucket" "apps/web/app/api/admin/invite/route.ts"   # no matches → no app-layer throttle
```

### Cloud-dashboard items Mohamed verifies (cannot be checked from the repo)
The [Cloud-dashboard parity checklist](#cloud-dashboard-parity-checklist) above —
every unchecked box must be confirmed manually in the Supabase Cloud dashboard
before a production deploy. The local `config.toml` is the reference, not the
production source of truth.
