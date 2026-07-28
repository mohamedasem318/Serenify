"use client";

import { useEffect } from "react";

import { Button } from "@/components/ui/button";

/**
 * The app's error boundary.
 *
 * Until 2026-07-28 `apps/web/app` had none at all — no `error.tsx`, no
 * `global-error.tsx` — so any uncaught error fell through to Next's built-in
 * root fallback and users saw the unstyled "This page couldn't load / Reload to
 * try again, or go back". That is the screen the sign-out bug surfaced. The
 * transport fix in proxy.ts removes that particular cause; this file is the
 * defence-in-depth for every cause we haven't met yet.
 *
 * Nothing from the error object reaches the screen. No message, no stack, no
 * digest — a digest is an opaque build id, but it is still an internal handle
 * and it reads as noise to the person stuck looking at it. The error goes to the
 * console, which is the developer channel, and nowhere else.
 *
 * Voice follows the house inline-note idiom (terms-reconsent-screen.tsx): "a
 * foggy tint, never crimson", and the failure is ours rather than the reader's.
 * `variant="foggy"` is the documented CTA for exactly this kind of surface
 * (components/ui/button.tsx — "the primary action on a FOGGY screen").
 */
export default function AppError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("[app-error]", error);
  }, [error]);

  return (
    <main className="flex min-h-[60vh] flex-col items-center justify-center px-6 py-16">
      <div className="w-full max-w-sm space-y-6 text-center">
        <div className="space-y-2">
          <h1 className="font-display text-2xl leading-tight text-ink">
            This didn&rsquo;t load
          </h1>
          <p className="text-sm text-ink/70">
            Something on our side didn&rsquo;t finish. Trying again usually
            settles it.
          </p>
        </div>

        <div className="space-y-3">
          <Button
            type="button"
            variant="foggy"
            onClick={reset}
            className="min-h-11 w-full text-base"
          >
            Try again
          </Button>
          {/* A full navigation, not a <Link>: the router state is what just
              failed, so a soft nav can land straight back in the same boundary.
              `reset()` above is already the soft retry; this is the escape hatch
              for when that is not enough, and it is only an escape hatch if it
              leaves the broken router behind. Same idiom as the full-nav <a>
              into the capture routes (components/home/todays-checkin-card.tsx),
              which the rule happens not to flag. */}
          {/* eslint-disable-next-line @next/next/no-html-link-for-pages */}
          <a
            href="/"
            className="flex min-h-11 items-center justify-center rounded-control px-2
              text-sm text-meadow-text underline underline-offset-4 hover:no-underline
              focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring
              focus-visible:ring-offset-2"
          >
            Back to Serenify
          </a>
        </div>
      </div>
    </main>
  );
}
