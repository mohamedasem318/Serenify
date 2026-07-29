import { PublicFooter } from "@/components/public/public-footer";
import { PublicNavbar } from "@/components/public/public-navbar";
import { readPublicViewer } from "@/lib/public-viewer";

/**
 * Feature 013 — the public route group's shell (T028).
 *
 * Verified against the Next 16 docs before it was written, not inferred from Next 14/15
 * habits (`apps/web/AGENTS.md`; R9). The specific question T020 required answering from
 * the docs: does adding this file, with `terms/` and `privacy/` beneath it, change
 * anything about `/`, which `app/page.tsx` still owns? It does not, for three reasons the
 * docs state directly:
 *
 *  1. `node_modules/next/dist/docs/01-app/03-api-reference/03-file-conventions/route-groups.md`
 *     — a parenthesised folder "should **not be included** in the route's URL path". The
 *     group is organisational; `(public)` never appears in a URL.
 *  2. `node_modules/next/dist/docs/01-app/01-getting-started/02-project-structure.md`
 *     § "Opting specific segments into a layout" — a layout inside a route group applies
 *     only to routes moved INTO that group; routes outside it do not share the layout.
 *     `app/page.tsx` is outside `(public)`, so this file never wraps it.
 *  3. `node_modules/next/dist/docs/01-app/03-api-reference/03-file-conventions/layout.md`
 *     § Root Layout — "Any layout without a `layout.js` above it is a root layout."
 *     `app/layout.tsx` IS above this one, so this is a NESTED layout, not a second root.
 *     That is why it emits no `<html>` and no `<body>`, and why the route-groups
 *     "Full page load" caveat — which applies only between multiple ROOT layouts — does
 *     not apply to navigation between `/` and `/terms`.
 *
 * The conflicting-paths caveat (route-groups.md) is likewise clear: `(public)/terms` and
 * `(public)/privacy` resolve to `/terms` and `/privacy`, and no other file in the tree
 * resolves to either. P3 deliberately adds no `(public)/page.tsx`, which is the one file
 * that WOULD collide with `app/page.tsx` over `/`. The root-route takeover is P6.
 *
 * ── IT READS THE SESSION NOW, AND THAT REVERSES A LINE THIS FILE USED TO CARRY ─────────
 *
 * Until 2026-07-29 this comment said "NO AUTHENTICATION CALL … the cheapest way to
 * guarantee that is a shell that has no session to check". That was true, and it was
 * also why `/terms` and `/privacy` rendered "Sign in / Sign up" to signed-in users — the
 * shell could not tell the difference. A pre-013 user meets the re-consent gate, opens
 * one of these documents from it, and is greeted as a stranger.
 *
 * WHAT THAT SENTENCE WAS PROTECTING IS UNCHANGED, and it was never the absence of the
 * call. FR-043d requires a blocked user to still read both documents in full, and the
 * guarantee is STRUCTURAL: these routes live outside `(authed)`, so the consent gate in
 * `app/(authed)/layout.tsx` cannot run for them at all. Reading a session here does not
 * reach that gate, and cannot re-introduce it.
 *
 * The cost the old sentence was buying — "nothing to fail" — is bought differently now:
 * `readPublicViewer()` cannot throw and cannot reject. Every failure returns null, which
 * renders exactly the navbar this route shipped with. See `lib/public-viewer.ts` for why
 * the asymmetry runs that way. A signed-out visitor still pays one short-circuited
 * `getUser()` and no profiles round trip.
 *
 * NO RENDERING BEHAVIOUR CHANGES. `/terms` and `/privacy` were already `ƒ (Dynamic)` in
 * the build route table before this — the root layout awaits `headers()` for the CSP
 * nonce (`app/layout.tsx:45`), so nothing in this application prerenders. Verified
 * against a real `next build` on `main` rather than assumed.
 *
 * The column mirrors `app/(authed)/layout.tsx`: `min-h-dvh` flex column so a short
 * document still pins the footer to the bottom of the viewport rather than floating it
 * mid-screen.
 */
export default async function PublicLayout({ children }: { children: React.ReactNode }) {
  const viewer = await readPublicViewer();

  return (
    <div className="flex min-h-dvh flex-col bg-bg">
      <PublicNavbar viewer={viewer} />
      <main className="flex-1">{children}</main>
      <PublicFooter />
    </div>
  );
}
