# Contract: Weekly Aggregate Readiness for Feature 017

## Privacy Boundary

Feature 012 persists weekly work-environment feedback so future manager surfaces can read only team-level aggregates.

Manager-facing code must never receive:

- `user_id`
- employee name
- employee email
- prompt cadence id
- raw contribution id
- free text
- monitoring session id
- an individual answer row
- a precise insert timestamp; the contribution row carries only the ISO-week bucket to prevent timestamp-join re-identification against the private cadence row

## Persisted Contribution Row

```text
weekly_work_environment_contributions
  id uuid primary key
  team_manager_id uuid null
  iso_week_start date not null
  sentiment text not null
  roadblock text null
  support text null
```

`team_manager_id` is an aggregate bucket derived at submit time from the employee's current `profiles.manager_id`. It identifies the manager/team bucket, not the employee.

Rows with `team_manager_id is null` can be stored for employee completion but are excluded from manager summaries.

Residual: the submit RPC's contribution insert and cadence completion share a transaction, so transaction metadata such as `xmin` or commit time is a theoretical residual correlation; this is accepted for the demo build and not addressed at the schema level.

## Submit RPC

```sql
select public.submit_weekly_work_environment_checkin(
  p_iso_week_start := date '2026-06-29',
  p_sentiment := 'could_be_better',
  p_roadblock := 'unclear_instructions_or_goals',
  p_support := 'better_team_alignment_or_communication'
);
```

Expected effects:

- Inserts one identity-stripped contribution.
- Updates the caller's private cadence row to completed.
- Returns no row payload.

## Aggregate Summary RPC

```sql
select *
from public.get_weekly_work_environment_summary(
  p_iso_week_start := date '2026-06-29'
);
```

Return shape:

```text
iso_week_start date
sample_size integer
sentiment text
roadblock text null
support text null
response_count integer
```

Rules:

- `sample_size` is the total visible contribution count for the caller/week before grouping.
- `response_count` is the grouped count for the returned bucket.
- Return rows group by `sentiment`, `roadblock`, and `support`.
- Do not include raw `id`.
- Do not expose direct table select to manager code.

## Manager Visibility

Caller role handling:

- `employee`: reject.
- `team_lead`: include buckets where `team_manager_id = auth.uid()` plus subordinate team-lead buckets if the existing reporting hierarchy proves visibility.
- `admin`: include all buckets.

The function must use `auth.uid()` internally; it must not accept a user id to impersonate.

## Minimum-Headcount Hardening

BACKLOG #123 remains out of scope for the demo build. Before real data collection:

- Add minimum sample-size suppression to `get_weekly_work_environment_summary`.
- Document the threshold in the constitution/backlog resolution.
- Update feature 017 to handle suppressed buckets.

The current contract includes `sample_size` specifically so that hardening can be added without changing the manager UI data model.

## False-Alarm Forward Contract

Feature 017 aggregate logic for passive stress can later join employee-owned prompt outcomes under a restricted aggregate function:

- Treat `questionnaire_confirmatory_prompts.aggregate_treatment='exclude_or_down_weight'` as the forward marker.
- Join by `monitoring_session_id` and `triggered_window_captured_at`, preferring `trigger_window_reading_id` when present.
- Do not mutate `window_readings`.
- Do not change employee Today-card or trend rendering.

Feature 012 only persists the marker; it does not build manager stress aggregates.
