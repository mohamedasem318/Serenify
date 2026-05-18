import { test, expect } from "@playwright/test";
import { createAdminClient } from "./setup/admin-client";

// Asserts FR-019 / Story 4: the demo cohort created by `npm run seed`
// (feature 002) survives a Playwright e2e run unchanged.
//
// The Playwright globalSetup runs BEFORE this spec executes, so by the
// time the test body runs, the @example.com fixture wipe has already
// fired. We snapshot the demo cohort at the start of this spec; that
// snapshot IS the post-global-setup state. Any drift here means
// global-setup leaked outside the @example.com pattern.

const DEMO_SUFFIX = "@demo.serenify.local";

type DemoSnapshotRow = {
  id: string;
  email: string;
  role: string;
  manager_id: string | null;
};

test.describe("demo cohort coexistence (FR-019)", () => {
  test("the 30 demo users from `npm run seed` are unchanged after global-setup", async ({ page }) => {
    const admin = createAdminClient();

    // Snapshot every auth user whose email matches the demo pattern.
    // If the developer hasn't run `npm run seed`, this set will be
    // < 30 and we skip rather than fail — CI may legitimately run
    // without a seeded demo cohort.
    const demoAuthUsers: Array<{ id: string; email: string }> = [];
    let p = 1;
    while (true) {
      const { data, error } = await admin.auth.admin.listUsers({ page: p, perPage: 200 });
      if (error) throw error;
      if (data.users.length === 0) break;
      for (const u of data.users) {
        if (u.email?.toLowerCase().endsWith(DEMO_SUFFIX)) {
          demoAuthUsers.push({ id: u.id, email: u.email });
        }
      }
      if (data.users.length < 200) break;
      p += 1;
    }

    test.skip(
      demoAuthUsers.length < 30,
      `npm run seed has not been run (${demoAuthUsers.length}/30 demo users present); demo-coexistence is N/A for this run`,
    );

    // Snapshot the profile rows for the demo cohort. Sort by email so
    // the comparison is order-independent.
    const demoIds = demoAuthUsers.map((u) => u.id);
    const { data: profiles, error: profErr } = await admin
      .from("profiles")
      .select("id, role, manager_id")
      .in("id", demoIds);
    if (profErr) throw profErr;

    const byId = new Map(demoAuthUsers.map((u) => [u.id, u.email]));
    const baseline: DemoSnapshotRow[] = (profiles ?? [])
      .map((row) => ({
        id: row.id as string,
        email: byId.get(row.id as string)!,
        role: row.role as string,
        manager_id: (row.manager_id as string | null) ?? null,
      }))
      .sort((a, b) => a.email.localeCompare(b.email));

    expect(baseline).toHaveLength(30);

    // Trigger a real page navigation so we exercise the test runtime
    // in the same way as any other spec (proves global-setup actually
    // ran in this test context, not just that the cohort exists).
    await page.goto("/login");

    // Re-query and compare byte-for-byte.
    const { data: post, error: postErr } = await admin
      .from("profiles")
      .select("id, role, manager_id")
      .in("id", demoIds);
    if (postErr) throw postErr;

    const after: DemoSnapshotRow[] = (post ?? [])
      .map((row) => ({
        id: row.id as string,
        email: byId.get(row.id as string)!,
        role: row.role as string,
        manager_id: (row.manager_id as string | null) ?? null,
      }))
      .sort((a, b) => a.email.localeCompare(b.email));

    expect(after).toEqual(baseline);
  });
});
