import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

import {
  ALLOWED_FIELDS,
  buildAuthConfigPayload,
  CONFIG_PATH,
  parseTemplateTable,
  PROJECT_REF,
  TEMPLATE_KINDS,
} from "../../../../../scripts/sync-hosted-email-templates.mjs";

/**
 * The hosted-template sync contract — docs/BACKLOG.md #189.
 *
 * `apps/web/tests/unit/brand/wordmark-sync.test.ts` reads
 * `supabase/templates/*.html` off disk, so on its own it can only prove the
 * repo agrees with itself. What makes it mean something is that the repo now
 * PUSHES those files to the hosted project. This file is the test for that
 * push: it pins the payload to exactly four fields, pins the project it may
 * target, and pins the triggers the workflow is allowed to have.
 *
 * The real PATCH cannot be tested here — it targets production and the token
 * is not available to CI-of-a-PR by design. So everything testable without the
 * network is tested, and the end-to-end run stays an operator step.
 */

const repoRoot = resolve(__dirname, "../../../../..");
const workflowPath = resolve(
  repoRoot,
  ".github/workflows/sync-email-templates.yml",
);

const workflow = readFileSync(workflowPath, "utf8");
const realConfig = readFileSync(CONFIG_PATH, "utf8");

/** A minimal config.toml with only the two tables the script reads. */
function fakeConfig({
  confirmationSubject = "Fake confirmation subject",
  recoverySubject = "Fake recovery subject",
  confirmationPath = "./supabase/templates/confirmation.html",
  recoveryPath = "./supabase/templates/recovery.html",
  trailer = "\n[auth.sms]\nenable_signup = false\nsubject = \"NOT A TEMPLATE SUBJECT\"\n",
} = {}) {
  return [
    "[auth]",
    'site_url = "http://localhost:3000"',
    "",
    "[auth.email.template.confirmation]",
    `subject = "${confirmationSubject}"`,
    `content_path = "${confirmationPath}"`,
    "",
    "[auth.email.template.recovery]",
    `subject = "${recoverySubject}"`,
    `content_path = "${recoveryPath}"`,
    trailer,
  ].join("\n");
}

const stubTemplates = (contents: Record<string, string>) => (path: string) => {
  const found = contents[path];
  if (found === undefined) throw new Error(`ENOENT: ${path}`);
  return found;
};

const bothTemplates = stubTemplates({
  "./supabase/templates/confirmation.html": "<html>confirmation body</html>",
  "./supabase/templates/recovery.html": "<html>recovery body</html>",
});

describe("hosted email template sync — payload builder", () => {
  it("targets one hardcoded project and cannot be pointed elsewhere", () => {
    // The Management API token is account-wide (Supabase issues no
    // project-scoped tokens), so the ref is the only thing standing between a
    // mistake and someone else's project. It is not a parameter.
    expect(PROJECT_REF).toBe("excukdzjudslbqmkysrc");
  });

  it("builds exactly four fields and nothing else", () => {
    const payload = buildAuthConfigPayload({
      configText: fakeConfig(),
      readTemplate: bothTemplates,
    });

    expect(Object.keys(payload).sort()).toEqual([
      "mailer_subjects_confirmation",
      "mailer_subjects_recovery",
      "mailer_templates_confirmation_content",
      "mailer_templates_recovery_content",
    ]);

    // Every field in an auth-config PATCH is a live setting, so the guard is
    // the list itself, not a spot check.
    expect(ALLOWED_FIELDS).toEqual(Object.keys(payload).sort());
    expect(ALLOWED_FIELDS).toHaveLength(TEMPLATE_KINDS.length * 2);
  });

  it("carries no field that could disturb site_url or the redirect allow-list", () => {
    const payload = buildAuthConfigPayload({
      configText: fakeConfig(),
      readTemplate: bothTemplates,
    });

    for (const field of ["site_url", "uri_allow_list", "jwt_exp"]) {
      expect(Object.keys(payload)).not.toContain(field);
    }
  });

  it("reads the subjects out of config.toml rather than carrying its own", () => {
    const payload = buildAuthConfigPayload({
      configText: fakeConfig({
        confirmationSubject: "Subject that exists only in this test",
        recoverySubject: "Another subject that exists only in this test",
      }),
      readTemplate: bothTemplates,
    });

    expect(payload.mailer_subjects_confirmation).toBe(
      "Subject that exists only in this test",
    );
    expect(payload.mailer_subjects_recovery).toBe(
      "Another subject that exists only in this test",
    );
  });

  it("does not pick up a `subject` belonging to a different table", () => {
    // fakeConfig's trailer plants a decoy `subject` under [auth.sms].
    const payload = buildAuthConfigPayload({
      configText: fakeConfig(),
      readTemplate: bothTemplates,
    });

    expect(payload.mailer_subjects_recovery).toBe("Fake recovery subject");
    expect(payload.mailer_subjects_recovery).not.toContain("NOT A TEMPLATE");
  });

  it("sends the live repo subjects and the live template bytes", () => {
    const payload = buildAuthConfigPayload();

    for (const { kind, subjectField, contentField } of TEMPLATE_KINDS) {
      const { subject, contentPath } = parseTemplateTable(realConfig, kind);

      expect(payload[subjectField]).toBe(subject);
      expect(payload[contentField]).toBe(
        readFileSync(resolve(repoRoot, contentPath), "utf8"),
      );
      // The wordmark split this whole mechanism exists to keep in production.
      expect(payload[contentField]).toContain('class="wordmark-seren"');
      expect(payload[contentField]).toContain('class="wordmark-ify"');
    }
  });
});

describe("hosted email template sync — failing safely", () => {
  it("throws instead of sending a partial payload when a template is missing", () => {
    expect(() =>
      buildAuthConfigPayload({
        configText: fakeConfig(),
        readTemplate: stubTemplates({
          // recovery.html deliberately absent
          "./supabase/templates/confirmation.html": "<html>ok</html>",
        }),
      }),
    ).toThrow(/ENOENT/);
  });

  it("throws on an empty template rather than blanking a live email", () => {
    expect(() =>
      buildAuthConfigPayload({
        configText: fakeConfig(),
        readTemplate: stubTemplates({
          "./supabase/templates/confirmation.html": "   \n  ",
          "./supabase/templates/recovery.html": "<html>ok</html>",
        }),
      }),
    ).toThrow(/empty or unreadable/);
  });

  it("throws on an empty subject rather than publishing a blank subject line", () => {
    expect(() =>
      buildAuthConfigPayload({
        configText: fakeConfig({ recoverySubject: "  " }),
        readTemplate: bothTemplates,
      }),
    ).toThrow(/subject is empty/);
  });

  it("refuses a content_path outside supabase/templates/", () => {
    expect(() =>
      buildAuthConfigPayload({
        configText: fakeConfig({ recoveryPath: "./.env" }),
        readTemplate: bothTemplates,
      }),
    ).toThrow(/outside \.\/supabase\/templates/);
  });

  it("refuses a subject it cannot parse rather than guessing at one", () => {
    // A backslash escape the narrow reader does not implement.
    const configText = fakeConfig().replace(
      'subject = "Fake recovery subject"',
      'subject = "Reset your \\"Serenify\\" password"',
    );

    expect(() => parseTemplateTable(configText, "recovery")).toThrow(
      /no plain double-quoted `subject`/,
    );
  });

  it("refuses a duplicated table rather than guessing which one is live", () => {
    const configText = `${fakeConfig()}\n[auth.email.template.recovery]\nsubject = "Second"\ncontent_path = "./supabase/templates/recovery.html"\n`;

    expect(() => parseTemplateTable(configText, "recovery")).toThrow(
      /declared more than once/,
    );
  });

  it("throws when a table is absent entirely", () => {
    expect(() => parseTemplateTable("[auth]\n", "confirmation")).toThrow(
      /no \[auth\.email\.template\.confirmation\] table/,
    );
  });
});

describe("hosted email template sync — the workflow", () => {
  it("is not reachable from a pull request", () => {
    // `pull_request_target` runs with the base repo's secrets against an
    // untrusted head ref. Asserting the substring is absent covers both it and
    // plain `pull_request`, in triggers and anywhere else in the file.
    expect(workflow).not.toContain("pull_request");
  });

  it("triggers only on a push to main and on manual dispatch", () => {
    expect(workflow).toMatch(/^on:$/m);
    expect(workflow).toMatch(/^ {2}push:$/m);
    expect(workflow).toMatch(/^ {4}branches:\n {6}- main$/m);
    expect(workflow).toMatch(/^ {2}workflow_dispatch:$/m);

    // No other event. `on:` runs to the first top-level key after it.
    const onBlock = workflow.slice(
      workflow.search(/^on:$/m),
      workflow.search(/^permissions:$/m),
    );
    const events = [...onBlock.matchAll(/^ {2}([a-z_]+):$/gm)].map((m) => m[1]);
    expect(events.sort()).toEqual(["push", "workflow_dispatch"]);
  });

  it("watches exactly the two files that are the source of truth", () => {
    expect(workflow).toMatch(
      /^ {4}paths:\n {6}- supabase\/templates\/\*\*\n {6}- supabase\/config\.toml$/m,
    );
  });

  it("uses one action only, pinned to a full commit SHA", () => {
    const uses = [...workflow.matchAll(/^\s*- uses: (\S+)$/gm)].map((m) => m[1]);

    // Every action in a workflow holding a secret can read that secret.
    expect(uses).toHaveLength(1);
    expect(uses[0]).toMatch(/^actions\/checkout@[0-9a-f]{40}$/);
  });

  it("asks for no write permission and does not race itself", () => {
    expect(workflow).toMatch(/^permissions:\n {2}contents: read$/m);
    expect(workflow).toMatch(/^ {2}cancel-in-progress: false$/m);
  });

  it("runs the script that is under test", () => {
    expect(workflow).toContain(
      "run: node scripts/sync-hosted-email-templates.mjs",
    );
    expect(workflow).toContain(
      "SUPABASE_ACCESS_TOKEN: ${{ secrets.SUPABASE_ACCESS_TOKEN }}",
    );
  });

  it("does not restate the subjects or the project ref", () => {
    // Copying either into the workflow would recreate, one layer up, the exact
    // drift #189 is about.
    for (const { kind } of TEMPLATE_KINDS) {
      expect(workflow).not.toContain(parseTemplateTable(realConfig, kind).subject);
    }
    expect(workflow).not.toContain(PROJECT_REF);
  });
});
