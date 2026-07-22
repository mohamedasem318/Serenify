# AGENTS.md — Codex CLI Instructions for Serenify

## Tech Stack

- **Frontend:** Next.js 16 App Router (`apps/web`) — TypeScript, Tailwind CSS v4, React Server Components
- **Backend:** FastAPI (`apps/api`) — Python, async endpoints
- **Database:** Supabase / Postgres with Row-Level Security (RLS) enforced on every table
- **ML inference:** `packages/ml-video` — Python, per-session in-memory smoothing buffers

## Design System (Graphite)

### Fonts
- **Outfit** — display / headings
- **Inter** — body / UI text
- Base font size: **17px**

### Semantic color invariants — never break these

| Token family | Meaning | Hard rule |
|---|---|---|
| `amber` | Stress signals | Use **only** for stress-level indicators |
| `crimson` | Destructive actions | Use **only** for delete / irreversible actions |
| `meadow` | Calm / affirmative | Use for positive states, success, calm readings |
| `foggy` | Attention / errors | Use for warnings, error states |

### Accessibility
- **WCAG AA** required in both light **and** dark themes simultaneously — test both
- Minimum breakpoint: **360px**
- Touch targets: minimum **44px**

### Motion
- Reduced-motion: use the repo's `useMediaQuery` hook — **never** Framer Motion's `useReducedMotion`

### Token remapping rule
Never remap a Graphite token name to a different source value inside `@theme inline` — it bakes CSS variables at compile time and bypasses the runtime variable chain.

## Critical Invariants

### Security posture
- **Always use RLS-as-user** — no service-role key anywhere in the codebase, ever
- `get_my_anchor()` is the self-scoped `SECURITY DEFINER` function for scoping queries to the current user; use it for any per-user data access

### Inference server
- Must launch **without `--reload`** — worker restarts drop the in-memory per-session smoothing buffer (`_SessionBuffers`); lost buffers silently corrupt readings

### SVG rendering
- Fixed-pixel SVG: 1 unit = 1px; `SVG width = nLanes × laneWidth` with a matching `viewBox`
- **No stretched viewBox** — a stretched viewBox is the known regression that broke prior builds

## Backlog ↔ Issues

`docs/BACKLOG.md` is the source of truth and is mirrored 1:1 to GitHub Issues.

- When logging a new follow-up to BACKLOG: open its GitHub issue in the same change and record `(#NN)` on the entry
- When fixing a follow-up: mark its BACKLOG entry resolved (date + commit/PR) **and** close the matching issue in the same change
- Never update one without the other; on conflict BACKLOG wins
- Full rules: constitution Principle VIII; operational detail + label taxonomy: `docs/DECISIONS.md`

## Git Workflow

Codex handles **all** git operations:
- Per-file commits (semantic, scoped: `feat/fix/chore/docs/refactor(scope): message`)
- Branch creation and cleanup
- Pushing to remote
- Opening PRs

**Mohamed's only git step: click squash-merge on the PR.**

### Workspace safety — non-negotiable

- Treat Claude Code's project rules and memories as binding context for this
  repository. Read `CLAUDE.md`, `AGENTS.md`, and relevant `.agents/skills/*`
  guidance before git or cleanup work.
- Never hide, stash, delete, reset, move, or otherwise disturb Mohamed's
  untracked files or unrelated dirty work without explicit approval.
- If isolation is needed, use a branch/worktree that leaves the current
  workspace untouched. If preserving unrelated work is unavoidable, state the
  exact command and get approval first.
- After PR merge cleanup, local `main` must be clean only with respect to the
  task branch; user-owned untracked files must remain visible exactly where
  they were.

Commit messages must be semantic and scoped — examples:
```
feat(monitor): add stress trend SVG component
fix(auth): use RLS-as-user posture in session query
chore(deps): update supabase-js to 2.x
```

## Skills

Skills are in `.agents/skills/<skill-name>/SKILL.md`. Invoke by name with `$skill-name`. Key skills available:

- `$systematic-debugging` — use before proposing any fix for a bug or test failure
- `$test-driven-development` — use when adding features or fixing bugs with test coverage
- `$verification-before-completion` — use before declaring any task done
- `$brainstorming` — use when approaching a design decision or architecture choice
- `$frontend-design` — use for any UI work (visual direction, anti-slop guardrails)
- `$ui-ux-pro-max` — use for heuristics, critique, component patterns
- `$responsive-design` — use when a surface needs to work across viewports
- `$supabase` — use for any Supabase / Postgres / RLS / auth work

## SpecKit

SpecKit commands (`/speckit-*`) may be used by both Codex and Claude Code. Follow the
current SpecKit-managed plan context when running them.

## What Codex Must NOT Do

- Do **not** add service-role key usage under any circumstance
- Do **not** remap Graphite design token names inside `@theme inline`
- Do **not** run the inference server with `--reload`
- Do **not** stretch SVG viewBox — always use fixed-pixel 1:1 rendering

## Testing
- Passing e2e tests do NOT guarantee correct real behaviour — cross-tab,
  cross-session, and async-timing failures are systematically masked by
  the suite. Never declare a fix done based solely on e2e passing.

<!-- SPECKIT START -->
For additional context about technologies to be used, project structure,
shell commands, and other important information, read the current plan
at specs/012-questionnaire-feedback/plan.md
<!-- SPECKIT END -->

## graphify

This project has a knowledge graph at graphify-out/ with god nodes, community structure, and cross-file relationships.

When the user types `/graphify`, use the installed graphify skill or instructions before doing anything else.

Rules:
- For codebase questions, first run `graphify query "<question>"` when graphify-out/graph.json exists. Use `graphify path "<A>" "<B>"` for relationships and `graphify explain "<concept>"` for focused concepts. These return a scoped subgraph, usually much smaller than GRAPH_REPORT.md or raw grep output.
- Dirty graphify-out/ files are expected after hooks or incremental updates; dirty graph files are not a reason to skip graphify. Only skip graphify if the task is about stale or incorrect graph output, or the user explicitly says not to use it.
- If graphify-out/wiki/index.md exists, use it for broad navigation instead of raw source browsing.
- Read graphify-out/GRAPH_REPORT.md only for broad architecture review or when query/path/explain do not surface enough context.
- After modifying code, run `graphify update .` to keep the graph current (AST-only, no API cost).
