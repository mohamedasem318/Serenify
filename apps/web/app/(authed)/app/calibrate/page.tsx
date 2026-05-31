import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { resolveCalibrateMode } from "@/lib/anchor/calibrate-mode";
import { createClient } from "@/lib/supabase/server";

import { CalibrateRecorder } from "./calibrate-recorder";

export const metadata: Metadata = { title: "Calibrate" };
export const dynamic = "force-dynamic";

type Role = "employee" | "team_lead" | "admin";
type SearchParams = Promise<Record<string, string | string[] | undefined>>;

/**
 * Employee-only calibration / recalibration route (📌 DECISION-14/22, FR-022/029/
 * 038). team_lead / admin have no anchor flow and are redirected to /app
 * (Principle I).
 */
export default async function CalibratePage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
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

  // has_anchor drives BOTH the ST-17 redirect and the mode reconciliation (T026).
  // The original ST-17 fix needs the probe: a sibling tab that was mid-record
  // receives the cross-tab broadcast → router.refresh() re-runs this Server
  // Component → has_anchor now returns true → redirect away from the now-stale
  // recorder. Feature 005 layers recalibrate on top: a `?mode=recalibrate` visit
  // from the account page (the user HAS an anchor and means to replace it) must
  // NOT be bounced by that same redirect. resolveCalibrateMode() folds both rules
  // together — suppressing the redirect in recalibrate and reconciling a stray
  // `?mode=recalibrate` with no baseline down to first-time semantics
  // (clarification #3). Conservative on null/error: any non-true result keeps the
  // recorder available so a transient RPC failure doesn't strand an uncalibrated
  // user (and never spuriously recalibrates).
  const params = await searchParams;
  const { data: hasAnchor } = await supabase.rpc("has_anchor", {
    target_user: user.id,
  });
  const { mode, redirectToApp } = resolveCalibrateMode({
    paramMode: params.mode,
    hasAnchor,
  });
  if (redirectToApp) {
    redirect("/app");
  }

  return (
    // Centre the calm capture in the viewport below the header (FR — balanced,
    // not crammed to the top). The header + main padding take ~7rem.
    <div className="mx-auto flex min-h-[calc(100dvh-7rem)] w-full max-w-2xl flex-col justify-center pb-8">
      <CalibrateRecorder mode={mode} />
    </div>
  );
}
