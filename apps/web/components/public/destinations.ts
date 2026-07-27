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
 * ("How", "Product") would name the section worse than the CTA already does. A shell
 * destination that duplicates a CTA is not navigation, it is noise.
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
