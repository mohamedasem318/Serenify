import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

/**
 * Standard shadcn helper: merge an arbitrary list of class-name inputs
 * (strings, arrays, conditional objects) through clsx, then run the
 * result through tailwind-merge so conflicting Tailwind utilities
 * resolve to the last winner (e.g. `cn("p-2", "p-4")` → `"p-4"`).
 *
 * Used by every shadcn primitive emitted into `components/ui/` via
 * `npx shadcn@latest add`, and available to bespoke components that
 * want the same conflict-resolution semantics.
 */
export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs));
}
