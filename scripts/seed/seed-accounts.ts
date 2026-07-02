import { existsSync, readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { argv } from "node:process";
import { realpathSync } from "node:fs";

import { config as loadDotenv } from "dotenv";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

/**
 * Idempotent account seed for the REAL team roster (admins, one team lead,
 * their direct reports) — distinct from `scripts/seed-demo.ts`, which
 * creates a synthetic 30-user cohort under @demo.serenify.local and must
 * never carry real teammate names (constitution Principle X).
 *
 * Real emails/names live ONLY in the gitignored `roster.local.json` next to
 * this file — never in committed code. Auth users are created exclusively
 * via `auth.admin.createUser` (never a raw `auth.users` INSERT): that path
 * leaves GoTrue's token columns NULL and crashes `auth.admin.listUsers()`
 * (see specs/012-questionnaire-feedback/smoke-tests.md, Problem 1).
 *
 * Safe to run repeatedly and safe against a deployed/production project:
 * an account whose email already exists is skipped entirely (no update, no
 * duplicate), and nothing is ever deleted.
 */

type Role = "admin" | "team_lead" | "employee";
const ROLES: readonly Role[] = ["admin", "team_lead", "employee"];

type RosterAccount = {
  readonly email: string;
  readonly full_name: string;
  readonly role: Role;
  readonly manager_email?: string;
};

const HERE = dirname(fileURLToPath(import.meta.url));
const ROSTER_PATH = resolve(HERE, "roster.local.json");
const ENV_PATH = resolve(HERE, ".env.local");

class SeedError extends Error {}

function loadRoster(): readonly RosterAccount[] {
  if (!existsSync(ROSTER_PATH)) {
    throw new SeedError(
      `Roster file not found at ${ROSTER_PATH}. Copy scripts/seed/roster.example.json to ` +
        `scripts/seed/roster.local.json and fill in the real accounts.`,
    );
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(readFileSync(ROSTER_PATH, "utf8"));
  } catch (err) {
    throw new SeedError(`Failed to parse ${ROSTER_PATH} as JSON: ${(err as Error).message}`);
  }
  const accounts = (parsed as { accounts?: unknown }).accounts;
  if (!Array.isArray(accounts) || accounts.length === 0) {
    throw new SeedError(`${ROSTER_PATH} must contain a non-empty top-level "accounts" array.`);
  }

  const seenEmails = new Set<string>();
  const result: RosterAccount[] = [];
  for (const [i, raw] of accounts.entries()) {
    const entry = raw as Partial<RosterAccount>;
    const where = `accounts[${i}]`;
    if (typeof entry.email !== "string" || !entry.email.includes("@")) {
      throw new SeedError(`${where}: "email" must be a non-empty email string.`);
    }
    if (typeof entry.full_name !== "string" || entry.full_name.trim() === "") {
      throw new SeedError(`${where}: "full_name" must be a non-empty string.`);
    }
    if (!ROLES.includes(entry.role as Role)) {
      throw new SeedError(`${where}: "role" must be one of ${ROLES.join(", ")}, got ${String(entry.role)}.`);
    }
    const emailLower = entry.email.toLowerCase();
    if (seenEmails.has(emailLower)) {
      throw new SeedError(`${where}: duplicate email "${entry.email}" in the roster.`);
    }
    seenEmails.add(emailLower);

    if (entry.role === "employee") {
      if (typeof entry.manager_email !== "string" || entry.manager_email.trim() === "") {
        throw new SeedError(`${where}: employee "${entry.email}" is missing "manager_email".`);
      }
    }
    result.push({
      email: entry.email,
      full_name: entry.full_name,
      role: entry.role as Role,
      manager_email: entry.manager_email,
    });
  }

  // Every employee's manager_email must resolve within this same roster —
  // an unresolvable manager silently produces a NULL manager_id, which
  // defeats the whole point of seeding the hierarchy (empty weekly
  // aggregate). Fail fast instead.
  for (const a of result) {
    if (a.role === "employee" && !seenEmails.has(a.manager_email!.toLowerCase())) {
      throw new SeedError(
        `${a.email}: manager_email "${a.manager_email}" does not match any account in the roster.`,
      );
    }
  }

  return result;
}

type SeedEnv = { url: string; serviceRoleKey: string };

function loadSeedEnv(): SeedEnv {
  // Silently no-ops if the file is absent — a deployed/CI run may export
  // these two vars directly instead of via a local file.
  loadDotenv({ path: ENV_PATH });

  function requireEnv(name: string): string {
    const value = process.env[name];
    if (!value || value.trim() === "") {
      throw new SeedError(
        `Required env var ${name} is missing or empty. Copy scripts/seed/.env.example to ` +
          `scripts/seed/.env.local and fill it in, or export it directly.`,
      );
    }
    return value;
  }

  return {
    url: requireEnv("SUPABASE_URL"),
    serviceRoleKey: requireEnv("SUPABASE_SERVICE_ROLE_KEY"),
  };
}

function createAdminClient(env: SeedEnv): SupabaseClient {
  return createClient(env.url, env.serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

/** Paginated scan for existing users whose email matches the roster (case-insensitive). */
async function findExistingByEmail(
  admin: SupabaseClient,
  rosterEmailsLower: ReadonlySet<string>,
): Promise<Map<string, string>> {
  const found = new Map<string, string>();
  let page = 1;
  while (true) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage: 200 });
    if (error) throw error;
    if (data.users.length === 0) break;
    for (const u of data.users) {
      const emailLower = u.email?.toLowerCase();
      if (emailLower && rosterEmailsLower.has(emailLower)) {
        found.set(emailLower, u.id);
      }
    }
    if (data.users.length < 200) break;
    page += 1;
  }
  return found;
}

type MainOptions = { readonly skipDeployedLog?: boolean };
type ExitResult = { readonly exitCode: number };

export async function main(opts: MainOptions = {}): Promise<ExitResult> {
  let roster: readonly RosterAccount[];
  let env: SeedEnv;
  try {
    roster = loadRoster();
    env = loadSeedEnv();
  } catch (err) {
    if (err instanceof SeedError) {
      process.stderr.write(err.message + "\n");
      return { exitCode: 1 };
    }
    throw err;
  }

  if (!opts.skipDeployedLog) {
    process.stdout.write(`Targeting Supabase at ${env.url}\n`);
  }

  const admin = createAdminClient(env);
  const rosterEmailsLower = new Set(roster.map((a) => a.email.toLowerCase()));

  let existingByEmail: Map<string, string>;
  try {
    existingByEmail = await findExistingByEmail(admin, rosterEmailsLower);
  } catch (err) {
    process.stderr.write(`Failed to list existing users: ${(err as Error).message}\n`);
    return { exitCode: 2 };
  }

  const createdEmailsLower = new Set<string>();
  for (const account of roster) {
    const emailLower = account.email.toLowerCase();
    if (existingByEmail.has(emailLower)) {
      process.stdout.write(`Skipping ${account.email} (already exists)\n`);
      continue;
    }
    const { data, error } = await admin.auth.admin.createUser({
      email: account.email,
      // Per-account password = the account's own email (operator decision,
      // not a shared secret) — each person's login is just their address.
      password: account.email,
      email_confirm: true,
      user_metadata: { full_name: account.full_name },
    });
    if (error || !data.user) {
      process.stderr.write(`createUser failed for ${account.email}: ${error?.message ?? "no user returned"}\n`);
      return { exitCode: 3 };
    }
    existingByEmail.set(emailLower, data.user.id);
    createdEmailsLower.add(emailLower);
    process.stdout.write(`Created ${account.email} (${account.role})\n`);
  }

  // Only the accounts created just now get their profile row touched — an
  // account that already existed is never overwritten, even to "fix" its
  // role or manager_id.
  const profileRows = roster
    .filter((a) => createdEmailsLower.has(a.email.toLowerCase()))
    .map((a) => ({
      id: existingByEmail.get(a.email.toLowerCase())!,
      full_name: a.full_name,
      role: a.role,
      manager_id: a.role === "employee" ? (existingByEmail.get(a.manager_email!.toLowerCase()) ?? null) : null,
    }));

  if (profileRows.length > 0) {
    const { error: upsertErr } = await admin.from("profiles").upsert(profileRows, { onConflict: "id" });
    if (upsertErr) {
      process.stderr.write(`profiles upsert failed: ${upsertErr.message}\n`);
      return { exitCode: 4 };
    }
  }

  process.stdout.write(
    `Done. ${createdEmailsLower.size} created, ${roster.length - createdEmailsLower.size} already present.\n`,
  );
  return { exitCode: 0 };
}

// CLI bootstrap. The integration test imports main() directly and skips this.
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
