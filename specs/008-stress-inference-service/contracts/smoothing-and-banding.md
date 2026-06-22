# Contract — Smoothing, Banding & Cold-Start (008, D-3)

The concrete numbers for FR-014 / FR-015 / SC-001 / SC-003, computed
**server-side** in the window endpoint (`apps/api/app/services/smoothing.py`) so
the band is authoritative and the two trend surfaces agree (SC-008). The model is
binary with **non-probability-calibrated** `predict_proba`; **no numeric value is
ever shown** — these rules only choose one of three bands.

---

## Inputs

- `proba[1]` — the current window's stress-positive probability from
  `Predictor.predict_delta(delta)` (raw, uncalibrated).
- The session's prior **scored** readings' `stress_probability` values
  (`window_readings` where `scored=true`), most-recent first.

## Constants (config-exposed)

| Name | Default | Config / source | Meaning |
|---|---|---|---|
| `N` (smoothing window) | **4** | code constant | rolling count of recent **scored** readings averaged |
| `M` (cold-start) | **4** | code constant (`= N`) | scored readings required before any band is shown |
| `t_low` | **0.53** | `STRESS_OPERATING_POINT` ← `metadata.json` operating point | At-ease vs tense cut (the model contract's operating point) |
| `t_high` | **0.70** | `STRESS_TENSE_BAND` | A-little-tense vs Tense cut (**display-only** product band) |

`t_low` default is read from
`metadata.json → loso_metrics_60s_calibrated.threshold_sweep_recommended.threshold`
at startup — never a hard-coded literal (FR-012). `t_high` has no metadata source
(the model carries only the single stress/not-stress operating point), so it is a
documented product default, tunable without retraining.

---

## Algorithm (per window)

```
on scored window with current proba1:
    recent = last (N-1) scored stress_probability for this session   # newest first
    buffer = [proba1] + recent
    if len(buffer) < M:
        band = NULL            # WARMING-UP: persist scored reading, return outcome "warming_up"
    else:
        smoothed = mean(buffer[:N])          # trailing mean of the most recent N
        if   smoothed <  t_low:   band = "at_ease"
        elif smoothed <  t_high:  band = "a_little_tense"
        else:                     band = "tense"
        # return outcome "reading" with band

on skipped window (FeatureExtractionError):
    # does NOT enter the smoothing buffer, does NOT count toward M
    persist scored=false, band=NULL, skip_cause=<...>; bloom keeps last band
```

- **Skipped windows never enter the buffer** and never reset/advance warm-up; a
  run of skips just delays reaching `M` (during warm-up) or leaves the last
  smoothed band showing (after warm-up).
- The trailing mean over `N=4` of an already-overlapping signal (consecutive 60 s
  windows share 50 s) yields a band that **drifts, not flickers** (SC-003) while
  spanning ~90 s of underlying video — responsive enough to track a real trend.

---

## Cold-start timeline → SC-001

| Reading | ~Capture-complete time | Scored count | Display |
|---|---|---|---|
| 1 | ~60 s (+3–5 s extract) | 1 | warming-up |
| 2 | ~70 s | 2 | warming-up |
| 3 | ~80 s | 3 | warming-up |
| **4** | **~90 s (+extract)** | **4** | **first band** (mean of readings 1–4) |
| 5+ | ~100 s, ~110 s … | 5+ | band updates ~every 10 s (trailing mean of last 4) |

First smoothed band at **~90–105 s**, then ~every 10 s — matches the updated
SC-001. The display holds **warming-up** the entire time before reading 4, so the
first state the user ever sees is already smoothed (mock-gap #2).

---

## Band → UI (Principle V, governed by the mock)

| Band | Bloom / color role | Copy (calm) |
|---|---|---|
| `at_ease` | **meadow** bloom | "You're at ease right now" |
| `a_little_tense` | **amber** signal (soft-tint) | "You're a little tense" |
| `tense` | **amber** signal (soft-tint) | "You're feeling tense" |
| warming-up | neutral/calm bloom (meadow-muted) | "Getting a read on things" |

amber = stress signal only; the warming-up and skipped states use neutral/foggy,
never amber-as-alarm. Built against Graphite tokens, not the mock's hex.

---

## Tests (Principle VII)

`apps/api/tests/test_smoothing.py` (pure function, no model needed):
- warm-up: < 4 scored readings → `band is None` / outcome `warming_up`; the 4th
  scored reading produces a band.
- banding boundaries: smoothed `0.52→at_ease`, `0.53→a_little_tense`,
  `0.69→a_little_tense`, `0.70→tense` (inclusive at `t_low`/`t_high`).
- drift: an alternating raw sequence around the boundary produces a **stable**
  banded output (no per-window flip) — locks SC-003.
- skipped windows: excluded from the buffer and from the `M` count; last band
  persists.
- config override: changing `STRESS_OPERATING_POINT` / `STRESS_TENSE_BAND` moves
  the boundaries (proves no hard-coded literal; FR-012).
