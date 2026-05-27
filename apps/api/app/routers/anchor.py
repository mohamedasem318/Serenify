"""POST /anchor — extract a calm-baseline anchor vector (DECISION-8, Principle I).

Contract:
- auth: Bearer JWT (verify_jwt) -> 401 on missing/invalid.
- body: multipart/form-data field ``clip``, content-type video/mp4 or video/webm
  (DECISION-11) -> 415 otherwise.
- success: 200 AnchorResponse {model_version, dim, vector_b64} (base64 LE float32).
- extraction failure: 422 {error:"extraction_failed", reason}.
- the raw upload is written to a temp file and **deleted unconditionally** in a
  finally (Principle I) — no video bytes persist on success OR failure.
"""

from __future__ import annotations

import base64
import os
import tempfile

import ml_video
from fastapi import APIRouter, Depends, File, Request, UploadFile
from fastapi.responses import JSONResponse
from ml_video import FeatureExtractionError

from ..auth import verify_jwt
from ..schemas import AnchorResponse

router = APIRouter()

# Content-type allow-list (DECISION-11, FR-047). MediaRecorder appends a codecs
# parameter (e.g. "video/webm;codecs=vp9") which is stripped before the check.
_ALLOWED_TYPES = {"video/mp4", "video/webm"}
_SUFFIX = {"video/mp4": ".mp4", "video/webm": ".webm"}


@router.post("/anchor")
async def create_anchor(
    request: Request,
    user_id: str = Depends(verify_jwt),
    clip: UploadFile = File(...),
):
    base_type = (clip.content_type or "").split(";")[0].strip().lower()
    if base_type not in _ALLOWED_TYPES:
        return JSONResponse(
            status_code=415,
            content={
                "error": "unsupported_media_type",
                "reason": "expected video/mp4 or video/webm",
            },
        )

    fd, tmp_path = tempfile.mkstemp(suffix=_SUFFIX[base_type])
    try:
        with os.fdopen(fd, "wb") as fh:
            fh.write(await clip.read())
        try:
            vector = ml_video.compute_anchor(tmp_path)
        except FeatureExtractionError as exc:
            return JSONResponse(
                status_code=422,
                content={"error": "extraction_failed", "reason": str(exc)},
            )
        vector_b64 = base64.b64encode(vector.astype("<f4").tobytes()).decode("ascii")
        return AnchorResponse(
            model_version=request.app.state.predictor.model_version,
            dim=int(vector.shape[0]),
            vector_b64=vector_b64,
        )
    finally:
        # Principle I — raw video never persists, on any outcome.
        try:
            os.unlink(tmp_path)
        except OSError:
            pass
