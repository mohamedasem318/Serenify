import { cn } from "@/lib/utils";

/**
 * The one definition of the `serenify` wordmark inside the web app's
 * React tree — Constitution Principle V, Wordmark block (v1.13.0
 * Amendment 17). Re-typing this markup at a new site is a violation.
 *
 * Two colours: `seren` in the `ink` token, `ify` in the `meadow-text`
 * token. Always lowercase, and never a dot or other terminal
 * punctuation — there is no place in the markup for one.
 *
 * Size and spacing come from the caller's `className`, because the five
 * in-tree render sites differ: `text-2xl` in the app header,
 * `text-4xl sm:text-5xl` on the auth and onboarding layouts, and the
 * public navbar/footer sizes.
 *
 * Note the argument order: `lowercase` is passed to `cn()` AFTER the
 * caller's `className`, not before it. `cn()` is tailwind-merge, which
 * resolves conflicting utilities in favour of the LAST one — so with
 * `cn("… lowercase …", className)` a caller passing `capitalize` would
 * silently win and the wordmark would render "Serenify". Applying
 * `lowercase` last makes FR-030 structural rather than conventional:
 * casing cannot be overridden from a call site, while size and tracking
 * still can, which is what the five differing sites need.
 *
 * Lives in `components/brand/`, not `components/ui/`: that namespace is
 * the shadcn primitive namespace regenerated from `components.json`,
 * and the wordmark is brand identity fixed by the constitution rather
 * than a primitive (`research.md` §8).
 *
 * Two render sites sit outside this tree and cannot consume the
 * component — the `next/og` social card (Satori cannot load Outfit) and
 * the Supabase transactional email templates (inline-styled HTML). They
 * are kept in sync by hand, and that obligation is enforced by
 * `tests/unit/brand/wordmark-sync.test.ts` rather than remembered.
 */
export function Wordmark({ className }: { className?: string }) {
  return (
    <span className={cn("font-display tracking-tight", className, "lowercase")}>
      <span className="text-ink">seren</span>
      <span className="text-meadow-text">ify</span>
    </span>
  );
}
