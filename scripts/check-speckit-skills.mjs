import fs from "node:fs";

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

let failed = false;

const missing = REQUIRED.filter(
  (s) => !fs.existsSync(`.claude/skills/${s}/SKILL.md`)
);
if (missing.length) {
  console.error("Missing speckit skill files:", missing.join(", "));
  console.error("See DECISIONS.md @ 512c1d6 and commit 7a7beff.");
  failed = true;
}

const gitignore = fs.readFileSync(".gitignore", "utf8");
if (/^\.claude\/?\s*$/m.test(gitignore)) {
  console.error(
    "Broad `.claude/` rule found in .gitignore — narrow to `.claude/settings.local.json` per 7a7beff."
  );
  failed = true;
}

if (failed) {
  process.exit(1);
} else {
  console.log("speckit skills check passed.");
}
