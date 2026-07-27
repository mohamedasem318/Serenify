import { expect, test } from "@playwright/test";

import { randomEmail, signInAs, termsConsentMetadata } from "./helpers";
import { createAdminClient } from "./setup/admin-client";

/**
 * The app-shell Terms/Privacy entry gate, end to end (feature 013, §7.3, FR-043d).
 *
 * THIS IS THE ONE SPEC WHOSE USER IS DELIBERATELY WITHOUT CONSENT. Every other fixture in
 * this suite now carries `termsConsentMetadata()` so it lands past the gate — which means
 * that without this spec, fixing the fixtures would leave the gate with ZERO end-to-end
 * coverage, and the only thing standing behind the highest-blast-radius change in the
 * feature would be P8's manual ST-10. Unit tests pin the layout's branching; they cannot
 * show that a real browser, on a real session, against the real database, is stopped.
 *
 * The user here is created WITHOUT `termsConsentMetadata()`. That is not an oversight and
 * must not be "fixed" — it is the entire fixture. `handle_new_user()` writes a consent row
 * only when the signup metadata carries `terms_privacy_version`, so omitting it produces
 * exactly the state a pre-existing user is in: never asked, therefore not consented
 * (§7.4, FR-041).
 *
 * THE URL ASSERTIONS ARE THE POINT OF THE FILE. The gate renders a different tree; it
 * never redirects. A redirect-based gate can loop, and a loop in the layout every
 * authenticated route renders through is a total product lockout. Asserting that the URL
 * is unchanged — on a deep route, not just `/app` — is the end-to-end counterpart of the
 * unit test that mocks `redirect` and expects zero calls.
 */

const PASSWORD = "Blocked123!";

/** A confirmed employee with a full_name but NO terms_privacy consent row. */
async function createUnconsentedEmployee(): Promise<{ email: string }> {
  const admin = createAdminClient();
  const email = randomEmail("gate-blocked");
  const { data, error } = await admin.auth.admin.createUser({
    email,
    password: PASSWORD,
    email_confirm: true,
    // full_name IS set, so the proxy sends them straight to /app rather than to
    // /onboarding — the gate, not the onboarding step, is what must stop them.
    // `terms_privacy_version` is deliberately ABSENT.
    user_metadata: { full_name: "Blocked Employee" },
  });
  if (error || !data.user) throw error ?? new Error("createUser failed");

  // Prove the fixture really is in the un-consented state, rather than trusting that the
  // trigger's condition still works. If a future migration started writing a consent row
  // unconditionally, every assertion below would pass vacuously against a user who was
  // never actually blocked — and this spec would quietly stop testing the gate.
  const { data: rows, error: readErr } = await admin
    .from("user_consents")
    .select("document_version")
    .eq("user_id", data.user.id)
    .eq("consent_key", "terms_privacy");
  if (readErr) throw readErr;
  expect(
    rows ?? [],
    "fixture precondition: this user must hold NO terms_privacy consent",
  ).toHaveLength(0);

  return { email };
}

test("entry gate: an un-consented user is blocked, in place, and can still read both documents and sign out", async ({
  page,
}) => {
  const { email } = await createUnconsentedEmployee();
  await signInAs(page, { email, password: PASSWORD });

  // ── It blocks, and it renders instead of the shell ────────────────────────
  await expect(page).toHaveURL(/\/app$/);
  await expect(
    page.getByRole("heading", { name: /have been revised/i }),
  ).toBeVisible();
  // The normal shell is NOT in the tree — not hidden, not empty. The blocked user has no
  // header to navigate from and no chat pill to open.
  await expect(page.getByRole("link", { name: "Go to home" })).toHaveCount(0);
  await expect(page.getByRole("button", { name: /talk to ren/i })).toHaveCount(0);

  // ── FR-043d: both documents readable in full, in a new tab ────────────────
  const termsLink = page.getByRole("link", {
    name: /terms of service.*new tab/i,
  });
  const privacyLink = page.getByRole("link", {
    name: /privacy policy.*new tab/i,
  });
  await expect(termsLink).toBeVisible();
  await expect(privacyLink).toBeVisible();
  await expect(termsLink).toHaveAttribute("href", "/terms");
  await expect(privacyLink).toHaveAttribute("href", "/privacy");
  await expect(termsLink).toHaveAttribute("target", "_blank");
  await expect(privacyLink).toHaveAttribute("target", "_blank");

  // Follow one of them for real. A new tab means the blocked screen is still mounted
  // behind it, so the accept control is there when the user comes back.
  const termsTab = await page.context().newPage();
  await termsTab.goto("/terms");
  await expect(
    termsTab.getByRole("heading", { name: /terms of service/i }).first(),
  ).toBeVisible();
  await termsTab.close();
  await expect(
    page.getByRole("heading", { name: /have been revised/i }),
  ).toBeVisible();

  // ── There is no decline control (§7.5, FR-042) ────────────────────────────
  await expect(page.getByRole("button", { name: /decline|not now|reject/i })).toHaveCount(
    0,
  );

  // ── FR-043d: sign out works from INSIDE the blocked shell ─────────────────
  // Clicked directly, not via the `signOut` helper: that helper goes through the header's
  // profile dropdown, and a blocked user has no header. The control being reachable
  // without one is precisely the guarantee.
  await page.getByRole("button", { name: /sign out/i }).click();
  await expect(page).toHaveURL(/\/login$/);
});

test("entry gate: it renders in place on a deep authed route — the URL never changes", async ({
  page,
}) => {
  const { email } = await createUnconsentedEmployee();
  await signInAs(page, { email, password: PASSWORD });

  // A deep route, so a redirect-based gate would be unmistakable: the URL would move to
  // the consent destination and, if that destination were itself inside the gated group,
  // keep moving. Rendering in place cannot loop, and this is what proves it in a browser.
  await page.goto("/app/account");
  await expect(page).toHaveURL(/\/app\/account$/);
  await expect(
    page.getByRole("heading", { name: /have been revised/i }),
  ).toBeVisible();

  // Reloading does not escape it either — the gate is a function of stored consent, not
  // of navigation history.
  await page.reload();
  await expect(page).toHaveURL(/\/app\/account$/);
  await expect(
    page.getByRole("heading", { name: /have been revised/i }),
  ).toBeVisible();
});

test("entry gate: accepting records the consent and unblocks the app", async ({ page }) => {
  const { email } = await createUnconsentedEmployee();
  await signInAs(page, { email, password: PASSWORD });
  await expect(
    page.getByRole("heading", { name: /have been revised/i }),
  ).toBeVisible();

  await page.getByRole("button", { name: /agree and continue/i }).click();

  // The app itself is the confirmation — silent success, no toast.
  await expect(page.getByRole("link", { name: "Go to home" })).toBeVisible();
  await expect(
    page.getByRole("heading", { name: /have been revised/i }),
  ).toHaveCount(0);
  await expect(page).toHaveURL(/\/app$/);

  // The row that was written is the CURRENT registry revision — the same value
  // `termsConsentMetadata()` seeds for every other fixture, which is what makes the two
  // paths equivalent rather than merely both-green.
  const admin = createAdminClient();
  const { data: user } = await admin.auth.admin.listUsers({ perPage: 200 });
  const created = user.users.find((u) => u.email === email);
  expect(created, "the fixture user should exist").toBeTruthy();

  const { data: rows, error } = await admin
    .from("user_consents")
    .select("document_version")
    .eq("user_id", created!.id)
    .eq("consent_key", "terms_privacy");
  if (error) throw error;
  expect(rows).toHaveLength(1);
  expect(rows?.[0]?.document_version).toBe(
    termsConsentMetadata().terms_privacy_version,
  );
});
