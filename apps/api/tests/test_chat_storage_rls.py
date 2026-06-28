"""T020 — chat tables RLS shape test (FR-021, FR-022, FR-041; Principle I).

Static parse of the 011 migration (no live DB). Asserts the feature-008 posture:
owner-only policies, no manager/admin policy, ENABLE+FORCE RLS, explicit
revoke-before-grant, no service-role path, and — the 011-specific invariant — NO
crisis / per-message-band / raw-scorer / notification columns exist on either table
(crisis is live-only, FR-041). Mirrors apps/api/tests/test_privacy.py.
"""

from __future__ import annotations

import re
from pathlib import Path

_MIGRATION = (
    Path(__file__).resolve().parents[3]
    / "supabase"
    / "migrations"
    / "20260628000000_chat_conversations_messages.sql"
)
_TABLES = ("chat_conversations", "chat_messages")

_EXPECTED_POLICIES = {
    "chat_conversations_select_self",
    "chat_conversations_insert_self",
    "chat_conversations_update_self",
    "chat_conversations_delete_self",
    "chat_messages_select_self",
    "chat_messages_insert_self",
    "chat_messages_delete_self",
}

# Forbidden on EITHER table (FR-041 + data-model "Forbidden columns").
_FORBIDDEN_COLUMN_TOKENS = (
    "crisis",
    "manager",
    "notification",
    "probability",
    "scorer",
    "reasoning",
    "peak",
    "per_message",
)
_MANAGER_TOKENS = ("manager", "reports_to", "team_lead", "admin", "is_admin")


def _sql() -> str:
    return _MIGRATION.read_text(encoding="utf-8")


def _strip_comments(sql: str) -> str:
    """Drop `-- …` comments so the explanatory header (which names the forbidden
    things on purpose) never produces a false match."""
    return "\n".join(re.sub(r"--.*$", "", line) for line in sql.splitlines())


def _table_body(sql: str, table: str) -> str:
    m = re.search(
        rf"CREATE TABLE public\.{table}\s*\((.*?)\n\);",
        sql,
        re.IGNORECASE | re.DOTALL,
    )
    assert m, f"no CREATE TABLE public.{table} found"
    return m.group(1)


def _policies(sql: str) -> list[tuple[str, str, str]]:
    """(name, table, body) for each CREATE POLICY in comment-stripped SQL."""
    out: list[tuple[str, str, str]] = []
    for m in re.finditer(
        r"CREATE POLICY (\w+)\s+ON public\.(\w+)(.*?);",
        sql,
        re.IGNORECASE | re.DOTALL,
    ):
        out.append((m.group(1), m.group(2), m.group(3)))
    return out


def test_migration_exists():
    assert _MIGRATION.is_file(), _MIGRATION


def test_rls_enabled_and_forced_on_both_tables():
    sql = _sql()
    for table in _TABLES:
        assert re.search(rf"{table}\s+ENABLE\s+ROW LEVEL SECURITY", sql, re.IGNORECASE), table
        assert re.search(rf"{table}\s+FORCE\s+ROW LEVEL SECURITY", sql, re.IGNORECASE), table


def test_anon_and_authenticated_revoked():
    sql = _sql()
    for table in _TABLES:
        assert re.search(
            rf"REVOKE\s+ALL\s+ON\s+public\.{table}\s+FROM\s+anon,\s*authenticated",
            sql,
            re.IGNORECASE,
        ), table


def test_only_owner_self_policies_exist():
    names = {name for name, _t, _b in _policies(_strip_comments(_sql()))}
    assert names == _EXPECTED_POLICIES


def test_every_policy_is_owner_self_scoped_and_has_no_manager_reach():
    for name, table, body in _policies(_strip_comments(_sql())):
        lowered = body.lower()
        assert "auth.uid()) = user_id" in lowered, f"{name} on {table} not owner-self-scoped"
        for token in _MANAGER_TOKENS:
            assert token not in lowered, f"{name} on {table} references manager token {token!r}"


def test_messages_have_no_update_policy():
    names = {name for name, _t, _b in _policies(_strip_comments(_sql()))}
    assert not any(n.startswith("chat_messages_update") for n in names)


def test_message_insert_requires_owned_conversation():
    body = next(
        b for n, _t, b in _policies(_strip_comments(_sql())) if n == "chat_messages_insert_self"
    ).lower()
    assert "exists" in body and "chat_conversations" in body


def test_no_forbidden_columns_on_either_table():
    sql = _strip_comments(_sql())
    for table in _TABLES:
        body = _table_body(sql, table).lower()
        for token in _FORBIDDEN_COLUMN_TOKENS:
            assert token not in body, f"forbidden column token {token!r} present on {table}"


def test_only_stored_band_is_conversation_rollup_band():
    sql = _strip_comments(_sql())
    conv = _table_body(sql, "chat_conversations").lower()
    msg = _table_body(sql, "chat_messages").lower()
    # The single chat-derived band lives on the conversation; messages carry none.
    assert "rollup_band" in conv
    assert "band" not in msg


def test_no_service_role_path():
    assert "service_role" not in _strip_comments(_sql()).lower()


def test_hard_delete_cascade_on_messages():
    body = _table_body(_sql(), "chat_messages")
    assert re.search(
        r"conversation_id[^,]*REFERENCES public\.chat_conversations\(id\)\s*ON DELETE CASCADE",
        body,
        re.IGNORECASE | re.DOTALL,
    )
