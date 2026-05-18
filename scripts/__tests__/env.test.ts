import { describe, expect, it } from "vitest";

import { parseArgs } from "../lib/env.js";

/**
 * Regression coverage for the npm-on-PowerShell argv-stripping bug.
 *
 * On Windows PowerShell, `npm run seed -- --remote` strips `--remote`
 * from process.argv before spawning the script. npm DOES forward the
 * flag as `npm_config_remote=true` in the script's env. parseArgs
 * must accept either source.
 *
 * Tests below cover the four argv/env combinations from the bug
 * report plus the --reset analogues and unknown-flag rejection.
 */
describe("parseArgs (argv + npm_config_* fallback)", () => {
  it("no flag, no env -> reset=false, remote=false", () => {
    expect(parseArgs([], {})).toEqual({ reset: false, remote: false });
  });

  it("--reset in argv -> reset=true", () => {
    expect(parseArgs(["--reset"], {})).toEqual({ reset: true, remote: false });
  });

  it("--remote in argv -> remote=true", () => {
    expect(parseArgs(["--remote"], {})).toEqual({ reset: false, remote: true });
  });

  it("both flags in argv -> reset=true, remote=true", () => {
    expect(parseArgs(["--reset", "--remote"], {})).toEqual({ reset: true, remote: true });
  });

  it("npm_config_remote=true with empty argv recovers remote (npm-on-PowerShell fix)", () => {
    expect(parseArgs([], { npm_config_remote: "true" })).toEqual({
      reset: false,
      remote: true,
    });
  });

  it("npm_config_reset=true with empty argv recovers reset (npm-on-PowerShell fix)", () => {
    expect(parseArgs([], { npm_config_reset: "true" })).toEqual({
      reset: true,
      remote: false,
    });
  });

  it("npm_config_remote=true AND npm_config_reset=true with empty argv recovers both", () => {
    expect(parseArgs([], { npm_config_remote: "true", npm_config_reset: "true" })).toEqual({
      reset: true,
      remote: true,
    });
  });

  it("argv and npm_config_* agree -> idempotent (no double-counting since boolean OR)", () => {
    expect(parseArgs(["--remote"], { npm_config_remote: "true" })).toEqual({
      reset: false,
      remote: true,
    });
  });

  it("npm_config_remote=anything-but-the-string-'true' is ignored", () => {
    // npm sets exactly the string "true". Defensive check: a different
    // value (e.g. "1", "yes", "false") must not be interpreted as the
    // flag being set, otherwise unrelated env vars could trigger
    // REMOTE writes.
    expect(parseArgs([], { npm_config_remote: "1" })).toEqual({ reset: false, remote: false });
    expect(parseArgs([], { npm_config_remote: "false" })).toEqual({ reset: false, remote: false });
    expect(parseArgs([], { npm_config_remote: "" })).toEqual({ reset: false, remote: false });
  });

  it("unknown flag in argv throws unknown-flag (exit 6)", () => {
    expect(() => parseArgs(["--bogus"], {})).toThrowError(/Unrecognized argument: --bogus/);
  });

  it("unknown flag thrown does NOT depend on the env-var fallback running first", () => {
    // Even if npm_config_remote is "true", an unknown token in argv
    // is still rejected. The fallback is for missing flags, not a
    // license to ignore typos.
    expect(() => parseArgs(["--typo"], { npm_config_remote: "true" })).toThrowError(
      /Unrecognized argument: --typo/,
    );
  });
});
