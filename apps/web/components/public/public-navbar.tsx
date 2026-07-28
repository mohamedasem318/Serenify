import Link from "next/link";

import { Wordmark } from "@/components/brand/wordmark";
import { PUBLIC_AUTH_ACTIONS } from "@/components/public/destinations";
import { PublicDesktopNav } from "@/components/public/public-desktop-nav";
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
 * ── ONE DELIBERATE DIVERGENCE FROM FR-018 (2026-07-28, narrowed 2026-07-29) ────────────
 *
 * 1. IT IS STICKY — AND SO IS THE APP HEADER NOW, SO THIS IS NO LONGER A DIVERGENCE AT
 *    ALL. `/` is a long scrolling narrative whose whole job is to get a stranger to the
 *    two buttons in this bar, and a bar that scrolls away takes them with it. That was
 *    the 2026-07-28 argument for making this one sticky while the app header was not.
 *    On 2026-07-29 the app header became sticky too (`components/header/header.tsx`),
 *    which resolves the divergence in the direction of parity rather than away from it.
 *
 *    THE TRANSLUCENCY IS GONE. Until 2026-07-29 this bar sat on an 88 %-opaque `--bg`
 *    via an inline `color-mix` plus a 12 px `backdrop-blur-md`, copied from the mock. It
 *    is now plain `bg-bg` — the same opaque token the app header uses. Two reasons. The
 *    inline `style` was a colour declaration bypassing the token utilities, which is the
 *    thing FR-057 exists to prevent; and an 88 % veil over scrolling body copy is a
 *    legibility cost the bar was not buying anything with. **The mock is spent as the
 *    authority for this element's background** — see `docs/DECISIONS.md` 2026-07-29. It
 *    remains authoritative elsewhere.
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
    <header className="sticky top-0 z-50 flex h-16 items-center justify-between gap-2 border-b border-border bg-bg px-4 sm:gap-4 sm:px-6">
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

      {/* The destination row marks the current page, which needs `usePathname` — so it is
          its own client component, exactly as the app header keeps `CenterNav` separate
          from the otherwise-server `Header`. */}
      <PublicDesktopNav />

      {/*
       * ORDER IS SIGN IN · SIGN UP · THEME TOGGLE, with the toggle in the far-right corner.
       * The two actions read left-to-right in the order a stranger needs them, and the
       * toggle — a preference, not a destination — sits outboard of both rather than
       * between the wordmark and the way in.
       */}
      <div className="flex items-center gap-1 sm:gap-2">
        {/*
         * ONE OF THE TWO HIDES BELOW 420 px, AND IT IS SIGN UP. At 320 px the bar already
         * carries a hamburger, a wordmark and a theme toggle; a second button pushes the
         * row past the viewport. `h-11` keeps each at a 44 px tap target and neither label
         * wraps (FR-053). Both live in the sheet at every width regardless (FR-019).
         *
         * P3 kept Sign up and dropped Sign in, following the mock. That was the wrong one
         * to keep. The landing hero's primary CTA IS the signup path, so at narrow widths
         * a navbar Sign up is the second signup control on the screen while a returning
         * visitor — who has no hero CTA of their own — is left with none. Keeping Sign in
         * gives each visitor exactly one door: the hero for people without an account, the
         * bar for people with one.
         *
         * Sign in stays `outline` rather than promoting itself to the filled variant now
         * that it is the sole survivor. On a phone the hero's "Get started" should be the
         * only filled control above the fold; two competing fills is what the narrow width
         * was protecting against in the first place.
         */}
        <Button asChild variant="outline" size="default" className="h-11 px-4">
          <Link href={PUBLIC_AUTH_ACTIONS.signIn.href}>{PUBLIC_AUTH_ACTIONS.signIn.label}</Link>
        </Button>
        <Button asChild variant="default" size="default" className="hidden h-11 px-4 min-[420px]:inline-flex">
          <Link href={PUBLIC_AUTH_ACTIONS.signUp.href}>{PUBLIC_AUTH_ACTIONS.signUp.label}</Link>
        </Button>
        <ThemeToggle />
      </div>
    </header>
  );
}
