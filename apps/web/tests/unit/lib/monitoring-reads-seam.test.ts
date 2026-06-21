import { readFileSync } from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

import {
  RECAP_SESSION_COLUMNS,
  SESSION_TREND_COLUMNS,
  TODAY_TREND_COLUMNS,
} from "@/lib/api/monitoring-reads";

/**
 * Feature 008 / US4 — T050. FR-020 **seam** confirmation: the persisted `window_readings`
 * shape (`band` + `captured_at` + `session_id`, indexed for time queries) is sufficient for
 * feature 009's sustained-tense query, and 008 builds **no** questionnaire trigger / UI /
 * flow. This is a confirmation test — it adds no production behaviour. It also re-audits the
 * SELECT-whitelist posture the US4 readers ship with (data-model D1): no `label` /
 * `stress_probability` ever leaves the DB to a client (FR-015).
 */

const repoRoot = path.resolve(process.cwd(), "../..");
const read = (rel: string) => readFileSync(path.join(repoRoot, rel), "utf8");

const migration = read("supabase/migrations/20260619000000_monitoring_sessions_and_readings.sql");
const dataModel = read("specs/008-stress-inference-service/data-model.md");

describe("FR-020 seam — persisted window_readings shape supports the 009 sustained-tense query", () => {
  it("window_readings persists band + captured_at + session_id (the 009 seam columns)", () => {
    const tableBlock = migration.slice(
      migration.indexOf("CREATE TABLE public.window_readings"),
      migration.indexOf("CREATE INDEX window_readings_session_captured_idx"),
    );
    expect(tableBlock).toMatch(/\bsession_id\b/);
    expect(tableBlock).toMatch(/\bcaptured_at\b/);
    expect(tableBlock).toMatch(/\bband\b/);
  });

  it("indexes the seam for the per-session and per-user time queries 009 runs", () => {
    expect(migration).toMatch(/\(session_id, captured_at\)/);
    expect(migration).toMatch(/\(user_id, captured_at\)/);
  });
});

describe("Out-of-scope — 008 builds NO questionnaire trigger / UI / flow", () => {
  it("the migration introduces no questionnaire object", () => {
    expect(migration.toLowerCase()).not.toContain("questionnaire");
  });

  it("the data model documents the seam-only scope", () => {
    expect(dataModel).toMatch(/builds no questionnaire/i);
  });
});

describe("SELECT-whitelist re-audit (data-model D1; FR-015) — no raw signal to the client", () => {
  it("the US4 reader column lists never name label or stress_probability", () => {
    for (const cols of [SESSION_TREND_COLUMNS, TODAY_TREND_COLUMNS, RECAP_SESSION_COLUMNS]) {
      expect(cols).not.toMatch(/label/);
      expect(cols).not.toMatch(/stress_probability/);
    }
  });

  it("the today-trend reader DOES expose the seam columns the client renders", () => {
    expect(TODAY_TREND_COLUMNS).toMatch(/\bband\b/);
    expect(TODAY_TREND_COLUMNS).toMatch(/\bcaptured_at\b/);
    expect(TODAY_TREND_COLUMNS).toMatch(/\bsession_id\b/);
  });

  it("the DB SELECT grant on window_readings is the backstop — it withholds the raw signal", () => {
    const grantSelect = migration.slice(
      migration.indexOf("GRANT SELECT (id, session_id, user_id, captured_at"),
      migration.indexOf("GRANT INSERT (id, session_id, user_id, captured_at"),
    );
    expect(grantSelect).toMatch(/ON public\.window_readings/);
    expect(grantSelect).not.toMatch(/\blabel\b/);
    expect(grantSelect).not.toMatch(/\bstress_probability\b/);
  });
});
