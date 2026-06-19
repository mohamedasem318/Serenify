"""Decode-smoke helper for the feature-008 B2 windowing GATE (T003/T006).

A single tiny utility the human runs (via ``test_multiclip_fidelity.py`` or the
``__main__`` CLI below) to confirm that a recorded clip is **independently
decodable** — i.e. the B2 promise that every stop/restart clip carries its own
container init and opens on its own (unlike a bare B1 timeslice chunk, which
cannot). It deliberately does NOT touch mediapipe or features; it only opens the
container with OpenCV and counts the frames it can decode.

Usage (real-device GATE — run from ``packages/ml-video`` with its ``.venv`` python; it
has no intra-package imports, so invoke it as a direct script path, not ``-m``):

    .venv/Scripts/python tests/helpers/decode_smoke.py \
        tests/fixtures/multiclip/chrome/clips/clip_00.webm \
        tests/fixtures/multiclip/chrome/continuous.webm

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
