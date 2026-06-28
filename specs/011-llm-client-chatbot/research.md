# Phase 0 Research: LLM Client and Ren Chatbot

Research is constrained by the locked stack in constitution v1.9.0 and by the approved 011 spec. No open clarifications remain.

## R-1 - Shared LLM provider boundary

**Decision**: Create `packages/llm-client` as the only LLM provider boundary for server-side LLM calls. It exports an `LLMProvider` protocol, a config-driven provider registry, prompt-loading helpers, scorer validators, and privacy-safe telemetry types.

**Rationale**: Principle IV requires provider abstraction and prompt seams. Centralizing provider calls prevents direct vendor SDK imports from web/API surfaces and lets questionnaire/recommendations reuse the same boundary later.

**Alternatives considered**: Calling Groq directly from FastAPI routers was rejected because it duplicates provider logic and violates the abstraction. Calling vendors directly from Next.js was rejected because it expands secret and prompt exposure.

## R-2 - Prompt files are fixed assets, not inline strings

**Decision**: The five 011 prompt seams live under `packages/llm-client/prompts/`: `ren`, `ren_preference_block`, `scorer_per_message`, `scorer_rollup`, and `auto_title`. Code loads them by id and may interpolate documented variables only at the call boundary.

**Rationale**: The constitution treats inline prompt strings in application code as a violation. File-backed prompts make review, versioning, and future prompt tuning auditable.

**Alternatives considered**: String constants in router/service files were rejected. Database-stored prompts were rejected for 011 because prompt wording is fixed and should be committed/reviewed with code.

## R-3 - Scorer JSON contract and defensive extraction

**Decision**: Scorer calls request `response_format: { type: "json_object" }` and accept only a validated object with shape `{ "band": "at_ease" | "a_little_tense" | "tense", "crisis": boolean }`. The adapter defensively extracts the first JSON object from reasoning-contaminated output before validation. Per-message scorer uses both fields; rollup persists only `band` and discards `crisis`.

**Rationale**: Reasoning models can produce extra text. The scorer must be strict enough to avoid corrupting stored rollups while keeping a clean retry path for malformed output.

**Alternatives considered**: Regex-only parsing was rejected as too loose. Persisting per-message scorer results was rejected by the spec. Letting rollup `crisis` drive the panel was rejected because crisis is live-only via per-message scorer and Ren `[CRISIS]`.

## R-4 - RLS-as-user storage

**Decision**: Store chat in `public.chat_conversations` and `public.chat_messages` with explicit grants, ENABLE/FORCE RLS, owner-only policies, and no manager/admin policies. All application DB access uses the authenticated employee JWT, following `apps/api/app/supabase_user.py`. No service-role key is used for chat content.

**Rationale**: This matches the feature-008 RLS-as-user posture and Principle I. Supabase's current docs require RLS on exposed-schema tables, explicit grants, `TO authenticated` policies, and ownership predicates. The 2026-04-28 Supabase changelog also makes Data API exposure opt-in for new projects, so grants and RLS must be planned together.

**Alternatives considered**: A service-role backend writer was rejected because this feature's invariant is employee-private RLS-as-user. Manager-readable aggregates were rejected because chat content and crisis moments never reach manager/admin layers.

## R-5 - Crisis resources are verified app data

**Decision**: The crisis panel renders resources from a hard-coded verified app table for 011: Egypt and United States rows, plus a universal immediate-danger line for all users. Ren must never generate phone numbers, hotline names, or service names.

**Rationale**: Crisis safety requires deterministic, reviewed resources and the no-model-generated-numbers rule. The universal line prevents blank panels for unsupported or missing countries.

**Alternatives considered**: Asking the model for country resources was rejected. A full country picker was rejected as out of scope.

## R-6 - Parallel Ren/scorer orchestration

**Decision**: Each user send persists the user message, then launches Ren and per-message scorer concurrently. The conversation has a per-conversation send lock while either call is pending. Ren's wording never receives the same-turn scorer output. Rollup runs every fifth user message and on `[END]`; auto-title runs on `[END]` after rollup succeeds.

**Rationale**: Parallel calls keep latency lower while preserving signal separation. The send lock prevents duplicate message writes and racey rollups.

**Alternatives considered**: Serial scorer-before-Ren was rejected because it could steer Ren's reply. Fully optimistic multi-send was rejected because it makes ordering, duplicate writes, and end-flow semantics ambiguous.

## R-7 - Signal separation from video surfaces

**Decision**: Chat rollup bands are stored only on chat conversations and displayed only on recent-chat/chat history surfaces. Video-derived today card, live monitor graph, historical video trend, and physiological stress surfaces never read or display chat-derived bands. Recent video reads may be sent only as limited context to Ren opener/rollup agreement logic.

**Rationale**: This preserves modality honesty. The spec explicitly forbids fused stress values in 011.

**Alternatives considered**: Updating the today card with chat bands was rejected. A combined "overall stress" band was rejected as fusion and out of scope.

## R-8 - Graphite and accessibility implementation posture

**Decision**: Reuse existing feature-003 shell components and Graphite tokens from `apps/web/app/globals.css`. Do not remap role tokens in `@theme inline`. Crisis uses foggy attention treatment; destructive delete uses crimson; mobile pill is icon-only with `aria-label="Talk to Ren"`; all chat surfaces preserve 44px touch targets and WCAG AA in both themes.

**Rationale**: This keeps the 011 surfaces visually consistent with the application shell and preserves constitution token semantics.

**Alternatives considered**: New design tokens were rejected. Crimson crisis treatment was rejected because crimson is destructive-only.
