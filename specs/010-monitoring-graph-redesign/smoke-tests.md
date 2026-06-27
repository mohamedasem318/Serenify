# Smoke Tests: Live "This session" monitoring-graph redesign (009b)

**Feature**: `010-monitoring-graph-redesign` | **Spec**: [spec.md](./spec.md) | **Plan**: [plan.md](./plan.md)

Human-validated checks per Constitution Principle VII (gate 5). **Mohamed** runs these by hand in a
real browser after `/speckit-implement` and records each result inline (`PASS` / `FAIL` + note + date).
The redesign is "done" only when every check below passes. These are the checks the automated suites
**cannot** make: the real-browser **totem/oval** stretch (jsdom asserts only SVG attributes, no layout),
band legibility by eye in both themes, the now-marker recolouring **in lockstep** with the live bloom/orb
(a timing/perceptual thing), keyboard + reduced-motion behaviour, and the honest no-read journey end to end.

**Setup**: run `apps/web` via `npm run dev` (desktop localhost is a secure context, so the camera works).
Sign in as a **whitelisted employee**, open the monitor page via a **full-nav** `<a>` (never a soft `<Link>` —
a soft-nav keeps the prior route's `camera=()` Permissions-Policy and blocks capture), and **start a live
capture session** so the "This session" card below the camera stage builds a real trend (the capture →
inference loop must be running — `apps/api` up — so windows produce real bands / skips). To drive the
no-read states by hand: **step out of frame** (out-of-frame skip → at launch the muted "no clear read"
gap, FR-015) and **cover the lens / dim the light** (no-clear-read skip). Toggle light/dark with the
in-app ThemeToggle. Visual source of truth: `serenify-live-session-graph-mock.html` (open from the working
tree — untracked). The foggy "stepped out of frame" treatment is **gated OFF at launch**
(`showOutOfFrameFoggy=false`); its gate-ON behaviour is exercised by the injectable prop + unit tests, not
by a launch smoke.

**Sign-off**: Mohamed Asem  **Date**: ____________  **Overall**: ☐ PASS ☐ FAIL

---

## ST-1 — Band colour + height read cleanly in both themes (SC-003, FR-003/FR-016/FR-023)

Build a session that reaches all three bands. Flip **light** then **dark** and judge the trend by eye against
the mock — no number is shown, so colour + height must carry the band on their own.

- ☐ **At ease** segments are `--color-meadow`; **a little tense** segments are `--amber-soft-line`
  (`#D49A4A` light / `#E8BC7A` dark — the 009 mid-band token, FR-023, a deliberate ~hue delta from the
  mock placeholder); **tense** segments are `--color-amber`.
- ☐ **Height tracks tension** — tenser sits **higher**; a glance places the current reading in the right
  band without reading any label.
- ☐ **amber is stress-only** — amber appears only on the band line/markers, never on a no-read treatment;
  **no crimson/red anywhere** in the graph, in any state (FR-016).
- ☐ Both themes read cleanly (light is the harder judge for the soft-amber mid line).

**Pass when**: all four hold in both themes. Result: _pending_

---

## ST-2 — Fixed-px true circles, no totem/oval stretch; matched pair (SC-001, SC-002, FR-001/FR-002)

The whole redesign exists to kill the stretched-viewBox oval. Unit tests assert `width == viewBox` at the
**SVG-attribute** level only (jsdom has no layout); a browser can still **visually stretch via CSS**, which
the unit suite cannot catch — so this eyeball is mandatory. Check at **360px** (the floor) and **~768px**.

- ☐ The now-marker and every point are **true circles** (1:1, no ovaling) at **both** widths.
- ☐ The graph **fills its container width** and reads as a **matched pair** with the camera stage directly
  above it (both share the `max-w-3xl` column — left/right edges align at every width).
- ☐ There is **no small fixed viewBox stretched to `width:100%`** — the SVG width equals the viewBox width
  (DC-001). The plot does not totem/squash as the window resizes.
- ☐ Axis gutter + right margin **shrink responsively** toward the 360px floor so the no-read gap labels stay
  legible; the left labels ("Tense / A little tense / At ease") are retained (min gutter still fits
  "A little tense").

**Pass when**: true circles + matched-pair width + no stretch at both widths. Result: _pending_

---

## ST-3 — Ramp-up fills the width (no blank-left), then scrolls off (SC-012a, SC-012, FR-002a)

Watch a **fresh** session from the first confident readings through past **N_target = 12** windows (~2 min at
the ~10s window stride). This is a live, time-evolving behaviour no static test exercises.

- ☐ **Ramp-up** (count < 12): the few windows **fill the full plot width** — earliest at the left edge,
  latest at the right — with the **now-marker pinned at the right edge**. There is **no blank-left "cut off"**
  band for the first ~2 min.
- ☐ Existing points **gently re-space (compress)** as each new window arrives (by-design); the now-marker
  stays **dead-still** at the right edge while the background re-spaces.
- ☐ At **N_target** the pitch **locks** with **no visual jump** (the fill pitch is continuous with the locked
  pitch); thereafter the oldest windows **scroll off the left**, slot width held constant (no progressive
  compression as the session grows).
- ☐ A no-read **gap's width = its count of consecutive no-read windows** (an honest elapsed-time proxy) in
  both the ramp-up and the steady-state regime.

**Pass when**: fills width during ramp-up, continuous lock, then scroll-off with uniform slots. Result: _pending_

---

## ST-4 — Now-marker reachable by keyboard; popup on focus/hover/tap (SC-005, FR-007/FR-008)

With a live confident now-marker on screen, use **Tab** and the keyboard only, then re-check with mouse + touch.

- ☐ **Tab lands on the now-marker** (it is focusable) and shows a **visible focus ring**; the **"you are here"**
  popup appears **on focus** (not hover-only).
- ☐ The popup also appears **on hover** (hides on mouse-out) and **on tap**.
- ☐ **Tap toggles** — a tap on the marker opens it, a **second tap on the marker closes** it, and a tap
  **outside** the marker dismisses it (pure `:focus-within` would not give this — pinned state is tracked).
- ☐ On a **touch** viewport the marker's **hit-area is ≥44×44px** (an intended divergence from the mock's
  r=15 hit-circle, Principle VI) — easy to tap without zooming.

**Pass when**: focusable with a ring, popup on focus/hover/tap, tap toggles + outside-dismiss, ≥44px touch.
Result: _pending_

---

## ST-5 — Reduced motion honoured (SC-006, FR-006/FR-013)

Enable `prefers-reduced-motion` (the Windows OS setting — the real one), both themes.

- ☐ The now-marker's gentle **pulse becomes a static halo** — no animation.
- ☐ The no-read **fades show no motion** — they are a **static opacity ramp** (~0.25 dimmed segments flanking
  the gap, per the mock's `.fade`), not a temporal animation, so they look the same reduced-motion or not.
- ☐ **No motion anywhere** in the graph in any state; function is preserved (marker still anchors, gaps still
  read as gaps, subtitle still tracks).
- ☐ Toggle the OS flag **while the tab is open** and confirm it updates live (the repo media-query hook
  re-subscribes).

**Pass when**: pulse → static halo, fades stay static, zero motion, live toggle. Result: _pending_

---

## ST-6 — Now-marker freshness: recolours in lockstep with the bloom (FR-004 freshness / T011a, SC-011)

The marker must reflect each **new reading** as promptly as the live **bloom/orb** on the camera stage above —
refreshing on the persisted window outcome, **not** waiting on the ~12s background poll. Watch a **band
transition** (e.g. at-ease → tense, or any recolour) and compare the orb and the marker.

- ☐ When a new reading lands and the **camera-stage bloom/orb recolours**, the now-marker **recolours to the
  same band within the same window** — it does **not** trail ~a poll (~2s+) behind the orb.
- ☐ The marker never shows a **stale colour** after the orb has already moved on (no marker-vs-orb mismatch).
- ☐ Because the marker is sourced from the **persisted row** (committed before the window POST returns), the
  marker and the **step-line edge agree** — no optimistic value that disagrees with the drawn line.

**Pass when**: marker recolours within one window of the bloom, never trailing, never mismatched. Result: _pending_

---

## ST-7 — The honest live journey: warm → read → out-of-frame → return (SC-004/008/009/010/011/013)

Drive one continuous session through every honesty state and confirm each treatment is distinct and honest.
This is the integration check the unit suites prove in pieces but never end to end in a real browser.

- ☐ **Warming** (session start, no confident band yet): **≥2** warming windows draw a **dashed muted line**
  ("getting a read") — a *line*, not a gap, muted (not amber); there is **no now-marker**; the subtitle is the
  non-asserting "getting a read" (never a tension word). *(Exactly **1** warming window shows the just-started
  text "Your trend builds as readings come in." — no stub, FR-018.)*
- ☐ **Confident reading**: the band-coloured step-line appears, the now-marker sits at the latest reading,
  recolours to its band, pulses, popup **"you are here"**; the subtitle is the session summary. A **single**
  confident reading renders a **dot, not a line** (FR-019).
- ☐ **Step out of frame** (launch, gate OFF): the trend **fades out → gap → fades back in**, the gap carries
  the **muted "no clear read"** label — **never** "step back into frame" (SC-008/FR-015); the gap is **never
  bridged** by a flat carried-forward line (SC-009).
- ☐ **Parked marker** during the no-read: the now-marker **stays at the last confident reading**, renders
  **muted + static** (no pulse, no halo, same radius), popup **"last clear read"**; the subtitle switches to
  the neutral **"No clear read right now"** (no tension claim held over).
- ☐ **Return**: on the next confident reading the marker **resumes full band colour + pulse + "you are here"**
  and the subtitle resumes the session summary.
- ☐ **Leading skip** (warming → skip → first reading, no prior confident reading): the gap is **fade-in only**
  (no fade-out half), and there is still **no now-marker** until the first confident reading (FR-004b).
- ☐ **No probability, ever**: no numeric value appears anywhere in the graph in any of these states (SC-007).

**Pass when**: every state is distinct + honest, no bridged gap, no "step back into frame", no number shown.
Result: _pending_

---

## Result log

| ID | Check | Result | Note |
|----|-------|--------|------|
| ST-1 | Band colour + height in light/dark (meadow / soft-amber / amber; amber stress-only; no crimson) | _pending_ |  |
| ST-2 | Fixed-px true circles, no totem/oval stretch; matched-pair width at 360px & ~768px | _pending_ |  |
| ST-3 | Ramp-up fill-to-width (no blank-left) → continuous lock → scroll-off, uniform slots | _pending_ |  |
| ST-4 | Keyboard focus + ring; popup on focus/hover/tap; tap toggles + outside-dismiss; ≥44px touch | _pending_ |  |
| ST-5 | Reduced motion: pulse → static halo, fades static, zero motion, live toggle | _pending_ |  |
| ST-6 | Marker freshness — recolours within one window of the bloom, never trailing/mismatched | _pending_ |  |
| ST-7 | Honest journey warm → read → out-of-frame → return (distinct treatments, no bridge, no number) | _pending_ |  |
