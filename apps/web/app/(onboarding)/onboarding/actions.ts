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
    return { status: "error", message: error.message };
  }

  redirect("/app");
}
