"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { forgotPasswordSchema } from "@/lib/auth/schemas";
import { serverEnv } from "@/lib/env/server";

export type ForgotResult = { status: "ok" } | { status: "validation" };

export async function requestPasswordReset(
  formData: FormData,
): Promise<ForgotResult> {
  const parsed = forgotPasswordSchema.safeParse({
    email: formData.get("email"),
  });
  if (!parsed.success) {
    return { status: "validation" };
  }

  const siteUrl = serverEnv.siteUrl;
  const supabase = await createClient();

  // Always respond ok regardless of whether the email exists — FR-007.
  // Any Supabase error is intentionally swallowed.
  //
  // The recovery email's `?code=` lands on /auth/callback (same handler
  // as signup confirmation) which exchanges the PKCE code server-side
  // and forwards to /reset-password with the recovery session in place.
  // Doing the exchange in /reset-password's client-side useEffect ran
  // twice under React Strict Mode and the second call "expired" the
  // already-spent code, surfacing as the bogus "Your link expired"
  // state on a freshly clicked link.
  await supabase.auth.resetPasswordForEmail(parsed.data.email, {
    redirectTo: `${siteUrl}/auth/callback?next=/reset-password`,
  });

  return { status: "ok" };
}

// Progressive-enhancement wrapper for <form action={...}>: invoked
// natively when JS hasn't loaded or hydration failed. Always redirects
// to /forgot-password?state=reset_sent (independent of whether the
// email is registered — FR-007), with the email round-tripped so the
// OTP entry surface (FR-020) can pre-fill it. The page renders the
// "check email" panel under both no-JS and JS paths.
export async function requestPasswordResetFromForm(formData: FormData) {
  const email = String(formData.get("email") ?? "");
  await requestPasswordReset(formData);
  redirect(
    `/forgot-password?state=reset_sent&email=${encodeURIComponent(email)}`,
  );
}
