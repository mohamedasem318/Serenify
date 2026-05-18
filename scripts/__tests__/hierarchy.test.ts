import { describe, expect, it } from "vitest";

import { buildHierarchy, type DemoUser, type Role } from "../lib/hierarchy.js";

const SEED = 1729;

/**
 * Captured byte-for-byte output of `buildHierarchy(1729)` at the time
 * faker was pinned to 9.2.0. A diff here means either:
 *  (a) faker shipped a patch that quietly changed the en-locale name
 *      corpora — investigate, then update the pin in package.json + plan.md
 *      "Pinned versions" table in the same commit, OR
 *  (b) someone reshuffled the SHAPE table in hierarchy.ts — verify the new
 *      shape still satisfies FR-006 (assertions 2..6 below).
 *
 * Either way, do NOT silently re-baseline. The determinism contract
 * FR-007 / SC-005 is a cross-machine guarantee; if this snapshot drifts
 * unintentionally, every developer's local Supabase is now seeded with
 * different names than yours.
 */
const EXPECTED_AT_SEED_1729: readonly DemoUser[] = [
  { slot: 0, full_name: "Courtney Kassulke", email: "courtney.kassulke.01@demo.serenify.local", role: "admin", manager_slot: null },
  { slot: 1, full_name: "Milo Rempel", email: "milo.rempel.02@demo.serenify.local", role: "admin", manager_slot: null },
  { slot: 2, full_name: "Eduardo Willms", email: "eduardo.willms.03@demo.serenify.local", role: "employee", manager_slot: 0 },
  { slot: 3, full_name: "Kennedi Reynolds", email: "kennedi.reynolds.04@demo.serenify.local", role: "employee", manager_slot: 1 },
  { slot: 4, full_name: "John Heaney", email: "john.heaney.05@demo.serenify.local", role: "employee", manager_slot: 6 },
  { slot: 5, full_name: "Jolie Morar-Rolfson", email: "jolie.morarrolfson.06@demo.serenify.local", role: "team_lead", manager_slot: 0 },
  { slot: 6, full_name: "Stephan O'Keefe", email: "stephan.okeefe.07@demo.serenify.local", role: "team_lead", manager_slot: 0 },
  { slot: 7, full_name: "Grady Koch", email: "grady.koch.08@demo.serenify.local", role: "team_lead", manager_slot: 1 },
  { slot: 8, full_name: "Brice Hahn", email: "brice.hahn.09@demo.serenify.local", role: "team_lead", manager_slot: 1 },
  { slot: 9, full_name: "Jean Reynolds", email: "jean.reynolds.10@demo.serenify.local", role: "team_lead", manager_slot: 5 },
  { slot: 10, full_name: "Jade Beahan", email: "jade.beahan.11@demo.serenify.local", role: "employee", manager_slot: 5 },
  { slot: 11, full_name: "Karlee Kihn", email: "karlee.kihn.12@demo.serenify.local", role: "employee", manager_slot: 5 },
  { slot: 12, full_name: "Laurine Berge", email: "laurine.berge.13@demo.serenify.local", role: "employee", manager_slot: 5 },
  { slot: 13, full_name: "Bryce Nienow", email: "bryce.nienow.14@demo.serenify.local", role: "employee", manager_slot: 6 },
  { slot: 14, full_name: "Jacinto Kuphal-Yundt", email: "jacinto.kuphalyundt.15@demo.serenify.local", role: "employee", manager_slot: 6 },
  { slot: 15, full_name: "Tyree Legros", email: "tyree.legros.16@demo.serenify.local", role: "employee", manager_slot: 6 },
  { slot: 16, full_name: "Natalie Welch", email: "natalie.welch.17@demo.serenify.local", role: "employee", manager_slot: 6 },
  { slot: 17, full_name: "Richmond Beahan", email: "richmond.beahan.18@demo.serenify.local", role: "employee", manager_slot: 7 },
  { slot: 18, full_name: "Ezequiel Marks", email: "ezequiel.marks.19@demo.serenify.local", role: "employee", manager_slot: 7 },
  { slot: 19, full_name: "Marshall Pfannerstill", email: "marshall.pfannerstill.20@demo.serenify.local", role: "employee", manager_slot: 7 },
  { slot: 20, full_name: "Mafalda Johnson", email: "mafalda.johnson.21@demo.serenify.local", role: "employee", manager_slot: 7 },
  { slot: 21, full_name: "Vita D'Amore", email: "vita.damore.22@demo.serenify.local", role: "employee", manager_slot: 8 },
  { slot: 22, full_name: "Ken Stark", email: "ken.stark.23@demo.serenify.local", role: "employee", manager_slot: 8 },
  { slot: 23, full_name: "Willis Bogan", email: "willis.bogan.24@demo.serenify.local", role: "employee", manager_slot: 8 },
  { slot: 24, full_name: "Jaylin D'Amore", email: "jaylin.damore.25@demo.serenify.local", role: "employee", manager_slot: 8 },
  { slot: 25, full_name: "Broderick McCullough", email: "broderick.mccullough.26@demo.serenify.local", role: "employee", manager_slot: 8 },
  { slot: 26, full_name: "Phyllis Ondricka", email: "phyllis.ondricka.27@demo.serenify.local", role: "employee", manager_slot: 9 },
  { slot: 27, full_name: "Tobin Dickinson", email: "tobin.dickinson.28@demo.serenify.local", role: "employee", manager_slot: 9 },
  { slot: 28, full_name: "Elisabeth Conroy", email: "elisabeth.conroy.29@demo.serenify.local", role: "employee", manager_slot: 9 },
  { slot: 29, full_name: "Joany Schinner", email: "joany.schinner.30@demo.serenify.local", role: "employee", manager_slot: 9 },
];

const EMAIL_RE = /^[a-z0-9]+\.[a-z0-9]+\.\d{2}@demo\.serenify\.local$/;
const TEAMMATE_RE = /(fatma.+emad|gehad.+mohamed|hebatullah.+gazoly|mohamed.+assem)/i;

describe("buildHierarchy", () => {
  const users = buildHierarchy(SEED);

  it("returns 30 users distributed 2 admin / 5 team_lead / 23 employee (FR-001)", () => {
    expect(users).toHaveLength(30);
    const counts: Record<Role, number> = { admin: 0, team_lead: 0, employee: 0 };
    for (const u of users) counts[u.role] += 1;
    expect(counts).toEqual({ admin: 2, team_lead: 5, employee: 23 });
  });

  it("gives every team_lead 4 or 5 direct reports (FR-006(a))", () => {
    const teamLeads = users.filter((u) => u.role === "team_lead");
    for (const lead of teamLeads) {
      const reports = users.filter((u) => u.manager_slot === lead.slot);
      expect(reports.length).toBeGreaterThanOrEqual(4);
      expect(reports.length).toBeLessThanOrEqual(5);
    }
  });

  it("contains at least one team-lead-to-team-lead link with a 3-level chain to admin (FR-006(b))", () => {
    const bySlot = new Map(users.map((u) => [u.slot, u]));
    const chainedLeads = users.filter(
      (u) => u.role === "team_lead" && u.manager_slot !== null && bySlot.get(u.manager_slot)?.role === "team_lead",
    );
    expect(chainedLeads.length).toBeGreaterThanOrEqual(1);

    // For the first such chained lead, walk up exactly two manager hops and assert admin.
    const child = chainedLeads[0]!;
    const grandparentSlot = bySlot.get(child.manager_slot!)!.manager_slot;
    expect(grandparentSlot).not.toBeNull();
    expect(bySlot.get(grandparentSlot!)?.role).toBe("admin");
  });

  it("has exactly 2 employees reporting directly to admins, one to each admin (FR-006(c))", () => {
    const bySlot = new Map(users.map((u) => [u.slot, u]));
    const empToAdmin = users.filter(
      (u) => u.role === "employee" && u.manager_slot !== null && bySlot.get(u.manager_slot)?.role === "admin",
    );
    expect(empToAdmin).toHaveLength(2);
    const adminParents = new Set(empToAdmin.map((u) => u.manager_slot));
    expect(adminParents.size).toBe(2);
  });

  it("gives every non-admin a non-null manager_slot that resolves within the cohort (FR-006(d))", () => {
    const slots = new Set(users.map((u) => u.slot));
    for (const u of users) {
      if (u.role === "admin") continue;
      expect(u.manager_slot).not.toBeNull();
      expect(slots.has(u.manager_slot!)).toBe(true);
    }
  });

  it("gives both admins manager_slot=null (FR-006(e))", () => {
    const admins = users.filter((u) => u.role === "admin");
    expect(admins).toHaveLength(2);
    for (const a of admins) expect(a.manager_slot).toBeNull();
  });

  it("is byte-identical across calls and pinned to the captured snapshot (FR-007 / SC-005)", () => {
    const a = buildHierarchy(SEED);
    const b = buildHierarchy(SEED);
    expect(a).toEqual(b);
    expect(a).toEqual(EXPECTED_AT_SEED_1729);
  });

  it("emits 30 unique emails matching the expected shape (FR-002 + Decision B)", () => {
    const emails = new Set<string>();
    for (const u of users) {
      expect(u.email).toMatch(EMAIL_RE);
      const localPart = u.email.split("@")[0]!;
      const nnStr = localPart.split(".").at(-1)!;
      const nn = Number(nnStr);
      expect(nn).toBe(u.slot + 1);
      expect(nn).toBeGreaterThanOrEqual(1);
      expect(nn).toBeLessThanOrEqual(30);
      emails.add(u.email);
    }
    expect(emails.size).toBe(30);
  });

  it("never produces the four real teammate names (Principle X)", () => {
    for (const u of users) {
      expect(u.full_name).not.toMatch(TEAMMATE_RE);
    }
  });
});
