"""Feature 013 — consent DB / RLS / grant privacy gate (Principle VII + I).

A *real* privacy gate, not a smoke test. Every assertion here is a hard requirement;
a failure is a genuine privacy regression, NOT something to relax. Mirrors the
feature-008 (`test_privacy.py`), feature-011 (`test_chat_storage_rls.py`) and
feature-012 (`test_questionnaire_privacy.py`) style: a **static parse of the migration
SQL** (no live DB needed → CI-runnable), because the privacy boundary IS the
schema/RLS/grant shape.

The migration under test:
    supabase/migrations/20260726000000_user_consents.sql

One storage concept, one privacy posture:

  Owner-only, append-only consent HISTORY (ENABLE + FORCE RLS, no manager/admin policy):
    * user_consents — one row per accepted revision, never overwritten. `document_version`
      records WHICH wording was shown; `decided_at` records WHEN. Version identity, not
      timestamp comparison, is what the evaluator gates on (research.md §6.2) — so
      `decided_at` is evidence and `document_version` is the enforced field.

Hard invariants asserted below:
  - `decision` enumerates exactly ('granted'). Declining writes NO row (FR-042), so
    'declined' is deliberately inadmissible — admitting it would invite writing one.
  - `document_version` NOT NULL with BOTH CHECKs (format regex, and prefix = consent_key);
    `decided_at` NOT NULL. Together: every record identifies when and which wording.
  - Owner-only + forced RLS. Exactly two policies — SELECT self and INSERT self. No
    UPDATE policy, no DELETE policy, no manager/admin/reports_under policy anywhere.
  - Grants are REVOKE ALL FROM anon, authenticated then GRANT SELECT, INSERT TO
    authenticated only. No UPDATE grant, no DELETE grant.
  - A BEFORE UPDATE FOR EACH ROW immutability trigger. Consent records are never edited
    (FR-043b, SC-013). DELETE is withheld by the missing policy/grant but deliberately
    NOT trigger-blocked — a BEFORE DELETE raise would also fire on the ON DELETE CASCADE
    from auth.users and make genuine account deletion impossible.
  - NO BACKFILL (FR-041, contracts/consent-gates.md §7.4). This is scoped precisely: the
    naive assertion ("no INSERT INTO public.user_consents") is unsatisfiable, because
    data-model.md §6.6 puts one INSERT INSIDE the handle_new_user() body BY DESIGN and
    that statement is what records the signup acknowledgement. The prohibition is on
    backfill DML — no such INSERT OUTSIDE that function body, and specifically no
    INSERT … SELECT sourcing auth.users or public.profiles. The one INSERT that does
    appear fires only on auth-user creation and is therefore structurally incapable of
    writing a row for a user who already exists, so it satisfies FR-041 rather than
    violating it.
  - No column and no CHECK value expresses withdrawal or revocation — none exists to
    write (§7.5). Feature 018 owns that seam.
  - The migration never mutates public.window_readings or public.monitoring_sessions.
    Declining is a gate, not a deletion.
  - No service-role key / no service_role path anywhere in the migration.

Test ids map 1:1 to task T017's bullet list.
"""

from __future__ import annotations

import re
from pathlib import Path

# Repo root: apps/api/tests/test_consent_privacy.py -> parents[3] == repo root.
_MIGRATIONS = Path(__file__).resolve().parents[3] / "supabase" / "migrations"
_MIGRATION = _MIGRATIONS / "20260726000000_user_consents.sql"
# The pre-existing trigger this migration additively replaces. Its profiles INSERT,
# SECURITY DEFINER and search_path pin must survive verbatim.
_MIGRATION_PROFILE_TRIGGER = _MIGRATIONS / "20260517000030_profile_trigger.sql"

_TABLE = "user_consents"
_TRIGGER_FN = "user_consents_immutable"
_SIGNUP_FN = "handle_new_user"

# Tokens that would betray a manager/admin/cross-user reach. Consent is owner-only with
# no privileged read path at all, so these are forbidden in the WHOLE migration, not just
# in policy bodies — unlike feature 012, this migration has no role-gated RPC.
_MANAGER_TOKENS = (
    "manager",
    "reports_to",
    "reports_under",
    "team_lead",
    "admin",
    "is_admin",
    "direct_report",
)

# Vocabulary that would mean a withdrawal/revocation state exists to be written (§7.5).
_WITHDRAWAL_TOKENS = ("withdraw", "revoke_consent", "revocation", "revoked", "rescind", "opt_out")

# Reading tables this feature must not touch. Declining is a gate, not a deletion.
_UNTOUCHED_TABLES = ("window_readings", "monitoring_sessions")


# ── SQL fixture helpers ───────────────────────────────────────────────────────


def _sql() -> str:
    """The migration text, or '' when it does not exist yet.

    Returning '' (instead of raising) means the RED phase produces clean assertion
    FAILURES ('feature missing') rather than collection errors.
    """
    return _MIGRATION.read_text(encoding="utf-8") if _MIGRATION.is_file() else ""


def _sql_profile_trigger() -> str:
    """The pre-existing profile-trigger migration text, or '' when absent."""
    return (
        _MIGRATION_PROFILE_TRIGGER.read_text(encoding="utf-8")
        if _MIGRATION_PROFILE_TRIGGER.is_file()
        else ""
    )


def _strip_comments(sql: str) -> str:
    """Drop `-- …` comments so the explanatory header (which names forbidden things
    on purpose) never produces a false match."""
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
    return [
        (m.group(1), m.group(2), m.group(3))
        for m in re.finditer(
            r"CREATE POLICY (\w+)\s+ON public\.(\w+)(.*?);",
            sql,
            re.IGNORECASE | re.DOTALL,
        )
    ]


def _checks(body: str) -> list[str]:
    """Each `CHECK (...)` clause, with balanced parentheses (any nesting depth)."""
    out: list[str] = []
    for m in re.finditer(r"check\s*\(", body, re.IGNORECASE):
        depth = 0
        j = m.end() - 1  # index of the opening '('
        while j < len(body):
            if body[j] == "(":
                depth += 1
            elif body[j] == ")":
                depth -= 1
                if depth == 0:
                    break
            j += 1
        out.append(body[m.start() : j + 1])
    return out


def _function(sql: str, name: str) -> str:
    """The full `CREATE OR REPLACE FUNCTION ... $$ ... $$;` definition for `name`."""
    m = re.search(
        rf"create or replace function public\.{name}\(.*?\$\$.*?\$\$;",
        sql,
        re.IGNORECASE | re.DOTALL,
    )
    return m.group(0) if m else ""


def _function_body(fn: str) -> str:
    """Everything between the `$$` delimiters — the executable body only."""
    m = re.search(r"\$\$(.*)\$\$", fn, re.DOTALL)
    return m.group(1) if m else ""


# ── T017a — `decision` admits exactly ('granted') ─────────────────────────────


def test_t017a_decision_enumerates_granted_only():
    """Declining writes NO row (FR-042). 'declined' is deliberately absent from the
    CHECK — admitting it would invite writing one."""
    body = _table_body(_strip_comments(_sql()), _TABLE)
    low = body.lower()

    assert re.search(r"decision\s+text\s+not null", low), "decision must be NOT NULL"
    assert re.search(r"decision\s+text\s+not null\s+default\s+'granted'", low), (
        "decision must default to 'granted'"
    )

    decision_checks = [c for c in _checks(low) if "decision" in c]
    assert decision_checks, "decision must carry a CHECK"
    enumerated = set(re.findall(r"'(\w+)'", " ".join(decision_checks)))
    assert enumerated == {"granted"}, (
        f"decision must enumerate exactly ('granted'), got {sorted(enumerated)}"
    )
    for forbidden in ("declined", "withdrawn", "revoked"):
        assert forbidden not in " ".join(decision_checks), (
            f"decision must not admit {forbidden!r}"
        )


# ── T017b — document_version NOT NULL with BOTH CHECKs ───────────────────────


def test_t017b_document_version_not_null_with_both_checks():
    """FR-039: every record identifies WHICH wording was shown. The database constrains
    the stored shape independently of the application (research.md §6.3)."""
    body = _table_body(_strip_comments(_sql()), _TABLE)
    low = body.lower()

    assert re.search(r"document_version\s+text\s+not null", low), (
        "document_version must be NOT NULL"
    )

    dv_checks = [c for c in _checks(low) if "document_version" in c]
    assert len(dv_checks) == 2, (
        f"document_version must carry BOTH CHECKs (format + key prefix), got {len(dv_checks)}"
    )

    # 1. The format regex: <consent_key>@YYYY-MM-DD.<n>, anchored at both ends.
    format_check = next((c for c in dv_checks if "~" in c), "")
    assert format_check, "expected a regex CHECK on document_version"
    assert "terms_privacy|camera_inference" in format_check, (
        "the format regex must enumerate both consent keys"
    )
    assert r"\d{4}-\d{2}-\d{2}" in format_check, "the format regex must require a date"
    assert format_check.count("^") == 1 and format_check.count("$") == 1, (
        "the format regex must be anchored at both ends"
    )

    # 2. The prefix CHECK: the stored value names its own consent_key.
    prefix_check = next((c for c in dv_checks if "like" in c), "")
    assert prefix_check, "expected a prefix CHECK on document_version"
    assert "consent_key" in prefix_check and "@%" in prefix_check, (
        "the prefix CHECK must require document_version LIKE consent_key || '@%'"
    )


def test_t017b_consent_key_enumerates_both_texts():
    """Both consented texts share one table, one RLS surface, one evaluator."""
    body = _table_body(_strip_comments(_sql()), _TABLE)
    low = body.lower()
    assert re.search(r"consent_key\s+text\s+not null", low), "consent_key must be NOT NULL"
    key_checks = [c for c in _checks(low) if "consent_key" in c and "in" in c]
    assert key_checks, "consent_key must carry an enumerating CHECK"
    enumerated = set(re.findall(r"'(\w+)'", " ".join(key_checks)))
    assert enumerated == {"terms_privacy", "camera_inference"}, (
        f"consent_key must enumerate exactly the two texts, got {sorted(enumerated)}"
    )


# ── T017c — decided_at NOT NULL ──────────────────────────────────────────────


def test_t017c_decided_at_not_null():
    """FR-035/FR-039: every record identifies WHEN it was given. Stored as evidence,
    never as the gate input (research.md §6.2)."""
    body = _table_body(_strip_comments(_sql()), _TABLE)
    low = body.lower()
    assert re.search(r"decided_at\s+timestamptz\s+not null", low), (
        "decided_at must be NOT NULL timestamptz"
    )


def test_t017c_history_is_one_row_per_accepted_revision():
    """FR-043b: consent is a HISTORY. `document_version` is part of the uniqueness key,
    so a later acceptance is always a NEW row and an earlier one is never rolled
    forward (§7.4)."""
    body = _table_body(_strip_comments(_sql()), _TABLE)
    low = body.lower()
    assert re.search(
        r"unique\s*\(\s*user_id\s*,\s*consent_key\s*,\s*document_version\s*\)", low
    ), "expected UNIQUE (user_id, consent_key, document_version)"


# ── T017d — ENABLE and FORCE row level security ──────────────────────────────


def test_t017d_rls_enabled_and_forced():
    sql = _sql()
    assert re.search(
        rf"alter table public\.{_TABLE}\s+enable row level security", sql, re.I
    ), "RLS must be ENABLEd"
    assert re.search(
        rf"alter table public\.{_TABLE}\s+force\s+row level security", sql, re.I
    ), "RLS must be FORCEd"


# ── T017e — exactly two owner-self policies, and nothing else ────────────────


def test_t017e_exactly_two_owner_self_policies():
    pols = [(n, b) for n, tbl, b in _policies(_strip_comments(_sql())) if tbl == _TABLE]
    names = {n for n, _ in pols}
    assert names == {"user_consents_select_self", "user_consents_insert_self"}, (
        f"expected exactly the owner select/insert policies, got {sorted(names)}"
    )

    for name, body in pols:
        low = body.lower()
        assert "to authenticated" in low, f"{name} must be TO authenticated"
        assert "(select auth.uid()) = user_id" in low, f"{name} must be owner-self-scoped"

    select_body = next(b for n, b in pols if n.endswith("select_self")).lower()
    insert_body = next(b for n, b in pols if n.endswith("insert_self")).lower()
    assert "for select" in select_body and "using" in select_body
    assert "for insert" in insert_body and "with check" in insert_body


def test_t017e_no_update_or_delete_policy():
    """Nothing may ever edit a consent record, and nothing client-side may delete one."""
    stripped = _strip_comments(_sql())
    for name, tbl, body in _policies(stripped):
        if tbl != _TABLE:
            continue
        low = body.lower()
        assert "for update" not in low, f"{name} must not be an UPDATE policy"
        assert "for delete" not in low, f"{name} must not be a DELETE policy"
        assert "for all" not in low, f"{name} must not be a FOR ALL policy"


def test_t017e_no_manager_admin_or_reports_under_policy_anywhere():
    """Consent is owner-only. There is no privileged read path, so these tokens are
    forbidden in the WHOLE migration, not merely in policy bodies."""
    low = _strip_comments(_sql()).lower()
    assert low, "migration must exist"
    for token in _MANAGER_TOKENS:
        assert token not in low, f"migration must not reference {token!r}"


# ── T017f — grants: SELECT + INSERT to authenticated, and nothing more ───────


def test_t017f_grants_are_select_insert_to_authenticated_only():
    sql = _sql()
    assert re.search(
        rf"revoke all on public\.{_TABLE} from anon, ?authenticated", sql, re.I
    ), "direct anon/authenticated grants must be revoked first"

    grants = re.findall(rf"grant\s+(.*?)\s+on public\.{_TABLE}\s+to\s+(\w+)", sql, re.I)
    assert grants, "expected a GRANT on user_consents"
    assert len(grants) == 1, f"expected exactly one GRANT statement, got {len(grants)}"

    privileges, grantee = grants[0]
    assert grantee.lower() == "authenticated", (
        f"the only grantee must be authenticated, got {grantee}"
    )
    granted = {p.strip().lower() for p in privileges.split(",")}
    assert granted == {"select", "insert"}, (
        f"authenticated must hold SELECT and INSERT only, got {sorted(granted)}"
    )


def test_t017f_no_update_or_delete_grant():
    low = _strip_comments(_sql()).lower()
    assert not re.search(rf"grant[\w ,()]*\bupdate\b[\w ,()]*on public\.{_TABLE}", low), (
        "no UPDATE grant on user_consents"
    )
    assert not re.search(rf"grant[\w ,()]*\bdelete\b[\w ,()]*on public\.{_TABLE}", low), (
        "no DELETE grant on user_consents"
    )
    assert not re.search(rf"grant all[\w ,()]*on public\.{_TABLE}", low), (
        "no blanket GRANT ALL on user_consents"
    )
    assert not re.search(rf"grant[\w ,()]+on public\.{_TABLE}\s+to\s+anon", low), (
        "anon must hold nothing on user_consents"
    )


# ── T017g — the immutability trigger, BEFORE UPDATE FOR EACH ROW ─────────────


def test_t017g_immutability_trigger_is_before_update_for_each_row():
    """FR-043b / SC-013: earlier rows are never overwritten. UPDATE gets a trigger AS
    WELL AS the missing grant, because a future migration could re-grant UPDATE by
    accident and that promise is load-bearing for the whole model."""
    sql = _strip_comments(_sql())
    low = sql.lower()

    assert re.search(
        rf"create trigger\s+\w+\s+before update on public\.{_TABLE}\s+for each row\s+"
        rf"execute function public\.{_TRIGGER_FN}\(\)",
        low,
    ), "expected a BEFORE UPDATE … FOR EACH ROW trigger calling the immutability function"

    fn = _function(sql, _TRIGGER_FN)
    assert fn, f"{_TRIGGER_FN}() not found"
    fn_low = fn.lower()
    assert "language plpgsql" in fn_low
    assert re.search(r"set\s+search_path\s*=\s*''", fn_low), "must SET search_path = ''"
    assert "raise exception" in fn_low, "the trigger must raise, not silently skip"
    assert "42501" in fn_low, "the trigger must raise with ERRCODE 42501"
    assert re.search(
        rf"alter function public\.{_TRIGGER_FN}\(\)\s+owner to postgres", low
    ), "the trigger function must be owned by postgres"


def test_t017g_delete_is_not_trigger_blocked():
    """DELETE is withheld by the missing policy and grant — deliberately NOT by a
    trigger. A BEFORE DELETE raise would also fire on the ON DELETE CASCADE from
    auth.users and make genuine account deletion impossible. Editing a consent record
    and deleting an account are different acts; only the first is forbidden."""
    low = _strip_comments(_sql()).lower()
    assert not re.search(rf"create trigger[\s\S]*?before delete on public\.{_TABLE}", low), (
        "DELETE must not be trigger-blocked — it would break account deletion"
    )
    assert "on delete cascade" in low, (
        "the user_id FK must CASCADE so account deletion stays possible"
    )


# ── T017h — NO BACKFILL, scoped precisely ────────────────────────────────────


def test_t017h_no_consent_insert_outside_handle_new_user():
    """FR-041 / §7.4. The scoping matters: data-model.md §6.6 puts ONE INSERT INTO
    public.user_consents inside the handle_new_user() body BY DESIGN, and that statement
    is what records the signup acknowledgement. The prohibition is on backfill DML —
    an INSERT anywhere OUTSIDE that function body."""
    sql = _strip_comments(_sql())
    fn = _function(sql, _SIGNUP_FN)
    assert fn, f"{_SIGNUP_FN}() not found in the migration"

    inserts_everywhere = re.findall(rf"insert\s+into\s+public\.{_TABLE}", sql, re.I)
    inserts_in_signup = re.findall(
        rf"insert\s+into\s+public\.{_TABLE}", _function_body(fn), re.I
    )

    assert len(inserts_in_signup) == 1, (
        f"expected exactly one consent INSERT inside {_SIGNUP_FN}(), "
        f"got {len(inserts_in_signup)}"
    )
    assert len(inserts_everywhere) == len(inserts_in_signup), (
        f"BACKFILL: {len(inserts_everywhere) - len(inserts_in_signup)} INSERT INTO "
        f"public.{_TABLE} outside the {_SIGNUP_FN}() body — no migration may write a "
        f"consent row for an existing user (FR-041)"
    )


def test_t017h_no_insert_select_sourcing_users_or_profiles():
    """The specific backfill shape the prohibition names: INSERT … SELECT over the
    existing population."""
    low = _strip_comments(_sql()).lower()
    for insert in re.finditer(rf"insert\s+into\s+public\.{_TABLE}(.*?);", low, re.DOTALL):
        statement = insert.group(1)
        assert "select" not in statement, (
            "BACKFILL: a consent INSERT … SELECT would write rows for existing users"
        )
        for source in ("auth.users", "public.profiles"):
            assert source not in statement, (
                f"BACKFILL: a consent INSERT must not source {source}"
            )


def test_t017h_signup_insert_is_metadata_gated_and_conflict_safe():
    """The one permitted INSERT fires only on auth-user creation, only when the
    acknowledgement was actually carried, and re-accepting the same revision is a
    no-op rather than a duplicate."""
    fn_body = _function_body(_function(_strip_comments(_sql()), _SIGNUP_FN)).lower()
    assert fn_body, f"{_SIGNUP_FN}() body not found"

    assert "raw_user_meta_data ? 'terms_privacy_version'" in fn_body, (
        "the consent INSERT must be gated on the acknowledgement actually being present"
    )
    assert "'terms_privacy'" in fn_body, "the signup seam records the terms_privacy consent"
    assert "on conflict do nothing" in fn_body, (
        "re-accepting the same revision must be a no-op, not a duplicate"
    )
    # NEW.id only — the trigger can never write a row for a different user.
    insert = re.search(rf"insert into public\.{_TABLE}(.*?);", fn_body, re.DOTALL)
    assert insert, "consent INSERT not found in the trigger body"
    assert "new.id" in insert.group(1), "the consent row must be keyed to the new auth user"


def test_t017h_handle_new_user_edit_is_additive():
    """The trigger edit preserves the pre-existing profiles INSERT, SECURITY DEFINER and
    search_path pin verbatim, and does not drop or recreate on_auth_user_created."""
    sql = _strip_comments(_sql())
    fn = _function(sql, _SIGNUP_FN)
    assert fn, f"{_SIGNUP_FN}() not found"
    low = fn.lower()

    # The security posture carried forward from 20260517000030_profile_trigger.sql.
    assert "security definer" in low, "SECURITY DEFINER must be preserved"
    assert re.search(r"set\s+search_path\s*=\s*public,\s*pg_temp", low), (
        "the search_path pin must be preserved verbatim"
    )

    # The profiles INSERT survives, still hard-coding the role.
    assert re.search(
        r"insert into public\.profiles\s*\(\s*id\s*,\s*full_name\s*,\s*role\s*\)", low
    ), "the profiles INSERT must be preserved"
    assert "'employee'::public.user_role" in low, "role must stay hard-coded to employee"
    # Privileged values are still never read from client-controllable metadata.
    for privileged in ("role'", "manager_id'"):
        assert f"raw_user_meta_data->>'{privileged}" not in low, (
            f"must never read {privileged} from raw_user_meta_data"
        )

    # The trigger itself is untouched — it already points at this function by name.
    assert not re.search(r"drop trigger[\s\S]*?on_auth_user_created", low + sql.lower()), (
        "on_auth_user_created must not be dropped"
    )
    assert not re.search(r"create trigger\s+on_auth_user_created", sql, re.I), (
        "on_auth_user_created must not be recreated"
    )

    # And the source of the preserved text still exists, unedited, as the reference.
    original = _strip_comments(_sql_profile_trigger()).lower()
    assert original, "the pre-existing profile-trigger migration must still exist"
    assert "'employee'::public.user_role" in original


# ── T017i — the migration never touches the reading tables ──────────────────


def test_t017i_migration_never_mutates_reading_tables():
    """Declining is a gate, not a deletion (§7.5): zero readings and zero monitoring
    sessions are modified by this feature."""
    low = _strip_comments(_sql()).lower()
    assert low, "migration must exist"
    for table in _UNTOUCHED_TABLES:
        assert not re.search(rf"alter table\s+public\.{table}", low), f"must not ALTER {table}"
        assert not re.search(rf"update\s+public\.{table}", low), f"must not UPDATE {table}"
        assert not re.search(rf"delete\s+from\s+public\.{table}", low), (
            f"must not DELETE from {table}"
        )
        assert not re.search(rf"drop\s+\w+[^;]*{table}", low), f"must not DROP anything on {table}"
        assert not re.search(rf"comment\s+on\s+\w+\s+public\.{table}", low), (
            f"must not annotate {table}"
        )
        assert not re.search(rf"create\s+trigger\s+\w+[^;]*on\s+public\.{table}", low), (
            f"must not add a trigger on {table}"
        )
        assert not re.search(rf"create policy[^;]*on public\.{table}", low), (
            f"must not add a policy on {table}"
        )


# ── T017j — no withdrawal or revocation state exists to be written ──────────


def test_t017j_no_withdrawal_or_revocation_column_or_check_value():
    """§7.5: declining is not withdrawal. Nothing is deleted and no revocation state is
    written — none exists to write. Feature 018 owns that seam and widens the CHECK
    then, which is why the column shape (not a presence-of-row design) exists now."""
    body = _table_body(_strip_comments(_sql()), _TABLE).lower()
    for token in _WITHDRAWAL_TOKENS:
        assert token not in body, f"no column may express {token!r}"

    for check in _checks(body):
        for value in re.findall(r"'(\w+)'", check):
            assert value.lower() not in _WITHDRAWAL_TOKENS, (
                f"no CHECK value may express withdrawal/revocation, found {value!r}"
            )

    # And no separate withdrawal table or column is added elsewhere in the migration.
    low = _strip_comments(_sql()).lower()
    assert not re.search(r"alter table[^;]*add column[^;]*(withdraw|revok)", low), (
        "no withdrawal/revocation column may be added"
    )


# ── T017k — no service-role path anywhere ───────────────────────────────────


def test_t017k_no_service_role_path():
    stripped = _strip_comments(_sql()).lower()
    assert stripped, "migration must exist"
    assert "service_role" not in stripped, "no service-role path allowed"
    assert "supabase_service_role_key" not in stripped, "no service-role key allowed"
    assert "service-role" not in stripped, "no service-role path allowed"
