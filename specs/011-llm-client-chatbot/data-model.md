# Phase 1 Data Model: LLM Client and Ren Chatbot

## Overview

This feature adds employee-private chat storage and app-owned crisis resource data. Chat persistence uses Supabase/Postgres with RLS-as-user: every read/write runs as the authenticated employee, and no service-role access path exists for chat content.

## Entities

### Conversation (`public.chat_conversations`)

Employee-owned chat thread.

| Column | Type | Notes |
|---|---|---|
| `id` | `uuid` PK | `default gen_random_uuid()` |
| `user_id` | `uuid` NOT NULL | `references auth.users(id) on delete cascade`; owning employee |
| `state` | `text` NOT NULL | `check (state in ('open','ended'))`, default `open` |
| `title` | `text` NULL | auto-title or employee rename; short calm title |
| `rollup_band` | `text` NULL | `check (rollup_band in ('at_ease','a_little_tense','tense'))`; only stored chat-derived band |
| `message_count` | `integer` NOT NULL | user message count for fifth-message rollup cadence |
| `last_message_at` | `timestamptz` NULL | recent-chats ordering |
| `created_at` | `timestamptz` NOT NULL | `default now()` |
| `updated_at` | `timestamptz` NOT NULL | updated on message, title, rollup, state changes |

Forbidden columns: no `crisis`, `crisis_at`, `crisis_count`, `latest_per_message_band`, `peak_band`, `manager_visible`, or notification fields.

Indexes:

- `(user_id, updated_at desc)` for history/recent chats.
- `(user_id, state, updated_at desc)` for open/current conversation lookup.

### Message (`public.chat_messages`)

Persisted user/assistant chat text.

| Column | Type | Notes |
|---|---|---|
| `id` | `uuid` PK | `default gen_random_uuid()` |
| `conversation_id` | `uuid` NOT NULL | `references public.chat_conversations(id) on delete cascade` |
| `user_id` | `uuid` NOT NULL | denormalized owner for RLS; references `auth.users(id)` |
| `role` | `text` NOT NULL | `check (role in ('user','assistant'))` |
| `content` | `text` NOT NULL | full message text after stripping control tokens |
| `created_at` | `timestamptz` NOT NULL | `default now()` |

Forbidden columns: no per-message band, no crisis boolean, no raw scorer JSON, no prompt text, no provider reasoning.

Indexes:

- `(conversation_id, created_at asc)` for transcript reconstruction.
- `(user_id, created_at desc)` for owner-scoped diagnostics/history.

### Rollup Band

Stored as `chat_conversations.rollup_band`. It is produced by a fresh whole-conversation rollup every fifth user message and on `[END]`. It replaces the prior conversation-level band. It is not an average or peak of per-message scores.

### Crisis Resource Row

App-owned verified resource shape for 011:

```ts
type CrisisResourceRow = {
  country: "EG" | "US";
  name: string;
  number: string;
  url: string | null;
  last_checked: "2026-06-28";
};
```

Rows:

| Country | Name | Number | URL | Last checked |
|---|---|---|---|---|
| `EG` | General Secretariat of Mental Health & Addiction Treatment hotline | `16328` | null | `2026-06-28` |
| `US` | 988 Suicide & Crisis Lifeline | `Call/text 988` | null | `2026-06-28` |

The panel always includes the universal emergency line: if the employee is in immediate danger, contact local emergency services. Egypt rendering also includes emergency number `123`.

### Provider Configuration

Config fields:

- primary provider: Groq `openai/gpt-oss-120b`, `reasoning_effort=low`
- fallback provider: LM Studio `openai/gpt-oss-20b`
- fallback mode: fail-clean by default; silent fallback only behind explicit flag
- bot display name: one config string, default `Ren`
- telemetry allowlist: request outcome, provider used, latency bucket, retry count, validation failure type

### Prompt File

Versioned prompt asset loaded from `packages/llm-client/prompts/`.

Prompt ids:

- `ren`
- `ren_preference_block`
- `scorer_per_message`
- `scorer_rollup`
- `auto_title`

## State Transitions

Conversation:

```text
open -> ended       after [END] rollup and auto-title both succeed
open -> open        if [END] rollup or auto-title fails; show retry state
open -> deleted     hard delete conversation and messages
ended -> open       resume is allowed if implementation keeps prior state openable; transcript continuity comes from messages
```

Message send:

```text
draft -> pending -> user_message_persisted -> ren/scorer pending
ren success + scorer success -> assistant persisted + live panel maybe shown
ren success + scorer failure -> assistant persisted + no per-message score stored
ren failure -> no assistant invented; retry state preserves typed text
both failure -> no assistant invented; retry state preserves typed text
```

## RLS and Grants

Migration posture mirrors feature 008:

```sql
alter table public.chat_conversations enable row level security;
alter table public.chat_conversations force row level security;
alter table public.chat_messages enable row level security;
alter table public.chat_messages force row level security;

revoke all on public.chat_conversations from anon, authenticated;
revoke all on public.chat_messages from anon, authenticated;

grant select, insert, update, delete on public.chat_conversations to authenticated;
grant select, insert, delete on public.chat_messages to authenticated;
```

Policies:

```sql
create policy chat_conversations_select_self
on public.chat_conversations
for select
to authenticated
using ((select auth.uid()) = user_id);

create policy chat_conversations_insert_self
on public.chat_conversations
for insert
to authenticated
with check ((select auth.uid()) = user_id);

create policy chat_conversations_update_self
on public.chat_conversations
for update
to authenticated
using ((select auth.uid()) = user_id)
with check ((select auth.uid()) = user_id);

create policy chat_conversations_delete_self
on public.chat_conversations
for delete
to authenticated
using ((select auth.uid()) = user_id);

create policy chat_messages_select_self
on public.chat_messages
for select
to authenticated
using ((select auth.uid()) = user_id);

create policy chat_messages_insert_self
on public.chat_messages
for insert
to authenticated
with check (
  (select auth.uid()) = user_id
  and exists (
    select 1
    from public.chat_conversations c
    where c.id = conversation_id
      and c.user_id = (select auth.uid())
  )
);

create policy chat_messages_delete_self
on public.chat_messages
for delete
to authenticated
using ((select auth.uid()) = user_id);
```

No manager/admin/employer policies are created. No service-role key is introduced. No crisis state is stored.

