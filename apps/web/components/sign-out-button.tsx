"use client";

import { signOut } from "@/app/(authed)/actions";
import { Button } from "@/components/ui/button";
import { broadcastSignOut } from "@/lib/auth-broadcast";

type SignOutButtonProps = {
  variant?: "secondary" | "ghost";
  className?: string;
  children?: React.ReactNode;
};

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
      <Button type="submit" variant={variant} className={className}>
        {children}
      </Button>
    </form>
  );
}
