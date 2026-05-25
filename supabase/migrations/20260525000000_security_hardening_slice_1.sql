-- Security slice 1 — RLS + SECURITY DEFINER hardening
--   Branch:    security/01-rls-and-security-definer
--   Audit:     docs/security/01-rls-and-security-definer.md
--   Decisions: docs/DECISIONS.md (2026-05-25 — RLS hardening: slice 1)
--
-- Applies the six approved fixes from the slice-1 audit. No schema or
-- column changes; this migration only hardens the authorization layer:
--   F1  admin_update_manager — reject multi-node manager cycles
--   F2  admin_update_role    — reject demotions that would empty the admin set
--   F3  REVOKE PUBLIC EXECUTE on the privileged SECURITY DEFINER functions
--   F4  tighten table grants — column whitelist for authenticated; DML off anon
--   F5  pin OWNER TO postgres on the remaining DEFINER / helper functions
--   F6  reports_under — EXECUTE revoked from all roles until the first consumer
--
-- Finding 7 (full_name validation) is intentionally NOT here — routed to
-- slice 3 (signup Server Action validation). No DB CHECK on full_name.
-- reports_under is intentionally NOT given a CYCLE clause: its UNION already
-- dedups so termination is guaranteed; the cycle defense lives in F1.

-- ── F1 ── admin_update_manager: multi-node cycle guard ──────────────────
-- A cycle forms iff the prospective manager is already a transitive REPORT
-- of the target, i.e. new_manager_id ∈ reports_under(target_user_id).
-- Running as postgres (SECURITY DEFINER), the INVOKER reports_under called
-- from here traverses the full graph with RLS bypassed — correct for this
-- check. Signature, OWNER, search_path and the existing self-cycle /
-- manager-existence guards are unchanged; only the cycle guard is added,
-- before the UPDATE.
CREATE OR REPLACE FUNCTION public.admin_update_manager(
  target_user_id   uuid,
  new_manager_id   uuid
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'forbidden: admin role required'
      USING ERRCODE = '42501';
  END IF;

  IF new_manager_id IS NOT NULL AND new_manager_id = target_user_id THEN
    RAISE EXCEPTION 'a profile may not be its own manager'
      USING ERRCODE = '23514';
  END IF;

  IF new_manager_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM public.profiles WHERE id = new_manager_id
  ) THEN
    RAISE EXCEPTION 'manager profile not found: %', new_manager_id
      USING ERRCODE = 'P0002';
  END IF;

  -- F1: reject if new_manager_id is already a transitive report of the
  -- target — assigning it would close a cycle (A→B→…→A).
  IF new_manager_id IS NOT NULL AND EXISTS (
    SELECT 1 FROM public.reports_under(target_user_id) r(id)
    WHERE r.id = new_manager_id
  ) THEN
    RAISE EXCEPTION 'cycle detected: % is already a transitive report of %',
      new_manager_id, target_user_id
      USING ERRCODE = '23514';
  END IF;

  UPDATE public.profiles
     SET manager_id = new_manager_id
   WHERE id = target_user_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'profile not found: %', target_user_id
      USING ERRCODE = 'P0002';
  END IF;
END;
$$;

ALTER FUNCTION public.admin_update_manager(uuid, uuid) OWNER TO postgres;

-- ── F2 ── admin_update_role: last-admin guard ──────────────────────────
-- The check runs AFTER the UPDATE so it sees the post-UPDATE admin set; a
-- RAISE here rolls back the UPDATE (single-statement transaction). This is
-- a last-admin-ONLY check by design — self-demotion is permitted when a
-- second admin remains (see DECISIONS.md 2026-05-25). Signature, OWNER,
-- search_path and the existing is_admin / not-found guards are unchanged.
CREATE OR REPLACE FUNCTION public.admin_update_role(
  target_user_id uuid,
  new_role       public.user_role
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'forbidden: admin role required'
      USING ERRCODE = '42501';
  END IF;

  UPDATE public.profiles
     SET role = new_role
   WHERE id = target_user_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'profile not found: %', target_user_id
      USING ERRCODE = 'P0002';
  END IF;

  -- F2: a zero-admin deployment locks everyone out of every admin-gated
  -- path with no in-app recovery. Reject and roll back.
  IF NOT EXISTS (SELECT 1 FROM public.profiles WHERE role = 'admin') THEN
    RAISE EXCEPTION 'operation would leave zero admins'
      USING ERRCODE = '23514';
  END IF;
END;
$$;

ALTER FUNCTION public.admin_update_role(uuid, public.user_role) OWNER TO postgres;

-- ── F3 ── strip the unauthenticated audience from privileged functions ──
-- Newly created functions grant EXECUTE to PUBLIC by default; Supabase ALSO
-- grants EXECUTE explicitly to anon/authenticated/service_role via ALTER
-- DEFAULT PRIVILEGES. A bare REVOKE … FROM PUBLIC removes only the pseudo-
-- grant and LEAVES the explicit anon grant intact (empirically verified via
-- pg_proc.proacl). So per function:
--   • is_admin — revoke PUBLIC only; the explicit anon/authenticated grants
--     are RETAINED, because is_admin is called from the profiles_select_admin
--     RLS policy and must remain executable by the role evaluating the query.
--   • admin_update_* — not referenced by any RLS policy, so also revoke the
--     explicit anon grant; the TO-authenticated grant (the legitimate admin
--     caller via the session client) is preserved by CREATE OR REPLACE above.
-- Each function self-gates today (is_admin → false for anon; admin_update_*
-- RAISE 42501 before any data access), so this is attack-surface reduction.

-- Anon EXECUTE retained: required for the profiles_select_admin RLS policy
-- to evaluate without permission_denied on unauthenticated queries.
REVOKE EXECUTE ON FUNCTION public.is_admin() FROM PUBLIC;

REVOKE EXECUTE ON FUNCTION public.admin_update_role(uuid, public.user_role)  FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.admin_update_manager(uuid, uuid)           FROM PUBLIC, anon;

-- ── F4 ── tighten table grants on public.profiles ──────────────────────
-- (a) authenticated: whitelist the row-owner-editable columns instead of
-- blacklisting the privileged ones. The audit's first-proposed
-- `REVOKE UPDATE (role, manager_id) … FROM authenticated` is a NO-OP — a
-- column-level REVOKE has no effect while the role holds table-level UPDATE
-- (Supabase's baseline grant). Verified: has_column_privilege(...,'role',
-- 'UPDATE') still returned true after that revoke. So we drop the
-- table-level UPDATE entirely and re-grant only full_name. role/manager_id
-- are written solely by the SECURITY DEFINER RPCs (as postgres);
-- updated_at is set by the touch_updated_at BEFORE trigger, which needs no
-- column grant on the invoking role (a BEFORE trigger's NEW assignment is
-- not column-privilege-checked against the invoker — empirically verified).
-- Whitelist > blacklist: a forgotten GRANT fails safe (user can't edit a
-- field, fix forward); a forgotten REVOKE fails open (security gap).
-- See DECISIONS.md 2026-05-25 — "column-grant whitelist on public.profiles".
REVOKE UPDATE                ON public.profiles FROM authenticated;
GRANT  UPDATE (full_name)    ON public.profiles TO   authenticated;

-- (b) anon never legitimately writes profiles; strip the latent DML. These
-- are whole-privilege table-level REVOKEs, so they are effective as-is.
REVOKE INSERT, UPDATE, DELETE ON public.profiles FROM anon;

-- ── F5 ── pin OWNER TO postgres for parity across DEFINER / helpers ─────
-- A SECURITY DEFINER function's privilege level IS its owner's; an unpinned
-- owner makes that environment-dependent. admin_update_* already pin owner
-- (re-affirmed in F1/F2 above); pin the rest for consistency. is_admin is
-- DEFINER and called from inside RLS policies, so its owner is load-bearing;
-- reports_under and touch_updated_at are INVOKER (owner matters less) but
-- pinned for parity.
ALTER FUNCTION public.is_admin()          OWNER TO postgres;
ALTER FUNCTION public.handle_new_user()   OWNER TO postgres;
ALTER FUNCTION public.reports_under(uuid) OWNER TO postgres;
ALTER FUNCTION public.touch_updated_at()  OWNER TO postgres;

-- ── F6 ── shrink reports_under exposure to zero ────────────────────────
-- Zero in-code consumers today; it exists as a forward contract for
-- features 005/010/011. Strip EXECUTE from EVERY client role so exposure is
-- genuinely zero until the first consumer lands. REVOKE FROM PUBLIC alone
-- leaves Supabase's explicit anon/authenticated/service_role grants, so all
-- four grantees are enumerated (empirically verified via pg_proc.proacl).
-- Only postgres (owner, after F5) retains EXECUTE — which is why the F1
-- internal call from admin_update_manager (running as postgres) still works.
-- The adopting migration must re-grant deliberately and decide
-- DEFINER-vs-INVOKER + search_path pin + scope guard there (see DECISIONS.md
-- 2026-05-25 — "reports_under() deferred design").
REVOKE EXECUTE ON FUNCTION public.reports_under(uuid)
  FROM PUBLIC, anon, authenticated, service_role;
