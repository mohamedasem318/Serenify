"use client";

import { signOut } from "@/app/(authed)/actions";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type SignOutButtonProps = {
  variant?: "secondary" | "ghost";
  className?: string;
  children?: React.ReactNode;
};

/**
 * Calm M&M-compatible "secondary" button styling.
 *
 * shadcn's default variant="secondary" maps to bg-secondary
 * (= --color-foggy) + text-secondary-foreground (= --color-ink),
 * which in dark mode is foggy-on-light-ink — a 1.49:1 ratio that
 * fails WCAG AA. The surface+ink+border treatment below matches
 * the Avatar fallback fix from 515984c and yields ~13:1 in light
 * mode and ~12:1 in dark mode for both rest and hover states.
 *
 * Exported so non-SignOutButton consumers (e.g. the inline
 * change-password form's submit button) can apply the same
 * treatment without re-duplicating the class string.
 */
export const CALM_SECONDARY_BUTTON =
  "bg-surface text-foreground border border-border hover:bg-bg";

export function SignOutButton({
  variant = "secondary",
  className,
  children = "Sign out",
}: SignOutButtonProps) {
  // For the "secondary" variant only, inject the calm M&M-compatible
  // override. Callers can still pass a className to layer on more
  // styling (tailwind-merge resolves bg/text/border collisions in the
  // caller's favour).
  const variantOverride =
    variant === "secondary" ? CALM_SECONDARY_BUTTON : undefined;
  return (
    <form action={signOut}>
      <Button
        type="submit"
        variant={variant}
        className={cn(variantOverride, className)}
      >
        {children}
      </Button>
    </form>
  );
}
