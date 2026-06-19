# Quickstart — Stress Inference Service (008)

How to run and verify the live read path locally. Webcam capture needs a **secure
context** (`localhost` or HTTPS).

## Prerequisites

- Local Supabase running with migrations applied (incl. the new
  `20260619000000_monitoring_sessions_and_readings.sql`).
- A **calibrated employee** account (has `profiles.anchor_vector`) — run the
  calibration flow (features 004–006) or use the seeded demo anchor.
- The committed model at `packages/ml-video/models/` (loads at API startup;
  `/healthz` reports its version).

## Backend (`apps/api`)

```bash
# .env (env-only — never commit; note: NO service-role key, revised D-1)
SUPABASE_JWT_SECRET=...            # existing
SUPABASE_URL=http://127.0.0.1:54321   # now required (JWKS + user-context PostgREST)
SUPABASE_ANON_KEY=...              # NEW — publishable anon key (same as web's NEXT_PUBLIC_SUPABASE_ANON_KEY); NOT a secret
ALLOWED_ORIGINS=http://localhost:3000
# STRESS_OPERATING_POINT unset → default read from metadata.json (0.53)
# STRESS_TENSE_BAND unset → default 0.70

uvicorn app.main:app --reload      # boots: loads model (fail-fast), wires monitoring router
curl localhost:8000/healthz        # {"status":"ready","model_version":"...@2.0.0"}
```

The API talks to Supabase **as the user** (forwarded access token + the anon key),
calling `get_my_anchor()` and writing sessions/readings under RLS — no service-role.
The client uploads the **contiguous recording-so-far** each stride from **one
continuous `MediaRecorder`** (init + all chunks in order — always decodable); the
**server** decodes that one continuous clip and **tail-extracts the last 60 s** via the
existing single-clip path (`compute_anchor` + the VFR sampler, bounded to the trailing
window) — no multi-clip assembly (revised D-2; research R-5/R-7).

## Frontend (`apps/web`)

```bash
npm run dev --workspace=apps/web   # http://localhost:3000 (secure context for webcam)
```

Sign in as the calibrated employee → dashboard → **Start check-in**.

## Manual verification (maps to Success Criteria)

1. **Permission + warming-up (SC-001)**: Start check-in → camera permission → on
   grant, the monitoring page shows **warming-up** ("getting a read on things").
   The first **smoothed band** appears at ~90–105 s, then refreshes ~every 10 s.
2. **Three bands, no number (SC-002)**: the reading is always exactly **At ease /
   A little tense / Tense** on the bloom — confirm **no** percentage/score/gauge
   anywhere.
3. **Drift not flicker (SC-003)**: the band changes gradually; it does not flip
   every window.
4. **No-anchor → calibrate-first (SC-004)**: with an account that has no anchor,
   Start check-in → the **foggy calibrate-first** panel with **Start calibration**;
   no stress band is ever shown.
5. **No-face / skipped (SC-005)**: cover the camera / leave frame briefly → no
   window uploads while no face; a coverage-failure window (e.g. glare) shows the
   **foggy "skipped a read" note** (not out-of-frame) and the bloom keeps the last
   state.
6. **Out-of-frame lifecycle (SC-006)**: step out > 90 s → auto-pause + self-view +
   foggy "move back into frame"; return → auto-resume within ~10 s; stay out 5 min
   → auto-end → dashboard recap.
7. **Slow window non-blocking (SC-007)**: artificially slow one window's
   extraction → the next window still captures/uploads on the 10 s cadence.
8. **Trend consistency (SC-008)**: the dashboard card mini-trend matches the
   monitoring-page trend for the same session.
9. **Privacy (SC-009)**: confirm no raw video persists (temp file deleted) and no
   manager surface can read sessions/readings.
10. **All op-states (SC-010)**: permission, warming-up, active, out-of-frame,
    paused, blocked are reachable and visually distinct (meadow=calm,
    amber=stress, foggy=attention); **ended** returns to the dashboard recap (not
    a standalone screen).
11. **Mobile (Principle VI)**: at 360 px the stage stacks (bloom shrinks, controls
    full-width); **reduced-motion** suppresses the bloom breathing while band +
    trend stay legible.
12. **Continuous-capture windowing validation (R-7, front-loaded — do this FIRST;
    lighter, no fidelity gate)**: on **real Chrome + real Safari/iOS** (Safari → fragmented
    MP4, Chrome → webm), confirm the **one continuous `MediaRecorder`** + **growing
    upload** of the contiguous recording-so-far + **server tail-extract of the last 60 s**
    both **works** (the contiguous file is decodable and the server returns a 2958-d
    vector each stride) and **keeps up** (per-stride server time within the 10 s stride
    across a 5-min session — worst case is the last stride, ~300 s decoded). This reuses
    the proven `/anchor` upload+extract path. Do **not** rely on Playwright alone (false
    cross-browser confidence) — use the real Safari smoke channel. It stays the
    **Safari/iOS pre-production gate** but is **no longer a fidelity gate**: a keep-up
    breach means the deferred rolling decoded-frame buffer is needed for production, not
    that windowing re-opens.

## Automated tests

```bash
# Backend + first predict_delta test
pytest apps/api/tests/test_monitoring_endpoints.py apps/api/tests/test_inference_service.py apps/api/tests/test_smoothing.py
pytest packages/ml-video/tests/test_predict_delta.py
pytest packages/ml-video/tests/test_tail_window.py         # pins the tail-window option (last-60 s bound; reduces to compute_anchor for ≤60 s)
pytest packages/ml-video/tests/test_webm_vfr_fidelity.py   # scheduled hardening (not a ship blocker)

# Frontend
npm run test --workspace=apps/web                          # Vitest + RTL
npx playwright test employee-monitoring --workspace=apps/web
```
