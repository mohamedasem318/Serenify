"use client";

import Link from "next/link";
import { Menu } from "lucide-react";
import { usePathname } from "next/navigation";
import { useState } from "react";

import { Sheet, SheetClose, SheetContent, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import {
  PUBLIC_AUTH_ACTIONS,
  PUBLIC_DESTINATIONS,
  PUBLIC_RETURN_ACTION,
} from "@/components/public/destinations";
import { Button } from "@/components/ui/button";
import type { PublicViewer } from "@/lib/public-viewer";
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
 * role-filtered authed destinations; this one has no role and renders exactly one authed
 * destination, only to a resolved session. Sharing them would still mean one component
 * branching on an optional role, which is how a role-gated link ends up on a page that
 * has no role to gate it with.
 *
 * IT TAKES AN OPTIONAL SESSION AS OF 2026-07-29, and the signed-out half of
 * `tests/unit/components/public/public-shell.test.tsx` is what keeps that honest: with
 * the prop omitted or null, the open sheet must contain no `/app`, `/onboarding` or
 * `/auth` href at all. FR-018's signed-out guarantee is unchanged; see
 * docs/DECISIONS.md 2026-07-29.
 *
 * Rows are `h-11` (44 px) and their labels are single words, so nothing wraps at 320 px
 * (FR-053). No browser storage of any kind — open state is React state that dies with the
 * page, which is all it should ever have been (FR-051). The T033 guard is a plain
 * substring scan over these files, so it flags the API names even inside a comment; that
 * is why this sentence names the rule rather than the APIs.
 */
export function PublicMobileNav({ viewer }: { viewer?: PublicViewer | null }) {
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

        {/*
         * THE WAY OUT OF THE PUBLIC SITE, ALWAYS REACHABLE HERE. Whichever wide control
         * the bar drops below 420 px — "Sign up" for a stranger, "Go to app" for a
         * signed-in visitor — this panel carries it at every width. That is precisely why
         * this block is not conditional on WIDTH: the bar's width budget is not this
         * panel's problem (FR-019).
         *
         * It IS conditional on the session (2026-07-29), because otherwise the defect
         * this change fixes simply moves in here: a signed-in user opening the sheet on
         * /terms would still be offered two doors they are already through.
         *
         * NO SIGN-OUT CONTROL IN THIS PANEL, DELIBERATELY. The profile dropdown is visible
         * in the bar at every width — exactly as it is in the app header — so sign-out is
         * already one click from this screen. A second copy in here would be a second
         * place to keep correct, and the app's own `MobileMenu` does not carry one either.
         *
         * Separated from the page list by a rule because they are a different KIND of
         * thing — those navigate the public site, these leave it for the application.
         */}
        <div className="mt-6 flex flex-col gap-2 border-t border-border pt-6">
          {viewer ? (
            <SheetClose asChild>
              <Button asChild variant="default" size="lg" className="w-full whitespace-nowrap">
                <Link href={PUBLIC_RETURN_ACTION.href}>{PUBLIC_RETURN_ACTION.label}</Link>
              </Button>
            </SheetClose>
          ) : (
            <>
              <SheetClose asChild>
                <Button asChild variant="default" size="lg" className="w-full">
                  <Link href={PUBLIC_AUTH_ACTIONS.signUp.href}>
                    {PUBLIC_AUTH_ACTIONS.signUp.label}
                  </Link>
                </Button>
              </SheetClose>
              <SheetClose asChild>
                <Button asChild variant="outline" size="lg" className="w-full">
                  <Link href={PUBLIC_AUTH_ACTIONS.signIn.href}>
                    {PUBLIC_AUTH_ACTIONS.signIn.label}
                  </Link>
                </Button>
              </SheetClose>
            </>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}
