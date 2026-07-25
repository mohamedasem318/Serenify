# Specification Quality Checklist: Public Surface & Legal

**Purpose**: Validate specification completeness and quality before proceeding to planning
**Created**: 2026-07-24
**Feature**: [spec.md](../spec.md)

## Content Quality

- [x] No implementation details (languages, frameworks, APIs)
- [x] Focused on user value and business needs
- [x] Written for non-technical stakeholders
- [x] All mandatory sections completed

## Requirement Completeness

- [x] No [NEEDS CLARIFICATION] markers remain
- [x] Requirements are testable and unambiguous
- [x] Success criteria are measurable
- [x] Success criteria are technology-agnostic (no implementation details)
- [x] All acceptance scenarios are defined
- [x] Edge cases are identified
- [x] Scope is clearly bounded
- [x] Dependencies and assumptions identified

## Feature Readiness

- [x] All functional requirements have clear acceptance criteria
- [x] User scenarios cover primary flows
- [x] Feature meets measurable outcomes defined in Success Criteria
- [x] No implementation details leak into specification

## Notes

### Validation result: PASS — all open questions resolved (updated 2026-07-25)

All checklist items pass. The spec is internally complete and every requirement is
testable. **All eight open questions are now answered** — OQ-1 and OQ-3 by Constitution
Amendment 17 (merged, PR #156), the rest by operator decision — and each answer is
folded into the functional requirements. The feature is **ready for `/speckit-plan`**.

*(Original validation, preserved: the feature was recorded as **not ready** until
**OQ-1** was answered.)*

### Why OQ-1 was recorded as an open question, not a [NEEDS CLARIFICATION] marker

OQ-1 was not an under-specified requirement — it was a **verified three-way
contradiction** between the required page copy, Constitution Principle I, and the
shipped code. FR-050 mandates stop-and-report on exactly this class of finding, so it
was surfaced as a blocking decision with costed options rather than a gap to be filled
in by guessing.

**Resolved**: Option B — Principle I's substance stands, and Amendment 17 added a
public-communication rule governing how the end-state may be described. The dependency
marker in FR-048 ("pending OQ-1") is replaced by **FR-048a**, which states the
manager-visibility copy rule affirmatively and applies it to every surface this feature
ships, not just the Privacy Policy.

### Deliberate departures from the usual "≤3 clarifications" guidance

Eight open questions were recorded because the request explicitly asked for open
questions over assumptions ("I'd rather answer questions than review a spec built on
assumptions"). They were ranked: OQ-1 blocked; OQ-2–OQ-6 were scoping/copy decisions
that change the work; OQ-7 was repository hygiene; OQ-8 was a copy correction raised
rather than silently applied, per the instruction not to silently change the mock. All
eight are resolved in place in the spec, question text preserved alongside each answer.

### Notes on implementation-detail boundaries

The spec names three concrete artefacts — the monitor's breathing bloom component, the
existing per-user calibration anchor state, and the app's band definitions. These are
recorded under Assumptions/Dependencies as **reuse targets and identity corrections**
(notably: the canon orb is feature 008's bloom, not 007 as the request stated), not as
implementation instruction. The *how* of reuse remains a plan concern, per the
request's "already-decided, see plan" framing.

### Items intentionally left to the plan

Per explicit instruction, the following are constrained by behaviour in the spec and
left to `/speckit-plan` for mechanism: the card structure achieving no-layout-shift /
no-scroll (FR-008); where the team outline coordinates live and how they are applied
(FR-026); and the concrete consent-record schema (FR-039, FR-043).
