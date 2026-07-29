import Link from "next/link";

import { Wordmark } from "@/components/brand/wordmark";
import { ProfileDropdown } from "@/components/header/profile-dropdown";
import { PUBLIC_AUTH_ACTIONS, PUBLIC_RETURN_ACTION } from "@/components/public/destinations";
import { PublicDesktopNav } from "@/components/public/public-desktop-nav";
import { PublicMobileNav } from "@/components/public/public-mobile-nav";
import { Button } from "@/components/ui/button";
import { ThemeToggle } from "@/app/theme-toggle";
import type { PublicViewer } from "@/lib/public-viewer";

/**
 * Feature 013 — the public navbar (T027, FR-018).
 *
 * MATCHES THE APP HEADER'S RHYTHM: same `h-16` (64 px), same `border-b border-border`, same
 * wordmark size (`text-2xl leading-none`), same three-slot layout, and the theme toggle in
 * the same trailing position — `components/header/header.tsx` on every property FR-018
 * names.
 *
 * ── DELIBERATE DIVERGENCES FROM FR-018 (2026-07-28, narrowed and extended 2026-07-29) ──
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
 * 3. IT IS AUTH-AWARE (2026-07-29). A signed-in visitor gets "Go to app", the theme
 *    toggle and the profile dropdown, in place of the two doors in. `/` already
 *    redirects a signed-in visitor to `/app`, so the defect this fixes only ever showed
 *    on `/terms` and `/privacy` — where it mattered most: a pre-013 user meets the
 *    Terms/Privacy re-consent gate, opens a document from it (in a new tab, by design),
 *    and the site greets them as a stranger. Every pre-013 production account meets
 *    that gate. FR-018's "no dashboard or authed links" is superseded for the signed-in
 *    case; see docs/DECISIONS.md 2026-07-29.
 *
 * All three are recorded in `docs/DECISIONS.md` rather than by editing the spec. Feature
 * 013 has shipped (PR #194) and was production-verified (#199); its `spec.md` is a
 * point-in-time record and is not retro-edited — the constitution states this directly
 * (`.specify/memory/constitution.md`: "those spec docs are point-in-time records"), and
 * PRs #210 and #212 both changed this very component's behaviour without touching it.
 *
 * AND A SEPARATE COMPONENT, STILL DELIBERATELY — the reason narrowed, not the rule.
 * `Header` takes a role and renders `CenterNav` and a wordmark linking to `/app`; none
 * of that exists here, and this bar's wordmark still goes to `/`. What DID change is
 * that this component now takes an optional session, which is the exact shape the old
 * comment warned about ("extracting a shared header that takes an optional session is
 * the refactor that eventually leaks an authed link onto a signed-out page").
 *
 * That warning is not withdrawn — it is now load-bearing in a different place. The
 * duplication was never the guarantee on its own; the TEST was, and it has been split
 * rather than relaxed: the signed-out half asserts no authed href, no authed vocabulary
 * and no avatar trigger, across all three ways of expressing "no viewer" (omitted,
 * `undefined`, `null`), so a merged component that defaults its session parameter or
 * branches on a loose truthiness test fails on at least one of them
 * (`tests/unit/components/public/public-shell.test.tsx`).
 *
 * `ProfileDropdown` is REUSED rather than reimplemented. It takes `{ fullName, email }`
 * and no role, so it costs no extra column in the query, and reusing it means sign-out
 * behaves identically on both surfaces — including the cross-tab broadcast, which a
 * parallel implementation would have had to remember.
 *
 * Below `md` the destination row is replaced by `<PublicMobileNav />`, mirroring how the
 * app header swaps `CenterNav` for `MobileMenu` at the same breakpoint.
 *
 * The wordmark links to `/`. In P3 that root route still redirects — the landing page
 * takes it over in P6 — so this link is correct now and becomes useful then, without
 * this component changing.
 */
export function PublicNavbar({ viewer }: { viewer?: PublicViewer | null }) {
  return (
    <header className="sticky top-0 z-50 flex h-16 items-center justify-between gap-2 border-b border-border bg-bg px-4 sm:gap-4 sm:px-6">
      <div className="flex items-center gap-2">
        <div className="md:hidden">
          <PublicMobileNav viewer={viewer} />
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
       * THE TRAILING SLOT IS THE ONLY THING THE SESSION CHANGES. Everything to the left of
       * it — the hamburger, the wordmark, the destination row — is identical either way,
       * which is what keeps the two branches from drifting into two different bars.
       *
       * THE TWO ORDERS ARE DIFFERENT, AND EACH MATCHES THE BAR THE VISITOR IS ABOUT TO SEE.
       *
       *   signed out · SIGN IN · SIGN UP · THEME TOGGLE
       *   signed in  · GO TO APP · THEME TOGGLE · AVATAR
       *
       * Signed out, the toggle is outboard of both actions: it is a preference, not a
       * destination, and it should not sit between the wordmark and the way in. Signed in,
       * the trailing pair is `ThemeToggle` then `ProfileDropdown` — character-for-character
       * the app header's own order (`components/header/header.tsx`) — because the next bar
       * this visitor sees is that one, and the avatar must not move when they cross over.
       */}
      <div className="flex items-center gap-1 sm:gap-2">
        {viewer ? (
          <>
            {/*
             * HIDES BELOW 420 px, on exactly the budget Sign up spends. At 320 px the row
             * carries a hamburger, a wordmark, a theme toggle and now a 44 px avatar; a
             * wide button on top of that pushes it past the viewport. The sheet carries
             * it at every width instead, which is the same answer FR-019 gave for the two
             * doors in — the bar's width budget is not the panel's problem.
             *
             * `whitespace-nowrap` is not decorative: "Go to app" is three words, and a
             * tap target whose label wraps to two lines fails FR-053 and reads as broken
             * (Hallmark responsive.md § Clickable text — never wraps).
             *
             * `outline`, not the filled variant. A signed-in visitor on a legal document
             * is reading, not converting; the only filled control on `/` is the hero's
             * "Get started", and this bar should not compete with it in the one place the
             * two could appear together.
             */}
            <Button
              asChild
              variant="outline"
              size="default"
              className="hidden h-11 whitespace-nowrap px-4 min-[420px]:inline-flex"
            >
              <Link href={PUBLIC_RETURN_ACTION.href}>{PUBLIC_RETURN_ACTION.label}</Link>
            </Button>
            <ThemeToggle />
            {/*
             * REUSED, NOT REBUILT. Takes `{ fullName, email }` and no role, so it adds no
             * column to the query, and sign-out behaves identically here and in the app —
             * including the cross-tab broadcast a parallel implementation would have had
             * to remember. Visible at EVERY width, exactly as it is in the app header:
             * that is what keeps sign-out one click rather than one click plus a sheet.
             */}
            <ProfileDropdown fullName={viewer.fullName} email={viewer.email} />
          </>
        ) : (
          <>
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
          </>
        )}
      </div>
    </header>
  );
}
