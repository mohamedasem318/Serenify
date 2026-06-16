# Smoke Tests: Calibration Capture Quality (006)

**Human-validated, flow-level checks** for behaviour CI cannot honestly exercise: a
**real** camera + a **real** face through the **real** mediapipe extraction and the
**real** usable-face-coverage gate. The unit/boundary tests already prove the gate logic
and the threshold separation on committed `.npy` fixtures (no mediapipe in CI); these
checks prove the **end-to-end flow** — that the gate actually fires (or doesn't) on a
live recording and that the user lands on the right surface with the right chip. Per
Constitution Principle VII / DECISION-26, these are **run by hand, not mocked green**.

**Account to use**: a real (non-demo) **employee** account whose baseline is **not yet
set** — signing in lands on `/app` with the calibration banner. Demo cohort users are
pre-anchored and skip the flow.

**Setup**:
- Backend up (the **pinned** ml-video env — Python 3.12, `mediapipe==0.10.13`):
  `cd apps/api && uv run uvicorn app.main:app --port 8000` (so `/healthz` is ready and
  `/anchor` runs the real extraction + gate). Web: `cd apps/web && npm run dev`.
- A real webcam. Record each minute on `/app/calibrate` (click **Set baseline** in the
  banner, or open the route directly).
- **Privacy spot-check (do once, during §1)**: open DevTools → Network, run a minute, and
  confirm the only video egress is the single final `POST /anchor`; on a rejection,
  confirm the 422 body is exactly `{"error":"extraction_failed","reason":"insufficient_face_frames"}`
  — **no `usable`/`kept`/`fraction`, no digits** (FR-016 / Principle I). Counts appear
  only in the **uvicorn server log** (`coverage reject: usable=… kept=… fraction=…`).

**How to record**: put your initials + the date in **Notes**, mark **Pass/Fail** for each
row. A failure must be filed and resolved (or explicitly accepted with a rationale) before
merge to `main`. Mohamed signs off the table.

---

## §1 — Thin capture (the bug) → rejected with the face-absence chip

**This is the core regression check** — the exact 005 smoke failure that motivated 006.

**Action**: Start a calibration minute and keep your **face out of frame for almost all of
it** — let the detector see your face for only **~2 seconds** of the 60 s (e.g. step out of
frame, or point the camera away, then briefly appear). Let the full minute elapse and submit.

**Expect**:
- The **005 failure screen** ("We couldn't set your baseline that time"), **not** the
  success screen — it must **NOT** say "Your baseline is set".
- The cause chip is the **face-absence** chip: *"We couldn't see your face for enough of
  that recording — let's try again."*
- It must **NOT** be the **"our-side"** chip (*"This one was on our side…"*) — even though
  the on-device framing detector may have been unavailable, the **server** reason
  (`insufficient_face_frames`) takes precedence and gives the correct, specific message.
- HTTP **422** with body `{"error":"extraction_failed","reason":"insufficient_face_frames"}`.

| Browser | Result | Notes (initials / date) |
|---|---|---|
| Chrome  | ✅ Pass ☐ Fail | MA / 2026-06-16 |
| Firefox | ☐ Pass ☐ Fail | |
| Safari/WebKit | ☐ Pass ☐ Fail ☐ N-A | |

---

## §1b — Half-present minute (~30 s absent) → rejected (the boundary case)

**The calibration boundary** — the clip that set `MIN_COVERAGE_FRACTION = 0.65` (DECISION-32).
The `half` fixture measured **0.513 coverage** (77 usable / 150 kept) and is a **documented
reject**: a baseline where the face is present for only about half the minute is incomplete and
must not anchor every downstream delta.

**Action**: Record a full minute but keep your face **present for only about half of it** — in
frame and looking at the screen for roughly the first ~30 s, then step out of frame (or turn
fully away) for the remaining ~30 s. Let the full minute elapse and submit.

**Expect**:
- The **005 failure screen**, **not** the success screen — it must **NOT** say "Your baseline is set".
- The **face-absence** chip: *"We couldn't see your face for enough of that recording — let's try again."*
- HTTP **422** with body `{"error":"extraction_failed","reason":"insufficient_face_frames"}`.
- If this **accepts**, the threshold is too lenient — **file it** (coverage ≈ fraction-of-minute-
  present, so a ~0.5 capture must fall below the 0.65 line).

| Browser | Result | Notes (initials / date) |
|---|---|---|
| Chrome  | ☐ Pass ☐ Fail | |
| Firefox | ☐ Pass ☐ Fail | |
| Safari/WebKit | ☐ Pass ☐ Fail ☐ N-A | |

---

## §2 — Genuine full minute → success (no false reject)

**Action**: Record a **real full minute sitting normally** — face in frame the whole time,
looking at the screen (glasses fine, per DECISION-33).

**Expect**: **success** — "Your baseline is set". The gate does **not** fire; the baseline
is written once on success.

| Browser | Result | Notes |
|---|---|---|
| Chrome  | ☐ Pass ☐ Fail | |
| Firefox | ☐ Pass ☐ Fail | |
| Safari/WebKit | ☐ Pass ☐ Fail ☐ N-A | |

---

## §3 — Realistic minute with natural look-aways → success (no false reject at the flow level)

This is the **SC-002 no-false-reject** check on a real recording (the fixture proved it on
`.npy`; this proves it end-to-end).

**Action**: Record a realistic calm minute the way a real user would — **natural brief
look-aways**: glance down/away a few times, shift in your seat, look at your keyboard — but
stay seated and present (the face leaves the frame only momentarily, not for most of the
minute).

**Expect**: **success** — "Your baseline is set". The brief glances must **not** trip the
gate (FaceMesh holds the face through seated glances — DECISION-32; the good clips measured
1.000, well clear of the 0.65 line). If this **rejects**, the threshold is too strict for real
use — **file it** (the accept-side absence tolerance — ~15–20 s of a 60 s minute — is
extrapolated from the validated linearity, not directly measured; revisit `MIN_COVERAGE_FRACTION`
downward against real-user data).

| Browser | Result | Notes |
|---|---|---|
| Chrome  | ☐ Pass ☐ Fail | |
| Firefox | ☐ Pass ☐ Fail | |
| Safari/WebKit | ☐ Pass ☐ Fail ☐ N-A | |

---

## §4 — Control: off-centre-but-detected → behaves exactly as before this gate

**Action**: Record a minute where your face is **clearly off-centre** (sit to one side / low
in frame) but **continuously visible** to the camera for the whole minute.

**Expect**: This gate does **not** change anything here — the usable-face-coverage gate keys
on *detection*, not *framing*. Outcome is whatever 005 did: a success, or (if the existing
framing telemetry dominated) the existing **out-of-frame** chip — **never** the new
face-absence chip. Confirms the gate is additive and the existing framing chips are unchanged.

| Browser | Result | Notes |
|---|---|---|
| Chrome  | ☐ Pass ☐ Fail | |

---

## Sign-off

- [ ] §1 thin → 422 + face-absence chip (not "baseline set", not "our-side")
- [ ] §2 full minute → success
- [ ] §3 realistic look-aways → success (no false reject)
- [ ] §4 off-centre-but-detected control → unchanged behaviour
- [x] Privacy spot-check: 422 body categorical, no counts on the wire; counts only in server log

**Signed off (Mohamed)**: ____________________  **Date**: ____________
