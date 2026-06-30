# Feature Specification: Questionnaire Feedback

**Feature Branch**: `012-questionnaire-feedback`

**Roadmap label**: `012-questionnaire` (constitution v1.10.0, Principle VIII; Amendment 13).

**Created**: 2026-06-30

**Status**: Draft

**Input**: User description: "Feature 012 - Questionnaire: confirmatory mid-session prompt, session-end product feedback, and managerial weekly work-environment check-in."

**Visual source of truth**: `serenify-012-questionnaire-mocks.html` (repo root). The mock is binding for the three instruments, their visible states, copy, icons, and calm-first treatment.

**Styling source of truth**: Graphite tokens in `apps/web/app/globals.css`. The mock uses the same token values as a reference, but implementation must bind to the real repo tokens and must not remap Graphite token names inside `@theme inline`.

**Live signal contract verified**: the passive monitoring band enum is `at_ease`, `a_little_tense`, `tense`; display labels are "at ease", "a little tense", and "tense". The confirmatory prompt keys off the top band, `tense`.

---

## Clarifications

### Session 2026-06-30

- Q: What confirmatory outcome persists, and how does a false alarm affect trend and aggregate views? → A: Persist answered prompt outcome as `confirmed | false_alarm | opened_chat`, tied to the monitoring session and triggering window/time. Window readings remain immutable. `false_alarm` flags the associated window for future manager-visible aggregate exclusion or down-weighting, while the employee's own trend and Today card stay unchanged with no suppression or annotation. This path uses RLS-as-the-employee and no service-role key.
- Q: What is the weekly check-in cadence and re-prompt behavior? → A: Trigger on the employee's first authenticated visit of a new ISO week. The check-in is optional and skippable. If skipped, re-prompt at most once more within the same week, then wait until the next week.
- Q: What are the confirmatory timing and cooldown rules? → A: Trigger when band `tense` is sustained for about 20 seconds continuously, expressed as a named tunable constant. A signal-drop auto-dismiss requires about 4-5 seconds minimum on-screen dwell, also a named tunable constant. Keep one prompt per monitoring session, and after `false_alarm`, additionally suppress the prompt for the next session.
- Q: Does session-end feedback fire after every session or use sampling? → A: For the demo build, fire after every monitoring session. Include a documented flag/seam to sample or reduce frequency later, defaulted to every session in v1.

## User Scenarios & Testing *(mandatory)*

This feature ships three employee-facing questionnaire instruments that share the same calm form patterns and privacy posture. The confirmatory prompt is the passive false-alarm gate during an active monitoring session. The session-end card captures employee-private product feedback. The weekly check-in captures work-environment feedback that can later feed only anonymized team-level manager aggregates.

### User Story 1 - Confirm a sustained tense signal (Priority: P1)

As an employee in an active monitoring session, I see a calm, sticky confirmatory prompt when my passive signal has stayed in the top `tense` band long enough, so Serenify can distinguish a likely stress moment from a false alarm.

**Why this priority**: This is the stage 2 false-alarm gate for passive stress detection. It protects trust in the stress pipeline before recommendations and manager-facing aggregates build on it.

**Independent Test**: Run an active monitoring session with a controlled sequence of `tense`, `a_little_tense`, and `at_ease` bands. Confirm the prompt appears only after the named sustained top-band duration, cannot be dismissed by outside click or misclick, resolves only through a valid answer or a signal drop after the named dwell floor, persists the correct answered outcome and trigger window/time, and appears at most once in the session.

**Acceptance Scenarios**:

1. **Given** an employee has an active monitoring session, **When** the passive video signal remains `tense` continuously for the named `confirmatory_tense_sustained_duration` defaulting to about 20 seconds, **Then** the bottom-right notification surface shows the sticky "Checking in" prompt.
2. **Given** the prompt is visible, **When** the employee clicks outside it or otherwise misclicks, **Then** the prompt remains visible and answerable.
3. **Given** the prompt is visible, **When** the employee chooses "Yes, that's me", **Then** the prompt resolves, persists `confirmed` with the monitoring session and triggering window/time, and Ren opens with a soft handoff opener.
4. **Given** the prompt is visible, **When** the employee chooses "No, I'm okay", **Then** the prompt resolves, persists `false_alarm` with the monitoring session and triggering window/time, flags the associated window for future manager-aggregate exclusion or down-weighting, and suppresses the prompt for the next monitoring session.
5. **Given** the prompt is visible, **When** the employee chooses "Maybe — talk about it", **Then** the prompt resolves, persists `opened_chat` with the monitoring session and triggering window/time, and Ren opens directly.
6. **Given** the prompt is visible, **When** the passive signal drops from `tense` to `a_little_tense` or `at_ease` after the named `confirmatory_prompt_min_dwell_duration` defaulting to about 4-5 seconds, **Then** the prompt disappears without recording an answered outcome.
7. **Given** a prompt has already appeared in a monitoring session, **When** the same session later returns to sustained `tense`, **Then** no second prompt appears in that session.
8. **Given** Ren's conversational scoring detects stress during chat, **When** no passive monitoring session trigger is present, **Then** the confirmatory questionnaire does not appear.
9. **Given** an employee has a `false_alarm` outcome from the previous monitoring session, **When** the next monitoring session reaches sustained `tense`, **Then** the confirmatory prompt remains suppressed for that next session only.
10. **Given** any confirmatory outcome is persisted, **When** the employee Today card or own monitoring trend renders, **Then** the original spike remains visible as-is with no suppression and no "you dismissed this" annotation.

---

### User Story 2 - Give optional feedback after a check-in (Priority: P2)

As an employee after a monitoring session, I can optionally say whether the check-in felt helpful and, if something felt off, choose a reason or add a short note without sending that product feedback to Ren or to management.

**Why this priority**: This feedback closes the loop on the product experience and creates safe seams for preferences, notifications, and future recommendation tuning while keeping product feedback employee-private.

**Independent Test**: End monitoring sessions with the v1 sampling seam defaulted to every session, then exercise Good, Something was off, each reason, free text, and Skip. Confirm each eligible session shows the card, each path reaches the visible state from the mock, stores only the intended employee-private product feedback, and never collides with the mid-session confirmatory prompt.

**Acceptance Scenarios**:

1. **Given** a monitoring session has ended in the demo build, **When** the v1 sampling seam remains at its default, **Then** the employee sees "How did that check-in feel?" after every monitoring session and can choose "Good", "Something was off", or "Skip".
2. **Given** the employee chooses "Good", **When** the card resolves, **Then** it shows the meadow success state with "Glad that helped."
3. **Given** the employee chooses "Something was off", **When** the reason picker appears, **Then** it offers exactly: "The suggestion didn't help", "I just needed quiet time", "The chatbot felt too robotic", and "Something else".
4. **Given** the employee chooses "The suggestion didn't help", **When** the tailored action appears, **Then** it routes to the existing preferences placeholder without sending anything to Ren.
5. **Given** the employee chooses "I just needed quiet time", **When** the tailored action appears, **Then** it routes to the existing notification settings placeholder without sending anything to Ren.
6. **Given** the employee chooses "The chatbot felt too robotic", **When** the card resolves, **Then** the feedback is acknowledged and stored only as Serenify-internal product feedback.
7. **Given** the employee chooses "Something else", **When** they add free text, **Then** that free text is stored only as Serenify-internal product feedback.
8. **Given** the employee chooses "Skip", **When** the card resolves, **Then** it shows the muted wind state with "No problem — another time." and stores no negative reason.

---

### User Story 3 - Complete a weekly work-environment check-in (Priority: P2)

As an employee, I can optionally complete a short weekly work-environment check-in, knowing that managers can later see only anonymized team-level aggregates and never my individual attributed answer.

**Why this priority**: This is the first collection point for work-environment feedback under Principle I and Amendment 13. The privacy shape must be correct before feature 017 consumes any aggregate.

**Independent Test**: Sign in on the employee's first authenticated visit of a new ISO week, then exercise Good, Could be better, Back, Done, and Skip. Confirm the two-step flow matches the mock, the aggregate contribution strips individual attribution from manager-facing data, the first skip can re-prompt at most once in that ISO week, and skipped or incomplete paths do not create a manager-visible response.

**Acceptance Scenarios**:

1. **Given** the employee has their first authenticated visit of a new ISO week, **When** the weekly check-in has not already been completed that ISO week, **Then** the employee sees "How has the work environment felt lately?" and can choose "Good", "Could be better", or "Skip".
2. **Given** the employee chooses "Good", **When** the card resolves, **Then** it shows the meadow success state with "Glad the week's been good."
3. **Given** the employee chooses "Could be better", **When** the stepped flow begins, **Then** Q1 asks "What was your biggest roadblock?" with exactly: "Unclear instructions or goals", "Waiting on other team members", and "Software or tools crashing".
4. **Given** the employee selects a Q1 roadblock, **When** the selection is made, **Then** the flow auto-advances to Q2 and the progress indicator moves forward.
5. **Given** Q2 is visible, **When** the employee reviews the support options, **Then** Q2 asks "What support would have made this week better?" with exactly: "Deadline flexibility", "Better team alignment or communication", "A quieter workspace", and "Better technical equipment".
6. **Given** Q2 is visible, **When** the employee chooses Back, **Then** Q1 is restored without submitting the check-in.
7. **Given** the employee selects Q2 support and chooses Done, **When** the card resolves, **Then** it shows the meadow check state with "Heard — thanks for speaking up."
8. **Given** the employee chooses "Skip" on the first weekly prompt of an ISO week, **When** the card resolves, **Then** it shows the muted wind state with "All good — we'll ask again next week.", records that one skip for cadence only, and does not create a manager-visible answer.
9. **Given** any weekly answer is stored, **When** future manager-facing features read it, **Then** they can consume only anonymized team-level aggregate data and never the employee's attributed response.
10. **Given** the employee skipped the weekly prompt once in the current ISO week, **When** they return on another authenticated visit in that same ISO week, **Then** the weekly check-in may re-prompt at most one more time.
11. **Given** the employee has skipped twice in the current ISO week, **When** they return again before the next ISO week, **Then** the weekly check-in does not re-prompt.

---

### User Story 4 - Preserve calm, private questionnaire surfaces (Priority: P3)

As an employee, I can use all questionnaire surfaces in light or dark mode, on small screens or desktop, with calm copy, stable touch targets, reduced-motion support, and clear privacy boundaries.

**Why this priority**: The three instruments share UI patterns and privacy expectations. A consistent shell reduces employee confusion and prevents one instrument from undermining another.

**Independent Test**: Render all three instruments across 360px and desktop viewports in light and dark themes, with and without reduced motion. Confirm copy, color roles, icons, touch targets, and privacy messaging match the mock and the Graphite system.

**Acceptance Scenarios**:

1. **Given** any questionnaire surface renders, **When** the theme changes between light and dark, **Then** the surface maintains WCAG AA contrast and Graphite semantic color roles.
2. **Given** reduced motion is preferred, **When** success, skip, check, smiley draw-in, or progress fill states occur, **Then** motion is reduced or removed while preserving the final state.
3. **Given** a 360px viewport, **When** the employee interacts with any option, skip, Back, Done, or route action, **Then** every interactive target remains at least 44px and text does not overlap or truncate essential meaning.
4. **Given** the confirmatory prompt and session-end card are both possible in the product, **When** a session moves from active monitoring to ended, **Then** they do not appear on-screen at the same time.

### Edge Cases

- **Signal flicker below threshold**: If the passive signal leaves `tense` before the named sustained duration, no confirmatory prompt appears.
- **Prompt visible during session end**: If a session ends while the confirmatory prompt is visible, the prompt resolves before any session-end feedback card is eligible to show.
- **Prompt expires by signal drop**: If the signal drops after the dwell floor, the prompt disappears without counting as an answered prompt.
- **Prompt answer race**: If the employee answers at the same time the signal drops, only one resolution path is recorded and the surface closes once.
- **Window immutability**: Persisting `confirmed`, `false_alarm`, or `opened_chat` never edits, deletes, suppresses, or annotates the associated window reading.
- **False alarm next-session suppression**: After `false_alarm`, the confirmatory prompt is suppressed for the next monitoring session only, then normal one-prompt-per-session behavior resumes.
- **Session reset**: Starting a new monitoring session resets the one-prompt-per-session limit.
- **Non-video modalities**: The demo fires from the video passive path only. Future physiological or audio paths may share the same questionnaire seam, but Ren's conversational path must not fire it.
- **Skipped feedback**: Skip creates a visible muted completion state but no negative reason, free text, or manager-visible record.
- **Empty free text**: Selecting "Something else" without entering text must not create an empty-text product-feedback payload.
- **Weekly abandoned mid-step**: Leaving the weekly stepped flow before Done must not create a completed manager-aggregate contribution.
- **Weekly repeated skip**: A skipped weekly prompt can reappear at most once more in the same ISO week; after a second skip, the next possible prompt is in the next ISO week.
- **Low headcount aggregate risk**: Minimum-headcount anonymization hardening is deferred to BACKLOG #123 and is required before real employee data collection.

## Requirements *(mandatory)*

### Functional Requirements

**Shared questionnaire shell and visual rules**

- **FR-001**: The system MUST provide three instruments: confirmatory prompt, session-end product feedback, and weekly work-environment check-in.
- **FR-002**: The confirmatory prompt MUST reuse the existing notification toast/sheet surface and render bottom-right.
- **FR-003**: The two feedback instruments MUST render as in-app cards or sheets and must not use the notification surface.
- **FR-004**: All three instruments MUST match the visual source of truth for copy, icon choices, visible states, option ordering, success states, skip states, and stepped-flow behavior.
- **FR-005**: Graphite role tokens from `apps/web/app/globals.css` MUST be the styling source of truth. The implementation MUST NOT copy mock-only placeholder notes or remap Graphite token names inside `@theme inline`.
- **FR-006**: Amber MUST appear only for stress-confirm affordances and stress signals; meadow MUST appear on affirmative/success/calm paths; foggy MUST appear on neutral attention or error states; crimson MUST NOT appear in these affective or feedback surfaces.
- **FR-007**: Icons MUST use the lucide icon family represented in the mock.
- **FR-008**: Smiley draw-in, check draw-in, progress fill, and muted skip animations MUST honor `prefers-reduced-motion`.
- **FR-009**: Every interactive target in all three instruments MUST be at least 44px and usable at the 360px minimum viewport.
- **FR-010**: All questionnaire surfaces MUST satisfy WCAG AA in light and dark themes.

**Confirmatory prompt**

- **FR-011**: The confirmatory prompt MUST be available only while an employee-owned monitoring session is actively running.
- **FR-012**: The confirmatory trigger MUST key off the passive monitoring top band `tense`; lower bands are `a_little_tense` and `at_ease`.
- **FR-013**: The confirmatory trigger MUST require `tense` sustained continuously for a named tunable `confirmatory_tense_sustained_duration`, defaulting to about 20 seconds, before showing the prompt.
- **FR-013a**: Once shown, the confirmatory prompt MUST require a named tunable `confirmatory_prompt_min_dwell_duration`, defaulting to about 4-5 seconds, before a signal drop can auto-dismiss it.
- **FR-014**: The prompt title MUST be "Checking in" and body copy MUST be "Your signals have looked tense for a little while. Is that how you're feeling?"
- **FR-015**: The prompt MUST be sticky and not dismissible by outside click, escape misclick, blur, or a visible close/skip action.
- **FR-016**: The prompt MUST resolve only when the employee answers or when the passive signal drops from `tense` to `a_little_tense` or `at_ease` after the prompt has been on-screen for at least the dwell floor (`confirmatory_prompt_min_dwell_duration`, FR-013a). This dwell floor is measured from when the prompt is shown and is distinct from the sustained-tense trigger duration that gates whether the prompt appears (FR-013).
- **FR-017**: The prompt MUST show exactly three options in this order: "Yes, that's me", "No, I'm okay", and "Maybe — talk about it".
- **FR-018**: Choosing "Yes, that's me" MUST hand off to Ren with a soft opener and must not show recommendations in this feature.
- **FR-019**: Choosing "No, I'm okay" MUST dismiss the prompt as a false alarm, persist `false_alarm`, and suppress the confirmatory prompt for the next monitoring session.
- **FR-020**: Choosing "Maybe — talk about it" MUST open Ren directly.
- **FR-021**: The system MUST show at most one confirmatory prompt per monitoring session, regardless of answer or expiry reason.
- **FR-022**: Starting a new monitoring session MUST reset the one-prompt-per-session limit.
- **FR-023**: Ren's conversational stress detection MUST NOT trigger the confirmatory questionnaire.
- **FR-024**: Each answered confirmatory prompt MUST persist one outcome value: `confirmed`, `false_alarm`, or `opened_chat`, tied to the monitoring session and the triggering window/time.
- **FR-024a**: Window readings MUST remain immutable. Persisting a confirmatory outcome MUST NOT edit, delete, suppress, or annotate any window reading.
- **FR-024b**: A `false_alarm` outcome MUST flag the associated triggering window/time for future manager-visible aggregate exclusion or down-weighting by feature 017.
- **FR-024c**: The employee's own trend and Today card MUST remain unchanged after any confirmatory outcome; spikes stay visible as-is with no suppression and no dismissal annotation.
- **FR-024d**: Confirmatory prompt outcome persistence and false-alarm aggregate flagging MUST use RLS-as-the-employee throughout and MUST NOT introduce service-role access.

**Session-end product feedback**

- **FR-025**: In the demo build, the session-end feedback card MUST appear after every monitoring session by default, and only after the monitoring session has ended.
- **FR-025a**: The system MUST include a documented sampling seam that can reduce session-end feedback frequency later; the v1 default MUST be every session.
- **FR-026**: The session-end feedback card MUST be optional and freely skippable.
- **FR-027**: The session-end feedback card heading MUST be "How did that check-in feel?"
- **FR-028**: The sentiment choices MUST be exactly "Good" and "Something was off".
- **FR-029**: Choosing "Good" MUST resolve to the meadow success state with "Glad that helped."
- **FR-030**: Choosing "Something was off" MUST reveal a reason picker.
- **FR-031**: The reason picker MUST offer exactly: "The suggestion didn't help", "I just needed quiet time", "The chatbot felt too robotic", and "Something else".
- **FR-032**: Choosing "The suggestion didn't help" MUST offer a tailored action to the existing preferences placeholder.
- **FR-033**: Choosing "I just needed quiet time" MUST offer a tailored action to the existing notification settings placeholder.
- **FR-034**: Choosing "The chatbot felt too robotic" MUST acknowledge and store the signal as Serenify-internal product feedback only.
- **FR-035**: Choosing "Something else" MUST offer free text and store the submitted text as Serenify-internal product feedback only.
- **FR-036**: Free text and the "too robotic" signal MUST NOT be sent to Ren, the manager layer, or any manager-visible aggregate.
- **FR-037**: Choosing Skip MUST resolve to the muted state with "No problem — another time." and MUST NOT store a negative reason.
- **FR-038**: Session-end feedback MUST never be visible at the same time as the confirmatory prompt.

**Weekly work-environment check-in**

- **FR-039**: The weekly check-in MUST be employee-owned, optional, and skippable.
- **FR-040**: The weekly check-in MUST trigger on the employee's first authenticated visit of a new ISO week.
- **FR-040a**: If the employee skips the weekly check-in, the system MUST re-prompt at most once more within the same ISO week, then wait until the next ISO week.
- **FR-041**: The weekly heading MUST be "How has the work environment felt lately?"
- **FR-042**: The weekly sentiment choices MUST be exactly "Good" and "Could be better".
- **FR-043**: Choosing "Good" MUST resolve to the meadow success state with "Glad the week's been good."
- **FR-044**: Choosing "Could be better" MUST reveal a two-step flow with one question visible at a time, a progress bar, Back navigation on Q2, and Done confirmation on Q2.
- **FR-045**: Q1 MUST ask "What was your biggest roadblock?" and offer exactly one selection from: "Unclear instructions or goals", "Waiting on other team members", and "Software or tools crashing".
- **FR-046**: Selecting a Q1 answer MUST auto-advance to Q2.
- **FR-047**: Q2 MUST ask "What support would have made this week better?" and offer exactly one selection from: "Deadline flexibility", "Better team alignment or communication", "A quieter workspace", and "Better technical equipment".
- **FR-048**: Done MUST remain unavailable until a Q2 support answer is selected.
- **FR-049**: Choosing Done MUST resolve to the meadow check state with "Heard — thanks for speaking up."
- **FR-050**: Choosing Skip MUST resolve to the muted state with "All good — we'll ask again next week." and MUST NOT create a completed aggregate contribution.
- **FR-051**: Weekly check-in storage MUST be aggregate-friendly and identity-stripped from day one so future manager-facing features consume only anonymized team-level aggregate data.
- **FR-052**: An individual employee's weekly answer MUST NEVER reach a manager, admin, employer, or manager-visible attributed view.
- **FR-053**: Minimum-headcount anonymization hardening from BACKLOG #123 MUST remain out of scope for the demo build but MUST be completed before any real employee data collection.

**Privacy, storage, and routing**

- **FR-054**: Confirmatory prompt data and session-end feedback MUST be employee-private.
- **FR-055**: Weekly work-environment feedback MUST expose only anonymized team-level aggregate data to manager-facing features.
- **FR-056**: All per-user questionnaire access MUST follow the existing authenticated-user privacy posture; service-role access MUST NOT be introduced.
- **FR-057**: Product feedback about Ren's tone, quiet time, suggestion usefulness, or free-text comments MUST NOT be used as conversational input to Ren in this feature.
- **FR-058**: Recommendations are out of scope; confirmatory "Yes" uses Ren handoff as the interim next step.

### Key Entities

- **Confirmatory Prompt State**: Session-scoped prompt lifecycle for one active monitoring session. Key attributes: monitoring session, current lifecycle state (not shown, visible, answered, expired), trigger band, triggering window/time, shown timestamp, answered outcome (`confirmed`, `false_alarm`, or `opened_chat`) when answered, and expiry reason if the signal drops before answer.
- **Confirmatory Aggregate Flag**: Employee-private marker created from a `false_alarm` outcome for future feature 017 aggregate handling. Key attributes: monitoring session, triggering window/time, outcome `false_alarm`, aggregate treatment marker for exclusion or down-weighting, and created timestamp. It references but does not mutate the immutable window reading. It is written and read through RLS-as-the-employee for this feature; manager aggregate consumption is deferred to feature 017.
- **Session-End Feedback**: Employee-private product feedback after a monitoring session. Key attributes: monitoring session, sentiment, optional negative reason, optional free text, tailored action target, submitted or skipped status, sampling decision, and created timestamp. In v1 the sampling decision defaults to every session.
- **Weekly Check-In Contribution**: Employee-submitted work-environment feedback prepared for future anonymized aggregation. Key attributes: ISO week bucket, team bucket, sentiment, optional roadblock category, optional support category, completed or skipped status, and skip count within the ISO week for cadence. The manager-facing shape excludes employee identity, individual attribution, and any precise per-row timestamp that could be joined back to private cadence timestamps.
- **Questionnaire Eligibility State**: The current decision about whether a feedback instrument should be offered. Confirmatory eligibility depends on active session signal state and next-session false-alarm suppression. Session-end eligibility defaults to every ended monitoring session in v1, behind a sampling seam. Weekly eligibility depends on first authenticated visit of a new ISO week and at most one same-week re-prompt after skip.
- **Ren Handoff**: The transition from a confirmatory answer into the existing Ren chat surface. Key attributes: handoff kind (`confirmatory_yes` or `confirmatory_maybe`) and the soft opener variant.

### Out of Scope

- Recommendation cards or a recommendations engine (feature 013).
- Personal de-stress preference capture (feature 014).
- Preferences and notifications hubs beyond routing to existing account placeholders (feature 016).
- Team-lead dashboard display of weekly aggregates (feature 017).
- Minimum-headcount anonymization hardening for real-data collection (BACKLOG #123).
- Ren conversational stress detection as a questionnaire trigger.
- New manager-visible individual answer views, individual feedback exports, or employee-attributed weekly reporting.
- Changes to Today-card or employee monitoring-trend rendering in response to confirmatory outcomes.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: In controlled monitoring tests, the confirmatory prompt appears in 100% of cases where an active session remains `tense` continuously for the configured sustained-tense trigger duration (`confirmatory_tense_sustained_duration`, FR-013). The minimum on-screen dwell floor (`confirmatory_prompt_min_dwell_duration`, FR-013a) is a separate post-appearance timer that gates only signal-drop auto-dismiss and does not affect whether the prompt appears.
- **SC-002**: In controlled monitoring tests, the confirmatory prompt appears in 0% of cases where the signal leaves `tense` before the configured sustained duration.
- **SC-003**: In prompt interaction tests, outside click, blur, escape misclick, and missing close action dismiss the prompt in 0% of cases.
- **SC-004**: In prompt lifecycle tests, the prompt resolves on valid answer or qualifying signal drop in 100% of cases and appears no more than once per monitoring session.
- **SC-005**: In trigger separation tests, Ren conversational stress detection triggers the confirmatory questionnaire in 0% of tested chat-only cases.
- **SC-006**: In confirmatory handoff tests, "Yes, that's me" and "Maybe — talk about it" open Ren in 100% of cases without showing recommendation cards.
- **SC-007**: In session-end feedback tests, employees can complete Good, each negative reason, free text, and Skip paths in no more than three interactions after the card appears.
- **SC-008**: In privacy tests, session-end free text and "too robotic" signals are sent to Ren or manager-visible layers in 0% of cases.
- **SC-009**: In weekly check-in tests, "Could be better" completion requires exactly one Q1 roadblock and one Q2 support answer before Done succeeds.
- **SC-010**: In weekly privacy tests, manager-facing reads expose individual attributed weekly answers in 0% of cases.
- **SC-011**: In responsive visual tests, all three instruments remain usable at 360px through desktop with no overlapping text and all touch targets at least 44px.
- **SC-012**: In theme and accessibility tests, all three instruments meet WCAG AA contrast in both light and dark themes.
- **SC-013**: In reduced-motion tests, success, skip, progress, smiley draw-in, and check draw-in states complete without required animation in 100% of reduced-motion cases.
- **SC-014**: In surface collision tests, confirmatory prompt and session-end feedback are simultaneously visible in 0% of monitored session transitions.
- **SC-015**: In persistence tests, answered confirmatory prompts store exactly one of `confirmed`, `false_alarm`, or `opened_chat` with the monitoring session and triggering window/time in 100% of answered cases.
- **SC-016**: In immutability tests, a `false_alarm` outcome causes 0 edits, deletes, suppressions, or annotations to the employee's window readings, Today card, and own monitoring trend.
- **SC-017**: In aggregate-contract tests, 100% of `false_alarm` outcomes create an associated manager-aggregate exclusion/down-weighting marker without service-role access.
- **SC-018**: In weekly cadence tests, the weekly check-in appears on the first authenticated visit of a new ISO week and re-prompts no more than once after a same-week skip.
- **SC-019**: In session-end cadence tests, the feedback card appears after every monitoring session while the v1 sampling seam is set to its default.

## Assumptions

- The employee is authenticated and has access to the existing employee monitoring session surface.
- The demo build fires the confirmatory prompt from the passive video path only.
- The existing notification surface from feature 003 supports sticky, non-misclick-dismissable behavior.
- The existing Ren chat surface from feature 011 can accept a soft opener handoff.
- Existing account settings placeholders can receive links for preferences and notification settings until later features fill those sections.
- BACKLOG #123 already tracks minimum-headcount anonymization hardening and remains required before real employee data collection.
- The weekly aggregate consumer is future feature 017; this feature only stores the privacy-preserving contribution shape.
- Confirmatory timing defaults are named tunables: about 20 seconds sustained `tense` and about 4-5 seconds minimum on-screen dwell before signal-drop auto-dismiss.
- Session-end feedback fires after every monitoring session in v1, behind a sampling seam that can reduce frequency later.
- Weekly check-in cadence uses ISO weeks and the employee's authenticated visits, with at most one same-week re-prompt after skip.

## Dependencies

- Constitution v1.10.0, especially Principle I and Amendment 13 for weekly work-environment privacy.
- Approved 012 questionnaire mock: `serenify-012-questionnaire-mocks.html`.
- Graphite design tokens in `apps/web/app/globals.css`.
- Existing feature-003 notification surface.
- Existing monitoring session signal contract using `at_ease`, `a_little_tense`, and `tense` bands.
- Existing Ren chatbot handoff surface from feature 011.
- Existing account settings placeholders for preferences and notifications.
- BACKLOG #123 for pre-real-data minimum-headcount anonymization hardening.

## Constitution Alignment

- **Principle I - Privacy by Architecture**: Confirmatory and session-end feedback are employee-private. Weekly feedback is stored in an aggregate-friendly, identity-stripped shape so future manager surfaces receive only anonymized team-level aggregates.
- **Principle V - Calm-First Design Language**: The instruments use Graphite tokens, calm copy, lucide icons, and correct semantic color roles. Amber is limited to stress confirmation; meadow is used for affirmative success; foggy is used for neutral attention or errors; crimson is not used.
- **Principle VI - Responsive & Accessible by Default**: All instruments must support 360px minimum viewport, 44px touch targets, WCAG AA in light and dark themes, and reduced-motion behavior.
- **Principle VII - Mandatory Testing Per PR**: Later phases must cover trigger timing, one-per-session behavior, privacy boundaries, aggregate shape, visual states, responsive behavior, and reduced motion.
- **Principle VIII - Spec-Driven Workflow**: This specification captures the feature before plan/tasks/implementation and records the 2026-06-30 clarification decisions inline.
- **Principle IX - Secrets Discipline**: No secrets are introduced by these questionnaire surfaces.
