# Component Contracts: Employee Dashboard Shell

Each component below lists its props, events, accessibility
attributes, and consumer contract. The shape committed here is what
`/speckit.tasks` decomposes into implementation tasks. Type signatures
are TypeScript-style; final `.tsx` files will have richer JSDoc.

---

## `apps/web/components/header/header.tsx` **[server]**

Server Component. Reads the current user's `full_name` + `role` from
`profiles` and renders the persistent top header for the authed
surface.

```ts
type HeaderProps = {
  fullName: string | null;  // from profiles.full_name
  email: string;            // from auth.users.email — for avatar fallback
  role: "employee" | "team_lead" | "admin";
};
```

Renders, left-to-right:

1. Serenify logo (DM Serif Display "Serenify" + the small meadow dot
   already in the feature-001 (authed) layout) — wrapped in
   `<Link href="/app">`.
2. `<CenterNav />` (FR-001) — the workflow-destination region.
3. Right cluster (Decision I):
   - `<ThemeToggle />` (existing component, reused).
   - `{/* feature 010 inserts <TalkButton /> here */}` — JSX comment.
   - `<ProfileDropdown fullName={...} email={...} />`.

Mobile (≤768px): the center nav is replaced by a `<MobileMenu />`
hamburger; profile avatar stays as its own trigger.

Accessibility:

- The top header is a `<header>` landmark.
- Logo link has `aria-label="Go to home"`.

---

## `apps/web/components/header/center-nav.tsx` **[client]**

Client Component (uses `usePathname()` for active-state).

```ts
type CenterNavProps = {};  // no props — destinations are statically defined in this feature
```

Renders a `<nav aria-label="Workflow destinations">` containing the
list of workflow destinations. In this feature: only "Home" → `/app`.

Active state (Decision J): if `usePathname()` starts with the
destination's href, render with `bg-surface rounded-md` background;
otherwise no background. Normal text weight. No underline.

The component is intentionally static — destinations are NOT pulled
from a config object in this feature. Future features (008 Chat, a
later Insights) add destinations by editing this file directly.

Mobile: this component renders `null` at ≤768px viewports;
`<MobileMenu />` is the mobile substitute.

---

## `apps/web/components/header/profile-dropdown.tsx` **[client]**

Client Component (uses Radix dropdown via `@/components/ui/dropdown-menu`).

```ts
type ProfileDropdownProps = {
  fullName: string | null;
  email: string;
};
```

Trigger: an `<Avatar />` (`@/components/ui/avatar`) rendered with the
initials derived per Decision K (`fullName` if available, else
email-local-part fallback). The trigger has `aria-label="Open
profile menu"` and is a ≥44×44px tappable target.

Content (FR-003):

1. Header item: the user's display name (the truncated 24-char
   form from Decision K). Non-actionable. Rendered with
   `<DropdownMenuLabel>`.
2. `<DropdownMenuItem asChild><Link href="/app/account">Account</Link></DropdownMenuItem>`.
3. `<DropdownMenuItem>` wrapping a `<form action={signOut}>` with a
   "Sign out" button (uses the existing `signOut` server action).

No other items (settings, preferences, theme, language are out of
scope or live elsewhere — Decision is part of FR-003).

Accessibility:

- Keyboard navigable via Radix defaults.
- Focus returns to the avatar trigger on close.

---

## `apps/web/components/header/mobile-menu.tsx` **[client]**

Client Component, rendered only at ≤768px.

```ts
type MobileMenuProps = {};
```

Renders a hamburger icon button (Lucide `Menu`). On click, opens a
`<Sheet>` (`@/components/ui/sheet`) containing the workflow
destinations list — same destinations as `<CenterNav />` but in a
vertical layout suitable for a sheet.

Profile avatar is NOT inside this sheet (FR-005). The avatar trigger
sits in the header separately at all viewport widths.

---

## `apps/web/components/home/welcome-banner.tsx` **[server]**

Server Component.

```ts
type WelcomeBannerProps = {
  fullName: string | null;
  // Time-of-day is computed inside the component from the request's
  // local time. See note below on timezone handling.
};
```

Renders:

- An `<h1>` in DM Serif Display: the adaptive greeting per FR-008
  + first name per FR-010, or the name-less form if `fullName` is
  null.
- A `<p>` subtitle: the static line from Decision M ("A space to
  check in with yourself.").

**Timezone**: the time-of-day prefix is computed server-side in this
feature using the server's local time. This is correct for users in
the same timezone as the Vercel deployment region. A future
enhancement (logged in BACKLOG) would defer the greeting to the
client and use `Intl.DateTimeFormat().resolvedOptions().timeZone` to
match the user's actual locale. For now, the simpler server-side
computation is acceptable because the project's research-only scope
(Constitution Principle X) and the demo cohort don't exercise a
broad geographic footprint.

---

## `apps/web/components/home/todays-checkin-card.tsx` **[server]**

Server Component. Renders the large primary card on the left ~60%
of the desktop layout.

```ts
type TodaysCheckinCardProps = {};  // empty skeleton in this feature
```

Renders a `<Card>` (shadcn) with calm "not yet" empty-state copy. No
form, no signal indicators, no recommendations — those land in
features 004–009.

Copy direction (finalized during `/speckit.tasks`): a brief headline
like "We'll surface your check-in here." plus a one-sentence body
explaining that the surface lights up as the product learns more.
No exclamation marks. No alarmist language.

---

## `apps/web/components/home/things-that-might-help-card.tsx` **[server]**

Server Component. Smaller secondary card, upper-right.

Same shape and styling as `TodaysCheckinCard`. Copy direction:
something like "Suggestions land here when they're useful."

---

## `apps/web/components/home/recent-chats-card.tsx` **[server]**

Server Component. Smaller secondary card, lower-right.

Same shape and styling. Copy direction: "Past conversations show up
here."

Final copy is set in `/speckit.tasks`.

---

## `apps/web/components/account/profile-section.tsx` **[client]**

Client Component (form state requires `"use client"`).

```ts
type ProfileSectionProps = {
  initialFullName: string;
  email: string;
};
```

Renders the Profile section of `/app/account` (FR-016a):

- `full_name` editable input (uses the bespoke `Field` primitive from
  `@/components/ui/auth/field` — reused so the styling matches the
  (auth) surfaces).
- Email read-only display (rendered as plain text, NOT an `<input>` —
  per FR-018).
- An avatar/initials placeholder (the same `<Avatar>` shape the
  header uses, but at a larger size).

On submit, calls the `updateProfile` server action. Optimistic
update: the form pushes the new `fullName` to a parent React state
(or context) that the header avatar and dropdown read from, so the
header updates on the same render cycle without waiting for the
server action to return (FR-017).

Validation: `z.string().trim().min(1).max(60)` (Decision K).

Layout: stacked label-above-input, generous spacing, single primary
"Save changes" button at the bottom of the section.

---

## `apps/web/components/account/security-section.tsx` **[server]**

Server Component.

```ts
type SecuritySectionProps = {};
```

Renders the Security section (FR-016b, FR-020):

- A short label and explanatory line.
- A "Change password" affordance — implementation: a `<Link
  href="/forgot-password">` styled as a secondary button (uses the
  shadcn `Button` with `variant="secondary"`).

No inline password form. No new email template. The link routes
into feature 001's existing flow.

---

## `apps/web/components/account/privacy-placeholder.tsx` **[server]**

Server Component.

```ts
type PrivacyPlaceholderProps = {};
```

Renders the Privacy section as a muted dashed-border container
(FR-021):

- `border-2 border-dashed border-border bg-bg/40` (or equivalent
  on the Mist & Meadow token system).
- A short calm copy line: "Privacy controls arrive with the
  transparency view." (finalized during `/speckit.tasks`).
- No form controls.

---

## `apps/web/components/account/notifications-placeholder.tsx` **[server]**

Server Component. Same shape as `<PrivacyPlaceholder>` but with
"Notifications" labeling and a TBD-flavored copy line. No live
controls.

---

## `apps/web/components/account/sign-out-section.tsx` **[server]**

Server Component. Uses the shared `<SignOutButton variant="secondary">`
sub-component (introduced in this feature) — the same button used by
the profile dropdown and the role placeholder, ensuring all three
sign-out paths share understated styling per the
"sign-out styling consistency" rule in plan.md.

```ts
type SignOutSectionProps = {};
```

Renders the Sign out section at the bottom of `/app/account`
(FR-016e, FR-022):

- A short label "Sign out".
- A `<form action={signOut}>` with a single button. The button
  uses the shadcn `Button` with `variant="secondary"` (visually
  understated per calm-first; FR-022 explicitly forbids a large
  destructive treatment).

---

## `apps/web/components/role-placeholder/role-placeholder.tsx` **[server]**

Server Component.

```ts
type RolePlaceholderProps = {
  role: "team_lead" | "admin";
};
```

Renders the one-screen placeholder for non-employee roles (FR-034,
Decision L). Layout: centered single column with `py-24 sm:py-32`,
DM Serif Display heading at the welcome-banner scale, Inter
subtitle in `text-muted`, a Sign out button below.

Branches on `role` to pick the copy variant:

| role | heading | subtitle |
|---|---|---|
| `team_lead` | "Your team-lead view is coming together." | "We're building something that respects your team's privacy. Check back soon." |
| `admin` | "Your admin view is in progress." | "Org-wide tools land in a later release. Account settings are available below." |

Does NOT render:

- The welcome banner.
- The three skeleton cards.
- The persistent chat pill (FR-035 — enforced at the layout level
  by gating the pill on `role === "employee"`).

DOES render (FR-034):

- The same header as the employee shell (logo, theme toggle,
  reserved talk slot, profile avatar/dropdown).

---

## `apps/web/components/chat-pill.tsx` **[client]**

Client Component (interactive — onClick is a true no-op in this
feature; feature 008 wires the real chatbot).

```ts
type ChatPillProps = {};  // visual-only; no consumer-supplied state in this feature

export const CHAT_PILL_HEIGHT = 48;  // exported for testing and documentation; runtime contract is --chat-pill-offset (Decision H)
```

Renders a `fixed bottom-4 right-4` pill — a horizontal capsule on
desktop (icon + "Chat" label), an icon-only floating circle on
mobile (≤768px). Background uses `--color-surface`, border uses
`--color-border`, icon uses `--color-meadow`.

Touch target ≥44×44px on mobile (Constitution VI; FR-025).

Click handler: a **true no-op**. FR-024 explicitly allows "either do
nothing or open a placeholder 'coming soon' empty state" — we pick
"do nothing" so feature 008's wiring is a pure addition rather than
a substitution. No network call, no analytics, no popover, no chat
surface.

CSS-variable offset (Decision H): on mount the pill sets
`document.documentElement.style.setProperty("--chat-pill-offset",
"${CHAT_PILL_HEIGHT}px")`; on unmount it removes the property. The
notification component reads this variable to compute its bottom
offset, so notifications on manager pages (where the pill is gated
off) collapse the math to `bottom: 2rem` automatically via the
CSS `var(..., 0px)` fallback.

Persistence: rendered by `(authed)/layout.tsx` outside the
`<main>` content so navigations between `/app` and `/app/account` do
not remount it.

Role gate: rendered only when `role === "employee"`. The layout
threads role from its profile read to the pill (FR-035).

---

## `apps/web/components/notification.tsx` **[client]**

Client Component (Decision G).

```ts
type NotificationProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  body?: string;
  children?: React.ReactNode;     // for action buttons / questionnaire content
  dismissLabel?: string;          // default "Dismiss"
};
```

Renders a controlled notification surface:

- Desktop (≥768px): bottom-right slide-in card.
- Mobile (≤768px): bottom sheet.
- Reduced-motion: opacity-only entrance/exit.

Composition: Radix Dialog + Framer Motion + `useMediaQuery` hook.

Stacking with the chat pill (Decision H, FR-032): on desktop the
component positions itself at
`bottom: calc(1rem + var(--chat-pill-offset, 0px) + 1rem)`. The
chat pill (when mounted on the employee shell) writes its height
to `--chat-pill-offset` on `<html>` on mount; the notification
reads it via the CSS `var()` chain. The `0px` fallback collapses
the math to `bottom: 2rem` (16px above the viewport edge) when the
pill is absent — which is the case on team_lead / admin pages
(features 010+) where the pill is gated off by FR-035. No
component-to-component prop wiring needed.

On mobile the bottom sheet covers the chat pill area entirely; the
chat pill remains in the DOM but sits below the sheet's backdrop.

In this feature, NO production code mounts the component (FR-033).
The Vitest + RTL test exercises the three configurations directly.

Exports `Notification`, `type NotificationProps`, and
`CHAT_PILL_HEIGHT` (re-exported from `chat-pill.tsx` for convenience).

---

## `apps/web/components/cross-tab-auth.tsx` **[client]**

Client Component, imported and rendered by the root layout
(`apps/web/app/layout.tsx`). Lives under `components/` rather than
inside `app/` so the `app/` tree stays route-only and the
non-route helper does not co-mingle with route segments.

Decision R-7 / FR-045.

```ts
export function CrossTabAuth(): null;
```

Subscribes to `supabase.auth.onAuthStateChange` once on mount.
Returns `null` — no visible UI.

Pathname-gated `router.push()`:

- `SIGNED_IN` on `/login` / `/signup` / `/forgot-password` /
  `/reset-password` / `/` → `router.push("/app")`.
- `SIGNED_OUT` on `/app` or `/onboarding` → `router.push("/login")`.
- All other transitions: no-op.
- `TOKEN_REFRESHED`: always no-op.

Cleanup: unsubscribes on unmount.

Tested by `cross-tab-auth-sync.spec.ts` per Decision N.

---

## `apps/web/hooks/use-media-query.ts`

```ts
export function useMediaQuery(query: string): boolean;
```

Standard `matchMedia` hook with SSR safety. Returns `false` during
SSR and on first client render until `matchMedia` has been queried;
flips to the real value on first effect.

Used by `notification.tsx` and any future component that needs to
branch on viewport. Not used by the header / center nav — those use
Tailwind responsive utility classes instead (cheaper, no JS).

---

## `apps/web/lib/truncate-name.ts`

```ts
export function truncateName(input: string, max: number = 24): string;
```

Returns `input` if `input.length <= max`; otherwise returns
`input.slice(0, max - 1) + "…"` (Unicode ellipsis, U+2026).

**Purity contract**: a pure function. No `Intl` APIs, no `toLocale*`
methods, no `Date` access, no environment reads. The output for a
given input is byte-identical on the server and the client — this
matters because the truncated name is computed in Server Components
(the header) and consumed in Client Components (the profile
dropdown) within the same render; any divergence between SSR and
CSR output would surface as a React hydration warning.

Counts characters using `.length` (UTF-16 code units). For the names
in scope (BMP characters, no astral-plane codepoints) this is
equivalent to grapheme count. Astral-plane names (emoji-in-name,
some scripts outside common usage) are not in the demo cohort and
not in the spec's edge cases.

Used by the header avatar tooltip and the profile dropdown header
item. Trivial — co-located in `lib/` rather than `components/` so
non-component consumers (e.g., a future analytics caption) can
reuse it.

---

## `apps/web/lib/utils.ts` (shadcn-introduced)

```ts
export function cn(...inputs: ClassValue[]): string;
```

The standard shadcn `cn()` helper (`clsx` + `tailwind-merge`). Added
by `shadcn init` if missing. Used by every shadcn primitive.

---

## Modified existing files (contracts unchanged, behavior preserved)

These files are modified for cosmetics or imports only; their
external contracts are unchanged:

- `apps/web/app/layout.tsx` — adds `<CrossTabAuth />` as a sibling
  of `<Providers>` inside `<body>`. No prop changes.
- `apps/web/app/providers.tsx` — `attribute="data-theme"` →
  `attribute="class"`; adds `storageKey="serenify-theme"`. No prop
  changes for consumers.
- `apps/web/app/globals.css` — adds the shadcn CSS-variable mapping
  block (Decision B); flips the dark selector from
  `:root[data-theme="dark"]` to `.dark` (Decision C). Mist & Meadow
  token values are unchanged.
- `apps/web/app/(authed)/layout.tsx` — body content replaced by the
  new shell (header + main + chat pill). The route-guard `getUser()`
  call is preserved; the redirect-on-missing-user is preserved.
- `apps/web/app/(authed)/app/page.tsx` — replaces the role-banner
  placeholder body with the role-conditional branch (employee
  shell body or `<RolePlaceholder>`).
- `apps/web/app/(auth)/*/[form].tsx` (login-form, signup-form,
  forgot-form, reset-form) — replaces the locally-defined `Field`
  with an import from `@/components/ui/auth/field`. No DOM change.
- `apps/web/app/(authed)/onboarding/onboarding-form.tsx` — same
  import change.
- `apps/web/app/(auth)/otp-panel.tsx` — file moves to
  `@/components/ui/auth/otp-panel.tsx`; import sites updated.
