import { clientEnv } from "@/lib/env/client";

/**
 * The single typed module that talks to the FastAPI anchor service
 * (DECISION-13, Architecture Constraints transport rule — no untyped `fetch`
 * leaks into components). The origin comes from the validated public env.
 */

const ANCHOR_ENDPOINT = `${clientEnv.apiUrl}/anchor`;
const HEALTH_ENDPOINT = `${clientEnv.apiUrl}/healthz`;

/** Discriminated result — every backend status maps to one variant. */
export type AnchorResult =
  | { ok: true; modelVersion: string; dim: number; vectorB64: string }
  | { ok: false; kind: AnchorErrorKind; reason?: string };

export type AnchorErrorKind =
  | "unauthorized" // 401 — token missing/invalid/expired
  | "unsupported_media" // 415 — not mp4/webm
  | "extraction_failed" // 422 — face not read clearly; user can re-record
  | "network" // fetch threw (service down / CORS / offline)
  | "unknown"; // any other non-2xx

/**
 * Upload a recorded clip for anchor extraction. The clip's MIME type rides the
 * multipart part (the backend strips any `;codecs=` suffix); a matching filename
 * extension is attached so python-multipart treats the field as a file.
 */
export async function postAnchor(clip: Blob, accessToken: string): Promise<AnchorResult> {
  const ext = clip.type.includes("mp4") ? "mp4" : "webm";
  const form = new FormData();
  form.append("clip", clip, `anchor.${ext}`);

  let res: Response;
  try {
    res = await fetch(ANCHOR_ENDPOINT, {
      method: "POST",
      headers: { Authorization: `Bearer ${accessToken}` },
      body: form,
    });
  } catch {
    return { ok: false, kind: "network" };
  }

  if (res.ok) {
    const body = await res.json();
    return {
      ok: true,
      modelVersion: body.model_version,
      dim: body.dim,
      vectorB64: body.vector_b64,
    };
  }

  switch (res.status) {
    case 401:
      return { ok: false, kind: "unauthorized" };
    case 415:
      return { ok: false, kind: "unsupported_media" };
    case 422: {
      const body = await res.json().catch(() => ({}));
      return { ok: false, kind: "extraction_failed", reason: body?.reason };
    }
    default:
      return { ok: false, kind: "unknown" };
  }
}

/**
 * Readiness pre-check (FR-048): the recorder calls this before offering to
 * record, and again on the Start click (ST-18), so the user never records 60s
 * into a dead backend. Any failure (non-2xx, a thrown fetch, or a `timeoutMs`
 * abort) resolves to `false`. The timeout keeps a *hung* backend — one that
 * accepts the connection but never responds — from stalling the Start click
 * indefinitely; a killed backend already rejects fast (connection refused).
 */
export async function checkHealth(timeoutMs = 4000): Promise<boolean> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(HEALTH_ENDPOINT, { method: "GET", signal: controller.signal });
    return res.ok;
  } catch {
    return false;
  } finally {
    clearTimeout(timer);
  }
}
