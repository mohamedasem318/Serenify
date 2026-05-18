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
    return { status: "error", message: error.message };
  }

  return { status: "ok" };
}

export async function resendConfirmation(email: string) {
  const supabase = await createClient();
  await supabase.auth.resend({ type: "signup", email });
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
