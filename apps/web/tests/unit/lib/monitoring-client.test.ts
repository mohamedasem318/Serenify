import { afterEach, describe, expect, it, vi } from "vitest";

import { endSession, patchStatus, submitWindow } from "@/lib/api/monitoring-client";

/**
 * Feature 008 / US2 — T041: the lifecycle write client. The load-bearing case is the
 * re-end RACE: the backend returns 409 when the session is already ended (auto-end and a
 * manual End both fired), and the client must treat that 409 as success so the frontend
 * goes to the ended state instead of surfacing an error.
 *
 * Feature 008 / US3 — T043: submitWindow's 409 is overloaded — the windows route 409s in
 * TWO shapes ({"error":"ended_session"} and the defensive mid-session {"outcome":"no_anchor"}).
 * The client must disambiguate by body so the orchestrator can route a vanished anchor to
 * calibrate-first instead of treating it as an ended session (SC-004).
 */

function stubFetch(impl: () => Partial<Response>) {
  vi.stubGlobal(
    "fetch",
    vi.fn(async () => impl() as unknown as Response),
  );
}

afterEach(() => vi.unstubAllGlobals());

describe("endSession — re-end race", () => {
  it("treats a 409 (already ended) as success — the race resolves silently", async () => {
    stubFetch(() => ({ ok: false, status: 409 }));
    expect((await endSession("sid", "user", "tok")).ok).toBe(true);
  });

  it("a 200 end is success; reason is forwarded", async () => {
    const f = vi.fn(async () => ({ ok: true, status: 200 }) as unknown as Response);
    vi.stubGlobal("fetch", f);
    expect((await endSession("sid", "auto_absence", "tok")).ok).toBe(true);
    const init = f.mock.calls[0][1] as RequestInit;
    expect(init.method).toBe("POST");
    expect(JSON.parse(init.body as string)).toEqual({ reason: "auto_absence" });
    expect(String(f.mock.calls[0][0])).toContain("/monitoring/sessions/sid/end");
  });

  it("a non-409 failure (500) is NOT success, and a network throw is not ok", async () => {
    stubFetch(() => ({ ok: false, status: 500 }));
    expect((await endSession("sid", "user", "tok")).ok).toBe(false);
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => {
        throw new Error("net");
      }),
    );
    expect((await endSession("sid", "user", "tok")).ok).toBe(false);
  });
});

describe("submitWindow — 409 disambiguation (ended vs mid-session no_anchor)", () => {
  const clip = () => new Blob(["x"], { type: "video/webm" });

  it("maps a 409 {outcome:'no_anchor'} to kind 'no_anchor' (mid-session calibrate-first; SC-004)", async () => {
    stubFetch(() => ({ ok: false, status: 409, json: async () => ({ outcome: "no_anchor" }) }));
    expect(await submitWindow("sid", clip(), "tok")).toEqual({ ok: false, kind: "no_anchor" });
  });

  it("maps a 409 {error:'ended_session'} to kind 'ended'", async () => {
    stubFetch(() => ({ ok: false, status: 409, json: async () => ({ error: "ended_session" }) }));
    expect(await submitWindow("sid", clip(), "tok")).toEqual({ ok: false, kind: "ended" });
  });

  it("a 409 with an unreadable body falls back to 'ended' (never throws)", async () => {
    stubFetch(() => ({
      ok: false,
      status: 409,
      json: async () => {
        throw new Error("not json");
      },
    }));
    expect(await submitWindow("sid", clip(), "tok")).toEqual({ ok: false, kind: "ended" });
  });
});

describe("patchStatus — lifecycle transitions", () => {
  it("PATCHes the session with the new status", async () => {
    const f = vi.fn(async () => ({ ok: true, status: 200 }) as unknown as Response);
    vi.stubGlobal("fetch", f);
    const res = await patchStatus("sid", "out_of_frame", "tok");
    expect(res.ok).toBe(true);
    const [url, init] = f.mock.calls[0] as [string, RequestInit];
    expect(String(url)).toContain("/monitoring/sessions/sid");
    expect(init.method).toBe("PATCH");
    expect(JSON.parse(init.body as string)).toEqual({ status: "out_of_frame" });
  });

  it("reports not-ok on a failure status", async () => {
    stubFetch(() => ({ ok: false, status: 409 }));
    expect((await patchStatus("sid", "paused", "tok")).ok).toBe(false);
  });
});
