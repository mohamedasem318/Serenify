# Specification Quality Checklist: Live "This session" monitoring-graph redesign (009b)

**Purpose**: Validate specification completeness and quality before proceeding to planning
**Created**: 2026-06-25
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

- **All three original `[NEEDS CLARIFICATION]` markers are now RESOLVED and removed** (patched directly into the spec 2026-06-25 from Mohamed's decisions — see spec "Resolved decisions"):
  1. **FR-023** — mid-band token: **resolved** to reuse the existing pinned `--amber-soft-line` (no new token, no amendment).
  2. **FR-022** — no-read copy: **resolved** to same `phraseFor` vocabulary in live/imperative voice; proposed live strings recorded, pending Mohamed's final wording sign-off (a sign-off note, not a clarification marker).
  3. **FR-015** — out-of-frame: **resolved** to ship the foggy treatment built-but-gated-OFF at launch (out-of-frame → muted fallback); reverse-linked to issue #100.
- Additional decisions patched in: now-marker no-read behaviour (FR-004a/b, SC-011), leading-skip fade-in-only (Edge Cases, US2 scenario 7).
- BACKLOG↔Issues contract honoured: a back-reference was appended to **both** issue **#100** and its `docs/BACKLOG.md` entry in the same change (no new issue opened).
- **Zero clarification markers remain.** All quality items pass. The spec is ready for review before `/speckit-clarify`.
- Recon notes captured in-spec (not markers): the 009 mid-band token finding and Amendment 7 coverage of the live graph (covered; at most a one-line clarification, not a new principle).

---

## Requirements Quality Audit — Session 2026-06-25 (pre-plan, honesty-critical gate)

> Deeper "unit tests for the requirements" run after clarification, focused on the honesty-critical
> conditional states. Each item tests whether the *requirement* is complete / clear / consistent /
> testable — NOT whether code behaves. Unchecked = needs a decision or a spec fix.
> Assessment legend used in the run report: **FAIL** = real gap/conflict/untestable; **PASS** = adequately specified.

### Requirement Consistency & Conflicts

- [x] CHK001 - Is the x-axis mapping of the rolling window specified as either **time-proportional** (x ∝ timestamp, so a missed window shows a proportional horizontal gap) or **index-even** (equal spacing per reading)? The two render no-read gap *widths* differently, which is honesty-relevant. [Conflict/Ambiguity, Spec §FR-002a, §FR-002, §SC-012]
- [x] CHK002 - Does "spacing stays stable regardless of read frequency" (FR-002a) actually hold under a literal time-based axis, where spacing is proportional to elapsed time between reads? [Consistency, Spec §FR-002a]
- [x] CHK003 - Does "drop the oldest readings rather than shrink spacing" (FR-002a) presuppose an index-even model (in a time-proportional axis, dropping readings does not change the others' positions)? [Consistency, Spec §FR-002a]
- [x] CHK004 - Is the boundary between the **empty** text-only state and the **warming** dashed-line state defined by *zero trend points* rather than *zero confident readings*? FR-018 anchors empty to "today's `drawableCount === 0` behaviour," but a warming-only session also has `drawableCount === 0` yet must render a dashed line per FR-010 / the "fully read-less" edge case. [Conflict, Spec §FR-018, §FR-010, Edge Cases]
- [ ] CHK005 - Is the colour of the **"a little tense" legend swatch** specified as the FR-023 `--amber-soft-line` token (not the mock placeholder)? FR-021 says the legend is "consistent with the mock," but FR-023 deliberately deviates the mid-band line from the mock. [Consistency, Spec §FR-021, §FR-023]
- [x] CHK006 - Is the no-read **"fade out → gap → fade in"** treatment specified as a **static opacity** rendering (per the mock's `.fade` class) versus a temporal animation? The word "fade" implies motion, which would interact with SC-006 (no animation under reduced-motion). [Consistency/Ambiguity, Spec §FR-011, §FR-012, §FR-013, §SC-006]

### Requirement Completeness — States With No Defined Behavior

- [x] CHK007 - Is the **"now" marker behavior during a leading skip** (a skip before any confident reading) defined? FR-004a requires "at least one confident reading"; FR-004b is worded only for "start-of-session warming" with a dashed line — neither cleanly covers a skip-with-no-prior-confident. [Gap, Spec §FR-004a, §FR-004b, Edge Cases]
- [x] CHK008 - Is the "now" marker behavior in a **fully read-less / all-skipped session** (no confident reading ever, not warming) defined? [Gap, Spec §FR-004b, Edge Cases]
- [x] CHK009 - Is the **parked "now" marker's exact muted rendering** (which token / opacity) specified? FR-004a says "muted/dimmed — not band-coloured," but the binding mock only shows the live amber state, not the parked state. [Gap/Clarity, Spec §FR-004a]
- [x] CHK010 - Does FR-024 specify **what the subtitle shows during an active no-read** (not only what it must not assert)? Only the prohibition is stated; the fallback content is undefined. [Gap, Spec §FR-024]
- [x] CHK011 - Is the **subtitle for a fully read-less / all-skipped session** (no confident reading ever) defined? FR-024 names a warming fallback but not the all-skipped case. [Gap, Spec §FR-024, Edge Cases]
- [ ] CHK012 - Is the **partial-window / ramp-up x-positioning** defined (a session younger than the 2-min window — do the few readings span the full width, or cluster at the right edge)? [Gap, Spec §FR-002a, §FR-002]
- [ ] CHK013 - Are **live-update / transition requirements between polls** specified (how the trend and "now" marker change when a new reading arrives), or explicitly inherited unchanged? [Coverage/Gap]
- [ ] CHK014 - Is **popup dismissal on touch** (after a tap reveals it) specified? FR-007 covers reveal-on-tap but not hide. [Gap, Spec §FR-007]
- [ ] CHK015 - Is the role of the trend point's **`scored` flag** specified for this feature, or confirmed irrelevant? It is listed in Key Entities but used by no requirement. [Completeness, Key Entities]

### Requirement Clarity & Ambiguity

- [ ] CHK016 - Is the rolling-window duration precise (exact seconds + tolerance) rather than "**~2 minutes**"? [Clarity/Measurability, Spec §FR-002a, §SC-012]
- [ ] CHK017 - Is the set of **"supported container widths / viewports"** enumerated (the bounds across which true circles and matched-pair width must hold)? [Clarity, Spec §SC-001, §SC-002]
- [ ] CHK018 - Is the **matched-pair reference element** unambiguous? FR-002 says "camera/feed stage" while Assumptions says "main-column wrapper / camera stage." [Ambiguity, Spec §FR-002, Assumptions]
- [x] CHK019 - Does FR-024 distinguish a **retrospective peak summary** (e.g. "a tense stretch in here") from a **current-state tension assertion** during an active no-read? The existing subtitle is peak-derived, so the line between allowed/forbidden is undrawn. [Ambiguity, Spec §FR-024]
- [ ] CHK020 - Is **"leading skip"** defined to cover a session that *begins* with a skip (no warming run first), not only "after warming"? The Edge Case wording assumes warming precedes. [Clarity, Edge Cases, Spec §FR-013]

### Acceptance Criteria Quality & Testability

- [x] CHK021 - Is the **foggy gate** defined as a single named, controllable/injectable condition? The gate-ON acceptance scenarios (US2 #4) and SC-004 / SC-008 reference toggling it, but no mechanism is specified. [Testability, Spec §FR-015, §FR-021, US2]
- [ ] CHK022 - Is **SC-003** ("identify the band in 100% of confident-reading states") objectively verifiable as written, or does it require a usability-study protocol? [Measurability, Spec §SC-003]
- [ ] CHK023 - Does **SC-012** define a measurable threshold for "gap labels remain **legible**"? [Measurability, Spec §SC-012]

### Honesty-Critical Consistency (scrutiny of the decided states)

- [x] CHK024 - Are the gated-off foggy treatment (FR-015), the legend gating (FR-021), and SC-004 / SC-008 all governed by one gate and mutually consistent? [Consistency, Spec §FR-015, §FR-021, §SC-004, §SC-008]
- [x] CHK025 - Is the parked-marker rule (FR-004a) applied across **every** active-no-read sub-case that has a prior confident reading — including the gated-off out-of-frame fallback? [Coverage, Spec §FR-004a, §SC-011]
- [x] CHK026 - Is "no-read never bridges the calm line" (FR-013) consistent and complete against the leading-skip fade-in-only carve-out? [Consistency, Spec §FR-013, §SC-009]

### Audit resolution status (2026-06-25)

- **Applied to spec.md (Mohamed-approved):** **F1** uniform-slot-per-window x-axis → CHK001/002/003 (FR-002a, SC-012, Edge Cases, Clarifications). **F2** no "now" marker whenever no confident reading has *ever* occurred → CHK007/008 (FR-004b, SC-011, US3 #7). **F3** empty = *zero trend points*, not `drawableCount===0` → CHK004 (FR-018, Edge Cases). **F4** no-read fades are static opacity, not motion → CHK006 (FR-013, SC-006). **F7** foggy gate = single named injectable boolean → CHK021 (FR-015).
- **PASS — no change needed:** CHK024 (gate consistency, strengthened by F7), CHK025 (parked-marker coverage for prior-confident cases), CHK026 (no-bridge vs leading-skip).
- **Applied to spec.md (Mohamed-approved 2026-06-25):** **F6** parked marker = solid `--muted` fill, no halo, same radius → CHK009 (FR-004a). **F5** subtitle switches to a neutral no-read line during an active no-read (and all-skipped), resumes the session summary on a confident reading → CHK010/011/019 (FR-024, SC-013).
- **Pending Mohamed's sign-off:** none — F5 and F6 decided and applied 2026-06-25.
- **Deferred to `/speckit-plan` (minor / plan-level):** CHK005, CHK012, CHK013, CHK014, CHK015, CHK016, CHK017, CHK018, CHK020, CHK022, CHK023.
