# Feature Specification: Visual Redesign (Graphite)

**Feature Branch**: `007-visual-redesign`

**Created**: 2026-06-18

**Status**: Draft

**Input**: User description: A visual redesign of the Serenify web app (`apps/web/`) — a
re-skin onto the deepened **"Graphite"** values of the existing semantic token system, a
typography refresh (Outfit display + Inter body, retiring DM Serif Display), a small set of
targeted behaviour changes, and two bespoke animated components (the OTP verification merge and
the breathing-orb bloom). It is **not** a behavioural rewrite: every existing screen, route, user
flow, form-validation rule, role gate, failure/empty/permission/loading state, WebSocket/API
behaviour, and the *meaning* of all copy is preserved unless this spec explicitly changes it.
Constitution Amendment 4 (v1.4.0) already ratified the Graphite palette values, the Outfit/Inter
typefaces, and two contrast-driven rules; this feature implements them.

> **House-style note**: per the convention established in
> `specs/003-employee-dashboard-shell/spec.md` and continued through
> `specs/006-calibration-capture-quality/spec.md`, this spec references binding architectural
> contracts by name — **Constitution Principle V** (Calm-First Design Language, palette + voice +
> no-glassmorphism + elevation), **Principle VI** (Responsive & Accessible by Default: 360px,
> ≥44px touch targets, both modes equal, `prefers-reduced-motion`), and **Principle VIII**
> (Spec-Driven Workflow: append-only `docs/DECISIONS.md`, `docs/CHANGELOG.md` for any deviation).
> These are binding rules, not incidental choices, so they appear here as requirements. The two
> items deliberately left open — the **font-size token naming mechanism** and the exact **scrim
> token treatment** — are marked `[PLAN-DECISION]` and deferred to `/speckit-plan`; they are not
> unresolved ambiguities, they are decisions intentionally made later (the mechanism after
> auditing how Tailwind v4's built-in `--text-*` scale migrates existing call sites; the scrim
> after reading the dialog/sheet/notification overlay code). The locked values (palette hexes,
> the eight type-scale px sizes, the two new tokens) are **not** deferred and appear as
> requirements.
>
> **Numbering note**: FR-IDs are spec-local (restart at FR-001 per feature). Where this spec means
> the colour/voice/finish rule, it says "Constitution Principle V"; where it means the
> responsive/accessibility rule, "Constitution Principle VI".

## User Scenarios & Testing *(mandatory)*

### User Story 1 - The whole app wears Graphite, and nothing in it is lost (Priority: P1)

A returning employee, team lead, or admin opens any screen they already use — login, dashboard,
account, the calibration flow — and finds it visually refreshed into the deeper Graphite palette
and the new Outfit/Inter type, yet behaving exactly as before: every route still resolves, every
form still validates the same way, every role still sees the same things, and every failure /
empty / permission / loading state still appears when it did. Headings are set in Outfit, body in
Inter, the wordmark now reads a lowercase `serenify` with no dot, and filled meadow/foggy buttons
carry a near-white label (light) instead of dark ink.

**Why this priority**: This is the feature's core deliverable and its MVP. Swapping the ~9 `@theme`
token values auto-propagates Graphite to every token-driven surface (including all `/10 /15 /50`
opacity variants), so the foundation slice alone re-skins the entire app. It is also where the
single largest risk lives: a redesign that silently drops a screen, a state, a validation rule, or
a piece of copy meaning is a regression, not a redesign. Pairing "wears Graphite" with "nothing is
lost" in one P1 story makes the no-silent-removal guarantee co-equal with the re-skin itself.

**Independent Test**: With only the foundation in place (Graphite token values, the two new tokens,
the Outfit/Inter wiring, the filled-accent button foreground fix, the lowercase wordmark in all
three locations), load every in-scope surface in both light and dark mode and confirm: (a) the
palette, fonts, and wordmark are the new ones; (b) every screen, route, role view, and
failure/empty/permission/loading state enumerated in the **Preserved-States Checklist** below still
renders and functions; (c) nothing outside the **Intended Replacements** list has been removed or
changed in meaning.

**Acceptance Scenarios**:

1. **Given** the Graphite token values are set in the theme layer, **When** any token-driven
   surface renders, **Then** it shows the deepened Graphite colours (and all opacity-variant tints
   derived from them) in both light and dark mode, with no per-component colour literal left
   pointing at an old value.
2. **Given** the typography is wired, **When** a heading, card title, wordmark, or large numeral
   renders, **Then** it is set in Outfit, and **When** body text, a button label, a form label, or
   chart text renders, **Then** it is set in Inter — Outfit never appears on body/buttons/labels/
   chart text, and DM Serif Display appears nowhere.
3. **Given** the wordmark, **When** it renders in the header, the auth layout, and the onboarding
   layout, **Then** it reads a lowercase `serenify` set in Outfit with **no** meadow dot, in all
   three locations.
4. **Given** a filled meadow or foggy action button, **When** it renders, **Then** its label is the
   `--color-on-accent` near-white token in light mode and the `--color-bg` token in dark mode —
   never dark ink — while soft accent-tint surfaces keep ink-token text.
5. **Given** the full Preserved-States Checklist, **When** each listed screen, role view, and
   failure/empty/permission/loading state is exercised after the redesign, **Then** every one still
   exists and behaves as it did before, and no route, validation rule, or copy meaning has changed.

---

### User Story 2 - Every colour pairing is legible in both modes (Priority: P1)

A user with ordinary eyesight, on either a light or dark screen, can read every label, link,
notice, and button in the redesigned app without strain. The deliberate contrast fixes that
Amendment 4 exists for are all applied: deepened accent fills carry the near-white / bg-token
foreground; small meadow-coloured text on light backgrounds uses the deepened `--color-meadow-text`
token instead of the too-light accent; error and attention notices read as **foggy** soft tints
(never amber); the amber stress signal appears only as a soft-tint notice or a graphic hue (never a
solid amber fill with ink); and modal scrims are a Graphite ink-derived treatment, not raw black.

**Why this priority**: Constitution Amendment 4 was ratified specifically because the deepened
accents fail WCAG AA with the old ink-on-accent treatment (ink on foggy = 2.92:1) and because small
meadow text on the light page was 4.22:1 (fail). Legibility is a binding constitutional requirement
(Principle V's "every documented pairing meets WCAG AA" + Principle VI's "both modes equal
priority"), not a polish item. A redesign that looks deeper but reads worse has failed its own
reason for existing.

**Independent Test**: For every documented colour pairing, in **both** light and dark mode, verify
the contrast ratio meets WCAG AA (≥4.5:1 for normal text, ≥3.0:1 for large text and non-text/icon
contrast). Specifically verify: filled CTA foreground on meadow and on foggy; foggy soft-tint
notice text; amber soft-tint notice text; small meadow-as-text at every migrated call site; and the
scrim against the surfaces it covers.

**Acceptance Scenarios**:

1. **Given** a filled meadow or foggy CTA, **When** its foreground is measured, **Then** light-mode
   `--color-on-accent` clears AA on both fills and dark-mode `--color-bg` foreground clears AA on
   both fills; the old ink-on-accent treatment appears nowhere.
2. **Given** an error or attention state, **When** it renders, **Then** it is a **foggy** soft-tint
   notice (tint background with ink/text-token foreground and a foggy icon) in both modes — never
   amber, and never a sharp red.
3. **Given** the amber stress signal, **When** it renders, **Then** it appears only as a soft-tint
   notice (light tint with deep amber-family text; dark tint with light amber-family text) or as a
   graphic/indicator hue — a solid amber fill with dark ink text appears nowhere.
4. **Given** small meadow-coloured text on a light background (auth-form links, the
   password-requirement "met" text, the account baseline "has-anchor" pill), **When** it renders,
   **Then** it uses the deepened `--color-meadow-text` token and clears AA; meadow used as an
   icon/graphic colour (countdown ring, success check, green-room check, chat-pill icon) is
   unchanged and still clears the non-text contrast bar.
5. **Given** a modal, sheet, or notification scrim, **When** it renders over content, **Then** it is
   a Graphite ink-derived scrim that works in both modes — raw `black/80`, `black/50` scrims appear
   nowhere.

---

### User Story 3 - OTP verification feels like a calm handoff, not a form (Priority: P2)

At the auth → onboarding handoff, the user enters a six-digit verification code into six separate
single-digit boxes that auto-advance as they type, accept a pasted code into all six at once, and
support backspace-to-previous. When the code is correct, the six boxes resolve into a single calm
"Verified" pill that lifts toward onboarding; when it is wrong, the row gives a gentle foggy sway,
shows a calm foggy notice, clears, and returns focus to the first box — never a sharp red shake.

**Why this priority**: The OTP component is bespoke new interaction work (not a re-skin of an
existing surface) and is the emotional first impression of the post-signup journey. It is P2 rather
than P1 because the foundation (US1) and legibility (US2) must be frozen first, but it is the
single most distinctive new build in this feature and has an approved mock as its source of truth.

**Independent Test**: Drive the OTP component through empty, partial, complete, wrong-code, and
success states. On success, confirm the meadow halo sweep, the boxes merging edge-to-edge into one
pill as their separators melt, the "Verified" check resolving, and the lift — matching the approved
mock — and confirm the reduced-motion path shows the verified pill directly with no sweep/merge/
lift. On a wrong code, confirm the foggy sway (not red, not a sharp shake), the calm foggy notice,
the cleared digits, and focus back on box 1 — and confirm the reduced-motion path skips the sway but
still shows the notice and clears.

**Acceptance Scenarios**:

1. **Given** the six-box input, **When** the user types digits, **Then** focus auto-advances on
   entry, backspace moves to the previous box, a pasted code fills all six, the boxes use a numeric
   input mode, each box is a ≥44px touch target, and the boxes shrink and may wrap at 360px.
2. **Given** a correct code with motion allowed, **When** it is accepted, **Then** a meadow halo
   sweeps box 1→6 staggered, the six boxes slide together edge-to-edge centred while their
   separators (borders + gaps) melt and the boxes fill meadow with rounded ends so the row *becomes*
   one pill (no separate pill fading in over the top), a "Verified" check resolves on it, and the
   pill lifts toward onboarding — at a calm ~3s pacing weighted so the merge reads clearly.
3. **Given** a correct code with `prefers-reduced-motion`, **When** it is accepted, **Then** the
   sweep and merge are skipped, the verified pill is shown directly, and there is no lift.
4. **Given** a wrong code with motion allowed, **When** it is submitted, **Then** the row gives a
   gentle foggy sway (low amplitude, ~0.9s, ease-in-out — never a sharp red shake), a foggy
   soft-tint notice reading "That code didn't match — give it another go." appears, the digits
   clear, and focus returns to box 1.
5. **Given** a wrong code with `prefers-reduced-motion`, **When** it is submitted, **Then** the sway
   is skipped but the foggy notice still appears and the digits still clear; the error treatment is
   never red.

---

### User Story 4 - The breathing orb blooms instead of frosting (Priority: P2)

During calibration capture, the user sees a softened webcam preview with a calm breathing orb
overlaid — now rendered as a clean layered meadow bloom (concentric translucent discs that scale
with the ~8s breathe cycle) instead of the old frosted-glass treatment, with the "Breathe in /
Breathe out" label centred on it. Portrait face-frame brackets track the user's face — meadow when
tracking is good, foggy when attention is needed — a progress bar hugs the preview, and **all**
status text lives in the card below the preview, never on the raw video.

**Why this priority**: The orb bloom is the second bespoke build and directly discharges the
constitutional **no-glassmorphism** rule (Principle V) by removing the `backdrop-blur` frost. Like
the OTP component it depends on the frozen foundation and has an approved mock as its source of
truth, so it is P2; but it is a deliberate, visible improvement, not a mechanical recolour.

**Independent Test**: Render the calibration capture screen and confirm: the orb is a layered
radial bloom with **no** `backdrop-blur` / glassmorphism; the composition is unchanged except for
recolour (softened webcam preview + orb overlay + portrait face brackets); the brackets are
meadow when tracking is good and foggy when attention is needed; the only text on the raw video is
the centred "Breathe in / Breathe out" label; progress is a bar hugging the preview (not a ring
around the orb); and every other status string ("Capturing your baseline", the insufficient-face /
lost-face attention copy, progress) lives in the card below. Confirm the reduced-motion path: the
orb does not pulse (static bloom), the label is static, but the progress bar still advances.

**Acceptance Scenarios**:

1. **Given** the calibration capture screen, **When** the orb renders, **Then** it is a clean
   layered meadow bloom (radial-gradient / stepped-opacity discs) that scales with the ~8s
   breathe-in/out cycle, with **no** `backdrop-blur` and no glassmorphism anywhere on the surface.
2. **Given** the orb composition, **When** capture is active, **Then** the softened webcam preview,
   the orb overlay, and the portrait face-frame brackets around the tracked face all remain — only
   recoloured to Graphite — and the brackets are meadow when tracking is good and foggy when
   attention is needed.
3. **Given** capture progress, **When** it advances, **Then** it is shown as a bar hugging the
   preview (directly above or below it), **not** as a ring around the orb.
4. **Given** any status text during capture, **When** it renders, **Then** the only text on the raw
   video is the centred "Breathe in / Breathe out" label, and all other status copy ("Capturing
   your baseline", the insufficient-face / lost-face attention copy, progress) appears in the card
   below the preview.
5. **Given** `prefers-reduced-motion`, **When** the capture screen renders, **Then** the orb is a
   static bloom (no pulse) and the label is static, but the progress bar still advances as
   functional feedback.

---

### User Story 5 - Correct and calm on a phone, and never against the user's motion setting (Priority: P2)

A user on a 360px-wide phone, or a user who has asked their device to reduce motion, gets a layout
that holds together and animations that respect their choice across every redesigned surface: the
OTP boxes shrink and wrap, the dashboard two-column grid stacks, the calibration preview holds its
aspect ratio in-viewport, touch targets stay ≥44px, and every animation (OTP merge, orb breathing,
and any transition) is either subtle or skipped under `prefers-reduced-motion`.

**Why this priority**: Constitution Principle VI makes responsiveness and reduced-motion mandatory
and equal-priority with the visual work, in both modes. It is P2 because it is verified per-surface
after the surfaces exist, but it is a binding gate on done-ness, not an optional polish pass.

**Independent Test**: Check each in-scope surface at phone (360px), tablet, and desktop widths in
both modes, and with `prefers-reduced-motion` on and off, confirming layout integrity, ≥44px touch
targets on touch viewports, and that every animation honours the reduced-motion setting via the
repo's `useMediaQuery` hook (not framer's `useReducedMotion`).

**Acceptance Scenarios**:

1. **Given** a 360px viewport, **When** each surface renders, **Then** it is correct and usable —
   OTP boxes shrink/wrap, the dashboard two-column grid stacks, and the calibration preview holds
   16:9 in-viewport — scaling cleanly up to desktop.
2. **Given** a touch-capable viewport, **When** interactive controls render, **Then** every touch
   target is ≥44×44px.
3. **Given** `prefers-reduced-motion`, **When** any animated surface renders, **Then** every
   animation (OTP merge, orb breathing, and any transition) is skipped or reduced to a non-ambient
   minimum, honoured through the repo's `useMediaQuery` hook.
4. **Given** either light or dark mode, **When** any surface renders at any supported width,
   **Then** it is designed and legible in that mode — neither mode is treated as secondary.

---

### Edge Cases

- **OTP at 360px**: the six boxes must shrink and may wrap to keep ≥44px touch targets; the merge
  animation must still resolve into a single legible pill at that width.
- **OTP paste of a too-short / too-long / non-numeric string**: the existing validation behaviour is
  preserved (the OTP component changes presentation and animation, not the validation rule or its
  copy meaning).
- **OTP wrong code under reduced motion**: the sway is skipped but the foggy notice and the
  digit-clear/refocus still happen — the user is never left without feedback.
- **Orb under reduced motion**: ambient breathing motion stops, but the progress bar (functional
  feedback) keeps advancing — reduced motion silences ambience, it does not remove function.
- **Face brackets state flip mid-capture**: brackets recolour meadow↔foggy as tracking quality
  changes; this is a recolour of the existing tracking-state signal, not a new state.
- **Meadow used as a graphic vs as small text**: the same role token resolves to two treatments —
  small text migrates to `--color-meadow-text` (AA on light bg), while icons/graphics/large text
  keep regular `--color-meadow` (passes the 3.0 non-text bar). A migration must not over-reach and
  recolour the graphic uses.
- **An amber error anywhere**: any pre-existing amber error/attention notice must become **foggy**;
  amber survives only as the stress signal (soft-tint notice or graphic hue). Errors are never
  amber and never sharp red.
- **`@theme inline` alias layer**: changing a Graphite token must propagate through the shadcn alias
  layer without editing the alias itself; an alias must never be pointed at a colour literal, and
  `--color-muted` must stay out of the `@theme inline` block.
- **A surface that appears to need an out-of-scope change** (application logic, routing, data model,
  Supabase schema/policy, ML pipeline, API contract, auth logic, or a new dependency beyond
  self-hosted fonts) to be restyled: implementation MUST **stop and report** rather than make the
  out-of-scope change.

## Requirements *(mandatory)*

### Functional Requirements — Scope guardrails & anti-silent-removal

- **FR-001**: The redesign MUST **preserve** every existing screen, route, user flow, form-
  validation rule, role gate (employee / team-lead / admin), failure / empty / permission / loading
  state, WebSocket/API behaviour, and the *meaning* of all copy. The work is recolour + re-type +
  the explicitly listed targeted changes — never removal of behaviour.
- **FR-002**: The **only** elements deliberately removed or swapped (the **Intended Replacements**)
  are: (1) the frosted-glass / `backdrop-blur` treatment on the breathing orb → a clean layered
  meadow bloom; (2) `DM Serif Display` → `Outfit` for display/headings; (3) ink-on-accent text on
  filled meadow/foggy buttons → near-white (light) / bg-token (dark); (4) the capital "Serenify" +
  meadow-dot wordmark → lowercase `serenify`, no dot; (5) meadow used as *small text* on light
  backgrounds → the deepened `--color-meadow-text` token; (6) amber auth notices and any amber
  error states → foggy (errors are foggy, never amber). Removing or changing the meaning of any
  element, state, or copy string **not** on this list is a spec violation.
- **FR-003**: Each implementation slice MUST report, in its summary, anything it removed or replaced
  and why (the anti-silent-removal rule). A removal not traceable to FR-002 is a defect to be
  reverted.
- **FR-004**: The following are **out of scope** and MUST NOT be touched: application logic, routing
  logic, data models, Supabase schema/policies, the ML pipeline, API contracts, and auth logic. No
  new runtime dependency may be added beyond the self-hosted fonts. If implementation appears to
  require any out-of-scope change, the implementer MUST **stop and report** rather than proceed.

### Functional Requirements — Graphite tokens & palette

- **FR-005**: The semantic role token names MUST be **unchanged** (`--color-bg`, `--color-surface`,
  `--color-ink`/`--color-text`, `--color-muted`, `--color-meadow`, `--color-foggy`, `--color-amber`,
  `--color-crimson`, `--color-border`); only their **values** change to the Graphite light/dark
  values ratified in Constitution Principle V (Amendment 4). The real tokens live in the Tailwind v4
  `@theme` layer.
- **FR-006**: Swapping the ~9 `@theme` token values MUST **auto-propagate** to every token-driven
  surface, including all `/10 /15 /50` opacity variants. No surface may keep a per-component colour
  literal that pins an old value; any such literal is migrated to the token.
- **FR-007**: The single `@theme inline` (shadcn alias) layer MUST be driven **only** by changing the
  underlying Graphite tokens. The alias values MUST NOT be edited directly, and no `@theme inline`
  token may be pointed at a colour literal. `--color-muted` MUST remain **outside** the `@theme
  inline` block.
- **FR-008**: A new token `--color-on-accent` (value `#F8F9FA` in light) MUST be introduced as the
  **single** foreground for filled meadow/foggy action surfaces in light mode. In dark mode the
  filled-accent foreground MUST be the `--color-bg` token (`#101214`), not `--color-on-accent`.
  Defining this as one token (not a per-component literal) is required to prevent drift below AA.
- **FR-009**: A new token `--color-meadow-text` (value `#346A56` light / `#63B292` dark, i.e. equal
  to regular meadow on dark) MUST be introduced for **small meadow-coloured text** on light
  backgrounds. Regular `--color-meadow` continues to be used for fills, icons, graphics, and large
  text.

### Functional Requirements — Typography

- **FR-010**: `Outfit` MUST be the display/heading typeface — used for display text, page and
  section headings, card titles, the wordmark, and large numerals — and MUST NOT be used for body,
  buttons, labels, or chart text. `Inter` MUST be the body/UI typeface. Both MUST be **self-hosted**
  under the SIL Open Font License and wired in the app layout. `DM Serif Display` MUST be retired
  entirely (no remaining reference).
- **FR-011**: The redesign MUST introduce **font-size tokens** (none exist today; every size is
  currently a per-component utility) with a **17px base body** size and the locked role→size scale:
  caption/meta 13px, small/secondary 14px, body 17px, notice/failure-error copy 18px, card title
  20px, section heading 24px, page heading 30px, display/large-numeral 38px. Body line-height ≈1.5;
  headings tighter (≈1.2).
- **FR-012**: The **mechanism** for the type-scale tokens — either overriding Tailwind v4's built-in
  `--text-*` scale (auto-migrating existing `text-sm/base/lg` utilities, with an audit that the
  resulting per-component sizes stay sane) **or** introducing new semantic token names and
  converting call sites — is `[PLAN-DECISION]`, deferred to `/speckit-plan`. The **px values in
  FR-011 are locked regardless of mechanism.** The chosen scale and mechanism MUST be recorded in
  `docs/DECISIONS.md`.

### Functional Requirements — Wordmark

- **FR-013**: The wordmark MUST read a lowercase `serenify` with **no** dot, set in Outfit, in all
  three current locations (the header, the auth layout, and the onboarding layout). The prior
  capital "Serenify" + meadow-dot wordmark MUST appear nowhere.

### Functional Requirements — Filled-accent foreground & contrast

- **FR-014**: Filled meadow/foggy action surfaces (primary and attention CTAs) MUST take the
  `--color-on-accent` foreground in light mode and the `--color-bg` token foreground in dark mode,
  applied at the shared button primitive so the treatment cannot drift. The prior ink-on-accent
  treatment (which failed AA — ink on foggy = 2.92:1) MUST be removed. Soft accent-tint surfaces
  (e.g. a `foggy/10` banner) MUST keep ink-token text.
- **FR-015**: Error and attention states MUST use the **foggy** role as a soft-tint notice — a foggy
  tint background with ink/text-token foreground and a foggy icon — in both modes. Errors MUST NOT
  use amber, and MUST NOT use a sharp red. Any pre-existing amber auth notice or amber error state
  MUST be migrated to foggy.
- **FR-016**: The **amber** role MUST appear only as (a) a soft-tint stress-signal notice (light:
  tint with deep amber-family text; dark: tint with light amber-family text) or (b) a graphic/
  indicator hue. A solid amber fill with dark ink text is **forbidden** (fails AA, reads muddy).
- **FR-017**: Small meadow-coloured text on light backgrounds MUST be migrated to
  `--color-meadow-text`. The migration call sites are: all auth-form links (login, signup,
  forgot-password, reset-password), the password-requirement "met" text, and the account baseline
  "has-anchor" pill (currently a meadow-tint pill whose 3.84:1 text fails — fix the text colour).
  Meadow used as an **icon/graphic** colour (countdown ring, success check, green-room check,
  chat-pill icon) MUST be left unchanged (it already passes the 3.0 non-text bar).
- **FR-018**: Every documented colour pairing MUST meet **WCAG AA in both light and dark mode**:
  ≥4.5:1 for normal text, ≥3.0:1 for large text and non-text/icon contrast. This is the binding
  acceptance bar for the redesign (Constitution Principle V + VI).

### Functional Requirements — Visual finish (Principle V)

- **FR-019**: **No glassmorphism / `backdrop-blur` may remain anywhere** in the app after the
  redesign — not in cards, modals, navs, overlays, or the breathing orb.
- **FR-020**: Elevation MUST use 0.5px borders plus the **single** soft shadow
  (`0 1px 2px rgba(0,0,0,0.04)`, with a dark-mode-appropriate value confirmed); this `--shadow-soft`
  is the only elevation shadow. Corner radii stay 8–16px (pills excepted). One-off geometry already
  in the layouts (per-call button-height overrides, `rounded-[28px]`, `aspect-[3/4]`) MUST be
  preserved as-is.
- **FR-021**: Modal/sheet/notification **scrims** MUST be a Graphite ink-derived treatment that
  works in both modes; the raw `black/80` (dialog, sheet) and `black/50` (notification) scrims MUST
  be replaced. The exact scrim token/treatment is `[PLAN-DECISION]`, deferred to `/speckit-plan`
  (decided after reading the overlay code) and recorded in `docs/DECISIONS.md`; the constraint is
  ink-derived, not raw black.
- **FR-022**: Surface-specific non-auto-migrating treatments MUST be recoloured to Graphite, not
  left or removed: the framing-overlay spotlight + meadow glow → Graphite state colours; neutral
  `border-white/70` framing brackets → state-coloured meadow/foggy; the countdown `text-white` +
  soft drop-shadow on-video overlay → kept (the established on-video pattern) with legibility
  verified.

### Functional Requirements — Bespoke component: OTP verification (auth → onboarding)

- **FR-023**: The OTP input MUST be six separate single-digit boxes (Outfit numerals) with numeric
  input mode, auto-advance on entry, backspace-to-previous, paste-fills-all-six, ≥44px touch
  targets, and boxes that shrink and may wrap at 360px. The OTP component changes presentation and
  animation only — it MUST NOT change the underlying code-validation rule or the meaning of its
  copy.
- **FR-024**: On a **correct** code (motion allowed), a meadow halo MUST sweep box 1→6 (staggered),
  then the six boxes MUST slide together edge-to-edge centred while their separators (borders + gaps)
  **melt** — boxes fill meadow and the ends round — so the row *becomes* one pill (no separate pill
  fading in over the top); a "Verified" check resolves on it; the pill then lifts toward onboarding.
  Pacing is calm (~3s total), weighted so the merge-into-pill reads clearly.
- **FR-025**: On a **wrong** code (motion allowed), the row MUST give a gentle **foggy** sway (low
  amplitude, ~0.9s, ease-in-out — never a sharp red shake), show a foggy soft-tint notice reading
  "That code didn't match — give it another go.", then clear the digits and return focus to box 1.
  The wrong-code treatment MUST never be red.
- **FR-026**: Under `prefers-reduced-motion`, the OTP MUST: on success, skip the sweep and merge,
  show the verified pill directly, and not lift; on a wrong code, skip the sway but still show the
  notice and clear the digits. Reduced motion MUST be detected via the repo's `useMediaQuery` hook,
  **not** framer's `useReducedMotion`.
- **FR-027**: The OTP component MUST match its approved mock (`serenify-007-otp-mock.html`) as the
  visual source of truth.

### Functional Requirements — Bespoke component: breathing-orb bloom (calibration)

- **FR-028**: The breathing orb MUST be rendered as a **clean layered bloom** — concentric
  translucent meadow discs (radial-gradient / stepped-opacity discs, **no** `backdrop-blur`, no
  glassmorphism) that scale with the ~8s breathe-in/out cycle — with the existing "Breathe in /
  Breathe out" label centred on the orb. This breathe label is the **only** text permitted on the
  raw video.
- **FR-029**: The orb composition MUST be **unchanged except for recolour**: the softened (blurred)
  webcam preview, the orb overlaid on it, and the **portrait face-frame brackets** drawn around the
  tracked face (matching the current portrait framing, not the preview's four corners). The brackets
  MUST be state-coloured — meadow when tracking is good, foggy when attention is needed — with a
  subtle meadow framing glow recoloured to Graphite.
- **FR-030**: Capture progress MUST be shown as a **bar hugging the preview** (directly above or
  below it), **not** as a ring around the orb.
- **FR-031**: All status text MUST live in the **card below the preview** ("Capturing your
  baseline", the insufficient-face / lost-face attention copy, progress) — never on the raw video
  (the breathe label of FR-028 excepted).
- **FR-032**: Under `prefers-reduced-motion` (detected via `useMediaQuery`), the orb MUST NOT pulse
  (static bloom) and the label MUST be static, but the **progress bar MUST still advance**
  (functional feedback, not ambient motion).
- **FR-033**: The orb bloom MUST match its approved mock (`serenify-007-orb-mock.html`) as the
  visual source of truth; the new-pattern reference for the CTA foreground, role notices, and the
  meadow-link fix is `serenify-007-patterns-swatch.html`.

### Functional Requirements — Surfaces in scope

- **FR-034**: The following surfaces MUST be recoloured + re-typed against their already-approved
  layouts, with the folded-in fixes noted: **Auth** (login, signup, forgot-password, reset-password,
  plus the new OTP flow; meadow links → `--color-meadow-text`; any amber notices → foggy);
  **Onboarding**; **Home dashboard** (header shell, calibration banner one-row desktop layout,
  greeting, two-column card grid, chat pill); **Account** (baseline/recalibrate section incl. the
  has-anchor pill text fix, plus the dark-mode account-menu dropdown contrast fix folded in);
  **Full calibration flow** (intro, green room, get-ready countdown, recording, stop-confirm,
  success, failure incl. the `insufficient-face` reason, the three camera-access states, the
  backend-down modal — with the orb bloom per FR-028…FR-033); **Shared primitives** (buttons,
  dialogs, sheets, dropdown, avatar — with the scrim re-tokenisation per FR-021).

### Functional Requirements — Documentation, deliverables & cleanup

- **FR-035**: `docs/DECISIONS.md` MUST be updated (append-only) with: the type scale + naming
  mechanism, the `--color-on-accent` token, the `--color-meadow-text` token, the errors=foggy
  confirmation, and the scrim token treatment. `docs/CHANGELOG.md` MUST note any deviation from this
  spec. A `smoke-tests.md` MUST be authored and signed off by Mohamed.
- **FR-036**: The throwaway preview files `serenify-redesign-preview.html` and
  `serenify-font-preview-d5.html` MUST be deleted as cleanup (if present in the working tree).

### Key Entities

- **Graphite token**: a semantic role colour whose **name** is unchanged from the prior system but
  whose **value** is the deepened Graphite light/dark value; lives in the real `@theme` layer and
  auto-propagates to every token-driven surface and opacity variant.
- **`--color-on-accent`**: the single near-white (`#F8F9FA`) foreground token for filled
  meadow/foggy surfaces in light mode (dark mode uses the `--color-bg` token); exists to keep filled
  CTAs at AA without per-component drift.
- **`--color-meadow-text`**: the deepened meadow token (`#346A56` light / `#63B292` dark) for small
  meadow-coloured text on light backgrounds; distinct from regular `--color-meadow`, which stays for
  fills/icons/graphics/large text.
- **Font-size token / type scale**: the locked role→px scale (13/14/17/18/20/24/30/38) with 17px
  base body; new to this feature (no size tokens exist today). Naming mechanism deferred to plan.
- **Wordmark**: the lowercase `serenify` (no dot) set in Outfit, in the header, auth layout, and
  onboarding layout.
- **OTP merge component**: the bespoke six-box → single-pill verification interaction, with the
  meadow success merge/lift, the foggy wrong-code sway, and the reduced-motion fallbacks; source of
  truth is `serenify-007-otp-mock.html`.
- **Breathing-orb bloom**: the bespoke layered-disc meadow bloom replacing the frosted orb, with
  state-coloured portrait brackets, the preview-hugging progress bar, and the card-below status
  text; source of truth is `serenify-007-orb-mock.html`.
- **Scrim**: the Graphite ink-derived overlay treatment replacing raw `black/80` and `black/50`
  scrims on dialogs/sheets/notifications; exact token deferred to plan.
- **Preserved-States Checklist**: the enumerated set of screens, role views, and failure/empty/
  permission/loading states (below) that MUST all survive the redesign unchanged in behaviour.

#### Preserved-States Checklist (every item MUST still exist and function after the redesign)

- **OTP**: empty, partial, complete, wrong-code, success.
- **Calibration**: intro, green-room, countdown, recording, stop-confirm, success, failure-generic,
  failure `insufficient-face`, camera-access (prompt / granted / denied — three states), and the
  backend-down modal.
- **Calibration banner**: present (not calibrated) and dismissed.
- **Account baseline section**: has-anchor vs no-anchor.
- **Dashboard cards**: populated vs empty (e.g. no recent chats).
- **Roles**: all three role views (employee / team-lead / admin) where they differ.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Every documented colour pairing passes **WCAG AA in both light and dark mode** (≥4.5:1
  normal text, ≥3.0:1 large text and non-text/icon) — verified for the filled-CTA foregrounds on
  meadow and foggy, the foggy notice text, the amber soft-tint notice text, every migrated
  meadow-as-text call site, and the scrim — in 100% of the documented pairings.
- **SC-002**: Every state in the **Preserved-States Checklist** is present and functional after the
  redesign, and nothing outside the FR-002 Intended Replacements list has been removed or changed in
  meaning — verified by walking the full checklist in both modes and across the three role views.
- **SC-003**: **No `backdrop-blur` / glassmorphism remains anywhere** in the app (cards, modals,
  navs, overlays, or the orb) — verified to zero occurrences.
- **SC-004**: Every in-scope surface is **correct and usable at 360px** width and scales cleanly to
  desktop (OTP boxes shrink/wrap, the dashboard two-column grid stacks, the calibration preview
  holds 16:9 in-viewport), with all touch targets ≥44×44px on touch viewports.
- **SC-005**: `prefers-reduced-motion` is **honoured on every animation** (OTP merge, orb breathing,
  and any transition), detected via the repo's `useMediaQuery` hook — verified that, with reduced
  motion on, the OTP shows the verified pill directly / skips the sway and the orb is a static bloom,
  while the orb progress bar still advances.
- **SC-006**: The OTP component and the orb bloom **match their approved mocks**
  (`serenify-007-otp-mock.html`, `serenify-007-orb-mock.html`) — verified against the mock as the
  visual source of truth.
- **SC-007**: The wordmark reads a lowercase `serenify` (no dot) in Outfit in **all three** locations
  and `DM Serif Display` appears **nowhere**; Outfit is confined to display/heading/wordmark/
  large-numeral roles and never appears on body/buttons/labels/chart text.
- **SC-008**: Errors and attention states are **foggy** soft-tint notices everywhere (never amber,
  never sharp red), and amber appears only as a soft-tint stress notice or a graphic hue (no solid
  amber-with-ink fill) — verified across the auth notices, the calibration failure states, and any
  attention banner.
- **SC-009**: `docs/DECISIONS.md` is updated with the type scale + naming mechanism,
  `--color-on-accent`, `--color-meadow-text`, the errors=foggy confirmation, and the scrim token;
  `docs/CHANGELOG.md` notes any deviation; and `smoke-tests.md` is authored and signed off by
  Mohamed.

## Assumptions

- **Amendment 4 is the authority for the values.** The Graphite light/dark hexes, the Outfit/Inter
  typefaces, and the two contrast rules (filled-accent foreground; amber soft-tint) are already
  ratified in Constitution Principle V (v1.4.0); this feature *implements* them and does not
  re-litigate them.
- **The approved mocks are the visual source of truth for the two bespoke pieces.**
  `serenify-007-otp-mock.html` and `serenify-007-orb-mock.html` (and the patterns reference
  `serenify-007-patterns-swatch.html`) are approved; the OTP/orb behaviour is also fully specified
  in text here. Claude Code cannot open the mocks from the repo; they may be provided to the
  implementing session as attachments.
- **Token swap auto-propagates most of the palette.** Changing the ~9 `@theme` values is most of the
  recolour and is nearly free; the explicit non-auto-migrating items (scrims, the orb frost removal,
  the framing overlay, the framing brackets, the shadow, the meadow-as-text call sites) are the
  hand-work and are enumerated in the FRs.
- **The font-size token mechanism and the scrim token are deliberate planning decisions, not
  ambiguities.** FR-012 and FR-021 fix the constraints (locked px values; ink-derived scrim) and
  defer only the naming/treatment mechanism to `/speckit-plan`, decided after auditing the relevant
  code — mirroring the `[CALIBRATION-PENDING]` pattern used in feature 006.
- **Reduced motion uses the repo's own hook.** All reduced-motion gating is via the repo's
  `useMediaQuery` hook, not framer's `useReducedMotion`, per the brief.
- **Dev-only environment; no data/contract impact.** No application logic, routing, data model,
  Supabase schema/policy, ML pipeline, API contract, or auth logic is changed; the only new runtime
  dependency permitted is the self-hosted fonts.
- **Three-phase delivery.** Phase 1 (foundation: tokens, the two new tokens, the type scale + 17px
  base, Outfit/Inter wiring, the button foreground fix, the wordmark) is serial and single-agent
  because it touches shared files and must be frozen as the contract; Phase 2 (surfaces + the two
  bespoke pieces) is parallel-safe **only** with frozen contracts and explicit non-overlapping file
  scopes; Phase 3 (integration, responsive/AA verification, smoke tests) is serial. Fan-out helps
  Phase 2 only; the real bottleneck is the smoke-test/debug loop, not raw implementation throughput.
- **Manual smoke testing is performed by Mohamed** per Constitution Principle VII; `smoke-tests.md`
  is authored during `/speckit-tasks` and signed off after `/speckit-implement`, covering the AA
  checks (both modes), the 360px responsive checks, the reduced-motion checks, and the OTP/orb
  mock-fidelity checks.

## Out of Scope *(explicit exclusions)*

The following are explicitly excluded from this feature:

- **Any behavioural rewrite.** No change to application logic, routing logic, data models, Supabase
  schema/policies, the ML pipeline, API contracts, or auth logic. This is a re-skin + re-type + the
  listed targeted changes + the two bespoke components only.
- **New runtime dependencies** beyond the self-hosted Outfit/Inter fonts.
- **Removing or altering the meaning of any screen, route, state, validation rule, role gate, or
  copy string** not on the FR-002 Intended Replacements list.
- **Recolouring meadow graphic/icon uses** (countdown ring, success check, green-room check,
  chat-pill icon) — only small *meadow text* migrates to `--color-meadow-text`; the graphic uses
  stay regular meadow.
- **Editing the `@theme inline` (shadcn alias) layer directly** or pointing any alias at a colour
  literal, and moving `--color-muted` into `@theme inline`.
- **Changing the locked type-scale px values, the Graphite hexes, or the two contrast rules** —
  these are ratified; only the type-scale *naming mechanism* and the *scrim token treatment* are
  deferred to planning.
- **One-off geometry redesign** (per-call button-height overrides, `rounded-[28px]`, `aspect-[3/4]`)
  — preserved as-is, not re-derived.

## Dependencies

- **Constitution Principle V (Calm-First Design Language)** — the Graphite palette + role system,
  the filled-accent and amber-soft-tint contrast rules, the no-glassmorphism rule, the elevation
  (0.5px border + single soft shadow) rule, the radii rule, the Outfit/Inter typography, the
  lowercase wordmark, and the calm/non-alarmist voice are all ratified here (Amendment 4) and are
  what this feature implements.
- **Constitution Principle VI (Responsive & Accessible by Default)** — 360px minimum, ≥44px touch
  targets, both modes equal-priority and designed in tandem, and `prefers-reduced-motion` respected
  on every animation are binding gates on done-ness (US5).
- **Constitution Principle VIII (Spec-Driven Workflow)** — SpecKit order (spec → plan → tasks →
  implement); append-only `docs/DECISIONS.md`; `docs/CHANGELOG.md` for any deviation; the Tailwind
  v4 `@theme` rule (real tokens never via `@theme inline`).
- **Feature 005 (calibration capture flow)** — the intro / green-room / countdown / recording /
  stop-confirm / success / failure-screen + cause-chip flow and the camera-access states that the
  calibration re-skin recolours without behavioural change; the orb bloom replaces only the frosted
  treatment within this flow.
- **Feature 006 (calibration capture-quality gate)** — the `insufficient-face` failure reason and
  its calm explanation are among the preserved calibration states that must survive the re-skin.
- **The approved 007 mocks** — `serenify-007-otp-mock.html`, `serenify-007-orb-mock.html`, and
  `serenify-007-patterns-swatch.html` are the visual source of truth for the two bespoke pieces and
  the new patterns.

### Open Decisions Deferred to Planning (NOT spec requirements — for `/speckit-plan`)

These are intentionally-deferred decisions, recorded so the plan resolves them and does not regress:

1. **Font-size token naming mechanism** (FR-012): override Tailwind v4's built-in `--text-*` scale
   (auto-migrating `text-sm/base/lg`, with an audit that resulting per-component sizes stay sane) vs
   introduce new semantic token names and convert call sites. The eight px values are locked; only
   the mechanism is chosen at plan time and recorded in `docs/DECISIONS.md`.
2. **Scrim token treatment** (FR-021): the exact Graphite ink-derived scrim token/value for
   dialogs, sheets, and notifications, decided after reading the overlay code (`dialog.tsx`,
   `sheet.tsx`, `notification.tsx`) and recorded in `docs/DECISIONS.md`. Constraint: ink-derived,
   works in both modes, never raw black.
3. **Phase-2 file-scope partition**: the explicit non-overlapping file-scope tags per surface task
   (auth/OTP, dashboard, calibration, account, dialogs/sheets/scrims, the two bespoke pieces) so
   parallel agents do not collide — derived at `/speckit-plan` / `/speckit-tasks` once the Phase-1
   foundation is frozen as the contract.
