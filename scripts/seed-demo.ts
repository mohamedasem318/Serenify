import { fileURLToPath } from "node:url";
import { realpathSync } from "node:fs";
import { argv } from "node:process";

import { buildHierarchy, type DemoUser } from "./lib/hierarchy.js";
import { ConfigError, loadConfig, type SeedConfig } from "./lib/env.js";
import { createAdminClient } from "./lib/supabase-admin.js";
import { confirmProceed } from "./lib/confirm.js";
import { environmentBanner, passwordBanner, summaryTable } from "./lib/banner.js";

const SEED = 1729;
const SHARED_PASSWORD = "DemoUser123!";
const DEMO_EMAIL_SUFFIX = "@demo.serenify.local";

type MainOptions = {
  readonly argv?: readonly string[];
  readonly skipPrompt?: boolean;
};

type ExitResult = { readonly exitCode: number };

export async function main(opts: MainOptions = {}): Promise<ExitResult> {
  let config: SeedConfig;
  try {
    config = loadConfig(opts.argv ?? argv.slice(2));
  } catch (err) {
    return handleConfigError(err);
  }

  process.stdout.write(environmentBanner(config.target) + "\n");

  if (config.target.kind === "remote") {
    process.stdout.write("Proceed? (y/N) ");
    const proceed = opts.skipPrompt === true ? true : await confirmProceed();
    if (!proceed) {
      process.stderr.write("Aborted by user.\n");
      return { exitCode: 4 };
    }
  }

  const admin = createAdminClient(config.target);

  // Step: enumerate the demo cohort in the project.
  const demoUsers = await listDemoUsers(admin);

  // Reset path: delete the demo cohort first, then fall through to create.
  if (config.reset) {
    if (demoUsers.length > 0) {
      process.stdout.write(`Deleting ${demoUsers.length} existing demo user(s)…\n`);
      for (const u of demoUsers) {
        const { error } = await admin.auth.admin.deleteUser(u.id);
        if (error) {
          process.stderr.write(`deleteUser failed for ${u.email}: ${error.message}\n`);
          return { exitCode: 5 };
        }
      }
    }
    // After delete, the cohort is empty — fall through to the create
    // path. (FK CASCADE wipes corresponding profiles rows.)
  } else {
    if (demoUsers.length === 30) {
      process.stdout.write("Demo cohort already present. No changes made.\n");
      return { exitCode: 0 };
    }
    if (demoUsers.length > 0 && demoUsers.length < 30) {
      process.stderr.write(
        `Found ${demoUsers.length} demo user(s) — neither 0 nor 30. The cohort is in a partial state from a prior interrupted run. Run 'npm run seed:reset' to recover.\n`,
      );
      return { exitCode: 5 };
    }
  }

  // Create path: 30 sequential admin.createUser calls + one bulk upsert.
  const users = buildHierarchy(SEED);
  process.stdout.write(`Creating ${users.length} demo users…\n`);

  const slotToId = new Map<number, string>();
  for (const u of users) {
    const { data, error } = await admin.auth.admin.createUser({
      email: u.email,
      password: SHARED_PASSWORD,
      email_confirm: true,
      user_metadata: { full_name: u.full_name },
    });
    if (error || !data.user) {
      process.stderr.write(`createUser failed for ${u.email}: ${error?.message ?? "no user returned"}\n`);
      return { exitCode: 5 };
    }
    slotToId.set(u.slot, data.user.id);
  }

  // Bulk upsert on public.profiles in one HTTP call. The trigger
  // from feature 001 already created an employee-role row for each
  // user; this upsert overwrites role, manager_id, and full_name in
  // a single round-trip per FR-018 + plan.md "single bulk profile
  // update statement".
  const profileRows = users.map((u) => ({
    id: slotToId.get(u.slot)!,
    full_name: u.full_name,
    role: u.role,
    manager_id: u.manager_slot === null ? null : (slotToId.get(u.manager_slot) ?? null),
  }));

  const { error: upsertErr } = await admin
    .from("profiles")
    .upsert(profileRows, { onConflict: "id" });

  if (upsertErr) {
    process.stderr.write(`profiles upsert failed: ${upsertErr.message}\n`);
    return { exitCode: 5 };
  }

  process.stdout.write(summaryTable(users) + "\n");
  // Slice 4 Finding 3: only print the shared demo password when stdout is an
  // interactive TTY. A non-interactive run (CI, redirected/piped output) skips
  // the credential banner so it can't land in a build log. The password is a
  // non-prod constant — this is defense-in-depth. See
  // docs/security/04-secrets-handling.md and DECISIONS.md (2026-05-25 — slice 4).
  if (process.stdout.isTTY) {
    process.stdout.write(passwordBanner() + "\n");
  }
  return { exitCode: 0 };
}

async function listDemoUsers(
  admin: ReturnType<typeof createAdminClient>,
): Promise<Array<{ id: string; email: string }>> {
  const out: Array<{ id: string; email: string }> = [];
  let page = 1;
  while (true) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage: 200 });
    if (error) throw error;
    if (data.users.length === 0) break;
    for (const u of data.users) {
      if (u.email && u.email.toLowerCase().endsWith(DEMO_EMAIL_SUFFIX)) {
        out.push({ id: u.id, email: u.email });
      }
    }
    if (data.users.length < 200) break;
    page += 1;
  }
  return out;
}

function handleConfigError(err: unknown): ExitResult {
  if (!(err instanceof ConfigError)) {
    process.stderr.write(`Unexpected error during config load: ${(err as Error).message ?? String(err)}\n`);
    return { exitCode: 5 };
  }
  process.stderr.write(err.message + "\n");
  switch (err.code) {
    case "remote-without-project-ref":
      return { exitCode: 1 };
    case "missing-env":
      return { exitCode: 2 };
    case "production-environment":
      return { exitCode: 3 };
    case "unknown-flag":
      return { exitCode: 6 };
  }
}

// Suppress these inline so DemoUser stays exported via the lib module
// without an unused-import lint complaint here.
export type { DemoUser };

// CLI bootstrap. We compare the resolved file path so symlinked or
// reparse-point invocations on Windows still match. The integration
// test (T020) imports main() directly and skips this block.
const isCli = (() => {
  if (!argv[1]) return false;
  try {
    return realpathSync(fileURLToPath(import.meta.url)) === realpathSync(argv[1]);
  } catch {
    return false;
  }
})();

if (isCli) {
  main()
    .then(({ exitCode }) => {
      process.exit(exitCode);
    })
    .catch((err: unknown) => {
      process.stderr.write(`Fatal: ${(err as Error).message ?? String(err)}\n`);
      process.exit(5);
    });
}
