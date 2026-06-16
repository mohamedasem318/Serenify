"""Error types for the video modality pipeline."""

from __future__ import annotations


class FeatureExtractionError(Exception):
    """Raised when anchor/feature extraction cannot produce a valid (2958,) vector.

    Covers the "no prediction available" conditions from MODEL_HANDOFF §3 Step 4
    and §8 red-flag 6: an ROI that yields zero valid frames (so LBP-TOP would be
    < 90-d), too few decoded frames for motion statistics, or any other malformed
    intermediate. The API layer maps this to HTTP 422 (extraction_failed), never a
    500 — it is an expected, user-recoverable outcome (record again), not a server
    fault.

    ``code`` (feature 006) is an optional stable, categorical machine code that the
    API surfaces as the HTTP 422 ``reason`` (e.g. ``"insufficient_face_frames"`` from
    the usable-face-coverage gate). Existing raises omit it (``code is None``) and
    keep their free-text message as the reason — backward-compatible. The code is
    deliberately count-free so no numeric detail can leak to the client (Principle I).
    """

    def __init__(self, message: str, *, code: str | None = None) -> None:
        super().__init__(message)
        self.code = code
