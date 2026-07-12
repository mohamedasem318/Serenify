import { afterEach, describe, expect, it, vi } from "vitest";

import { checkHealth, postAnchor } from "@/lib/api/anchor-client";

// clientEnv.apiUrl defaults to the local dev origin (no NEXT_PUBLIC_API_URL in
// the unit env, see lib/env/schema.ts), so endpoints resolve under this origin.
const API = "http://127.0.0.1:8000";

function jsonResponse(status: number, body: unknown) {
  return { ok: status >= 200 && status < 300, status, json: async () => body } as Response;
}

function makeClip(type = "video/webm;codecs=vp9") {
  return new Blob([new Uint8Array([1, 2, 3])], { type });
}

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});

describe("postAnchor", () => {
  it("sends multipart with a Bearer header and maps 200 to ok", async () => {
    const fetchSpy = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValue(
        jsonResponse(200, { model_version: "m@2.0.0", dim: 2958, vector_b64: "Zm9v" }),
      );

    const result = await postAnchor(makeClip(), "tok123");

    expect(result).toEqual({ ok: true, modelVersion: "m@2.0.0", dim: 2958, vectorB64: "Zm9v" });

    const [url, init] = fetchSpy.mock.calls[0] as [string, RequestInit];
    expect(url).toBe(`${API}/anchor`);
    expect(init.method).toBe("POST");
    expect((init.headers as Record<string, string>).Authorization).toBe("Bearer tok123");
    expect(init.body).toBeInstanceOf(FormData);
    expect((init.body as FormData).get("clip")).not.toBeNull();
  });

  it("maps 401 to unauthorized", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(jsonResponse(401, {}));
    expect(await postAnchor(makeClip(), "t")).toEqual({ ok: false, kind: "unauthorized" });
  });

  it("maps 415 to unsupported_media", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(jsonResponse(415, {}));
    expect(await postAnchor(makeClip(), "t")).toEqual({ ok: false, kind: "unsupported_media" });
  });

  it("maps 422 to extraction_failed and carries the reason", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      jsonResponse(422, { error: "extraction_failed", reason: "no face" }),
    );
    expect(await postAnchor(makeClip(), "t")).toEqual({
      ok: false,
      kind: "extraction_failed",
      reason: "no face",
    });
  });

  it("maps other non-2xx to unknown", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(jsonResponse(500, {}));
    expect(await postAnchor(makeClip(), "t")).toEqual({ ok: false, kind: "unknown" });
  });

  it("maps a thrown fetch to network", async () => {
    vi.spyOn(globalThis, "fetch").mockRejectedValue(new Error("offline"));
    expect(await postAnchor(makeClip(), "t")).toEqual({ ok: false, kind: "network" });
  });

  it("attaches a codec-matched filename (mp4 vs webm)", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      jsonResponse(200, { model_version: "m", dim: 2958, vector_b64: "x" }),
    );
    // happy-dom does not preserve FormData filenames, so assert the argument
    // postAnchor passes to append() rather than the stored File.name.
    const appendSpy = vi.spyOn(FormData.prototype, "append");

    await postAnchor(makeClip("video/mp4"), "t");
    expect(appendSpy.mock.calls.find((c) => c[0] === "clip")?.[2]).toBe("anchor.mp4");

    appendSpy.mockClear();
    await postAnchor(makeClip("video/webm;codecs=vp9"), "t");
    expect(appendSpy.mock.calls.find((c) => c[0] === "clip")?.[2]).toBe("anchor.webm");
  });
});

describe("checkHealth", () => {
  it("keeps the default request pending until the 75-second wake boundary", async () => {
    vi.useFakeTimers();
    let signal: AbortSignal | undefined;
    vi.spyOn(globalThis, "fetch").mockImplementation((_input, init) => {
      signal = init?.signal ?? undefined;
      return new Promise<Response>((_resolve, reject) => {
        signal?.addEventListener("abort", () => reject(new DOMException("Aborted", "AbortError")));
      });
    });

    let settled = false;
    const request = checkHealth().then((result) => {
      settled = true;
      return result;
    });

    await vi.advanceTimersByTimeAsync(74_999);
    expect(settled).toBe(false);
    expect(signal?.aborted).toBe(false);

    await vi.advanceTimersByTimeAsync(1);
    await expect(request).resolves.toBe(false);
    expect(signal?.aborted).toBe(true);
  });

  it("returns true when /healthz responds ok", async () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValue(jsonResponse(200, {}));
    expect(await checkHealth()).toBe(true);
    const [url] = fetchSpy.mock.calls[0] as [string];
    expect(url).toBe(`${API}/healthz`);
  });

  it("returns false on a non-2xx response", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(jsonResponse(503, {}));
    expect(await checkHealth()).toBe(false);
  });

  it("returns false when fetch throws", async () => {
    vi.spyOn(globalThis, "fetch").mockRejectedValue(new Error("offline"));
    expect(await checkHealth()).toBe(false);
  });
});
