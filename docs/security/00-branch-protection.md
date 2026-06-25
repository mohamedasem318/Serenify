# Security Slice 0 — Branch Protection on `main`

## Summary

On 2026-05-25, classic branch protection (GitHub Branch Protection v3 API,
`repos/{owner}/{repo}/branches/main/protection`) was enabled on `main` for
`mohamedasem318/Serenify`. Until this point `main` was unprotected — no
pull-request requirement, no linear-history rule, no force-push or deletion
guard — and the squash-merge workflow used across features 001/002/003 was
honored by convention only. This slice converts that convention into an
enforced rule so that every subsequent PR in the security review phase (this
doc's PR being the first) is exercised by the new protections before the
harder slices (RLS audit, SECURITY DEFINER bodies, secrets discipline) land.

## Update — 2026-06-25 — Required status checks now enforced

When this doc was first written (2026-05-25) there was no CI workflow, so
`required_status_checks` was `null` (see "What's intentionally NOT enabled"
below). Phase-1 CI has since landed (`.github/workflows/ci.yml`, PR #94) and run
green across PRs #94/#96/#97/#98/#99/#101. With a green baseline established, the
two CI jobs are now **required** on `main`:

- `web (lint · typecheck · vitest)`
- `python (ruff · pytest)`

Set via the classic Branch Protection `PUT .../branches/main/protection` with
`required_status_checks.strict = false` (a branch need not be up to date with
`main` before merging — least-disruptive on a one-reviewer team) and `contexts`
= the two check-run names above (matched exactly, including the `·` separators).
**Every other slice-0 setting is unchanged** — PR still required, linear history,
no force-push, no deletions, `enforce_admins: false`, 0 required reviewers.

Net effect: a PR into `main` can no longer be merged until both CI jobs pass.
The "Required status checks (`required_status_checks: null`)" bullet under
"What's intentionally NOT enabled" is therefore **superseded as of this date**.
Note the two **required** contexts are the CI jobs only — the one-off
`.github/dependabot.yml` config-validation check and Dependabot's own meta-checks
are deliberately NOT required (they do not run on every PR).

Verify live:

```bash
gh api repos/mohamedasem318/Serenify/branches/main/protection -q '.required_status_checks'
```

## Rules enabled

Mirrors the live API response (see verbatim output below). Each bullet names
the GitHub field so the doc can be mapped against live state.

- **Require a pull request before merging** — `required_pull_request_reviews`
  is present (non-null), so direct pushes to `main` are rejected; changes must
  arrive via a PR.
  - `required_pull_request_reviews.required_approving_review_count`: `0`
  - `required_pull_request_reviews.dismiss_stale_reviews`: `false`
  - `required_pull_request_reviews.require_code_owner_reviews`: `false`
  - `required_pull_request_reviews.require_last_push_approval`: `false`
    (GitHub default; not set by us)
- **Require linear history** — `required_linear_history.enabled`: `true`.
  Matches the squash-merge precedent from features 001/002/003; merge commits
  to `main` are rejected.
- **Block force pushes** — `allow_force_pushes.enabled`: `false`. History on
  `main` cannot be rewritten.
- **Block branch deletions** — `allow_deletions.enabled`: `false`. `main`
  cannot be deleted.
- **Admin enforcement off** — `enforce_admins.enabled`: `false`. Admins retain
  an override for emergency hotfixes (see rationale below).

GitHub also reports these fields with their default (off) values; we did not
set them, and they are recorded here so a future reader sees the complete live
shape:

- `required_signatures.enabled`: `false`
- `block_creations.enabled`: `false`
- `required_conversation_resolution.enabled`: `false`
- `lock_branch.enabled`: `false`
- `allow_fork_syncing.enabled`: `false`

## What's intentionally NOT enabled

- **Required status checks** (`required_status_checks`: `null`) — **SUPERSEDED
  2026-06-25: now enabled; see the "Update — 2026-06-25" section above.** At the
  original 2026-05-25 capture, no GitHub Actions workflow existed in the repo
  yet, so there were no checks to require — requiring a non-existent check would
  deadlock every merge. CI has since landed (`.github/workflows/ci.yml`) and the
  `web` + `python` jobs are now required.
- **Required approving reviewers > 0**
  (`required_approving_review_count`: `0`) — Serenify is a one-reviewer team
  (Mohamed). Raising this to `1` would block Mohamed from self-merging his own
  PRs, since GitHub does not count the PR author's own approval. Revisit when
  the team grows beyond a single effective reviewer.
- **CODEOWNERS** (`require_code_owner_reviews`: `false`, no `CODEOWNERS` file)
  — premature at the current team size; there are no distinct ownership
  domains to route reviews to yet.
- **Admin enforcement** (`enforce_admins.enabled`: `false`) — the admin
  override is deliberately retained so an emergency hotfix is not blocked by
  the very rules meant to protect routine work on a one-person team. This
  SHOULD flip to `true` once the team grows or once the project starts
  carrying real production traffic, whichever comes first.

## Verification command

Anyone can recheck the live protection state without re-reading this doc:

```bash
gh api repos/{owner}/{repo}/branches/main/protection
```

(`gh api` auto-resolves `{owner}` and `{repo}` from the current repo context.
Add `| jq .` to pretty-print.)

## Date enabled

**2026-05-25.** Verifying `gh api` GET output, captured verbatim:

```json
{
  "url": "https://api.github.com/repos/mohamedasem318/Serenify/branches/main/protection",
  "required_pull_request_reviews": {
    "url": "https://api.github.com/repos/mohamedasem318/Serenify/branches/main/protection/required_pull_request_reviews",
    "dismiss_stale_reviews": false,
    "require_code_owner_reviews": false,
    "require_last_push_approval": false,
    "required_approving_review_count": 0
  },
  "required_signatures": {
    "url": "https://api.github.com/repos/mohamedasem318/Serenify/branches/main/protection/required_signatures",
    "enabled": false
  },
  "enforce_admins": {
    "url": "https://api.github.com/repos/mohamedasem318/Serenify/branches/main/protection/enforce_admins",
    "enabled": false
  },
  "required_linear_history": {
    "enabled": true
  },
  "allow_force_pushes": {
    "enabled": false
  },
  "allow_deletions": {
    "enabled": false
  },
  "block_creations": {
    "enabled": false
  },
  "required_conversation_resolution": {
    "enabled": false
  },
  "lock_branch": {
    "enabled": false
  },
  "allow_fork_syncing": {
    "enabled": false
  }
}
```

## Note on API shape (doc ↔ live mapping)

The `PUT` payload uses flat booleans (`"required_linear_history": true`,
`"allow_force_pushes": false`, …). The `GET` response wraps each of those in
an `{ "enabled": <bool> }` object — so the doc cross-references above point at
`required_linear_history.enabled`, `allow_force_pushes.enabled`, etc. This is
expected Branch Protection v3 behavior, not a discrepancy. This slice uses the
classic Branch Protection API deliberately; migration to the newer Rulesets
API is out of scope.
