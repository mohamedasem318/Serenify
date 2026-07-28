"use client";

import { useState, useTransition } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";

import { AnchorRecorder } from "@/components/anchor/anchor-recorder";
import { CameraConsentGate } from "@/components/consent/camera-consent-gate";
import {
  onboardingSchema,
  type OnboardingInput,
} from "@/lib/auth/schemas";
import { completeOnboarding, type OnboardingResult } from "./actions";

// Hard navigation to /app, NOT router.replace: at sign-in the proxy bounced
// /app → /onboarding (full_name was null) and Next cached that redirect in the
// client Router Cache. A soft router.replace("/app") would resolve against that
// stale entry and no-op back to /onboarding. A full document navigation re-runs
// the proxy server-side with the now-complete profile. See DECISIONS 2026-05-27.
function goToApp() {
  window.location.replace("/app");
}

export function OnboardingForm({
  defaultFullName,
  cameraBlocked = false,
}: {
  defaultFullName?: string;
  /**
   * The camera-and-inference consent decision, resolved on the server (feature 013,
   * T049). It gates the ANCHOR STEP ONLY.
   *
   * The name step below runs regardless, and that is the whole point. FR-043c blocks
   * calibration, baseline capture and monitoring sessions — "and nothing else". Gating
   * the name step too would exceed the requirement and, worse, would strand the user:
   * this step is the only thing that writes profiles.full_name, and proxy.ts:203 bounces
   * a null-full_name user back to /onboarding from everywhere. Declining would then loop
   * forever with no exit.
   */
  cameraBlocked?: boolean;
}) {
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
    // Fill the remaining height below the slim onboarding header and centre the
    // capture vertically (the onboarding <main> is already a min-h-dvh flex col).
    return (
      <div className="flex flex-1 flex-col justify-center">
        {cameraBlocked ? (
          // FR-038, structurally: <AnchorRecorder> is not rendered at all, so nothing
          // that could call getUserMedia is in the mounted tree. Not hidden, not
          // disabled — absent. Accepting refreshes the server component, which re-reads
          // the consent and flips cameraBlocked, and this step then renders the recorder
          // without the visitor losing their place (router.refresh keeps client state).
          <CameraConsentGate />
        ) : (
          <AnchorRecorder context="onboarding" onComplete={goToApp} onSkip={goToApp} />
        )}
      </div>
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
          {pending ? "Saving…" : "Continue"}
        </button>
      </form>
    </section>
  );
}
