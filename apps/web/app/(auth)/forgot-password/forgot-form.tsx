"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";

import {
  forgotPasswordSchema,
  type ForgotPasswordInput,
} from "@/lib/auth/schemas";
import { OtpPanel } from "../otp-panel";
import { verifyResetOtp } from "../reset-password/actions";
import {
  requestPasswordReset,
  requestPasswordResetFromForm,
} from "./actions";

type Props = {
  initialSent?: boolean;
  initialEmail?: string | null;
};

export function ForgotForm({
  initialSent = false,
  initialEmail = null,
}: Props) {
  const [pending, startTransition] = useTransition();
  const [sent, setSent] = useState(initialSent);
  const [submittedEmail, setSubmittedEmail] = useState<string | null>(
    initialEmail,
  );

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<ForgotPasswordInput>({
    resolver: zodResolver(forgotPasswordSchema),
    mode: "onTouched",
  });

  function onSubmit(values: ForgotPasswordInput) {
    startTransition(async () => {
      const form = new FormData();
      form.set("email", values.email);
      await requestPasswordReset(form);
      setSubmittedEmail(values.email);
      setSent(true);
    });
  }

  if (sent) {
    return (
      <section className="space-y-6">
        <header className="space-y-2">
          <h1 className="font-display text-2xl text-ink sm:text-3xl">
            Check your email
          </h1>
          <p className="text-sm leading-relaxed text-muted">
            If
            {submittedEmail ? (
              <>
                {" "}
                <span className="text-ink">{submittedEmail}</span>
              </>
            ) : (
              " that email"
            )}{" "}
            is registered, we&apos;ve sent a link to reset your password.
          </p>
        </header>

        {submittedEmail && (
          <OtpPanel
            email={submittedEmail}
            action={verifyResetOtp}
            successHref="/reset-password"
            helperText="The email also includes a 6-digit code. Enter it here if the link doesn't work."
          />
        )}

        <p className="pt-2 text-sm text-muted">
          <Link
            href="/login"
            className="text-meadow underline-offset-4 hover:underline"
          >
            Back to sign in
          </Link>
        </p>
      </section>
    );
  }

  return (
    <section className="space-y-8">
      <header className="space-y-2">
        <h1 className="font-display text-3xl leading-tight text-ink sm:text-4xl">
          Reset your password
        </h1>
        <p className="text-sm leading-relaxed text-muted">
          We&apos;ll send a link to set a new one.
        </p>
      </header>

      <form
        noValidate
        action={requestPasswordResetFromForm}
        onSubmit={handleSubmit(onSubmit)}
        className="space-y-6"
      >
        <div className="space-y-1.5">
          <label
            htmlFor="email"
            className="block text-xs font-medium uppercase tracking-wide text-muted"
          >
            Email
          </label>
          <input
            id="email"
            type="email"
            autoComplete="email"
            inputMode="email"
            aria-invalid={errors.email ? true : undefined}
            {...register("email")}
            className="h-12 w-full rounded-control border border-border bg-surface px-3 text-base text-ink outline-none transition-colors placeholder:text-muted focus:border-meadow"
          />
          {errors.email?.message && (
            <p className="text-xs text-ink">{errors.email.message}</p>
          )}
        </div>

        <button
          type="submit"
          disabled={pending}
          className="inline-flex h-12 w-full items-center justify-center rounded-control bg-ink px-4 text-sm font-medium text-bg transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {pending ? "Sending…" : "Send reset link"}
        </button>

        <p className="text-sm text-muted">
          Remembered it?{" "}
          <Link
            href="/login"
            className="text-meadow underline-offset-4 hover:underline"
          >
            Back to sign in
          </Link>
        </p>
      </form>
    </section>
  );
}
