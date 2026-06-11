# Contract: Rejection messaging — new reason value, existing 422 channel

📌 DECISION-30. Reuses the existing `FeatureExtractionError → HTTP 422 →
005 failure-screen / cause-chip` flow (FR-009/010); adds **one** reason value and
**one** chip, additively. No new endpoint, status, or response field.

## 1. Backend error type — `packages/ml-video/src/ml_video/errors.py` (MODIFIED)

```python
class FeatureExtractionError(Exception):
    def __init__(self, message: str, *, code: str | None = None) -> None:
        super().__init__(message)
        self.code = code
```
- Backward-compatible: every existing raise passes only a message → `code is None`.
- The gate raises `FeatureExtractionError(..., code="insufficient_face_frames")`.

## 2. API router — `apps/api/app/routers/anchor.py` (MODIFIED, 1 line)

```python
except FeatureExtractionError as exc:
    reason = getattr(exc, "code", None) or str(exc)   # NEW: prefer the categorical code
    return JSONResponse(
        status_code=422,
        content={"error": "extraction_failed", "reason": reason},
    )
```

| Source | `reason` on the wire |
|---|---|
| coverage gate | `"insufficient_face_frames"` (categorical; **no numbers** — FR-016) |
| every existing extraction failure | `str(exc)` — **unchanged** |

Body shape `{ "error": "extraction_failed", "reason": "<string>" }` is **unchanged**
(FR-009/010). Same `POST /anchor`, same 422 status, same JWKS/ES256 auth, same
raw-byte deletion in the `finally`.

## 3. Frontend cause selection — `apps/web/components/anchor/anchor-recorder.tsx` (MODIFIED)

In `submitClip`, on `extraction_failed` (the server reason is authoritative for the
new case; the existing `dominantCause` path is the fallback for everything else):

```js
if (result.kind === "extraction_failed") {
  const cause =
    result.reason === "insufficient_face_frames"
      ? "insufficient-face"                         // server-authoritative (incl. detector-unavailable)
      : dominantCause(telemetryRef.current);        // UNCHANGED existing selection
  setFailureCause(cause);
  dispatch({ type: "EXTRACT_FAILED", reason: result.reason });
}
```

- Existing behaviour for all non-`insufficient_face_frames` reasons is **byte-for-byte
  unchanged** (incl. detector-unavailable → `dominantCause` → `our-side`) — FR-013/014.
- This is the first consumer of `result.reason` for chip selection (the reducer
  already threads it as `errorReason`; see research.md flag 1).

## 4. Frontend chip — `apps/web/components/anchor/failure-state.tsx` (MODIFIED)

```js
export type FailureCause = "low-light" | "out-of-frame" | "our-side" | "insufficient-face";

const CAUSE: Record<FailureCause, { Icon: LucideIcon; line: string }> = {
  "low-light":   { Icon: Sun,         line: "Facing a little more light usually helps." },        // unchanged
  "out-of-frame":{ Icon: MoveDiagonal,line: "Staying roughly centred and still helps." },         // unchanged
  "our-side":    { Icon: CloudOff,    line: "This one was on our side — give it a moment and try again." }, // unchanged
  "insufficient-face": { Icon: ScanFace, line: "We couldn’t see your face for enough of that recording — let’s try again." }, // NEW
};
```
- Only an **addition** to the union and the map. Foggy surface, Lucide icon, calm
  Principle-V voice (no exclamation, no "detected", no self-blame, owns nothing it
  shouldn't and instructs gently). Final icon (`ScanFace` vs `EyeOff`) chosen at
  implement.

## 5. No-regression test contract (Vitest — FR-013/018)

- A 422 with `reason === "insufficient_face_frames"` → `FailureState` receives
  `cause="insufficient-face"` (new chip + copy).
- A 422 with any other reason → `cause === dominantCause(telemetry)` (unchanged),
  including the detector-unavailable → `our-side` case.
- The three existing `CAUSE` entries are unchanged (explicit assertion).

## Voice check (Principle V / SC-005)
The new line contains no exclamation mark and none of the alarmist/clinical blocklist
("detected", "alert", "abnormal", "elevated risk"); it is specific, calm, and
non-blaming — it states what happened ("we couldn't see your face for enough of that
recording") and offers a gentle retry, consistent with the foggy failure screen.
