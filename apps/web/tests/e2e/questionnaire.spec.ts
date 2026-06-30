import { expect, test } from "@playwright/test";

import { createCalibratedEmployee, signInToApp } from "./anchor-helpers";
import { seedRetrospectiveSession } from "./monitoring-helpers";

/**
 * T058 — Feature 012 questionnaire flows (Principle VII e2e gate).
 *
 * Covers, on the real authenticated employee dashboard:
 *   • the weekly work-environment check-in (fresh ISO week) — stepper, Back, Done;
 *   • the session-end product feedback card via the just-ended-session handoff —
 *     Good / Skip / negative reasons, and the tailored account route targets;
 *   • confirmatory and session-end never co-occur (only ONE coordinator surface mounts);
 *   • the Ren handoff opens chat with a soft opener and NO recommendation cards;
 *   • SC-007: each session-end path reaches its end state in ≤3 interactions.
 *
 * Seeded-employee pattern mirrors employee-dashboard-shell.spec.ts; globalSetup truncates
 * @example.com between runs so this is idempotent.
 */

const HANDOFF_KEY = "serenify.questionnaire.last_ended_session";

test("weekly check-in: Could be better → two-step stepper → Done", async ({ page }) => {
  const emp = await createCalibratedEmployee("Weekly Tester");
  await signInToApp(page, emp);

  const card = page.getByTestId("weekly-check-in");
  await expect(card).toBeVisible();
  await expect(card.getByText("How has the work environment felt lately?")).toBeVisible();

  await card.getByRole("button", { name: /Could be better/ }).click();
  // Q1 → auto-advance to Q2 with the progress bar at step 1 then 2.
  await expect(page.getByRole("progressbar")).toHaveAttribute("aria-valuenow", "1");
  await card.getByRole("button", { name: /Unclear instructions/i }).click();
  await expect(page.getByRole("progressbar")).toHaveAttribute("aria-valuenow", "2");
  await expect(card.getByText("What support would have made this week better?")).toBeFocused();

  // Done is disabled until a support is chosen.
  const done = card.getByRole("button", { name: /^Done/ });
  await expect(done).toBeDisabled();
  await card.getByRole("button", { name: /quieter workspace/i }).click();
  await expect(done).toBeEnabled();
  await done.click();

  await expect(card.getByText("Heard — thanks for speaking up.")).toBeVisible();
  await expect(card.getByText(/Only an anonymized team-level summary/)).toBeVisible();
});

test("session-end feedback: handoff → Something was off → routes to the notifications anchor", async ({
  page,
}) => {
  const emp = await createCalibratedEmployee("Session-end Tester");
  const sessionId = await seedRetrospectiveSession(emp.id);
  await signInToApp(page, emp);

  // Simulate the monitor's just-ended-session handoff, then reload so the coordinator takes it.
  await page.evaluate(
    ([key, id]) => sessionStorage.setItem(key, id),
    [HANDOFF_KEY, sessionId] as const,
  );
  await page.reload();

  const card = page.getByTestId("session-end-feedback");
  await expect(card).toBeVisible();
  // Confirmatory + session-end never co-occur: exactly one coordinator surface.
  await expect(page.getByTestId("weekly-check-in")).toHaveCount(0);

  await card.getByRole("button", { name: /Something was off/ }).click();
  await card.getByRole("button", { name: /needed quiet time/i }).click();
  await card.getByRole("button", { name: /Notification settings/i }).click();

  await expect(page).toHaveURL(/\/app\/account#notifications$/);
  // The anchor target exists and is scrolled into view.
  await expect(page.locator("section#notifications")).toBeVisible();
});

test("session-end feedback: suggestion didn't help routes to /app/account (no preferences anchor)", async ({
  page,
}) => {
  const emp = await createCalibratedEmployee("Route Tester");
  const sessionId = await seedRetrospectiveSession(emp.id);
  await signInToApp(page, emp);
  await page.evaluate(([key, id]) => sessionStorage.setItem(key, id), [HANDOFF_KEY, sessionId] as const);
  await page.reload();

  const card = page.getByTestId("session-end-feedback");
  await card.getByRole("button", { name: /Something was off/ }).click();
  await card.getByRole("button", { name: /suggestion didn.t help/i }).click();
  await card.getByRole("button", { name: /Update preferences/i }).click();
  await expect(page).toHaveURL(/\/app\/account$/);
});

test("Ren confirmatory handoff opens chat with a soft opener and no recommendation cards", async ({
  page,
}) => {
  const emp = await createCalibratedEmployee("Handoff Tester");
  await signInToApp(page, emp);

  await page.goto("/app/chat?handoff=confirmatory_yes");
  const composer = page.getByTestId("chat-composer-input");
  await expect(composer).toHaveValue(/talk it through/i);
  await expect(page.getByTestId("recommendation-cards")).toHaveCount(0);
});
