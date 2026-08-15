import { expect, test, type Locator, type Page } from "@playwright/test";

import { MODEL_VERSION, createCalibratedEmployee, signInToApp } from "./anchor-helpers";
import { createSeederClient } from "./setup/seeder-client";

import {
  CARD_DESC_PICKED,
  DURATION_OPENED_LABEL,
  OUTCOME_QUESTION,
} from "../../lib/recommendations/card-strings";
import {
  OUTCOME_ACKNOWLEDGEMENT,
  OUTCOME_DIDNT_HELP_SUBLINE,
  RECOMMENDATION_LIBRARY,
} from "../../lib/recommendations/library";

/**
 * Feature 014 / T015 — the US1 loop end to end: suggest → engage → outcome.
 *
 * Seeds an Uneasy day through the real `serenify_seeder` fixture path, signs a real
 * employee in, and drives the card through states 3 → 5 → 6 → 7 → 9 (and the other answer's
 * 3 → 5 → 6 → 8). **No camera is involved** — the readings are seeded rather than captured,
 * which is exactly why this spec runs in CI while the confirmatory-detection proof (T020)
 * cannot.
 *
 * ── What is REAL here, and why that matters ─────────────────────────────────────────
 * Everything except the readings. The engine runs for real, the reducer runs for real, and
 * every `recommendation_picks` write goes through the browser Supabase client AS THE
 * SIGNED-IN USER under owner RLS — there is no privileged path to that table for a fixture
 * to take, by design (`contracts/recommendation-storage-rls.md` §5–6). So a broken policy or
 * a missing grant fails this spec rather than hiding behind a service key.
 *
 * ── Why no item id is hard-coded ────────────────────────────────────────────────────
 * The engine ranks by TIME OF DAY, so the item a CI run gets depends on the hour it runs at.
 * Pinning one would make this spec pass in the morning and fail at night for no product
 * reason. Instead the spec reads the title the card rendered, looks that item up in the
 * library, and asserts its steps render VERBATIM (FR-004) — a stronger claim than an id
 * match, and one that holds at every hour.
 */

const CARD = "[data-testid='things-that-might-help']";

/** The seeded shape: one ended session earlier today whose peak reading is Uneasy. */
async function seedUneasyDay(userId: string) {
  const seeder = createSeederClient();
  const now = Date.now();
  const midnight = new Date();
  midnight.setHours(0, 0, 0, 0);
  // Comfortably inside today and comfortably past the 5-minute fresh-live cut, so the
  // check-in card above renders its recap too (the realistic page, not a stripped one).
  const startedMs = Math.max(now - 90 * 60_000, midnight.getTime() + 60_000);
  let endedMs = Math.min(startedMs + 30 * 60_000, now - 6 * 60_000);
  if (endedMs <= startedMs) endedMs = startedMs + 60_000;

  const { data: session, error: sessionError } = await seeder
    .from("monitoring_sessions")
    .insert({
      user_id: userId,
      started_at: new Date(startedMs).toISOString(),
      ended_at: new Date(endedMs).toISOString(),
      status: "ended",
      end_reason: "user",
      model_version: MODEL_VERSION,
    })
    .select("id")
    .single();
  if (sessionError || !session) throw sessionError ?? new Error("seed session failed");

  const bands = ["at_ease", "a_little_tense", "tense"] as const;
  const span = endedMs - startedMs;
  const { error: rowError } = await seeder.from("window_readings").insert(
    bands.map((band, i) => ({
      session_id: session.id,
      user_id: userId,
      captured_at: new Date(startedMs + ((i + 1) / (bands.length + 1)) * span).toISOString(),
      scored: true,
      band,
    })),
  );
  if (rowError) throw rowError;
}

/** The card, once it has finished its first read and settled on a state. */
async function cardIn(page: Page, state: number): Promise<Locator> {
  const card = page.locator(CARD);
  await expect(card).toHaveAttribute("data-card-state", String(state), { timeout: 30_000 });
  return card;
}

/** FR-030: nothing on this surface ever renders as an error, on any path. */
async function expectNoErrorSurface(card: Locator) {
  const text = (await card.textContent()) ?? "";
  expect(text).not.toMatch(/error|failed|something went wrong|try again|sorry/i);
  expect(text).not.toContain("!");
  await expect(card.getByRole("alert")).toHaveCount(0);
}

async function signedInWithAnUneasyDay(page: Page) {
  const employee = await createCalibratedEmployee("Pick Taker");
  await seedUneasyDay(employee.id);
  await signInToApp(page, employee);
  await expect(page).toHaveURL(/\/app$/);
  return employee;
}

test("recommendations: an uneasy day offers one quiet pick, and 'it helped' settles the card at rest", async ({
  page,
}) => {
  await signedInWithAnUneasyDay(page);

  // ── State 3 — exactly ONE pick, quietly. ─────────────────────────────────────────
  const card = await cardIn(page, 3);
  await expect(card.getByTestId("pick-item")).toHaveCount(1);
  await expect(card.getByTestId("pick-item")).toHaveAttribute("data-prominent", "false");
  await expect(card.getByTestId("card-description")).toHaveText(CARD_DESC_PICKED);
  // The band is stated once, by the check-in card above — never restated here (FR-013).
  const quietText = (await card.textContent()) ?? "";
  for (const band of ["Calm", "Uneasy", "Tense"]) expect(quietText).not.toContain(band);
  await expectNoErrorSurface(card);

  // Whatever the hour produced, it is one of the fifteen reviewed items.
  const title = (await card.getByTestId("pick-item-title").textContent())?.trim() ?? "";
  const item = RECOMMENDATION_LIBRARY.find((entry) => entry.title === title);
  expect(item, `card rendered a title outside the reviewed library: "${title}"`).toBeTruthy();

  // ── State 5 — opening shows the library's own instructions, VERBATIM (FR-004). ────
  await card.getByTestId("show-me").click();
  await expect(card).toHaveAttribute("data-card-state", "5");
  const steps = card.getByTestId("pick-item-steps").locator("li");
  await expect(steps).toHaveCount(item!.steps.length);
  for (const [index, step] of item!.steps.entries()) {
    await expect(steps.nth(index)).toContainText(step);
  }
  // Swap and Ren both withdraw mid-instruction.
  await expect(card.getByTestId("swap")).toHaveCount(0);
  await expect(card.getByTestId("talk-to-ren")).toHaveCount(0);

  // ── State 6 — the question, asked once, only after the steps are closed. ──────────
  await card.getByTestId("close-instructions").click();
  await expect(card).toHaveAttribute("data-card-state", "6");
  await expect(card.getByTestId("outcome-prompt")).toContainText(OUTCOME_QUESTION);
  // The pill now records the engagement without adding a badge.
  await expect(card.getByTestId("pick-item-duration")).toHaveText(DURATION_OPENED_LABEL);

  // ── State 7 — acknowledged, not graded. ──────────────────────────────────────────
  await card.getByTestId("outcome-helped").click();
  await expect(card).toHaveAttribute("data-card-state", "7");
  await expect(card.getByTestId("questionnaire-result-message")).toHaveText(
    OUTCOME_ACKNOWLEDGEMENT,
  );

  // ── State 9 — at rest after the D-6 dwell: no second pick pushed. ────────────────
  await expect(card).toHaveAttribute("data-card-state", "9", { timeout: 15_000 });
  await expect(card.getByTestId("pick-item")).toHaveCount(0);
  await expect(card.getByTestId("resting-lead")).toContainText(item!.title);
  await expectNoErrorSurface(card);

  // The record survives a reload — it was written to the owner's own rows, as the owner.
  await page.reload();
  const reloaded = await cardIn(page, 9);
  await expect(reloaded.getByTestId("resting-lead")).toContainText(item!.title);
});

test("recommendations: 'not really' is acknowledged with the same word and offers the one replacement", async ({
  page,
}) => {
  await signedInWithAnUneasyDay(page);

  const card = await cardIn(page, 3);
  const firstTitle = (await card.getByTestId("pick-item-title").textContent())?.trim() ?? "";

  await card.getByTestId("show-me").click();
  await expect(card).toHaveAttribute("data-card-state", "5");
  await card.getByTestId("close-instructions").click();
  await expect(card).toHaveAttribute("data-card-state", "6");

  // ── State 8 — the SAME acknowledgement word as state 7, and the only path that ────
  //    offers an immediate replacement, drawn on the episode's shared budget.
  await card.getByTestId("outcome-didnt-help").click();
  await expect(card).toHaveAttribute("data-card-state", "8");
  await expect(card.getByTestId("questionnaire-result-message")).toHaveText(
    OUTCOME_ACKNOWLEDGEMENT,
  );
  await expect(card.getByTestId("outcome-subline")).toHaveText(OUTCOME_DIDNT_HELP_SUBLINE);
  await expectNoErrorSurface(card);

  await card.getByTestId("take-replacement").click();
  await expect(card).toHaveAttribute("data-card-state", "3");
  // A different item — nothing repeats within a day once it has been opened (FR-018).
  await expect(card.getByTestId("pick-item-title")).not.toHaveText(firstTitle);
  await expectNoErrorSurface(card);
});
