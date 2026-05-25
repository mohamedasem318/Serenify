"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { resetPasswordSchema, verifyOtpSchema } from "@/lib/auth/schemas";

export type ResetResult =
  | { status: "ok" }
  | { status: "validation"; message: string }
  | { status: "error"; message: string };

export type VerifyResetOtpResult =
  | { status: "ok" }
  | { status: "invalid"; message: string }
  | { status: "validation"; message: string };

export async function updatePassword(formData: FormData): Promise<ResetResult> {
  const parsed = resetPasswordSchema.safeParse({
    new_password: formData.get("new_password"),
    confirm_password: formData.get("confirm_password"),
  });
  if (!parsed.success) {
    return {
      status: "validation",
      message: parsed.error.issues[0]?.message ?? "Please check the fields.",
    };
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.updateUser({
    password: parsed.data.new_password,
  });
  if (error) {
    // Slice 2 Finding 8: log server-side, return a fixed generic message
    // instead of the raw vendor error.message.
    console.error("[updatePassword] supabase error:", error);
    return { status: "error", message: "Something went wrong — please try again." };
  }

  // After updating the password we sign the user out so they re-enter
  // with the new credentials — matches the contract's "redirect to /login
  // with a flash". Server Action can't redirect AND return data; the
  // client does router.replace on { status: 'ok' }.
  await supabase.auth.signOut();
  return { status: "ok" };
}

// Progressive-enhancement wrapper for <form action={...}>: invoked
// natively when JS hasn't loaded or hydration failed. Returns void so
// the form does a POST (not GET) and the new password never appears in
// the URL. On success, redirects to /login with the existing flash; on
// failure, the page re-renders without error UI.
export async function updatePasswordFromForm(formData: FormData) {
  const result = await updatePassword(formData);
  if (result.status === "ok") {
    redirect("/login?flash=password_updated");
  }
}

// FR-020: 6-digit OTP fallback for password recovery. Same outcome as
// clicking the email link — establishes the recovery-scoped session
// so the new-password form on /reset-password can call updateUser.
export async function verifyResetOtp(
  formData: FormData,
): Promise<VerifyResetOtpResult> {
  const parsed = verifyOtpSchema.safeParse({
    email: formData.get("email"),
    token: formData.get("token"),
    type: "recovery",
  });
  if (!parsed.success) {
    return {
      status: "validation",
      message:
        parsed.error.issues[0]?.message ??
        "Enter the 6-digit code from the email.",
    };
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.verifyOtp({
    email: parsed.data.email,
    token: parsed.data.token,
    type: "recovery",
  });
  if (error) {
    return {
      status: "invalid",
      message: "That code didn't match. Try again, or request a fresh email.",
    };
  }

  return { status: "ok" };
}
