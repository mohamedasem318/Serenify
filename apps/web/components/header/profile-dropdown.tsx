"use client";

import Link from "next/link";
import { useRef, useState } from "react";

import { signOut } from "@/app/(authed)/actions";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { broadcastSignOut } from "@/lib/auth-broadcast";
import { deriveInitials } from "@/lib/initials";
import { truncateName } from "@/lib/truncate-name";

type ProfileDropdownProps = {
  fullName: string | null;
  email: string;
};

function deriveDisplayName(fullName: string | null, email: string): string {
  if (fullName && fullName.trim().length > 0) {
    return truncateName(fullName.trim());
  }
  return email;
}

export function ProfileDropdown({ fullName, email }: ProfileDropdownProps) {
  const formRef = useRef<HTMLFormElement>(null);
  // The menu item is a SIBLING of the form (the form lives outside the Radix
  // portal), so `useFormStatus` — which only reads from inside a form — cannot
  // see it. This local flag is the equivalent signal for that one control.
  //
  // It is never reset. Both outcomes of the action navigate away: success
  // redirects to /login, and a failed revoke now clears cookies and redirects
  // anyway. Nothing returns the user to this menu with the flag still set.
  const [signingOut, setSigningOut] = useState(false);
  const initials = deriveInitials(fullName, email);
  const displayName = deriveDisplayName(fullName, email);

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger
          aria-label="Open profile menu"
          className="inline-flex h-11 w-11 items-center justify-center rounded-full transition-opacity hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
        >
          <Avatar className="h-9 w-9">
            <AvatarFallback className="bg-surface text-foreground font-medium text-sm border border-border">
              {initials}
            </AvatarFallback>
          </Avatar>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="min-w-[12rem]">
          <DropdownMenuLabel
            data-testid="profile-dropdown-name"
            className="font-normal text-foreground"
          >
            {displayName}
          </DropdownMenuLabel>
          <DropdownMenuSeparator />
          {/* min-h-11 on both items: 44px touch targets. The base
              DropdownMenuItem is ~32px, and sizing only the sign-out row would
              leave the menu visibly uneven. */}
          <DropdownMenuItem asChild className="min-h-11">
            <Link href="/app/account" data-testid="profile-dropdown-account">
              Account
            </Link>
          </DropdownMenuItem>
          <DropdownMenuItem
            data-testid="profile-dropdown-signout"
            className="min-h-11"
            disabled={signingOut}
            onSelect={(event) => {
              // preventDefault keeps the menu open — Radix would otherwise
              // close it on select, hiding the pending state we just set.
              event.preventDefault();
              setSigningOut(true);
              formRef.current?.requestSubmit();
            }}
          >
            {signingOut ? "Signing out…" : "Sign out"}
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
      <form
        ref={formRef}
        action={signOut}
        onSubmit={() => {
          // Cross-tab sign-out broadcast (📌 DECISION-N amendment
          // 2026-05-22). Same contract as SignOutButton — write the
          // marker before the server action runs so sibling tabs
          // catch the storage event while the user still has a
          // session.
          broadcastSignOut();
        }}
        className="hidden"
      />
    </>
  );
}
