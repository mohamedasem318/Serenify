import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

/**
 * T016 — the static half of SC-013 (`research.md` §12.2).
 *
 * A user who declines the camera-and-inference consent can still complete the weekly
 * work-environment check-in. This test proves the strongest half of that: the two are
 * structurally unable to interact, because nothing under the questionnaire feature can
 * reach the consent modules at all. Not "does not today" — cannot, by import graph.
 *
 * The walk is TRANSITIVE. A direct-imports-only check would pass while a questionnaire
 * module imported a helper that imported the evaluator, which is the same coupling with
 * one more hop. The closure is what makes the claim structural.
 *
 * (Existing names are quoted as they are: the `weekly_checkin_cadence` table and
 * `lib/questionnaire/weekly-cadence.ts` predate this feature and are referenced verbatim.
 * This feature's own prose says "weekly work-environment check-in".)
 */

const ROOT = process.cwd(); // apps/web

/** The two trees that must not be able to reach consent state. */
const QUESTIONNAIRE_ROOTS = ["lib/questionnaire", "components/questionnaire"];
/** The tree they must not reach. */
const CONSENT_ROOT = "lib/consent";

const SOURCE_EXTENSIONS = [".ts", ".tsx"];

function sourceFilesUnder(dir: string): string[] {
  const absolute = path.join(ROOT, dir);
  if (!existsSync(absolute)) return [];
  const out: string[] = [];
  for (const entry of readdirSync(absolute)) {
    const full = path.join(absolute, entry);
    if (statSync(full).isDirectory()) {
      out.push(...sourceFilesUnder(path.join(dir, entry)));
    } else if (SOURCE_EXTENSIONS.includes(path.extname(entry))) {
      out.push(full);
    }
  }
  return out;
}

/** Every module specifier in `source` — static imports, re-exports, and dynamic import(). */
function specifiersIn(source: string): string[] {
  const patterns = [
    /(?:^|\n)\s*import\s+(?:[\s\S]*?)\sfrom\s*["']([^"']+)["']/g,
    /(?:^|\n)\s*import\s*["']([^"']+)["']/g,
    /(?:^|\n)\s*export\s+(?:[\s\S]*?)\sfrom\s*["']([^"']+)["']/g,
    /\bimport\s*\(\s*["']([^"']+)["']\s*\)/g,
    /\brequire\s*\(\s*["']([^"']+)["']\s*\)/g,
  ];
  const found = new Set<string>();
  for (const pattern of patterns) {
    for (const match of source.matchAll(pattern)) {
      if (match[1]) found.add(match[1]);
    }
  }
  return [...found];
}

/** An in-repo specifier resolved to a file, or null for a package or a missing target. */
function resolveSpecifier(fromFile: string, specifier: string): string | null {
  let base: string;
  if (specifier.startsWith("@/")) {
    base = path.join(ROOT, specifier.slice(2));
  } else if (specifier.startsWith(".")) {
    base = path.resolve(path.dirname(fromFile), specifier);
  } else {
    return null; // a package — outside the repo's own graph
  }

  for (const candidate of [
    base,
    ...SOURCE_EXTENSIONS.map((ext) => base + ext),
    ...SOURCE_EXTENSIONS.map((ext) => path.join(base, `index${ext}`)),
  ]) {
    if (existsSync(candidate) && statSync(candidate).isFile()) return candidate;
  }
  return null;
}

const relative = (file: string) => path.relative(ROOT, file).split(path.sep).join("/");
const isConsentModule = (file: string) => relative(file).startsWith(`${CONSENT_ROOT}/`);

/** Every in-repo module reachable from `entries`, with the path that reached each one. */
function reachableFrom(entries: readonly string[]): Map<string, string[]> {
  const seen = new Map<string, string[]>();
  const queue: { file: string; trail: string[] }[] = entries.map((file) => ({
    file,
    trail: [relative(file)],
  }));

  while (queue.length > 0) {
    const next = queue.shift();
    if (!next) break;
    if (seen.has(next.file)) continue;
    seen.set(next.file, next.trail);

    for (const specifier of specifiersIn(readFileSync(next.file, "utf8"))) {
      const resolved = resolveSpecifier(next.file, specifier);
      if (resolved && !seen.has(resolved)) {
        queue.push({ file: resolved, trail: [...next.trail, relative(resolved)] });
      }
    }
  }
  return seen;
}

// ── The trees exist, so a green result means "checked", not "found nothing" ──

describe("the test is looking at something", () => {
  it.each(QUESTIONNAIRE_ROOTS)("%s contains modules to check", (dir) => {
    expect(sourceFilesUnder(dir).length, `${dir} has no source files`).toBeGreaterThan(0);
  });

  it("lib/consent contains the modules that must stay out of reach", () => {
    const consentFiles = sourceFilesUnder(CONSENT_ROOT).map(relative);
    expect(consentFiles).toContain("lib/consent/registry.ts");
    expect(consentFiles).toContain("lib/consent/evaluate.ts");
  });

  it("recognises a consent module when it sees one", () => {
    // Guards the matcher itself: a green suite must not be green because
    // isConsentModule never returns true for anything.
    expect(isConsentModule(path.join(ROOT, "lib/consent/evaluate.ts"))).toBe(true);
    expect(isConsentModule(path.join(ROOT, "lib/questionnaire/weekly-cadence.ts"))).toBe(false);
  });
});

// ── The invariant ────────────────────────────────────────────────────────────

describe("the questionnaire feature cannot reach consent state", () => {
  it.each(QUESTIONNAIRE_ROOTS)("no module under %s imports lib/consent directly", (dir) => {
    for (const file of sourceFilesUnder(dir)) {
      for (const specifier of specifiersIn(readFileSync(file, "utf8"))) {
        const resolved = resolveSpecifier(file, specifier);
        expect(
          resolved !== null && isConsentModule(resolved),
          `${relative(file)} imports ${specifier}`,
        ).toBe(false);
      }
    }
  });

  it.each(QUESTIONNAIRE_ROOTS)("no module under %s reaches lib/consent transitively", (dir) => {
    const reached = reachableFrom(sourceFilesUnder(dir));
    const offenders = [...reached.entries()]
      .filter(([file]) => isConsentModule(file))
      .map(([, trail]) => trail.join(" → "));
    expect(
      offenders,
      `the weekly work-environment check-in must not be able to reach consent state:\n${offenders.join("\n")}`,
    ).toEqual([]);
  });

  it("names no consent concept anywhere in the questionnaire trees", () => {
    // Belt and braces: a copy-pasted evaluator would satisfy the import graph while
    // reintroducing exactly the coupling SC-013 forbids.
    const markers = ["CONSENT_REGISTRY", "satisfiesConsent", "bindingRevision", "currentRevision"];
    for (const dir of QUESTIONNAIRE_ROOTS) {
      for (const file of sourceFilesUnder(dir)) {
        const source = readFileSync(file, "utf8");
        for (const marker of markers) {
          expect(source, `${relative(file)} references ${marker}`).not.toContain(marker);
        }
      }
    }
  });
});

// ── The walker itself is proven to work ─────────────────────────────────────

describe("the transitive walker actually follows edges", () => {
  it("reaches a module several hops away", () => {
    // The consent modules form a real two-node graph: evaluate.ts imports registry.ts.
    // If the walker could not follow that edge, every assertion above would be vacuous.
    const reached = reachableFrom([path.join(ROOT, "lib/consent/evaluate.ts")]);
    expect([...reached.keys()].map(relative)).toContain("lib/consent/registry.ts");
  });

  it("extracts specifiers from every import form it must handle", () => {
    const sample = [
      `import { a } from "@/lib/consent/evaluate";`,
      `import "@/lib/consent/registry";`,
      `export { b } from "./relative-module";`,
      `const c = await import("@/lib/consent/registry");`,
      `import type { D } from "@/lib/consent/registry";`,
    ].join("\n");
    expect(specifiersIn(sample).sort()).toEqual(
      ["./relative-module", "@/lib/consent/evaluate", "@/lib/consent/registry"].sort(),
    );
  });
});
