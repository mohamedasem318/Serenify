-- Feature 001 — auth-and-roles
-- T013: SECURITY DEFINER functions for the only legitimate write paths
-- on the two privileged columns (role, manager_id). Both verify the
-- caller is admin INSIDE Postgres — defence in depth on top of the
-- route-handler check in POST /api/admin/invite.
--
-- Postgres RLS is row-not-column; there is no first-class way to allow
-- admins to UPDATE only role/manager_id while letting row-owners
-- UPDATE other fields. SECURITY DEFINER functions are the standard
-- escape valve and concentrate every privileged change in two named
-- SQL definitions.

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
END;
$$;

ALTER FUNCTION public.admin_update_role(uuid, public.user_role) OWNER TO postgres;
GRANT EXECUTE ON FUNCTION public.admin_update_role(uuid, public.user_role) TO authenticated;

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
GRANT EXECUTE ON FUNCTION public.admin_update_manager(uuid, uuid) TO authenticated;
