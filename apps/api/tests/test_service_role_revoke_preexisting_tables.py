"""service_role revoke gate for #269 step 2.

Static parse of `20260913100000_revoke_service_role_preexisting_tables.sql` (no live DB
- CI-runnable), in the style of `test_service_role_is_explicitly_revoked` (014). Pins:

  * every public table created by an EARLIER migration, except the 014 table (which
    carries its own revoke, pinned by test_recommendation_storage_rls), has a verbatim
    `REVOKE ALL ON public.<table> FROM service_role;`
    -> test_every_preexisting_public_table_is_explicitly_revoked
  * the migration is exactly that set of revokes and nothing else: no GRANT, no
    ALTER, no other schema, no table that does not exist yet, and no duplicate of
    the 014 revoke
    -> test_migration_is_exactly_the_preexisting_revokes,
       test_014_table_is_not_duplicated
  * no migration, this one or any other, grants service_role anything on a public
    table
    -> test_no_migration_grants_service_role_on_a_public_table

The expected table set is DERIVED from the migrations (every `CREATE TABLE
public.<x>` in a file older than this one), not hard-coded, so adding a table to an
older migration without a revoke here fails, and so does listing a table that no
migration creates.

Live proof (local stack, 2026-09-13): after `migration up`, no public table has a
service_role item in `relacl` and `has_table_privilege('service_role', ...)` is
false for SELECT/INSERT/UPDATE/DELETE on all eleven; recorded in the PR.
"""

from __future__ import annotations

import re
from pathlib import Path

_MIGRATIONS = Path(__file__).resolve().parents[3] / "supabase" / "migrations"
_MIGRATION = _MIGRATIONS / "20260913100000_revoke_service_role_preexisting_tables.sql"
# Carries its own `REVOKE ALL ... FROM service_role` (20260815090000), pinned by
# test_recommendation_storage_rls.test_service_role_is_explicitly_revoked.
_SELF_REVOKING = {"recommendation_picks"}


def _strip_comments(sql: str) -> str:
    return re.sub(r"--[^\n]*", "", sql)


def _sql() -> str:
    assert _MIGRATION.is_file(), f"missing migration {_MIGRATION.name}"
    return _MIGRATION.read_text(encoding="utf-8")


def _statements(sql: str) -> list[str]:
    return [re.sub(r"\s+", " ", s).strip() for s in _strip_comments(sql).split(";") if s.strip()]


def _earlier_migrations() -> list[Path]:
    return [p for p in sorted(_MIGRATIONS.glob("*.sql")) if p.name < _MIGRATION.name]


def _tables_created_before_this_migration() -> set[str]:
    created: set[str] = set()
    for path in _earlier_migrations():
        sql = _strip_comments(path.read_text(encoding="utf-8"))
        created |= set(
            re.findall(
                r"CREATE\s+TABLE\s+(?:IF\s+NOT\s+EXISTS\s+)?public\.([a-z_][a-z0-9_]*)",
                sql,
                re.IGNORECASE,
            )
        )
    return created


def _expected_revoked() -> set[str]:
    return _tables_created_before_this_migration() - _SELF_REVOKING


def _revoke_pattern(table: str) -> re.Pattern[str]:
    return re.compile(
        rf"REVOKE\s+ALL\s+ON\s+public\.{table}\s+FROM\s+service_role\s*;",
        re.IGNORECASE,
    )


def test_every_preexisting_public_table_is_explicitly_revoked():
    """On cloud every pre-014 public table carries `service_role=arwdDxtm` and the role
    has BYPASSRLS, so the grant, not RLS, is the boundary. One verbatim revoke per
    table, same shape as 014's. DECISIONS 2026-09-13 (#269 step 2)."""
    expected = _expected_revoked()
    assert len(expected) == 10, f"expected ten pre-existing tables, derived {sorted(expected)}"
    sql = _strip_comments(_sql())
    for table in sorted(expected):
        assert _revoke_pattern(table).search(sql), (
            f"missing REVOKE ALL ON public.{table} FROM service_role"
        )


def test_migration_is_exactly_the_preexisting_revokes():
    """Nothing but the revokes: no GRANT, no ALTER, no policy, no other schema, and no
    table that is not created by an earlier migration. Compared as an exact set."""
    statements = _statements(_sql())
    expected = {f"REVOKE ALL ON public.{table} FROM service_role" for table in _expected_revoked()}
    assert set(statements) == expected, (
        f"unexpected statements: {sorted(set(statements) - expected)}; "
        f"missing: {sorted(expected - set(statements))}"
    )
    assert len(statements) == len(expected), "duplicate statements"


def test_014_table_is_not_duplicated():
    """014's migration owns its own revoke; a second one here would split the posture
    of that table across two files and trip 014's own cross-migration gate."""
    stripped = _strip_comments(_sql()).lower()
    for table in _SELF_REVOKING:
        assert table not in stripped, f"{table} must not be referenced here"


def test_no_migration_grants_service_role_on_a_public_table():
    """No `GRANT ... ON [TABLE] public.<x> ... TO ... service_role` anywhere: a re-grant
    in any migration would silently undo this one for that table."""
    pattern = re.compile(
        r"\bGRANT\b(?:(?!;).)*?\bON\s+(?:TABLE\s+)?public\.[a-z_][a-z0-9_]*"
        r"(?:(?!;).)*?\bTO\b(?:(?!;).)*?\bservice_role\b",
        re.IGNORECASE | re.DOTALL,
    )
    for path in sorted(_MIGRATIONS.glob("*.sql")):
        sql = _strip_comments(path.read_text(encoding="utf-8"))
        assert not pattern.search(sql), (
            f"{path.name} grants service_role a privilege on a public table"
        )
