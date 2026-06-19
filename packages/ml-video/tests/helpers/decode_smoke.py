"""Decode-smoke helper for the feature-008 continuous windowing validation (T003/T008).

A single tiny utility the human runs (via the ``__main__`` CLI below) to confirm that
an uploaded **contiguous recording-so-far** is **decodable** — the *(works)* half of the
continuous works-and-keeps-up validation (`tasks.md` T008): every stride uploads one
continuous, always-decodable clip that the server must open before tail-extracting its
last 60 s. It deliberately does NOT touch mediapipe or features; it only opens the
container with OpenCV and counts the frames it can decode.

Usage (run from ``packages/ml-video`` with its ``.venv`` python; it has no intra-package
imports, so invoke it as a direct script path, not ``-m``):

    .venv/Scripts/python tests/helpers/decode_smoke.py \
        tests/fixtures/multiclip/chrome-singlesource/continuous.webm

(For the real-device run, point it at the recorded continuous fixtures under
``tests/fixtures/continuous/{chrome,safari}/`` — see T007.)

Each path prints ``OK <n_frames> <path>`` or ``FAIL <path>`` and the process exits
non-zero if any clip failed to open or yielded zero frames.
"""

from __future__ import annotations

import sys
from dataclasses import dataclass

import cv2


@dataclass(frozen=True)
class DecodeResult:
    path: str
    opened: bool
    frame_count: int

    @property
    def ok(self) -> bool:
        """A clip is usable iff OpenCV opened it AND it decoded at least one frame."""
        return self.opened and self.frame_count > 0


def decode_smoke(video_path) -> DecodeResult:
    """Open ``video_path`` and count decodable frames (grab loop, no pixel copy).

    Returns a :class:`DecodeResult`. Never raises on a bad container — a clip that
    cannot be opened comes back as ``opened=False, frame_count=0`` so the caller can
    report it as a FAIL rather than crash the whole sweep.
    """
    path = str(video_path)
    cap = cv2.VideoCapture(path)
    if not cap.isOpened():
        return DecodeResult(path=path, opened=False, frame_count=0)
    count = 0
    try:
        while cap.grab():
            count += 1
    finally:
        cap.release()
    return DecodeResult(path=path, opened=True, frame_count=count)


def _main(argv: list[str]) -> int:
    if not argv:
        print("usage: python -m tests.helpers.decode_smoke <clip> [<clip> ...]", file=sys.stderr)
        return 2
    any_fail = False
    for arg in argv:
        result = decode_smoke(arg)
        if result.ok:
            print(f"OK   {result.frame_count:5d}  {result.path}")
        else:
            any_fail = True
            print(f"FAIL  ----  {result.path}  (opened={result.opened})")
    return 1 if any_fail else 0


if __name__ == "__main__":  # pragma: no cover - dev-only CLI
    raise SystemExit(_main(sys.argv[1:]))
