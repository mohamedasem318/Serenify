# Cold-Start Readiness Design

**Date:** 2026-07-13

**Goal:** Make calibration and check-in starts communicate and tolerate an Azure Container Apps scale-from-zero wake without keeping the backend artificially warm.

## Context

The production API runs with `minReplicas=0`, `maxReplicas=1`, 4 vCPU, and 8 GiB. A measured request from zero replicas took 46.68 seconds; a warm request took 0.34 seconds.

Calibration already gates recording on `/healthz`, but its four-second timeout turns an expected cold wake into the backend-down modal. Check-in session creation already wakes the API and keeps the camera off until the server accepts the session, but the permission action has no pending presentation and can look unresponsive.

## Behavior

### Calibration

- Wake only after the user presses the existing readiness action.
- Keep the existing `healthGate="checking"` surface and disable forward progress while checking.
- Allow one readiness request to remain pending for up to 75 seconds.
- Continue automatically when `/healthz` succeeds.
- Show the existing backend-down modal only after timeout, network failure, or a non-success response.
- Use the status copy `Waking Serenify... This can take about a minute after some time away.`

### Check-In

- Wake only after the user presses `Allow camera access`.
- Keep the existing acquire-late privacy order: authenticate and create the monitoring session before opening the camera.
- While creation is pending, disable the action, label it `Waking Serenify...`, and expose the status through `aria-live="polite"`.
- Bound session creation to 75 seconds with `AbortController`.
- Preserve existing error routing after timeout: the service-unavailable surface appears and offers retry.
- Preserve the single-create guard so repeated activation cannot create duplicate sessions.

## Visual Contract

- Pending is neutral/affirmative and uses meadow semantics already owned by the permission surface.
- Foggy remains reserved for the existing unavailable state.
- Amber and crimson are not used.
- The button remains at least 44px tall and its label fits at 360px.
- No new animation is required, so reduced-motion behavior is unchanged.
- A skeleton is not used because page content is loaded; this is a bounded command state.

## Interfaces

- `checkHealth(timeoutMs?: number)` keeps its existing signature and changes its default timeout to 75,000ms.
- `createSession(accessToken: string, timeoutMs?: number)` gains an optional timeout with a 75,000ms default and continues returning `kind: "network"` on abort/fetch failure.
- `OpSurfaces` gains `starting?: boolean`; the permission panel consumes it to disable and relabel the action.
- `MonitoringSession` owns a local `starting` flag around the existing session-creation await and resets it in `finally`.

## Testing

- `anchor-client` proves the default readiness request remains pending before 75 seconds and aborts at the boundary.
- `monitoring-client` proves session creation aborts at 75 seconds and maps to `network`.
- `op-surfaces` proves the pending action is disabled, accessible, and correctly labeled.
- `monitoring-session` proves pending state is visible, the camera remains unopened, and repeated activation does not duplicate creation.
- Existing focused suites, full Vitest, lint, typecheck, and production build remain green.

## SpecKit CI Guard

The existing local guard is included as a separate commit:

- `.github/workflows/ci.yml` adds the `speckit-skills guard` job.
- `package.json` adds `check:speckit-skills`.
- `scripts/check-speckit-skills.mjs` verifies the required Claude SpecKit skill files and rejects a broad `.claude/` ignore rule.
- `.claude/skills/speckit-agent-context-update/SKILL.md` is tracked because the guard requires it.

## Constitution Check

| Principle | Status | Evidence |
|---|---|---|
| I. Privacy by Architecture | PASS | Check-in creates the authenticated session before opening the camera; no media exists during wake. |
| II. Employee Agency and Consent | PASS | Wake begins only after an explicit calibration/check-in action; no page-load keepalive is added. |
| III. Explainable AI | PASS | No inference result or model behavior changes. |
| IV. AI Boundary | PASS | No LLM path changes. |
| V. Calm-First Design Language | PASS | Pending stays meadow/neutral; foggy remains failure-only; amber/crimson are absent. |
| VI. Responsive and Accessible | PASS | Existing 44px action is retained, pending is disabled and announced, and copy is bounded for 360px. |
| VII. Mandatory Testing | PASS | Timeout, pending, privacy ordering, and duplicate prevention receive focused tests plus full verification. |
| VIII. Spec-Driven Workflow | PASS | This design and its implementation plan precede code; the separate CI guard protects managed SpecKit skills. |
| IX. Secrets Discipline | PASS | No environment variable, secret, service-role path, or deployment credential changes. |

No constitution exception or amendment is required.
