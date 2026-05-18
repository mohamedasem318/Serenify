import type { Metadata } from "next";

import { createClient } from "@/lib/supabase/server";
import { ResetForm } from "./reset-form";

export const metadata: Metadata = { title: "Set a new password" };

// The recovery email link routes through /auth/callback, which
// exchanges the PKCE code server-side and forwards here with the
// recovery session in place. By the time this page renders we either
// have an authenticated user (happy path) or we don't (the user
// pasted the URL directly, the code expired, or auth/callback bounced
// them away). The proxy keeps /reset-password reachable to authed
// users — see proxy.ts AUTH_PAGES.
//
// OTP fallback (FR-020) lives on /forgot-password's check-email
// panel, not here — recovery's pre-click surface mirrors signup's
// pre-click surface, so users can choose between link and code
// before the link is touched.
export default async function ResetPasswordPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return <ResetForm authenticated={!!user} />;
}
