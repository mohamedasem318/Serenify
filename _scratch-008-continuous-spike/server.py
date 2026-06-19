"""Disposable continuous-capture spike SERVER (feature 008, task T002).

NOT part of ``apps/api`` and NOT shipped — throwaway scaffolding for the real-device
**works-and-keeps-up** validation (T007/T008). It is the **per-component-timing instrument**
the device gate reads: it answers, for an uploaded contiguous recording-so-far, both *does it
work* (decodable -> a (2958,) vector, or the "skipped" case) and *does it keep up* (how long the
decode-to-tail and the extract each take, **separately**).

It serves the client page (``GET /``) and accepts the upload (``POST /upload``) on **one origin**
so the camera's secure-context requirement is satisfied by ``localhost`` / ngrok-HTTPS alone (no
CORS). For each upload it:

  1. writes the raw body to a temp file;
  2. runs the ml-video extract with the **T005 ``tail_seconds=60`` option**, *reusing
     ``compute_anchor``'s own building blocks* (``_probe_timestamps`` -> ``_select_keep_indices``
     -> ``_retrieve_frames`` -> ``_build_face_mesh``/``_landmarks_from_result`` ->
     ``lbp_top_features`` (+) ``motion_features``) — NOT a re-implementation of the feature math;
     the resulting vector is identical to ``compute_anchor(path, tail_seconds=60)``;
  3. reports **two separate timings** — ``decode_to_tail_s`` (probe + tail-select + retrieve; the
     cost that GROWS with the growing clip) and ``extract_s`` (MediaPipe FaceMesh + LBP + motion;
     the CONSTANT per-window cost) — so a T008 keep-up breach can be attributed to the right
     component (research R-5 / T009) without re-running the 5-min session;
  4. deletes the temp clip in a ``finally`` (Principle I — raw video never persists).

Run it with the **ml-video venv python** (it must import ``ml_video`` + cv2 + mediapipe):

    packages/ml-video/.venv/Scripts/python _scratch-008-continuous-spike/server.py
    # then open http://localhost:8009  (desktop) — see README.md for the iPhone/ngrok path.
"""

from __future__ import annotations

import json
import os
import sys
import tempfile
import time
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path

import cv2
import numpy as np

from ml_video import FeatureExtractionError
from ml_video.coverage import assert_usable_face_coverage
from ml_video.features import FEATURE_DIM, lbp_top_features, motion_features
from ml_video.pipeline import (
    _build_face_mesh,
    _landmarks_from_result,
    _probe_timestamps,
    _retrieve_frames,
    _select_keep_indices,
)

HERE = Path(__file__).resolve().parent
PORT = int(os.environ.get("SPIKE_PORT", "8009"))
TAIL_SECONDS = 60.0


def measure(clip_path: str, tail_seconds: float = TAIL_SECONDS) -> dict:
    """Run the tail-window extract on ``clip_path``, timing the two phases separately.

    Mirrors ``ml_video.compute_anchor(clip_path, tail_seconds=tail_seconds)`` exactly (same
    building blocks, same order) but splits the wall-clock into ``decode_to_tail_s`` and
    ``extract_s``. Always returns both timings — even on the "skipped" path — so a slow window
    can be diagnosed without a re-run. Never raises ``FeatureExtractionError`` (it is mapped to
    ``outcome="skipped"``).
    """
    result: dict = {
        "outcome": None,        # "reading" | "skipped"
        "dim": None,            # 2958 on a reading
        "shape": None,          # "(2958,)" on a reading
        "decode_to_tail_s": None,
        "extract_s": None,
        "kept_frames": None,
        "reason": None,         # the FeatureExtractionError code/message on a skip
    }

    # --- Phase 1: decode-to-tail (GROWS with elapsed session time) ---------------------------
    t0 = time.perf_counter()
    fps, _fc, _w, _h, timestamps_ms = _probe_timestamps(clip_path)
    keep = set(_select_keep_indices(len(timestamps_ms), fps, timestamps_ms, tail_seconds=tail_seconds))
    frames = _retrieve_frames(clip_path, keep)
    result["decode_to_tail_s"] = round(time.perf_counter() - t0, 4)
    result["kept_frames"] = len(frames)

    # --- Phase 2: extract — MediaPipe FaceMesh + LBP + motion (CONSTANT per window) ----------
    t1 = time.perf_counter()
    try:
        if not frames:
            raise FeatureExtractionError("no frames left after downsample")
        face_mesh = _build_face_mesh()
        rows: list[np.ndarray] = []
        try:
            for frame in frames:
                rgb = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)
                rows.append(_landmarks_from_result(face_mesh.process(rgb)))
        finally:
            close = getattr(face_mesh, "close", None)
            if callable(close):
                close()
        landmarks = np.asarray(rows, dtype=np.float64)
        assert_usable_face_coverage(landmarks)  # feature-006 gate (same as compute_anchor)
        vector = np.concatenate([lbp_top_features(frames, landmarks), motion_features(landmarks)])
        if vector.shape != (FEATURE_DIM,):
            raise FeatureExtractionError(f"expected ({FEATURE_DIM},), got {vector.shape}")
        if not np.all(np.isfinite(vector)):
            raise FeatureExtractionError("anchor vector contains non-finite values")
        result["extract_s"] = round(time.perf_counter() - t1, 4)
        result["outcome"] = "reading"
        result["dim"] = int(vector.shape[0])
        result["shape"] = f"({int(vector.shape[0])},)"
    except FeatureExtractionError as exc:
        result["extract_s"] = round(time.perf_counter() - t1, 4)
        result["outcome"] = "skipped"
        result["reason"] = getattr(exc, "code", None) or str(exc)
    return result


class Handler(BaseHTTPRequestHandler):
    def _send_json(self, status: int, payload: dict) -> None:
        body = json.dumps(payload).encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", "application/json")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def do_GET(self) -> None:  # noqa: N802 - http.server signature
        path = self.path.split("?", 1)[0]
        if path in ("/", "/index.html"):
            body = (HERE / "index.html").read_bytes()
            self.send_response(200)
            self.send_header("Content-Type", "text/html; charset=utf-8")
            self.send_header("Content-Length", str(len(body)))
            self.end_headers()
            self.wfile.write(body)
        else:
            self.send_error(404, "not found")

    def do_POST(self) -> None:  # noqa: N802 - http.server signature
        if self.path.split("?", 1)[0] != "/upload":
            self.send_error(404, "not found")
            return
        length = int(self.headers.get("Content-Length", 0) or 0)
        if length <= 0:
            self._send_json(400, {"outcome": "error", "reason": "empty upload"})
            return
        ctype = (self.headers.get("Content-Type") or "video/webm").lower()
        suffix = ".mp4" if "mp4" in ctype else ".webm"
        # the contiguous recording-so-far is the raw POST body (the spike's simplified shape;
        # the production /anchor route uses multipart field `clip` — see README).
        data = self.rfile.read(length)
        fd, tmp_path = tempfile.mkstemp(suffix=suffix)
        wall0 = time.perf_counter()
        try:
            with os.fdopen(fd, "wb") as fh:
                fh.write(data)
            result = measure(tmp_path)
            result["upload_bytes"] = length
            result["server_total_s"] = round(time.perf_counter() - wall0, 4)
            self._send_json(200, result)
            # one-line server log so the operator sees the split live, per stride.
            print(
                f"[upload] {length/1e6:6.2f} MB  outcome={result['outcome']:<8} "
                f"kept={result['kept_frames']}  decode_to_tail={result['decode_to_tail_s']}s  "
                f"extract={result['extract_s']}s  reason={result['reason']}",
                flush=True,
            )
        except Exception as exc:  # noqa: BLE001 - spike: never crash the loop on one upload
            self._send_json(500, {"outcome": "error", "reason": f"{type(exc).__name__}: {exc}"})
        finally:
            # Principle I — raw video never persists, on any outcome.
            try:
                os.unlink(tmp_path)
            except OSError:
                pass

    def log_message(self, *_args) -> None:  # noqa: ANN002 - silence default request spam
        pass


def main() -> int:
    server = ThreadingHTTPServer(("0.0.0.0", PORT), Handler)
    print(f"continuous-capture spike server on http://localhost:{PORT}  (Ctrl-C to stop)", flush=True)
    print(f"  extract: compute_anchor building blocks, tail_seconds={TAIL_SECONDS:.0f}", flush=True)
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        print("\nstopping…", flush=True)
    finally:
        server.server_close()
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
