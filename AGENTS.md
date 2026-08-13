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
- **Never bare `--reload`.** Any worker restart drops the in-memory per-session smoothing buffer (`_SessionBuffers`), and the smoothed band only latches after ~4 scored windows (~90 s), so the live monitor re-warms from scratch.
- Normal dev: `--reload --reload-dir app` — scoping the watcher to source means cache writes, test-file saves and branch checkouts can't restart the worker.
- Live-monitor test pass: no `--reload` at all is cleanest, `--reload --reload-dir app` is acceptable; either way don't edit `app/` source mid-session.
- `apps/api/README.md` is authoritative here. Do not "correct" it to match a shorter rule.

### SVG rendering
- Fixed-pixel SVG: 1 unit = 1px; `SVG width = nLanes × laneWidth` with a matching `viewBox`
- **No stretched viewBox** — a stretched viewBox is the known regression that broke prior builds

### Product terminology — binding on copy, comments, and docs

Three surfaces, three names. Two of them are easy to confuse and one of them turns on a camera,
so the names are not negotiable:

| Name | What it is |
|---|---|
| **calibration** | The one-off baseline capture of the person's ordinary face |
| **monitoring session** | Live camera inference. **"Check-in" is the friendly name for exactly this**, and the app's primary action says `Start check-in` |
| **weekly work-environment survey** | The text questionnaire about working conditions. **Never** called a check-in |

Set by **#198** on 2026-08-12, reversing an earlier rule that banned a bare "check-in" and
reserved the word for the questionnaire. The app had always said `Start check-in` on the button
that turns a camera on, so the legal documents moved to the app's word rather than the reverse.
Full reasoning: `docs/DECISIONS.md` 2026-08-12; the spec amendment is in `docs/CHANGELOG.md`.

Identifiers are **not** in scope and were deliberately left alone: `weekly-check-in-card.tsx`,
`WeeklyCheckInCard`, `weekly_checkin_cadence`, `submit_weekly_work_environment_checkin`,
`todays-checkin-card.tsx` and the `/privacy#weekly-work-environment-check-in` anchor all keep
their names. Quote them as-is; write the concept in prose.

## Tracking docs — which one, and when

Four docs, four jobs. A change usually touches more than one, and the failure mode is never
"wrote the wrong one" — it is "wrote three and skipped the fourth".

| Doc | What goes in it | When |
|---|---|---|
| `docs/PROGRESS.md` | What shipped, what was verified, what was **not** verified, what was knowingly left broken | When a **line of work** lands |
| `docs/DECISIONS.md` | A judgement call and its reasoning, including rejected alternatives | Same PR as the decision. **Append-only** — reversals are new entries citing the original |
| `docs/CHANGELOG.md` | Amendments to an approved spec, and constitution amendments | Only when a spec is actually amended |
| `docs/BACKLOG.md` | A deferred follow-up, plus its GitHub issue | Same change as the deferral or the fix (see below) |

- `PROGRESS.md` is per **line of work**, not per PR — a run of PRs building one thing gets **one**
  entry, written when that work lands. A PR shipping no user-visible or structural change (a
  BACKLOG-only sync, a one-file log-level fix) needs no entry of its own.
- Enforced loosely by CI: `scripts/check-progress-freshness.mjs` (the `progress freshness guard` job)
  warns at 8 commits behind, fails at 15. It measures **drift**, not per-PR compliance.
- `PROGRESS.md` went silently stale twice (PRs #142–#144, then #210–#256, backfilled in #257) while
  the other three docs stayed current. The rule existed both times; nothing checked it.
- Escape hatch for the hotfix case: a `Progress-Freshness: override (<reason>)` trailer on a commit
  downgrades the failure to a warning. It is a commit trailer so that using it leaves a permanent mark.

## Records are self-contained

**`docs/DECISIONS.md` and `docs/PROGRESS.md` must be understandable on their own.** An entry states
its own conclusion, its own evidence and its own date. It never delegates any of that to a working
document a reader may not have.

- **Triage docs are scratch.** `docs/triage/` is gitignored. A recon, spike or diagnosis note exists
  to work a problem out; it is not a record, and a fresh clone will not have it.
- **Nothing permanent may depend on one.** Before citing a triage file from DECISIONS, PROGRESS,
  BACKLOG, MODELS or a source comment, fold what you need into the citing text. Keeping the filename
  afterwards as a provenance note is fine — the entry just has to stand without it.
- **Preserve measured vs inferred.** Absorbing evidence must not flatten it. If a number was measured
  at n=1 on a contended laptop, the entry says so; "we measured X" in place of "one run on one
  machine showed X" is a downgrade, not a summary.
- **One grandfathered exception**: `docs/triage/mobile-capture-diagnosis.md` stays tracked because
  source comments in `apps/web/lib/capture/constraints.ts` cite it. Do not add a second.

## Backlog ↔ Issues

`docs/BACKLOG.md` is the source of truth and is mirrored 1:1 to GitHub Issues.

- When logging a new follow-up to BACKLOG: open its GitHub issue in the same change and record `(#NN)` on the entry
- When fixing a follow-up: mark its BACKLOG entry resolved (date + commit/PR) **and** close the matching issue in the same change
- Never update one without the other; on conflict BACKLOG wins
- Full rules: constitution Principle VIII; operational detail + label taxonomy: `docs/DECISIONS.md`

## Git Workflow

Codex commits, creates and cleans up branches, pushes, and opens PRs. **Claude Code does the same** —
the constitution (§Development Workflow, gate 7) permits it to push to feature branches, and it has
been opening PRs for a long time. Neither agent owns git exclusively; assume the other may have
touched the branch.

`main` is protected: PR required, linear history, so merge commits are rejected and per-file commits
collapse under squash by design.

### The sequence

1. Agent works on a branch, commits, pushes, opens the PR.
2. **Mohamed squash-merges in the GitHub UI. No agent ever merges** — and never asks him to run git
   commands, only to click.
3. He tells the agent it is merged.
4. Agent prunes the branch **locally and on the remote**, then confirms `main` is clean and current.

While a PR is still open, fold small things that surface into it rather than opening a second one.

Commit messages must be semantic and scoped — examples:
```
feat(monitor): add stress trend SVG component
fix(auth): use RLS-as-user posture in session query
chore(deps): update supabase-js to 2.x
```

### Branch naming

Two regimes, selected by the prefix:

- **SpecKit feature branches** — `NNN-feature-slug` (e.g. `013-public-surface-and-legal`). Cut by
  `/speckit.specify`; `.specify/extensions/git/` validates this prefix and rejects anything else.
- **Everything else** — fixes, chores, docs, spikes — **MUST NOT** match `[0-9][0-9][0-9]-*`. Use a
  typed prefix: `fix/…`, `chore/…`, `docs/…`. A `NNN-` prefix on a non-SpecKit branch makes CI run a
  doubled check list on a PR into `main`.

The SpecKit validator only encodes the first half and only fires when a `/speckit.git.*` command
runs. It is not a repo-wide rule and must not be "fixed" to cover the second half.

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

## Commit & PR conventions

- **Do NOT add `Co-authored-by:` trailers.** Rescinded 2026-07-29, reversing an earlier blanket rule
  that put all three teammates on every commit. The teammates are direct contributors to this
  repository now, so the trailers are redundant; and GitHub attributes co-authors by **email**, so a
  guessed address credits nobody. Commits already merged into `main` keep their trailers — published
  history is not rewritten. See `docs/DECISIONS.md` 2026-07-29.
- **Never write a `Claude-Session:` trailer or any `claude.ai` URL** into a commit message, PR
  description, or issue comment. This repository is **public**, and those URLs link to private agent
  sessions — publishing one exposes a private session to anyone. This includes squash-merge messages,
  which concatenate the branch's commit messages by default: strip any such trailer before merging.

## Privacy Policy & Terms of Service

Any PR that changes what data is collected, where it goes, who can see it, or how long it is
retained MUST review and update the Privacy Policy and Terms of Service in the same PR.

## Instruction files: `CLAUDE.md` ↔ `AGENTS.md`

`CLAUDE.md` (Claude Code) and this file (Codex) both bind agents working in this repository. A change
to a **shared** rule in one MUST land the matching change in the other, in the same PR.

Shared — keep in sync: commit and PR conventions, git workflow, branch naming, security and privacy
invariants, the backlog ↔ issues contract.

Agent-specific — free to differ: harness and tool config, skill names and invocation syntax, which
SpecKit surface the agent drives, and the design-skill split recorded under **Skills**.

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

### Remotion skills — for the launch video in `video/` only

Upstream skills from [remotion-dev/skills](https://github.com/remotion-dev/skills), installed at
project scope so they are committed with the repo. Start at the router; it loads the rest.

- `$remotion-best-practices` — **the router. Enter here** for any work in `video/`
- `$remotion-markup` — content, animation and effects: sequencing, timing, transitions,
  multi-scene structure, text highlights, voiceover, fonts
- `$remotion-create` — scaffolding a composition
- `$remotion-render` — exporting, beyond a plain `npx remotion render`
- `$remotion-docs` — looking up current Remotion APIs
- `$remotion-captions` — transcribing, displaying and animating captions
- `$remotion-multimedia` — Mediabunny: audio/video duration, dimensions, trimming
- `$remotion-interactivity` — structuring markup so the Studio can edit it; installed mainly
  as a link target for the four installed files that reference it

**Not installed, deliberately:** `remotion-maps`, `remotion-saas`, `remotion-upgrade`. None
applies to a hand-authored promotional MP4.

**Exactly two files diverge from upstream** — `remotion-best-practices/SKILL.md` (links
flattened from upstream's nested layout to the flat one; unavoidable) and
`remotion-markup/SKILL.md` (two `remotion-maps` links flattened to plain text marked
`(skill not installed in this repo)`). Everything else is byte-identical. **Keep it that way:
when a link would dangle, install the target rather than hand-edit the file.** Full rationale
and the upgrade procedure: `video/README.md`.

**These are scoped to `video/`.** They carry Remotion's conventions, not this repo's, and have
nothing to say about `apps/web` or `apps/api`. Do not apply them outside the video project.

**The design-skill split is deliberate, not drift.** Claude Code's user-level instructions route all
UI work through `hallmark` and explicitly forbid stacking `frontend-design` or `responsive-design` on
top of it. **Hallmark is not installed for Codex**, so Codex uses the three skills above instead. Do
not "reconcile" this. If Hallmark is ever installed for Codex, this note is the trigger to revisit
the split.

## SpecKit

SpecKit commands (`/speckit-*`) may be used by both Codex and Claude Code. Follow the
current SpecKit-managed plan context when running them.

## What Codex Must NOT Do

- Do **not** add service-role key usage under any circumstance
- Do **not** remap Graphite design token names inside `@theme inline`
- Do **not** run the inference server under **bare** `--reload` (see Inference server above)
- Do **not** stretch SVG viewBox — always use fixed-pixel 1:1 rendering

## Testing
- Passing e2e tests do NOT guarantee correct real behaviour — cross-tab,
  cross-session, and async-timing failures are systematically masked by
  the suite. Never declare a fix done based solely on e2e passing.

<!-- SPECKIT START -->
For additional context about technologies to be used, project structure,
shell commands, and other important information, read the current plan
at `specs/013-public-surface-and-legal/plan.md`. That feature — the landing
page, `/terms`, `/privacy`, the public navbar/footer, and the two consent
gates — is merged and live; treat its plan as shipped context, not as work
in progress. `CLAUDE.md` carries the detailed version of this block.
<!-- SPECKIT END -->

## graphify

This project has a knowledge graph at `graphify-out/` with god nodes, community structure, and cross-file relationships.

`graphify-out/` is **gitignored and local-only** — regenerable build output, never a committed artifact, and it never appears in `git status`. A fresh clone has no graph until someone runs `graphify update .`; treat its absence as "not built yet", never as "this project has no graph".

When the user types `/graphify`, use the installed graphify skill or instructions before doing anything else.

Rules:
- For codebase questions, first run `graphify query "<question>"` when `graphify-out/graph.json` exists. Use `graphify path "<A>" "<B>"` for relationships and `graphify explain "<concept>"` for focused concepts. These return a scoped subgraph, usually much smaller than GRAPH_REPORT.md or raw grep output.
- Read `graphify-out/GRAPH_REPORT.md` only for broad architecture review or when query/path/explain do not surface enough context. It is the broad-navigation entry point — there is no `wiki/index.md`, and no graphify command generates one.
- After modifying code, run `graphify update .` to keep the graph current (AST-only, no API cost).
