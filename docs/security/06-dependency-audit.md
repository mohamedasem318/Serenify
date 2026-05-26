# Security Slice 6 — Dependency Audit

> **Audit-only.** This document records findings; it applies **no** fixes. No
> `package.json` change, no lockfile update, no `npm audit fix`, no version bump
> is in the commit that introduces this doc. Mohamed reviews these with claude.ai,
> decides which updates to apply (and in what order), and a follow-up Claude Code
> session lands the approved changes on this same branch
> (`security/06-dependency-audit`).

## Summary

This slice audits the dependency posture under **OWASP A06 — Vulnerable and
Outdated Components**: the `npm audit` baseline, direct-dependency freshness, the
transitive surface, version-pin policy, build-time-vs-runtime classification, and
supply-chain hygiene (install scripts, maintainers, typosquats, `node_modules`
artifacts).

The package manager is **npm with workspaces** (DECISIONS 2026-05-17): one root
`package-lock.json`, two manifests (`package.json` root + `apps/web/package.json`),
one populated workspace (`apps/web`; no `packages/` yet). Toolchain at audit time:
**Node 22.11.0 / npm 10.9.0**.

**Headline posture: clean, with zero runtime-reachable vulnerabilities.**

- **`npm audit`: 4 moderate, 0 critical / 0 high / 0 low.** The 4 collapse to **2
  distinct advisories**, each double-counted (once on the vulnerable transitive
  node, once on the flagged direct parent). **Both are dev/build-time only;
  neither is reachable in production runtime** — verified against the advisory
  text, not just the package name (both GHSA pages were fetched). The production
  runtime dependency set (94 prod packages: `next` runtime, `react`,
  `@supabase/*`, `@radix-ui/*`, `zod`, `framer-motion`, `lucide-react`) carries
  **zero** advisories.
- **Freshness: strong.** Every dependency whose specific version a prior security
  slice relied upon is **exactly on its registry-`latest`**: `next` 16.2.6,
  `zod` 4.4.3, `@supabase/ssr` 0.10.3, `next-themes` 0.4.6, and all five
  `@radix-ui/*`. The two riskiest theoretical upgrades — a **zod major** (would
  threaten the slice-5 jitless barrel) and a **Next major** (would risk CSP-nonce
  regression) — are **not pending**: no zod 5 and no Next 17 is published or
  roadmapped (npm `canary` is only Next 16.3.0). The freshness gaps that exist
  are all routine and **none is security-driven**.
- **Supply chain: clean.** All five install/postinstall scripts in the tree were
  **read verbatim** and are legitimate prebuilt-binary placement (esbuild, sharp,
  unrs-resolver); `gypfile:true` is absent (no `node-gyp` source compilation). No
  typosquats, no known-malicious package names, no `.npmrc`/`.env` leaked inside
  any installed package.

**Slice-6 actionable findings:** `low` 2 (F1 dependency-classification, F2
pin-documentation). Plus the two npm advisories, each presented with a recommended
action (one has a clean non-breaking fix; one is a documented accept). **Zero**
runtime-reachable advisories.

| # | Title | Severity |
|---|-------|----------|
| F1 | Four bundle-/build-required packages (`clsx`, `tailwind-merge`, `class-variance-authority`, `server-only`) are declared under `apps/web` `devDependencies` — a production-scoped audit (`npm audit --omit=dev`) silently excludes them, and a `--omit=dev` install breaks `next build` | low |
| F2 | Two correct-but-undocumented exact pins (`react`/`react-dom`, `@faker-js/faker`) have no DECISIONS entry — a future maintainer could "helpfully" un-pin them (faker un-pin shifts the demo-seed cohort) | low |
| A1 | `esbuild` dev-server advisory (GHSA-67mh-4wv8-2f99) reached via `tsx` — **not runtime-reachable**; clean non-breaking fix available (`tsx@4.22.3`) | moderate (advisory) · not reachable |
| A2 | `postcss` `</style>` XSS advisory (GHSA-qx2v-qp2m-jg93) reached via `next` — **not runtime-reachable**; only offered fix is a non-viable Next downgrade | moderate (advisory) · not reachable |

---

## Audit inventory — verbatim `npm audit`

Run from repo root (single root lockfile covers all workspaces):

```
# npm audit report

esbuild  <=0.24.2
Severity: moderate
esbuild enables any website to send any requests to the development server and read the response - https://github.com/advisories/GHSA-67mh-4wv8-2f99
fix available via `npm audit fix --force`
Will install tsx@4.22.3, which is outside the stated dependency range
node_modules/tsx/node_modules/esbuild
  tsx  3.13.0 - 4.19.2
  Depends on vulnerable versions of esbuild
  node_modules/tsx

postcss  <8.5.10
Severity: moderate
PostCSS has XSS via Unescaped </style> in its CSS Stringify Output - https://github.com/advisories/GHSA-qx2v-qp2m-jg93
fix available via `npm audit fix --force`
Will install next@9.3.3, which is a breaking change
node_modules/next/node_modules/postcss
  next  9.3.4-canary.0 - 16.3.0-canary.5
  Depends on vulnerable versions of postcss
  node_modules/next

4 moderate severity vulnerabilities

To address all issues (including breaking changes), run:
  npm audit fix --force
```

`audit.json` rollup (verbatim):

```
vulnerabilities: { info:0, low:0, moderate:4, high:0, critical:0, total:4 }
dependencies:    { prod:94, dev:573, optional:160, peer:21, peerOptional:0, total:702 }
```

**The headline `npm audit` text is misleading about scope** — it lists `tsx
3.13.0 - 4.19.2` and `next 9.3.4-canary.0 - 16.3.0-canary.5` as the affected
ranges, which reads as "your whole Next/tsx install is vulnerable." It is not. The
`npm ls` tree shows that only **one specific transitive copy** of each underlying
package is on the vulnerable version; the hoisted/shared copies are already
patched. The per-advisory analysis below pins down the exact vulnerable node.

---

## Per-advisory analysis

### A1 — esbuild dev-server request smuggling (GHSA-67mh-4wv8-2f99)

| Field | Value |
|---|---|
| GHSA | GHSA-67mh-4wv8-2f99 |
| CVSS | 5.3 moderate · `AV:N/AC:H/PR:N/UI:R/S:U/C:H/I:N/A:N` |
| CWE | CWE-346 (Origin Validation Error) |
| Vulnerable range | `esbuild <= 0.24.2` |
| **Vulnerable node** | `node_modules/tsx/node_modules/esbuild` @ **0.23.1** (pinned by `tsx@4.19.2` as `esbuild ~0.23.0`) |
| Parent direct dep | `tsx` 4.19.2 — root `devDependency`, runs `scripts/seed-demo.ts` (local seed CLI) |
| Other esbuild copy | `esbuild@0.25.12` (via `vite` ← `vitest`) — **0.25.12 > 0.24.2, not vulnerable, not flagged** |
| Reachable in production runtime? | **No** |
| Fix path | **Non-breaking** — `tsx@4.22.3` (`isSemVerMajor: false`; bumps esbuild `~0.23 → 0.25`) |

**Reachability — dev/build-only, vulnerable code path never invoked.** The
advisory is scoped to **esbuild's development server (the `serve` API) only**: the
exploit requires `esbuild serve` to be running locally while a victim visits a
malicious site, which then reads compiled bundles off `http://127.0.0.1:<port>`.
`tsx` uses esbuild solely as a one-shot TypeScript **transform** to run a script —
it never starts esbuild's HTTP dev server. A grep of `scripts/` for
`serve`/`context`/esbuild server usage returns **zero** hits. `tsx` is a root
`devDependency` run manually by a developer against the demo-seed CLI; it is never
installed or executed in production (Next's `next build`/`next start` never touch
`tsx`). The vulnerable code path is therefore not exercised in **any** environment
here.

**Recommended action — optional, non-security-required, but the one advisory with
a clean fix.** Bump `tsx` to `4.22.3` to clear the audit line. Note `tsx` is
**exact-pinned `4.19.2`** by DECISIONS 2026-05-18 (deterministic toolchain; a
*major* bump risks ESM path-resolution drift). `4.22.3` is a **minor** bump, not
the major that decision guards against, so the bump is compatible with the stated
rationale. Alternatively, **defer with a documented justification** (the path is
unreachable) — equally defensible. Either way: not a production exposure.

### A2 — PostCSS `</style>` stringify XSS (GHSA-qx2v-qp2m-jg93)

| Field | Value |
|---|---|
| GHSA | GHSA-qx2v-qp2m-jg93 (CVE-2026-41305) |
| CVSS | 6.1 moderate · `AV:N/AC:L/PR:N/UI:R/S:C/C:L/I:L/A:N` |
| CWE | CWE-79 (XSS) |
| Vulnerable range | `postcss < 8.5.10` |
| **Vulnerable node** | `node_modules/next/node_modules/postcss` @ **8.4.31** (vendored/pinned by `next@16.2.6`) |
| Parent direct dep | `next` 16.2.6 — `apps/web` production framework |
| Other postcss copy | `postcss@8.5.14` (hoisted, shared by `vite` + `@tailwindcss/postcss@4.3.0`) — **8.5.14 ≥ 8.5.10, not vulnerable, not flagged** |
| Reachable in production runtime? | **No** |
| Fix path | **Breaking / non-viable** — `npm audit fix --force` offers only `next@9.3.3` (`isSemVerMajor: true`; a catastrophic 16 → 9 downgrade) |

**Reachability — build-time only, attacker-input precondition structurally
absent.** The advisory requires processing **attacker-controlled CSS**: it triggers
when user-submitted CSS is parsed and re-stringified for embedding in a `<style>`
tag, where `</style>` in a CSS value breaks out of the style context. The advisory
explicitly scopes the impact to **non-bundler use cases**. Serenify's `next`-bundled
postcss runs at **build time** on **first-party** stylesheets (Tailwind v4 +
`globals.css`) — exactly the bundler use case the advisory excludes. The app never
accepts user-submitted CSS, never parses untrusted CSS through postcss, and never
re-stringifies CSS into a runtime `<style>`. The precondition is absent.

**Recommended action — accept; carry forward the existing adjudication.** This
advisory was **already adjudicated** in DECISIONS 2026-05-17 ("npm audit: postcss
XSS advisory ignored"): the only offered fix downgrades Next to 9.3.3 (non-viable),
and the vulnerability is not on a code path the app exercises. **Do not run
`npm audit fix --force`.** Revisit when a Next 16.x patch (or the next major) ships
a bumped bundled postcss — re-run `npm audit` and re-triage at that point.
*(Incidental note: 8.4.31 is also the postcss version that patched the earlier
line-return ReDoS GHSA-7fh5-64p2-3v2j, so Next's pin sits on a safe floor for that
separate issue.)*

### Severity rollup

| Severity | Advisories (npm-counted) | Distinct | Runtime-reachable | Dev/build/test-only |
|---|---|---|---|---|
| critical | 0 | 0 | 0 | 0 |
| high | 0 | 0 | 0 | 0 |
| moderate | 4 | 2 (esbuild, postcss) | **0** | **2** |
| low | 0 | 0 | 0 | 0 |
| info | 0 | 0 | 0 | 0 |

---

## Direct-dependency freshness table

Deduped across both manifests (`@supabase/supabase-js`, `dotenv`, `vitest` appear
in root + `apps/web`). "latest major" is filled only where a **higher** major
exists on the registry. Rows marked *on latest* were absent from `npm outdated`
(installed already equals registry `latest`); the slice-sensitive runtime deps were
additionally confirmed by `npm view <pkg> version`. **None of the gaps below is
security-driven** — no advisory targets any of these versions (the only dev-only
advisory, esbuild-via-`tsx`, is covered in A1).

| Dependency | Current | Latest stable | Higher major | Gap | Security-relevant changelog note | Action |
|---|---|---|---|---|---|---|
| **`apps/web` runtime** | | | | | | |
| `next` | 16.2.6 | 16.2.6 | — | on latest | CSP nonce auto-stamping intact (slice 5) | hold |
| `react` | 19.2.4 | 19.2.6 | — | patch (exact-pin) | none (bug-fix patch) | hold — move atomically with Next |
| `react-dom` | 19.2.4 | 19.2.6 | — | patch (exact-pin) | none (bug-fix patch) | hold — move atomically with Next |
| `@supabase/ssr` | 0.10.3 | 0.10.3 | — | on latest | slice-2 cookie behaviour audited at this version | hold |
| `@supabase/supabase-js` | 2.105.4 | 2.106.2 | — | minor | none — 2.106.x = opt-in OTel trace-context + OAuth client-id encoding + RN/Hermes fixes; **no cookie/session/SSR-auth change** | update (low priority) |
| `@hookform/resolvers` | 5.2.2 | 5.4.0 | — | minor | none (resolver-adapter fixes) | update (range-satisfiable) |
| `react-hook-form` | 7.76.0 | 7.76.1 | — | patch | none | update (range-satisfiable) |
| `zod` | 4.4.3 | 4.4.3 | — | on latest | jitless barrel intact; see slice-sensitive note | hold |
| `@radix-ui/react-avatar` | 1.1.11 | 1.1.11 | — | on latest | n/a | hold |
| `@radix-ui/react-dialog` | 1.1.15 | 1.1.15 | — | on latest | runtime `<style>` scroll-lock unchanged | hold |
| `@radix-ui/react-dropdown-menu` | 2.1.16 | 2.1.16 | — | on latest | n/a | hold |
| `@radix-ui/react-separator` | 1.1.8 | 1.1.8 | — | on latest | n/a | hold |
| `@radix-ui/react-slot` | 1.2.4 | 1.2.4 | — | on latest | n/a | hold |
| `framer-motion` | 12.40.0 | 12.40.0 | — | on latest | n/a | hold |
| `lucide-react` | 1.16.0 | 1.16.0 | — | on latest | n/a (1.x is the genuine Lucide major) | hold |
| `next-themes` | 0.4.6 | 0.4.6 | — | on latest | `nonce` prop honored (≥0.4.6) | hold |
| **`apps/web` build / test (dev)** | | | | | | |
| `typescript` | 5.9.3 | 5.9.3 (`^5`) | **6.0.3** | major (out of range) | none (dev compiler); caret `^5` deliberately excludes TS 6 | hold — separate migration |
| `@types/node` | 20.19.41 | 20.19.41 (`^20`) | **25.9.1** | major (out of range) | none (types only); tracks an older Node typings line | hold (intentional) |
| `@types/react` | 19.2.14 | 19.2.15 | — | patch | none (types only) | update (range-satisfiable) |
| `@types/react-dom` | on latest | on latest | — | on latest | none (types only) | hold |
| `@playwright/test` | on latest | on latest | — | on latest | n/a (test) | hold |
| `@tailwindcss/postcss` | 4.3.0 (`^4`) | on latest | — | on latest | n/a (build) | hold |
| `tailwindcss` | on latest (`^4`) | on latest | — | on latest | n/a (build) | hold |
| `tw-animate-css` | on latest | on latest | — | on latest | n/a (build) | hold |
| `@vitejs/plugin-react` | on latest | on latest | — | on latest | n/a (test transform) | hold |
| `@testing-library/jest-dom` | on latest | on latest | — | on latest | n/a (test) | hold |
| `@testing-library/react` | on latest | on latest | — | on latest | n/a (test) | hold |
| `@testing-library/user-event` | on latest | on latest | — | on latest | n/a (test) | hold |
| `happy-dom` | on latest (`^20`) | on latest | — | on latest | old majors had eval-RCE advisories; `^20` unaffected (test-only regardless) | hold |
| `jsdom` | on latest (`^27`) | on latest | — | on latest | n/a (test) | hold |
| `eslint` | on latest (`^9`) | on latest | — | on latest | n/a (lint) | hold |
| `eslint-config-next` | on latest (`^16.2.6`) | on latest | — | on latest | n/a (lint) | hold |
| `class-variance-authority` | on latest | on latest | — | on latest | n/a — **but see F1 (mis-declared as dev)** | hold (+ reclassify) |
| `clsx` | on latest | on latest | — | on latest | n/a — **but see F1** | hold (+ reclassify) |
| `tailwind-merge` | on latest | on latest | — | on latest | n/a — **but see F1** | hold (+ reclassify) |
| `server-only` | 0.0.1 | 0.0.1 | — | on latest | n/a (build guard) — **but see F1** | hold (+ reclassify) |
| `dotenv` (web) | on latest (`^17.4.2`) | on latest | — | on latest | n/a | hold |
| **root (dev)** | | | | | | |
| `tsx` | 4.19.2 | 4.22.3 | — | minor (exact-pin) | carries the A1 esbuild advisory (dev-only, unreachable); minor fix available | see A1 |
| `@faker-js/faker` | 9.2.0 | 9.9.0 | — | minor (exact-pin) | none — pin is determinism-driven (see F2) | hold |
| `cross-env` | 7.0.3 | 7.0.3 (`^7`) | **10.1.0** | major (out of range) | none (dev script shim); v8+ went ESM-only | hold |
| `vitest` | 4.1.6 | 4.1.7 | — | patch | none (test) | update (range-satisfiable) |
| `@supabase/supabase-js` (root) | 2.105.4 | 2.106.2 | — | minor | same as web row (dev/seed copy) | update (low priority) |
| `dotenv` (root) | on latest (`^17.4.2`) | on latest | — | on latest | n/a | hold |

**Net freshness posture:** 5 deps are a range-satisfiable patch/minor behind
(`@supabase/supabase-js`, `@hookform/resolvers`, `react-hook-form`, `@types/react`,
`vitest`) — all routine, none security. 3 hold a higher **out-of-range** major
intentionally (`typescript` 6, `@types/node` 25, `cross-env` 10). 2 exact pins are
minor-behind by design (`tsx`, `@faker-js/faker`). Everything else is exactly on
`latest`.

---

## Slice-5-sensitive deps

Explicit callout for the dependencies whose **specific version behaviour** a prior
security slice relied on. The question for each: does the **latest** version (which
the project is on, in every case below except the Supabase client) still honor the
slice invariant?

| Dep | Installed | Latest | Slice invariant | Verdict |
|---|---|---|---|---|
| `next` | 16.2.6 | **16.2.6** | Next 16 auto-stamps the per-request nonce onto the streamed `__next_f` flight scripts (slice-5 CSP DECISIONS choice 1) | **On latest — invariant holds.** No version movement could have regressed it. No Next 17 published or roadmapped; `canary` is 16.3.0. |
| `zod` | 4.4.3 | **4.4.3** | jitless barrel `z.config({ jitless: true })` keeps `script-src` free of `'unsafe-eval'` (slice-5 DECISIONS choice 2) | **On latest — invariant holds.** No zod 5 published or announced; the jitless-API-change risk is dormant. (See forward-looking robustness note in Out of scope.) |
| `@supabase/ssr` | 0.10.3 | **0.10.3** | the `httpOnly:false` / `SameSite=Lax` cookie behaviour audited in slice 2 lives here | **On latest — invariant holds.** Cookie/session logic has not moved since the slice-2 audit. |
| `@supabase/supabase-js` | 2.105.4 | 2.106.2 | (cookie behaviour lives in `@supabase/ssr`, not this package) | **One minor behind — slice-2-safe either way.** 2.106.x = opt-in OTel + OAuth/RN fixes; **no** cookie/session/SSR-auth change. Optional routine bump. |
| `next-themes` | 0.4.6 | **0.4.6** | the `nonce` prop (≥0.4.6) lets the FOUC `<script>` carry the CSP nonce (slice 5) | **On latest — invariant holds.** |
| `@radix-ui/*` (all 5) | as installed | **identical** | the runtime `<style>` scroll-lock injection (`react-remove-scroll`) underpins the `style-src 'unsafe-inline'` decision (slice 5) | **All exactly on latest — invariant holds.** No pending bump threatens the inline-style assumption. |

**Affirmative bottom line:** every dependency the CSP/cookie slices depend on is
**at its newest published version**. The two upgrades that *would* require slice
re-validation — a **zod major** (jitless API) and a **Next major** (CSP nonce
stamping) — are **not on the table today**: neither a zod 5 nor a Next 17 exists.
When either ships, slices 5 (CSP) and 2 (cookies) must be re-verified before the
bump merges.

---

## Pin-policy assessment

Inspected both manifests for pin style.

- **Caret (`^`) by default**, with **deliberate exact pins** in two tiers:
  - **Framework core** — `next` `16.2.6`, `react` `19.2.4`, `react-dom` `19.2.4`
    (`apps/web`). The React triple moves atomically with Next per `create-next-app`
    convention.
  - **Determinism-critical toolchain** — `tsx` `4.19.2` and `@faker-js/faker`
    `9.2.0` (root).
- **No wildcards** (`*` / `latest`) anywhere in either manifest. This is the most
  important hygiene property, and it holds.
- One cosmetic inconsistency: dev deps use short-form carets (`^4`, `^5`, `^9`,
  `^19`, `^20`) while runtime deps use full triplets. Harmless (npm reads `^4` as
  `^4.0.0`) but under-records the tested floor — a clarity nit, not a correctness
  issue.

**Documentation gap (→ F2):** the `tsx` exact pin **is** documented (DECISIONS
2026-05-18), but the `react`/`react-dom` and `@faker-js/faker` exact pins are
**not** logged as deliberate decisions. The faker pin is the load-bearing one: the
demo-seed cohort has a determinism guarantee (DECISIONS 2026-05-18 demo-email
format), and a faker version change can shift generated names — an un-pin would
silently break cohort reproducibility. The pins are **correct**; they are just
undocumented, which invites a future maintainer to "tidy" them into carets.

The policy is otherwise consistent and defensible; no pin should be **loosened**.

---

## Supply-chain notes

**Install / lifecycle scripts.** Five packages in the resolved tree run an
`install`/`postinstall` script. Each script was **read verbatim** (not judged by
package name); all are legitimate prebuilt-binary placement:

| Package | Script | Verdict |
|---|---|---|
| `esbuild@0.25.12`, `esbuild@0.23.1` | `postinstall: node install.js` | Standard upstream binary fetch/validate — resolves the platform `@esbuild/<platform>` optional dep; only on `--no-optional` does it fall back to a registry-pinned tarball download; finishes by exec'ing the binary and asserting its `--version`. Network target hardcoded to the official npm registry; no env/credential access; no obfuscation. |
| `sharp@0.34.5` | `install: node install/check.js \|\| npm run build` | 15-line presence check: uses prebuilt `@img/sharp-*` binaries unless a global libvips / build-from-source flag is set. No-op on this host; no network, no exec, no source build. |
| `unrs-resolver@1.11.1` | `postinstall: napi-postinstall … check` | NAPI presence check: `require.resolve`s the matching `@unrs/resolver-binding-*` optional dep and exits if found. Registry-pinned fallback only on resolution failure. Same pattern as esbuild. |
| `ljharb-monorepo-symlink-test@0.0.0` | `postinstall: lerna bootstrap` | Inert (see below). |

**`gypfile:true`: NONE.** No `node-gyp` source compilation anywhere — every native
package uses the prebuilt-binary-as-optional-dependency model (npm resolves only
the current platform's binary). This is the lower-risk native model.

**Native-binding inventory:** `sharp` (Next's **optional** image-optimization dep —
the app uses no `next/image`/`<img>`, so it is **installed but inert at runtime**),
`unrs-resolver` (ESLint tooling, dev-only), and `esbuild` ×2 (build/test). All
prebuilt-binary; none compiles locally.

**The `ljharb-monorepo-symlink-test` curiosity — benign.** A full-depth `find` over
`node_modules` for `*ljharb*`/`*symlink-test*` returns nothing on disk, and the
package does not appear in `package-lock.json`. It is a test fixture from the
`ljharb` (Jordan Harband) es-* tooling ecosystem; npm never runs lifecycle scripts
for a package that is not in the resolved tree, and its `lerna bootstrap`
postinstall is inert because `lerna` is not installed. No exposure.

**Maintainer / typosquat sanity** (less-mainstream names verified against the
canonical npm registry; all carry SHA-512 integrity hashes resolving to
`registry.npmjs.org`):

- `server-only@0.0.1` — authentic React-team marker package (publisher
  `sebmarkbage`, repo facebook/react). A `0.0.1` marker is by design.
- `tw-animate-css@1.4.0` — authentic (publisher Wombosvideo; the known Tailwind-v4
  replacement for `tailwindcss-animate`, per DECISIONS DECISION-10).
- `lucide-react@1.16.0` — authentic (official `lucide-icons` org); the 1.x major is
  genuine, just recent.
- `happy-dom@20.9.0` — authentic (capricorn86 / David Ortner; published with npm
  provenance attestations).
- `tsx@4.19.2`, `unrs-resolver@1.11.1` — authentic.

**Known-malicious-incident scan — clean.** No resolved package name matches a known
supply-chain incident (`event-stream`/`flatmap-stream`, `ua-parser-js`, `node-ipc`,
`coa`/`rc`/`colors`, `eslint-scope`, etc.).

**`node_modules` security artifacts — clean.** No `.npmrc` inside any installed
package (no leaked registry auth tokens shipping in a tarball), and no `.env` /
`*.env` files inside installed packages. (`node_modules` is gitignored, so this
concerns secrets shipped *inside published packages*, of which there are none.)

**Residual (informational, accepted — not a defect):** native-binary install scripts
(`esbuild`, `sharp`, `unrs-resolver`) are an inherent supply-chain surface for any
project using these tools. The trust anchor is the npm registry plus the committed
lockfile's SHA-512 integrity hashes (all present), which `npm ci` enforces.
`--ignore-scripts` is **not** advisable here (esbuild/sharp/unrs genuinely need the
script to place their binaries); integrity-hash enforcement via `npm ci` is the
realistic control.

---

## Audited and clean

Affirmative record — surfaces examined that returned no finding.

1. **Production runtime dependency set is advisory-free** — the 94 prod packages
   (`next` runtime, `react`/`react-dom`, `@supabase/ssr`/`@supabase/supabase-js`,
   all `@radix-ui/*`, `zod`, `framer-motion`, `lucide-react`,
   `@hookform/resolvers`, `react-hook-form`) carry **zero** `npm audit` advisories.
   Both flagged advisories are dev/build-only.
2. **Both advisories are non-runtime-reachable** — esbuild's vulnerable `serve`
   path is never invoked (`tsx` transforms only; grep-confirmed no `serve` usage);
   postcss's untrusted-CSS-stringify precondition is structurally absent (build-time
   first-party CSS only). GHSA pages fetched to confirm.
3. **No critical/high/low advisories** — only the 2 moderate (dev/build) entries.
4. **All slice-5-sensitive deps are on `latest`** — `next` 16.2.6, `zod` 4.4.3,
   `@supabase/ssr` 0.10.3, `next-themes` 0.4.6, all five `@radix-ui/*` — every CSP
   and cookie invariant from slices 2/5 is honored at the newest published version.
5. **No pending dep major threatens a prior slice** — no zod 5 (jitless barrel safe)
   and no Next 17 (CSP-nonce stamping safe) is published or roadmapped.
6. **No wildcard version specifiers** — every dependency in both manifests is a
   caret range or an exact pin; no `*`/`latest`.
7. **Lockfile is registry-resolved + integrity-hashed** — single root
   `package-lock.json`; every entry resolves to `registry.npmjs.org` with a
   SHA-512 integrity hash. `npm ci` reproduces the tree deterministically and
   verifies hashes.
8. **Duplicate versions are dev/build-only and explained** — `esbuild` ×2 (0.23.1
   via `tsx`, 0.25.12 via `vite`) and `postcss` ×2 (8.4.31 vendored by `next`,
   8.5.14 hoisted for `vite`+Tailwind) live in isolated build/test subtrees; `tsx`
   is correctly deduped. No production-runtime-bundle duplication.
9. **Native distribution is prebuilt-binary** — `gypfile:true` absent; no local
   `node-gyp` compilation anywhere.
10. **All five install scripts read and confirmed legitimate** — standard
    binary-placement (esbuild/sharp/unrs); no credential/env access, no
    off-registry endpoints, no obfuscation.
11. **No typosquats / no known-malicious package names** — less-mainstream deps
    verified authentic against the canonical registry.
12. **No `.npmrc`/`.env` inside installed packages** — no leaked tokens or secrets
    shipping in any dependency tarball.
13. **`sharp` is inert** — Next's optional image-optimization dep, but the app uses
    no `next/image`/`<img>` (slice 5); its native binary surface exists on disk but
    is never exercised at runtime.

---

## Findings

### Finding 1: Four bundle-/build-required packages are declared under `apps/web` `devDependencies`

- **Severity**: `low`
- **Surface**: `apps/web/package.json` `devDependencies` — `clsx` `^2.1.1`,
  `tailwind-merge` `^3.6.0`, `class-variance-authority` `^0.7.1`, `server-only`
  `^0.0.1`.
- **What**: these four packages are imported by application code that is part of the
  production build/bundle, not by test-only code (verified by grep):
  - `clsx`, `tailwind-merge` → `apps/web/lib/utils.ts` (the `cn()` helper used by
    every shadcn UI primitive) → bundled into client/server output.
  - `class-variance-authority` → `apps/web/components/ui/button.tsx` and
    `components/ui/sheet.tsx` → bundled.
  - `server-only` → side-effect-imported at `apps/web/lib/env/server.ts:1` and
    `apps/web/lib/supabase/admin.ts:1` (the build-time RSC guard that fails the
    build if a server module is pulled into a client graph).
  They originate from the shadcn Tailwind-v4 manual-init workflow, which installs
  them with `npm i -D` (DECISIONS 2026-05-25, DECISION-1) — so the placement is
  *intentional-by-convention*, but it is technically incorrect. (Contrast
  `@radix-ui/react-slot`, from the same `-D` install list, which **is** correctly
  in `dependencies`.)
- **Why it's a risk** (OWASP A06 — audit-scope hygiene, not a reachable exploit):
  1. **Audit blind spot.** A production-scoped audit — `npm audit --omit=dev` (or
     `--production`) — **excludes** these four packages, so a future advisory in
     `clsx`/`tailwind-merge`/`class-variance-authority`/`server-only` would be
     silently missed by anyone auditing only production deps. They are clean today;
     the risk is the *future* false-negative.
  2. **Build integrity.** `npm install --omit=dev` (or `NODE_ENV=production`
     install) before `next build` would fail to resolve these imports and break the
     build. The current Vercel deploy flow installs all deps before building, which
     is why builds pass today — masking the misclassification.
- **Suggested fix** (fix pass, not this slice): move the four from
  `devDependencies` to `dependencies` in `apps/web/package.json` (and reconcile
  DECISIONS DECISION-1's dep list, which lists them under the `-D` set). No code
  change; lockfile regenerates with the same resolved versions.
- **Status**: open — awaiting adjudication.

### Finding 2: Two correct-but-undocumented exact pins (`react`/`react-dom`, `@faker-js/faker`)

- **Severity**: `low`
- **Surface**: `apps/web/package.json` (`react` `19.2.4`, `react-dom` `19.2.4`) and
  root `package.json` (`@faker-js/faker` `9.2.0`).
- **What**: these exact pins are deliberate and correct, but no DECISIONS entry
  records *why*, unlike the `tsx` exact pin (DECISIONS 2026-05-18). The
  `react`/`react-dom` pins follow `create-next-app` convention (the triple moves
  atomically with Next). The `@faker-js/faker` pin is load-bearing for the
  demo-seed cohort determinism guarantee (DECISIONS 2026-05-18) — a faker version
  change can shift generated names.
- **Why it's a risk**: documentation/maintainability only (no security exposure). An
  undocumented exact pin invites a future maintainer to "normalize" it to a caret —
  un-pinning faker would silently break demo-cohort reproducibility; un-pinning
  React could desync it from Next's expected version.
- **Suggested fix** (fix pass): add two short DECISIONS entries documenting the
  rationale for the `react`/`react-dom` and `@faker-js/faker` exact pins. Optional:
  normalize dev-dep short-form carets to full triplets (pure clarity).
- **Status**: open — awaiting adjudication.

---

## Out of scope this slice

Routed elsewhere or deliberately not deep-dived; recorded so nothing is silently
dropped.

- **Applying any update or fix** — this is the audit pass. The `tsx@4.22.3` bump
  (A1), the `@supabase/supabase-js`/`@hookform/resolvers`/`react-hook-form`/
  `@types/react`/`vitest` routine bumps, the F1 reclassification, and the F2
  documentation are all for the follow-up fix-pass session on this branch after
  Mohamed adjudicates.
- **zod jitless-barrel load-order robustness (forward-looking).** zod issue
  [#5789](https://github.com/colinhacks/zod/issues/5789) notes that
  `z.config({ jitless: true })` is load-order-sensitive: it must run before any
  module touches zod, or a later import could re-arm the `new Function` CSP probe.
  The slice-5 invariant **currently holds** (the enforcing-CSP capture showed 0
  `script-src` eval violations), so this is not a slice-6 finding — it is a
  robustness note for the slice-5 barrel. Suggested forward-looking hardening: a
  guard test asserting no `unsafe-eval` CSP violation fires on a representative
  validation path, so the invariant is *verified* rather than *assumed*. Owned by
  the slice-5 surface.
- **TypeScript 6 / `@types/node` 25 / `cross-env` 10 major migrations** — out-of-range
  majors held deliberately; each is a separate, non-security migration decision.
- **License compliance** — orthogonal to security (per slice brief). No GPL/AGPL
  dep was surfaced incidentally; the audited deps are MIT/ISC/Apache-family.
- **Bundle-size analysis** — a performance lens, not security.
- **Rate-limit quota deep-dive** → slice 7.
- **Renovate / Dependabot automation** — operational; a separate slice or BACKLOG
  candidate.
- **Production Cloud dashboard dep posture** (Vercel / Supabase managed runtimes) —
  not auditable from the repo; Mohamed handles manually. The slice-2/4/5 Cloud-parity
  caveat stands.

---

## Verification approach

`/security-review` was **not** used as the audit engine: it is diff-scoped (it
reviews only the branch diff, which here is this new doc) and cannot audit the
committed `package.json`/lockfile or the installed tree. The `cybersecurity-skills:*`
set are live-pentest playbooks (no live target here), so **OWASP A06 (Vulnerable and
Outdated Components)** was used as conceptual framing only. The engine was the
main-session empirical `npm` tool runs (below) plus three parallel `general-purpose`
reviewer subagents (advisory reachability + classification; freshness + pin policy;
transitive surface + supply-chain hygiene). Every claim about a version, an advisory,
or a transitive path comes from actual tool output, not memory — npm/registry state
evolves and recollection is stale.

Commands a future Claude re-runs for a periodic re-audit (from repo root; the single
root lockfile covers all workspaces). Network-bearing commands (`audit`, `outdated`,
`view`) require the CC sandbox disabled:

```bash
# (a) advisory baseline
npm audit                       # human-readable
npm audit --json                # structured (severity counts, via-paths, nodes)

# (b) freshness
npm outdated                    # current vs wanted vs latest (exit 1 if any are behind = normal)
npm view <pkg> version          # registry `latest` for a specific dep (slice-sensitive set)

# advisory reachability — which copy is actually vulnerable?
npm ls esbuild postcss tsx --all
npm why esbuild ; npm why postcss ; npm why tsx

# (c) transitive surface
#   702 resolved deps per audit.json metadata; print-tree line count:
npm ls --all 2>/dev/null | wc -l
npm why sharp ; npm why unrs-resolver        # native-binding provenance

# (f) supply-chain — install scripts + native builds across the whole tree
node -e 'const fs=require("fs"),path=require("path");const hits=[],nat=[];
  (function w(d){let e;try{e=fs.readdirSync(d,{withFileTypes:true})}catch{return}
   for(const x of e){const p=path.join(d,x.name);
     if(x.isDirectory())w(p);
     else if(x.name==="package.json"){let k;try{k=JSON.parse(fs.readFileSync(p,"utf8"))}catch{return}
       const s=k.scripts||{};const i=["preinstall","install","postinstall"].filter(n=>s[n]);
       if(i.length)hits.push(k.name+"@"+k.version+" ["+i.join(",")+"]");
       if(k.gypfile)nat.push(k.name+"@"+k.version);}}})("node_modules");
  console.log("install-scripts:\n"+[...new Set(hits)].join("\n"));
  console.log("gypfile:true:\n"+([...new Set(nat)].join("\n")||"(none)"));'

# (g) node_modules security artifacts (expect none)
find node_modules -name ".npmrc" -type f
find node_modules \( -name ".env" -o -name "*.env" \) -type f

# slice-sensitive classification probe (which devDeps are actually bundled?)
node -e 'const p=require("./apps/web/package.json");for(const n of ["clsx","tailwind-merge","class-variance-authority","server-only","@radix-ui/react-slot"])console.log(n, p.dependencies?.[n]?"dep":(p.devDependencies?.[n]?"DEV":"absent"))'
```

Re-running needs no dev server or database — `npm audit`/`outdated`/`view` hit only
the registry; the tree, install-script, and artifact scans are local.

---

## Open questions for review

1. **F1 — reclassify the four, and reconcile DECISION-1?** Moving `clsx`,
   `tailwind-merge`, `class-variance-authority`, `server-only` to `dependencies` is
   the correct fix, but DECISIONS DECISION-1 documents them under the shadcn `-D`
   install set. Should the fix-pass also append a DECISIONS note that the shadcn
   convention's `-D` placement is overridden for these four (so the record stays
   consistent)?
2. **A1 — bump `tsx` to 4.22.3, or defer?** The advisory is unreachable, but the
   fix is a clean **minor** bump (within the spirit of the exact-pin rationale,
   which guards against *majors*). Bump to clear the audit line, or keep the exact
   `4.19.2` pin and document the deferral? Either is defensible.
3. **A2 — confirm the carry-forward accept.** The postcss advisory is a documented
   accept (DECISIONS 2026-05-17) with no viable fix. Confirm it stays accepted until
   a Next release ships a bumped bundled postcss.
4. **Routine bumps batch.** Apply the range-satisfiable patch/minor bumps
   (`@supabase/supabase-js` → 2.106.2, `@hookform/resolvers` → 5.4.0, `react-hook-form`
   → 7.76.1, `@types/react` → 19.2.15, `vitest` → 4.1.7) as one hygiene commit, or
   leave until a feature touches them? None is security-driven.
