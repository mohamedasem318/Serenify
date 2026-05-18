import { config as loadDotenv } from "dotenv";
import { existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

export type Target =
  | { readonly kind: "local"; readonly url: string }
  | { readonly kind: "remote"; readonly url: string; readonly projectRef: string };

export type SeedConfig = {
  readonly reset: boolean;
  readonly target: Target;
};

/**
 * Errors with stable codes so the entrypoint can map them to the
 * documented exit codes from contracts/cli.md without string-matching
 * messages.
 */
export class ConfigError extends Error {
  readonly code:
    | "remote-without-project-ref"
    | "missing-env"
    | "unknown-flag"
    | "production-environment";

  constructor(
    code: ConfigError["code"],
    message: string,
  ) {
    super(message);
    this.code = code;
    this.name = "ConfigError";
  }
}

const ENV_FILE_RELATIVE = "../../apps/web/.env.local";

function loadEnvLocal(): void {
  // env.ts lives at scripts/lib/env.ts; .env.local lives at
  // apps/web/.env.local. Resolve relative to this source file so the
  // path is portable regardless of cwd at invocation time.
  const here = dirname(fileURLToPath(import.meta.url));
  const envPath = resolve(here, ENV_FILE_RELATIVE);
  if (!existsSync(envPath)) {
    // dotenv would silently no-op on a missing file; surface it instead.
    // The caller still validates individual variables below, so this
    // throw is just a clearer error for the most common case.
    throw new ConfigError(
      "missing-env",
      `Cannot find ${envPath}. Follow specs/001-auth-and-roles/quickstart.md to set up local Supabase.`,
    );
  }
  loadDotenv({ path: envPath });
}

/**
 * Parses --reset and --remote from argv. Also recovers the same flags
 * from npm_config_* environment variables to work around the
 * Windows-PowerShell npm wrapper:
 *
 *   `npm run seed -- --remote` on PowerShell strips post-`--` flags
 *   from argv before spawning the script. npm DOES still forward them
 *   as `npm_config_remote=true` env vars (this is documented npm
 *   behavior — every CLI flag becomes an env var for the lifecycle
 *   script). The env-var fallback below recovers them.
 *
 * Exported for the regression test in scripts/__tests__/env.test.ts.
 *
 * `env` defaults to process.env so callers don't need to thread it;
 * tests inject a fresh record to exercise the npm_config_* path.
 */
export function parseArgs(
  argv: readonly string[],
  env: NodeJS.ProcessEnv = process.env,
): { reset: boolean; remote: boolean } {
  let reset = false;
  let remote = false;
  for (const token of argv) {
    if (token === "--reset") {
      reset = true;
    } else if (token === "--remote") {
      remote = true;
    } else {
      throw new ConfigError(
        "unknown-flag",
        `Unrecognized argument: ${token}. Supported: --reset, --remote.`,
      );
    }
  }
  // npm_config_* fallback. npm sets these for any CLI flag the user
  // passed (whether or not the `--` separator made it through). On
  // PowerShell this is the ONLY surviving signal that the user typed
  // `--remote`; on bash this is redundant with argv. Either way it's
  // safe to OR-merge because npm scopes these env vars to the
  // lifecycle script's process — a stale shell export of
  // `npm_config_remote` from outside `npm run` would only matter if
  // a user deliberately set it, and the LOCAL/REMOTE banner makes
  // any miswire visible on the next line.
  if (env.npm_config_reset === "true") reset = true;
  if (env.npm_config_remote === "true") remote = true;
  return { reset, remote };
}

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value || value.trim() === "") {
    throw new ConfigError("missing-env", `Required env var ${name} is missing or empty in apps/web/.env.local.`);
  }
  return value;
}

export function loadConfig(argv: readonly string[]): SeedConfig {
  if (process.env.NODE_ENV === "production") {
    throw new ConfigError(
      "production-environment",
      "NODE_ENV is 'production'. The seed script is a fixture tool and must never run in production.",
    );
  }

  const { reset, remote } = parseArgs(argv, process.env);

  loadEnvLocal();

  // SUPABASE_SERVICE_ROLE_KEY is required for every code path (admin
  // API calls bypass RLS). NEXT_PUBLIC_SUPABASE_URL is required for
  // the LOCAL path; remote rebuilds the URL from projectRef.
  requireEnv("SUPABASE_SERVICE_ROLE_KEY");

  if (remote) {
    const projectRef = process.env.SUPABASE_PROJECT_REF;
    if (!projectRef || projectRef.trim() === "") {
      throw new ConfigError(
        "remote-without-project-ref",
        "--remote requires SUPABASE_PROJECT_REF to be set. Refusing to run.",
      );
    }
    return {
      reset,
      target: {
        kind: "remote",
        url: `https://${projectRef}.supabase.co`,
        projectRef,
      },
    };
  }

  // Without --remote, SUPABASE_PROJECT_REF is silently ignored (FR-011):
  // a stale shell export must not become a destructive surprise.
  const url = requireEnv("NEXT_PUBLIC_SUPABASE_URL");
  return { reset, target: { kind: "local", url } };
}
