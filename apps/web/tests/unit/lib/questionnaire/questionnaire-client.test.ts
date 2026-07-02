import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  createConfirmatoryPrompt,
  getWeeklyCadence,
  getWeeklySummary,
  resolveConfirmatoryAnswered,
  resolveConfirmatoryExpired,
  saveSessionFeedback,
  submitWeeklyCheckin,
  upsertWeeklyCadence,
  type QuestionnaireClient,
} from "@/lib/api/questionnaire-client";

/**
 * T024 — the authenticated questionnaire data client is the ONLY web write path for
 * questionnaire rows, and it runs as the signed-in employee through the `@supabase/ssr`
 * browser client (RLS-as-user). These tests inject a recording mock for the Supabase
 * client and pin the exact table payloads / RPC argument maps, then statically assert
 * the file never reaches for a service-role/admin client or a direct manager row read.
 */

// A chainable, recording Supabase mock. Terminal `single`/`maybeSingle` resolve to
// `result`; awaiting the builder itself (update/upsert) resolves to `result` too.
function makeDb(result: { data: unknown; error: unknown } = { data: null, error: null }) {
  const calls = {
    from: [] as string[],
    insert: [] as unknown[],
    update: [] as unknown[],
    upsert: [] as { payload: unknown; opts: unknown }[],
    select: [] as unknown[],
    eq: [] as [string, unknown][],
    rpc: [] as [string, unknown][],
    single: 0,
    maybeSingle: 0,
  };
  const builder: Record<string, unknown> = {};
  builder.insert = vi.fn((p: unknown) => (calls.insert.push(p), builder));
  builder.update = vi.fn((p: unknown) => (calls.update.push(p), builder));
  builder.upsert = vi.fn((p: unknown, o: unknown) => (calls.upsert.push({ payload: p, opts: o }), builder));
  builder.select = vi.fn((c: unknown) => (calls.select.push(c), builder));
  builder.eq = vi.fn((c: string, v: unknown) => (calls.eq.push([c, v]), builder));
  builder.order = vi.fn(() => builder);
  builder.single = vi.fn(() => (calls.single++, Promise.resolve(result)));
  builder.maybeSingle = vi.fn(() => (calls.maybeSingle++, Promise.resolve(result)));
  // thenable so `await from(t).update(p).eq(...)` resolves.
  builder.then = (resolve: (v: unknown) => unknown) => Promise.resolve(result).then(resolve);
  const client = {
    from: vi.fn((t: string) => (calls.from.push(t), builder)),
    rpc: vi.fn((fn: string, args: unknown) => (calls.rpc.push([fn, args]), Promise.resolve(result))),
  };
  return { client: client as unknown as QuestionnaireClient, calls };
}

describe("confirmatory prompt create/resolve", () => {
  it("createConfirmatoryPrompt inserts a visible, tense, owner-linked row and returns its id", async () => {
    const db = makeDb({ data: { id: "prompt-1" }, error: null });
    const res = await createConfirmatoryPrompt(
      {
        userId: "user-1",
        monitoringSessionId: "sess-1",
        triggeredWindowCapturedAt: "2026-06-30T10:00:00.000Z",
        triggerWindowReadingId: "wr-9",
      },
      { client: db.client },
    );
    expect(db.calls.from[0]).toBe("questionnaire_confirmatory_prompts");
    const payload = db.calls.insert[0] as Record<string, unknown>;
    expect(payload).toMatchObject({
      user_id: "user-1",
      monitoring_session_id: "sess-1",
      triggered_window_captured_at: "2026-06-30T10:00:00.000Z",
      trigger_window_reading_id: "wr-9",
      trigger_band: "tense",
      lifecycle: "visible",
    });
    expect(res).toEqual({ ok: true, data: { id: "prompt-1" } });
  });

  it("omits trigger_window_reading_id when unresolved", async () => {
    const db = makeDb({ data: { id: "p" }, error: null });
    await createConfirmatoryPrompt(
      { userId: "u", monitoringSessionId: "s", triggeredWindowCapturedAt: "t" },
      { client: db.client },
    );
    const payload = db.calls.insert[0] as Record<string, unknown>;
    expect("trigger_window_reading_id" in payload && payload.trigger_window_reading_id != null).toBe(
      false,
    );
  });

  it("resolveConfirmatoryAnswered(false_alarm) marks lifecycle/outcome/down-weight on the row id", async () => {
    const db = makeDb();
    await resolveConfirmatoryAnswered("prompt-1", "false_alarm", { client: db.client });
    expect(db.calls.from[0]).toBe("questionnaire_confirmatory_prompts");
    const payload = db.calls.update[0] as Record<string, unknown>;
    expect(payload).toMatchObject({
      lifecycle: "answered",
      outcome: "false_alarm",
      aggregate_treatment: "exclude_or_down_weight",
    });
    expect(typeof payload.answered_at).toBe("string");
    expect(db.calls.eq).toContainEqual(["id", "prompt-1"]);
  });

  it("resolveConfirmatoryAnswered(confirmed) keeps aggregate_treatment none", async () => {
    const db = makeDb();
    await resolveConfirmatoryAnswered("p", "confirmed", { client: db.client });
    expect((db.calls.update[0] as Record<string, unknown>).aggregate_treatment).toBe("none");
  });

  it("resolveConfirmatoryExpired records the expiry reason without an outcome", async () => {
    const db = makeDb();
    await resolveConfirmatoryExpired("p", "session_end", { client: db.client });
    const payload = db.calls.update[0] as Record<string, unknown>;
    expect(payload).toMatchObject({ lifecycle: "expired", expiry_reason: "session_end" });
    expect("outcome" in payload).toBe(false);
    expect(db.calls.eq).toContainEqual(["id", "p"]);
  });
});

describe("session-end feedback upsert", () => {
  it("skip stores no sentiment/reason/free_text/action_target", async () => {
    const db = makeDb({ data: { id: "f1" }, error: null });
    await saveSessionFeedback(
      { userId: "u", monitoringSessionId: "s", status: "skipped" },
      { client: db.client },
    );
    expect(db.calls.from[0]).toBe("questionnaire_session_feedback");
    const up = db.calls.upsert[0]!;
    const p = up.payload as Record<string, unknown>;
    expect(p.status).toBe("skipped");
    for (const k of ["sentiment", "reason", "free_text", "action_target"]) {
      expect(p[k] == null).toBe(true);
    }
    expect((up.opts as Record<string, unknown>).onConflict).toBe("monitoring_session_id");
  });

  it("good stores sentiment only, nulling reason/free_text/action_target explicitly", async () => {
    const db = makeDb({ data: { id: "f" }, error: null });
    await saveSessionFeedback(
      { userId: "u", monitoringSessionId: "s", status: "submitted", sentiment: "good" },
      { client: db.client },
    );
    const p = db.calls.upsert[0]!.payload as Record<string, unknown>;
    expect(p).toMatchObject({ status: "submitted", sentiment: "good" });
    expect(p.reason).toBeNull();
    expect(p.free_text).toBeNull();
    expect(p.action_target).toBeNull();
  });

  it("off+ren_too_robotic derives ack_only and nulls free_text", async () => {
    const db = makeDb({ data: { id: "f" }, error: null });
    await saveSessionFeedback(
      {
        userId: "u",
        monitoringSessionId: "s",
        status: "submitted",
        sentiment: "off",
        reason: "ren_too_robotic",
      },
      { client: db.client },
    );
    const p = db.calls.upsert[0]!.payload as Record<string, unknown>;
    expect(p).toMatchObject({ sentiment: "off", reason: "ren_too_robotic", action_target: "ack_only" });
    expect(p.free_text).toBeNull();
  });

  it("off+something_else carries trimmed free_text and ack_only", async () => {
    const db = makeDb({ data: { id: "f" }, error: null });
    await saveSessionFeedback(
      {
        userId: "u",
        monitoringSessionId: "s",
        status: "submitted",
        sentiment: "off",
        reason: "something_else",
        freeText: "  the timing felt random  ",
      },
      { client: db.client },
    );
    const p = db.calls.upsert[0]!.payload as Record<string, unknown>;
    expect(p).toMatchObject({
      reason: "something_else",
      action_target: "ack_only",
      free_text: "the timing felt random",
    });
  });

  it("off+suggestion_didnt_help routes to preferences action target", async () => {
    const db = makeDb({ data: { id: "f" }, error: null });
    await saveSessionFeedback(
      { userId: "u", monitoringSessionId: "s", status: "submitted", sentiment: "off", reason: "suggestion_didnt_help" },
      { client: db.client },
    );
    const p = db.calls.upsert[0]!.payload as Record<string, unknown>;
    expect(p.action_target).toBe("preferences");
    expect(p.free_text).toBeNull();
  });

  it("upserts on monitoring_session_id so a reason switch cleanly overwrites the row instead of hitting the unique constraint", async () => {
    const db = makeDb({ data: { id: "f" }, error: null });
    await saveSessionFeedback(
      {
        userId: "u",
        monitoringSessionId: "s",
        status: "submitted",
        sentiment: "off",
        reason: "something_else",
        freeText: "first reason",
      },
      { client: db.client },
    );
    await saveSessionFeedback(
      { userId: "u", monitoringSessionId: "s", status: "submitted", sentiment: "off", reason: "suggestion_didnt_help" },
      { client: db.client },
    );
    expect(db.calls.upsert).toHaveLength(2);
    const second = db.calls.upsert[1]!.payload as Record<string, unknown>;
    // The second write must null out the first reason's free_text explicitly — an upsert
    // that omitted this key would leave the stale value behind and violate qsf_free_text_scope.
    expect(second.reason).toBe("suggestion_didnt_help");
    expect(second.free_text).toBeNull();
    expect((db.calls.upsert[1]!.opts as Record<string, unknown>).onConflict).toBe("monitoring_session_id");
  });
});

describe("weekly cadence reads/writes", () => {
  it("getWeeklyCadence selects the owner/week row and maps it", async () => {
    const db = makeDb({
      data: {
        id: "c1",
        user_id: "u",
        iso_week_start: "2026-06-29",
        prompt_count: 1,
        skipped_count: 1,
        last_prompted_at: "2026-06-29T09:00:00Z",
        completed_at: null,
      },
      error: null,
    });
    const row = await getWeeklyCadence("u", "2026-06-29", { client: db.client });
    expect(db.calls.from[0]).toBe("weekly_checkin_cadence");
    expect(db.calls.eq).toContainEqual(["user_id", "u"]);
    expect(db.calls.eq).toContainEqual(["iso_week_start", "2026-06-29"]);
    expect(db.calls.maybeSingle).toBe(1);
    expect(row).toEqual({
      id: "c1",
      userId: "u",
      isoWeekStart: "2026-06-29",
      promptCount: 1,
      skippedCount: 1,
      lastPromptedAt: "2026-06-29T09:00:00Z",
      completedAt: null,
    });
  });

  it("getWeeklyCadence returns null when no row exists", async () => {
    const db = makeDb({ data: null, error: null });
    expect(await getWeeklyCadence("u", "2026-06-29", { client: db.client })).toBeNull();
  });

  it("upsertWeeklyCadence upserts on (user_id, iso_week_start)", async () => {
    const db = makeDb();
    await upsertWeeklyCadence(
      { userId: "u", isoWeekStart: "2026-06-29", promptCount: 2, skippedCount: 1, lastPromptedAt: "2026-06-30T09:00:00Z" },
      { client: db.client },
    );
    expect(db.calls.from[0]).toBe("weekly_checkin_cadence");
    const up = db.calls.upsert[0]!;
    expect(up.payload).toMatchObject({
      user_id: "u",
      iso_week_start: "2026-06-29",
      prompt_count: 2,
      skipped_count: 1,
      last_prompted_at: "2026-06-30T09:00:00Z",
    });
    expect((up.opts as Record<string, unknown>).onConflict).toBe("user_id,iso_week_start");
  });
});

describe("weekly aggregate RPCs (identity-stripped boundary)", () => {
  it("submitWeeklyCheckin calls the DEFINER RPC with prefixed args", async () => {
    const db = makeDb({ data: null, error: null });
    await submitWeeklyCheckin(
      {
        isoWeekStart: "2026-06-29",
        sentiment: "could_be_better",
        roadblock: "unclear_instructions_or_goals",
        support: "deadline_flexibility",
      },
      { client: db.client },
    );
    expect(db.calls.rpc[0]).toEqual([
      "submit_weekly_work_environment_checkin",
      {
        p_iso_week_start: "2026-06-29",
        p_sentiment: "could_be_better",
        p_roadblock: "unclear_instructions_or_goals",
        p_support: "deadline_flexibility",
      },
    ]);
  });

  it("submitWeeklyCheckin sends null roadblock/support for good", async () => {
    const db = makeDb({ data: null, error: null });
    await submitWeeklyCheckin({ isoWeekStart: "2026-06-29", sentiment: "good" }, { client: db.client });
    expect(db.calls.rpc[0]![1]).toEqual({
      p_iso_week_start: "2026-06-29",
      p_sentiment: "good",
      p_roadblock: null,
      p_support: null,
    });
  });

  it("getWeeklySummary calls the aggregate RPC and maps grouped rows", async () => {
    const db = makeDb({
      data: [
        {
          iso_week_start: "2026-06-29",
          sample_size: 4,
          sentiment: "good",
          roadblock: null,
          support: null,
          response_count: 3,
        },
      ],
      error: null,
    });
    const res = await getWeeklySummary("2026-06-29", { client: db.client });
    expect(db.calls.rpc[0]).toEqual([
      "get_weekly_work_environment_summary",
      { p_iso_week_start: "2026-06-29" },
    ]);
    expect(res).toEqual({
      ok: true,
      data: [
        {
          isoWeekStart: "2026-06-29",
          sampleSize: 4,
          sentiment: "good",
          roadblock: null,
          support: null,
          responseCount: 3,
        },
      ],
    });
  });
});

describe("privacy posture of the client source (static)", () => {
  const raw = readFileSync(
    path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../../../lib/api/questionnaire-client.ts"),
    "utf8",
  );
  // Strip `//` and `/* */` comments before scanning — the doc comments deliberately
  // NAME the forbidden things to explain the boundary (mirrors `_strip_comments` in the
  // Python privacy gate). The scan must judge CODE, not prose.
  const src = raw.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");

  it("imports the browser RLS client, never the admin/service-role client", () => {
    expect(src).toContain("@/lib/supabase/client");
    expect(src).not.toContain("@/lib/supabase/admin");
    expect(src).not.toContain("service_role");
    expect(src).not.toContain("SERVICE_ROLE");
  });

  it("never reads the identity-stripped contributions table directly", () => {
    // The aggregate table is reachable only via the two DEFINER RPCs (named below); the
    // client must never do `.from("weekly_work_environment_contributions")`.
    expect(src).not.toMatch(/\bfrom\(\s*["'`]weekly_work_environment_contributions["'`]/);
  });
});
