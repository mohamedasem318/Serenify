import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { after, test } from "node:test";
import { fileURLToPath } from "node:url";

const SCRIPT = fileURLToPath(new URL("./check-speckit-skills.mjs", import.meta.url));
const REQUIRED = [
  "speckit-agent-context-update",
  "speckit-analyze",
  "speckit-checklist",
  "speckit-clarify",
  "speckit-constitution",
  "speckit-git-commit",
  "speckit-git-feature",
  "speckit-git-initialize",
  "speckit-git-remote",
  "speckit-git-validate",
  "speckit-implement",
  "speckit-plan",
  "speckit-specify",
  "speckit-tasks",
  "speckit-taskstoissues",
];

const fixtures = fs.mkdtempSync(path.join(os.tmpdir(), "serenify-speckit-guard-"));
after(() => fs.rmSync(fixtures, { recursive: true, force: true }));

function runGuard(gitignore, missing) {
  const root = fs.mkdtempSync(path.join(fixtures, "fixture-"));
  fs.writeFileSync(path.join(root, ".gitignore"), `${gitignore}\n`);
  for (const skill of REQUIRED) {
    if (skill === missing) continue;
    const dir = path.join(root, ".claude", "skills", skill);
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(path.join(dir, "SKILL.md"), `# ${skill}\n`);
  }
  return spawnSync(process.execPath, [SCRIPT], { cwd: root, encoding: "utf8" });
}

for (const pattern of [".claude", ".claude/", "/.claude/", ".claude/*", ".claude/**", "**/.claude/"]) {
  test(`rejects broad ignore pattern ${pattern}`, () => {
    const result = runGuard(pattern);
    assert.equal(result.status, 1);
    assert.match(result.stderr, /Broad `.claude\/` rule/);
  });
}

test("allows the narrow local settings ignore", () => {
  const result = runGuard(".claude/settings.local.json");
  assert.equal(result.status, 0, result.stderr);
});

test("names a missing managed skill", () => {
  const result = runGuard(".claude/settings.local.json", "speckit-agent-context-update");
  assert.equal(result.status, 1);
  assert.match(result.stderr, /speckit-agent-context-update/);
});
