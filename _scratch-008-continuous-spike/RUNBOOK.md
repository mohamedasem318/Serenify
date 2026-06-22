# RUNBOOK — continuous-capture device gate (T007 → T009)

Click-by-click guide for the **maintainer** to run the feature-008 **works-and-keeps-up**
validation on real devices and record the result. The agent **cannot** drive a webcam or a real
iPhone, so this is yours to run. Everything is local; **raw video is never committed** (the
fixtures dir gitignores `*.webm`/`*.mp4`). Use **real browsers, not Playwright** (Playwright has
given false cross-browser capture/timing confidence before).

> **What you are proving (read this first).** The 60 s window is **faithful by construction** (a
> real continuous clip through the already-validated single-clip extraction), so **there is no
> fidelity gate**. Two things are open:
>
> - **WORKS — the real gate.** Can each browser *capture*, and does its uploaded clip *decode
>   server-side* and *tail-extract* to a `(2958,)` vector? **Safari/iOS is the genuine unknown** —
>   it emits **fragmented MP4** (the fragile encoder), not webm. Chrome/webm is the warm-up.
> - **KEEPS UP — expected to degrade, NOT a pass/fail.** A dev-machine end-to-end check already
>   measured `server_total_s ≈ 10.3 s` on a 66 s clip (decode-to-tail ~7.5 s + extract ~2.8 s).
>   So **totals over 10 s late in a session are expected**, not a failure — see §4. The per-stride
>   split is recorded only so a *production-deploy* optimization can be aimed at the right component
>   later; it never re-opens the windowing approach.

You will end with: continuous fixtures saved under
`packages/ml-video/tests/fixtures/continuous/{chrome,safari}/`, two exported markdown tables, and
the result written into `specs/008-stress-inference-service/smoke-tests.md` + a one-line note in
`docs/DECISIONS.md`.

---

## 0. Prereqs

- **Start the spike server with the ml-video venv python** (it must import `ml_video` + cv2 +
  mediapipe — a plain `python` will fail the imports). From the repo root:

  ```bash
  packages/ml-video/.venv/Scripts/python _scratch-008-continuous-spike/server.py
  # -> "continuous-capture spike server on http://localhost:8009"
  # (override the port with SPIKE_PORT=… ; Ctrl-C to stop)
  ```

  The real `apps/api` is **not** involved — this standalone `http.server` serves the page and
  runs the extract on one origin. Leave it running in its own terminal for the whole session; it
  prints a one-line `[upload]` log per stride and deletes every temp clip in a `finally`.

- **Secure-context rules** (`getUserMedia` is blocked otherwise — no camera, no session):
  - **Desktop: `http://localhost:8009` or `http://127.0.0.1:8009` only.** A **LAN IP over plain
    HTTP** (`http://192.168.x.x:8009`) is **not** a secure context and the camera **will not**
    start — the page shows "NOT a secure context".
  - **iPhone: HTTPS via ngrok** (next, §2). A phone cannot reach `localhost`, and LAN-IP HTTP is
    blocked, so the tunnel's `https://…` URL is the only path that gets the camera.

---

## 1. Chrome desktop (localhost) — warm-up run

This is the easy browser; it confirms the rig before you fight Safari.

1. Server running (§0) → open **`http://localhost:8009`** in **real Chrome** (not Playwright).
2. Click **Start session** → **grant the camera**. The preview shows, the session clock starts,
   and the page begins **auto-uploading the recording-so-far every ~10 s** (one continuous
   `MediaRecorder` — no stop/restart). Keep your face framed and reasonably steady.
3. **Record a full ~5-minute continuous session** — long enough to reach the **300 s stride** and
   the page's **5-minute hard cap**. The `60/120/180/240/300 s` chips light up as the clock passes
   them; each ~10 s the results table gains a row (`#`, t, MB, decode-to-tail, extract, server
   total, within-10s?, decodable?, shape/outcome).
4. **At t ≈ 60 / 120 / 180 / 240 / 300 s**, click **Save recording-so-far to disk**. You get
   `recording-so-far_NNN.webm`. Move the five files into:

   ```
   packages/ml-video/tests/fixtures/continuous/chrome/
   ```

   (gitignored — these are the **T007 Chrome fixtures**.)
5. Click **Stop**, then **Export as markdown**. The markdown is copied to your clipboard and shown
   in the box below the table (select-copy it if the clipboard was blocked). **Keep it** for §3.

> Sanity: every Chrome row should be `decodable? = yes` and `shape/outcome = (2958,)`. Totals
> climbing past 10 s at the late strides is expected (§4).

---

## 2. Safari / iOS (ngrok) — the real gate

This is the browser the gate exists for. Safari emits **fragmented MP4**; the open question is
**whether it works at all** server-side.

1. With the server still running, start a tunnel (separate terminal):

   ```bash
   ngrok http 8009
   ```

   Copy the `https://….ngrok-free.app` (or `…ngrok.io`) **Forwarding** URL.
2. On the **iPhone, open that `https://…` URL in Safari**. If an ngrok **interstitial** page
   appears ("You are about to visit…"), tap **Visit Site** to dismiss it. Then **grant the
   camera** when Safari prompts.
3. **Run the same ~5-minute continuous session**, capturing at the **same five marks**
   (60/120/180/240/300 s). At each mark tap **Save recording-so-far to disk** — Safari downloads
   `recording-so-far_NNN.mp4`. Get those `.mp4` files onto the dev machine (AirDrop / iCloud /
   cable) and drop them into:

   ```
   packages/ml-video/tests/fixtures/continuous/safari/
   ```
4. Tap **Stop**, then **Export as markdown**, and keep that second table for §3 (the export's
   `userAgent=` comment line records that it was Safari/iOS).

> **The pass/fail to watch here:** each uploaded contiguous fMP4 must be **decodable server-side**
> (`decodable? = yes`) and tail-extract to **`shape/outcome = (2958,)`**. If Safari can't capture,
> or the fMP4 won't decode / won't tail-extract, that is a **real windowing problem** to bring back
> to planning (§4) — not a keep-up issue.

### Offline re-confirmation on the saved fixtures (belt-and-suspenders)

The live table already shows works+keeps-up per stride. To re-verify the **(works)** half against
the saved fixture files exactly as `tasks.md` T008 prescribes (this is also what a fresh reviewer
can re-run without a camera):

```bash
cd packages/ml-video
# (works) every line must be `OK <n_frames> <path>`, exit 0:
.venv/Scripts/python tests/helpers/decode_smoke.py tests/fixtures/continuous/safari/recording-so-far_300.mp4
# (works) and the tail-extract returns a (2958,) vector:
.venv/Scripts/python -c "from ml_video import compute_anchor; print(compute_anchor(r'tests/fixtures/continuous/safari/recording-so-far_300.mp4', tail_seconds=60).shape)"
# -> (2958,)
```

Repeat for the `chrome/*.webm` fixtures.

---

## 3. Record the results into `smoke-tests.md`

Open `specs/008-stress-inference-service/smoke-tests.md` → the **"Windowing validation
(continuous)"** section.

1. **Paste both exported tables** (Chrome, then Safari/iOS) under **Step B — works-and-keeps-up**,
   as evidence blocks. Then fill the pre-formatted per-stride table there (Browser / stride /
   decode-to-tail / extract / total / (2958,)? / within 10 s?) from those numbers.
2. **Mark WORKS pass/fail per browser**: PASS = every sampled stride is **decodable** *and*
   returns **`(2958,)`**. (Chrome is expected to pass trivially; Safari/iOS is the real verdict.)
3. **Record the keep-up per-stride times** — the **decode-to-tail and extract split, separately**,
   not just the total — at the five marks. Worst case is the last (~300 s decoded).
4. Fill the **Step C — T009 checkpoint** row with the verdict **and the per-component
   attribution** (§4): Chrome works+keeps-up ☐, Safari/iOS works+keeps-up ☐, breach component (if
   any), Verdict. Then add the one-line outcome to `docs/DECISIONS.md`.

---

## 4. Interpreting the numbers (so you read them right)

- **WORKS is the gate.** PASS = the upload **decodes server-side** and tail-extracts to
  **`(2958,)`** on **both** Chrome **and** Safari/iOS. If Safari can't capture, or its fMP4 won't
  decode / won't tail-extract → that is a **real windowing problem**: stop and bring it back to
  planning. This is the genuine unknown the gate exists for.

- **KEEPS UP is expected to degrade — it is NOT a pass/fail and never re-opens windowing.** ~10 s
  total at ~66 s of video was already observed on a dev machine, so **totals over 10 s late in the
  session are expected**, not a failure. A keep-up breach is a **production-deploy concern only**
  (localhost/demo is unaffected and the build proceeds). Use the split to attribute it, and
  **record which** in the checkpoint:
  - breach that **grows with session length** (late strides ≫ early; **decode-to-tail dominates**)
    ⇒ the lever is the **deferred server-side rolling decoded-frame buffer** (decode only the newest
    increment; research R-5) — the *decode* side.
  - breach **present even early / dominated by the constant `extract_s`** (MediaPipe + LBP) ⇒ the
    lever is a **slower reading cadence** (FR-016 non-blocking + D-3 smoothing tolerate variable
    arrival) or **GPU MediaPipe**, **not** the buffer — the *extract* side.

- **`decodable? = yes` but `shape/outcome = skipped: …`** is a *content* outcome (e.g. the
  usable-face-coverage gate rejected the window — keep your face framed), **not** a decode failure.
  It still proves WORKS at the container level; re-frame and let the next stride read.

---

## Cleanup

Disposable. Once the T009 checkpoint is signed off, **delete this whole
`_scratch-008-continuous-spike/` directory** (and the gitignored fixtures, if no longer needed).
