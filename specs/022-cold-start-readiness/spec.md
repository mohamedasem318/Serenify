# Feature Specification: Cold-Start Readiness

**Feature Branch**: `fix/cold-start-readiness`

**Created**: 2026-07-13

**Status**: Approved

**Input**: Make calibration and check-in starts tolerate an Azure API wake from zero replicas, communicate the wait clearly on every supported viewport, and retain the explicit-action privacy boundary.

## User Scenarios & Testing

### User Story 1 - Start calibration after idle time (Priority: P1)

An authenticated user starting calibration after the API has scaled to zero sees a clear bounded wake state instead of an immediate backend-down error.

**Why this priority**: Calibration cannot proceed while the API is asleep, and the measured wake time exceeds the current four-second timeout.

**Independent Test**: Hold the health request pending, verify the wake message remains visible before 75 seconds, then resolve it successfully and verify calibration advances.

**Acceptance Scenarios**:

1. **Given** the API is scaled to zero, **When** the user starts calibration, **Then** the existing readiness control is disabled and explains that waking can take about a minute.
2. **Given** the API responds within 75 seconds, **When** health succeeds, **Then** calibration continues automatically.
3. **Given** the API does not respond within 75 seconds, **When** the timeout expires, **Then** the existing service-unavailable recovery surface appears.

### User Story 2 - Start a private check-in after idle time (Priority: P1)

An authenticated user starting a check-in sees an explicit pending state while the API wakes, and the camera remains off until the backend session exists.

**Why this priority**: The current action appears unresponsive during a cold wake, while acquire-late camera behavior is a non-negotiable privacy constraint.

**Independent Test**: Hold session creation pending, verify the button is disabled and relabeled, verify camera acquisition has not run, and verify repeated activation does not create another session.

**Acceptance Scenarios**:

1. **Given** permission has not been granted, **When** the user selects `Allow camera access`, **Then** the action reads `Waking Serenify...`, is disabled, and announces the pending state politely.
2. **Given** session creation is pending, **When** the wait continues, **Then** the camera remains unopened and duplicate activation cannot create a second session.
3. **Given** session creation fails or reaches 75 seconds, **When** the request settles, **Then** the existing service-unavailable recovery surface appears.

### User Story 3 - Protect managed SpecKit skills (Priority: P2)

A contributor receives a CI failure if a required Claude SpecKit skill is missing or the entire `.claude` directory is broadly ignored.

**Why this priority**: Managed planning skills are part of the repository workflow and need a structural regression guard.

**Independent Test**: Run the guard in the repository for success, then run it against a temporary fixture missing one required skill for a deterministic failure.

**Acceptance Scenarios**:

1. **Given** all required skills are tracked, **When** CI runs, **Then** the SpecKit guard passes.
2. **Given** a required skill file is absent, **When** the guard runs, **Then** it exits non-zero and names the missing skill.

### Edge Cases

- A warm API responds immediately without forcing a minimum wait.
- A browser abort, network failure, timeout, or non-success health response uses existing error routing.
- The user cannot trigger duplicate session creation while the first action is pending.
- Pending copy wraps without clipping at 360px and remains legible in light and dark themes.
- No wake request runs merely because a page was loaded.

## Requirements

### Functional Requirements

- **FR-001**: Health readiness MUST allow up to 75 seconds by default and release its timer after settlement.
- **FR-002**: Monitoring session creation MUST allow up to 75 seconds by default and map abort/fetch failure to the existing `network` result.
- **FR-003**: Wake requests MUST begin only after an explicit calibration or check-in action.
- **FR-004**: Check-in MUST create the authenticated backend session before requesting camera access.
- **FR-005**: Check-in pending UI MUST disable its action, use `Waking Serenify...`, and expose a polite live status.
- **FR-006**: Calibration pending UI MUST explain that wake can take about a minute after idle time.
- **FR-007**: Existing service-unavailable recovery surfaces MUST handle true failure.
- **FR-008**: The pending action MUST remain at least 44px tall and fit at 360px in light and dark themes.
- **FR-009**: Pending UI MUST NOT introduce animation or a new reduced-motion path.
- **FR-010**: CI MUST verify required Claude SpecKit skill files and reject a broad `.claude` ignore rule.
- **FR-011**: The change MUST NOT add service-role use, secrets, raw-signal transport, model behavior, `--reload`, Graphite token remaps, or SVG changes.

### Key Entities

- **Wake request**: A bounded existing health or session-creation HTTP request initiated by an explicit user command.
- **Starting state**: Local transient UI state between explicit activation and monitoring session creation settlement.
- **SpecKit guard**: A repository structural check over managed skill entrypoints and `.gitignore` scope.

## Success Criteria

### Measurable Outcomes

- **SC-001**: A request remains pending at 74,999ms and aborts at the 75,000ms boundary in automated tests.
- **SC-002**: While check-in creation is pending, automated tests observe zero camera calls and one session-creation call after repeated activation.
- **SC-003**: Pending controls are disabled, screen-reader announced, at least 44px tall, and unclipped at 360px in both themes.
- **SC-004**: The complete web test, lint, typecheck, and production build gates pass.
- **SC-005**: The SpecKit guard passes in the repository and fails in a temporary missing-skill fixture.

## Assumptions

- Azure Container Apps remains configured for scale-to-zero; a measured production wake took 46.68 seconds.
- The current Graphite permission and readiness surfaces remain the visual source of truth.
- No skeleton is needed because this is a command-pending state, not unloaded page content.
- The final production smoke test occurs after deployment and before merge sign-off is recorded.
