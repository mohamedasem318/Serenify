# Contract — the hero story card

**Feature**: 013-public-surface-and-legal | **Plan**: [../plan.md](../plan.md) §9.1 | **Approved copy**: [../plan.md](../plan.md) §10.3 | **Proof**: [../research.md](../research.md) §12.2

The landing page's largest and least predictable component: 17 beats, 6 chapters, 4 absolutely positioned panels, and an outer box that must not move by a single pixel. Its invariants are asserted, not assumed — the zero-drift and no-wrap proofs are in `research.md` §12.2.

**The three approved strings this card renders (hero lede, the replacement "Never" card, the closing story beat) are fixed verbatim in `plan.md` §10.3 and are not restated here.**

## §9.1 Hero story card (FR-006–FR-015)

**Structure.** Three regions inside one card whose outer box never changes:

```
┌─ card (fixed outer box; overflow-hidden; no scrollbar, ever) ────────┐
│  READOUT      — always present: <Bloom>, reading label, trend        │
│  NARRATION    — FIXED height (not min-height); content swaps inside  │
│  SWAP AREA    — position:relative + explicit height                  │
│     4 panels, each position:absolute; inset:0                        │
│     exactly one visible (data-active + aria-hidden on the rest)      │
└──────────────────────────────────────────────────────────────────────┘
```

The absolute positioning **is** the anti-clipping mechanism and is not substituted with flow layout: an absolutely positioned panel is out of flow, so it cannot push the card's box no matter how tall its content is; the swap area's explicit height (the tallest panel's, measured once per breakpoint) fixes the box. `overflow-hidden` on the card and on the swap area guarantees no internal scrollbar at any width.

**The script is data, not control flow.** `apps/web/lib/landing/story-script.ts` exports the 17 beats as a frozen array — `{ chapter, durationMs, panel, band, narrationKey, threadOp }` — plus pure helpers `chaptersOf()`, `firstBeatIndexOfChapter()`, `trimThread(messages, 4)`. Everything honesty-critical is then unit-testable without a DOM. Transcribed structure (verified against the mock, `:754–773`):

| Chapter | Beats | Panel(s) | Content |
|---|---|---|---|
| 0 | 1–2 | quiet | a normal morning → signals climb |
| 1 | 3–4 | prompt | the system stops and asks → the person declines |
| 2 | 5 | resolved | **the false alarm is resolved, at no cost** |
| 3 | 6–8 | quiet → prompt | a different day → tense → this time they want to talk |
| 4 | 9–13 | ren | the companion conversation |
| 5 | 14–17 | ren → quiet | later that afternoon → back to at ease → closing line |

**17 beats, 6 chapters, 42.1 s total, 4 panels, false-alarm-first.** The false-alarm beat resolves in chapter 2; the first companion beat is in chapter 4. The ordering is the page's thesis and is not reorderable — asserted as an invariant, not a convention (§12).

**Thread cap.** `trimThread` keeps the 4 most recent bubbles; the oldest leaves when the cap is reached. Because the thread lives inside an absolutely positioned panel with a fixed swap-area height, the card cannot resize when it trims.

**Navigation.** Chapter markers only — a per-beat progress bar was explicitly rejected (Non-Goals). Six `<button>` elements in a `<nav aria-label="Story chapters">`, each with an accessible name naming its chapter, `aria-current="true"` on the active one, and the app's visible focus ring. Pointer and keyboard both activate (a `<button>` gives Enter and Space for free), and each is ≥44×44 px on touch viewports.

**Pause off-screen (FR-012), with the repo's known gotcha handled.** `IntersectionObserver` delivers an initial **synchronous** entry on `observe()` reflecting current visibility. The implementation holds a `hasDeliveredFirstEntry` ref and discards that first callback, so only real scroll transitions drive pause/resume. It **fails safe**: if the observed element is missing, or its measured height is 0 (a collapsed or not-yet-laid-out box), the story is treated as **visible** and keeps playing — a story frozen forever because a ref was null is worse than one that runs off-screen.

**Reduced motion (FR-013).** `useMediaQuery("(prefers-reduced-motion: reduce)")` — the **repo hook**, built on `useSyncExternalStore`, which re-subscribes to the media query. framer-motion's `useReducedMotion` snapshots at mount and does not re-subscribe; it is forbidden here and its absence is asserted by a lint-style unit check. Under reduced motion: no timer is armed, no transition class is applied, a static representative beat renders **with the readout visible**, and the chapter markers remain fully functional so a visitor can step through deliberately. No information exists only in motion.

**Reading labels (FR-015).** New module `apps/web/lib/bands.ts` becomes the **one** definition:

```ts
export const BAND_LABEL: Record<Band, string> = {
  tense: "Tense",
  a_little_tense: "A little tense",
  at_ease: "At ease",
};
```

`lib/session-trend-geometry.ts:324–326` currently inlines these three literals inside `axisFor()`; it is refactored to import `BAND_LABEL`. The landing readout imports the same export. Two consumers, one literal set — which is precisely "sourced from the app's existing band definitions rather than restated as new literals". The refactor is mechanical with zero behaviour change and is covered by the existing `session-trend-geometry` unit suite.

**Orb (FR-021, FR-022).** `components/monitor/bloom.tsx` — feature **008**'s component, reused, not reimplemented. It already suppresses breathing under reduced motion while still updating colour, carries no number, and is `aria-hidden` decorative.

One **optional, additive** prop is added: `color?: string`. When provided it replaces `TONE_COLOR[tone]` as the `--bloom` custom property; when omitted (every existing call site) behaviour is byte-identical. This is needed because Bloom sets `--bloom` as an **inline style on its own element**, which an ancestor cannot override. The landing page passes `var(--color-foggy)` for Ren's blue state during chapters 4–5 — which is exactly what the mock does (`.stage[data-mood="talk"]` uses `var(--foggy)` at `:130, :164, :179, :191`), so this is the real Graphite token, not a ported mock hex (FR-057). **FR-022 governs: this divergence from the live monitor's band colouring is deliberate, approved, and must not be "corrected".** Flagged for Mohamed's eye in ST-4 because foggy's semantic role in Principle V is attention.

**Zero-drift proof** is the layout Playwright spec at §12.
