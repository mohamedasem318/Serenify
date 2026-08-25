"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import {
  ItemActions,
  OutcomePrompt,
  OutcomeRecorded,
  RecommendationCardShell,
  RenRow,
  RestingBlock,
  SwapFade,
  SwapRetiredNote,
} from "@/components/recommendations/recommendation-card-states";
import { PickItem } from "@/components/recommendations/pick-item";
import {
  fetchReflectiveCopy as defaultFetchReflectiveCopy,
  recordOpened as defaultRecordOpened,
  recordOutcome as defaultRecordOutcome,
  surfacePick as defaultSurfacePick,
  swapPick as defaultSwapPick,
  type ReflectiveCopyResult,
} from "@/lib/api/recommendations-client";
import { openChatPillFresh } from "@/lib/chat/pill-launcher";
import { BAND_LABEL } from "@/lib/bands";
import { QUESTIONNAIRE_RESULT_DWELL_MS } from "@/lib/questionnaire/constants";
import {
  CARD_DESC_CONFIRMED,
  CARD_DESC_NOTHING_TO_SUGGEST,
  CARD_DESC_NO_READING,
  CARD_DESC_PICKED,
} from "@/lib/recommendations/card-strings";
import { selectPick, type PickOutcome, type SelectedPick } from "@/lib/recommendations/engine";
import {
  IDLE_CARD_UI,
  deriveCardModel,
  toHistoryEntry,
  toLocalDayString,
  type BandReading,
  type CardModel,
  type CardUiState,
  type PickRow,
} from "@/lib/recommendations/episode";
import {
  AT_REST_FORWARD_LINE,
  CALM_FORWARD_LINE,
  NO_READING_YET_LEAD,
  NO_READING_YET_LINE,
  RECOMMENDATION_LIBRARY,
  REFLECTIVE_COPY_MAX_LENGTH,
  buildAtRestFallbackText,
  buildCalmFallbackText,
  type LibraryItem,
} from "@/lib/recommendations/library";
import { neutralPreferenceSource, type PreferenceSource } from "@/lib/recommendations/preference-source";
import {
  readCachedReflectiveCopy,
  reflectiveCopyCacheKey,
  writeCachedReflectiveCopy,
} from "@/lib/recommendations/reflective-copy-cache";
import {
  validateReflectiveCopy,
  type ReflectiveFacts,
} from "@/lib/recommendations/reflective-copy-validation";
import {
  getTodayBandReadings,
  getTodayPicks,
  type TodayBandReading,
} from "@/lib/recommendations/recommendation-reads";

/**
 * Feature 014 — the "Things that might help" card (T013), placeholder → stateful.
 *
 * THE WIRING LAYER, and the only impure thing in the feature's web half. The engine
 * (`engine.ts`) and the reducer (`episode.ts`) are pure and stay that way: every clock read,
 * every uuid, every read and every write is injected HERE and handed to them as data. That
 * is why the ten states are table-testable at all, and why the determinism property (SC-001)
 * is a property of the code rather than of a careful reviewer.
 *
 * Shape of a render:
 *   1. read today's picks + today's band readings, owner-RLS, as the signed-in user;
 *   2. hand them plus the in-flight UI flags to `deriveCardModel` → one of the ten states;
 *   3. render that state's shell from `recommendation-card-states.tsx`;
 *   4. an action writes through `recommendations-client.ts`, then re-reads.
 *
 * ── Never an interruption (FR-013) ──────────────────────────────────────────────────
 * An Uneasy or Tense reading changes what this card SAYS and nothing else. No modal, no
 * toast, no scroll, no focus move, no band chip — the check-in card above already stated
 * the band once, and repeating it doubles the alarm. Only a confirmed detection changes the
 * card's weight, and only to state 4's five small moves.
 *
 * ── The outcome prompt (FR-016 / FR-031) ────────────────────────────────────────────
 * It appears only after the item was OPENED **and** its instructions CLOSED, never over the
 * open steps, and it is asked once. There is deliberately no dismiss control: ignoring it IS
 * the third answer, it writes nothing, and it costs no budget. `outcomePromptIgnored` is set
 * the moment an answer is given too, so a failed outcome write degrades to the previous
 * state rather than re-asking (FR-030).
 *
 * ── The day boundary (FR-019) ───────────────────────────────────────────────────────
 * There is no reset routine and nothing to clear. Both reads are filtered by the person's
 * own `local_day` at query time and the reducer filters again; cross midnight and the
 * budget, the exclusions, the episode and the prompt are simply not there any more.
 *
 * ── There is no error state (FR-030) ────────────────────────────────────────────────
 * No branch below renders a failure. A failed read degrades to the resting state; a failed
 * write degrades to what was already on screen. The write client never throws, and every
 * handler here swallows what it cannot use.
 */

// ─────────────────────────────────────────────────────────────────────────────
// The injectable seam
// ─────────────────────────────────────────────────────────────────────────────

export interface ThingsThatMightHelpDeps {
  loadPicks: (userId: string, now: Date) => Promise<PickRow[]>;
  loadBands: (userId: string, now: Date) => Promise<TodayBandReading[]>;
  surfacePick: typeof defaultSurfacePick;
  recordOpened: typeof defaultRecordOpened;
  recordOutcome: typeof defaultRecordOutcome;
  swapPick: typeof defaultSwapPick;
  /** Opens the chat pill in place — the same seam the Recent chats card uses. */
  openRen: () => void;
  /** Injected clock. The engine and reducer never read one. */
  now: () => number;
  /** Injected uuid, used only when a derivation opens a NEW episode. */
  newId: () => string;
  preferences: PreferenceSource;
  library: readonly LibraryItem[];
  /** The D-6 acknowledgement dwell (FR-029) — feature 012's constant, reused not restated. */
  dwellMs: number;
  /**
   * Ask the service to re-phrase a state-2/9 line. Injected like every other network call
   * here; it may fail freely, because the deterministic string is already correct.
   */
  generateReflectiveCopy: (facts: ReflectiveFacts) => Promise<ReflectiveCopyResult>;
  /** Reader-facing skeleton budget (contract §First paint rule 2). */
  reflectiveSkeletonMs: number;
  /** Background generation budget (contract §Timing). Bounds work, not the reader's wait. */
  reflectiveGenerationMs: number;
}

/**
 * How long the line's slot may sit empty while a re-phrasing is fetched.
 *
 * 800 ms, from `contracts/reflective-copy.md`: the sibling today card paints a stable
 * shell and upgrades exactly once after a single local round trip, with no skeleton
 * anywhere, so a generated line that lags materially behind that reads as a broken card —
 * and painting the deterministic string early just to swap it later is the flip the
 * contract forbids. The slot waits, briefly, on the same visual clock as that sibling.
 */
export const REFLECTIVE_SKELETON_BUDGET_MS = 800;

/**
 * How long generation may keep running after the reader has stopped waiting. Roughly 4×
 * the skeleton budget: this bounds BACKGROUND work, and a result that lands inside it is
 * still worth having — for the *next* first paint, via the cache, never for the paint
 * already on screen. `REFLECTIVE_COPY_REQUEST_TIMEOUT_MS` sits below it deliberately.
 */
export const REFLECTIVE_GENERATION_BUDGET_MS = 3_500;

const DEFAULT_DEPS: ThingsThatMightHelpDeps = {
  loadPicks: (userId, now) => getTodayPicks(userId, { now }),
  loadBands: (userId, now) => getTodayBandReadings(userId, { now }),
  surfacePick: defaultSurfacePick,
  recordOpened: defaultRecordOpened,
  recordOutcome: defaultRecordOutcome,
  swapPick: defaultSwapPick,
  openRen: openChatPillFresh,
  now: () => Date.now(),
  newId: () => crypto.randomUUID(),
  preferences: neutralPreferenceSource,
  library: RECOMMENDATION_LIBRARY,
  dwellMs: QUESTIONNAIRE_RESULT_DWELL_MS,
  generateReflectiveCopy: (facts) => defaultFetchReflectiveCopy(facts),
  reflectiveSkeletonMs: REFLECTIVE_SKELETON_BUDGET_MS,
  reflectiveGenerationMs: REFLECTIVE_GENERATION_BUDGET_MS,
};

export interface ThingsThatMightHelpCardProps {
  /** The signed-in employee. Without it the card rests in state 1 and reads nothing. */
  userId?: string;
  deps?: Partial<ThingsThatMightHelpDeps>;
}

// ─────────────────────────────────────────────────────────────────────────────
// Reflective facts — real counts, real times, never a raw reading
// ─────────────────────────────────────────────────────────────────────────────

/**
 * `9:40` / `2:30` — the mock's clock shape, in the viewer's own zone. The meridiem is
 * dropped exactly as the mock drops it; the times are already anchored to "today" by every
 * read being day-filtered, so there is nothing for am/pm to disambiguate.
 */
function clockLabel(atMs: number): string {
  return new Date(atMs)
    .toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })
    .replace(/\s*[ap]\.?m\.?$/i, "")
    .trim();
}

/**
 * The facts states 2 and 9 are allowed to state, computed IN ADVANCE and never as raw
 * readings: a real count of the person's own check-ins, real preformatted times, real band
 * display labels. Nothing downstream may say anything that is not in here — that is what
 * makes the deterministic string the source of truth (contracts/reflective-copy.md).
 *
 * A CHECK-IN is a monitoring session, not a scored window: someone had three check-ins
 * today, not eighty-one windows. So sessions are counted, and each contributes the clock
 * time of its first confident reading.
 */
function reflectiveFacts(bands: readonly TodayBandReading[]): {
  checkinCount: number;
  times: string[];
  bandLabels: string[];
} {
  const firstBySession = new Map<string, number>();
  for (const reading of bands) {
    const seen = firstBySession.get(reading.sessionId);
    if (seen === undefined || reading.atMs < seen) firstBySession.set(reading.sessionId, reading.atMs);
  }
  const times = [...firstBySession.values()].sort((a, b) => a - b).map(clockLabel);

  const labels: string[] = [];
  for (const reading of bands) {
    const label = BAND_LABEL[reading.band];
    if (label && !labels.includes(label)) labels.push(label);
  }

  return { checkinCount: firstBySession.size, times, bandLabels: labels };
}

/**
 * Split a deterministic reflective string into the mock's two lines on its OWN trailing
 * forward-line constant. This is a split on a known suffix, never a re-wording: both halves
 * are the reviewed text, byte for byte. When the builder had no true specific to state it
 * returns the forward line alone — `lead` comes back empty and the caller falls back to
 * state 1's SHAPE rather than inventing a generic affirmation (FR-001 state 2).
 */
function splitReflective(text: string, forwardLine: string): { lead: string; line?: string } {
  if (text.endsWith(forwardLine)) {
    const lead = text.slice(0, text.length - forwardLine.length).trim();
    return lead ? { lead, line: forwardLine } : { lead: "" };
  }
  return { lead: text };
}

// ─────────────────────────────────────────────────────────────────────────────
// Generation over the deterministic line (states 2 and 9)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * What states 2 and 9 render, plus the material a re-phrasing would need.
 *
 * **Generation is scoped to the LEAD**, and that is a deliberate reading of
 * `contracts/reflective-copy.md` against this card's two-line shape. The forward line
 * (`CALM_FORWARD_LINE` / `AT_REST_FORWARD_LINE`) is a fixed reviewed constant carrying no
 * count, no time and no band — there is nothing in it for a generator to phrase better,
 * and a model rewriting it could only weaken or over-promise it. The lead is the line
 * built from the person's own facts, so the lead is "the reflective line": it is what
 * `fallbackText` carries, what the skeleton stands in for, and what a validated result
 * replaces. The forward line paints with the shell, immediately, on both paths.
 *
 * `null` means this state generates nothing: either it is not 2/9, or the builder could
 * not produce a true specific line (`lead` empty) — in which case the card owes state 1's
 * SHAPE, never a generic affirmation (FR-001 state 2), and there is nothing to re-phrase.
 */
export function reflectiveInputFor(
  state: number,
  facts: { checkinCount: number; times: string[]; bandLabels: string[] },
  tried: { title?: string; atLabel?: string },
): ReflectiveFacts | null {
  if (state === 2) {
    const { lead } = splitReflective(buildCalmFallbackText(facts), CALM_FORWARD_LINE);
    return lead ? { state: 2, ...facts, fallbackText: lead } : null;
  }
  if (state === 9) {
    const full = buildAtRestFallbackText({
      ...facts,
      triedItemTitle: tried.title,
      triedAtLabel: tried.atLabel,
    });
    const { lead } = splitReflective(full, AT_REST_FORWARD_LINE);
    // The bundle is NARROWED to what state 9's line actually says: what was tried, and
    // when. The day's counts, times and bands are deliberately NOT carried — the state-9
    // lead makes no claim about any of them, so handing them over would let a generated
    // sentence bolt on "…after a Tense stretch across your 3 check-ins" and pass
    // validation against facts the fallback never asserted. The validator's corpus is
    // this bundle, so narrowing the bundle IS the guarantee (FR-021).
    return lead
      ? {
          state: 9,
          checkinCount: 0,
          times: [],
          bandLabels: [],
          triedItemTitle: tried.title,
          triedAtLabel: tried.atLabel,
          fallbackText: lead,
        }
      : null;
  }
  return null;
}

/** The fixed reviewed line that paints under the generated one, per state. */
function forwardLineFor(state: 2 | 9): string {
  return state === 9 ? AT_REST_FORWARD_LINE : CALM_FORWARD_LINE;
}

/** What the lead slot shows right now. `pending` = the skeleton is standing in for it. */
interface ReflectivePaint {
  pending: boolean;
  text: string;
}

/**
 * The first-paint rules of `contracts/reflective-copy.md`, in order. The invariant they
 * exist for: **the reflective line is painted once per mounted state and never flips under
 * the reader.**
 *
 *   1. Cache hit → paint the cached (already-validated) text immediately. No skeleton and
 *      NO network call. This is why the cache is read during render rather than in an
 *      effect: reading it in an effect would paint a skeleton first and swap — the exact
 *      flip the contract forbids.
 *   2. Cache miss → the shell paints as usual and only the lead's slot holds a skeleton,
 *      for at most `reflectiveSkeletonMs`.
 *   3. A validated result inside that budget IS the first and only paint of the line.
 *   4. Budget expires → the deterministic string paints and **stands for this mounted
 *      state**. Generation continues to `reflectiveGenerationMs`; a late validated result
 *      goes to the cache ONLY, serving the next first paint, never the one on screen.
 *
 * One deliberate refinement of rule 4: a *definitive failure* (non-200, timeout, or text
 * that fails validation) settles the line to the deterministic string immediately rather
 * than holding the skeleton for the rest of the budget. Nothing can arrive afterwards to
 * make that wait worthwhile, and a skeleton held past the point of hope is just a card
 * that looks stuck. It flips nothing: the fallback is where this state was going to end.
 *
 * `key` is the cache fingerprint, so "a new mounted state" and "a new cache entry" are the
 * same event by construction — a state change, a fact change or the day boundary all
 * re-arm this hook exactly once (FR-019/FR-022).
 */
function useReflectiveLine(
  facts: ReflectiveFacts | null,
  localDay: string,
  d: ThingsThatMightHelpDeps,
): ReflectivePaint {
  const key = facts ? reflectiveCopyCacheKey(facts, localDay) : "";

  const resolve = (): ReflectivePaint => {
    if (!facts) return { pending: false, text: "" };
    const cached = readCachedReflectiveCopy(facts, localDay);
    return cached === null
      ? { pending: true, text: facts.fallbackText } // rule 2 — skeleton, fallback held ready
      : { pending: false, text: cached }; // rule 1 — instant, no network
  };

  const [paint, setPaint] = useState<ReflectivePaint>(resolve);
  const [paintedKey, setPaintedKey] = useState(key);

  // Re-arm on a state change DURING render (React's adjust-state-on-prop-change pattern):
  // React re-runs this component before committing, so the new state's first commit is
  // already correct. Doing it in an effect would paint the previous state's line for one
  // frame — a flip, and a visible one.
  if (key !== paintedKey) {
    setPaintedKey(key);
    setPaint(resolve());
  }

  /**
   * The run in progress, or the finished one, for a fingerprint.
   *
   * `settled` is the load-bearing half. A guard that only remembered "started this key"
   * strands the skeleton forever the moment the effect re-runs at the SAME key: the
   * cleanup cancels the timers and neuters the promise, and the guard then refuses to arm
   * a replacement — permanent shimmer, permanent `aria-busy`, deterministic string never
   * painted. React StrictMode does exactly that on every mount (mount → cleanup → mount),
   * and so does any dependency identity change while a request is in flight. So the run's
   * OUTCOME is tracked, not just its start, and an unsettled run releases the guard when
   * it dies.
   */
  const runRef = useRef<{ key: string; settled: boolean } | null>(null);

  // Deliberately keyed on the FINGERPRINT alone. `facts`, `localDay` and `d` are all
  // recomputed upstream — a background reload hands down a fresh `facts` object with
  // identical content — and re-running on identity would tear down an in-flight request
  // and fire a second one for the same state. The fingerprint IS the content (it is built
  // from the facts, and `fallbackText` is derived from those same facts), so a closure
  // captured under one key stays correct for the whole life of that key.
  useEffect(() => {
    if (!facts || !key) return;
    // Already resolved for this exact state — nothing to re-request and nothing to re-arm.
    if (runRef.current?.key === key && runRef.current.settled) return;

    const run = { key, settled: false };
    runRef.current = run;

    // Rule 1 again, authoritatively: a hit means no request is made at all.
    if (readCachedReflectiveCopy(facts, localDay) !== null) {
      run.settled = true;
      return;
    }

    let live = true;
    const forwardLine = forwardLineFor(facts.state);

    /** Paint once. After this the line STANDS for this mounted state (rule 4). */
    const settleTo = (text: string) => {
      if (run.settled) return;
      run.settled = true;
      setPaint({ pending: false, text });
    };
    const settleToFallback = () => settleTo(facts.fallbackText);

    const skeletonTimer = setTimeout(settleToFallback, d.reflectiveSkeletonMs);
    const budgetTimer = setTimeout(() => {
      live = false;
    }, d.reflectiveGenerationMs);

    void d
      .generateReflectiveCopy(facts)
      .then((result) => {
        clearTimeout(skeletonTimer);
        if (!result.ok || !validateReflectiveCopy(result.text, facts).ok) {
          if (live) settleToFallback();
          return;
        }
        // The cap bounds what a person READS, and what they read is the generated lead
        // plus the forward line beneath it. The validator only saw the lead, so the pair
        // is re-checked here — otherwise a 220-character lead paints at 267.
        if (`${result.text} ${forwardLine}`.length > REFLECTIVE_COPY_MAX_LENGTH) {
          if (live) settleToFallback();
          return;
        }
        // Cached BEFORE the liveness check, on purpose: rule 4 says a late validated
        // result serves the next first paint. "Next" outlives this component, so a result
        // that arrives after unmount is still worth keeping — it is the same text this
        // mount would have shown. Only the PAINT is gated on being alive.
        writeCachedReflectiveCopy(result.text, facts, localDay);
        if (!live || run.settled) return; // rule 4 — cache yes, painted line no
        settleTo(result.text); // rule 3 — first and only paint
      })
      .catch(() => {
        // The seam threw rather than returning a result. Same silence as everywhere else.
        clearTimeout(skeletonTimer);
        if (live) settleToFallback();
      });

    return () => {
      live = false;
      clearTimeout(skeletonTimer);
      clearTimeout(budgetTimer);
      // Belt to the `settled` check's braces: a dead run leaves no trace behind. This is
      // REDUNDANT as the guard is written today — the check above only skips a run that
      // settled, so an unsettled one is re-armed whether or not it was cleared here — and
      // it is kept because it makes the invariant local. `runRef` holding a run that can
      // never settle is the state the stranded-skeleton bug WAS, and the cheapest way to
      // keep it unrepresentable is to not represent it.
      if (!run.settled && runRef.current === run) runRef.current = null;
    };
    // `facts`, `localDay` and `d` are deliberately absent — see the note above the effect.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  return paint;
}

/**
 * The pair of owner-RLS reads, as a module-level async function so it holds no state and
 * cannot be called synchronously. `null` means "nothing new to apply" — no signed-in user,
 * or a read that failed. A failed read is not an error on this surface (FR-030): the card
 * simply keeps what it had and rests.
 */
async function readToday(
  userId: string | undefined,
  d: ThingsThatMightHelpDeps,
  at: Date,
): Promise<{ picks: PickRow[]; bands: TodayBandReading[] } | null> {
  if (!userId) return null;
  try {
    const [picks, bands] = await Promise.all([d.loadPicks(userId, at), d.loadBands(userId, at)]);
    return { picks, bands };
  } catch {
    return null;
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// The card
// ─────────────────────────────────────────────────────────────────────────────

export function ThingsThatMightHelpCard({ userId, deps }: ThingsThatMightHelpCardProps) {
  const d = useMemo<ThingsThatMightHelpDeps>(() => ({ ...DEFAULT_DEPS, ...deps }), [deps]);

  const [picks, setPicks] = useState<readonly PickRow[]>([]);
  const [bands, setBands] = useState<readonly TodayBandReading[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [ui, setUi] = useState<CardUiState>(IDLE_CARD_UI);
  const [nowMs, setNowMs] = useState<number>(() => d.now());
  const [newEpisodeId, setNewEpisodeId] = useState<string>(() => d.newId());

  /** Insert attempts already made, keyed `episodeId|itemId`. ONE per pick, never a loop. */
  const attemptedRef = useRef<Set<string>>(new Set());
  const surfacingRef = useRef(false);
  const dwellRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const clearDwell = useCallback(() => {
    if (dwellRef.current) {
      clearTimeout(dwellRef.current);
      dwellRef.current = null;
    }
  }, []);

  // Never let a dwell timer fire against a card that is gone.
  useEffect(() => clearDwell, [clearDwell]);

  /** Apply a completed read. Called only from a promise callback — never in an effect body. */
  const applyRead = useCallback(
    (at: Date, next: { picks: PickRow[]; bands: TodayBandReading[] } | null) => {
      if (next) {
        setPicks(next.picks);
        setBands(next.bands);
      }
      setNowMs(at.getTime());
      setLoaded(true);
    },
    [],
  );

  /** Re-read today, after a write. Used by the action handlers, never by an effect body. */
  const reload = useCallback(async () => {
    const at = new Date(d.now());
    applyRead(at, await readToday(userId, d, at));
  }, [userId, d, applyRead]);

  // The first read. Written as `read().then(apply)` rather than `void reload()` on purpose:
  // `react-hooks/set-state-in-effect` reads through a `useCallback` and (correctly) treats a
  // helper that sets state as setting state in the effect body. The state lands in the
  // promise callback, which is exactly what the rule is asking for — the same idiom
  // `todays-checkin-card.tsx` already uses for its recap read.
  useEffect(() => {
    const at = new Date(d.now());
    let alive = true;
    void readToday(userId, d, at).then((next) => {
      if (alive) applyRead(at, next);
    });
    return () => {
      alive = false;
    };
  }, [userId, d, applyRead]);

  // ── Derivation ─────────────────────────────────────────────────────────────────────
  const localDay = toLocalDayString(new Date(nowMs));
  const todayBands: BandReading[] = useMemo(
    () => bands.map((reading) => ({ band: reading.band, atMs: reading.atMs })),
    [bands],
  );

  const model: CardModel = deriveCardModel({
    localDay,
    nowMs,
    picks,
    bands: todayBands,
    ui,
    library: d.library,
    preferences: d.preferences,
    newEpisodeId,
  });

  /**
   * Persist a pick the engine has chosen but the database has not seen yet.
   *
   * ONE ATTEMPT PER PICK, enforced by `attemptedRef`. A failed INSERT is not retried: the
   * engine is deterministic, so re-running it against unchanged inputs would produce the
   * same row and the same failure — a loop with no error surface, which is worse than
   * silence. A genuinely different pick gets its own single attempt.
   */
  const surfacePending = useCallback(
    async (
      pending: { item: LibraryItem; episodeId: string; source: "reading" | "confirmed"; startsNewEpisode: boolean },
      day: string,
    ) => {
      if (!userId) return;
      const key = `${pending.episodeId}|${pending.item.id}`;
      if (attemptedRef.current.has(key) || surfacingRef.current) return;
      attemptedRef.current.add(key);
      surfacingRef.current = true;
      try {
        const result = await d.surfacePick({
          userId,
          localDay: day,
          episodeId: pending.episodeId,
          itemId: pending.item.id,
          source: pending.source,
        });
        // The minted id has been spent; mint the next one so a later episode is not
        // attributed to the same uuid.
        if (result.ok && pending.startsNewEpisode) setNewEpisodeId(d.newId());
      } catch {
        // Silence is the contract (FR-030).
      } finally {
        surfacingRef.current = false;
        await reload();
      }
    },
    [userId, d, reload],
  );

  // State 3's pick is surfaced automatically — the card offering something IS the event.
  // State 8's replacement is NOT: it waits for the person to ask for it.
  //
  // The write is scheduled onto a microtask rather than started in the effect body, for the
  // same reason the first read is: the effect's job is to notice that a pick is pending, not
  // to set state. `attemptedRef` inside `surfacePending` keeps this to ONE attempt per pick
  // however many times the effect re-runs.
  const pendingForSurface = model.state === 3 ? model.pendingPick : null;
  useEffect(() => {
    if (!loaded || !pendingForSurface) return;
    void Promise.resolve().then(() => surfacePending(pendingForSurface, localDay));
  }, [loaded, pendingForSurface, localDay, surfacePending]);

  // ── Actions ────────────────────────────────────────────────────────────────────────

  const nowIso = () => new Date(d.now()).toISOString();

  /** Opening the instructions IS the engagement record (FR-015), and it is written once. */
  async function toggleInstructions() {
    if (ui.instructionsOpen) {
      setUi((u) => ({ ...u, instructionsOpen: false, instructionsClosedAfterOpening: true }));
      return;
    }
    setUi((u) => ({ ...u, instructionsOpen: true }));
    const pick = model.activePick;
    if (!pick) return;
    const result = await d.recordOpened({ id: pick.id, openedAtMs: pick.openedAtMs }, nowIso());
    if (result.wrote) await reload();
  }

  async function answerOutcome(outcome: PickOutcome) {
    const pick = model.activePick;
    if (!pick) return;

    // D-6 / FR-029: the end-state paints in its OWN commit, before the write is awaited.
    // Resolving synchronously with the surface swap drops the acknowledgement entirely.
    setUi((u) => ({
      ...u,
      acknowledgement: outcome,
      instructionsOpen: false,
      // Asked once (FR-016). Set here too so a FAILED write degrades to the previous state
      // instead of re-asking the question the person already answered.
      outcomePromptIgnored: true,
    }));

    // State 8 offering a replacement is the one end-state that must WAIT for the person:
    // settling it on a timer would take the replacement action away mid-read. Every other
    // end-state — helped, and the state-8 no-replacement variant — dwells, then settles to
    // state 9 (FR-001 states 7/8/9).
    const offersReplacement = outcome === "didnt_help" && model.replacementAvailable;
    if (!offersReplacement) {
      clearDwell();
      dwellRef.current = setTimeout(() => {
        dwellRef.current = null;
        setUi((u) => ({
          ...u,
          acknowledgement: null,
          instructionsClosedAfterOpening: false,
          outcomePromptIgnored: false,
        }));
      }, d.dwellMs);
    }

    await d.recordOutcome(pick.id, outcome, nowIso());
    await reload();
  }

  /** State 8's replacement — the SAME shared three-pick budget, never a second allowance. */
  async function takeReplacement() {
    const pending = model.pendingPick;
    if (!pending) return;
    clearDwell();
    setUi(IDLE_CARD_UI);
    await surfacePending(pending, localDay);
  }

  /**
   * What the engine would offer once the pick on screen has been declined. Asked with the
   * active item marked swapped-away, which is exactly the history the database will hold a
   * moment later — so the optimistic choice and the re-derived one agree.
   */
  function nextAfterSwap(): SelectedPick | null {
    const pick = model.activePick;
    if (!pick) return null;
    const history = model.todayPicks
      .map(toHistoryEntry)
      .map((entry) => (entry.itemId === pick.itemId ? { ...entry, swappedAway: true } : entry));
    return selectPick({
      dayBands: todayBands.filter((r) => toLocalDayString(new Date(r.atMs)) === localDay),
      nowMs,
      todayHistory: history,
      episode: model.episode,
      preferences: d.preferences,
      library: d.library,
    });
  }

  /**
   * The swap — state 10, and the whole of US4's write path (T028).
   *
   * ── Ordering is RULED and forced by the schema (Ruling B) ───────────────────────────
   * `swapped_away_at` is stamped on the outgoing row FIRST, then the replacement is
   * inserted. Insert-first would collide with the still-active outgoing row under
   * `rp_one_active_per_user_day`, since the two writes are separate PostgREST requests with
   * no transaction. The stamp is NEVER reversed — a swap-away that was recorded stays
   * recorded, because the preference signal is real regardless of what became of the
   * replacement (contract points 1 and 4).
   *
   * ── Exactly one re-run, then stop (contract points 2 and 3) ─────────────────────────
   * `onReplacementInsertFailed` is the engine's ONE permitted re-run, and it is armed as a
   * callback rather than inferred from the result so that it fires at exactly the moment the
   * contract names — the replacement INSERT failing — and at no other. Its pick gets ONE
   * write attempt, through the same `attemptedRef` gate every other surfacing goes through,
   * which is what stops the auto-surface effect from picking the thread back up on the next
   * render. Two attempts total, then silence: no retry loop, and nothing renders as an error
   * (FR-030). A swap has no ceremony, so the re-run path is indistinguishable on screen from
   * a swap that landed first time — which is the point.
   *
   * ── A failed swap costs NO budget slot (Amendment 2026-08-16) ───────────────────────
   * That is structural, not enforced here: the reducer derives `picksUsed` from the
   * episode's SURFACED ROWS, so a stamped row with no successor charges its own slot and
   * nothing more. The person keeps the suggestion a write on our side lost. The stamped item
   * still enters the day's non-repeat exclusions — it was genuinely declined.
   */
  async function swap() {
    const pick = model.activePick;
    if (!pick || !userId || !model.swapAvailable || ui.swapInFlight) return;
    const next = nextAfterSwap();
    // Belt to `swapAvailable`'s braces: with nothing eligible left the action has already
    // retired to `SWAP_RETIRED_LINE`, and no branch here may repeat an item instead.
    if (!next) return;

    setUi((u) => ({ ...u, swapInFlight: true }));

    // Held in an object rather than two `let`s: the assignment happens inside a callback,
    // and TypeScript's narrowing does not follow a closure back to the enclosing binding.
    const rerun: { count: number; pick: SelectedPick | null } = { count: 0, pick: null };

    try {
      await d.swapPick(
        {
          outgoingPickId: pick.id,
          atIso: nowIso(),
          replacement: {
            userId,
            localDay,
            episodeId: next.episodeId,
            itemId: next.item.id,
            source: "reading",
          },
        },
        {
          onReplacementInsertFailed: () => {
            rerun.count += 1;
            // The engine, asked again with the declined pick marked away — exactly the
            // history the stamp has just written.
            rerun.pick = nextAfterSwap();
          },
        },
      );
    } catch {
      // Silence (FR-030).
    }

    if (rerun.pick) {
      await surfacePending(
        {
          item: rerun.pick.item,
          episodeId: rerun.pick.episodeId,
          source: "reading",
          // The replacement continues the episode it replaces within — a swap is never a
          // new stress event, so it never mints a new episode id (FR-018).
          startsNewEpisode: false,
        },
        localDay,
      );
    }

    // Reload BEFORE dropping the in-flight flag so the replacing item is the one that
    // carries the state-10 fade — the new item appears where the old one was, with no
    // acknowledgement and no ceremony.
    await reload();
    setUi({ ...IDLE_CARD_UI });
  }

  // ── Render ─────────────────────────────────────────────────────────────────────────

  const item = model.item;
  const prominent = model.state === 4;
  // Day-filtered with the SAME rule the reducer uses. The reads are already day-scoped, so
  // this is belt to their braces — but a count is the one fact the card states outright,
  // and "today" has to mean the same thing to the sentence as it does to the state.
  const facts = useMemo(() => {
    const day = toLocalDayString(new Date(nowMs));
    return reflectiveFacts(
      bands.filter((reading) => toLocalDayString(new Date(reading.atMs)) === day),
    );
  }, [bands, nowMs]);

  // States 2/9's reflective material, computed BEFORE any early return — the hook below
  // has to run on every render, in the same order, whatever state the card is in. Memoised
  // on primitives so a re-render with unchanged data does not hand the hook a new object
  // and tear down its in-flight timers.
  const triedPick = model.openedToday.at(-1) ?? null;
  const triedTitle = triedPick
    ? d.library.find((entry) => entry.id === triedPick.itemId)?.title
    : undefined;
  const triedAtLabel =
    triedPick?.openedAtMs != null ? clockLabel(triedPick.openedAtMs) : undefined;
  const reflectiveState = loaded && userId ? model.state : 0;
  const reflectiveInput = useMemo(
    () => reflectiveInputFor(reflectiveState, facts, { title: triedTitle, atLabel: triedAtLabel }),
    [reflectiveState, facts, triedTitle, triedAtLabel],
  );
  const reflective = useReflectiveLine(reflectiveInput, localDay, d);

  // Before the first read resolves the card wears state 1's SHAPE — the shell, the
  // neutral tile, one lead line — but claims nothing: the lead slot holds the same
  // skeleton the reflective line uses, and there is no forward line and no action. This
  // is not an eleventh state and not a spinner. It used to paint state 1 itself here
  // ("Nothing from today yet." + Start check-in), which is a definitive empty state
  // asserted before the data is known — the shape #201 ruled a bug on the Recent chats
  // card (2026-07-28) — and it offered a check-in to someone who may already have
  // readings. Live check 2026-08-26 (smoke-tests ST-5 attestation); Mohamed chose the
  // neutral shape. The skeleton drops its pulse under `prefers-reduced-motion`.
  if (!userId || !loaded) {
    return (
      <RecommendationCardShell state={1} description={CARD_DESC_NO_READING}>
        <RestingBlock tone="neutral" glyph="clock" lead="" leadPending />
      </RecommendationCardShell>
    );
  }

  // ── State 1 — no reading yet today. Names the cause; NO action of its own (the
  //    today's-check-in card above owns the only Start check-in — Mohamed 2026-08-26). ──
  if (model.state === 1) {
    return (
      <RecommendationCardShell state={1} description={CARD_DESC_NO_READING}>
        <RestingBlock tone="neutral" glyph="clock" lead={NO_READING_YET_LEAD} line={NO_READING_YET_LINE} />
      </RecommendationCardShell>
    );
  }

  // ── State 2 — calm. Specific and true first, then one forward line. No action. ──────
  //
  // `reflectiveInput` is non-null exactly when the builder produced a true specific line;
  // `reflective.text` is that line, a validated re-phrasing of it, or the skeleton's
  // stand-in — never anything else, and never a second paint (see `useReflectiveLine`).
  if (model.state === 2) {
    return (
      <RecommendationCardShell state={2} description={CARD_DESC_NOTHING_TO_SUGGEST}>
        {reflectiveInput ? (
          <RestingBlock
            tone="meadow"
            glyph="wave"
            lead={reflective.text}
            leadPending={reflective.pending}
            line={CALM_FORWARD_LINE}
          />
        ) : (
          // DEFENSIVELY UNREACHABLE today: `deriveCardModel` only reaches state 2 when the
          // day has at least one reading, and one reading is at least one check-in, so the
          // builder always has a specific to state. The branch stays because the rule it
          // encodes is FR-001's, not the reducer's — state 1's SHAPE, never a generic
          // affirmation. Nothing is generated here either: there is no fact to phrase, and
          // phrasing the forward line alone would invent the specificity the data lacked.
          <RestingBlock tone="neutral" glyph="clock" lead={CALM_FORWARD_LINE} />
        )}
      </RecommendationCardShell>
    );
  }

  // ── State 9 — at rest after an outcome. Does not push another pick, does not claim ──
  //    the day is over, and re-arms on its own when a qualifying reading arrives.
  if (model.state === 9) {
    return (
      <RecommendationCardShell state={9} description={CARD_DESC_NOTHING_TO_SUGGEST}>
        {reflectiveInput ? (
          <RestingBlock
            tone="meadow"
            glyph="check"
            lead={reflective.text}
            leadPending={reflective.pending}
            leadEmphasis={triedTitle}
            line={AT_REST_FORWARD_LINE}
          />
        ) : (
          // Nothing was opened today (or the title is gone) — the forward line stands
          // alone. It claims nothing about the day being over, and re-arms on its own.
          <RestingBlock tone="meadow" glyph="check" lead={AT_REST_FORWARD_LINE} />
        )}
      </RecommendationCardShell>
    );
  }

  // ── States 7 / 8 — the recorded end-states, with their dwell. ───────────────────────
  if ((model.state === 7 || model.state === 8) && ui.acknowledgement) {
    return (
      <RecommendationCardShell state={model.state} description={CARD_DESC_PICKED}>
        <OutcomeRecorded
          outcome={ui.acknowledgement}
          replacementAvailable={model.state === 8 && model.pendingPick !== null}
          onTakeReplacement={() => void takeReplacement()}
        />
      </RecommendationCardShell>
    );
  }

  // ── States 3 / 4 / 5 / 6 / 10 — there is a pick on screen. ──────────────────────────
  if (item) {
    const expanded = model.state === 5;
    const askingOutcome = model.state === 6;
    const body = (
      <>
        <PickItem
          item={item}
          prominent={prominent}
          expanded={expanded}
          // The pill reads "opened" once the item has been used — but not WHILE the steps
          // are on screen, where the duration is still the useful fact (mock panels 5/6).
          opened={model.activePick?.openedAtMs != null && !expanded}
        >
          {askingOutcome ? (
            <OutcomePrompt prominent={prominent} onAnswer={(outcome) => void answerOutcome(outcome)} />
          ) : (
            <>
              <ItemActions
                expanded={expanded}
                prominent={prominent}
                swapAvailable={model.swapAvailable}
                swapInFlight={ui.swapInFlight}
                onToggleInstructions={() => void toggleInstructions()}
                onSwap={() => void swap()}
              />
              {/* Nothing new is left to offer today — honest, and it pushes nothing. */}
              {!expanded && !model.swapAvailable && <SwapRetiredNote />}
            </>
          )}
        </PickItem>
        {/* Ren withdraws while the instructions are open and while the outcome question is
            on screen: mid-instruction, and mid-answer, are the wrong moments for an exit. */}
        {!expanded && !askingOutcome && <RenRow onClick={d.openRen} />}
      </>
    );

    return (
      <RecommendationCardShell
        state={model.state}
        description={prominent ? CARD_DESC_CONFIRMED : CARD_DESC_PICKED}
      >
        {model.state === 10 ? <SwapFade>{body}</SwapFade> : body}
      </RecommendationCardShell>
    );
  }

  // Total by construction: the reducer assigns one of the ten states to every input, and
  // the branches above cover all ten. This is the state-9 shape for the residual case the
  // reducer reaches with no item — never an error, never an eleventh state (SC-002/FR-030).
  return (
    <RecommendationCardShell state={model.state} description={CARD_DESC_NOTHING_TO_SUGGEST}>
      <RestingBlock tone="meadow" glyph="check" lead={AT_REST_FORWARD_LINE} />
    </RecommendationCardShell>
  );
}
