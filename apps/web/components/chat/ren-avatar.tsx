import { cn } from "@/lib/utils";

/**
 * Ren's avatar — the framed "R" (feature 011's companion chat; lifted out of
 * `chat-shell.tsx` on 2026-07-28 so a second surface can consume it).
 *
 * EXTRACTED RATHER THAN COPIED, for the reason FR-021 gives about the orb: the landing
 * page must not reimplement a thing the app already has, because two definitions of one
 * mark drift the moment either is touched. It was a private function inside `chat-shell`,
 * which is a client component carrying the composer, the history and the crisis panel —
 * importing that module to borrow a 28 px circle would have pulled the whole chat surface
 * into the landing bundle. So the definition moved here and BOTH sites consume it; the
 * chat shell's rendering is byte-identical to what it was.
 *
 * THE `color` PROP MIRRORS `Bloom`'s (T082) AND EXISTS FOR THE SAME REASON. Every chat
 * call site omits it and keeps `bg-meadow` — today's behaviour exactly. The landing page
 * passes `var(--color-foggy)` for Ren's blue state (FR-022), because the background is
 * otherwise a utility class that a caller cannot override from outside.
 *
 * THE "R" COLOUR NEEDS NO BRANCH. `text-on-accent dark:text-bg` is the repo's
 * filled-accent foreground pair, and it is the pair the `Button` component already uses
 * for BOTH its `meadow` and its `foggy` variants — near-white on the darker light-mode
 * fill, deep graphite on the lighter dark-mode fill. It clears WCAG AA on foggy exactly as
 * it does on meadow, so the one class pair serves both colours and nothing new is
 * registered (FR-057).
 */
export function RenAvatar({
  size = 34,
  color,
  className,
}: {
  size?: number;
  /** Optional fill override. Omitted everywhere in chat, which keeps `bg-meadow`. */
  color?: string;
  className?: string;
}) {
  return (
    <span
      aria-hidden
      style={{ width: size, height: size, ...(color ? { background: color } : {}) }}
      // dark:text-bg mirrors the Button meadow idiom — near-white "R" in light mode, deep
      // ink "R" on the lighter dark-mode meadow (bare text-on-accent washes out ~1.9:1).
      className={cn(
        "grid shrink-0 place-items-center rounded-full font-display font-bold text-on-accent dark:text-bg",
        // Only the default fill is a class, so an explicit `color` is not fighting one.
        color ? undefined : "bg-meadow",
        className,
      )}
    >
      R
    </span>
  );
}
