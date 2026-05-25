"use server";

import { revalidatePath } from "next/cache";
import { createClient as createAnonClient } from "@supabase/supabase-js";
import { z } from "@/lib/zod";

import { changePasswordSchema, fullNameSchema } from "@/lib/auth/schemas";
import { createClient } from "@/lib/supabase/server";
import { clientEnv } from "@/lib/env/client";

// full_name is validated by the single authoritative fullNameSchema (slice 3
// Finding 5 — was a divergent local max(60); see docs/DECISIONS.md
// 2026-05-25 — Security slice 3).
const updateProfileSchema = z.object({
  full_name: fullNameSchema,
});

export type UpdateProfileResult =
  | { status: "ok" }
  | { status: "invalid"; message: string };

export type ChangePasswordResult = UpdateProfileResult;

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

export async function changePassword(
  formData: FormData,
): Promise<ChangePasswordResult> {
  const parsed = changePasswordSchema.safeParse({
    current_password: formData.get("current_password"),
    new_password: formData.get("new_password"),
    confirm_password: formData.get("confirm_password"),
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
  if (!user || !user.email) {
    return {
      status: "invalid",
      message: "Your session expired — sign in again.",
    };
  }

  // Catch the "I retyped my current password into the new field" case
  // before hitting Supabase. supabase.auth.updateUser would silently
  // succeed on a no-op password write, which leaks the (probably
  // unintentional) sameness back through the generic "couldn't update"
  // fallback — wrong message for the actual user mistake. Compared
  // here in plain text because both values are already in memory and
  // never leave the server action.
  if (parsed.data.new_password === parsed.data.current_password) {
    return {
      status: "invalid",
      message: "That's already your current password — try a different one.",
    };
  }

  // Verify the current password via a throwaway anon client so the
  // user's existing session cookies aren't replaced by a fresh sign-in.
  // The SSR client at @/lib/supabase/server would also work, but
  // signInWithPassword on it would rotate the session tokens for no
  // functional benefit. The anon client has no persistence and no
  // cookie writes — it's pure verification.
  const verifier = createAnonClient(
    clientEnv.supabaseUrl,
    clientEnv.supabaseAnonKey,
    { auth: { autoRefreshToken: false, persistSession: false } },
  );
  const { error: verifyError } = await verifier.auth.signInWithPassword({
    email: user.email,
    password: parsed.data.current_password,
  });
  if (verifyError) {
    return {
      status: "invalid",
      message: "Current password doesn't match.",
    };
  }

  const { error: updateError } = await supabase.auth.updateUser({
    password: parsed.data.new_password,
  });
  if (updateError) {
    return {
      status: "invalid",
      message: "We couldn't update your password — try again.",
    };
  }

  return { status: "ok" };
}
