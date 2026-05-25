"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { signInSchema } from "@/lib/auth/schemas";

export type SignInResult =
  | { status: "ok" }
  | { status: "unconfirmed"; email: string }
  | { status: "invalid" }
  | { status: "error"; message: string };

export async function signIn(formData: FormData): Promise<SignInResult> {
  const parsed = signInSchema.safeParse({
    email: formData.get("email"),
    password: formData.get("password"),
  });
  if (!parsed.success) {
    return { status: "invalid" };
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({
    email: parsed.data.email,
    password: parsed.data.password,
  });

  if (error) {
    if (/email.*not.*confirmed/i.test(error.message)) {
      return { status: "unconfirmed", email: parsed.data.email };
    }
    if (/invalid.*credentials/i.test(error.message)) {
      return { status: "invalid" };
    }
    // Slice 2 Finding 8: don't forward the raw vendor message to the client.
    // The enumeration-relevant outcomes are handled by the branches above;
    // this fallback only sees non-credential errors. Log server-side, return
    // a fixed generic message (mirrors changePassword in account/actions.ts).
    console.error("[signIn] supabase error:", error);
    return { status: "error", message: "Something went wrong — please try again." };
  }

  return { status: "ok" };
}

export async function resendConfirmation(email: string) {
  // Slice 2 Finding 5: validate the email before calling Supabase — this is
  // an exported "use server" POST endpoint and was the only auth action that
  // skipped validation. Return void on bad input (no enumeration oracle);
  // rate control is handled by the max_frequency tightening (Finding 4).
  const parsed = signInSchema.shape.email.safeParse(email);
  if (!parsed.success) return;
  const supabase = await createClient();
  await supabase.auth.resend({ type: "signup", email: parsed.data });
}

// Progressive-enhancement wrapper for <form action={...}>: invoked
// natively when JS hasn't loaded or hydration failed. Returns void so
// the form does a POST (not GET) and credentials never appear in the
// URL. On success, redirects to /app; on failure, the page simply
// re-renders (no error UI in this no-JS fallback path).
export async function signInFromForm(formData: FormData) {
  const result = await signIn(formData);
  if (result.status === "ok") {
    redirect("/app");
  }
}
