"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { cn } from "@/lib/utils";

type Destination = {
  href: string;
  label: string;
  /**
   * When true, the pill is active only on an exact pathname match. Home sets
   * this because it is the root of the /app namespace — a startsWith match
   * would light it up on every descendant (e.g. /app/account). Descendant
   * destinations (Insights etc.) omit this and keep the prefix match below.
   */
  exact?: boolean;
  /** Visible to this role only (omit = all roles). */
  employeeOnly?: boolean;
};

const DESTINATIONS: ReadonlyArray<Destination> = [
  { href: "/app", label: "Home", exact: true },
  // Chat is an employee-only surface (FR-016).
  { href: "/app/chat", label: "Chat", exact: true, employeeOnly: true },
];

type Role = "employee" | "team_lead" | "admin";

export function CenterNav({ role }: { role?: Role }) {
  const pathname = usePathname();
  const destinations = DESTINATIONS.filter(
    (d) => !d.employeeOnly || role === "employee",
  );

  return (
    <nav aria-label="Workflow destinations" className="flex items-center gap-1">
      {destinations.map(({ href, label, exact }) => {
        const active = exact
          ? pathname === href
          : pathname === href || pathname.startsWith(`${href}/`);
        return (
          <Link
            key={href}
            href={href}
            aria-current={active ? "page" : undefined}
            // `h-11` (44 px), NOT `h-9`. Raised 2026-07-29 for two reasons that point the
            // same way. It was the only sub-44px interactive element in this bar — the
            // avatar button beside it has been 44 px all along — and the public navbar's
            // destination row is required to be 44 px by FR-053, whose one exception is
            // spent. Making the two rows identical, which is the point of the change this
            // belongs to, therefore had to raise this one rather than lower that one.
            // Measured: the header box stays 64 px and no sibling moves (all three of its
            // children stay centred at y=31.5).
            className={cn(
              "inline-flex h-11 items-center rounded-md px-3 text-sm text-ink transition-colors hover:bg-surface",
              active && "bg-surface",
            )}
          >
            {label}
          </Link>
        );
      })}
    </nav>
  );
}
