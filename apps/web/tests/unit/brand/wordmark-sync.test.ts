import { readdirSync, readFileSync } from "node:fs";
import { join, relative, resolve } from "node:path";

import { describe, expect, it } from "vitest";

/**
 * The wordmark sync contract — specs/013-public-surface-and-legal/
 * contracts/wordmark.md, implementing constitution v1.13.0 Amendment 17
 * (Principle V, Wordmark).
 *
 * Principle V says the wordmark is defined ONCE inside the web app's
 * React tree, and that the two render sites which cannot consume that
 * component — the next/og social card (Satori cannot load Outfit) and
 * the Supabase transactional email templates (inline-styled HTML) —
 * "MUST be kept in sync by hand, and any change to the wordmark MUST
 * update them in the same PR".
 *
 * A comment is not a mechanism. This file is the mechanism: a change on
 * either side of the boundary — the component, a token VALUE, or an
 * exception file — fails CI.
 *
 * The token values are READ from app/globals.css, never hard-coded
 * here. That is the load-bearing choice: if someone deepens
 * `--color-meadow-text` and does not touch the social card, this test
 * fails, which is exactly the drift the hand-sync carve-out invites.
 */

const webRoot = resolve(__dirname, "../../..");
const repoRoot = resolve(__dirname, "../../../../..");

const HEX = /^#[0-9A-F]{6}$/;

/**
 * A *rendered* wordmark: a text node whose entire content is the
 * lowercase wordmark. Deliberately NOT the bare substring `serenify` —
 * the repo legitimately contains ~20 non-wordmark occurrences (storage
 * keys like `serenify.recentChats.collapsed`, the broadcast channel
 * name, mock filenames, `serenify.tech`, and prose such as "waking
 * serenify"), and a substring match would fail against all of them.
 *
 * Case-sensitive lowercase, because the wordmark is always lowercase.
 * `Serenify` capitalised is the product name in a sentence, not the
 * wordmark, and P3's legal copy will contain a great deal of it.
 */
const RENDERED_WORDMARK = />\s*serenify\s*</;

// --- (1) the live token values, read out of app/globals.css ---------

// Comments are stripped first: globals.css:86 documents the dark block
// as a prose example (`:root.dark { --color-muted: ... }`), and a naive
// scan matches that comment instead of the real rule.
const globalsCss = readFileSync(
  resolve(webRoot, "app/globals.css"),
  "utf8",
).replace(/\/\*[\s\S]*?\*\//g, "");

/** Slice out a brace-balanced CSS block by its opening selector. */
function cssBlock(opener: RegExp, label: string): string {
  const found = globalsCss.match(opener);
  if (!found || found.index === undefined) {
    throw new Error(`app/globals.css: no ${label} block found`);
  }
  const open = globalsCss.indexOf("{", found.index);
  let depth = 0;
  for (let i = open; i < globalsCss.length; i += 1) {
    if (globalsCss[i] === "{") depth += 1;
    else if (globalsCss[i] === "}") {
      depth -= 1;
      if (depth === 0) return globalsCss.slice(open + 1, i);
    }
  }
  throw new Error(`app/globals.css: unbalanced ${label} block`);
}

function token(block: string, name: string, label: string): string {
  const value = block.match(new RegExp(`--${name}\\s*:\\s*([^;]+);`))?.[1];
  if (value === undefined) {
    throw new Error(`app/globals.css: --${name} is not declared in ${label}`);
  }
  return value.trim().toUpperCase();
}

// `/@theme\s*\{/` matches the light block at the top and NOT the later
// `@theme inline {`, which holds the shadcn var() indirections.
const lightTokens = cssBlock(/@theme\s*\{/, "@theme (light)");
const darkTokens = cssBlock(/:root\.dark\s*\{/, ":root.dark");

const LIGHT_INK = token(lightTokens, "color-ink", "@theme");
const LIGHT_MEADOW_TEXT = token(lightTokens, "color-meadow-text", "@theme");
const DARK_INK = token(darkTokens, "color-ink", ":root.dark");
const DARK_MEADOW_TEXT = token(darkTokens, "color-meadow-text", ":root.dark");
const DARK_BG = token(darkTokens, "color-bg", ":root.dark");

/**
 * The colour declared on the element that renders `half`. Takes the last
 * hex before the text node, which is the element's own colour whatever
 * the surrounding markup looks like — so this works unchanged across
 * JSX inline styles and HTML `style=` attributes.
 */
function colourRendering(source: string, half: "seren" | "ify"): string {
  const at = source.search(new RegExp(`>\\s*${half}\\s*<`));
  if (at === -1) {
    throw new Error(`no "${half}" text node — the wordmark split is missing`);
  }
  const declared = source
    .slice(Math.max(0, at - 200), at)
    .match(/#[0-9A-Fa-f]{6}/g);
  const own = declared?.at(-1);
  if (own === undefined) {
    throw new Error(`no colour declared on the "${half}" element`);
  }
  return own.toUpperCase();
}

/** A dark-mode rule that recolours one half with `colour`. */
function overrideRule(half: string, colour: string, prefix = ""): RegExp {
  return new RegExp(
    `${prefix}\\.[\\w-]*${half}[\\w-]*\\s*\\{[^}]*color:\\s*${colour}\\s*!important`,
    "i",
  );
}

// --- (4) which files are scanned for a hand-typed wordmark ----------

const BRAND_DIR = resolve(webRoot, "components/brand");
const SCAN_ROOTS = [
  resolve(webRoot, "app"),
  resolve(webRoot, "components"),
  resolve(webRoot, "lib"),
  resolve(webRoot, "hooks"),
  resolve(repoRoot, "supabase/templates"),
];
const RENDERABLE = [".ts", ".tsx", ".js", ".jsx", ".html"];

/**
 * Every file that can render markup, minus `components/brand/` (the one
 * legitimate definition) and minus test files — a test does not render,
 * and several of them quote the wordmark on purpose, including this one.
 */
function renderSites(): string[] {
  const files: string[] = [];
  for (const root of SCAN_ROOTS) {
    for (const entry of readdirSync(root, {
      recursive: true,
      withFileTypes: true,
    })) {
      if (!entry.isFile()) continue;
      if (!RENDERABLE.some((ext) => entry.name.endsWith(ext))) continue;
      if (/\.test\.[jt]sx?$/.test(entry.name)) continue;
      const full = join(entry.parentPath, entry.name);
      if (full.startsWith(BRAND_DIR)) continue;
      files.push(full);
    }
  }
  return files;
}

const emailTemplates = [
  {
    type: "confirmation",
    path: resolve(repoRoot, "supabase/templates/confirmation.html"),
  },
  {
    type: "recovery",
    path: resolve(repoRoot, "supabase/templates/recovery.html"),
  },
] as const;

describe("wordmark sync contract", () => {
  it("reads both wordmark tokens, in both themes, from app/globals.css", () => {
    const live = {
      "light --color-ink": LIGHT_INK,
      "light --color-meadow-text": LIGHT_MEADOW_TEXT,
      "dark --color-ink": DARK_INK,
      "dark --color-meadow-text": DARK_MEADOW_TEXT,
    };
    for (const [label, value] of Object.entries(live)) {
      expect(value, label).toMatch(HEX);
    }

    // Two colours, and they genuinely differ per theme — otherwise the
    // assertions below would pass against a one-colour wordmark.
    expect(LIGHT_INK).not.toBe(LIGHT_MEADOW_TEXT);
    expect(DARK_INK).not.toBe(DARK_MEADOW_TEXT);
    expect(LIGHT_INK).not.toBe(DARK_INK);
    expect(LIGHT_MEADOW_TEXT).not.toBe(DARK_MEADOW_TEXT);
  });

  it("keeps the next/og social card on the DARK token values", () => {
    const card = readFileSync(
      resolve(webRoot, "app/opengraph-image.tsx"),
      "utf8",
    );

    // The card is dark-themed, which is why it takes the dark values.
    expect(card).toContain(`background: "${DARK_BG}"`);

    expect(colourRendering(card, "seren")).toBe(DARK_INK);
    expect(colourRendering(card, "ify")).toBe(DARK_MEADOW_TEXT);
    expect(card).not.toMatch(RENDERED_WORDMARK);
  });

  it.each(emailTemplates)(
    "keeps the $type email template split in light and flipped in both dark blocks",
    ({ path }) => {
      const html = readFileSync(path, "utf8");

      // (a) light mode — each half carries its own light token value.
      expect(colourRendering(html, "seren")).toBe(LIGHT_INK);
      expect(colourRendering(html, "ify")).toBe(LIGHT_MEADOW_TEXT);
      expect(html).not.toMatch(RENDERED_WORDMARK);

      // (b) both dark blocks must reach BOTH halves. Slice them apart so
      // a rule in one cannot satisfy the assertion for the other.
      const prefersDarkAt = html.indexOf("@media (prefers-color-scheme: dark)");
      const ogscAt = html.indexOf("[data-ogsc]");
      expect(prefersDarkAt).toBeGreaterThan(-1);
      expect(ogscAt).toBeGreaterThan(prefersDarkAt);

      const prefersDark = html.slice(prefersDarkAt, ogscAt);
      const ogsc = html.slice(ogscAt);
      const OGSC = "\\[data-ogsc\\]\\s*";

      expect(prefersDark).toMatch(overrideRule("seren", DARK_INK));
      expect(prefersDark).toMatch(overrideRule("ify", DARK_MEADOW_TEXT));
      expect(ogsc).toMatch(overrideRule("seren", DARK_INK, OGSC));
      expect(ogsc).toMatch(overrideRule("ify", DARK_MEADOW_TEXT, OGSC));
    },
  );

  it("keeps the shared component naming both token classes", () => {
    const component = readFileSync(
      resolve(webRoot, "components/brand/wordmark.tsx"),
      "utf8",
    );

    expect(component).toMatch(/text-ink"\s*>\s*seren\s*</);
    expect(component).toMatch(/text-meadow-text"\s*>\s*ify\s*</);
  });

  it("finds no hand-typed wordmark outside components/brand/", () => {
    const offenders = renderSites()
      .filter((file) => RENDERED_WORDMARK.test(readFileSync(file, "utf8")))
      .map((file) => relative(repoRoot, file));

    expect(offenders).toEqual([]);
  });

  it("detects a hand-typed wordmark without flagging the repo's other uses", () => {
    // Proof the detector can actually catch what it is there to catch.
    expect('<span className="font-display text-ink">serenify</span>').toMatch(
      RENDERED_WORDMARK,
    );
    expect('<p class="wordmark">\n  serenify\n</p>').toMatch(RENDERED_WORDMARK);

    // …and proof it does not flag the legitimate occurrences, including
    // the correct two-element split itself.
    for (const legitimate of [
      '<span className="text-ink">seren</span>' +
        '<span className="text-meadow-text">ify</span>',
      '<span class="wordmark-seren" style="color:#1C2023;">seren</span>' +
        '<span class="wordmark-ify" style="color:#346A56;">ify</span>',
      'const KEY = "serenify.questionnaire.last_ended_session";',
      'const COLLAPSE_KEY = "serenify.recentChats.collapsed";',
      'export const OPEN_CHAT_PILL_EVENT = "serenify:open-chat-pill";',
      'const CHANNEL = "serenify-anchor-camera";',
      '<p class="muted">serenify.tech</p>',
      "docs/mockups/serenify-008-monitoring-mock.html",
      "<p>Waking serenify — this takes about a minute.</p>",
      "<p>serenify needs your camera to notice how the day is going.</p>",
      'expect(link).toHaveTextContent("serenify");',
    ]) {
      expect(legitimate, legitimate).not.toMatch(RENDERED_WORDMARK);
    }
  });
});
