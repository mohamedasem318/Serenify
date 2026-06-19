# 008 continuous-capture spike (disposable — task T002)

Throwaway scaffolding for the feature-008 **continuous windowing works-and-keeps-up** validation
(T007/T008/T009). **Not shipped UI, and NOT wired into `apps/api`.** It supersedes the retired
`_scratch-008-b1-spike/` and `_scratch-008-b2-spike/` harnesses (B1/B2 were rejected → continuous
single-stream upload + server tail-extract; see `docs/DECISIONS.md` 2026-06-19).

Two parts, one origin:

- **`index.html`** — the client. **One continuous `MediaRecorder`** in timeslice mode (incremental
  capture, **no stop/restart**). Each ~10 s stride it uploads the **contiguous recording-so-far**
  (init chunk + all media chunks in order → always decodable) to the server, shows a **session
  clock** with the t≈60/120/180/240/300 s strides lighting up, and has a **"Save recording-so-far
  to disk"** button so an upload becomes a **T007 fixture**.
- **`server.py`** — a standalone `http.server` (NOT `apps/api`). For each upload it tail-extracts
  the last 60 s with `compute_anchor`'s building blocks (the **T005 `tail_seconds=60` option**) and
  returns the vector shape **and the decode-to-tail time and the extract time as two separate
  numbers**, deleting the temp clip in a `finally` (Principle I). This split is the per-component
  timing instrument the device gate (T008) records — *growing decode-to-tail* vs *constant extract*
  (research R-5 / T009).

## Run it

Use the **ml-video venv python** (it must import `ml_video` + cv2 + mediapipe):

```bash
# from the repo root
packages/ml-video/.venv/Scripts/python _scratch-008-continuous-spike/server.py
# -> serves http://localhost:8009  (override with SPIKE_PORT=…)
```

Then:

- **Desktop (Chrome/Firefox):** open **`http://localhost:8009`** (or `http://127.0.0.1:8009`).
  Click **Start session**, grant the camera, let it run ~5 min.
- **iPhone (real Safari/iOS):** the camera needs a **secure context**, and a **LAN IP over plain
  HTTP blocks `getUserMedia`**. Tunnel the local server through **ngrok** (HTTPS) and open the
  `https://…ngrok…` URL on the phone:

  ```bash
  ngrok http 8009
  ```

> **Secure-context rule:** `getUserMedia` is allowed only on `localhost`/`127.0.0.1` or over
> **HTTPS**. `http://<LAN-IP>:8009` from a phone will **not** get the camera — use ngrok.

## What each upload returns (JSON)

```json
{
  "outcome": "reading",        // or "skipped" (FeatureExtractionError) / "error"
  "dim": 2958, "shape": "(2958,)",
  "decode_to_tail_s": 1.83,    // probe + tail-select + retrieve — GROWS with the clip
  "extract_s": 4.12,           // MediaPipe FaceMesh + LBP + motion — CONSTANT per window
  "kept_frames": 150,
  "upload_bytes": 7340032, "server_total_s": 5.97, "reason": null
}
```

The server also prints a one-line `[upload]` log per stride with the same split.

## Collecting the T007 fixtures

During the session, hit **Save recording-so-far to disk** at each stride; drop the downloaded
`recording-so-far_NNN.{webm,mp4}` files under `packages/ml-video/tests/fixtures/continuous/{chrome,safari}/`
(raw video is gitignored). The real-device pass/fail + per-component times are recorded in
`specs/008-stress-inference-service/smoke-tests.md` (T008/T009) — **maintainer-operated; not run
by the agent.**

## Cleanup

Disposable — delete this whole directory once the device gate (T009) is signed off.
