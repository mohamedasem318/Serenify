import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { createClient } from "@/lib/supabase/server";

import { CalibrateRecorder } from "./calibrate-recorder";

export const metadata: Metadata = { title: "Calibrate" };
export const dynamic = "force-dynamic";

type Role = "employee" | "team_lead" | "admin";

/**
 * Employee-only recalibration route (📌 DECISION-14, FR-022/029). team_lead /
 * admin have no anchor flow and are redirected to /app (Principle I).
 */
export default async function CalibratePage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    redirect("/login");
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .maybeSingle<{ role: Role }>();

  if (!profile) {
    redirect("/onboarding");
  }
  if (profile.role !== "employee") {
    redirect("/app");
  }

  // Falls through to /app when the anchor is already captured (FR-022). The
  // ST-17 fix needs this: a sibling tab that was mid-record receives the
  // cross-tab broadcast → router.refresh() re-runs this Server Component →
  // has_anchor now returns true → redirect away from the now-stale recorder.
  // Without this probe, refresh just re-rendered the recorder and the sibling
  // appeared to hang. Manual visits with an anchor are likewise redirected —
  // recalibration UI is feature 005, not 004. Conservative on null/error: any
  // non-true result keeps the recorder available so a transient RPC failure
  // doesn't strand a still-uncalibrated user.
  const { data: hasAnchor } = await supabase.rpc("has_anchor", {
    target_user: user.id,
  });
  if (hasAnchor === true) {
    redirect("/app");
  }

  return (
    <div className="mx-auto w-full max-w-2xl space-y-8 pb-12">
      <CalibrateRecorder />
    </div>
  );
}
