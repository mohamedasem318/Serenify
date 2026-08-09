import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { execFileSync, spawnSync } from "node:child_process";
import { after, test } from "node:test";
import { fileURLToPath } from "node:url";

const SCRIPT = fileURLToPath(new URL("./check-progress-freshness.mjs", import.meta.url));
const PROGRESS = "docs/PROGRESS.md";
const CONSTITUTION_PATH = path.join(".specify", "memory", "constitution.md");

const fixtures = fs.mkdtempSync(path.join(os.tmpdir(), "serenify-progress-guard-"));
after(() => fs.rmSync(fixtures, { recursive: true, force: true }));

/** Deterministic identity + no signing/hooks, so a contributor's global git config
 *  cannot change what these tests measure. */
const GIT_ENV = {
  ...process.env,
  GIT_AUTHOR_NAME: "Guard Fixture",
  GIT_AUTHOR_EMAIL: "fixture@example.invalid",
  GIT_COMMITTER_NAME: "Guard Fixture",
  GIT_COMMITTER_EMAIL: "fixture@example.invalid",
  GIT_CONFIG_GLOBAL: path.join(fixtures, "no-such-gitconfig"),
  GIT_CONFIG_SYSTEM: path.join(fixtures, "no-such-gitconfig"),
};

function git(cwd, ...args) {
  return execFileSync("git", args, { cwd, encoding: "utf8", env: GIT_ENV }).trim();
}

function commit(root, message) {
  git(root, "add", "-A");
  git(root, "-c", "commit.gpgsign=false", "commit", "--no-verify", "-m", message);
}

/**
 * Build a repo whose PROGRESS.md was last touched `behind` commits ago.
 *
 * @param {object} opts
 * @param {number} opts.behind        commits landed since PROGRESS.md changed
 * @param {string} [opts.retroHeading] a `## …retro…` line to include in PROGRESS.md
 * @param {string} [opts.trailer]     appended to the newest commit message
 */
function makeRepo({ behind, retroHeading = "", trailer = "" }) {
  const root = fs.mkdtempSync(path.join(fixtures, "repo-"));
  git(root, "init", "--quiet", "--initial-branch=main");

  fs.mkdirSync(path.join(root, "docs"), { recursive: true });
  fs.mkdirSync(path.join(root, ".specify", "memory"), { recursive: true });
  fs.writeFileSync(path.join(root, CONSTITUTION_PATH), "# constitution\n");
  fs.writeFileSync(
    path.join(root, PROGRESS),
    `# Progress\n\n${retroHeading}\n\n## Some entry\n`
  );
  commit(root, "docs: progress entry");

  for (let i = 0; i < behind; i += 1) {
    fs.writeFileSync(path.join(root, `file-${i}.txt`), `${i}\n`);
    const last = i === behind - 1;
    commit(root, last && trailer ? `feat: change ${i}\n\n${trailer}` : `feat: change ${i}`);
  }

  return root;
}

function runGuard(root) {
  const result = spawnSync(process.execPath, [SCRIPT], {
    cwd: root,
    encoding: "utf8",
    env: { ...GIT_ENV, GITHUB_ACTIONS: "" },
  });
  return { ...result, output: `${result.stdout}${result.stderr}` };
}

// A recent retro so these cases isolate the freshness check from the retro check.
const recentRetro = () => {
  const d = new Date(Date.now() - 5 * 86_400_000).toISOString().slice(0, 10);
  return `## Retro — constitution check, ${d}`;
};

test("passes when PROGRESS.md is the newest change", () => {
  const result = runGuard(makeRepo({ behind: 0, retroHeading: recentRetro() }));
  assert.equal(result.status, 0);
  assert.match(result.output, /0 commits have landed since/);
  assert.match(result.output, /progress freshness check passed/);
});

test("passes quietly below the warning threshold", () => {
  const result = runGuard(makeRepo({ behind: 7, retroHeading: recentRetro() }));
  assert.equal(result.status, 0);
  assert.doesNotMatch(result.output, /WARNING/);
  assert.match(result.output, /7 commits have landed since/);
});

test("warns, but passes, at the warning threshold", () => {
  const result = runGuard(makeRepo({ behind: 8, retroHeading: recentRetro() }));
  assert.equal(result.status, 0);
  assert.match(result.output, /WARNING: .*8 commits have landed since/);
  assert.match(result.output, /fails at 15/);
});

test("fails at the limit", () => {
  const result = runGuard(makeRepo({ behind: 15, retroHeading: recentRetro() }));
  assert.equal(result.status, 1);
  assert.match(result.output, /ERROR: .*15 commits have landed since/);
  assert.match(result.output, /one entry per line of work, not per PR/);
});

test("fails well past the limit — the real 2026-08 gap was 34", () => {
  const result = runGuard(makeRepo({ behind: 34, retroHeading: recentRetro() }));
  assert.equal(result.status, 1);
  assert.match(result.output, /34 commits have landed since/);
});

test("an override trailer downgrades the failure to a warning", () => {
  const result = runGuard(
    makeRepo({
      behind: 15,
      retroHeading: recentRetro(),
      trailer: "Progress-Freshness: override (production hotfix)",
    })
  );
  assert.equal(result.status, 0);
  assert.match(result.output, /trailer is present — allowing/);
});

test("the override does not fire on a lookalike line", () => {
  const result = runGuard(
    makeRepo({
      behind: 15,
      retroHeading: recentRetro(),
      trailer: "Discussed the Progress-Freshness: override idea and rejected it",
    })
  );
  assert.equal(result.status, 1);
});

test("warns when no retro entry exists at all — today's state", () => {
  const result = runGuard(makeRepo({ behind: 0 }));
  assert.equal(result.status, 0, "the retro check must never fail the build");
  assert.match(result.output, /No constitution retro entry found/);
});

test("warns when the newest retro is older than a quarter", () => {
  const stale = new Date(Date.now() - 200 * 86_400_000).toISOString().slice(0, 10);
  const result = runGuard(
    makeRepo({ behind: 0, retroHeading: `## Retro — constitution check, ${stale}` })
  );
  assert.equal(result.status, 0);
  assert.match(result.output, /last constitution retro .* is dated/);
});

test("skips rather than fails on a shallow clone", () => {
  const source = makeRepo({ behind: 20, retroHeading: recentRetro() });
  const shallow = fs.mkdtempSync(path.join(fixtures, "shallow-"));
  execFileSync(
    "git",
    ["clone", "--quiet", "--depth", "1", `file://${source.replace(/\\/g, "/")}`, shallow],
    { encoding: "utf8", env: GIT_ENV }
  );

  const result = runGuard(shallow);
  assert.equal(result.status, 0, "a checkout setting must not fail a PR");
  assert.match(result.output, /Shallow clone/);
  assert.match(result.output, /fetch-depth: 0/);
});
