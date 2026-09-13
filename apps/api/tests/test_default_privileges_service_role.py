"""Default-privileges gate for #269 step 1.

Static parse of `20260913000000_default_privileges_service_role.sql` (no live DB —
CI-runnable), mirroring the 011/014 posture gates. Pins:

  * the one statement the migration exists for, verbatim modulo whitespace
    → test_default_acl_revokes_all_tables_from_service_role
  * the statement targets the `postgres`-grantor entry explicitly
    (the entry migrations actually inherit), not the session default
    → same test (FOR ROLE postgres is part of the pinned text)
  * the migration touches nothing else: no GRANT, no table-level REVOKE, no
    ALTER TABLE / ROLE / FUNCTION, no CREATE
    → test_migration_alters_default_privileges_only
  * no migration, this one or any later one, re-grants service_role a default
    privilege on public tables
    → test_no_migration_regrants_service_role_default_table_privileges

The live proof that a fresh table comes out with no `service_role` item in its
`relacl` was run locally on 2026-09-13 (throwaway table, read, dropped) and is
recorded in the PR for #269 step 1; it is not repeated here.
"""

from __future__ import annotations

import re
from pathlib import Path

_MIGRATIONS = Path(__file__).resolve().parents[3] / "supabase" / "migrations"
_MIGRATION = _MIGRATIONS / "20260913000000_default_privileges_service_role.sql"


def _strip_comments(sql: str) -> str:
    return re.sub(r"--[^\n]*", "", sql)


def _sql() -> str:
    assert _MIGRATION.is_file(), f"missing migration {_MIGRATION.name}"
    return _MIGRATION.read_text(encoding="utf-8")


def _statements(sql: str) -> list[str]:
    return [re.sub(r"\s+", " ", s).strip() for s in _strip_comments(sql).split(";") if s.strip()]


_PINNED = re.compile(
    r"^ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public "
    r"REVOKE ALL ON TABLES FROM service_role$",
    re.IGNORECASE,
)


def test_default_acl_revokes_all_tables_from_service_role():
    """On cloud the `postgres`-grantor default ACL for public tables hands service_role
    full `arwdDxtm` (read live 2026-08-15, re-read 2026-09-13); locally only `Dxtm`.
    REVOKE ALL is the right verb on both — the end state is no service_role item at
    all, matching 014's `recommendation_picks`. FOR ROLE postgres pins the entry the
    migrations actually inherit. DECISIONS 2026-09-13."""
    statements = _statements(_sql())
    assert any(_PINNED.match(s) for s in statements), (
        "missing: ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public "
        "REVOKE ALL ON TABLES FROM service_role"
    )


def test_migration_alters_default_privileges_only():
    """Step 1 is default privileges ONLY. Any GRANT, any table-level REVOKE, any
    ALTER TABLE/ROLE/FUNCTION or CREATE here would be step 2 (#269) or a role change
    smuggled in, and both are separate decisions."""
    statements = _statements(_sql())
    assert len(statements) == 1, f"expected exactly one statement, got {statements}"
    assert _PINNED.match(statements[0]), f"unexpected statement: {statements[0]!r}"


def test_no_migration_regrants_service_role_default_table_privileges():
    """No migration may hand service_role a default privilege on public tables back —
    that would silently undo this one for every table created after it."""
    pattern = re.compile(
        r"ALTER\s+DEFAULT\s+PRIVILEGES\b(?:(?!;).)*?\bGRANT\b(?:(?!;).)*?\bTABLES\b"
        r"(?:(?!;).)*?\bTO\b(?:(?!;).)*?\bservice_role\b",
        re.IGNORECASE | re.DOTALL,
    )
    for path in sorted(_MIGRATIONS.glob("*.sql")):
        sql = _strip_comments(path.read_text(encoding="utf-8"))
        assert not pattern.search(sql), (
            f"{path.name} re-grants service_role a default privilege on tables"
        )
