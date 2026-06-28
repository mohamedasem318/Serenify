"use client";

import Link from "next/link";
import { Menu } from "lucide-react";
import { usePathname } from "next/navigation";
import { useState } from "react";

import {
  Sheet,
  SheetClose,
  SheetContent,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { cn } from "@/lib/utils";

type Role = "employee" | "team_lead" | "admin";

type Destination = {
  href: string;
  label: string;
  /** Exact-match active state (Home is the root of /app — see CenterNav). */
  exact?: boolean;
  /** Visible to this role only (omit = all roles). */
  employeeOnly?: boolean;
};

const DESTINATIONS: ReadonlyArray<Destination> = [
  { href: "/app", label: "Home", exact: true },
  // Mirror CenterNav: Chat is an employee-only surface (FR-016). Without this the
  // hamburger had no Chat link, stranding employees at narrow widths (no center nav).
  { href: "/app/chat", label: "Chat", exact: true, employeeOnly: true },
];

export function MobileMenu({ role }: { role?: Role }) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const destinations = DESTINATIONS.filter(
    (d) => !d.employeeOnly || role === "employee",
  );

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger
        aria-label="Open menu"
        className="inline-flex h-11 w-11 items-center justify-center rounded-control text-muted transition-colors hover:bg-surface hover:text-ink"
      >
        <Menu className="h-5 w-5" />
      </SheetTrigger>
      <SheetContent side="left" className="bg-bg">
        <SheetTitle className="font-display text-2xl text-ink">
          Menu
        </SheetTitle>
        <nav
          aria-label="Workflow destinations"
          className="mt-8 flex flex-col gap-1"
        >
          {destinations.map(({ href, label, exact }) => {
            const active = exact
              ? pathname === href
              : pathname === href || pathname.startsWith(`${href}/`);
            return (
              <SheetClose key={href} asChild>
                <Link
                  href={href}
                  aria-current={active ? "page" : undefined}
                  className={cn(
                    "inline-flex h-11 items-center rounded-md px-3 text-base text-ink transition-colors hover:bg-surface",
                    active && "bg-surface",
                  )}
                >
                  {label}
                </Link>
              </SheetClose>
            );
          })}
        </nav>
      </SheetContent>
    </Sheet>
  );
}
