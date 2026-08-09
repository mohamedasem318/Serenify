/**
 * Structural guard: `docs/PROGRESS.md` must not fall behind the code it records.
 *
 * WHY THIS EXISTS
 * ---------------
 * `docs/PROGRESS.md` has now silently gone stale twice:
 *
 *   - PRs #142/#143/#144 (2026-07-12/13) shipped the entire production-deployment
 *     milestone with no entry. Caught by a human recon nine days later
 *     (`RECON_2026-07-21.md:304`) and backfilled on 2026-07-22.
 *   - PRs #210 through #256 (2026-07-29 → 2026-08-10) — thirty-four of them —
 *     shipped with no entry. Caught by a passing question, backfilled in PR #257.
 *
 * Both times the *other* three tracking docs (DECISIONS, BACKLOG, CHANGELOG) stayed
 * current. The rule was never the problem: constitution Principle VIII already says
 * "Progress is tracked in `docs/PROGRESS.md`". What was missing is anything that
 * checks. The two rules in this repo that have never drifted are the two with
 * machinery behind them — `speckit-guard` and `main`'s branch protection — so this
 * follows `check-speckit-skills.mjs` deliberately, in shape and in spirit.
 *
 * WHAT IT DOES *NOT* DO, ON PURPOSE
 * ---------------------------------
 * It does not require a PROGRESS entry per PR. The convention is per *line of work*:
 * of the 34 PRs in the second gap, roughly ten correctly warranted no entry of their
 * own (#248 was a one-file logging change, #251/#254 were BACKLOG-only, and the
 * seventeen video PRs rightly became ONE entry). A per-PR gate would be wrong about
 * a third of the time, and a gate that is wrong that often teaches people to reach
 * for its escape hatch without reading it.
 *
 * So it measures *drift*, which is the failure that actually happened: how many
 * commits have landed since `docs/PROGRESS.md` last changed.
 *
 * THRESHOLDS
 * ----------
 * Warn at 8, fail at 15. Replayed against the real 2026-07-29 → 2026-08-10 gap in a
 * detached worktree, not reasoned about: it warns by `2baca4f` (2026-07-30, 10
 * behind) and **fails at `a7d2a11` on 2026-07-31, two days in** — instead of the gap
 * running twelve days and thirty-four commits to `568325c`, where it reports 34.
 *
 * It also warns (never fails) when the constitution's quarterly retro is overdue
 * (`.specify/memory/constitution.md`, §Compliance review). That obligation has never
 * been met — there is no retro entry in `docs/PROGRESS.md` at all — so failing on it
 * would block every PR from the moment this lands. A warning is the honest signal.
 *
 * ESCAPE HATCH
 * ------------
 * A `Progress-Freshness: override` trailer in any of the last 20 commit messages
 * downgrades the failure to a warning, for the hotfix case where writing the entry
 * genuinely has to wait. It lives in the commit message rather than a label or a
 * workflow input so that using it leaves a permanent, greppable mark in history.
 */

import fs from "node:fs";
import { execFileSync } from "node:child_process";

const PROGRESS = "docs/PROGRESS.md";
const CONSTITUTION = ".specify/memory/constitution.md";

const WARN_AT = 8;
const FAIL_AT = 15;
const RETRO_WARN_DAYS = 100; // "quarterly", with a fortnight of slack

const inActions = process.env.GITHUB_ACTIONS === "true";

function git(args) {
  return execFileSync("git", args, { encoding: "utf8" }).trim();
}

/** GitHub renders these as annotations on the PR; locally they are just lines. */
function warn(message) {
  console.log(inActions ? `::warning::${message}` : `WARNING: ${message}`);
}

function fail(message) {
  console.error(inActions ? `::error::${message}` : `ERROR: ${message}`);
}

let failed = false;

// --- 1. How far behind is PROGRESS.md? --------------------------------------

// A shallow clone cannot answer the question. Say so and pass, rather than
// failing a PR over a checkout setting — `fetch-depth: 0` is the fix, and the
// notice is how someone finds that out.
if (git(["rev-parse", "--is-shallow-repository"]) === "true") {
  warn(
    `Shallow clone — cannot measure ${PROGRESS} freshness. ` +
      "Set `fetch-depth: 0` on actions/checkout for this job."
  );
} else {
  const lastTouch = git(["log", "-1", "--format=%H", "--", PROGRESS]);

  if (!lastTouch) {
    warn(`${PROGRESS} has no commit history reachable from HEAD — skipping.`);
  } else {
    const behind = Number(git(["rev-list", "--count", `${lastTouch}..HEAD`]));
    const lastDate = git(["log", "-1", "--format=%ad", "--date=short", lastTouch]);

    const overridden = git(["log", "-20", "--format=%B"])
      .split(/\r?\n/)
      .some((line) => /^Progress-Freshness:\s*override\b/i.test(line.trim()));

    const summary =
      `${PROGRESS} last changed ${lastDate} (${lastTouch.slice(0, 7)}); ` +
      `${behind} commit${behind === 1 ? "" : "s"} have landed since.`;

    if (behind >= FAIL_AT && overridden) {
      warn(
        `${summary} Over the ${FAIL_AT}-commit limit, but a ` +
          "`Progress-Freshness: override` trailer is present — allowing."
      );
    } else if (behind >= FAIL_AT) {
      fail(
        `${summary} The limit is ${FAIL_AT}. Add an entry for the work that has ` +
          "landed (one entry per line of work, not per PR), or add a " +
          "`Progress-Freshness: override` trailer to a commit in this PR with a reason."
      );
      failed = true;
    } else if (behind >= WARN_AT) {
      warn(
        `${summary} This fails at ${FAIL_AT}. Fold an entry into this PR while it is cheap.`
      );
    } else {
      console.log(`${summary} Under the ${WARN_AT}-commit warning threshold.`);
    }
  }
}

// --- 2. Is the quarterly constitution retro overdue? ------------------------

// Warn-only, always. See the header: this obligation has never once been met, so a
// hard failure would block every PR from the day this guard lands.
if (fs.existsSync(PROGRESS) && fs.existsSync(CONSTITUTION)) {
  const retroDates = fs
    .readFileSync(PROGRESS, "utf8")
    .split(/\r?\n/)
    .filter((line) => /^##+\s/.test(line) && /\bretro\b/i.test(line))
    .flatMap((line) => line.match(/\d{4}-\d{2}-\d{2}/g) ?? [])
    .sort();

  const newest = retroDates.at(-1);

  if (!newest) {
    warn(
      `No constitution retro entry found in ${PROGRESS}. ${CONSTITUTION} ` +
        "(§Compliance review) asks for a brief quarterly entry confirming the " +
        "constitution still reflects reality."
    );
  } else {
    const ageDays = Math.floor((Date.now() - Date.parse(newest)) / 86_400_000);
    if (ageDays > RETRO_WARN_DAYS) {
      warn(
        `The last constitution retro in ${PROGRESS} is dated ${newest} (${ageDays} days ago). ` +
          "A quarterly entry is due."
      );
    }
  }
}

if (failed) {
  process.exit(1);
} else {
  console.log("progress freshness check passed.");
}
