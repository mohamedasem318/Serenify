# Contract: Confirmatory Trigger and Notification UI

## Source Inputs

The trigger consumes existing monitoring outputs:

```ts
type Band = "at_ease" | "a_little_tense" | "tense";

type WindowOutcome =
  | { outcome: "reading"; band: Band; capturedAt: string }
  | { outcome: "warming_up"; capturedAt: string }
  | { outcome: "skipped"; cause: string }
  | { outcome: "superseded" };
```

Only `outcome: "reading"` with `band: "tense"` participates in the sustained-tense clock.

## Named Tunables

Place tunables in `apps/web/lib/questionnaire/constants.ts`:

```ts
export const CONFIRMATORY_TENSE_SUSTAINED_MS = 20_000;
export const CONFIRMATORY_PROMPT_MIN_DWELL_MS = 4_500;
export const CONFIRMATORY_FALSE_ALARM_SUPPRESS_NEXT_SESSIONS = 1;
```

The constants are product prompt tunables over the existing band contract, not model thresholds.

## Hook

Planned hook:

```ts
useConfirmatoryTrigger({
  sessionId,
  active,
  latestOutcome,
  createPrompt,
  resolvePrompt,
  resolveWindowReadingId,
  hasFalseAlarmNextSessionSuppression,
  consumeFalseAlarmNextSessionSuppression,
  openRen,
});
```

Behavior:

- Reset when `sessionId` changes.
- Ignore Ren/chat-derived stress signals entirely.
- Start sustained timer on first consecutive `tense` reading.
- Reset sustained timer when band is `a_little_tense`, `at_ease`, skipped, warming, superseded, inactive, paused, or ended.
- Show prompt after `CONFIRMATORY_TENSE_SUSTAINED_MS`.
- Insert `questionnaire_confirmatory_prompts` row when shown.
- Store triggering `capturedAt` and optional `window_readings.id`.
- Allow signal-drop expiry only after `CONFIRMATORY_PROMPT_MIN_DWELL_MS`.
- Resolve only once; answer/signal-drop/session-end races use a single resolution guard.
- Never show more than one prompt for the same `monitoring_session_id`.
- After `false_alarm`, suppress the next monitoring session only, then consume that suppression.

## Notification Surface

`Notification` is extended backward-compatibly:

```ts
type NotificationProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  body?: string;
  children?: React.ReactNode;
  dismissLabel?: string;
  dismissible?: boolean; // default true
  nonModal?: boolean;    // confirmatory uses true to avoid focus trap/app inertness
};
```

Confirmatory prompt requirements:

- `dismissible={false}`.
- `nonModal={true}`.
- No close button.
- Escape, outside click, blur, and overlay/misclick must not close it.
- The prompt still closes programmatically on answer, signal-drop expiry after dwell, or session end expiry.
- Desktop uses bottom-right notification stacking over the chat pill offset.
- Mobile uses the sheet geometry without making the rest of the app inert.

## Confirmatory Prompt Component

Planned component:

```tsx
<ConfirmatoryPrompt
  open={visible}
  onConfirm={...}
  onFalseAlarm={...}
  onOpenChat={...}
/>
```

Visible copy:

- Title: `Checking in`
- Body: `Your signals have looked tense for a little while. Is that how you're feeling?`
- Options in order:
  1. `Yes, that's me`
  2. `No, I'm okay`
  3. `Maybe — talk about it`

Lucide icons:

- `Activity` in amber for the heading and confirm option.
- `Wind` in meadow for false alarm.
- `MessageCircle` in foggy for chat.

## Accessibility Contract

- Prompt is announced with a stable accessible title and description.
- Answer buttons are native buttons, in DOM order, at least 44px tall.
- The prompt must be reachable and answerable by keyboard without trapping focus.
- On open, focus moves to the first answer only when focus is currently on the monitoring shell/body; otherwise the prompt uses `aria-live="polite"` and does not steal active text/input focus.
- Closing by answer returns focus to the monitoring shell or chat handoff target.
- Closing by signal drop returns focus only if focus was inside the prompt.
- There is no invisible close control when `dismissible=false`.

## Ren Handoff

Confirmed:

- Persist `outcome='confirmed'`.
- Open `/app/chat` through the existing chat entry with a soft opener seam, e.g. `?handoff=confirmatory_yes`.
- Do not show recommendations.

Maybe:

- Persist `outcome='opened_chat'`.
- Open chat directly, e.g. `?handoff=confirmatory_maybe`.

False alarm:

- Persist `outcome='false_alarm'`.
- Set `aggregate_treatment='exclude_or_down_weight'`.
- Do not open chat.
- Suppress next monitoring session only.

## Anti-Collision

If the monitoring session ends while visible:

1. Resolve the prompt row as `expired` with `expiry_reason='session_end'`.
2. Close the notification.
3. Only then allow session-end feedback eligibility to mount.

The coordinator exposes a single surface state so confirmatory and session-end feedback cannot be visible together.
