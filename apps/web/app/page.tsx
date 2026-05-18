import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

// Root path: send signed-in users to /app (the proxy will further bounce
// to /onboarding if full_name is null), and unauthenticated visitors to
// /login.
export const dynamic = "force-dynamic";

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

export default async function RootPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  // Defensive: if a Supabase email link landed here with a `?code=` (e.g.
  // because site_url got misconfigured back to "/"), forward to the
  // proper callback handler so the PKCE exchange still happens instead
  // of silently bouncing the user to /login with the code lost.
  const { code } = await searchParams;
  if (typeof code === "string" && code.length > 0) {
    redirect(`/auth/callback?code=${encodeURIComponent(code)}`);
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  redirect(user ? "/app" : "/login");
}
