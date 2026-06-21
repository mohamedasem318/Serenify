# Smoke tests — Stress Inference Service (008)

Human-validated checks (Constitution Principle VII). This file has **two parts**:

1. **Phase 1 + Phase 2 — the windowing validation** (below, from the `T001` section through the
   `T009` checkpoint): the continuous capture/upload/tail-extract path **works + keeps up** on real
   Chrome + Safari/iOS. **Done** (T009 = PASS, 2026-06-19).
2. **Phase 8 — the feature smoke matrix** (added by **T054**; see the
   [Phase 8 section](#phase-8--feature-smoke-matrix-t054) below): the human checks the automated
   suite cannot cover — camera permission on real browsers, Safari/iOS secure-context + capture,
   HTTPS/localhost, low-light skip, mobile 360 px, reduced-motion, privacy (temp/clip deleted), and
   that no manager surface can read sessions/readings. These are **operator-run on real devices**
   (the agent cannot drive a webcam or a real iPhone, and Playwright gives false cross-browser
   capture confidence — see the e2e-load-timing flake history); the Phase 8 Playwright happy-path
   (T051) covers the wiring on Chromium/Firefox but is **not** the cross-browser capture gate.

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
- **Full ml-video suite** (after T004 retirement + T005/T006 tail-window, 2026-06-19):
  `python -m pytest packages/ml-video/tests` → **32 passed** locally (**31 passed + 1 skipped**
  in CI — the tail-window *decode-bound* test `test_tail_window.py::…trailing_60s_on_real_continuous_clip`
  skips when the gitignored continuous fixture is absent; the **synthetic suffix invariant** runs
  in CI). The retired `test_multiclip_fidelity.py` skip is gone — that file is deleted. Ruff:
  **all checks passed**.

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
| Chrome (webm) | 60 | 30.26 | 15.74 | 46.10 | ✅ | ❌ |
| Chrome (webm) | 120 | 122.51 | 23.52 | 146.46 | ✅ | ❌ |
| Chrome (webm) | 180 | 96.52 | 7.44 | 104.56 | ✅ | ❌ |
| Chrome (webm) | 240 | 142.86 | 13.94 | 157.09 | ✅ | ❌ |
| Chrome (webm) | 300 | 133.78 | 5.36 | 139.72 | ✅ | ❌ |
| Safari/iOS (webm/vp9) ‡ | ~61 | 19.40 | 3.93 | 23.36 | ✅ | ❌ |
| Safari/iOS (**fMP4/CMAF**) ‡ | ~62 | 7.02 | 7.13 | 14.18 | ✅ | ❌ |

‡ **Safari/iOS rows are offline measurements on the saved fixtures (idle machine), not live**, and
there are two — one per container *this* iOS Safari can produce. The cloudflared tunnel could not
carry iOS's large continuous uploads (iOS records ~4× bigger than Chrome — ~12 MB/10 s ⇒ 20–110 MB
POSTs from a phone uplink), so only the first ~10 s stride uploaded live (decodable; `skipped` on
face-coverage). Works + the per-component split were therefore taken by running the **same**
`compute_anchor`/`measure` building blocks the live server uses on the saved recording-so-far
fixtures — **faithful** (identical extraction; whether bytes arrive by upload or transfer does not
change whether they decode). The 120/180/240/300 s Safari marks were not captured live; the
longer-duration keep-up trend mirrors Chrome (same server-side decode growth). **Both containers
PASS works.** Evidence + the WebM-vs-fMP4 finding below. (Chrome rows above are **live** localhost
numbers, additionally concurrency-inflated — see that note.)

> **Chrome (webm) — WORKS ✅ PASS** (real run 2026-06-19, Chrome 149, `video/webm;codecs=vp9`).
> All 30 strides **decodable**; every framed stride (t≥30 s) tail-extracted to **`(2958,)`** (the
> two t≤20 s rows are `skipped: insufficient_face_frames` — the coverage gate during initial
> framing, still decodable, a *content* outcome not a decode failure). **KEEPS UP: breaches** (no
> stride within 10 s past t=40 s) — **expected, not a fail** (see Step C). The breach **grows with
> session length and is decode-to-tail-dominated** (decode-to-tail 30→122→134 s vs extract bounded
> 5–24 s on a constant ~150-frame tail; at t=300 s decode is ~25× extract) ⇒ *decode* side ⇒ the
> lever is the deferred rolling decoded-frame buffer (R-5). Full per-stride evidence below.

<details><summary><b>Chrome exported table — full 30-stride run (2026-06-19)</b></summary>

<!-- mime=video/webm;codecs=vp9 · userAgent=Chrome/149.0.0.0 (Windows NT 10.0; Win64; x64) -->

| # | t (s) | upload MB | decode-to-tail (s) | extract (s) | server total (s) | within 10 s? | decodable? | shape / outcome |
|--:|--:|--:|--:|--:|--:|:--:|:--:|:--|
| 1 | 10 | 2.87 | 2.1541 | 0.5406 | 2.7044 | yes | yes | skipped: insufficient_face_frames · 23f |
| 2 | 20 | 6.15 | 4.5605 | 1.1922 | 5.7729 | yes | yes | skipped: insufficient_face_frames · 48f |
| 3 | 30 | 9.45 | 6.673 | 2.986 | 9.6915 | yes | yes | (2958,) · 74f |
| 4 | 40 | 12.81 | 10.0808 | 5.4344 | 15.5637 | no | yes | (2958,) · 99f |
| 5 | 50 | 15.85 | 15.3966 | 8.8772 | 24.3913 | no | yes | (2958,) · 122f |
| 6 | 60 | 19.15 | 30.2562 | 15.7402 | 46.0959 | no | yes | (2958,) · 148f |
| 7 | 70 | 22.42 | 47.0644 | 23.7098 | 70.9537 | no | yes | (2958,) · 150f |
| 8 | 80 | 25.69 | 69.1728 | 19.9623 | 89.3283 | no | yes | (2958,) · 150f |
| 9 | 90 | 29.04 | 84.7978 | 19.8304 | 104.8672 | no | yes | (2958,) · 150f |
| 10 | 100 | 32.30 | 97.7319 | 21.4626 | 119.5177 | no | yes | (2958,) · 150f |
| 11 | 110 | 35.25 | 109.7301 | 23.1552 | 133.336 | no | yes | (2958,) · 150f |
| 12 | 120 | 38.60 | 122.5069 | 23.519 | 146.4579 | no | yes | (2958,) · 150f |
| 13 | 131 | 41.95 | 135.8424 | 20.7843 | 156.9699 | no | yes | (2958,) · 150f |
| 14 | 141 | 43.11 | 137.9968 | 16.379 | 154.8314 | no | yes | (2958,) · 150f |
| 15 | 150 | 44.36 | 136.3704 | 9.092 | 145.8467 | no | yes | (2958,) · 150f |
| 16 | 160 | 47.74 | 127.4655 | 8.8836 | 136.7176 | no | yes | (2958,) · 150f |
| 17 | 170 | 51.01 | 115.6297 | 8.4357 | 124.5074 | no | yes | (2958,) · 150f |
| 18 | 180 | 54.33 | 96.5188 | 7.4445 | 104.5576 | no | yes | (2958,) · 150f |
| 19 | 190 | 57.34 | 80.1707 | 9.8114 | 90.4976 | no | yes | (2958,) · 150f |
| 20 | 200 | 60.62 | 84.0443 | 15.9631 | 100.3899 | no | yes | (2958,) · 150f |
| 21 | 210 | 63.93 | 106.7897 | 13.2151 | 120.2635 | no | yes | (2958,) · 150f |
| 22 | 220 | 67.17 | 115.1747 | 9.8119 | 125.32 | no | yes | (2958,) · 150f |
| 23 | 230 | 70.49 | 133.6732 | 14.8015 | 148.8258 | no | yes | (2958,) · 150f |
| 24 | 240 | 73.53 | 142.8554 | 13.9354 | 157.09 | no | yes | (2958,) · 151f |
| 25 | 250 | 76.74 | 165.9303 | 16.4774 | 182.7368 | no | yes | (2958,) · 150f |
| 26 | 260 | 80.03 | 165.2354 | 11.0888 | 176.8811 | no | yes | (2958,) · 150f |
| 27 | 270 | 83.31 | 157.2695 | 9.3055 | 166.9696 | no | yes | (2958,) · 150f |
| 28 | 280 | 86.68 | 157.7327 | 7.4209 | 165.8038 | no | yes | (2958,) · 150f |
| 29 | 290 | 89.62 | 139.0061 | 6.098 | 145.7107 | no | yes | (2958,) · 150f |
| 30 | 300 | 92.94 | 133.7752 | 5.3599 | 139.7161 | no | yes | (2958,) · 150f |

Fixtures saved (gitignored): `tests/fixtures/continuous/chrome/recording-so-far_{062,122,182,241,301}.webm`.

**Offline re-confirm from the saved fixtures (belt-and-suspenders, agent-run):** `decode_smoke.py`
→ `OK` on all five (1840 / 3646 / 5068 / 6847 / 8655 frames — growing with clip length; the
`File ended prematurely` line is the benign *unfinalized live-webm trailer* warning, frames still
decode); `compute_anchor(recording-so-far_301.webm, tail_seconds=60)` → **`(2958,)`, all-finite**.
Matches the live table — WORKS confirmed both live and offline.

</details>

**Safari/iOS — works PASS, and a finding: this iOS Safari emits WebM, not fMP4.**

This iPhone's Safari **supports `video/webm;codecs=vp9` MediaRecorder** (`isTypeSupported` → true),
so with the harness's webm-first `pickMime()` the **default** iOS capture is **webm/vp9** — which
contradicts the spec's "Safari emits fragmented MP4" assumption. Both containers were validated:

| Capture | container (ffprobe) | size / bitrate | decode_smoke | tail-extract `(2958,)`? | decode-to-tail / extract |
|---|---|---|---|---|---|
| Safari **default** | `matroska,webm` / VP9, 480×640 | 74 MB / 9.7 Mbps | OK 1794f | ✅ `(2958,)` | 19.40 s / 3.93 s |
| Safari **`?mime=mp4`** | **`iso5`+`cmfc` (CMAF), 59 `moof`** / H.264, `Core Media Video` | 68 MB / 9.4 Mbps | OK 1794f | ✅ `(2958,)` | 7.02 s / 7.13 s |

- **The fragmented-MP4 path — the gate's actual named unknown — is explicitly closed.** Forcing
  `?mime=mp4` pushed iOS into its genuine fragmented-MP4 / CMAF encoder (**59 movie-fragment `moof`
  boxes**, one `moov` init, no `mp42isom`; handler `Core Media Video`; 9.4 Mbps / 68 MB — *not* a
  re-encode). It **decodes + tail-extracts to `(2958,)`**, and it decoded **faster** than the webm
  (7.0 s vs 19.4 s) — the "fragile encoder" concern is dispelled.
- **Fixtures saved (gitignored):** `tests/fixtures/continuous/safari/recording-so-far_061.webm`
  (default webm) + `recording-so-far_062.mp4` (forced fMP4/CMAF).
- **Transfer caveat (recorded so the evidence chain is auditable):** a first transfer via
  WhatsApp-as-*video* silently **re-encoded** the clip to a 6.5 MB H.264-Baseline `mp42isom` MP4
  (640×480, rotated) — discarded as non-representative; the real 68 MB CMAF fMP4 was re-sent as a
  WhatsApp **document** (lossless) and is the fixture measured above.

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
| 2026-06-19 | ✅ works · ⚠️ keep-up breaches (expected) | ✅ works — **webm _and_ fMP4/CMAF** · ⚠️ keep-up breaches (expected) | **decode-to-tail** (grows with session length) → deferred rolling decoded-frame buffer (R-5) | ✅ **PASS — unblock Phase 3** |

**Outcome (per-component attribution). T009 = PASS.** The continuous capture → contiguous-
recording-so-far upload → server tail-extract path **works on real Chrome and real Safari/iOS**, and
`compute_anchor(clip, tail_seconds=60)` returns `(2958,)` on **both** Safari containers (webm **and**
fragmented-MP4/CMAF). The fragmented-MP4 "fragile encoder" — the reason iOS was the genuine unknown —
was explicitly exercised and **decodes cleanly** (even faster than webm).

**Keep-up breaches, as expected — a production-deploy concern only, never a windowing failure.** The
breach is **decode-to-tail-dominated and grows with session length** (Chrome live: decode-to-tail
30→122→134 s vs extract bounded ~5–24 s on a constant ~150-frame tail; at t=300 s decode ≈ 25×
extract). Per the diagnosis split, the lever is the **deferred server-side rolling decoded-frame
buffer** (decode only the newest increment; research R-5) — the *decode* side, **not** extract. Two
corroborating observations: (1) the same 60 s Chrome clip processed in **9.7 s standalone vs 30 s
live**, so the live worst-case is *also* inflated by ~30 concurrent strides contending on one machine
(a cadence/back-pressure concern orthogonal to clip size); (2) on Safari the fMP4 decode (7.0 s) was
*lower* than the webm (19.4 s), so container choice also moves the decode cost. None of this re-opens
windowing (**faithful by construction** — no fidelity outcome to fail). Localhost/demo is unaffected.

**Checkpoint**: continuous windowing proven on real devices → feature build (Phase 3+) may begin.

---

# Phase 8 — feature smoke matrix (T054)

The operator-run human checks for the built feature, maps to the `quickstart.md` Success Criteria
(SC-001…SC-011) and Constitution Principle VI. **Run on real devices and real browsers** — the
agent cannot drive a webcam, a real iPhone, or a permission prompt, and Playwright has repeatedly
given **false** cross-browser capture/timing confidence. The Phase 8 Playwright happy-path
(`employee-monitoring.spec.ts`, T051) exercises the start→permission→warming-up→reading→end→recap
**wiring** on Chromium/Firefox against the feature-005 detector-injection seam — it is **not** the
cross-browser capture gate; **ST-08-2 / ST-08-3 below are.**

**Setup**: a **calibrated employee** account (has `profiles.anchor_vector`) + a **no-anchor**
employee (for the calibrate-first checks) + a **manager** (team_lead/admin, for the privacy check).
Run the web app over a secure context (`localhost`, or HTTPS via a tunnel for the phone). Backend up
(`/healthz` → ready). Raw video is never committed (the fixtures `.gitignore` excludes video).

| ID | Check (what the operator does) | Pass criterion | SC / FR |
|---|---|---|---|
| **ST-08-1** | **Camera permission — real browsers (Chrome, Firefox, Edge, Safari).** Sign in (calibrated employee) → dashboard → **Start check-in** → the browser shows its native camera prompt → **Allow**. | The permission panel (meadow "Allow camera access") precedes the prompt; on grant the stage shows **warming-up** ("getting a read on things"); on **deny** it shows the foggy **blocked** panel with a gentle fix + "Try again", never a crash. | SC-001, SC-010, FR-001/010/031–035 |
| **ST-08-2** | **Safari/iOS secure-context + capture (real iPhone).** Open the app on a real iPhone Safari over **HTTPS** (a LAN-IP over plain HTTP must be refused by `getUserMedia`) → Start check-in → Allow. | Over HTTPS: the camera opens, warming-up shows, and a smoothed band appears by ~90–105 s. Over a non-secure origin: no camera, the blocked/secure-context surface shows (never a silent dead page). This is the **cross-browser capture gate** (continuous `MediaRecorder` on Safari — webm **or** fMP4, per the T009 finding). | SC-001, SC-010; Principle VI |
| **ST-08-3** | **HTTPS / localhost requirement.** On desktop, load the monitor page over a plain `http://<LAN-IP>` origin (not localhost). | `getUserMedia` is blocked by the browser; the app routes to the foggy **secure-context/blocked** surface with calm copy — it does **not** appear to "hang" with a granted-but-dead camera. | FR-010; Principle VI |
| **ST-08-4** | **First smoothed reading + drift-not-flicker.** With the calibrated employee, run a steady ~2-min session. | Warming-up holds until ~90–105 s, then a band (At ease / A little tense / Tense) appears and refreshes ~every 10 s; the band **drifts**, it does not flip every window. **No** percentage/gauge/number anywhere. | SC-001/002/003, FR-015/021 |
| **ST-08-5** | **No-anchor → calibrate-first.** Sign in as the **no-anchor** employee → Start check-in. | The foggy **calibrate-first** panel with a meadow **Start calibration** action — **no camera prompt is ever triggered** and **no stress band is ever shown** (no global/fallback anchor). | SC-004, FR-011 |
| **ST-08-6** | **Low-light / skipped-read.** Dim the room or partially cover the lens mid-session so a window fails the coverage gate (but a face is still roughly present). | The **foggy "couldn't get a clear read" note** shows (distinct from out-of-frame), names a likely cause via the shared CauseChip, and the bloom **keeps the last band** — the loop continues; never amber, never a crash. | SC-005, FR-013/022 |
| **ST-08-7** | **Out-of-frame lifecycle.** Step out of frame > ~90 s, then return; separately, stay out ~5 min. | Out > 90 s → auto-pause + self-view revealed + foggy "move back into frame" (camera stays on); return → auto-resume within ~one stride; stay out ~5 min → auto-end → back to the dashboard recap. | SC-006, FR-004/005/006/007 |
| **ST-08-8** | **Pause / Resume / End.** Manual **Pause** → **Resume** → **End**. | Pause **releases the camera** (light off) and shows the calm neutral paused surface; Resume re-acquires (re-prompts if access was revoked) and warms up again; End returns to the dashboard whose check-in card shows the updated **today** recap (no standalone "ended" screen). | SC-010, FR-006 |
| **ST-08-9** | **Today recap + expand-in-place + read-less honesty.** Complete ≥1 session today, return to the dashboard, click **View today**; separately, end one session during warming-up (or keep every window skipped). | The card recaps **today** and **expands in place** (no route change — URL stays `/app`); the collapsed mini-trend and the expanded view come from the **same** rows (agree); an n=1 session is a single dot; a read-less session reads **"no clear read"** (a neutral marker), **never** calm/at-ease; the day axis auto-fits in **local** time; a still-live session is **not** drawn in today. | SC-008, SC-011, FR-018/019/028–032 |
| **ST-08-10** | **Mobile ≥ 360 px stacking.** Load the monitor page + the dashboard recap at a 360 px viewport (real phone or devtools). | The stage stacks: bloom shrinks, controls go full-width / stack, the pill + viewfinder reposition without overflow; the expanded today view is legible and scrollable; touch targets are ≥ 44 × 44 px. | Principle VI, FR-025 (mock-gap #3) |
| **ST-08-11** | **Reduced-motion.** Enable the OS "reduce motion" setting, then visit the monitor page (all op-states) + the dashboard recap (expand/collapse + cross-highlight). | The bloom's breathing is suppressed (static), the camera-pill pulse stops, the expand animation + the card↔timeline highlight transitions are reduced — while the band, the trend, and all copy stay legible and the cross-highlight still works on hover **and** keyboard focus. | Principle VI, FR-025 |
| **ST-08-12** | **Keyboard a11y.** Tab through the monitor stage (Allow / Pause / Resume / End / pill) and the dashboard recap (View today toggle, plot badges, timeline rows). | Every control has a **visible focus ring**; the expand toggle exposes `aria-expanded`; focusing a session's plot badge or timeline row **cross-highlights** its partner (keyboard parity with hover); no focus trap. | Principle VI, FR-025 |
| **ST-08-13** | **Privacy — no raw video persists (SC-009).** During and after a session, inspect the server: the API's temp dir holds no leftover clip, no per-session clip buffer is retained, and the Supabase tables hold **no** video — only `window_readings` rows (band/captured_at/scored/skip_cause + the server-only label/proba). | The uploaded clip + any temp file are deleted in `finally` (verify the temp dir is empty after each window and after End/crash); **no** column or table stores raw video. Pairs with the automated `test_no_raw_video_persistence` (T055). | SC-009, FR-027; Principle I |
| **ST-08-14** | **Privacy — no manager surface reads sessions/readings.** As the **manager**, attempt to read `monitoring_sessions` / `window_readings` (via the app's manager surfaces and a direct Supabase RLS SELECT as that manager). | The manager gets **nothing** — there is no manager RLS policy on either table, so the SELECT returns zero rows / is denied; no manager UI exposes another user's sessions or readings. Pairs with the automated RLS assertions (T055). | SC-009; Principle I |

**Operator log** — record the run here (one row per device/browser, or a free-form note):

| Date | Device / browser | STs run | Result | Notes |
|---|---|---|---|---|
| _pending_ | _e.g. iPhone 13 / Safari 17_ | ST-08-2, ST-08-10, ST-08-11 | _pending_ | run before production sign-off |

> **Note**: ST-08-2 / ST-08-3 (real Safari/iOS secure-context + capture) remain the authoritative
> cross-browser capture gate; the T051 Playwright happy-path does **not** replace them.

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
