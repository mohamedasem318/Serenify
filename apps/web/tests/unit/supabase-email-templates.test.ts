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

  /**
   * Hand-sync exception 2 (constitution Principle V, Wordmark). These
   * templates are inline-styled HTML and cannot consume
   * components/brand/wordmark.tsx, so the two-colour split is typed by
   * hand and kept honest by this test plus the cross-boundary contract
   * test at tests/unit/brand/wordmark-sync.test.ts, which reads the live
   * token values out of app/globals.css.
   */
  it.each(templates)(
    "$type template splits the wordmark and flips both halves in both dark blocks",
    ({ path }) => {
      const html = readFileSync(path, "utf8");

      // Light mode: each half carries its own LIGHT token value inline.
      expect(html).toContain(
        '<span class="wordmark-seren" style="color:#1C2023;">seren</span>' +
          '<span class="wordmark-ify" style="color:#346A56;">ify</span>',
      );

      // A single-node wordmark would mean the split was reverted.
      // (`serenify.tech` in the footer does not match — `.tech` follows.)
      expect(html).not.toMatch(/>serenify</);

      // Both dark blocks must reach BOTH halves. Once a half carries its
      // own inline colour, a rule that only recolours `.wordmark` no
      // longer reaches it, so each half needs its own !important rule —
      // an author !important declaration outranks a normal inline style.
      // Slice the two blocks apart so a rule in one cannot satisfy the
      // assertion for the other.
      const prefersDarkStart = html.indexOf(
        "@media (prefers-color-scheme: dark)",
      );
      const ogscStart = html.indexOf("[data-ogsc]");
      expect(prefersDarkStart).toBeGreaterThan(-1);
      expect(ogscStart).toBeGreaterThan(prefersDarkStart);

      const prefersDarkBlock = html.slice(prefersDarkStart, ogscStart);
      const ogscBlock = html.slice(ogscStart);

      expect(prefersDarkBlock).toMatch(
        /\.wordmark-seren\s*\{\s*color:\s*#E2E5E8\s*!important;/,
      );
      expect(prefersDarkBlock).toMatch(
        /\.wordmark-ify\s*\{\s*color:\s*#63B292\s*!important;/,
      );
      expect(ogscBlock).toMatch(
        /\[data-ogsc\]\s*\.wordmark-seren\s*\{\s*color:\s*#E2E5E8\s*!important;/,
      );
      expect(ogscBlock).toMatch(
        /\[data-ogsc\]\s*\.wordmark-ify\s*\{\s*color:\s*#63B292\s*!important;/,
      );
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
