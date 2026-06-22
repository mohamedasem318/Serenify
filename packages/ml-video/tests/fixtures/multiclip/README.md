# Multi-clip windowing fixtures (feature 008) — B2 **retired**, single-source evidence kept

> **B2 (stop/restart multi-clip frame-concat) was REJECTED** (windowing D-2 reversed →
> continuous single-stream upload + server tail-extract; see `docs/DECISIONS.md` 2026-06-19 and
> `specs/008-stress-inference-service/research.md` R-5/R-7). The multi-clip fidelity HARD GATE
> (`tests/test_multiclip_fidelity.py`) and the package symbols `compute_anchor_multiclip` /
> `motion_features_seamaware` are **retired** (feature-008 T004); the assembly logic now lives
> only in the diagnostic `tests/helpers/singlesource_fidelity.py`.

Only the **single-source** evidence fixture remains here — it is *why* B2 was rejected:

```
multiclip/
└── chrome-singlesource/          # the recorded evidence (see its own README.md)
    ├── continuous.webm           # one continuous ~60 s real-Chrome recording (the reference)
    └── clips/clip_00..05.webm    # the SAME clip losslessly re-segmented (no re-encode)
```

The retired cross-take dirs (`chrome/`, `safari/`) — two *independent* recordings of "the same"
~60 s — were removed: they conflated assembly fidelity with recording reproducibility (the wrong
test). The single-source fixture isolates assembly fidelity and showed the residual per-clip
sampling-phase divergence that sank B2.

> **Raw video is NEVER committed.** The repo-level `tests/fixtures/.gitignore` excludes
> `*.webm` / `*.mp4` / `*.mov` / `*.avi` / `*.mkv` **recursively**, so the clips stay local and
> untracked (Constitution Principle I / X). Only the READMEs and `.gitkeep` are committed.

## How the single-source evidence is read

Run the diagnostic (it reproduces B2's assembly via an **inlined** local helper — no retired
package symbol):

```bash
# from packages/ml-video, with its .venv python
.venv/Scripts/python tests/helpers/singlesource_fidelity.py \
  tests/fixtures/multiclip/chrome-singlesource/continuous.webm \
  tests/fixtures/multiclip/chrome-singlesource/clips/clip_*.webm
```

See `tests/fixtures/multiclip/chrome-singlesource/README.md` for generation + the keyframe-alignment
caveat, and `specs/008-stress-inference-service/smoke-tests.md` Step F for the recorded numbers.
