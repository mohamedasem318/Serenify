import Link from "next/link";
import { redirect } from "next/navigation";

import { SignOutButton } from "@/components/sign-out-button";
import { ThemeToggle } from "@/app/theme-toggle";
import { createClient } from "@/lib/supabase/server";

/**
 * Shell for /onboarding only. Onboarding sits between (auth) and
 * (authed): the user IS signed in (so getUser() must return a session
 * or we bounce to /login), but the workspace dashboard has nothing to
 * show until the profile row is filled in. The (authed) shell's full
 * Header (workflow nav, profile dropdown, chat pill) would mislead
 * the user into thinking the product is already inhabited; the (auth)
 * shell has no sign-out option which an interrupted user needs.
 *
 * Slim chrome: wordmark left, ThemeToggle + SignOutButton right.
 * Centered max-w-md column matches the (auth) form-funnel rhythm so
 * the onboarding form reads as the final step in the sign-up flow
 * rather than the first page of a dashboard.
 */
export default async function OnboardingLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    redirect("/login");
  }

  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-md flex-col px-4 py-12 sm:px-6 sm:py-16">
      <header className="mb-10 flex items-baseline justify-between sm:mb-12">
        <Link href="/app" className="inline-flex items-baseline gap-2">
          <span className="font-display text-4xl leading-none tracking-tight text-ink sm:text-5xl">
            Serenify
          </span>
          <span
            aria-hidden
            className="h-1.5 w-1.5 rounded-full bg-meadow"
          />
        </Link>
        <div className="flex items-center gap-1">
          <ThemeToggle />
          <SignOutButton variant="ghost" />
        </div>
      </header>
      {children}
    </main>
  );
}
