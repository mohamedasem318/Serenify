"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";

import { signUpSchema, type SignUpInput } from "@/lib/auth/schemas";
import { PasswordInput } from "@/components/ui/password-input";
import { PasswordRequirements } from "@/components/ui/password-requirements";
import { OtpPanel } from "../otp-panel";
import {
  signUp,
  signUpFromForm,
  verifySignupOtp,
  type SignUpResult,
} from "./actions";

type Props = {
  initialCheckEmail?: boolean;
  initialEmail?: string | null;
};

export function SignupForm({
  initialCheckEmail = false,
  initialEmail = null,
}: Props) {
  const [pending, startTransition] = useTransition();
  const [submitState, setSubmitState] = useState<SignUpResult | null>(
    initialCheckEmail ? { status: "ok" } : null,
  );
  const [submittedEmail, setSubmittedEmail] = useState<string | null>(
    initialEmail,
  );

  const {
    register,
    handleSubmit,
    control,
    formState: { errors },
  } = useForm<SignUpInput>({
    resolver: zodResolver(signUpSchema),
    mode: "onTouched",
  });

  // useWatch (not the watch() function returned by useForm) is the
  // memoization-safe way to read a single field reactively — react-
  // hooks/incompatible-library flags watch() because its identity
  // changes per render.
  const passwordValue = useWatch({ control, name: "password" }) ?? "";

  function onSubmit(values: SignUpInput) {
    startTransition(async () => {
      const form = new FormData();
      form.set("email", values.email);
      form.set("password", values.password);
      form.set("full_name", values.full_name);
      const result = await signUp(form);
      setSubmitState(result);
      if (result.status === "ok") {
        setSubmittedEmail(values.email);
      }
    });
  }

  if (submitState?.status === "ok") {
    return (
      <section className="space-y-6">
        <header className="space-y-2">
          <h1 className="font-display text-2xl text-ink sm:text-3xl">
            Check your email
          </h1>
          <p className="text-sm leading-relaxed text-muted">
            We sent a confirmation link
            {submittedEmail ? (
              <>
                {" "}
                to <span className="text-ink">{submittedEmail}</span>
              </>
            ) : null}
            . Open it on this device to finish setting up your account.
          </p>
        </header>

        {submittedEmail && (
          <OtpPanel
            email={submittedEmail}
            action={verifySignupOtp}
            successHref="/app"
            helperText="The email also includes a 6-digit code. Enter it here if the link doesn't work."
          />
        )}

        <p className="pt-2 text-sm text-muted">
          Wrong email?{" "}
          <button
            type="button"
            onClick={() => {
              setSubmitState(null);
              setSubmittedEmail(null);
            }}
            className="text-meadow underline-offset-4 hover:underline"
          >
            Start over
          </button>
        </p>
      </section>
    );
  }

  const existsMessage =
    submitState?.status === "exists"
      ? "This email already has an account. Sign in, or reset your password."
      : null;
  const errorMessage =
    submitState?.status === "error"
      ? submitState.message
      : submitState?.status === "validation"
        ? submitState.message
        : null;

  return (
    <section className="space-y-8">
      <header className="space-y-2">
        <h1 className="font-display text-3xl leading-tight text-ink sm:text-4xl">
          Create your account
        </h1>
        <p className="text-sm leading-relaxed text-muted">
          A calm way to notice workplace stress.
        </p>
      </header>

      <form
        noValidate
        action={signUpFromForm}
        onSubmit={handleSubmit(onSubmit)}
        className="space-y-6"
      >
        <Field
          id="full_name"
          label="Full name"
          autoComplete="name"
          {...register("full_name")}
          error={errors.full_name?.message}
        />
        <Field
          id="email"
          label="Email"
          type="email"
          autoComplete="email"
          inputMode="email"
          {...register("email")}
          error={errors.email?.message}
        />
        <div className="space-y-2">
          <Field
            id="password"
            label="Password"
            type="password"
            autoComplete="new-password"
            {...register("password")}
            error={errors.password?.message}
          />
          <PasswordRequirements
            id="password-requirements"
            value={passwordValue}
          />
        </div>

        {existsMessage && (
          <p
            role="status"
            className="rounded-control border border-amber/50 bg-amber/10 px-3 py-2 text-sm text-ink"
          >
            {existsMessage}{" "}
            <Link
              href="/login"
              className="text-meadow underline-offset-4 hover:underline"
            >
              Sign in
            </Link>{" "}
            ·{" "}
            <Link
              href="/forgot-password"
              className="text-meadow underline-offset-4 hover:underline"
            >
              Reset password
            </Link>
          </p>
        )}

        {errorMessage && submitState?.status === "error" && (
          <p
            role="alert"
            className="rounded-control border border-amber/50 bg-amber/10 px-3 py-2 text-sm text-ink"
          >
            {errorMessage}
          </p>
        )}

        <button
          type="submit"
          disabled={pending}
          className="inline-flex h-12 w-full items-center justify-center rounded-control bg-ink px-4 text-sm font-medium text-bg transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {pending ? "Creating account…" : "Create account"}
        </button>

        <p className="text-sm text-muted">
          Already have an account?{" "}
          <Link
            href="/login"
            className="text-meadow underline-offset-4 hover:underline"
          >
            Sign in
          </Link>
        </p>
      </form>
    </section>
  );
}

type FieldProps = React.InputHTMLAttributes<HTMLInputElement> & {
  id: string;
  label: string;
  helper?: string;
  error?: string;
};

const Field = (props: FieldProps) => {
  const { id, label, helper, error, type, ...inputProps } = props;
  const helperId = helper ? `${id}-helper` : undefined;
  const errorId = error ? `${id}-error` : undefined;
  const describedBy =
    [helperId, errorId].filter(Boolean).join(" ") || undefined;
  return (
    <div className="space-y-1.5">
      <label
        htmlFor={id}
        className="block text-xs font-medium uppercase tracking-wide text-muted"
      >
        {label}
      </label>
      {type === "password" ? (
        <PasswordInput
          id={id}
          aria-invalid={error ? true : undefined}
          aria-describedby={describedBy}
          {...inputProps}
        />
      ) : (
        <input
          id={id}
          type={type}
          aria-invalid={error ? true : undefined}
          aria-describedby={describedBy}
          {...inputProps}
          className="h-12 w-full rounded-control border border-border bg-surface px-3 text-base text-ink outline-none transition-colors placeholder:text-muted focus:border-meadow"
        />
      )}
      {helper && !error && (
        <p id={helperId} className="text-xs text-muted">
          {helper}
        </p>
      )}
      {error && (
        <p id={errorId} className="text-xs text-ink">
          {error}
        </p>
      )}
    </div>
  );
};
