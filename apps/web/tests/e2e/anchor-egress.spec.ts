import { type Request, expect, test } from "@playwright/test";

import {
  RECORD_AND_LAND_TIMEOUT,
  WEBKIT_SKIP_REASON,
  createCalibratableEmployee,
  installActiveDetector,
  installAnchorMocks,
  interceptAnchorApi,
  signInToApp,
} from "./anchor-helpers";

/**
 * T031 CENTREPIECE — the on-device privacy guarantee, proven at the network layer
 * (Principle I / FR-050 / SC-014). Across BOTH the green room AND the full 60-second
 * recording, the on-device framing pipeline runs ACTIVE (the injected detector +
 * the REAL `useFramingGuide` loop + the REAL gate) — and NOT ONE video/frame byte
 * leaves the device for framing. The ONLY video egress in the entire flow is the
 * single final encoded clip POSTed to `/anchor` on success.
 *
 * This is a real-lifecycle run, not a shortcut to success: the soft gate must clear
 * (the detector loop ran), "I'm ready" enables, the real 3·2·1 countdown plays, the
 * real 60s timer elapses, and only then is the clip uploaded.
 *
 * Boundary seams only (📌 DECISION-26): getUserMedia + MediaRecorder (fake stream),
 * the detector (injected), /healthz + /anchor (intercepted). Supabase is the real
 * local instance (its writes carry the DERIVED vector as hex text — never video).
 *
 * Two layers of detection, both asserted at the green-room / mid-recording / post-
 * success checkpoints:
 *  - VIDEO egress (structural): a request whose body is a multipart file part with a
 *    video filename (the `clip` field, `anchor.webm`/`.mp4`), or whose Content-Type is
 *    `video/*` — the only legitimate instance is the single final `/anchor` clip POST.
 *  - ANY-DATA egress (strengthened): a request that is POST/PUT/PATCH or carries a
 *    non-empty body to a destination NOT on the benign allowlist below. This catches a
 *    frame leak even if it were disguised as JSON/base64/image bytes to any URL — the
 *    earlier video-signature check alone would miss that.
 *
 * Benign allowlist — the ONLY destinations allowed to carry an outbound body:
 *  (1) the single final clip POST to `/anchor` (the one legitimate video egress);
 *  (2) the Supabase host (browser auth/token refresh + the REST anchor-vector write —
 *      DERIVED hex data, not raw video); and
 *  (3) same-origin Next **server actions**, matched by the `Next-Action` request header
 *      (the auth sign-in RPC + any framework RPC). These carry NO on-device framing
 *      signal: the detector outputs (bounding box / luma / drift) live only in React
 *      state and are never serialized into a server action. A bespoke frame leak would
 *      be a plain fetch / XHR / sendBeacon WITHOUT that header → still flagged. This is
 *      a header-scoped allow, not a blanket same-origin pass.
 */

/** The Supabase origin (from the test-runner env) whose body-carrying requests are benign. */
const SUPABASE_HOST = (() => {
  try {
    return new URL(process.env.NEXT_PUBLIC_SUPABASE_URL ?? "").host;
  } catch {
    return "";
  }
})();

/** Read the request body as bytes-preserving text so multipart ASCII headers survive. */
function bodyText(req: Request): string {
  try {
    return req.postDataBuffer()?.toString("latin1") ?? "";
  } catch {
    return req.postData() ?? "";
  }
}

function isVideoEgress(req: Request): boolean {
  const ct = (req.headers()["content-type"] ?? "").toLowerCase();
  if (ct.startsWith("video/")) return true;
  const body = bodyText(req);
  // a multipart file part carrying the recorded clip
  return (
    /content-disposition:[^\r\n]*filename="[^"]*\.(webm|mp4)"/i.test(body) ||
    /name="clip"[\s\S]*filename=/i.test(body)
  );
}

function isAnchorClipPost(req: Request): boolean {
  return req.method() === "POST" && /\/anchor(\?|$)/.test(req.url());
}

/** The only destinations permitted to carry an outbound body in this flow (see header). */
function isBenignDataDestination(req: Request): boolean {
  const url = req.url();
  // (1) the single legitimate video egress, on success
  if (/\/anchor(\?|$)/.test(url)) return true;
  // (2) Supabase auth/token refresh + the REST anchor-vector write (derived hex, not video)
  try {
    if (SUPABASE_HOST && new URL(url).host === SUPABASE_HOST) return true;
  } catch {
    /* unparseable url → not allowlisted */
  }
  // (3) same-origin Next server actions (header-scoped — see the file header)
  if (req.headers()["next-action"] !== undefined) return true;
  // (4) Next's dev-only error-overlay symbolication (#197): a console message during
  //     the green room makes the dev server symbolicate the stack via a text/plain
  //     POST to /__nextjs_original-stack-frames — a dev-harness artifact carrying
  //     stack frames, not capture data, and firefox trips it where chromium doesn't.
  //     PATH-SCOPED ON PURPOSE: only the `/__nextjs_` dev namespace passes, never a
  //     blanket same-origin/localhost pass — the broad catch-all below is what proves
  //     no disguised frame leak, and it must keep proving it. The console message that
  //     TRIGGERS the overlay on firefox is still unidentified and stays open debt.
  try {
    if (/^\/__nextjs_/.test(new URL(url).pathname)) return true;
  } catch {
    /* unparseable url → not allowlisted */
  }
  return false;
}

test("no video leaves the device for framing — only the final clip is POSTed (FR-050, SC-014)", async ({
  page,
  browserName,
}) => {
  test.skip(browserName === "webkit", WEBKIT_SKIP_REASON);
  test.setTimeout(150_000); // real green room + a real 60s recording + dev cold-compile

  await installAnchorMocks(page); // fake getUserMedia (bright feed) + fake MediaRecorder
  await installActiveDetector(page); // framing runs ACTIVE → the gate clears with no real face
  await interceptAnchorApi(page); // /healthz ready, /anchor → canned vector

  // Intercept EVERY request the page makes. A request counts as VIDEO EGRESS if it is
  // the clip POST to /anchor (by method+URL) OR carries a video payload anywhere (by
  // body/Content-Type) — so a hypothetical per-frame leak to ANY url is caught, and
  // the proof does not hinge on Playwright reading the multipart body.
  const videoEgress: string[] = [];
  const anchorClipPosts: string[] = [];
  // STRENGTHENED: any outbound body to a non-allowlisted destination — catches a frame
  // leak disguised as JSON/base64/image bytes to any URL, not only video-signature ones.
  const unexpectedDataEgress: string[] = [];
  let totalRequests = 0;
  page.on("request", (req) => {
    totalRequests += 1;
    const method = req.method();
    const clipPost = isAnchorClipPost(req);
    if (clipPost) anchorClipPosts.push(req.url());
    if (clipPost || isVideoEgress(req)) videoEgress.push(`${method} ${req.url()}`);

    const mutating = method === "POST" || method === "PUT" || method === "PATCH";
    const hasBody = bodyText(req).length > 0;
    if ((mutating || hasBody) && !isBenignDataDestination(req)) {
      const ct = req.headers()["content-type"] ?? "(none)";
      unexpectedDataEgress.push(`${method} ${req.url()} [${ct}]`);
    }
  });

  const emp = await createCalibratableEmployee();
  await signInToApp(page, emp);
  await page.goto("/app/calibrate");

  // ── GREEN ROOM — the detector + luma loop run on-device ───────────────────────
  await page.getByRole("button", { name: "Turn on camera" }).click();
  const ready = page.getByRole("button", { name: /ready/i });
  // The gate only clears because the REAL framing loop processed frames from the
  // local stream — i.e. the on-device pipeline genuinely ran this whole phase.
  await expect(ready).toBeEnabled({ timeout: 30_000 });

  const requestsByGreenRoom = totalRequests;
  expect(requestsByGreenRoom, "the green room did make network requests").toBeGreaterThan(0);
  // PROOF #1 — across the entire green room, the framing pipeline transmitted no video…
  expect(videoEgress, "no video egress during the green room").toEqual([]);
  expect(anchorClipPosts, "no clip POST during the green room").toEqual([]);
  // …and no OTHER outbound data to any non-allowlisted destination either.
  expect(unexpectedDataEgress, "no unexpected outbound data during the green room").toEqual([]);

  // ── RECORDING — the real 60s lifecycle ────────────────────────────────────────
  const timer = page.getByRole("timer");
  await expect(async () => {
    if (await timer.isVisible()) return;
    if (await ready.isVisible().catch(() => false)) {
      await ready.click({ timeout: 2_000 }).catch(() => {});
    }
    await expect(timer).toBeVisible({ timeout: 8_000 });
  }).toPass({ timeout: 30_000 });

  // mid-recording: the framing loop is still running at ~3.5fps; assert NOTHING has
  // egressed yet — the clip is only sent after the minute completes.
  await page.waitForTimeout(4_000);
  expect(videoEgress, "no per-frame video egress mid-recording").toEqual([]);
  expect(anchorClipPosts, "no clip POST mid-recording").toEqual([]);
  expect(unexpectedDataEgress, "no unexpected outbound data mid-recording").toEqual([]);

  // the recorder auto-stops at 60s → uploads the single clip → writes → success.
  await expect(
    page.getByRole("heading", { name: /your baseline is set/i }),
  ).toBeVisible({ timeout: RECORD_AND_LAND_TIMEOUT });

  // ── PROOF #2 — over the WHOLE flow, the only video egress is the single final clip ─
  expect(anchorClipPosts, "exactly one clip POST, only on success").toHaveLength(1);
  expect(anchorClipPosts[0]).toMatch(/\/anchor(\?|$)/);
  // the set of ALL video-bearing requests equals exactly that one /anchor clip POST.
  expect(videoEgress).toHaveLength(1);
  expect(videoEgress[0]).toContain(anchorClipPosts[0]);
  // …and NO unexpected outbound data appeared anywhere across the whole flow.
  expect(unexpectedDataEgress, "no unexpected outbound data across the whole flow").toEqual([]);
});
