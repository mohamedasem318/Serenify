import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

/**
 * T064 — non-regression: a confirmatory outcome (or any questionnaire surface) cannot suppress,
 * annotate, or otherwise change the Today card / trend rendering. This is guaranteed
 * STRUCTURALLY: the questionnaire feature and the Today/trend feature share no import edge in
 * EITHER direction, and the questionnaire client never touches `window_readings`. The DB layer
 * (test_questionnaire_privacy.py T013) separately proves the migration never mutates readings.
 */

const WEB_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../../..");

function read(rel: string): string {
  return readFileSync(path.join(WEB_ROOT, rel), "utf8");
}

function filesIn(rel: string): string[] {
  return readdirSync(path.join(WEB_ROOT, rel))
    .filter((f) => f.endsWith(".ts") || f.endsWith(".tsx"))
    .filter((f) => !f.endsWith(".test.ts") && !f.endsWith(".test.tsx"))
    .map((f) => path.join(rel, f));
}

const QUESTIONNAIRE_FILES = [
  ...filesIn("components/questionnaire"),
  ...filesIn("lib/questionnaire"),
  "lib/api/questionnaire-client.ts",
];

const TODAY_TREND_FILES = [
  "components/home/todays-checkin-card.tsx",
  "components/home/today-view.tsx",
  "components/home/today-trend-plot.tsx",
  "components/home/today-mini-trend.tsx",
  "components/home/today-timeline.tsx",
  "components/monitor/session-trend.tsx",
];

const TODAY_TREND_TOKENS = [
  "todays-checkin-card",
  "today-view",
  "today-trend-plot",
  "today-mini-trend",
  "today-timeline",
  "session-trend",
  "window_readings",
];

describe("questionnaire never reaches into Today/trend rendering", () => {
  it("no questionnaire file imports a Today/trend component or window_readings", () => {
    for (const file of QUESTIONNAIRE_FILES) {
      const src = read(file).replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");
      for (const token of TODAY_TREND_TOKENS) {
        expect(src.includes(token), `${file} must not reference ${token}`).toBe(false);
      }
    }
  });

  it("no Today/trend component imports a questionnaire module", () => {
    for (const file of TODAY_TREND_FILES) {
      const src = read(file).replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");
      expect(src.includes("questionnaire"), `${file} must not import a questionnaire module`).toBe(
        false,
      );
    }
  });

  it("the dashboard still renders the Today card unchanged and mounts the coordinator additively", () => {
    const page = read("app/(authed)/app/page.tsx");
    // The Today card keeps its exact props (additive coordinator, no rendering change).
    expect(page).toMatch(/<TodaysCheckinCard userId=\{user\.id\} hasAnchor=\{hasAnchor \?\? undefined\} \/>/);
    expect(page).toContain("<QuestionnaireCoordinator userId={user.id} />");
  });
});
