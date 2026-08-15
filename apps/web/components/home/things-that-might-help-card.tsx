"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import {
  ItemActions,
  OutcomePrompt,
  OutcomeRecorded,
  RecommendationCardShell,
  RenRow,
  RestingBlock,
  StartCheckinAction,
  SwapFade,
  SwapRetiredNote,
} from "@/components/recommendations/recommendation-card-states";
import { PickItem } from "@/components/recommendations/pick-item";
import {
  recordOpened as defaultRecordOpened,
  recordOutcome as defaultRecordOutcome,
  surfacePick as defaultSurfacePick,
  swapPick as defaultSwapPick,
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
  buildAtRestFallbackText,
  buildCalmFallbackText,
  type LibraryItem,
} from "@/lib/recommendations/library";
import { neutralPreferenceSource, type PreferenceSource } from "@/lib/recommendations/preference-source";
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
}

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
   * The swap (state 10). Ordering is RULED and forced by the schema: `swapped_away_at` is
   * stamped on the outgoing row FIRST, then the replacement is inserted — insert-first would
   * collide with the still-active outgoing row under `rp_one_active_per_user_day`, since the
   * two writes are separate PostgREST requests with no transaction. The stamp is never
   * reversed, and a failed swap costs no budget slot: consumption counts replacement rows
   * that actually landed (Amendment 2026-08-16).
   *
   * If the replacement INSERT fails, the reload below re-derives the card — the engine's ONE
   * permitted re-run — and the auto-surface effect makes exactly one further attempt before
   * `attemptedRef` stops it for good. No retry loop, and nothing renders as an error.
   *
   * Full US4 behaviour (including the retirement line's edge cases) is T028's; this is the
   * minimum the mock's states 3/4/10 need to exist at all.
   */
  async function swap() {
    const pick = model.activePick;
    if (!pick || !userId || !model.swapAvailable || ui.swapInFlight) return;
    const next = nextAfterSwap();
    if (!next) return;

    setUi((u) => ({ ...u, swapInFlight: true }));
    try {
      await d.swapPick({
        outgoingPickId: pick.id,
        atIso: nowIso(),
        replacement: {
          userId,
          localDay,
          episodeId: next.episodeId,
          itemId: next.item.id,
          source: "reading",
        },
      });
    } catch {
      // Silence (FR-030).
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
  const facts = reflectiveFacts(bands);

  // Before the first read resolves the card rests in state 1's shape. That is not an
  // eleventh state and not a spinner: "nothing from today yet" is exactly what is known.
  if (!userId || !loaded) {
    return (
      <RecommendationCardShell state={1} description={CARD_DESC_NO_READING}>
        <RestingBlock tone="neutral" glyph="clock" lead={NO_READING_YET_LEAD} line={NO_READING_YET_LINE}>
          <StartCheckinAction />
        </RestingBlock>
      </RecommendationCardShell>
    );
  }

  // ── State 1 — no reading yet today. Names the cause, offers a check-in. ─────────────
  if (model.state === 1) {
    return (
      <RecommendationCardShell state={1} description={CARD_DESC_NO_READING}>
        <RestingBlock tone="neutral" glyph="clock" lead={NO_READING_YET_LEAD} line={NO_READING_YET_LINE}>
          <StartCheckinAction />
        </RestingBlock>
      </RecommendationCardShell>
    );
  }

  // ── State 2 — calm. Specific and true first, then one forward line. No action. ──────
  if (model.state === 2) {
    const calm = splitReflective(buildCalmFallbackText(facts), CALM_FORWARD_LINE);
    return (
      <RecommendationCardShell state={2} description={CARD_DESC_NOTHING_TO_SUGGEST}>
        {calm.lead ? (
          <RestingBlock tone="meadow" glyph="wave" lead={calm.lead} line={calm.line} />
        ) : (
          // No true specific line is derivable — state 1's SHAPE, never a generic
          // affirmation (FR-001 state 2).
          <RestingBlock tone="neutral" glyph="clock" lead={CALM_FORWARD_LINE} />
        )}
      </RecommendationCardShell>
    );
  }

  // ── State 9 — at rest after an outcome. Does not push another pick, does not claim ──
  //    the day is over, and re-arms on its own when a qualifying reading arrives.
  if (model.state === 9) {
    const tried = model.openedToday.at(-1) ?? null;
    const triedItem = tried ? d.library.find((entry) => entry.id === tried.itemId) : undefined;
    const atRest = splitReflective(
      buildAtRestFallbackText({
        ...facts,
        triedItemTitle: triedItem?.title,
        triedAtLabel: tried?.openedAtMs != null ? clockLabel(tried.openedAtMs) : undefined,
      }),
      AT_REST_FORWARD_LINE,
    );
    return (
      <RecommendationCardShell state={9} description={CARD_DESC_NOTHING_TO_SUGGEST}>
        {atRest.lead ? (
          <RestingBlock tone="meadow" glyph="check" lead={atRest.lead} line={atRest.line} />
        ) : (
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
