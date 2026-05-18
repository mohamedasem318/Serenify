# Feature Specification: Authentication and Role-Based Access

**Feature Branch**: `001-auth-and-roles`

**Created**: 2026-05-16

**Status**: Draft

**Input**: User description: Build the authentication layer for Serenify with
three roles (employee, team_lead, admin) using email + password sign-in, a
separate profile record per user, team affiliation, role-gated routes, a
first-login profile-completion step, and password recovery by email.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Self-serve account creation (Priority: P1)

A new Serenify user creates an account so they can begin using the platform.
They provide their email, choose a password, and give their full name. After
confirming their email, they can sign in for the first time. No further fields
are collected at signup; the user confirms their profile on first sign-in.

**Why this priority**: Nothing else in the product is reachable until a
user can create an account. Sign-up is the front door of the entire
platform.

**Independent Test**: Land on the signup page, complete the form with a
fresh email address, receive the activation email, click the activation
link, and arrive at a state where sign-in succeeds with the chosen
credentials.

**Acceptance Scenarios**:

1. **Given** a visitor with no Serenify account, **When** they submit the
   signup form with a valid email, password, and full name, **Then** the
   system creates the account, sends an activation email, and presents a
   confirmation message instructing them to verify the email.
2. **Given** a user who has just received an activation email, **When**
   they click the activation link, **Then** the account becomes active and
   they are able to sign in.
3. **Given** a visitor who enters an email already associated with an
   existing account, **When** they submit the signup form, **Then** the
   system presents a calm, non-blaming message explaining the email is
   already registered and offers a path to sign in or reset the password.
4. **Given** a new user, **When** their account is created, **Then** the
   default role is `employee` and no direct manager is assigned. Direct
   managers are linked to a user by an administrator, not by the user
   themselves.
5. **Given** a user who received a confirmation email containing both a
   link and a 6-digit code, **When** they enter the code at the OTP entry
   surface and submit, **Then** their account activates and they land on
   `/onboarding` or `/app` — the same outcome they would have reached by
   clicking the link.
6. **Given** any unauthenticated surface (`/login`, `/signup`,
   `/forgot-password`, `/reset-password`), **When** the user toggles
   theme via a visible control, **Then** the new theme persists and
   propagates to every other authenticated and unauthenticated page.

---

### User Story 2 - Sign in to the role-appropriate workspace (Priority: P1)

A returning user signs in and lands in the workspace view that matches
their role: employees see an employee placeholder, team leads see a
team-lead placeholder, admins see an admin placeholder. Cross-role
navigation attempts are blocked.

**Why this priority**: Without correct role-based routing, the entire
product collapses into a single undifferentiated view, and the privacy
guarantees that depend on role separation cannot hold.

**Independent Test**: Create three accounts (one per role), sign in as
each, confirm each lands on the role-appropriate placeholder, and confirm
that an employee attempting to reach the team-lead or admin route is
redirected away.

**Acceptance Scenarios**:

1. **Given** a confirmed `employee` user, **When** they sign in with valid
   credentials, **Then** they land on the protected workspace and see the
   employee placeholder ("You are an employee").
2. **Given** a confirmed `team_lead` user, **When** they sign in, **Then**
   they land on the protected workspace and see the team-lead placeholder.
3. **Given** a confirmed `admin` user, **When** they sign in, **Then**
   they land on the protected workspace and see the admin placeholder.
4. **Given** a visitor who is not signed in, **When** they navigate
   directly to any workspace URL, **Then** the system redirects them to
   the sign-in page.
5. **Given** an `employee` who is signed in, **When** they attempt to
   navigate to the team-lead or admin section, **Then** the system blocks
   the navigation and returns them to a permitted view with a calm
   "this area isn't available to you" message.
6. **Given** a `team_lead` who is signed in, **When** they attempt to
   navigate to the admin section, **Then** the system blocks the
   navigation.
7. **Given** a signed-in user of any role, **When** they trigger the
   sign-out action, **Then** their session ends and subsequent attempts to
   reach the workspace redirect to sign-in.
8. **Given** a signed-in user, **When** they navigate to the sign-in or
   signup page, **Then** the system redirects them to the workspace
   instead.

---

### User Story 3 - Complete profile on first sign-in (Priority: P2)

On their very first successful sign-in, a user is prompted to confirm
their full name before reaching the workspace. Direct-manager assignment
is performed by an administrator and is not part of this step.

**Why this priority**: A confirmed full name is the prerequisite for
every other feature that surfaces "who" a stress event or message
belongs to. Without this step the user appears as a raw email across
the product.

**Independent Test**: After completing User Story 1 and signing in for
the first time, confirm the user is presented with the profile-completion
form (full name), fill it, and verify they then reach the workspace.
Sign out and sign back in — the profile-completion form does not appear
a second time.

**Acceptance Scenarios**:

1. **Given** a user signing in for the first time after activation,
   **When** they reach the post-sign-in flow, **Then** the system presents
   a profile-completion form containing the full-name field, pre-filled
   from the value captured at signup if one was provided.
2. **Given** a user on the profile-completion form, **When** they submit
   a valid full name, **Then** the system saves the profile and routes
   them to the workspace.
3. **Given** a user who has already completed profile setup, **When**
   they sign in on a subsequent session, **Then** they bypass the
   profile-completion form and go directly to the workspace.

---

### User Story 4 - Recover a forgotten password (Priority: P2)

A user who has forgotten their password requests a reset, receives an
email with a single-use link, sets a new password, and signs in with the
new password.

**Why this priority**: Without password recovery, a user who forgets
their password is locked out indefinitely and a maintainer has to
intervene. The flow is well-trodden and the platform's built-in email
transport is sufficient for development.

**Independent Test**: From the sign-in page, follow the "forgot password"
link, submit the user's email, receive the reset email, follow the link,
set a new password, sign in successfully with the new password.

**Acceptance Scenarios**:

1. **Given** a user on the sign-in page who has forgotten their password,
   **When** they request a reset for their email, **Then** the system
   sends a reset email containing a single-use link.
2. **Given** a user clicking a valid reset link within its validity
   window, **When** they submit a new password, **Then** the system
   updates the password and they can sign in with the new password
   immediately.
3. **Given** a user clicking an expired or already-used reset link,
   **When** they attempt to set a new password, **Then** the system
   refuses politely and offers to send a fresh reset email.
4. **Given** someone requesting a reset for an email that does not
   correspond to an account, **When** the request is submitted, **Then**
   the response is indistinguishable from a successful request (to avoid
   leaking which emails are registered).
5. **Given** a user who received a password-reset email containing both
   a link and a 6-digit code, **When** they enter the code at the OTP
   entry surface, **Then** they reach the new-password form and can
   complete the reset — the same outcome they would have reached by
   clicking the link.

---

### Edge Cases

- A visitor submits a signup form with a malformed email address — the
  form rejects the input inline before sending anything.
- A visitor submits a signup form with a password that does not meet the
  platform's minimum strength requirements — the form rejects the input
  inline with calm, non-shaming guidance.
- A user tries to sign in before clicking the activation link — the
  system declines and offers to resend the activation email.
- A user's session expires while they are inside the workspace — the
  next protected request redirects them to sign-in.
- A user is signed in on multiple tabs and signs out on one tab — the
  other tabs detect the session loss on the next protected interaction
  and redirect to sign-in.
- A user with a stale browser cookie tries to reach the workspace — the
  system clears the stale state and redirects to sign-in.
- A user submits the signup form twice in quick succession (double-click)
  — the platform creates exactly one account.
- A user opens the signup form on a 360px-wide mobile viewport — every
  control is visible and tappable with a 44px minimum touch target.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The system MUST allow a new user to create an account
  using email, password, and full name. No additional fields are
  collected at signup; the user confirms their profile on first
  sign-in.
- **FR-002**: The system MUST default new accounts to the `employee`
  role. Elevation to `team_lead` or `admin` is a manual maintainer
  action outside this feature.
- **FR-003**: The system MUST send an account-activation email after
  signup and MUST prevent sign-in until the email is confirmed.
- **FR-004**: The system MUST allow returning users to sign in with
  email and password.
- **FR-005**: The system MUST allow a signed-in user to end their
  session via an explicit sign-out action.
- **FR-006**: The system MUST allow a user to request a password reset
  by email and complete the reset via a single-use link with a bounded
  validity window.
- **FR-007**: The system MUST respond identically to password-reset
  requests for registered and unregistered emails (to avoid disclosing
  which emails are registered).
- **FR-008**: After a user's first successful sign-in following
  activation, the system MUST prompt them to confirm their full name
  before reaching the workspace. Direct-manager assignment is performed
  by an administrator, not by the user themselves. New accounts have no
  assigned direct manager by default; an administrator links a user to
  their direct manager via an admin-only assignment path. A user MUST
  NOT be able to set, change, or clear their own manager.
- **FR-009**: The system MUST route each signed-in user to a workspace
  view that reflects their role (`employee`, `team_lead`, or `admin`).
- **FR-010**: The system MUST redirect unauthenticated visitors away
  from any protected workspace URL to the sign-in page.
- **FR-011**: The system MUST redirect already-signed-in users away
  from the sign-in and signup pages to the workspace.
- **FR-012**: The system MUST prevent users with the `employee` role
  from reaching team-lead or admin sections.
- **FR-013**: The system MUST prevent users with the `team_lead` role
  from reaching admin sections.
- **FR-014**: A user MUST be able to read and update only their own
  profile information; reading or modifying another user's profile MUST
  be blocked.
- **FR-015**: No user — including users with the `admin` role — MUST be
  able to read another user's raw signal data. Raw-signal access rules
  introduced in this feature MUST be designed so they apply when the
  corresponding signal tables arrive in later features.
- **FR-016**: Users with the `team_lead` role MUST be limited to
  aggregated data for their direct reports. This constraint MUST be
  documented in this feature even though the target data tables arrive
  in later features.
- **FR-017**: Users with the `admin` role MUST be limited to org-wide
  aggregated data and MUST NEVER be able to read raw individual data.
- **FR-018**: Every authentication surface (signup, sign-in, sign-out,
  password reset, profile completion) MUST be operable at a 360px
  minimum viewport width with touch targets ≥ 44px.
- **FR-019**: Every user-facing string in this feature — form labels,
  error messages, transactional email content — MUST follow the calm,
  non-alarmist voice established by the project's design language and
  MUST NOT use red as a signal color.
- **FR-020**: The system MUST allow users to enter the 6-digit OTP code
  included in confirmation and password-reset emails as a fallback to
  clicking the link. The same outcome is achieved — account activation
  for signup, password reset for forgot-password — whether the user
  clicks the link or enters the OTP. The OTP entry surface MUST be
  reachable on the same page as the "check your email" panel (signup)
  and the reset-password page so users who never received the link can
  still proceed.
- **FR-021**: Light and dark theme toggle MUST be available on every
  authentication surface (`/login`, `/signup`, `/forgot-password`,
  `/reset-password`), at equal priority with the authed-surface toggle.
  Toggling on any surface persists the choice across all authenticated
  and unauthenticated pages.

### Key Entities

- **User Account**: The credential side of a user — email, password,
  and activation status. The unique identifier for a real person on the
  platform.
- **Profile**: The application-side representation of a user — full
  name, role (`employee` / `team_lead` / `admin`), and an optional
  reference to a direct manager. Linked one-to-one with a user account.
- **Manager Relationship**: A self-referential link from one Profile to
  another, recording who reports directly to whom. Each user has at
  most one direct manager; users at the top of the chain (typically
  admins) may have none. The relationship is set, changed, or cleared
  only by administrators.
- **Session**: The signed-in state of a user. Begins on successful
  sign-in, ends on sign-out, expiration, or password change.

## Out of Scope *(explicit exclusions)*

The following items are explicitly excluded from this feature and live
in later features or are deferred indefinitely:

- Magic-link sign-in
- Third-party sign-in (Google, GitHub, or similar OAuth providers)
- Two-factor authentication
- Production-grade branded transactional email (deferred until the
  project's external email transport domain is verified)
- The actual employee, team-lead, and admin dashboards — this feature
  provides role-gated placeholder routes only (real dashboards arrive
  in features 003, 010, 011)
- The per-user calibration flow (feature 006)
- The employee-facing privacy slider and manager-transparency view
  (feature 012)
- Seeded demo accounts for a fictional company (feature 002)
- Self-serve role management — role elevation is performed manually by
  a maintainer for this feature
- Skip-level (manager-of-manager) visibility into per-employee data is
  forbidden in this and all future features. Skip-level managers see
  only org-aggregated views, never per-employee data, even where their
  transitive report set is computable.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: A new user can complete signup, activate their account,
  and reach their workspace in under 5 minutes end-to-end (excluding
  any delay outside the platform's control, such as email-delivery
  latency).
- **SC-002**: A returning user with valid credentials reaches their
  workspace on the first attempt 95% of the time or better.
- **SC-003**: A user who has forgotten their password can recover and
  sign in with a new password in under 5 minutes end-to-end.
- **SC-004**: An unauthenticated visitor attempting to reach the
  workspace is redirected to sign-in within a single navigation hop in
  100% of attempts.
- **SC-005**: Cross-role navigation attempts (employee → team-lead,
  employee → admin, team-lead → admin) are blocked in 100% of attempts.
- **SC-006**: All authentication surfaces are usable (no clipped
  controls, no horizontal scrolling, no unreachable buttons) at a 360px
  viewport width.
- **SC-007**: A first-time user completes profile confirmation in under
  60 seconds when they know their display name and team.
- **SC-008**: Sign-up and sign-in flows surface no language that
  violates the project's calm, non-alarmist voice (no red, no
  "warning" / "alert" tone, no clinical phrasing) across 100% of
  rendered states reviewed.

## Assumptions

- Users have a working email inbox capable of receiving activation and
  password-reset emails.
- The platform's built-in transactional email transport is sufficient
  for this feature; the production-grade branded email transport
  swap-in is deferred to a later feature.
- Role elevation from `employee` to `team_lead` or `admin` is a manual
  database action performed by a project maintainer in this feature.
  Self-serve role management is out of scope.
- Privacy rules expressed here for raw signal data, team-lead access,
  and admin aggregates are forward-looking — they encode the
  architectural intent against tables that arrive in later features
  and MUST be honored when those tables are introduced.
- A user's session is bound to a single browser session by default;
  the platform's standard session lifecycle applies.
