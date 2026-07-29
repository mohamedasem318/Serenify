import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

/**
 * Guard: no text-entry control may suppress the user-agent focus ring without
 * declaring a replacement indicator.
 *
 * `outline-none` with nothing after it is WCAG 2.4.7 Focus Visible (Level AA)
 * failing outright — the control is keyboard-reachable and, once focused, looks
 * identical to how it looked before. Two inline rename inputs shipped that way
 * on `main` (chat-shell + recent-chats-card); this test is what would have
 * caught them.
 *
 * A border-colour change alone does NOT count as a replacement. Grey→meadow is a
 * hue shift with a 1.27:1 luminance delta in light mode, which is invisible to a
 * red-green colourblind reader (WCAG 1.4.1 Use of Color) and well under the 3:1
 * that SC 2.4.13 Focus Appearance asks for between the focused and unfocused
 * states. The indicator has to be added geometry — a ring or an outline.
 *
 * SCOPED TO NATIVE TEXT-ENTRY CONTROLS (`input` / `textarea` / `select`) on
 * purpose. Two other `outline-none` sites in the tree are deliberate and correct,
 * and a broader guard would false-positive on both:
 *   • today-trend-plot.tsx — an SVG <rect role="button">; its focus indicator is
 *     state-driven (`focusedId`, :368), not CSS, which a static scan cannot see.
 *   • weekly-check-in-card.tsx — a <p tabIndex={-1}> used as a programmatic focus
 *     target for step announcements. Not keyboard-operable, so 2.4.7 is not in play.
 */

const HERE = path.dirname(fileURLToPath(import.meta.url));
const WEB_ROOT = path.resolve(HERE, "../..");

const SUPPRESSES_OUTLINE = /\boutline-(none|hidden)\b/;
/** A real indicator: added geometry, on either focus variant. */
const HAS_REAL_INDICATOR = /\bfocus(-visible)?:(ring|outline)-(\d|\[)/;

type Finding = { file: string; tag: string; className: string };

/** Pull the className literal out of a JSX open-tag slice. */
function classNameOf(tagSlice: string): string | null {
  // No `s` flag: the char classes already span newlines, and `s` needs an es2018 target.
  const m =
    tagSlice.match(/className=\{?\s*"((?:[^"\\]|\\[\s\S])*)"/) ??
    tagSlice.match(/className=\{?\s*`((?:[^`\\]|\\[\s\S])*)`/);
  const captured = m?.[1];
  return captured === undefined ? null : captured.replace(/\s+/g, " ");
}

/** Slice each `<input | <textarea | <select` open tag out of a source file. */
function textEntryTags(src: string): { tag: string; slice: string }[] {
  const out: { tag: string; slice: string }[] = [];
  const opener = /<(input|textarea|select)\b/g;
  let m: RegExpExecArray | null;
  while ((m = opener.exec(src))) {
    const start = m.index;
    // Walk to the end of the open tag, ignoring `>` that sit inside quotes or braces.
    let depth = 0;
    let quote: string | null = null;
    let end = -1;
    for (let i = start; i < src.length; i++) {
      const c = src[i];
      if (quote) {
        if (c === quote && src[i - 1] !== "\\") quote = null;
        continue;
      }
      if (c === '"' || c === "'" || c === "`") quote = c;
      else if (c === "{") depth++;
      else if (c === "}") depth--;
      else if (c === ">" && depth === 0) {
        end = i;
        break;
      }
    }
    if (end === -1) continue;
    out.push({ tag: m[1] ?? "unknown", slice: src.slice(start, end + 1) });
  }
  return out;
}

describe("focus indicator guard (WCAG 2.4.7 / 2.4.13)", () => {
  const files = ["components", "app"].flatMap((dir) =>
    readdirSync(path.join(WEB_ROOT, dir), {
      recursive: true,
      withFileTypes: true,
    })
      .filter(
        (e) =>
          e.isFile() &&
          e.name.endsWith(".tsx") &&
          !e.parentPath.includes(`${path.sep}.next${path.sep}`) &&
          !e.parentPath.includes("node_modules"),
      )
      .map((e) => path.join(e.parentPath, e.name)),
  );

  it("finds source files to scan", () => {
    expect(files.length).toBeGreaterThan(50);
  });

  it("every input/textarea/select that suppresses the outline declares a ring or outline on focus", () => {
    const findings: Finding[] = [];

    for (const file of files) {
      const src = readFileSync(file, "utf8");
      if (!SUPPRESSES_OUTLINE.test(src)) continue;

      for (const { tag, slice } of textEntryTags(src)) {
        const className = classNameOf(slice);
        if (!className || !SUPPRESSES_OUTLINE.test(className)) continue;
        if (HAS_REAL_INDICATOR.test(className)) continue;
        findings.push({
          file: path.relative(WEB_ROOT, file).replace(/\\/g, "/"),
          tag,
          className,
        });
      }
    }

    const report = findings
      .map((f) => `  <${f.tag}> ${f.file}\n      ${f.className}`)
      .join("\n");

    expect(
      findings,
      findings.length
        ? `${findings.length} text-entry control(s) suppress the focus ring without a ring/outline replacement:\n${report}\n\n` +
            "Add `focus-visible:outline-2 focus-visible:outline-meadow focus-visible:outline-offset-0`. " +
            "A `focus:border-*` colour change alone is not a focus indicator."
        : undefined,
    ).toEqual([]);
  });
});
