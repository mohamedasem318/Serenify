# Coverage-fixture provenance & device forensics

Note for a future maintainer. Covers where the four coverage-gate clips
(`thin`, `good_ideal`, `good_realistic`, `half`) came from and how we established
that **none of them is an iOS capture**. (The committed `.npy` arrays are now
**synthetic** stand-ins — see `README.md` and `make_synthetic_fixtures.py`. This note
is the record of the *real clips* those arrays were originally extracted from.)

## Verdict

All four are **landscape webcam captures; none is iOS**. This matters because iOS
captures in this project were a teammate's (Gehad's) and would need a consent
message before reuse — so it was worth confirming.

- `thin`, `good_ideal`, `good_realistic` — attributed to **Mohamed** in feature 006
  `specs/006-calibration-capture-quality/tasks.md` **T012** ("clips supplied locally
  by Mohamed").
- `half` — added later in the DECISION-32 webm recalibration; the docs call it only a
  generic "developer clip", **no written name attribution**. Its ownership is inferred
  **geometrically** (below): same landscape capture regime as the other three, not iOS.

Every iPhone / iOS / Safari / Gehad mention in feature 006 concerns **app-flow
smoke-testing** of the anchor-recorder UI on WebKit (`smoke-tests.md`), *not* the
recording of these clips. Don't conflate the two.

## Device-fingerprint method

The dev recorder (`packages/ml-video/tools/dev_webm_recorder.html`) calls
`getUserMedia({video: true})` **unconstrained**, so the camera's native frame
orientation survives into the capture. FaceMesh then normalizes each landmark's x by
frame **width** and y by frame **height** *independently*. A real face has a roughly
fixed physical width:height, so the face's **normalized x-span / y-span ratio encodes
the upstream frame aspect**: a portrait frame (taller than wide) inflates the x-span
fraction and shrinks the y-span fraction → **high** ratio; a landscape frame → **low**
ratio. Device metadata is stripped at extraction, but this geometric signature is not.

Calibrated against the known-device control clips still in the repo under
`tests/fixtures/continuous/{chrome,safari}/` (raw webm, **gitignored / local-only** —
may be absent in a fresh clone), re-extracted through the same pipeline:

| Source | Frame | face x-span / y-span |
|---|---|---:|
| Known **iPhone / Safari** (portrait) | 480×640 | **≈ 1.09–1.10** |
| Known **Chrome laptop** (landscape 4:3) | 960×720 | **≈ 0.615** |
| **All four fixtures** | — | **≈ 0.45–0.46** |

The four fixtures sit firmly in the landscape regime, ~2.4× away from the iPhone
portrait signature with **zero overlap** — so none is an iOS capture.

## Why the fixtures (~0.45) read lower than the Chrome control (~0.615)

Both are landscape; the gap is a **webcam aspect-ratio difference, not pose or
distance**. (Distance can't cause it — moving nearer scales x and y together and
leaves their ratio unchanged. Pose can't either — four independent recordings agree to
within ~0.01, too tight for head-turn to be the driver.)

Recovering frame aspect from a pose-robust anatomical ratio (interocular width ÷
face height) confirms it. Calibrating the anatomical constant on the two control clips
(known frame aspects) gives a consistent `K ≈ 0.534` (0.538 chrome / 0.531 safari,
~1.4% spread), and inverting it for the fixtures yields an inferred frame
height/width of **≈ 0.56 for all four = 16:9**, versus the Chrome control's **4:3
(0.75)**. So the fixtures were shot on a **16:9** webcam and the control clip on a
**4:3** one. This only strengthens the iOS conclusion: 16:9 landscape (0.5625) is even
*further* from portrait (1.333) than the 4:3 control is.

## The 150-vs-151 frame count

`good_realistic` has 151 rows; the other three have 150. This is **not** a different
pipeline or device — it's the sampler's ~2.5 fps (400 ms bucket) grid over a slightly
longer recording. `good_realistic` ran 60.29 s vs ~59.97 s for the others; the extra
~0.3 s crosses one more bucket boundary. The bucket count
`floor((duration_ms − 200) / 400) + 1` reproduces 150 / 150 / **151** / 150 exactly.
