"use client";

import Link from "next/link";
import { Menu } from "lucide-react";
import { usePathname } from "next/navigation";
import { useState } from "react";

import { Sheet, SheetClose, SheetContent, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { PUBLIC_DESTINATIONS } from "@/components/public/destinations";
import { cn } from "@/lib/utils";

/**
 * Feature 013 — the public surface's hamburger menu (T025, FR-019).
 *
 * Mirrors the app's existing pattern in `components/header/mobile-menu.tsx`: the Radix
 * `Sheet`, a `SheetTrigger` labelled "Open menu", `side="left"`, `bg-bg`, and every link
 * wrapped in `SheetClose` so choosing a destination dismisses the panel. Mirroring is the
 * point — a visitor who later signs in should not have to learn a second navigation
 * idiom, and a second idiom is also a second thing to keep accessible.
 *
 * SEPARATE COMPONENT, NOT A SHARED ONE. `MobileMenu` takes a `role` and renders
 * role-filtered authed destinations; this one has no role, no session, and no authed
 * destination it could render. Sharing them would mean one component that takes an
 * optional role and branches on it, which is exactly how an authed link ends up on a
 * public page (FR-018).
 *
 * Rows are `h-11` (44 px) and their labels are single words, so nothing wraps at 320 px
 * (FR-053). No browser storage of any kind — open state is React state that dies with the
 * page, which is all it should ever have been (FR-051). The T033 guard is a plain
 * substring scan over these files, so it flags the API names even inside a comment; that
 * is why this sentence names the rule rather than the APIs.
 */
export function PublicMobileNav() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger
        aria-label="Open menu"
        className="inline-flex h-11 w-11 items-center justify-center rounded-control text-muted transition-colors hover:bg-surface hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
      >
        <Menu className="h-5 w-5" />
      </SheetTrigger>
      <SheetContent side="left" className="bg-bg">
        <SheetTitle className="font-display text-2xl text-ink">Menu</SheetTitle>
        <nav aria-label="Public pages" className="mt-8 flex flex-col gap-1">
          {PUBLIC_DESTINATIONS.map(({ href, label }) => {
            const active = pathname === href;
            return (
              <SheetClose key={href} asChild>
                <Link
                  href={href}
                  aria-current={active ? "page" : undefined}
                  className={cn(
                    "inline-flex h-11 items-center whitespace-nowrap rounded-md px-3 text-base text-ink transition-colors hover:bg-surface focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background",
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
