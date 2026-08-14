# Smoke Tests: Recommendations — "Things that might help" (014)

**Status: OPEN — no results recorded yet.** Authored at the tasks stage (plan
§Constitution VII); results are recorded **inline in this file before
`014-recommendations` merges to `main`** (Principle VII gate 5). Owner: **Mohamed**.

These are the checks automation cannot catch in CI: the live RLS posture, anything
needing a **real camera** (Playwright's fake-camera flags do not engage in this repo),
the **real provider**, and judgement calls on the rendered surface. Each entry carries
three fields — **Check** (what must be true), **Method** (how it was actually verified —
agent-run checks state their method in full; Mohamed's attestations say so), and
**Observations / Verdict** (left blank until run). A failed check is recorded as a
failure, not softened.

Task cross-references: T003 → ST-1 · T020 → ST-2/ST-3/ST-4 · T027 → ST-5 · T035 runs
the file.

---

## ST-1 — Live RLS probe on `recommendation_picks`

**Check**: the owner reads their own rows; a second employee, a team-lead, and an admin
each read **zero** rows; `anon` errors; an UPDATE on an identity column (`item_id`)
fails on grant; DELETE is impossible for every role (SC-003, FR-025,
contracts/recommendation-storage-rls.md §Verification).

**Method**: local Supabase, psql per-transaction impersonation — `SET LOCAL ROLE` +
`set_config('request.jwt.claims', …, true)` (the feature-012 validated method). Seed one
pick row as user A; probe as A, as user B, as a team-lead, as an admin, as `anon`;
attempt `UPDATE … SET item_id` and `DELETE` as A. Transcript pasted below.

**Observations / Verdict**: _not run yet._

---

## ST-2 — SC-005: "Yes, that's me" resolves to the pick, in-session and at home

**Check**: drive a real monitoring session to sustained Tense on a real camera; answer
"Yes, that's me". The prompt resolves to the recommendation, **not** a Ren handoff; the
`ConfirmedPickCard` is reachable in-session with **no navigation** (FR-011), in the
`Notification` slot the prompt occupied; the home card then shows the **identical pick,
identical words**, rendered prominently (state 4, the mock's five moves — US2
scenarios 1–2).

**Method**: real device, real camera, local stack (or the deployed stack). Compare the
in-session card's title/why-line/duration against the home card's, word for word.

**Observations / Verdict**: _not run yet._

---

## ST-3 — 012's other two answers are untouched on the real surface

**Check**: on the live confirmatory prompt, "No, I'm okay" behaves exactly as 012
shipped it (false-alarm path, next-session suppression) and "Maybe — talk about it"
still opens Ren (`confirmatory_maybe`), including D-6 dwell feel and the
explicit-answer-only budget (FR-012, SC-006's live half — the pinned suites cover the
reducers; this covers the surface).

**Method**: same live session setup as ST-2, one run per answer path.

**Observations / Verdict**: _not run yet._

---

## ST-4 — FR-014: a new confirmed detection beats a pending outcome prompt

**Check**: with an outcome prompt pending on the home card, a new confirmed detection
removes the stale prompt **without recording an answer** and the confirmed pick takes
over (in-session and at home). If the prior episode had closed on an outcome, the new
episode has a fresh budget.

**Method**: live session; needs the timing to be engineered (answer nothing on the
outcome prompt, then drive a second sustained-Tense confirmation). Verify no `outcome`
was written for the abandoned prompt's pick row (owner query).

**Observations / Verdict**: _not run yet._

---

## ST-5 — Reflective copy against the real provider, and its collapse

**Check**: with apps/api up and a real `GROQ_API_KEY`, a state-2 (or state-9) reflective
line generates, passes validation, and **paints exactly once** — cache hit on re-render,
no flip under the reader; every fact in it (counts, times, bands) appears in the
precomputed facts. Then with the provider down (kill apps/api or unset the key), the
deterministic fallback renders inside the budget and **nothing on the surface reads as
an error** (FR-021, FR-030, SC-004's live half).

**Method**: agent-run or attested; observe the 800 ms skeleton behaviour on a cold
cache, then reload (cache hit — instant), then kill the provider and force a state
change.

**Observations / Verdict**: _not run yet._

---

## ST-6 — The rendered card at 360 px, dark mode, and reduced motion

**Check**: the card's states — at minimum 3, 4, 5, and the retirement line — hold the
approved mock's layout at a **360 px** viewport (the mock's wrap point), in **both**
palettes, with 44 px touch targets; under `prefers-reduced-motion` the result ring and
skeleton are static and state transitions do not animate. No crimson, no exclamation
marks, no band chip on the card (Principle V / VI, plan §UI design contract).

**Method**: real device or devtools emulation across the states; Mohamed's eye on the
mock fidelity is the verdict that counts (attestation — and says so).

**Observations / Verdict**: _not run yet._
