# Smoke tests — Stress Inference Service (008)

Human-validated checks (Constitution Principle VII). **This session covers only Phase 1 +
Phase 2 (the windowing validation).** The full feature smoke matrix (camera permission on real
browsers, mobile 360 px, reduced-motion, privacy, etc.) is added in Phase 8 (task T054)
once the feature is built.

> **✅ WINDOWING RESOLVED (2026-06-19) — B2 rejected; continuous single-stream adopted.**
> Windowing is **continuous single-stream upload + server tail-extract of the last 60 s**, which
> is **faithful by construction** (a real continuous 60 s clip through the already-validated
> single-clip extraction) — so there is **no fidelity gate**. The remaining real-device check
> (Phase 2 of the revised `tasks.md`) is light: the continuous capture/upload/tail-extract path
> **works and keeps up** on real Chrome + Safari/iOS (per-stride server time within the 10 s stride
> across a 5-min session). See `docs/DECISIONS.md` (2026-06-19 — *feature 008 windowing DECISION*)
> and `research.md` R-5/R-7. The retired B2 multi-clip evidence (Steps A–F, the measured numbers
> that drove this decision) is preserved at the end under **"Superseded (B2, retired)"**.

---

## T001 — ml-video environment check ✅ (agent, automated)

- **Interpreter**: `packages/ml-video/.venv/Scripts/python.exe` — **Python 3.12.13** (the
  pinned env; mediapipe 0.10.13 has no 3.13 wheel).
- **Public surface imports**: `compute_anchor` (now with the additive **`tail_seconds`
  tail-window option**, T005), `Predictor.predict_delta`, `load_model` import cleanly.
  *(The B2 `compute_anchor_multiclip` / `motion_features_seamaware` symbols are **retired** — see
  T004 / "Superseded" below.)*
- **Startup contract** (`load_model()`): scaler `n_features_in_ == 2958`, classes `[0, 1]`,
  `model_version == "serenify-video-lbptop-motion-rf-calibrated@2.0.0"` — PASS
  (`tests/test_pipeline_fixtures.py::test_load_model_satisfies_startup_contract`).
- **Full ml-video suite**: green on the pinned env after the T004 retirement + the T005/T006
  tail-window work (the `test_multiclip_fidelity.py` skip is gone — that file is retired). Record
  the current `pytest packages/ml-video/tests` + ruff result on each run below.

---

## 🚦 Windowing validation (continuous) — HUMAN, real devices (T004 → T009)

This is the **active** procedure. The 60 s window is **faithful by construction** (a real
continuous clip through the already-validated single-clip extraction), so there is **no fidelity
gate** — the only open question is whether the continuous capture/upload/tail-extract path **works**
and **keeps up** on real devices. It stays the **Safari/iOS pre-production gate**.

The agent cannot drive a webcam or a real iPhone — a human runs these. Everything is local;
**raw video is never committed** (the fixtures `.gitignore` excludes `*.webm`/`*.mp4`/… so your
recordings stay untracked). **Use real browsers, not Playwright** (Playwright has given false
cross-browser capture/timing confidence — see the e2e-load-timing flake history).

### Step A — record continuous fixtures (T007: real Chrome webm + real Safari/iOS fMP4)

Use the continuous-capture harness (`_scratch-008-continuous-spike/`, T002): **one continuous
`MediaRecorder`** in timeslice mode (no stop/restart), with a button that uploads/downloads the
**contiguous recording-so-far** at each ~10 s stride.

```bash
python -m http.server 8009 --directory _scratch-008-continuous-spike
# open http://localhost:8009 in real Chrome (desktop); for iOS use real Safari over HTTPS/LAN
```

Run a **~5-min continuous session**, capturing the contiguous recording-so-far at several strides
(e.g. t≈60/120/180/240/300 s). Drop the captures under:

```
packages/ml-video/tests/fixtures/continuous/chrome/   (recording-so-far_060.webm … _300.webm)
packages/ml-video/tests/fixtures/continuous/safari/   (recording-so-far_060.mp4  … _300.mp4)
```

(Safari/iOS emits **fragmented MP4**, not webm — the fragile encoder. Raw video gitignored.)

### Step B — T008 works-and-keeps-up validation (per browser, per stride)

For **each** browser and **each** stride sample:

- **(works)** the uploaded contiguous recording-so-far is **decodable** —
  ```bash
  cd packages/ml-video
  .venv/Scripts/python tests/helpers/decode_smoke.py tests/fixtures/continuous/chrome/recording-so-far_300.webm
  # repeat for safari/*.mp4
  ```
  every line is `OK <n_frames> <path>` (exit 0) — and `compute_anchor(clip, tail_seconds=60)`
  returns a `(2958,)` vector.
- **(keeps up)** the per-stride **server time stays within the 10 s stride** across the 5-min
  session. **Record the decode-to-tail time and the extract (MediaPipe + LBP) time SEPARATELY**
  (not just the combined total) at t≈60/120/180/240/300 s — worst case is the last (~300 s
  decoded). The split is required so a breach can be attributed to the right component **without
  re-running** the 5-min session.

Record the per-component, per-stride times per browser:

| Browser | stride (s) | decode-to-tail (s) | extract MP+LBP (s) | total (s) | (2958,)? | within 10 s? |
|---|---|---|---|---|---|---|
| Chrome (webm) | 60 |  |  |  | ☐ | ☐ |
| Chrome (webm) | 120 |  |  |  | ☐ | ☐ |
| Chrome (webm) | 180 |  |  |  | ☐ | ☐ |
| Chrome (webm) | 240 |  |  |  | ☐ | ☐ |
| Chrome (webm) | 300 |  |  |  | ☐ | ☐ |
| Safari/iOS (fMP4) | 60 |  |  |  | ☐ | ☐ |
| Safari/iOS (fMP4) | 120 |  |  |  | ☐ | ☐ |
| Safari/iOS (fMP4) | 180 |  |  |  | ☐ | ☐ |
| Safari/iOS (fMP4) | 240 |  |  |  | ☐ | ☐ |
| Safari/iOS (fMP4) | 300 |  |  |  | ☐ | ☐ |

### Step C — 🚦 T009 VALIDATION CHECKPOINT (light)

**Pass** = T008 **works and keeps up** on Chrome **AND** Safari/iOS → unblock Phase 3+.

A **keep-up breach is NOT a windowing failure and never re-opens the windowing approach** — it is
a **production-deploy concern only** (localhost/demo is unaffected and the build proceeds). There
is **no fidelity outcome to fail** (faithful by construction). If a breach occurs, **diagnose which
component breached** using the separately-recorded times:

- breach that **grows with session length** (late strides ≫ early strides; decode-to-tail
  dominates) ⇒ the lever is the **deferred server-side rolling decoded-frame buffer** (decode only
  the newest increment; research R-5) — the *decode* side;
- breach **present even early / dominated by the constant extract time** (MediaPipe + LBP) ⇒ the
  lever is a **slower reading cadence** (FR-016 non-blocking + D-3 smoothing tolerate variable
  arrival) or **GPU MediaPipe**, **not** the buffer — the *extract* side.

Record the outcome **with the per-component attribution** here and note it in `docs/DECISIONS.md`.

| Date | Chrome works+keeps-up | Safari/iOS works+keeps-up | breach component (if any) | Verdict |
|---|---|---|---|---|
|  | ☐ | ☐ |  | ☐ |

**Checkpoint**: continuous windowing proven on real devices → feature build (Phase 3+) may begin.

---

# Superseded (B2, retired)

> Everything below is **historical evidence**, not the active procedure. **B2 (standalone
> stop/restart clips + multi-clip frame-concat) was REJECTED** (windowing D-2 reversed → continuous
> single-stream upload, adopted above). The multi-clip fidelity HARD GATE
> (`tests/test_multiclip_fidelity.py`) and the package symbols `compute_anchor_multiclip` /
> `motion_features_seamaware` are **retired** (feature-008 T004). **The retirement took resolution
> (a): the assembly logic was *inlined* into the single-source diagnostic
> (`tests/helpers/singlesource_fidelity.py`), so the active package source carries ZERO retired B2
> code** and the diagnostic + single-source fixture stay runnable as the recorded evidence. Steps
> A–F below are kept because they are *why* B2 was rejected.

> **🚦 B2 GATE STATUS (HISTORICAL): ❌ NOT cleared.** Two findings,
> both true: **(1)** the original cross-take fixture **was a real flaw** — it compared two
> independent recordings, so the take-to-take micro-motion/VFR difference (not the assembly)
> dominated. Re-fixturing to a **single source** (the continuous Chrome clip losslessly
> re-segmented into 6 standalone clips — same frames, no re-encode) moves cosine **0.896 →
> 0.991** and median relative motion error **0.41 → 0.05**, with LBP-block cosine 0.99997. The
> **single-source fixture is the correct test going forward.** **(2)** Even so, the gate still
> fails on the single-source fixture (**cosine 0.991 < 0.999**, motion_rel_p99 0.334 > 0.25):
> a smaller but **real** assembly divergence localized to the **per-clip sampling phase** (only
> 31.5% of sampled frames coincide; the rest are offset up to ~½ the 400 ms sampling period).
> So **B2's assembly is not faithful enough** — see Step F + `docs/DECISIONS.md` 2026-06-19. The
> resolution (numbers in hand): adopt the **continuous single-stream upload** (active above).
> Safari/iOS was never reached on B2 and is independently still required — now via the *continuous*
> validation above, not this retired gate.

## T007/T008 — multi-clip extraction entry + fidelity test (RETIRED synthetic layer)

`ml_video.compute_anchor_multiclip(clip_paths)` *was* a thin assembly wrapper that reused the
per-clip `extract_landmarks` + `lbp_top_features` (Principle III), validated by the **synthetic,
env-runnable** layer of `tests/test_multiclip_fidelity.py` (6 tests). **Both the symbol and that
test file are now retired** (T004); the assembly is reproduced only by the inlined helper in
`tests/helpers/singlesource_fidelity.py`. The synthetic layer pinned, at the time:

- one clip through `compute_anchor_multiclip` == `compute_anchor` (exact — the seam-aware
  motion path reduced to `motion_features` when there are no seams);
- `compute_anchor_multiclip` == manually `[LBP over concat frames+landmarks] ⊕ [seam-aware
  motion]` (exact — pinned the documented assembly, motion diffs taken per-clip);
- the motion block **excluded the cross-seam diffs** (2026-06-19 seam-aware fix, Step E);
- combined frame count == sum of per-clip kept frames;
- empty input raised `FeatureExtractionError`;
- the coverage gate ran on the **combined** set (`insufficient_face_frames`).

The **real-content fidelity assertion** below needed real recordings and was the human gate —
**run 2026-06-19 on Chrome → FAILED** (Step E); the seam-aware fix was the response and was
itself insufficient (residual beyond the seams) → B2 rejected.

## 🚦 Windowing GATE (B2) — HUMAN, real devices (the retired procedure)

The agent cannot drive a webcam or a real iPhone. A human ran these. Everything was local;
raw video was never committed.

### Step A — record fixtures (Chrome, Safari/iOS)

Use the (now-deleted) B2 harness `_scratch-008-b2-spike` (superseded by the continuous harness):

```bash
python -m http.server 8009 --directory _scratch-008-b2-spike
# open http://localhost:8009 in real Chrome (desktop); for iOS use real Safari over HTTPS/LAN
```

In the harness: **Enable camera**, keep your face framed and steady, then:
1. **Record N stop/restart clips** → `clip_00.*…clip_05.*` (6 standalone clips, ~11 s each — a
   single recorder stopped/restarted between each, so each clip is its own decodable container).
2. **Record one continuous clip** → `continuous.*` (~60 s, same content/framing).

Record the SAME ~60 s of content **both** ways, back-to-back, on **each** browser.

### Step B — drop the files (exact locations) [retired]

```
packages/ml-video/tests/fixtures/multiclip/chrome/continuous.webm
packages/ml-video/tests/fixtures/multiclip/chrome/clips/clip_00.webm   (… clip_05.webm)
packages/ml-video/tests/fixtures/multiclip/safari/continuous.mp4
packages/ml-video/tests/fixtures/multiclip/safari/clips/clip_00.mp4    (… clip_05.mp4)
```

(These cross-take `chrome/` and `safari/` dirs have been **removed** — they were the flawed
fixture. The kept **single-source** fixture is `multiclip/chrome-singlesource/`.)

### Step C — capture-decodability smoke (each clip opens on its own)

```bash
cd packages/ml-video
.venv/Scripts/python tests/helpers/decode_smoke.py <continuous> <clip_*>
```

**PASS** = every line `OK <n_frames> <path>` (exit 0) — each standalone clip independently
decodable. (`decode_smoke.py` is **kept**, repurposed for the continuous-validation decodability
check above.)

### Step D — multi-clip fidelity HARD GATE [retired test]

The gate (`tests/test_multiclip_fidelity.py`, now deleted) printed a measured line per browser and
**asserted** `cosine ≥ 0.999`, `lbp_maxabs ≤ 0.05`, `motion_rel_p99 ≤ 0.25`, `frames_lost ≤
2×n_clips`. Reproduce its measurement now via `tests/helpers/singlesource_fidelity.py` on the
single-source fixture.

| Metric | Budget | Meaning |
|---|---|---|
| `cosine` (full 2958-d) | ≥ **0.999** | multi-clip vector ≈ continuous vector |
| `lbp_maxabs` (90-d LBP block) | ≤ **0.05** | texture stable across the seam |
| `motion_rel_p99` (2868-d motion) | ≤ **0.25** | seam-sensitive motion within tolerance |
| `frames_lost` | ≤ **2 × n_clips** | restart seam frame loss within budget |
| `seam_motion_ratio` | reported (not hard-failed) | per-seam motion inflation, for visibility |

### Step E — GATE DECISION (recorded 2026-06-19, Chrome)

**Verdict: ❌ FAIL on Chrome — GATE NOT cleared.** Safari/iOS not recorded.

| Browser | T006 decodable? | run | cosine (≥0.999) | lbp_maxabs (≤0.05) | motion_rel_p99 (≤0.25) | frames_lost (≤2×n) | seam_ratio | Verdict |
|---|---|---|---|---|---|---|---|---|
| Chrome (webm) | ✅ (6 clips, 27 kept each; continuous 165) | **before** (seam-contaminated) | **0.9010** ❌ | 0.0089 ✅ | **1.2923** ❌ | 3 ✅ | 5.72 | ❌ FAIL |
| Chrome (webm) | ✅ | **after** (seam-aware) | **0.8958** ❌ | 0.0089 ✅ | **0.6998** ❌ | 3 ✅ | 5.72 | ❌ FAIL |
| Safari/iOS (fMP4) | ☐ not recorded | — | — | — | — | — | — | ☐ not run |

**Read (honest — divergence is beyond the seams).** The seam-aware fix moved motion-block cosine
**0.861 → 0.956** and motion_rel_p99 **1.29 → 0.70**, so the seams *were* contributing — but the
headline full-vector **cosine barely moved (0.9010 → 0.8958)**. Decomposition (seam-aware):
LBP-block cosine **0.9997**; relative motion-error **p50 0.41 / p90 0.64 / p99 0.70**. A ~41% error
*at the median*, spread across **all** motion dims, is **broadband**, not seam-localized. The
continuous clip and the 6 standalone clips were two **independent back-to-back recordings**, so the
gate conflated **assembly fidelity** with **recording reproducibility** → re-fixture to a single
source (Step F).

### Step F — single-source re-fixture: isolate assembly fidelity (2026-06-19, design session)

**Fix the test, not the budget.** Take the **existing** continuous Chrome clip and **losslessly
segment** it (`ffmpeg -c copy -f segment` — same VP9 frames, no re-encode) into 6 standalone clips.
Union of decoded frames = **1984 = continuous's 1984** (provably the same take). See
`tests/fixtures/multiclip/chrome-singlesource/README.md` and run
`tests/helpers/singlesource_fidelity.py`.

**Measured (single-source, 2026-06-19; no threshold loosened):**

| Fixture | cosine (≥0.999) | lbp_maxabs (≤0.05) | motion_rel_p99 (≤0.25) | frames_lost (≤12) | seam_ratio | Verdict |
|---|---|---|---|---|---|---|
| `chrome` (cross-take, Step E) | 0.8958 ❌ | 0.0089 ✅ | 0.6998 ❌ | 3 ✅ | 5.72 | ❌ FAIL |
| `chrome-singlesource` (lossless segments) | **0.9910** ❌ | 0.0025 ✅ | **0.3336** ❌ | **0** ✅ | 1.52 | ❌ FAIL |

**Read (honest):**

- **The cross-take fixture WAS a real flaw.** Isolating to one source moved cosine **0.896 →
  0.991**, median relative motion error **0.41 → 0.05**, LBP-block cosine **0.99997**. Most of Step
  E's failure was **recording reproducibility, not assembly**. The single-source (lossless-segment)
  fixture is the **correct test**; the cross-take `chrome` fixture is the wrong test (removed).
- **But the gate still fails on the single-source fixture** (cosine 0.991 < 0.999;
  motion_rel_p99 0.334 > 0.25). The residual is **real, smaller, motion-only** (LBP cosine
  0.99997), and **localized to the per-clip sampling phase**:
  - `frames_lost = 0` (165 = 165) → not frame loss, frame **substitution**;
  - only **31.5%** of the 2.5 fps-sampled frames coincide (52/165); the rest offset from the
    continuous pick by **median 79 ms, p90 175 ms, max 195 ms** — up to ~½ the 400 ms period;
  - **why:** each standalone clip re-applies the 200 ms-phased 2.5 fps grid from its own `t≈0`
    (`CAP_PROP_POS_MSEC` resets per clip), and the clip start offsets are not multiples of 400 ms.
- **Why this cannot be patched for *real* B2 clips:** a real stop/restart clip carries **no global
  clock** — its `POS_MSEC` genuinely starts at 0 and the server cannot reconstruct the continuous
  sampling phase. A **continuous single-stream upload** avoids re-phasing entirely (adopted).

**Verdict: GATE NOT cleared → B2 rejected; continuous single-stream adopted** (active procedure at
the top). This is **exactly** the per-clip sampling-phase reset the T005 tail-window option is
*prohibited* from reintroducing, and the T006 file-global-grid suffix invariant now **enforces**
that prohibition in CI (research.md R-5).
