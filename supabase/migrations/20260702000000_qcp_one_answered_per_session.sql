-- BACKLOG #127 (PR #130 partial fix, this migration completes it) — a re-armed
-- confirmatory prompt's second INSERT now persists.
--   Table:      public.questionnaire_confirmatory_prompts (T014,
--               20260630000000_questionnaire_feedback.sql:53-79)
--   Decisions:  insert + partial-unique-index (not upsert-in-place) — keeps a
--               permanent row per prompt episode, matching the existing
--               visible → answered|expired lifecycle and the client's plain
--               `.insert()` in createConfirmatoryPrompt (questionnaire-client.ts).
--
-- The original qcp_one_per_session UNIQUE(monitoring_session_id) constraint capped
-- the table at ONE row per session, full stop. PR #130 fixed the browser-side
-- prompt budget so a second prompt CAN legitimately show after re-arm (signal_drop /
-- session_end auto-resolutions never spend the budget), but the second
-- createConfirmatoryPrompt insert then hit this constraint and failed — silently,
-- until the companion logging fix in this same change. Multiple visible/expired
-- rows per session are legitimate (one per re-arm episode); only one ANSWERED
-- row per session is the actual budget rule — the same predicate the client's
-- budgetConsumed check already enforces (an explicit user answer, not an auto
-- expiry, spends the one-time budget). Replace the full-table unique constraint
-- with a partial unique index scoped to lifecycle = 'answered'.
ALTER TABLE public.questionnaire_confirmatory_prompts
  DROP CONSTRAINT qcp_one_per_session;

CREATE UNIQUE INDEX qcp_one_answered_per_session
  ON public.questionnaire_confirmatory_prompts (monitoring_session_id)
  WHERE lifecycle = 'answered';
