# Quickstart — Today-Card Stress Trend Redesign

Frontend-only change in `apps/web`. Consumes the existing read layer; no backend, migration, or env change.

## Prerequisites
- Repo deps installed (`npm install` at root / `apps/web`).
- A calibrated demo employee with **multiple monitoring sessions today** (so the recap has ≥1 retrospective session). Use the existing seed/demo flow; a busy-day fixture (≥11 sessions) is needed to exercise overflow.
- Visual reference open side-by-side: `serenify-008followups-trend-FINAL.html` (toggle light/dark in it).

## Run the app
```
# from apps/web
npm run dev
```
- Sign in as the demo employee → dashboard → the today check-in card.
- Toggle "View today ▾" / "Hide today ▴".
- Toggle OS/app light–dark; the amber-text legibility question lives in **light** mode (flip there to judge).

## Verify against the Success Criteria
- **SC-001** axis-not-legend: expanded view shows four left-axis labels (tense / a little tense / at ease / no read); no bottom legend.
- **SC-002** shapes-not-bars: sessions are thin horizontal step strokes; inspect the plot `<svg>` — its `width` attribute equals `nLanes × laneWidth` and the `viewBox` width matches (no stretch). Check at desktop **and** at a 360px viewport.
- **SC-003** collapsed-is-a-line: the mini-trend is a connected step-line, not floating dots; expanded plot region ≈200px tall (card not oversized).
- **SC-004** peak == chip: each session's lane peak colour matches its timeline chip tone.
- **SC-005** synced highlight: hover a lane → its row highlights; hover a row → its lane highlights; Tab to a plot session target → focus ring + its row highlights. Enable reduced motion → no transition animation.
- **SC-006** overflow: busy-day fixture → horizontal scroll, lanes keep min width (never crushed), right edge-fade present (left appears once scrolled).
- **SC-007** amber AA: run the contrast unit test (below); also eyeball light + dark.
- **SC-008** no probability: inspect the DOM / network — no stress-probability value anywhere; only clock-time digits.

## Tests
```
# from apps/web
npm run test            # Vitest: trend-geometry units, amber-aa contrast, today-view RTL
npm run test:e2e        # Playwright employee happy-path (expand/collapse, no-legend)
npm run lint && npm run typecheck
```
- `tests/unit/lib/trend-geometry.test.ts` — run-collapse, fixed-px width, band→Y, warm-up/lost-read segmenting, peak==tenor.
- `tests/unit/lib/amber-aa.test.ts` — asserts each amber **text** token ≥ its WCAG threshold on its background, **both themes** (SC-007).
- `tests/unit/components/home/today-view.test.tsx` — the render invariants in `contracts/today-trend-ui.md`.

## Smoke tests (manual, authored at implement time)
`smoke-tests.md` (Constitution VII / gate 5) will list human checks: light/dark amber legibility, 360px no-crush + scroll/fade, keyboard focus ring, reduced-motion, a real multi-session day, warm-up/lost-read/no-read honesty. Mohamed runs and records results before merge.

## Before implementing — resolve the two forks (research R-2, R-3)
1. **Headline honesty (R-2):** confirm whether `deriveHeadline` gets the scoped copy change (recommended) or FR-002 is relaxed.
2. **Amber light text (R-3):** confirm `#8A580F` (mock; needs MINOR amendment) vs `#7E5310` (constitution; no amendment). Either way, log the amber sub-tokens in `docs/DECISIONS.md`.
