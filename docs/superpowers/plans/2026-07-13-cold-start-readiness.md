# Cold-Start Readiness Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use $subagent-driven-development (recommended) or $executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make explicit calibration and check-in actions tolerate and communicate a bounded Azure scale-from-zero wake, and protect the tracked Claude SpecKit skills in CI.

**Architecture:** Preserve the existing privacy order and state machines. Extend the two existing network calls with 75-second defaults, surface a local pending flag through the existing permission UI, and reuse existing unavailable states after a true failure. Add the previously prepared SpecKit structural guard as a separate CI commit.

**Tech Stack:** Next.js 16, React 19, TypeScript, Vitest, Testing Library, GitHub Actions, Node.js.

## Global Constraints

- Backend wake begins only after an explicit user action; no page-load keepalive.
- Camera acquisition remains after authenticated monitoring session creation.
- Pending is meadow/neutral; foggy is failure-only; amber/crimson are not used.
- Touch targets remain at least 44px and copy must fit at 360px.
- No new animation, service-role use, secret, API route, model change, or inference-server change.
- Existing user-owned dirty files in the primary workspace remain untouched.

---

### Task 1: Bound Calibration and Check-In Wake Requests

**Files:**
- Modify: `apps/web/lib/api/anchor-client.ts`
- Modify: `apps/web/lib/api/monitoring-client.ts`
- Test: existing API-client tests located by `rg -l "checkHealth|createSession" apps/web --glob "*.test.*"`

**Interfaces:**
- Consumes: browser `fetch`, `AbortController`, existing result unions.
- Produces: `checkHealth(timeoutMs = 75_000)` and `createSession(accessToken, timeoutMs = 75_000)`.

- [ ] **Step 1: Write failing timeout tests**

Add fake-timer tests that leave `fetch` pending, assert neither call settles before 75,000ms, advance to the boundary, and assert `checkHealth` returns `false` while `createSession` returns `{ ok: false, kind: "network" }`.

- [ ] **Step 2: Run focused tests and verify RED**

Run the exact Vitest files found in Step 1.

Expected: failures because current health defaults to 4,000ms and session creation has no abort timeout.

- [ ] **Step 3: Implement minimal bounded requests**

Use a local `AbortController` and `setTimeout` in each function. Clear the timer in `finally`. Keep optional timeout parameters so tests do not wait in real time and existing callers remain source compatible.

- [ ] **Step 4: Run focused tests and verify GREEN**

Expected: all API-client tests pass with no changed result-union behavior.

### Task 2: Surface Check-In Wake State

**Files:**
- Modify: `apps/web/components/monitor/monitoring-session.tsx`
- Modify: `apps/web/components/monitor/op-surfaces.tsx`
- Modify: `apps/web/components/anchor/green-room.tsx`
- Test: `apps/web/tests/unit/components/monitor/monitoring-session.test.tsx`
- Test: `apps/web/tests/unit/components/monitor/op-surfaces.test.tsx`
- Test: existing calibration recorder/green-room tests.

**Interfaces:**
- Consumes: the bounded API calls from Task 1 and existing `permission`/`healthGate="checking"` states.
- Produces: `OpSurfaces` optional `starting` prop and accessible wake copy on both flows.

- [ ] **Step 1: Write failing pending-state tests**

Add tests that hold `createSession` pending and assert:

- the permission action reads `Waking Serenify...` and is disabled;
- the camera dependency has not been called;
- repeated activation cannot call `createSession` twice;
- calibration checking copy mentions the expected one-minute wake.

- [ ] **Step 2: Run focused component tests and verify RED**

Expected: failures because `starting` is not represented and calibration uses generic connection copy.

- [ ] **Step 3: Implement the minimal pending presentation**

In `MonitoringSession`, set local `starting=true` immediately before session/auth work and reset it in `finally`. Pass it to `OpSurfaces`. In the permission panel, retain the 48px meadow button, set `disabled={starting}`, switch its label, and expose the status with `aria-live="polite"`. Update only calibration's existing checking sentence.

- [ ] **Step 4: Run focused tests and verify GREEN**

Expected: all monitoring and calibration focused tests pass.

- [ ] **Step 5: Commit cold-start behavior**

```powershell
git add apps/web/lib/api apps/web/components/monitor apps/web/components/anchor apps/web/tests
git commit -m "fix(web): communicate backend cold starts"
```

### Task 3: Add the SpecKit Skills CI Guard

**Files:**
- Modify: `.github/workflows/ci.yml`
- Modify: `package.json`
- Create: `scripts/check-speckit-skills.mjs`
- Create: `.claude/skills/speckit-agent-context-update/SKILL.md`

**Interfaces:**
- Consumes: tracked `.claude/skills/speckit-*/SKILL.md` files and root `.gitignore`.
- Produces: `npm run check:speckit-skills` and required CI job `speckit-skills guard`.

- [ ] **Step 1: Port the user-approved local guard exactly**

Copy the current primary-workspace versions of `.github/workflows/ci.yml`, `package.json`, `scripts/check-speckit-skills.mjs`, and `.claude/skills/speckit-agent-context-update/SKILL.md` into the isolated branch without touching any other dirty file.

- [ ] **Step 2: Run the guard**

Run: `npm run check:speckit-skills`

Expected: `speckit skills check passed.`

- [ ] **Step 3: Prove the guard fails on a missing managed skill without editing tracked files**

Run the script against a temporary copied fixture tree with one required `SKILL.md` removed.

Expected: non-zero exit and the removed skill name in stderr.

- [ ] **Step 4: Commit the CI guard**

```powershell
git add .github/workflows/ci.yml package.json scripts/check-speckit-skills.mjs .claude/skills/speckit-agent-context-update/SKILL.md
git commit -m "ci(speckit): guard managed Claude skills"
```

### Task 4: Verify, Audit, and Open the PR

**Files:**
- Modify only documentation if verification reveals an actual mismatch.

**Interfaces:**
- Consumes: Tasks 1-3.
- Produces: a green, reviewable GitHub PR targeting `main`.

- [ ] **Step 1: Run focused and full verification**

Run from `apps/web`:

```powershell
npm run test
npm run lint
npm run typecheck
npm run build
```

Run from repository root:

```powershell
npm run check:speckit-skills
git diff --check origin/main..HEAD
```

- [ ] **Step 2: Re-run the constitution audit**

Confirm no service-role token, Graphite token remap, `--reload`, SVG viewBox change, automatic page-load wake, or user-owned workspace change entered the branch.

- [ ] **Step 3: Update the graph**

Run: `graphify update .`

Expected: graph rebuild completes; parser warnings may be reported but no source file is reverted.

- [ ] **Step 4: Push and open the PR**

Push `fix/cold-start-readiness`, open a PR against `main`, list the measured 46.68-second cold start, tests, constitution evidence, and the separate SpecKit guard commit.
