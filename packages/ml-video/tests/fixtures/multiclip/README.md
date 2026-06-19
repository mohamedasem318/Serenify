# Multi-clip windowing GATE fixtures (feature 008, B2)

These back the **multi-clip fidelity HARD GATE** (`tests/test_multiclip_fidelity.py`,
tasks T006/T008) and the B2 capture validation. They are recorded on **real devices**
by a human (the agent cannot drive a webcam / a real iPhone) and dropped here.

> **Raw video is NEVER committed.** The repo-level `tests/fixtures/.gitignore` already
> excludes `*.webm` / `*.mp4` / `*.mov` / `*.avi` / `*.mkv` **recursively**, so anything
> you drop in `chrome/` or `safari/` stays local and untracked (Constitution Principle
> I / X). Only this README and the `.gitkeep` files are committed. The fidelity test
> **skips** with a clear message when the clips are absent (i.e. in CI / a clean tree).

## Expected layout (record the SAME ~60 s of content two ways, per browser)

```
multiclip/
├── chrome/                      # real Chrome — WebM (VP8/VP9)
│   ├── continuous.webm          # ONE continuous ~60 s recording (the reference)
│   └── clips/                   # the SAME ~60 s as ~6 stop/restart standalone clips
│       ├── clip_00.webm
│       ├── clip_01.webm
│       ├── clip_02.webm
│       ├── clip_03.webm
│       ├── clip_04.webm
│       └── clip_05.webm
└── safari/                      # real Safari / iOS — fragmented MP4
    ├── continuous.mp4
    └── clips/
        ├── clip_00.mp4
        └── … clip_05.mp4
```

Notes:
- `continuous.*` and `clips/clip_*.*` must be the **same person, same ~60 s, same
  framing** — recorded back-to-back. The gate compares the 2958-d vector of the
  continuous clip vs the concatenation of the stop/restart clips.
- `clips/` are sorted lexicographically, so zero-pad the index (`clip_00`, `clip_01`, …).
- Record with the harness at `_scratch-008-b2-spike/` (stop/restart mode for `clips/`,
  continuous mode for `continuous.*`).

## How the gate reads them

`test_multiclip_fidelity.py` discovers each browser dir that has both a `continuous.*`
and a non-empty `clips/`, and skips the rest. See that file and
`specs/008-stress-inference-service/smoke-tests.md` (the T006/T009 checklist).
