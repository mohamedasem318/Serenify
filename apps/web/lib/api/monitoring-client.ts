import { clientEnv } from "@/lib/env/client";

/**
 * The single typed module that talks to the FastAPI monitoring service (feature 008,
 * US1 — contracts/inference-api.md). Sibling of `anchor-client.ts`; same rule — no
 * untyped `fetch` leaks into components, origin from the validated public env.
 *
 * The wire NEVER carries a probability or the raw label (FR-015): the window response
 * is the discriminated outcome union only (`reading` / `warming_up` / `skipped`), the
 * band the sole stress signal. The contiguous recording-so-far rides a multipart
 * `clip` part (the same shape `/anchor` uses; the backend tail-extracts the last 60 s).
 */

const SESSIONS_ENDPOINT = `${clientEnv.apiUrl}/monitoring/sessions`;

/** The three smoothed bands (the only stress signal on the wire). */
export type Band = "at_ease" | "a_little_tense" | "tense";

/** Coarse server-side skip cause; the client refines it from on-device telemetry. */
export type ServerSkipCause = "insufficient-face" | "our-side";

/** The window outcome union — discriminated by `outcome`, never a number. */
export type WindowOutcome =
  | { outcome: "reading"; band: Band; capturedAt: string }
  | { outcome: "warming_up"; capturedAt: string }
  | { outcome: "skipped"; cause: ServerSkipCause };

export type CreateSessionResult =
  | { ok: true; sessionId: string; modelVersion: string }
  | { ok: false; kind: CreateSessionErrorKind };

export type CreateSessionErrorKind =
  | "no_anchor" // 409 — calibrate-first (US3 routes this; SC-004 — no global anchor)
  | "forbidden_role" // 403 — not an employee
  | "unauthorized" // 401 — token missing/invalid/expired
  | "network" // fetch threw
  | "unknown"; // any other non-2xx

export type SubmitWindowResult =
  | { ok: true; outcome: WindowOutcome }
  | { ok: false; kind: SubmitWindowErrorKind };

export type SubmitWindowErrorKind =
  | "unauthorized"
  | "forbidden_role"
  | "not_found" // 404 — unknown / not-owned session (RLS select-own)
  | "ended" // 409 {"error":"ended_session"} — the session is ended
  | "no_anchor" // 409 {"outcome":"no_anchor"} — anchor vanished mid-session → calibrate-first (US3 / SC-004)
  | "unsupported_media" // 415
  | "network"
  | "unknown";

export type EndReason = "user" | "auto_absence" | "error";
export type SessionStatus = "paused" | "active" | "out_of_frame";

function authHeaders(accessToken: string): HeadersInit {
  return { Authorization: `Bearer ${accessToken}` };
}

/**
 * Start a check-in. The backend runs the **calibrate-first guard up front** — a caller
 * with no anchor gets `409` (mapped to `no_anchor`); no global/fallback anchor is ever
 * substituted (SC-004).
 */
export async function createSession(accessToken: string): Promise<CreateSessionResult> {
  let res: Response;
  try {
    res = await fetch(SESSIONS_ENDPOINT, { method: "POST", headers: authHeaders(accessToken) });
  } catch {
    return { ok: false, kind: "network" };
  }

  if (res.status === 201) {
    const body = await res.json();
    return { ok: true, sessionId: body.session_id, modelVersion: body.model_version };
  }
  switch (res.status) {
    case 409:
      return { ok: false, kind: "no_anchor" };
    case 403:
      return { ok: false, kind: "forbidden_role" };
    case 401:
      return { ok: false, kind: "unauthorized" };
    default:
      return { ok: false, kind: "unknown" };
  }
}

/**
 * Upload one **contiguous recording-so-far** window. Multipart (`clip`), matching the
 * `/anchor` upload shape. Returns the outcome union; a `skipped` window is a routine
 * `200`, not an error — the caller continues the loop.
 */
export async function submitWindow(
  sessionId: string,
  clip: Blob,
  accessToken: string,
): Promise<SubmitWindowResult> {
  const ext = clip.type.includes("mp4") ? "mp4" : "webm";
  const form = new FormData();
  form.append("clip", clip, `window.${ext}`);

  let res: Response;
  try {
    res = await fetch(`${SESSIONS_ENDPOINT}/${sessionId}/windows`, {
      method: "POST",
      headers: authHeaders(accessToken),
      body: form,
    });
  } catch {
    return { ok: false, kind: "network" };
  }

  if (res.ok) {
    const body = await res.json();
    if (body.outcome === "reading") {
      return { ok: true, outcome: { outcome: "reading", band: body.band, capturedAt: body.captured_at } };
    }
    if (body.outcome === "skipped") {
      return { ok: true, outcome: { outcome: "skipped", cause: body.cause } };
    }
    return { ok: true, outcome: { outcome: "warming_up", capturedAt: body.captured_at } };
  }

  switch (res.status) {
    case 401:
      return { ok: false, kind: "unauthorized" };
    case 403:
      return { ok: false, kind: "forbidden_role" };
    case 404:
      return { ok: false, kind: "not_found" };
    case 409: {
      // The windows route 409s in two shapes: the defensive mid-session
      // {"outcome":"no_anchor"} (the anchor vanished after the create-time guard — route
      // to calibrate-first, never a reading; US3 / SC-004) and {"error":"ended_session"}
      // (terminal). Disambiguate by body; an unreadable body falls back to "ended".
      const body = await res.json().catch(() => null);
      if (body?.outcome === "no_anchor") return { ok: false, kind: "no_anchor" };
      return { ok: false, kind: "ended" };
    }
    case 415:
      return { ok: false, kind: "unsupported_media" };
    default:
      return { ok: false, kind: "unknown" };
  }
}

/**
 * End a session (US2 — T038). Manual End and the 5-min auto-end can both fire; the backend
 * returns **409** when the session is already ended. The end intent is idempotent — an
 * already-ended session IS the desired terminal state — so a **409 is treated as success**,
 * resolving the re-end race silently (the caller goes to the ended state, never an error).
 */
export async function endSession(
  sessionId: string,
  reason: EndReason,
  accessToken: string,
): Promise<{ ok: boolean }> {
  try {
    const res = await fetch(`${SESSIONS_ENDPOINT}/${sessionId}/end`, {
      method: "POST",
      headers: { ...authHeaders(accessToken), "Content-Type": "application/json" },
      body: JSON.stringify({ reason }),
    });
    // 409 = already ended (the auto-end / manual-End race) → success, not an error.
    return { ok: res.ok || res.status === 409 };
  } catch {
    return { ok: false };
  }
}

/**
 * Patch a session's lifecycle status (US2 endpoint — wired in T036). Provided for a
 * complete typed client; US1 never calls it.
 */
export async function patchStatus(
  sessionId: string,
  status: SessionStatus,
  accessToken: string,
): Promise<{ ok: boolean }> {
  try {
    const res = await fetch(`${SESSIONS_ENDPOINT}/${sessionId}`, {
      method: "PATCH",
      headers: { ...authHeaders(accessToken), "Content-Type": "application/json" },
      body: JSON.stringify({ status }),
    });
    return { ok: res.ok };
  } catch {
    return { ok: false };
  }
}
