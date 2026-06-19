# Smoke tests — Stress Inference Service (008)

Human-validated checks (Constitution Principle VII). **This session covers only Phase 1 +
Phase 2 (the windowing GATE).** The full feature smoke matrix (camera permission on real
browsers, mobile 360 px, reduced-motion, privacy, etc.) is added in Phase 8 (task T054)
once the feature is built.

> **🚦 GATE STATUS: ❌ NOT cleared (2026-06-19) — Phases 3–8 remain blocked.** Two findings,
> both true: **(1)** the original cross-take fixture **was a real flaw** — it compared two
> independent recordings, so the take-to-take micro-motion/VFR difference (not the assembly)
> dominated. Re-fixturing to a **single source** (the continuous Chrome clip losslessly
> re-segmented into 6 standalone clips — same frames, no re-encode) moves cosine **0.896 →
> 0.991** and median relative motion error **0.41 → 0.05**, with LBP-block cosine 0.99997. The
> **single-source fixture is the correct test going forward.** **(2)** Even so, the gate still
> fails on the single-source fixture (**cosine 0.991 < 0.999**, motion_rel_p99 0.334 > 0.25):
> a smaller but **real** assembly divergence localized to the **per-clip sampling phase** (only
> 31.5% of sampled frames coincide; the rest are offset up to ~½ the 400 ms sampling period).
> So **B2's assembly is not faithful enough yet** — see Step F + `docs/DECISIONS.md` 2026-06-19.
> The maintainer's open call (numbers now in hand): make per-clip decode+sample phase-faithful
> vs switch to a **continuous single-stream upload**. Safari/iOS was never reached and is
> independently still required (run the same single-source test there).

---

## T001 — ml-video environment check ✅ (agent, automated)

- **Interpreter**: `packages/ml-video/.venv/Scripts/python.exe` — **Python 3.12.13** (the
  pinned env; mediapipe 0.10.13 has no 3.13 wheel).
- **Public surface imports**: `compute_anchor`, **`compute_anchor_multiclip` (new, B2)**,
  `Predictor.predict_delta`, `load_model` import cleanly.
- **Startup contract** (`load_model()`): scaler `n_features_in_ == 2958`, classes `[0, 1]`,
  `model_version == "serenify-video-lbptop-motion-rf-calibrated@2.0.0"` — PASS
  (`tests/test_pipeline_fixtures.py::test_load_model_satisfies_startup_contract`).
- **Full ml-video suite**: `python -m pytest packages/ml-video/tests` → **33 passed, 1
  skipped** (the skip is the real-fixture fidelity gate below). Ruff: **all checks passed**.

---

## T007/T008 — multi-clip extraction entry + fidelity test ✅ (agent, synthetic layer)

`ml_video.compute_anchor_multiclip(clip_paths)` is implemented (a thin assembly wrapper that
reuses the per-clip `extract_landmarks` + `lbp_top_features` — Principle III, no second copy)
and validated by the **synthetic, env-runnable** layer of `tests/test_multiclip_fidelity.py`
(6 tests, all passing):

- one clip through `compute_anchor_multiclip` == `compute_anchor` (exact — the seam-aware
  motion path reduces to `motion_features` when there are no seams);
- `compute_anchor_multiclip` == manually `[LBP over concat frames+landmarks] ⊕ [seam-aware
  motion]` (exact — pins the documented assembly, motion diffs taken per-clip);
- the motion block **excludes the cross-seam diffs** (matches the per-clip aggregation, and
  differs from the old diff-over-the-whole-stack — **2026-06-19 seam-aware fix**, see Step E);
- combined frame count == sum of per-clip kept frames;
- empty input raises `FeatureExtractionError`;
- the coverage gate runs on the **combined** set (`insufficient_face_frames`).

The **real-content fidelity assertion** below needs real recordings and is the human gate —
**run 2026-06-19 on Chrome → FAILED** (Step E); the seam-aware fix was the response and is
itself insufficient (residual is beyond the seams).

---

## 🚦 Windowing GATE (B2) — HUMAN, real devices (T004 → T009)

The agent cannot drive a webcam or a real iPhone. A human runs these. Everything is local;
**raw video is never committed** (the fixtures `.gitignore` excludes `*.webm`/`*.mp4`/… so
your recordings stay untracked).

### Step A — record fixtures (T004 Chrome, T005 Safari/iOS)

Use the harness (disposable):

```bash
python -m http.server 8009 --directory _scratch-008-b2-spike
# open http://localhost:8009 in real Chrome (desktop); for iOS use real Safari over HTTPS/LAN
```

In the harness: **Enable camera**, keep your face framed and steady, then:
1. **Record N stop/restart clips** → downloads `clip_00.*…clip_05.*` (6 standalone clips,
   ~11 s each — a single recorder stopped/restarted between each, so each clip is its own
   decodable container).
2. **Record one continuous clip** → downloads `continuous.*` (~60 s, same content/framing).

Record the SAME ~60 s of content **both** ways, back-to-back, on **each** browser.

### Step B — drop the files (exact locations)

```
packages/ml-video/tests/fixtures/multiclip/chrome/continuous.webm
packages/ml-video/tests/fixtures/multiclip/chrome/clips/clip_00.webm   (… clip_05.webm)
packages/ml-video/tests/fixtures/multiclip/safari/continuous.mp4
packages/ml-video/tests/fixtures/multiclip/safari/clips/clip_00.mp4    (… clip_05.mp4)
```

(Zero-pad the clip index; the gate sorts `clips/clip_*.*` lexicographically.)

### Step C — T006 capture-decodability smoke (each clip opens on its own)

Run from `packages/ml-video` with its venv python (Git Bash expands the glob):

```bash
cd packages/ml-video
.venv/Scripts/python tests/helpers/decode_smoke.py \
  tests/fixtures/multiclip/chrome/continuous.webm \
  tests/fixtures/multiclip/chrome/clips/clip_*.webm
# repeat for safari/*.mp4
```

**PASS looks like**: every line is `OK <n_frames> <path>` (process exits 0) — i.e. **each
standalone clip is independently decodable** (the B2 promise; a bare B1 timeslice chunk would
`FAIL` here). Eyeball that the per-clip frame counts are roughly even and sum to ≈ the
continuous clip's count (a few frames lost per restart seam is fine; a clip near-zero is a
recorder glitch — re-record).

### Step D — T008 multi-clip fidelity HARD GATE

```bash
# from packages/ml-video
.venv/Scripts/python -m pytest tests/test_multiclip_fidelity.py -v -s
```

The `test_multiclip_fidelity_gate[chrome]` / `[safari]` cases now run (no longer skipped) and
print a measured line per browser, e.g.:

```
[B2 fidelity GATE: chrome] clips=6 kept_cont=150 kept_multi=147 frames_lost=3 \
  cosine=0.99996 lbp_maxabs=0.012 motion_rel_p99=0.08 seam_motion_ratio=1.7
```

**PASS criteria** (the agreed starting budget — confirm/adjust the constants at the top of
`test_multiclip_fidelity.py` with the maintainer on the first real run):

| Metric | Budget | Meaning |
|---|---|---|
| `cosine` (full 2958-d) | ≥ **0.999** | multi-clip vector ≈ continuous vector |
| `lbp_maxabs` (90-d LBP block) | ≤ **0.05** | texture stable across the seam |
| `motion_rel_p99` (2868-d motion) | ≤ **0.25** | seam-sensitive motion within tolerance |
| `frames_lost` | ≤ **2 × n_clips** | restart seam frame loss within budget |
| `seam_motion_ratio` | reported (not hard-failed) | per-seam motion inflation, for visibility |

The test **asserts** the first four and **prints** the seam ratio. Both `[chrome]` and
`[safari]` must pass.

### Step E — T009 GATE DECISION (recorded 2026-06-19, Chrome)

**Verdict: ❌ FAIL on Chrome — GATE NOT cleared. STOP: Phases 3–8 remain blocked.**
Safari/iOS not recorded yet (no fixtures) → independently still required.

The gate ran on the recorded Chrome fixtures (continuous.webm + clip_00…05.webm). The
first run caught a real fidelity failure; a seam-aware fix to the multi-clip motion
assembly was then applied (see below) and the gate re-run on the **same** fixtures. No
threshold was loosened.

| Browser | T006 decodable? | run | cosine (≥0.999) | lbp_maxabs (≤0.05) | motion_rel_p99 (≤0.25) | frames_lost (≤2×n) | seam_ratio | Verdict |
|---|---|---|---|---|---|---|---|---|
| Chrome (webm) | ✅ (6 clips, 27 kept each; continuous 165) | **before** (seam-contaminated) | **0.9010** ❌ | 0.0089 ✅ | **1.2923** ❌ | 3 ✅ | 5.72 | ❌ FAIL |
| Chrome (webm) | ✅ | **after** (seam-aware) | **0.8958** ❌ | 0.0089 ✅ | **0.6998** ❌ | 3 ✅ | 5.72 | ❌ FAIL |
| Safari/iOS (fMP4) | ☐ not recorded | — | — | — | — | — | — | ☐ not run |

**Read (honest — divergence is beyond the seams).** The seam-aware fix did exactly what
it should to the motion block — motion-block cosine **0.861 → 0.956**, motion_rel_p99
**1.29 → 0.70** — so the seams *were* contributing to the tail. But the headline
full-vector **cosine barely moved (0.9010 → 0.8958, slightly worse)**. Decomposition
(seam-aware): LBP-block cosine **0.9997**; motion magnitude ratio multi/continuous mean
**0.79** / std **0.55** / max **0.43**; relative motion-error **p50 0.41 / p90 0.64 / p99
0.70**. A ~41% error *at the median*, spread across **all** motion dims, is **broadband**,
not seam-localized — tighter seam handling cannot close it. The continuous clip and the 6
standalone clips are two **independent back-to-back recordings**, so the motion block is
also measuring involuntary micro-motion / VFR-sampling differences that do not reproduce
take-to-take: as fixtured, the gate conflates **assembly fidelity** with **recording
reproducibility**. → **Windowing goes to a design session** (see `docs/DECISIONS.md`
2026-06-19): re-fixture to isolate assembly fidelity (continuous vs the *same decoded
frames* re-chunked), and reconsider whether a 0.999 full-vector cosine is achievable on
the take-irreproducible motion block. The seam-aware code is kept (it is correct) but is
not sufficient.

- **Both PASS** → the GATE is cleared; authorize Phases 3–8. Note the date + measured numbers
  here and in `docs/DECISIONS.md`. *(Not reached — Chrome failed.)*
- **Any FAIL** → STOP. The windowing approach is revisited before any further build (escalate
  a B2 NO-GO; do not proceed to Phase 3). Capture the failing numbers above so the budget vs
  a genuine fidelity problem can be told apart. *(This is the path taken — 2026-06-19.)*

### Step F — single-source re-fixture: isolate assembly fidelity (2026-06-19, design session)

**Fix the test, not the budget.** Step E's `chrome` fixture compared **two independent
recordings** (one continuous take + one 6-clip take of "the same" ~60 s). Human micro-motion
(blinks, breathing, sway) and VFR sampling are not reproducible take-to-take, so the motion
block (97% of the 2958-d vector) differed for reasons unrelated to the multi-clip **assembly**.
That fixture conflated **assembly fidelity** with **recording reproducibility** and could not
answer the real question.

The single-source fixture removes the confound: take the **existing** continuous Chrome clip
and **losslessly segment** it (`ffmpeg -c copy -f segment` — same VP9 frames, no re-encode, no
new recording) into 6 standalone clips. Union of decoded frames = **1984 = continuous's 1984**
(provably the same take). See `tests/fixtures/multiclip/chrome-singlesource/README.md`
(generation + keyframe-alignment caveat) and run:

```bash
# from packages/ml-video
.venv/Scripts/python tests/helpers/singlesource_fidelity.py \
  tests/fixtures/multiclip/chrome-singlesource/continuous.webm \
  tests/fixtures/multiclip/chrome-singlesource/clips/clip_*.webm
# and the production gate path (auto-discovers the new fixture):
.venv/Scripts/python -m pytest tests/test_multiclip_fidelity.py -v -s -k fidelity_gate
```

**Measured (production gate `_measure`, 2026-06-19; no threshold loosened):**

| Fixture | cosine (≥0.999) | lbp_maxabs (≤0.05) | motion_rel_p99 (≤0.25) | frames_lost (≤12) | seam_ratio | Verdict |
|---|---|---|---|---|---|---|
| `chrome` (cross-take, Step E) | 0.8958 ❌ | 0.0089 ✅ | 0.6998 ❌ | 3 ✅ | 5.72 | ❌ FAIL |
| `chrome-singlesource` (lossless segments) | **0.9910** ❌ | 0.0025 ✅ | **0.3336** ❌ | **0** ✅ | 1.52 | ❌ FAIL |

**Read (honest):**

- **The cross-take fixture WAS a real flaw.** Isolating to one source moved cosine **0.896 →
  0.991**, median relative motion error **0.41 → 0.05**, LBP-block cosine **0.99997**, and
  removed the broadband take-to-take noise. Most of Step E's failure was **recording
  reproducibility, not assembly**. The single-source (lossless-segment) fixture is the
  **correct test going forward**; the cross-take `chrome` fixture is retired as the wrong test.
- **But the gate still fails on the single-source fixture** (cosine 0.991 < 0.999;
  motion_rel_p99 0.334 > 0.25). The residual is **real, smaller, motion-only** (LBP cosine
  0.99997), and **localized to the per-clip sampling phase**:
  - `frames_lost = 0` (165 = 165) → not frame loss, frame **substitution**;
  - only **31.5%** of the 2.5 fps-sampled frames coincide (52/165); the other 113 picks are
    offset from the continuous pick by **median 79 ms, p90 175 ms, max 195 ms** — up to ~½ the
    400 ms sampling period;
  - **why:** each standalone clip re-applies the 200 ms-phased 2.5 fps timestamp grid from its
    own `t≈0` (`CAP_PROP_POS_MSEC` resets per clip), and the clip start offsets are not
    multiples of 400 ms, so the per-clip grid lands a different set of frames than continuous
    sampling. Different frames → different landmark diffs → motion magnitude ~14% lower
    (l2 ratio 0.864). LBP is phase-insensitive (averaged texture), so it is unaffected.
- **Why this likely cannot be patched server-side for *real* B2 clips:** the lossless fixture
  happens to have knowable global offsets, but a **real** stop/restart clip carries **no global
  clock** — its `POS_MSEC` genuinely starts at 0 and the server cannot know the (variable)
  recorder stop→restart wall-clock gaps, so the continuous sampling phase cannot be
  reconstructed from standalone clips. A **continuous single-stream upload** avoids re-phasing
  entirely.

**Verdict: GATE still NOT cleared.** B2's assembly is closer than Step E implied but **not
faithful enough** (0.991 < 0.999). **Do not loosen the budget; do not patch yet.** This is the
maintainer's call, now with numbers in hand: (a) make per-clip decode+sample phase-faithful, or
(b) switch the windowing approach to a continuous single-stream upload. Safari/iOS still needs
the **same single-source test** before any build. Phases 3–8 remain blocked.
