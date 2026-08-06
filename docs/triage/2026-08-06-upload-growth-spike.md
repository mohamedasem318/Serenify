# Spike — tail-window uploads instead of re-POSTing the whole recording (2026-08-06)

**Verdict: GO.** The single deciding fact: both containers stamp every media chunk with its
**absolute original-timeline position** — webm clusters carry an absolute `Timestamp` element,
fMP4 fragments carry an absolute `tfdt` baseMediaDecodeTime — so a file built from
header + tail-of-chunks reproduces the file-global 2.5 fps sampling grid exactly, with no
re-anchoring. This is what B2 lacked: B2's stop/restart clips each restarted their clock at
t≈0 (unrecoverable phase reset, DECISIONS 2026-06-19); a trimmed continuous recording never
re-zeroes its own timeline. Proven **bit-identical features** on real fixtures (below).

Method: real growing-recording fixtures from 2026-06-19 (gitignored, local-only):
`packages/ml-video/tests/fixtures/continuous/chrome/recording-so-far_{062..301}.webm`
(Chrome VP9, 960×720, 93.2 MB @ 301 s ≈ 2.5 Mbps) and `safari/recording-so-far_062.mp4`
(real-iPhone growing fMP4/avc1, 480×640 rotated −90°, 70.4 MB @ 60 s ≈ 9.4 Mbps). Trims
built by raw byte concatenation (no re-encode), scored via the real pipeline in
`packages/ml-video`. Scratch scripts only; no production code changed.

## Q1 — Decodability and original timeline

- The snapshots are strict byte-prefixes of each other (`cmp` verified), so the accumulated
  blob is append-only and snapshot boundaries are genuine `dataavailable` boundaries.
- **webm/VP9**: header before the first cluster is **154 bytes**. 86 clusters, ~3.36 s / ~1.1 MB
  each (one 10.5 s outlier), all unknown-size (streaming), timestamps absolute 0→297 858 ms.
  A header+tail file cut at a cluster start decodes fully: ffprobe reports **2090/2090 packets
  as an exact contiguous suffix of the full file on the original clock** (230 691→300 163 ms).
  Clusters begin with keyframes (every packet of the trim decoded).
- **fMP4/avc1**: header (`ftyp`+`moov`) is **679 bytes**, then 58 self-contained `moof`+`mdat`
  pairs (~1.02 s / ~1.2 MB each). Header+tail cut at a `moof`: **919/919 packets, exact suffix
  on the original clock** (29 163→59 767 ms).
- Caveat: **OpenCV re-zeroes POS_MSEC on both trimmed containers**; ffprobe preserves the
  absolute clock. The live tail path already derives its grid from ffprobe
  (`pipeline.probe_global_timestamps_fast`), so the absolute timeline is available — but any
  path that trusts OpenCV's clock on a trimmed file (the ffmpeg-absent whole-file fallback,
  `pipeline.py:365-367`) would re-anchor the grid at the cut point (cut offset mod 400 ms ≠ 0)
  and silently reproduce the B2 phase reset. An implementation must fail closed there.
- As-is, current code **rejects** a trimmed upload loudly: `_extract_landmarks_tail` computes
  its seek from absolute duration, over-seeks the short file, and raises
  `FeatureExtractionError` ("seek did not cover the window") → skipped window, never a wrong
  score. The adaptation (seek relative to the file's first timestamp, or skip seeking when the
  file span ≈ the window) is small and local to `pipeline.py`.

## Q2 — Feature fidelity (single-source harness metrics, thresholds unchanged)

Reference = the production read path on the full file; trim side = the same ffprobe-absolute
grid on the header+tail file (the minimal adaptation, emulated in scratch code).

| | kept frames | kept timestamps | landmarks | features | cosine | lbp_maxabs | motion_rel_p99 |
|---|---|---|---|---|---|---|---|
| webm 60 s window, full 301 s vs header+66 s tail (22.5 MB) | 150 = 150 | identical | bit-identical | **bit-identical (max\|Δ\|=0)** | 1.000000 | 0.0000 | 0.0000 |
| fMP4 20 s window, full 60 s vs header+30 s tail (36 MB) | 50 = 50 | identical | bit-identical | **bit-identical (max\|Δ\|=0)** | 1.000000 | 0.0000 | 0.0000 |

(fMP4 used a 20 s window because the fixture is only ~60 s — a 60 s tail wouldn't bite;
thresholds untouched. Incidental: a 20 s window keeps 50 frames and sits exactly at the
coverage gate's `MIN_USABLE_FRAMES = 50` floor — the gate is calibrated for 60 s windows.
Also incidental: FaceMesh detects the rotated iPhone frames fine, 49/50 usable.)

## Q3 — Where you can cut

- **Recorder chunk (`dataavailable`) boundaries are NOT usable cut points for webm**: none of
  the four real snapshot boundaries lands on a cluster start. Safe cuts = cluster starts,
  found by scanning for the 4-byte cluster ID `0x1F43B675` (cluster sizes are unknown-size, so
  scanning is also how the boundaries must be found). Cheap: the scan is over ~3 MB/stride of
  new bytes, or the whole 66 s tail at worst.
- **fMP4**: safe cuts = `moof` starts, found by the trivial box-length walk. Whether Safari's
  `dataavailable` boundaries align with fragments is untestable with one snapshot (unknown).
- **Mid-boundary cuts differ by container**: webm **silently resyncs** to the next cluster —
  decodes with correct absolute timestamps but drops up to one cluster (~3.4 s) at the head,
  no error. fMP4 **fails loudly** — zero packets demux, pipeline raises (skipped window).
  So cutting must locate structural boundaries; the failure mode of getting it wrong is
  silent-but-benign for webm (if the margin absorbs it) and loud for fMP4.

## Q4 — The current stride budget (client)

- Uploads are **strictly serialized**: one in flight, newest window parked in `pendingClipRef`,
  older parked windows overwritten (`monitoring-session.tsx:402-415`, test at
  `monitoring-session.test.tsx:747`). The coalescing drop is that overwrite — silent by
  construction: no log, no reducer action, no counter exists for it. No media bytes are lost
  (each upload is a superset); what's lost is the stride's *reading*.
- The literal "44–47 %" figure appears nowhere in the repo. Modelling the serial drain against
  the measured growth (below) at 10 Mbps uplink and 9–20 s server time gives a drop fraction
  climbing ~17 %→57 %+ across a 5-minute session — 44–47 % is a plausible 3–4-minute point on
  that curve, but it is a derived estimate, not a repo measurement.
- `MediaRecorder.start(10_000)` → one ~3.1 MB chunk per 10 s stride (Chrome, measured:
  `specs/008-stress-inference-service/smoke-tests.md:139-168`, ≈18.6 MB/min). Upload is
  `new Blob(all chunks so far)` — payload grows ~18.6 MB per session-minute; at 10 Mbps,
  transfer alone breaches the 10 s stride inside minute 1 and never recovers.
- Bounded at ~1.6 MB/stride (estimate: header + ~66 s tail at Phase-2-normalised capture
  bitrate; at the 2026-06-19 fixture bitrate the same tail is ~20–22 MB — payload =
  bitrate × ~66 s, session-length-independent either way): transfer ≈ 0.5–4.3 s
  (25→3 Mbps, estimates) — flat forever. Headroom then depends entirely on server time (Q5).

## Q5 — The server's ~8 s

Decomposition (`inference.py:163-274`; measured sources cited by the Q5 sub-report):
multipart receive + temp write (**O(total upload)** — exactly what this spike removes);
ffprobe packet demux 0.1–0.8 s measured flat to ~5 min but **O(elapsed) and run twice per
window** (once in `probe_recorded_seconds`, once in the tail decode — dedupable); tail
remux + decode (bounded, the 1ef0c0c fix); **FaceMesh over ~150 frames + LBP/motion — the
dominant, fixed cost** (a fresh FaceMesh is built and closed every window,
`pipeline.py:280-289`); model predict + one DB row (negligible). Measured flat totals:
~9–13 s dev-laptop (DECISIONS 2026-06-21); ~7–8 s in recent live DEBUG traces. With a
bounded upload, everything becomes O(window), but the fixed extract cost alone is near the
10 s stride on current hosts — cheapest path to margin, in order: (1) dedupe the double
ffprobe, (2) a warm per-worker FaceMesh instead of per-window build/close, (3) if still
short on the deploy target, the deferred rolling decoded-frame buffer (DECISIONS
2026-06-21, ~1.5 s/window est.). Re-measure on the real deploy target before choosing.

## Q6 — Everything unbounded with session length

No session-length cap exists anywhere in code — the only auto-end is 5 min of continuous
face-absence (`presence-monitor.ts:23-25`); a present user runs forever. Growing today:
**client chunk array** (`window-recorder.ts:91`, never trimmed — with tail uploads the client
can drop old chunks after retaining the header bytes, bounding memory); **upload payload**
(unbounded; no request-size limit configured in FastAPI/uvicorn/Dockerfile; the browser
POSTs directly to FastAPI, so no Next.js limit applies; Azure ingress default — commonly
~30 MB-class, unverified in-repo — is the first real ceiling, breached around minute 2 at
the fixture bitrate); **server temp file** (per-request, always unlinked, but sized O(total));
**ffprobe demux** (O(elapsed), flat only proven to ~5 min); **DB rows** (`window_readings`,
one small row per stride ≈ 8.6 k/day — unbounded but negligible; no video is ever persisted).
Bounded already: decode, memory during decode, smoothing buffers (N=4, LRU 1024). The
tail-window candidate bounds all of the first five; DB rows remain the only growth, and they
are the cheapest.

## Next step (not implemented here)

Adapt the tail decode to trimmed inputs (seek relative to first timestamp; fail closed when
the ffprobe path is unavailable rather than falling back to the re-zeroed OpenCV clock), cut
client-side at cluster/`moof` boundaries with a ≥66 s tail, and re-run the fidelity emulation
as a gate. Server statelessness is preserved — each stride's upload stays self-contained.
