# Privacy, Crisis, Signals, and Accessibility Checklist: LLM Client and Ren Chatbot

**Purpose**: Validate that `spec.md` is complete, clear, consistent, and measurable for the 011 privacy, crisis-safety, signal-separation, prompt-seam, RLS, and accessibility requirements.
**Created**: 2026-06-28
**Feature**: [spec.md](../spec.md)

**Note**: This checklist tests the quality of the written requirements, not the implementation.

## Requirement Completeness

- [ ] CHK001 Are the Principle I disclosure invariants fully specified: chat content is employee-private, crisis never routes to manager/admin/employer, and crisis is never persisted? [Completeness, Spec FR-021, FR-041, FR-042, Constitution Alignment]
- [ ] CHK002 Are manager, admin, employer, dashboard, log, and notification exclusions covered wherever crisis and chat privacy are described? [Completeness, Spec FR-021, FR-041, FR-042, SC-010, SC-014]
- [ ] CHK003 Are RLS-as-user requirements specified for chat persistence so only the owning employee can read or mutate conversations and messages? [Completeness, Spec FR-021, FR-022, Data Model]
- [ ] CHK004 Is the no-service-role-key rule explicitly scoped to chat content and employee-private persistence paths? [Completeness, Spec FR-022]
- [ ] CHK005 Are prompt-loading requirements complete for all required file seams: `ren`, `ren_preference_block`, `scorer_per_message`, `scorer_rollup`, and `auto_title`? [Completeness, Spec FR-007]
- [ ] CHK006 Are inline prompt string prohibitions specified for app call sites without leaving an alternate path that could bypass prompt files? [Completeness, Spec FR-010]
- [ ] CHK007 Are no-model-generated-number requirements complete for phone numbers, hotline names, service names, and crisis resources? [Completeness, Spec FR-035, FR-037, FR-038]
- [ ] CHK008 Are signal-separation requirements complete for every named video-derived surface, including today card, live monitor graph, historical video trend, and other physiological stress surfaces? [Completeness, Spec FR-045, FR-046]
- [ ] CHK009 Does the spec explicitly state that the chat band never appears inside or alters the video card, not only that it does not update video-derived data? [Gap, Spec FR-045, FR-046, Signal-Separation Rule]

## Requirement Clarity

- [ ] CHK010 Is "employee-private" defined with clear actor boundaries for employee, manager, admin, employer, and unauthenticated users? [Clarity, Spec FR-021, User Story 1 Scenario 5]
- [ ] CHK011 Is "crisis state" clear enough to distinguish live UI state from persisted fields, logs, badges, product behavior, and later conversation history? [Clarity, Spec FR-041, FR-044, Edge Cases]
- [ ] CHK012 Is the universal immediate-danger fallback clear for employees outside Egypt and the United States, including the requirement that the panel must not be blank? [Clarity, Spec FR-039, FR-040, Crisis Resource Table]
- [ ] CHK013 Is the crisis resource table boundary clear that 011 includes Egypt and United States country rows only, while all other users receive the universal line? [Clarity, Spec FR-036, FR-040, Out of Scope]
- [ ] CHK014 Is the "Ren MUST NOT generate phone numbers" rule clearly separated from the app-rendered verified resource table? [Clarity, Spec FR-035, Crisis Resource Table]
- [ ] CHK015 Is "chat-derived band" defined clearly enough to distinguish rollup bands from per-message bands and video-derived readings? [Clarity, Spec FR-026, FR-029, FR-030, FR-045]
- [ ] CHK016 Is the prompt source-of-truth requirement clear enough to prevent rewritten prompt wording during 011 wiring? [Clarity, Spec Prompt Source of Truth, FR-008]
- [ ] CHK017 Is the mobile pill requirement clear about both icon-only presentation and `aria-label="Talk to Ren"`? [Clarity, Spec FR-013, User Story 1 Scenario 4]
- [ ] CHK018 Is the calm-not-crimson crisis treatment specified with the exact semantic role to use and the roles forbidden for crisis surfaces? [Clarity, Spec FR-043, Constitution Alignment]

## Requirement Consistency

- [ ] CHK019 Are crisis persistence exclusions consistent across user stories, functional requirements, data model, edge cases, out-of-scope list, and constitution alignment? [Consistency, Spec User Story 5, FR-041, Data Model, Edge Cases, Out of Scope]
- [ ] CHK020 Are chat privacy requirements consistent with the conversation hard-delete requirement and manager/admin inaccessibility statements? [Consistency, Spec FR-021, FR-022, FR-044, User Story 4 Scenario 6]
- [ ] CHK021 Are prompt-file requirements consistent between the prompt source-of-truth paragraph, Functional Requirements, Dependencies, and Constitution Alignment? [Consistency, Spec Prompt Source of Truth, FR-007, FR-010, Dependencies]
- [ ] CHK022 Are no-model-generated-number requirements consistent with the fixed Egypt and United States resource rows and the universal fallback line? [Consistency, Spec FR-035, FR-037, FR-038, FR-039, FR-040]
- [ ] CHK023 Are signal-separation requirements consistent with the opportunistic video-context reconcile rule and the no-fusion rule? [Consistency, Spec FR-045, FR-046, FR-047, FR-050, Signal-Separation Rule]
- [ ] CHK024 Are accessibility requirements consistent between acceptance scenarios, Functional Requirements, Success Criteria, and Constitution Alignment? [Consistency, Spec FR-013, FR-019, SC-012, Constitution Alignment]

## Acceptance Criteria Quality

- [ ] CHK025 Can the employee-private chat invariant be objectively evaluated from the written success criteria for read, list, mutate, and notification paths? [Measurability, Spec SC-010]
- [ ] CHK026 Can the crisis non-persistence invariant be objectively evaluated from the written requirements and success criteria without relying on implied implementation behavior? [Measurability, Spec FR-041, FR-044, SC-010, SC-014]
- [ ] CHK027 Can the no-model-generated-numbers rule be objectively evaluated for both Ren text and app-rendered crisis resources? [Measurability, Spec FR-035, SC-009]
- [ ] CHK028 Can signal separation be objectively evaluated for all named video-derived surfaces and recent-chat surfaces? [Measurability, Spec FR-045, FR-046, SC-007]
- [ ] CHK029 Can prompt-file loading and no-inline-prompt requirements be objectively evaluated from the spec without inspecting unstated conventions? [Measurability, Spec FR-007, FR-010]
- [ ] CHK030 Can accessibility outcomes for 360px width, WCAG AA in both themes, 44px touch targets, mobile icon-only pill, and pill aria-label be objectively evaluated? [Measurability, Spec FR-013, FR-019, SC-012]

## Scenario Coverage

- [ ] CHK031 Are primary, alternate, and exception flows covered for crisis triggers from both scorer `crisis: true` and Ren's silent `[CRISIS]` token? [Coverage, Spec FR-033, FR-034, User Story 5]
- [ ] CHK032 Are non-Egypt and non-US crisis-panel scenarios covered for missing country, unsupported country, and absent profile/session country context? [Coverage, Spec FR-040, Assumptions]
- [ ] CHK033 Are chat privacy scenarios covered for all non-owner actors, including manager, admin, employer, team lead, and unauthenticated users? [Coverage, Spec FR-021, User Story 1 Scenario 5, SC-010]
- [ ] CHK034 Are degraded-state scenarios covered for scorer failure, Ren failure, malformed scorer output, reasoning leakage, and end-flow failure without weakening crisis privacy or persistence rules? [Coverage, Spec Edge Cases, FR-051, FR-054, FR-058]
- [ ] CHK035 Are signal-reconcile scenarios covered for recent video reads, no video reads, stale conflicting reads, and the no-fused-value boundary? [Coverage, Spec FR-047, FR-048, FR-049, FR-050]

## Non-Functional Requirements

- [ ] CHK036 Are privacy-safe telemetry requirements specified with both allowed metadata and forbidden sensitive fields? [Completeness, Spec FR-058, Clarifications]
- [ ] CHK037 Are security requirements sufficient to require employee-private RLS behavior without any service-role bypass for chat content? [Security, Spec FR-021, FR-022]
- [ ] CHK038 Are accessibility requirements specified for the crisis panel and chat entry points without relying only on broad page-level accessibility statements? [Gap, Spec FR-013, FR-019, FR-043]
- [ ] CHK039 Are calm visual-treatment requirements complete for crisis, stress labels, destructive delete actions, and attention/error states under Graphite token semantics? [Completeness, Spec FR-017, FR-043, Assumptions]
- [ ] CHK040 Are prompt-file and provider-boundary requirements sufficient to keep prompt wording auditable without logging prompt text in telemetry? [Consistency, Spec FR-007, FR-008, FR-010, FR-058]

## Dependencies & Assumptions

- [ ] CHK041 Are dependencies on existing authenticated employee identity and self-scoped data access rules documented enough to support the RLS employee-private requirement? [Dependency, Spec Dependencies, FR-021, FR-022]
- [ ] CHK042 Is the assumption about employee country source documented enough for the crisis fallback behavior when country is missing or unsupported? [Assumption, Spec Assumptions, FR-040]
- [ ] CHK043 Are dependencies on final prompt files in `packages/llm-client/prompts/` documented with enough specificity to avoid inline prompt substitutions? [Dependency, Spec Dependencies, FR-007, FR-010]
- [ ] CHK044 Is the out-of-scope country-picker boundary consistent with the required universal-line fallback for users outside the two-row crisis table? [Consistency, Spec FR-036, FR-040, Out of Scope]

