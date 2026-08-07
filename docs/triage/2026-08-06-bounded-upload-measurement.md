# Bounded tail uploads — stride-budget measurement (2026-08-06)

Companion to the tail-window spike (`2026-08-06-upload-growth-spike.md`, PR #245) and to
the fix itself (PR B off #246). Everything here is a **measurement on the dev laptop**
unless labelled an estimate; the deploy target must be re-measured before trusting
absolute server numbers (the spike's own caveat, unchanged).

## Method

Real end-to-end session, no mocks anywhere on the measured path:

- **Client**: real Chrome (Playwright chromium headless-shell) running the real app
  (`next dev`), capturing **the real laptop webcam at a verified 1280×720** (the #246
  `ideal` 720p/15 constraints honoured by real hardware) with **Mohamed live in frame
  for the whole run**. Chrome's fake-camera flags were attempted first and did NOT
  engage in this environment (three aborted rig attempts, diagnosed via in-run
  screenshots — the "fake" feed was the physical camera all along), so the accepted run
  embraces it: real camera, real face, real 720p VP9 encoding.
- **Server**: the real FastAPI + ml-video stack, local, `LOG_LEVEL=DEBUG`, local
  Supabase (reset to current migrations). Real RLS-as-user writes, real model predict.
- **Session**: a fresh employee seeded with a REAL anchor (computed by `compute_anchor`
  from the 62 s fixture clip), signed in through the real login, full navigation to
  `/app/monitor`, camera allowed. The **on-device face detector was disabled** for the
  run (its asset load blocked) so the client uploaded every stride un-gated — the
  detector is not part of the upload cycle under measurement, and the server's real
  FaceMesh coverage gate still validated every window's content (67/67 scorable
  windows passed it). Client numbers from the `[monitor]` console lines; server numbers
  from the `window-timing` / `trimmed-tail-decode` DEBUG lines.
- The whole rig — Chrome (encoding 720p), node/Playwright, `next dev`, uvicorn +
  FaceMesh — shares one laptop, so timings carry rig contention a real deployment does
  not have. Named where it matters.

## The accepted run — 13 min live session, real camera, real face

75 uploads: 7 `full` during warm-up (growing 0.74 → 5.93 MB, the pre-cut phase), then
**68 `tail` uploads across ~12 minutes of steady state**. 8 warming outcomes, then
**67 readings, 0 skipped windows** for the entire run.

- **Per-stride payload flat with respect to elapsed time** — the headline criterion.
  Tail payload: min 6.38, median 7.01, max 7.79 MB. Per-minute medians across all 12
  steady-state minutes: `6.83 6.85 7.23 7.35 7.17 6.85 6.92 6.91 6.94 7.03 7.19 7.24`.
  No slope. (Old behaviour at this bitrate: ~55–60 MB per stride by minute 13 and
  climbing ~6 MB/min forever.) Payload ≈ header + 73–79 s of media at the camera's
  ~0.75 Mbit/s VP9 — session-length-independent by construction, now by measurement.
- **Client memory bounded**: JS heap flat at 40 MB at every 30 s sample, start to end.
  `trimmed-tail-decode` shows the server-received file span 73–79 s at every window
  regardless of session age (`decoded≈560–650, kept=150`).
- **Steady-state cycle vs the 10 s stride**: client-observed round-trip (upload +
  server + serialisation) median **7.27 s → ~27 % margin**; p90 11.7 s; max 15.2 s.
  The distribution's tail crosses the stride on this contended laptop: **1 stride of 75
  was coalesced away** (`dropped_total=1` — observable, exactly as designed; it was
  silent-by-construction before). The serialized pump absorbed every excursion without
  backlog — the freshest window always uploaded next, and the reading stream stayed
  continuous (67 readings, none skipped, none stale).
- **Server per-window cost**: probe median 115 ms (p90 181 ms, one 2.7 s outlier);
  extract median 6.19 s, p90 9.2 s; total median 6.62 s, p90 10.6 s. First-quarter
  median 8.3 s vs last-quarter 6.2 s — the machine settling, not growth.

**Verdict against the acceptance criteria**: payload flat ✓; memory bounded ✓; cycle
fits the stride with ~27 % median margin ✓ but the p90 tail crosses it on this rig, so
the dropped-window count was **1, not the target 0** — reported as measured. The drop
mechanism now degrades loudly (counter + log) instead of silently, and the deploy
target (no Playwright/dev-server/encoder contention, but a weaker CPU) must be
re-measured before trusting these absolute server numbers — the spike's standing
caveat. If the deploy target breaches, the deferred rolling decoded-frame buffer
(DECISIONS 2026-06-21, ~1.5 s/window est.) is the named next lever.

## Rig postmortem (for whoever repeats this)

Four attempts preceded the accepted run. `--use-fake-device-for-media-capture` +
`--use-file-for-fake-video-capture` appeared on the browser's command line but the
capture pipeline used the physical webcam regardless (proven by an in-run screenshot of
the self-view showing the room, and by scoring tracking Mohamed's actual presence).
Consequences while undiagnosed: runs "died" whenever he left frame (the client
face-gate correctly stopped uploads), and early windows skipped on an empty chair.
Diagnosis artifacts (per-run logs, screenshots) are in the session scratchpad; the
measurement driver spec is deliberately untracked.

## Per-window server cost — what was taken, what was dropped

- **ffprobe dedupe (taken)**: the identical packet demux ran twice per window (once for
  the <60 s gate, once for the tail grid). Measured on the 301 s fixture: ~130 ms per
  call, O(elapsed) on full uploads. Now probed once (`probe_window_timestamps`) and
  passed through; on tail uploads the probe is bounded too (82–305 ms measured live).
- **Warm per-worker FaceMesh (measured, DROPPED)**: construction costs ~1.1 s only for
  the FIRST build in a process; every later fresh build is ~10 ms (mediapipe caches the
  graph process-wide), so warm+reset would save ~6 ms/window. Not worth touching a
  determinism-critical path for — reset-reuse was verified bit-identical anyway
  (max|Δ| = 0 on the real 150-frame tail) before being rejected.

## Fidelity (both containers, thresholds unchanged)

`packages/ml-video/tests/test_trimmed_tail_upload.py` (local fixtures, real FaceMesh):
header+tail files cut at validated cluster/`moof` boundaries score **bit-identical
(max|Δ| = 0)** to the whole-file read — real Chrome webm at 66 s and 120 s cut depths,
real iPhone fMP4 at a 30 s cut (20 s window; the fixture is only ~60 s). Client-side,
`tail-cutter.fixture.test.ts` proves the cutter's output on the real Chrome webm demuxes
to an **exact contiguous packet suffix on the original clock**.

## What still grows with session length

- `window_readings` rows: one small row per stride (~8.6 k/day) — unbounded, negligible,
  and already covered by the 90-day retention policy (purge job still backlogged, #86).
- The client's **full-mode fallback** (unrecognised container / unparseable stream):
  retains and uploads the whole recording, exactly the pre-fix behaviour. Logged when it
  happens; never expected on the supported recorders.
- Nothing else: client chunk retention, upload payload, server temp file, ffprobe demux
  and decode are all O(window) now.

## Phone measurement — Mohamed's run

On the phone, after PR A+B reach a preview/deploy with the API carrying this change:

1. Open the preview on the phone (Chrome on Android / Safari on iOS), sign in, start a
   **monitoring session** and leave it running **15 minutes**, face in frame.
2. Report **one number**: `dropped_total` from the last `[monitor] upload …` line in the
   remote-debugged console (chrome://inspect for Android; Safari Web Inspector for iOS)
   — or, if console access is awkward, just report whether readings kept arriving every
   ~10 s through minute 15 (a growing gap = drops).
3. If you can copy console lines, the `bytes=` values from minutes 3 and 15 are the
   payload-flatness check — they should be within a few hundred KB of each other.
