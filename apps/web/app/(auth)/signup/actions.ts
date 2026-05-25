"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { signUpSchema, verifyOtpSchema } from "@/lib/auth/schemas";
import { serverEnv } from "@/lib/env/server";

export type SignUpResult =
  | { status: "ok" }
  | { status: "exists" }
  | { status: "error"; message: string }
  | { status: "validation"; field: string; message: string };

export type VerifySignupOtpResult =
  | { status: "ok" }
  | { status: "invalid"; message: string }
  | { status: "validation"; message: string };

export async function signUp(formData: FormData): Promise<SignUpResult> {
  const parsed = signUpSchema.safeParse({
    email: formData.get("email"),
    password: formData.get("password"),
    full_name: formData.get("full_name"),
  });

  if (!parsed.success) {
    const first = parsed.error.issues[0];
    return {
      status: "validation",
      field: String(first?.path[0] ?? ""),
      message: first?.message ?? "Please check the fields and try again.",
    };
  }

  const siteUrl = serverEnv.siteUrl;
  const supabase = await createClient();

  const { data, error } = await supabase.auth.signUp({
    email: parsed.data.email,
    password: parsed.data.password,
    options: {
      data: { full_name: parsed.data.full_name },
      emailRedirectTo: `${siteUrl}/auth/callback`,
    },
  });

  if (error) {
    // Supabase returns a generic 422 for already-registered emails when
    // "Confirm email" is on. The message text is the most reliable signal.
    if (/already|registered|exists/i.test(error.message)) {
      return { status: "exists" };
    }
    // Slice 2 Finding 8: log server-side, return a fixed generic message
    // instead of the raw vendor error.message.
    console.error("[signUp] supabase error:", error);
    return { status: "error", message: "Something went wrong — please try again." };
  }

  // If Supabase returns a user with no identities, the email exists but
  // hasn't been confirmed yet — same UX as the "exists" branch.
  if (data.user && data.user.identities && data.user.identities.length === 0) {
    return { status: "exists" };
  }

  return { status: "ok" };
}

// Progressive-enhancement wrapper for <form action={...}>: invoked
// natively when JS hasn't loaded or hydration failed. Returns void so
// the form does a POST (not GET) and credentials never appear in the
// URL. On success, stays on /signup and signals the "check email"
// panel via `?state=check_email&email=…` — the page renders the panel
// under both no-JS and JS paths, and the OTP entry surface (FR-020)
// can read the email back from the URL to pre-fill its form. On
// failure, the page re-renders without error UI.
export async function signUpFromForm(formData: FormData) {
  const email = String(formData.get("email") ?? "");
  const result = await signUp(formData);
  if (result.status === "ok") {
    redirect(`/signup?state=check_email&email=${encodeURIComponent(email)}`);
  }
}

// FR-020: 6-digit OTP fallback for signup confirmation. Same outcome
// as clicking the email link — the session is established here and
// the proxy routes the user onward (to /onboarding if full_name is
// null, otherwise /app). Validation errors render inline; on
// Supabase-side failure (wrong/expired code) the page re-renders with
// a calm "didn't match" message.
export async function verifySignupOtp(
  formData: FormData,
): Promise<VerifySignupOtpResult> {
  const parsed = verifyOtpSchema.safeParse({
    email: formData.get("email"),
    token: formData.get("token"),
    type: "signup",
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
    type: "signup",
  });
  if (error) {
    return {
      status: "invalid",
      message: "That code didn't match. Try again, or request a fresh email.",
    };
  }

  return { status: "ok" };
}
