-- Feature 001 — auth-and-roles
-- T008: introduce the closed user_role enum used by profiles.role.

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_type WHERE typname = 'user_role'
  ) THEN
    CREATE TYPE public.user_role AS ENUM ('employee', 'team_lead', 'admin');
  END IF;
END
$$;
