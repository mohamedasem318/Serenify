# Serenify — Progress Log

Per-feature implementation log. Append-only, newest first.

---

## Fix — VFR-webm decode mis-sampling (timestamp-driven frame sampling)

**Branch**: `fix/webm-vfr-decode-sampling` → **PR #18** into `main` (open; awaiting the
operator's merge click).
**Status**: code validated; this entry is the implementation record. Full rationale in
**📌 DECISION-29**.
**Date**: 2026-06-16.

**Chronology (the thesis narrative)** — how a latent fidelity bug was found, diagnosed, and
fixed:

1. **Surfaced by an end-to-end smoke, not a unit test.** Feature 006's usable-face-coverage
   gate **smoke test** showed an **intermittent false-reject**: a good baseline clip passed on
   one run and was rejected on the next. The unit suite was green throughout — it exercised
   CFR synthetic clips, on which the legacy sampler is correct, so it structurally could not
   see the bug.
2. **Diagnosed to VFR container metadata.** Instrumenting the decode showed production uploads
   are Chrome `MediaRecorder` **variable-frame-rate webm**, and OpenCV's `CAP_PROP_FPS` /
   `CAP_PROP_FRAME_COUNT` are unreliable on them — the **same format** read `8.417 fps /
   504 frames` on one capture and `1000.0 fps / 59 890 frames` on another.
3. **Confirmed the nondeterministic collapse.** Because `skip_ratio = round(reported_fps / 5)`,
   the kept-frame count tracked the garbage fps — **126 frames one run, 4 the next** for
   equivalent input. A dev harness reproduced `fps=1000.0` exactly on a real `MediaRecorder`
   webm (269 true frames over 11.45 s) and measured the legacy sampler keeping **1** frame.
4. **Timestamp-driven hybrid fix.** A probe established that `CAP_PROP_POS_MSEC` is reliable
   and strictly monotonic on these webms. Sampling now reads timestamps: **CFR** keeps the
   legacy index selection **bit-for-bit** (mp4/avi unchanged at any frame rate); **VFR**
   samples on a fixed **2.5 fps grid** (≈150 frames per 60 s, regardless of reported metadata);
   unusable timestamps fall back to legacy. Two-pass decode (`grab` for timestamps, then
   retrieve only the kept frames). **No new dependency** — the FFmpeg transcode-to-CFR fallback
   was deliberately not needed.
5. **Validated.** Real captures now yield **kept ≈ 150 consistently** across reported_fps
   8.4 / 1000 / metadata-mismatch (the count is now a function of *duration*, not garbage fps);
   `usable ≈ kept` on a full capture; CFR mp4/avi select **identical** frames to before;
   `tests/test_vfr_sampling.py` + full ml-video/apps/api suites green.

**Scope**: decode sampling only — the usable-face-coverage gate and every output contract are
untouched. A quiet `logger.debug` decode line and a DEV-only webm recorder
(`packages/ml-video/tools/dev_webm_recorder.html`) were added. The residual caveat (a webm
with **both** garbage fps **and** garbage timestamps would fall back to legacy and could still
collapse — not observed; transcode fallback deferred) is recorded in **DECISION-29**.

**Relation to Principle II**: per-user calibration makes every prediction a delta from the
~60 s baseline, so the baseline's feature fidelity is the measurement datum. The fix
**restores** the model's trained ≈2.5 fps sampling density on webm and keeps CFR bit-identical
— an application of Principle II, not a model change.

---

## Feature 006 — Calibration Capture Quality (implementation complete; awaiting smoke + review)

**Branch**: `006-calibration-capture-quality`
**Status**: implementation complete (Phases 1–8 / T001–T028); **awaiting Mohamed's manual
smoke run (`smoke-tests.md`) + merge approval**. No pre-ship blocker.
**Date**: 2026-06-16 (implementation spanned the 006 cycle on the branch above)

**Scope shipped** — a server-side, authoritative **usable-face-coverage gate** that fixes the
005-era bug where a 60 s baseline with the face in frame for only ~2 s was silently accepted,
poisoning every later delta-from-baseline reading (Constitution Principle II — per-user
calibration is load-bearing). **Additive only: no new endpoint, status, response shape,
dependency, or migration.**

- **The gate (DECISION-30).** `packages/ml-video/src/ml_video/coverage.py` —
  `usable_face_coverage(landmarks) -> (usable, kept, fraction)` (usable = non-zero landmark
  row, the predicate `lbp_top_features` already uses) + `assert_usable_face_coverage`, called
  from `compute_anchor` **after `extract_landmarks`, before the existing degenerate floors**.
  Strictly stricter and additive — it never loosens the floors and short-circuits thin clips.
  Confirmed gate-cannot-touch-inference (T003): `compute_anchor` is baseline-path-only; live
  inference uses the separate, unwired `Predictor.predict_delta`.
- **Messaging (DECISION-31).** New categorical reason `insufficient_face_frames` carried in
  the **unchanged** 422 `reason` field via an optional `FeatureExtractionError.code`
  (`reason = getattr(exc, "code", None) or str(exc)`), mapped to **one** new client
  `insufficient-face` chip with server-reason precedence over `dominantCause`. **Counts
  (`usable`/`kept`/`fraction`) live only in a server `logger` line** — generic exception
  message, categorical wire token, so nothing numeric leaks (Principle I / FR-016). Every
  other reason still selects via `dominantCause` (incl. detector-unavailable → `our-side`);
  the three existing chips are byte-for-byte unchanged.
- **Calibration (DECISION-32).** `MIN_COVERAGE_FRACTION = 0.40` (primary) / `MIN_USABLE_FRAMES
  = 50` (backstop), measured against three real clips in the pinned env (Python 3.12.13,
  mediapipe 0.10.13): thin `0.023/4` rejects; good-ideal `1.000/154` and good-realistic
  `1.000/129` (binding) accept. Values sit in a **wide empty gap** (good-realistic held at
  1.000 — FaceMesh is robust to seated glances, so there is no sub-100% sample); **explicitly
  provisional — revisit against real-user data (coverage 0.40–0.60, usable 30–60)**.
- **Glasses (DECISION-33, investigation-only).** No glasses/no-glasses gap (24/53; macro-F1
  0.720 vs 0.717; stress recall 0.844 vs 0.818) → calibrate as you normally sit, glasses
  included; do not ban. Recorded with the between-subject thesis caveat.

**Testing (honest, no mock-green — Principle VII)**: the gate logic is never mocked; the only
injected seam is native extraction (mediapipe), and **CI runs no mediapipe** — the boundary
tests load committed `.npy` landmark fixtures (raw clips never committed — Principle I/X). TDD
throughout (RED → GREEN) for the gate, the router reason, and the frontend chip.

- ✅ `packages/ml-video` `uv run pytest` — green (gate logic + wiring + real-fixture boundary).
- ✅ `apps/api` pytest — green (categorical-reason + legacy-message-unchanged; happy/ES256
  paths bypass the gate via inert thresholds since the synthetic clip is below the floor).
- ✅ `apps/web` Vitest — green (new chip render + server-reason precedence + byte-for-byte
  no-regression on the existing chips; static voice/colour guardrail on the new chip).
- ✅ `tsc --noEmit` + eslint clean.

**Gates**:

- ✅ Constitution Check — Principles I, II, III, V, VII, VIII addressed in `plan.md`.
- ✅ Test gate — all three suites + typecheck + lint green locally.
- ✅ Privacy — counts log-only; raw clips never committed; 422 body categorical.
- ⏳ Smoke-test gate — pending Mohamed's run of
  `specs/006-calibration-capture-quality/smoke-tests.md` (T027, manual).
- ⏳ Mohamed's final review and merge to `main`.

**Branch commit ordering** (PR-sized, tests green per step): P1–2 env/scaffold (`8cd2027`) →
P3–4 gate core + wiring (`60983cb`) → P5 fixtures + measurements (`46e3bb8`) → P5 calibrate +
lock (`68c199b`) → P6–7 router reason + chip (`4428060`) → P8 docs + smoke.

---

## Feature 005 — Calibration Capture Flow (implementation complete; one pre-ship blocker open)

**Branch**: `005-calibration-capture-flow`
**Status**: implementation complete; **one hard pre-ship blocker open (T004 — flip the
capture-route CSP from report-only to enforce)**; awaiting the real-webcam smoke run +
merge approval.
**Date**: 2026-06-08 (docs-finalisation close; implementation spanned 2026-05-29 → 2026-06-08)

**Scope shipped** — a calm redesign of the calibration capture UX over feature 004's
**unchanged** extraction backend (no migration, no backend/contract change, no seed
change; `contracts/backend-unchanged.md`):

- **On-device framing guide (DECISION-19/20)** — a self-hosted MediaPipe BlazeFace
  detector (vendored WASM, capability-probed, hard-timeout, never hangs) drives a pure
  gate/drift module through a throttled live loop; `loading → active | unavailable`, with
  `unavailable` bypassing the gate so the user is never locked out. A scoped CSP
  `'wasm-unsafe-eval'` allowance on the two capture routes only (report-only) lets the WASM
  compile; no `connect-src` host added, COEP unset. **Nothing leaves the browser.**
- **Settle-before-record flow (DECISION-21/27)** — redesigned reducer
  `intro → green-room → (healthz) → get-ready → recording → success`: a green room that
  lets the user settle with live framing + device switching before anything records, a
  numbers-only 3→2→1, a breathing orb (4-in/6-out) as the only non-progress motion, the
  60 s timer as the sole progress indicator, and a reduced-motion equivalent for every
  animated element on the shared `useMediaQuery` hook.
- **Three calm camera-access states + honest stop-confirm + adaptive failure
  (DECISION-21/24)** — `getUserMedia` `error.name` maps to foggy Blocked / Busy /
  No-camera screens with recovery; a non-destructive "start the minute over" stop-confirm;
  and a foggy failure state whose cause chip (low-light / out-of-frame / our-side default)
  is collapsed from on-device telemetry, never asserting a user-side cause we didn't
  measure. The `/healthz` gate + backend-down modal reuse 004 and block recording into a
  dead backend.
- **Recalibrate from account (DECISION-22/23)** — an employees-only "Your calm baseline"
  section (whether-set only, never the date) with a heads-up dialog → full-document
  `<a href="/app/calibrate?mode=recalibrate">`; `mode` reconciled against the real
  `has_anchor` (a stray `?mode=` never manufactures a recalibration); copy "set"→"update";
  exits to `/app/account`. The baseline is overwritten **only on a successful capture** —
  the same single in-place `UPDATE`, no history table, no migration.
- **Home calibration banner restyled (DECISION-28)** — 004's amber banner becomes foggy
  with a foggy-filled "Set baseline" CTA (attention, not affirmative); lifecycle, cross-tab
  mirror, and the full-document nav unchanged; employees-only.
- **Old 004 calibration UI fully removed (DECISION-28)** and the redesigned recorder
  mounted at both onboarding and `/app/calibrate`.
- **Device-memory fix (DECISION-25)** — a cleared store re-seeds the resolved default
  camera for the session without clobbering a temporarily-absent remembered device.
- **Honest tests + the NON-NEGOTIABLE egress proof (DECISION-26)** — boundary-seam tests
  exercise the real orchestration; an e2e detector seam runs the real gate to a full
  recording; a two-layer Playwright egress proof asserts **no video AND no outbound body of
  any kind** leaves for framing across green-room / mid-recording / post-success, except the
  single final `/anchor` clip POST on success.
- **Static guardrail scan (T030)** — a source scan over the 005 surfaces asserts zero
  `amber`/`crimson` tokens and zero exclamation marks / blocklist terms ("detected",
  "alert", "abnormal", "elevated risk", …) on any calibration or error surface.

**Test results** (as last recorded; this docs pass ran no suites):

- Web anchor Vitest: **161 anchor tests green** (last recorded at the green-room gate-sync
  fix); typecheck 0 / lint 0 at the last code change.
- Anchor e2e (Playwright, chromium): the consolidated 005 specs (`anchor-flow`,
  `anchor-camera-access`, `anchor-banner`, `anchor-egress`, `anchor-cross-tab`) green; the
  egress proof passes both layers. firefox/webkit + the real-detector paths fall to the
  smoke matrix.

**Decisions logged in DECISIONS.md (2026-06-08, T033)**: the collected, finalised
feature-005 block **📌 DECISION-19 through DECISION-28** (folding the 2026-05-31
DECISION-22/23/25 drafts, the banner-CTA meadow→foggy note → DECISION-28, and the e2e-seam /
FR-050 egress note → DECISION-26 into the numbered scheme).

**Open / deferred — before the 005 detector ships** (tracked in `docs/BACKLOG.md`):

- **T004 — flip the capture-route CSP report-only → enforce** after a
  `securitypolicyviolation` sweep. **Hard deploy blocker**; the detector must not ship to
  production under report-only.
- **Run the T032 smoke matrix on a real webcam** (cross-browser; the three real
  camera-access conditions; the weak-device detector-unavailable fallback; 360 px;
  reduced-motion; light/dark) — none of it is CI-reproducible.
- **Verify mobile camera over HTTPS** (the 004-deferred real-device camera path).
- Pre-production: the invite-only `/signup` gate (security slice 7) remains a separate
  pre-launch blocker, unchanged by 005.

**Next**: feature 006 — stress-inference-service (the live inference read path that consumes
`anchor_vector` as the per-user delta baseline 005 calibrates).

---

## Feature 004 — Onboarding Video Anchor Flow (merged to main)

**Branch**: `004-onboarding-video-anchor` (squash-merged via PR #14, then deleted)
**Status**: **merged to `main` 2026-05-29** (PR #14, squash `b75a6a9`); smoke pass
signed off by Mohamed 2026-05-29.
**Date**: 2026-05-29 (ship close; implementation spanned 2026-05-27 → 2026-05-29)

**Scope shipped**:

- **ML video package** (`packages/ml-video`) — `uv`-managed, Python 3.12-pinned
  (mediapipe ceiling, DECISION-1) LBP-TOP + motion feature pipeline; exact ML pins
  copied from `models/metadata.json`; loader/predict path present and unit-tested
  but invoked by no 004 endpoint (that's feature 005's inference read path). Model
  `serenify-video-lbptop-motion-rf-calibrated@2.0.0`.
- **FastAPI extraction service** (`apps/api`) — `POST /anchor` (JWT-verified) runs
  extraction and returns a 2958-dim vector as base64 LE-float32; raw bytes deleted
  in a `finally` (Principle I); `GET /healthz` (no auth) for the recorder
  pre-check; service holds **no** DB credentials (DECISION-8/9). Accepts MP4 + WebM
  (DECISION-11). JWT verified via Supabase JWKS / ES256 with an HS256 fallback
  (DECISION-9 amendment, smoke-surfaced).
- **Anchor columns + privacy** (migration `20260527000000_anchor_columns.sql`) —
  three anchor columns on `public.profiles`, all excluded from the `authenticated`
  SELECT whitelist; calibration status read only via the scope-guarded SECURITY
  DEFINER `has_anchor(auth.uid())` (DECISION-12, plan amendment). The web app does
  the privileged write with the user's own session client.
- **Web recorder** (`apps/web/components/anchor/`) — explicit state machine
  (idle → permission → 60s countdown → extracting → success/failure), post-grant
  device picker, codec probe, calm failure copy with a three-failure escape,
  reduced-motion countdown, health pre-check before any capture UI, and explicit
  user-dismissible terminal states.
- **Onboarding step + `/app/calibrate` route + calibration banner** — anchor step
  inline in onboarding and at a standalone route; amber banner with session-only
  dismissal (resets on sign-out), hard-navigating CTA so the per-route
  `camera=(self)` Permissions-Policy applies (DECISION-14/16 + smoke refinement).
- **Cross-tab sync** (extends `lib/auth-broadcast.ts`) — completing calibration
  drops the banner / redirects sibling tabs within ~2s; dismissal mirrors into
  sibling tabs; the anchor-captured refresh is scoped to banner-bearing routes
  (DECISION-15 + smoke refinements).
- **Demo synthetic anchor** (DECISION-17) — the seed writes one deterministic
  synthetic anchor (seed 42) via service-role so demo employees land on a
  calibrated, banner-free `/app`.

**Test results** (pre-flight, 2026-05-29):

- Web unit (vitest): **291/291 in 31 files**; the 2 previously-red
  `cross-tab-auth.test.tsx` tests are green (file: **35/35**).
- apps/api (pytest): **11/11** (incl. the ES256-via-JWKS accept + wrong-key reject
  tests). ml-video (pytest): **4/4** (unchanged).
- Anchor e2e: **chromium + firefox green — 26/26** (run with `--retries=2`, the CI
  posture: 19 passed clean, 7 chromium tests flaked on the cold-compile *first*
  attempt and passed warm on retry — the documented suite-wide load-timing flake,
  not a product issue). webkit is excluded locally — the Windows worker-teardown
  leak (DECISIONS 2026-05-27, collected entry item 13); Safari coverage falls to the
  smoke matrix + CI's clean Linux webkit.
- Typecheck: 0 errors. Lint: 0 warnings.

**Smoke gate**: signed off by Mohamed 2026-05-29 —
`specs/004-onboarding-video-anchor/smoke-tests.md`. ST-01…ST-20 PASS. **Deferred**:
ST-21 (Safari desktop) + ST-24 (iOS Safari) pending Apple hardware; the mobile
*camera* portions of ST-22/ST-23 to post-deploy HTTPS verification (non-camera
mobile UI verified over a LAN-IP HTTP origin). Several smoke bugs were found and
fixed during the gate (ST-02 retry flash, ST-10 explanation/observer, ST-11
dismissal persistence, ST-17 cross-tab, ST-18 health pre-check, plus the JWKS auth
and banner hard-nav fixes) — all recorded in DECISIONS.md 2026-05-29.

**Decisions logged in DECISIONS.md**: the collected feature-004 entry
(📌 DECISION-1 through DECISION-18, 2026-05-27), the DECISION-12 amendment
(2026-05-27), and the 2026-05-29 smoke-surfaced entry (which also backfills the two
planned decisions — DECISION-10 `/healthz`+startup check, DECISION-11 MP4+WebM —
that the collected entry had skipped).

**Deferred to BACKLOG.md (feature 004)**: post-deploy mobile camera → upload →
anchor verification over HTTPS (incl. mobile-codec server-side decode); Safari/iOS
smoke cells (ST-21/24); the `localStorage` device write-back bug (ST-05); an e2e
test-hardening pass; cross-browser/cross-device anchor + auth realtime sync; and
the redundant onboarding name step. The invite-only `/signup` gate (security slice
7) remains a ⛔ pre-production deploy blocker, unchanged by 004.

**Next**: feature 005 — per-user calibration (live inference read path for
`anchor_vector` + calibration UX revamp / design refinements). 005 owns the anchor
read path and the deferred design-system token pass.

---

## Feature 003 — Employee Dashboard Shell (implementation complete)

**Branch**: `003-employee-dashboard-shell`
**Status**: implementation complete, awaiting smoke-test + merge approval.
**Date**: 2026-05-25 (Phase 13 close; implementation work spanned 2026-05-19 → 2026-05-25)

**Scope shipped** (13 phases / 71 tasks):

- **Auth-primitive extraction** (Phase 2): `PasswordInput`,
  `PasswordRequirements`, `OtpPanel`, and a new `Field` wrapper
  moved to `apps/web/components/ui/auth/`. (auth) page forms
  reimport by path; pages render byte-equivalent to `main` per
  FR-040.
- **`next-themes` migration** (Phase 3): `attribute` flipped from
  `data-theme` to `class`; localStorage namespaced from `theme` to
  `serenify-theme`. Inline migration shim in root layout populates
  the new key from legacy storage on first load (T014 resolution
  at `a5d89b3` + `073bdaf` after the initial guard was too strict).
- **shadcn/ui on Tailwind v4** (Phase 4): manual init (per
  CHANGELOG 2026-05-20 amendment), `components.json` per
  Decision E, 7 primitives installed (button, card, dropdown-menu,
  sheet, dialog, avatar, separator). Mist & Meadow tokens drive
  every shadcn CSS variable via the 19-row `@theme inline` mapping
  in `globals.css`. `--color-*` prefix correction (CHANGELOG
  2026-05-20) unblocked Tailwind v4's utility-class generation;
  7-step radius ladder added in the same correction commit.
- **Header + center nav + profile dropdown** (Phase 5): Server-
  Component `<Header>` reads `profiles.full_name` and `profiles.role`
  once; passes props down to client sub-components (`<CenterNav>`,
  `<ProfileDropdown>`, `<MobileMenu>`). Shared
  `<SignOutButton>` used by the dropdown, account-page Sign out
  section, and role placeholder.
- **`/app/account` page** (Phase 6): five vertical sections —
  Profile (edits `full_name` via Server Action with optimistic
  in-section avatar + `router.refresh()` to flush the header on the
  same render cycle); Security (inline change-password form per
  FR-020 CHANGELOG 2026-05-21 amendment; throwaway anon client for
  current-password verification); Privacy + Notifications
  placeholders; SignOutSection.
- **`/app` body** (Phase 7): employee role sees `<WelcomeBanner>`
  (adaptive greeting + locked Decision M subtitle "A space to
  check in with yourself.") + three skeleton cards in the
  documented 60/40 layout (Today's check-in / Things that might
  help / Recent chats). Stacks single-column at 360px.
- **Chat pill** (Phase 8): visual-only `<ChatPill>` anchored
  bottom-right on employee pages only (FR-035). Writes
  `--chat-pill-offset: 48px` on `<html>` for the notification
  stacking convention.
- **Notification component** (Phase 9): Radix Dialog + Framer
  Motion composition (not Sonner). Desktop slide-in / mobile
  bottom-sheet bifurcation via `useMediaQuery`; `useReducedMotion`
  collapses to opacity-only. Built but not mounted by production
  code per FR-033 — features 007/008/010 consume.
- **Role placeholders** (Phase 10): `<RolePlaceholder>` for
  team_lead and admin; locked Decision L copy with the
  CHANGELOG 2026-05-22 admin-subtitle amendment ("available below"
  → "available from the header dropdown"). FR-035: no chat pill
  for managers.
- **Cross-tab auth listener** (Phase 11): `<CrossTabAuth>` at root
  layout per DECISION-8. Decision N amendment (commit 0e4637f /
  CHANGELOG 2026-05-22) replaced supabase-js storage propagation
  with an explicit broadcast helper at
  `apps/web/lib/auth-broadcast.ts` because `@supabase/ssr` stores
  the session in cookies, not localStorage.
- **Verification + polish** (Phase 12): `employee-dashboard-shell.spec.ts`
  Playwright happy-path covers US 1 + US 2; clean stale-import sweep;
  full test pass green across all gates.
- **Phase 13**: DECISIONS.md collected (12 entries — 11 planned +
  FR-020 amendment); BACKLOG follow-ups appended (4 new entries
  including the T066 pipe-buffering note); cross-tab + auth-
  primitive extraction backlog items marked resolved against
  feature 003's resolutions.

**Test results**:

- Vitest: **154/154 in 20 files** (10.6s).
- Playwright: **54/54** total — chromium 18/18 (37.8s), firefox
  18/18 (1.4m), webkit 18/18 (7.3m). Includes 2 new feature 003
  specs (`employee-dashboard-shell.spec.ts`,
  `cross-tab-auth-sync.spec.ts`) plus the 7 preserved feature 001 /
  hotfix specs (admin-seeded, team-lead-seeded, employee-otp,
  employee-signup, reset-password, demo-coexistence,
  login-expired-link). Only permitted change to feature 001 specs:
  role-placeholder copy assertions in `admin-seeded.spec.ts` /
  `team-lead-seeded.spec.ts` per T057 / FR-036 + admin-subtitle
  refinement per Decision L amendment.
- Typecheck: 0 errors. Lint: 0 warnings.

**Gates passed**:

- ✅ Spec gate — all `specs/003-employee-dashboard-shell/`
  artifacts populated.
- ✅ Constitution Check — Principles V (calm voice, no red on
  affective surfaces with FR-042 destructive-surface clarification
  in constitution 1.1.0), VI (light + dark equal-priority), VII
  (Vitest + Playwright coverage), VIII (DECISIONS.md, CHANGELOG,
  PROGRESS.md), IX (no new secrets, no new env vars) addressed in
  `plan.md`.
- ✅ Test gate — typecheck, lint, Vitest, Playwright all green
  across the three browser projects (T066).
- ✅ Auth regression — feature 001's seven auth Playwright specs
  preserved unchanged save the T057 role-placeholder copy update
  per FR-036.
- ⏳ Smoke-test gate — pending Mohamed's run of
  `specs/003-employee-dashboard-shell/smoke-tests.md` (T071,
  manual; ST-1 through ST-10 including the three cross-tab +
  email/reset scenarios added in T063.1).
- ⏳ Mohamed's final review and merge to `main`.

**Decisions logged in DECISIONS.md (2026-05-25, T067)**:

- DECISION-1: shadcn on Tailwind v4 path + manual init
  substituted.
- DECISION-2: 19-row variable mapping + 3 load-bearing choices
  + `--color-*` prefix convention + 7-step radius ladder.
- DECISION-3: `data-theme` → `class` + `serenify-theme` storage key.
- DECISION-4: three-tier component folder convention.
- DECISION-5: notification on Radix Dialog + Framer Motion (not
  Sonner).
- DECISION-6: notification explicit-dismiss only.
- DECISION-7: welcome banner subtitle locked to "A space to check
  in with yourself."
- DECISION-8: cross-tab listener mounts at root layout.
- DECISION-9: Playwright cross-tab spec pattern (single context,
  two pages) + Decision N amendment (explicit broadcast helper).
- DECISION-10: `framer-motion` + `tw-animate-css` dep deltas.
- DECISION-11: chat-pill / notification stacking via
  `--chat-pill-offset`.
- FR-020 amendment: inline change-password form on `/app/account`.

Plus the existing 2026-05-20 entry: FR-042 scope clarification
(red permitted on destructive action surfaces only via the
`--color-crimson` token).

**Deferred to BACKLOG.md (2026-05-25, T068)**:

- Dynamic welcome banner subtitle variants (deferred-feature)
- Notifications-section live controls (deferred-feature)
- Welcome banner timezone awareness (deferred-bug)
- Playwright local matrix run pipe-buffering note (deferred-tooling)

**Resolved against BACKLOG.md (2026-05-25, T069)** — feature 001
entries closed by feature 003 work:

- "Cross-tab auth state sync" — Phase 11.
- "Auth form components inlined in page files" — Phase 2.
- ("/login does not render ?error=expired_link" — was already
  resolved on the earlier hotfix; verified, not re-touched.)

**Deviations resolved during implementation** (full context in
CHANGELOG.md):

- 2026-05-19: spec Out-of-Scope bullet referencing the expired-link
  hotfix recon — superseded by `8dc822b` (PR #2 merge).
- 2026-05-20: Tailwind v4 `@theme inline` prefix correction.
- 2026-05-20: FR-042 scope clarification (red on destructive only,
  constitution V1.1.0 bump).
- 2026-05-20: shadcn manual init substituted for `shadcn@latest init`.
- 2026-05-21: FR-020 inline change-password form replaces link-to-
  /forgot-password (T034 design failed the proxy redirect contract).
- 2026-05-22: Decision N amendment — explicit broadcast helper.
- 2026-05-22: Decision L admin subtitle copy refinement.

**Commit count**: **112 commits** on the `003-employee-dashboard-shell`
branch (from `65dac2d` "feat(003): add employee dashboard shell spec"
through `f037b4a` "docs(003): T069 — sweep BACKLOG").

---

## Feature 002 — Demo Seed Data (implementation complete)

**Branch**: `002-demo-seed-data`
**Status**: implementation complete, awaiting smoke-test + merge approval.
**Date**: 2026-05-18

**Scope shipped**:

- `scripts/seed-demo.ts` CLI entrypoint with three code paths:
  idempotent create-or-skip (default), `--reset` (pattern-scoped delete
  + recreate), `--remote` (two-key opt-in to the deployed project).
- Five pure helper modules in `scripts/lib/`: `hierarchy.ts` (the
  canonical 30-slot generator), `env.ts` (`apps/web/.env.local` loader
  + CLI arg parser + target resolution), `supabase-admin.ts` (service-
  role client factory with production-load guard), `confirm.ts`
  (interactive y/N prompt for the remote path), `banner.ts`
  (environment / summary-table / password banner formatters).
- Root tooling: `package.json` devDeps (`@faker-js/faker` 9.2.0 exact,
  `tsx` 4.19.2 exact, `@supabase/supabase-js`, `dotenv`, `vitest`,
  `cross-env`), four npm scripts (`seed`, `seed:reset`, `test:seed`,
  `test:seed:integration`), new root `tsconfig.json` scoped to
  `scripts/`, new root `vitest.config.mts`.
- Playwright retrofit (FR-019): `apps/web/tests/e2e/setup/global-setup.ts`
  pattern-scopes the auth.users wipe to `@example.com` and removes the
  unscoped orphan-profile sweep (which would otherwise have destroyed
  demo profile rows).
- New Playwright spec `apps/web/tests/e2e/demo-coexistence.spec.ts`
  asserts the demo cohort is byte-identical before and after a full
  e2e run.

**Test results**:

- 9/9 Vitest unit assertions on `buildHierarchy(1729)` green (FR-001,
  FR-002, FR-006(a)-(e), FR-007/SC-005, Principle X).
- 8/8 Vitest integration assertions green against local Supabase
  (8.65s wall-clock for the full integration suite, well under the
  60s SC-001 budget).
- 33/33 Playwright e2e specs green across chromium + firefox + webkit
  (94s wall-clock). The new `demo-coexistence.spec.ts` ran in all three
  browsers and confirmed the demo cohort survives global-setup
  untouched.
- Root typecheck (`npx tsc -p tsconfig.json --noEmit`) green; apps/web
  typecheck (`npm run typecheck --workspace=apps/web`) also green
  after the FR-019 edit.

**Gates passed**:

- ✅ Spec gate — all `specs/002-demo-seed-data/` artifacts populated.
- ✅ Constitution Check — Principles VII, VIII, IX, X addressed.
- ✅ Test gate — unit + integration + e2e all green locally.
- ✅ Secrets scan — no new `.env*` files, no key in any banner/summary
  output, service-role key flows only through `process.env`.
- ⏳ Smoke-test gate — pending Mohamed's run of
  `specs/002-demo-seed-data/smoke-tests.md` (T025, manual).
- ⏳ Mohamed's final review and merge to `main`.

**Decisions logged in DECISIONS.md (2026-05-18)**:

- TS runner: `tsx` 4.19.2 (exact pin)
- Playwright orphan-profile sweep removed
- Demo email format `<first>.<last>.<NN>@demo.serenify.local`

**Deferred to BACKLOG.md**:

- CI integration for `npm run test:seed:integration` (deferred-feature)

---

## Feature 001 — Authentication and Role-Based Access (in review)

**Branch**: `001-auth-and-roles`
**Status**: implementation complete, awaiting smoke-test + merge approval.
**Date**: 2026-05-17

**Scope shipped**:

- Database: `public.user_role` enum, `public.profiles` table with RLS
  (self-select, admin-select, direct-reports-select, safe-fields self-
  update), `handle_new_user()` trigger seeding `role='employee'`,
  `is_admin()` helper, `admin_update_role` / `admin_update_manager`
  SECURITY DEFINER functions, `reports_under()` recursive-CTE helper
  for future signal-aggregate features.
- Web: `/signup`, `/login`, `/forgot-password`, `/reset-password`,
  `/onboarding`, `/app`, and `/auth/callback` + `POST /api/admin/invite`
  route handlers. Editorial-calm direction across all auth surfaces;
  Mist & Meadow palette with light + dark variants honored from day one.
- Middleware (proxy.ts on Next 16): 5-step gate — unauth→/login,
  auth→/app, full_name-null→/onboarding, full_name-set+on-onboarding→
  /app, otherwise pass through.
- Testing: 9/9 Vitest schema unit tests pass; 12/12 Playwright e2e
  specs pass across chromium + firefox + webkit (4 specs × 3 browsers).

**Gates passed**:

- ✅ Spec gate — all `specs/001-auth-and-roles/` artifacts populated.
- ✅ Constitution Check — Principles I, V, VI, VII, VIII, IX addressed
  in `plan.md`; deviations logged in `docs/DECISIONS.md`.
- ✅ Test gate — typecheck, lint, Vitest, Playwright all green locally.
- ✅ Secrets scan — no `.env*` files committed, no hardcoded keys.
- ⏳ Smoke-test gate — pending Mohamed's run of
  `specs/001-auth-and-roles/smoke-tests.md` (T041, manual).
- ⏳ Privacy review — note in `plan.md`'s Constitution Check.
- ⏳ Mohamed's final review and merge to `main`.

**Deviations logged in DECISIONS.md**:

- Next.js 16 (not 15)
- Vitest config is `.mts`, environment is `happy-dom`
- shadcn/ui not pulled
- Playwright `workers: 1`
- Migration packaging split: T013 (`admin_update_role` / `admin_update_manager`)
  and T014 (`reports_under`) are separate migration files rather than
  embedded in `20260517000020_profiles_rls.sql` per `contracts/migrations.md`.
  Documented in `tasks.md` § Cross-cutting notes.
- `middleware.ts` written as `proxy.ts` (Next 16 file convention).

**Bug discovered and fixed during implementation**:

- `POST /api/admin/invite` initially called the SECURITY DEFINER RPCs
  via the service-role client. `is_admin()` evaluates `auth.uid()`,
  which is NULL for service-role calls, so every invite returned 500
  with `role_update_failed: forbidden`. Fixed by routing the RPCs
  through the caller's session client (the admin client is now used
  only for `auth.admin.inviteUserByEmail`).
