# Contract: Questionnaire Storage and RLS

## Scope

This contract defines how Feature 012 persists questionnaire data without introducing service-role access or manager-visible individual answer paths.

## Tables

### `questionnaire_confirmatory_prompts`

Employee-owned prompt lifecycle and answered outcomes.

Required behavior:

- Insert row when the prompt is shown.
- Update the same row to `answered` with exactly one outcome, or `expired` with an expiry reason.
- Enforce `UNIQUE (monitoring_session_id)`.
- Store `triggered_window_captured_at` for every shown prompt.
- Store `trigger_window_reading_id` when resolved through owner-visible `window_readings`.
- Store `aggregate_treatment='exclude_or_down_weight'` only for `false_alarm`.
- Never update `window_readings`.

RLS:

- `SELECT`, `INSERT`, and `UPDATE` to `authenticated` only where `(select auth.uid()) = user_id`.
- Insert/update must also verify the referenced monitoring session is owned by the caller.
- No manager/admin policy.
- No delete policy required.

### `questionnaire_session_feedback`

Employee-owned product feedback for ended monitoring sessions.

Required behavior:

- One row per monitoring session.
- `status='skipped'` stores no negative reason and no free text.
- `ren_too_robotic` and `something_else.free_text` are stored only here.
- The table is not read by Ren, manager queries, or aggregate functions.
- `sampling_policy='every_session'` in v1.

RLS:

- `SELECT`, `INSERT`, and `UPDATE` owner-only.
- Insert must verify the referenced monitoring session is owned by the caller.
- No manager/admin policy.

### `weekly_checkin_cadence`

Employee-owned weekly prompt cadence with no answer values.

Required behavior:

- Unique `(user_id, iso_week_start)`.
- `prompt_count <= 2`.
- `skipped_count <= 2`.
- First authenticated visit of a new ISO week creates or updates cadence and can show prompt.
- First skip allows one later same-week re-prompt.
- Second skip suppresses until next ISO week.

RLS:

- `SELECT`, `INSERT`, and `UPDATE` owner-only.
- No manager/admin policy.

### `weekly_work_environment_contributions`

Identity-stripped answer buckets for future aggregate reporting.

Required behavior:

- No `user_id`, employee name, email, monitoring session id, or prompt cadence id.
- Store `team_manager_id`, `iso_week_start`, `sentiment`, optional `roadblock`, and optional `support`.
- Carry no precise insert timestamp; `iso_week_start` is the only temporal field to avoid timestamp-join re-identification against private cadence completion timestamps.
- Good sentiment stores no roadblock/support.
- Could-be-better sentiment requires both roadblock and support.
- Direct contribution rows are never returned to managers.

RLS/grants:

- Enable and force RLS.
- Revoke all direct privileges from `anon` and `authenticated`.
- Add only the function-owner policy required for restricted RPC execution.
- All employee submissions go through `submit_weekly_work_environment_checkin`.
- All manager reads go through `get_weekly_work_environment_summary`.

## RPC: `submit_weekly_work_environment_checkin`

Purpose: insert one identity-stripped weekly contribution and mark the caller's private cadence complete.

Signature:

```sql
public.submit_weekly_work_environment_checkin(
  p_iso_week_start date,
  p_sentiment text,
  p_roadblock text default null,
  p_support text default null
) returns void
```

Contract:

1. Resolve `v_user_id := auth.uid()`; reject null.
2. Verify caller profile exists and `role='employee'`.
3. Validate ISO week start is the Monday bucket expected by the web client.
4. Validate sentiment/options.
5. Lock or create the caller's `weekly_checkin_cadence` row for the week.
6. Reject or no-op if already completed.
7. Derive `team_manager_id` from `public.profiles.manager_id`.
8. Insert one row into `weekly_work_environment_contributions` without `user_id`.
9. Update private cadence `completed_at`.

Security requirements:

- `LANGUAGE plpgsql SECURITY DEFINER SET search_path = ''`.
- Owner `postgres`.
- `REVOKE EXECUTE FROM PUBLIC, anon`.
- `GRANT EXECUTE TO authenticated`.
- No service-role key.

## RPC: `get_weekly_work_environment_summary`

Purpose: future feature-017 aggregate-only manager read.

Signature:

```sql
public.get_weekly_work_environment_summary(
  p_iso_week_start date
) returns table (
  iso_week_start date,
  sample_size integer,
  sentiment text,
  roadblock text,
  support text,
  response_count integer
)
```

Contract:

1. Resolve `auth.uid()` and caller role.
2. Allow `team_lead` and `admin`; reject employees.
3. For team leads, aggregate rows whose `team_manager_id` is the caller or a subordinate team-lead bucket visible through the existing reporting hierarchy.
4. For admins, aggregate all team buckets.
5. Return grouped counts only; never return contribution ids or individual rows.
6. Include `sample_size` so BACKLOG #123 can later suppress low-headcount buckets before real data collection.

Security requirements match `submit_weekly_work_environment_checkin`.

## Service-Role Prohibition

Feature 012 must not add:

- `SUPABASE_SERVICE_ROLE_KEY` or equivalent env vars.
- Server clients initialized with a service role.
- FastAPI table writes that bypass caller RLS.
- Manager/admin RLS policies on employee-private tables.

The web client uses the authenticated employee session. RPCs validate the caller through `auth.uid()`.
