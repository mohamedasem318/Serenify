import { describe, expect, it, beforeAll, beforeEach, afterAll } from "vitest";
import { config as loadDotenv } from "dotenv";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

// Behavioral coverage for the two functional changes in migration
// 20260525000000_security_hardening_slice_1.sql:
//   F1  admin_update_manager rejects a multi-node manager cycle (23514)
//   F2  admin_update_role rejects a demotion that would empty the admin set (23514)
// plus the positive paths (cycle-free re-parent; self-demotion with a
// second admin remaining).
//
// These hit a real local Supabase exactly like seed-demo.integration.test.ts:
// gated behind SUPABASE_INTEGRATION=1, run via `npm run test:seed:integration`.
// Default `vitest run` skips them.

const ENABLED = process.env.SUPABASE_INTEGRATION === "1";

// Isolated from the demo cohort (@demo.serenify.local) and the Playwright
// fixtures (@example.com) so cleanup never touches either.
const SECTEST_SUFFIX = "@sectest.serenify.local";
const PASSWORD = "SecTest123!";

function loadEnv(): void {
  const here = dirname(fileURLToPath(import.meta.url));
  loadDotenv({ path: resolve(here, "../../apps/web/.env.local") });
}

function makeAdmin(): SupabaseClient {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } },
  );
}

/** A fresh anon client signed in as the given user — carries that user's
 *  JWT so auth.uid() inside the SECURITY DEFINER RPCs resolves correctly. */
async function signInAs(email: string): Promise<SupabaseClient> {
  const client = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } },
  );
  const { error } = await client.auth.signInWithPassword({ email, password: PASSWORD });
  if (error) throw error;
  return client;
}

/** Create a confirmed user; the on_auth_user_created trigger seeds the
 *  profile row (role 'employee'). Returns the new user id. */
async function createUser(admin: SupabaseClient, localpart: string): Promise<string> {
  const { data, error } = await admin.auth.admin.createUser({
    email: `${localpart}${SECTEST_SUFFIX}`,
    password: PASSWORD,
    email_confirm: true,
    user_metadata: { full_name: localpart },
  });
  if (error || !data.user) throw error ?? new Error("createUser returned no user");
  return data.user.id;
}

async function setRole(admin: SupabaseClient, id: string, role: string): Promise<void> {
  const { error } = await admin.from("profiles").update({ role }).eq("id", id);
  if (error) throw error;
}

async function getRole(admin: SupabaseClient, id: string): Promise<string> {
  const { data, error } = await admin.from("profiles").select("role").eq("id", id).single();
  if (error) throw error;
  return data.role as string;
}

async function getManager(admin: SupabaseClient, id: string): Promise<string | null> {
  const { data, error } = await admin.from("profiles").select("manager_id").eq("id", id).single();
  if (error) throw error;
  return data.manager_id as string | null;
}

/** Delete every @sectest.serenify.local user (cascades to profiles). */
async function cleanupSecTestUsers(admin: SupabaseClient): Promise<void> {
  let page = 1;
  while (true) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage: 200 });
    if (error) throw error;
    if (data.users.length === 0) break;
    for (const u of data.users) {
      if (u.email?.toLowerCase().endsWith(SECTEST_SUFFIX)) {
        const { error: delErr } = await admin.auth.admin.deleteUser(u.id);
        if (delErr) throw delErr;
      }
    }
    if (data.users.length < 200) break;
    page += 1;
  }
}

describe.skipIf(!ENABLED)("security slice 1 — SECURITY DEFINER behavior (real local Supabase)", () => {
  let admin: SupabaseClient;

  beforeAll(async () => {
    loadEnv();
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
    if (!url.includes("127.0.0.1") && !url.includes("localhost")) {
      throw new Error(
        `Refusing to run integration test: NEXT_PUBLIC_SUPABASE_URL is "${url}", not a local Supabase.`,
      );
    }
    admin = makeAdmin();
  }, 10_000);

  beforeEach(async () => {
    await cleanupSecTestUsers(admin);
  }, 30_000);

  afterAll(async () => {
    await cleanupSecTestUsers(admin);
  }, 30_000);

  it("F1: admin_update_manager rejects a multi-node cycle (23514)", async () => {
    const adm = await createUser(admin, "f1-adm");
    await setRole(admin, adm, "admin");
    const a = await createUser(admin, "f1-a");
    const b = await createUser(admin, "f1-b");

    const admClient = await signInAs(`f1-adm${SECTEST_SUFFIX}`);

    // A reports to B — succeeds.
    const ok = await admClient.rpc("admin_update_manager", {
      target_user_id: a,
      new_manager_id: b,
    });
    expect(ok.error).toBeNull();
    expect(await getManager(admin, a)).toBe(b);

    // B reports to A — would close A→B→A; rejected with CHECK-violation code.
    const cycle = await admClient.rpc("admin_update_manager", {
      target_user_id: b,
      new_manager_id: a,
    });
    expect(cycle.error?.code).toBe("23514");
    // B's manager is unchanged (the guard fires before the UPDATE).
    expect(await getManager(admin, b)).toBeNull();
  }, 60_000);

  it("F1: a cycle-free re-parent still succeeds", async () => {
    const adm = await createUser(admin, "f1b-adm");
    await setRole(admin, adm, "admin");
    const a = await createUser(admin, "f1b-a");
    const b = await createUser(admin, "f1b-b");
    const c = await createUser(admin, "f1b-c");

    const admClient = await signInAs(`f1b-adm${SECTEST_SUFFIX}`);

    // A→B, then B→C: C is not under B, so no cycle — succeeds.
    expect((await admClient.rpc("admin_update_manager", { target_user_id: a, new_manager_id: b })).error).toBeNull();
    const reparent = await admClient.rpc("admin_update_manager", { target_user_id: b, new_manager_id: c });
    expect(reparent.error).toBeNull();
    expect(await getManager(admin, b)).toBe(c);
  }, 60_000);

  it("F2: admin_update_role rejects the demotion that would empty the admin set (23514)", async () => {
    // The guard counts ALL admins globally, so make the test admin the only
    // one: snapshot + temporarily demote any pre-existing admins, restore after.
    const { data: existing, error: exErr } = await admin
      .from("profiles")
      .select("id")
      .eq("role", "admin");
    if (exErr) throw exErr;
    const foreignAdminIds = (existing ?? []).map((r) => r.id as string);

    try {
      for (const id of foreignAdminIds) await setRole(admin, id, "employee");

      const solo = await createUser(admin, "f2-solo");
      await setRole(admin, solo, "admin"); // now the only admin globally

      const soloClient = await signInAs(`f2-solo${SECTEST_SUFFIX}`);
      const res = await soloClient.rpc("admin_update_role", {
        target_user_id: solo,
        new_role: "employee",
      });
      expect(res.error?.code).toBe("23514");
      // Rolled back: the sole admin is still admin.
      expect(await getRole(admin, solo)).toBe("admin");
    } finally {
      for (const id of foreignAdminIds) await setRole(admin, id, "admin");
    }
  }, 60_000);

  it("F2: self-demotion succeeds when a second admin remains", async () => {
    const admA = await createUser(admin, "f2b-a");
    const admB = await createUser(admin, "f2b-b");
    await setRole(admin, admA, "admin");
    await setRole(admin, admB, "admin");

    const aClient = await signInAs(`f2b-a${SECTEST_SUFFIX}`);
    const res = await aClient.rpc("admin_update_role", {
      target_user_id: admA,
      new_role: "employee",
    });
    expect(res.error).toBeNull();
    expect(await getRole(admin, admA)).toBe("employee");
    expect(await getRole(admin, admB)).toBe("admin"); // the other admin survives
  }, 60_000);
});
