"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";

import {
  resetPasswordSchema,
  type ResetPasswordInput,
} from "@/lib/auth/schemas";
import { Field } from "@/components/ui/auth/field";
import { PasswordRequirements } from "@/components/ui/auth/password-requirements";
import { updatePassword, updatePasswordFromForm } from "./actions";

type Props = {
  authenticated: boolean;
};

export function ResetForm({ authenticated }: Props) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [submitError, setSubmitError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    control,
    formState: { errors },
  } = useForm<ResetPasswordInput>({
    resolver: zodResolver(resetPasswordSchema),
    mode: "onTouched",
  });

  // useWatch (not the watch() function returned by useForm) is the
  // memoization-safe way to read a single field reactively — react-
  // hooks/incompatible-library flags watch() because its identity
  // changes per render.
  const newPasswordValue =
    useWatch({ control, name: "new_password" }) ?? "";

  function onSubmit(values: ResetPasswordInput) {
    setSubmitError(null);
    startTransition(async () => {
      const form = new FormData();
      form.set("new_password", values.new_password);
      form.set("confirm_password", values.confirm_password);
      const result = await updatePassword(form);
      if (result.status === "ok") {
        router.replace("/login?flash=password_updated");
        router.refresh();
        return;
      }
      setSubmitError(result.message);
    });
  }

  if (!authenticated) {
    return (
      <section className="space-y-4">
        <h1 className="font-display text-2xl text-ink sm:text-3xl">
          Your link expired
        </h1>
        <p className="text-sm leading-relaxed text-muted">
          Reset links are one-time use and time-limited.
        </p>
        <p className="pt-2 text-sm text-muted">
          <Link
            href="/forgot-password"
            className="text-meadow-text underline-offset-4 hover:underline"
          >
            Send a fresh email
          </Link>
        </p>
      </section>
    );
  }

  return (
    <section className="space-y-8">
      <header className="space-y-2">
        <h1 className="font-display text-3xl leading-tight text-ink sm:text-4xl">
          Set a new password
        </h1>
        <p className="text-sm leading-relaxed text-muted">
          Choose something you&apos;ll remember.
        </p>
      </header>

      <form
        noValidate
        action={updatePasswordFromForm}
        onSubmit={handleSubmit(onSubmit)}
        className="space-y-6"
      >
        <div className="space-y-2">
          <Field
            id="new_password"
            label="New password"
            type="password"
            autoComplete="new-password"
            {...register("new_password")}
            error={errors.new_password?.message}
          />
          <PasswordRequirements
            id="new-password-requirements"
            value={newPasswordValue}
          />
        </div>
        <Field
          id="confirm_password"
          label="Confirm password"
          type="password"
          autoComplete="new-password"
          {...register("confirm_password")}
          error={errors.confirm_password?.message}
        />

        {submitError && (
          <p
            role="alert"
            className="rounded-control border border-foggy/30 bg-foggy/10 px-3 py-2 text-sm text-ink"
          >
            {submitError}
          </p>
        )}

        <button
          type="submit"
          disabled={pending}
          className="inline-flex h-12 w-full items-center justify-center rounded-control bg-ink px-4 text-sm font-medium text-bg transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {pending ? "Saving…" : "Update password"}
        </button>
      </form>
    </section>
  );
}
