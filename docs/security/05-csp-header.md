# Security Slice 5 — Content Security Policy Header (+ auxiliary security headers)

> **Audit-only.** This document records a design and a violation-capture
> playbook; it applies **no** header changes, **no** middleware changes, and
> **no** config changes. Mohamed reviews this with claude.ai, decides any
> adjustments, and a follow-up Claude Code session lands the rollout on this
> same branch (`security/05-csp-header`): Report-Only first, empirical
> violation capture, then flip to enforcing. No application or config code is
> changed by the commit that introduces this doc.

## Summary

**Current state: no CSP and no auxiliary security headers exist today.** A grep
of `apps/web` for `Content-Security-Policy`, `Strict-Transport-Security`,
`X-Frame-Options`, `X-Content-Type-Options`, `Referrer-Policy`,
`Permissions-Policy` returns **zero** matches. `apps/web/next.config.ts` is an
empty `NextConfig` (no `headers()`), and `apps/web/proxy.ts` sets no response
headers beyond the Supabase cookie plumbing.

CSP is the planned **second layer under React auto-escaping** (slice-3 verified
React-escape holds end-to-end) and the planned mitigation for the
`httpOnly:false` `sb-*` cookie exposure (slice-2 Finding 2 deliberately left the
session cookie readable by `document.cookie`; a strict `script-src` blocks the
foreign-script execution that would read it). It also closes mixed-content and
cross-origin-exfiltration vectors via `connect-src`/`img-src`.

**Proposed approach: nonce-based `script-src`, `'unsafe-inline'` `style-src`.**
This is not a stylistic preference — it is forced by the framework and the
dependency tree, both verified empirically (not read from docs):

- **`script-src` → nonce.** Next.js 16 emits many per-request inline scripts
  (the RSC flight payload `self.__next_f.push([...])` and the `self.__next_r`
  router marker). These are dynamic and streamed, so **hashing is infeasible**.
  Next.js auto-stamps a nonce onto all of them *when the CSP header carrying
  `'nonce-…'` is present on the request* — so nonce is both the only viable and
  the framework-native choice.
- **`style-src` → `'unsafe-inline'` (no nonce).** Radix UI (Dialog / Dropdown,
  via the transitive `react-remove-scroll` → `react-style-singleton`) injects a
  runtime `<style>` element on overlay open. That element only carries a nonce
  if `setNonce()` / `__webpack_nonce__` is wired — and Next 16 uses
  Turbopack/SWC, not webpack, so `__webpack_nonce__` is not auto-populated.
  Per CSP3, **a nonce on `style-src` makes the browser ignore `'unsafe-inline'`**
  — so putting a nonce on `style-src` would *break* the Radix scroll-lock. The
  correct Day-1 posture is `style-src 'self' 'unsafe-inline'`, which is
  materially lower-risk than on `script-src` (CSS cannot execute JS). A
  future hardening path to a nonce'd `style-src` is documented below.

**Rollout** (the fix pass executes): implement as
`Content-Security-Policy-Report-Only`, drive every route under Playwright while
capturing `securitypolicyviolation` events (including opening the Radix
dropdown/dialog to trigger the runtime `<style>` injection), resolve, then flip
to the enforcing `Content-Security-Policy` and re-run the full e2e matrix.

**Empirical basis.** The inline-script/style inventory below was captured from
the **running dev server** (`http://localhost:3000`, View Source), and the
framework/library behaviours were verified against the actual `node_modules`
source (`file:line` cited throughout). Per `apps/web/AGENTS.md`, this Next.js
has breaking changes vs. training-data recollection, so every framework claim
was checked against the bundled source and docs.

> **Dev-vs-prod caveat (carried into the rollout):** the capture below is from
> **dev mode (Turbopack + HMR)**. Production emits a *different, smaller* set of
> inline scripts (no HMR client, no devtools segment-explorer) and does **not**
> require `'unsafe-eval'`. The fix-pass Report-Only capture **must** be run
> against a production build (`next build && next start`) as the authoritative
> inventory; the dev capture establishes the *shape* of the problem
> (which scripts are app-authored vs. framework, whether inline `<style>` is
> emitted), which is what drives the nonce-vs-hash and style-src decisions.

**Severity framing:** OWASP **A05 — Security Misconfiguration** (absent
defense-in-depth headers) and **A03 — Injection** (CSP as the second XSS layer).
This slice adds hardening; it does not close a reachable exploit (slice-3
verified there is no live XSS — React-escaping holds).

---

## Inventory tables

The headline artifact of this slice (analogous to slice-2's cookie table and
slice-4's env table).

### Table 1 — Inline `<script>` inventory (empirical, `GET /login`, dev mode)

View Source of `http://localhost:3000/login` carried **11 inline `<script>`
tags** (no `src`). Classification and nonce strategy per tag:

| # | Inline script | Origin | Bytes | Static? | Nonce strategy |
|---|---|---|---|---|---|
| 1 | Theme-migration IIFE `(function(){…localStorage 'theme'→'serenify-theme'…})()` | **App-authored** — `app/layout.tsx:42-47` `dangerouslySetInnerHTML` | 149 | yes | **Manual** — add `nonce={nonce}` to the `<script>` element |
| 2 | next-themes FOUC script `((e,i,s,u,m,a,l,h)=>{…})(…)` | **Library (app-controlled)** — injected by `<ThemeProvider>` in `app/providers.tsx` | ~832 | no (embeds props) | **Manual** — pass `nonce` prop to `<ThemeProvider>` (next-themes 0.4.6 supports it) |
| 3 | `self.__next_r="…"` (id `_R_`) router marker | **Next.js framework** | 37 | no (per-request id) | **Automatic** — Next stamps the nonce |
| 4 | `(self.__next_f=self.__next_f\|\|[]).push([0])` flight bootstrap | **Next.js framework** | 43 | no | **Automatic** |
| 5–11 | `self.__next_f.push([1,"…"])` × 7 — streamed RSC payload | **Next.js framework** | 0.5–4.7 KB each | no (content-dependent, streamed) | **Automatic** |

**Reading:** 2 inline scripts need *manual* nonce wiring (the migration IIFE and
next-themes); the other 9 are framework scripts that Next.js nonces
*automatically* once the CSP header is on the request. The framework scripts
(#3–11) are precisely what makes **hash-based CSP infeasible** — they are
per-request and streamed.

> Dev-only extras present in this capture that **will not appear in prod**: the
> `[turbopack]_browser_dev_hmr-client` script and the
> `next-devtools/segment-explorer` flight entries. These are why the fix pass
> re-captures against a prod build.

### Table 2 — Inline `<style>` inventory

| Source | Emits inline `<style>`? | When | Carries nonce? | Verified at |
|---|---|---|---|---|
| Static page render (`/login`) | **No** (0 inline `<style>` in View Source) | — | n/a | dev View Source |
| Tailwind v4 | No — ships as `<link rel="stylesheet" href="/_next/static/…css">` | build | n/a | dev View Source |
| `next/font/google` (Inter, DM Serif) | **No** in App Router — `@font-face` compiled into the static CSS bundle; fonts preloaded via `<link rel=preload as=font>` from `/_next/static/media/` | n/a | n/a | `node_modules/next` font loader; high confidence |
| Radix `react-remove-scroll` → `react-style-singleton` | **Yes** — `document.createElement('style')` injected into `<head>` | **runtime, on Dialog/Dropdown open** (scroll-lock) | only if `setNonce()`/`__webpack_nonce__` wired (not today) | `react-style-singleton/dist/es2015/singleton.js:5,9`; `get-nonce/dist/es2015/index.js:2,9` |
| next-themes (transition suppression) | Yes — only on theme toggle with `disableTransitionOnChange` | runtime, on theme change | **yes** (the `nonce` prop is applied) | `next-themes/dist/index.mjs` |
| Framer Motion (`framer-motion@12`) | **No** in current usage — only `style={{}}` element attributes; `<style>` injection is gated behind `ViewTransition`/`mode="popLayout"`, neither used | n/a | n/a | `framer-motion/dist/framer-motion.dev.js` (ViewTransition @5820, PopChild @10518) |
| JSX `style={{…}}` element attrs (Radix positioning, Framer) | n/a — these are **style attributes**, governed by `style-src-attr` (falls back to `style-src`); `'unsafe-inline'` covers them | runtime | n/a | — |

**Reading:** the static document carries **no** inline `<style>`. The only
inline-style pressure is **runtime**: Radix's scroll-lock `<style>` (un-nonce'd
today) and inline `style` attributes for popover positioning. Both are covered
by `style-src 'unsafe-inline'` and **not** by a nonce — this is why `style-src`
cannot be nonce-only without wiring `setNonce()`.

### Table 3 — `connect-src` inventory

| Destination | Used by | Needed (prod) today? | Directive token |
|---|---|---|---|
| App origin `'self'` | Server Actions, RSC hydration, all same-origin fetch | yes | `'self'` |
| `https://<ref>.supabase.co` | REST + Auth + Storage — `lib/supabase/{client,server,admin}.ts`, `proxy.ts` | yes | derived from `NEXT_PUBLIC_SUPABASE_URL` |
| `wss://<ref>.supabase.co` | Supabase Realtime | **No (today)** — `RealtimeClient` is *constructed* in the Supabase client ctor but `connect()` is **only** called from `.channel().subscribe()`, and the app has **zero** `.channel()` calls | omit now; add when realtime lands (feature 003+) |
| `http://127.0.0.1:54321` (+ `ws://…`) | Local Supabase (dev) | dev only | dev policy only |
| `http://127.0.0.1:54324` (Mailpit) | **Test harness only** (`tests/e2e/helpers.ts:54`) — the app never connects to it | no | never in app CSP |

Verified: `@supabase/realtime-js` `RealtimeClient` ctor does not open a socket
(`RealtimeClient.js`); Phoenix `Socket` ctor leaves `conn` undefined until
`connect()`; `connect()` is reached only via `RealtimeChannel.subscribe()`.
**No `wss:` is needed in the Day-1 policy.**

**Recommendation — derive the Supabase origin from the validated env module**
(slice-4 already validates `NEXT_PUBLIC_SUPABASE_URL` with `z.url()`):
`new URL(clientEnv.supabaseUrl).origin` → `https://<ref>.supabase.co`. This
beats (a) hardcoding the project ref (breaks across staging/prod) and (b)
`https://*.supabase.co` (wildcard allows any Supabase project). When realtime is
adopted, the `wss://` origin derives from the same URL
(`.origin.replace(/^https/, 'wss')`).

**Forward-looking `connect-src` additions** (document only; do **not** add
today — none is installed): Sentry (`https://*.ingest.sentry.io`), PostHog
(`https://*.posthog.com`) — both in the locked stack (Constitution Technology
Stack table) but absent (slice-4 Audited-clean #10); the FastAPI backend
(feature 005); Groq / LM Studio LLM (feature 008). Each needs a `connect-src`
entry when adopted — and a slice-5 revisit.

### Table 4 — `img-src` inventory

| Source | Used? | Directive token |
|---|---|---|
| `<img>` / `next/image` / `<Image>` | **None anywhere** in app code (grep confirmed) | — |
| Radix `AvatarImage` (remote src) | **Not used** — avatars render `AvatarFallback` text initials only (`components/header/profile-dropdown.tsx`, `components/ui/avatar.tsx` `AvatarImage` exported but never imported) | — |
| Lucide icons | inline `<svg>` DOM elements (not `<img>`, not `data:` URIs) — not governed by `img-src` | — |
| Favicon | `app/favicon.ico`, same origin | `'self'` |
| `data:` image URIs / `blob:` / canvas | none found | — |

**Recommendation:** start strict at `img-src 'self'`. Whether to add `data:` is
the one open question where the two reviewers diverged (see Open questions) —
recommend `'self'` and let the Report-Only pass reveal any `data:` need.

### Table 5 — `font-src` inventory

| Source | Origin | Directive token |
|---|---|---|
| Inter + DM Serif Display (`next/font/google`) | self-hosted at build → served from `/_next/static/media/*.woff2` (same origin) | `'self'` |
| `https://fonts.gstatic.com` | **not used** — `next/font` self-hosts; no runtime Google Fonts request | — |

`font-src 'self'` suffices. No external font CDN.

---

## Proposed CSP

### Production (enforcing — end state)

```
default-src 'self';
script-src 'self' 'nonce-<RANDOM>' 'strict-dynamic';
style-src 'self' 'unsafe-inline';
img-src 'self';
font-src 'self';
connect-src 'self' https://<ref>.supabase.co;
object-src 'none';
base-uri 'self';
form-action 'self';
frame-src 'none';
frame-ancestors 'none';
upgrade-insecure-requests
```

Per-directive rationale:

| Directive | Value | Why |
|---|---|---|
| `default-src` | `'self'` | Restrictive fallback for any directive not explicitly set (`media-src`, `worker-src`, `manifest-src`, `child-src`, …). Anything unenumerated defaults to same-origin. |
| `script-src` | `'self' 'nonce-<RANDOM>' 'strict-dynamic'` | Per-request nonce covers the 2 app inline scripts + the 9 framework inline scripts (auto-stamped). `'strict-dynamic'` propagates trust to the chunk scripts the nonced bootstrap loads (Next loads `/_next/static/chunks/*.js` dynamically — enumerating them is infeasible). `'self'` is kept as a fallback for non-`'strict-dynamic'` browsers (ignored where `'strict-dynamic'` is honored). |
| `style-src` | `'self' 'unsafe-inline'` | `'self'` = Tailwind/font CSS bundle. `'unsafe-inline'` = Radix runtime `<style>` (scroll-lock) + inline `style` attributes for popover positioning. **No nonce** — a nonce would make the browser ignore `'unsafe-inline'` and break Radix. Lower-risk than on `script-src` (CSS ≠ code execution). |
| `img-src` | `'self'` | Favicon only; no `<img>`/remote/`data:` images today. |
| `font-src` | `'self'` | `next/font` self-hosts under `/_next/static/media/`. |
| `connect-src` | `'self' https://<ref>.supabase.co` | Same-origin fetch + Supabase REST/Auth/Storage. `<ref>` injected from the validated env. No `wss:` (no realtime today). |
| `object-src` | `'none'` | No plugins/embeds; blocks `<object>`/`<embed>` legacy vectors. |
| `base-uri` | `'self'` | Blocks `<base>` injection that would re-root relative URLs. |
| `form-action` | `'self'` | All forms post to same-origin Server Actions; no third-party form targets. |
| `frame-src` | `'none'` | App embeds no iframes (grep confirmed). |
| `frame-ancestors` | `'none'` | Clickjacking-proof; nobody may frame Serenify. The CSP equivalent of `X-Frame-Options: DENY`. |
| `upgrade-insecure-requests` | (flag) | Upgrades any stray `http:` subresource to `https:` in prod; no-op in dev (http origin, no mixed content). |

### Development delta

Dev (Turbopack) requires two relaxations, both verified against the bundled
Next CSP doc (`node_modules/next/dist/docs/01-app/02-guides/content-security-policy.md:42`
— "In development, `'unsafe-eval'` is required because React uses `eval` …; not
required for production"):

```
script-src  … add  'unsafe-eval'        # React dev eval (stack reconstruction). NOT in prod.
connect-src 'self' http://127.0.0.1:54321 ws://127.0.0.1:54321   # local Supabase
# HSTS: NOT set in dev (would poison localhost → forced https)
# upgrade-insecure-requests: harmless no-op over http
```

The implementation gates these on `process.env.NODE_ENV !== 'production'`,
matching Next's own documented pattern:
`script-src 'self' 'nonce-${nonce}' 'strict-dynamic'${isDev ? " 'unsafe-eval'" : ''}`.

> **WASM note (forward-looking):** feature 004 (webcam + rPPG) may ship an
> ONNX/WASM inference path. WebAssembly under a strict CSP needs
> `'wasm-unsafe-eval'` in `script-src` (bundled doc line 721). Add it then, not
> now.

---

## Proposed auxiliary security headers

All absent today. OWASP A05. Static headers belong in `next.config.ts`
`headers()` (applied to **all** responses including `/_next/static` assets,
which the `proxy.ts` matcher excludes); the per-request nonce-CSP belongs in
`proxy.ts`.

| Header | Value | Scope | Location | Why |
|---|---|---|---|---|
| `Strict-Transport-Security` | `max-age=63072000; includeSubDomains` | **prod only** | `next.config.ts` (NODE_ENV branch) or `proxy.ts` | Forces HTTPS for 2 years. **`preload` deferred** (see below). Must be prod-only — HSTS on `localhost` forces `http→https` and breaks dev. |
| `X-Content-Type-Options` | `nosniff` | always | `next.config.ts` | Stops MIME sniffing. |
| `X-Frame-Options` | `DENY` | always | `next.config.ts` | Old-browser backstop to `frame-ancestors 'none'` (deprecated but harmless). |
| `Referrer-Policy` | `strict-origin-when-cross-origin` | always | `next.config.ts` | Sends only origin (no path/query) cross-origin — keeps `?next=`/reset tokens out of third-party `Referer`. Functionally equal to `same-origin` here (no third-party scripts), and is the modern default. |
| `Permissions-Policy` | `camera=(), microphone=(), geolocation=(), payment=(), usb=(), interest-cohort=()` | always | `next.config.ts` | Deny-by-default for powerful features. **camera/microphone relaxed by feature 004/013** when they land (scope to the capture routes, don't pre-enable). |
| `X-XSS-Protection` | `0` | always | `next.config.ts` | Explicitly **disables** the legacy auditor (removed from Chrome 2019; was exploitable as a data-exfil oracle on old IE). |
| `Cross-Origin-Opener-Policy` | `same-origin` | always | `next.config.ts` | Severs `window.opener` cross-origin. No `window.open`/OAuth-popup flows exist (Supabase uses redirect callback), so safe. |
| `Cross-Origin-Resource-Policy` | `same-origin` | always | `next.config.ts` | App serves no cross-origin-embeddable resources. |
| `Cross-Origin-Embedder-Policy` | **SKIP** | — | — | `require-corp` would break Supabase cross-origin fetch/WebSocket (Supabase sends no CORP header). No `SharedArrayBuffer`/WASM-thread need today. |

**HSTS `preload` deferral.** `preload` is a near-irreversible commitment
(removal washes out of browser-baked lists over 6–12 months) and, with
`includeSubDomains`, would make any HTTP `serenify.tech` subdomain (a future
staging/tooling host) permanently unreachable for users who received the
preload entry. Ship `includeSubDomains` (which already qualifies the domain for
preload) **without** `preload`; add `preload` only after a conscious audit that
every subdomain is HTTPS-ready. The Supabase cloud (`*.supabase.co`) is a
different apex and is unaffected.

---

## Implementation plan (fix pass — described, not applied)

Five files. The CSP nonce is per-request → middleware; everything static →
`next.config.ts`.

### 1. `apps/web/proxy.ts` — generate nonce, set CSP on request **and** response

Verified mechanism (`node_modules/next/dist/esm/server/app-render/`):
- `get-script-nonce-from-header.js:1` — Next parses the nonce from the **request**
  CSP header with `CSP_NONCE_SOURCE_REGEX = /^'nonce-([A-Za-z0-9+/_-]+={0,2})'$/`,
  checking `script-src` then `default-src`.
- `app-render.js` — reads `headers['content-security-policy']` (the *request*
  header), threads the nonce into the Fizz renderer + the flight-payload stream
  (`use-flight-response.js`), so every `__next_f`/`__next_r` script is stamped.

Therefore the CSP must be set on **both** the forwarded request headers (so Next
stamps its scripts) **and** the response (so the browser enforces). Sketch:

```ts
// top of proxy(), before any routing branch:
const nonce = Buffer.from(crypto.randomUUID()).toString("base64");
const isDev = process.env.NODE_ENV !== "production";
const supabaseOrigin = new URL(clientEnv.supabaseUrl).origin;
const csp = [
  "default-src 'self'",
  `script-src 'self' 'nonce-${nonce}' 'strict-dynamic'${isDev ? " 'unsafe-eval'" : ""}`,
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self'",
  "font-src 'self'",
  `connect-src 'self' ${supabaseOrigin}${isDev ? " http://127.0.0.1:54321 ws://127.0.0.1:54321" : ""}`,
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "frame-src 'none'",
  "frame-ancestors 'none'",
  "upgrade-insecure-requests",
].join("; ");

const requestHeaders = new Headers(request.headers);
requestHeaders.set("x-nonce", nonce);              // convenience for Server Components
requestHeaders.set("content-security-policy", csp); // <- what Next parses to stamp scripts

// initial response carries the request-header override AND the response CSP:
let response = NextResponse.next({ request: { headers: requestHeaders } });
response.headers.set("content-security-policy", csp);
```

Integration points (must each preserve both headers):
- **Supabase `setAll`** re-creates `response` via `NextResponse.next({ request })`
  — update it to `NextResponse.next({ request: { headers: requestHeaders } })`
  and re-set the response CSP, else the nonce override is lost.
- **The four early redirect returns** (`proxy.ts:81,89,106,113`) — set the CSP on
  each `NextResponse.redirect(url)` for consistency (defense-in-depth).
- **`config.matcher`** — already correctly scoped to HTML routes (excludes
  `_next/static`, `_next/image`, favicon, image extensions; static assets don't
  need their own CSP — they're governed by the document policy). **Recommend
  widening to the object form with `missing` filters** to skip RSC prefetch
  requests (per the bundled doc), so the CSP isn't set on non-document responses:
  `missing: [{type:'header',key:'next-router-prefetch'},{type:'header',key:'purpose',value:'prefetch'}]`.
- **Report-Only first:** the fix pass initially uses the header name
  `content-security-policy-report-only` (Next parses the nonce from *either*
  header — `app-render.js` checks both), then renames to
  `content-security-policy` to enforce. Header *value* is identical.

### 2. `apps/web/app/layout.tsx` — async, nonce the migration script, thread to Providers

- Make `RootLayout` **`async`** (currently sync) to `await headers()` — `headers()`
  is async in Next 16 (DECISIONS 2026-05-17 Next-16 entry).
- `const nonce = (await headers()).get("x-nonce") ?? undefined;`
- Add `nonce={nonce}` to the existing theme-migration `<script>` (`layout.tsx:42`).
- `<Providers nonce={nonce}>`.
- (`?? undefined`, not `null`, so React omits the attribute on a non-matched
  request rather than rendering `nonce="null"`.)

### 3. `apps/web/app/providers.tsx` — forward nonce to next-themes

`"use client"` can't read `headers()`, so accept a `nonce?: string` prop and pass
`<ThemeProvider nonce={nonce} …>`. next-themes 0.4.6 applies it to its FOUC
`<script>` (server-side) and its transition `<style>`
(`next-themes/dist/index.d.ts:45`, `index.mjs`).

### 4. `apps/web/next.config.ts` — static aux headers via `headers()`

Add an async `headers()` returning the auxiliary-header table above for
`source: "/(.*)"`. HSTS gated on `process.env.NODE_ENV === "production"`. **No
CSP here** (it's per-request → middleware only).

### 5. (no code) — `react-remove-scroll` stays un-nonce'd

Covered by `style-src 'unsafe-inline'`. **Future hardening** to a nonce'd
`style-src`: call `setNonce(nonce)` from `get-nonce` in an early client bootstrap
(before any Radix overlay mounts), drop `'unsafe-inline'`, add `'nonce-…'` to
`style-src`. Deferred — `'unsafe-inline'` on `style-src` is an accepted low risk.

---

## Rollout playbook (the fix pass executes this)

1. **Report-Only.** Implement the policy as `Content-Security-Policy-Report-Only`
   (browser logs violations, blocks nothing). Build for **production**
   (`next build && next start`) — the authoritative inline-script set differs
   from dev (no HMR, no `'unsafe-eval'`).

2. **Drive every route + capture violations.** A throwaway Playwright spec
   (`tests/e2e/_slice5-csp.spec.ts`, **not committed** — deleted after) navigates
   all 8 routes (`/`, `/login`, `/signup`, `/forgot-password`, `/reset-password`,
   `/onboarding`, `/app`, `/app/account`) using the seeded `globalSetup` admin for
   the authed routes, and **interacts** with overlay components — open the profile
   dropdown on `/app` and a Radix dialog — to trigger the runtime `<style>`
   injection from `react-remove-scroll`. Capture both channels:
   - `page.on("console", msg => …)` — matches the human text `Refused to … because
     it violates the following Content Security Policy directive: "…"`.
   - `page.addInitScript(() => window.addEventListener("securitypolicyviolation",
     e => …))` — structured fields `violatedDirective`, `blockedURI`,
     `sourceFile`, `lineNumber`, `disposition` (`"report"` under Report-Only).
     `addInitScript` runs before page scripts so it catches parse-time inline
     violations.

   Run chromium for the capture pass (most structured CSP console output):
   `npx playwright test _slice5-csp --project=chromium --workers=1 --reporter=list`.
   Capture the violation list **verbatim** into the fix-pass section of this doc.

3. **Resolve.** For each violation: app inline script → add the nonce; framework
   script → confirm auto-stamped (should not appear if the request CSP is set
   correctly); Radix/inline `<style>` → confirm covered by `'unsafe-inline'`;
   Supabase fetch → confirm the `connect-src` origin matches the **prod** env;
   unexpected origin → **do not** allowlist — investigate (browser extension noise
   is excluded by Playwright's isolated context).

4. **Flip to enforcing.** Rename `…-Report-Only` → `Content-Security-Policy`
   (value unchanged). Re-run the **full** e2e matrix (chromium/firefox/webkit,
   `workers:1` per DECISIONS) to confirm zero breakage. Watch for the documented
   load-timing flakes (firefox `cross-tab-auth-sync`, webkit `reset-password`,
   trailing exit-1 after "N passed") — reproduce on the pre-change commit before
   attributing any failure to CSP.

5. **Document.** Append a `docs/DECISIONS.md` slice-5 entry (nonce-script /
   unsafe-inline-style choice; HSTS preload deferral; COEP skip; Permissions-Policy
   camera/mic deferral; the forward-looking telemetry-PII note) and a
   `docs/CHANGELOG.md` entry. Delete the throwaway spec.

---

## Audited and clean

Affirmative record — surfaces examined that need **no** CSP change or are
already correct.

1. **No CSP/security headers today** — confirmed by grep; clean slate, no
   partial/conflicting state to reconcile.
2. **No `styled-jsx`** (`<style jsx>`) anywhere — no runtime styled-jsx
   `<style>` to nonce (grep confirmed).
3. **No `<img>`/`next/image`/`<Image>`** anywhere — `img-src 'self'` suffices;
   no remote-image allowlist or `images.remotePatterns` to align.
4. **Avatars are text initials** (`AvatarFallback`), not remote `AvatarImage` —
   no avatar image host needed.
5. **`next/font` self-hosts** — `font-src 'self'`; no `fonts.gstatic.com`; and no
   inline `<style>` from fonts in the App Router prod path.
6. **No iframes, web workers, or service workers** (grep confirmed) — `frame-src
   'none'`, and `worker-src`/`manifest-src` safely inherit `default-src 'self'`.
7. **No Supabase realtime socket today** — `connect-src` needs no `wss:`
   (verified: socket opens only on `.channel().subscribe()`, which the app never
   calls).
8. **Framer Motion uses element `style` attributes, not `<style>` injection** in
   current usage — covered by `'unsafe-inline'` (style-attr); no Framer-specific
   directive.
9. **`proxy.ts` matcher already excludes static assets** — the CSP-bearing scope
   is the HTML document responses, which is correct; static JS/CSS/img don't carry
   (or need) their own CSP.
10. **Single `dangerouslySetInnerHTML`** is the static migration IIFE
    (slice-3 Audited-clean #13) — the one app inline script needing a manual
    nonce; no user input flows into it.

---

## Out of scope this slice

- **Telemetry PII scrubbing** — Sentry/PostHog are **not installed** (slice-4
  Audited-clean #10), so there is nothing to scrub. The fix-pass DECISIONS entry
  records the **forward-looking** policy only: *when* Sentry/PostHog are adopted,
  they will need (a) `connect-src` ingest origins added here, and (b) PII
  scrubbing config (`beforeSend`/session-recording masking). No telemetry code
  investigation runs in this slice.
- **Wiring `setNonce()` for a nonce'd `style-src`** — deferred; `'unsafe-inline'`
  on `style-src` is the accepted Day-1 posture.
- **CSP violation *reporting endpoint*** (`report-uri`/`report-to` + a collector)
  — not set up this slice; the rollout uses browser-console/DOM-event capture in
  Playwright instead. A production `report-to` endpoint is a later ops item.
- **Dependency audit** → slice 6. **Rate-limit quota deep-dive** → slice 7.
- **`proxy.ts` routing logic** — audited in slice 2; this slice only *adds* the
  CSP/header response, it does not change routing.
- **Production CDN / Vercel platform headers** — Vercel may inject some headers
  (e.g. HSTS) at the edge; that is platform config, not repo config, and is
  Mohamed's to verify in the dashboard (the slice-2/4 Cloud-parity caveat stands).
- **Feature 004+ resource types** (camera/mic permissions, WASM `'wasm-unsafe-eval'`,
  realtime `wss:`, FastAPI/LLM `connect-src`) — each needs a CSP revisit when the
  feature lands; flagged inline above.

---

## Verification approach

Commands and snippets a future Claude can re-run.

### Empirical inline-script/style capture (this audit, dev)

```bash
# (dev server already running on :3000)
curl -s http://localhost:3000/login -o login_capture.html
# count + classify inline <script> (no src) and inline <style>:
node -e 'const h=require("fs").readFileSync("login_capture.html","utf8");
  let n=0; h.replace(/<script(?![^>]*\bsrc=)[^>]*>([\s\S]*?)<\/script>/g,(_,b)=>{n++;console.log("#"+n,b.slice(0,80))});
  console.log("inline scripts:",n);
  console.log("inline styles:",(h.match(/<style[^>]*>/g)||[]).length);'
```

Result this audit: **11 inline scripts** (2 app, 9 framework), **0 inline
`<style>`**. *The fix pass MUST re-run this against a production build*
(`next build && next start`) for the authoritative set.

### Framework/library claims (verified against `node_modules`, repo-root hoisted)

```bash
# Next 16 nonce mechanism + dev unsafe-eval:
sed -n '1,20p' node_modules/next/dist/esm/server/app-render/get-script-nonce-from-header.js
grep -n "unsafe-eval" node_modules/next/dist/docs/01-app/02-guides/content-security-policy.md
# next-themes nonce prop:
grep -n "nonce" node_modules/next-themes/dist/index.d.ts
# Radix runtime <style> injection + nonce hook:
grep -n "createElement('style')\|setAttribute('nonce'" node_modules/react-style-singleton/dist/es2015/singleton.js
grep -n "setNonce\|__webpack_nonce__" node_modules/get-nonce/dist/es2015/index.js
# Supabase realtime is lazy (no proactive socket):
grep -n "connect()" node_modules/@supabase/realtime-js/dist/main/RealtimeChannel.js
```

Verbatim confirmations obtained this audit:
- `CSP_NONCE_SOURCE_REGEX = /^'nonce-([A-Za-z0-9+/_-]+={0,2})'$/`; directive
  `script-src` then `default-src` fallback.
- bundled doc: "*In development, `'unsafe-eval'` is required … not required for
  production.*"
- `next-themes` `nonce?: string` at `index.d.ts:45`.
- `react-style-singleton`: `document.createElement('style')` + conditional
  `setAttribute('nonce', nonce)`; `get-nonce` reads `setNonce()` then
  `__webpack_nonce__` (un-set under Turbopack/SWC).

### Report-Only violation capture (fix pass)

Throwaway `tests/e2e/_slice5-csp.spec.ts` (deleted after the run): for each of
the 8 routes, attach `page.on("console", …)` filtering on `Content Security
Policy` and `page.addInitScript` adding a `securitypolicyviolation` listener;
open the profile dropdown + a dialog on `/app`; collect violations grouped by
`violatedDirective`. Run `npx playwright test _slice5-csp --project=chromium
--workers=1 --reporter=list`; iterate the policy until zero violations; then flip
to enforcing and run the full matrix `npx playwright test --workers=1`.

---

## Open questions for review

1. **`img-src 'self'` vs `'self' data:`** — the two reviewers diverged. There are
   zero images today, so strict `'self'` is least-privilege and the Report-Only
   pass will surface any `data:` need (e.g. a future blur-placeholder). Recommend
   `'self'`; trivial to add `data:` if a violation appears. **Decision needed.**
2. **`default-src 'self'` vs `'none'`** — `'self'` (chosen, per the slice brief)
   is the forgiving fallback for unenumerated directives; `'none'` is stricter but
   requires enumerating `worker-src`/`manifest-src`/`media-src` etc. Recommend
   `'self'` for the first enforcing rollout, tighten to `'none'` later if desired.
3. **HSTS `preload`** — confirm the deferral (ship `includeSubDomains` without
   `preload` until all `serenify.tech` subdomains are audited HTTPS-ready).
4. **Header placement** — static aux headers in `next.config.ts` `headers()` (so
   `/_next/static` assets also get `nosniff`), CSP nonce in `proxy.ts`. Confirm
   this split vs. all-in-middleware.
```
