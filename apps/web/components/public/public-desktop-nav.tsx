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
 * ── THE ACTIVE TREATMENT IS AN EXACT MIRROR OF `CenterNav` (2026-07-29) ────────────────
 *
 * The class string below is character-identical to `components/header/center-nav.tsx`'s.
 * That is the requirement, not a coincidence: the two bars are meant to be the same bar,
 * and a visitor who signs in must not meet a second idiom for the same affordance.
 *
 * WHAT THIS REPLACED, AND WHAT IT COST. Until now this row carried a bespoke treatment
 * from PR #188 — `text-muted` resting, an `underline decoration-2 underline-offset-4` on
 * the active link, `h-11`, `rounded-control`, and a custom `focus-visible` ring. The
 * underline was there to give the current-page state a channel other than colour, because
 * the `bg-surface` pill is a weak one: `#F4F5F6` on `#EAEBEC` in light and `#181B1E` on
 * `#101214` in dark are 1.09:1 and 1.085:1, against the 3:1 WCAG 1.4.11 asks of a non-text
 * indicator. It also separated "the page you are on" from "the link under your cursor",
 * which `hover:bg-surface` otherwise renders identically.
 *
 * Both of those are true, and both are equally true of `CenterNav`, which has always
 * marked the current page with the pill alone. Ruled by Mohamed on 2026-07-29: the two
 * navbars are made identical, and the weak indicator is a shared, known property of the
 * house pill rather than something this one file fixes on its own. `aria-current="page"`
 * is unaffected and remains the machine-readable half — it is not optional and is what a
 * screen reader announces. Recorded in `docs/DECISIONS.md`.
 *
 * `h-11` (44 px) is the one thing that did NOT move to match: FR-053 requires a 44 px tap
 * target on the public surface and its single exception is spent (`spec.md` §FR-053,
 * amended 2026-07-28). Rather than shrink this row to `CenterNav`'s `h-9`, `CenterNav`
 * was raised to `h-11` — so the strings match at 44 px, in the direction that satisfies
 * the constraint instead of amending it away.
 *
 * The custom focus ring is gone with the rest. It is not a regression: nothing in
 * `globals.css` or Tailwind v4's preflight resets outlines, so the UA focus ring paints,
 * and it was verified visible on `CenterNav` in both themes in real Chromium before this
 * change was made (FR-055).
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
                  "inline-flex h-11 items-center rounded-md px-3 text-sm text-ink transition-colors hover:bg-surface",
                  active && "bg-surface",
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
