# Phase 0 Research — Today-Card Stress Trend Redesign

All decisions reconciled against the approved mock `serenify-008followups-trend-FINAL.html`, the live tokens in `apps/web/app/globals.css`, the existing read layer `apps/web/lib/api/monitoring-reads.ts`, and constitution v1.4.0.

---

## R-1 — Fixed-pixel SVG rendering (the anti-totem technique) — DECIDED

**Decision.** The expanded lane plot renders at **fixed pixel scale: 1 SVG unit = 1 screen pixel.** Concretely:
- Compute `laneWidth = max(112, floor(availableWidth / nLanes))` … in practice lanes are a **fixed** width (≈168px when the day fits, ≈112px min when busy); the plot's pixel width is `W = nLanes × laneWidth`.
- The `<svg>` gets **both** `width={W}` (px) **and** `viewBox="0 0 W H"` with `H ≈ 200`. Because the intrinsic width equals the viewBox width, there is **no scaling** — strokes stay ~3px, lanes stay wide.
- The SVG sits inside a horizontally-scrollable wrapper. When `W` exceeds the wrapper, the strip scrolls; it never shrinks the lanes.
- The left **axis (≈96px)** is a separate fixed column **outside** the scroll area, so the four level-labels stay pinned while lanes scroll.

**Forbidden (this is the totem bug).** A small fixed `viewBox` (e.g. `0 0 100 40`) with `preserveAspectRatio="none"` stretched to `width:100%`. The horizontal stretch turns thin step strokes into wide smears and, with per-band rects, into tall "totem" bars. The pre-`[3]` on-main `today-view.tsx` does exactly this (`viewBox="0 0 100 40" preserveAspectRatio="none"`) — it is the rejected approach.

**Mock geometry (the build target).** Band Y-centres on the 200px canvas: `tense=44`, `little=88`, `ease=132`, `noread=172`; stroke width `3`; lane inner padding `18`; normal-day laneWidth `168`, busy-day laneWidth `112`. Mini step-line: a separate wide-short strip (≈48px tall) — a thin line, so horizontal stretch is acceptable there (it is not a bar field); only the **lane plot** is held to the 1:1 rule.

**Rationale.** The non-negotiable DC-001 is fundamentally about decoupling the drawing scale from the container width. Fixed-px is the only technique that guarantees thin horizontal shapes at any session count.

**Alternatives considered.** Recharts `ResponsiveContainer` (stretches to width:100% → reintroduces the bug; rejected — see plan Complexity V-c). A single stretched viewBox (the rejected build). CSS-only bars (totems by construction).

---

## R-2 — Headline source & the FR-002 honesty fork — NEEDS MOHAMED

**Finding (confirmed by reading the code).** The honest templated headline is **already produced by the data layer**: `getTodayRecap` → `deriveRecap` → `deriveHeadline(recapSessions)` returns a `TemplatedHeadline {pre, hot, post}` where `hot` is null on a calm day. **This feature renders it (it does not add copy logic)** — it draws `recap.headline.pre` + `<span class=amber-head weight-700>hot</span>` + `post`, on the **card surface** (where `#BC7A2A` clears 3:1).

**Conflict.** `deriveHeadline` (monitoring-reads.ts:299–328) sets `hot = \`tense ${partOfDay(peak)}\`` for **any** stress band — its comment: *"any stress band reads as 'tense' at a glance (FR-022 amber = the stress signal); the timeline carries the 'a little tense' nuance."* That contradicts **009 FR-002 / SC-010 / US1-AC2**: the amber "tense" wording must appear **only** when the day actually reached the **tense** band; an a-little-tense-only day must reflect the lower peak.

**Fork (Mohamed decides before implement):**
- **(a) — recommended — scoped copy change to `deriveHeadline`.** When the day's peak tenor is `a_little_tense` (never `tense`), emit "a little tense {partOfDay}" (or equivalent) instead of "tense". This is a **presentation-copy** change inside `monitoring-reads.ts`; it touches **no** read, RLS policy, SELECT whitelist, or probability path, so it stays within the brief's "no data-layer changes" intent (which was about reads/privacy). It needs its own unit test and a `docs/CHANGELOG.md` note (it also affects feature 008's prior FR-022 wording).
- **(b) relax FR-002** to match the existing "amber = stress at a glance" behavior, and update SC-010/US1-AC2. Keeps the data layer untouched but weakens the feature's headline-honesty promise.

**Why it matters.** The entire feature is framed around an *honest header naming the real peak*. Shipping (b) silently would reintroduce exactly the kind of dishonesty the redesign is meant to remove.

---

## R-3 — Amber palette tokens & the `#8A580F` vs `#7E5310` fork — NEEDS MOHAMED

**Finding.** `globals.css` currently defines **only** `--color-amber` (`#C98637` light / `#E4AE5C` dark). None of `--color-amber-text`, `--amber-tint`, `--amber-soft-line`, `--amber-head` exist anywhere in `apps/web`. DC-006 needs all four. The constitution (Principle V) documents the amber soft-tint treatment as **tint `#F4E3C6` / text `#7E5310`** (light) and **tint `#3B2F19` / text `#E6C386`** (dark) — but only in prose; no token codifies it yet.

**Measured AA (re-verified):**

| Value | on tint `#F4E3C6` | on card surface `#F4F5F6` | verdict |
|---|---|---|---|
| constitution `#7E5310` (light text) | **5.32:1** | **6.14:1** | passes, slightly higher contrast |
| spec/mock `#8A580F` (light text) | **4.78:1** | **5.52:1** | passes (warmer) |
| dark text `#E6C386` (both agree) | 7.79:1 (on `#3B2F19`) | 10.31:1 | passes |

So the **dark** value matches the constitution; only the **light** amber-text diverges (`#8A580F` mock vs `#7E5310` constitution).

**Decision (tokens to add, both themes):**

| Token | Light | Dark | Role |
|---|---|---|---|
| `--color-amber-text` | `#8A580F` *or* `#7E5310` (fork) | `#E6C386` | chip text + axis tension labels (AA-safe small text) |
| `--amber-tint` | `#F4E3C6` | `#3B2F19` | chip background for tension rows |
| `--amber-soft-line` | `#D49A4A` | `#E8BC7A` | "a little tense" mid graph line (graphic, not text) |
| `--amber-head` | `#BC7A2A` | `#E4AE5C` | headline keyword (weight 700, large text) |
| `--color-amber` (existing) | `#C98637` | `#E4AE5C` | tense graph line / markers only — never small text |

**Fork (Mohamed decides):**
- **(a) adopt the constitution's `#7E5310`** for light amber-text — **no amendment needed**, marginally higher contrast, but departs from the mock's chosen warmth.
- **(b) keep the mock's `#8A580F`** and log a **MINOR constitution amendment** updating Principle V's amber-text light value to `#8A580F`, with the AA rationale ("warmest that clears AA on the tint").

**Governance regardless of fork.** Introducing the amber **sub-tokens** (especially the genuinely new `--amber-soft-line` and light `--amber-head`) is a palette addition under a "locked, no additions without amendment" principle → **MINOR amendment + `docs/DECISIONS.md` entry**. Token names use the `--color-*` prefix only where Tailwind utility generation is needed (`--color-amber-text` for `text-amber-text`); the graphic-only line/tint/head values can be plain custom properties consumed via inline `style`/arbitrary values, mirroring the mock.

**Rationale.** Bright graphic amber fails small-text AA (2.77:1), so a dedicated AA-safe text token is mandatory; the mid-line token gives the "a little tense" band its own hue so colour reinforces height.

---

## R-4 — Synced highlight (resolved per amended FR-011) — DECIDED

**Decision.** Highlight state is a single "active session id" held in the orchestrator.
- **Mouse:** `mouseenter`/`leave` on **both** a lane hit-area **and** its timeline row set/clear the active id (both directions).
- **Keyboard:** the **plot per-session targets** are the focusable elements (`tabindex=0`, `role=button`, `aria-label="Session N, {tenor}"`); `focus`/`blur` set/clear the active id and show a visible **focus ring**. Timeline rows are **not** separate tab stops (avoids per-row tab-stop bloat — the accessible choice locked by amended FR-011/A-007).
- Active id drives a CSS class on the matching lane background, focus ring, and timeline row. All transitions gate on `useMediaQuery('(prefers-reduced-motion: reduce)')`.

**Rationale.** Matches the mock's wiring and the amended spec exactly; one source of truth prevents lane/row divergence.

---

## R-5 — Peak-band == chip is structural (SC-004) — DECIDED

**Finding.** `deriveRecap` computes each session's `tenor = sessionTenor(rows)` once and derives **both** `chipTone`/`chipLabel` (via `chipFor(rows, tenor)`) **and** the value the graph must treat as the session's peak from that same `tenor`. `chipFor` maps `at_ease→meadow`, `a_little_tense→amber`, `tense→amber`, `no_read→muted` (matches the mock's three chip tones). **Decision:** the plot's per-session peak marker/lane colour reads the **same `RecapSession.tenor`** — never a separately recomputed max — so SC-004 holds by construction. The mini step-line's per-session peak also reads `tenor`.

---

## R-6 — Overflow, scrollbar & edge fades (component-local) — DECIDED

**Decision.** The lane strip is `overflow-x:auto` with a **component-local** thin styled scrollbar (`scrollbar-width:thin` + `::-webkit-scrollbar` thumb token) and two gradient **edge-fade** overlays (right shown when overflowing; left shown once `scrollLeft>0`), exactly as the mock. App-wide scrollbar restyling is **out of scope** (separate chore). Overflow detection via a small resize/scroll listener toggling `.ovr`/`.scrolled` classes.

**Rationale.** Keeps the affordance scoped to this component and avoids a global scrollbar change.

---

## R-7 — Testing approach mapped to Success Criteria — DECIDED

| SC | Layer | Check |
|---|---|---|
| SC-001 axis-not-legend | RTL | four axis level-labels present; **zero** legend swatches in the DOM |
| SC-002 shapes-not-bars @ desktop **and** 360px | geometry unit + RTL | SVG `width` attr == `nLanes×laneWidth` (== viewBox width) → no stretch; strokes are `<path>`/`<polyline>` ~3px; **no** `<rect>` fill encodes a band; assert at both widths |
| SC-003 collapsed-is-a-line | RTL | mini-trend emits connected `polyline` segments (≥1 connector), not isolated dots; expanded plot height ≈200px |
| SC-004 peak == chip | geometry unit | the lane peak tenor === `RecapSession.tenor` === chip tone, over fixtures |
| SC-005 synced highlight | RTL | hover lane→row active; hover row→lane active; focus plot target→ring + row active; reduced-motion → no transition class |
| SC-006 overflow | RTL/geometry | nLanes large → `W>wrapper`, every lane ≥ min width, all sessions in DOM; right fade present |
| SC-007 amber AA both themes | unit (`amber-aa.test.ts`) | compute WCAG ratio for each amber text token on its bg; assert ≥ threshold (light + dark) |
| SC-008 no probability | RTL/grep | no probability digit in DOM; only clock-time strings; reads select no probability column |
| SC-009 RLS-as-user / whitelist | code review + existing reader tests | no new read; whitelist constants unchanged |
| SC-010 honesty | geometry + RTL | warm-up/lost-read render faded (not bridged); fully no-read → hollow marker on no-read lane, never calm line; headline wording per resolved R-2 |

Plus the existing employee Playwright happy-path (extend to assert expand/collapse + no-legend), and a human `smoke-tests.md` (authored at implement): light/dark amber legibility by eye, 360px no-crush, keyboard focus ring, reduced-motion, real multi-session day.

---

## Open items carried to the plan
- **R-2 fork** (headline honesty) → Mohamed.
- **R-3 fork** (`#8A580F` vs `#7E5310`) + amber sub-token amendment → Mohamed.
- **Plan §V-b** (20px radius vs 8–16px) → recommend PATCH amendment; not this feature's fault.
