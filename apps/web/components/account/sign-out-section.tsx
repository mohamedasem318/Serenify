import { SignOutButton } from "@/components/sign-out-button";

export function SignOutSection() {
  return (
    <section
      aria-labelledby="account-signout-heading"
      className="space-y-4"
    >
      <header className="space-y-1.5">
        <h2
          id="account-signout-heading"
          className="font-display text-2xl leading-tight text-ink"
        >
          Sign out
        </h2>
        <p className="text-sm leading-relaxed text-muted">
          You&apos;ll need to sign in again to come back.
        </p>
      </header>
      <SignOutButton variant="secondary" />
    </section>
  );
}
