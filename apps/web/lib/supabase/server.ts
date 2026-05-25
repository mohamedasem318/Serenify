import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";

export async function createClient() {
  const cookieStore = await cookies();

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) => {
              cookieStore.set(name, value, options);
            });
          } catch {
            // cookies().set throws when called from a Server Component.
            // Token refresh writes still happen in the proxy (apps/web/proxy.ts),
            // so this is safe to swallow here.
          }
        },
      },
      cookieOptions: {
        // Slice 2 Finding 2: add Secure on sb-* session cookies in production.
        // httpOnly and sameSite are intentionally left at the @supabase/ssr
        // defaults (httpOnly: false, sameSite: "lax") — the browser client is
        // constructed without a cookie adapter and reads document.cookie to
        // hydrate the session, so httpOnly: true would BREAK auth. See
        // docs/security/02-auth-cookies-broadcast.md Finding 2 and the
        // DECISIONS.md 2026-05-25 cookie-Secure policy entry.
        secure: process.env.NODE_ENV === "production",
      },
    },
  );
}
