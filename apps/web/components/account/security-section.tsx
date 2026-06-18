"use client";

import { useState, useTransition } from "react";
import { useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";

import {
  changePassword,
  type ChangePasswordResult,
} from "@/app/(authed)/app/account/actions";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/auth/field";
import { PasswordRequirements } from "@/components/ui/auth/password-requirements";
import {
  changePasswordSchema,
  type ChangePasswordInput,
} from "@/lib/auth/schemas";

const EMPTY_FORM: ChangePasswordInput = {
  current_password: "",
  new_password: "",
  confirm_password: "",
};

export function SecuritySection() {
  const [pending, startTransition] = useTransition();
  const [submitState, setSubmitState] =
    useState<ChangePasswordResult | null>(null);

  const {
    register,
    handleSubmit,
    control,
    reset,
    formState: { errors },
  } = useForm<ChangePasswordInput>({
    resolver: zodResolver(changePasswordSchema),
    mode: "onTouched",
    defaultValues: EMPTY_FORM,
  });

  // useWatch (not the watch() function returned by useForm) is the
  // memoization-safe way to read a single field reactively — matches
  // the pattern feature 001's reset-form.tsx uses to keep the
  // PasswordRequirements checklist live without tripping the
  // react-hooks/incompatible-library warning.
  const newPasswordValue =
    useWatch({ control, name: "new_password" }) ?? "";

  function onSubmit(values: ChangePasswordInput) {
    setSubmitState(null);
    startTransition(async () => {
      const form = new FormData();
      form.set("current_password", values.current_password);
      form.set("new_password", values.new_password);
      form.set("confirm_password", values.confirm_password);
      const result = await changePassword(form);
      setSubmitState(result);
      if (result.status === "ok") {
        // Wipe the form back to empty so a refresh of the section
        // doesn't leave the new password sitting in the inputs.
        reset(EMPTY_FORM);
      }
    });
  }

  return (
    <section
      aria-labelledby="account-security-heading"
      className="space-y-6"
    >
      <header>
        <h2
          id="account-security-heading"
          className="font-display text-2xl leading-tight text-ink"
        >
          Security
        </h2>
      </header>

      <form
        noValidate
        onSubmit={handleSubmit(onSubmit)}
        className="space-y-6"
      >
        <Field
          id="current_password"
          label="Current password"
          type="password"
          autoComplete="current-password"
          {...register("current_password")}
          error={errors.current_password?.message}
        />

        <div className="space-y-2">
          <Field
            id="new_password"
            label="New password"
            type="password"
            autoComplete="new-password"
            aria-describedby="security-new-password-requirements"
            {...register("new_password")}
            error={errors.new_password?.message}
          />
          <PasswordRequirements
            id="security-new-password-requirements"
            value={newPasswordValue}
          />
        </div>

        <Field
          id="confirm_password"
          label="Confirm new password"
          type="password"
          autoComplete="new-password"
          {...register("confirm_password")}
          error={errors.confirm_password?.message}
        />

        {submitState?.status === "invalid" && (
          <p
            role="alert"
            className="rounded-control border border-foggy/30 bg-foggy/10 px-3 py-2 text-sm text-ink"
          >
            {submitState.message}
          </p>
        )}

        {submitState?.status === "ok" && (
          <p
            role="status"
            className="rounded-control border border-meadow/50 bg-meadow/10 px-3 py-2 text-sm text-ink"
          >
            Password updated.
          </p>
        )}

        <Button type="submit" variant="secondary" disabled={pending}>
          {pending ? "Saving…" : "Save password"}
        </Button>
      </form>
    </section>
  );
}
