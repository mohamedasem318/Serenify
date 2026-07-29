import { createClient } from "@/lib/supabase/server";

/**
 * Who is looking at a public page — resolved on the server, or nobody.
 *
 * WHY THIS EXISTS. `/terms` and `/privacy` rendered "Sign in / Sign up" to everybody,
 * including signed-in users. The path that matters is not cosmetic: a pre-013 user meets
 * the Terms/Privacy re-consent gate, opens one of the two documents from it — in a new
 * tab, by design (`components/consent/terms-reconsent-screen.tsx`) — and the site greets
 * them as a stranger. Every pre-013 production account meets that gate.
 *
 * ── IT FAILS OPEN, AND IT FAILS SILENT ────────────────────────────────────────────────
 *
 * Every path through this function RETURNS. Nothing it calls is allowed to propagate,
 * and `tests/unit/lib/public-viewer.test.ts` pins that for all three failure modes.
 *
 * The asymmetry is deliberate and it is the whole reason this is a separate module
 * rather than four lines inlined into the layout. `/terms` and `/privacy` are legally
 * load-bearing: FR-043d entitles a *blocked* user to read both documents in full, and
 * the re-consent screen links into them as the only way out of the gate. A wrong navbar
 * on those routes is a nuisance — the reader still gets the document, and the wrong
 * navbar is the one those routes shipped with anyway. A route that 500s because an auth
 * call timed out is a legal surface going dark, and it takes the re-consent gate's only
 * exit with it.
 *
 * So: on any failure, return null, render the signed-out navbar, and serve the document.
 * This is the same direction `(authed)/layout.tsx`'s consent gate fails, for the same
 * reason, and it uses the same loud-and-greppable log convention — one occurrence is
 * noise, a steady stream is an outage.
 *
 * ── THE PROFILES READ IS A SECOND ONE, KNOWINGLY ───────────────────────────────────────
 *
 * `proxy.ts` already selects `full_name` for the signed-in user on every GET, including
 * these two routes, so this makes it twice per load. It is not cleanly avoidable: the
 * proxy is a separate Node function invocation that completes before the render begins,
 * so React's per-request memoisation cannot span the two. The alternatives are worse —
 * forwarding profile data on a request header across every route in the app to save one
 * query on two of them, or dropping the name and rendering email-derived initials for
 * everyone. It is one indexed primary-key lookup of one column, and a signed-out visitor
 * pays none of it. Accepted rather than engineered around.
 */
export type PublicViewer = {
  /** May be null for a signed-in user who has not finished onboarding. */
  readonly fullName: string | null;
  readonly email: string;
};

/** Loud and greppable, matching `[consent-gate] FAIL-OPEN` in `(authed)/layout.tsx`. */
function failOpen(error: unknown): null {
  console.error(
    "[public-viewer] FAIL-OPEN: rendering the signed-out navbar; the page is unaffected",
    { error },
  );
  return null;
}

export async function readPublicViewer(): Promise<PublicViewer | null> {
  try {
    const supabase = await createClient();

    // `getUser()`, never `getSession()` — standing rule in this codebase. It validates
    // the token against the auth server rather than trusting a cookie's contents.
    const {
      data: { user },
    } = await supabase.auth.getUser();

    // The common case on a public route. A stranger costs one short-circuited call and
    // NO profiles round trip — there is no row that could exist to read.
    if (!user) {
      return null;
    }

    const { data: profile } = await supabase
      .from("profiles")
      .select("full_name")
      .eq("id", user.id)
      .maybeSingle<{ full_name: string | null }>();

    // A missing row is not a failure — it is a user mid-onboarding. The dropdown falls
    // back to the email for both the label and the initials (`lib/initials.ts`).
    return { fullName: profile?.full_name ?? null, email: user.email ?? "" };
  } catch (error) {
    return failOpen(error);
  }
}
