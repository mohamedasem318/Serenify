# Tasks: LLM Client and Ren Chatbot

**Input**: Design documents from `specs/011-llm-client-chatbot/`

**Prerequisites**: `plan.md`, `spec.md`, `research.md`, `data-model.md`, `contracts/`, `quickstart.md`

**Tests**: Required by the feature specification and Constitution Principle VII. Write test tasks first and ensure they fail before implementation.

**Prompt input rule**: The prompt files in `packages/llm-client/prompts/` are fixed input. Tasks may load, validate, and wire these files, but must not author or rewrite prompt wording.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel because it touches a distinct file and does not depend on an incomplete task.
- **[Story]**: User story label for implementation phases only.
- All task descriptions include exact file paths.

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Create the package and integration skeleton needed by all stories.

- [X] T001 Create the `packages/llm-client/pyproject.toml` Python package manifest with pytest/ruff configuration and package metadata.
- [X] T002 Create the `packages/llm-client/src/llm_client/__init__.py` package export skeleton.
- [X] T003 Add the local editable `llm-client` dependency to `apps/api/pyproject.toml` following the existing `ml-video` source pattern.
- [X] T004 Create the `packages/llm-client/tests/conftest.py` pytest fixture skeleton for fake providers and fixed prompt-file fixtures.
- [X] T005 Create the feature smoke-test checklist skeleton in `specs/011-llm-client-chatbot/smoke-tests.md`.

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Shared provider, prompt loading, database, RLS, typed API, and orchestration contracts that must exist before story work.

**Critical**: No user story implementation should begin until this phase is complete.

### LLM Client Adapter, Provider Config, and Fallback Flag

- [X] T006 [P] Add provider dataclasses, literals, and `LLMProvider` protocol in `packages/llm-client/src/llm_client/provider.py`.
- [X] T007 [P] Add privacy-safe telemetry metadata types and latency bucketing in `packages/llm-client/src/llm_client/telemetry.py`.
- [X] T008 Add provider configuration parsing for Groq primary, LM Studio fallback, bot display name, and explicit silent-fallback flag in `packages/llm-client/src/llm_client/config.py`.
- [X] T009 Add the Groq adapter using the provider protocol and low reasoning effort in `packages/llm-client/src/llm_client/groq_provider.py`.
- [X] T010 Add the LM Studio fallback adapter using the same provider protocol in `packages/llm-client/src/llm_client/lm_studio_provider.py`.
- [X] T011 Add provider registry and fail-clean default fallback selection in `packages/llm-client/src/llm_client/registry.py`.
- [X] T012 [P] Add pytest coverage for provider config and fallback-flag behavior in `packages/llm-client/tests/test_provider_config.py`.
- [X] T013 [P] Add pytest coverage that app code can use fake providers without vendor SDK imports in `packages/llm-client/tests/test_provider_contract.py`.

### Prompt-Loading Mechanism

- [X] T014 Add prompt id enum, prompt directory resolver, and load-from-files validation for the fixed prompt ids in `packages/llm-client/src/llm_client/prompts.py`.
- [X] T015 Add prompt loading tests that read fixed prompt files without asserting or authoring prompt wording in `packages/llm-client/tests/test_prompts.py`.
- [X] T016 Add a repository guard test rejecting inline prompt strings in API call sites in `apps/api/tests/test_chat_prompt_boundaries.py`.

### Scorer JSON and Reasoning Extraction

- [X] T017 Add balanced JSON extraction and scorer validation helpers in `packages/llm-client/src/llm_client/scorer.py`.
- [X] T018 Add pytest coverage for clean scorer JSON, reasoning-contaminated extraction, invalid enum rejection, and rollup crisis discard in `packages/llm-client/tests/test_scorer.py`.

### DB Schema and RLS Migration

- [X] T019 Create chat conversations/messages migration with explicit grants, ENABLE/FORCE RLS, owner-only policies, and hard-delete cascade in `supabase/migrations/20260628000000_chat_conversations_messages.sql`.
- [X] T020 Add SQL shape tests for forbidden columns, owner-only policies, no manager/admin policies, and no service-role path in `apps/api/tests/test_chat_storage_rls.py`.
- [X] T021 Add chat persistence schema models and request/response types in `apps/api/app/schemas.py`.
- [X] T022 Add RLS-as-user chat storage helpers using `get_user_supabase` in `apps/api/app/services/chat_store.py`.
- [X] T023 Add pytest coverage for chat storage helpers using authenticated user-scope clients in `apps/api/tests/test_chat_store.py`.

### API Route and Typed Web Client Foundation

- [X] T024 Add API LLM integration wrapper around `packages/llm-client` in `apps/api/app/services/llm_client.py`.
- [X] T025 Add chat router skeleton for employee-only conversation endpoints in `apps/api/app/routers/chat.py`.
- [X] T026 Register the chat router in `apps/api/app/main.py`.
- [X] T027 Add typed chat API client schemas and functions in `apps/web/lib/api/chat-client.ts`.
- [X] T028 Add server action wrappers for chat load/send/rename/delete/end flows in `apps/web/app/(authed)/app/chat/actions.ts`.
- [X] T029 [P] Add Vitest coverage for typed chat client request/response parsing in `apps/web/lib/api/chat-client.test.ts`.

**Checkpoint**: Provider boundary, prompt loading, RLS storage, API route skeleton, and typed web client are ready.

---

## Phase 3: User Story 1 - Open Ren From Any Chat Entry Point (Priority: P1) - MVP

**Goal**: Employees can reach the same private conversation store from the home recent-chats card, persistent pill, and Chat navigation item.

**Independent Test**: Sign in as an employee, open chat from each entry point, and confirm the same conversations, titles, latest messages, and rollup bands appear across the card, pill, and full page.

### Tests for User Story 1

- [X] T030 [P] [US1] Add Vitest/RTL tests for `/app/chat` empty, history, switch, rename, delete, and disclaimer states in `apps/web/tests/unit/components/chat/chat-page.test.tsx`.
- [X] T031 [P] [US1] Add Vitest/RTL tests for employee-only Chat navigation and hidden non-employee entry points in `apps/web/components/header/center-nav.test.tsx`.
- [X] T032 [P] [US1] Add Vitest/RTL tests for the persistent pill desktop/mobile behavior and `aria-label="Talk to Ren"` in `apps/web/components/chat-pill.test.tsx`.
- [X] T033 [P] [US1] Add Vitest/RTL tests for recent-chats shared-store rows, relative timestamps, collapse memory, rename, delete, and new-chat action in `apps/web/components/home/recent-chats-card.test.tsx`.
- [ ] T034 [P] [US1] Add Playwright employee/team_lead/admin role coverage for chat entry-point visibility and shared history routing in `apps/web/tests/e2e/chat-entrypoints.spec.ts`.

### Implementation for User Story 1

- [X] T035 [US1] Implement conversation list, load, create, rename, delete, and latest/current endpoints in `apps/api/app/routers/chat.py`.
- [X] T036 [US1] Implement conversation storage operations for list, current, create, rename, and hard delete in `apps/api/app/services/chat_store.py`.
- [X] T037 [US1] Build reusable chat history/sidebar, message list, composer shell, disclaimer, and empty-state components in `apps/web/components/chat/chat-shell.tsx`.
- [X] T038 [US1] Build `/app/chat` full-page experience with history sidebar and full-width selected conversation in `apps/web/app/(authed)/app/chat/page.tsx`.
- [X] T039 [US1] Extend employee Chat navigation item in `apps/web/components/header/center-nav.tsx`.
- [X] T040 [US1] Extend persistent pill panel for continue current chat, new chat, and full history without a switcher in `apps/web/components/chat-pill.tsx`.
- [X] T041 [US1] Extend the feature-003 home recent-chats card to use the shared chat store and row actions in `apps/web/components/home/recent-chats-card.tsx`.

**Checkpoint**: User Story 1 is independently usable from all entry points.

---

## Phase 4: User Story 2 - Vent and Be Heard Before Advice (Priority: P1)

**Goal**: User sends persist, Ren replies listen-first, Ren and scorer run in parallel, and same-turn scorer output does not steer Ren wording.

**Independent Test**: Send a venting message and verify Ren responds independently from the per-message scorer; failed responses preserve the typed message for retry.

### Tests for User Story 2

- [X] T042 [P] [US2] Add pytest orchestration tests for parallel Ren/scorer calls, scorer-not-steering Ren, retry paths, and duplicate-send locking in `apps/api/tests/test_chat_orchestration.py`.
- [X] T043 [P] [US2] Add pytest privacy telemetry tests for allowed metadata and forbidden message/prompt/crisis/band fields in `apps/api/tests/test_chat_privacy.py`.
- [X] T044 [P] [US2] Add Vitest/RTL composer tests for send-lock, preserved typed text on failure, calm trouble state, and no duplicate user messages in `apps/web/tests/unit/components/chat/chat-composer.test.tsx`.
- [X] T044a [P] [US2] Add pytest coverage for the FR-055 sliding-window context guard in `apps/api/tests/test_chat_context_window.py`: under context pressure the model input keeps the required system prompt plus the most-recent turns and drops oldest turns; persisted conversation history is unchanged; and the conversation is never summarized (FR-055, FR-056).

### Implementation for User Story 2

- [X] T045 [US2] Implement chat orchestration for send-message flow, per-conversation lock, rate limit, retries, and parallel Ren/scorer calls in `apps/api/app/services/chat_orchestrator.py`.
- [X] T046 [US2] Wire `POST /chat/conversations/{conversation_id}/messages` to the orchestrator and persistence layer in `apps/api/app/routers/chat.py`.
- [X] T047 [US2] Add privacy-safe operational telemetry emission for chat calls in `apps/api/app/services/chat_orchestrator.py`.
- [X] T048 [US2] Implement chat composer send, pending, retry, slow-down, and inline trouble states in `apps/web/components/chat/chat-shell.tsx`.
- [X] T048a [US2] Implement the FR-055 sliding-window context guard in `apps/api/app/services/chat_orchestrator.py`: when assembling model input under context pressure, always retain the required system instructions and the most-recent turns, drop the oldest model-input turns, leave persisted history intact as the source of truth, and never summarize the conversation (FR-055, FR-056).

**Checkpoint**: User Story 2 supports reliable, listen-first sends without losing drafts.

---

## Phase 5: User Story 5 - See Verified Resources During a Crisis Moment (Priority: P1)

**Goal**: Crisis triggers from scorer or Ren `[CRISIS]` show verified resources live, strip control tokens, and persist no crisis state.

**Independent Test**: Trigger crisis via scorer and via `[CRISIS]`; verify the same panel appears, numbers come only from the resource table, and no manager/admin/employer route or persisted crisis flag exists.

### Tests for User Story 5

- [X] T049 [P] [US5] Add pytest coverage for verified Egypt/US rows, unsupported-country universal fallback, and no crisis persistence in `apps/api/tests/test_crisis_resources.py`.
- [X] T050 [P] [US5] Add pytest orchestration tests for scorer crisis, Ren `[CRISIS]`, stripped control token, and no generated phone numbers in `apps/api/tests/test_chat_crisis_flow.py`.
- [X] T051 [P] [US5] Add Vitest/RTL crisis panel tests for foggy treatment, Egypt/US rows, universal line, and no crimson styling in `apps/web/tests/unit/components/chat/crisis-panel.test.tsx`.
- [ ] T052 [P] [US5] Add Playwright role e2e coverage that crisis stays employee-private and creates no team_lead/admin notification in `apps/web/tests/e2e/chat-crisis-privacy.spec.ts`.

### Implementation for User Story 5

- [X] T053 [US5] Implement verified crisis resource rows and universal immediate-danger fallback in `apps/api/app/services/crisis_resources.py`.
- [X] T054 [US5] Add crisis resource response schemas and crisis live-panel fields to chat responses in `apps/api/app/schemas.py`.
- [X] T055 [US5] Wire crisis detection, `[CRISIS]` token stripping, resource lookup, and no-persist behavior in `apps/api/app/services/chat_orchestrator.py`.
- [X] T056 [US5] Build calm crisis resource panel component with foggy attention treatment in `apps/web/components/chat/crisis-panel.tsx`.
- [X] T057 [US5] Render crisis panel responses across `/app/chat` and pill surfaces in `apps/web/components/chat/chat-shell.tsx`.

**Checkpoint**: User Story 5 handles crisis moments live and privately.

---

## Phase 6: User Story 3 - Ask for One Suggestion (Priority: P2)

**Goal**: Ren provides one practical next step while the companion disclaimer remains visible.

**Independent Test**: Ask for help after describing work stress and confirm Ren gives at most one concrete suggestion without clinical/legal/emergency posture.

### Tests for User Story 3

- [X] T058 [P] [US3] Add pytest rubric tests for one-suggestion behavior, disclaimer preservation metadata, and professional-care refusal boundaries in `apps/api/tests/test_ren_behavior_rubric.py`.
- [X] T059 [P] [US3] Add Vitest/RTL tests confirming the AI companion disclaimer remains visible on page, pill, and recent-chat entry surfaces in `apps/web/tests/unit/components/chat/disclaimer.test.tsx`.

### Implementation for User Story 3

- [X] T060 [US3] Pass the fixed `ren` prompt and optional empty preference seam into Ren requests without inline prompt strings in `apps/api/app/services/chat_orchestrator.py`.
- [X] T061 [US3] Ensure chat UI keeps the persistent AI companion disclaimer visible on `/app/chat`, pill panel, and empty states in `apps/web/components/chat/chat-shell.tsx`.

**Checkpoint**: User Story 3 preserves Ren's companion behavior and disclaimer surface.

---

## Phase 7: User Story 4 - End, Title, and Resume a Chat (Priority: P2)

**Goal**: Employees can end chats, receive a fresh rollup band and calm title, resume history, rename, and hard-delete conversations.

**Independent Test**: Start a conversation, send several turns, end it, verify auto-title and rollup band on recent chats and history, resume text continuity, rename consistency, and hard delete.

### Tests for User Story 4

- [X] T062 [P] [US4] Add pytest tests for fifth-message rollup, `[END]` rollup/title success, end-flow retry failure, and open-state preservation in `apps/api/tests/test_chat_rollup_title.py`.
- [X] T063 [P] [US4] Add Vitest/RTL tests for ended conversation display, rollup labels, rename consistency, destructive delete treatment, and resume continuity in `apps/web/tests/unit/components/chat/chat-history.test.tsx`.
- [ ] T064 [P] [US4] Add Playwright employee e2e for end-title-resume-delete flow in `apps/web/tests/e2e/chat-end-resume.spec.ts`.

### Implementation for User Story 4

- [X] T065 [US4] Implement fresh whole-conversation rollup every fifth user message and on `[END]` in `apps/api/app/services/chat_orchestrator.py`.
- [X] T066 [US4] Implement auto-title after successful `[END]` rollup and keep conversation open on rollup/title failure in `apps/api/app/services/chat_orchestrator.py`.
- [X] T067 [US4] Persist conversation state, title, rollup band, message count, and last-message timestamps in `apps/api/app/services/chat_store.py`.
- [X] T068 [US4] Wire end, retry-end, rename, delete, and resume actions through typed web actions in `apps/web/app/(authed)/app/chat/actions.ts`.
- [X] T069 [US4] Render ended/open states, calm titles, rollup labels, rename, and destructive delete controls in `apps/web/components/chat/chat-shell.tsx`.
- [X] T070 [US4] Show auto-title and rollup band only from chat conversation data in `apps/web/components/home/recent-chats-card.tsx`.

**Checkpoint**: User Story 4 supports persistence, management, rollup, title, and resume behavior.

---

## Phase 8: User Story 6 - Use Recent Video Context Without Mixing Signals (Priority: P3)

**Goal**: Ren may use recent video context as limited opener/rollup context, while chat-derived bands never affect video-derived surfaces.

**Independent Test**: Test recent, missing, stale, and conflicting video reads; confirm chat band remains only on chat/recent-chat surfaces.

### Tests for User Story 6

- [X] T071 [P] [US6] Add pytest tests for recent video context selection, 70-second stale conflict handling, and no fused stress value in `apps/api/tests/test_chat_video_reconcile.py`.
- [X] T072 [P] [US6] Add Vitest tests proving chat-derived bands do not appear in today-card, live monitor, or video trend surfaces in `apps/web/tests/unit/lib/chat-signal-separation.test.ts`.
- [ ] T073 [P] [US6] Add Playwright employee e2e for recent-chat band visibility without video-surface mutation in `apps/web/tests/e2e/chat-signal-separation.spec.ts`.

### Implementation for User Story 6

- [X] T074 [US6] Add recent video-read context lookup for Ren opener and rollup agreement logic in `apps/api/app/services/chat_video_context.py`.
- [X] T075 [US6] Wire optional video context into Ren and rollup requests without creating a fused band in `apps/api/app/services/chat_orchestrator.py`.
- [X] T076 [US6] Keep chat-derived rollup labels scoped to chat and recent-chat surfaces in `apps/web/lib/api/chat-client.ts`.

**Checkpoint**: User Story 6 preserves signal separation while allowing limited context.

---

## Phase 9: Polish and Cross-Cutting Concerns

**Purpose**: Validation, documentation, and guardrails across the completed feature.

- [X] T077 Add prompt-boundary and service-role-key grep checks to `specs/011-llm-client-chatbot/smoke-tests.md`.
- [X] T078 Document manual checks for card, pill, `/app/chat`, crisis panel, 360px viewport, light/dark AA, and role access in `specs/011-llm-client-chatbot/smoke-tests.md`.
- [X] T079 Run backend verification with `uv run pytest` from `apps/api` and record results in `specs/011-llm-client-chatbot/smoke-tests.md`. (Chat suite 57 green + ruff; full suite incl. 008 monitoring needs the ML model — noted.)
- [X] T080 Run frontend verification with `npm run lint`, `npm run typecheck`, `npm run test`, and touched Playwright specs from `apps/web`, then record results in `specs/011-llm-client-chatbot/smoke-tests.md`. (Lint/tsc/Vitest 52 green; Playwright role e2e deferred — see T034/52/64/73.)
- [X] T081 Run package verification with `uv run pytest` from `packages/llm-client` and record results in `specs/011-llm-client-chatbot/smoke-tests.md`. (28 green.)
- [X] T082 Review Graphite token usage for no amber misuse, no crimson crisis styling, no `@theme inline` remapping, and no Framer reduced-motion hook in `apps/web/components/chat/chat-shell.tsx` and `apps/web/components/chat/crisis-panel.tsx`. (Crisis=foggy; bands=amber/meadow; crimson only on destructive delete; CSS transitions only, no Framer.)

---

## Dependencies and Execution Order

### Phase Dependencies

1. **Setup (Phase 1)**: No dependencies.
2. **Foundational (Phase 2)**: Depends on Phase 1 and blocks all stories.
3. **US1, US2, US5 (P1)**: Depend on Phase 2. US1 can build UI entry points while US2/US5 build orchestration and crisis handling after shared route/store contracts exist.
4. **US3, US4 (P2)**: Depend on US2 for Ren orchestration. US4 also depends on foundational storage and US1 management UI.
5. **US6 (P3)**: Depends on US2 and US4 because it wires optional context into Ren and rollup flows.
6. **Polish**: Depends on all desired stories for the delivery increment.

### User Story Dependencies

1. **US1 (P1)**: Starts after Foundation; MVP visible shell and shared store.
2. **US2 (P1)**: Starts after Foundation; core send orchestration.
3. **US5 (P1)**: Starts after Foundation and shares US2 orchestration seams.
4. **US3 (P2)**: Depends on US2 prompt wiring and response flow.
5. **US4 (P2)**: Depends on US2 send flow and storage helpers.
6. **US6 (P3)**: Depends on US2 orchestration and US4 rollup semantics.

### Within Each User Story

1. Tests first and failing.
2. Storage/models before services.
3. Services before router endpoints.
4. Typed client/actions before UI rendering.
5. Story checkpoint validation before moving to the next priority tier.

---

## Parallel Execution Examples

### User Story 1

```text
Task: T030 chat-page tests in apps/web/tests/unit/components/chat/chat-page.test.tsx
Task: T031 nav tests in apps/web/components/header/center-nav.test.tsx
Task: T032 pill tests in apps/web/components/chat-pill.test.tsx
Task: T033 recent card tests in apps/web/components/home/recent-chats-card.test.tsx
Task: T034 role e2e in apps/web/tests/e2e/chat-entrypoints.spec.ts
```

### User Story 2

```text
Task: T042 backend orchestration tests in apps/api/tests/test_chat_orchestration.py
Task: T043 privacy telemetry tests in apps/api/tests/test_chat_privacy.py
Task: T044 composer UI tests in apps/web/tests/unit/components/chat/chat-composer.test.tsx
```

### User Story 5

```text
Task: T049 crisis resources tests in apps/api/tests/test_crisis_resources.py
Task: T050 crisis flow tests in apps/api/tests/test_chat_crisis_flow.py
Task: T051 crisis panel tests in apps/web/tests/unit/components/chat/crisis-panel.test.tsx
Task: T052 crisis privacy e2e in apps/web/tests/e2e/chat-crisis-privacy.spec.ts
```

### User Story 4

```text
Task: T062 rollup/title tests in apps/api/tests/test_chat_rollup_title.py
Task: T063 chat history UI tests in apps/web/tests/unit/components/chat/chat-history.test.tsx
Task: T064 end/resume e2e in apps/web/tests/e2e/chat-end-resume.spec.ts
```

---

## Implementation Strategy

### MVP First

1. Complete Phase 1 and Phase 2.
2. Complete US1 for reachability and shared store.
3. Complete US2 for real Ren sends.
4. Complete US5 before demoing broadly because crisis handling is safety-critical.
5. Stop and validate the P1 increment before P2/P3 work.

### Incremental Delivery

1. Foundation: provider boundary, prompt loading, RLS storage, typed API.
2. P1: entry points, send orchestration, crisis resources.
3. P2: one-suggestion behavior and end/title/resume.
4. P3: recent video context and signal-separation hardening.
5. Polish: verification commands, smoke tests, and token/privacy review.

### Parallel Team Strategy

1. One developer owns `packages/llm-client`.
2. One developer owns `supabase/` and `apps/api/app/services/`.
3. One developer owns `apps/web/components/chat/` and `/app/chat`.
4. One developer owns role e2e and privacy/signal-separation tests.

---

## Notes

- Prompt files are load-from-files fixed input, not authored implementation tasks.
- No task may introduce service-role usage for chat content.
- Crisis state remains live-only and never persists.
- Chat rollup bands stay on chat/recent-chat surfaces only.
- Graphite semantic tokens remain binding: amber for stress, foggy for crisis attention/errors, crimson only for destructive actions.
