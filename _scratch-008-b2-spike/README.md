# `_scratch-008-b2-spike/` — B2 capture harness (disposable)

Throwaway scaffolding for the feature-008 **windowing GATE** (tasks T002, used by
T004/T005/T006). It records the same ~60 s of webcam content **two ways** so the
multi-clip fidelity gate (`packages/ml-video/tests/test_multiclip_fidelity.py`) can
compare them:

- **N stop/restart standalone clips** — a single `MediaRecorder` that is stopped and
  fully restarted between each clip, so every clip carries its own container init and
  is **independently decodable** (this is the B2 promise; B1's bare timeslice chunks
  were not). Downloads `clip_00.*…clip_05.*`.
- **One continuous clip** — a single ~60 s recording, downloaded as `continuous.*`.

## Run it

Webcam needs a **secure context** (`http://localhost` or `https://`). From the repo root:

```bash
# any static server works; e.g.
python -m http.server 8009 --directory _scratch-008-b2-spike
# then open http://localhost:8009  (Chrome desktop)
```

For **real Safari / iOS** (the pre-production gate), serve it over HTTPS or your LAN
with a trusted cert and open it in real Safari — **not** a Playwright/automated browser
(false cross-browser confidence; see DECISIONS e2e-load-timing history).

## Then

Drop the downloaded files into the gitignored fixtures dirs (raw video is never
committed — Principle I/X):

```
packages/ml-video/tests/fixtures/multiclip/chrome/continuous.webm
packages/ml-video/tests/fixtures/multiclip/chrome/clips/clip_00.webm … clip_05.webm
packages/ml-video/tests/fixtures/multiclip/safari/continuous.mp4
packages/ml-video/tests/fixtures/multiclip/safari/clips/clip_00.mp4 … clip_05.mp4
```

Run the GATE per `specs/008-stress-inference-service/smoke-tests.md` (T006 + T008).

> This directory is **disposable** and not part of the app. Delete it once the gate is
> confirmed PASS.
