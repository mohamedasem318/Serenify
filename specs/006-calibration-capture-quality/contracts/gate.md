# Contract: Server-side usable-face-coverage gate (`packages/ml-video/`)

Authoritative modality logic (Constitution Principle III / FR-001). 📌 DECISION-30.

## Module: `packages/ml-video/src/ml_video/coverage.py` (NEW)

```python
from __future__ import annotations
import logging
import numpy as np
from .errors import FeatureExtractionError

logger = logging.getLogger(__name__)

# [CALIBRATION-PENDING] — set by the DECISION-32 procedure during /speckit-implement.
MIN_USABLE_FRAMES: int = ...        # absolute floor (FR-005, secondary backstop)
MIN_COVERAGE_FRACTION: float = ...  # coverage fraction (FR-006, primary lever)

def usable_face_coverage(landmarks: np.ndarray) -> tuple[int, int, float]:
    """(usable, kept, fraction). usable = non-zero rows; kept = total rows."""
    kept = int(landmarks.shape[0])
    usable = int(np.count_nonzero(np.any(landmarks, axis=1)))
    fraction = (usable / kept) if kept else 0.0
    return usable, kept, fraction

def assert_usable_face_coverage(landmarks: np.ndarray) -> None:
    """Raise FeatureExtractionError(code='insufficient_face_frames') if the clip
    fails EITHER the absolute floor OR the coverage fraction (FR-005/006/007)."""
    usable, kept, fraction = usable_face_coverage(landmarks)
    if usable < MIN_USABLE_FRAMES or fraction < MIN_COVERAGE_FRACTION:
        # Counts go ONLY to the server log — NEVER into the exception message
        # (so even str(exc) cannot leak them). Wire reason is the categorical code.
        logger.info("coverage reject: usable=%d kept=%d fraction=%.3f", usable, kept, fraction)
        raise FeatureExtractionError(
            "insufficient usable face coverage",   # generic, count-free
            code="insufficient_face_frames",
        )
```

### Predicate contract (FR-004)
- "Usable face frame" = a **non-zero** landmark row. This is exactly the predicate
  `features.py::lbp_top_features` already uses (`if not np.any(row): continue`) and
  the all-zero no-face row `pipeline._landmarks_from_result` emits. The gate counts
  the existing signal; it adds no detector.

### Decision contract (FR-005/006/007)
- Accept **iff** `usable >= MIN_USABLE_FRAMES` **and** `fraction >= MIN_COVERAGE_FRACTION`.
- Reject (raise) if **either** condition fails.
- `kept` is always ≥1 at the gate (`extract_landmarks` raises earlier on zero kept
  frames); `fraction` guards divide-by-zero defensively.

### Privacy contract (Principle I / FR-016)
- `usable`, `kept`, `fraction` are emitted **only** to the server log line above —
  **never** in the exception message and never on the wire.
- The exception **message is generic and count-free** (`"insufficient usable face
  coverage"`); the `code` is the **categorical** token. The wire reason (see
  `messaging.md`) is the code, so even `str(exc)` cannot leak counts.

## Call site: `packages/ml-video/src/ml_video/anchor.py` (MODIFIED)

```python
clip = extract_landmarks(video_path)
assert_usable_face_coverage(clip.landmarks)          # NEW — additive, before the floors
features = np.concatenate([
    lbp_top_features(clip.frames, clip.landmarks),   # existing floor: ≥1 usable frame per ROI
    motion_features(clip.landmarks),                 # existing floor: ≥2 kept frames
])
```

### Composition contract (additive, never loosening — DECISION-30)
- The gate runs **first**. It can only **raise earlier**; it never bypasses or relaxes
  the existing floors — when the gate passes, control reaches `lbp_top_features` /
  `motion_features` unchanged.
- A capture the floors would reject is **still** rejected (the gate doesn't gate them
  out). A capture that previously passed the floors but is coverage-thin is **newly**
  rejected by the gate. (Tested — R-5.)

## Test contract (`tests/test_usable_face_coverage_gate.py`, NEW — FR-017/018, Principle VII)

- **Reject-below / accept-above at the real boundary**, gate logic **never mocked**:
  - `assert_usable_face_coverage(load("thin.npy"))` **raises**, with
    `exc.code == "insufficient_face_frames"`.
  - `assert_usable_face_coverage(load("good_ideal.npy"))` does **not** raise.
  - `assert_usable_face_coverage(load("good_realistic.npy"))` does **not** raise
    (binding upper bound; the no-false-reject assertion, SC-002).
- **Wired into `compute_anchor`**: monkeypatch `pipeline._build_face_mesh` (or
  `extract_landmarks`) to return the thin rows; assert `compute_anchor(...)` raises
  with `code == "insufficient_face_frames"` — the real call site, no mediapipe.
- **No-regression (gate level)**: a detected-throughout array (all non-zero rows)
  passes the gate regardless of framing — an "off-centre but detected" capture is not
  rejected here (FR-013/018).
- Fixtures are committed `.npy` arrays; **CI runs no mediapipe** (determinism).

## Out of scope (gate does NOT do)
- No image-quality grading of present faces (soft/dim/blurry/small-but-detected) — the
  gate counts presence only.
- No change to the live-inference path; this is the anchor/baseline path only.
- No retroactive evaluation of stored anchors.
