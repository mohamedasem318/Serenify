import { describe, expect, it } from "vitest";

import type { Band } from "@/lib/api/monitoring-client";
import {
  bandCount,
  deriveRecap,
  isReadLess,
  retrospectiveSessionIds,
  sessionTenor,
  type SessionRow,
  type TodayTrendRow,
} from "@/lib/api/monitoring-reads";

/**
 * Feature 008 / US4 — T049 (pure-derivation slice). These bind the locked US4
 * read-rules from `data-model.md § Reads` (decided 2026-06-21): read-less honesty
 * (FR-029 / SC-011), n=1 single point, retrospective-only (FR-031), and the
 * band+time-only templated headline (never a probability). All TZ-independent: the
 * fixtures are built with the LOCAL Date constructor and round-trip through
 * `toISOString()`, so a session started at local 8:40 reads as "morning" on any
 * runner.
 */

// local-zone instant → the ISO string the DB stores (UTC); deriveRecap parses it
// back to the user's local zone, so the time-of-day buckets are deterministic.
const iso = (h: number, m: number) => new Date(2026, 5, 21, h, m).toISOString();

const wr = (
  sessionId: string,
  band: Band | null,
  h: number,
  m: number,
  scored = band !== null,
  skipCause: TodayTrendRow["skipCause"] = null,
): TodayTrendRow => ({ sessionId, band, capturedAt: iso(h, m), scored, skipCause });

const sess = (
  id: string,
  startH: number,
  startM: number,
  status: SessionRow["status"],
  endedAt: string | null = null,
): SessionRow => ({ id, started_at: iso(startH, startM), ended_at: endedAt, status });

describe("monitoring-reads — read-less honesty (FR-029 / SC-011)", () => {
  it("a warming-only session (scored, but no confident band) is read-less", () => {
    const rows = [wr("s", null, 9, 0, true), wr("s", null, 9, 1, true)];
    expect(isReadLess(rows)).toBe(true);
  });

  it("a session where every window was skipped is read-less", () => {
    const rows = [
      wr("s", null, 9, 0, false, "low-light"),
      wr("s", null, 9, 1, false, "out-of-frame"),
    ];
    expect(isReadLess(rows)).toBe(true);
  });

  it("a session with at least one confident band is NOT read-less", () => {
    const rows = [wr("s", null, 9, 0, false, "low-light"), wr("s", "at_ease", 9, 1)];
    expect(isReadLess(rows)).toBe(false);
  });
});

describe("monitoring-reads — n=1 single point (FR-029)", () => {
  it("counts only confident bands; one band amid warming/skips → 1", () => {
    const rows = [
      wr("s", null, 9, 0, true),
      wr("s", "tense", 9, 1),
      wr("s", null, 9, 2, false, "low-light"),
    ];
    expect(bandCount(rows)).toBe(1);
  });

  it("counts every confident band across skips → 3", () => {
    const rows = [
      wr("s", "at_ease", 9, 0),
      wr("s", null, 9, 1, false, "low-light"),
      wr("s", "a_little_tense", 9, 2),
      wr("s", "tense", 9, 3),
    ];
    expect(bandCount(rows)).toBe(3);
  });
});

describe("monitoring-reads — session tenor (peak; never calm when read-less)", () => {
  it("all at_ease → at_ease", () => {
    expect(sessionTenor([wr("s", "at_ease", 9, 0), wr("s", "at_ease", 9, 1)])).toBe("at_ease");
  });

  it("a climb into tense → tense (the tensest stretch)", () => {
    expect(
      sessionTenor([wr("s", "at_ease", 9, 0), wr("s", "a_little_tense", 9, 1), wr("s", "tense", 9, 2)]),
    ).toBe("tense");
  });

  it("read-less → no_read, NEVER at_ease (SC-011)", () => {
    const t = sessionTenor([wr("s", null, 9, 0, true), wr("s", null, 9, 1, false, "low-light")]);
    expect(t).toBe("no_read");
    expect(t).not.toBe("at_ease");
  });
});

describe("monitoring-reads — retrospective-only (FR-031 / B4): the fresh-live session is excluded", () => {
  const NOW = new Date(2026, 5, 21, 14, 40);

  it("includes ended + stale-active; excludes a session read within the last 5 min", () => {
    const sessions = [
      sess("ended1", 8, 40, "ended", iso(9, 30)),
      sess("stale", 10, 0, "active"), // last reading 10:05 → >5 min before 14:40 → stale-active
      sess("live", 14, 30, "active"), // last reading 14:38 → within 5 min → the fresh-live one
    ];
    const rows = [
      wr("ended1", "at_ease", 9, 0),
      wr("ended1", "at_ease", 9, 20),
      wr("stale", "tense", 10, 5),
      wr("live", "at_ease", 14, 38),
    ];
    const ids = retrospectiveSessionIds(sessions, rows, NOW);
    expect(ids.has("ended1")).toBe(true);
    expect(ids.has("stale")).toBe(true);
    expect(ids.has("live")).toBe(false);
  });

  it("an active session with no readings falls back to started_at for staleness", () => {
    const sessions = [sess("old", 9, 0, "active"), sess("just", 14, 39, "active")];
    const ids = retrospectiveSessionIds(sessions, [], NOW);
    expect(ids.has("old")).toBe(true); // started 9:00, no readings → > 5 min old → stale
    expect(ids.has("just")).toBe(false); // started 14:39 → fresh-live
  });
});

describe("monitoring-reads — templated headline is band + time only (no probability)", () => {
  const NOW = new Date(2026, 5, 21, 17, 40);

  it("a calm morning then a tense afternoon → the amber 'hot' clause is the tense one; no digits", () => {
    const sessions = [sess("m", 8, 40, "ended", iso(9, 30)), sess("a", 13, 30, "ended", iso(14, 18))];
    const rows = [
      wr("m", "at_ease", 8, 45),
      wr("m", "at_ease", 9, 20),
      wr("a", "at_ease", 13, 35),
      wr("a", "a_little_tense", 13, 50),
      wr("a", "tense", 14, 10),
    ];
    const { headline } = deriveRecap(sessions, rows, NOW);
    expect(headline.hot).toBeTruthy();
    expect(headline.hot!).toMatch(/tense/i);
    expect(headline.hot!).toMatch(/afternoon/i);
    expect(headline.pre).toMatch(/calm/i);
    expect(headline.pre).toMatch(/morning/i);
    expect(`${headline.pre}${headline.hot}${headline.post}`).not.toMatch(/[0-9]/);
  });

  it("an all-calm day carries no amber 'hot' clause", () => {
    const sessions = [sess("m", 8, 40, "ended", iso(9, 30))];
    const rows = [wr("m", "at_ease", 8, 45), wr("m", "at_ease", 9, 20)];
    const { headline } = deriveRecap(sessions, rows, NOW);
    expect(headline.hot).toBeNull();
    expect(`${headline.pre}${headline.post}`).not.toMatch(/[0-9]/);
  });
});

describe("monitoring-reads — deriveRecap integration (mock parity + read-rules)", () => {
  const NOW = new Date(2026, 5, 21, 17, 40);

  it("derives identity, chip tone, read-less + day span, and excludes the fresh-live session", () => {
    const sessions = [
      sess("m", 8, 40, "ended", iso(9, 30)),
      sess("a", 13, 30, "ended", iso(14, 18)),
      sess("late", 16, 50, "active"), // stale-active (last read 17:00, > 5 min before 17:40)
      sess("live", 17, 38, "active"), // fresh-live (read 17:39) → excluded
    ];
    const rows = [
      wr("m", "at_ease", 8, 45),
      wr("m", "at_ease", 9, 20),
      wr("a", "at_ease", 13, 35),
      wr("a", "a_little_tense", 13, 50),
      wr("a", "tense", 14, 10),
      wr("late", null, 16, 55, false, "low-light"),
      wr("late", null, 17, 0, false, "low-light"),
      wr("live", "at_ease", 17, 39),
    ];

    const recap = deriveRecap(sessions, rows, NOW);

    // the fresh-live session is never surfaced as a past recap (FR-031 / FR-032)
    expect(recap.sessions.map((s) => s.sessionId)).toEqual(["m", "a", "late"]);
    expect(recap.checkinCount).toBe(3);

    const m = recap.sessions.find((s) => s.sessionId === "m")!;
    const a = recap.sessions.find((s) => s.sessionId === "a")!;
    const late = recap.sessions.find((s) => s.sessionId === "late")!;

    expect(m.tenor).toBe("at_ease");
    expect(m.chipTone).toBe("meadow");
    expect(m.readLess).toBe(false);

    expect(a.tenor).toBe("tense");
    expect(a.chipTone).toBe("amber");

    // read-less session: honest, muted, NEVER calm (SC-011)
    expect(late.readLess).toBe(true);
    expect(late.tenor).toBe("no_read");
    expect(late.chipTone).toBe("muted");
    expect(late.chipLabel.toLowerCase()).not.toContain("at ease");

    // chronological numbering for the plot badges
    expect(m.number).toBe(1);
    expect(a.number).toBe(2);
    expect(late.number).toBe(3);

    // auto-fit day span: first reading (08:45) → last reading (17:00), local
    expect(recap.daySpan).not.toBeNull();
    expect(recap.daySpan!.startMs).toBe(new Date(2026, 5, 21, 8, 45).getTime());
    expect(recap.daySpan!.endMs).toBe(new Date(2026, 5, 21, 17, 0).getTime());
  });

  it("no retrospective sessions today → an empty recap (the card renders its empty state)", () => {
    const recap = deriveRecap([], [], NOW);
    expect(recap.sessions).toEqual([]);
    expect(recap.checkinCount).toBe(0);
    expect(recap.daySpan).toBeNull();
    expect(recap.headline.hot).toBeNull();
  });
});
