"""T002 — `recommendation_picks` RLS/posture gate (014, SC-003, FR-025).

Static parse of the 014 migration (no live DB — CI-runnable). Pins every invariant in
specs/014-recommendations/contracts/recommendation-storage-rls.md, one named assertion
per posture line, so deleting any single line from the migration fails a test that says
which line it was:

  * ENABLE + FORCE RLS, never turned back off
    → test_rls_enabled_and_forced, test_rls_is_never_disabled_or_unforced,
      test_no_other_migration_disables_rls_on_the_table
  * exactly three owner policies, owner-scoped, `authenticated` only
    → test_exactly_three_owner_policies,
      test_every_policy_is_owner_self_scoped_to_authenticated,
      test_policy_predicates_are_exactly_the_owner_predicate,
      test_every_policy_role_list_is_exactly_authenticated
  * no DELETE path
    → test_no_delete_policy, test_no_delete_grant
  * no manager / admin / team-lead / aggregate reach
    → test_no_manager_admin_aggregate_or_team_lead_path
  * no seeder path
    → test_no_seeder_path
  * no SECURITY DEFINER reaches the table
    → test_no_security_definer_in_this_migration,
      test_no_security_definer_function_anywhere_touches_the_table
  * revoke-before-grant; anon and PUBLIC end with nothing
    → test_anon_and_authenticated_revoked_before_grants,
      test_anon_is_never_re_granted, test_public_is_never_a_grantee
  * exactly two grants, column-scoped UPDATE, verbatim
    → test_grants_on_the_table_are_exactly_two_verbatim_statements,
      test_no_grant_all_on_the_table, test_update_grant_is_column_scoped_verbatim,
      test_no_table_wide_update_grant,
      test_identity_and_provenance_columns_are_not_updatable
  * the three named CHECKs → test_named_check_constraints
  * the partial unique index → test_partial_unique_one_active_per_user_day
  * no other migration widens the table
    → test_no_other_migration_adds_a_policy_or_grant

The gate is written to catch ADDITIONS as well as deletions: policy and grant
statements are compared as EXACT SETS (normalised whitespace), policy predicates as
exact expressions rather than substrings, and role lists as exact sets — so a widening
such as `OR true`, `TO authenticated, anon`, `GRANT ALL`, `TO PUBLIC`, an unqualified
`ON recommendation_picks` policy, or a trailing `NO FORCE ROW LEVEL SECURITY` each
fails a named test.

Mirrors apps/api/tests/test_chat_storage_rls.py (the 011 posture gate).
"""

from __future__ import annotations

import re
from pathlib import Path

# Repo root: apps/api/tests/test_recommendation_storage_rls.py -> parents[3] == repo root.
_MIGRATIONS = Path(__file__).resolve().parents[3] / "supabase" / "migrations"
_MIGRATION = _MIGRATIONS / "20260815090000_recommendation_picks.sql"
_TABLE = "recommendation_picks"

_EXPECTED_POLICIES = {
    "rp_select_self",
    "rp_insert_self",
    "rp_update_self",
}

# The owner predicate, normalised (whitespace collapsed, lower-cased). Policy USING /
# WITH CHECK expressions must equal this EXACTLY — substring containment would accept
# `((select auth.uid()) = user_id OR true)`.
_OWNER_PREDICATE = "(select auth.uid()) = user_id"

# The complete set of GRANT statements targeting the table, normalised. An exact set
# means an ADDED grant fails just as loudly as a deleted one.
_EXPECTED_GRANTS = {
    "GRANT SELECT, INSERT ON public.recommendation_picks TO authenticated;",
    "GRANT UPDATE (confirmed_at, opened_at, outcome, outcome_at, swapped_away_at, "
    "updated_at) ON public.recommendation_picks TO authenticated;",
}

# The column-scoped UPDATE grant list (contract §4) — verbatim, in order.
_UPDATE_GRANT_COLUMNS = [
    "confirmed_at",
    "opened_at",
    "outcome",
    "outcome_at",
    "swapped_away_at",
    "updated_at",
]

# Identity + provenance: immutable after insert BY GRANT (data-model §2).
_IMMUTABLE_COLUMNS = (
    "user_id",
    "local_day",
    "episode_id",
    "item_id",
    "category",
    "source",
    "suggested_at",
)

# Tokens that would indicate a manager / admin / aggregate / cross-user reach.
_MANAGER_TOKENS = (
    "manager",
    "team_lead",
    "reports_to",
    "reports_under",
    "is_admin",
    "admin",
    "aggregate",
)

# Statements that would undo the RLS posture after it was established.
_RLS_OFF_TOKENS = ("no force row level security", "disable row level security")

_POLICY_RE = re.compile(
    # `public.` is OPTIONAL: an unqualified `ON recommendation_picks` policy is just as
    # real to Postgres, and must not slip past the enumeration.
    r"CREATE\s+POLICY\s+(\w+)\s+ON\s+(?:public\.)?(\w+)(.*?);",
    re.IGNORECASE | re.DOTALL,
)
_GRANT_RE = re.compile(r"\bGRANT\b.*?;", re.IGNORECASE | re.DOTALL)
_USING_RE = re.compile(r"\bUSING\s*\(", re.IGNORECASE)
_WITH_CHECK_RE = re.compile(r"\bWITH\s+CHECK\s*\(", re.IGNORECASE)
# Dollar quoting is tagged or bare: $$ … $$ and $tag$ … $tag$ are both function bodies.
_DOLLAR_QUOTE_RE = re.compile(r"\$(\w*)\$(.*?)\$\1\$", re.DOTALL)


def _sql() -> str:
    return _MIGRATION.read_text(encoding="utf-8")


def _strip_comments(sql: str) -> str:
    """Drop `-- …` comments so the explanatory header (which names the forbidden
    things on purpose) never produces a false match."""
    return "\n".join(re.sub(r"--.*$", "", line) for line in sql.splitlines())


def _norm(text: str) -> str:
    """Collapse whitespace and lower-case — the form every exact comparison uses."""
    return re.sub(r"\s+", " ", text).strip().lower()


def _table_body(sql: str) -> str:
    m = re.search(
        rf"CREATE TABLE public\.{_TABLE}\s*\((.*?)\n\);",
        sql,
        re.IGNORECASE | re.DOTALL,
    )
    assert m, f"no CREATE TABLE public.{_TABLE} found"
    return m.group(1)


def _balanced_paren(text: str, open_idx: int) -> str:
    """The content between the `(` at ``open_idx`` and its matching `)`."""
    assert text[open_idx] == "(", "expected an opening parenthesis"
    depth = 0
    for i in range(open_idx, len(text)):
        if text[i] == "(":
            depth += 1
        elif text[i] == ")":
            depth -= 1
            if depth == 0:
                return text[open_idx + 1 : i]
    raise AssertionError("unbalanced parentheses in policy expression")


def _policies(sql: str) -> list[tuple[str, str, str]]:
    """(name, table, body) for each CREATE POLICY in comment-stripped SQL."""
    return [(m.group(1), m.group(2), m.group(3)) for m in _POLICY_RE.finditer(sql)]


def _policy_expr(body: str, opener: re.Pattern[str]) -> str | None:
    """The USING / WITH CHECK expression of a policy body, or None if absent."""
    m = opener.search(body)
    if not m:
        return None
    return _balanced_paren(body, m.end() - 1)


def _policy_roles(body: str) -> set[str]:
    """The policy's role list. A policy with NO `TO` clause applies to PUBLIC —
    returning that explicitly means the omission fails the exact-set assertion."""
    m = re.search(
        r"\bTO\s+(.*?)(?=\s*(?:\bUSING\b|\bWITH\s+CHECK\b)|\s*$)",
        body,
        re.IGNORECASE | re.DOTALL,
    )
    if not m:
        return {"public"}
    return {r.strip().lower() for r in m.group(1).split(",") if r.strip()}


def _grant_statements(sql: str) -> list[str]:
    """Every `GRANT … ;` statement, normalised."""
    return [_norm(m.group(0)) for m in _GRANT_RE.finditer(sql)]


def _grants_on_table(sql: str) -> list[str]:
    return [g for g in _grant_statements(sql) if _TABLE in g]


# ── existence ────────────────────────────────────────────────────────────────


def test_migration_exists():
    assert _MIGRATION.is_file(), _MIGRATION


def test_migration_sorts_after_the_seeding_identity_migration():
    """Migrations apply in filename order; this one must land after 20260814000000."""
    assert _MIGRATION.name > "20260814000000_seeding_identity.sql"


# ── contract §1 — ENABLE + FORCE RLS ─────────────────────────────────────────


def test_rls_enabled_and_forced():
    sql = _strip_comments(_sql())
    assert re.search(rf"{_TABLE}\s+ENABLE\s+ROW LEVEL SECURITY", sql, re.IGNORECASE)
    assert re.search(rf"{_TABLE}\s+FORCE\s+ROW LEVEL SECURITY", sql, re.IGNORECASE)


def test_rls_is_never_disabled_or_unforced():
    """A later statement in the same file could quietly undo the two lines above."""
    sql = _norm(_strip_comments(_sql()))
    for token in _RLS_OFF_TOKENS:
        assert token not in sql, f"{token!r} present — the RLS posture is undone"


def test_no_other_migration_disables_rls_on_the_table():
    for path in sorted(_MIGRATIONS.glob("*.sql")):
        sql = _norm(_strip_comments(path.read_text(encoding="utf-8")))
        if _TABLE not in sql:
            continue
        for token in _RLS_OFF_TOKENS:
            assert token not in sql, f"{path.name} contains {token!r}"


# ── contract §2 — exactly three owner policies ───────────────────────────────


def test_exactly_three_owner_policies():
    names = {name for name, _t, _b in _policies(_strip_comments(_sql()))}
    assert names == _EXPECTED_POLICIES


def test_every_policy_is_owner_self_scoped_to_authenticated():
    policies = _policies(_strip_comments(_sql()))
    assert policies, "expected RLS policies on recommendation_picks — found none"
    for name, table, body in policies:
        lowered = body.lower()
        assert table == _TABLE, f"{name} targets {table}, not {_TABLE}"
        assert "to authenticated" in lowered, f"{name} is not scoped TO authenticated"
        assert _OWNER_PREDICATE in lowered, f"{name} lacks the owner predicate"


def test_every_policy_role_list_is_exactly_authenticated():
    """`TO authenticated, anon` contains `authenticated` — exact-set equality is what
    actually forbids it, and so does an omitted `TO` clause (which means PUBLIC)."""
    for name, _table, body in _policies(_strip_comments(_sql())):
        assert _policy_roles(body) == {"authenticated"}, (
            f"{name} role list is {sorted(_policy_roles(body))}, expected ['authenticated']"
        )


def test_policy_predicates_are_exactly_the_owner_predicate():
    """Exact expression equality, not containment: `… = user_id OR true` must fail."""
    stripped = _strip_comments(_sql())
    seen: dict[str, tuple[str | None, str | None]] = {}
    for name, _table, body in _policies(stripped):
        using = _policy_expr(body, _USING_RE)
        with_check = _policy_expr(body, _WITH_CHECK_RE)
        for label, expr in (("USING", using), ("WITH CHECK", with_check)):
            if expr is not None:
                assert _norm(expr) == _OWNER_PREDICATE, (
                    f"{name} {label} is {_norm(expr)!r}, expected {_OWNER_PREDICATE!r}"
                )
        seen[name] = (using, with_check)
    # Each policy carries exactly the clauses its command needs — no more, no fewer.
    assert seen["rp_select_self"][0] is not None and seen["rp_select_self"][1] is None
    assert seen["rp_insert_self"][0] is None and seen["rp_insert_self"][1] is not None
    assert all(e is not None for e in seen["rp_update_self"])


def test_select_insert_update_policies_carry_the_right_clauses():
    bodies = {n: b.lower() for n, _t, b in _policies(_strip_comments(_sql()))}
    assert "for select" in bodies["rp_select_self"] and "using" in bodies["rp_select_self"]
    assert "for insert" in bodies["rp_insert_self"] and "with check" in bodies["rp_insert_self"]
    upd = bodies["rp_update_self"]
    assert "for update" in upd and "using" in upd and "with check" in upd


# ── contract §3 — nothing else may touch the table ───────────────────────────


def test_no_delete_policy():
    for name, _t, body in _policies(_strip_comments(_sql())):
        assert "for delete" not in body.lower(), f"{name} is a DELETE policy"
        assert "for all" not in body.lower(), f"{name} is a FOR ALL policy (implies DELETE)"


def test_no_delete_grant():
    for grant in _grants_on_table(_strip_comments(_sql())):
        assert "delete" not in grant, f"DELETE granted: {grant}"


def test_no_manager_admin_aggregate_or_team_lead_path():
    sql = _strip_comments(_sql()).lower()
    for token in _MANAGER_TOKENS:
        assert token not in sql, f"manager-layer token {token!r} present in the migration"


def test_no_service_role_path():
    assert "service_role" not in _strip_comments(_sql()).lower()


def test_no_seeder_path():
    """contract §5: serenify_seeder gets grants/policies only if a fixture demonstrably
    writes picks. None does, so the role must be absent entirely."""
    assert "serenify_seeder" not in _strip_comments(_sql()).lower()


def test_no_security_definer_in_this_migration():
    sql = _strip_comments(_sql()).lower()
    assert "security definer" not in sql
    assert "create function" not in sql
    assert "create or replace function" not in sql


def test_no_security_definer_function_anywhere_touches_the_table():
    """No function body in ANY migration may reference the table — a DEFINER body would
    run as its owner and sidestep the owner-only policies above. Both bare `$$ … $$` and
    tagged `$tag$ … $tag$` quoting are scanned."""
    for path in sorted(_MIGRATIONS.glob("*.sql")):
        sql = _strip_comments(path.read_text(encoding="utf-8"))
        for m in _DOLLAR_QUOTE_RE.finditer(sql):
            assert _TABLE not in m.group(2).lower(), (
                f"{path.name} defines a function body referencing {_TABLE}"
            )


def test_no_other_migration_adds_a_policy_or_grant():
    """The table's whole posture lives in one file; nothing else may widen it."""
    for path in sorted(_MIGRATIONS.glob("*.sql")):
        if path.name == _MIGRATION.name:
            continue
        sql = _strip_comments(path.read_text(encoding="utf-8")).lower()
        assert _TABLE not in sql, f"{path.name} references {_TABLE}"


# ── contract §4 — revoke first, then exactly two grants ──────────────────────


def test_anon_and_authenticated_revoked_before_grants():
    sql = _strip_comments(_sql())
    revoke = re.search(
        rf"REVOKE\s+ALL\s+ON\s+public\.{_TABLE}\s+FROM\s+anon,\s*authenticated",
        sql,
        re.IGNORECASE,
    )
    assert revoke, "missing REVOKE ALL ... FROM anon, authenticated"
    first_grant = re.search(rf"GRANT\b[^;]*{_TABLE}", sql, re.IGNORECASE | re.DOTALL)
    assert first_grant, "no grants found"
    assert revoke.start() < first_grant.start(), "REVOKE must precede every GRANT"


def test_grants_on_the_table_are_exactly_two_verbatim_statements():
    """An EXACT set: an added grant of any shape fails here, not just a removed one."""
    grants = _grants_on_table(_strip_comments(_sql()))
    assert len(grants) == 2, f"expected exactly 2 GRANT statements, found {len(grants)}: {grants}"
    assert set(grants) == {_norm(g) for g in _EXPECTED_GRANTS}, grants


def test_no_grant_all_on_the_table():
    for grant in _grants_on_table(_strip_comments(_sql())):
        assert not re.match(r"grant all\b", grant), f"GRANT ALL on the table: {grant}"


def test_anon_is_never_re_granted():
    for grant in _grants_on_table(_strip_comments(_sql())):
        assert not re.search(r"\bto\b[^;]*\banon\b", grant), f"anon re-granted: {grant}"


def test_public_is_never_a_grantee():
    """`TO PUBLIC` hands the privilege to every role, including anon."""
    for grant in _grants_on_table(_strip_comments(_sql())):
        assert not re.search(r"\bto\b[^;]*\bpublic\b(?!\.)", grant), f"PUBLIC granted: {grant}"


def test_select_and_insert_are_table_wide_grants_to_authenticated():
    assert re.search(
        rf"GRANT\s+SELECT,\s*INSERT\s+ON\s+public\.{_TABLE}\s+TO\s+authenticated",
        _strip_comments(_sql()),
        re.IGNORECASE,
    )


def test_update_grant_is_column_scoped_verbatim():
    m = re.search(
        rf"GRANT\s+UPDATE\s*\(([^)]*)\)\s*ON\s+public\.{_TABLE}\s+TO\s+authenticated",
        _strip_comments(_sql()),
        re.IGNORECASE | re.DOTALL,
    )
    assert m, "no column-scoped GRANT UPDATE (...) on the table"
    cols = [c.strip() for c in m.group(1).split(",") if c.strip()]
    assert cols == _UPDATE_GRANT_COLUMNS, cols


def test_no_table_wide_update_grant():
    assert not re.search(
        rf"GRANT\s+[A-Z, ]*\bUPDATE\b\s+ON\s+public\.{_TABLE}",
        _strip_comments(_sql()),
        re.IGNORECASE,
    ), "UPDATE must be column-scoped, never a table-wide grant"


def test_identity_and_provenance_columns_are_not_updatable():
    m = re.search(
        rf"GRANT\s+UPDATE\s*\(([^)]*)\)\s*ON\s+public\.{_TABLE}",
        _strip_comments(_sql()),
        re.IGNORECASE | re.DOTALL,
    )
    assert m
    cols = {c.strip() for c in m.group(1).split(",")}
    for col in _IMMUTABLE_COLUMNS:
        assert col not in cols, f"{col} must be immutable by grant"


# ── data-model §2 — shape, constraints, indexes ──────────────────────────────


def test_owner_fk_cascades_from_auth_users():
    body = _table_body(_strip_comments(_sql()))
    assert re.search(
        r"user_id[^,]*REFERENCES auth\.users\(id\)\s*ON DELETE CASCADE",
        body,
        re.IGNORECASE | re.DOTALL,
    )


def test_named_check_constraints():
    body = _table_body(_strip_comments(_sql()))
    normalised = re.sub(r"\s+", " ", body)
    assert (
        "CONSTRAINT rp_outcome_iff_at CHECK ((outcome IS NULL) = (outcome_at IS NULL))"
        in normalised
    )
    assert (
        "CONSTRAINT rp_outcome_requires_opened CHECK (outcome IS NULL OR opened_at IS NOT NULL)"
        in normalised
    )
    assert (
        "CONSTRAINT rp_outcome_xor_swap CHECK "
        "(NOT (outcome IS NOT NULL AND swapped_away_at IS NOT NULL))" in normalised
    )


def test_enumerated_value_checks():
    body = re.sub(r"\s+", " ", _table_body(_strip_comments(_sql())))
    assert "item_id ~ '^[a-z0-9-]{1,64}$'" in body
    assert (
        "category IN ('breathing_grounding', 'movement', 'sensory_reset', "
        "'taking_a_break', 'connection')" in body
    )
    assert "source IN ('reading', 'confirmed')" in body
    assert "outcome IN ('helped', 'didnt_help')" in body


def test_user_day_index():
    assert re.search(
        rf"CREATE INDEX rp_user_day_idx\s+ON public\.{_TABLE}\s*"
        r"\(\s*user_id,\s*local_day,\s*suggested_at DESC\s*\)",
        _strip_comments(_sql()),
        re.IGNORECASE,
    )


def test_partial_unique_one_active_per_user_day():
    assert re.search(
        rf"CREATE UNIQUE INDEX rp_one_active_per_user_day\s+ON public\.{_TABLE}\s*"
        r"\(\s*user_id,\s*local_day\s*\)\s*"
        r"WHERE outcome IS NULL AND swapped_away_at IS NULL",
        _strip_comments(_sql()),
        re.IGNORECASE,
    )


def test_touch_updated_at_trigger():
    assert re.search(
        rf"CREATE TRIGGER rp_touch_updated_at\s+BEFORE UPDATE ON public\.{_TABLE}\s+"
        r"FOR EACH ROW EXECUTE FUNCTION public\.touch_updated_at\(\)",
        _strip_comments(_sql()),
        re.IGNORECASE,
    )
