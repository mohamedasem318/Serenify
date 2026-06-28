# Contract: Conversation and Messages Schema + RLS

## Tables

`public.chat_conversations`

- `id uuid primary key default gen_random_uuid()`
- `user_id uuid not null references auth.users(id) on delete cascade`
- `state text not null default 'open' check (state in ('open','ended'))`
- `title text null`
- `rollup_band text null check (rollup_band in ('at_ease','a_little_tense','tense'))`
- `message_count integer not null default 0`
- `last_message_at timestamptz null`
- `created_at timestamptz not null default now()`
- `updated_at timestamptz not null default now()`

`public.chat_messages`

- `id uuid primary key default gen_random_uuid()`
- `conversation_id uuid not null references public.chat_conversations(id) on delete cascade`
- `user_id uuid not null references auth.users(id) on delete cascade`
- `role text not null check (role in ('user','assistant'))`
- `content text not null`
- `created_at timestamptz not null default now()`

## Forbidden Storage

Do not store:

- crisis flags or crisis timestamps
- per-message bands
- raw scorer JSON
- prompt text
- provider reasoning
- resource-panel events
- manager/admin/employer notification state

## RLS Requirements

- Enable and force RLS on both tables.
- Revoke `anon` privileges.
- Grant only the needed `authenticated` privileges.
- Use `TO authenticated`.
- Use `(select auth.uid()) = user_id` ownership predicates.
- UPDATE policies include both `USING` and `WITH CHECK`.
- `chat_messages.insert` requires the target conversation to be owned by the caller.
- No manager/admin/employer policy exists.
- No service-role key is used for chat content.

## Delete Behavior

Deleting a conversation hard deletes the conversation row and all messages immediately through `ON DELETE CASCADE`, scoped by owner-only delete policy.

