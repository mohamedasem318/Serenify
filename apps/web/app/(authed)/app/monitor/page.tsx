import { redirect } from "next/navigation";

import { CameraConsentGate } from "@/components/consent/camera-consent-gate";
import { MonitoringSession } from "@/components/monitor/monitoring-session";
import { readCameraGateDecision } from "@/lib/consent/read";
import { createClient } from "@/lib/supabase/server";

/**
 * The employee-only live monitoring page (feature 008, US1 — T033). Server-side role
 * guard (FR-010): only an employee reaches the stage; team leads / admins (who do not
 * calibrate and must not run inference) are redirected. Mirrors the /app guard pattern.
 *
 * The webcam's secure-context requirement (HTTPS / localhost) is enforced client-side in
 * the orchestrator (it routes to the blocked surface when the context is insecure or the
 * camera is unavailable).
 */

export const dynamic = "force-dynamic";

type Role = "employee" | "team_lead" | "admin";

export default async function MonitorPage() {
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
    redirect("/app"); // employees-only (FR-010) — never a manager/admin surface
  }

  // The camera-and-inference gate (T051, §7.2), placed AFTER the employees-only guard so
  // a team lead or admin is still redirected and never meets a consent surface for a
  // capture they can never run. Returning the gate instead of <MonitoringSession> means
  // no capture code and no getUserMedia call is mounted first (FR-038).
  // Fails CLOSED — an unreadable read shows the gate (lib/consent/read.ts).
  if ((await readCameraGateDecision(supabase)) === "blocked") {
    return <CameraConsentGate />;
  }

  return <MonitoringSession />;
}
