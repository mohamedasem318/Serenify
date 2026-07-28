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

export function Header({ fullName, email, role }: HeaderProps) {
  return (
    <header className="flex h-16 items-center justify-between gap-4 border-b border-border bg-bg px-4 sm:px-6">
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
