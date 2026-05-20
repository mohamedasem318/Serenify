# Changelog

This file records material amendments to feature specs discovered
during planning or implementation, per Constitution Principle VIII.
Entries are append-only.

## 2026-05-17 — spec(001-auth-and-roles) amendment

- Replaced "Team" entity with direct-manager hierarchy
  (`profiles.manager_id` self-FK).
- Onboarding reduced to `full_name` only.
- Skip-level per-employee visibility explicitly forbidden going forward.

Rationale: the privacy model in `PROJECT_SYSTEM_PROMPT.md` requires
direct-manager + skip-level-aggregates-only. Teams as a separate layer
add access-control surface without serving any current privacy
invariant. Teams may return later as a pure grouping concept if
reporting features need them.

## 2026-05-17 — spec(001-auth-and-roles) amendment

- Added FR-020: OTP entry fallback for signup confirmation and
  password reset.
- Added FR-021: Theme toggle on all unauthenticated auth surfaces.

Rationale: Smoke testing revealed (a) Supabase emails ship with both
a magic link and a 6-digit OTP, and the latter currently has no
consumption path in the app — users whose link breaks or arrives
sluggishly are stuck; (b) the existing theme toggle on authed surfaces
makes its absence on the auth surfaces (/login, /signup,
/forgot-password, /reset-password) feel like an oversight rather than
a deliberate design choice, especially since Constitution Principle VI
treats light/dark as equal-priority.

## 2026-05-17 — constitution(V) — display font: Instrument Serif → DM Serif Display
The design token `--font-display` was already swapped on the implementation side (DECISIONS.md entry "Lock display font to DM Serif Display"). The constitution is brought into alignment with the implementation.

## 2026-05-18 — Feature ordering reshuffle

Two reorderings, both because the original ordering put consumers before
their dependencies:

- **005 ↔ 006**: per-user-calibration now precedes stress-inference-service.
  The constitution requires predictions to be deltas from a per-user
  baseline; inference has nothing to subtract from until calibration ships
  first.
- **010/011/012**: privacy-controls-and-transparency moves to 010, ahead of
  the two manager dashboards (now 011 team-lead, 012 admin). The privacy
  slider and visibility-scope rules determine what data the dashboards
  are allowed to query; building them against placeholder defaults would
  force rework when privacy lands.

No code or specs affected — only 001 has shipped; the rest were names in
a list.

## 2026-05-19 — spec(003-employee-dashboard-shell) — Out-of-Scope bullet superseded by hotfix `8dc822b`

`specs/003-employee-dashboard-shell/spec.md` (committed as `f4a1218`,
review-edited through `5de64d2`) contains an Out-of-Scope bullet
naming the `/login?error=expired_link` notice bug as a separate
hotfix branch off `main`, with a recon step before the branch opens.

That hotfix shipped between spec commit and `/speckit.plan`:

- `0acb0e1` — `fix(001): render expired-link notice on /login`
- `8dc822b` — merge of PR #2 onto `main`
- The `003-employee-dashboard-shell` branch's merge-base with
  `main` is `8dc822b`, confirming the branch is rebased onto
  post-hotfix `main`.

The bullet is therefore stale: the bug it points at is fixed, and
the recon step is unnecessary. **The committed spec is NOT
modified.** This entry records the supersession per Principle VIII
(spec amendments live in CHANGELOG, not in retroactive edits to
the spec).

`docs/BACKLOG.md` will be updated during feature 003's
`/speckit.implement` step 13 (smoke tests) to reclassify the
expired-link entry as `merged`.

## 2026-05-20 — feat(003-employee-dashboard-shell) — FR-042 scope clarification: red permitted on destructive action surfaces only

FR-042 originally banned red anywhere in the UI. This amendment
narrows the ban to **in-product affective and ambient surfaces** —
stress detection states, physiological indicators, charts, status
badges, notifications, and any in-product affective copy or imagery.
Red IS permitted on **destructive action surfaces** — delete-account,
leave-team confirmations, revoke-session, and inline destructive text
links — using the Mist & Meadow `crimson` token, because hiding
visual urgency on irreversible user actions is hostile design.

Introduces a new Mist & Meadow token, `--color-crimson` — a washed
red in the same low-saturation tonal family as `--color-amber`.
Values: light `#7B4244`, dark `#C17F81`.

Maps shadcn `--destructive` → `--color-crimson` (was `--color-amber`),
and `--destructive-foreground` → `--color-bg` (symmetric across modes,
same WCAG-AA pattern as `--primary-foreground`).

Affected artifacts, all updated in this commit:

- `.specify/memory/constitution.md` Principle V — palette amended,
  red-rule clarified, version bumped `1.0.0 → 1.1.0` (MINOR per
  Governance: palette addition + scope clarification of an existing
  rule). Sync Impact Report appended with amendment record.
- `docs/DECISIONS.md` — formal architectural decision entry.
- `specs/003-employee-dashboard-shell/plan.md` Decision B — mapping
  table updated; `--destructive` row remapped; `--destructive-foreground`
  row added; load-bearing-choices reference at line 1139 updated.
- `specs/003-employee-dashboard-shell/contracts/shadcn-mapping.md` —
  table updated; `--destructive-foreground` moved out of notes into
  the table proper; canonical implementation block updated to
  crimson + destructive-foreground pair.
- `specs/003-employee-dashboard-shell/tasks.md` — DECISION-2 source
  descriptions at lines 112 and 322 updated to crimson-not-amber.

Rationale: amber + dark-mode ink fails WCAG AA at `1.4:1` (`#DCB587`
amber + `#DCDED5` dark-ink ≈ 1.4:1, well below the 4.5:1 AA floor for
normal text). Symmetric amber → bg mapping fails light mode at
`1.6:1`. Hardcoded dark-text fixes contrast but loses theme
adaptation. A crimson-family color whose luminance positions allow a
symmetric bg-foreground pair to clear AA in both modes (6.08:1 light,
5.02:1 dark) is the cleanest resolution that preserves the
theme-adaptation pattern shared with `--primary-foreground`.

Calm-first compatibility: the chosen crimson values are washed (not
saturated/vibrant). The dark-mode value (`#C17F81`) is closer to a
dusty rose than a red. Both modes feel earthy/muted, consistent with
the Mist & Meadow tonal language. The dark-mode value's lower
saturation + higher lightness counteract the visual weight of dark
backgrounds.

## 2026-05-20 — plan(003-employee-dashboard-shell) — manual shadcn install substituted for `shadcn init`

Feature 003: shadcn CLI 4.7.0's `--preset=base-nova` default
introduces Inter→Geist font swap, red `--destructive`, and a generic
oklch palette that conflict with Constitution Principle V, FR-042,
and Decision B respectively. Manual init (hand-authored
`components.json` + `lib/utils.ts` + direct dep installs) substituted
for `shadcn init`. `shadcn add` retained for primitive scaffolding
only. Decisions A, B, E unchanged; their target outputs match the
manual-init result.

This is a plan AMENDMENT recorded via CHANGELOG, not a re-decision.
Any future re-init must use the manual path until shadcn's defaults
realign with the Decision A/B/E target shape.
