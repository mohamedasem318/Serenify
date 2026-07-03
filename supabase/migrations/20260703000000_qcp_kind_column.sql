-- BACKLOG #134 — a second, milder confirmatory trigger (~60s sustained a_little_tense)
-- alongside the existing ~20s sustained-tense acute trigger.
--   Table:      public.questionnaire_confirmatory_prompts (T014,
--               20260630000000_questionnaire_feedback.sql:53-79)
--   Prior work: #127/#130/#132 (the browser prompt budget + the DB-side re-arm index,
--               20260702000000_qcp_one_answered_per_session.sql). Decisions: D-10 (sibling).
--
-- The tense-senior budget allows ONE answered MILD prompt AND ONE answered TENSE prompt per
-- monitoring session. The #132 index `qcp_one_answered_per_session (monitoring_session_id)
-- WHERE lifecycle='answered'` caps *answered* rows at one per session, FULL STOP — so a
-- mild-answered + tense-answered pair in the same session collides (empirically: the second
-- answered UPDATE raises `duplicate key value violates unique constraint
-- "qcp_one_answered_per_session"`). We add a `kind` discriminator and re-scope the cap to
-- one answered row per (session, kind).
--
-- `trigger_band` is deliberately UNCHANGED: it remains the existing constrained ('tense'-only)
-- column, and `kind` is the new mild/tense discriminator. Widening `trigger_band` was NOT in
-- scope (it would touch the base migration's CHECK and the T003 privacy assertion); the client
-- keeps writing `trigger_band='tense'` for both kinds.

-- The trigger kind: 'mild' (~60s sustained a_little_tense) | 'tense' (~20s sustained tense).
-- Existing rows are all acute → backfilled to 'tense' by the column default.
ALTER TABLE public.questionnaire_confirmatory_prompts
  ADD COLUMN kind text NOT NULL DEFAULT 'tense'
    CONSTRAINT qcp_kind_valid CHECK (kind IN ('mild', 'tense'));

-- Replace the single-answered-row-per-session cap (#132) with a PER-KIND cap: at most one
-- answered MILD and one answered TENSE row per session. Visible/expired rows stay uncapped
-- (one per re-arm episode), exactly as #132 intended — only the discriminator gains a dimension.
DROP INDEX IF EXISTS qcp_one_answered_per_session;

CREATE UNIQUE INDEX qcp_one_answered_per_session_per_kind
  ON public.questionnaire_confirmatory_prompts (monitoring_session_id, kind)
  WHERE lifecycle = 'answered';
