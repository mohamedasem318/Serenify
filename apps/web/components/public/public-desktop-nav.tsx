"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { PUBLIC_DESTINATIONS } from "@/components/public/destinations";
import { cn } from "@/lib/utils";

/**
 * Feature 013 — the public navbar's destination row, with a current-page state.
 *
 * A SEPARATE CLIENT COMPONENT, for the same reason `CenterNav` is one. Marking the state
 * requires `usePathname`, and `PublicNavbar` is otherwise a server component; extracting
 * the one part that needs the hook keeps the rest of the bar server-rendered. The app
 * header solved this identically (`components/header/center-nav.tsx`), so this file is
 * the public mirror of a shape that already exists rather than a new idea.
 *
 * ── THE STATE IS NOT CARRIED BY COLOUR ─────────────────────────────────────────────────
 *
 * `aria-current="page"` is the machine-readable half and is not optional. The visible half
 * is a `bg-surface` pill — the house idiom, matching `CenterNav` and the mobile sheet —
 * PLUS an underline, and the underline is the part doing the accessibility work.
 *
 * The pill alone would not be enough, on two counts. First, it is a colour distinction,
 * and a state a user can only perceive by colour is one some users cannot perceive at all.
 * Second, and independently, it is a *weak* colour distinction: in dark mode `surface`
 * (#181B1E) sits on `bg` (#101214), which is a difference of about 4 % lightness — the
 * pill is close to invisible there before anyone's colour vision is considered.
 *
 * The underline fixes both. It is present or absent rather than one hue or another, it
 * renders at full ink contrast in both themes, and it costs no layout — a weight step
 * (`font-medium`) would have been the other non-colour channel, but it re-measures the
 * label and nudges its neighbours on every navigation.
 *
 * IT ALSO SEPARATES CURRENT FROM HOVER. An inactive link already takes `bg-surface` on
 * hover, so pill-only would render "the link under your cursor" and "the page you are on"
 * identically. The underline is what tells them apart.
 *
 * `underline-offset-4` is the repo's one underline offset (16 other uses); this adds no
 * new value to the scale.
 */
export function PublicDesktopNav() {
  const pathname = usePathname();

  return (
    <nav aria-label="Public pages" className="hidden md:flex">
      <ul className="flex items-center gap-1">
        {PUBLIC_DESTINATIONS.map(({ href, label }) => {
          // `/` is exact-only. Every path starts with "/", so a prefix match would light
          // Home on /terms and /privacy as well — the same trap `CenterNav` documents for
          // /app. The leaf routes keep the prefix match, so a future /terms/annex would
          // still mark Terms as current.
          const active =
            href === "/"
              ? pathname === "/"
              : pathname === href || pathname.startsWith(`${href}/`);

          return (
            <li key={href}>
              <Link
                href={href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "inline-flex h-11 items-center whitespace-nowrap rounded-control px-3 text-sm text-muted transition-colors hover:bg-surface hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background",
                  active && "bg-surface text-ink underline decoration-2 underline-offset-4",
                )}
              >
                {label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
