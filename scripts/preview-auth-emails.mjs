import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const scriptDir = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(scriptDir, "..");
const outputDir = resolve(process.argv[2] ?? resolve(repoRoot, "tmp/email-previews"));
const previewUrl = "https://serenify.tech/auth/callback?token=preview";
const previewToken = "482731";

await mkdir(outputDir, { recursive: true });

for (const name of ["confirmation", "recovery"]) {
  const sourcePath = resolve(repoRoot, `supabase/templates/${name}.html`);
  const outputPath = resolve(outputDir, `${name}.html`);
  const source = await readFile(sourcePath, "utf8");
  const preview = source
    .replaceAll("{{ .ConfirmationURL }}", previewUrl)
    .replaceAll("{{ .Token }}", previewToken);

  await writeFile(outputPath, preview, "utf8");
}

console.log(`Auth email previews written to ${outputDir}`);
