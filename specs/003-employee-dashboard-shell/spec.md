# Feature Specification: Employee Dashboard Shell

**Feature Branch**: `003-employee-dashboard-shell`

**Created**: 2026-05-19

**Status**: Draft

**Input**: User description: Turn the bare `/app` placeholder shipped by
feature 001 into the actual authenticated employee surface — a persistent
header (logo, center nav with Home only, theme toggle, reserved
"I'd like to talk" slot, profile avatar/dropdown), a Home page with a
welcome banner and three skeleton cards (primary "Today's check-in" plus
secondary "Things that might help" stacked over "Recent chats"), an
`/app/account` page with five stacked sections (Profile, Security, Privacy
placeholder, Notifications placeholder, Sign out), a visual-only persistent
chat pill bottom-right, and a generic reusable notification toast/sheet
component (built but with no triggers wired). Includes a one-screen
placeholder landing for team_lead and admin roles so non-employees do not
see the employee dashboard during the months before features 011 and 012
ship. Folds in two items deferred from feature 001: extracting the bespoke
auth form primitives (`PasswordInput`, requirements checklist,
`Field`/`Label`/`ErrorText`) from the (auth) page files into
`apps/web/components/ui/`, and wiring cross-tab auth state sync via
`supabase.auth.onAuthStateChange`. Adopts shadcn/ui in this feature for
dashboard primitives only — auth surfaces stay bespoke, preserving the
editorial-calm direction feature 001 ratified.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Employee lands on the authenticated dashboard shell (Priority: P1)

An employee signs in and arrives at `/app`. Instead of the placeholder
text feature 001 shipped, they see the actual employee shell — a
persistent header across the top of every authed page (Serenify logo,
center navigation with "Home" as the only active destination, a theme
toggle icon button, an empty reserved slot for the future "I'd like to
talk" button, and a profile avatar/initials trigger), a welcome banner
("Good morning, [first name]" plus a static supportive subtitle), three
skeleton cards in a primary-plus-secondary layout (a large "Today's
check-in" on the left occupying ~60% of desktop width, with "Things that
might help" stacked above "Recent chats" on the right), and a small chat
pill anchored bottom-right.

**Why this priority**: This is the actual employee surface for every
subsequent feature — passive detection, calibration, inference,
questionnaire, chatbot, recommendations, and privacy controls all fill
in named slots inside this shell. Without the shell, none of those
features have anywhere to land. The shell is the contract.

**Independent Test**: Sign in as a `demo.serenify.local` employee user.
Confirm `/app` renders the welcome banner with the employee's first name,
the three skeleton cards in the correct layout (60/40 split on desktop;
single column at 360px with "Today's check-in" first, "Things that might
help" second, "Recent chats" third), the persistent header (logo, Home
active, theme toggle, profile avatar — no talk button), and the chat
pill bottom-right. Toggle theme from the header and confirm the choice
persists across page navigations and across sign-out / sign-in.

**Acceptance Scenarios**:

1. **Given** a confirmed employee user, **When** they sign in, **Then**
   they land on `/app` and the page renders the welcome banner with their
   first name (derived from `profiles.full_name` — first whitespace-
   separated token), the three skeleton cards in the documented
   primary-plus-secondary layout, the persistent header, and the
   persistent chat pill bottom-right.
2. **Given** the rendered shell, **When** the employee clicks the theme
   toggle in the header, **Then** the theme flips immediately, persists
   across page navigations within the authed surface, and persists across
   a sign-out / sign-in cycle.
3. **Given** the rendered shell, **When** the employee navigates between
   `/app` and `/app/account`, **Then** the header, theme choice, and chat
   pill remain visible without flicker and the active-nav indicator on
   "Home" highlights only on `/app`.
4. **Given** the rendered shell at desktop width (≥768px), **When** the
   employee inspects the right column, **Then** "Things that might help"
   appears above "Recent chats" with the documented vertical gap (not the
   other order).
5. **Given** the rendered shell at 360px viewport width, **When** the
   employee scrolls the page, **Then** the three cards are stacked in
   one column in the order "Today's check-in" → "Things that might
   help" → "Recent chats", the center navigation collapses behind a
   hamburger, the profile avatar remains as its own separate trigger
   (NOT folded into the hamburger), the chat pill collapses to an
   icon-only floating button bottom-right, and every interactive target
   in the header and pill measures ≥44×44px.
6. **Given** the empty-state copy in each of the three cards, **When**
   the employee reads it, **Then** no copy contains an exclamation mark,
   no copy uses clinical or alarming language ("alert", "detected",
   "elevated"), and no copy contains any color in the red sector
   (340–20°) — the cards inherit the Mist & Meadow palette only.
7. **Given** a user whose `profiles.full_name` is empty or null,
   **When** they land on `/app`, **Then** the welcome banner falls back
   to a calm greeting that does not address them by name (e.g. "Good
   morning") and the profile avatar shows initials derived from the
   user's email local-part (first letter, uppercased) — not a placeholder
   silhouette.

---

### User Story 2 - Employee manages their account from the profile dropdown (Priority: P1)

An employee opens the profile avatar dropdown from the header, sees their
display name, navigates to the account page via the Account link, edits
their full name, signs out cleanly, and the navigation never exposes an
"Account" or "Settings" entry in the center nav.

**Why this priority**: Account hygiene (changing name, signing out) is a
baseline expectation of any authed product. Without it, the shell looks
like a placeholder. The conceptual separation between workflow
destinations (center nav) and account/settings (profile dropdown) is
also the convention every future feature inherits — getting it wrong now
means redesigning navigation later.

**Independent Test**: Sign in as an employee, click the profile avatar,
confirm the dropdown shows the employee's display name + an Account link
+ Sign out, click Account, confirm the page renders the five stacked
sections in the documented order, edit the full name field, save, and
confirm the header avatar/initials and dropdown name update immediately
without a page reload. Sign out from the account page; confirm the
session ends and `/app` redirects to `/login`.

**Acceptance Scenarios**:

1. **Given** the rendered shell, **When** the employee clicks the
   profile avatar in the header, **Then** a dropdown opens containing
   exactly three items in order: the employee's display name (non-
   actionable header item), a link labeled "Account" routing to
   `/app/account`, and a "Sign out" button.
2. **Given** the rendered shell, **When** the employee inspects the
   center navigation, **Then** no "Account", "Settings", "Profile", or
   similar workflow entry is present — account-related affordances live
   only inside the profile dropdown.
3. **Given** the employee on `/app/account`, **When** the page renders,
   **Then** five sections appear stacked in this exact order: Profile,
   Security, Privacy (muted dashed-border placeholder), Notifications
   (muted dashed-border placeholder), and a Sign out button at the
   bottom. The Privacy and Notifications placeholders contain calm copy
   indicating those controls arrive in feature 010 (privacy) and a
   later feature (notifications) — no live controls are rendered.
4. **Given** the Profile section, **When** the employee edits the
   "Full name" field and submits the change, **Then** the new value
   persists to `public.profiles.full_name` for their `auth.uid()`, the
   header avatar/initials and dropdown display name update immediately
   on the same render cycle (without a page reload), and the welcome
   banner on `/app` reflects the new first name on next visit.
5. **Given** the Profile section, **When** the employee inspects the
   email field, **Then** the field is display-only (rendered as
   read-only text, not an editable input) and labeled in a way that
   makes its non-editability clear — email changes are out of scope for
   this feature.
6. **Given** the employee on `/app/account`, **When** they click the
   Sign out button at the bottom of the page, **Then** the session
   terminates, the browser navigates to `/login`, and any subsequent
   attempt to revisit `/app` or `/app/account` redirects back to
   `/login`. The same outcome holds when signing out from the profile
   dropdown on any authed page.
7. **Given** the account page at 360px viewport width, **When** the
   employee scrolls, **Then** the five sections stack in the same
   documented order, all controls remain ≥44×44px, and the dashed-border
   placeholders do not visually compete with the live Profile and
   Security sections (they are clearly muted).

---

### User Story 3 - Employee changes their password through Security (Priority: P1)

An employee on `/app/account` clicks "Change password" in the Security
section. The action routes them through the existing password-reset flow
shipped by feature 001 — email-delivered link or 6-digit OTP — without
this feature reimplementing password rotation logic.

**Why this priority**: Password rotation is part of account hygiene.
Building it into this feature alongside name editing keeps the
"account section grows by appending" convention coherent. Reusing
feature 001's reset flow (rather than building a new in-place form) is
the only realistic option without rebuilding PKCE.

**Independent Test**: Sign in as an employee, navigate to
`/app/account`, click "Change password" in the Security section. Confirm
the user is delivered into feature 001's `/forgot-password` flow (or an
equivalent server-action-driven entry point) such that completing it
results in a working new password and the user returns to a signed-in
state under the new credentials.

**Acceptance Scenarios**:

1. **Given** the employee on `/app/account`, **When** they activate the
   "Change password" affordance, **Then** they are routed into feature
   001's existing password-reset flow (the same path triggered by
   `/forgot-password`) — this feature MUST NOT introduce a new
   in-section password-rotation form or a new email template.
2. **Given** the employee completes the reset flow successfully,
   **When** they return to the app, **Then** they are signed in under
   the new password and any previously-issued sessions on other devices
   are handled per feature 001's existing semantics (this feature does
   not change those semantics).
3. **Given** the Security section, **When** the employee inspects it,
   **Then** no field captures the current or new password inline on
   `/app/account` — the reset is owned by the email-driven flow, not by
   this surface.

---

### User Story 4 - Non-employees see a placeholder, not the employee dashboard (Priority: P1)

A team_lead or admin signs in and lands at `/app`. Instead of the
employee shell with its three skeleton cards and chat pill, they see a
single calm one-screen placeholder that names their view as
"being built" and offers a sign-out affordance. Their landing surface
remains stable until features 011 (team_lead) and 012 (admin) replace it
wholesale.

**Why this priority**: This is a privacy guard, not a polish item. The
employee shell will host passive detection state, signal quality
indicators, and (later) the questionnaire prompt — all of which are
employee-perspective surfaces, not manager surfaces. A team_lead briefly
seeing an empty employee-view during the months between feature 003 and
feature 011 would seed confusion about what their actual view will look
like and could leak the wrong mental model of how the product works.
Existing feature 001 placeholders ("You are a team_lead",
"You are an admin") satisfy the test that role-routing still works, but
this feature replaces them with the one-screen calm placeholder so they
are visually consistent with the rest of the authed surface.

**Independent Test**: Sign in as the demo cohort's `team_lead` and
confirm `/app` shows the one-screen placeholder + sign-out affordance,
no welcome banner, no skeleton cards, no chat pill. Repeat for the demo
cohort's `admin`. Confirm sign-out from the placeholder returns them to
`/login`. Confirm a `team_lead` attempting to navigate to
`/app/account` either lands on a similarly minimal account surface or
is routed back to the placeholder — the employee dashboard surfaces
MUST NOT render.

**Acceptance Scenarios**:

1. **Given** a confirmed `team_lead` user, **When** they sign in,
   **Then** they land on `/app` and see the one-screen placeholder
   ("Your team-lead view is being built…" or equivalent calm copy) plus
   a clearly visible sign-out affordance. The employee welcome banner,
   the three skeleton cards, and the persistent chat pill MUST NOT
   render.
2. **Given** a confirmed `admin` user, **When** they sign in, **Then**
   the same one-screen placeholder pattern applies — distinct copy
   acknowledging the admin view is being built, plus a sign-out
   affordance.
3. **Given** a `team_lead` or `admin` on their placeholder, **When**
   they activate the sign-out affordance, **Then** the session
   terminates and they are redirected to `/login` — identical semantics
   to the employee sign-out path.
4. **Given** a `team_lead` or `admin`, **When** they attempt to
   navigate directly to `/app/account`, **Then** they either see a
   non-employee placeholder version of that page or are redirected back
   to `/app`. The full employee account page (Profile editor + Security
   + Privacy/Notifications placeholders) is acceptable to render for
   non-employees only if it carries no employee-specific copy or
   affordances; otherwise it MUST be gated. This decision is finalized
   in `/speckit.plan`.
5. **Given** the existing role-trio Playwright e2e suite from feature
   001, **When** it runs against this feature's branch, **Then** the
   employee, team_lead, and admin landing tests all pass — the
   role-routing contract from feature 001 is preserved, only the
   placeholder copy changes.

---

### User Story 5 - Reusable notification toast/sheet component ready for future features (Priority: P2)

A generic, dismissable notification surface is built and demonstrable in
isolation — bottom-right slide-in on desktop, bottom-sheet on mobile,
respects `prefers-reduced-motion`. No event sources it in this feature;
features 007 (questionnaire), 008 (chatbot), and 010 (manager check-ins)
will mount it later.

**Why this priority**: Building the toast/sheet now means features 007,
008, and 010 do not each invent their own bottom-right pattern. Setting
the stacking convention now (toast above chat pill, with a documented
gap) prevents three later features from each negotiating the same
layout question independently. This is foundational scaffolding, but it
is not user-facing on its own — hence P2, not P1.

**Independent Test**: Mount the toast/sheet component in a developer
preview surface (a Vitest story, a route under `/app/_dev/`, or
equivalent) with sample copy. Confirm at desktop width it slides in
from bottom-right and is dismissable via an explicit control. Confirm at
360px width it renders as a bottom sheet. Confirm with
`prefers-reduced-motion: reduce` set in the OS / browser, the entrance
animation is suppressed (or reduced to an opacity fade) and the surface
still appears and dismisses correctly. Confirm that when the chat pill
is rendered concurrently on a viewport that also shows the toast, the
toast sits above the chat pill with the documented vertical gap, not on
top of it.

**Acceptance Scenarios**:

1. **Given** the toast/sheet component mounted in a developer preview
   at desktop width, **When** it appears, **Then** it slides in from
   the bottom-right corner with subtle motion consistent with the
   Mist & Meadow visual finish (soft border, generous whitespace,
   amber-not-red for any callout accent).
2. **Given** the same component at 360px viewport, **When** it appears,
   **Then** it renders as a bottom sheet anchored to the bottom edge of
   the viewport, not as a small floating card.
3. **Given** the same component on a viewport with
   `prefers-reduced-motion: reduce`, **When** it appears, **Then** the
   motion is suppressed or reduced to an opacity-only transition.
4. **Given** the component visible on a viewport where the chat pill
   is also rendered, **When** both surfaces are present, **Then** the
   toast sits above the chat pill with a documented vertical gap (not
   overlapping). The exact pixel gap is set in `/speckit.plan` against
   the Mist & Meadow spacing scale.
5. **Given** the component is dismissed by the user, **When** the
   dismiss control is activated, **Then** the surface animates out
   (subject to `prefers-reduced-motion`) and unmounts.
6. **Given** this feature, **When** the suite runs, **Then** no event
   source in production code triggers the toast/sheet automatically —
   the component is exposed for later features to mount, but it is not
   wired to questionnaire, chat, or manager events in this feature.

---

### User Story 6 - Cross-tab auth state sync (Priority: P2)

An employee has two tabs of Serenify open. They sign in (or sign out)
in one tab; the other tab transitions to the authed shell (or back to
`/login`) without requiring a manual refresh.

**Why this priority**: Without this, an employee who signs up in one
tab and then returns to a pre-auth tab they had open earlier sees a
stale "Check your email" panel even after the activation completed.
This was logged in BACKLOG from feature 001 specifically to be folded
into the dashboard-shell work, because the auth shell root is the
natural mount point for the listener. The UX win is real but not
foundational — hence P2, not P1.

**Independent Test**: Open `/login` in two tabs. In tab A, sign in as
an employee. Confirm tab B transitions from the login form to `/app`
without manual refresh, within a short delay (target: under 2 seconds
in normal conditions). Repeat with sign-out: sign out from tab A;
confirm tab B transitions from `/app` to `/login` automatically.

**Acceptance Scenarios**:

1. **Given** two tabs at `/login`, **When** the user signs in in tab A,
   **Then** tab B navigates to `/app` automatically without manual
   refresh.
2. **Given** two tabs of `/app` open under the same authenticated
   session, **When** the user signs out from tab A, **Then** tab B
   navigates to `/login` automatically without manual refresh and any
   subsequent navigation attempts in tab B from cached page state
   trigger the existing route guard from feature 001.
3. **Given** the cross-tab listener is mounted at the authed shell
   root, **When** the same session is renewed by Supabase (token
   refresh), **Then** the listener does not gratuitously navigate the
   user — only `SIGNED_IN` (from a previously unauthenticated state) and
   `SIGNED_OUT` trigger navigation. Token-refresh events are silent.

---

### User Story 7 - Auth pages remain visually identical after primitives extraction (Priority: P2)

The bespoke auth form primitives currently inlined in
`apps/web/app/(auth)/**` page files — `PasswordInput`, the
password-requirements checklist, the `Field`/`Label`/`ErrorText`
wrappers — are moved into `apps/web/components/ui/`. After the move,
the login, signup, forgot-password, reset-password, and onboarding
pages render identically to before — same DOM structure, same CSS,
same behavior. No shadcn migration of auth surfaces happens in this
feature.

**Why this priority**: This is a tech-debt cleanup deferred from
feature 001's BACKLOG. The reason it ships on this branch is that
shadcn/ui adoption (for dashboard primitives) is most cleanly bootstrapped
when there is a real `components/ui/` directory already in place. By
extracting the auth primitives FIRST (as the first commit of the
branch), the shadcn install lands into an existing `components/ui/`
folder rather than creating one and immediately complicating the diff.
It is P2 because no user behavior changes — but a regression here would
be a feature-001 regression, so the bar for "visually identical" is
high.

**Independent Test**: Before any other commit on this branch, run the
existing Playwright auth happy-path specs from feature 001 against the
extracted-primitives state. Confirm every spec passes unchanged. Open
each (auth) page (`/login`, `/signup`, `/forgot-password`,
`/reset-password`, `/onboarding`) at desktop and at 360px in both light
and dark themes; confirm by eye that no spacing, typography, color, or
animation has shifted relative to `main`.

**Acceptance Scenarios**:

1. **Given** the feature-003 branch with the auth-primitives extraction
   landed as the first commit, **When** the existing role-trio Playwright
   e2e suite from feature 001 runs, **Then** every auth spec passes
   without changes to spec files.
2. **Given** the same branch, **When** the auth pages (`/login`,
   `/signup`, `/forgot-password`, `/reset-password`, `/onboarding`) are
   rendered at desktop and 360px in both themes, **Then** the visual
   output is indistinguishable from `main` to the eye — no padding shift,
   no font weight change, no color drift, no animation delta.
3. **Given** the extracted primitives in `apps/web/components/ui/`,
   **When** they are imported by the (auth) page files, **Then** the
   import paths use the established `@/components/ui/...` convention
   (or whichever path alias `apps/web/tsconfig.json` already configures)
   and not relative `../../../` paths.
4. **Given** the extracted primitives, **When** shadcn/ui is
   subsequently installed in this feature's later commits, **Then** the
   extracted auth primitives are NOT replaced by shadcn equivalents —
   the editorial-calm direction of feature 001 is preserved verbatim.
   shadcn primitives are added alongside them for use by the dashboard
   shell only.

---

### Edge Cases

- A user whose `profiles.full_name` is empty / null lands on `/app` —
  the welcome banner falls back to "Good morning" without a name, and
  the profile avatar shows initials derived from the user's email
  local-part (first letter, uppercased). No placeholder silhouette is
  rendered; the surface MUST NOT visually advertise that something is
  missing.
- A user's `profiles.full_name` is unusually long (e.g., a multi-part
  hyphenated name) — the header avatar's tooltip / dropdown name area
  truncates with a tasteful ellipsis at the documented max length; the
  edit field in the Profile section accepts the full value without
  truncation. The exact max length and truncation pattern are set in
  `/speckit.plan`.
- The profile dropdown is open on desktop when the user resizes the
  viewport down past the mobile breakpoint — the dropdown closes
  gracefully on resize, the center nav collapses to the hamburger, and
  the profile avatar (now a separate mobile trigger) remains tappable.
- The user has both `prefers-color-scheme: dark` set in their OS and a
  manual light-theme override stored from a previous session — the
  manual override wins on this load; the OS preference is consulted
  only when there is no stored override.
- Cross-tab sync: a tab is in the middle of loading `/app` (the session
  cookie is valid but React hasn't hydrated yet) when sign-out fires
  from another tab — the listener fires once the shell mounts and
  navigates to `/login` cleanly; there is no double-mount or hydration
  warning. If the page is fully unmounted (e.g. the tab is in BFCache),
  re-activation re-runs the auth check from feature 001's existing
  middleware and the same `/login` redirect occurs without involving
  the listener.
- A team_lead is mid-session when an admin promotes them to admin via
  feature 001's existing `admin_update_role` RPC — the placeholder copy
  does NOT update mid-session; the role-derived copy is read at page
  load. This is acceptable for the feature-003 surface (both roles see
  a placeholder anyway). Features 011 and 012 will address mid-session
  role transitions as a real concern when their dashboards land.
- A user reduces motion via OS preference AFTER landing on `/app` — any
  already-running entrance animation completes its current frame; any
  newly-triggered animation respects the new preference. This is the
  default Framer Motion behavior and requires no special handling.
- The notification toast/sheet component is mounted in a developer
  preview alongside an active chat pill on a 360px viewport — the toast
  renders as a bottom sheet covering the full viewport width, the chat
  pill remains tappable below the bottom-sheet's dismiss control, and
  the documented gap convention is satisfied automatically (a bottom
  sheet at full width does not visually compete with a bottom-right
  icon pill the way a desktop slide-in card would).

## Requirements *(mandatory)*

### Functional Requirements — Authed shell chrome

- **FR-001**: A persistent top header MUST render on every authenticated
  page (`/app`, `/app/account`, and any future authed route in this
  feature's scope). The header MUST contain, in left-to-right order:
  (a) the Serenify logo (links to `/app`), (b) a center navigation
  region containing workflow destinations (only "Home" is active in
  this feature), (c) a right-cluster containing a theme toggle icon
  button, a reserved layout slot for the future "I'd like to talk"
  button (no button rendered now), and a profile avatar / initials
  trigger.
- **FR-002**: The theme toggle MUST be an icon button in the header's
  right cluster — NOT inside the profile dropdown. The theme toggle MUST
  remain visible and operable on the (auth) surfaces from feature 001
  exactly as it does today; no regression in auth-surface theme-toggle
  placement is permitted by this feature's extraction work.
- **FR-003**: The profile avatar/initials trigger MUST open a dropdown
  containing exactly three items in order: the user's display name
  (rendered as a non-actionable header item, derived from
  `profiles.full_name`), a link labeled "Account" routing to
  `/app/account`, and a "Sign out" button. The dropdown MUST NOT
  contain settings, preferences, theme toggle, language, or any other
  affordance — those either live elsewhere in this feature (theme in
  the header) or are out of scope.
- **FR-004**: The center navigation MUST NOT contain "Account",
  "Settings", "Profile", or any account/settings entry. Account
  affordances live ONLY in the profile dropdown. This convention is
  established for all future workflow-destination additions.
- **FR-005**: At viewport widths ≤768px the center navigation MUST
  collapse behind a hamburger menu. The profile avatar MUST remain as
  its own separate trigger on mobile — it MUST NOT be folded into the
  hamburger because profile is conceptually distinct from navigation.
- **FR-006**: A reserved layout slot for the "I'd like to talk" button
  MUST exist in the header's right cluster next to the profile menu,
  ready to host the button when feature 010 ships. No button is
  rendered in this feature; the slot reserves the visual position so
  feature 010's addition does not reflow the header.
- **FR-007**: All interactive elements in the header and any other
  authed surface introduced by this feature MUST be ≥44×44px on
  touch-capable viewports, per Constitution Principle VI.

### Functional Requirements — Home page (`/app`)

- **FR-008**: `/app` MUST render, in this order top-to-bottom: (a) a
  welcome banner reading "Good morning, [first name]" with a subtle
  static subtitle line beneath it, and (b) a primary-plus-secondary
  card layout containing three skeleton cards.
- **FR-009**: The welcome banner subtitle MUST be a single static
  string for all employees in this feature. Dynamic state-aware
  subtitle variants (e.g. "you've been busy this week") are explicitly
  deferred and re-logged in BACKLOG; the markup MUST accommodate a
  future swap to a dynamic variant (a single `<p>` slot beneath the
  greeting) but the wiring is out of scope.
- **FR-010**: First-name derivation MUST be the first whitespace-
  separated token of `profiles.full_name`. If `full_name` is empty or
  null, the banner MUST fall back to a name-less calm greeting ("Good
  morning") rather than an empty bracket, an obvious placeholder, or
  the user's email.
- **FR-011**: At desktop widths (≥768px) the layout MUST be:
  - Left column ~60% width: a large "Today's check-in" card that will
    host (in subsequent features) passive detection state, signal
    quality indicators, the inline questionnaire on trigger, and
    recommendations on confirm.
  - Right column ~40% width: two smaller cards stacked vertically —
    "Things that might help" on TOP (fills with feature 009
    recommendations), "Recent chats" on BOTTOM (fills with feature 008
    chatbot history). The vertical order is binding.
- **FR-012**: At viewport widths ≤768px the cards MUST collapse to a
  single column in this order top-to-bottom: "Today's check-in" →
  "Things that might help" → "Recent chats". No card may overflow the
  viewport horizontally.
- **FR-013**: Each of the three cards MUST ship with calm "not yet"
  empty-state copy in this feature. The copy MUST NOT contain
  exclamation marks, MUST NOT use alarming or clinical language
  ("alert", "detected", "elevated", "abnormal"), and MUST NOT contain
  any red-sector (340–20°) color. The voice is supportive ("we'll
  surface things here when there's something to share").
- **FR-014**: The empty-state copy for "Things that might help" and
  "Recent chats" MUST acknowledge those surfaces fill in with later
  features. Naming the feature numbers is NOT required; the user-facing
  copy is product-voiced, not engineering-voiced.

### Functional Requirements — Account page (`/app/account`)

- **FR-015**: `/app/account` MUST be reachable only via the Account
  link in the profile dropdown — no center-nav entry, no other entry
  point introduced by this feature.
- **FR-016**: `/app/account` MUST render five sections stacked
  vertically in this exact order:
  (a) **Profile** — `full_name` (editable), email (display-only), an
  avatar / initials placeholder.
  (b) **Security** — a "Change password" affordance.
  (c) **Privacy** — a muted dashed-border placeholder with copy
  indicating visibility controls arrive with feature 010. No live
  controls.
  (d) **Notifications** — a muted dashed-border placeholder with "TBD"
  copy. No live controls.
  (e) **Sign out** — a sign-out button at the bottom, visually
  understated per calm-first.
- **FR-017**: The Profile section's `full_name` editor MUST persist
  changes to `public.profiles.full_name` for the current user (scoped
  by `auth.uid()` per feature 001's RLS policy). On successful save,
  the header avatar/initials and the profile dropdown's display name
  MUST update immediately on the same render cycle, without a full page
  reload.
- **FR-018**: The Profile section's email field MUST be display-only
  (read-only text, NOT an editable input). Email change is out of scope
  for this feature.
- **FR-019**: The avatar / initials placeholder in the Profile section
  MUST be a placeholder only — no avatar upload, no Storage write, no
  image processing. The same initials-derivation rule from FR-010
  applies to the placeholder rendering.
- **FR-020**: The Security section's "Change password" affordance MUST
  route through feature 001's existing password-reset flow (the same
  path triggered by `/forgot-password`). This feature MUST NOT
  introduce a new in-section password-rotation form, a new password
  validation surface, or a new email template.
- **FR-021**: The Privacy and Notifications placeholder sections MUST
  use the muted dashed-border visual treatment to clearly signal
  "coming soon" without competing visually with the live Profile and
  Security sections. They MUST NOT render any live form controls,
  toggles, or sliders.
- **FR-022**: The Sign out button at the bottom of `/app/account` MUST
  terminate the session and navigate to `/login`, identical semantics
  to the sign-out path in the profile dropdown. The button MUST be
  visually understated per calm-first (no large red destructive button,
  no full-width primary color treatment).

### Functional Requirements — Persistent chat pill

- **FR-023**: A small chat pill MUST be anchored bottom-right on every
  authenticated page in this feature's scope (`/app`, `/app/account`,
  and the role-placeholder surfaces are evaluated per FR-035 below).
- **FR-024**: The chat pill MUST be visual-only in this feature.
  Activating it MUST either do nothing or open a placeholder "coming
  soon" empty state. It MUST NOT open a real chat surface, MUST NOT
  make any network call to a chatbot or LLM, and MUST NOT log any
  analytics event tied to chat intent — feature 008 wires the actual
  chatbot.
- **FR-025**: At viewport widths ≤768px the chat pill MUST collapse to
  an icon-only floating button bottom-right. The touch target MUST be
  ≥44×44px per Constitution Principle VI.
- **FR-026**: The chat pill MUST be persistent across page navigation
  within the authed surface — navigating between `/app` and
  `/app/account` MUST NOT remount or visually flicker the pill.

### Functional Requirements — Notification toast/sheet component

- **FR-027**: A generic reusable notification toast/sheet component
  MUST be implemented in this feature. The component MUST be exported
  from a stable path (e.g., `apps/web/components/ui/notification.tsx`
  or the agreed shadcn-compatible path set in `/speckit.plan`) such
  that features 007, 008, and 010 can import and mount it without
  re-deriving it.
- **FR-028**: At desktop widths (≥768px) the component MUST render as
  a bottom-right slide-in card with subtle motion consistent with the
  Mist & Meadow visual finish (soft border, generous whitespace,
  amber-not-red for any callout accent).
- **FR-029**: At viewport widths ≤768px the component MUST render as a
  bottom sheet anchored to the bottom edge of the viewport.
- **FR-030**: The component MUST respect `prefers-reduced-motion` —
  when the user has reduced motion enabled, entrance and exit
  animations MUST be suppressed or reduced to an opacity-only
  transition.
- **FR-031**: The component MUST be dismissable via an explicit user
  control. There is no auto-dismiss requirement in this feature; if a
  consuming feature later wants auto-dismiss, it MAY wire it on top of
  the component.
- **FR-032**: When the notification component is visible on a viewport
  where the chat pill is also rendered, the notification MUST sit above
  the chat pill with a documented vertical gap (not overlapping). The
  exact gap value is set in `/speckit.plan` against the Mist & Meadow
  spacing scale. The convention applies to features 007, 008, and 010
  when they consume the component.
- **FR-033**: In this feature, NO event source in production code MUST
  trigger the notification component. The component is built for later
  consumption only. Developer-preview mounts (Vitest stories, a
  `/_dev/` route, or equivalent) are permitted and are the intended way
  to satisfy the Independent Test for User Story 5.

### Functional Requirements — Role-based landing

- **FR-034**: For users with `profiles.role` of `team_lead` or `admin`,
  `/app` MUST render a one-screen placeholder containing calm
  role-acknowledging copy ("Your team-lead view is being built…" /
  "Your admin view is being built…" or equivalent) plus a sign-out
  affordance. The employee welcome banner, the three skeleton cards,
  and the persistent chat pill MUST NOT render for these roles.
- **FR-035**: The persistent chat pill (FR-023) MUST be scoped to
  employee-role landings only. team_lead and admin placeholders MUST
  NOT render the chat pill — the chatbot is an employee-perspective
  surface and rendering it for managers would seed the wrong mental
  model.
- **FR-036**: The role-routing contract from feature 001 MUST be
  preserved. The existing role-trio Playwright e2e suite MUST pass
  unchanged against this feature's branch (with at most cosmetic copy
  assertions updated where the role-placeholder copy changed). Any
  test failure that is not a copy assertion MUST be treated as a
  feature-001 regression.
- **FR-037**: For team_lead and admin sign-out from the role
  placeholder, the semantics MUST be identical to the employee
  sign-out path — session termination + navigation to `/login`.

### Functional Requirements — Auth components consolidation

- **FR-038**: The bespoke auth form primitives currently inlined in
  `apps/web/app/(auth)/**` page files MUST be extracted to
  `apps/web/components/ui/` as the FIRST commit on the
  `003-employee-dashboard-shell` branch, before any new shell work,
  before the shadcn install, and before any cross-tab sync wiring. The
  primitives in scope are at minimum: `PasswordInput`, the password-
  requirements checklist, and the `Field`/`Label`/`ErrorText` wrappers.
  Any other auth-only primitive discovered during extraction that meets
  the same criteria (inlined, reused across multiple auth pages) is
  also in scope.
- **FR-039**: After extraction, the (auth) pages (`/login`, `/signup`,
  `/forgot-password`, `/reset-password`, `/onboarding`) MUST render
  visually identical to the pre-extraction state — same DOM structure,
  same CSS classes, same animations, same tab-order, same
  light/dark theming. The existing role-trio Playwright e2e suite from
  feature 001 MUST pass without modification.
- **FR-040**: After extraction, the extracted primitives MUST NOT be
  replaced by shadcn equivalents in this feature. The editorial-calm
  direction of feature 001 (page IS the surface, no card chrome, no
  shadcn default aesthetic) is preserved verbatim on the (auth)
  surfaces. shadcn primitives are added alongside the extracted ones
  for use by the dashboard shell only (FR-041 et seq.).

### Functional Requirements — shadcn/ui adoption

- **FR-041**: `shadcn/ui` MUST be installed in this feature for the
  dashboard shell to consume. The dashboard primitives in scope —
  header structure, card primitives, dropdown menu, sheet/toast (used
  by the notification component), and button variants used by the
  dashboard — MUST be built on shadcn from day one.
- **FR-042**: shadcn primitives consumed by the dashboard shell MUST
  be tokenized against the existing Mist & Meadow tokens already
  defined in `apps/web/app/globals.css` `@theme` block. No new color
  token is introduced by this feature. The Constitution's Principle V
  forbids red anywhere; shadcn's default destructive-button red MUST
  be remapped to amber (`#DCB587`) or removed from the consumed
  variants.
- **FR-043**: The (auth) surfaces (`/login`, `/signup`,
  `/forgot-password`, `/reset-password`, `/onboarding`) MUST NOT be
  migrated to shadcn in this feature. They remain on the bespoke
  primitives extracted per FR-038.
- **FR-044**: The Tailwind v4 + shadcn configuration reconciliation
  required to make the install work cleanly is in scope for
  `/speckit.plan`. Any decision made during planning (e.g., a specific
  shadcn CLI version, a `components.json` configuration choice, a
  `@theme` mapping) MUST be logged in `docs/DECISIONS.md` per
  Constitution Principle VIII.

### Functional Requirements — Cross-tab auth state sync

- **FR-045**: A `supabase.auth.onAuthStateChange` listener MUST be
  mounted at the authed shell root in this feature. The listener MUST
  trigger client-side navigation to `/app` on `SIGNED_IN` (when
  transitioning from a previously unauthenticated state) and to
  `/login` on `SIGNED_OUT`. Token-refresh events MUST be silent — the
  listener MUST NOT navigate on token renewal.
- **FR-046**: The listener MUST be the only owner of cross-tab
  navigation in this feature — sign-in / sign-out triggered locally in
  the same tab continues to use the explicit navigation already wired
  by feature 001. The listener handles ONLY the cross-tab propagation
  case.
- **FR-047**: Cross-tab sync MUST be tested by a Playwright spec that
  opens two browser contexts (or two tabs in one context, per
  Playwright's API for the case) and asserts the propagation in both
  directions (sign-in in tab A → tab B at `/app`; sign-out in tab A →
  tab B at `/login`).

### Functional Requirements — Calm-first, accessibility, and palette enforcement

- **FR-048**: All new surfaces introduced by this feature (header,
  home cards, account sections, chat pill, notification component,
  role placeholders) MUST render correctly at 360px minimum viewport
  width per Constitution Principle VI.
- **FR-049**: All interactive targets on touch-capable viewports MUST
  be ≥44×44px per Constitution Principle VI.
- **FR-050**: Light and dark modes MUST be equal-priority on every new
  surface — designed and reviewed in tandem, with the Mist & Meadow
  light and dark token sets driving everything. No surface may be
  light-only or dark-only.
- **FR-051**: `prefers-reduced-motion` MUST be respected by every
  animated surface added by this feature (notification component
  entrance/exit is the primary case; any header/dropdown animation
  also qualifies).
- **FR-052**: No copy added by this feature may contain an exclamation
  mark, alarmist language ("alert", "detected", "elevated risk",
  "abnormal"), or any color in the red sector (340–20° hue). Stress-
  related callouts (none in this feature, but the convention applies)
  use amber `#DCB587` in both modes.
- **FR-053**: The persistent theme toggle in the header MUST persist
  the user's choice across page navigations within the session and
  across sign-out / sign-in cycles. The persistence mechanism (e.g.
  `localStorage` keyed by a documented namespace, or a `profiles`
  column) is selected in `/speckit.plan`; whichever path is chosen
  MUST work without a server round-trip on theme flip.

### Key Entities

- **Authed Shell**: The persistent chrome rendered around every
  authenticated page introduced by this feature — header + chat pill +
  any later persistent surface. The shell is a layout primitive, not a
  route; routes mount inside it.
- **Workflow Destination**: An entry in the center navigation
  region. Only "Home" exists in this feature. Future workflow
  destinations (Chat in feature 008, Insights in a later feature, etc.)
  will be added to the same region. Account / Settings / Profile are
  explicitly NOT workflow destinations — they live in the profile
  dropdown.
- **Profile Dropdown**: The menu opened from the avatar trigger in the
  header's right cluster. Contains the user's display name, an Account
  link, and Sign out. Future settings affordances may extend the
  dropdown only if they remain conceptually account/identity-scoped —
  workflow destinations MUST NOT migrate here.
- **Today's Check-In Card**: The large primary card on `/app` left
  column. Empty skeleton in this feature; subsequent features fill it
  with passive detection state, signal quality, inline questionnaire,
  and recommendations.
- **Things That Might Help Card**: The upper-right secondary card on
  `/app`. Empty skeleton in this feature; feature 009
  (recommendations) fills it.
- **Recent Chats Card**: The lower-right secondary card on `/app`.
  Empty skeleton in this feature; feature 008 (chatbot) fills it.
- **Persistent Chat Pill**: The bottom-right anchored pill rendered on
  every employee-role authed page. Visual-only in this feature;
  feature 008 wires it.
- **Notification Toast/Sheet**: A reusable component for "we noticed
  something" surfaces. Built but unused in this feature; features
  007, 008, and 010 consume it.
- **Role Placeholder**: The single one-screen surface shown to
  team_lead and admin users at `/app` in this feature. Replaced
  wholesale by features 011 and 012.
- **Auth Primitive**: A bespoke form-input or form-wrapper component
  shared across the (auth) page files (`PasswordInput`, the
  requirements checklist, `Field`/`Label`/`ErrorText`, etc.).
  Extracted in this feature from inlined page-file code into
  `apps/web/components/ui/`. NOT replaced by shadcn equivalents in
  this feature.

## Out of Scope *(explicit exclusions)*

The following items are explicitly excluded from this feature:

- **Passive detection, rPPG capture, calibration, inference, signal
  quality indicators.** Those land in features 004 (webcam-and-rppg),
  005 (per-user-calibration), and 006 (stress-inference-service) and
  fill in the "Today's check-in" card.
- **Questionnaire wiring.** Feature 007 introduces the confirmatory
  questionnaire and mounts it via the notification toast/sheet built
  here.
- **Chatbot wiring.** Feature 008 wires the persistent chat pill to
  the real chatbot, fills in the "Recent chats" card, and uses the
  notification toast/sheet for chatbot-side notifications.
- **Recommendations.** Feature 009 fills in the "Things that might
  help" card and lands recommendations in the "Today's check-in" card
  on confirm.
- **Privacy controls and transparency view.** Feature 010 replaces the
  Privacy placeholder section in `/app/account` with the three-position
  privacy slider, the transparency view, and the "I'd like to talk"
  button that occupies the reserved header slot from this feature.
- **Notifications preferences.** A later feature replaces the
  Notifications placeholder section in `/app/account` with real
  preference controls.
- **Dynamic welcome-banner subtitles.** State-aware subtitle variants
  (e.g. "you've been busy this week") require signal data and are
  explicitly deferred until post-feature-006. The markup accommodates a
  future swap but the wiring is out of scope. Logged in BACKLOG.
- **Team-lead and admin dashboards beyond the one-screen placeholder.**
  Features 011 (team-lead-dashboard) and 012 (admin-dashboard) replace
  the placeholders wholesale.
- **Migration of (auth) surfaces to shadcn/ui.** The login, signup,
  forgot-password, reset-password, and onboarding pages remain on
  bespoke primitives. Only the file location of those primitives
  changes (extraction to `components/ui/`).
- **Notification triggers.** The toast/sheet component is built but no
  event source in production code mounts it during this feature.
- **Insights / history / analytics page.** Not in this feature; not
  yet on the roadmap as a discrete feature.
- **The `/login?error=expired_link` notice bug from BACKLOG.** That
  bug ships as a separate hotfix branch off `main`, not on this
  feature branch. Before opening the hotfix branch, Claude Code MUST
  reconnoiter whether the bug still reproduces against current `main`
  (it was logged in BACKLOG from feature 001 and may have been
  inadvertently resolved by intervening work).
- **Avatar upload to Supabase Storage.** The avatar field in the
  Profile section is a placeholder only.
- **Email change.** The Profile section's email field is display-only.
  Email change requires a separate identity-verification flow that is
  out of scope.
- **In-section password rotation.** The Security section routes to
  feature 001's existing email-driven reset flow; no new in-page
  password form is introduced.
- **Auto-dismiss on the notification toast/sheet.** Dismissable via an
  explicit user control only in this feature. Auto-dismiss is a
  consumer-feature decision (feature 007, 008, or 010 may add it on
  top of the component).
- **Mid-session role-transition reactivity.** If an admin promotes a
  team_lead to admin during an active session, the placeholder copy
  does not live-update mid-session — the role-derived copy is read at
  page load. Features 011 and 012 will address this when their real
  dashboards land.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: A signed-in employee can complete the full landing →
  open dropdown → navigate to account → edit name → sign out path in
  under 30 seconds in 100% of attempts on the demo cohort
  (`*@demo.serenify.local`) users seeded by feature 002.
- **SC-002**: An employee's chosen theme persists across page
  navigations within the authed surface and across sign-out / sign-in
  cycles in 100% of attempts. Reloading the browser does not reset the
  theme to a default.
- **SC-003**: At 360px viewport width, every interactive target on
  every new surface introduced by this feature measures ≥44×44px,
  verified by an automated check in the Vitest + RTL suite (or
  Playwright, per `/speckit.plan`) over the header, profile dropdown,
  account sections, chat pill, and notification component.
- **SC-004**: Zero new colors outside the Mist & Meadow palette are
  introduced by this feature; zero red-sector (340–20° hue) colors
  appear anywhere on any new surface, verified by a static scan over
  the new source files and a manual visual review at desktop and
  360px in both themes.
- **SC-005**: Zero copy strings in any new surface contain an
  exclamation mark or any item from the documented alarmist-language
  blocklist ("alert", "detected", "elevated risk", "abnormal"),
  verified by a static check over the new source files.
- **SC-006**: An employee editing their `full_name` sees the header
  avatar/initials and the dropdown display name reflect the new value
  on the same render cycle (no full page reload required) in 100% of
  attempts.
- **SC-007**: A team_lead or admin signing in lands on the
  one-screen role placeholder in 100% of attempts. The employee
  welcome banner, the three skeleton cards, and the chat pill are NOT
  rendered for these roles in 100% of attempts, verified by the
  Playwright role-trio suite plus an explicit assertion that the
  employee-only DOM nodes are absent.
- **SC-008**: Cross-tab auth sync propagates a SIGNED_IN or
  SIGNED_OUT transition from one tab to another in under 2 seconds
  under normal local conditions, verified by a Playwright two-context
  spec.
- **SC-009**: After the auth-primitives extraction commit lands, the
  existing role-trio Playwright e2e suite from feature 001 passes
  without spec-file modifications in 100% of CI runs. A visual
  regression review of each (auth) page at desktop and 360px in both
  themes finds no perceptible drift relative to `main`.
- **SC-010**: The notification toast/sheet component renders correctly
  in three configurations — desktop slide-in, mobile bottom sheet, and
  reduced-motion mode — verified by Vitest + RTL component tests over
  each configuration. When co-rendered with the chat pill, the
  documented gap convention holds in 100% of viewport-width samples.
- **SC-011**: shadcn/ui is installed and the dashboard shell primitives
  (header, cards, dropdown menu, sheet/toast, button variants) are
  built on shadcn while the (auth) surfaces remain on the bespoke
  primitives. The `components.json` configuration is checked in. The
  Tailwind v4 reconciliation is logged in `docs/DECISIONS.md`.
- **SC-012**: All three Constitution Principle VII test layers are
  satisfied for the new code in this feature: Vitest + RTL for
  component logic (header, dropdown, account sections, notification
  component), Playwright happy-path for the employee role (sign in →
  home → open profile dropdown → navigate to account → edit name →
  sign out), and `smoke-tests.md` populated with the human-validated
  checks Mohamed runs after `/speckit.implement`. The team_lead and
  admin placeholder landings receive smoke coverage in Playwright; the
  existing role-trio e2e from feature 001 is preserved.

## Assumptions

- Feature 001's authentication, schema, and route guards are
  available on `main` and unchanged by this feature. The
  `public.profiles` table has the columns this feature consumes
  (`id`, `full_name`, `role`, `manager_id`, `created_at`,
  `updated_at`) per feature 001's data model. RLS policies for
  row-owner reads/updates of `full_name` are in place.
- Feature 002's demo seed (`scripts/seed-demo.ts`) populates the
  three role demographics (`employee`, `team_lead`, `admin`) such
  that manual testing of every user story in this feature can be
  performed against `*@demo.serenify.local` users with the shared
  password `DemoUser123!`.
- The Mist & Meadow palette tokens already defined in
  `apps/web/app/globals.css` `@theme` are stable and are the only
  color tokens used by any new surface in this feature. No new color
  token is introduced.
- Tailwind v4 is the current styling stack per Constitution
  Technology Stack table. shadcn/ui can be configured against
  Tailwind v4 with the existing tokens via a `components.json`
  configuration; minor reconciliation friction is expected and is
  handled in `/speckit.plan`, with any concrete decision logged in
  `docs/DECISIONS.md` per Constitution Principle VIII.
- `supabase.auth.onAuthStateChange` behaves as documented in
  `@supabase/supabase-js` v2 — it fires `SIGNED_IN`, `SIGNED_OUT`,
  and `TOKEN_REFRESHED` events under the conditions described in the
  Supabase docs. Cross-tab propagation in particular is driven by
  `localStorage`-based session storage and works across same-origin
  tabs. No cross-domain or cross-window-name propagation is in
  scope.
- The `/login?error=expired_link` notice bug from BACKLOG is
  addressed on a separate hotfix branch off `main`. This feature
  does not consume or depend on the fix, and the fix does not
  consume or depend on this feature.
- Mohamed is the smoke-test gatekeeper per Constitution Principle
  VII — `smoke-tests.md` for this feature will be authored during
  `/speckit.tasks` and signed off after `/speckit.implement` completes.
- The user-facing copy strings introduced by this feature (welcome
  banner, empty-state cards, account section labels, role
  placeholder copy) are draft-quality in the spec and finalized
  during `/speckit.plan` / `/speckit.tasks` with the calm-voice
  guidance from Constitution Principle V as the binding rubric. Any
  copy approved during `/speckit.plan` and later changed in
  `/speckit.implement` requires a `docs/CHANGELOG.md` entry per
  Constitution Principle VIII.
