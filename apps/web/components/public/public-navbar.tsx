import Link from "next/link";

import { Wordmark } from "@/components/brand/wordmark";
import { PUBLIC_AUTH_ACTIONS, PUBLIC_DESTINATIONS } from "@/components/public/destinations";
import { PublicMobileNav } from "@/components/public/public-mobile-nav";
import { Button } from "@/components/ui/button";
import { ThemeToggle } from "@/app/theme-toggle";

/**
 * Feature 013 — the public navbar (T027, FR-018).
 *
 * MATCHES THE APP HEADER'S RHYTHM: same `h-16` (64 px), same `border-b border-border`, same
 * wordmark size (`text-2xl leading-none`), same three-slot layout, and the theme toggle in
 * the same trailing position — `components/header/header.tsx` on every property FR-018
 * names.
 *
 * ── TWO DELIBERATE DIVERGENCES FROM FR-018, BOTH FROM THE MOCK (2026-07-28) ────────────
 *
 * 1. IT IS STICKY, AND TRANSLUCENT WITH IT. The mock's `nav` is `position:sticky; top:0`
 *    over an 88 %-opaque `--bg` with a 12 px backdrop blur. The app header is neither, and
 *    P3 matched that on the reasoning that matching means matching behaviour too. On a
 *    signed-out LANDING page that reasoning inverts: this is a long scrolling page whose
 *    whole job is to get a stranger to the two buttons below, and a bar that scrolls away
 *    takes them with it. The app header sits above short, task-shaped screens where
 *    sticky buys nothing.
 *
 * 2. IT CARRIES SIGN IN AND SIGN UP. The trailing slot was a theme toggle alone, which
 *    left a returning visitor on `/` with no way into the product at all — the hero's CTA
 *    is the only door on the whole route, and it is below the fold on a phone. That is a
 *    functional gap on the root route of a live product, not a style question. The app
 *    header has no such pair because everyone reading it is already signed in.
 *
 * Both are recorded in `docs/DECISIONS.md` rather than by editing the spec mid-build.
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
    <header
      className="sticky top-0 z-50 flex h-16 items-center justify-between gap-2 border-b border-border px-4 backdrop-blur-md sm:gap-4 sm:px-6"
      // The mock's translucent ground. `color-mix` over the SAME `--color-bg` token the
      // opaque header used — a percentage of an existing token, not a new one (FR-057) —
      // so the bar still reads as the page's own surface when content slides under it.
      style={{ background: "color-mix(in srgb, var(--color-bg) 88%, transparent)" }}
    >
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

      <div className="flex items-center gap-1 sm:gap-2">
        <ThemeToggle />
        {/*
         * Sign in hides below 420 px and Sign up does not — the mock's own rule, and the
         * right one: at 320 px the bar is already carrying a hamburger, a wordmark and a
         * theme toggle, and two buttons would push the row past the viewport. The one that
         * survives is the one for people who do not have an account yet, because the other
         * is one tap away in the sheet, which is where BOTH also live (FR-019). `h-11`
         * keeps each at a 44 px tap target and neither label wraps (FR-053).
         */}
        <Button asChild variant="outline" size="default" className="hidden h-11 px-4 min-[420px]:inline-flex">
          <Link href={PUBLIC_AUTH_ACTIONS.signIn.href}>{PUBLIC_AUTH_ACTIONS.signIn.label}</Link>
        </Button>
        <Button asChild variant="default" size="default" className="h-11 px-4">
          <Link href={PUBLIC_AUTH_ACTIONS.signUp.href}>{PUBLIC_AUTH_ACTIONS.signUp.label}</Link>
        </Button>
      </div>
    </header>
  );
}
