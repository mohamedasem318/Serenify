import type { Band } from "@/lib/api/monitoring-client";
import { createClient } from "@/lib/supabase/client";

/**
 * Feature 008 / US4 — T046. The typed, **browser-side Supabase RLS reads** that feed
 * the monitor-page this-session trend and the dashboard today recap. There are NO extra
 * API endpoints (data-model.md § Reads): every read runs as the signed-in user through
 * `createClient()` (the `@supabase/ssr` browser client), so RLS scopes it to `auth.uid()`
 * and the manager layer — which has no policy on these tables — can never run them.
 *
 * Read-rules locked 2026-06-21 (data-model.md § Reads — "US4 read-rules"), honoured here:
 *   • SELECT whitelist — owner columns only. The `.select()` strings NEVER name `label`
 *     or `stress_probability`; no raw probability ever reaches the client (FR-015). The
 *     DB column GRANT is the backstop (a slip → `42501`), but the SELECTs stay honest.
 *   • Retrospective-only — today's recap shows **ended OR stale-active** sessions and
 *     EXCLUDES the fresh-live one (a reading within the last 5 min). (FR-031 / B4)
 *   • Read-less honesty — a session with no confident band renders "no clear read",
 *     never calm/at-ease. (FR-029 / SC-011)
 *   • n=1 — a single-reading session is a single point, not a line. (FR-029)
 *   • Gaps only — skipped/absent windows are gaps, never carried-forward or fabricated.
 *   • Headline/phrase derive from **band + time only** — never a probability.
 *
 * The pure derivations below (`isReadLess`, `bandCount`, `sessionTenor`,
 * `retrospectiveSessionIds`, `deriveRecap`, …) are exported so the read-rules are
 * unit-testable without a Supabase round-trip (T049).
 */

// ── Column whitelists (data-model.md § Reads — owner columns only) ───────────────────
// Exported so the seam/whitelist test (T050) can assert they exclude label + probability.
export const SESSION_TREND_COLUMNS = "id, captured_at, scored, band, skip_cause" as const;
export const TODAY_TREND_COLUMNS = "band, captured_at, scored, skip_cause, session_id" as const;
export const RECAP_SESSION_COLUMNS = "id, started_at, ended_at, status" as const;

/** Skip cause as persisted (feature 006 vocabulary); null when scored. */
export type SkipCause = "low-light" | "out-of-frame" | "insufficient-face" | "our-side";

/** Monitoring-session status as persisted (data-model.md). */
export type SessionStatus = "active" | "paused" | "out_of_frame" | "ended";

/** One point of the monitor-page this-session trend (getSessionTrend). */
export interface SessionTrendPoint {
  id: string;
  capturedAt: string; // ISO-8601 UTC; rendered in the user's local zone (FR-030)
  scored: boolean;
  band: Band | null; // null when skipped OR warming
  skipCause: SkipCause | null;
}

/** One window row of the today trend (getTodayTrend). */
export interface TodayTrendRow {
  band: Band | null;
  capturedAt: string;
  scored: boolean;
  skipCause: SkipCause | null;
  sessionId: string;
}

/** A monitoring-session row as read for the recap (owner columns). */
export interface SessionRow {
  id: string;
  started_at: string;
  ended_at: string | null;
  status: SessionStatus;
}

/** Overall tenor of a session — `no_read` when it produced no confident band. */
export type SessionTenor = Band | "no_read";

/** The colour role a chip/marker takes: meadow = calm, amber = stress, muted = no-read. */
export type ChipTone = "meadow" | "amber" | "muted";

/** A derived per-session recap entry (everything the timeline + plot badge need). */
export interface RecapSession {
  sessionId: string;
  /** Chronological 1-based index (the plot badge number). */
  number: number;
  startedAt: string;
  endedAt: string | null;
  /** "Morning check-in" / "Afternoon check-in" / "Late check-in" — from start time, local. */
  timeIdentity: string;
  /** "8:40 – 9:30 am" — local zone (FR-030). */
  timeRange: string;
  /** Peak (tensest) tenor; `no_read` when read-less. */
  tenor: SessionTenor;
  /** Short state-chip label (read-less = "no clear read"). */
  chipLabel: string;
  chipTone: ChipTone;
  /** Short templated phrase (band + time only; no number). */
  phrase: string;
  /** True when the session produced no confident band — render honestly, never calm. */
  readLess: boolean;
  /** Count of confident bands — `1` ⇒ render a single dot, not a line (FR-029). */
  bandCount: number;
}

/** Templated headline: rendered as `{pre}<amber>{hot}</amber>{post}`. `hot` is null when calm. */
export interface TemplatedHeadline {
  pre: string;
  hot: string | null;
  post: string;
}

/** The whole today recap the check-in card renders from. */
export interface TodayRecap {
  /** Retrospective sessions, chronological (the fresh-live one is excluded). */
  sessions: RecapSession[];
  headline: TemplatedHeadline;
  /** Auto-fit axis bounds: first → last reading, in ms (null when no readings). */
  daySpan: { startMs: number; endMs: number } | null;
  /** "last read 2:18 pm" — local; null when no readings. */
  lastReadLabel: string | null;
  /** Number of retrospective check-ins today. */
  checkinCount: number;
  /** The session holding the tensest stretch (peak marker), if any reached stress. */
  peakSessionId: string | null;
  /** The instant (ms) of the tensest reading — for positioning the peak marker. */
  peakAtMs: number | null;
}

export interface ReaderOpts {
  /** Injectable Supabase client (defaults to the browser RLS client). */
  client?: ReturnType<typeof createClient>;
  /** Injectable clock (defaults to `new Date()`) — keeps the read-rules testable. */
  now?: Date;
}

// ── band algebra ─────────────────────────────────────────────────────────────────────

const BAND_RANK: Record<Band, number> = { at_ease: 0, a_little_tense: 1, tense: 2 };
const RANK_BAND: Band[] = ["at_ease", "a_little_tense", "tense"];

const ms = (iso: string) => new Date(iso).getTime();
const confidentBands = (rows: TodayTrendRow[]): Band[] =>
  rows.filter((r) => r.band != null).map((r) => r.band as Band);

/** True when a session produced no confident band (warming-only or all-skipped). */
export function isReadLess(rows: TodayTrendRow[]): boolean {
  return rows.every((r) => r.band == null);
}

/** Count of confident bands in a session (n=1 ⇒ single dot). */
export function bandCount(rows: TodayTrendRow[]): number {
  return confidentBands(rows).length;
}

/** A session's overall tenor = its tensest (peak) confident band, else `no_read`. */
export function sessionTenor(rows: TodayTrendRow[]): SessionTenor {
  const bands = confidentBands(rows);
  if (!bands.length) return "no_read";
  const peak = Math.max(...bands.map((b) => BAND_RANK[b]));
  return RANK_BAND[peak] ?? "no_read";
}

// ── retrospective set (ended OR stale-active; fresh-live excluded) ────────────────────

const STALE_MS = 5 * 60 * 1000; // the existing 5-min auto-end window (B4)

/**
 * The retrospective session set among `sessions`: every `ended` session plus any
 * non-ended session whose last reading (or `started_at`, if none) is more than 5 min old.
 * A non-ended session read within the last 5 min is the **fresh-live** one and is excluded
 * (it belongs to the monitor page, never to a past recap — FR-031 / FR-032).
 */
export function retrospectiveSessionIds(
  sessions: SessionRow[],
  rows: TodayTrendRow[],
  now: Date,
): Set<string> {
  const lastReadingMs = new Map<string, number>();
  for (const r of rows) {
    const t = ms(r.capturedAt);
    const prev = lastReadingMs.get(r.sessionId);
    if (prev == null || t > prev) lastReadingMs.set(r.sessionId, t);
  }
  const cutoff = now.getTime() - STALE_MS;
  const keep = new Set<string>();
  for (const s of sessions) {
    if (s.status === "ended") {
      keep.add(s.id);
      continue;
    }
    const activity = lastReadingMs.get(s.id) ?? ms(s.started_at);
    if (activity < cutoff) keep.add(s.id); // stale-active
  }
  return keep;
}

// ── local time formatting (FR-030: user's local zone, never a server zone) ────────────

/** The user-local-day window [start, nextMidnight) for start-day attribution (A2/A3). */
export function localDayWindow(now: Date): { start: Date; end: Date } {
  const start = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0);
  const end = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1, 0, 0, 0, 0);
  return { start, end };
}

function localHour(iso: string): number {
  return new Date(iso).getHours();
}

function timeIdentity(iso: string): string {
  const h = localHour(iso);
  if (h < 12) return "Morning check-in";
  if (h < 16) return "Afternoon check-in";
  if (h < 19) return "Late check-in";
  if (h < 22) return "Evening check-in";
  return "Night check-in";
}

/** Coarse part-of-day for the headline ("calm morning", "tense afternoon"). */
function partOfDay(iso: string): string {
  const h = localHour(iso);
  if (h < 12) return "morning";
  if (h < 17) return "afternoon";
  if (h < 21) return "evening";
  return "night";
}

function fmtClock(iso: string): { time: string; meridiem: string } {
  // toLocaleTimeString → the user's local zone (FR-030). Split the meridiem so a
  // same-period range can collapse it ("8:40 – 9:30 am").
  const full = new Date(iso)
    .toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })
    .toLowerCase();
  const m = full.match(/\s*(am|pm)$/);
  if (!m || m.index == null) return { time: full, meridiem: "" };
  return { time: full.slice(0, m.index).trim(), meridiem: m[1] ?? "" };
}

function timeRange(startIso: string, endIso: string | null): string {
  const start = fmtClock(startIso);
  if (!endIso) return `${start.time}${start.meridiem ? ` ${start.meridiem}` : ""}`;
  const end = fmtClock(endIso);
  if (start.meridiem && start.meridiem === end.meridiem) {
    return `${start.time} – ${end.time} ${end.meridiem}`;
  }
  const s = `${start.time}${start.meridiem ? ` ${start.meridiem}` : ""}`;
  const e = `${end.time}${end.meridiem ? ` ${end.meridiem}` : ""}`;
  return `${s} – ${e}`;
}

function lastReadLabel(rows: TodayTrendRow[]): string | null {
  if (!rows.length) return null;
  const latest = rows.reduce((a, b) => (ms(b.capturedAt) > ms(a.capturedAt) ? b : a));
  const c = fmtClock(latest.capturedAt);
  return `last read ${c.time}${c.meridiem ? ` ${c.meridiem}` : ""}`;
}

// ── per-session chip + phrase (band + time only) ─────────────────────────────────────

const dominantSkipCause = (rows: TodayTrendRow[]): SkipCause | null => {
  const counts = new Map<SkipCause, number>();
  for (const r of rows) if (r.skipCause) counts.set(r.skipCause, (counts.get(r.skipCause) ?? 0) + 1);
  let best: SkipCause | null = null;
  let bestN = 0;
  for (const [cause, n] of counts) {
    if (n > bestN) {
      best = cause;
      bestN = n;
    }
  }
  return best;
};

function chipFor(rows: TodayTrendRow[], tenor: SessionTenor): { label: string; tone: ChipTone } {
  if (tenor === "no_read") return { label: "no clear read", tone: "muted" };
  if (tenor === "at_ease") return { label: "calm", tone: "meadow" };
  if (tenor === "a_little_tense") return { label: "uneasy", tone: "amber" };
  // peaked at tense — distinguish "ended tense" from "eased after a tense stretch"
  const bands = confidentBands(rows);
  const endedTense = bands[bands.length - 1] === "tense";
  return { label: endedTense ? "ended tense" : "a tense stretch", tone: "amber" };
}

function phraseFor(rows: TodayTrendRow[], tenor: SessionTenor): string {
  if (tenor === "no_read") {
    switch (dominantSkipCause(rows)) {
      case "low-light":
        return "light too low";
      case "out-of-frame":
        return "kept stepping away";
      default:
        return "no clear read";
    }
  }
  const bands = confidentBands(rows);
  if (bands.length === 1) return "a brief read";
  const first = BAND_RANK[bands[0]!];
  const last = BAND_RANK[bands[bands.length - 1]!];
  if (last > first) return "climbed steadily";
  if (last < first) return "eased off";
  if (tenor === "at_ease") return "calm throughout";
  if (tenor === "tense") return "tense throughout";
  return "uneasy throughout";
}

// ── headline (band + time only) ──────────────────────────────────────────────────────

/**
 * The today-card headline. Rendered `{pre}<amber weight-700>{hot}</amber>{post}` — `hot` is
 * null on a calm/no-read day. Band + time only (never a probability); single-surface (this
 * feeds only the today card via deriveRecap → getTodayRecap → todays-checkin-card).
 *
 * Copy contract (009 Phase 8 — FR-002 / SC-010 + DECISIONS 2026-06-23 "headline rework"):
 *   • Honesty (T010, kept): the standalone "tense" word appears ONLY when the tense band was
 *     reached; an a-little-tense peak says exactly "uneasy"; a calm day carries no amber.
 *   • Recovery (FR-002 / SC-010 extension): when the day reached a tension peak but the most
 *     recent CONFIDENT session sits below it (the user eased), surface that recovery rather than
 *     the peak alone. HONESTY (009 follow-up §3): bare "…then eased" reads as "back to fine", so
 *     it is reserved for a step-down that REACHES calm (at_ease); a peak that only stepped down to
 *     a-little-tense (still elevated) gets the qualified "…then eased a little". A trailing
 *     read-less session is a measurement gap, not a recovery — it is excluded from `readable`, so
 *     recovery keys off the most recent *band*. Recovery never upgrades a sub-tense day to "tense"
 *     (`level` is the real peak).
 *   • Voice: second-person, no trailing period. Amber `hot` is the BARE descriptor only — the
 *     part-of-day moves to `pre`/`post`. Calm→tension arcs name both parts of day when they
 *     differ, and collapse to a time-neutral second clause when they share one part of day.
 *   • "No clear read today" stays impersonal (no "your", no period) — it describes a gap.
 */
function deriveHeadline(sessions: RecapSession[]): TemplatedHeadline {
  if (!sessions.length) return { pre: "", hot: null, post: "" };

  const readable = sessions.filter((s) => !s.readLess);
  // impersonal — a measurement gap, not the user's state (no "your", no period)
  if (!readable.length) return { pre: "No clear read today", hot: null, post: "" };

  const stressed = readable.filter((s) => s.tenor === "a_little_tense" || s.tenor === "tense");
  if (!stressed.length) {
    // a calm day — no amber clause (calm recedes; Principle V). Second-person, no period.
    if (readable.length === 1) return { pre: `Your ${partOfDay(readable[0]!.startedAt)} was calm`, hot: null, post: "" };
    return { pre: "Your day has been calm so far", hot: null, post: "" };
  }

  // pick the tensest session (tie → the later one) as the eye-catch
  const peak = stressed.reduce((a, b) =>
    BAND_RANK[b.tenor as Band] > BAND_RANK[a.tenor as Band] ||
    (BAND_RANK[b.tenor as Band] === BAND_RANK[a.tenor as Band] && ms(b.startedAt) > ms(a.startedAt))
      ? b
      : a,
  );
  const isTense = peak.tenor === "tense";
  const level = isTense ? "tense" : "uneasy"; // bare descriptor → amber `hot`
  const peakPod = partOfDay(peak.startedAt);

  // recovery — the most recent CONFIDENT session is below the peak (readable excludes read-less,
  // so a trailing no-read tail can't masquerade as easing). Honesty intact: `level` is the real peak.
  const mostRecent = readable[readable.length - 1]!;
  if (BAND_RANK[mostRecent.tenor as Band] < BAND_RANK[peak.tenor as Band]) {
    // Honest easing (009 follow-up §3): bare "eased" reads as "back to fine", so reserve it for a
    // step-down that REACHES calm. A peak that only stepped down to a-little-tense (still elevated)
    // gets the qualified "eased a little" — never the unqualified relief word.
    const easedToCalm = mostRecent.tenor === "at_ease";
    return { pre: `Your ${peakPod} turned `, hot: level, post: easedToCalm ? ", then eased" : ", then eased a little" };
  }

  // calm→tension arc — a calm session precedes the peak
  const calmBefore = readable.find((s) => s.tenor === "at_ease" && ms(s.startedAt) < ms(peak.startedAt));
  if (calmBefore) {
    const calmPod = partOfDay(calmBefore.startedAt);
    if (calmPod === peakPod) {
      // same part of day → collapse the second clause (no repeated part-of-day word)
      return { pre: `Your ${calmPod} started calm, then turned `, hot: level, post: "" };
    }
    // different parts of day → name both. The article rides in `pre` ("a tense" / "an uneasy").
    const article = isTense ? "a " : "an ";
    return { pre: `Your ${calmPod} started calm, then you had ${article}`, hot: level, post: ` ${peakPod}` };
  }

  // plain peak — stressed, but no calm phase before it and no easing after
  return { pre: `Your ${peakPod} was `, hot: level, post: "" };
}

// ── deriveRecap ──────────────────────────────────────────────────────────────────────

/**
 * Build the whole today recap from the day's sessions + window rows. Applies the
 * retrospective filter (fresh-live excluded), groups rows by session, derives each
 * session's identity/chip/phrase/read-less/tenor, and computes the headline, auto-fit
 * day span, last-read label, and the peak marker. Pure — `now` is injected.
 */
export function deriveRecap(sessions: SessionRow[], rows: TodayTrendRow[], now: Date): TodayRecap {
  const keep = retrospectiveSessionIds(sessions, rows, now);
  const kept = sessions
    .filter((s) => keep.has(s.id))
    .sort((a, b) => ms(a.started_at) - ms(b.started_at));

  const rowsBySession = new Map<string, TodayTrendRow[]>();
  for (const r of rows) {
    if (!keep.has(r.sessionId)) continue; // retrospective rows only
    const list = rowsBySession.get(r.sessionId) ?? [];
    list.push(r);
    rowsBySession.set(r.sessionId, list);
  }
  for (const list of rowsBySession.values()) list.sort((a, b) => ms(a.capturedAt) - ms(b.capturedAt));

  const recapSessions: RecapSession[] = kept.map((s, i) => {
    const r = rowsBySession.get(s.id) ?? [];
    const tenor = sessionTenor(r);
    const readLess = isReadLess(r);
    const lastRowIso = r.at(-1)?.capturedAt ?? null;
    const chip = chipFor(r, tenor);
    return {
      sessionId: s.id,
      number: i + 1,
      startedAt: s.started_at,
      endedAt: s.ended_at,
      timeIdentity: timeIdentity(s.started_at),
      timeRange: timeRange(s.started_at, s.ended_at ?? lastRowIso),
      tenor,
      chipLabel: chip.label,
      chipTone: chip.tone,
      phrase: phraseFor(r, tenor),
      readLess,
      bandCount: bandCount(r),
    };
  });

  // auto-fit day span + last-read label across all retrospective rows
  const keptRows = recapSessions.flatMap((s) => rowsBySession.get(s.sessionId) ?? []);
  const daySpan =
    keptRows.length > 0
      ? {
          startMs: Math.min(...keptRows.map((r) => ms(r.capturedAt))),
          endMs: Math.max(...keptRows.map((r) => ms(r.capturedAt))),
        }
      : null;

  // peak marker — the tensest reading (tie → latest), only when stress was reached
  let peakSessionId: string | null = null;
  let peakAtMs: number | null = null;
  let peakRank = 0;
  for (const r of keptRows) {
    if (r.band == null) continue;
    const rank = BAND_RANK[r.band];
    const t = ms(r.capturedAt);
    if (rank > peakRank || (rank === peakRank && peakAtMs != null && t > peakAtMs)) {
      peakRank = rank;
      peakSessionId = r.sessionId;
      peakAtMs = t;
    }
  }
  if (peakRank < BAND_RANK.a_little_tense) {
    peakSessionId = null;
    peakAtMs = null;
  }

  return {
    sessions: recapSessions,
    headline: deriveHeadline(recapSessions),
    daySpan,
    lastReadLabel: lastReadLabel(keptRows),
    checkinCount: recapSessions.length,
    peakSessionId,
    peakAtMs,
  };
}

// ── readers (browser-side RLS SELECTs) ───────────────────────────────────────────────

function mapSessionPoint(row: Record<string, unknown>): SessionTrendPoint {
  return {
    id: row.id as string,
    capturedAt: row.captured_at as string,
    scored: row.scored as boolean,
    band: (row.band as Band | null) ?? null,
    skipCause: (row.skip_cause as SkipCause | null) ?? null,
  };
}

function mapTrendRow(row: Record<string, unknown>): TodayTrendRow {
  return {
    band: (row.band as Band | null) ?? null,
    capturedAt: row.captured_at as string,
    scored: row.scored as boolean,
    skipCause: (row.skip_cause as SkipCause | null) ?? null,
    sessionId: row.session_id as string,
  };
}

/**
 * The monitor-page **this-session** trend — the one session currently being recorded.
 * RLS also restricts to `auth.uid()`. Never selects the probability (FR-015).
 */
export async function getSessionTrend(
  sessionId: string,
  opts: ReaderOpts = {},
): Promise<SessionTrendPoint[]> {
  const supabase = opts.client ?? createClient();
  const { data, error } = await supabase
    .from("window_readings")
    .select(SESSION_TREND_COLUMNS)
    .eq("session_id", sessionId)
    .order("captured_at", { ascending: true });
  if (error || !data) return [];
  return (data as Record<string, unknown>[]).map(mapSessionPoint);
}

/** Today's sessions (any status) in the user-local day + all their window rows. */
async function loadToday(
  userId: string,
  now: Date,
  client?: ReturnType<typeof createClient>,
): Promise<{ sessions: SessionRow[]; rows: TodayTrendRow[] }> {
  const supabase = client ?? createClient();
  const { start, end } = localDayWindow(now);
  const { data: sessData } = await supabase
    .from("monitoring_sessions")
    .select(RECAP_SESSION_COLUMNS)
    .eq("user_id", userId)
    .gte("started_at", start.toISOString())
    .lt("started_at", end.toISOString())
    .order("started_at", { ascending: true });
  const sessions = (sessData ?? []) as unknown as SessionRow[];
  if (!sessions.length) return { sessions, rows: [] };

  const ids = sessions.map((s) => s.id);
  const { data: rowData } = await supabase
    .from("window_readings")
    .select(TODAY_TREND_COLUMNS)
    .in("session_id", ids)
    .order("captured_at", { ascending: true });
  const rows = ((rowData ?? []) as Record<string, unknown>[]).map(mapTrendRow);
  return { sessions, rows };
}

/**
 * The dashboard card's **today recap** — derived from today's ended-or-stale-active
 * sessions (fresh-live excluded). Empty when there are none today.
 */
export async function getTodayRecap(userId: string, opts: ReaderOpts = {}): Promise<TodayRecap> {
  const now = opts.now ?? new Date();
  const { sessions, rows } = await loadToday(userId, now, opts.client);
  return deriveRecap(sessions, rows, now);
}

/**
 * The dashboard card's **today trend** — per-window rows for the same retrospective set
 * the recap uses. The collapsed mini-trend and the expanded view both read THESE rows
 * (one source), so they always agree (SC-008). Owner columns only; never a probability.
 */
export async function getTodayTrend(userId: string, opts: ReaderOpts = {}): Promise<TodayTrendRow[]> {
  const now = opts.now ?? new Date();
  const { sessions, rows } = await loadToday(userId, now, opts.client);
  const keep = retrospectiveSessionIds(sessions, rows, now);
  return rows.filter((r) => keep.has(r.sessionId)).sort((a, b) => ms(a.capturedAt) - ms(b.capturedAt));
}
