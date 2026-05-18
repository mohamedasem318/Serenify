import type { Target } from "./env.js";
import type { DemoUser } from "./hierarchy.js";

const SHARED_PASSWORD = "DemoUser123!";

export function environmentBanner(target: Target): string {
  if (target.kind === "local") {
    return `Targeting LOCAL Supabase (${target.url})`;
  }
  return `Targeting REMOTE Supabase (project ref: ${target.projectRef})`;
}

/**
 * Renders the summary table per contracts/cli.md.
 *
 * - "Manager" column shows the manager's full_name (or `—` for admins).
 * - UUIDs and secrets are intentionally NOT included; the table is
 *   for human triage, not machine consumption (Principle IX).
 */
export function summaryTable(users: readonly DemoUser[]): string {
  const bySlot = new Map(users.map((u) => [u.slot, u]));

  const rows = users.map((u) => ({
    slot: String(u.slot + 1).padStart(2, "0"),
    full_name: u.full_name,
    email: u.email,
    role: u.role,
    manager: u.manager_slot === null ? "—" : (bySlot.get(u.manager_slot)?.full_name ?? "?"),
  }));

  const headers = { slot: "Slot", full_name: "Full name", email: "Email", role: "Role", manager: "Manager" };
  const widths = {
    slot: Math.max(headers.slot.length, ...rows.map((r) => r.slot.length)),
    full_name: Math.max(headers.full_name.length, ...rows.map((r) => r.full_name.length)),
    email: Math.max(headers.email.length, ...rows.map((r) => r.email.length)),
    role: Math.max(headers.role.length, ...rows.map((r) => r.role.length)),
    manager: Math.max(headers.manager.length, ...rows.map((r) => r.manager.length)),
  };

  const pad = (s: string, n: number): string => s + " ".repeat(n - s.length);

  const top = `┌─${"─".repeat(widths.slot)}─┬─${"─".repeat(widths.full_name)}─┬─${"─".repeat(widths.email)}─┬─${"─".repeat(widths.role)}─┬─${"─".repeat(widths.manager)}─┐`;
  const sep = `├─${"─".repeat(widths.slot)}─┼─${"─".repeat(widths.full_name)}─┼─${"─".repeat(widths.email)}─┼─${"─".repeat(widths.role)}─┼─${"─".repeat(widths.manager)}─┤`;
  const bottom = `└─${"─".repeat(widths.slot)}─┴─${"─".repeat(widths.full_name)}─┴─${"─".repeat(widths.email)}─┴─${"─".repeat(widths.role)}─┴─${"─".repeat(widths.manager)}─┘`;

  const headerRow = `│ ${pad(headers.slot, widths.slot)} │ ${pad(headers.full_name, widths.full_name)} │ ${pad(headers.email, widths.email)} │ ${pad(headers.role, widths.role)} │ ${pad(headers.manager, widths.manager)} │`;
  const dataRows = rows.map(
    (r) =>
      `│ ${pad(r.slot, widths.slot)} │ ${pad(r.full_name, widths.full_name)} │ ${pad(r.email, widths.email)} │ ${pad(r.role, widths.role)} │ ${pad(r.manager, widths.manager)} │`,
  );

  return [top, headerRow, sep, ...dataRows, bottom].join("\n");
}

export function passwordBanner(): string {
  const line = `   Shared password for all 30 demo users:  ${SHARED_PASSWORD}   `;
  const inner = " ".repeat(line.length);
  const horiz = "─".repeat(line.length);
  return [
    `┌${horiz}┐`,
    `│${inner}│`,
    `│${line}│`,
    `│${inner}│`,
    `└${horiz}┘`,
  ].join("\n");
}
