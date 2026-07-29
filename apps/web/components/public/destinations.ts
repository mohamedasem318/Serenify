/**
 * Feature 013 — the public surface's destination list, defined once (T025/T027).
 *
 * The navbar, the hamburger menu, and the footer all read this list, so a destination
 * cannot appear in one and go missing from another. It also gives the shell test a single
 * thing to assert against rather than three hand-kept copies.
 *
 * PUBLIC ONLY, AND THAT IS ENFORCED BY WHAT IS ABSENT. There is no `/app` entry, no
 * role, and no session — the public shell has no way to render an authed destination
 * because it has no authed destination to render (FR-018). A future phase adding a public
 * page adds it here; a future phase must not add an authed one.
 *
 * In P3 the public surface was exactly the two legal documents. P6 (T104) took `/` over
 * for the landing page and added it here — ONE entry, not several.
 *
 * WHY ONLY "HOME". The landing page's other reachable anchor is its how-it-works section,
 * and it is deliberately NOT listed: the hero's second CTA already goes there with the
 * label FR-020 fixes, and any label short enough to satisfy the single-word rule below
 * ("How", "Product") would name the section worse than the CTA already does.
 *
 * "Home" DOES sit next to the navbar wordmark, which also links to `/`, and that
 * duplication is deliberate rather than an oversight. The two are not the same
 * affordance: the wordmark is a brand mark that experienced users know is clickable, and
 * it is absent from BOTH the mobile sheet and the footer's link row — which is where this
 * list is actually read. A named row there is the only home link a phone user gets. The
 * how-it-works case is different precisely because its alternative, the hero CTA, is on
 * the same screen and better labelled.
 *
 * Still PUBLIC ONLY — `/` is the signed-out landing page. No `/app`, no role, no session.
 *
 * Labels are single words on purpose: they sit inside 44 px tap targets at 320 px in both
 * the navbar row and the sheet, and FR-053 forbids a tap target whose label wraps.
 */

export type PublicDestination = {
  readonly href: string;
  readonly label: string;
};

export const PUBLIC_DESTINATIONS: readonly PublicDestination[] = [
  { href: "/", label: "Home" },
  { href: "/terms", label: "Terms" },
  { href: "/privacy", label: "Privacy" },
];

/**
 * The two ways IN, defined here for the same reason the destinations above are: the navbar
 * shows them and the mobile sheet shows them, and a visitor on a phone must not get a
 * smaller set of doors than a visitor on a laptop.
 *
 * NOT part of `PUBLIC_DESTINATIONS`, deliberately. That list is the *pages* — it drives the
 * navbar's centre row, the sheet's page list AND the footer's link column, and an auth
 * action does not belong in a footer's site map. Keeping them separate is also what lets
 * the shell test keep asserting that the destination list contains nothing authed.
 *
 * `/login` and `/signup` are UNAUTHENTICATED routes under `app/(auth)/`. They are not `/app`
 * and they are not role-gated — a signed-out stranger is exactly who they are for — so
 * naming them here does not put an authed destination on the public surface (FR-018).
 */
export const PUBLIC_AUTH_ACTIONS = {
  signIn: { href: "/login", label: "Sign in" },
  signUp: { href: "/signup", label: "Sign up" },
} as const satisfies Record<string, PublicDestination>;

/**
 * The way BACK, for a visitor who already has a session (2026-07-29).
 *
 * DELIBERATELY NOT IN `PUBLIC_DESTINATIONS`, and the reason is the same one that keeps
 * the two auth actions out of it. That list is the *pages* — it drives the navbar's
 * centre row, the sheet's page list AND the footer's link column — and this is not a
 * page of the public site; it is the door out of it. Keeping it separate is also what
 * lets `tests/unit/components/public/public-shell.test.tsx` go on asserting, without
 * conditions, that the destination list contains nothing authed.
 *
 * THIS IS AN AUTHED DESTINATION AND IT IS RENDERED ONLY TO A RESOLVED SESSION. FR-018
 * ("no dashboard or authed links") is superseded for the signed-in case only; the
 * signed-out guarantee it was actually written to protect is unchanged and is asserted
 * unconditionally. See docs/DECISIONS.md 2026-07-29.
 *
 * "Go to app" is three short words on purpose: it sits in a 44 px target at 320 px and
 * must not wrap to a second line (FR-053).
 */
export const PUBLIC_RETURN_ACTION = {
  href: "/app",
  label: "Go to app",
} as const satisfies PublicDestination;
