import { type Page, expect } from "@playwright/test";

import { randomEmail } from "./helpers";
import { createAdminClient } from "./setup/admin-client";

export const MODEL_VERSION = "serenify-video-lbptop-motion-rf-calibrated@2.0.0";

// Recorder-mounting tests skip on WebKit: headless WebKit locks
// navigator.mediaDevices, so getUserMedia cannot be mocked (a Playwright/WebKit
// limitation, not a product issue — the recorder uses standard, engine-agnostic
// APIs and passes on Chromium + Firefox). Real Safari/WebKit camera behavior is
// covered by the cross-browser smoke matrix (ST-21/ST-24, FR-045).
export const WEBKIT_SKIP_REASON =
  "headless WebKit locks navigator.mediaDevices (getUserMedia unmockable); real Safari is covered by the smoke matrix (ST-21/ST-24, FR-045)";

// Base64 of 11832 zero bytes — a structurally valid (2958,) LE float32 blob for
// the mocked /anchor response. The recorder decodes it to \x-hex and writes it
// to anchor_vector; has_anchor only needs it non-null.
const CANNED_VECTOR_B64 = Buffer.alloc(2958 * 4).toString("base64");

// The mocked FastAPI origin is cross-origin to the web app, so the fulfilled
// responses must carry CORS headers (the browser still enforces CORS on
// route.fulfill) and the /anchor POST preflight (Authorization header → non-simple)
// must be answered.
const CORS_HEADERS = {
  "access-control-allow-origin": "*",
  "access-control-allow-methods": "GET, POST, OPTIONS",
  "access-control-allow-headers": "authorization, content-type",
};

/**
 * Route-intercept the FastAPI origin so no real 60s video is ever recorded in CI
 * (📌 DECISION-18). `/healthz` → ready (or 503 when `healthy: false`), `/anchor`
 * → a canned vector (preflight answered).
 *
 * `healthy` may be a live-readable function so a test can flip readiness AFTER
 * the recorder has mounted — e.g. the backend dying between the mount-time probe
 * and the Start re-check (ST-18). The handler reads it on every request.
 */
export async function interceptAnchorApi(
  page: Page,
  opts: { healthy?: boolean | (() => boolean) } = {},
) {
  const healthyOpt = opts.healthy ?? true;
  const isHealthy = () => (typeof healthyOpt === "function" ? healthyOpt() : healthyOpt);
  await page.route("**/healthz", (route) =>
    route.fulfill({
      status: isHealthy() ? 200 : 503,
      headers: { ...CORS_HEADERS, "content-type": "application/json" },
      body: JSON.stringify(
        isHealthy() ? { status: "ready", model_version: MODEL_VERSION } : { status: "down" },
      ),
    }),
  );
  await page.route("**/anchor", (route) => {
    if (route.request().method() === "OPTIONS") {
      return route.fulfill({ status: 204, headers: CORS_HEADERS });
    }
    return route.fulfill({
      status: 200,
      headers: { ...CORS_HEADERS, "content-type": "application/json" },
      body: JSON.stringify({
        model_version: MODEL_VERSION,
        dim: 2958,
        vector_b64: CANNED_VECTOR_B64,
      }),
    });
  });
}

/**
 * Replace getUserMedia / enumerateDevices / MediaRecorder with deterministic
 * stubs so the recorder runs without a real camera (📌 DECISION-18). The fake
 * MediaRecorder emits a canned blob on stop(); the recorder's own 60s timer
 * still drives stop(), so tests fast-forward it with page.clock.
 */
export async function installAnchorMocks(page: Page) {
  await page.addInitScript(() => {
    const RealMediaStream = window.MediaStream;

    // A real stream (canvas track) is a valid <video>.srcObject in every engine,
    // unlike an empty `new MediaStream()` which WebKit can reject.
    const makeStream = (): MediaStream => {
      try {
        const canvas = document.createElement("canvas");
        canvas.width = 64;
        canvas.height = 64;
        canvas.getContext("2d");
        const capture = (canvas as HTMLCanvasElement & { captureStream?: (fps?: number) => MediaStream })
          .captureStream;
        if (typeof capture === "function") return capture.call(canvas, 5);
      } catch {
        /* fall through */
      }
      return new RealMediaStream();
    };

    // Replace the WHOLE navigator.mediaDevices via an instance getter. WebKit
    // exposes getUserMedia as a locked own property, so patching the method
    // in place (assignment or defineProperty) falls through to the real one →
    // permission denied in headless. Shadowing the prototype getter on the
    // navigator instance sidesteps that across all engines.
    const fakeMediaDevices = {
      getUserMedia: async () => makeStream(),
      enumerateDevices: async () => [
        { deviceId: "fake-cam", kind: "videoinput", label: "Fake Camera", groupId: "grp", toJSON() { return this; } },
      ],
      getSupportedConstraints: () => ({}),
      addEventListener: () => {},
      removeEventListener: () => {},
      dispatchEvent: () => false,
    };
    try {
      Object.defineProperty(navigator, "mediaDevices", {
        configurable: true,
        get: () => fakeMediaDevices,
      });
    } catch {
      try {
        (navigator.mediaDevices as { getUserMedia: unknown }).getUserMedia =
          fakeMediaDevices.getUserMedia;
        (navigator.mediaDevices as { enumerateDevices: unknown }).enumerateDevices =
          fakeMediaDevices.enumerateDevices;
      } catch {
        /* last resort: leave as-is */
      }
    }

    class FakeMediaRecorder {
      mimeType: string;
      state: string;
      ondataavailable: ((event: { data: Blob }) => void) | null = null;
      onstop: (() => void) | null = null;
      constructor(_stream: MediaStream, options?: { mimeType?: string }) {
        this.mimeType = options?.mimeType ?? "video/webm";
        this.state = "inactive";
      }
      static isTypeSupported() {
        return true;
      }
      start() {
        this.state = "recording";
      }
      stop() {
        this.state = "inactive";
        this.ondataavailable?.({
          data: new Blob([new Uint8Array([0, 1, 2, 3])], { type: this.mimeType }),
        });
        this.onstop?.();
      }
    }
    try {
      Object.defineProperty(window, "MediaRecorder", {
        configurable: true,
        writable: true,
        value: FakeMediaRecorder,
      });
    } catch {
      (window as unknown as { MediaRecorder: unknown }).MediaRecorder = FakeMediaRecorder;
    }
  });
}

/** Sign in via the login form and land on the onboarding name step (null full_name). */
export async function signInToOnboarding(
  page: Page,
  creds: { email: string; password: string },
) {
  await page.goto("/login");
  await page.getByLabel("Email").fill(creds.email);
  await page.getByLabel("Password", { exact: true }).fill(creds.password);
  await page.getByRole("button", { name: "Sign in" }).click();
  // Generous: the first server-action invocation in the dev server triggers
  // on-demand route compilation, which can exceed the default 5s.
  await expect(page).toHaveURL(/\/onboarding$/, { timeout: 30_000 });
}

/**
 * Start a recording, confirm it began (the countdown is visible), then click
 * through the sticky success view. The recorder auto-stops at 60s, uploads
 * (intercepted), writes the vector, and shows a user-dismissible "You're all set"
 * view; clicking "Continue to dashboard" navigates to /app — the caller asserts
 * that with a generous timeout.
 *
 * Uses real time (the recorder's 60s setInterval), NOT page.clock: install()
 * freezes timers in a way that stalls the post-success Next router navigation,
 * and resume() doesn't reliably recover it. Real time is slower but correct.
 */
export async function recordAnchor(page: Page) {
  const start = page.getByRole("button", { name: "Start recording" });
  await expect(start).toBeVisible({ timeout: 30_000 });
  const timer = page.getByRole("timer");
  // The click can race React hydration on a freshly (hard-)loaded page — the
  // button is in the DOM before its onClick attaches, so a single click is
  // silently lost. Retry until the recording actually begins (countdown shows).
  await expect(async () => {
    if (!(await timer.isVisible())) {
      await start.click({ timeout: 2_000 });
    }
    await expect(timer).toBeVisible({ timeout: 2_000 });
  }).toPass({ timeout: 20_000 });

  // Success no longer auto-redirects (Mohamed 2026-05-28): the recorder shows a
  // sticky "You're all set" view. Click through to /app; the broadcast that
  // refreshes sibling tabs (SC-008) already fired when the vector was written.
  const continueButton = page.getByRole("button", { name: "Continue to dashboard" });
  await expect(continueButton).toBeVisible({ timeout: RECORD_AND_LAND_TIMEOUT });
  await continueButton.click();
}

/** Wall-clock budget for a recording: 60s capture + upload + cold /app compile. */
export const RECORD_AND_LAND_TIMEOUT = 80_000;

/** A confirmed employee with NULL profile full_name (routes through onboarding). */
export async function createOnboardingEmployee() {
  const admin = createAdminClient();
  const email = randomEmail("anchor-emp");
  const password = "Employee123!";
  const { data, error } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  });
  if (error || !data.user) throw error ?? new Error("createUser failed");
  return { email, password, id: data.user.id };
}

/**
 * Confirmed employee with full_name set + no anchor — sign-in lands on /app
 * with the calibration banner visible (skips /onboarding). Needed for the
 * ST-17 cross-tab tests that need a sibling tab already on /app or
 * /app/calibrate, not the /onboarding+proxy path the original SC-008 test
 * happens to exercise.
 */
export async function createCalibratableEmployee(fullName = "Calibrate Test") {
  const emp = await createOnboardingEmployee();
  const admin = createAdminClient();
  const { error } = await admin
    .from("profiles")
    .update({ full_name: fullName })
    .eq("id", emp.id);
  if (error) throw error;
  return emp;
}

/** Sign in and land directly on /app (caller's user must have full_name set). */
export async function signInToApp(
  page: Page,
  creds: { email: string; password: string },
) {
  await page.goto("/login");
  await page.getByLabel("Email").fill(creds.email);
  await page.getByLabel("Password", { exact: true }).fill(creds.password);
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page).toHaveURL(/\/app$/, { timeout: 30_000 });
}

export const DEMO_SUFFIX = "@demo.serenify.local";
export const DEMO_PASSWORD = "DemoUser123!";

/**
 * First demo-cohort employee that has the synthetic anchor, or null when the
 * cohort is absent OR was seeded before feature 004 (so it has no anchor yet).
 * Either way the demo-clean-dashboard check is N/A until `npm run seed` runs
 * with the 004 seed. Reads anchor_captured_at (a timestamp, not the 11832-byte
 * vector) via the service role to keep the probe cheap.
 */
export async function findDemoEmployee(): Promise<{ email: string } | null> {
  const admin = createAdminClient();
  const demo: Array<{ id: string; email: string }> = [];
  let page = 1;
  while (true) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage: 200 });
    if (error) throw error;
    if (data.users.length === 0) break;
    for (const u of data.users) {
      if (u.email?.toLowerCase().endsWith(DEMO_SUFFIX)) demo.push({ id: u.id, email: u.email });
    }
    if (data.users.length < 200) break;
    page += 1;
  }
  if (demo.length === 0) return null;

  const { data: profiles, error } = await admin
    .from("profiles")
    .select("id, role, anchor_captured_at")
    .in("id", demo.map((d) => d.id));
  if (error) throw error;
  const anchoredEmployeeIds = new Set(
    (profiles ?? [])
      .filter((p) => p.role === "employee" && p.anchor_captured_at !== null)
      .map((p) => p.id),
  );
  const employee = demo.find((d) => anchoredEmployeeIds.has(d.id));
  return employee ? { email: employee.email } : null;
}

/** A confirmed manager (team_lead/admin) with NULL full_name. */
export async function createManager(role: "team_lead" | "admin") {
  const admin = createAdminClient();
  const email = randomEmail(`anchor-${role}`);
  const password = "Manager123!";
  const { data, error } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  });
  if (error || !data.user) throw error ?? new Error("createUser failed");
  const { error: roleErr } = await admin
    .from("profiles")
    .update({ role })
    .eq("id", data.user.id);
  if (roleErr) throw roleErr;
  return { email, password, id: data.user.id };
}
