import Link from "next/link";

import { Wordmark } from "@/components/brand/wordmark";
import { PUBLIC_DESTINATIONS } from "@/components/public/destinations";
import { PublicMobileNav } from "@/components/public/public-mobile-nav";
import { ThemeToggle } from "@/app/theme-toggle";

/**
 * Feature 013 — the public navbar (T027, FR-018).
 *
 * VISUALLY IDENTICAL TO THE APP HEADER, DELIBERATELY. Same `h-16` (64 px), same
 * `border-b border-border`, same NON-TRANSLUCENT `bg-bg`, same wordmark size
 * (`text-2xl leading-none`), same three-slot rhythm, and the theme toggle in the same
 * trailing position — matching `components/header/header.tsx` line for line on every
 * property FR-018 names. It is also not sticky, because the app header is not sticky;
 * matching means matching the behaviour that produces the look, not just the classes.
 *
 * AND A SEPARATE COMPONENT, DELIBERATELY. The two headers look the same and mean
 * different things: `Header` takes a name, an email, and a role, and renders `CenterNav`,
 * `ProfileDropdown`, and a wordmark linking to `/app`. None of that can exist here.
 * Extracting a shared header that takes an optional session is the refactor that
 * eventually leaks an authed link onto a signed-out page — the duplication is the
 * guarantee, and `tests/unit/components/public/public-shell.test.tsx` asserts no `/app`
 * destination appears.
 *
 * Below `md` the destination row is replaced by `<PublicMobileNav />`, mirroring how the
 * app header swaps `CenterNav` for `MobileMenu` at the same breakpoint.
 *
 * The wordmark links to `/`. In P3 that root route still redirects — the landing page
 * takes it over in P6 — so this link is correct now and becomes useful then, without
 * this component changing.
 */
export function PublicNavbar() {
  return (
    <header className="flex h-16 items-center justify-between gap-4 border-b border-border bg-bg px-4 sm:px-6">
      <div className="flex items-center gap-2">
        <div className="md:hidden">
          <PublicMobileNav />
        </div>
        {/*
         * `min-h-11` gives the wordmark link a 44 px tap target (FR-053). Measured at
         * 320 px it was 81×24 without it — the app header's equivalent link has the same
         * gap, which is why matching the app header is not on its own sufficient here.
         * `items-center` replaces the app header's `items-baseline` and renders
         * identically: the link has a single child, so there is no second baseline to
         * align to, and the taller box then centres the wordmark rather than top-pinning it.
         */}
        <Link
          href="/"
          aria-label="Serenify home"
          className="inline-flex min-h-11 items-center gap-2 rounded-control focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
        >
          <Wordmark className="text-2xl leading-none" />
        </Link>
      </div>

      <nav aria-label="Public pages" className="hidden md:flex">
        <ul className="flex items-center gap-1">
          {PUBLIC_DESTINATIONS.map(({ href, label }) => (
            <li key={href}>
              <Link
                href={href}
                className="inline-flex h-11 items-center whitespace-nowrap rounded-control px-3 text-sm text-muted transition-colors hover:bg-surface hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
              >
                {label}
              </Link>
            </li>
          ))}
        </ul>
      </nav>

      <div className="flex items-center gap-1">
        <ThemeToggle />
      </div>
    </header>
  );
}
