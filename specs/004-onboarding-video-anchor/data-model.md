# Phase 1 Data Model: Onboarding Video Anchor Flow

This feature adds three columns to the existing `public.profiles` table
(feature 001). No new tables. The authorization change (a SELECT column
whitelist) is the load-bearing privacy mechanism — see 📌 DECISION-12 and
`contracts/migration.md`.

## `public.profiles` — added columns

| Column | Type | Null | Default | Written by | Readable by |
|--------|------|------|---------|-----------|-------------|
| `anchor_vector` | `bytea` | YES | NULL | Owner (own row, session client) or `service_role` (seed) | **No client role** — excluded from the SELECT whitelist (Principle I). `service_role` only. |
| `anchor_captured_at` | `timestamptz` | YES | NULL | Owner (own row) or `service_role` | **No client role** — excluded from the SELECT whitelist. `service_role` only. |
| `anchor_model_version` | `text` | YES | NULL | Owner (own row) or `service_role` | **No client role** — excluded from the SELECT whitelist. `service_role` only. |

- **Nullability**: all three are nullable. A profile with no anchor (every new
  employee before calibration; every manager forever) is valid. "Has the user
  calibrated?" is exposed **only** via the scope-guarded SECURITY DEFINER
  function `has_anchor(auth.uid())` (returns `anchor_vector IS NOT NULL` for the
  caller's own row; raises if asked about anyone else). No client role can read
  `anchor_captured_at` directly — see `contracts/migration.md`.
- **No CHECK constraint** on `octet_length(anchor_vector)`. The web app only ever
  writes a vector it received from the backend (`dim: 2958` in the response);
  the encoding contract (11832 = 2958 × 4 LE float32 bytes) is enforced in the
  application layer.
- **No FK, no index.** The columns are read only via the owning row
  (`id = auth.uid()`), already covered by the PK. No query filters on these
  columns in 004.

## Encoding contract

`anchor_vector` is the 2958-d float vector serialized as **little-endian
float32**, 4 bytes per element = **11832 bytes**.

- **Backend → web** (`POST /anchor` response): base64 of those 11832 bytes
  (`vector_b64`).
- **Web → DB**: decode base64 → `Uint8Array`/`Buffer` → `\x…` hex literal for the
  `bytea` column (written via the user's session Supabase client).
- **DB → feature 005** (future, out of scope): read the `bytea` → `np.frombuffer(buf, dtype="<f4")`
  → `(2958,)` array → subtract from live features at inference.
- **Demo seed**: `mulberry32(42)` → 2958 float32 → same 11832-byte encoding via
  `service_role`.
- **Debug**: `packages/ml-video/scripts/inspect_anchor.py` reads a stored blob and
  prints shape/min/max/mean.

## State / lifecycle (a profile's anchor)

```text
(new employee, anchor_* all NULL)
      │  records 60s → POST /anchor → 200 → web writes own row
      ▼
(calibrated: anchor_vector + anchor_captured_at + anchor_model_version set)   ── terminal for 004
```

- Skip / failure-escape leave the row at NULL (the banner shows on `/app`).
- Re-calibration via `/app/calibrate` overwrites the three columns (same write
  path).
- Manager/admin rows stay all-NULL forever (no anchor flow for them, FR-029).
- `anchor_model_version` exists for a **future** model-bump invalidation flow
  (out of scope, FR-020) — 004 never compares or invalidates on it.

## Entities consumed unchanged (feature 001)

- `public.profiles` columns `id, full_name, role, manager_id, created_at,
  updated_at` — read as today. The `role` column drives the employee-only gating
  (FR-029). `full_name` IS NULL still drives the proxy onboarding gate.
- RLS policies `profiles_select_self`, `profiles_select_admin`,
  `profiles_select_direct_reports`, `profiles_update_self_safe_fields` — **left
  unchanged**. The privacy guarantee for the anchor columns comes from the
  column GRANT change (all three excluded from the `authenticated` SELECT
  whitelist) plus the scope-guarded `has_anchor()` SECURITY DEFINER function —
  not a policy change (see `contracts/migration.md`).
