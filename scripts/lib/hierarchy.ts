import { Faker, en } from "@faker-js/faker";

export type Role = "admin" | "team_lead" | "employee";

export type DemoUser = {
  readonly slot: number;
  readonly full_name: string;
  readonly email: string;
  readonly role: Role;
  readonly manager_slot: number | null;
};

const EMAIL_DOMAIN = "demo.serenify.local";
const TOTAL_SLOTS = 30;

type SlotShape = { role: Role; manager_slot: number | null };

/**
 * Canonical 30-slot hierarchy from specs/002-demo-seed-data/data-model.md.
 * Only role + manager_slot are pinned here; full_name and email are
 * generated per-slot from faker so the cohort feels realistic, but the
 * graph structure is fixed across seeds.
 */
const SHAPE: readonly SlotShape[] = [
  { role: "admin", manager_slot: null },
  { role: "admin", manager_slot: null },
  { role: "employee", manager_slot: 0 },
  { role: "employee", manager_slot: 1 },
  { role: "employee", manager_slot: 6 },
  { role: "team_lead", manager_slot: 0 },
  { role: "team_lead", manager_slot: 0 },
  { role: "team_lead", manager_slot: 1 },
  { role: "team_lead", manager_slot: 1 },
  { role: "team_lead", manager_slot: 5 },
  { role: "employee", manager_slot: 5 },
  { role: "employee", manager_slot: 5 },
  { role: "employee", manager_slot: 5 },
  { role: "employee", manager_slot: 6 },
  { role: "employee", manager_slot: 6 },
  { role: "employee", manager_slot: 6 },
  { role: "employee", manager_slot: 6 },
  { role: "employee", manager_slot: 7 },
  { role: "employee", manager_slot: 7 },
  { role: "employee", manager_slot: 7 },
  { role: "employee", manager_slot: 7 },
  { role: "employee", manager_slot: 8 },
  { role: "employee", manager_slot: 8 },
  { role: "employee", manager_slot: 8 },
  { role: "employee", manager_slot: 8 },
  { role: "employee", manager_slot: 8 },
  { role: "employee", manager_slot: 9 },
  { role: "employee", manager_slot: 9 },
  { role: "employee", manager_slot: 9 },
  { role: "employee", manager_slot: 9 },
];

function normalize(part: string): string {
  return part
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "");
}

function emailFor(first: string, last: string, slot: number): string {
  const nn = String(slot + 1).padStart(2, "0");
  return `${normalize(first)}.${normalize(last)}.${nn}@${EMAIL_DOMAIN}`;
}

export function buildHierarchy(seed: number): readonly DemoUser[] {
  const localFaker = new Faker({ locale: en });
  localFaker.seed(seed);

  const users: DemoUser[] = [];
  for (let slot = 0; slot < TOTAL_SLOTS; slot += 1) {
    const first = localFaker.person.firstName();
    const last = localFaker.person.lastName();
    const shape = SHAPE[slot]!;
    users.push({
      slot,
      full_name: `${first} ${last}`,
      email: emailFor(first, last, slot),
      role: shape.role,
      manager_slot: shape.manager_slot,
    });
  }
  return users;
}
