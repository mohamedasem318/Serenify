# Smoke Tests: Today-Card Stress Trend Redesign

**Feature**: `009-today-card-trend-redesign` | **Spec**: [spec.md](./spec.md) | **Plan**: [plan.md](./plan.md)

Human-validated checks per Constitution Principle VII (gate 5). **Mohamed** runs these by hand in a
real browser after `/speckit-implement` and records each result inline (`PASS` / `FAIL` + note + date).
The redesign is "done" only when every check below passes. These are the checks the automated suites
**cannot** make: real-browser CSS stretch (jsdom asserts only SVG attributes), perceptual first-paint
flash, amber legibility by eye, and keyboard/reduced-motion behaviour.

**Setup**: run `apps/web` via `npm run dev`. Sign in as a **calibrated employee with check-ins today**
so the today card shows the recap (not the empty/calibrate-first state); expand it with **View today**.
Toggle light/dark with the in-app ThemeToggle. Visual source of truth: `serenify-008followups-trend-FINAL.html`
(open from the working tree — untracked).

**Sign-off**: Mohamed Asem  **Date**: 2026-06-23  **Overall**: ☑ PASS ☐ FAIL

---

## ST-1 — Light-mode amber renders with the locked tokens (SC-007, FR-002)

Expand the card on a day that reached a tension peak, in **light mode** (flip to light to judge the
amber text — it is hardest there).

- ☑ **Chip / axis label** — the amber timeline pill + the "tense" / "a little tense" axis labels use
  `--color-amber-text` **`#8A580F`** (deep amber) on the amber tint, clearly legible.
- ☑ **Headline keyword** — the `hot` word ("tense" / "a little tense") is `--amber-head` **`#BC7A2A`**
  at **weight 700**, and sits on the **card surface** — never on the page background. (DC-007: #BC7A2A
  clears 3:1 large-text on the `#F4F5F6` card but FAILS 2.95:1 on the `#EAEBEC` page bg.)
- ☑ **Graphic amber is lines/markers only** — `--color-amber` appears only as a stroke/marker in the
  plot, never as a solid fill behind dark ink.
- ☑ **Dark mode** — re-check all three read cleanly with the dark tokens (`#E6C386` text / `#E4AE5C` head).

**Pass when**: all four hold. Result: PASS (2026-06-23) — deep amber legible in light; keyword bold on the card surface; graphic amber confined to lines/markers; dark tokens clean.

---

## ST-2 — 360px: intrinsic-width scroll, lanes tighten to 112 (SC-002, DC-001)

Resize to **360px**. The fixed-px no-stretch rule is asserted by unit tests only at the **SVG-attribute**
level (jsdom has no layout) and by `npm run test:layout` (the a7be539 `today-plot-tightening.spec.ts`
guard, real chromium). A browser can still **visually stretch via CSS**, which neither can catch — so
this eyeball is mandatory.

- ☑ The plot renders at its **intrinsic width and SCROLLS** horizontally — it does **not** stretch to
  fit, and does **not** crush the lanes into bars.
- ☑ Lanes **tighten to the 112px floor** (a 4-lane day → strip wider than the screen → scrolls).
- ☑ The right **edge-fade** is visible while there's more strip to the right; the left edge-fade
  appears once scrolled off the start.
- ☑ (Optional cross-check) `npm run test:layout` is green — the 360px tighten + the no-first-paint-flash
  guards.

**Pass when**: scrolls at intrinsic width, no stretch, no crush, edge-fades present. Result: PASS (2026-06-23) — scrolls at intrinsic width on a 4-lane day, lanes at the 112 floor, no stretch/crush, both edge-fades present.

---

## ST-3 — No first-paint width flash (SC-002, T031)

The wide-then-snap flash is the bug. Automated guards cover the SVG-attribute level and the JS-disabled
SSR state (`test:layout`); this is the perceptual real-browser confirmation.

- ☑ In DevTools, throttle the network (**Slow 3G**) and **hard-reload** `/app` at a **360px** viewport;
  watch the card area. The plot must **not** appear wide/overflowing for any frame before settling — its
  slot holds reserved (blank) space, then the correctly-sized plot fills in.
- ☑ **No vertical jump** — the headline/timeline below do not shift down when the plot appears (the
  placeholder reserves the plot's height).
- ☑ (Deterministic alternative) Disable JavaScript in DevTools and load `/today-plot-harness` at 360px:
  you see reserved blank space, **no** wide SVG — matching the automated JS-disabled guard.

**Pass when**: no wide flash, no vertical shift on load. Result: PASS (2026-06-23) — run on `/today-plot-harness`: `/app` reloads the card *collapsed* (in-memory expand state) so the plot can't be watched paint there; the harness renders the same plot in the same wrapper chain, always expanded. 3a (Slow 3G hard-reload) = reserved blank → correct-width snap, no wide frame, no vertical jump; 3b (JS off) = reserved blank space, no SVG.

---

## ST-4 — Keyboard reachability + focus ring (SC-005, FR-011)

Expand the card. Use **Tab** and the keyboard only.

- ☑ Each plot **per-session target is focusable** (Tab lands on it) and shows a **visible focus ring**.
- ☑ Focusing a lane **highlights its timeline row**; hovering a row highlights its lane (synced, both ways).
- ☑ Timeline **rows are NOT separate tab stops** (Tab does not stop on each row — only the plot targets).
- ☑ While the card is **collapsed**, the plot targets are not in the tab order.

**Pass when**: plot targets focusable with a ring, rows not tab stops, highlight syncs both ways. Result: PASS (2026-06-23) — all four plot targets focusable with the foggy focus ring; rows not tab stops; highlight syncs both ways; collapsed targets out of the tab order.

---

## ST-5 — Reduced motion honoured (SC-005, FR-015)

Enable `prefers-reduced-motion` (OS setting or DevTools rendering emulation), both modes.

- ☑ Expand/collapse is **instant** — no height-grow animation.
- ☑ The synced highlight and the edge-fades show **no transition** (state still changes, just not animated).
- ☑ Function is preserved: the card still expands, the highlight still tracks, the fades still appear.
- ☑ Toggle the OS/DevTools flag **while the tab is open** and confirm it updates live (`useMediaQuery`
  re-subscribes).

**Pass when**: every animation is skipped and function survives. Result: PASS (2026-06-23) — verified via the Windows OS reduced-motion flag (the real setting): expand/collapse instant, highlight + fades show no transition, function preserved, updates live on toggle.

---

## ST-6 — Honesty on a real multi-session day (SC-010, FR-002/FR-007)

Use a real day with a warm-up, an interior lost read, a fully read-less session, and a tension peak.

- ☑ **Warm-up** (leading absent reads) draws a **faded** eased lead-in — never a solid line at a fixed level.
- ☑ **Lost read** (interior gap) is **faded and never bridged** across at a fixed level.
- ☑ A **fully read-less session** is a **hollow marker on its own low (`no read`) lane** — never on the calm line.
- ☑ Each lane's **drawn peak == its timeline chip tone** (the plot and the chip never disagree).
- ☑ **Headline never overstates**: it says "tense" only when the tense band was actually reached; on a
  recovered day (most-recent band below the peak) it surfaces the "…then eased" recovery, not the peak alone.

**Pass when**: every honesty rule holds and the headline matches the day. Result: PASS (2026-06-23) — on a seeded 4-session day: S1 faded warm-up lead-in → solid; S2 interior lost-read faded and unbridged → solid tense; S3 hollow marker on the no-read lane; peak == chip on all four; headline "Your morning turned tense, then eased" surfaces the recovery without overstating.

---

## Result log

| ID | Check | Result | Note |
|----|-------|--------|------|
| ST-1 | Light-mode amber tokens (chip #8A580F / head #BC7A2A 700 / graphic-only) | PASS | light + dark legible; keyword on card surface, not page bg |
| ST-2 | 360px intrinsic-width scroll, lanes → 112 | PASS | real-browser no-stretch eyeball; scrolls at intrinsic width, edge-fades present |
| ST-3 | No first-paint width flash (T031) | PASS | throttled reload + JS-disabled cross-check on `/today-plot-harness` (`/app` reloads collapsed) |
| ST-4 | Keyboard targets + focus ring; rows not tab stops | PASS | synced highlight both ways; collapsed = out of tab order |
| ST-5 | Reduced motion honoured | PASS | Windows OS reduced-motion flag; live update on toggle |
| ST-6 | Honesty on a real day (warm-up/lost-read/no-read/peak/headline) | PASS | all honesty rules hold; headline surfaces recovery, no overstatement |
