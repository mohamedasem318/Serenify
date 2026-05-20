import { type Page, expect } from "@playwright/test";

export async function signInAs(
  page: Page,
  credentials: { email: string; password: string; fullName?: string },
) {
  await page.goto("/login");
  await page.getByLabel("Email").fill(credentials.email);
  await page.getByLabel("Password", { exact: true }).fill(credentials.password);
  await page.getByRole("button", { name: "Sign in" }).click();
  // Seeded users (via /api/admin/invite) have full_name = NULL, so the
  // proxy bounces them to /onboarding. Fill the form to reach /app.
  await expect(page).toHaveURL(/\/(app|onboarding)$/);
  if (page.url().endsWith("/onboarding")) {
    await page.getByLabel("Full name").fill(credentials.fullName ?? "Test User");
    await page.getByRole("button", { name: "Continue" }).click();
    await expect(page).toHaveURL(/\/app$/);
  }
}

export async function signOut(page: Page) {
  // Feature 003 moved Sign out into the ProfileDropdown (T024). The
  // dropdown trigger is the avatar; Sign out is a DropdownMenuItem
  // queried by test-id (resolved guidance (d): the role=menuitem
  // count does not include the DropdownMenuLabel for the display
  // name, so a role-based lookup undercounts).
  await page.getByLabel("Open profile menu").click();
  await page.getByTestId("profile-dropdown-signout").click();
  await expect(page).toHaveURL(/\/login$/);
}

export function randomEmail(role: string) {
  const stamp = Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
  return `${role}-${stamp}@example.com`;
}

/**
 * Fetches the most recent Supabase auth email for {email} from local
 * Mailpit (port 54324 per supabase/config.toml — note Supabase ships
 * Mailpit under the legacy `[inbucket]` config block) and returns
 * the 6-digit OTP it contains.
 *
 * Mailpit exposes a JSON API: `/api/v1/messages?query=to:{email}`
 * lists matching messages newest-first; each entry's `Snippet` is a
 * plain-text excerpt that already contains the OTP (default Supabase
 * templates render "Alternatively, enter the code: 123456"). For
 * defensiveness we fall back to fetching the full body if no 6-digit
 * group lives in the snippet.
 *
 * Polls for up to ~10s because the local SMTP send is asynchronous.
 */
export async function fetchLatestOtp(email: string): Promise<string> {
  const mailpitUrl =
    process.env.MAILPIT_URL ?? "http://127.0.0.1:54324";
  const query = encodeURIComponent(`to:${email}`);
  const deadline = Date.now() + 10_000;
  while (Date.now() < deadline) {
    const listRes = await fetch(
      `${mailpitUrl}/api/v1/messages?query=${query}&limit=1`,
    );
    if (listRes.ok) {
      const payload = (await listRes.json()) as {
        messages?: Array<{ ID: string; Snippet?: string }>;
      };
      const latest = payload.messages?.[0];
      if (latest) {
        const snippetMatch = latest.Snippet?.match(/\b(\d{6})\b/);
        if (snippetMatch) return snippetMatch[1]!;
        const msgRes = await fetch(
          `${mailpitUrl}/api/v1/message/${latest.ID}`,
        );
        if (msgRes.ok) {
          const msg = (await msgRes.json()) as {
            Text?: string;
            HTML?: string;
          };
          const bodyMatch = `${msg.Text ?? ""}\n${msg.HTML ?? ""}`.match(
            /\b(\d{6})\b/,
          );
          if (bodyMatch) return bodyMatch[1]!;
        }
      }
    }
    await new Promise((r) => setTimeout(r, 200));
  }
  throw new Error(
    `Mailpit: no email with a 6-digit OTP for ${email} after 10s`,
  );
}
