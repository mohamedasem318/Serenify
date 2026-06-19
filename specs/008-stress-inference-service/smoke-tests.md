# Smoke tests — Stress Inference Service (008)

Human-validated checks (Constitution Principle VII). **This session covers only Phase 1 +
Phase 2 (the windowing GATE).** The full feature smoke matrix (camera permission on real
browsers, mobile 360 px, reduced-motion, privacy, etc.) is added in Phase 8 (task T054)
once the feature is built.

> **🚦 GATE STATUS: NOT YET CONFIRMED.** Phases 3–8 are blocked until a human records on
> real devices and confirms T006 + T008 PASS on **both** Chrome and Safari/iOS (T009).

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
reuses the per-clip `extract_landmarks` + `lbp_top_features`/`motion_features` — Principle
III, no second copy) and validated by the **synthetic, env-runnable** layer of
`tests/test_multiclip_fidelity.py` (5 tests, all passing):

- one clip through `compute_anchor_multiclip` == `compute_anchor` (exact);
- `compute_anchor_multiclip` == manually `[concat kept frames + landmarks] → features` (exact
  — pins the documented assembly);
- combined frame count == sum of per-clip kept frames;
- empty input raises `FeatureExtractionError`;
- the coverage gate runs on the **combined** set (`insufficient_face_frames`).

The **real-content fidelity assertion** below needs real recordings and is the human gate.

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

### Step E — T009 GATE DECISION (record the outcome here)

| Browser | T006 decodable? | T008 cosine / lbp / motion_p99 / frames_lost | Verdict |
|---|---|---|---|
| Chrome (webm) | ☐ | ☐ | ☐ PASS / ☐ FAIL |
| Safari/iOS (fMP4) | ☐ | ☐ | ☐ PASS / ☐ FAIL |

- **Both PASS** → the GATE is cleared; authorize Phases 3–8. Note the date + measured numbers
  here and in `docs/DECISIONS.md`.
- **Any FAIL** → STOP. The windowing approach is revisited before any further build (escalate
  a B2 NO-GO; do not proceed to Phase 3). Capture the failing numbers above so the budget vs
  a genuine fidelity problem can be told apart.
