# Contract: Feedback Instruments UI

## Component Set

```text
components/questionnaire/
├── session-end-feedback-card.tsx
├── weekly-check-in-card.tsx
├── questionnaire-coordinator.tsx
└── questionnaire-result-icon.tsx
```

All components:

- Use lucide icons from the mock.
- Use Graphite tokens from `apps/web/app/globals.css`.
- Do not copy mock CSS or remap token names inside `@theme inline`.
- Use `useMediaQuery("(prefers-reduced-motion: reduce)")` for motion decisions.
- Keep interactive targets at least 44px high at 360px.

## Session-End Feedback Card

Heading:

```text
How did that check-in feel?
```

Initial actions:

- `Good`
- `Something was off`
- `Skip`

States:

- Good: meadow success state, text `Glad that helped.`
- Skip: muted wind state, text `No problem — another time.`
- Negative branch prompt: `Got it. What felt off?`

Negative reasons and actions:

| Reason label | Stored reason | Action |
|--------------|---------------|--------|
| `The suggestion didn't help` | `suggestion_didnt_help` | Route to existing account preferences placeholder. |
| `I just needed quiet time` | `needed_quiet` | Route to existing account notification placeholder. |
| `The chatbot felt too robotic` | `ren_too_robotic` | Store/acknowledge only. Never send to Ren. |
| `Something else` | `something_else` | Show free text; store non-empty trimmed text only. |

Route targets:

- Preferences seam: `/app/account#preferences` after implementation adds a stable section id.
- Notifications seam: `/app/account#notifications` using the existing placeholder section.

Privacy copy/action:

- Product feedback is employee-private.
- Free text and `ren_too_robotic` never reach Ren, manager tables, manager aggregates, or manager UI.

Sampling:

```ts
export const SESSION_END_FEEDBACK_SAMPLING_POLICY = "every_session";
export function shouldOfferSessionEndFeedback(...) {
  return SESSION_END_FEEDBACK_SAMPLING_POLICY === "every_session";
}
```

The function is the documented seam for later sampling.

## Weekly Check-In Card

Heading:

```text
How has the work environment felt lately?
```

Initial actions:

- `Good`
- `Could be better`
- `Skip`

Good:

- Persist weekly contribution with `sentiment='good'`.
- Meadow success state, text `Glad the week's been good.`

Skip:

- Update cadence only.
- No aggregate contribution.
- Muted wind state, text `All good — we'll ask again next week.`

Could-be-better stepper:

Q1 label:

```text
What was your biggest roadblock?
```

Q1 single-select options:

- `Unclear instructions or goals`
- `Waiting on other team members`
- `Software or tools crashing`

Selecting Q1 auto-advances to Q2.

Q2 label:

```text
What support would have made this week better?
```

Q2 single-select options:

- `Deadline flexibility`
- `Better team alignment or communication`
- `A quieter workspace`
- `Better technical equipment`

Q2 controls:

- `Back` returns to Q1 without submission.
- `Done` is disabled until Q2 has a selected support.
- Done submits one identity-stripped aggregate contribution and shows meadow check state: `Heard — thanks for speaking up.`

## Weekly Cadence

Eligibility calculation belongs in `apps/web/lib/questionnaire/weekly-cadence.ts`.

Inputs:

- Current authenticated user.
- Current ISO week start.
- `weekly_checkin_cadence` row for the caller/week.

Rules:

- First authenticated visit in a new ISO week: show if no completed cadence row.
- First skip: set `skipped_count=1`; allow one later prompt in the same ISO week.
- Second prompt: if skipped again, set `skipped_count=2`; do not re-prompt until next ISO week.
- Completion: set `completed_at`; do not re-prompt in that ISO week.
- Abandoned Q2 does not create a contribution or completion.

## Accessibility

Reduced motion:

- Smiley draw-in: final smile/check state appears instantly when reduced motion is preferred.
- Check draw-in: final check appears instantly.
- Progress fill: width/state updates without transition.
- Muted skip: wind icon and text appear without pop/fade movement.

Stepper:

- Q1 and Q2 are grouped with accessible labels.
- On Q1 auto-advance, focus moves to Q2 heading or first Q2 option.
- Progress uses `role="progressbar"` with `aria-valuemin`, `aria-valuemax`, `aria-valuenow`, and `aria-valuetext` such as `Step 2 of 2`.
- Step changes are announced through a polite live region.
- Back and Done are native buttons and reachable by keyboard/screen reader.

Contrast and hit targets:

- Use `text-muted`, `text-ink`, `text-meadow-text`, `text-amber-text`, `bg-surface`, `bg-bg`, `border-border`, and color-mix utilities that preserve WCAG AA in both themes.
- No crimson on these surfaces.
- All option, skip, Back, Done, and route-action controls use minimum `min-h-11`.

## Collision Rules

The coordinator controls rendering priority:

1. Confirmatory prompt while session is active.
2. Session-end feedback after session end and after confirmatory prompt is closed/resolved.
3. Weekly check-in on authenticated dashboard visits, separate from active monitoring.

The coordinator never mounts confirmatory and session-end feedback at the same time.
