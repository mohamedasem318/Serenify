"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { cn } from "@/lib/utils";

type Destination = {
  href: string;
  label: string;
};

const DESTINATIONS: ReadonlyArray<Destination> = [
  { href: "/app", label: "Home" },
];

export function CenterNav() {
  const pathname = usePathname();

  return (
    <nav aria-label="Workflow destinations" className="flex items-center gap-1">
      {DESTINATIONS.map(({ href, label }) => {
        const active = pathname === href || pathname.startsWith(`${href}/`);
        return (
          <Link
            key={href}
            href={href}
            aria-current={active ? "page" : undefined}
            className={cn(
              "inline-flex h-9 items-center rounded-md px-3 text-sm text-ink transition-colors hover:bg-surface",
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
