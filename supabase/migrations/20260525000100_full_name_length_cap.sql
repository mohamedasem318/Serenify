-- Security slice 3 — Finding 6 — layer-independent backstop on full_name length.
--   Branch:    security/03-privileged-endpoints-and-input-validation
--   Audit:     docs/security/03-privileged-endpoints-and-input-validation.md
--   Decisions: docs/DECISIONS.md (2026-05-25 — Security slice 3)
--
-- App-layer Zod (lib/auth/schemas.ts fullNameSchema) is the primary control;
-- this CHECK guarantees no non-form writer (a future Server Action, a job, or
-- a direct DB write that bypasses the Zod gate) can persist an arbitrarily
-- large value into the unbounded `text` column. Length and character class are
-- different calculus: this migration intentionally caps ONLY length — the
-- character-class restriction (\p{Cc}\p{Cf}) stays at the app layer per
-- slice-1 Finding 7's routing, while length warrants a DB backstop because it
-- matters even when render-escaping holds.
--
-- NULL is allowed: invited users (POST /api/admin/invite) get full_name = NULL
-- until they complete onboarding.
ALTER TABLE public.profiles
  ADD CONSTRAINT profiles_full_name_length_check
  CHECK (full_name IS NULL OR char_length(full_name) <= 120);
