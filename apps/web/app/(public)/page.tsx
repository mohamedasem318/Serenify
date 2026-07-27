import { redirect } from "next/navigation";

import { Hero } from "@/components/landing/hero";
import { HowItWorks } from "@/components/landing/how-it-works";
import { NeverCards } from "@/components/landing/never-cards";
import { StatusStatement } from "@/components/landing/status-statement";
import { TeamSection } from "@/components/landing/team-section";
import { resolveRootRoute } from "@/lib/routing/resolve-root-route";
import { createClient } from "@/lib/supabase/server";

/**
 * Feature 013 — the root-route takeover (T086; `research.md` §11).
 *
 * THIS IS A MOVE, NOT AN ADDITION. `app/page.tsx` is deleted in the same commit that adds
 * this file, because only one `page` may resolve to `/` and both would. The Next 16 docs
 * on disk state it directly: `app/page.tsx` maps to `/`
 * (`01-app/01-getting-started/02-project-structure.md`, routing table) and so does
 * `app/(marketing)/page.tsx` — "Group omitted from URL" (same file, route-groups table) —
 * and `03-api-reference/03-file-conventions/route-groups.md` § Caveats says routes that
 * "resolve to the same URL path … cause an error". T028's header comment in
 * `(public)/layout.tsx` recorded the P3 half of this ("P3 deliberately adds no
 * `(public)/page.tsx`, which is the one file that WOULD collide"); this is that file, and
 * the collision is avoided by removing the other one, not by coexisting with it.
 *
 * `/` HAD THREE BEHAVIOURS AND P6 CHANGES EXACTLY ONE. The `?code=` forward and the
 * signed-in redirect to `/app` are protected by FR-017 and survive unchanged; only the
 * terminal branch moves, from `redirect("/login")` to rendering the landing page. The
 * decision itself lives in `resolveRootRoute` so it is exhaustible by a unit table (T085)
 * rather than only by a browser — the same technique `resolveCalibrateMode` uses.
 *
 * `force-dynamic` is kept from the page this replaces. The cost is known and accepted
 * (R11): for an anonymous visitor there is no session cookie, so `getUser()`
 * short-circuits without a network round trip, and the proxy runs on every request
 * regardless. Moving only the signed-in redirect into the proxy is a possible follow-up,
 * NOT done here — `proxy.ts` is the highest-blast-radius file in the repo and its
 * `redirectTo` helper clears `url.search`, which would eat the `?code=` outright (§11).
 *
 * Rendering here puts the landing page inside the P3 public shell — `(public)/layout.tsx`
 * supplies the navbar and footer, and reads no session, so nothing on this page depends
 * on one.
 */
export const dynamic = "force-dynamic";

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

export default async function LandingPage({ searchParams }: { searchParams: SearchParams }) {
  const { code } = await searchParams;

  // `?code=` outranks the session (§11 precedence), so it is answerable WITHOUT reading
  // one — and the page this replaces likewise touched Supabase only after the forward.
  // Asking the resolver with no session first is safe precisely because `callback` is the
  // highest-precedence outcome: supplying `isSignedIn` below can never overturn it. The
  // ordering is the point — a visitor signed in in another tab who clicks a recovery link
  // must still reach the callback, not get bounced to /app with the code lost.
  const beforeSession = resolveRootRoute({ code });
  if (beforeSession.kind === "callback") {
    redirect(`/auth/callback?code=${encodeURIComponent(beforeSession.code)}`);
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const route = resolveRootRoute({ code, isSignedIn: Boolean(user) });
  if (route.kind === "app") {
    // The proxy's onboarding gate bounces an un-onboarded user onward from here,
    // exactly as it did before the takeover.
    redirect("/app");
  }

  // The landing branch (T104). No user data is read and no authenticated call is made
  // past this point — everything below is static copy from `lib/landing/copy.ts`.
  return (
    <>
      <Hero />
      <NeverCards />
      <HowItWorks />
      <StatusStatement />
      <TeamSection />
    </>
  );
}
