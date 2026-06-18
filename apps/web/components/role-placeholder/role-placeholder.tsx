import { SignOutButton } from "@/components/sign-out-button";

type Role = "team_lead" | "admin";

type RolePlaceholderProps = {
  role: Role;
};

/**
 * Locked copy per plan.md Decision L. Do NOT change without a
 * CHANGELOG amendment. Two variants — team_lead and admin — each
 * with its own heading + subtitle. The header (logo, theme toggle,
 * profile avatar) renders identically to the employee shell per
 * FR-034; only the body content differs.
 */
const COPY: Record<Role, { heading: string; subtitle: string }> = {
  team_lead: {
    heading: "Your team-lead view is coming together.",
    subtitle:
      "We're building something that respects your team's privacy. Check back soon.",
  },
  admin: {
    heading: "Your admin view is in progress.",
    // Subtitle amended 2026-05-22 (see CHANGELOG). The prior wording
    // ended in "available below." which was misdirective — Account
    // lives in the header dropdown, not below the subtitle.
    subtitle:
      "Org-wide tools land in a later release. Account settings are available from the header dropdown.",
  },
};

/**
 * One-screen placeholder body for `profiles.role` of `team_lead` or
 * `admin`. Replaces the feature-001 role-banner placeholder for
 * managers per FR-034.
 *
 * Layout per contracts/components.md / T054:
 *   - Centered single column with py-24 sm:py-32 — generous vertical
 *     space frames the placeholder as a calm "we'll get to you"
 *     moment rather than an empty dashboard.
 *   - max-w-2xl + text-center keeps the copy column readable on
 *     wide viewports without forcing the heading to span the full
 *     dashboard width.
 *   - Outfit (font-display) heading at the welcome-banner scale
 *     (text-3xl sm:text-4xl) so the visual hierarchy reads as a
 *     proper page-level title.
 *   - Inter subtitle in text-muted matches the muted secondary copy
 *     used by the home placeholder cards.
 *   - SignOutButton variant="secondary" below — uses the
 *     post-Phase-6 calm-secondary variant (surface tile, meadow
 *     border, ink text) for AAA contrast and clear button character.
 *
 * Copy strings live in the COPY constant so the apostrophes render
 * via expression interpolation rather than as JSX text, sidestepping
 * the react/no-unescaped-entities lint rule without needing &apos;
 * entities in the source.
 *
 * The chat pill is gated to employee-only at the (authed) layout
 * level (13be4f2 / FR-035) — managers never see it, no special
 * handling needed here.
 *
 * The cross-tab listener (T060, future) is also a layout-level
 * concern; sign-out via the SignOutButton below propagates to other
 * tabs automatically once T060 ships.
 */
export function RolePlaceholder({ role }: RolePlaceholderProps) {
  const copy = COPY[role];
  return (
    <section
      aria-labelledby="role-placeholder-heading"
      className="mx-auto flex max-w-2xl flex-col items-center gap-6 py-24 text-center sm:py-32"
    >
      <h1
        id="role-placeholder-heading"
        className="font-display text-3xl leading-tight text-ink sm:text-4xl"
      >
        {copy.heading}
      </h1>
      <p className="text-base leading-relaxed text-muted">{copy.subtitle}</p>
      <SignOutButton variant="secondary" />
    </section>
  );
}
