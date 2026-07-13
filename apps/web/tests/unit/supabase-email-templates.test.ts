import { execFileSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

import { describe, expect, it } from "vitest";

const repoRoot = resolve(__dirname, "../../../..");
const configPath = resolve(repoRoot, "supabase/config.toml");

const templates = [
  {
    type: "confirmation",
    path: resolve(repoRoot, "supabase/templates/confirmation.html"),
    subject: "Confirm your Serenify email",
  },
  {
    type: "recovery",
    path: resolve(repoRoot, "supabase/templates/recovery.html"),
    subject: "Reset your Serenify password",
  },
] as const;

describe("Supabase auth email templates", () => {
  it("wires confirmation and recovery templates in Supabase config", () => {
    const config = readFileSync(configPath, "utf8");

    for (const template of templates) {
      expect(config).toContain(`[auth.email.template.${template.type}]`);
      expect(config).toContain(`subject = "${template.subject}"`);
      expect(config).toContain(
        `content_path = "./supabase/templates/${template.type}.html"`,
      );
    }
  });

  it.each(templates)(
    "$type template keeps link and OTP fallback while avoiding risky email content",
    ({ path }) => {
      const html = readFileSync(path, "utf8");

      expect(html).toContain("Serenify");
      expect(html).toContain("{{ .ConfirmationURL }}");
      expect(html).toContain("{{ .Token }}");
      expect(html).not.toMatch(/<img\b/i);
      expect(html).not.toContain("{{ .Data");
      expect(html).not.toMatch(/#(?:C98637|894A4E)\b/i);
    },
  );

  it.each(templates)(
    "$type template follows the Graphite typography and contrast contract",
    ({ path }) => {
      const html = readFileSync(path, "utf8");

      expect(html).toContain("fonts.googleapis.com/css2?family=Inter");
      expect(html).toContain("family=Outfit");
      expect(html).toContain('class="wordmark"');
      expect(html).toContain('class="headline"');
      expect(html).toMatch(/>serenify<\/[^>]+>/);
      expect(html).toContain(
        "font:400 24px/1 Outfit,Inter,Arial,sans-serif;letter-spacing:0;",
      );
      expect(html).toMatch(
        /<td align="center" style="padding:20px 28px 16px;text-align:center;">\s*<a class="button"/,
      );
      expect(html).toContain("border-top:4px solid #3E7A63");
      expect(html).toMatch(
        /\.wordmark\s*\{\s*color:\s*#E2E5E8\s*!important;/,
      );
      expect(html).toMatch(
        /\.headline\s*\{\s*color:\s*#E2E5E8\s*!important;/,
      );
      expect(html).toContain("max-width:520px");
    },
  );

  it("generates browser previews with representative values", () => {
    const outputDir = mkdtempSync(join(tmpdir(), "serenify-email-preview-"));
    const script = resolve(repoRoot, "scripts/preview-auth-emails.mjs");

    try {
      execFileSync(process.execPath, [script, outputDir]);

      for (const template of templates) {
        const preview = readFileSync(
          resolve(outputDir, `${template.type}.html`),
          "utf8",
        );
        expect(preview).toContain("482731");
        expect(preview).toContain(
          "https://serenify.tech/auth/callback?token=preview",
        );
        expect(preview).not.toContain("{{ .ConfirmationURL }}");
        expect(preview).not.toContain("{{ .Token }}");
      }
    } finally {
      rmSync(outputDir, { recursive: true, force: true });
    }
  });
});
