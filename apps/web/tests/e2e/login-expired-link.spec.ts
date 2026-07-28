import { expect, test } from "@playwright/test";

test("shows the calm expired-link notice when ?error=expired_link", async ({
  page,
}) => {
  await page.goto("/login?error=expired_link");

  const notice = page.getByRole("status");
  await expect(notice).toBeVisible();
  await expect(notice).toHaveText(
    "Your activation link expired. Please sign in below.",
  );

  // The form must still render — the notice never replaces the sign-in path.
  await expect(
    page.getByRole("heading", { name: "Welcome back" }),
  ).toBeVisible();
  await expect(page.getByRole("button", { name: "Sign in" })).toBeVisible();
});

test("renders no notice on a bare /login", async ({ page }) => {
  await page.goto("/login");
  await expect(page.getByRole("status")).toHaveCount(0);
});

test("renders no notice for an unknown error value", async ({ page }) => {
  await page.goto("/login?error=mystery_code");
  await expect(page.getByRole("status")).toHaveCount(0);
});

/**
 * Feature 013 / P6 — T087: the second of the two root-route checks (`research.md` §12.2).
 *
 * A Supabase email link that lands on `/` instead of `/auth/callback` (a misconfigured
 * `site_url`, which is exactly the failure this defence exists for) must still forward,
 * or the PKCE exchange never happens and the link is spent for nothing. The landing-page
 * takeover put a rendered page on that route for the first time, so this is the check
 * that the forward still outranks it.
 *
 * Appended to this auth spec because it is unauthenticated and belongs with the other
 * email-link behaviours, and because §12.2 asks for two narrow checks rather than a new
 * suite. The REAL email-link case — a genuine Supabase confirmation and recovery mail,
 * clicked on a real device — is ST-8 and stays a human check in P8; this only proves the
 * redirect wiring.
 */
test("root route: /?code=… still forwards to the auth callback", async ({ page }) => {
  // ASSERTED ON THE REDIRECT CHAIN, NOT THE FINAL URL, and deliberately. `test` is not a
  // real PKCE code, so the callback rejects it and lands on /login?error=expired_link —
  // which is correct behaviour and would make a final-URL assertion prove nothing about
  // whether `/` forwarded at all. The browser follows the 307 before the navigation
  // commits, so the hop is only visible in `redirectedFrom()`.
  const response = await page.goto("/?code=test");

  const chain: string[] = [];
  for (let request = response?.request() ?? null; request; request = request.redirectedFrom()) {
    chain.unshift(request.url());
  }

  expect(chain[0]).toContain("/?code=test");
  expect(
    chain.some((url) => url.includes("/auth/callback?code=test")),
    `expected /?code=test to forward to the callback; the chain was:\n  ${chain.join("\n  ")}`,
  ).toBe(true);
});
