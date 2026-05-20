"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { createClient } from "@/lib/supabase/server";

const updateProfileSchema = z.object({
  full_name: z
    .string()
    .trim()
    .min(1, "Name can't be empty")
    .max(60, "Keep it under 60 characters"),
});

export type UpdateProfileResult =
  | { status: "ok" }
  | { status: "invalid"; message: string };

export async function updateProfile(
  formData: FormData,
): Promise<UpdateProfileResult> {
  const parsed = updateProfileSchema.safeParse({
    full_name: formData.get("full_name"),
  });
  if (!parsed.success) {
    return {
      status: "invalid",
      message: parsed.error.issues[0]?.message ?? "Please check the form.",
    };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return {
      status: "invalid",
      message: "We couldn't save that — try again.",
    };
  }

  const { error } = await supabase
    .from("profiles")
    .update({ full_name: parsed.data.full_name })
    .eq("id", user.id);

  if (error) {
    return {
      status: "invalid",
      message: "We couldn't save that — try again.",
    };
  }

  revalidatePath("/app");
  revalidatePath("/app/account");
  return { status: "ok" };
}
