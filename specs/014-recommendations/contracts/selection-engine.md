# Contract — deterministic selection engine

**Module**: `apps/web/lib/recommendations/engine.ts` — pure, no clock, no randomness, no
model (FR-002). SC-001: identical inputs → identical pick, 100% of runs.

## Signature

```ts
selectPick(input: {
  dayBands: { band: Band; atMs: number }[];   // today's readings summary (from the
                                              // existing owner-RLS monitoring reads)
  nowMs: number;                              // injected — never Date.now() inside
  todayHistory: PickHistoryEntry[];           // today's pick rows: item_id, category,
                                              // opened/swapped/outcome flags
  episode: { id: string; picksUsed: number } | null;  // current open episode, if any
                                              // (picksUsed = SURFACED rows in the
                                              // episode — Amendment 2026-08-16: a
                                              // stamp with no successor row charges
                                              // nothing)
  newEpisodeId?: string;                      // injected like nowMs (amended 2026-08-16:
                                              // a pure function cannot mint a uuid);
                                              // used only when episode is null AND a
                                              // new episode is warranted — absent, the
                                              // engine returns null rather than emit an
                                              // unattributable pick
  preferences: PreferenceSource;              // neutral in v1 (R-8)
  library: readonly LibraryItem[];            // the reviewed in-repo library
}): { item: LibraryItem; episodeId: string } | null   // null = no pick warranted/available
```

## Rules (evaluated in order)

1. **Warrant**: a pick exists only when today's readings include Uneasy or Tense
   (`a_little_tense` / `tense`). Otherwise `null` (states 1/2 render instead).
2. **Budget**: if the open episode has `picksUsed >= 3`, `null` for further picks — the
   swap action retires with the honest line (FR-018); state 8 renders its no-replacement
   variant.
3. **Non-repeat**: items opened or swapped away today are excluded, all day, regardless
   of budget; if exclusions leave nothing eligible, `null` (non-repeat wins, swap retires
   early — FR-018).
4. **Category ranking** (FR-005 — selection is expressible over categories): fixed rule
   table over band tenor (peak band today) and time-of-day segment, weighted by
   `preferences.categoryAffinity`, ties broken by declared category order. The rule table
   is data, reviewable in the module.
5. **Item within category**: first eligible item in declared order; category exhausted →
   next ranked category.

## Boundaries

- The engine returns only members of the passed library — no path to crisis content or
  any generated item exists (FR-007; SC-008 gates library content separately).
- Episode lifecycle (start on first warranted pick, end on outcome/day boundary, state-9
  re-arm = new episode) is the caller-side reducer's job; the engine only consumes
  `episode.picksUsed`.
- Band display names never enter the engine — internal enum only.

## Tests (Vitest)

- Determinism property: repeated calls with frozen inputs, table-driven across all ten
  card states' input shapes (SC-001, SC-002 reachability).
- Budget/non-repeat interaction: budget exhausts at 3; non-repeat retires the swap early
  when it bites first; state-8 replacement draws from the same budget.
- Preference-seam: a non-neutral fake source changes ranking without any engine edit
  (FR-006 proof).
