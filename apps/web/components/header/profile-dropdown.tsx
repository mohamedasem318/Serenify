"use client";

import Link from "next/link";
import { useRef } from "react";

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
import { truncateName } from "@/lib/truncate-name";

type ProfileDropdownProps = {
  fullName: string | null;
  email: string;
};

function deriveInitials(fullName: string | null, email: string): string {
  if (fullName) {
    const tokens = fullName.trim().split(/\s+/).filter(Boolean);
    if (tokens.length >= 2) {
      const first = tokens[0]!;
      const last = tokens[tokens.length - 1]!;
      return (first[0]! + last[0]!).toUpperCase();
    }
    if (tokens.length === 1) {
      const only = tokens[0]!;
      return (only.slice(0, 2) || only[0] || "").toUpperCase();
    }
  }
  const local = email.split("@")[0] ?? "";
  return (local.slice(0, 2) || "?").toUpperCase();
}

function deriveDisplayName(fullName: string | null, email: string): string {
  if (fullName && fullName.trim().length > 0) {
    return truncateName(fullName.trim());
  }
  return email;
}

export function ProfileDropdown({ fullName, email }: ProfileDropdownProps) {
  const formRef = useRef<HTMLFormElement>(null);
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
          <DropdownMenuItem asChild>
            <Link href="/app/account" data-testid="profile-dropdown-account">
              Account
            </Link>
          </DropdownMenuItem>
          <DropdownMenuItem
            data-testid="profile-dropdown-signout"
            onSelect={(event) => {
              event.preventDefault();
              formRef.current?.requestSubmit();
            }}
          >
            Sign out
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
      <form ref={formRef} action={signOut} className="hidden" />
    </>
  );
}
