type WelcomeBannerProps = {
  fullName: string | null;
  /**
   * Test seam — pass in a fixed Date to make the rendered greeting
   * deterministic. Production callers omit it; the component reads
   * `new Date()` server-side per contracts/components.md (server's
   * local time; timezone-deferral follow-up logged in BACKLOG).
   */
  now?: Date;
};

/**
 * Banner shown at the top of the employee /app body. Two lines:
 *
 *   1. <h1> DM Serif Display: "Good morning, Jane" / "Good afternoon"
 *      / "Good evening" — name-less when fullName is null/empty.
 *   2. <p> Inter: the static subtitle locked by plan.md Decision M.
 *
 * Time-of-day bands (server-local time):
 *   05:00 – 11:59  Good morning
 *   12:00 – 17:59  Good afternoon
 *   18:00 – 04:59  Good evening
 *
 * First-name extraction (Decision K-adjacent, FR-010): split fullName
 * on whitespace, take the first non-empty token verbatim — preserves
 * capitalisation and diacritics. If fullName has no usable token, the
 * greeting renders without a name.
 *
 * Subtitle wording is locked per Decision M. Do not change without a
 * CHANGELOG amendment.
 */
const SUBTITLE = "A space to check in with yourself.";

function greetingFor(date: Date): "Good morning" | "Good afternoon" | "Good evening" {
  const hour = date.getHours();
  if (hour >= 5 && hour < 12) return "Good morning";
  if (hour >= 12 && hour < 18) return "Good afternoon";
  return "Good evening";
}

function firstNameOf(fullName: string | null): string | null {
  if (!fullName) return null;
  const token = fullName.trim().split(/\s+/)[0] ?? "";
  return token.length > 0 ? token : null;
}

export function WelcomeBanner({ fullName, now }: WelcomeBannerProps) {
  const greeting = greetingFor(now ?? new Date());
  const firstName = firstNameOf(fullName);
  const heading = firstName ? `${greeting}, ${firstName}` : greeting;

  return (
    <header className="space-y-2">
      <h1 className="font-display text-3xl leading-tight text-ink sm:text-4xl">
        {heading}
      </h1>
      <p className="text-base leading-relaxed text-muted">{SUBTITLE}</p>
    </header>
  );
}
