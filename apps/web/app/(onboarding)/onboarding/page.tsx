import type { Metadata } from "next";
import { redirect } from "next/navigation";

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
  // THE DECISION IS PASSED DOWN, NOT APPLIED HERE. Replacing the whole <OnboardingForm>
  // with the gate also removes the NAME step — the only thing that ever writes
  // profiles.full_name — and declining then pushed to /app, where proxy.ts:203 bounces a
  // null-full_name user straight back to /onboarding. That was an unescapable loop and a
  // total product lockout. FR-043c blocks camera capture "and nothing else"; a text field
  // is not camera capture. So the form owns the gate at its anchor step, where the
  // capture actually is, and the name step runs regardless.
  //
  // Fails CLOSED — an unreadable read blocks (lib/consent/read.ts).
  const cameraBlocked = (await readCameraGateDecision(supabase)) === "blocked";

  // Pre-fill from auth.users.user_metadata.full_name if signup carried it.
  const defaultFullName =
    typeof user.user_metadata?.full_name === "string"
      ? user.user_metadata.full_name
      : undefined;

  return <OnboardingForm defaultFullName={defaultFullName} cameraBlocked={cameraBlocked} />;
}
