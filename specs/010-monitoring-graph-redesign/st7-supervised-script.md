# ST-7 Supervised Script — Out-of-frame / return graph blanking

> **One-time run doc. NOT smoke-tests.md. Discard when done.**
> Branch: `010-monitoring-graph-redesign`
> Logging flag: `__ST7 = true` in `session-trend.tsx` + `monitoring-session.tsx`
> After the run: flip both `__ST7` to `false` and commit, or delete the `[ST7-DEBUG]` blocks.

---

## Step 0 — Clean start (eliminates stale-module risk)

| Action | Expected | Capture |
|--------|----------|---------|
| Kill any running Next dev server | — | — |
| Start fresh **without** `--reload`: `npm run dev` (in `apps/web`) | Server starts on port 3000 | — |
| Hard-reload the browser (`Ctrl+Shift+R` / `Cmd+Shift+R`) | Page loads; no cached JS | — |
| Open DevTools → Console; filter to `[ST7]` | Console clear | Screenshot 0a: clean console |

---

## Step 1 — Allow camera + warm up

| Action | Expected | Capture |
|--------|----------|---------|
| Navigate to `/app/monitor` | Permission prompt or direct to camera | — |
| Allow camera | `[ST7] op → warming-up \| active-for-trend: true` in console | Screenshot 1a: console |
| `[ST7] poll effect — active: true — firing immediate refetch` appears | Poll armed with active=true | Screenshot 1b |
| Wait for the first confident read (graph shows a coloured band dot, not just dashed line) | `[ST7] trendRefresh bump — outcome: reading` appears; `[ST7] render — isEmpty: false \| marker.state: live` | Screenshot 1c: graph + console |

---

## Step 2 — Step out of frame (cover camera or move face away)

| Action | Expected per spec | Capture |
|--------|------------------|---------|
| Cover camera / leave frame | Presence timer starts (~90 s to GO_OUT_OF_FRAME) | — |
| After ~90 s: `[ST7] GO_OUT_OF_FRAME — opRef was: active` fires | **FR-014 / Assumptions:** op → out-of-frame is the system's deliberate presence gate | Screenshot 2a: console |
| `[ST7] op → out-of-frame \| active-for-trend: false` fires | SessionTrend's `active` prop flips to false | Screenshot 2b |
| `[ST7] poll effect — active: false — firing immediate refetch` fires | ONE refetch on deactivate; no new interval | Screenshot 2c |
| `[ST7] setPoints` line shows `→ KEPT prev (guard)` OR `→ REPLACED with next` | **SUSPECTED-BUG trigger:** if "REPLACED with next" AND next.length=0 → blanking | Screenshot 2d |
| Graph still shows the step-line + parked marker (muted, no pulse) | **FR-004a:** parked marker MUST persist over prior confident reading | Screenshot 2e: graph |
| Subtitle shows "No clear read right now" (FR-024) | **EXPECTED-verify** — this is correct mid-session no-read behaviour | Screenshot 2f: subtitle |

> **SUSPECTED-BUG checkpoint:** if 2e shows a BLANK graph (step-line gone, marker gone):
> - Record `[ST7] render — isEmpty:` value and `pts in:` count from the console.
> - Record what `[ST7] setPoints` said (kept vs replaced).
> - This is the evidence we need.

---

## Step 3 — Return to frame

| Action | Expected per spec | Capture |
|--------|------------------|---------|
| Move face back in front of camera | Presence timer fires onReturn | — |
| `[ST7] RETURN_TO_FRAME — opRef was: out-of-frame` fires | op → active | Screenshot 3a: console |
| `[ST7] op → active \| active-for-trend: true` fires | Poll re-arms | Screenshot 3b |
| `[ST7] poll effect — active: true — firing immediate refetch` fires | Interval restarted | Screenshot 3c |
| Graph still shows step-line + now the marker begins re-acquiring | **EXPECTED-verify** — re-warm takes ~90 s, so "No clear read" is CORRECT here | Screenshot 3d: graph |
| After ~90 s (re-warm): next confident read arrives, `[ST7] trendRefresh bump` fires | Marker returns to "live" (pulsing) | Screenshot 3e: final state |

---

## What to paste back

1. **Full `[ST7]` console output** as text (DevTools → right-click → "Save as" or copy all).
2. **Screenshots 2d + 2e** — the setPoints decision and the graph state immediately after GO_OUT_OF_FRAME refetch.
3. **Screenshot 2c** — the refetch result length, to confirm whether DB returned data or empty.

That's all the evidence needed to diagnose whether the blank is:
- A) `getSessionTrend` returning `[]` AND the prev-keep guard NOT firing (race / mount reset)
- B) `buildSessionTrend` seeing valid points but still emitting `isEmpty: true`
- C) Something upstream (`sessionLive`, `liveSessionId`) unmounting the component
