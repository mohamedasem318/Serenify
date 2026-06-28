-- Employee-private chat storage — two tables, owner-only RLS, no manager/admin
-- path, no service-role, and NO crisis state anywhere.
--   Feature:    011-llm-client-chatbot (T019)
--   Decisions:  revised D-1 posture (feature 008) — all DB I/O runs AS THE USER via
--               the forwarded JWT + publishable anon key; there is NO service-role key.
--   Data model: specs/011-llm-client-chatbot/data-model.md
--   Contract:   specs/011-llm-client-chatbot/contracts/chat-storage-rls.md
--
-- Privacy is STRUCTURAL (Principle I + the feature-008 mechanism):
--   * NO manager/admin/employer policy on either table — chat content and crisis
--     moments never reach the manager layer (same boundary as raw signals).
--   * ENABLE + FORCE RLS on both tables. FORCE is safe and desirable: every writer
--     (the API and, if ever used, the browser) acts as `authenticated` via a
--     forwarded user JWT and is fully subject to RLS; FORCE also blocks any
--     accidental table-owner bypass. There is no service-role write path to exempt.
--   * Crisis is LIVE-ONLY: there is deliberately NO crisis column, crisis timestamp,
--     per-message band, raw scorer JSON, prompt text, or notification column on
--     EITHER table (FR-041). The only stored chat-derived band is the conversation
--     rollup_band. Forbidden state is ABSENT by construction, not merely hidden.
--   * Per-role grants are enumerated explicitly: Supabase grants per role, so
--     `REVOKE … FROM PUBLIC` alone is a no-op (DECISIONS 2026-05-25). We REVOKE ALL
--     from anon + authenticated, then GRANT the precise verbs back to
--     `authenticated` only. anon gets nothing. There are no server-only columns to
--     withhold here (unlike window_readings), so SELECT is a table grant.
--
-- Delete is a HARD delete: removing a conversation cascades to its messages
-- immediately (ON DELETE CASCADE), scoped by the owner-only delete policy.

-- ── chat_conversations ───────────────────────────────────────────────────
-- One employee-owned chat thread. Holds the lifecycle state, the calm auto-title,
-- and the ONE current rollup band. No crisis field (FR-041), no per-message/peak band.
CREATE TABLE public.chat_conversations (
  id              uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         uuid        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  state           text        NOT NULL DEFAULT 'open'
                    CHECK (state IN ('open', 'ended')),
  title           text,
  rollup_band     text        CHECK (rollup_band IN ('at_ease', 'a_little_tense', 'tense')),
  message_count   integer     NOT NULL DEFAULT 0,
  last_message_at timestamptz,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now()
);

-- History / recent-chats ordering, and open/current lookup for the pill.
CREATE INDEX chat_conversations_user_updated_idx
  ON public.chat_conversations (user_id, updated_at DESC);
CREATE INDEX chat_conversations_user_state_updated_idx
  ON public.chat_conversations (user_id, state, updated_at DESC);

-- ── chat_messages ────────────────────────────────────────────────────────
-- Persisted user/assistant text — the source of truth for resume and history.
-- Control tokens ([END]/[CRISIS]) are stripped before insert. No per-message
-- band, no crisis boolean, no raw scorer JSON, no prompt text, no reasoning.
CREATE TABLE public.chat_messages (
  id              uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id uuid        NOT NULL
                    REFERENCES public.chat_conversations(id) ON DELETE CASCADE,
  user_id         uuid        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role            text        NOT NULL CHECK (role IN ('user', 'assistant')),
  content         text        NOT NULL,
  created_at      timestamptz NOT NULL DEFAULT now()
);

-- Transcript reconstruction (per conversation, time-ordered) and owner-scoped history.
CREATE INDEX chat_messages_conversation_created_idx
  ON public.chat_messages (conversation_id, created_at);
CREATE INDEX chat_messages_user_created_idx
  ON public.chat_messages (user_id, created_at DESC);

-- ── RLS — ENABLE + FORCE on both tables ───────────────────────────────────
ALTER TABLE public.chat_conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.chat_conversations FORCE  ROW LEVEL SECURITY;
ALTER TABLE public.chat_messages      ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.chat_messages      FORCE  ROW LEVEL SECURITY;

-- Owner-only policies. `(select auth.uid())` (not bare auth.uid()) per current
-- Supabase guidance — the initplan is cached once per statement. NO manager/admin
-- policy on either table (Principle I).
CREATE POLICY chat_conversations_select_self ON public.chat_conversations
  FOR SELECT TO authenticated USING ((select auth.uid()) = user_id);
CREATE POLICY chat_conversations_insert_self ON public.chat_conversations
  FOR INSERT TO authenticated WITH CHECK ((select auth.uid()) = user_id);
CREATE POLICY chat_conversations_update_self ON public.chat_conversations
  FOR UPDATE TO authenticated
  USING ((select auth.uid()) = user_id)
  WITH CHECK ((select auth.uid()) = user_id);
CREATE POLICY chat_conversations_delete_self ON public.chat_conversations
  FOR DELETE TO authenticated USING ((select auth.uid()) = user_id);

CREATE POLICY chat_messages_select_self ON public.chat_messages
  FOR SELECT TO authenticated USING ((select auth.uid()) = user_id);
-- A message insert must be owned AND target an OWNED conversation — a message can
-- never be attached to someone else's thread.
CREATE POLICY chat_messages_insert_self ON public.chat_messages
  FOR INSERT TO authenticated
  WITH CHECK (
    (select auth.uid()) = user_id
    AND EXISTS (
      SELECT 1 FROM public.chat_conversations c
      WHERE c.id = conversation_id AND c.user_id = (select auth.uid())
    )
  );
CREATE POLICY chat_messages_delete_self ON public.chat_messages
  FOR DELETE TO authenticated USING ((select auth.uid()) = user_id);
-- No UPDATE policy on chat_messages — message text is immutable once written.

-- ── Per-role grants (explicit; PUBLIC/table-level revoke alone is a no-op) ──
REVOKE ALL ON public.chat_conversations FROM anon, authenticated;
REVOKE ALL ON public.chat_messages      FROM anon, authenticated;

-- No server-only columns on either table, so SELECT is a plain table grant. The
-- conversation owner may read/create/rename/end/delete their threads; messages are
-- create + read + delete (immutable, so no UPDATE grant). anon gets nothing.
GRANT SELECT, INSERT, UPDATE, DELETE ON public.chat_conversations TO authenticated;
GRANT SELECT, INSERT, DELETE         ON public.chat_messages      TO authenticated;
