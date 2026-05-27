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

  return (
    <div className="mx-auto w-full max-w-2xl space-y-8 pb-12">
      <CalibrateRecorder />
    </div>
  );
}
