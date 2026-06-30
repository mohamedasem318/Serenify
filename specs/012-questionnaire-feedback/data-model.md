# Data Model: Questionnaire Feedback

## Enumerations

```text
confirmatory_outcome = confirmed | false_alarm | opened_chat
confirmatory_lifecycle = visible | answered | expired
confirmatory_expiry_reason = signal_drop | session_end
confirmatory_aggregate_treatment = none | exclude_or_down_weight

session_feedback_status = submitted | skipped
session_feedback_sentiment = good | off
session_feedback_reason =
  suggestion_didnt_help | needed_quiet | ren_too_robotic | something_else
session_feedback_action_target = preferences | notifications | ack_only
session_feedback_sampling_policy = every_session

weekly_sentiment = good | could_be_better
weekly_roadblock =
  unclear_instructions_or_goals | waiting_on_other_team_members | software_or_tools_crashing
weekly_support =
  deadline_flexibility | better_team_alignment_or_communication |
  quieter_workspace | better_technical_equipment
```

## Table: `public.questionnaire_confirmatory_prompts`

One row per shown prompt. This row is created when the prompt becomes visible, then updated exactly once on answer or expiry.

| Column | Type | Required | Notes |
|--------|------|----------|-------|
| `id` | `uuid` | yes | Primary key, default `gen_random_uuid()`. |
| `user_id` | `uuid` | yes | References `auth.users(id)`; equals `(select auth.uid())` under RLS. |
| `monitoring_session_id` | `uuid` | yes | References `public.monitoring_sessions(id)`; unique to enforce one prompt per session. |
| `trigger_window_reading_id` | `uuid` | no | Optional reference to `public.window_readings(id)` if resolved from the owner-visible trend row. |
| `triggered_window_captured_at` | `timestamptz` | yes | Required trigger window/time linkage from the live `WindowOutcome.capturedAt`. |
| `trigger_band` | `text` | yes | Check `trigger_band = 'tense'`. |
| `shown_at` | `timestamptz` | yes | Prompt visible time. |
| `lifecycle` | `text` | yes | `visible`, `answered`, or `expired`. |
| `outcome` | `text` | no | `confirmed`, `false_alarm`, or `opened_chat`; only set when `lifecycle='answered'`. |
| `answered_at` | `timestamptz` | no | Set with answered outcomes. |
| `expiry_reason` | `text` | no | `signal_drop` or `session_end`; only set when `lifecycle='expired'`. |
| `aggregate_treatment` | `text` | yes | `exclude_or_down_weight` for `false_alarm`; `none` otherwise. Forward contract for feature 017. |
| `created_at` | `timestamptz` | yes | Default `now()`. |
| `updated_at` | `timestamptz` | yes | Maintained by `touch_updated_at()`. |

### Constraints

- `UNIQUE (monitoring_session_id)` enforces one prompt per monitoring session.
- `outcome IS NOT NULL` only when `lifecycle='answered'`.
- `expiry_reason IS NOT NULL` only when `lifecycle='expired'`.
- `aggregate_treatment = 'exclude_or_down_weight'` only when `outcome='false_alarm'`.
- If `trigger_window_reading_id` is present, it must reference a reading whose `session_id` and `user_id` match this row.

### Immutability Contract

This table references `window_readings`; it never mutates them. No column is added to `window_readings` for false alarms. Today card and employee trend data/rendering stay unchanged.

## Table: `public.questionnaire_session_feedback`

Employee-private product feedback for one ended monitoring session.

| Column | Type | Required | Notes |
|--------|------|----------|-------|
| `id` | `uuid` | yes | Primary key. |
| `user_id` | `uuid` | yes | Owner. |
| `monitoring_session_id` | `uuid` | yes | References `monitoring_sessions(id)`, unique. |
| `status` | `text` | yes | `submitted` or `skipped`. |
| `sentiment` | `text` | no | `good` or `off`; null only for skip. |
| `reason` | `text` | no | Required when `sentiment='off'`. |
| `free_text` | `text` | no | Only allowed for `reason='something_else'`; reject empty trimmed text. |
| `action_target` | `text` | no | `preferences`, `notifications`, or `ack_only`; derived from reason. |
| `sampling_policy` | `text` | yes | Defaults to `every_session`; documents the v1 sampling seam. |
| `created_at` | `timestamptz` | yes | Default `now()`. |

### Constraints

- One feedback row per monitoring session.
- `status='skipped'` requires `sentiment`, `reason`, `free_text`, and `action_target` to be null.
- `sentiment='good'` requires no reason/free text.
- `sentiment='off'` requires a reason.
- Free text and `ren_too_robotic` are stored only in this employee-private table and are not routed to Ren or manager aggregates.

## Table: `public.weekly_checkin_cadence`

Employee-private cadence state for weekly check-in eligibility. Contains no work-environment answer values.

| Column | Type | Required | Notes |
|--------|------|----------|-------|
| `id` | `uuid` | yes | Primary key. |
| `user_id` | `uuid` | yes | Owner. |
| `iso_week_start` | `date` | yes | Monday start date of the ISO week. |
| `prompt_count` | `smallint` | yes | 0-2. Increment on shown prompt. |
| `skipped_count` | `smallint` | yes | 0-2. Increment on skip. |
| `last_prompted_at` | `timestamptz` | no | Last time the card was shown. |
| `completed_at` | `timestamptz` | no | Set when Good or Done submits. |
| `created_at` | `timestamptz` | yes | Default `now()`. |
| `updated_at` | `timestamptz` | yes | Maintained by `touch_updated_at()`. |

### Constraints

- `UNIQUE (user_id, iso_week_start)`.
- `prompt_count BETWEEN 0 AND 2`.
- `skipped_count BETWEEN 0 AND 2`.
- Completed weeks are not re-prompted.

## Table: `public.weekly_work_environment_contributions`

Identity-stripped aggregate contribution row. This table intentionally has no `user_id`.

| Column | Type | Required | Notes |
|--------|------|----------|-------|
| `id` | `uuid` | yes | Primary key; not returned by manager aggregate functions. |
| `team_manager_id` | `uuid` | no | Derived from the submitting employee's `profiles.manager_id` at submit time; null rows are excluded from manager summaries. |
| `iso_week_start` | `date` | yes | ISO week bucket. |
| `sentiment` | `text` | yes | `good` or `could_be_better`. |
| `roadblock` | `text` | no | Required for `could_be_better`, null for `good`. |
| `support` | `text` | no | Required for `could_be_better`, null for `good`. |

The contribution row intentionally carries no precise timestamp; `iso_week_start` is the only temporal field. A per-row `now()` would correlate with `weekly_checkin_cadence.completed_at` from the same submit transaction and re-identify the otherwise identity-stripped row. `weekly_checkin_cadence` timestamps remain unchanged because that table is employee-private and owner-only.

### Persisted vs Derived

Persisted:

- Employee-private cadence rows.
- Identity-stripped weekly contribution buckets.
- Confirmatory prompt outcomes and false-alarm aggregate treatment markers.
- Employee-private session-end product feedback.

Derived:

- Weekly manager summaries: grouped counts/percentages by week/team/sentiment/roadblock/support.
- Future feature-017 false-alarm handling: aggregate query can exclude or down-weight readings associated with `aggregate_treatment='exclude_or_down_weight'`.

Never persisted:

- Manager-visible individual weekly answers.
- A precise insert timestamp on weekly aggregate contribution rows.
- A service-role copy of questionnaire rows.
- Ren conversational input derived from session-end product feedback.

## RLS Policy Shape

### Owner-only questionnaire tables

For `questionnaire_confirmatory_prompts`, `questionnaire_session_feedback`, and `weekly_checkin_cadence`:

```sql
alter table public.<table> enable row level security;
alter table public.<table> force row level security;

create policy <table>_select_self
  on public.<table> for select to authenticated
  using ((select auth.uid()) = user_id);

create policy <table>_insert_self
  on public.<table> for insert to authenticated
  with check ((select auth.uid()) = user_id);

create policy <table>_update_self
  on public.<table> for update to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);
```

No manager/admin policy exists on these tables.

### Weekly contribution table

`weekly_work_environment_contributions` is not directly readable or writable by authenticated users:

- Enable + force RLS.
- Revoke all direct grants from `anon` and `authenticated`.
- Add only the narrow table-owner policy needed by the `SECURITY DEFINER` RPC owner.
- Expose submit/read behavior through restricted RPCs with `REVOKE EXECUTE FROM PUBLIC, anon` and `GRANT EXECUTE TO authenticated`.

## State Machines

### Confirmatory prompt

```text
idle
  -> tracking_tense        (active session + band tense)
  -> idle                  (band drops before sustained tunable)
  -> visible               (tense sustained >= CONFIRMATORY_TENSE_SUSTAINED_MS)
  -> answered              (confirmed | false_alarm | opened_chat)
  -> expired               (signal_drop after dwell floor, or session_end)
```

Guards:

- One row per `monitoring_session_id`.
- Previous session `false_alarm` suppresses the next monitoring session only.
- Ren chat stress detection never enters this state machine.

### Session-end feedback

```text
ineligible -> eligible_after_session_end -> choice
choice -> submitted_good | negative_reason | skipped
negative_reason -> route_action | ack_only | free_text_submit
```

Guards:

- Mount only after monitoring session ended.
- Do not mount while confirmatory prompt is visible/resolving.
- V1 sampling policy returns true for every session.

### Weekly check-in

```text
not_due -> due_on_first_authenticated_visit_of_iso_week
due -> prompted_once
prompted_once -> completed | skipped_once
skipped_once -> prompted_twice_on_later_visit
prompted_twice -> completed | skipped_until_next_iso_week
```

Guards:

- No completed aggregate contribution is created on skip or abandoned Q2.
- `Done` requires both roadblock and support when sentiment is `could_be_better`.
