import Link from "next/link";

import { ThemeToggle } from "../theme-toggle";

/**
 * Shell for /login, /signup, /forgot-password, /reset-password.
 *
 * Editorial-calm direction: no card chrome — the page IS the surface.
 * The DM Serif Display wordmark is the one display moment per
 * Constitution Principle V's "display fonts MUST be used sparingly —
 * not for body, buttons, labels, or chart text" rule. Inter for
 * everything else.
 *
 * Theme toggle top-right (FR-021): equal-priority light/dark across
 * authed and unauth surfaces per Constitution Principle VI.
 *
 * Vertical centering: on tall viewports the wordmark + form sit in
 * the optical centre of the screen rather than slammed against the
 * top. `justify-center` does the centering, `py-12 / sm:py-16` is
 * the safety padding so a mobile keyboard opening keeps the form
 * inside the visible region. `min-h-dvh` (dynamic viewport height)
 * collapses with iOS Safari's chrome instead of leaving a phantom
 * scroll.
 *
 * 360px floor: horizontal padding is `px-4` (16px) so a 360px
 * viewport leaves a 328px content column — fits the form fields'
 * 12-padding plus 44px touch targets without horizontal scroll.
 */
export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-md flex-col justify-center px-4 py-12 sm:px-6 sm:py-16">
      <header className="mb-10 flex items-baseline justify-between sm:mb-12">
        <Link
          href="/login"
          className="inline-flex items-baseline gap-2"
        >
          <span className="font-display text-4xl leading-none tracking-tight text-ink sm:text-5xl">
            Serenify
          </span>
          <span
            aria-hidden
            className="h-1.5 w-1.5 rounded-full bg-meadow"
          />
        </Link>
        <ThemeToggle />
      </header>
      {children}
    </main>
  );
}
