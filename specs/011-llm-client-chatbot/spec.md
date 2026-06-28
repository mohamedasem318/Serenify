# Feature Specification: LLM Client and Ren Chatbot

**Feature Branch**: `011-llm-client-chatbot`

**Roadmap label**: `011-llm-client-and-chatbot` (constitution v1.9.0, Principle VIII; Amendment 12). This feature intentionally comes before the questionnaire and recommendations because the shared LLM client unblocks both.

**Created**: 2026-06-28

**Status**: Draft

**Input**: User description: "Build the shared LLM client package and the first chatbot surface riding on it, with Ren chat, dual-mode stress detection, crisis escalation, persistence, and the approved 011 chatbot design."

**Visual source of truth**: `serenify-011-chatbot-mock.html` (repo root), approved 011 chatbot design mock. The history/recent-chats card, `/app/chat` page, lean pill, crisis view, and empty states are binding.

**Prompt source of truth**: Prompt wording is final and lives in `packages/llm-client/prompts/`. This feature loads these fixed seams and does not rewrite their wording: `ren`, `ren_preference_block`, `scorer_per_message`, `scorer_rollup`, and `auto_title`.

---

## Clarifications

### Session 2026-06-28

- Q: When an employee deletes a conversation, should chat content be removed immediately or retained behind the scenes? → A: Hard delete the conversation and all messages immediately for the owning employee.
- Q: What operational observability may be captured for LLM/chat failures without violating chat and crisis privacy? → A: Log only privacy-safe operational metadata: request outcome, provider used, latency bucket, retry count, and validation failure type; never log message text, prompt text, crisis booleans, bands, or resource-panel events.
- Q: How should the system handle multiple sends in the same conversation while Ren/scorer calls are pending? → A: Serialize per conversation: disable/send-lock while Ren/scorer calls are pending; allow other conversations to remain usable.
- Q: How should the system handle excessive chat sends or accidental rapid retries in 011? → A: Per-employee chat send rate limit with a calm inline "slow down and try again" state; do not count blocked attempts as messages.
- Q: What happens if the `[END]` rollup or auto-title call fails? → A: Keep the conversation open; show a calm inline retry state; do not mark ended until rollup and title both succeed.

## User Scenarios & Testing *(mandatory)*

This feature gives employees a private AI companion named Ren while establishing a shared LLM client boundary for current and future LLM-backed Serenify features. Chat is employee-private, listen-first, calm-first, and separated from the video-derived stress surfaces. The chatbot can detect stress from typed conversation, persist chat history, show recent chat rollup labels, and render verified crisis resources live without storing crisis flags or notifying managers.

### User Story 1 - Open Ren from any chat entry point (Priority: P1)

As an employee, I can open Ren from the home recent-chats card, the persistent "Talk to Ren" pill, or the main Chat navigation item, and all entry points take me into the same private conversation store.

**Why this priority**: This is the visible foundation of the chatbot. It proves the first Ren surface exists, is reachable from the approved design entry points, and has one shared history rather than fragmented chats.

**Independent Test**: Sign in as an employee and open chat from each entry point. Confirm the same conversations, titles, latest messages, and rollup bands appear across the card, pill, and full page.

**Acceptance Scenarios**:

1. **Given** an employee has no conversations, **When** they open `/app/chat`, **Then** they see the approved empty state and the persistent disclaimer: "Ren is an AI companion, not a substitute for professional care."
2. **Given** an employee has existing conversations, **When** they open the Chat nav item, **Then** the full page shows a history sidebar with switch, rename, and delete controls plus the selected full-width conversation.
3. **Given** an employee is on an app page, **When** they use the bottom-right "Talk to Ren" pill on desktop, **Then** it shows a compact fixed-size panel with the label plus the `✦` mark and no conversation switcher inside the panel.
4. **Given** an employee is on a mobile viewport, **When** the bottom-right pill renders, **Then** it is icon-only, keeps a touch target of at least 44px, and exposes `aria-label="Talk to Ren"`.
5. **Given** a team lead, admin, or unauthenticated user is viewing the app, **When** chat entry points render, **Then** employee-only chat entry points are not available.
6. **Given** a conversation appears on the recent-chats home card, **When** the employee opens it from the card, **Then** the same conversation opens in Ren with its persisted messages intact.

---

### User Story 2 - Vent and be heard before advice (Priority: P1)

As an employee, I can tell Ren what is happening and receive a response that listens first, reflects the situation calmly, and does not let a separate score steer the reply.

**Why this priority**: The core user value is being heard. The stress score exists for detection and rollup labels, not for turning Ren into a scripted triage bot.

**Independent Test**: Send a venting message and verify the conversational reply is generated independently from the per-message scorer. Confirm the user message is not lost if a response fails.

**Acceptance Scenarios**:

1. **Given** an employee sends a stressed but non-crisis message, **When** Ren replies, **Then** the reply acknowledges the situation before offering advice and does not mention internal scoring.
2. **Given** a user message is sent, **When** Ren and the per-message scorer run, **Then** the two reads run in parallel and the scorer result does not steer the wording of Ren's reply.
3. **Given** Ren succeeds but the per-message scorer fails, **When** the reply is shown, **Then** the employee still receives Ren's reply and the system keeps Ren's `[CRISIS]` backstop active for safety.
4. **Given** both Ren and the scorer fail after retry, **When** the user tries to send, **Then** the user sees a calm inline trouble message and can retry without retyping their message.
5. **Given** only one of the two calls fails transiently, **When** retry succeeds, **Then** the conversation continues without duplicate user messages.

---

### User Story 3 - Ask for one suggestion (Priority: P2)

As an employee, I can ask Ren for help and receive one practical, calm suggestion rather than a long list or clinical instruction.

**Why this priority**: The approved Ren behavior is companion-style support. One suggestion is enough to act on and avoids overwhelming the employee.

**Independent Test**: Ask Ren what to do next after describing a work stressor. Confirm the response contains at most one concrete suggestion and keeps the companion disclaimer visible on the surface.

**Acceptance Scenarios**:

1. **Given** an employee asks "what should I do?", **When** Ren responds, **Then** Ren offers one concrete next step and keeps the tone calm.
2. **Given** the employee asks for more options, **When** Ren replies, **Then** Ren may offer another single next step in the new reply rather than dumping a long checklist.
3. **Given** the employee asks for clinical, legal, or emergency instructions, **When** Ren responds, **Then** Ren avoids presenting itself as professional care and keeps the persistent companion disclaimer visible on the chat surface.

---

### User Story 4 - End, title, and resume a chat (Priority: P2)

As an employee, I can end a chat, see it titled calmly, and later resume or manage it from recent chats or the full history page.

**Why this priority**: Persistence turns the chatbot from a one-off panel into a usable private journal-like support surface and creates the rollup band that feature 012 recommendations will later read.

**Independent Test**: Start a conversation, send several turns, end it, and confirm the title and rollup band appear on the recent-chats card and full history. Resume the conversation and verify text continuity comes from persisted messages.

**Acceptance Scenarios**:

1. **Given** a conversation has enough turns for a rollup, **When** the rollup runs, **Then** the conversation stores one current rollup band that replaces the previous conversation-level band.
2. **Given** an employee selects `[END]`, **When** the end flow completes, **Then** the system performs a fresh whole-conversation rollup and creates a short calm title that names the situation without distress words.
3. **Given** a conversation has been ended, **When** it appears on the recent-chats card, **Then** the card shows the auto-title and the rollup band, not a crisis badge and not a video-derived stress reading.
4. **Given** an employee resumes a prior conversation, **When** Ren opens it, **Then** the persisted user and assistant text reconstructs continuity without needing any stored per-message scores.
5. **Given** an employee renames a conversation, **When** the history sidebar and recent card refresh, **Then** the employee's chosen title is shown consistently where that conversation appears.
6. **Given** an employee deletes a conversation, **When** they confirm the destructive action, **Then** the conversation and all messages are hard deleted immediately and remain inaccessible to managers and admins.

---

### User Story 5 - See verified resources during a crisis moment (Priority: P1)

As an employee in a crisis moment, I see a calm resource panel with human-verified country resources, without Ren inventing phone numbers and without any manager, admin, or employer notification.

**Why this priority**: Crisis handling is safety-critical and constitutionally required. It must be live, private, calm, and precise before the chatbot is considered usable.

**Independent Test**: Send a message that the per-message scorer flags as crisis and separately test a Ren reply that contains the silent `[CRISIS]` token. Confirm both trigger the same panel, no phone number is generated by Ren, no crisis flag is persisted, and no manager/admin surface receives anything.

**Acceptance Scenarios**:

1. **Given** the scorer returns `crisis: true`, **When** the reply is rendered, **Then** a calm crisis resource panel appears with a foggy attention border and no crimson alarm styling.
2. **Given** Ren emits the silent `[CRISIS]` token, **When** the reply is processed, **Then** the token is not shown to the user and the same crisis resource panel appears.
3. **Given** the employee country is Egypt, **When** the crisis panel renders, **Then** it shows General Secretariat of Mental Health & Addiction Treatment hotline 16328, marked 24/7, with last-checked date 2026-06-28.
4. **Given** the employee country is the United States, **When** the crisis panel renders, **Then** it shows 988 Suicide & Crisis Lifeline with call/text 988, marked 24/7, with last-checked date 2026-06-28.
5. **Given** the employee country is missing or not in the hard-coded table, **When** the crisis panel renders, **Then** it still shows the universal immediate-danger line to contact local emergency services and never renders a blank panel.
6. **Given** any crisis trigger occurs, **When** the conversation is persisted, **Then** only normal message text, title, and rollup band are stored; no crisis property, badge, per-message crisis log, manager route, admin route, or employer notification is created.
7. **Given** Ren responds during a crisis trigger, **When** the message appears, **Then** Ren does not produce a phone number or service name; resources come only from the verified app table.

---

### User Story 6 - Use recent video context without mixing signals (Priority: P3)

As an employee, Ren can optionally acknowledge a recent video read as context, but chat-derived stress stays separate from video-derived today-card and trend surfaces.

**Why this priority**: Principle IV requires dual-mode awareness, while prior honesty work requires signal separation. This story defines the reconcile reading without misleading users.

**Independent Test**: Test with a recent stored video read, with no recent read, and with a stale or conflicting live read. Confirm Ren's opener may use recent context, the rollup may note agreement, and chat bands never alter video surfaces.

**Acceptance Scenarios**:

1. **Given** a recent stored video read (today / last few days) exists, **When** Ren opens a new chat, **Then** Ren may use a short recent-read context line as a door-opener without claiming certainty.
2. **Given** no recent stored video read exists, **When** Ren opens, **Then** chat runs as its own independent detector with no video-aware opener.
3. **Given** the typed message conflicts with a video read that is at least 70 seconds stale, **When** the system reconciles signals, **Then** the conversation wins because the typed message is fresher.
4. **Given** chat rollup produces a band, **When** dashboard video surfaces render, **Then** the chat-derived band does not affect the video-derived today card, live monitor trend, or video trend.
5. **Given** a recent-chats card renders, **When** it shows a stress label, **Then** that label comes from the chat rollup band only.

### Edge Cases

- **Transient LLM failure**: Retry once or twice with backoff. If the response still fails, keep or restore the typed message for retry and show calm inline trouble copy. Do not silently swallow messages.
- **Scorer-only failure**: Ren's reply can still render. The system does not persist a per-message band and relies on Ren's `[CRISIS]` token as the remaining live safety backstop for that turn.
- **Ren-only failure**: The scorer result alone must not generate a falsely reassuring assistant reply. The employee sees a response trouble state.
- **Both calls fail**: No assistant reply is invented. The employee sees an error state and can retry.
- **Malformed scorer output**: The scorer expects clean JSON. Malformed or reasoning-contaminated content is retried and defensively extracted before the turn is treated as failed.
- **Reasoning leaks into content**: The shared adapter strips or extracts the usable JSON/object content so hidden reasoning does not appear in user-visible assistant text or scorer data.
- **Context window pressure**: No summarization ships in 011. The conversation degrades by keeping the system prompt and most recent turns while dropping oldest turns from the model input; persisted messages remain the source of truth.
- **Fallback provider availability**: If the primary provider is unavailable, fallback behavior is controlled by configuration. Default is fail-clean rather than silently switching to a visibly weaker model mid-demo.
- **Empty states**: No chats, no selected chat, failed load, and deleted-current-chat states follow the approved 011 mock and keep the persistent AI companion disclaimer visible on chat surfaces.
- **Preference seam empty**: The preference block is only injected when preferences exist. In 011, preference content is intentionally empty.
- **Crisis conversation history**: A conversation that had a live crisis moment appears later like any normal chat, with text, auto-title, and rollup band only.
- **Concurrent sends**: A conversation accepts only one in-flight user send at a time while Ren/scorer calls are pending. Other conversations remain usable.
- **Rate limited sends**: When an employee exceeds the chat send rate limit, the attempted send is blocked with calm inline "slow down and try again" copy and is not persisted as a message.
- **End flow failure**: If either the `[END]` rollup or auto-title call fails after retry, the conversation remains open, shows a calm inline retry state, and is not marked ended until both calls succeed.

## Requirements *(mandatory)*

### Functional Requirements

**Shared LLM client boundary**

- **FR-001**: The system MUST expose one shared LLM provider boundary for all app code that needs LLM calls; app code MUST NOT import vendor SDKs directly.
- **FR-002**: Provider selection MUST be configuration-driven, with primary provider set to Groq `openai/gpt-oss-120b` using low reasoning effort, and fallback provider set to LM Studio `openai/gpt-oss-20b` through the configured tunnel.
- **FR-003**: The provider boundary MUST support fail-clean as the default when the primary provider is down; silent fallback MUST exist only behind an explicit configuration flag.
- **FR-004**: The provider boundary MUST include defensive extraction for structured content so reasoning-model leakage does not corrupt scorer JSON or expose hidden reasoning to users.
- **FR-005**: Scorer calls MUST request JSON-object style responses and accept only clean `{band, crisis}` objects after validation. The per-message scorer uses both fields; the rollup scorer uses `band` only and ignores `crisis`.
- **FR-006**: The bot display name MUST come from one configuration string. "Ren" MUST NOT be duplicated as hardcoded copy across unrelated files.

**Prompt seams**

- **FR-007**: The system MUST load versioned prompt files from the prompt directory for exactly these 011 seams: `ren` (conversational), `ren_preference_block` (injected only when preferences exist), `scorer_per_message` (`{band, crisis}`), `scorer_rollup` (the "where did they land" whole-conversation variant, returning `{band, crisis}` with only `band` used in 011), and `auto_title`.
- **FR-008**: The system MUST treat prompt wording as fixed for 011. Implementation may wire prompts to call sites but MUST NOT rewrite their wording.
- **FR-009**: The preference block MUST be injected only when user preferences exist. In 011, the preference content seam remains empty.
- **FR-010**: Inline prompt strings in app call sites MUST NOT replace the prompt files.

**Chat surfaces**

- **FR-011**: The system MUST provide `/app/chat` with a history sidebar, conversation switcher, rename control, delete control, empty states, and a full-width selected conversation.
- **FR-012**: The system MUST provide a persistent bottom-right "Talk to Ren" pill for employees only.
- **FR-013**: On desktop, the pill MUST show a label plus the `✦` mark; on mobile, it MUST be icon-only and expose `aria-label="Talk to Ren"`.
- **FR-014**: The pill panel MUST be fixed-size, support continuing the current chat, starting a new chat, and opening full history, and MUST NOT include a conversation switcher inside the panel.
- **FR-015**: The home page MUST include a "Recent chats" card that reads from the same conversation store and shows the latest relevant conversations with their rollup bands.
- **FR-015a**: The recent-chats card MUST render relative timestamps client-side (avoiding the server-timezone issue, BACKLOG #53), provide per-row rename and delete, a collapse toggle whose state is remembered browser-local (until the preferences hub absorbs it), and a "+ New chat" action.
- **FR-016**: The app navigation MUST include a Chat item for employees.
- **FR-017**: The card, page, pill, buttons, notification surface, empty states, and destructive actions MUST stay within the Graphite design language and reuse existing feature-003 shells where applicable.
- **FR-018**: Every chat surface MUST show the persistent disclaimer: "Ren is an AI companion, not a substitute for professional care."
- **FR-019**: Chat surfaces MUST work at the 360px minimum viewport, in light and dark themes, with WCAG AA contrast and touch targets of at least 44px.

**Conversation behavior**

- **FR-020**: The system MUST store conversations and messages so an employee can resume a conversation with full user and assistant text.
- **FR-021**: The system MUST protect chat content so only the owning employee can read or mutate it. Managers, admins, and employers MUST NOT access chat content.
- **FR-022**: All chat persistence MUST use the authenticated employee's own user scope. Service-role access MUST NOT be used anywhere for chat content.
- **FR-023**: Sending a user message MUST launch two parallel reads: Ren conversational reply and per-message scorer.
- **FR-024**: Ren's reply MUST be listen-first and MUST NOT be steered by the scorer output from the same turn.
- **FR-025**: The per-message scorer MUST read the current user message plus the previous two complete conversation turns by default.
- **FR-026**: The per-message scorer MUST compute `{band, crisis}` for the live turn, discard the per-message score after use, and never persist per-message scores.
- **FR-027**: The system MUST run a fresh whole-conversation rollup every fifth user message and on `[END]`.
- **FR-028**: Rollup MUST read the conversation text fresh and return one conversation-level `{band}`. It MUST NOT average, peak, or otherwise aggregate per-message bands. The rollup prompt returns `{band, crisis}`; 011 reads and persists only band. The rollup's crisis output is discarded (crisis is live-only via the per-message scorer and Ren's `[CRISIS]` token) and MUST NOT drive the panel or be persisted.
- **FR-029**: The conversation-level rollup band MUST be the only chat-derived band stored for the conversation.
- **FR-030**: The recent-chats card MUST show the rollup band, not the latest per-message band and not the peak band.
- **FR-031**: On `[END]`, the system MUST create a short, calm auto-title that names the situation and avoids banned distress words.
- **FR-032**: Resume MUST rely on persisted user and assistant text. It MUST NOT require stored per-message scores or crisis flags.
- **FR-032a**: The system MUST serialize sends per conversation. While a user message is awaiting Ren/scorer completion in one conversation, that conversation's send action is locked, but other conversations remain usable.
- **FR-032b**: If the `[END]` rollup or auto-title call fails after retry, the system MUST keep the conversation open, show a calm inline retry state, and MUST NOT mark the conversation ended until both rollup and title succeed.

**Crisis behavior**

- **FR-033**: A crisis panel MUST trigger when either the per-message scorer returns `crisis: true` or Ren emits the silent `[CRISIS]` token.
- **FR-034**: The `[CRISIS]` token MUST be treated as a control signal. It MUST NOT be displayed to the user or stored as chat content.
- **FR-035**: Ren MUST NOT generate phone numbers, hotline names, or service names. Crisis resources MUST render only from the human-verified app resource table.
- **FR-036**: The 011 crisis resource table MUST include Egypt and the United States only, each with a last-checked date.
- **FR-037**: The Egypt crisis resource row MUST show General Secretariat of Mental Health & Addiction Treatment hotline 16328, marked 24/7, last checked 2026-06-28.
- **FR-038**: The United States crisis resource row MUST show 988 Suicide & Crisis Lifeline, call/text 988, marked 24/7, last checked 2026-06-28.
- **FR-039**: The crisis panel MUST always show a universal immediate-danger line telling the employee to contact local emergency services. For Egypt, the emergency number 123 MUST be available in the resource copy.
- **FR-040**: If the employee country is missing or not in the table, the panel MUST still show the universal immediate-danger line and MUST NOT render blank.
- **FR-041**: Crisis state MUST be live-only. The system MUST NOT store a crisis flag on conversations, messages, dashboards, or logs used for product behavior.
- **FR-042**: Crisis MUST NEVER route to a manager, admin, employer, or workplace notification.
- **FR-043**: Crisis UI treatment MUST be calm and use the foggy attention role. Crimson/red MUST NOT be used for crisis, stress, affective, or ambient surfaces.
- **FR-044**: A conversation that contained a crisis moment MUST persist like a normal chat and later appear normally with text, auto-title, and rollup band only.

**Signal separation and dual-mode reconcile**

- **FR-045**: Chat-derived stress bands MUST appear only on recent-chat surfaces.
- **FR-046**: Chat-derived stress bands MUST NOT update or influence the video-derived today card, live monitor graph, historical video trend, or any other physiological stress surface.
- **FR-047**: The system MUST implement the opportunistic reconcile reading of Principle IV: if a recent stored video read exists (today / last few days), Ren may receive a short recent-read context line as a door-opener and the rollup may note agreement.
- **FR-048**: If no recent stored video read exists, chat MUST run as an independent detector.
- **FR-049**: If typed conversation conflicts with a video read that is at least 70 seconds stale, conversation MUST win because the typed message is fresher.
- **FR-050**: Reconcile MUST NOT create a fused stress value in 011.

**Reliability and degraded states**

- **FR-051**: Transient LLM failures MUST retry once or twice with backoff before showing an error.
- **FR-052**: The system MUST never lose the user's typed message on send failure; the user must be able to retry without retyping.
- **FR-053**: If Ren succeeds and the scorer fails, the system MUST still show Ren's reply.
- **FR-054**: If both calls fail, the system MUST show a calm inline trouble message and MUST NOT invent a reassuring assistant reply.
- **FR-055**: The system MUST apply a sliding-window guard under context pressure: keep required system instructions and most recent turns, drop oldest model input turns, and leave persisted history intact.
- **FR-056**: The system MUST not summarize conversations in 011.
- **FR-057**: The fallback provider must be presented through the same provider boundary as the primary provider so future app code is unaffected by provider choice.
- **FR-058**: Operational telemetry for LLM/chat calls MUST be privacy-safe and limited to request outcome, provider used, latency bucket, retry count, and validation failure type. It MUST NOT log message text, prompt text, crisis booleans, bands, or resource-panel events.
- **FR-059**: The system MUST enforce a per-employee chat send rate limit. Blocked attempts MUST show calm inline "slow down and try again" copy, preserve the typed text for retry, and MUST NOT be counted or persisted as messages.

### Data Model

- **Conversation**: Employee-owned chat thread. Key attributes: id, owner employee, created timestamp, updated timestamp, lifecycle state (open or ended), auto-title, and one current rollup band. A conversation has many messages. It has no crisis field. Deleting a conversation hard deletes the conversation and all messages immediately.
- **Message**: One persisted chat message. Key attributes: id, conversation id, role (user or assistant), full text, created timestamp. Message text is the source of truth for resume and history. Per-message score and crisis state are not stored. Messages are hard deleted with their conversation.
- **Rollup band**: The conversation-level chat-derived stress band created by the fresh rollup read. It is persisted once per conversation and shown on recent-chat surfaces only.
- **Crisis resource row**: Human-verified country resource entry. Key attributes: country, resource name, contact action or number, availability, last-checked date. In 011 the table contains Egypt and United States only.
- **Provider configuration**: The selected primary provider, fallback provider, fail-clean versus silent-fallback behavior, bot display name, and any provider-specific options required by the locked stack.
- **Prompt file**: Versioned prompt asset loaded by call site. Key attributes: prompt id, prompt text, version/location, intended call site.

### Crisis Resource Table for 011

| Country | Resource | Contact | Availability | Last checked |
|---------|----------|---------|--------------|--------------|
| Egypt | General Secretariat of Mental Health & Addiction Treatment hotline | 16328 | 24/7 | 2026-06-28 |
| United States | 988 Suicide & Crisis Lifeline | Call/text 988 | 24/7 | 2026-06-28 |

The panel always includes a universal immediate-danger line: if the employee is in immediate danger, they should contact local emergency services. Egypt emergency number 123 is included for Egypt-specific resource rendering. Users outside the two-row table still see the universal line.

### Signal-Separation Rule

Chat and video are separate modalities in 011. The chat rollup band labels recent chats and later gives feature 012 recommendations a chat-derived input. It does not change video-derived today-card or trend readings. When a recent stored video read is available, it can only be used as context for Ren's opener or as agreement context in rollup; it cannot overwrite the conversation's rollup band and cannot create a fused band.

### Out of Scope

- Preference content beyond the empty preference-block seam.
- Structured recommendation cards.
- Questionnaire-to-chatbot routing.
- Manager routing or "I'd like to talk" wiring into chat.
- The confirmatory "you've been tense, are you okay?" popup flow.
- A full country picker for crisis resources.
- A stored crisis flag, crisis dashboard badge, per-message score log, or employer notification path.
- Summarization of long conversations.
- Any fusion of chat-derived and video-derived stress signals.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: An employee can start or resume a chat from the card, pill, or Chat nav in no more than two user actions from the relevant surface.
- **SC-002**: In acceptance testing, the same conversation history appears consistently across `/app/chat`, the pill, and the recent-chats card in 100% of tested account states.
- **SC-003**: In listen-first test prompts, Ren acknowledges the user's situation before advice in 100% of required acceptance cases.
- **SC-004**: When the user asks for help, Ren provides no more than one concrete suggestion in the first response in 100% of one-suggestion rubric tests.
- **SC-005**: Per-message scorer results never change the wording of the same-turn Ren reply in call-trace tests.
- **SC-006**: Rollup labels on recent-chat surfaces match the fresh whole-conversation rollup result in 100% of rollup acceptance cases.
- **SC-007**: No chat-derived band appears on video-derived today-card or trend surfaces in 100% of signal-separation tests.
- **SC-008**: Crisis triggers from either scorer flag or `[CRISIS]` token show the crisis panel in 100% of crisis acceptance tests.
- **SC-009**: In crisis tests, no phone number or service name appears in Ren-generated text; all numbers and resource names come from the resource table.
- **SC-010**: In privacy tests, managers and admins cannot read, list, mutate, or receive notifications for employee chat content or crisis moments.
- **SC-011**: Failed LLM calls never cause a typed user message to be lost in retry-path tests.
- **SC-012**: All chat surfaces remain usable and visually coherent at 360px minimum width and in both light and dark modes.
- **SC-013**: All required hard-case rubric scenarios pass: listen-first, one-suggestion, `[END]`, crisis acknowledge-without-number plus panel, preference seam, clean scorer JSON, video-aware opener, and vents-then-calms rollup arc where the rollup weights where the conversation landed rather than the peak.
- **SC-014**: Privacy review of LLM/chat telemetry finds zero logged message text, prompt text, crisis booleans, bands, or resource-panel events.
- **SC-015**: Rate-limited send attempts show the inline slow-down state and create zero persisted messages in 100% of rate-limit tests.
- **SC-016**: Failed `[END]` rollup or auto-title attempts leave the conversation open with a retry state and create zero ended conversations in 100% of end-flow failure tests.

## Assumptions

- The exact 011 defaults are: per-message scorer context is the current user message plus the previous two complete user/assistant turns; rollup cadence is every fifth user message and on `[END]`. These defaults can be revisited during `/speckit-clarify` if Mohamed wants a different number.
- Two separate freshness notions: (a) the opener's recent-read context line uses the shallow recent stored read (today / last few days - the same read the today-card reflects), with no 70-second gate; (b) the 70-second staleness applies only to the rare live case where an active monitoring read overlaps a chat, where the typed message wins.
- "Current chat" for the pill means the most recently active non-deleted conversation for the employee unless the employee starts a new chat.
- Employee country is read from existing profile/session context if available. If unavailable or unsupported, the crisis panel shows the universal emergency-services line without a country-specific resource row.
- Delete is irreversible and therefore uses the destructive-action treatment, while crisis uses foggy attention treatment.
- Full ToS/consent disclaimer work remains the #75 pre-production gate and is out of scope for 011; this feature only requires the persistent AI companion disclaimer on chat surfaces.
- The shared client created here is the required foundation for questionnaire and recommendations work, but those downstream features do not ship in 011.

## Dependencies

- Constitution v1.9.0, especially Principles I, IV, V, VI, VII, and VIII.
- Approved 011 chatbot design mock: `serenify-011-chatbot-mock.html`.
- Existing Graphite design language and feature-003 component shells.
- Final prompt files in `packages/llm-client/prompts/`.
- Existing authenticated employee identity and self-scoped data access rules.
- Backlog item #75 for the later full ToS/consent disclaimer, referenced only as an out-of-scope gate.

## Constitution Alignment

- **Principle I - Privacy by Architecture**: Chat is employee-private. Managers, admins, and employers never receive chat content or crisis signals. Crisis is live-only and routes to external resources only.
- **Principle IV - LLM Provider Abstraction**: App code uses a shared provider boundary, not direct vendor SDK imports. Prompt files are versioned. Dual-mode detection is implemented through per-message scoring plus conversation rollup, with the opportunistic video reconcile rule defined in this spec.
- **Principle V - Calm-First Design Language**: Chat, stress labels, and crisis resources use calm Graphite semantics. Crisis uses foggy attention treatment, not crimson. Crimson remains reserved for destructive actions such as delete.
- **Principle VI - Responsive & Accessible by Default**: The pill has mobile icon-only behavior with `aria-label="Talk to Ren"`, all touch targets meet the 44px minimum, and chat surfaces support 360px and both themes.
- **Principle VII - Mandatory Testing Per PR**: The hard-case rubric, privacy checks, RLS-as-user behavior, scorer JSON behavior, and responsive accessibility states require automated and smoke coverage during later phases.
- **Principle VIII - Spec-Driven Workflow**: This spec defines scope before plan/tasks/implementation and records the 011 roadmap intent.
