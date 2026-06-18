# Implementation Plan: Visual Redesign (Graphite)

**Branch**: `007-visual-redesign` | **Date**: 2026-06-18 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `specs/007-visual-redesign/spec.md`

**Supporting artifacts**: [research.md](./research.md) (Phase 0 — the two resolved `[PLAN-DECISION]`
items + grounding corrections), [quickstart.md](./quickstart.md) (how to run + verify).

## Summary

Re-skin the entire `apps/web` Next.js app onto the deepened **Graphite** values of the existing
semantic token system, refresh typography (Outfit display + Inter body, retiring DM Serif Display),
apply the Amendment-4 contrast fixes (filled-accent foreground, `--color-meadow-text`, errors=foggy,
amber soft-tint, ink-derived scrim), lowercase the wordmark, and build two bespoke animated
components (the six-box OTP merge, shared by the sign-up-verification and password-reset flows; and
the breathing-orb bloom replacing the frosted orb). It is **recolour + re-type + the explicitly
listed targeted changes only** — no behavioural rewrite (FR-001/FR-004).

Technical approach, grounded in the code audit (see research.md):

- **Token swap auto-propagates the palette.** Swapping the nine `@theme` role values to Graphite
  re-skins every token-driven surface and every `/10 /15 /50` opacity variant for free (US1).
- **Type scale = override Tailwind v4's `--text-*` scale** (R-1): the app uses only standard size
  utilities (149 sites, zero arbitrary sizes), and the locked 8-step scale maps onto them with three
  ≤2px value deltas — so three `@theme` overrides migrate every site, including shadcn primitives,
  with no call-site churn.
- **Scrim = one fixed Graphite-ink-derived `--color-scrim` token** (R-2), replacing the three raw-
  black scrims.
- **Three-phase delivery**: Phase 1 (serial, single-agent) freezes the shared foundation; Phase 2
  (parallel-safe) re-skins surfaces + builds the two bespoke pieces on **disjoint file scopes**;
  Phase 3 (serial) is integration + AA/responsive/reduced-motion/mock-fidelity verification + docs.

## Technical Context

**Language/Version**: TypeScript (strict) on Next.js **16** App Router (`proxy.ts`, not
`middleware.ts`). React 19. **Read `node_modules/next/dist/docs/` before writing Next code** — this
Next has breaking changes vs. training data (`apps/web/AGENTS.md`).

**Primary Dependencies** (all already present — **no new runtime deps**, FR-004): Tailwind CSS **v4**
(CSS-first; `@theme` in `apps/web/app/globals.css`; **no `tailwind.config`**), shadcn/ui (Radix
primitives), framer-motion, next-themes (dark mode via `:root.dark` class, `attribute="class"`,
storage key `serenify-theme`), Lucide, `next/font/google` (self-hosting Inter + Outfit).

**Storage / Data / Auth / ML / API**: **N/A for this feature.** No data model, no Supabase schema/
policy, no ML pipeline, no API contract, no auth logic is touched (FR-004). See *Project Structure*
for why no `data-model.md` / `contracts/` artifacts are generated.

**Testing**: Vitest + React Testing Library for the two bespoke components (`OtpPanel`,
`BreathingOrb`); existing component tests guard recolour-only changes; Playwright role e2e
(employee/team-lead/admin) is unaffected by a re-skin and must still pass; `smoke-tests.md` authored
at `/speckit-tasks`, run by Mohamed after `/speckit-implement` (Constitution Principle VII).

**Target Platform**: Web, light + dark, 360px → desktop, `prefers-reduced-motion` honoured via the
repo's `useMediaQuery` hook (`apps/web/hooks/use-media-query.ts`) — never framer's `useReducedMotion`.

**Project Type**: Web frontend (`apps/web`) only. Single-app re-skin.

**Performance/Constraints**: No runtime perf target beyond "no regression." Hard constraints are the
acceptance bars: WCAG AA both modes (SC-001), zero glassmorphism (SC-003), 360px integrity (SC-004),
reduced-motion honoured (SC-005), mock fidelity (SC-006).

**Scale/Scope**: ~50 in-scope `.tsx` surface files across auth, onboarding, home dashboard, account,
the full calibration flow, header/nav shell, and shared primitives; one CSS theme file; one layout
file; two bespoke components.

## Constitution Check

*GATE: must pass before Phase 0. Re-checked after Phase 1 design (below). No violations — the
`Complexity Tracking` table is empty.*

This feature **implements** Constitution v1.4.0 Amendment 4; it does not re-litigate it (the Graphite
hexes, Outfit/Inter, and the two contrast rules are ratified — Assumptions §1).

- **Principle V — Calm-First Design Language (PRIMARY):** Directly implemented.
  - Graphite palette **values** swapped; semantic role token **names** unchanged (FR-005).
  - Filled meadow/foggy CTAs take `--color-on-accent` (light) / `--color-bg` (dark) at the shared
    button primitive; old ink-on-accent removed (FR-008/FR-014). Amber is soft-tint/graphic only,
    never solid-amber-with-ink; errors are **foggy**, never amber, never sharp red (FR-015/FR-016).
  - **No glassmorphism**: the orb's inline `backdropFilter` frost is removed (research.md R-3.1);
    SC-003 verified by grepping `backdropFilter`/`backdrop-filter`/`backdrop-blur` to zero.
  - Elevation = 0.5px borders + the single `--shadow-soft` (dark value confirmed, FR-020); radii
    8–16px; one-off geometry (`rounded-[28px]`, `aspect-[3/4]`, per-call heights) preserved (FR-020).
  - Typography: Outfit display / Inter body, both self-hosted OFL; DM Serif retired; lowercase
    `serenify` wordmark (FR-010/FR-013). Lucide unchanged. Calm voice preserved (no copy-meaning
    change, FR-001).
  - Ink-derived scrim replaces raw black (FR-021; R-2).
- **Principle VI — Responsive & Accessible by Default:** US5 is a binding done-ness gate. 360px
  layout integrity (OTP wrap, dashboard grid stack, 16:9 preview), ≥44px touch targets, **both modes
  equal-priority and designed in tandem**, and `prefers-reduced-motion` honoured on every animation
  via `useMediaQuery` (SC-004/SC-005, FR-026/FR-032). Every documented pairing meets WCAG AA in both
  modes (SC-001/FR-018).
- **Principle VII — Mandatory Testing Per PR:** Vitest/RTL for the two bespoke components
  (`OtpPanel`, `BreathingOrb`); recolour-only surfaces are guarded by their existing component tests;
  Playwright role e2e (3 roles) must still pass (a re-skin must not break role-gated flows);
  `smoke-tests.md` authored at `/speckit-tasks`, signed off by Mohamed (FR-035).
- **Principle VIII — Spec-Driven Workflow:** spec → **plan** → tasks → implement order honoured.
  `docs/DECISIONS.md` (append-only) gets the type-scale mechanism, `--color-on-accent`,
  `--color-meadow-text`, errors=foggy, and the scrim token; `docs/CHANGELOG.md` notes any deviation;
  these are written **at implementation time** (FR-035) — **not** edited now. The Tailwind-v4 rule
  (real tokens never via `@theme inline`; `--color-muted` stays out of `@theme inline`) is respected
  (FR-007).
- **Privacy review (Dev-Workflow gate 6 — Principle I):** This feature touches the calibration
  **capture UI** (orb, preview, brackets) but **only its rendering**. No change to signal capture,
  signal transport, manager-facing views, or aggregation. Raw frames still never leave the device/
  backend layer; the preview and orb are local-only client rendering. **Principle I invariants hold,
  unchanged.**
- **Principles II / III / IV / IX / X:** Not engaged. No ML eval, modality, LLM, secrets, or dataset
  surface is touched. (No `*.env*` added; no keys; FR-004 forbids new deps — Principle IX clean.)

## Project Structure

### Documentation (this feature)

```text
specs/007-visual-redesign/
├── spec.md          # source of truth (amended 6f3d8d5)
├── plan.md          # this file (/speckit-plan)
├── research.md      # Phase 0 — the two resolved [PLAN-DECISION] items + grounding corrections
├── quickstart.md    # Phase 1 — how to run + verify the re-skin
└── tasks.md         # /speckit-tasks (NOT created here)
```

**No `data-model.md` and no `contracts/` directory are generated — by design.** FR-004 holds the
out-of-scope boundary: this feature changes **no** application logic, routing, data model, Supabase
schema/policy, ML pipeline, API contract, or auth logic, and adds **no** new dependency beyond the
self-hosted fonts. There is no entity to model and no interface contract to document, so emitting
empty stubs would be noise. The only "contract" that matters is the **Phase-1 frozen foundation**
(below), which lives in this plan so Phase 2 can be frozen against it.

### Source Code (repository root) — in-scope tree

```text
apps/web/
├── app/
│   ├── globals.css                     # @theme tokens, type scale, scrim, fonts  [PHASE 1]
│   ├── layout.tsx                      # Outfit/Inter wiring                       [PHASE 1]
│   ├── (auth)/
│   │   ├── layout.tsx                  # wordmark                                  [PHASE 1]
│   │   ├── login|signup|forgot-password|reset-password/{page,*-form}.tsx [P2-A auth]
│   ├── (onboarding)/
│   │   ├── layout.tsx                  # wordmark                                  [PHASE 1]
│   │   └── onboarding/{page,onboarding-form}.tsx                          [P2-A* onboarding]
│   └── (authed)/
│       ├── layout.tsx                  # authed shell                             [P2-G nav shell]
│       └── app/
│           ├── page.tsx                                                   [P2-C dashboard]
│           ├── account/page.tsx                                          [P2-D account]
│           └── calibrate/{page,calibrate-recorder}.tsx                    [P2-E calibration]
├── components/
│   ├── ui/button.tsx                   # meadow/foggy foreground fix              [PHASE 1]
│   ├── ui/auth/{field,password-input,password-requirements}.tsx          [P2-A auth]
│   ├── ui/auth/otp-panel.tsx (+ new otp-* files)                          [P2-B OTP bespoke]
│   ├── ui/{dialog,sheet,dropdown-menu,card,avatar,separator}.tsx          [P2-F primitives/scrims]
│   ├── notification.tsx                # scrim                                    [P2-F]
│   ├── home/*.tsx, chat-pill.tsx                                          [P2-C dashboard]
│   ├── account/*.tsx                                                      [P2-D account]
│   ├── anchor/baseline-section.tsx     # Account-rendered (NOT calibration)       [P2-D account]
│   ├── anchor/calibration-banner.tsx   # Dashboard-rendered (NOT calibration)     [P2-C dashboard]
│   ├── anchor/breathing-guide.tsx      # orb bloom (bespoke)                      [P2-E-orb]
│   ├── anchor/framing-overlay.tsx      # brackets/spotlight recolour              [P2-E-overlay]
│   ├── anchor/{intro,green-room,countdown,get-ready-countdown,recording-stage,
│   │          recording-timer,stop-confirm,success-state,failure-state,
│   │          camera-access-state,backend-down-modal,
│   │          anchor-recorder,device-picker}.tsx                          [P2-E calibration]
│   ├── header/header.tsx               # wordmark                                 [PHASE 1]
│   ├── header/{center-nav,mobile-menu,profile-dropdown}.tsx               [P2-G nav shell]
│   └── role-placeholder/role-placeholder.tsx                             [P2-C dashboard]
```

**Structure Decision**: single-app re-skin under `apps/web` (constitution's locked frontend). Logic-
only files in scope dirs are explicitly **NOT touched** (FR-004): `**/actions.ts`,
`anchor/device-memory.ts`, `anchor/use-anchor-recorder.ts`, `lib/**`, `hooks/**` (read-only consumer
of `use-media-query.ts`).

---

## Phase 1 — Frozen Foundation Contract (serial, single-agent)

Phase 1 is single-agent because it edits **shared files** every Phase-2 task depends on. The exact
interface below is **frozen** before any Phase-2 work starts; Phase-2 agents code against these names/
values and must not redefine them. Files touched in Phase 1: `globals.css`, `layout.tsx`,
`button.tsx`, `header/header.tsx`, `(auth)/layout.tsx`, `(onboarding)/layout.tsx`.

### 1.1 Graphite role tokens (`globals.css` — real `@theme` + `:root.dark`)

Names unchanged (FR-005); values → Amendment-4 Graphite:

| Token | Light | Dark (`:root.dark`) |
|---|---|---|
| `--color-bg` | `#EAEBEC` | `#101214` |
| `--color-surface` | `#F4F5F6` | `#181B1E` |
| `--color-ink` | `#1C2023` | `#E2E5E8` |
| `--color-muted` | `#585D61` | `#939A9F` |
| `--color-meadow` | `#3E7A63` | `#63B292` |
| `--color-foggy` | `#356E88` | `#74B6CE` |
| `--color-amber` | `#C98637` | `#E4AE5C` |
| `--color-crimson` | `#894A4E` | `#C98589` |
| `--color-border` | `#D7D9DC` | `#23272B` |

`@theme inline` (shadcn alias) layer is **unchanged** and **not edited**; it tracks the above through
its existing `var()` chain. `--color-muted` stays **out** of `@theme inline` (FR-007).

### 1.2 New tokens (real `@theme`)

| Token | Light | Dark | Consumed by |
|---|---|---|---|
| `--color-on-accent` | `#F8F9FA` | *(unused; dark filled-accent fg = `--color-bg`)* | filled meadow/foggy CTA fg (light) |
| `--color-meadow-text` | `#346A56` | `#63B292` *(`:root.dark` override)* | small meadow **text** on light bg (FR-017 sites) |
| `--color-scrim` | `rgba(28,32,35,0.60)` | *(same; fixed, no dark override)* | dialog/sheet/notification scrims (FR-021) |

### 1.3 Type-scale tokens (real `@theme`) — see research.md R-1

Override **three** steps; the other five already equal the locked values:

```
--text-xs:   13px (0.8125rem)   line-height 1.4
--text-base: 17px (1.0625rem)   line-height 1.5     ← 17px base body
--text-4xl:  38px (2.375rem)    line-height ~1.15
```

Plus `body { font-size: var(--text-base) }` for the inherited 17px base. **Final type-scale token
mechanism = override Tailwind `--text-*`** (no new size-token names). The hero wordmark
(`sm:text-5xl`, 48px) and on-video countdown (`text-8xl`, 96px) remain preserved one-offs above the
scale. Root `html` font-size is **not** changed.

### 1.4 Fonts (`layout.tsx` + `globals.css`)

`next/font/google`: keep `Inter` (`--font-sans`); replace `DM_Serif_Display` with `Outfit`
(`--font-display`). `globals.css`: `--font-display: "Outfit", sans-serif`. DM Serif Display retired
(FR-010). No new dependency.

### 1.5 Button variant API (`button.tsx`) — FROZEN

Variant **names/props unchanged** (`default | destructive | outline | secondary | meadow | foggy |
ghost | link`; `size`; `asChild`). Only the filled-accent foreground changes (FR-014):

- `meadow`: `bg-meadow text-ink … dark:text-bg` → **`bg-meadow text-on-accent … dark:text-bg`**
- `foggy`:  `bg-foggy text-ink … dark:text-bg`  → **`bg-foggy text-on-accent … dark:text-bg`**

`default` (`bg-ink text-bg`) and soft-tint surfaces are unchanged. Phase-2 surfaces using
`<Button variant="meadow|foggy">` inherit the AA fix automatically — they must **not** re-implement
filled-accent foreground locally.

### 1.6 Wordmark (3 files) — FROZEN

`header/header.tsx`, `(auth)/layout.tsx`, `(onboarding)/layout.tsx`: capital `Serenify` + meadow-dot
`<span>` → lowercase **`serenify`**, dot removed, `font-display` (now Outfit) kept (FR-013). These
three files are **owned entirely by Phase 1**; no Phase-2 task edits them.

### 1.7 Dark `--shadow-soft` confirmed (FR-020)

Confirm/define a dark-mode-appropriate `--shadow-soft` (deeper alpha in `:root.dark`, or accept
border-only elevation) and record it. Single soft shadow only.

> **Phase-1 exit / re-check of Constitution Check:** after Phase 1, re-verify (a) `@theme inline`
> untouched and `--color-muted` still outside it; (b) AA on the filled-CTA foregrounds and the
> meadow-text token in both modes; (c) DM Serif and capital-wordmark/dot grep to zero in the three
> frozen files. Only then unfreeze Phase 2.

---

## Phase 2 — Surface re-skin + bespoke components (parallel-safe, disjoint file scopes)

Each task below is a **disjoint, non-overlapping set of files**. With Phase 1 frozen and these
scopes enforced, parallel agents cannot clobber each other. Logic files (`actions.ts`, hooks,
`lib/**`, `device-memory.ts`, `use-anchor-recorder.ts`) are **out of scope** in every task (FR-004).
Every task reports anything it removed/replaced and why (FR-003), traceable to FR-002.

| Task | Owns (exact files) | Notes |
|---|---|---|
| **P2-A — Auth screens** | `app/(auth)/login/{page,login-form}.tsx`, `app/(auth)/signup/{page,signup-form}.tsx`, `app/(auth)/forgot-password/{page,forgot-form}.tsx`, `app/(auth)/reset-password/{page,reset-form}.tsx`, `components/ui/auth/{field,password-input,password-requirements}.tsx` | Recolour/re-type; meadow links → `--color-meadow-text`; any amber notice → foggy; password-requirement "met" text → meadow-text (FR-017). Mounts `<OtpPanel>` in signup-form/forgot-form via **frozen props** — does **not** edit `otp-panel.tsx`. Does **not** touch `(auth)/layout.tsx` (Phase 1). |
| **P2-A* — Onboarding** | `app/(onboarding)/onboarding/{page,onboarding-form}.tsx` | Recolour/re-type. Does **not** touch `(onboarding)/layout.tsx` (Phase 1). Small; may run as its own agent or fold into P2-A. |
| **P2-B — OTP bespoke** | `components/ui/auth/otp-panel.tsx` + **new** `components/ui/auth/otp-*.tsx` + `components/ui/auth/otp-panel.test.tsx` | Six-box merge / foggy sway / reduced-motion via `useMediaQuery` (FR-023–FR-027); source of truth `serenify-007-otp-mock.html`. **`OtpPanel` props API `{email, action, successHref, helperText}` is FROZEN** (verification/validation logic + backend untouched). Owns the `otp-*` filename namespace under `ui/auth/`. |
| **P2-C — Home dashboard** | `app/(authed)/app/page.tsx`, `components/home/{welcome-banner,recent-chats-card,todays-checkin-card,things-that-might-help-card}.tsx`, `components/chat-pill.tsx`, `components/role-placeholder/role-placeholder.tsx`, `components/anchor/calibration-banner.tsx` | Header shell one-row calibration banner (present/dismissed), greeting, two-column card grid (stacks at 360px), chat pill; populated vs empty card states preserved. role-placeholder = team-lead/admin home view. `calibration-banner.tsx` is an anchor-dir file **rendered only by the dashboard** (`app/(authed)/app/page.tsx:44`) → owned here, not P2-E (mirrors `baseline-section.tsx`→P2-D). |
| **P2-D — Account** | `app/(authed)/app/account/page.tsx`, `components/account/{profile-section,security-section,notifications-placeholder,privacy-placeholder,sign-out-section}.tsx`, `components/anchor/baseline-section.tsx` | Includes the **has-anchor pill text fix** (FR-017) in `baseline-section.tsx` — Account-rendered, **owned here, not by P2-E**. The dark-mode **account-menu dropdown** contrast fix is split: the primitive edit (`ui/dropdown-menu.tsx`) → P2-F; its header consumer (`profile-dropdown.tsx`) → P2-G. |
| **P2-E — Calibration flow** | `app/(authed)/app/calibrate/{page,calibrate-recorder}.tsx`, `components/anchor/{intro,green-room,countdown,get-ready-countdown,recording-stage,recording-timer,stop-confirm,success-state,failure-state,camera-access-state,backend-down-modal,anchor-recorder,device-picker}.tsx` | Recolour the whole flow incl. `insufficient-face` (006), three camera-access states, backend-down modal. FR-022: framing spotlight + on-video countdown handled here (countdown overlay **kept**, legibility verified). **Imports** `breathing-guide`/`framing-overlay` but does **not** edit them; **excludes** `baseline-section.tsx` (P2-D) and `calibration-banner.tsx` (P2-C — dashboard-rendered). |
| **P2-E-orb — Breathing-orb bloom (bespoke)** | `components/anchor/breathing-guide.tsx` + `breathing-guide.test.tsx` | Remove inline `backdropFilter` frost → layered meadow bloom (FR-028); reduced-motion static bloom via `useMediaQuery`; source of truth `serenify-007-orb-mock.html`. Self-contained component (simple/no-prop) consumed by P2-E stages — **interface frozen** (no new props). |
| **P2-E-overlay — Framing brackets/spotlight** | `components/anchor/framing-overlay.tsx` (+ existing `framing-overlay.test.tsx`) | Recolour neutral `border-white/70` brackets → state-coloured meadow/foggy (FR-022/FR-029); spotlight `rgba(20,24,22,…)` → Graphite ink-derived; meadow glow auto-migrates. **Props frozen** (`drift`, `showNudge`, `gateReady`). |
| **P2-F — Shared primitives + scrims** | `components/ui/{dialog,sheet,dropdown-menu,card,avatar,separator}.tsx`, `components/notification.tsx` | Scrim re-tokenisation (FR-021): `bg-black/80`→`bg-scrim` (dialog, sheet), `bg-black/50`→`bg-scrim` (notification mobile overlay). Dark-mode dropdown contrast fix lives here. Does **not** touch `button.tsx` (Phase 1). |
| **P2-G — Header / nav shell consumers** | `app/(authed)/layout.tsx`, `components/header/{center-nav,mobile-menu,profile-dropdown}.tsx` | Recolour nav shell; `mobile-menu` consumes `Sheet` (owned by P2-F — disjoint files); `profile-dropdown` consumes `dropdown-menu` (P2-F) + `avatar` (P2-F). Does **not** touch `header/header.tsx` (Phase 1). |

### Shared-file flags (genuinely shared — resolved by pinning, not parallelised)

- **`globals.css`, `layout.tsx`, `button.tsx`** — touched by every surface → **Phase 1**, frozen.
- **`header.tsx`, `(auth)/layout.tsx`, `(onboarding)/layout.tsx`** — carry the wordmark (Phase 1) and
  are minimal chrome whose recolour auto-migrates → **owned entirely by Phase 1**; no Phase-2 task
  edits them.
- **`components/ui/auth/`** is shared by P2-A (`field`, `password-*`) and P2-B (`otp-*`) → partitioned
  by **filename namespace** (no shared file; P2-B owns `otp-*`).
- **`OtpPanel` call sites** (`signup-form.tsx`, `forgot-form.tsx`, in P2-A) vs the OTP redesign (P2-B)
  → kept disjoint by **freezing `OtpPanel`'s props**; P2-A edits only its own markup, not the panel.
- **`baseline-section.tsx`** (under `anchor/`, rendered by Account) → pinned to **P2-D**; P2-E excludes
  it.
- **`calibration-banner.tsx`** (under `anchor/`, rendered **only** by the dashboard,
  `app/(authed)/app/page.tsx:44`) → pinned to **P2-C**; P2-E excludes it — parallel to the
  baseline-section→P2-D pinning.
- **`dropdown-menu.tsx` / `sheet.tsx` / `avatar.tsx`** (primitives, P2-F) vs their nav consumers
  (`profile-dropdown`, `mobile-menu`, in P2-G) → disjoint files; the primitive is edited once in P2-F.
- **`breathing-guide.tsx` / `framing-overlay.tsx`** (P2-E-orb / P2-E-overlay) vs the stages that
  import them (P2-E) → disjoint files; component interfaces frozen.

---

## Phase 3 — Integration & verification (serial)

Runs after Phase 2 merges. Serial because it walks the whole app and the smoke/debug loop is the real
bottleneck (see caveat). Covers:

- **SC-002** Preserved-States Checklist walk (both modes, three roles) — nothing outside FR-002
  removed/changed in meaning (FR-003 reconciliation).
- **SC-001/FR-018** WCAG AA both modes for every documented pairing (filled-CTA fg on meadow+foggy,
  foggy notice text, amber soft-tint text, every migrated meadow-as-text site, the scrim).
- **SC-003** zero glassmorphism — grep `backdropFilter` / `backdrop-filter` / `WebkitBackdropFilter`
  / `backdrop-blur` to **0** (research.md R-3.1).
- **SC-004** 360px integrity (OTP wrap, dashboard grid stack, 16:9 preview) + ≥44px touch targets.
- **SC-005** reduced-motion via `useMediaQuery` on every animation (OTP merge, orb, transitions).
- **SC-006** OTP + orb match `serenify-007-otp-mock.html` / `serenify-007-orb-mock.html`.
- **SC-007** wordmark lowercase `serenify` in all three locations; `DM Serif Display` grep → 0; Outfit
  confined to display/heading/wordmark/large-numeral.
- **SC-008** errors/attention = foggy soft-tint everywhere; amber soft-tint/graphic only.
- **SC-009 / FR-035** `docs/DECISIONS.md` (type-scale mechanism, `--color-on-accent`,
  `--color-meadow-text`, errors=foggy, scrim token) + `docs/CHANGELOG.md` (deviations) + signed-off
  `smoke-tests.md`. **Written here at implementation time — not now.**
- **FR-036** delete the throwaway mocks (`serenify-007-otp-mock.html`, `serenify-007-orb-mock.html`,
  `serenify-007-patterns-swatch.html`, and any prior previews) at the **end** of the feature. They
  stay **untracked** until then.

## Honest fan-out caveat

Parallelism helps **Phase 2 only**, and only because Phase 1 freezes the token/button/type/wordmark
contract and Phase 2 tasks hold **disjoint file scopes**. The token swap already does most of the
recolour for free, so several Phase-2 tasks are small. The real bottleneck is **not** raw
implementation throughput — it is the **smoke-test / visual-debug loop** (both modes × 360px→desktop
× reduced-motion × mock fidelity × AA), which is serial, human-in-the-loop (Mohamed, Principle VII),
and concentrated in Phase 3 and the two bespoke components. Spinning up more parallel coders does not
shorten that loop; over-parallelising the small recolour tasks mostly adds merge/coordination
overhead. Fan out Phase 2 where scopes are genuinely disjoint; expect Phase 1 and Phase 3 to dominate
wall-clock.

## Complexity Tracking

*No Constitution Check violations. Table intentionally empty.*

| Violation | Why Needed | Simpler Alternative Rejected Because |
|-----------|------------|-------------------------------------|
| — | — | — |
