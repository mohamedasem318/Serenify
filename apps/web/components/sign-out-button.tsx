"use client";

import { signOut } from "@/app/(authed)/actions";
import { Button } from "@/components/ui/button";

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
    <form action={signOut}>
      <Button type="submit" variant={variant} className={className}>
        {children}
      </Button>
    </form>
  );
}
