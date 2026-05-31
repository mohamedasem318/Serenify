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
        const ctx = canvas.getContext("2d");
        // Paint the fake feed bright so the on-device luma read clears the soft gate's
        // too-dark floor (LUMA_MIN). With the injected detector reporting a centred
        // face, the green-room gate resolves to "ready". A SINGLE fill isn't reliably
        // carried into captureStream's frames, so repaint on every rAF — that keeps
        // the captured frames non-black (and the breathing motion is irrelevant here).
        const paint = () => {
          if (ctx) {
            ctx.fillStyle = "#9aa0a6";
            ctx.fillRect(0, 0, canvas.width, canvas.height);
          }
        };
        paint();
        const capture = (canvas as HTMLCanvasElement & { captureStream?: (fps?: number) => MediaStream })
          .captureStream;
        if (typeof capture === "function") {
          const stream = capture.call(canvas, 5);
          const tick = () => {
            paint();
            requestAnimationFrame(tick);
          };
          requestAnimationFrame(tick);
          return stream;
        }
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

/**
 * Inject a deterministic on-device detector (📌 DECISION-26 e2e seam, read by
 * `lib/face-detect/detector.ts`). `detect()` always reports a centred, well-sized,
 * high-confidence face, so the REAL `useFramingGuide` loop + the REAL framing gate
 * resolve to "ready" without a real face — the soft gate clears and "I'm ready"
 * enables. The framing pipeline runs ACTIVE (frame reads, luma, gate/drift) yet
 * transmits nothing, which is exactly what the egress proof asserts. Absent this,
 * the real BlazeFace would see no face on the synthetic feed and hold the gate.
 */
export async function installActiveDetector(page: Page) {
  await page.addInitScript(() => {
    (window as unknown as { __anchorE2EDetector__?: unknown }).__anchorE2EDetector__ = async () => ({
      // cx/cy = 0.5 → dead-centre (≤ CENTRE_MAX); h = 0.5 → within SIZE bounds;
      // score 0.95 ≥ SCORE_MIN. Combined with the bright feed → gate "ready".
      detect: () => ({ cx: 0.5, cy: 0.5, w: 0.4, h: 0.5, score: 0.95 }),
      close: () => {},
    });
  });
}

/**
 * Make getUserMedia reject with a specific DOMException-like `error.name`, so the
 * orchestrator's real error→state mapping routes to one of the three calm
 * camera-access states (FR-031–035). Installs AFTER `installAnchorMocks` (overrides
 * its getUserMedia on the same fake mediaDevices). `enumerateDevices` still works so
 * the device picker mounts.
 */
export async function installCameraError(page: Page, errorName: string) {
  await page.addInitScript((name: string) => {
    const reject = () => Promise.reject(Object.assign(new Error("camera error"), { name }));
    const apply = () => {
      try {
        const md = navigator.mediaDevices as unknown as { getUserMedia?: unknown };
        if (md) md.getUserMedia = reject;
      } catch {
        /* ignore */
      }
    };
    apply();
    // installAnchorMocks redefines navigator.mediaDevices via a getter that returns a
    // fresh object; re-apply on the next tick so this override wins.
    setTimeout(apply, 0);
  }, errorName);
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
 * Drive the 005 capture flow from the intro through to success, then click its
 * "Back to …" CTA, in REAL time (the recorder's own 60s setInterval — page.clock
 * stalls the post-success Next navigation, the 004 finding). Assumes the recorder is
 * mounted (intro visible) and `installActiveDetector` ran so the soft gate clears.
 * The caller asserts the landing (first-time → /app, recalibrate → /app/account).
 */
export async function recordAnchor(page: Page) {
  // intro → green room
  await page.getByRole("button", { name: "Turn on camera" }).click();

  // the soft gate clears once the injected detector reports a centred, lit face.
  const ready = page.getByRole("button", { name: /ready/i });
  await expect(ready).toBeEnabled({ timeout: 30_000 });

  // a click can race React hydration on a freshly (hard-)loaded page — retry until
  // the recording begins. "I'm ready" → /healthz ok → 3·2·1 (~3s) → the timer.
  const timer = page.getByRole("timer");
  await expect(async () => {
    if (await timer.isVisible()) return;
    if (await ready.isVisible().catch(() => false)) {
      await ready.click({ timeout: 2_000 }).catch(() => {});
    }
    await expect(timer).toBeVisible({ timeout: 8_000 });
  }).toPass({ timeout: 30_000 });

  // auto-stops at 60s → uploads the single clip (intercepted) → writes → success.
  await expect(
    page.getByRole("heading", { name: /your baseline is (set|updated)/i }),
  ).toBeVisible({ timeout: RECORD_AND_LAND_TIMEOUT });
  await page.getByRole("button", { name: /back to (home|account)/i }).click();
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

/**
 * Confirmed employee WITH a stored baseline — the anchor columns are written via the
 * service role (the same canned all-zero (2958,) vector the /anchor mock returns), so
 * has_anchor is true: /app shows no banner, and /app/calibrate?mode=recalibrate enters
 * recalibrate mode (copy "update", exit /app/account). Used by the recalibrate path
 * without paying a second real 60s recording to seed the prior baseline.
 */
export async function createCalibratedEmployee(fullName = "Recalibrate Test") {
  const emp = await createCalibratableEmployee(fullName);
  const admin = createAdminClient();
  const hex = Buffer.alloc(2958 * 4).toString("hex"); // bytea of zeros → non-null anchor
  const { error } = await admin
    .from("profiles")
    .update({
      anchor_vector: `\\x${hex}`,
      anchor_captured_at: new Date().toISOString(),
      anchor_model_version: MODEL_VERSION,
    })
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
