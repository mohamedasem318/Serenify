import Link from "next/link";

import { Wordmark } from "@/components/brand/wordmark";
import { CenterNav } from "@/components/header/center-nav";
import { MobileMenu } from "@/components/header/mobile-menu";
import { ProfileDropdown } from "@/components/header/profile-dropdown";
import { ThemeToggle } from "@/app/theme-toggle";

type HeaderProps = {
  fullName: string | null;
  email: string;
  role: "employee" | "team_lead" | "admin";
};

/**
 * STICKY SINCE 2026-07-29, matching `components/public/public-navbar.tsx` in both
 * directions. Same offset (`top-0`), same stacking level (`z-50`), same `h-16`.
 *
 * `bg-bg` was already here and is unchanged — it is opaque, which is what makes sticky
 * safe: content scrolling underneath is covered rather than veiled. The public navbar
 * dropped its translucency in the same change for the same reason, so the two bars now
 * share one background treatment rather than two.
 *
 * NO LAYOUT RESTRUCTURING WAS NEEDED. This is already the first child of the
 * `flex min-h-dvh flex-col` column in `app/(authed)/layout.tsx`, which has no transform,
 * filter or opacity — so it creates no stacking context and `sticky` resolves against the
 * document scroller, which is the containing block we want.
 *
 * MEASURED CONSEQUENCES, not derived ones. On `/app/chat` the only thing that passes
 * under this bar is the page `<h1>`, and only below a 624 px viewport (the chat card
 * itself only below 576 px); above 656 px the route does not scroll at all. The open
 * `ChatPill` panel is also `z-50` but later in DOM order, so it paints ON TOP of this
 * header where they overlap, which begins below a 444 px viewport. Both were confirmed
 * in real Chromium before this line was added.
 */
export function Header({ fullName, email, role }: HeaderProps) {
  return (
    <header className="sticky top-0 z-50 flex h-16 items-center justify-between gap-4 border-b border-border bg-bg px-4 sm:px-6">
      <div className="flex items-center gap-2">
        <div className="md:hidden">
          <MobileMenu role={role} />
        </div>
        <Link
          href="/app"
          aria-label="Go to home"
          className="inline-flex items-baseline gap-2"
        >
          <Wordmark className="text-2xl leading-none" />
        </Link>
      </div>

      <div className="hidden md:flex">
        <CenterNav role={role} />
      </div>

      <div className="flex items-center gap-1">
        <ThemeToggle />
        {/* feature 010 inserts <TalkButton /> here */}
        <ProfileDropdown fullName={fullName} email={email} />
      </div>
    </header>
  );
}
