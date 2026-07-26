import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { CameraConsentGate } from "@/components/consent/camera-consent-gate";
import { readCameraGateDecision } from "@/lib/consent/read";
import { createClient } from "@/lib/supabase/server";
import { OnboardingForm } from "./onboarding-form";

export const metadata: Metadata = { title: "Welcome to Serenify" };
export const dynamic = "force-dynamic";

export default async function OnboardingPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    redirect("/login");
  }

  // The camera-and-inference gate (T049, §7.2). THIS ROUTE IS IN THE GATE LIST FOR A
  // REASON (plan.md §0.5): for a brand-new employee this — not /app/calibrate — is the
  // moment of their first-ever calibration. It is registered in CAPTURE_ROUTES
  // (next.config.ts:103) and isCaptureRoute (proxy.ts:71-74) precisely because it calls
  // getUserMedia. Gating only /app/calibrate would let every new employee's first
  // capture run unconsented.
  //
  // Returning the gate INSTEAD of <OnboardingForm> is what keeps that true: the form's
  // "anchor" step mounts <AnchorRecorder> (onboarding-form.tsx:60) once setStep("anchor")
  // runs at :48, and neither can happen while the form is not in the tree (FR-038).
  // Fails CLOSED — an unreadable read shows the gate (lib/consent/read.ts).
  if ((await readCameraGateDecision(supabase)) === "blocked") {
    return <CameraConsentGate />;
  }

  // Pre-fill from auth.users.user_metadata.full_name if signup carried it.
  const defaultFullName =
    typeof user.user_metadata?.full_name === "string"
      ? user.user_metadata.full_name
      : undefined;

  return <OnboardingForm defaultFullName={defaultFullName} />;
}
