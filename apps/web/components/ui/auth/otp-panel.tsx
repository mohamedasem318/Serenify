"use client";

import { useRouter } from "next/navigation";
import { useRef, useState } from "react";

import {
  broadcastSignIn,
  destinationBroadcastsSignIn,
} from "@/lib/auth-broadcast";
import { useMediaQuery } from "@/hooks/use-media-query";

import { OtpBoxes, type OtpBoxesHandle } from "./otp-boxes";
import { OtpNotice } from "./otp-notice";

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

const EMPTY: string[] = ["", "", "", "", "", ""];

/**
 * 6-digit OTP fallback. Inline beside the "check your email" (signup) and
 * "your link expired" (reset) panels. Same outcome as clicking the magic link.
 *
 * If `email` is supplied (signup confirmation, recovery happy path) it's
 * surfaced read-only above the code input. If omitted (reset expired-link path)
 * the user types their email alongside the code.
 *
 * Presentation is the six-box merge (FR-023…FR-027, source of truth
 * `serenify-007-otp-mock.html`); the verification/validation logic, the
 * server-action calls, the cross-tab sign-in broadcast gate, and the success
 * navigation are unchanged from the prior single-input version (FR-004). The
 * code auto-submits the moment all six digits are present — the boxes
 * themselves resolve into the verified pill, so there is no separate submit
 * button (the prior amber-error single-input form is retired per FR-002).
 */
export function OtpPanel({ email, action, successHref, helperText }: Props) {
  const router = useRouter();
  const reducedMotion = useMediaQuery("(prefers-reduced-motion: reduce)");
  const boxesRef = useRef<OtpBoxesHandle>(null);

  const [emailValue, setEmailValue] = useState(email ?? "");
  const [digits, setDigits] = useState<string[]>(EMPTY);
  const [status, setStatus] = useState<"input" | "verifying" | "success" | "error">(
    "input",
  );
  const [error, setError] = useState<string | null>(null);

  async function verify(code: string) {
    setError(null);
    const emailFinal = (email ?? emailValue).trim();
    if (!emailFinal) {
      setError("Enter the email you used to sign up.");
      return;
    }
    if (!/^\d{6}$/.test(code)) {
      setError("Enter the 6-digit code from the email.");
      return;
    }
    setStatus("verifying");
    const form = new FormData();
    form.set("email", emailFinal);
    form.set("token", code);
    const result = await action(form);
    if (result.status === "ok") {
      // 📌 OTP cross-tab fix (2026-05-25): OTP verify is an auth-completing
      // path. Unlike /auth/callback (a server-only Route Handler that needs the
      // AUTH_SIGNIN_COOKIE bridge), this is client-driven — like
      // login-form.tsx, we write the localStorage broadcast marker directly so
      // sibling tabs propagate. Gated by successHref so the recovery flow
      // (verifyResetOtp → /reset-password) doesn't broadcast a spurious sign-in
      // (preserves smoke ST-9); only the signup confirmation path (→ /app) does.
      if (destinationBroadcastsSignIn(successHref)) {
        broadcastSignIn();
      }
      // Let the merge-into-pill animation read before handing off (reduced
      // motion shows the pill directly, then navigates). Behaviour is
      // unchanged: the same router.replace(successHref) + refresh as before.
      setStatus("success");
      await boxesRef.current?.playSuccess();
      router.replace(successHref);
      router.refresh();
      return;
    }
    setError(result.message);
    setStatus("error");
    await boxesRef.current?.playError();
    // Clear + re-enable; OtpBoxes returns focus to box 1 once it re-enables.
    setDigits(EMPTY);
    setStatus("input");
  }

  // Auto-submit the instant all six digits are present (typed or pasted). A
  // sub-6-digit code never reaches the action. Editing while a notice is shown
  // dismisses it (error-recovery).
  function handleDigits(next: string[]) {
    if (status !== "input") return;
    setDigits(next);
    setError(null);
    const code = next.join("");
    if (/^\d{6}$/.test(code)) {
      void verify(code);
    }
  }

  // Email-input fallback path only: if the code was completed before the email,
  // verify when the email field is left.
  function handleEmailBlur() {
    if (status !== "input") return;
    const code = digits.join("");
    if (/^\d{6}$/.test(code) && (email ?? emailValue).trim()) {
      void verify(code);
    }
  }

  return (
    <section
      aria-labelledby="otp-heading"
      className="space-y-4 rounded-card border border-border bg-surface px-3 py-5 sm:px-4"
    >
      <div className="space-y-1.5">
        <h2
          id="otp-heading"
          className="text-xs font-medium uppercase tracking-wide text-muted"
        >
          Enter the code instead
        </h2>
        <p className="text-sm leading-relaxed text-muted">{helperText}</p>
      </div>

      {email ? (
        <p className="text-xs text-muted">
          Code for <span className="text-ink">{email}</span>
        </p>
      ) : (
        <div className="space-y-1.5">
          <label htmlFor="otp-email" className="sr-only">
            Email
          </label>
          <input
            id="otp-email"
            type="email"
            inputMode="email"
            autoComplete="email"
            value={emailValue}
            onChange={(e) => {
              setEmailValue(e.target.value);
              setError(null);
            }}
            onBlur={handleEmailBlur}
            placeholder="you@example.com"
            className="h-12 w-full rounded-control border border-border bg-bg px-3 text-base text-ink outline-none placeholder:text-muted focus-visible:border-meadow focus-visible:outline-solid focus-visible:outline-2 focus-visible:outline-offset-0 focus-visible:outline-meadow"
          />
        </div>
      )}

      <OtpBoxes
        ref={boxesRef}
        digits={digits}
        onDigitsChange={handleDigits}
        disabled={status !== "input"}
        reducedMotion={reducedMotion}
        invalid={status === "error"}
      />

      {error && <OtpNotice>{error}</OtpNotice>}
    </section>
  );
}
