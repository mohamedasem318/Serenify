import { readFileSync } from "node:fs";
import { resolve } from "node:path";

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
});
