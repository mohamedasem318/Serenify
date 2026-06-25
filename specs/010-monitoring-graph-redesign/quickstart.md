# Quickstart — Live "This session" monitoring-graph redesign (009b)

Frontend-only redesign of one component (`apps/web/components/monitor/session-trend.tsx`) + one new pure module (`apps/web/lib/session-trend-geometry.ts`). No backend, DB, env, or token changes.

## Prerequisites
- Repo bootstrapped; `apps/web` deps installed.
- Visual target: `serenify-live-session-graph-mock.html` (repo root) — open in a browser, toggle Light/Dark.

## Build sequence (matches `/speckit-tasks` order)
1. **Pure geometry/derivation** — `lib/session-trend-geometry.ts`: rolling-window trim, uniform-slot layout (right-anchored), band→Y step-line, no-read treatment derivation (warming/foggy/no-clear-read + leading fade-in-only), now-marker state (live/parked/none), subtitle state. Constants from research R-1.
2. **Geometry unit tests** — `tests/unit/lib/session-trend-geometry.test.ts`: map SC-001…SC-013 (research R-9). TDD: write alongside step 1.
3. **Component** — replace `session-trend.tsx` internals: read container width (`ResizeObserver`/ref), render fixed-px SVG (step-line, treatments, now-marker, gridlines/axis labels), honest subtitle, gated legend, reduced-motion via the repo hook. Add `showOutOfFrameFoggy` prop (default false).
4. **Component tests** — rewrite `tests/unit/components/monitor/session-trend.test.tsx` to the new surface + the contract invariants.
5. **E2E** — extend the existing monitor/employee Playwright happy-path: a no-read treatment renders; zero numbers in the graph.
6. **Smoke tests** — author `smoke-tests.md` (light/dark by eye, 360px no-crush, keyboard focus + popup, reduced-motion, a live warm→read→out-of-frame→return session).

## Verify
```bash
cd apps/web
npm run lint
npx tsc --noEmit
npx vitest run --pool=threads tests/unit/lib/session-trend-geometry.test.ts tests/unit/components/monitor/session-trend.test.tsx
```
> Windows note: run Vitest with `--pool=threads` (the default forks pool crashes at startup on this machine with `kill EPERM` — see project memory).

Then run the app and open the monitor page mid-session; confirm against the mock:
- true circles at any width (resize the window); the graph matches the camera card width.
- band colour + height track the readings; the now-marker recolours and pulses.
- step out of frame → at launch a muted "no clear read" gap (NOT "step back into frame"); now-marker parks muted/static "last clear read".
- warming start → dashed "getting a read" line, no now-marker.
- reduced-motion (OS setting) → no pulse, no motion anywhere.

## Gotchas
- **Totem/oval bug:** never a small fixed viewBox stretched to width:100%. width MUST equal the viewBox width (DC-001).
- **No new token / no page change:** all tokens exist; the camera card and trend already share the `max-w-3xl` column.
- **Foggy is gated OFF at launch** (`showOutOfFrameFoggy=false`): out-of-frame → muted; foggy legend key hidden. One-line flip when issue #100 confirms reliability.
- **FR-024 neutral-subtitle wording is signed off**: the active-no-read / all-skipped neutral line = **"No clear read right now"** (research R-7).
