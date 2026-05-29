"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { onboardingSchema } from "@/lib/auth/schemas";

export type OnboardingResult =
  | { status: "ok" }
  | { status: "validation"; message: string }
  | { status: "error"; message: string };

export async function completeOnboarding(
  formData: FormData,
): Promise<OnboardingResult> {
  const parsed = onboardingSchema.safeParse({
    full_name: formData.get("full_name"),
  });
  if (!parsed.success) {
    return {
      status: "validation",
      message: parsed.error.issues[0]?.message ?? "Please enter your name.",
    };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    redirect("/login");
  }

  const { error } = await supabase
    .from("profiles")
    .update({ full_name: parsed.data.full_name })
    .eq("id", user.id);

  if (error) {
    // Mirror updateProfile's error hygiene (account/actions.ts): log the raw
    // Supabase error server-side, return a fixed generic message. Slice 3
    // Finding 4 — both write the same full_name column; both branches now
    // handle failure identically. See docs/DECISIONS.md (2026-05-25 — slice 3).
    console.error("[completeOnboarding] supabase error:", error);
    return { status: "error", message: "We couldn't save that — try again." };
  }

  // Employees calibrate in a second, in-page onboarding step (📌 DECISION-14,
  // FR-001): return { status: "ok" } WITHOUT a server redirect so the client
  // advances to the anchor recorder. Managers (team_lead/admin) have no anchor
  // step — keep the server redirect to /app (FR-029, Principle I).
  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .maybeSingle<{ role: "employee" | "team_lead" | "admin" }>();

  if (profile?.role === "employee") {
    return { status: "ok" };
  }

  redirect("/app");
}
