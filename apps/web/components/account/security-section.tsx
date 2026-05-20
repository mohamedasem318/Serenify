import Link from "next/link";

import { Button } from "@/components/ui/button";

export function SecuritySection() {
  return (
    <section
      aria-labelledby="account-security-heading"
      className="space-y-4"
    >
      <header className="space-y-1.5">
        <h2
          id="account-security-heading"
          className="font-display text-2xl leading-tight text-ink"
        >
          Security
        </h2>
        <p className="text-sm leading-relaxed text-muted">
          Change your password using the same flow you'd use if you forgot it
          — we'll email you a fresh reset link.
        </p>
      </header>
      <Button asChild variant="secondary">
        <Link href="/forgot-password">Change password</Link>
      </Button>
    </section>
  );
}
