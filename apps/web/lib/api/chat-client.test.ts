import { afterEach, describe, expect, it, vi } from "vitest";

import {
  deleteConversation,
  getCurrentConversation,
  listConversations,
  sendMessage,
} from "@/lib/api/chat-client";

function mockFetch(status: number, body: unknown) {
  return vi.fn().mockResolvedValue({
    status,
    json: async () => body,
  } as unknown as Response);
}

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe("chat-client — response mapping", () => {
  it("maps conversation summaries from snake_case to camelCase", async () => {
    vi.stubGlobal(
      "fetch",
      mockFetch(200, {
        conversations: [
          {
            id: "c1",
            title: "A heavy week at work",
            state: "ended",
            rollup_band: "a_little_tense",
            message_count: 6,
            last_message_at: "2026-06-28T10:00:00Z",
            created_at: "2026-06-28T09:00:00Z",
            updated_at: "2026-06-28T10:00:00Z",
          },
        ],
      }),
    );
    const res = await listConversations("tok");
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    expect(res.data[0]).toMatchObject({
      id: "c1",
      rollupBand: "a_little_tense",
      messageCount: 6,
      lastMessageAt: "2026-06-28T10:00:00Z",
      state: "ended",
    });
  });

  it("maps a send result including nested crisis panel", async () => {
    vi.stubGlobal(
      "fetch",
      mockFetch(200, {
        outcome: "ok",
        user_message: { id: "m1", role: "user", content: "hi", created_at: "t1" },
        assistant_message: { id: "m2", role: "assistant", content: "hey", created_at: "t2" },
        crisis: {
          resources: [
            { country: "EG", name: "Hotline", number: "16328", url: null, last_checked: "2026-06-28" },
          ],
          universal_line: "If you're in immediate danger, contact local emergency services.",
          emergency_number: "123",
        },
        rollup_band: null,
        conversation: null,
        retry_after_seconds: null,
      }),
    );
    const res = await sendMessage("tok", "c1", "hi");
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    expect(res.data.outcome).toBe("ok");
    expect(res.data.assistantMessage?.content).toBe("hey");
    expect(res.data.crisis?.resources[0]).toMatchObject({ country: "EG", number: "16328", lastChecked: "2026-06-28" });
    expect(res.data.crisis?.emergencyNumber).toBe("123");
  });

  it("treats a null current-conversation body as ok/null", async () => {
    vi.stubGlobal("fetch", mockFetch(200, null));
    const res = await getCurrentConversation("tok");
    expect(res).toEqual({ ok: true, data: null });
  });

  it("returns ok for a 204 delete", async () => {
    vi.stubGlobal("fetch", mockFetch(204, null));
    const res = await deleteConversation("tok", "c1");
    expect(res.ok).toBe(true);
  });
});

describe("chat-client — error mapping", () => {
  it.each([
    [401, "unauthorized"],
    [403, "forbidden_role"],
    [404, "not_found"],
    [500, "unknown"],
  ])("maps HTTP %i to kind %s", async (status, kind) => {
    vi.stubGlobal("fetch", mockFetch(status, {}));
    const res = await listConversations("tok");
    expect(res).toEqual({ ok: false, kind });
  });

  it("maps a thrown fetch (offline) to network", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("offline")));
    const res = await listConversations("tok");
    expect(res).toEqual({ ok: false, kind: "network" });
  });
});
