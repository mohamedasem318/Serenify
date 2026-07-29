#!/usr/bin/env node
/**
 * Push the repo's transactional email templates to the HOSTED Supabase
 * project, then read them back and prove they applied.
 *
 * WHY THIS EXISTS (docs/BACKLOG.md #189). `supabase/config.toml` wires both
 * templates via `content_path`, but that is LOCAL-dev config — nothing ever
 * transmitted `supabase/templates/*.html` to a hosted project. Hosted was the
 * repo template at a stale revision for weeks and the only thing that noticed
 * was a human reading the dashboard. Worse, the test that Principle V leans on
 * to prevent exactly that drift — apps/web/tests/unit/brand/wordmark-sync.test.ts
 * — reads those templates OFF DISK, so it could only ever prove the repo agreed
 * with itself. This script is what makes the repo the source that governs
 * hosted, which is what makes that test mean something.
 *
 * MECHANISM. A single PATCH to the Management API's auth config carrying ONLY
 * the four template fields. Because it is a PATCH and the request body has no
 * required fields, `site_url` and the redirect allow-list are never touched —
 * that narrowness is the whole reason this was chosen over `supabase config
 * push`, which pushes the entire auth block.
 *
 * The four field names are not guessed. They are the ones declared on
 * `UpdateAuthConfigBody` in the published OpenAPI spec (api.supabase.com/api/v1-json),
 * and all four are readable back on the GET response, which is what makes the
 * verification step below possible at all.
 *
 * LINE ENDINGS. The repo has no .gitattributes and this file's authors work on
 * Windows with core.autocrlf=true, so the templates are CRLF in a Windows
 * working tree and LF in git. The Linux runner checks out LF, so what lands on
 * hosted is byte-identical to the git blob. Running this from a Windows shell
 * would push the CRLF form instead — harmless for HTML, but it is why CI is the
 * intended caller.
 *
 * Usage:  SUPABASE_ACCESS_TOKEN=… node scripts/sync-hosted-email-templates.mjs
 *         …    --dry-run   builds and prints the payload, sends nothing
 */

import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

// --- what this script is allowed to touch -----------------------------------

/**
 * The one project this script may ever write to. Hardcoded rather than passed
 * in, because the token is account-wide: a ref supplied by the caller is a
 * wrong-project write waiting to happen, and there is no second project this
 * repo deploys to. Pinned by a unit test so an edit here fails CI.
 */
export const PROJECT_REF = "excukdzjudslbqmkysrc";

const API_ORIGIN = "https://api.supabase.com";

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");

export const CONFIG_PATH = resolve(repoRoot, "supabase/config.toml");

/**
 * The two template kinds this repo governs, and the API field each maps to.
 * This list IS the payload's shape — four fields, nothing else. Adding a kind
 * here is the only way to widen what gets sent.
 */
export const TEMPLATE_KINDS = [
  {
    kind: "confirmation",
    subjectField: "mailer_subjects_confirmation",
    contentField: "mailer_templates_confirmation_content",
  },
  {
    kind: "recovery",
    subjectField: "mailer_subjects_recovery",
    contentField: "mailer_templates_recovery_content",
  },
];

/** Every field name the payload is permitted to carry, sorted. */
export const ALLOWED_FIELDS = TEMPLATE_KINDS.flatMap((t) => [
  t.subjectField,
  t.contentField,
]).sort();

/** `content_path` must name a template in the directory this script governs. */
const CONTENT_PATH_SHAPE = /^\.\/supabase\/templates\/[a-z0-9-]+\.html$/;

// --- reading supabase/config.toml -------------------------------------------

/**
 * Pull one scalar out of a TOML table body.
 *
 * Deliberately narrow: a plain double-quoted string with no backslash escapes,
 * anchored to its own line. Anything else — a literal string, a multi-line
 * string, an escape sequence — does not match and throws, rather than being
 * quietly mis-parsed into a subject line that then gets pushed to production.
 * A 20-line reader that refuses what it does not understand beats a TOML
 * dependency in a workflow that holds an account-wide token.
 */
function scalar(body, key, label) {
  const found = body.match(
    new RegExp(`^[ \\t]*${key}[ \\t]*=[ \\t]*"([^"\\\\]*)"[ \\t]*$`, "m"),
  );
  if (!found) {
    throw new Error(
      `supabase/config.toml: ${label} has no plain double-quoted \`${key}\`. ` +
        `This reader accepts only \`${key} = "…"\` with no escapes — widen it ` +
        `deliberately rather than letting an unparsed value reach production.`,
    );
  }
  return found[1];
}

/**
 * Read the `subject` and `content_path` for one template kind out of
 * `supabase/config.toml`.
 *
 * The subjects are NOT duplicated into the workflow or into this file. Copying
 * those strings anywhere would recreate the same class of drift #189 is about,
 * one layer up.
 *
 * @param {string} configText
 * @param {string} kind
 * @returns {{ subject: string, contentPath: string }}
 */
export function parseTemplateTable(configText, kind) {
  const header = `[auth.email.template.${kind}]`;
  const at = configText.indexOf(header);
  if (at === -1) {
    throw new Error(`supabase/config.toml: no ${header} table`);
  }
  if (configText.indexOf(header, at + header.length) !== -1) {
    throw new Error(
      `supabase/config.toml: ${header} is declared more than once — ` +
        `refusing to guess which one is live`,
    );
  }

  // Slice from just past the header to the next table header, so a `subject`
  // belonging to some other table can never be picked up as this one's.
  const rest = configText.slice(at + header.length);
  const nextTable = rest.search(/^[ \t]*\[/m);
  const body = nextTable === -1 ? rest : rest.slice(0, nextTable);

  const contentPath = scalar(body, "content_path", header);
  if (!CONTENT_PATH_SHAPE.test(contentPath)) {
    throw new Error(
      `supabase/config.toml: ${header} content_path is ${JSON.stringify(contentPath)}, ` +
        `which is outside ./supabase/templates/*.html. This script only ever ` +
        `publishes files from that directory.`,
    );
  }

  return { subject: scalar(body, "subject", header), contentPath };
}

function readTemplateFromDisk(contentPath) {
  // contentPath is `./supabase/templates/x.html`, relative to the repo root
  // (where the Supabase CLI is invoked), and already shape-checked above.
  return readFileSync(resolve(repoRoot, contentPath), "utf8");
}

// --- building the payload ----------------------------------------------------

/**
 * Build the exact request body: four fields, nothing else.
 *
 * Every failure mode here — missing table, unparseable subject, missing or
 * empty template file — throws BEFORE the caller has a chance to send
 * anything. That ordering is the point: a half-built payload must never reach
 * the API, because a PATCH carrying one of two templates is a silent,
 * successful, half-applied deploy.
 *
 * `configText` and `readTemplate` are injectable so the unit test can exercise
 * the failure modes without staging broken files on disk.
 *
 * @param {{ configText?: string, readTemplate?: (contentPath: string) => string }} [options]
 * @returns {Record<string, string>} exactly the fields in {@link ALLOWED_FIELDS}
 */
export function buildAuthConfigPayload({
  configText = readFileSync(CONFIG_PATH, "utf8"),
  readTemplate = readTemplateFromDisk,
} = {}) {
  /** @type {Record<string, string>} */
  const payload = {};

  for (const { kind, subjectField, contentField } of TEMPLATE_KINDS) {
    const { subject, contentPath } = parseTemplateTable(configText, kind);

    if (subject.trim() === "") {
      throw new Error(
        `supabase/config.toml: the ${kind} subject is empty — refusing to ` +
          `publish a blank subject line`,
      );
    }

    const content = readTemplate(contentPath);
    if (typeof content !== "string" || content.trim() === "") {
      throw new Error(
        `${contentPath} is empty or unreadable — refusing to publish a blank ` +
          `${kind} template`,
      );
    }

    payload[subjectField] = subject;
    payload[contentField] = content;
  }

  assertPayloadShape(payload);
  return payload;
}

/**
 * The blast-radius assertion. If this ever fails, the payload has grown a field
 * nobody reviewed — and every field in an auth-config PATCH is a live setting.
 */
export function assertPayloadShape(payload) {
  const actual = Object.keys(payload).sort();
  const expected = ALLOWED_FIELDS;
  const same =
    actual.length === expected.length &&
    actual.every((key, i) => key === expected[i]);

  if (!same) {
    throw new Error(
      `payload must carry exactly these ${expected.length} fields:\n` +
        `  expected: ${expected.join(", ")}\n` +
        `  actual:   ${actual.join(", ") || "(none)"}`,
    );
  }
  return payload;
}

// --- the network half --------------------------------------------------------

const digest = (value) =>
  createHash("sha256").update(value, "utf8").digest("hex").slice(0, 12);

function authConfigUrl() {
  return `${API_ORIGIN}/v1/projects/${PROJECT_REF}/config/auth`;
}

async function callApi(method, token, body) {
  const response = await fetch(authConfigUrl(), {
    method,
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });

  const text = await response.text();
  if (!response.ok) {
    // Supabase error bodies echo the request shape, never the bearer token.
    throw new Error(
      `${method} ${authConfigUrl()} → ${response.status} ${response.statusText}\n${text}`,
    );
  }
  return text === "" ? {} : JSON.parse(text);
}

/**
 * Where two strings first differ, with a little context from each side.
 * Template bodies are public repo content, so echoing a window of them into the
 * log is fine — and it is the difference between "it didn't apply" and knowing
 * why.
 */
function describeMismatch(field, expected, actual) {
  if (typeof actual !== "string") {
    return `  ${field}: hosted returned ${actual === undefined ? "no value" : typeof actual}`;
  }

  let at = 0;
  while (at < expected.length && at < actual.length && expected[at] === actual[at]) {
    at += 1;
  }
  const window = (value) => JSON.stringify(value.slice(Math.max(0, at - 40), at + 40));

  return [
    `  ${field}: differs at offset ${at}`,
    `    expected (${expected.length} chars, sha ${digest(expected)}): …${window(expected)}…`,
    `    hosted   (${actual.length} chars, sha ${digest(actual)}): …${window(actual)}…`,
  ].join("\n");
}

/**
 * Read the config back and compare every field that was sent.
 *
 * A silent 200 that did not apply is precisely the failure #189 exists to
 * close, so a successful PATCH is not treated as evidence of anything. The
 * retries cover propagation lag only — the last attempt still fails the run.
 */
async function verifyApplied(token, payload, { attempts = 3, waitMs = 3000 } = {}) {
  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    const hosted = await callApi("GET", token);
    const mismatches = Object.entries(payload)
      .filter(([field, value]) => hosted[field] !== value)
      .map(([field, value]) => describeMismatch(field, value, hosted[field]));

    if (mismatches.length === 0) {
      console.log(
        `Read-back verified on attempt ${attempt}: all ${Object.keys(payload).length} fields match the repo.`,
      );
      return;
    }

    if (attempt === attempts) {
      throw new Error(
        `hosted auth config does not match the repo after ${attempts} read-backs.\n` +
          `The PATCH returned success but the change did not apply:\n${mismatches.join("\n")}`,
      );
    }

    console.log(
      `Attempt ${attempt}/${attempts}: ${mismatches.length} field(s) not applied yet, retrying in ${waitMs}ms…`,
    );
    await new Promise((done) => setTimeout(done, waitMs));
  }
}

async function main() {
  const dryRun = process.argv.includes("--dry-run");

  // Build first, always. Every "fail safely" case — missing template, missing
  // table, unparseable subject — lands here, before a token is even read.
  const payload = buildAuthConfigPayload();

  console.log(`Project: ${PROJECT_REF}`);
  for (const { kind, subjectField, contentField } of TEMPLATE_KINDS) {
    console.log(
      `  ${kind}: subject ${JSON.stringify(payload[subjectField])}; ` +
        `body ${payload[contentField].length} chars, sha256 ${digest(payload[contentField])}`,
    );
  }

  if (dryRun) {
    console.log("--dry-run: nothing sent.");
    return;
  }

  const token = process.env.SUPABASE_ACCESS_TOKEN;
  if (!token) {
    throw new Error(
      "SUPABASE_ACCESS_TOKEN is not set. In CI it comes from the repository " +
        "secret of the same name; locally, export a Management API personal " +
        "access token. Nothing was sent.",
    );
  }

  console.log(`PATCH ${authConfigUrl()} (${ALLOWED_FIELDS.length} fields)…`);
  await callApi("PATCH", token, payload);
  console.log("PATCH accepted. Verifying it actually applied…");

  await verifyApplied(token, payload);
  console.log("Hosted email templates match the repo.");
}

// Only run when invoked directly — importing this from a test must not fire a
// request at production.
if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(process.argv[1]).href
) {
  main().catch((error) => {
    console.error(`\n${error.message}`);
    process.exit(1);
  });
}
