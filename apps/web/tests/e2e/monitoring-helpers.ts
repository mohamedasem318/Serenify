import { type Page } from "@playwright/test";

import { MODEL_VERSION } from "./anchor-helpers";
import { createAdminClient } from "./setup/admin-client";

/**
 * Feature 008 / US1–US4 — T051 e2e seams. Boundary mocks only (📌 DECISION-26): getUserMedia
 * + MediaRecorder + the FastAPI monitoring endpoints are faked, while the REAL orchestration
 * (state machine, continuous recorder loop, the typed monitoring-client, the face-detector
 * gate via the injected detector, the dashboard recap RLS reads) all run. This is NOT the
 * cross-browser capture gate — that is the real-Safari smoke (Phase 2 / smoke-tests.md
 * ST-08-2/3); WebKit is skipped here because headless WebKit locks navigator.mediaDevices.
 */

const CORS_HEADERS = {
  "access-control-allow-origin": "*",
  "access-control-allow-methods": "GET, POST, PATCH, OPTIONS",
  "access-control-allow-headers": "authorization, content-type",
};

/**
 * Replace getUserMedia / enumerateDevices / MediaRecorder with deterministic stubs so the
 * CONTINUOUS recorder runs without a real camera. Unlike the anchor flow's recorder (one
 * 60 s clip emitted on stop), the monitoring recorder runs ONE timeslice recorder for the
 * whole session — so the fake MediaRecorder must emit `ondataavailable` on its OWN timer
 * when `start(timeslice)` is called, which is what drives the per-stride upload loop.
 */
export async function installMonitoringMocks(page: Page) {
  await page.addInitScript(() => {
    const RealMediaStream = window.MediaStream;

    const makeStream = (): MediaStream => {
      try {
        const canvas = document.createElement("canvas");
        canvas.width = 64;
        canvas.height = 64;
        const ctx = canvas.getContext("2d");
        const paint = () => {
          if (ctx) {
            ctx.fillStyle = "#9aa0a6";
            ctx.fillRect(0, 0, canvas.width, canvas.height);
          }
        };
        paint();
        const capture = (
          canvas as HTMLCanvasElement & { captureStream?: (fps?: number) => MediaStream }
        ).captureStream;
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

    const fakeMediaDevices = {
      getUserMedia: async () => makeStream(),
      enumerateDevices: async () => [
        { deviceId: "fake-cam", kind: "videoinput", label: "Fake Camera", groupId: "g", toJSON() { return this; } },
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
        (navigator.mediaDevices as { getUserMedia: unknown }).getUserMedia = fakeMediaDevices.getUserMedia;
        (navigator.mediaDevices as { enumerateDevices: unknown }).enumerateDevices =
          fakeMediaDevices.enumerateDevices;
      } catch {
        /* last resort */
      }
    }

    class FakeMediaRecorder {
      mimeType: string;
      state: string;
      ondataavailable: ((event: { data: Blob }) => void) | null = null;
      onstop: (() => void) | null = null;
      private _timer: number | null = null;
      constructor(_stream: MediaStream, options?: { mimeType?: string }) {
        this.mimeType = options?.mimeType ?? "video/webm";
        this.state = "inactive";
      }
      static isTypeSupported() {
        return true;
      }
      start() {
        // The requested timeslice (10 s in prod) is ignored — the fake emits on a fast fixed
        // cadence so the e2e flows quickly; the recorder appends each chunk just as in prod.
        this.state = "recording";
        // Emit a chunk on a FAST fixed cadence (independent of the requested 10 s stride) so
        // the e2e flows quickly; the recorder appends each chunk and uploads the contiguous-
        // so-far, exactly as in production — just sped up.
        this._timer = window.setInterval(() => {
          this.ondataavailable?.({ data: new Blob([new Uint8Array([0, 1, 2, 3])], { type: this.mimeType }) });
        }, 400);
      }
      stop() {
        this.state = "inactive";
        if (this._timer != null) {
          clearInterval(this._timer);
          this._timer = null;
        }
        this.onstop?.();
      }
    }
    try {
      Object.defineProperty(window, "MediaRecorder", { configurable: true, writable: true, value: FakeMediaRecorder });
    } catch {
      (window as unknown as { MediaRecorder: unknown }).MediaRecorder = FakeMediaRecorder;
    }
  });
}

/**
 * Route-intercept the FastAPI monitoring endpoints so no real backend is needed (it isn't up
 * in CI, the same reason the anchor flow mocks /anchor). The window endpoint returns
 * `warming_up` for the first two windows then `reading` (at_ease), so the warming-up → first
 * band transition is exercised end-to-end. Only the FastAPI origin's `/monitoring/sessions…`
 * paths are matched — Supabase's `rest/v1/monitoring_sessions` (no `/sessions` slash) is NOT
 * intercepted, so the dashboard recap reads hit the real DB.
 */
export async function interceptMonitoringApi(page: Page, opts: { warmingWindows?: number } = {}) {
  const warming = opts.warmingWindows ?? 2;
  let windowCount = 0;
  let sessionSeq = 0;

  await page.route("**/healthz", (route) =>
    route.fulfill({
      status: 200,
      headers: { ...CORS_HEADERS, "content-type": "application/json" },
      body: JSON.stringify({ status: "ready", model_version: MODEL_VERSION }),
    }),
  );

  await page.route("**/monitoring/sessions**", (route) => {
    const req = route.request();
    const method = req.method();
    if (method === "OPTIONS") return route.fulfill({ status: 204, headers: CORS_HEADERS });

    const url = req.url();
    const json = (status: number, body: unknown) =>
      route.fulfill({
        status,
        headers: { ...CORS_HEADERS, "content-type": "application/json" },
        body: JSON.stringify(body),
      });
    const now = new Date().toISOString();

    if (method === "POST" && /\/windows(\?|$)/.test(url)) {
      windowCount += 1;
      if (windowCount <= warming) return json(200, { outcome: "warming_up", captured_at: now });
      return json(200, { outcome: "reading", band: "at_ease", captured_at: now });
    }
    if (method === "POST" && /\/end(\?|$)/.test(url)) {
      return json(200, { session_id: "e2e-session", ended_at: now });
    }
    if (method === "PATCH") {
      return json(200, { session_id: "e2e-session", status: "active" });
    }
    if (method === "POST") {
      // create session
      sessionSeq += 1;
      return json(201, { session_id: `e2e-session-${sessionSeq}`, model_version: MODEL_VERSION });
    }
    return json(404, { error: "unexpected" });
  });
}

/**
 * Seed ONE retrospective (ended) monitoring session today + a few scored window readings via
 * the service role, so the dashboard "today recap" has content to render + expand after the
 * (mocked) live session ends. Bands chosen to give a real trend + a peak marker.
 */
export async function seedRetrospectiveSession(userId: string) {
  const admin = createAdminClient();
  const now = Date.now();
  const midnight = new Date();
  midnight.setHours(0, 0, 0, 0);
  // Start ~90 min ago, clamped into today; ended ~60 min ago (well past the 5-min stale cut).
  const startedMs = Math.max(now - 90 * 60_000, midnight.getTime() + 60_000);
  let endedMs = Math.min(startedMs + 30 * 60_000, now - 6 * 60_000);
  if (endedMs <= startedMs) endedMs = startedMs + 60_000;

  const { data: sess, error: sErr } = await admin
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
  if (sErr || !sess) throw sErr ?? new Error("seed session failed");

  const bands = ["at_ease", "a_little_tense", "at_ease"] as const;
  const span = endedMs - startedMs;
  const rows = bands.map((band, i) => ({
    session_id: sess.id,
    user_id: userId,
    captured_at: new Date(startedMs + ((i + 1) / (bands.length + 1)) * span).toISOString(),
    scored: true,
    band,
  }));
  const { error: rErr } = await admin.from("window_readings").insert(rows);
  if (rErr) throw rErr;
  return sess.id as string;
}
