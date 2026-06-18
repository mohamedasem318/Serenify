"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";

import { signInSchema, type SignInInput } from "@/lib/auth/schemas";
import { Field } from "@/components/ui/auth/field";
import { broadcastSignIn } from "@/lib/auth-broadcast";
import {
  resendConfirmation,
  signIn,
  signInFromForm,
  type SignInResult,
} from "./actions";

export function LoginForm() {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [submitState, setSubmitState] = useState<SignInResult | null>(null);
  const [resent, setResent] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<SignInInput>({
    resolver: zodResolver(signInSchema),
    mode: "onTouched",
  });

  function onSubmit(values: SignInInput) {
    startTransition(async () => {
      const form = new FormData();
      form.set("email", values.email);
      form.set("password", values.password);
      const result = await signIn(form);
      setSubmitState(result);
      if (result.status === "ok") {
        // Cross-tab sign-in broadcast (📌 DECISION-N amendment 2026-05-22):
        // cookies don't fire storage events, so feature 003's
        // cross-tab listener relies on this explicit marker. Writing
        // happens BEFORE router.replace so sibling tabs see the storage
        // event while their CrossTabAuth listeners are still subscribed
        // at the /login pathname.
        broadcastSignIn();
        router.replace("/app");
        router.refresh();
      }
    });
  }

  return (
    <section className="space-y-8">
      <header className="space-y-2">
        <h1 className="font-display text-3xl leading-tight text-ink sm:text-4xl">
          Welcome back
        </h1>
        <p className="text-sm leading-relaxed text-muted">
          Sign in to your Serenify workspace.
        </p>
      </header>

      <form
        noValidate
        action={signInFromForm}
        onSubmit={handleSubmit(onSubmit)}
        className="space-y-6"
      >
        <Field
          id="email"
          label="Email"
          type="email"
          autoComplete="email"
          inputMode="email"
          {...register("email")}
          error={errors.email?.message}
        />
        <Field
          id="password"
          label="Password"
          type="password"
          autoComplete="current-password"
          {...register("password")}
          error={errors.password?.message}
        />

        {submitState?.status === "invalid" && (
          <p
            role="alert"
            className="rounded-control border border-foggy/30 bg-foggy/10 px-3 py-2 text-sm text-ink"
          >
            Those details didn&apos;t match an account. Try again, or{" "}
            <Link
              href="/forgot-password"
              className="text-meadow-text underline-offset-4 hover:underline"
            >
              reset your password
            </Link>
            .
          </p>
        )}

        {submitState?.status === "unconfirmed" && (
          <div
            role="status"
            className="space-y-2 rounded-control border border-foggy/30 bg-foggy/10 px-3 py-3 text-sm text-ink"
          >
            <p>Confirm your email first. We can send a fresh link.</p>
            <button
              type="button"
              disabled={resent}
              onClick={() => {
                resendConfirmation(submitState.email);
                setResent(true);
              }}
              className="text-meadow-text underline-offset-4 hover:underline disabled:opacity-60"
            >
              {resent ? "Link sent." : "Send a new confirmation link"}
            </button>
          </div>
        )}

        {submitState?.status === "error" && (
          <p
            role="alert"
            className="rounded-control border border-foggy/30 bg-foggy/10 px-3 py-2 text-sm text-ink"
          >
            {submitState.message}
          </p>
        )}

        <button
          type="submit"
          disabled={pending}
          className="inline-flex h-12 w-full items-center justify-center rounded-control bg-ink px-4 text-sm font-medium text-bg transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {pending ? "Signing in…" : "Sign in"}
        </button>

        <div className="flex items-center justify-between text-sm text-muted">
          <Link
            href="/forgot-password"
            className="text-meadow-text underline-offset-4 hover:underline"
          >
            Forgot password?
          </Link>
          <Link
            href="/signup"
            className="text-meadow-text underline-offset-4 hover:underline"
          >
            Create account
          </Link>
        </div>
      </form>
    </section>
  );
}
