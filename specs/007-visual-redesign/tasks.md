# Tasks: Visual Redesign (Graphite)

**Input**: Design documents from `specs/007-visual-redesign/` — [spec.md](./spec.md),
[plan.md](./plan.md), [research.md](./research.md), [quickstart.md](./quickstart.md).

**Tests**: Vitest/RTL **behaviour** tests are required for the two bespoke components (`OtpPanel`,
`BreathingOrb`) per Constitution Principle VII; recolour-only surfaces are guarded by their existing
component tests; the three Playwright role e2e tests must still pass. Animation/visual fidelity is
**human-verified against the mocks** (SC-006), not unit-tested.

**Organization**: Tasks follow the three phases from plan.md — **Phase 1** (serial foundation =
Foundational), **Phase 2** (P2-A…P2-G surface/bespoke, `[P]` where file scopes are disjoint),
**Phase 3** (serial verification + docs). Each task is **self-contained** (explicit file scope,
exact FR/SC IDs, done-condition) so it can be handed to a fresh implementation session as a
standalone prompt. Implementation is driven by hand-authored phase prompts, **not**
`/speckit-implement`.

## Format: `[ID] [P?] [Story?] Description`

- **[P]**: parallel-safe (different files, no dependency on an incomplete task).
- **[US#]**: dominant user story for traceability (US1 foundation, US2 legibility, US3 OTP, US4 orb,
  US5 responsive/reduced-motion). Foundational + Polish tasks carry no story label.
- Every task names exact file paths, the FR/SC it satisfies, and a done-condition.

## Out-of-scope guardrail (applies to EVERY task)

No application logic, routing, data model, Supabase, ML, API-contract, or auth-logic change; no new
runtime dependency beyond the self-hosted fonts (FR-004). `**/actions.ts`, `anchor/device-memory.ts`,
`anchor/use-anchor-recorder.ts`, `lib/**`, `hooks/**` are **read-only**. Change **real `@theme`
tokens only**; never edit `@theme inline`, never point an alias at a literal, keep `--color-muted`
out of `@theme inline` (FR-007). Reduced motion via the repo's `useMediaQuery` hook, **never**
framer's `useReducedMotion`. Report anything removed/replaced and trace it to FR-002 (FR-003); an
untraceable removal is a defect. If a restyle appears to need an out-of-scope change, **stop and
report**.

---

## Phase 1: Foundation (SERIAL — single agent) 🔒 FROZEN CONTRACT

**Purpose**: Establish the shared token/type/font/button/wordmark interface every Phase-2 task
depends on. Single-agent and serial because these are shared files. **No Phase-2 task may start until
T008 (the Phase-1 exit re-check) passes.** Tasks T001–T005 all edit `apps/web/app/globals.css` and
are sequential edits to that one file.

- [ ] T001 Swap the nine semantic role token **values** to Graphite (names unchanged) in the real
  `@theme` block and the `:root.dark` override of `apps/web/app/globals.css`, per plan.md §1.1
  (light: bg `#EAEBEC`, surface `#F4F5F6`, ink `#1C2023`, muted `#585D61`, meadow `#3E7A63`, foggy
  `#356E88`, amber `#C98637`, crimson `#894A4E`, border `#D7D9DC`; dark: bg `#101214`, surface
  `#181B1E`, ink `#E2E5E8`, muted `#939A9F`, meadow `#63B292`, foggy `#74B6CE`, amber `#E4AE5C`,
  crimson `#C98589`, border `#23272B`). Do **not** edit `@theme inline`. **Satisfies**: FR-005,
  FR-006. **Done when**: every role token holds its Graphite value in both blocks; the `@theme inline`
  alias layer is byte-for-byte unchanged; `--color-muted` is still outside `@theme inline`.

- [ ] T002 Add the three new real `@theme` tokens in `apps/web/app/globals.css`, per plan.md §1.2:
  `--color-on-accent: #F8F9FA` (light; no dark override — dark filled-accent fg uses `--color-bg`);
  `--color-meadow-text: #346A56` (light) with a `:root.dark` override `#63B292`; and
  `--color-scrim: rgba(28,32,35,0.60)` (fixed, **no** dark override — research.md R-2).
  **Satisfies**: FR-008, FR-009, FR-021. **Done when**: `bg-scrim`, `text-on-accent`, and
  `text-meadow-text` utilities resolve; `--color-meadow-text` swaps per mode; `--color-scrim` does
  not swap.

- [ ] T003 Override the three type-scale steps + line-heights and set the 17px base body in
  `apps/web/app/globals.css`, per plan.md §1.3 / research.md R-1 (`--text-xs: 0.8125rem`/13px,
  `--text-base: 1.0625rem`/17px, `--text-4xl: 2.375rem`/38px, with `--text-*--line-height`
  companions: body ≈1.5, headings ≈1.2; add `body { font-size: var(--text-base) }` in `@layer base`).
  Do **not** change the root/`html` font-size; do **not** touch `--text-sm/lg/xl/2xl/3xl` (already
  locked values). **Satisfies**: FR-011, FR-012. **Done when**: `text-xs`=13px, `text-base`=17px,
  `text-4xl`=38px render; untokened body text inherits 17px; the `sm:text-5xl` hero wordmark and
  `text-8xl` countdown one-offs are untouched.

- [ ] T004 Confirm the dark-mode `--shadow-soft` value and refresh the palette comment in
  `apps/web/app/globals.css`, per plan.md §1.7 / research.md R-3.5 (add a `:root.dark`
  `--shadow-soft` with a perceptible alpha, or document border-only dark elevation; rename the
  "Mist & Meadow" comment to "Graphite"). **Satisfies**: FR-020. **Done when**: a single soft shadow
  is the only elevation shadow and reads in both modes; the comment says Graphite.

- [ ] T005 Wire **Outfit** as the display font and retire DM Serif Display in
  `apps/web/app/layout.tsx` (replace the `DM_Serif_Display` import/instance with `Outfit` from
  `next/font/google`, keep `Inter`; keep the `--font-display` / `--font-sans` variable bindings) and
  repoint `--font-display: "Outfit", sans-serif` in `apps/web/app/globals.css`, per plan.md §1.4 /
  research.md R-3.3. No new dependency. **Satisfies**: FR-010. **Done when**: all `font-display`
  sites render Outfit; `DM_Serif`/`"DM Serif Display"` appears in **no** source (stale code comments
  cleaned).

- [ ] T006 Fix the filled-accent foreground at the shared button primitive in
  `apps/web/components/ui/button.tsx`, per plan.md §1.5: `meadow` and `foggy` variants change
  `text-ink` → `text-on-accent` (keep `dark:text-bg`); all other variants/props/names/sizes
  unchanged. **Satisfies**: FR-008, FR-014. **Done when**: filled meadow/foggy buttons render
  near-white (light) / bg-token (dark) foreground; the `buttonVariants` public API
  (`default|destructive|outline|secondary|meadow|foggy|ghost|link`, `size`, `asChild`) is unchanged.

- [ ] T007 Replace the wordmark in its **three** locations — `apps/web/components/header/header.tsx`,
  `apps/web/app/(auth)/layout.tsx`, `apps/web/app/(onboarding)/layout.tsx`: capital `Serenify` +
  meadow-dot `<span>` → lowercase **`serenify`**, dot removed, `font-display` (Outfit) kept; update
  the stale "DM Serif Display wordmark" comment in `(auth)/layout.tsx`. These three files are owned
  entirely by Phase 1. **Satisfies**: FR-013. **Done when**: all three render lowercase `serenify`
  with no dot; capital-`Serenify`-as-wordmark and the dot span appear in none of the three.

- [ ] T008 **Phase-1 exit re-check (GATE)** — verify before unfreezing Phase 2, per plan.md
  "Phase-1 exit": (a) `@theme inline` untouched and `--color-muted` still outside it; (b) AA spot-
  check the filled-CTA foregrounds (meadow + foggy) and `--color-meadow-text` in **both** modes;
  (c) grep confirms DM Serif and the capital-wordmark/dot are gone from the three frozen files;
  (d) `npm run build` (or typecheck) is clean. **Satisfies**: gate for FR-005…FR-014, US1.
  **Done when**: all four checks pass; Phase 2 is cleared to start.

**Checkpoint**: Foundation frozen and verified. The token names+values, the button variant API, the
type-scale token mechanism, the Outfit/Inter wiring, and the lowercase wordmark are now the contract
Phase-2 codes against.

---

## Phase 2: Surfaces + bespoke components (PARALLEL where disjoint)

**Purpose**: Re-skin each surface and build the two bespoke components on **disjoint file scopes**.
Every task below is `[P]` — Phase 1 froze the contract and the plan's Phase-2 table guarantees
non-overlapping files. **Each task recolours/re-types against the already-approved layout and reports
its removals against FR-002 (FR-003).** Token swap auto-propagates most colour; these tasks do the
enumerated hand-work + the two bespoke builds.

> **P2-A ↔ P2-B ordering note**: verified — `OtpPanel`'s props `{email, action, successHref,
> helperText}` **already exist** on the current component (`otp-panel.tsx:24-30`), and both
> consumers already pass them (`signup-form.tsx:86-91` → `successHref="/app"`; `forgot-form.tsx:75-80`
> → `successHref="/reset-password"`). **No consumer-facing prop is new** (`successHref` is **not**
> new), so the redesign is internal and the props are truly frozen — P2-A and P2-B run in parallel on
> disjoint files. **Guard**: if T011's implementer finds a need to change the prop signature, STOP
> and re-sequence T009 to run after T011.

### P2-A — Auth screens (US2)

- [ ] T009 [P] [US2] Recolour/re-type the four auth flows in `apps/web/app/(auth)/login/{page,login-form}.tsx`,
  `apps/web/app/(auth)/signup/{page,signup-form}.tsx`,
  `apps/web/app/(auth)/forgot-password/{page,forgot-form}.tsx`,
  `apps/web/app/(auth)/reset-password/{page,reset-form}.tsx`, and the shared auth UI
  `apps/web/components/ui/auth/{field,password-input,password-requirements}.tsx`. Migrate all
  auth-form meadow links → `--color-meadow-text` and the password-requirement "met" text →
  `--color-meadow-text`; migrate any amber auth notice → **foggy** soft-tint (FR-015). Do **not** edit
  `(auth)/layout.tsx` (Phase 1), `otp-panel.tsx` (P2-B), or any `actions.ts`. The `<OtpPanel …/>` call
  in signup-form/forgot-form keeps its existing props unchanged. **Satisfies**: FR-034 (auth), FR-017,
  FR-015; SC-001, SC-002, SC-008. **Done when**: every auth screen reads Graphite/Outfit-Inter in both
  modes, meadow text uses `--color-meadow-text` (AA), no amber error remains, and existing auth
  component tests + the auth Playwright paths still pass.

### P2-A* — Onboarding (US1)

- [ ] T010 [P] [US1] Recolour/re-type onboarding in
  `apps/web/app/(onboarding)/onboarding/{page,onboarding-form}.tsx`. Do **not** edit
  `(onboarding)/layout.tsx` (Phase 1) or `actions.ts`. **Satisfies**: FR-034 (onboarding); SC-002.
  **Done when**: the onboarding form reads Graphite/Outfit-Inter in both modes and its existing tests
  pass. (Small — may fold into the same agent as T009.)

### P2-B — OTP bespoke component (US3)

- [ ] T011 [P] [US3] Redesign `OtpPanel` into the six-box merge in
  `apps/web/components/ui/auth/otp-panel.tsx` plus new `apps/web/components/ui/auth/otp-*.tsx`
  sub-files (owns the `otp-*` filename namespace under `ui/auth/`). Six single-digit boxes (Outfit
  numerals), numeric inputmode, auto-advance, backspace-to-previous, paste-fills-all-six, ≥44px touch
  targets, shrink/wrap at 360px; on correct code → meadow halo sweep + boxes merge edge-to-edge into
  one "Verified" pill that lifts toward `successHref` (~3s); on wrong code → gentle **foggy** sway
  (~0.9s, never red), foggy soft-tint notice "That code didn't match — give it another go.", clear
  digits, refocus box 1 — **migrating today's amber error notice (`otp-panel.tsx:142`,
  `bg-amber/10`) to foggy**; reduced-motion via `useMediaQuery`. **Props `{email, action,
  successHref, helperText}` are FROZEN** — verification/validation logic + backend behaviour + copy
  meaning unchanged (FR-004). Source of truth: `serenify-007-otp-mock.html` (open from working tree).
  **Satisfies**: FR-023, FR-024, FR-025, FR-026, FR-027, FR-015, FR-033; SC-005, SC-006, SC-004 (wrap),
  SC-008. **Done when**: both flows (signup via `verifySignupOtp`/`/app`, reset via
  `verifyResetOtp`/`/reset-password`) render the same six-box component; the merge/sway/reduced-motion
  match the mock by eye; the props signature is unchanged.

- [ ] T012 [P] [US3] Author Vitest/RTL **behaviour** tests in
  `apps/web/components/ui/auth/otp-panel.test.tsx` (extend if present): reduced-motion branch is
  taken via `useMediaQuery` (no sweep/merge/lift; verified pill shown directly); a wrong code clears
  all six digits and returns focus to box 1; a correct code calls `router.replace(successHref)` for
  the context value (assert with `successHref="/app"` and `successHref="/reset-password"`); paste of a
  6-digit string fills all boxes; sub-6-digit submit is blocked. Assert **behaviour/state, not
  animation visuals**. **Satisfies**: Principle VII for FR-023/FR-025/FR-026. **Done when**: tests
  pass against T011 and fail if the reduced-motion branch, clear/refocus, or `successHref` navigation
  regresses.

### P2-C — Home dashboard (US1/US5)

- [ ] T013 [P] [US1] Recolour/re-type the dashboard in `apps/web/app/(authed)/app/page.tsx`,
  `apps/web/components/home/{welcome-banner,recent-chats-card,todays-checkin-card,things-that-might-help-card}.tsx`,
  `apps/web/components/chat-pill.tsx`, `apps/web/components/role-placeholder/role-placeholder.tsx`
  (team-lead/admin home view), and `apps/web/components/anchor/calibration-banner.tsx` — an anchor-dir
  file **rendered only by the dashboard** (`app/(authed)/app/page.tsx:44`), so owned here, not by P2-E
  (mirrors `baseline-section.tsx`→P2-D). Header-shell one-row calibration-banner desktop layout (present
  vs dismissed states preserved), greeting, two-column card grid that **stacks at 360px**, chat pill;
  preserve populated-vs-empty card states. **Satisfies**: FR-034 (home dashboard, incl. the calibration
  banner); SC-002, SC-004. **Done when**: the dashboard reads Graphite/Outfit-Inter in both modes, the
  grid stacks cleanly at 360px, the calibration banner (present/dismissed) and empty/populated states
  survive, and the three role views still differ correctly.

### P2-D — Account (US1/US2)

- [ ] T014 [P] [US2] Recolour/re-type Account in `apps/web/app/(authed)/app/account/page.tsx`,
  `apps/web/components/account/{profile-section,security-section,notifications-placeholder,privacy-placeholder,sign-out-section}.tsx`,
  and `apps/web/components/anchor/baseline-section.tsx` (Account-rendered; **owned here, not by
  P2-E**). Apply the **has-anchor pill text fix** (FR-017) in `baseline-section.tsx` (migrate the
  failing 3.84:1 meadow-tint pill text to `--color-meadow-text`). The dark-mode account-menu
  **dropdown** contrast fix lives in P2-F (`ui/dropdown-menu.tsx`) / P2-G (`profile-dropdown.tsx`),
  not here. **Satisfies**: FR-034 (account incl. has-anchor pill), FR-017; SC-001, SC-002.
  **Done when**: Account reads Graphite/Outfit-Inter in both modes, the has-anchor pill text clears
  AA, has-anchor vs no-anchor both render, and existing account tests pass.

### P2-E — Calibration flow (US1)

- [ ] T015 [P] [US1] Recolour/re-type the full calibration flow in
  `apps/web/app/(authed)/app/calibrate/{page,calibrate-recorder}.tsx` and
  `apps/web/components/anchor/{intro,green-room,countdown,get-ready-countdown,recording-stage,recording-timer,stop-confirm,success-state,failure-state,camera-access-state,backend-down-modal,anchor-recorder,device-picker}.tsx`.
  Recolour to Graphite (preserve intro/green-room/countdown/recording/stop-confirm/success/failure
  incl. `insufficient-face`, the three camera-access states, and the backend-down modal). Show capture
  progress as a **bar hugging the preview, not a ring** (FR-030); keep all status text **in the card
  below the preview** (FR-031); keep the on-video countdown `text-white` + drop-shadow overlay,
  legibility verified (FR-022). **Imports** `breathing-guide`/`framing-overlay` but does **not** edit
  them; does **not** touch `baseline-section.tsx` (P2-D) or `calibration-banner.tsx` (P2-C —
  dashboard-rendered). For FR-032, ensure the **progress bar still
  advances** under reduced motion (the orb-static half is T016). **Satisfies**: FR-034 (full
  calibration), FR-022, FR-030, FR-031, FR-032 (progress half); SC-002, SC-004 (16:9 preview), SC-008.
  **Done when**: every calibration state renders in Graphite both modes, progress is a preview-hugging
  bar, no status text sits on the raw video except the breathe label, and existing anchor tests pass.

### P2-E-orb — Breathing-orb bloom (bespoke) (US4)

- [ ] T016 [P] [US4] Rebuild the orb as a clean layered meadow bloom in
  `apps/web/components/anchor/breathing-guide.tsx`: **remove the inline `backdropFilter`/
  `WebkitBackdropFilter` frost** (the `FROST_FILTER`/`FROST_VEIL`/`FROST_MASK` glassmorphism) and
  render concentric translucent meadow discs (radial-gradient / stepped-opacity) that scale with the
  ~8s breathe cycle, breathe label centred (the only text on raw video); static bloom + static label
  under reduced motion via `useMediaQuery`. Component interface (no props) frozen. Source of truth:
  `serenify-007-orb-mock.html`. **Satisfies**: FR-019, FR-028, FR-032 (orb-static half), FR-033;
  SC-003, SC-005, SC-006. **Done when**: no backdrop-filter remains in the file, the orb matches the
  mock by eye, and the reduced-motion branch renders a static bloom.

- [ ] T017 [P] [US4] Author Vitest/RTL **behaviour** tests in
  `apps/web/components/anchor/breathing-guide.test.tsx` (extend the existing file): the reduced-motion
  branch is taken via `useMediaQuery` (static bloom — no animating `motion.div`); the breathe label
  swaps on the in/out cadence. Assert behaviour/state, **not** animation visuals. **Satisfies**:
  Principle VII for FR-028/FR-032. **Done when**: tests pass against T016 and fail if the
  reduced-motion branch or label cadence regresses.

### P2-E-overlay — Framing brackets / spotlight (US4)

- [ ] T018 [P] [US4] Recolour the framing overlay in
  `apps/web/components/anchor/framing-overlay.tsx`: state-coloured brackets — **meadow when tracking
  is good, foggy when attention is needed**, neutral `border-white/70` brackets migrated to a state
  colour (FR-022/FR-029); the spotlight dim `rgba(20,24,22,…)` → a Graphite ink-derived value; the
  meadow framing glow auto-migrates. Props (`drift`, `showNudge`, `gateReady`) frozen; the existing
  `framing-overlay.test.tsx` guards behaviour. **Satisfies**: FR-022, FR-029; SC-002. **Done when**:
  brackets are state-coloured (no raw white), the spotlight is Graphite ink-derived, and
  `framing-overlay.test.tsx` still passes.

### P2-F — Shared primitives + scrims (US2)

- [ ] T019 [P] [US2] Re-tokenise scrims and apply the dropdown contrast fix in
  `apps/web/components/ui/dialog.tsx` (`bg-black/80` → `bg-scrim`),
  `apps/web/components/ui/sheet.tsx` (`bg-black/80` → `bg-scrim`),
  `apps/web/components/notification.tsx` (`bg-black/50` → `bg-scrim` on the mobile overlay; desktop
  keeps `md:hidden`), and recolour `apps/web/components/ui/{dropdown-menu,card,avatar,separator}.tsx`
  (incl. the dark-mode account-menu dropdown contrast fix). Does **not** touch `button.tsx` (Phase 1).
  **Satisfies**: FR-021, FR-034 (shared primitives), FR-019; SC-001 (scrim), SC-003. **Done when**:
  no `bg-black/*` scrim remains, all three overlays use `bg-scrim`, the dark dropdown reads at AA, and
  primitive tests pass.

### P2-G — Header / nav shell consumers (US1)

- [ ] T020 [P] [US1] Recolour/re-type the nav shell in `apps/web/app/(authed)/layout.tsx` and
  `apps/web/components/header/{center-nav,mobile-menu,profile-dropdown}.tsx`. `mobile-menu` consumes
  `Sheet` (P2-F) and `profile-dropdown` consumes `dropdown-menu`/`avatar` (P2-F) — disjoint files, so
  parallel. Does **not** touch `header/header.tsx` (Phase 1). **Satisfies**: FR-034 (header shell);
  SC-002. **Done when**: the authed shell + nav read Graphite/Outfit-Inter in both modes and existing
  header tests pass.

**Checkpoint**: All surfaces re-skinned and both bespoke components built on disjoint scopes. Ready
for serial integration + verification.

---

## Phase 3: Integration, verification & docs (SERIAL)

**Purpose**: Walk the whole app, prove every Success Criterion, write the decision/changelog docs,
get the smoke sign-off, and clean up. Serial because it spans every surface and the smoke/visual-debug
loop is the real bottleneck (plan.md "Honest fan-out caveat").

- [ ] T021 Walk the **Preserved-States Checklist** (spec.md) in **both** modes across all three roles
  (employee/team-lead/admin); reconcile every removal against FR-002 (FR-003) — any untraceable
  removal is reverted. Also confirm the FR-020 "don't-change" geometry survived: the named one-off
  geometries (`rounded-[28px]`, `aspect-[3/4]`, per-call button heights) still render and no
  interactive radius falls outside 8–16px. **Satisfies**: SC-002, FR-001, FR-003, FR-020 (geometry).
  **Done when**: every listed state renders/functions, the one-off geometries are intact, and no
  out-of-list change in meaning remains.

- [ ] T022 Verify **WCAG AA in both modes** for every documented pairing (filled-CTA fg on meadow +
  foggy, foggy notice text, amber soft-tint text, every migrated `--color-meadow-text` site, the
  scrim separation) using a contrast tool. **Satisfies**: SC-001, FR-018. **Done when**: 100% of the
  documented pairings clear AA (≥4.5:1 text, ≥3.0:1 large/non-text) in both modes.

- [ ] T023 **No-glassmorphism sweep**: `rg "backdropFilter|backdrop-filter|WebkitBackdropFilter|backdrop-blur" apps/web`
  → **0** hits (the orb frost was an inline `style` prop; the utility grep alone is insufficient).
  **Satisfies**: SC-003, FR-019. **Done when**: zero matches anywhere in `apps/web`.

- [ ] T024 **Colour-literal sweep (token integrity)**: confirm no surface kept a per-component colour
  literal pinning an old value after the token swap — `rg "bg-\[#|text-\[#|border-\[#" apps/web` plus a
  grep for the legacy Mist & Meadow hexes
  (`rg -i "7A9275|8AA9B6|DCB587|7B4244|D6D7D1|ECEEE9|F5F6F2|1F2522|6E7572|161917|20231F|DCDED5|8B928F|97AE91|9CBBC7|2D3130|C17F81" apps/web`).
  Expect only intentional values; migrate any stray literal to its Graphite token. **Satisfies**:
  FR-006. **Done when**: no old-value colour literal remains — every surviving `#hex` / `[#…]` is a
  deliberate, documented value.

- [ ] T025 **Typeface sweep**: `rg "DM_Serif|DM Serif Display" apps/web` → **0**; confirm the wordmark
  reads lowercase `serenify` in all three locations and Outfit is confined to
  display/heading/wordmark/large-numeral (never body/buttons/labels/chart text). **Satisfies**:
  SC-007, FR-010, FR-013. **Done when**: zero DM-Serif matches and the wordmark/Outfit-scope checks
  pass.

- [ ] T026 **Errors=foggy sweep**: confirm every error/attention state is a foggy soft-tint notice
  (never amber, never sharp red) across the auth notices, the OTP wrong-code notice, the calibration
  failure states, and any attention banner; amber appears only as soft-tint stress notice or graphic
  hue (no solid-amber-with-ink fill). **Satisfies**: SC-008, FR-015, FR-016. **Done when**: no amber
  or red error treatment remains.

- [ ] T027 Verify **360px integrity** (OTP boxes wrap, dashboard two-column grid stacks, calibration
  preview holds 16:9) with all touch targets ≥44×44px, and **reduced-motion** honoured on every
  animation (OTP merge, orb breathing, transitions) via `useMediaQuery` — OTP shows the verified pill
  directly / skips the sway, the orb is a static bloom while its progress bar still advances.
  **Satisfies**: SC-004, SC-005, FR-026, FR-032. **Done when**: every in-scope surface is correct at
  360px→desktop and every animation respects the reduced-motion setting.

- [ ] T028 Run the test gate: `npm run test` (Vitest/RTL — incl. the new `OtpPanel` + `BreathingOrb`
  specs) and `npm run test:e2e` (Playwright role e2e, all three roles) both green. **Satisfies**:
  Constitution Principle VII. **Done when**: all unit/RTL tests and the three role e2e tests pass.

- [ ] T029 Update docs (append-only) at `docs/DECISIONS.md` — the type-scale + naming **mechanism**
  (override Tailwind `--text-*`), the `--color-on-accent` token, the `--color-meadow-text` token, the
  **errors=foggy** confirmation, and the **scrim token** (`--color-scrim`) — and note any spec
  deviation in `docs/CHANGELOG.md`. **Satisfies**: FR-035, SC-009, Principle VIII. **Done when**: all
  five decisions are recorded in `docs/DECISIONS.md` and any deviation is in `docs/CHANGELOG.md`.

- [ ] T030 Run `specs/007-visual-redesign/smoke-tests.md` and record results; **Mohamed signs off**
  (Principle VII / Dev-Workflow gate 5). **Satisfies**: FR-035, SC-009, and the human halves of
  SC-001/002/004/005/006. **Done when**: every smoke check is recorded pass and the file is signed off.

- [ ] T031 **End-of-feature cleanup (FR-036)**: delete the throwaway preview/mock files from the repo
  root — `serenify-007-otp-mock.html`, `serenify-007-orb-mock.html`, `serenify-007-patterns-swatch.html`
  (and any prior `serenify-redesign-preview.html` / `serenify-font-preview-d5.html`). They stay
  **untracked** until this task. **Satisfies**: FR-036. **Done when**: none of the listed mocks remain
  in the working tree and none were ever committed.

**Checkpoint**: All Success Criteria proven, docs written, smoke signed off, mocks removed — feature
ready for Mohamed's merge review.

---

## Dependencies & Execution Order

### Phase order

- **Phase 1 (T001–T008)**: serial, single-agent. **T008 is a hard gate** — Phase 2 cannot start
  until the Phase-1 exit re-check passes.
- **Phase 2 (T009–T020)**: all `[P]` — disjoint file scopes against the frozen Phase-1 contract.
- **Phase 3 (T021–T031)**: serial, after all of Phase 2 merges.

### Within-phase notes

- **Phase 1**: T001→T002→T003→T004 are sequential edits to `globals.css`; T005 edits `globals.css`
  **and** `layout.tsx`; T006 (`button.tsx`) and T007 (the three wordmark files) are independent of the
  `globals.css` chain but kept in the single serial Phase-1 agent. T008 last.
- **Phase 2**: T009 (auth) ∥ T010 (onboarding) ∥ T011+T012 (OTP) ∥ T013 (dashboard) ∥ T014 (account)
  ∥ T015 (calibration) ∥ T016+T017 (orb) ∥ T018 (overlay) ∥ T019 (primitives/scrims) ∥ T020 (nav).
  - **T009 ∥ T011 confirmed parallel** — `OtpPanel` props (incl. `successHref`) pre-exist and are
    frozen (see the ordering note above); they edit disjoint files.
  - T015 imports but does not edit `breathing-guide.tsx` (T016) / `framing-overlay.tsx` (T018) —
    frozen interfaces, so parallel.
  - T019 (primitives) ∥ T020 (their nav consumers) — disjoint files.
  - T012 depends on T011; T017 depends on T016 (same bespoke-component agent, test alongside build).
- **Phase 3**: T021→…→T031 in order; T031 (mock deletion) is strictly **last**.

### Parallel execution example (Phase 2, after T008 passes)

```text
# Disjoint-scope tasks — launch together:
Task T009  Auth screens          (app/(auth)/**, components/ui/auth/{field,password-*})
Task T011  OTP bespoke + T012    (components/ui/auth/otp-*)
Task T013  Home dashboard        (app/(authed)/app/page, components/home/*, chat-pill, role-placeholder)
Task T014  Account               (app/(authed)/app/account, components/account/*, anchor/baseline-section)
Task T015  Calibration flow      (app/(authed)/app/calibrate/**, components/anchor/* except orb/overlay/baseline)
Task T016  Orb bloom + T017      (components/anchor/breathing-guide)
Task T018  Framing overlay       (components/anchor/framing-overlay)
Task T019  Primitives + scrims   (components/ui/{dialog,sheet,dropdown-menu,card,avatar,separator}, notification)
Task T020  Nav shell             (app/(authed)/layout, components/header/{center-nav,mobile-menu,profile-dropdown})
```

## Implementation Strategy

- **MVP = Phase 1 alone** (US1 core): swapping the nine `@theme` values + the two new tokens + type
  scale + fonts + button fix + wordmark re-skins the entire app via token auto-propagation. Validate
  the foundation (T008) before any Phase-2 surface work.
- **Incremental**: each Phase-2 task is an independently shippable surface; the two bespoke pieces
  (T011/T016) carry the only new behaviour-shaped tests.
- **Fan-out is real only for Phase 2** and only with the frozen contract + disjoint scopes; Phase 1
  and the Phase-3 smoke/debug loop dominate wall-clock (plan.md caveat). Do not over-parallelise the
  small recolour tasks.

## Notes

- `[P]` = different files, no dependency on an incomplete task.
- Each task is a standalone prompt: it names its files, FR/SC IDs, and done-condition.
- The two bespoke components are unit-tested for **behaviour** (T012, T017); visual/animation fidelity
  is human-verified against the mocks (SC-006) in `smoke-tests.md`.
- Commit after each task or logical group; report removals against FR-002 (FR-003).
