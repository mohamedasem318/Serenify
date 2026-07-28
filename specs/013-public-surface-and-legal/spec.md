# Feature Specification: Public Surface & Legal

**Feature Branch**: `013-public-surface-and-legal`

**Created**: 2026-07-24

**Status**: Draft — **all open questions resolved** (2026-07-25). OQ-1 and OQ-3 were
resolved by **Constitution Amendment 17** (merged, PR #156, constitution 1.13.0); the
rest by operator decision. Ready for planning.

**Input**: User description: the public landing page, `/terms`, `/privacy`, the
site footer, and a signup + camera consent gate. Closes **#75** (legal pages +
signup consent gate). See "Issue mapping" below — **#62 is a different issue**
and is NOT closed by this feature.

---

## Overview

Serenify has no public front door. Today `/` redirects: signed-in visitors to
`/app`, everyone else to `/login`. An anonymous visitor cannot learn what the
product is, what it does with their camera, or what it refuses to do — and there
is no Terms of Service, no Privacy Policy, and no consent gate anywhere in the
product.

This feature builds that front door and the legal surface behind it: a landing
page whose centrepiece is an animated, scripted story of the product working; the
two legal documents; a site footer; and two consent gates — one for the Terms and
Privacy Policy, one for camera capture and inference.

**Neither gate is one-time.** Both consented texts can be revised, and a revision
judged **material** re-prompts everyone whose recorded consent predates it. The
Terms/Privacy gate therefore blocks the **whole application**, not only account
creation — an existing signed-in user can meet it mid-life. The camera gate blocks
only the camera-based features. What a person agreed to, and when, is kept as
**history** rather than overwritten.

The organising principle is that **Serenify's pitch is a set of refusals**. The
page's job is not to claim accuracy; it is to show that the system asks before it
decides, and to be exactly truthful about what happens to a person's camera feed.

### Issue mapping

| Issue | Actual title | Relationship to this feature |
|-------|--------------|------------------------------|
| **#75** | ToS + Privacy Policy + signup consent gate (Egypt PDPL) | **Owned and closed by this feature.** Was mis-closed on GitHub by a stray closing keyword; **reopened 2026-07-25** and re-closes only when this feature ships. See OQ-7. |
| **#157** | Camera + inference consent gate — no consent recorded for webcam capture or inference | **Owned and closed by this feature.** New scope introduced by this specification; opened 2026-07-25 with its BACKLOG entry per Principle VIII. Governed by FR-037–FR-043. |
| **#62** | Gate `/signup` to invite-only (open self-serve posture) | **NOT this feature.** #62 is an auth-posture/tenancy issue (invite tokens, closing open self-serve signup). It is not a consent gate, it is **not closed here**, and it remains an open pre-production deploy blocker. See OQ-7. |

#62 and this feature both touch `/signup`, which is the only reason they were ever
conflated. They solve different problems: #62 governs **who may hold an account at
all**; this feature governs **what the account holder has agreed to**. A Terms
checkbox does not make signup invite-only.

---

## User Scenarios & Testing *(mandatory)*

### User Story 1 - A visitor understands the product and its boundaries (Priority: P1)

An anonymous visitor arrives at the site. Within one screen they learn what
Serenify does, and they watch a short scripted story of it working — one that
opens by showing the system getting it **wrong**, being corrected by the person,
and backing off with no consequence. Only afterwards does the story show a real
moment being talked through with the companion. The visitor scrolls on to find
what the product will never do, how it works, what is actually live today, and
who built it.

**Why this priority**: This is the feature's reason to exist. The false-alarm-first
ordering is the page's thesis: a stress detector that cannot be corrected is a
surveillance tool, and showing the correction *before* the success is what
distinguishes the product. Everything else on the page supports this.

**Independent Test**: Load the landing page anonymously and watch the hero story
through a full cycle. The false-alarm beat must be reached and resolved before any
companion conversation begins. Deliverable value: a visitor can explain the
product and its central refusal without signing up.

**Acceptance Scenarios**:

1. **Given** an anonymous visitor on the landing page, **When** the hero story
   plays from its first beat, **Then** the sequence reaches a state where the
   system flags the person as tense, the person declines ("No, I'm okay"), and the
   story shows the reading set aside with no record and no follow-up — and this
   occurs **before** any companion conversation beat.
2. **Given** the hero story is playing, **When** any beat transition occurs,
   **Then** the card's outer dimensions do not change, no content is clipped, and
   no scrollbar appears inside the card.
3. **Given** the hero story is playing, **When** the readout is observed at any
   point in the cycle, **Then** an orb, a reading label, and a trend are visible —
   the card is never empty.
4. **Given** a visitor scrolls the hero card out of view, **When** the card is no
   longer visible, **Then** the story stops advancing; **When** it returns to view,
   **Then** the story resumes.
5. **Given** a visitor uses the chapter markers, **When** a marker is activated by
   click **or** by keyboard, **Then** the story jumps to that chapter's first beat
   and the marker's active state updates.
6. **Given** a reading label is displayed, **When** its text is inspected, **Then**
   it is exactly one of **At ease** / **A little tense** / **Tense**.

---

### User Story 2 - A person consents before anything happens, and again when the terms change (Priority: P1)

A new user signs up. Account creation is blocked until they acknowledge the Terms
and Privacy Policy, both reachable and readable before they agree. Later, before
their first-ever calibration — the first moment any inference could occur — they
are shown a separate, explicit camera-and-inference consent gate that states what
is transmitted, what is kept, and what is discarded. They must actively agree; each
agreement is recorded with the time and the wording they were shown.

Neither agreement is permanent. When either text is revised in a way judged
**material**, everyone whose consent predates that revision is asked again, with the
current wording, and their answer is recorded as a **new** consent alongside the old
one rather than replacing it. Declining is allowed and is not a trap: it blocks the
features that text governs and only those, changes nothing that already exists, and
can be revisited.

**Why this priority**: This is the pre-real-data legal gate (#75). No real user
data may be processed without it. It is P1 alongside US1 because the landing page's
data-handling claims and the consent text are the same claims — they must ship
together and say the same thing.

**Independent Test**: Attempt signup without acknowledgement (blocked); complete
signup with acknowledgement; reach calibration as a user who has never calibrated
and confirm the camera consent gate appears and blocks progress until answered;
then publish a material revision of each text and confirm the matching re-prompt
appears, that declining blocks the right scope **and only that scope**, and that the
earlier consent record survives intact. Testable without the landing page existing.

**Acceptance Scenarios**:

1. **Given** the signup form, **When** a visitor submits without the Terms +
   Privacy acknowledgement, **Then** the account is not created and the visitor is
   told why.
2. **Given** the signup form, **When** the visitor opens the Terms or Privacy link,
   **Then** the full document is reachable and readable without losing entered form
   data or leaving the signup flow unrecoverable.
3. **Given** a signed-in user who has never calibrated, **When** they arrive at
   calibration, **Then** the camera/inference consent gate is presented before any
   camera access is requested and before any capture begins.
4. **Given** the camera consent gate is presented, **When** the user agrees,
   **Then** the agreement is persisted with a timestamp **and the identity of the
   wording they were shown**, and the user proceeds to calibration.
5. **Given** a user who has already given camera consent, **When** they calibrate
   again, **Then** the consent gate is not shown again.
6. **Given** an existing user who has never given camera consent, **When** they
   next reach calibration, **Then** they are prompted exactly once — their existing
   readings and account are untouched, and no consent record is fabricated for the
   period before they answered.
7. **Given** a user whose camera consent predates a **material** revision of the
   consent wording, **When** they next attempt calibration or a monitoring session,
   **Then** they are re-prompted with the current wording, their acceptance is
   recorded as a **new** consent against that revision, and the earlier record
   remains unchanged.
8. **Given** a **cosmetic** revision of either consented text, **When** a user whose
   consent predates it uses the product, **Then** they are not re-prompted.
9. **Given** a user who declines the camera-and-inference consent, **When** they use
   the product, **Then** calibration and camera-based monitoring sessions are
   unavailable, the **weekly work-environment check-in remains available**, and their
   existing readings, sessions, and account are untouched.
10. **Given** a user whose Terms/Privacy acknowledgement predates a material
    revision, **When** they sign in, **Then** they cannot use the application until
    they accept — and while blocked they can still **read both documents in full**
    and **sign out**.
11. **Given** a user who has declined either consent, **When** they return, **Then**
    they can reach that prompt again and accept.
12. **Given** any decline, first or re-consent, **When** the user's stored data is
    inspected, **Then** nothing has been deleted and no withdrawal or revocation
    state has been written.

---

### User Story 3 - A person can read what actually happens to their data (Priority: P2)

A visitor or user opens `/privacy` or `/terms` from the footer, the signup form, or
the consent gate. They find real documents describing this system: what the camera
feed does, what is kept and for how long, who can see what, what happens in a
crisis, and which claimed features are not yet operating. The documents state
plainly that they were drafted without a lawyer.

**Why this priority**: The documents are the substance behind US2's gate, but the
gate's *mechanism* can be tested before final legal text lands. P2 reflects
sequencing, not lower importance — #75 requires the checkbox ship **with** real
documents, never with placeholders.

**Independent Test**: Open both documents directly and verify each required topic
is covered and each factual claim is traceable to code or constitution.

**Acceptance Scenarios**:

1. **Given** `/privacy`, **When** read end to end, **Then** it describes
   webcam-derived inference, what is transmitted, what is discarded, what is
   retained and for how long, manager visibility, companion-chat privacy, and the
   crisis invariants.
2. **Given** either document, **When** its data-handling statements are compared
   against the shipped system, **Then** every statement is true of the system as
   shipped in this feature.
3. **Given** either document, **When** a reader looks for legal assurance, **Then**
   they find an explicit, unmissable statement that the text is an informed draft
   prepared without qualified legal review.
4. **Given** `/privacy`, **When** a reader looks for not-yet-live features,
   **Then** a clearly-marked forward-looking section names audio and physiological
   modalities, manager dashboards, and privacy controls as **not operating today**.

---

### User Story 4 - A visitor meets the team (Priority: P3)

A visitor scrolls to the team section, sees a full-width photo of the four
builders, and can hover, tap, or keyboard-focus either a person in the photo or
their name card — either one highlights the other. Supervisors are credited.

**Why this priority**: This is a graduation project; attribution matters and the
section is a signature piece. It carries no product or legal risk, so it lands last.

**Independent Test**: Focus each name card by keyboard and confirm the matching
person is outlined in the photo, and vice versa.

**Acceptance Scenarios**:

1. **Given** the team section, **When** a name card receives hover, tap, or
   keyboard focus, **Then** that person's outline is highlighted in the photo and
   the rest of the photo is de-emphasised.
2. **Given** the team section, **When** a person's outline in the photo receives
   hover or tap, **Then** their name card is highlighted.
3. **Given** a keyboard-only visitor, **When** they tab through the team section,
   **Then** every interactive element is reachable and shows a visible focus
   indicator.
4. **Given** the team section, **When** credits are read, **Then** the four
   builders and both supervisors (Dr. Lamees Nasser · Dr. Safaa Mouneer) are named.

---

### Edge Cases

- **A visitor with `prefers-reduced-motion` enabled**: the story does not
  auto-advance and no motion plays; a static, representative state is shown and
  chapter markers remain the way to move through the story (see FR-013).
- **A signed-in user visits `/`**: they must still reach the app — the landing
  page must not strand or re-authenticate them (FR-017).
- **A Supabase auth link lands on `/` carrying a `?code=` parameter**: the
  existing PKCE-forwarding behaviour at the root must survive the landing page
  taking over `/` (FR-017).
- **A visitor loads the page at 320px wide**: no horizontal scrolling, no tap
  target below 44px, no two-line tap targets.
- **A visitor's browser blocks the team photo or it fails to load**: the name
  cards and supervisor credits remain readable and usable.
- **A user abandons the camera consent gate** (closes, navigates away, or
  declines): no consent record is written for the wording being offered, no
  calibration or monitoring session occurs, and they are prompted again next time.
  Declining must not silently record a grant. If they hold an **earlier** consent to
  a superseded revision, that record survives untouched — it simply no longer
  unlocks the camera features.
- **A material revision is published while a user is signed in**: they meet the
  re-prompt at their next attempt to use the scope that text governs — the
  Terms/Privacy case blocks the application, the camera case blocks only calibration
  and monitoring sessions.
- **A user declines the camera consent and then opens the weekly work-environment
  check-in**: it is available and works normally. It is not camera-based, so the
  camera decline does not reach it.
- **A user completes signup but never calibrates**: they hold a Terms/Privacy
  acknowledgement but no camera consent — this is a valid, expected state.
- **The hero story is mid-conversation when the thread reaches its cap**: the
  oldest message leaves the thread; the card still does not resize or scroll.

---

## Requirements *(mandatory)*

### Truthfulness (non-negotiable — governs every other requirement)

- **FR-001**: Every data-handling claim on the landing page, in the consent gates,
  and in both legal documents MUST be true of the system as shipped in this
  feature. Any claim that cannot be verified against the codebase or the
  constitution MUST NOT be written — it MUST be raised as an open question
  instead. The following are the verified claims this feature may make:
  - Video **is transmitted** to the backend for inference *(verified: the web
    client uploads recorded clips to the inference service)*.
  - Video is **processed and then discarded** — the temporary clip is deleted on
    **every** outcome, including errors *(verified: `apps/api` deletes the temp
    clip in a `finally` block; covered by dedicated privacy tests)*.
  - Video is **never persisted** and **no human, including an admin, can view or
    replay it** *(verified: no storage path, no retrieval surface)*.
  - Only the **derived reading** is stored *(verified: `window_readings`)*.
  - Companion chat is **employee-private** *(verified: chat RLS is self-only)*.
  - A crisis disclosure is **never persisted**, **never notifies any manager,
    admin, or employer**, and **routes only to external resources** *(verified:
    the crisis panel is a live, render-only payload with no persisted flag)*.
  - **Companion chat content and crisis disclosures never reach a manager, admin,
    or employer — permanently.** This is the one "nothing reaches a manager" claim
    this feature may make, it is scoped to those two things only, and it may be
    stated without a not-yet-live qualifier because it is a non-negotiable
    invariant of Principle I rather than an unbuilt control.
  - **No manager-facing surface exists today** *(verified: monitoring sessions and
    window readings are self-only, there is no manager read policy and no
    manager-facing route)*. Any statement about what a manager sees is therefore a
    statement about the designed end-state, governed by FR-048a and FR-049.
  - Readings are **retained 90 days as a matter of policy**.
  - Evaluation was **subject-disjoint**.

- **FR-002**: These three claims are **FALSE** for this system and MUST NEVER appear
  in any form, paraphrase, or implication, anywhere in this feature's surfaces:
  - "video never leaves your device"
  - "frames are processed in your browser and discarded"
  - **any blanket "nothing reaches a manager" claim** — including the mock's
    *"A team lead sees anonymised group trends and nothing else. Not your individual
    readings."* Stress-trend summaries **are** manager-visible by default in the
    designed end-state, so a blanket claim is a promise this system will break.
    Constitution **Principle I** (public-communication rule, Amendment 17) forbids
    flattening the distinction in either direction. The scoped chat-and-crisis claim
    permitted by FR-001 is the only form this claim may take.

  *(The signed-off landing mock carries the flattened claim on three lines. The mock
  is untracked and cannot be fixed by a pull request, so this requirement binds at
  transcription time — when the landing copy is written from it.)*

- **FR-003**: The landing page MUST state the retention policy (readings kept 90
  days) as a **policy**. It MUST NOT describe, promise, or imply an automated
  enforcement mechanism — the purge job is not built and is explicitly not owned by
  this feature (BACKLOG #86).

- **FR-004**: No model performance figures (F1, ROC-AUC, recall, accuracy, or any
  numeric quality metric) may appear anywhere on the landing page or in either
  legal document. The evaluation **method** — "subject-disjoint" — may and should
  be named, without numbers. *(The project poster visible within the team photograph
  does show figures; this is accepted and the photo MUST NOT be cropped or edited
  to remove them.)*

- **FR-005**: The approved hero data-handling line MUST appear verbatim:
  *"Your camera is read, then forgotten. Only the reading is kept."*

### Landing page — hero story

- **FR-006**: The hero story MUST show a **false alarm before** any successful
  companion conversation: the system flags the person as tense, the person
  declines, and the system backs off leaving no record and no follow-up. This
  ordering is the page's thesis and is not reorderable.
- **FR-007**: The story card MUST keep a **permanently-visible readout** — orb,
  reading label, and trend — present in every beat, so the card is never empty.
- **FR-008**: The card MUST NOT shift layout, change size, or clip content as
  panels change, and MUST have **no internal scrolling**, at every supported
  viewport width. *(The structure achieving this is already solved and is a
  plan-level concern — this requirement constrains the behaviour, not the technique.)*
- **FR-009**: The narration line MUST occupy a fixed height so its content changing
  never moves anything around it.
- **FR-010**: The swap area MUST show exactly one scripted panel at a time.
- **FR-011**: The companion thread MUST cap at **4 visible messages**; the scripted
  conversation is a fixed, short sequence.
- **FR-012**: The story MUST pause when the card is scrolled out of view and resume
  when it returns.
- **FR-013**: Under `prefers-reduced-motion`, the story MUST NOT auto-advance and
  MUST NOT animate transitions; it MUST present a static, representative state that
  still shows the readout, and the chapter markers MUST remain functional so a
  visitor can step through the story deliberately. No information conveyed by the
  animation may be available *only* through motion.
- **FR-014**: Story navigation MUST be by **clickable chapter markers**, operable by
  pointer **and** keyboard, with a visible focus indicator and an accessible name
  per marker.
- **FR-015**: Reading labels MUST be exactly the product's three bands — **At ease**
  / **A little tense** / **Tense** — and MUST be sourced from the app's existing band
  definitions rather than restated as new literals. No other band label may appear.
  *(Earlier mock text invented additional labels; those were bugs.)*

### Landing page — structure, navigation, and reuse

- **FR-016**: The landing page MUST be publicly reachable without authentication.
- **FR-017**: The landing page **occupies the root route `/`**. It does not live at a
  separate public path. Two existing root-route behaviours MUST continue to hold
  once it does:
  - A **signed-in visitor** who arrives at `/` MUST still reach the app. They MUST
    NOT be stranded on the public page, and MUST NOT be asked to authenticate again.
  - An **auth callback arriving at `/` carrying a `?code=` parameter** MUST still
    complete. A visitor following a Supabase email link MUST end up signed in.

  *(Which of these takes precedence over rendering the landing page, and how it is
  tested, is a planning decision — this requirement fixes the behaviour, not the
  routing technique.)*
- **FR-018**: The public navbar MUST **visually match** the real app navbar but be a
  **separate component** with its own nav items and **no dashboard or authed
  links**. It MUST NOT be translucent.
- **FR-019**: The public navbar MUST provide a mobile hamburger menu matching the
  app's existing mobile-nav pattern.
- **FR-020**: The primary hero call to action MUST be labelled **"Get started"** —
  verbatim, that casing — and MUST be the **meadow-filled** button. The secondary CTA
  remains **"See how it works"** and remains outline. On mobile both CTAs MUST be
  centred. *(The mock's "Create an account" is superseded.)*
- **FR-021**: The breathing orb MUST be the **canon orb from the live monitor**, not
  a reimplementation. Its established properties MUST be preserved: it is decorative
  and carries no number, it is not a gauge, and under reduced motion its breathing is
  suppressed while its colour still updates.
- **FR-022**: Ren's blue-orb state on the landing page is a **deliberate, approved
  landing-page liberty**. It is intentional, it diverges from the live monitor's
  band colouring on purpose, and it MUST NOT be "corrected" to match the monitor.
- **FR-023**: The site footer MUST link to `/privacy` and `/terms` and MUST appear on
  the public surface.

### Landing page — team section

- **FR-024**: The team section MUST present a full-width team photo with interactive
  per-person outline overlays and four name cards beneath. The photo MUST carry the
  caption **"Choose a name to find them in the photo."** — verbatim. *(The mock's
  "Hover a name to find them — or hover the photo." is superseded: it names an
  interaction touch and keyboard users do not have.)*

  The four name cards MUST carry these names verbatim, in this left-to-right order,
  each linking to that person's real GitHub and LinkedIn:

  | Order | Name | GitHub | LinkedIn |
  |---|---|---|---|
  | 1 | Mohamed Assem Adel | `https://github.com/mohamedasem318` | `https://www.linkedin.com/in/mohamedasem318/` |
  | 2 | Fatma Al-Zahraa Emad | `https://github.com/Fatma-Alzahraaa` | `https://www.linkedin.com/in/fatma-al-zahraa-emad-326b64234` |
  | 3 | Hebatullah El Gazoly | `https://github.com/hebatullah003` | `https://www.linkedin.com/in/hebatullah-elgazoly-308ab2243` |
  | 4 | Gehad Mohamed | `https://github.com/gehaddmohamedd` | `https://www.linkedin.com/in/gehad-mohamed-2a4946252` |

  The mock's inert `href="#"` placeholders MUST NOT ship. Each link MUST have an
  accessible name identifying both the person and the destination, so the eight
  links are distinguishable from one another by a screen reader.
- **FR-025**: Highlighting MUST be **bidirectional**: hover, tap, or keyboard focus
  on a name card highlights that person in the photo, and hover or tap on a person
  in the photo highlights their card.
- **FR-026**: The outline overlay coordinates are **already derived and verified**
  and MUST be reused **verbatim**. Re-deriving, re-tracing, or regenerating them by
  any means is **forbidden**. *(Where the data lives and how it is applied is
  plan-level.)*

  **AMENDED 2026-07-27, by Mohamed, during P7 — one spent exception for `gehad`.**
  The premise "already derived and verified" held for three of the four outlines and
  not for the fourth. The mock's `gehad` path covered her entire left edge with a
  **single straight segment spanning ~28 viewBox units** (`L 79.47 68.64` to
  `L 82.72 40.98`); every other segment in all four paths is short. That one segment
  sliced across her shoulder and upper arm and clipped the corner of her blazer where
  it overlaps Hebatullah — so reusing it verbatim would have shipped a visibly wrong
  outline on a public page, which is not what this requirement is for.

  `gehad` was therefore re-traced **once**, and Mohamed placed the final elbow and hem
  vertices himself. Scope of the exception, all of which was verified before it landed:

  - It applies to **`gehad` only**. `mohamed`, `fatma` and `hebatullah` remain
    byte-identical to the mock and are still covered by the unamended rule above.
  - Within `gehad`, vertices **0–6** and everything from `L 83.38 39.05` onward are
    **byte-identical** to the mock. Only the defective span changed.
  - `gehad`'s x-max is unchanged at **97.78**; its x-min moved 79.47 → **77.28**,
    recovering the blazer. The four x-ranges are still strictly ascending on both min
    and max.

  **The exception is spent.** `tests/unit/lib/landing/team-silhouettes.test.ts` freezes
  all four paths again by length and SHA-256. A further re-trace of any outline —
  including this one — needs a further amendment; it is not licensed by this one.
- **FR-027**: The team section MUST credit the supervisors: **Dr. Lamees Nasser ·
  Dr. Safaa Mouneer**.
- **FR-028**: The team section MUST be fully keyboard operable with visible focus,
  and MUST NOT depend on hover alone to convey which person is which.

### Wordmark canonization

- **FR-029**: The two-colour `serenify` wordmark MUST be canonized as **the** product
  wordmark and MUST render identically at **every** site that renders it. Those sites
  are, exhaustively:

  | Surface | In the web app's React tree? |
  |---|---|
  | Public navbar | yes — built by this feature |
  | Public footer | yes — built by this feature |
  | Authed app header | yes — exists today |
  | Auth-pages layout | yes — exists today |
  | **Onboarding layout** | yes — exists today |
  | **Social card** (`next/og` image) | **no** — hand-sync exception |
  | **Supabase transactional email templates** (confirmation, recovery) | **no** — hand-sync exception |

  Within the React tree the wordmark MUST have **one shared definition**, reused at
  every site above; re-typing the markup at a new site is a violation. The social
  card and the email templates cannot consume that definition — the first renders
  without the app's fonts, the second is inline-styled HTML — so they are **named
  hand-sync exceptions**: they MUST match, and any change to the wordmark MUST update
  them in the same pull request. Per Constitution **Principle V** (Wordmark,
  Amendment 17). *(Which shared definition, and where it lives, is plan-level.)*

  *(The earlier draft of this requirement listed only four sites. It omitted the
  onboarding layout, the social card, and the email templates, and asserted a
  "defined once everywhere" universal that the constitution deliberately does not —
  hence this restatement. All three in-tree sites that exist today render the
  wordmark single-colour; the two-colour treatment is implemented nowhere yet.)*

  **AMENDED 2026-07-28, by Mohamed, during the landing fidelity pass — a
  clarification, not a new allowance.** "Exhaustively" reads as a closed list of every
  place the wordmark may appear, and it was written to mean something narrower. The
  table enumerates the surfaces that carry the wordmark as **standing chrome** — a
  persistent brand mark in a header, a footer, a layout or a template — and its
  load-bearing purpose is to close the list of **hand-sync exceptions** at exactly two.

  **In-prose usage is permitted and is not a new site.** Where the product name occurs
  inside a heading, it MAY render as the wordmark **through the one shared definition**.
  Doing so introduces **no new hand-sync exception**, because such a usage consumes the
  shared component rather than restating it — which is precisely the property this
  requirement protects. Re-typing the two-tone markup at such a site remains a
  violation, exactly as it is at a chrome site.

  The two hand-sync exceptions remain **exactly two**: the `next/og` social card and the
  Supabase transactional email templates. This clarification adds none and licenses none.
- **FR-030**: The wordmark MUST always render lowercase and MUST NOT carry a dot or
  other terminal punctuation.
- **FR-031**: **Resolved — the amendment was required and has landed.** This change
  alters the product's design language and engages Constitution **Principle V**;
  **Amendment 17** (merged, PR #156, constitution 1.13.0) added the Wordmark block
  that FR-029 and FR-030 now restate. This feature implements a constitutional rule
  rather than proposing one, and MUST NOT re-amend the constitution.

### Fixed copy

- **FR-032**: The following user-facing strings are **fixed copy** and MUST be used
  verbatim, sourced from the mock and — where already implemented — from the
  codebase, rather than re-invented: the confirmatory prompt's eyebrow, body, and
  three options; Ren's header name and subtitle; and the companion disclaimer. Ren's
  voice throughout is **warm, unhurried, reflective — not perky**.

### Consent — signup

- **FR-033**: Account creation MUST be blocked until the user gives an explicit
  Terms + Privacy acknowledgement. The acknowledgement MUST be an active choice —
  never pre-checked, never inferred from form submission alone.
- **FR-034**: Both documents MUST be reachable from the signup form before the user
  agrees.
- **FR-035**: The acknowledgement MUST be recorded so it is auditable, capturing at
  minimum **when** it was given and **which version** of each document was accepted.
  Acknowledgement is **not one-time**: it is subject to the revision and re-consent
  rules in **FR-043a–FR-043e**, under which a material revision of either document
  re-prompts every user whose acknowledgement predates it and blocks all application
  use until they answer.
- **FR-036**: The consent gate MUST ship together with the real, complete documents —
  never as a checkbox linking to placeholder or empty pages.

### Consent — camera / inference

- **FR-037**: A **separate**, explicit camera-and-inference consent gate MUST be
  presented **before a user's first-ever calibration**, which is the correct hook
  because calibration is unskippable and precedes any inference. It is asked **once
  per revision of the consent wording, not once per user** — see FR-043a–FR-043e.
- **FR-038**: The gate MUST be presented **before** camera access is requested and
  **before** any capture begins.
- **FR-039**: Consent MUST be persisted, and the record MUST capture at minimum **when**
  consent was given **and which consent wording the user was actually shown**. The record
  MUST identify the presented wording well enough that, if that text is later revised, it
  remains answerable what a given user agreed to. This matches the discipline FR-035
  already applies to the Terms/Privacy acknowledgement — a consent record that cannot say
  what was consented to is not auditable. *(How wording revisions are identified and
  stored is a plan decision.)*
- **FR-040**: The gate MUST NOT be shown again once consent is recorded, **until a
  material revision of the consent wording is published** (FR-043a). It MUST NOT be
  shown again for a cosmetic revision.
- **FR-041**: **Existing users have never given camera consent.** They MUST be
  prompted **once**, on their next session. Consent MUST NOT be backfilled as
  already-granted for any existing user — recording a fact that never happened is
  forbidden. Existing readings, sessions, and accounts MUST be left untouched: this
  is a gate, not a deletion.

  The same prohibition governs **re-consent**: an existing consent record MUST NOT be
  rolled forward, re-stamped, or otherwise treated as covering a later revision the
  user was never shown. Consent to a revision exists only if that revision was
  actually presented and actually accepted, and every record — first or subsequent —
  captures the wording presented **at that moment** (FR-039).
- **FR-042**: Declining or abandoning a consent gate MUST NOT create a consent record
  for the wording being offered, and MUST NOT grant the access that wording governs
  (FR-043c).
  - At a **first** consent this leaves the user with no consent record for that text
    at all.
  - At a **re-consent** the user's **earlier consent records MUST survive unchanged**.
    Declining a revision MUST NOT overwrite, edit, delete, or invalidate the record of
    what they previously agreed to. What blocks access is the **absence of a record
    for the new revision** — never the destruction of the old one.
- **FR-043**: Consent **withdrawal is out of scope** (it belongs to
  `018-privacy-controls`). The consent record MUST nonetheless be **shaped so that
  withdrawal can be added later without rework** — the concrete schema is a plan
  decision, but a shape that can only ever express "granted" is not acceptable.
  **Declining a gate is not withdrawal** and MUST NOT be modelled as one (FR-043e).

### Consent — revision and re-consent

*(These rules apply **symmetrically to both consented texts**: the Terms/Privacy
acknowledgement of FR-033–FR-036 and the camera-and-inference consent wording of
FR-037–FR-043. One rule, two applications — neither is built without the other.)*

- **FR-043a**: Every published revision of a consented text MUST be classified, at
  publication, as either **MATERIAL** or **COSMETIC**. A material revision re-prompts
  every user whose recorded consent predates it; a cosmetic revision re-prompts
  nobody. The classification is a **human judgment made when publishing** — it MUST
  NOT be derived from an automatic comparison of the text. *(How the classification is
  recorded, and how "predates" is evaluated, are plan decisions.)*
- **FR-043b**: A user whose recorded consent predates a material revision MUST be
  re-prompted with the **current** wording, and their acceptance MUST be recorded as a
  **new** consent against that revision. The earlier record MUST NOT be overwritten,
  edited, or backfilled. **The history of what a person agreed to, and when, is the
  point** — a consent trail that keeps only the latest answer cannot establish what was
  true at the time a given reading was taken.
- **FR-043c**: Declining blocks a different scope per text, and **only** that scope:
  - **Camera-and-inference consent declined** → the user MAY NOT run **calibration**,
    anchor/baseline capture, or any **camera-based monitoring session**. Nothing else
    is blocked. The **weekly work-environment check-in** is not camera-based and MUST
    remain available. *(The product UI calls both the monitoring session and the weekly
    questionnaire a "check-in". This specification never uses that word unqualified,
    for exactly that reason.)*
  - **Terms/Privacy acknowledgement declined** → the user MAY NOT use the application
    at all until they accept. This is the basis on which the product is used, not a
    feature-level permission.
- **FR-043d**: A user blocked by a declined Terms/Privacy acknowledgement MUST still be
  able to **read both documents in full** and to **sign out**. A gate a person cannot
  read their way out of is a locked account — and an acceptance offered without the
  ability to open what is being accepted is not meaningful consent.
- **FR-043e**: Declining is a **pause, not a terminal state**, and destroys nothing:
  - **Declining is NOT withdrawal.** Existing readings, sessions, and account data MUST
    be left untouched; the user is blocked from the gated features, nothing is deleted,
    and **no revocation or withdrawal state is written**. Withdrawal remains out of
    scope and belongs to feature **018** (FR-043).
  - **Declining is NOT a deletion trigger.** Data already held remains subject to the
    standard **90-day reading-retention policy** (BACKLOG #86) — which is time-based,
    applies to every user regardless of consent status, and whose purge job is not
    built and is not owned by this feature. Nothing in these requirements may describe,
    promise, or imply that declining causes deletion. **FR-003's prohibition on
    implying an automated purge mechanism stands and extends to this text.**
  - **A decline MUST be recoverable.** The user MUST be able to reach that prompt again
    and accept. *(Where and how it is reachable again is a plan decision.)*

### Legal documents

- **FR-044**: `/terms` and `/privacy` MUST contain real, substantive text grounded in
  this system's actual data flows — not generic templates.
- **FR-045**: The documents MUST address the applicable regimes: **Egypt (Law
  151/2020)**, **EU/GDPR** (personal data resides in Supabase Frankfurt), and the
  **Azure** processing footprint.
- **FR-046**: The data controller MUST be identified as **Mohamed Asem, as an
  individual** (there is no legal entity), contactable at **`mohamedasem318@gmail.com`**.
  No placeholder remains.
- **FR-047**: The documents MUST state honestly and unmissably that they are an
  **informed draft prepared without qualified legal review**, and that such review is
  required before any real (non-demo) user data is processed.
- **FR-048**: The Privacy Policy MUST describe: webcam-derived inference; what is
  transmitted, discarded, and kept; **90-day reading retention as policy**;
  **companion chat as employee-private**; **manager visibility** (per FR-048a); and
  the **crisis-disclosure invariants** — never notifies any manager, admin, or
  employer; never persisted; routes to external resources only.
- **FR-048a**: Manager visibility MUST be described as the **employee-controlled
  model** Constitution Principle I designs, honestly and without flattening:
  - **Stress-trend summaries ARE visible to a direct manager**, by default, at the
    `summary only` granularity. This MUST be stated plainly. It MUST NOT be softened,
    omitted, or buried.
  - **Every description of manager visibility MUST carry its not-yet-live marker at
    the point of use.** Wherever the copy says what a manager sees, that same passage
    MUST make clear that **no manager-facing surface is live today** and that what is
    being described is the **designed end-state**. A marker in a distant
    forward-looking section does **not** satisfy this: a reader who reads only the
    paragraph in front of them MUST NOT come away believing a manager can see their
    trend today. This is **in addition to** FR-049's forward-looking section, not
    instead of it.

    Unqualified present tense is forbidden here for two independent reasons. It
    breaches Principle I's public-communication rule, which requires controls that
    are not yet live to be marked as such. And it is a **false data-handling claim
    under FR-001** — no manager-facing surface exists, so "your manager sees your
    trend" is untrue of the system as shipped. Overstating manager visibility is not
    a safe hedge: it tells an employee they are being watched today when they are
    not.

    *(The account page's privacy placeholder already models the required voice — it
    names the control, says what it will let the person do, and closes with the fact
    that there is nothing to configure yet. That string is compliant and MUST NOT be
    "corrected".)*
  - The employee controls granularity through a **three-position privacy slider**
    (`full detail` / `summary only` / `off during specified hours`), and can see
    exactly what their manager sees through a **transparency view**.
  - **Neither the slider nor the transparency view is live.** Both arrive with
    feature **018** (`privacy-controls-and-transparency`). Every mention of either
    MUST be marked not-yet-live and MUST NOT be written in the present tense. Copy
    that implies an employee can adjust their granularity today is forbidden.
  - **Companion chat content and crisis disclosures never reach a manager, admin, or
    employer** — permanently, per FR-001. This is a genuinely unconditional promise
    and is stated as one.
  - A **direct manager sees their direct reports only**; skip-level and above see
    only aggregated org-wide data.

  This resolves the contradiction recorded at OQ-1 and implements Constitution
  Principle I's public-communication rule (Amendment 17). It applies to **every**
  surface this feature ships — the landing page, both legal documents, and both
  consent gates — not to the Privacy Policy alone.
- **FR-049**: The documents MUST include a short, clearly-marked forward-looking
  section naming features that are **planned but not operating today**: audio and
  physiological modalities, manager dashboards, and the privacy controls named in
  FR-048a (the three-position slider and the transparency view, both feature 018).
- **FR-050**: Every factual statement in both documents MUST be cross-checked against
  Constitution Principle I **and** the actual implementation. **On any discrepancy
  between constitution, code, and text, work stops and the discrepancy is reported —
  a policy that misdescribes the data handling is worse than none.** *(One such
  discrepancy was found and resolved before planning: OQ-1, the manager-visibility
  contradiction, settled by Constitution Amendment 17 and folded into FR-048a.)*

### Cross-cutting constraints

- **FR-051**: `localStorage` and `sessionStorage` MUST NOT be used anywhere in this
  feature.
- **FR-052**: No fake device chrome anywhere — no simulated browser bars, phone
  frames, laptop bezels, or window furniture.
- **FR-053**: The public surface MUST be correct at **320px, 375px, 414px, and
  768px**: no horizontal scrolling, no tap target smaller than 44px, and no tap
  target whose label wraps to two lines.

  **AMENDED 2026-07-28, by Mohamed, during the landing fidelity pass — one spent
  exception for the hero story's chapter markers.** The 44px floor made the mock's
  chapter-marker treatment unreachable: the markers are six controls in one row, so at
  44×44 the cluster is **264px wide** however small the dot inside it is drawn, against
  the mock's ~66px. The row read as sparse and scattered rather than as the tight
  cluster the mock composes, and shrinking the dot does not help because the *hit area*
  is what sets the width.

  The chapter markers — and **only** the chapter markers — may therefore use a **24×24px**
  minimum target. Scope of the exception:

  - It applies to `components/landing/chapter-markers.tsx` **only**. Every other
    interactive element on the public surface — the navbar's links and auth actions, the
    hamburger, the hero CTAs, the footer links, the legal contents index, the retention
    links — stays at **44px**, and the walk that asserts it is unchanged apart from
    exempting these six.
  - **24×24 satisfies WCAG 2.5.8 (AA)**. This is a step from AAA down to AA on one
    control, not a drop below conformance. The six targets sit flush, so a 24px circle
    centred on any one of them does not intersect another.
  - The markers are a **convenience, not a path**: the story auto-advances without them
    and every beat is reachable by waiting, so nothing on the page is only obtainable
    through a marker.
  - They MUST remain **keyboard reachable with a visible focus ring** (FR-055), and MUST
    keep meeting the 3:1 non-text contrast bar (WCAG 1.4.11) that the same pass fixed.

  **The exception is spent.** It licenses no other sub-44px target anywhere on the public
  surface; a further one needs a further amendment.
- **FR-054**: `prefers-reduced-motion` MUST be respected across the whole feature.
- **FR-055**: The whole feature MUST be keyboard accessible with a visible focus
  indicator on every interactive element.
- **FR-056**: Tests MUST be provided per Constitution **Principle VII**.
- **FR-057**: The landing page MUST reuse the existing real components and design
  tokens rather than porting the mock's standalone CSS. The mock is a **throwaway
  visual reference**, not production code.

### Key Entities

- **Terms/Privacy acknowledgement**: a record that a specific user accepted a
  specific version of each document at a specific time. A user accumulates **one
  record per accepted revision** — accepting a later revision **adds** a record, it
  never replaces the earlier one. Created at signup; blocks account creation until
  present, and blocks all application use while a material revision stands unaccepted.
- **Camera/inference consent**: a record that a specific user explicitly permitted
  webcam capture and inference, capturing the time it was given **and the identity of
  the consent wording they were shown**. A user likewise accumulates **one record per
  accepted revision**. Created before first calibration; absent for every existing user
  until they are prompted. Shaped to accommodate a future withdrawal state without
  restructuring.
- **Document version**: the identifier of a published revision of a consented text —
  the Terms, the Privacy Policy, **or the camera-and-inference consent wording** —
  carrying its **material/cosmetic** classification (FR-043a) and referenced by consent
  records so consent remains auditable when that text changes.

---

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: A first-time visitor can state, unprompted after one viewing of the
  hero story, that the system asks the person before acting and can be told it is
  wrong.
- **SC-002**: The hero story reaches and resolves the false-alarm beat **before**
  any companion conversation beat, in 100% of playthroughs.
- **SC-003**: The hero card's outer dimensions vary by **zero pixels** across a full
  story cycle, and no scrollbar ever appears inside it, at every supported width.
- **SC-004**: 100% of data-handling claims across the landing page, consent gates,
  and both legal documents are traceable to a verified behaviour of the shipped
  system; the two forbidden claims appear **zero** times.
- **SC-005**: Zero model performance figures appear on the landing page or in either
  legal document.
- **SC-006**: Account creation cannot be completed without acknowledgement in 100%
  of attempts.
- **SC-007**: No user reaches calibration **or a camera-based monitoring session**
  while a **material** revision of the camera wording stands unaccepted by them; zero
  consent records exist for users who never answered the gate; and every consent record
  identifies both when it was given and which wording was shown. *(Cosmetic revisions
  do not enter this criterion — per FR-043a they re-prompt nobody, so holding consent
  against a cosmetically-superseded wording is correct behaviour, not a violation.)*
- **SC-008**: At 320px, 375px, 414px, and 768px the public surface produces no
  horizontal scrolling and every tap target is at least 44px and single-line.
- **SC-009**: Every interactive element on the public surface is reachable by
  keyboard alone with a visible focus indicator, and the team section's
  person-to-name mapping is obtainable without hover.
- **SC-010**: With `prefers-reduced-motion` set, the story presents no motion and no
  auto-advance, and remains fully navigable via chapter markers.
- **SC-011**: Only the three product band labels appear in the hero readout across a
  full cycle.
- **SC-012**: After a **material** revision of either consented text, 100% of users
  whose recorded consent predates it are re-prompted before any further use of the
  scope that text governs. After a **cosmetic** revision, **zero** users are
  re-prompted.
- **SC-013**: Across every decline — first consent or re-consent — **zero** prior
  consent records are modified or removed, **zero** readings or sessions are deleted,
  and **zero** withdrawal or revocation states are written. A user who has declined the
  camera consent can still complete the weekly work-environment check-in.

---

## Non-Goals

- **A per-beat progress bar.** Explicitly rejected. Story navigation is chapter
  markers only.
- **Consent withdrawal / revocation UI.** Belongs to `018-privacy-controls`. This
  feature only ensures the record's shape does not preclude it (FR-043). **Declining a
  consent gate is not withdrawal** and writes no revocation state (FR-043e).
- **Deletion on decline.** Declining triggers no deletion of anything. Data already
  held stays subject to the time-based 90-day retention policy that applies to every
  user regardless of consent status (FR-043e, FR-003).
- **The 90-day purge job.** Policy is stated; the enforcement mechanism is not built
  and is not owned here (BACKLOG #86).
- **Gating `/signup` to invite-only.** That is issue **#62**, a separate auth-posture
  concern, and is not addressed by this feature.
- **Manager dashboards or any manager-facing surface.** None exist today and none are
  built here.
- **Publishing model metrics.** No numbers, on principle (FR-004).
- **Changing what data is collected, processed, or retained.** This feature describes
  and gates the existing data handling; it does not alter it.
- **Backfilling consent for existing users.** Forbidden (FR-041).
- **Re-deriving the team outline coordinates.** Forbidden (FR-026).
- **Qualified legal review.** Out of reach; its absence is disclosed instead (FR-047).
- **Porting the mock as production code.** The mock is a visual reference only.

---

## Assumptions

- The landing page is a public, unauthenticated, statically-servable marketing
  surface; it consumes no user data and makes no authenticated calls.
- The hero story is **entirely scripted**. It does not call the inference service,
  does not use a camera, and shows no real person's data. Its "readings" are
  illustrative.
- The band labels are sourced from the app's existing definitions, which today live
  alongside the session-trend rendering logic.
- The canon orb is the live monitor's ambient breathing bloom
  (`apps/web/components/monitor/bloom.tsx`). *Note: the request attributed it to
  feature 007; the component is documented as feature 008's signature surface, built
  on the calibration breathing guide. Same artefact — recorded so the plan targets
  the right file.*
- "First-ever calibration" is determinable from existing per-user calibration state
  (the anchor columns and their scope-guarded status helper), so a new "has this user
  ever calibrated" concept is not required.
- Both consent records attach to the user's profile domain and are readable only by
  their owner, consistent with existing row-level security patterns.
- The team photo's subjects are the four project members, who consent to its
  publication. The photo contains no StressID subject imagery, so the
  withheld-consent subject prohibition (Principle I) is not engaged.
- Reduced-motion behaviour for the story (FR-013) was chosen by this specification —
  no auto-advance, static representative state, markers still functional — as the
  reading that preserves the story's information without motion.
- The "rolling 60-second window" phrasing used in the mock matches the constitution's
  documented inference contract (60-second windows, 10-second stride) and is
  therefore a true claim.
- The mock's team-card social links are inert placeholders; the real destinations are
  fixed by FR-024 and supersede them.

---

## Dependencies

- **Existing and consumed unchanged**: the calibration flow and its per-user anchor
  state; the app header, mobile-nav, and auth-pages layout (which the wordmark change
  touches); the live monitor's breathing bloom; the app's band definitions; the
  Graphite token set.
- **Existing and MODIFIED by this feature**: the **signup flow and its server action**,
  which gains the Terms/Privacy acknowledgement gate (FR-033); and the **authed
  application shell**, which gains the re-consent entry gate that blocks all
  application use while a material Terms/Privacy revision stands unaccepted (FR-043c).
  *(An earlier draft of this section listed the signup flow as consumed unchanged and
  did not mention the app shell at all. The re-consent model makes both false — recorded
  here so the plan does not inherit the wrong constraint.)*
- **Constitution Principle I** is the authority for every data-handling claim.
- **Feature 018 (`privacy-controls-and-transparency`)** defines data-handling
  substance that will feed these documents; if 018 changes what is collected, seen, or
  retained, both documents must be revisited (Amendment 16's standing
  Privacy-Policy/ToS-per-PR rule).
- **BACKLOG #86** (90-day purge job) is referenced by the retention policy but is not
  a blocker and is not owned here.

---

## Open Questions

> Per the request, genuinely ambiguous or contradictory items were recorded here rather
> than guessed. **All eight are now resolved** — OQ-1 and OQ-3 by Constitution
> Amendment 17 (merged, PR #156), the rest by operator decision on 2026-07-25. Each
> question is preserved verbatim below with its resolution appended; nothing is
> deleted, because why a thing was decided is worth as much as what was decided.

### OQ-1 — ✅ RESOLVED (Option B, via Constitution Amendment 17)

> **Resolution.** **Option B.** Principle I's substance is unchanged — per-individual
> manager visibility with the employee-controlled granularity slider remains the
> intended end-state. Amendment 17 added a **public-communication rule** to Principle I
> governing how that end-state may be described: honestly, with any not-yet-live
> control marked as not yet live, and with **no flattening in either direction**.
> Stress-trend summaries ARE manager-visible by default at `summary only`; companion
> chat and crisis disclosures never reach a manager, admin, or employer, permanently.
> The mock's blanket claim is therefore forbidden copy, not approved copy.
> **Folded into**: FR-001 (the scoped permitted claim + "no manager-facing surface
> exists today"), FR-002 (the blanket claim added to the forbidden list), **FR-048a**
> (the affirmative description rule, feature-wide), FR-049 (slider and transparency
> view named as feature 018, not-yet-live).

**Original question, preserved:**

#### *(as originally raised — ⛔ BLOCKING: manager visibility contradicts Constitution Principle I)*

The required copy says managers see **anonymised group trends only** — and the mock
states it flatly: *"A team lead sees anonymised group trends and nothing else. Not
your individual readings."*

**Constitution Principle I says the opposite** as the designed end-state:

> "Per-individual stress trends **ARE visible to a direct manager**. This is an
> intentional product decision … Employees control granularity via a three-position
> privacy slider: `full detail` / `summary only` (DEFAULT) / `off during specified hours`."

**What the code actually does today** (verified): `monitoring_sessions` and
`window_readings` are **self-only** — there is no manager read policy at all. No
manager-facing route exists. The only manager-visible data is the questionnaire
weekly work-environment summary, which is an **identity-stripped aggregate** behind a
manager-only routine. So the mock's claim is **true of today's system** and **false of
the system the constitution describes**.

This matters because a privacy promise on a public page is durable. If the page says
"never your individual readings" and feature 018 then ships per-individual manager
visibility as Principle I mandates, the published promise becomes a lie — the exact
failure FR-050 exists to prevent.

**Please choose:**

| Option | Answer | Implications |
|--------|--------|--------------|
| A | Amend Principle I — drop per-individual manager visibility; managers see anonymised aggregates only, permanently | Page and legal text can say what the mock says. Requires a constitution amendment (your explicit approval) and materially changes 018's scope. |
| B | Keep Principle I; write the copy to describe the **employee-controlled** model (default `summary only`, employee can restrict) | Copy is honest about the end-state but describes a slider that does not exist yet — must be marked as not-yet-operating under FR-049, which weakens the pitch. |
| C | Describe only today's system, with no permanence claim ("today, no manager can see any individual reading") | Truthful now and needs no amendment, but reads as hedged, and the page must be revised the moment 018 ships. |
| Custom | Your own wording/decision | — |

### OQ-2 — ✅ RESOLVED — Hero primary CTA label

The brief says "**Get started / sign up**"; the mock says "**Create an account**".
Which exact string ships? (The mock's secondary CTA "See how it works" appears
settled.)

> **Resolution.** **"Get started"** — verbatim, that casing. The mock's "Create an
> account" is superseded. The secondary CTA "See how it works" is confirmed.
> **Folded into**: FR-020.

### OQ-3 — ✅ RESOLVED — Does the wordmark change need a constitution amendment?

FR-029–FR-031 canonize a two-colour wordmark across authed surfaces. Principle V
locks the design language. Per your standing rule, the constitution is never amended
without your explicit approval — so this is a question, not an assumption. Does
canonization require an amendment, or does it sit inside the existing Graphite
palette (it uses only `ink` + `meadow-text`, both already locked tokens)?

> **Resolution.** **Yes, an amendment was required — and it has landed.** Constitution
> **Amendment 17** (merged, PR #156, 1.12.0 → 1.13.0) added a **Wordmark** block to
> Principle V. It introduces no new token and changes no token value, but it does
> register `--color-meadow-text` in Principle V for the first time. This feature now
> implements a constitutional rule rather than proposing one, and MUST NOT re-amend
> the constitution. **Folded into**: FR-029 (restated against the amendment, with the
> render inventory corrected), FR-031.

### OQ-4 — ✅ RESOLVED — Controller contact address

FR-046 leaves exactly one clearly-marked placeholder for the data controller's
contact email. Please supply the exact string to publish.

> **Resolution.** **`mohamedasem318@gmail.com`**. No placeholder remains.
> **Folded into**: FR-046.

### OQ-5 — ✅ RESOLVED — Team social links

The mock's GitHub/LinkedIn icons are inert placeholders (`href="#"`). Ship real
URLs, omit the icons, or ship them disabled?

> **Resolution.** **Ship real URLs** — four cards, fixed names, fixed left-to-right
> order, GitHub + LinkedIn per person. The roster is in **FR-024**. The inert
> `href="#"` placeholders MUST NOT ship.

### OQ-6 — ✅ RESOLVED — Which URL does the landing page occupy?

`/` currently redirects signed-in users to `/app`, anonymous users to `/login`, and
forwards stray Supabase `?code=` links. Should the landing page take over `/` (with
the signed-in redirect and `?code=` forwarding preserved), or live at a separate
public path leaving `/` untouched? This changes routing scope materially.

> **Resolution.** **The landing page takes over `/`.** Two behaviours must survive:
> a signed-in visitor at `/` still reaches the app, and an auth callback carrying
> `?code=` still completes. Routing precedence and its tests are planning decisions,
> not spec content. **Folded into**: FR-017.

### OQ-7 — ✅ RESOLVED — Issue hygiene (needed a decision before merge)

Three mismatches found:

1. **#62 is not the consent gate.** It is "Gate `/signup` to invite-only (open
   self-serve posture)" — an auth-posture issue. This feature does **not** close it.
   Confirm it stays open and is dropped from this feature's "Closes" list.
2. **#75 is already closed on GitHub — apparently by accident.** It was closed as
   COMPLETED on 2026-07-24 by commit `fba656d` (PR #154, the owning-feature
   reconcile), which evidently carried a closing keyword. `docs/BACKLOG.md` still
   records it as **OPEN** ("still OPEN — 013 has not shipped"), and per CLAUDE.md
   BACKLOG wins on conflict. **#75 should be reopened** and re-closed only when this
   feature ships. Confirm and I will reopen it.
3. **The camera/inference consent gate has no issue.** It is new scope. Per Principle
   VIII it needs a BACKLOG entry and a matching GitHub issue opened in the same
   change.

> **Resolution (all three, 2026-07-25).**
> 1. **#62 confirmed out of scope and dropped from this feature's "Closes" list.** Its
>    own GitHub issue and BACKLOG entry are **untouched**: it stays **OPEN** and stays
>    a ⛔ pre-production deploy blocker owned by a later auth/tenancy decision. This
>    feature does not address it and must not be read as closing it.
> 2. **#75 reopened.** It had been closed as COMPLETED on 2026-07-24 by a stray closing
>    keyword in commit `fba656d` (PR #154, the owning-feature reconcile). Nothing that
>    could complete it shipped that day — no `/terms`, no `/privacy`, no signup
>    checkbox. `docs/BACKLOG.md` and `docs/DECISIONS.md` both recorded it as OPEN, and
>    per CLAUDE.md BACKLOG wins on conflict. It re-closes only when this feature ships.
> 3. **Camera/inference consent gate logged.** BACKLOG entry written and GitHub issue
>    **#157** opened in the same change, per Principle VIII. Its requirements are
>    FR-037–FR-043, which already existed in this spec; the entry points at them rather
>    than restating them, so the two cannot drift.
>
> **Folded into**: the Issue mapping table above.

### OQ-8 — ✅ RESOLVED — Team-photo caption is hover-only language

The mock's caption reads *"Hover a name to find them — or hover the photo."* — which
is wrong for touch and keyboard users, both of which FR-025/FR-028 require. Raising
rather than silently rewriting, per your instruction. Suggested neutral replacement:
*"Choose a name to find them in the photo."* Approve or supply your own.

> **Resolution.** The suggested replacement is approved: **"Choose a name to find them
> in the photo."** — verbatim. **Folded into**: FR-024.
