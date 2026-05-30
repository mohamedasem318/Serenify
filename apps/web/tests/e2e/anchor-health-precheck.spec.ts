import { expect, test } from "@playwright/test";

import {
  WEBKIT_SKIP_REASON,
  createOnboardingEmployee,
  installAnchorMocks,
  interceptAnchorApi,
  signInToOnboarding,
} from "./anchor-helpers";

const NAME = "Anchor Employee";
const UNAVAILABLE = /temporarily unavailable/i;

// SKIP-AND-TRACK (feature 005): these specs assert the REMOVED 004 flow — a
// mount-time /healthz gate, a "Start recording" button, and "temporarily
// unavailable" + "Skip for now" on mount. 005 moved the health gate to the green
// room's "I'm ready" (FR-056) and replaced the flow (intro → green room → 3·2·1 →
// recording). They cannot pass green; re-author under T031 (e2e consolidation).
test.beforeEach(() => {
  test.skip(true, "004 calibration flow replaced by 005; re-author under T031 (e2e consolidation)");
});

// ST-18 / FR-048 / 📌 DECISION-10: the recording-state transition (the one that
// renders the live preview + countdown) must be downstream of an awaited 200 from
// /healthz. No optimistic transition — the recorder must NEVER flash the preview
// into a backend that is unreachable. These specs guard both entry points: a
// backend that is already down on mount, and one that dies between the mount-time
// probe and the Start click.

test("backend down on mount: only the unavailable copy + Skip, no Start button, no countdown (ST-18 bonus, FR-048)", async ({
  page,
  browserName,
}) => {
  test.skip(browserName === "webkit", WEBKIT_SKIP_REASON);
  test.setTimeout(60_000);
  await installAnchorMocks(page);
  await interceptAnchorApi(page, { healthy: false });
  const emp = await createOnboardingEmployee();

  await signInToOnboarding(page, emp);
  await page.getByLabel("Full name").fill(NAME);
  await page.getByRole("button", { name: "Continue" }).click();

  await expect(page.getByText(UNAVAILABLE)).toBeVisible({ timeout: 30_000 });
  // The recording UI must never be offered when the pre-check has failed.
  await expect(page.getByRole("button", { name: "Start recording" })).toHaveCount(0);
  await expect(page.getByRole("timer")).toHaveCount(0);
  await expect(page.locator("video")).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Skip for now" })).toBeVisible();
});

test("backend dies between the mount probe and Start: clicking Start shows unavailable with no recording flash (ST-18, FR-048)", async ({
  page,
  browserName,
}) => {
  test.skip(browserName === "webkit", WEBKIT_SKIP_REASON);
  test.setTimeout(60_000);
  await installAnchorMocks(page);

  // Healthy while the recorder mounts (so Start is offered), then flipped to
  // simulate the backend dying before the user clicks. The mount-time probe
  // passes; the Start re-check is what must catch the death.
  let backendHealthy = true;
  await interceptAnchorApi(page, { healthy: () => backendHealthy });
  const emp = await createOnboardingEmployee();

  await signInToOnboarding(page, emp);
  await page.getByLabel("Full name").fill(NAME);
  await page.getByRole("button", { name: "Continue" }).click();

  const start = page.getByRole("button", { name: "Start recording" });
  // The "Start recording" label only appears once the mount probe resolved up
  // (it reads "Checking availability…" while the probe is in flight), so this
  // also confirms the recorder believed the backend was healthy.
  await expect(start).toBeVisible({ timeout: 30_000 });
  await expect(start).toBeEnabled();

  // Backend dies; the next /healthz (the awaited Start re-check) returns 503.
  backendHealthy = false;

  // A single click can race React hydration on the freshly-transitioned recorder
  // (the button is in the DOM before onClick attaches). Retry the click until the
  // unavailable copy appears — once a click lands, the re-check disables the
  // button, so stray retries are harmless no-ops.
  await expect(async () => {
    if (!(await page.getByText(UNAVAILABLE).isVisible())) {
      await start.click({ timeout: 2_000 }).catch(() => {});
    }
    await expect(page.getByText(UNAVAILABLE)).toBeVisible({ timeout: 2_000 });
  }).toPass({ timeout: 20_000 });

  // The load-bearing assertion: the preview + countdown must NEVER have painted.
  // On the pre-fix recorder the click optimistically reached `recording` and the
  // timer + <video> stayed up for the full 60s — this fails on that behaviour.
  await expect(page.getByRole("timer")).toHaveCount(0);
  await expect(page.locator("video")).toHaveCount(0);
});
