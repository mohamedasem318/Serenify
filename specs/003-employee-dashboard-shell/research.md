# Phase 0 Research: Employee Dashboard Shell

This document gives the long-form treatment of every Decision in
`plan.md`'s **§ Plan-Level Decisions** section. The plan's table is
the at-a-glance reference; this file holds the reasoning.

---

## R-1 — shadcn CLI on the Tailwind v4 path (Decision A)

**Choice**: `npx shadcn@latest init` from `apps/web/`. Follow the
Tailwind v4 branch of the install story. CSS-vars mode, baseColor
`neutral` (overridden by Decision B). Then `shadcn add` each
primitive in scope.

**Live-docs verification** (per user directive — the install story
has moved through 2025-2026):

- The official shadcn install docs at
  `https://ui.shadcn.com/docs/installation/next` confirm the modern
  CLI command is `shadcn@latest`, NOT the older `shadcn-ui@latest`
  package name.
- The Tailwind v4-specific page at `https://ui.shadcn.com/docs/
  tailwind-v4` confirms the v4 path replaces `tailwindcss-animate`
  with `tw-animate-css`, moves color tokens into the `@theme` block,
  and adds `data-slot` attributes to every primitive (this last
  point is informational; we don't query primitives by `data-slot`).
- The Next.js dark-mode page at `https://ui.shadcn.com/docs/dark-
  mode/next` confirms `next-themes` is still the recommended
  integration, with `attribute="class"`, `defaultTheme="system"`,
  `enableSystem` (the values already in our `providers.tsx`).

**Rejected alternatives**:

- `pnpm dlx shadcn@latest init` — the project uses `npm` workspaces
  per DECISIONS 2026-05-17, so `npx` is the matching invocation.
- A pre-Tailwind-v4 shadcn fork or community alternative — none
  offer the calm-first aesthetic without re-skinning, and re-skinning
  shadcn-proper is cheaper than re-skinning a fork.
- Vendoring shadcn primitives by hand without the CLI — possible but
  wastes ~4 hours of mechanical work and gives no benefit; the CLI
  is the documented entry point.

**Risks**:

- The shadcn init can offer to rewrite `globals.css` wholesale. We
  refuse that rewrite and hand-reconcile so the existing Mist &
  Meadow `@theme` block survives verbatim.
- The init detects the Tailwind v4 toolchain via `tailwindcss` in
  `package.json` (currently `^4`). If a future Tailwind v3 backport
  is ever attempted, the init will silently switch to the v3 path —
  worth flagging in `smoke-tests.md`.

---

## R-2 — CSS-variable mapping (Decision B)

The mapping table is reproduced in `plan.md` (Decision B) and again
in `contracts/shadcn-mapping.md`. This entry explains the
why-not-other-mappings.

**The `--primary-foreground` mapping is symmetric across modes**:

- Light mode `--primary-foreground` = `--color-bg` (`#ECEEE9`):
  the button has `bg-primary` (= meadow `#7A9275`), text is page bg
  on top. Contrast: `#ECEEE9` on `#7A9275` ≈ 5.8:1 — passes WCAG AA
  for text.
- Dark mode `--primary-foreground` = `--color-bg` (`#161917`):
  text is dark-mode page bg on dark-mode meadow `#97AE91`.
  Contrast: `#161917` on `#97AE91` ≈ 7.4:1 — passes AA.
- An earlier asymmetric proposal mapped dark-mode
  `--primary-foreground` to `--color-ink` (`#DCDED5`), giving
  near-white text on light sage. Contrast: ≈ 3.1:1 — **fails WCAG
  AA**. The symmetric mapping is the only WCAG-compliant choice.
  Both modes now use the same near-black-on-sage reading.

**The `--muted` row mapping to `--color-surface` is intentional**:

- shadcn's `--muted` is consumed as a fill surface: Skeleton, the
  muted Card variant, hover-row backgrounds, Tab unselected fill.
- Mapping it to `--color-border` (hairline color) produces
  weird Skeleton states — `#D6D7D1` on `#ECEEE9` in light mode is
  a barely-perceptible tonal shift, and at common Skeleton sizes
  reads as "almost-bg with a faint tinge" rather than a clear
  recessed surface.
- `--color-surface` (light `#F5F6F2` / dark `#20231F`) is the
  closer semantic match: it IS the Mist & Meadow "slightly
  recessed surface" token, which is exactly what shadcn's `--muted`
  is supposed to be.
- shadcn's `--muted-foreground` is a text color and maps to the
  Mist & Meadow `muted` token (`#6E7572` light / `#8B928F` dark) —
  the direct semantic match. Unchanged from earlier drafts.

**The `--destructive` hard requirement** (FR-042):

> **SUPERSEDED 2026-05-20** by the FR-042 scope clarification recorded in
> `docs/CHANGELOG.md` and `docs/DECISIONS.md`. The current mapping is
> `--destructive → var(--color-crimson)` + `--destructive-foreground →
> var(--color-bg)`, not amber. The contrast claim below ("dark mode is
> 11.2:1") was computed incorrectly — dark mode's `--foreground` is the
> light-ink `#DCDED5`, not the dark-ink `#1F2522`, so amber + dark-ink is
> actually `1.4:1`, well below WCAG AA. The error surfaced at T019 when
> the shadcn button primitive emitted a `text-destructive-foreground`
> reference that exposed the dark-mode contrast gap. Crimson +
> bg-as-foreground passes AA in both modes (6.08:1 light, 5.02:1 dark).
> The original Phase 0 analysis below is preserved verbatim as
> historical context.

- shadcn's default `--destructive` is a red-sector hue. This
  violates Constitution Principle V's "red is forbidden anywhere in
  the UI."
- Both light and dark map to `--color-amber` (`#DCB587`).
  Mist & Meadow's amber is the same hex in both modes — the constant
  is intentional, and it makes the override cleaner (a single
  declaration, not two).
- The `--destructive-foreground` row is not in the user's directive
  table because shadcn's recent CLI does not include it as a
  separate variable on the v4 path; the `destructive` variant's
  text color derives from `text-foreground` (already mapped to
  `--color-ink`). On amber, ink contrast in light mode is 6.6:1 and
  in dark mode is 11.2:1 — both pass.

---

## R-3 — Dark-mode attribute migration (Decision C)

**The mechanical change**:

- `apps/web/app/providers.tsx`: `attribute="data-theme"` →
  `attribute="class"`; add `storageKey="serenify-theme"`.
- `apps/web/app/globals.css`: `:root[data-theme="dark"] { ... }` →
  `:root.dark { ... }` (or simply `.dark { ... }` — both work).

**Grep scope to verify the diff is small**:

- Search `apps/web/` for the literal `data-theme`. Expected matches
  before the change: `providers.tsx` (the attribute prop) and
  `globals.css` (the selector). Both edited.
- Search `apps/web/` for the literal `[data-theme=`. Expected
  matches: only `globals.css`. After the change: zero.
- Search the `apps/web/tests/` directory for any test that asserts
  on `[data-theme]` — none found in the current repo.

**Why migrate rather than configure shadcn to read `data-theme`**:

- shadcn primitives' CSS is namespaced to `.dark`. Each primitive's
  emitted file contains `.dark .my-class { ... }` rules. Configuring
  shadcn to read `data-theme` would require editing every primitive
  file's CSS — and re-editing them every time we run `shadcn add`
  for a new primitive. The toil compounds.
- Migrating once is a 3-line diff and zero ongoing cost.

**Why add the explicit `storageKey`**:

- next-themes default is `theme`. Two next-themes-using apps loaded
  under the same dev-server origin (rare, but possible) would
  collide. Namespacing to `serenify-theme` is cheap insurance and
  makes the persisted value greppable in the browser devtools.

---

## R-4 — Theme persistence (Decision D)

next-themes ≥ 0.4 already provides everything FR-053 asks for:

- **Page-navigation persistence**: localStorage is process-scoped,
  not route-scoped. Client-side navigation preserves it by default.
- **Sign-out / sign-in persistence**: localStorage is origin-scoped,
  not session-scoped. Supabase's signOut() clears auth cookies and
  the `sb-*` localStorage entries, but it does not touch
  `serenify-theme`.
- **No server round-trip**: `setTheme(...)` calls
  `localStorage.setItem` directly. Server is uninvolved.
- **OS preference fallback**: `defaultTheme="system"` +
  `enableSystem` reads `prefers-color-scheme` on first paint when
  no localStorage value exists.
- **Manual override priority**: once `setTheme("light")` or
  `setTheme("dark")` writes, subsequent reads of `resolvedTheme`
  return that value until `setTheme("system")` clears the override.

**No `profiles` column** for theme is added. A server-side
persistence (writing to `profiles.theme_preference`) was considered
and rejected: it adds a round-trip on every flip, requires a new
RLS-policy review, and the localStorage path already covers
cross-session for the same browser. The case "user switches
browsers" is rare enough to accept reverting to the OS preference.

---

## R-5 — `components.json` shape (Decision E)

The shape committed in `plan.md` Decision E is the literal contents
we expect from `npx shadcn@latest init` on the Tailwind v4 path,
hand-tightened in two places:

1. `aliases.ui` → `@/components/ui`. The CLI's default suggestion
   matches this; we confirm it.
2. `aliases.utils` → `@/lib/utils`. We add a `lib/utils.ts` if
   missing (it currently does not exist in `apps/web/lib/`); shadcn
   primitives import the `cn()` helper from this path.

The `tailwind.config` field is the empty string because Tailwind v4
removes the JS config file. `tailwind.css` is the relative path to
`globals.css` from the workspace root. `tailwind.cssVariables: true`
is non-negotiable — without it, shadcn primitives emit Tailwind
utility classes instead of var-driven styles and the Mist & Meadow
mapping breaks.

---

## R-6 — Component folder layout (Decision F)

**Why bespoke goes under `components/ui/auth/` instead of
`components/auth/`**:

- The bespoke primitives ARE primitives — they have the same
  prop-shape contract as shadcn's flat primitives (e.g., `Field`
  takes the same `id`, `label`, `error` props in any context).
- The semantic of `components/ui/` as "the design-system primitives
  layer" should hold for both shadcn and bespoke. The `auth/`
  subfolder communicates provenance ("these are feature-001's
  bespoke primitives") without breaking the semantic.
- The alternative (`components/auth/`) would put primitives at the
  same level as composite folders like `header/` and `home/`,
  blurring the primitive-vs-composite distinction.

**Why `notification.tsx` is NOT under `ui/`**:

- It composes multiple primitives and a viewport-sensing hook. It is
  application-level, not design-system-level.
- shadcn's own convention places composite components outside `ui/`:
  e.g., the `mode-toggle.tsx` in the shadcn dark-mode docs lives at
  `components/mode-toggle.tsx`, not `components/ui/mode-toggle.tsx`.

**Why per-feature subfolders (`header/`, `home/`, `account/`)**:

- Each subfolder owns 3–5 components that are used by exactly one
  route or layout. Grouping by feature keeps related files close
  and lets `/speckit.tasks` decompose work along folder boundaries.
- The shadcn convention does not mandate per-feature subfolders, but
  it does not forbid them, and the React community trend in 2025–
  2026 is toward feature-folder organization for non-primitive
  components.

**Discovered during planning** (not in the spec verbatim):

- `apps/web/app/(auth)/otp-panel.tsx` is an auth-only primitive
  that lives in the route group, not in `components/ui/`. It is
  not "inlined in a page file" so FR-038's exact wording doesn't
  capture it — but it is logically a peer of `PasswordInput` and
  belongs in the new `components/ui/auth/` subfolder. Moving it is
  in scope of this feature, included in the step-1 extraction.

---

## R-7 — Cross-tab listener mount location

The spec's FR-045 says "mounted at the authed shell root". US 6 AS-1
says: "Given two tabs at `/login`, when the user signs in in tab A,
then tab B navigates to `/app` automatically." Two tabs at `/login`
are NOT inside the (authed) layout — they are inside the (auth)
layout, or in the root layout if any pre-auth surface mounts outside
both groups.

**If the listener mounts in `(authed)/layout.tsx`**:

- Tab A signs in → (authed)/layout.tsx mounts → listener subscribes
  → fires `SIGNED_IN` → navigates tab A to `/app` (which was going
  to happen anyway from the form submit).
- Tab B is still at `/login` (auth layout). The (authed) layout
  never mounted in tab B. No listener subscribed. The
  `storage`-driven event fires, but no React effect is listening
  in tab B. US 6 AS-1 fails.

**Mount at `app/layout.tsx` (root)**:

- Mounted in EVERY tab regardless of route.
- Tab B at `/login` has the listener subscribed; the storage event
  fires Supabase's onAuthStateChange callback; the listener calls
  `router.push("/app")`; tab B navigates.
- This is the correct architecture.

The listener is wrapped in a client component (`"use client"`) at
`apps/web/app/cross-tab-auth.tsx` and rendered by the root layout
inside `<body>` as a sibling of `<Providers>`. It returns `null` —
its only job is the subscription.

**Pathname-gating** (FR-046):

- The listener inspects `usePathname()` before calling
  `router.push`. `SIGNED_IN` on a pathname already in the
  `(authed)` group is a no-op (the local tab navigated itself).
  `SIGNED_OUT` on a pathname already in the `(auth)` group is a
  no-op. Only the cross-tab case actually pushes.
- `TOKEN_REFRESHED` is always a no-op regardless of pathname.

---

## R-8 — Notification component composition (Decision G)

**Why not Sonner**:

- Sonner positions toasts in a top-right or bottom-right stack with
  auto-dismiss. The stack model is "many at a time, transient." Our
  FR is "one at a time, persistent until user dismisses, with a
  full-width bottom-sheet variant at ≤768px."
- Sonner's mobile mode is still a stacked toast at the top of the
  screen. Re-implementing the bottom-sheet bifurcation inside
  Sonner would mean wrapping `<Toaster />` in a custom positioner
  that overrides its built-in positioning, which fights the
  library.
- Sonner adds a Provider-style global queue. We don't have a queue
  use case — one consumer at a time mounts the surface.

**Why Radix Dialog**:

- Radix Dialog's primitive is unstyled and unopinionated about
  position. We add our own positioning via Tailwind classes and
  Framer Motion variants.
- Accessibility comes for free: focus trap, `aria-modal`, escape
  to close, click-outside semantics. (For a true non-modal toast,
  we'd disable the focus trap; for a confirmatory questionnaire
  surface in feature 007, the trap is desirable.)
- The same primitive backs shadcn's `dialog`, so we share
  dependencies (`@radix-ui/react-dialog` is already added by
  `shadcn add dialog`).

**Why Framer Motion**:

- `prefers-reduced-motion` via Framer's `useReducedMotion` is the
  React-state-driven gate the FR requires. The CSS rule in
  `globals.css` (which sets transition-duration to 0.01ms) does
  NOT affect React state-driven animations because Framer Motion
  uses JS to interpolate values; it doesn't drive CSS transitions.
- The variants pattern lets us write the desktop slide-in and
  mobile slide-up as two named variants and switch between them
  via a single prop.

**Implementation sketch** (for /speckit.tasks decomposition):

```tsx
"use client";
import * as Dialog from "@radix-ui/react-dialog";
import { motion, useReducedMotion } from "framer-motion";
import { useMediaQuery } from "@/hooks/use-media-query";

export function Notification({ open, onOpenChange, title, body, dismissLabel = "Dismiss", children }) {
  const isMobile = useMediaQuery("(max-width: 768px)");
  const reduceMotion = useReducedMotion();
  const variants = reduceMotion
    ? { initial: { opacity: 0 }, animate: { opacity: 1 }, exit: { opacity: 0 } }
    : isMobile
    ? { initial: { y: "100%" }, animate: { y: 0 }, exit: { y: "100%" } }
    : { initial: { x: "110%", y: 0 }, animate: { x: 0, y: 0 }, exit: { x: "110%" } };
  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Content asChild>
          <motion.div
            initial="initial" animate="animate" exit="exit" variants={variants}
            className={isMobile ? "fixed inset-x-0 bottom-0 ..." : "fixed right-4 bottom-4 ..."}
          >
            { /* title, body, children, dismiss button */ }
          </motion.div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
```

The exact className and props finalize during `/speckit.tasks`. The
component exports `Notification` and `type NotificationProps`.

---

## R-9 — Toast-above-pill gap (Decision H)

16px (Tailwind `gap-4`). Justification:

- Tailwind v4's default spacing scale at 1rem = 4 × 0.25rem.
  `gap-4` = 16px.
- Mist & Meadow's Constitution-encoded whitespace philosophy reads
  as "comfortable, not cramped." 16px between two distinct surfaces
  in the bottom-right quadrant is the comfortable tier.
- 8px (`gap-2`) reads as cramped — the toast and pill visually
  collide at small sizes.
- 24px (`gap-6`) strands the toast halfway up the viewport. By the
  time the eye traces from a bottom-right pill upward 24px + a 48px
  pill-height + 24px more, the toast is at a vertical position
  that suggests it's not associated with the pill anchor.

The gap is documented as a constant in the notification component's
JSDoc:

```tsx
/**
 * Layout convention: when rendered concurrently with the persistent
 * chat pill, this surface stacks ABOVE the pill with a 16px gap.
 * Features 007 (questionnaire), 008 (chatbot), and 010 (manager
 * check-ins) inherit this convention.
 */
```

The chat pill exports its own height constant (`CHAT_PILL_HEIGHT =
48`) from `components/chat-pill.tsx`. The notification's desktop
positioning computes
`bottom: calc(1rem + ${CHAT_PILL_HEIGHT}px + 1rem)`.

---

## R-10 — Header right-cluster mechanics (Decision I)

Comment marker over invisible placeholder:

- A `<div className="hidden" />` placeholder adds two DOM nodes
  that screen readers might still announce (depending on the
  `display: none` semantics for each consumer) and counts in flex
  child-count math (`gap-3` between three children with one hidden
  is still 3 gaps).
- A JSX comment marker (`{/* feature 010 inserts ... here */}`)
  produces zero DOM nodes. Flex math is two children, one gap.
  When feature 010 inserts `<TalkButton />`, it becomes three
  children, two gaps. The theme toggle and avatar shift by the
  width of the talk button + 12px. No surprise reflow.
- The comment also documents intent at the point of insertion.
  Future maintainers (and feature 010's implementer) read the
  comment and know where to insert the button.

---

## R-11 — Active-nav indicator (Decision J)

- Soft surface-token pill (`bg-surface`) over text-only-with-
  underline because underlines on a top nav read as link-state, not
  active-state — calm-first prefers the spatial signal over the
  typographic one.
- Normal text weight (no bold) because Constitution Principle V's
  voice rubric reads "calm, not perky"; bold-when-active reads as
  emphasis. The pill background is enough signal.
- `rounded-md` (= `--radius-control`, 8px) matches button radii so
  the pill reads as a peer of the other interactive controls in
  the header.

---

## R-12 — `full_name` length handling (Decision K)

The 60-character store limit is enforced application-side, not in
the database, because:

- The feature-001 schema declares `full_name` as `text` with no
  CHECK constraint. Adding a `text(60)` or a CHECK now would be a
  schema migration, and the spec is explicit that this feature
  ships no migrations.
- Application-side enforcement covers the writer (the account-page
  editor). The seed (feature 002) generates names well under 60
  chars by faker's default corpora. No path inserts a `full_name`
  > 60 chars today.

The 24-character truncation in the header avatar / dropdown:

- Sampling: "Mohamed Asem" = 12. "Hebatullah El Gazoly" = 20.
  "Fatma Al-Zahraa Emad" = 20. "Christopher Williamson" = 22. All
  fit. A pathological 30-char name truncates to "First Twenty-Two
  Charac…", which is recognizable as the user's name without
  visually breaking the dropdown.
- The ellipsis is Unicode `…` (U+2026) — single character — not
  three ASCII dots. Three ASCII dots add 3 chars of width and
  drift the truncation point.

The edit field accepts 60 chars to let the user fix a truncated
name without surprise. If the editor pre-fills with the truncated
display value, the user might inadvertently delete characters
thinking they're full.

---

## R-13 — Role placeholder copy (Decision L)

The copy is in `plan.md` Decision L. Justification:

- **No exclamation marks**. Constitution Principle V hard
  requirement.
- **No future-tense promise with a date**. "Coming together" /
  "in progress" are calm-tense — they describe state, not a
  schedule. A promise like "lands next month" creates a contract
  we don't want to honor mid-development.
- **No alarmist or clinical words** (the blocklist: "alert",
  "detected", "elevated risk", "abnormal"). The copy reads as
  product-status, not user-state.
- **Mention of "privacy" in the team_lead copy** ties to
  Constitution Principle I — the team-lead view will respect
  privacy by construction (feature 011), and naming it here
  primes the user.
- **Mention of "account settings are available below" in the admin
  copy** softens the empty-feeling landing by acknowledging the
  reachable surface.

---

## R-14 — Welcome banner subtitle (Decision M)

**Chosen** (by Mohamed during plan review): **"A space to check in
with yourself."**

Three candidates were on the table:

a) "We're here when you need us." — time-neutral partner-voice.
b) "A space to check in with yourself." — reflective, introspective.
c) "However you're showing up today." — variable-state warmth.

The spec's FR-008 mandates a time-of-day-adaptive greeting ("Good
morning" / "Good afternoon" / "Good evening"). All three candidates
pair cleanly with every adaptive prefix — unlike the spec's example
"A calm start to your day," which only fits morning. That spec
example was eliminated up front for this reason.

Of the three remaining candidates, (b) was chosen because:

- "Check in with yourself" primes the eventual product loop —
  passive detection raises a question, the questionnaire (feature
  007) confirms it, the chatbot (feature 008) deepens it.
  Introspection is the through-line; the subtitle on day one
  signals what the surface is for.
- It is more inward-facing than (a)'s "we'll be here" framing,
  which positions Serenify as a passive helper rather than a
  reflection tool.
- It is less variable-tense than (c)'s "however you're showing up,"
  which reads slightly looser and risks sounding like a greeting
  card.

The rationale is logged in `docs/DECISIONS.md` per the user's
directive.

---

## R-15 — Playwright cross-tab spec pattern (Decision N)

The mechanics behind "single context, two pages":

- Supabase's auth client uses localStorage to persist the session.
  When `signIn` succeeds in one tab, the session is written to
  localStorage and a `storage` event fires.
- The `storage` event is fired in OTHER same-origin same-storage
  contexts — not in the tab that did the write. So tab B (which
  shares localStorage with tab A) hears the event; tab A does not.
- Supabase's onAuthStateChange listener internally subscribes to
  this `storage` event (in addition to its own in-tab events).
  The cross-tab fire goes through this path.
- Playwright's `browser.newContext()` creates an isolated storage
  context. Two contexts do not share localStorage. The `storage`
  event never fires across them, and the listener never sees the
  cross-tab transition.

**Single context, two pages** is the correct primitive: the two
pages share localStorage by virtue of being in the same context.
The `storage` event fires in page B when page A writes.

Both the sign-in and sign-out are driven through the real UI in
pageA:

- Sign-in: fill the `/login` form, click submit.
- Sign-out: pageA (now on `/app`) opens the profile dropdown and
  clicks the "Sign out" menu item.

A `page.evaluate(() => client.auth.signOut())` shortcut was
considered for the sign-out half — calling the Supabase client
directly bypasses the dropdown-click and isolates the listener
behavior — but **rejected** for two reasons:

1. Inside `page.evaluate`, a bare `import("@supabase/ssr")` does
   not resolve in the browser context (the page bundler hasn't seen
   it), so the shortcut would actually require constructing a
   client from raw URL + anon-key plumbing inside the test. That
   couples the spec to client-internal details that should stay
   implementation detail.
2. Driving both halves through real UI keeps the spec uniform and
   resilient to client-factory refactors. The dropdown-click adds
   one selector but does not introduce flakiness — the dropdown is
   a Radix primitive with deterministic open/close semantics.

The 2-second budget aligns with SC-008. Under `workers: 1`
(DECISIONS 2026-05-17) the spec does not race other auth specs.

---

## R-16 — `framer-motion` dependency

- New dep, caret-pinned (`^x.y.z` — exact version locked during
  `/speckit.tasks` against the latest stable on the npm registry).
- Used by `components/notification.tsx` only in this feature.
- Future features (007, 008, 010) inherit the dep via their
  notification consumption.
- `useReducedMotion` is the canonical reduced-motion gate for any
  React-state-driven animation in this codebase going forward. The
  CSS rule in `globals.css` remains as a defense-in-depth for
  CSS-transition-driven animations (e.g., hover states).

The Constitution's Principle VI lists Framer Motion as permitted
"only when motion is subtle and opt-out is wired" — the notification
component satisfies both.

---

## R-17 — Out-of-Scope-bullet supersession

The spec's Out-of-Scope section contains a bullet about the
`/login?error=expired_link` notice bug from feature 001's BACKLOG,
calling it a separate hotfix off `main`. Between spec commit and
plan-time, that hotfix shipped:

- Commit `0acb0e1` (`fix(001): render expired-link notice on
  /login`).
- Merged via PR #2 as commit `8dc822b` (the merge commit).
- The 003 branch's merge-base with main is `8dc822b`, confirming
  the branch is rebased onto post-hotfix main.

The spec is committed and immutable. Per Constitution Principle
VIII and the user's directive, the supersession is recorded in
`docs/CHANGELOG.md` (a NEW file — first entry under feature 003).
The CHANGELOG entry:

- Names the stale bullet.
- Names the superseding commit.
- Confirms no spec edit is needed.

`docs/BACKLOG.md` should also have its expired-link bullet
re-classified as `merged` / removed during this feature's
`/speckit.implement` step 13 (smoke-tests) — but that is a BACKLOG
hygiene action, not a plan-time decision.
