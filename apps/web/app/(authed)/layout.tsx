import Link from "next/link";

import { ThemeToggle } from "../theme-toggle";
import { signOut } from "./actions";

/**
 * Authed shell: a slim header (wordmark + sign-out) above the page
 * content. The page content lives in /app or /onboarding. Same
 * editorial-calm direction as the (auth) shell — no surfaces, just
 * generous space.
 */
export default function AuthedLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="mx-auto flex min-h-dvh w-full max-w-3xl flex-col px-4 py-6 sm:px-6">
      <header className="flex items-baseline justify-between">
        <Link href="/app" className="inline-flex items-baseline gap-2">
          <span className="font-display text-2xl leading-none tracking-tight text-ink sm:text-3xl">
            Serenify
          </span>
          <span aria-hidden className="h-1 w-1 rounded-full bg-meadow" />
        </Link>
        <div className="flex items-center gap-2">
          <ThemeToggle />
          <form action={signOut}>
            <button
              type="submit"
              className="inline-flex h-11 items-center rounded-control px-3 text-sm text-muted transition-colors hover:bg-surface hover:text-ink"
            >
              Sign out
            </button>
          </form>
        </div>
      </header>
      <main className="flex-1 pt-12 sm:pt-20">{children}</main>
    </div>
  );
}
