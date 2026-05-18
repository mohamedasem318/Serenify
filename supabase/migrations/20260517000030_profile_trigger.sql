-- Feature 001 — auth-and-roles
-- T011: insert-into-auth.users → seed profiles row.
--
-- role is hard-coded to 'employee'. NEVER read role or manager_id from
-- raw_user_meta_data — that field is client-controllable on self-signup
-- (see research R-5). Privileged values are set later via the SECURITY
-- DEFINER functions admin_update_role / admin_update_manager (T013).

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  INSERT INTO public.profiles (id, full_name, role)
  VALUES (
    NEW.id,
    NEW.raw_user_meta_data->>'full_name',
    'employee'::public.user_role
  );
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();
