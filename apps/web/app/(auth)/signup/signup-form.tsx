"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";

import { signUpSchema, type SignUpInput } from "@/lib/auth/schemas";
import { TermsAcknowledgementField } from "@/components/consent/terms-acknowledgement-field";
import { TERMS_ACK_STALE_MESSAGE } from "@/lib/consent/copy";
import { Field } from "@/components/ui/auth/field";
import { PasswordRequirements } from "@/components/ui/auth/password-requirements";
import { OtpPanel } from "@/components/ui/auth/otp-panel";
import {
  signUp,
  signUpFromForm,
  verifySignupOtp,
  type SignUpResult,
} from "./actions";

type Props = {
  initialCheckEmail?: boolean;
  initialEmail?: string | null;
  /** Current `terms_privacy` revision id, resolved by the server component. */
  termsVersionId: string;
};

export function SignupForm({
  initialCheckEmail = false,
  initialEmail = null,
  termsVersionId,
}: Props) {
  const router = useRouter();
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
    resetField,
    formState: { errors },
  } = useForm<SignUpInput>({
    resolver: zodResolver(signUpSchema),
    mode: "onTouched",
    // The acknowledgement is deliberately absent from defaultValues — it must start
    // unsatisfied so the resolver rejects an untouched submission (FR-033). Only the
    // version id is seeded, because it is the page's own state rather than the
    // visitor's answer.
    defaultValues: { terms_privacy_version: termsVersionId },
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
      // This FormData is hand-built, so the acknowledgement fields must be set here
      // explicitly. Omitting them would make every JS submission arrive at the server
      // with no accept_terms at all and be rejected — the gate would look broken rather
      // than strict, and only for the users who have JS.
      form.set("accept_terms", values.accept_terms);
      // The PROP, not values.terms_privacy_version. react-hook-form captures
      // defaultValues once at mount and never re-syncs them, but the stale_terms
      // recovery below deliberately refreshes the server component WITHOUT unmounting
      // this form (so the typed password survives). Reading RHF's copy would therefore
      // resubmit the superseded id forever, and only a hard reload would escape — the
      // no-JS path would recover and the JS path would not. The prop is re-rendered by
      // the refresh, so it is always the server's current value.
      form.set("terms_privacy_version", termsVersionId);
      const result = await signUp(form);
      setSubmitState(result);
      if (result.status === "ok") {
        setSubmittedEmail(values.email);
      }
      if (result.status === "stale_terms") {
        // The documents were revised while this page sat open. Clear the acknowledgement
        // so it has to be given again against the new wording, and refresh the server
        // component so the links and the hidden version id are the CURRENT ones.
        // router.refresh() re-runs the server render without unmounting this form, so
        // the name, email and password the visitor already typed all survive.
        resetField("accept_terms");
        router.refresh();
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
            successNote="Taking you in…"
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
            className="text-meadow-text underline-offset-4 hover:underline"
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
            className="rounded-control border border-foggy/30 bg-foggy/10 px-3 py-2 text-sm text-ink"
          >
            {existsMessage}{" "}
            <Link
              href="/login"
              className="text-meadow-text underline-offset-4 hover:underline"
            >
              Sign in
            </Link>{" "}
            ·{" "}
            <Link
              href="/forgot-password"
              className="text-meadow-text underline-offset-4 hover:underline"
            >
              Reset password
            </Link>
          </p>
        )}

        {errorMessage && submitState?.status === "error" && (
          <p
            role="alert"
            className="rounded-control border border-foggy/30 bg-foggy/10 px-3 py-2 text-sm text-ink"
          >
            {errorMessage}
          </p>
        )}

        {submitState?.status === "stale_terms" && (
          <p
            role="alert"
            className="rounded-control border border-foggy/30 bg-foggy/10 px-3 py-2 text-sm text-ink"
          >
            {TERMS_ACK_STALE_MESSAGE}
          </p>
        )}

        <TermsAcknowledgementField
          versionId={termsVersionId}
          error={errors.accept_terms?.message}
          registration={register("accept_terms")}
        />

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
            className="text-meadow-text underline-offset-4 hover:underline"
          >
            Sign in
          </Link>
        </p>
      </form>
    </section>
  );
}
