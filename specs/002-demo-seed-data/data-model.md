# Data Model: Demo Seed Data

**Feature**: `002-demo-seed-data`
**Phase**: 1
**Date**: 2026-05-18

This feature **introduces no new schema**. No migrations are added; no
columns, tables, indexes, RLS policies, triggers, or SECURITY DEFINER
functions are created (FR-015, FR-016). The seed script writes to the
exact `auth.users` and `public.profiles` shapes feature 001 shipped.

This document exists to (a) restate the shape the script depends on so a
reader does not need to cross-reference feature 001, and (b) pin the
canonical 30-slot hierarchy that `buildHierarchy(1729)` produces.

## Schema consumed (unchanged from feature 001)

### `auth.users` (Supabase-managed)

The seed touches only these fields:

- `id uuid primary key`
- `email text unique`
- `encrypted_password` (set via `auth.admin.createUser`, not read)
- `email_confirmed_at timestamptz` (forced non-null via `email_confirm: true`)
- `raw_user_meta_data jsonb` (the seed writes `{ full_name }` here for parity with the signup flow; the value of record is `profiles.full_name` set by the trigger and then overwritten by the seed)

### `public.profiles`

```text
id           uuid          primary key, FK -> auth.users(id) ON DELETE CASCADE
full_name    text          not null
role         user_role     not null default 'employee'    -- enum: employee | team_lead | admin
manager_id   uuid          nullable, FK -> profiles(id) ON DELETE SET NULL
created_at   timestamptz   not null default now()
updated_at   timestamptz   not null default now()
```

The trigger from feature 001's migration `20260517000030_profile_trigger.sql` inserts a `profiles` row on every `auth.users` insert with `role = 'employee'` and `full_name = COALESCE(raw_user_meta_data->>'full_name', '')`. The seed depends on that trigger firing — its second pass UPDATEs `role`, `manager_id`, and `full_name` (the last for safety, in case the trigger races with the metadata write).

RLS on `profiles` is bypassed under a service-role client (FR-018, DECISIONS 2026-05-17).

## Canonical 30-slot hierarchy

`buildHierarchy(1729)` returns this exact table (names placeholder `Fn`,
`Ln` — the actual names are produced by faker at slot generation time
and pinned in `scripts/__tests__/hierarchy.test.ts`):

| Slot | Email local | Role | manager_slot | Notes |
|------|-------------|------|--------------|-------|
| 0 | `f0.l0.01` | admin | `null` | Root — anchors chains for slots 2, 5, 6 |
| 1 | `f1.l1.02` | admin | `null` | Root — anchors chains for slots 3, 7, 8 |
| 2 | `f2.l2.03` | employee | 0 | Direct-to-admin edge (FR-006(c), edge 1 of 2) |
| 3 | `f3.l3.04` | employee | 1 | Direct-to-admin edge (FR-006(c), edge 2 of 2) |
| 4 | `f4.l4.05` | employee | 6 | Reports to TL2 |
| 5 | `f5.l5.06` | team_lead | 0 | TL1 — 4 direct reports |
| 6 | `f6.l6.07` | team_lead | 0 | TL2 — 5 direct reports |
| 7 | `f7.l7.08` | team_lead | 1 | TL3 — 4 direct reports |
| 8 | `f8.l8.09` | team_lead | 1 | TL4 — 5 direct reports |
| 9 | `f9.l9.10` | team_lead | 5 | TL5 — reports to TL1 (FR-006(b)) — 4 direct reports |
| 10 | `f10.l10.11` | employee | 5 | Under TL1 |
| 11 | `f11.l11.12` | employee | 5 | Under TL1 |
| 12 | `f12.l12.13` | employee | 5 | Under TL1 |
| 13 | `f13.l13.14` | employee | 6 | Under TL2 |
| 14 | `f14.l14.15` | employee | 6 | Under TL2 |
| 15 | `f15.l15.16` | employee | 6 | Under TL2 |
| 16 | `f16.l16.17` | employee | 6 | Under TL2 |
| 17 | `f17.l17.18` | employee | 7 | Under TL3 |
| 18 | `f18.l18.19` | employee | 7 | Under TL3 |
| 19 | `f19.l19.20` | employee | 7 | Under TL3 |
| 20 | `f20.l20.21` | employee | 7 | Under TL3 |
| 21 | `f21.l21.22` | employee | 8 | Under TL4 |
| 22 | `f22.l22.23` | employee | 8 | Under TL4 |
| 23 | `f23.l23.24` | employee | 8 | Under TL4 |
| 24 | `f24.l24.25` | employee | 8 | Under TL4 |
| 25 | `f25.l25.26` | employee | 8 | Under TL4 |
| 26 | `f26.l26.27` | employee | 9 | Under TL5 |
| 27 | `f27.l27.28` | employee | 9 | Under TL5 |
| 28 | `f28.l28.29` | employee | 9 | Under TL5 |
| 29 | `f29.l29.30` | employee | 9 | Under TL5 |

(`fN.lN` placeholders are the lowercase ASCII-normalized first/last from
faker. The trailing `NN` is `String(slot + 1).padStart(2, "0")`.)

### Invariant check against FR-006

- **(a)** TL1=4, TL2=5, TL3=4, TL4=5, TL5=4 — all in [4, 5]. ✓
- **(b)** Slot 9 (TL5) → slot 5 (TL1) → slot 0 (admin). At least one team-lead-to-team-lead link exists. ✓
- **(c)** Exactly slots 2 and 3 are employees whose `manager_slot` is an admin; slot 2 → admin 0 and slot 3 → admin 1, one to each admin. ✓
- **(d)** Slots 2..29 all have non-null `manager_slot`. ✓
- **(e)** Slots 0 and 1 have `manager_slot = null`. ✓

### Direct-report fan-out by parent

| Parent slot | Direct-report slots | Count |
|-------------|---------------------|-------|
| 0 (admin) | 2, 5, 6 | 3 |
| 1 (admin) | 3, 7, 8 | 3 |
| 5 (TL1) | 9, 10, 11, 12 | 4 |
| 6 (TL2) | 4, 13, 14, 15, 16 | 5 |
| 7 (TL3) | 17, 18, 19, 20 | 4 |
| 8 (TL4) | 21, 22, 23, 24, 25 | 5 |
| 9 (TL5) | 26, 27, 28, 29 | 4 |

Sum check: 3 + 3 + 4 + 5 + 4 + 5 + 4 = 28. The two admin slots are roots
(not direct reports), so 28 + 2 = 30. ✓

## Cohort identity

The `@demo.serenify.local` email suffix is the single boundary the script
uses to identify the demo cohort (FR-002). The script:

- Lists `auth.users` and filters in-memory by the suffix to decide create-vs-skip (FR-008).
- Deletes by `auth.admin.deleteUser(id)` for every listed user whose email matches the suffix (FR-009).
- Never reads, writes, or deletes a user whose email does not match (FR-003).

`public.profiles.email` is NOT a column (per FR-015 — feature 001 deliberately keeps email out of `profiles`). The seed reasons about identity exclusively via `auth.users.email`.

## What the seed does NOT touch

For completeness:

- No signal-event tables (they don't exist until feature 006).
- No `auth.identities` rows beyond what Supabase creates automatically on `auth.admin.createUser`.
- No Supabase Storage objects (no avatar uploads — FR explicitly excludes).
- No `auth.sessions` (no session forging).
- No `public.profiles` rows whose `id` does not match an `auth.users` row in the demo cohort.
- No bootstrap admin from the feature-001 quickstart (its email lives outside the demo pattern).
