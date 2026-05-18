-- Feature 001 — auth-and-roles
-- T014: reports_under(uid) — transitive reports helper.
--
-- No consumer in feature 001. Defined now so signal-aggregate features
-- (005, 010, 011) can rely on a single contract for "who reports under
-- this user (recursively)?" without duplicating the recursive CTE.
--
-- Skip-level note: this function returns BOTH direct reports and
-- transitive reports. Future signal-table RLS policies MUST still
-- enforce that skip-level managers see only aggregates, never
-- per-employee rows (Constitution Principle I, spec amendment
-- 2026-05-17).

CREATE OR REPLACE FUNCTION public.reports_under(uid uuid)
RETURNS SETOF uuid
LANGUAGE sql STABLE AS $$
  WITH RECURSIVE chain AS (
    SELECT id FROM public.profiles WHERE manager_id = uid
    UNION
    SELECT p.id FROM public.profiles p
      JOIN chain c ON p.manager_id = c.id
  )
  SELECT id FROM chain;
$$;

GRANT EXECUTE ON FUNCTION public.reports_under(uuid) TO authenticated;
