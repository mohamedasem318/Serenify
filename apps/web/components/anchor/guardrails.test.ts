import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * T030 — static colour & voice guardrails over the 005 calibration/error surfaces
 * (FR-046/047, SC-009/010). A pure source scan (no rendering), so it catches a
 * forbidden token in ANY conditional branch, not just whatever a given render
 * happened to show — including the orchestrator-owned between-surface copy that is
 * awkward to render in isolation.
 *
 * Comments are stripped first, so a docstring that legitimately *names* a forbidden
 * token to explain the rule ("never amber", "noticed not detected", "no crimson")
 * does not trip the scan — only real code and user-facing copy are asserted.
 *
 * `countdown.tsx` is deliberately NOT in scope: it is dead 004 legacy (imported only
 * by its own test, never by the 005 flow, which renders `get-ready-countdown` +
 * `recording-timer`), so it is not a live calibration surface.
 */

const SURFACES = [
  "anchor-recorder.tsx",
  "backend-down-modal.tsx",
  "baseline-section.tsx",
  "breathing-guide.tsx",
  "calibration-banner.tsx",
  "camera-access-state.tsx",
  "device-picker.tsx",
  "failure-state.tsx",
  "framing-overlay.tsx",
  "get-ready-countdown.tsx",
  "green-room.tsx",
  "intro.tsx",
  "recording-stage.tsx",
  "recording-timer.tsx",
  "stop-confirm.tsx",
  "success-state.tsx",
] as const;

// FR-047 / SC-010 alarmist-language blocklist. Whole-word/phrase, case-insensitive
// (amber/crimson are handled separately as colour tokens).
const BLOCKLIST: ReadonlyArray<RegExp> = [
  /\bdetected\b/i,
  /\brequired\b/i,
  /\bmandatory\b/i,
  /\balert\b/i,
  /\babnormal\b/i,
  /\belevated\s+risk\b/i,
];

function readSurface(name: string): string {
  return readFileSync(resolve(process.cwd(), "components/anchor", name), "utf8");
}

/** Strip block (incl. {/* … *​/} JSX) and line comments, preserving URLs (`://`). */
function stripComments(src: string): string {
  return src
    .replace(/\/\*[\s\S]*?\*\//g, " ")
    .replace(/(^|[^:])\/\/.*$/gm, "$1");
}

/**
 * The user-facing copy: quoted string literals + JSX text nodes. classNames live in
 * strings too, but the 005 surfaces use no Tailwind `!important` and no `${!…}`
 * (audited), so a "!" found here is always copy — never a JS `!`/`!==` operator,
 * which lives outside any string/JSX-text.
 */
function copyOf(code: string): string {
  const strings = code.match(/(["'`])(?:\\.|(?!\1)[\s\S])*?\1/g) ?? [];
  const jsxText = code.match(/>[^<>{}]+</g) ?? [];
  return [...strings, ...jsxText].join("\n");
}

describe("005 surfaces — colour discipline: no amber, no crimson (FR-046, SC-009)", () => {
  it.each(SURFACES)("%s uses no amber or crimson colour token", (name) => {
    const code = stripComments(readSurface(name));
    // post-strip, these words only ever appear as Tailwind colour utilities.
    expect(code, `${name} must not use the amber token`).not.toMatch(/\bamber\b/);
    expect(code, `${name} must not use the crimson token`).not.toMatch(/\bcrimson\b/);
  });
});

describe("005 surfaces — calm voice: no exclamation marks (FR-047, SC-010)", () => {
  it.each(SURFACES)("%s copy has no exclamation marks", (name) => {
    const copy = copyOf(stripComments(readSurface(name)));
    expect(copy, `${name} copy must not use exclamation marks`).not.toContain("!");
  });
});

describe("005 surfaces — calm voice: no alarmist blocklist terms (FR-047, SC-010)", () => {
  it.each(SURFACES)("%s contains no blocklist term", (name) => {
    const code = stripComments(readSurface(name));
    for (const term of BLOCKLIST) {
      expect(code, `${name} must not contain ${term}`).not.toMatch(term);
    }
  });
});

// feature 006 — the new face-absence chip specifically obeys the calm-voice + foggy
// rules (FR-012, Principle V). The file-wide scans above already cover it; this
// pins the new chip's copy line explicitly so a future edit to it can't drift.
describe("006 face-absence chip — calm voice + foggy (FR-012)", () => {
  const FACE_ABSENCE = /couldn.t see your face for enough/i;

  it("isolates the new chip's copy line and asserts no '!', no blocklist term, no colour token", () => {
    const code = stripComments(readSurface("failure-state.tsx"));
    const line = code.split("\n").find((l) => FACE_ABSENCE.test(l)) ?? "";
    expect(line, "the insufficient-face chip line must exist after comment-strip").toMatch(
      FACE_ABSENCE,
    );
    expect(line, "no exclamation mark").not.toContain("!");
    expect(line, "no amber token").not.toMatch(/\bamber\b/);
    expect(line, "no crimson token").not.toMatch(/\bcrimson\b/);
    for (const term of BLOCKLIST) {
      expect(line, `no blocklist term ${term}`).not.toMatch(term);
    }
  });
});

// Proves the scan is not vacuously green: the matchers fire on known-bad input, and
// correctly exempt comments and JS `!` operators (the two false-positive sources).
describe("guardrail self-check — the scan detects real violations", () => {
  it("catches an amber/crimson token in code, but exempts it in a comment", () => {
    expect(stripComments(`const c = "border-amber/50 bg-crimson/10";`)).toMatch(/\bamber\b/);
    expect(stripComments(`/* never amber */ // no crimson here`)).not.toMatch(/\b(amber|crimson)\b/);
  });

  it("catches an exclamation in copy, but not a JS `!` / `!==` operator", () => {
    expect(copyOf(`<p>You did it!</p>`)).toContain("!");
    expect(copyOf(`const ok = !done && a !== b; return ok;`)).not.toContain("!");
  });

  it("catches a blocklist term used as copy", () => {
    expect(stripComments(`<p>stress was detected</p>`)).toMatch(/\bdetected\b/i);
    expect(stripComments(`<p>camera access is required</p>`)).toMatch(/\brequired\b/i);
  });
});
