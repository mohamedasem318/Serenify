"""Feature 012 — questionnaire DB / RLS / RPC privacy gate (Principle VII + I).

A *real* privacy gate, not a smoke test. Every assertion here is a hard requirement;
a failure is a genuine privacy regression, NOT something to relax. Mirrors the
feature-008 (`test_privacy.py`) and feature-011 (`test_chat_storage_rls.py`) style:
a **static parse of the migration SQL** (no live DB needed → CI-runnable), because
the privacy boundary IS the schema/RLS/RPC shape.

The migration under test:
    supabase/migrations/20260630000000_questionnaire_feedback.sql

Four storage concepts, two privacy postures:

  Employee-private, owner-only RLS (ENABLE + FORCE), no manager/admin policy:
    * questionnaire_confirmatory_prompts   — one prompt row per monitoring session
    * questionnaire_session_feedback       — one product-feedback row per session
    * weekly_checkin_cadence               — per-week prompt cadence, NO answer values

  Identity-stripped aggregate, RPC-only (ENABLE + FORCE, grants revoked, narrow
  function-owner policy, no direct anon/authenticated access):
    * weekly_work_environment_contributions — NO user_id / created_at / updated_at /
      precise timestamp; iso_week_start is the ONLY temporal field

Two restricted RPCs (LANGUAGE plpgsql SECURITY DEFINER SET search_path = '',
OWNER postgres, EXECUTE revoked from PUBLIC/anon and granted only to authenticated):
    * submit_weekly_work_environment_checkin — caller-validated, identity-stripped insert
    * get_weekly_work_environment_summary    — aggregate-only, role-gated manager read

Hard invariants asserted below:
  - weekly_work_environment_contributions carries no identity and no precise timestamp.
  - Owner-only + forced RLS on the three private tables; forced RLS + revoked grants +
    RPC-only access on the contributions table.
  - Both RPCs use auth.uid() internally with NO impersonation parameter.
  - No service-role key / no service_role path anywhere in the migration.
  - The migration never alters/annotates public.window_readings (a read-only FK is fine).

Test ids map 1:1 to tasks T003–T013. The skeleton/helpers below are T002.
"""

from __future__ import annotations

import re
from pathlib import Path

# Repo root: apps/api/tests/test_questionnaire_privacy.py -> parents[3] == repo root.
_MIGRATIONS = Path(__file__).resolve().parents[3] / "supabase" / "migrations"
_MIGRATION = _MIGRATIONS / "20260630000000_questionnaire_feedback.sql"

_PRIVATE_TABLES = (
    "questionnaire_confirmatory_prompts",
    "questionnaire_session_feedback",
    "weekly_checkin_cadence",
)
_AGGREGATE_TABLE = "weekly_work_environment_contributions"
_WEEKLY_RPCS = (
    "submit_weekly_work_environment_checkin",
    "get_weekly_work_environment_summary",
)

# Policy-name prefixes per private table (owner-self policies only).
_PRIVATE_POLICY_PREFIX = {
    "questionnaire_confirmatory_prompts": "qcp",
    "questionnaire_session_feedback": "qsf",
    "weekly_checkin_cadence": "wcc",
}
# The two private tables whose writes must verify an OWNED monitoring session.
_SESSION_LINKED = ("questionnaire_confirmatory_prompts", "questionnaire_session_feedback")

# Tokens that would betray a manager/admin/cross-user reach inside a POLICY body.
# (Applied to policy bodies only — the role-gated summary RPC legitimately names
# 'team_lead'/'admin' and team_manager_id; that is a function, not a policy.)
_MANAGER_TOKENS = ("manager", "reports_to", "team_lead", "admin", "is_admin", "direct_report")


# ── SQL fixture helpers (T002) ────────────────────────────────────────────────


def _sql() -> str:
    """The migration text, or '' when it does not exist yet.

    Returning '' (instead of raising) means the RED phase produces clean assertion
    FAILURES ('feature missing') rather than collection errors.
    """
    return _MIGRATION.read_text(encoding="utf-8") if _MIGRATION.is_file() else ""


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


def _function_param_list(fn: str) -> str:
    """The lowercased parameter list (between the first '(' and ')' before RETURNS)."""
    m = re.search(r"function\s+public\.\w+\s*\((.*?)\)\s*returns", fn, re.IGNORECASE | re.DOTALL)
    return (m.group(1) if m else "").lower()


# ── T003 — questionnaire_confirmatory_prompts schema/constraints ──────────────


def test_t003_confirmatory_prompts_columns_and_constraints():
    body = _table_body(_strip_comments(_sql()), "questionnaire_confirmatory_prompts")
    low = body.lower()
    for col in (
        "user_id",
        "monitoring_session_id",
        "trigger_window_reading_id",
        "triggered_window_captured_at",
        "trigger_band",
        "shown_at",
        "lifecycle",
        "outcome",
        "answered_at",
        "expiry_reason",
        "aggregate_treatment",
    ):
        assert re.search(rf"\b{col}\b", low), f"missing column {col}"

    # One prompt per monitoring session.
    assert re.search(r"unique\s*\(\s*monitoring_session_id\s*\)", low), "expected UNIQUE(monitoring_session_id)"

    # Trigger band fixed to the top band, and the trigger TIME is required.
    assert "trigger_band = 'tense'" in low
    assert re.search(r"triggered_window_captured_at\s+timestamptz\s+not null", low), "trigger time must be NOT NULL"

    # Lifecycle / outcome / expiry enumerations.
    for tok in ("'visible'", "'answered'", "'expired'"):
        assert tok in low, f"lifecycle enum missing {tok}"
    for tok in ("'confirmed'", "'false_alarm'", "'opened_chat'"):
        assert tok in low, f"outcome enum missing {tok}"
    for tok in ("'signal_drop'", "'session_end'"):
        assert tok in low, f"expiry_reason enum missing {tok}"

    checks = _checks(low)
    # Lifecycle constraints: outcome only when answered; expiry_reason only when expired.
    assert any("lifecycle" in c and "answered" in c and "outcome" in c for c in checks), \
        "outcome must be gated on lifecycle='answered'"
    assert any("lifecycle" in c and "expired" in c and "expiry_reason" in c for c in checks), \
        "expiry_reason must be gated on lifecycle='expired'"
    # The false-alarm aggregate rule: exclude_or_down_weight iff outcome='false_alarm'.
    assert any("exclude_or_down_weight" in c and "false_alarm" in c for c in checks), \
        "aggregate_treatment must be tied to outcome='false_alarm'"


# ── T004 — questionnaire_session_feedback schema/constraints ──────────────────


def test_t004_session_feedback_columns_and_constraints():
    body = _table_body(_strip_comments(_sql()), "questionnaire_session_feedback")
    low = body.lower()
    for col in ("user_id", "monitoring_session_id", "status", "sentiment", "reason",
                "free_text", "action_target", "sampling_policy"):
        assert re.search(rf"\b{col}\b", low), f"missing column {col}"

    # One row per monitoring session.
    assert re.search(r"unique\s*\(\s*monitoring_session_id\s*\)", low), "expected UNIQUE(monitoring_session_id)"

    # Status / sentiment / reason enumerations.
    for tok in ("'submitted'", "'skipped'"):
        assert tok in low, f"status enum missing {tok}"
    for tok in ("'good'", "'off'"):
        assert tok in low, f"sentiment enum missing {tok}"
    for tok in ("suggestion_didnt_help", "needed_quiet", "ren_too_robotic", "something_else"):
        assert tok in low, f"reason enum missing {tok}"

    checks = _checks(low)
    # Skip stores nothing (sentiment/reason/free_text/action_target all null on skip).
    assert any("skipped" in c and "is null" in c for c in checks), "skip must store no fields"
    # sentiment='off' requires a reason.
    assert any("'off'" in c and "reason" in c for c in checks), "sentiment='off' must require a reason"
    # Free text only for something_else, and empty/whitespace text rejected.
    assert any("free_text" in c and "something_else" in c for c in checks), \
        "free_text must be gated to reason='something_else'"
    assert any("btrim" in c or "trim" in c for c in checks), "empty/whitespace free_text must be rejected"

    # v1 sampling seam defaults to every session.
    assert re.search(r"sampling_policy\s+text\s+not null\s+default\s+'every_session'", low), \
        "sampling_policy must default to 'every_session'"


# ── T005 — weekly_checkin_cadence schema/constraints (NO answer values) ───────


def test_t005_weekly_cadence_columns_and_constraints():
    body = _table_body(_strip_comments(_sql()), "weekly_checkin_cadence")
    low = body.lower()
    for col in ("user_id", "iso_week_start", "prompt_count", "skipped_count",
                "last_prompted_at", "completed_at"):
        assert re.search(rf"\b{col}\b", low), f"missing column {col}"

    # One cadence row per (user, ISO week).
    assert re.search(r"unique\s*\(\s*user_id\s*,\s*iso_week_start\s*\)", low), \
        "expected UNIQUE(user_id, iso_week_start)"

    checks = _checks(low)
    assert any("prompt_count" in c and "between 0 and 2" in c for c in checks), "prompt_count must be 0-2"
    assert any("skipped_count" in c and "between 0 and 2" in c for c in checks), "skipped_count must be 0-2"

    # Cadence stores NO work-environment answers.
    for forbidden in ("sentiment", "roadblock", "support"):
        assert not re.search(rf"\b{forbidden}\b", low), f"cadence must not carry answer column {forbidden!r}"


# ── T006 — weekly_work_environment_contributions: identity-stripped, no timestamp ─


def test_t006_contributions_identity_stripped_and_timestampless():
    body = _table_body(_strip_comments(_sql()), _AGGREGATE_TABLE)
    low = body.lower()

    # Exactly the aggregate-safe columns are present.
    for col in ("id", "team_manager_id", "iso_week_start", "sentiment", "roadblock", "support"):
        assert re.search(rf"\b{col}\b", low), f"missing column {col}"

    # No identity column.
    assert not re.search(r"\buser_id\b", low), "contributions must have NO user_id"
    assert "monitoring_session_id" not in low, "contributions must not link a monitoring session"

    # No insert/update bookkeeping timestamps, and no precise timestamp AT ALL —
    # iso_week_start (a date) is the only temporal field (re-identification guard).
    assert not re.search(r"\bcreated_at\b", low), "contributions must have NO created_at"
    assert not re.search(r"\bupdated_at\b", low), "contributions must have NO updated_at"
    assert "timestamp" not in low, "contributions must carry no precise timestamp column"


# ── T007 — owner-only forced RLS on the three private tables ──────────────────


def test_t007_owner_only_forced_rls_on_private_tables():
    sql = _sql()
    for table in _PRIVATE_TABLES:
        assert re.search(rf"alter table public\.{table}\s+enable row level security", sql, re.I), table
        assert re.search(rf"alter table public\.{table}\s+force\s+row level security", sql, re.I), table

    by_table: dict[str, list[tuple[str, str]]] = {}
    for name, tbl, pbody in _policies(_strip_comments(sql)):
        by_table.setdefault(tbl, []).append((name, pbody))

    for table in _PRIVATE_TABLES:
        prefix = _PRIVATE_POLICY_PREFIX[table]
        pol = by_table.get(table, [])
        names = {n for n, _ in pol}
        assert names == {f"{prefix}_select_self", f"{prefix}_insert_self", f"{prefix}_update_self"}, \
            f"{table} must have exactly owner select/insert/update policies, got {names}"
        for name, pbody in pol:
            low = pbody.lower()
            assert "to authenticated" in low, f"{name} must be TO authenticated"
            assert "auth.uid()) = user_id" in low, f"{name} must be owner-self-scoped"

    # Inserts on the session-linked tables must verify an OWNED monitoring session.
    for table in _SESSION_LINKED:
        prefix = _PRIVATE_POLICY_PREFIX[table]
        ins = next(b for n, b in by_table[table] if n == f"{prefix}_insert_self").lower()
        assert "exists" in ins and "monitoring_sessions" in ins, \
            f"{table} insert must verify an owned monitoring session"


# ── T008 — contributions: forced RLS, revoked grants, no manager/admin policy ─


def test_t008_contributions_forced_rls_revoked_no_manager_policy():
    sql = _sql()
    t = _AGGREGATE_TABLE
    assert re.search(rf"alter table public\.{t}\s+enable row level security", sql, re.I)
    assert re.search(rf"alter table public\.{t}\s+force\s+row level security", sql, re.I)
    assert re.search(rf"revoke all on public\.{t} from anon, ?authenticated", sql, re.I), \
        "direct anon/authenticated grants must be revoked"
    # No direct table grant back to anon/authenticated — access is RPC-only.
    assert not re.search(rf"grant[\w ,()]+on public\.{t}\s+to\s+(anon|authenticated)", sql, re.I), \
        "contributions must not be directly granted to anon/authenticated"

    pols = [(n, b) for n, tbl, b in _policies(_strip_comments(sql)) if tbl == t]
    assert pols, "expected the narrow function-owner policy on the contributions table"
    for name, pbody in pols:
        low = pbody.lower()
        for tok in _MANAGER_TOKENS:
            assert tok not in low, f"{name} references manager/admin token {tok!r}"


# ── T009 — submit_weekly_work_environment_checkin SECURITY DEFINER + logic ────


def test_t009_submit_rpc_security_and_logic():
    sql = _sql()
    fn = _function(sql, "submit_weekly_work_environment_checkin")
    assert fn, "submit RPC not found"
    low = fn.lower()

    assert "language plpgsql" in low
    assert "security definer" in low
    assert re.search(r"set\s+search_path\s*=\s*''", low), "must SET search_path = ''"

    # Caller validation via auth.uid(); NO impersonation parameter.
    assert "auth.uid()" in low, "must resolve auth.uid() internally"
    params = _function_param_list(fn)
    assert "uid" not in params and "user" not in params, f"submit RPC must take no caller-id param: {params!r}"

    # Employee-role gate, ISO-week Monday validation, option validation.
    assert "'employee'" in low and "role" in low, "must gate on employee role"
    assert "isodow" in low or "date_trunc" in low, "must validate the ISO-week Monday bucket"
    assert "could_be_better" in low and "'good'" in low, "must validate sentiment options"

    # Derive the team bucket from profiles.manager_id and complete private cadence.
    assert "profiles" in low and "manager_id" in low, "must derive team_manager_id from profiles.manager_id"
    assert "weekly_checkin_cadence" in low and "completed_at" in low, "must complete the private cadence"

    # The contribution INSERT must be identity-stripped (no user_id in the column list).
    ins = re.search(r"insert into public\.weekly_work_environment_contributions\s*\((.*?)\)", low, re.DOTALL)
    assert ins, "must insert one contribution row"
    assert "user_id" not in ins.group(1), "contribution insert must carry NO user_id"

    # Owner postgres + restricted EXECUTE grants.
    assert re.search(
        r"alter function public\.submit_weekly_work_environment_checkin\([^)]*\)\s+owner to postgres", sql, re.I)
    assert re.search(
        r"revoke execute on function public\.submit_weekly_work_environment_checkin\([^)]*\)\s+from public, ?anon",
        sql, re.I)
    assert re.search(
        r"grant execute on function public\.submit_weekly_work_environment_checkin\([^)]*\)\s+to authenticated",
        sql, re.I)


# ── T010 — get_weekly_work_environment_summary SECURITY DEFINER + grouped shape ─


def test_t010_summary_rpc_security_and_grouped_shape():
    sql = _sql()
    fn = _function(sql, "get_weekly_work_environment_summary")
    assert fn, "summary RPC not found"
    low = fn.lower()

    assert "language plpgsql" in low
    assert "security definer" in low
    assert re.search(r"set\s+search_path\s*=\s*''", low), "must SET search_path = ''"
    assert "auth.uid()" in low

    # Returns the grouped aggregate shape only.
    assert "returns table" in low
    rt = re.search(r"returns table\s*\((.*?)\)", low, re.DOTALL)
    assert rt, "summary RPC must RETURNS TABLE(...)"
    ret = rt.group(1)
    for col in ("iso_week_start", "sample_size", "sentiment", "roadblock", "support", "response_count"):
        assert col in ret, f"return shape missing {col}"
    # Never return a raw contribution id or individual rows.
    assert not re.search(r"\bid\b", ret), "summary must not return a contribution id column"
    assert "group by" in low and "count(" in low, "summary must return grouped counts, not rows"

    # Owner postgres + restricted EXECUTE grants.
    assert re.search(
        r"alter function public\.get_weekly_work_environment_summary\([^)]*\)\s+owner to postgres", sql, re.I)
    assert re.search(
        r"revoke execute on function public\.get_weekly_work_environment_summary\([^)]*\)\s+from public, ?anon",
        sql, re.I)
    assert re.search(
        r"grant execute on function public\.get_weekly_work_environment_summary\([^)]*\)\s+to authenticated",
        sql, re.I)


# ── T011 — role-gated aggregate visibility inside the summary RPC ─────────────


def test_t011_summary_rpc_role_gated_visibility():
    fn = _function(_sql(), "get_weekly_work_environment_summary").lower()
    assert fn, "summary RPC not found"

    # Employees are rejected.
    assert "'employee'" in fn
    assert re.search(r"raise\s+exception|42501|forbidden", fn), "employees must be rejected"

    # Team leads and admins are handled distinctly; team leads see own + subordinate buckets.
    assert "'team_lead'" in fn and "'admin'" in fn, "must distinguish team_lead and admin"
    assert "reports_under" in fn, "team-lead visibility must use the reports_under hierarchy"
    assert "team_manager_id" in fn

    # Null-bucket rows are excluded from manager summaries.
    assert re.search(r"team_manager_id\s+is not null", fn), "null team_manager_id rows must be excluded"


# ── T012 — privacy regression: no service-role / no manager individual-row path ─


def test_t012_no_service_role_or_manager_individual_path():
    stripped = _strip_comments(_sql()).lower()
    assert stripped, "migration must exist"
    assert "service_role" not in stripped, "no service-role path allowed"
    assert "supabase_service_role_key" not in stripped, "no service-role key allowed"

    # No manager/admin policy on any employee-private table (individual rows never
    # reach the manager layer; the ONLY manager read is the grouped summary RPC).
    for name, tbl, pbody in _policies(_strip_comments(_sql())):
        if tbl in _PRIVATE_TABLES:
            low = pbody.lower()
            for tok in _MANAGER_TOKENS:
                assert tok not in low, f"{name} on {tbl} references manager/admin token {tok!r}"


# ── T013 — immutability: the migration never mutates public.window_readings ───


def test_t013_migration_never_mutates_window_readings():
    low = _strip_comments(_sql()).lower()
    assert low, "migration must exist"
    # A read-only FK reference is permitted; any mutation/annotation is not.
    assert not re.search(r"alter table\s+public\.window_readings", low), "must not ALTER window_readings"
    assert not re.search(r"update\s+public\.window_readings", low), "must not UPDATE window_readings"
    assert not re.search(r"delete\s+from\s+public\.window_readings", low), "must not DELETE window_readings"
    assert not re.search(r"drop\s+\w+[^;]*window_readings", low), "must not DROP anything on window_readings"
    assert not re.search(r"comment\s+on\s+\w+\s+public\.window_readings", low), "must not annotate window_readings"
    assert not re.search(r"create\s+trigger\s+\w+[^;]*on\s+public\.window_readings", low), \
        "must not add a trigger on window_readings"
    # The single permitted mention: the optional read-only FK from the prompt table.
    assert "references public.window_readings(id)" in low, "expected the optional read-only FK reference"


# ── T065 — model-scope regression: Feature 012 touches NO inference model artifact ────


def test_t065_no_model_artifact_scope():
    """Feature 012 is a product layer over the existing coarse `Band` contract — it adds
    prompt tunables, storage, and UI, but NO stress-model threshold/weight/extractor/metadata
    change. The migration must therefore name no model artifact, and the feature must not
    require edits under packages/ml-video or docs/MODELS.md (research.md R-8)."""
    low = _strip_comments(_sql()).lower()
    assert low, "migration must exist"

    # The migration must not reference any model artifact path or metadata doc.
    for token in ("ml-video", "ml_video", "models.md", "model_version", "stress_probability"):
        assert token not in low, f"migration must not reference model artifact {token!r}"

    # It must not touch model-bearing tables/columns (it only reads window_readings via FK,
    # asserted immutable in T013). No model-internal vocabulary leaks in. (Word-specific tokens
    # — `down_weight` is the legitimate false-alarm aggregate marker, not a model weight.)
    for token in ("stress_threshold", "model_weight", "feature_extractor", "logreg", "stress_probability"):
        assert token not in low, f"migration must not reference model internal {token!r}"

    # The model artifact tree and the model doc still exist and are untouched by this feature
    # (a structural anchor — their presence is independent of feature 012).
    repo_root = Path(__file__).resolve().parents[3]
    assert (repo_root / "packages" / "ml-video").exists(), "ml-video package expected to exist (untouched)"
    assert (repo_root / "docs" / "MODELS.md").exists(), "docs/MODELS.md expected to exist (untouched)"
