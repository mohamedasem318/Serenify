# Mobile capture — diagnosis (2026-08-05)

> **Status (2026-08-06): the Phase-2 work was split across two PRs.** The constraints half
> — shared `ideal` 1280×720@15 on both recorders, the `docs/MODELS.md` capture-conditions
> line, and the growing-fMP4 decode gate — ships via **PR #246**, alongside this document.
> The **container half and the capture-probe tooling** were parked pending a 720p
> wire-weight measurement; that measurement was taken and **PR #243 shipped them on
> 2026-08-07** (merged as `a5c8d3d`), with the preference narrowed from fMP4-*first* to
> fMP4-*only* on Apple WebKit. Where Phase 2 below says the fix "lands", read: both
> halves have now landed. The measurement did **not** support the wire-weight rationale —
> see the correction at "A refinement of #89's mechanism" below.

Decision document for the iOS-Safari / constraint-capping work. Phase 1 established the
facts and shipped the tester probe; Phase 2 (below, same day) reads the five device
probes and lands the fix.

## Q1 — does the server normalise resolution and frame rate before extraction?

**Frame rate: YES, normalised.** Frame selection samples onto a fixed **2.5 fps grid**
before any feature touches a pixel (`packages/ml-video/src/ml_video/pipeline.py`):
VFR browser capture goes through the timestamp sampler (one frame per 400 ms bucket,
CAP_PROP_POS_MSEC-driven, container fps ignored); trustworthy-CFR input goes through the
legacy index path targeting the same ~2.5 fps. LBP-TOP's temporal planes and the motion
deltas are computed on the *kept* 2.5 fps frames only. **Consequence: capping capture
frame rate with `ideal` does not move the model's temporal input**, provided capture stays
comfortably above 2.5 fps (a cap at 15–30 fps is temporally invisible to the model; only
starving buckets below ~5 fps would).

**Resolution: dimensionally normalised, distributionally NOT.** Each ROI (mouth, eyes) is
cropped from landmark coordinates and resized to a fixed **64×64** before LBP
(`features.py::_roi_crop`) — but two things still scale with capture resolution:

1. the crop's **native pixel size** (a mouth ROI from 640×480 may be *smaller* than 64×64
   → upscaling, different texture statistics than the downscale regime the model saw);
2. the **10 px margin is fixed in source pixels**, so the ROI's content framing changes
   proportionally with resolution.

There is **no full-frame resize** anywhere between upload and extraction. The training
clips' resolution is **not recorded in the repo** (metadata.json carries only fps/ROI
params) — the floor has to be read off the StressID source data before any resolution cap
is chosen. Known operating points today: laptop Chrome captures ~**960×720**, the known
iPhone captures **480×640 portrait** (`packages/ml-video/tests/fixtures/PROVENANCE.md`).

**Anchor coupling (binding for Phase 2):** scoring runs on `delta = window − anchor`
(`apps/api/app/services/inference.py`), and the anchor comes from the user's own
calibration clip. Any capture cap must therefore apply **identically to calibration and
monitoring**, and users calibrated pre-cap would monitor against a mismatched anchor — a
silent shift with no error message. A cap that lands must state what happens to existing
anchors (at minimum: recommend recalibration; we cannot detect the mismatch server-side).

## Q2 — where does iOS Safari actually fail?

**Established (from committed evidence, not conjecture): the failure is server-side decode
of iOS Safari's un-finalized growing webm — issue #89**, smoke Run 4 (2026-06-22, real
iPhone over HTTPS, `specs/008-stress-inference-service/smoke-tests.md`):

- `probe_recorded_seconds()` (ffprobe packet read) succeeds at 9/19/29/39 s, then
  **throws from ~40 s on** → every window `skipped: our-side` → the session never reaches
  the 60 s gate → **0 readings**. Auth held (0×401); uploads all returned 200.
- The other three candidates are ruled out for that device: **constraint rejection** —
  impossible, production calls `getUserMedia({video: true, audio: false})` with **no
  constraints at all** (`monitoring-session.tsx`); **MediaRecorder support** — capture
  itself worked (calibration passed end-to-end on the same phone; T009 proved the
  *finalized* iOS webm AND fMP4 both decode to (2958,)); **transport/auth** — disproved by
  Run 4's 200s/no-relogin trace.
- iOS also recorded **sub-realtime** (media clock ~39 s at ~75 s wall, ratio ≈ 0.52) —
  unexplained, matters for any latency reasoning.

**Not established, device-dependent, and what the tester probe answers:**

1. Which container the production webm-first negotiation (`pickWindowMimeType`) actually
   picks on the tester's iPhone — newer Safari claims WebM support, which *routes iOS into
   the broken decode path*; older Safari would fall through to mp4 and may not hit #89 at all.
2. Whether Safari's **mp4 recorder emits timeslice chunks** (historically dataavailable
   only fired on stop). This decides the shape of the fMP4 fix: container swap only, vs
   restructuring the continuous-upload design.
3. What the camera grants by default and under `ideal` constraint sets (informs any cap).
4. Whether the sub-realtime media clock reproduces, and whether the stream mutes/suspends
   mid-capture.

## The probe

`/capture-probe` — flag-gated (`NEXT_PUBLIC_CAPTURE_PROBE=1` baked at build; unset
everywhere normal → 404 in production and dev), unlinked, noindex, no account needed.
Registered in both Permissions-Policy touchpoints in `next.config.ts` and given a scoped
`media-src blob:` CSP allowance in `proxy.ts` (needed to measure the recorded blob's
duration locally). **Fully on-device: no fetch, no Supabase, nothing persisted** — the
only output is a text report the tester copies into a message themselves. Payload is
device/API capability only (UA, mime support matrix, granted camera settings, chunk
timing/byte counts, media-vs-wall clock, mute/visibility events). No frames, no audio, no
identifiers.

Tester flow: open the link → tap **Start the check** → hold the phone normally for ~2
minutes (75 s production-parity webm recording + 25 s forced-mp4 recording) → tap **Copy
the results** → paste into a message. Screen wake-lock is requested so iOS auto-lock
doesn't kill the run.

**Desktop control run (Chromium, fake camera, this machine)**: production pick
`webm;codecs=vp9`, 8/8 timeslice chunks over 75 s, media/wall ratio **0.997**, forced-mp4
emitted timeslice chunks. Use this as the healthy baseline when reading the tester's
report.

## Deployment

The flagged build is deployed as a Vercel **preview** (URL in the PR). Preview
deployments sit behind Vercel SSO, so before sending it to the tester Mohamed needs one
click: Vercel dashboard → the deployment → **Share** → create a Shareable Link (or enable
Protection Bypass for Automation and append its query param). Production (`serenify.tech`)
is untouched — the flag is unset there, and even after this branch merges the route stays
a 404.

## Phase 2 implications (for when the tester data is back)

- Frame-rate capping with `ideal` is **allowed** by Q1 (server already resamples to 2.5 fps).
- Resolution capping is **not yet cleared**: establish the StressID training resolution +
  face-crop pixel floor first, and decide the existing-anchor story (see Q1).
- The iOS fix direction stays #89's: prefer fMP4 on iOS *or* harden
  `probe_recorded_seconds` — which one (or both) depends on probe answers 1–2 above.
- Any change to capture constraints must hit calibration and monitoring together.

---

# Phase 2 — probe findings and the landed fix (2026-08-05)

Five probe runs: my laptop (poor webcam) + sister's Zenbook (good webcam) as a
same-browser matched pair, Galaxy S24 Ultra, Galaxy S25 Ultra, iPhone 15 Pro Max
(Safari 26.5.2). Raw reports stayed off-repo (they carry UA strings); the decisive
numbers are below.

## What the probes established

**Container (the #89 question).** Safari 26 reports `isTypeSupported = true` for ALL
webm types, so the production webm-first negotiation picks `webm;codecs=vp9` on iOS —
Phase 1's hypothesis confirmed, iOS was routed straight into the broken decode path.
And Safari's mp4 recorder **emits timeslice chunks on schedule** (10.0 s / 20.0 s /
25.0 s; `avc1.42000a`) with an **exactly realtime media clock** (25.0 s media / 25.0 s
wall) — so the fix is a container preference, not an upload redesign. Both Galaxys and
both laptops are healthy on webm (media/wall 0.996–0.999, 8/8 on-time chunks): webm
stays their path.

**Resolution (the capping question).** Under today's unconstrained `getUserMedia`,
**4 of 5 devices sit at 480p-class** — Zenbook 640×480 (despite a 1080p-capable
camera), S24U/S25U 480×640, iPhone 640×480 — i.e. *below* the 1280×720 training
capture, in the upscaling regime at the 64×64 ROI resize. Under `ideal` 1280×720,
**every probed device grants 720p-class**: both laptops and both Galaxys literal
1280×720, the iPhone portrait 720×1280 (the same pixel budget, orientation-swapped).
Every device granted 15 fps when asked. The matched laptop pair shows the 480p default
is a *browser/driver* default, not a device limit — so the probes support 720p as the
target; nothing in them argues for a different number.

**Sub-realtime media clock (the June ≈0.52 signature).** Could **not** be measured on
iOS webm — Safari reports duration **0** for its own webm recording (itself a signal
of how badly Safari handles this container). On the mp4 path it is affirmatively
cleared: 25.0 s media / 25.0 s wall. Since iOS now leaves webm entirely, the concern
dissolves with the container; if a future iOS session again warms up implausibly
slowly, suspect the clock first and check `probe_s` against wall time in the DEBUG
window trace.

**A refinement of #89's mechanism.** The real June growing-iOS-webm fixture
(`recording-so-far_061.webm`) probes FINE at rest (59.8 s, no throw) — so
un-finalized-ness alone did not break ffprobe. The live failure implicates the
*transport scale* of iOS webm: it records at ~4.8 Mbit/s (45 MB per 75 s
recording-so-far, re-uploaded every 10 s), the size class where the June tunnel
dropped/truncated POSTs. ~~Safari's mp4 runs ~5× lighter (2.2 Mbit/s at the same
settings). The container swap addresses both the decode fragility and the wire weight.~~

> **Corrected 2026-08-07.** Both figures above were taken at **480×640** — the probe's
> `applyConstraints({})` quirk (noted below) meant every device recorded at 480p, not at
> the 720p the fix ships. The ratio does not scale. Re-measured at the shipped operating
> point, iOS Safari fMP4 is **~40 MB/60 s (~5.4 Mbit/s)** — essentially the same as the
> WebM probe's ~45 MB. **No wire-weight advantage is claimed for fMP4 at 720p**; the
> container swap is justified by decode correctness alone. See `docs/DECISIONS.md`
> 2026-08-07.

**S25U note (out of scope, recorded for the face-gate bug).** The S25U probe is
byte-for-byte structurally identical to the S24U's — camera opens, 720p granted,
chunks flow, ratio 0.997. Whatever breaks its face gate, it is not capture.

**Probe quirk worth keeping.** `applyConstraints({})` does NOT restore defaults on any
of the five devices (all kept the last-applied 640×480@15) — the probe's "main
recording" therefore ran at 480p@15 everywhere. Production is unaffected (constraints
are passed at `getUserMedia` time), but never trust `applyConstraints({})` as a reset.

## The landed fix

1. **Shared capture module** — `apps/web/lib/capture/constraints.ts`, the single
   source both recorders use (scoring is `window − anchor`; the two paths must never
   diverge):
   - `ideal` **1280×720 @ 15 fps** (training-exact; never `exact` — Safari), wired
     into the calibration recorder (all three acquire sites, device pin preserved)
     and the monitoring orchestrator.
   - **Engine-aware container negotiation**: webm-first everywhere except Apple
     WebKit (`navigator.vendor` — frozen, engine-accurate), which goes
     fMP4-first (`video/mp4;codecs=avc1.42E01E` → `video/mp4`). Both recorders
     delegate to it.
2. **Server-side proof for the new container** —
   `packages/ml-video/tests/test_growing_fmp4_decode.py`: the REAL iPhone growing
   fMP4 fixture passes probe (59.8 s) + O(stride) tail decode (149 kept frames, 146
   usable face rows) + the full 2958-d feature build; synthetic Safari-layout
   prefixes (10/40/50/70 s, fragment-boundary AND mid-fragment cuts) pass the
   warming-up gate and tail decode. No server code change was needed: the routers
   already strip codec parameters, `WINDOW_MEDIA_SUFFIX` already maps `video/mp4`.
3. **Training conditions recorded** — `docs/MODELS.md` now carries the StressID
   capture line (Logitech QuickCam Pro 9000, 1280×720@15) so it is never re-derived.

## Latency comparison — pre-cap production controls (2026-08-05)

Measured by Mohamed on production (serenify.tech, OLD code: unconstrained
`getUserMedia`, webm, 30 fps defaults), same account, fresh baseline — the numbers the
Phase-2 build must beat or match after merge:

| Device | Time to first reading (pre-cap control) |
|---|---|
| Laptop, Chrome | **01:37** |
| Galaxy S24 Ultra, Chrome | **01:57** |

Floor for context: the 60 s window + 4-window smoothing warm-up puts the theoretical
minimum around ~01:30 at the 10 s stride; the post-merge comparison should use the same
account/baseline procedure. (A separate one-off during these runs — a production session
falling back to the camera prompt at 01:20 — is filed as #244, not part of this
comparison.)

## Existing anchors (decided: forced recalibration, pending one migration)

All current users calibrated at pre-cap defaults (mostly 480p-class), so their anchors
mismatch capped monitoring. Per the Phase-2 brief the resolution is a **one-time
forced recalibration** — operationally: after this merges, null the anchor columns for
existing users; the app's existing `no_anchor` → calibrate-first flow forces
recalibration under the new constraints with zero new code. Persisting capture
settings alongside the anchor (so a future capture change is detectable server-side)
needs a migration — the proposed shape is in the PR, **not written**, per the stop
instruction.

---

# Phase 3 — the bitrate ladder (instrumentation added 2026-08-07)

**Status: built, not yet run on a device.** This section describes the measurement; it
records no findings.

## The question

iOS Safari records H.264 at ~5.4 Mbit/s at 1280×720@15, against desktop Chrome VP9 at
~0.75 Mbit/s at the same operating point. At that weight an iOS monitoring session
produces zero scored windows — uploads arrive carrying under 60 s of media and are gated
`warming_up`.

`videoBitsPerSecond` has **never been set anywhere in `apps/web`** — the 5.4 Mbit/s
figure is the encoder default, and WebKit's response to an explicit target is simply
unmeasured. If WebKit honors a target near 1–2 Mbit/s at usable quality, the fix is a
one-line recorder option inside the current architecture and a much larger piece of work
becomes unnecessary.

## The ladder

A second, independent run on the same `/capture-probe` route (`Start the quality
check`). Seven steps × 25 s ≈ 4 minutes: **unset (encoder default), 3.0, 2.0, 1.5, 1.0,
0.75, 0.5 Mbit/s**. 0.75 is Chrome VP9 wire parity; 0.5 is an expected-failure anchor, so
the ladder brackets the usable floor from below as well as above. Container is
production's own pick (fMP4 on Apple WebKit).

**The ladder holds the production operating point and verifies it rather than assuming
it.** The camera is opened with `captureVideoConstraints()` (ideal 1280×720@15) and
`applyConstraints` is never called — the capability run's mid-probe `applyConstraints({})`
reset is what silently recorded 480×640 once and produced a wire-weight claim that had to
be withdrawn (#249). Granted track settings are sampled **before and after every step**;
a step whose resolution isn't 720-class, or that drifts mid-recording, is marked
`void: true` with a reason and its numbers must not be read as a result.

## Reading the report

`effectiveMbps` (totalBytes × 8 ÷ mediaSeconds) is the honoring answer.
`reflectedVideoBitsPerSecond` — what `MediaRecorder` reports back — is recorded as a
separate field and proves nothing: this engine's self-report is exactly what
`isTypeSupported` already got wrong, claiming WebM support on iOS and then producing
undecodable output. `mediaToWallRatio` and `maxChunkGapMs` are there to catch a target
that appears to work by stalling the encoder instead. `ladderSummary` carries one
readable line per step.

## Clips

The bytes half is answered on-device; the **quality** half is not — client-side detection
is not the server's FaceMesh, so landmark usability has to be judged offline by the real
pipeline. Three clips are retained in memory: the unset baseline, 1.50 Mbit/s (safe
candidate) and 0.75 Mbit/s (Chrome parity). If a retention target comes back void, the
next-higher valid step stands in and the report records the substitution. Non-retained
recordings are released as the ladder descends, so peak memory stays ~25–35 MB.

Retrieval is the tester's own OS share sheet (`navigator.share` with a file, falling back
to a download) — same posture as the text report: **the page transmits nothing, and the
tester chooses what to send and to whom.** The on-screen instruction is Save to Files →
attach in WhatsApp as **Document**; sending as a video re-encodes the clip and destroys
the measurement.
