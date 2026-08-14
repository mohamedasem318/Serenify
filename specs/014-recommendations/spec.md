# Feature Specification: Recommendations — "Things that might help"

**Feature Branch**: `014-recommendations`

**Created**: 2026-08-14

**Status**: Draft

**Input**: User description: "Fill the shipped-but-empty 'Things that might help' card on the employee home page with a deterministic recommendation engine over a small, human-authored and human-reviewed item library; opening an item is the engagement record; a single outcome question follows; recommendations and outcomes are private to the individual."

**Terminology** (binding, per `CLAUDE.md` and Amendment 22): the display bands are **Calm / Uneasy / Tense** (internal enum `at_ease` / `a_little_tense` / `tense`). A **check-in** is a monitoring session — the camera one. A **confirmed detection** means the employee answered "Yes, that's me" on feature 012's confirmatory prompt during an active monitoring session. **Reflective copy** is the card's own first-person-adjacent text in states 2 and 9; **item copy** is a library item's title and instructions.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - A pick when the day turns tense (Priority: P1)

An employee whose readings today include Uneasy or Tense sees the card quietly offer one item chosen by deterministic rules. They open it to read its instructions; opening is the engagement record. After closing the instructions they are asked once whether it helped, and the answer is recorded. Nothing about this loop grades, nags, or escalates.

**Why this priority**: This is the core loop the feature exists for — without it the card stays empty and no other story has anything to build on.

**Independent Test**: Seed a day with Uneasy/Tense readings, render the home page, open the pick, close the instructions, answer the outcome question each way. Delivers a complete suggest → engage → outcome cycle with records visible only to the owner.

**Acceptance Scenarios**:

1. **Given** today's readings include Uneasy or Tense and there is no confirmed detection, **When** the home page renders, **Then** the card shows exactly one item, rendered quietly (state 3), and does not restate the band — the check-in card above already did.
2. **Given** a pick is shown, **When** the employee opens it, **Then** the item's instructions are visible (state 5), the instructions are the reviewed library text verbatim, and an engagement record ("opened") is stored.
3. **Given** the instructions were open, **When** the employee closes them, **Then** the outcome prompt appears (state 6), asking once whether it helped. Ignoring it is a valid answer, records nothing, and costs nothing.
4. **Given** the outcome prompt, **When** the employee answers "it helped", **Then** the answer is recorded and the card acknowledges without grading (state 7).
5. **Given** the outcome prompt, **When** the employee answers "it didn't help", **Then** the answer is recorded, the card acknowledges with the same acknowledgement word as state 7, and offers an immediate replacement (state 8) — the only path that does.
6. **Given** an outcome was recorded, **Then** the card is at rest (state 9): it does not immediately push another pick, its copy does not claim the day is over, and it re-arms if the day shifts again.

---

### User Story 2 - A confirmed detection resolves to the pick (Priority: P1)

An employee in an active monitoring session answers "Yes, that's me" on the confirmatory prompt. Instead of today's Ren handoff, the answer resolves to the recommendation: the confirmed pick is reachable in-session on the monitor surface — the person must not have to navigate home to discover anything happened — and the home card renders the same pick, same words, prominently.

**Why this priority**: This is the behavioural change to feature 012 and the moment the recommendation carries the most value; 012's own spec marked the Ren handoff as the interim step this feature replaces (012 FR-018, FR-058).

**Independent Test**: Drive a monitoring session to sustained Tense, answer "Yes, that's me", verify the pick is reachable on the monitor surface without navigation, then verify the home card shows the identical pick prominently. Regression-test the other two answer paths.

**Acceptance Scenarios**:

1. **Given** the confirmatory prompt is visible, **When** the employee chooses "Yes, that's me", **Then** the prompt resolves to the recommendation, not to a Ren handoff, and the confirmed pick is reachable in-session on the monitor surface. The existing chat-pill and dismissal end-states on that surface are the precedent for how much UI is acceptable there.
2. **Given** a confirmed detection, **When** the home page renders, **Then** the card shows the same pick with the same words as the monitor surface, rendered prominently (state 4).
3. **Given** the confirmatory prompt is visible, **When** the employee chooses "No, I'm okay" or "Maybe — talk about it", **Then** behaviour is unchanged from feature 012, including its dwell semantics and its explicit-answer-only budget semantics.
4. **Given** an outcome prompt is pending, **When** a new confirmed detection arrives, **Then** the new detection wins: the stale outcome prompt goes away without recording an answer and the confirmed pick takes over.

---

### User Story 3 - Honest reflection on calm and empty days (Priority: P2)

An employee with no reading yet today sees the card name that cause — not a vague absence — and offer a check-in. An employee whose day has stayed Calm sees a specific, true line drawn from their own readings (real counts, real times) followed by one forward-looking line, with no action attached. The reflective copy is generated so it reads as written for that person, but every fact in it was computed in advance, and a deterministic fallback is always ready.

**Why this priority**: These are the card's most common states. Getting them honest and specific is what separates the card from a motivational-poster widget.

**Independent Test**: Render the card with (a) no readings today, (b) an all-Calm day with derivable specifics, (c) an all-Calm day where no true specific line can be produced, (d) the generation provider down. Each renders the required shape with zero fabricated facts.

**Acceptance Scenarios**:

1. **Given** no reading exists today, **When** the card renders, **Then** it names the cause (no check-in yet today) rather than a generic absence, and offers a check-in (state 1).
2. **Given** today's readings are all Calm, **When** the card renders, **Then** it shows a specific, true line drawn from the person's own readings — real counts, real times — then one forward-looking line, and no action (state 2).
3. **Given** the day's data cannot produce a true specific line, **Then** state 2 falls back to state 1's shape — never to a generic affirmation.
4. **Given** the generation provider is slow, down, or its output fails validation, **Then** the deterministic fallback phrasing renders. The fallback string is the source of truth for what is being said; generation only changes how it is said.
5. **Given** a reflective line was generated for a state, **When** the card re-renders without a state change, **Then** the same text is reused, not regenerated.

---

### User Story 4 - Swapping away (Priority: P3)

An employee who doesn't want the current pick swaps it for something else. Swapping is a preference, not an outcome: no acknowledgement, no ceremony — the next pick simply appears. Swaps are finite; when the day's picks are exhausted, the swap action retires for the day with an honest line rather than repeating.

**Why this priority**: Swapping makes the single-pick model livable, and its signal (distinct from "didn't help") is what feature 015 will learn from — but the card is useful without it.

**Independent Test**: Swap repeatedly until the day's picks are exhausted; verify each swap is recorded as a swap (not an outcome), the item changes without ceremony, and the final state is an honest retirement, not a repeat.

**Acceptance Scenarios**:

1. **Given** a pick is shown, **When** the employee swaps it away, **Then** a different item appears with no acknowledgement and no ceremony (state 10), and the swap is recorded as its own signal, distinct from "didn't help".
2. **Given** the day's picks are exhausted, **When** the employee would swap again, **Then** the swap action retires for the day with an honest line rather than repeating items.
3. **Given** an item is expanded (state 5), **Then** the swap and Ren actions are withdrawn while the instructions are open.

---

### Edge Cases

- A new confirmed detection arrives while an outcome prompt is pending → the new detection wins; the stale prompt disappears without recording an answer (US2 scenario 4).
- The generation provider is down, slow, or returns copy that fails validation → deterministic fallback renders; the card never blocks on generation.
- A Calm day whose data cannot yield a true specific line → state 1's shape, never a generic affirmation.
- The day's picks are exhausted → swap retires honestly for the day.
- The local day boundary passes → everything resets (pick history, swap budget, outcome prompts, reflective copy), consistent with today-card day semantics.
- Readings shift back to Uneasy/Tense after an outcome was recorded → the at-rest card re-arms.
- The card must never interrupt: Uneasy/Tense updates are quiet; only a confirmed detection makes it prominent.

## Requirements *(mandatory)*

### Functional Requirements

**Card states — all ten are required**

- **FR-001**: The card MUST implement exactly these ten states, each with the stated behaviour:

  | # | State | Required behaviour |
  |---|-------|--------------------|
  | 1 | No reading yet today | Names the cause (no check-in yet), not a vague absence; offers a check-in. |
  | 2 | Calm | A specific, true line from the person's own readings (real counts, real times), then one forward-looking line. No action. If no true specific line is derivable, falls back to state 1's shape — never a generic affirmation. |
  | 3 | Uneasy or Tense, unconfirmed | One pick, rendered quietly. Does not restate the band. |
  | 4 | Confirmed detection | The same pick, same words as shown in-session, rendered prominently. |
  | 5 | Item expanded | Instructions visible, library text verbatim; swap and Ren actions withdrawn. |
  | 6 | Outcome prompt | Appears only after the item was opened and its instructions closed. Asked once. Ignoring it is a valid answer and costs nothing. |
  | 7 | Recorded, helped | Acknowledgement, no grading. |
  | 8 | Recorded, didn't help | The same acknowledgement word as state 7, and the only path that offers an immediate replacement. |
  | 9 | At rest after an outcome | Does not immediately push another pick; re-arms if the day shifts again; copy does not claim the day is over. |
  | 10 | Swapped away | No acknowledgement, no ceremony; the next pick appears. |

**Selection engine**

- **FR-002**: Selection MUST be deterministic — rules over the day's band readings, time of day, and what has already been shown, opened, or swapped away today. Identical inputs MUST produce an identical pick. No model chooses the item.
- **FR-003**: The engine MUST surface exactly one item at a time.
- **FR-004**: Items MUST come from a small library authored and reviewed by Mohamed. Titles and instructions render verbatim; item copy is never generated. [NEEDS CLARIFICATION: library size and the category set have not been decided — to be answered in /speckit-clarify.]
- **FR-005**: Every library item MUST carry a category, and selection MUST be expressible over categories, so that feature 015 can generate specific instances within a category this feature has already reviewed.
- **FR-006**: The engine MUST read preferences from a source that returns a neutral default in v1, so that 015 replaces the source rather than the engine. This spec states the requirement only; the seam's shape is a plan decision.

**Content safety (hard invariants)**

- **FR-007**: Crisis content is out of scope entirely. Feature 011 owns crisis, live-only, from the verified resource table. No library item, and no copy on this card, may touch crisis territory, and the engine MUST have no path into it.
- **FR-008**: No item may recommend physical discomfort as a coping technique — no ice, no cold shock, no snapping, no pain — and no substances, including caffeine.
- **FR-009**: No item may read as clinical treatment, make an outcome claim, or require leaving the workplace.

**Feature 012 integration**

- **FR-010**: Choosing "Yes, that's me" on the confirmatory prompt MUST resolve to the recommendation instead of the Ren handoff. This supersedes 012's FR-018/FR-058 interim behaviour, which named exactly this replacement.
- **FR-011**: The confirmed pick MUST be reachable in-session on the monitor surface — the person must not have to navigate home to discover that anything happened. The existing chat-pill and dismissal end-states on that surface are the precedent for how much UI is acceptable there.
- **FR-012**: 012's other two answer paths ("No, I'm okay", "Maybe — talk about it") MUST remain unchanged, and 012's dwell semantics (DECISIONS D-6) and explicit-answer-only budget semantics (DECISIONS D-8) MUST be preserved.
- **FR-013**: The card MUST update quietly on Uneasy and Tense readings without interrupting; only a confirmed detection makes it prominent.
- **FR-014**: A new confirmed detection arriving while an outcome prompt is pending MUST win: the stale prompt goes away without recording an answer.

**Engagement, outcomes, and swaps**

- **FR-015**: Opening an item is the engagement record. The system MUST record what was suggested, what was opened, and the outcome answer when one is given.
- **FR-016**: The outcome prompt MUST appear only after the item was opened and its instructions closed, MUST be asked once per engagement, and ignoring it MUST record nothing and cost nothing.
- **FR-017**: "Didn't help" (an outcome) and swapping away (a preference) are two different signals and MUST be recorded distinctly. Feature 015 will read both.
- **FR-018**: Swapping is finite. Once the day's picks are exhausted, the swap action MUST retire for the day with an honest line rather than repeating. [NEEDS CLARIFICATION: the per-day pick/swap budget has not been decided — to be answered in /speckit-clarify.]
- **FR-019**: Everything — pick history, swap budget, outcome prompts, reflective copy — MUST reset at the local day boundary, consistent with today-card day semantics.

**Reflective copy generation (states 2 and 9)**

- **FR-020**: The facts MUST be computed in advance — counts, times, bands, what was tried. The generator receives those facts and may only phrase them; it MUST NOT introduce a number, a time, or a band claim that was not given to it.
- **FR-021**: Generated copy that fails validation, or a provider that is slow or down, MUST fall back to the deterministic phrasing. The fallback string is the source of truth for what is being said; generation only changes how it is said.
- **FR-022**: Copy MUST be generated once per state change and reused, not regenerated per render.
- **FR-023**: The generator MUST receive no raw readings and no chat content.
- **FR-024**: The provider MUST be the one already used by Ren; introducing a new provider is out of scope.

**Privacy and legal**

- **FR-025**: Recommendations and their outcomes are private to the individual. They MUST NEVER be visible to a manager, an admin, a team lead, or any aggregate. This is a requirement of this feature, not an omission to be filled by feature 017.
- **FR-026**: This feature creates a new data class — what was suggested, what was opened, whether it helped, what was swapped away. Per the Principle VIII standing rule, the Privacy Policy and Terms of Service MUST be reviewed and updated in the same PR.
- **FR-027**: The Privacy Policy MUST state retention for this data class explicitly. [NEEDS CLARIFICATION: the retention period for recommendation records has not been decided — the existing policy keeps monitoring readings ninety days and other classes for the account's life; to be answered in /speckit-clarify.]
- **FR-028**: All card and item copy MUST follow the calm-first voice rules (Principle V): no exclamation marks, never alarmist or clinical, suggest rather than prescribe.

### Key Entities

- **Library item**: A human-authored, human-reviewed suggestion — title, instructions, category. Rendered verbatim; never generated.
- **Recommendation record**: Per person, per local day — what was suggested, what was opened (the engagement record), the outcome answer if given (helped / didn't help), and what was swapped away. Owner-private, never manager-, admin-, team-lead-, or aggregate-visible.
- **Reflective copy facts**: The precomputed bundle of counts, times, bands, and what-was-tried handed to the generator; the only material generated copy may phrase.
- **Preference source**: The seam feature 015 will replace — returns a neutral default in v1.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: In selection tests, identical inputs (day's readings, time of day, today's shown/opened/swapped history) produce an identical pick in 100% of runs.
- **SC-002**: All ten card states are reachable and demonstrated in state coverage tests; no state is unreachable and no eleventh state exists.
- **SC-003**: In privacy tests, recommendation records are readable only by their owner: 0% visibility from manager, admin, team-lead, or any aggregate surface or query path.
- **SC-004**: In copy-validation tests, generated reflective copy contains zero numbers, times, or band claims not present in the supplied facts; with the provider disabled, the deterministic fallback renders in 100% of cases and the card never blocks.
- **SC-005**: In confirmed-detection tests, "Yes, that's me" resolves to the recommendation in 100% of cases, the pick is reachable on the monitor surface without navigation, and the home card shows the identical pick.
- **SC-006**: In 012 regression tests, the "No, I'm okay" and "Maybe — talk about it" paths, the dwell behaviour, and the one-per-session budget semantics are unchanged.
- **SC-007**: In signal-recording tests, swaps and "didn't help" answers are stored as distinct signals in 100% of cases, and an ignored outcome prompt stores nothing.
- **SC-008**: Every library item passes the content review against FR-007/FR-008/FR-009 before ship; 0 items in the shipped library violate them.

## Out of Scope *(explicit non-goals)*

- No routing, notification, or escalation to HR, managers, or anyone else.
- No personalization, no preference capture, no onboarding changes.
- No reranking or learning from outcomes. Outcomes are recorded only.
- No guided timers, players, or animations for the activities themselves.
- No changes to the today-card headline. That is a separate change after this one.
- No changes to Ren's own conversational behaviour beyond making him aware of the current pick.
- No crisis content of any kind (FR-007 restates this as a hard invariant, not merely a non-goal).
- No new LLM provider.

## Assumptions

- **The approved state mock was not found.** The feature brief references an approved state mock in the mocks directory as the behavioural reference, with the path to be supplied; no recommendations mock exists in `docs/mockups/` (or anywhere else searched) as of this writing. This spec is written from the brief's state descriptions alone. When the path is supplied, the mock is the approved reference for behaviour and states only — not visual spec — and its item titles and instruction text are placeholders.
- "Confirmed detection" is exactly a "Yes, that's me" answer on 012's confirmatory prompt; no other signal confirms.
- "Day" means the local day used by the today card; this feature adopts those semantics rather than defining its own.
- Making Ren "aware of the current pick" is contextual awareness only (he can refer to it); his conversational behaviour is otherwise untouched.
- The library review is an editorial review by Mohamed before the library ships; the review checklist is the content-safety invariants (FR-007–FR-009) plus the calm-first voice rules.
- Feature 012's data and instruments are otherwise untouched; this feature changes only the resolution of the "Yes, that's me" path.

## Open items — deferred to /speckit-clarify

Recorded here rather than decided, at Mohamed's direction; the three [NEEDS CLARIFICATION] markers above correspond 1:1.

1. **Library size and category set** (FR-004): how many items ship in v1, and which categories exist.
2. **Per-day pick/swap budget** (FR-018): how many picks a day holds before the swap action retires.
3. **Retention period for recommendation records** (FR-027): the Privacy Policy must state one explicitly; which one is a decision not yet given.

Additionally awaiting an input, not a decision: the path to the approved state mock (see Assumptions).
