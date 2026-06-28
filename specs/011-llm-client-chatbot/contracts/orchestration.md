# Contract: Parallel Calls, Rollup, and Auto-Title

## Send Lock

Each conversation accepts one in-flight user send at a time. While Ren/scorer work is pending, the same conversation's send action is locked. Other conversations remain usable.

## Per-Message Flow

1. Validate employee access and rate limit.
2. Persist the user message as the owning employee.
3. Launch Ren conversational reply and per-message scorer concurrently.
4. Ren request receives prompt files, transcript context, optional preference block, and optional recent video context line. It does not receive same-turn scorer output.
5. Scorer request receives the current user message plus the previous two complete user/assistant turns.
6. Strip Ren `[CRISIS]` control token if present.
7. Persist assistant text only if Ren succeeds.
8. Trigger the live crisis panel if scorer returns `crisis: true` or Ren emitted `[CRISIS]`.
9. Never persist per-message scorer band/crisis.

## Failure Matrix

| Ren | Scorer | Result |
|---|---|---|
| success | success | Persist assistant; live panel may show; no per-message score persists. |
| success | fail | Persist assistant; keep `[CRISIS]` backstop; no per-message score persists. |
| fail | success | Do not invent assistant reply; show calm retry state. |
| fail | fail | Do not invent assistant reply; preserve typed text for retry. |

Retry transient LLM failures once or twice with backoff. Malformed scorer JSON is retried, then treated as scorer failure.

## Rollup Triggers

- Every fifth user message.
- On `[END]`.

Rollup reads the full conversation text fresh and writes one current `rollup_band` on the conversation. It does not average, peak, or aggregate per-message bands.

## Auto-Title Trigger

On `[END]`, after rollup succeeds, run `auto_title`. The title is short, calm, and avoids banned distress words.

If rollup or title fails after retry, keep the conversation open and show a calm inline retry state. Do not mark ended until both succeed.

## Signal Separation

Chat rollup band appears only on chat/recent-chat surfaces. It never updates or appears inside the video-derived today card, live monitor graph, historical video trend, or any physiological stress surface.

