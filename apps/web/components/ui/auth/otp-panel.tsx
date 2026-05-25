"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import {
  broadcastSignIn,
  destinationBroadcastsSignIn,
} from "@/lib/auth-broadcast";

// Shared shape of the verify Server Action result — matches both
// verifySignupOtp and verifyResetOtp in their respective action
// modules. Defined as a structural type here so each caller can pass
// its own action without a circular import.
export type VerifyOtpActionResult =
  | { status: "ok" }
  | { status: "invalid"; message: string }
  | { status: "validation"; message: string };

export type VerifyOtpAction = (
  formData: FormData,
) => Promise<VerifyOtpActionResult>;

type Props = {
  /** Pre-filled, read-only email. Omit to render an email input. */
  email?: string;
  action: VerifyOtpAction;
  successHref: string;
  helperText: string;
};

/**
 * FR-020 — 6-digit OTP fallback. Inline beside the "check your email"
 * (signup) and "your link expired" (reset) panels. Same outcome as
 * clicking the magic link.
 *
 * If `email` is supplied (signup confirmation, recovery happy path)
 * it's surfaced read-only above the code input. If omitted (reset
 * expired-link path) the user types their email alongside the code.
 */
export function OtpPanel({ email, action, successHref, helperText }: Props) {
  const router = useRouter();
  const [emailValue, setEmailValue] = useState(email ?? "");
  const [token, setToken] = useState("");
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    const codeValue = token.trim();
    const emailFinal = (email ?? emailValue).trim();
    if (!emailFinal) {
      setError("Enter the email you used to sign up.");
      return;
    }
    if (!/^\d{6}$/.test(codeValue)) {
      setError("Enter the 6-digit code from the email.");
      return;
    }
    startTransition(async () => {
      const form = new FormData();
      form.set("email", emailFinal);
      form.set("token", codeValue);
      const result = await action(form);
      if (result.status === "ok") {
        // 📌 OTP cross-tab fix (2026-05-25): OTP verify is an
        // auth-completing path. Unlike /auth/callback (a server-only
        // Route Handler that needs the AUTH_SIGNIN_COOKIE bridge), this
        // is client-driven — like login-form.tsx, we can write the
        // localStorage broadcast marker directly so sibling tabs
        // propagate. Gated by successHref so the recovery flow
        // (verifyResetOtp → /reset-password) doesn't broadcast a
        // spurious sign-in (preserves smoke ST-9); only the signup
        // confirmation path (→ /app) does.
        if (destinationBroadcastsSignIn(successHref)) {
          broadcastSignIn();
        }
        router.replace(successHref);
        router.refresh();
        return;
      }
      setError(result.message);
    });
  }

  return (
    <section
      aria-labelledby="otp-heading"
      className="space-y-3 rounded-card border border-border bg-surface px-4 py-4"
    >
      <h2
        id="otp-heading"
        className="text-xs font-medium uppercase tracking-wide text-muted"
      >
        Enter the code instead
      </h2>
      <p className="text-sm leading-relaxed text-muted">{helperText}</p>
      <form noValidate onSubmit={submit} className="space-y-3">
        {email ? (
          <p className="text-xs text-muted">
            Code for <span className="text-ink">{email}</span>
          </p>
        ) : (
          <>
            <label htmlFor="otp-email" className="sr-only">
              Email
            </label>
            <input
              id="otp-email"
              type="email"
              inputMode="email"
              autoComplete="email"
              value={emailValue}
              onChange={(e) => setEmailValue(e.target.value)}
              placeholder="you@example.com"
              className="h-12 w-full rounded-control border border-border bg-bg px-3 text-base text-ink outline-none placeholder:text-muted focus:border-meadow"
            />
          </>
        )}
        <label htmlFor="otp-token" className="sr-only">
          6-digit code
        </label>
        <input
          id="otp-token"
          type="text"
          inputMode="numeric"
          autoComplete="one-time-code"
          maxLength={6}
          pattern="\d{6}"
          value={token}
          onChange={(e) =>
            setToken(e.target.value.replace(/\D/g, "").slice(0, 6))
          }
          placeholder="123456"
          aria-invalid={error ? true : undefined}
          className="h-12 w-full rounded-control border border-border bg-bg px-3 text-center text-base tracking-[0.5em] text-ink outline-none placeholder:tracking-normal placeholder:text-muted focus:border-meadow"
        />
        {error && (
          <p
            role="alert"
            className="rounded-control border border-amber/50 bg-amber/10 px-3 py-2 text-sm text-ink"
          >
            {error}
          </p>
        )}
        <button
          type="submit"
          disabled={pending || token.length < 6}
          className="inline-flex h-11 w-full items-center justify-center rounded-control border border-ink bg-bg px-4 text-sm font-medium text-ink transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {pending ? "Verifying…" : "Verify code"}
        </button>
      </form>
    </section>
  );
}
