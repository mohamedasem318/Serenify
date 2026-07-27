import { type Page, expect } from "@playwright/test";

import { currentRevision } from "../../lib/consent/evaluate";

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
 * The signup metadata that makes a fixture user land past the Terms/Privacy entry gate
 * (feature 013, P5 — `contracts/consent-gates.md` §7.3).
 *
 * WHY EVERY FIXTURE NEEDS THIS. `app/(authed)/layout.tsx` is the shell every authenticated
 * route renders through, and since P5 it renders `<TermsReconsentScreen>` instead of that
 * shell for any user without a current `terms_privacy` consent. Fixture users are created
 * with the admin API, which does not go through the signup form — so without this metadata
 * they have no consent row, and a spec that meant to test the dashboard fails on a missing
 * header instead.
 *
 * IT GOES THROUGH THE REAL TRIGGER, NOT AROUND IT. `handle_new_user()` writes the
 * `user_consents` row when — and only when — the signup metadata carries
 * `terms_privacy_version` (`20260726000000_user_consents.sql:108-112`), which is exactly
 * what the production signup path does (`app/(auth)/signup/actions.ts:68`). Spreading this
 * into `user_metadata` therefore exercises the trigger rather than side-stepping it with a
 * direct insert, so the fixtures prove the consent write works instead of hiding a
 * regression in it. That is also why this is a metadata helper and not a
 * `seedTermsConsent()` row-inserter: the admin API can carry metadata, so it should.
 *
 * THE VERSION IS RESOLVED FROM THE REGISTRY, never hardcoded — same discipline as
 * `seedCameraConsent` in `anchor-helpers.ts`. `currentRevision` rather than
 * `bindingRevision` because that is what a real signup records; both satisfy the gate, but
 * only one matches what production writes. When a future revision is published these
 * fixtures follow it automatically instead of going silently stale and re-breaking every
 * authed spec at once.
 *
 * A spec that wants to SEE the gate must omit this — see `consent-entry-gate.spec.ts`.
 */
export function termsConsentMetadata(): { terms_privacy_version: string } {
  return { terms_privacy_version: currentRevision("terms_privacy").versionId };
}

/**
 * Tick the Terms/Privacy acknowledgement on the signup form (feature 013, P4 — §7.1).
 *
 * A SECOND, DISTINCT GATE FROM THE ONE ABOVE. `termsConsentMetadata()` is for fixtures
 * created through the admin API, which never sees a form. This is for the four specs that
 * drive the REAL signup form, where P4 made the acknowledgement mandatory: the checkbox is
 * unchecked by default and cannot be satisfied by a default value (FR-033), and
 * `signUpSchema` requires the literal `"on"`, so a submission without it is rejected
 * server-side and no account is created.
 *
 * Those specs were left submitting the form without it, so signup silently failed and they
 * died on the "Check your email" heading that never came — a failure that looks like a
 * broken OTP flow and is nothing of the sort.
 *
 * Queried by id rather than by label: the field carries TWO `<label>` elements for one
 * input (the padded 44px tap target and the text), which is valid HTML and deliberate, but
 * makes `getByLabel` ambiguous.
 */
export async function acceptTermsOnSignup(page: Page) {
  await page.locator("#accept_terms").check();
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
