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
 * In P3 the public surface is exactly the two legal documents. The landing page takes
 * over `/` in P6 and will extend this list then; nothing here pre-empts that decision.
 *
 * Labels are single words on purpose: they sit inside 44 px tap targets at 320 px in both
 * the navbar row and the sheet, and FR-053 forbids a tap target whose label wraps.
 */

export type PublicDestination = {
  readonly href: string;
  readonly label: string;
};

export const PUBLIC_DESTINATIONS: readonly PublicDestination[] = [
  { href: "/terms", label: "Terms" },
  { href: "/privacy", label: "Privacy" },
];
