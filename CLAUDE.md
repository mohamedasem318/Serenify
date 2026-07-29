<!-- SPECKIT START -->
For additional context about technologies to be used, project structure,
shell commands, and other important information, read the current plan
at `specs/013-public-surface-and-legal/plan.md` (with supporting artifacts:
`research.md`, `data-model.md`, `contracts/consent-evaluate.md`,
`contracts/consent-gates.md`, `contracts/wordmark.md`,
`contracts/landing-hero-story.md`, `contracts/public-surface.md`,
`quickstart.md`; `tasks.md` and `smoke-tests.md` follow). Section numbers
(`§6.3`, `§7.3`, `§10.3`, …) are stable across those files — the map is in
plan.md §4.1.
This feature builds the public front door and the legal surface behind it:
the landing page at `/`, `/terms`, `/privacy`, a public navbar + footer, and
**two consent gates** — Terms/Privacy and camera-and-inference. Neither gate is
one-time: both texts can be revised, and a revision judged **material**
re-prompts everyone whose recorded consent predates it, so consent is a
**history** (one append-only row per accepted revision, never overwritten) and
the Terms/Privacy gate blocks the **whole application**, not just signup.
Version identity — not timestamp comparison — decides re-consent, against an
**in-repo registry** (`apps/web/lib/consent/registry.ts`); one migration
(`user_consents`, owner-only RLS, immutability trigger, no UPDATE/DELETE grant).
Declining writes nothing, deletes nothing, and writes no withdrawal state.
Terminology is binding: **calibration** / **monitoring session** / **weekly
work-environment check-in** — never bare "check-in". The signed-off landing mock
(`docs/mockups/serenify-landing-mock.html`, gitignored — grep it with
`--no-ignore`) carries **three forbidden lines** (`:442`, `:550`, `:772`) that
Amendment 17 bans; replacement copy is **APPROVED and fixed verbatim in plan §10.3**
— use it character-for-character, do not re-word it.
Implements constitution 1.13.0 Amendment 17 (two-colour wordmark, one shared
component + two hand-sync exceptions; manager-visibility copy discipline) and
MUST NOT re-amend the constitution. Closes #75 and #157; **not** #62.
<!-- SPECKIT END -->

## Backlog ↔ Issues

`docs/BACKLOG.md` is the source of truth and is mirrored 1:1 to GitHub Issues. When you log
a new follow-up to BACKLOG, open its issue in the same change and record `(#NN)` on the entry.
When you fix a follow-up, mark its BACKLOG entry resolved (date + commit/PR) **and** close the
matching issue in the same change. Never update one without the other; on conflict, BACKLOG
wins. Full rules: constitution Principle VIII; operational detail + label taxonomy:
`docs/DECISIONS.md`.

## Privacy Policy & Terms of Service

Whenever a feature changes what data is collected, where it goes, who can see it, or
how long it is retained, the Privacy Policy and Terms of Service MUST be reviewed and
updated in the same PR.

## Commit & PR conventions

- **Never write `Claude-Session:` trailers or any `claude.ai` URLs** into commit messages, PR
  descriptions, or issue comments. This repository is **public**, and those URLs link to private
  agent sessions — publishing one exposes a private session to anyone. This applies to squash-merge
  messages too: strip any such trailer before merging, since squash concatenates the branch's commit
  messages by default. (Two such trailers already exist on `main` in older feature commits, `#23`
  and `#118`; history is not rewritten for them — the rule is forward-looking.)
- **Do NOT add `Co-authored-by:` trailers.** Rescinded 2026-07-29 by Mohamed, reversing the
  earlier blanket rule that put all three teammates on every commit. Two reasons: the
  teammates are direct contributors to this repository now, so the trailers are redundant;
  and GitHub attributes co-authors by **email**, so a guessed address credits nobody — the
  trailers on the 2026-07-29 navbar-chrome commit used three invented `@users.noreply`
  addresses that appear nowhere in `main`'s history. Redundant at best, misattributing at
  worst. See `docs/DECISIONS.md` 2026-07-29.
  **Commits already merged into `main` keep their trailers** — published history is not
  rewritten for this. The rule is forward-looking only.

### Branch naming

Two regimes, selected by the prefix:

- **SpecKit feature branches** — `NNN-feature-slug` (e.g. `013-public-surface-and-legal`). Cut by
  `/speckit.specify`; `.specify/extensions/git/` validates this prefix and rejects anything else.
- **Everything else** — fixes, chores, docs, spikes — **MUST NOT** match `[0-9][0-9][0-9]-*`. Use a
  typed prefix: `fix/…`, `chore/…`, `docs/…`. A `NNN-` prefix on a non-SpecKit branch makes CI run a
  doubled check list on a PR into `main`.

The SpecKit validator only encodes the first half and only fires when a `/speckit.git.*` command
runs. It is not a repo-wide rule and must not be "fixed" to cover the second half.

### PR workflow

`main` is protected: PR required, linear history, so merge commits are rejected and per-file commits
collapse under squash by design.

1. Agent works on a branch, commits, pushes, opens the PR.
2. **Mohamed squash-merges in the GitHub UI. No agent ever merges** — and never asks him to run git
   commands, only to click.
3. He tells the agent it is merged.
4. Agent prunes the branch **locally and on the remote**, then confirms `main` is clean and current.

While a PR is still open, fold small things that surface into it rather than opening a second one.

## Remotion skills — for the launch video in `video/` only

Upstream skills from [remotion-dev/skills](https://github.com/remotion-dev/skills) are installed
at **project scope** in `.claude/skills/` (and mirrored to `.agents/skills/` for Codex), so they
are committed with the repo rather than depending on anyone's global install. Claude Code
discovers them automatically; invoke with the `Skill` tool.

Enter through **`remotion-best-practices`** — it is the router and loads the rest. Also installed:
`remotion-markup` (sequencing, timing, transitions, multi-scene, text highlights, voiceover,
fonts), `remotion-create`, `remotion-render`, `remotion-docs`, `remotion-captions`,
`remotion-multimedia`.

**Not installed, deliberately:** `remotion-maps`, `remotion-saas`, `remotion-upgrade`,
`remotion-interactivity`. Where an installed file linked to one of them the link was flattened to
plain text marked `(skill not installed in this repo)` — do not turn those back into links without
installing the target. Rationale and upgrade procedure: `video/README.md`.

**These are scoped to `video/`.** They carry Remotion's conventions, not this repo's, and say
nothing about `apps/web` or `apps/api`. Do not apply them outside the video project. In
particular they must not override the `hallmark` routing rule for UI work in `apps/web`.

## Instruction files: `CLAUDE.md` ↔ `AGENTS.md`

This file (Claude Code) and `AGENTS.md` (Codex) both bind agents working in this repository. A change
to a **shared** rule in one MUST land the matching change in the other, in the same PR.

Shared — keep in sync: commit and PR conventions, git workflow, branch naming, security and privacy
invariants, the backlog ↔ issues contract.

Agent-specific — free to differ: harness and tool config, skill names and invocation syntax, which
SpecKit surface the agent drives, and the design-skill split (Claude routes UI work through
`hallmark`; Codex uses `frontend-design` / `ui-ux-pro-max` / `responsive-design` because Hallmark is
not installed for it — recorded in `AGENTS.md` §Skills).

## graphify

This project has a knowledge graph at `graphify-out/` with god nodes, community structure, and
cross-file relationships.

`graphify-out/` is **gitignored and local-only** — it is regenerable build output, not a committed
artifact. A fresh clone has no graph until someone runs `graphify update .`. Treat its absence as
"not built yet", never as "this project has no graph".

Rules:
- For codebase questions, first run `graphify query "<question>"` when `graphify-out/graph.json`
  exists. Use `graphify path "<A>" "<B>"` for relationships and `graphify explain "<concept>"` for
  focused concepts. These return a scoped subgraph, usually much smaller than GRAPH_REPORT.md or
  raw grep output.
- Read `graphify-out/GRAPH_REPORT.md` only for broad architecture review, or when
  query/path/explain do not surface enough context. It is the broad-navigation entry point.
- After modifying code, run `graphify update .` to keep the graph current (AST-only, no API cost).

Note: an earlier version of this section told you to prefer `graphify-out/wiki/index.md` for broad
navigation. **No such file has ever existed, and graphify 0.9.12 has no command that generates a
wiki** — `graphify --help` lists no `wiki` verb. The rule pointed at nothing. GRAPH_REPORT.md is the
real broad-navigation artifact; the optional HTML views are `graphify tree` (GRAPH_TREE.html) and
the `cluster-only` viz (graph.html), neither of which is generated by default.
