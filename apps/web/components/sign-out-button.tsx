"use client";

import { useFormStatus } from "react-dom";

import { signOut } from "@/app/(authed)/actions";
import { Button } from "@/components/ui/button";
import { broadcastSignOut } from "@/lib/auth-broadcast";
import { cn } from "@/lib/utils";

type SignOutButtonProps = {
  variant?: "secondary" | "ghost";
  className?: string;
  children?: React.ReactNode;
};

/**
 * The pending affordance.
 *
 * Sign-out crosses the network twice before anything visible happens — measured
 * at ~1.6-2s in production — and until 2026-07-28 the control gave no feedback
 * at all for that whole window. The button simply sat there, which is what the
 * original bug report described as "does nothing".
 *
 * `useFormStatus` has to be read from a component rendered INSIDE the form, so
 * this is split out rather than folded into SignOutButton.
 *
 * Reduced motion: the ring is `motion-safe:` only. Serenify's global
 * reduced-motion rule (globals.css) freezes animations rather than removing
 * them, so a ring left spinning there would render as a static circle that says
 * nothing. The label is the load-bearing signal in both cases — "Signing out…"
 * reads identically with or without motion — and the `role="status"` region
 * announces it to screen readers. The ring only ever adds "still working".
 *
 * `disabled` is real, not `aria-disabled`: it also stops a second submit, which
 * would otherwise fire a second sign-out action against a dead session.
 */
function SignOutSubmit({
  variant = "secondary",
  className,
  children,
}: SignOutButtonProps) {
  const { pending } = useFormStatus();

  return (
    <>
      <Button
        type="submit"
        variant={variant}
        disabled={pending}
        // 44px floor. The default Button size is h-10 (40px), under the
        // comfortable-touch minimum for a control this consequential.
        className={cn("min-h-11", className)}
      >
        {pending ? (
          <>
            <PendingRing />
            Signing out…
          </>
        ) : (
          children
        )}
      </Button>
      <span role="status" className="sr-only">
        {pending ? "Signing out" : ""}
      </span>
    </>
  );
}

/**
 * A quiet rotating arc. Slower than a stock spinner (1.4s vs the usual 1s) and
 * drawn in the inherited text colour at reduced opacity — this is a calm exit,
 * not a loading race.
 */
function PendingRing() {
  return (
    <svg
      viewBox="0 0 16 16"
      aria-hidden="true"
      className="size-4 opacity-70 motion-safe:animate-spin [animation-duration:1.4s]"
    >
      <circle
        cx="8"
        cy="8"
        r="6.5"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeOpacity="0.25"
      />
      <path
        d="M8 1.5A6.5 6.5 0 0 1 14.5 8"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
      />
    </svg>
  );
}

export function SignOutButton({
  variant = "secondary",
  className,
  children = "Sign out",
}: SignOutButtonProps) {
  return (
    <form
      action={signOut}
      onSubmit={() => {
        // Cross-tab sign-out broadcast (📌 DECISION-N amendment
        // 2026-05-22). onSubmit fires synchronously BEFORE the
        // server action runs, so sibling tabs receive the storage
        // event while the calling tab still has the session
        // cookies — by the time the server action clears them and
        // redirects, the broadcast has already propagated.
        broadcastSignOut();
      }}
    >
      <SignOutSubmit variant={variant} className={className}>
        {children}
      </SignOutSubmit>
    </form>
  );
}
