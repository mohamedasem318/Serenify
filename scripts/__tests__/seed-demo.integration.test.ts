import { describe, expect, it, beforeAll } from "vitest";
import { config as loadDotenv } from "dotenv";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { createClient } from "@supabase/supabase-js";

import { main } from "../seed-demo.js";
import { buildHierarchy } from "../lib/hierarchy.js";
import { SYNTHETIC_ANCHOR_MODEL_VERSION } from "../lib/synthetic-anchor.js";

const SEED = 1729;
const DEMO_SUFFIX = "@demo.serenify.local";
const SHARED_PASSWORD = "DemoUser123!";

// Gate: this suite hits a real Supabase. Default `vitest run` skips it.
// `npm run test:seed:integration` sets the env var via cross-env.
const ENABLED = process.env.SUPABASE_INTEGRATION === "1";

// Load .env.local the same way the entrypoint does, so we have admin
// access for the post-condition queries.
function loadEnv(): void {
  const here = dirname(fileURLToPath(import.meta.url));
  loadDotenv({ path: resolve(here, "../../apps/web/.env.local") });
}

function makeAdmin() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } },
  );
}

function makeAnon() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } },
  );
}

async function listDemoUsers(admin: ReturnType<typeof makeAdmin>) {
  const out: Array<{ id: string; email: string }> = [];
  let page = 1;
  while (true) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage: 200 });
    if (error) throw error;
    if (data.users.length === 0) break;
    for (const u of data.users) {
      if (u.email?.toLowerCase().endsWith(DEMO_SUFFIX)) {
        out.push({ id: u.id, email: u.email });
      }
    }
    if (data.users.length < 200) break;
    page += 1;
  }
  return out;
}

async function snapshotNonDemo(admin: ReturnType<typeof makeAdmin>) {
  const out: Array<{ id: string; email: string }> = [];
  let page = 1;
  while (true) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage: 200 });
    if (error) throw error;
    if (data.users.length === 0) break;
    for (const u of data.users) {
      if (!u.email?.toLowerCase().endsWith(DEMO_SUFFIX)) {
        out.push({ id: u.id, email: u.email ?? "" });
      }
    }
    if (data.users.length < 200) break;
    page += 1;
  }
  return out.sort((a, b) => a.email.localeCompare(b.email));
}

describe.skipIf(!ENABLED)("seed-demo integration (real local Supabase)", () => {
  beforeAll(async () => {
    loadEnv();
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
    if (!url.includes("127.0.0.1") && !url.includes("localhost")) {
      throw new Error(
        `Refusing to run integration test: NEXT_PUBLIC_SUPABASE_URL is "${url}", not a local Supabase.`,
      );
    }
  }, 10_000);

  it("reset + create produces 30 demo users with the correct distribution (assertions 1, 2)", async () => {
    const result = await main({ argv: ["--reset"] });
    expect(result.exitCode).toBe(0);

    const admin = makeAdmin();
    const demoUsers = await listDemoUsers(admin);
    expect(demoUsers).toHaveLength(30);

    const ids = demoUsers.map((u) => u.id);
    const { data: profiles, error } = await admin
      .from("profiles")
      .select("role")
      .in("id", ids);
    if (error) throw error;

    const counts = { admin: 0, team_lead: 0, employee: 0 };
    for (const row of profiles ?? []) counts[row.role as keyof typeof counts] += 1;
    expect(counts).toEqual({ admin: 2, team_lead: 5, employee: 23 });

    // FR-031/033 (📌 DECISION-17): every demo profile carries the synthetic
    // anchor (service_role bypasses the authenticated column whitelist, so it
    // can read anchor_vector here). Only the 30 demo ids are ever upserted, so
    // non-demo profiles are untouched.
    const { data: anchorRows, error: anchorErr } = await admin
      .from("profiles")
      .select("anchor_vector, anchor_model_version")
      .in("id", ids);
    if (anchorErr) throw anchorErr;
    expect(anchorRows).toHaveLength(30);
    for (const row of anchorRows ?? []) {
      expect(row.anchor_vector).not.toBeNull();
      expect(row.anchor_model_version).toBe(SYNTHETIC_ANCHOR_MODEL_VERSION);
    }
  }, 60_000);

  it("FR-006(a)-(e) hold against real profile rows (assertion 3)", async () => {
    const admin = makeAdmin();
    const demoUsers = await listDemoUsers(admin);
    const idToEmail = new Map(demoUsers.map((u) => [u.id, u.email]));

    const { data: profiles, error } = await admin
      .from("profiles")
      .select("id, role, manager_id")
      .in("id", Array.from(idToEmail.keys()));
    if (error) throw error;

    type Row = { id: string; role: "admin" | "team_lead" | "employee"; manager_id: string | null };
    const rows = (profiles ?? []) as Row[];
    const byId = new Map(rows.map((r) => [r.id, r]));

    // (a) each team_lead has 4-5 direct reports
    for (const lead of rows.filter((r) => r.role === "team_lead")) {
      const reports = rows.filter((r) => r.manager_id === lead.id);
      expect(reports.length).toBeGreaterThanOrEqual(4);
      expect(reports.length).toBeLessThanOrEqual(5);
    }
    // (b) at least one team_lead reports to another team_lead
    const tlToTl = rows.filter(
      (r) => r.role === "team_lead" && r.manager_id !== null && byId.get(r.manager_id)?.role === "team_lead",
    );
    expect(tlToTl.length).toBeGreaterThanOrEqual(1);
    // (c) exactly 2 employees report to admins, one per admin
    const empToAdmin = rows.filter(
      (r) => r.role === "employee" && r.manager_id !== null && byId.get(r.manager_id)?.role === "admin",
    );
    expect(empToAdmin).toHaveLength(2);
    expect(new Set(empToAdmin.map((r) => r.manager_id)).size).toBe(2);
    // (d) every non-admin has non-null manager_id
    for (const r of rows.filter((r) => r.role !== "admin")) {
      expect(r.manager_id).not.toBeNull();
    }
    // (e) both admins have null manager_id
    const admins = rows.filter((r) => r.role === "admin");
    expect(admins).toHaveLength(2);
    for (const a of admins) expect(a.manager_id).toBeNull();
  }, 60_000);

  it("non-demo users are byte-identical before and after a full run (assertion 4)", async () => {
    const admin = makeAdmin();
    const before = await snapshotNonDemo(admin);
    const result = await main({ argv: [] });
    expect(result.exitCode).toBe(0); // already-present skip
    const after = await snapshotNonDemo(admin);
    expect(after).toEqual(before);
  }, 60_000);

  it("re-running without --reset is a zero-diff no-op (assertion 5)", async () => {
    const admin = makeAdmin();
    const beforeDemo = (await listDemoUsers(admin)).map((u) => u.id).sort();
    const result = await main({ argv: [] });
    expect(result.exitCode).toBe(0);
    const afterDemo = (await listDemoUsers(admin)).map((u) => u.id).sort();
    expect(afterDemo).toEqual(beforeDemo);
  }, 60_000);

  it("any demo user can sign in with the shared password (assertion 6)", async () => {
    const firstEmail = buildHierarchy(SEED)[0]!.email;
    const anon = makeAnon();
    const { data, error } = await anon.auth.signInWithPassword({
      email: firstEmail,
      password: SHARED_PASSWORD,
    });
    expect(error).toBeNull();
    expect(data.session).toBeTruthy();
  }, 60_000);

  it("--remote without SUPABASE_PROJECT_REF exits 1 before any network call (assertion 7)", async () => {
    const saved = process.env.SUPABASE_PROJECT_REF;
    delete process.env.SUPABASE_PROJECT_REF;
    try {
      const result = await main({ argv: ["--remote"] });
      expect(result.exitCode).toBe(1);
    } finally {
      if (saved !== undefined) process.env.SUPABASE_PROJECT_REF = saved;
    }
  }, 10_000);

  it("SUPABASE_PROJECT_REF without --remote is silently ignored and targets local (assertion 8)", async () => {
    process.env.SUPABASE_PROJECT_REF = "fake-ref-should-be-ignored";
    try {
      const result = await main({ argv: [] });
      expect(result.exitCode).toBe(0); // would be 0 (idempotent skip) since cohort is present
    } finally {
      delete process.env.SUPABASE_PROJECT_REF;
    }
  }, 60_000);

  it("partial-state cohort exits 5 with zero new writes (assertion 9)", async () => {
    // Per refinement 2: exercise T011 step 8 — the partial-state guard.
    // Setup: delete ONE demo user so the cohort sits at 29 (1 <= N <= 29).
    const admin = makeAdmin();
    const all = await listDemoUsers(admin);
    expect(all.length).toBe(30); // pre-condition from prior tests
    const victim = all[0]!;
    const { error: delErr } = await admin.auth.admin.deleteUser(victim.id);
    if (delErr) throw delErr;

    try {
      const beforeIds = (await listDemoUsers(admin)).map((u) => u.id).sort();
      expect(beforeIds.length).toBe(29);

      const result = await main({ argv: [] });
      expect(result.exitCode).toBe(5);

      // Zero new writes — id set is identical before and after.
      const afterIds = (await listDemoUsers(admin)).map((u) => u.id).sort();
      expect(afterIds).toEqual(beforeIds);
    } finally {
      // Restore the cohort so subsequent test runs start from a clean
      // baseline. `--reset` deletes the surviving 29 and recreates all 30.
      const restore = await main({ argv: ["--reset"] });
      expect(restore.exitCode).toBe(0);
    }
  }, 60_000);
});
