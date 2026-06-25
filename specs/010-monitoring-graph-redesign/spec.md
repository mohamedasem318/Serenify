# Feature Specification: Live "This session" monitoring-graph redesign (009b)

**Feature Branch**: `010-monitoring-graph-redesign`

**Roadmap label**: `009b-monitoring-graph-redesign` (constitution v1.8.0, Principle VIII; Amendment 10). The SpecKit branch number (`010`) is auto-assigned and decoupled from the `009b` label — this is expected. The shipped `009-today-card-trend-redesign` is **not** renamed or touched.

**Created**: 2026-06-25

**Status**: Draft

**Input**: User description: "Redesign the live 'This session' within-session monitoring graph (009b) — frontend-only redesign of `session-trend.tsx` per the locked mock `serenify-live-session-graph-mock.html`."

**Visual source of truth**: `serenify-live-session-graph-mock.html` (repo root), signed off by Mohamed (sole design authority). Its bottom "Design notes for implementation" block is binding. This is a **"match this"** spec, not a "use judgment" one.

---

## User Scenarios & Testing *(mandatory)*

This feature redesigns the live **"This session"** graph shown below the camera stage on the monitor page while an employee is actively being recorded. It is **frontend-only** — it consumes the existing read layer unchanged and adds no data, auth, or privacy surface. It is **not purely visual**: it adds real state-handling (consuming `skipCause`, splitting warming-vs-skip, three differentiated no-read treatments) and it is **honesty-critical** (the graph must never tell a user something the pipeline cannot actually know).

### User Story 1 - Read your live stress trend at a glance (Priority: P1)

While a monitoring session is running, the employee watches the "This session" graph build below the camera stage. Readings appear as a continuous **step line whose colour is the band** (at ease = meadow, a little tense = soft-amber, tense = amber) and **whose height is the tension level** (higher = tenser). A single round **"now" marker** sits at the current reading and **recolours to the current band**, so the employee always knows where they are right now — without any number.

**Why this priority**: This is the core of the redesign and the MVP. It replaces today's stretched coordinate space (which ovals every marker) and today's single meadow line + lone amber peak dot with an honest, legible band-coloured trend. Implementing only this already delivers a usable, correct live graph.

**Independent Test**: With a session that produces a mix of at-ease / a-little-tense / tense readings, confirm the line segments take the matching band colour, the line height tracks tension, the "now" marker sits at the latest reading and matches its band colour, and every marker renders as a true circle at any container width.

**Acceptance Scenarios**:

1. **Given** a live session with several confident readings across bands, **When** the graph renders, **Then** each segment's colour matches its band and its vertical position matches its tension level (tenser = higher).
2. **Given** the latest confident reading is "tense", **When** the graph renders, **Then** the single "now" marker is an amber round dot at that reading and there is no separate peak marker.
3. **Given** the latest confident reading changes band, **When** the next reading arrives, **Then** the "now" marker recolours to the new band.
4. **Given** any supported container width, **When** the graph renders, **Then** every marker is a true circle (no oval distortion) and the graph fills the container width.

---

### User Story 2 - Understand the three no-read states honestly (Priority: P2)

When the system can't take a reading, the employee sees a **distinct, honest** treatment instead of one undifferentiated gap — three are designed, of which **two are visible at launch** (the third, the out-of-frame foggy treatment, is built but gated OFF per FR-019):

- **Warming up** (session start, no band yet): a **dashed muted line** ("getting a read"). It is a *line*, not a gap, and it is muted — not a stress signal.
- **Stepped out of frame** (mid-session) — *built but gated OFF at launch (FR-019)*: when enabled, **fade out → gap → fade in** with a **foggy** label ("step back into frame"). Foggy signals *attention*. **At launch this is gated off** and out-of-frame routes to the muted "no clear read" treatment below, because the pipeline cannot yet reliably tell "left frame" from "low confidence" (issue #100).
- **No clear read** (mid-session): **fade out → gap → fade in**, with a **muted** label. Muted, not stress. At launch this is the treatment for **every** non-warming skip — including out-of-frame (the FR-019 fallback).

A no-read never bridges the calm line: it fades out at its current level, leaves a gap, and eases back in at the new level (fade-in only when there is no prior level — a leading skip).

**Why this priority**: This is the honesty-critical part and the part most likely to be implemented wrong. Today's component flattens all no-reads into one gap and discards both `skipCause` and the warming-vs-skip distinction (both already loaded into the data). The redesign must start consuming them. It ships after P1 because P1 is the legible-trend baseline; the no-read differentiation layers honesty on top.

**Independent Test**: Drive sessions that (a) start with leading no-read windows, (b) hit a mid-session out-of-frame skip, and (c) hit a mid-session low-light / our-side skip. **At launch (foggy gate OFF)** confirm two visible treatments — a dashed muted line at the start and muted-labelled gaps for both the out-of-frame and the low-light/our-side skips — with no gap bridged by a flat carried-forward line. **With the foggy gate ON**, confirm the out-of-frame skip instead renders the foggy-labelled gap, giving three visually + textually distinct treatments.

**Acceptance Scenarios**:

1. **Given** a session that has produced no confident band yet, **When** the graph renders, **Then** the leading no-read run is a dashed muted line (not a gap, not amber).
2. **Given** a mid-session out-of-frame skip between two confident readings **and the foggy gate OFF (launch default)**, **When** the graph renders, **Then** the trend fades out, leaves a gap, fades back in, and the gap carries the **muted** "no clear read" label — never the foggy "step back into frame" copy (FR-019).
3. **Given** a mid-session no-clear-read skip (low-light / insufficient-face / our-side), **When** the graph renders, **Then** the gap carries a muted label.
4. **Given** a mid-session out-of-frame skip **and the foggy gate ON**, **When** the graph renders, **Then** the gap carries the **foggy** "step back into frame" label (the built-but-gated treatment, FR-011).
5. **Given** a mid-session no-read with no skip cause (a re-warm), **When** the graph renders, **Then** it is the muted no-clear-read **gap** treatment — never a dashed warming line (see Assumptions).
6. **Given** any no-read window between two confident readings, **When** the graph renders, **Then** the line is never drawn flat across the gap at a carried-forward level.
7. **Given** a **leading skip** (warming → skip → first reading) with no prior confident reading, **When** the graph renders, **Then** the gap is a **muted gap with fade-in only** (no fade-out half).

---

### User Story 3 - Inspect the current reading ("you are here") (Priority: P3)

The employee can inspect their current reading: hovering, focusing (keyboard), or tapping the "now" marker reveals a small popup — **"you are here"** when the live edge is a confident reading, or **"last clear read"** when the marker is parked, muted and static, on the last confident reading during an active no-read (FR-004a). The marker is reachable and operable by keyboard alone, carries an appropriate accessible label, and respects reduced-motion (the gentle pulse becomes a static halo).

**Why this priority**: The recolouring marker (P1) already conveys the current band; this story adds the explicit inspection affordance and full accessibility. It is valuable but the smallest independent slice, so it ships last.

**Independent Test**: Using only the keyboard, tab to the "now" marker and confirm the "you are here" popup appears on focus (not hover-only); confirm it also appears on hover and on tap; with reduced-motion enabled, confirm no animation plays.

**Acceptance Scenarios**:

1. **Given** a rendered graph with a "now" marker on a live confident reading, **When** the user hovers, focuses, or taps the marker, **Then** the "you are here" popup appears.
2. **Given** a keyboard-only user, **When** they tab to the marker, **Then** it receives focus and the popup appears on focus.
3. **Given** a user with reduced-motion preferred, **When** the graph renders, **Then** the marker shows a static halo and does not pulse.
4. **Given** the current live state is an active no-read (out-of-frame, no-clear-read, or re-warm) **with** at least one prior confident reading, **When** the graph renders, **Then** the "now" marker stays at the last confident reading, renders muted (not band-coloured), does not pulse, and its popup reads "last clear read".
5. **Given** the live edge returns to a confident reading after a no-read, **When** the next confident reading arrives, **Then** the marker resumes full band colour, pulse, and "you are here".
6. **Given** a session still warming (no confident reading has ever occurred), **When** the graph renders, **Then** there is no "now" marker (the dashed warming line stands alone).

---

### Edge Cases

- **Empty / just-started** (no readings at all): keep the current text-only treatment ("Your trend builds as readings come in.") — no axes, no line. (Preserves today's `drawableCount === 0` behaviour.)
- **Single confident reading**: render a single dot, not a line.
- **Fully read-less session** (warming-only or all-skipped, no confident band ever): render honestly as a no-read state, never as calm / at-ease.
- **Mid-session re-warm** (a null band with no skip cause after a confident reading, e.g. after a worker restart): the muted no-clear-read **gap** treatment, not a dashed warming line (Assumptions).
- **Leading skip (after warming, before the first confident reading)**: a skip that occurs before any confident reading but after warming (warming → skip → first reading) has **nothing to fade out of**, so it renders as a **muted gap with fade-IN only** (no fade-out half). Honest and simple (FR-013).
- **Out-of-frame at launch**: out-of-frame is mapped to the muted "no clear read" gap (FR-019) because the foggy treatment is gated OFF at launch — so the user is never told to "step back into frame" while the pipeline can't reliably tell they left (issue #100). When #100 confirms reliability, the gate flips on and out-of-frame renders foggy.
- **Now marker during a no-read**: with a prior confident reading, the marker parks (muted, static, "last clear read"); with no confident reading yet (warming), there is no marker (FR-004a / FR-004b).
- **Container resize / responsive**: the graph re-renders at the new fixed-pixel width; markers stay true circles and the graph keeps matching the camera stage width.
- **Session paused / ended**: the live graph only polls while actively capturing (warming-up / active); a paused session shows the last rendered state.

## Requirements *(mandatory)*

### Functional Requirements

**Rendering & layout**

- **FR-001**: The graph MUST render in a uniform coordinate space where one drawing unit equals one screen pixel, with the drawing width and the coordinate-system width equal, so every marker renders as a **true circle** with no stretch distortion. This replaces today's stretched coordinate space that ovals every marker. (Governing constraint: DC-001, fixed-pixel rendering.)
- **FR-002**: The graph MUST fill the width of its container and read as a **matched pair** with the live monitoring container (camera/feed stage) directly above it. It MUST NOT impose a narrower max-width. The real width is read from the existing monitor layout, not the mock's standalone-preview width.
- **FR-003**: The trend MUST render as a **continuous step line** whose **colour encodes the band** (at ease = meadow, a little tense = soft-amber, tense = amber) and whose **height encodes tension** (tenser = higher). This is a continuous step line, not the today-card's lane geometry.

**The live "now" marker**

- **FR-004**: When the current (live-edge) reading is a **confident band**, a single live **"now" marker** MUST appear at it as a round dot that **recolours to the current band** (meadow / soft-amber / amber), pulses gently (FR-006), and whose popup reads **"you are here"**.
- **FR-004a**: When the current (live-edge) state is an **active no-read** (out-of-frame, no-clear-read, or mid-session re-warm) **and at least one confident reading has already occurred**, the "now" marker MUST **stay parked at the last confident reading** but: (a) render **muted/dimmed** — NOT band-coloured (band colour would assert a current band we don't have); (b) **stop pulsing** (static — no live pulse on a stale reading); and (c) flip its popup copy from "you are here" to **"last clear read"**. When the live edge returns to a confident reading, the marker MUST resume full band colour + pulse + "you are here". *Rationale: parking on a stale reading while still claiming "you are here" would be the exact dishonesty this redesign exists to prevent; muting + relabelling keeps a visual anchor without asserting a current band we don't have.*
- **FR-004b**: During **start-of-session warming** (no confident reading has ever occurred), there MUST be **no "now" marker at all** — the dashed warming line stands alone.
- **FR-005**: The "now" marker MUST **replace** the old amber peak dot. There is **no separate peak marker**.
- **FR-006**: When live on a confident reading, the "now" marker MUST show a gentle pulse; under reduced-motion it MUST render a **static halo** with no animation. (During an active no-read it is static regardless — FR-004a.)
- **FR-007**: The "now" marker MUST reveal its popup on hover, on focus, AND on tap. The popup copy is **"you are here"** when parked on a live confident reading and **"last clear read"** when parked on a stale reading during an active no-read (FR-004a).
- **FR-008**: The "now" marker MUST be reachable and operable by **keyboard** (focusable; the popup appears on focus, not hover-only) and MUST carry an appropriate accessible label (reflecting the live-confident vs parked-stale state).

**No-read states (the three honest treatments)**

- **FR-009**: The graph MUST start consuming `skipCause` and the **warming-vs-skip distinction** from the existing read layer (both already loaded into each trend point but discarded by the component today).
- **FR-010**: A **leading run of no-read windows at session start** (no confident band yet, no skip cause) MUST render as a **dashed muted line** ("warming up") — a line, not a gap, and muted (not a stress signal).
- **FR-011** *(built but gated OFF at launch — FR-019)*: The **mid-session out-of-frame** foggy treatment renders as **fade out → gap → fade in** with a **foggy** label inviting the user back into frame (attention, not stress). It MUST be fully built per the mock, but at launch it is gated OFF: out-of-frame instead routes to the muted treatment (FR-012, FR-019). This requirement defines the foggy treatment for when the gate is flipped on.
- **FR-012**: A **mid-session no-clear-read skip** MUST render as **fade out → gap → fade in** with a **muted** label. At launch this is the treatment for **every** non-warming skip cause — low-light, insufficient-face, our-side, **and out-of-frame** (the FR-019 fallback). (When such a skip is a **leading skip** with no prior confident reading, the fade-out half is omitted — **fade-in only**; see Edge Cases and FR-013.)
- **FR-013**: A no-read state MUST **never bridge the calm line**: it fades out at the current level, leaves a gap, and eases back in at the new level — never a flat carried-forward line across the gap. The fade-out half requires a prior confident level to fade out of; when there is none (a **leading skip** before any confident reading), the gap is **fade-in only**.
- **FR-014**: The dashed warming line is **session-start-only**. Any null band **after** a confident reading (including a mid-session re-warm with no skip cause) MUST render as the **no-clear-read gap** treatment, never a dashed line. (See Assumptions — this is a deliberate, reasoned exception, not an oversight.)
- **FR-019** *(decided)*: The foggy "step back into frame" out-of-frame treatment **ships OFF at launch.** At launch, `skipCause === "out-of-frame"` MUST map to the **muted "no clear read" gap** treatment (FR-012) — the honesty-first fallback — NOT the foggy treatment. The foggy treatment (FR-011) MUST nonetheless be **fully built per the mock but gated** behind a single feature condition, so enabling it later is a **one-line gate flip**, not a re-implementation. **Reason:** out-of-frame reliability is unproven until the backlogged read-only diagnostic — **GitHub issue #100** / `docs/BACKLOG.md` "Live monitor: does the pipeline distinguish 'not in frame' … from 'couldn't get a clear read'" — confirms `skipCause === "out-of-frame"` is reliable; honesty-first means we do not ship a "you left frame" claim we cannot stand behind. When #100 confirms reliability, flipping the gate on is the only change required (the back-reference in #100 records this trigger).

**Honesty & semantics (non-negotiable — Graphite)**

- **FR-015**: amber MUST be used **only** for stress signals (the bands). No-read states are NOT stress: the out-of-frame *foggy* role = attention (used only when the foggy treatment is enabled — gated per FR-019; at launch out-of-frame is muted), warming and no-clear-read = muted. Crimson/red MUST NEVER appear anywhere in this graph.
- **FR-016**: **No numeric probability** MUST ever be shown to the user.
- **FR-017**: An empty / just-started session (no readings) MUST keep the current **text-only** treatment (no axes, no line).
- **FR-018**: A session with a **single confident reading** MUST render as a single **dot, not a line**.

**Copy & tokens**

- **FR-020**: The graph MUST reuse the existing read layer (`getSessionTrend` / `monitoring-reads.ts`) **unchanged** — no RLS, auth, security, or data-model change, and no probability reaching the client.
- **FR-021**: The graph MUST present the three band levels (Tense, A little tense, At ease) and a band legend consistent with the mock.
- **FR-022** *(decided — copy pending Mohamed's wording sign-off before implement)*: The no-read copy MUST **reuse the same `skipCause` vocabulary as the today-card's `phraseFor`** but render it in the **live / present-or-imperative voice** — the live graph is real-time where the today-card is retrospective, so the two are aligned but **NOT identical strings** (e.g. retrospective "kept stepping away" → live imperative "step back into frame"). Resolved **proposed live copy** (flagged for Mohamed's sign-off):
  - **Warming** → **"getting a read"** (present/continuous; matches the mock).
  - **Out-of-frame** → **"step back into frame"** (imperative; the live counterpart of `phraseFor`'s retrospective "kept stepping away"). *Gated OFF at launch (FR-019); the string is ready for when the gate flips on.*
  - **No clear read** → **"no clear read"** (present; the live counterpart of `phraseFor`'s default "no clear read"). *Optional cause-specific live variant for low-light:* **"too dark to read"** (live counterpart of `phraseFor`'s "light too low") — Mohamed to confirm whether the no-clear-read state shows one generic string or cause-specific variants.
- **FR-023** *(decided)*: The **"a little tense" mid-band line** MUST reuse the existing pinned token **`--amber-soft-line`** (`#D49A4A` light / `#E8BC7A` dark, from feature 009's `trend-geometry.ts` `BAND_LINE.a_little_tense`). **No new `globals.css` token and no amendment.** This is a deliberate, signed-off ~hue delta from the mock's placeholder (`#CF9A4F` light / `#D8B57A` dark), chosen for **cross-surface consistency with the today-card**.

### Key Entities

- **Trend point** (existing, read-only — `SessionTrendPoint`): one capture window. Carries `band` (at ease / a little tense / tense, or null), `skipCause` (low-light / out-of-frame / insufficient-face / our-side, or null), a capture timestamp, and a `scored` flag. Derivation rule for this feature: **warming** = `band` null **and** `skipCause` null **in a leading run**; **skip** = `band` null **and** `skipCause` set (or a null-band run after a confident reading).
- **Band**: the three confident stress levels — at ease (meadow), a little tense (soft-amber), tense (amber).
- **Skip cause**: low-light, out-of-frame, insufficient-face, our-side.
- **No-read treatment** (derived, new to this component): one of **warming** (dashed muted line, start-only) · **out-of-frame** (foggy gap) · **no-clear-read** (muted gap) — selected from band/skipCause/position.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Every marker renders as a true circle (1:1 aspect, no ovaling) at every supported container width.
- **SC-002**: The graph width equals the camera-stage width directly above it at every supported viewport (they read as a matched pair).
- **SC-003**: Without seeing any number, a user can correctly identify which of the three bands their current reading is in (by colour + height) in 100% of confident-reading states.
- **SC-004**: The no-read states are visually and textually distinct. **At launch** (foggy gate OFF) there are two visible treatments — a user can tell "warming up" (dashed line) from "no clear read" (muted gap). **With the foggy gate ON**, all three are distinct — "warming up", "stepped out of frame" (foggy), and "no clear read" (muted).
- **SC-005**: The "you are here" popup is reachable and triggerable using the keyboard alone (appears on focus, not hover-only).
- **SC-006**: With reduced-motion preferred, no animation plays anywhere in the graph.
- **SC-007**: No probability value appears anywhere in the rendered output, in any state.
- **SC-008**: The user is never shown "step back into frame" when the system cannot reliably determine they left frame. At launch this holds **by construction** — the foggy treatment is gated OFF, so out-of-frame renders as the muted "no clear read" (FR-019).
- **SC-009**: A no-read gap is never bridged by a flat line at a carried-forward level. A leading skip (no prior confident reading) renders fade-in only.
- **SC-010**: A single-reading session renders one dot (never a line); a fully read-less session renders a no-read state (never calm/at-ease).
- **SC-011**: When the live edge is an active no-read with a prior confident reading, the "now" marker is muted (not band-coloured), static (not pulsing), and its popup reads "last clear read" — never a band-coloured/pulsing "you are here" on a stale reading. During start-of-session warming (no confident reading yet) there is no marker.

## Resolved decisions (2026-06-25, Mohamed)

These six were decided by Mohamed and are recorded here as resolved (no open clarifications remain):

1. **Now marker during a no-read** → parks at the last confident reading, **muted + static**, popup **"last clear read"** (not band-coloured/pulsing "you are here"); no marker at all during start-of-session warming. (FR-004 / FR-004a / FR-004b; US3 scenarios 4–6; SC-011.)
2. **Out-of-frame foggy treatment ships OFF at launch** — built but **gated** behind one feature condition; at launch out-of-frame → muted "no clear read" (FR-019 fallback). One-line gate flip to enable. (FR-019; FR-011/FR-012.)
3. **Back-reference recorded** in GitHub issue **#100** and its `docs/BACKLOG.md` entry (the trigger to flip the gate on); reverse link in FR-019.
4. **Mid-band token** → reuse existing `--amber-soft-line` (`#D49A4A`/`#E8BC7A`); no new token, no amendment. (FR-023.)
5. **No-read copy** → same `phraseFor` vocabulary, **live/imperative voice** (not identical strings); proposed live copy pending Mohamed's wording sign-off. (FR-022.)
6. **Leading skip** (warming → skip → first reading) → muted gap, **fade-in only**. (Edge Cases; FR-012/FR-013; US2 scenario 7.)

## Assumptions

- **Warming is session-start-only (deliberate exception — flagged, not buried).** The dashed warming line exists only because session start has no prior reading to fade out of. Any null band **mid-session** is a gap, never a dashed line — because mid-session there is always a prior level, so the locked "no-read never bridges the calm line" rule applies, and a dashed line across a mid-session gap would imply a trajectory we don't actually have (a small dishonesty). Concretely: a mid-session re-warm (e.g. after a worker restart) renders as the no-clear-read gap treatment. Stated explicitly so it is visible and challengeable — and so it is not re-litigated as "why aren't there two dashed states".
- The existing read layer is consumed **unchanged**; `skipCause` and the warming signal (`band` null + `skipCause` null) are already present on every trend point — the redesign starts *reading* them, it does not add them.
- **Container width** is read from the existing monitor layout (the page's main-column wrapper / camera stage), not the mock's 600px standalone-preview width.
- The colour tokens match the existing Graphite palette already in `globals.css` (meadow, amber, foggy, muted) and need no change; the "a little tense" line reuses the existing `--amber-soft-line` token (FR-023, decided — no new token, no amendment).
- This is **frontend-only**: no RLS, auth, security, or data-model change; no probability ever reaches the client.
- Reduced-motion and keyboard operability follow the existing app accessibility conventions.

## Dependencies

- **Read layer**: `getSessionTrend` / `apps/web/lib/api/monitoring-reads.ts` (consumed unchanged); the target component is `apps/web/components/monitor/session-trend.tsx`.
- **Copy alignment**: the today-card `phraseFor` `skipCause`→copy mapping (FR-022).
- **Design token**: feature 009's `--amber-soft-line` for the mid band (FR-023).
- **Out-of-frame reliability**: the backlogged read-only diagnostic **#100** ("not-in-frame vs no-clear-read") — the foggy "step back into frame" treatment is built but **gated OFF at launch** and depends on #100 confirming `skipCause === "out-of-frame"` is reliable before the gate flips on (FR-019). A back-reference recording this trigger has been added to issue #100 and its `docs/BACKLOG.md` entry.
- **Constitution**: Principle VIII (009b slot, v1.8.0), the Amendment 7 charting carve-out, and DC-001 (fixed-pixel rendering).

## Constitution alignment — Amendment 7 coverage (recon note, not a clarification)

Confirmed in recon, as requested: **Amendment 7 already covers this live graph.** The carve-out text names "feature 009's employee today-card stress trend" *specifically* as the example, but (a) the Amendment 7 rationale explicitly cites `session-trend.tsx` as existing precedent on `main`, and (b) the carve-out is scoped to the **technique** — bespoke affective micro-visualizations using hand-authored inline SVG with pixel-exact, non-stretched rendering (DC-001) — which this redesign reuses. The current `session-trend.tsx` already operates under it. **Expectation met: this needs at most a one-line clarification adding the live graph as a second named example — not a new principle.** No blocker found; flagged here for the plan phase to decide whether to make that one-line edit.

## Out of scope

- The today-card stress trend (feature 009) — not touched.
- Any change to the read layer, RLS, whitelist, auth, or data model.
- Surfacing any numeric probability.
- The camera stage, op-surfaces, presence/lifecycle logic, or session timeline above/around the graph.
