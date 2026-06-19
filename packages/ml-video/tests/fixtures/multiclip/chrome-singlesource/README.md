# Single-source multi-clip GATE fixture (feature 008, B2) — assembly isolated

This fixture exists to answer **one** question the original cross-take fixture could not:
**with identical source content, does the multi-clip assembly reproduce the continuous
vector?** It isolates *assembly fidelity* from *recording reproducibility* (see
`docs/DECISIONS.md` 2026-06-19 windowing entries and `smoke-tests.md` Step F).

> **Raw video is NEVER committed.** The repo-level `tests/fixtures/.gitignore` excludes
> `*.webm` / `*.mp4` / … recursively, so everything here except this README and
> `clips/.gitkeep` stays local and untracked. The gate **skips** when the clips are absent.

## How it is generated (no new recording, no re-encode)

`continuous.webm` is a **copy of the existing real-Chrome `chrome/continuous.webm`**. The
`clips/` are that SAME file losslessly segmented — `-c copy`, so every segment is the exact
same VP9 frames, no re-encode, no take-to-take difference:

```bash
# from packages/ml-video/tests/fixtures/multiclip
cp chrome/continuous.webm chrome-singlesource/continuous.webm
ffmpeg -hide_banner -loglevel error -i chrome/continuous.webm \
  -c copy -map 0 -f segment -segment_time 11 -reset_timestamps 1 \
  chrome-singlesource/clips/clip_%02d.webm
```

- `-c copy` → lossless; the union of the segments' decoded frames is **bit-identical** to
  `continuous.webm` (verified: 6 segments decode to 404+303+303+404+303+267 = **1984** frames,
  exactly `continuous.webm`'s 1984).
- `-reset_timestamps 1` → each segment's `CAP_PROP_POS_MSEC` restarts at ~0, modelling a real
  B2 stop/restart standalone clip (which genuinely starts at t=0 with no global clock).

### Keyframe-alignment caveat

`-c copy` can only cut on keyframes, and this clip's GOP is ~3.36 s, so the segment
boundaries snap to that grid — segment durations are **not** uniform (13.4 / 10.0 / 10.0 /
13.4 / 10.0 / 8.8 s for `-segment_time 11`). This does not affect the frames (their union is
the continuous decode); it only means the seams land on keyframes, not at exact 11 s marks.

## How the gate reads it

`tests/test_multiclip_fidelity.py` auto-discovers this dir (it has a `continuous.*` and a
non-empty `clips/`) and runs `test_multiclip_fidelity_gate[chrome-singlesource]`. The
per-frame / per-block decomposition + sampled-frame-timestamp comparison is in
`tests/helpers/singlesource_fidelity.py`.
