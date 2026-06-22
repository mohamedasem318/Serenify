import { redirect } from "next/navigation";

import { MonitoringSession } from "@/components/monitor/monitoring-session";
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

  return <MonitoringSession />;
}
