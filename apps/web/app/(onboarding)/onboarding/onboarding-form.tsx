"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";

import { AnchorRecorder } from "@/components/anchor/anchor-recorder";
import {
  onboardingSchema,
  type OnboardingInput,
} from "@/lib/auth/schemas";
import { completeOnboarding, type OnboardingResult } from "./actions";

export function OnboardingForm({ defaultFullName }: { defaultFullName?: string }) {
  const router = useRouter();
  const [step, setStep] = useState<"name" | "anchor">("name");
  const [pending, startTransition] = useTransition();
  const [submitState, setSubmitState] = useState<OnboardingResult | null>(null);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<OnboardingInput>({
    resolver: zodResolver(onboardingSchema),
    mode: "onBlur",
    defaultValues: { full_name: defaultFullName ?? "" },
  });

  function onSubmit(values: OnboardingInput) {
    startTransition(async () => {
      const form = new FormData();
      form.set("full_name", values.full_name);
      const result = await completeOnboarding(form);
      // Managers redirect server-side (no result reaches here). Employees get
      // { status: "ok" } and advance in-page to the anchor step — proxy.ts
      // bounces a full /onboarding reload to /app once full_name is set, so the
      // step must live in client state (📌 DECISION-14).
      if (result?.status === "ok") {
        setStep("anchor");
      } else if (result) {
        setSubmitState(result);
      }
    });
  }

  if (step === "anchor") {
    return (
      <AnchorRecorder
        context="onboarding"
        onComplete={() => router.replace("/app")}
        onSkip={() => router.replace("/app")}
      />
    );
  }

  return (
    <section className="space-y-8">
      <header className="space-y-2">
        <h1 className="font-display text-3xl leading-tight text-ink sm:text-4xl">
          Let&apos;s introduce you
        </h1>
        <p className="text-sm leading-relaxed text-muted">
          The name your colleagues will see.
        </p>
      </header>

      <form
        noValidate
        onSubmit={handleSubmit(onSubmit)}
        className="space-y-6"
      >
        <div className="space-y-1.5">
          <label
            htmlFor="full_name"
            className="block text-xs font-medium uppercase tracking-wide text-muted"
          >
            Full name
          </label>
          <input
            id="full_name"
            autoComplete="name"
            aria-invalid={errors.full_name ? true : undefined}
            {...register("full_name")}
            className="h-12 w-full rounded-control border border-border bg-surface px-3 text-base text-ink outline-none transition-colors placeholder:text-muted focus:border-meadow"
          />
          {errors.full_name?.message && (
            <p className="text-xs text-ink">{errors.full_name.message}</p>
          )}
        </div>

        {submitState && submitState.status !== "ok" && (
          <p
            role="alert"
            className="rounded-control border border-amber/50 bg-amber/10 px-3 py-2 text-sm text-ink"
          >
            {submitState.message}
          </p>
        )}

        <button
          type="submit"
          disabled={pending}
          className="inline-flex h-12 w-full items-center justify-center rounded-control bg-ink px-4 text-sm font-medium text-bg transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {pending ? "Saving…" : "Continue"}
        </button>
      </form>
    </section>
  );
}
