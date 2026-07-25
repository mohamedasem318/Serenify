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
- Co-author trailers: add all three teammates (`Fatma-Alzahraaa`, `gehaddmohamedd`, `hebatullah003`)
  as `Co-authored-by:` trailers on every commit.

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
