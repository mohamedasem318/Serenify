# Quickstart: Questionnaire Feedback Plan

This quickstart defines the verification gates the implementation plan is expected to satisfy. It is not an implementation script.

## 1. Storage and RLS

Apply the Feature 012 migration locally, then verify:

```bash
uv run pytest apps/api/tests/test_questionnaire_privacy.py
```

Expected coverage:

- No `SUPABASE_SERVICE_ROLE_KEY` or service-role client path.
- All employee-private tables enable and force RLS.
- Confirmatory/session feedback policies are owner-only.
- Weekly contribution rows have no `user_id`.
- Weekly aggregate functions revoke `PUBLIC`/`anon` execute and grant only to `authenticated`.
- Manager summary RPC returns grouped counts only.

## 2. Web Unit Tests

Run focused web tests:

```bash
npm --workspace web run test -- questionnaire
```

Expected coverage:

- Sustained `tense` timer triggers at `CONFIRMATORY_TENSE_SUSTAINED_MS`.
- Signal drops before threshold do not trigger.
- Signal drops after `CONFIRMATORY_PROMPT_MIN_DWELL_MS` expire visible prompts without answered outcome.
- Answer/signal-drop/session-end races resolve once.
- One prompt per monitoring session.
- `false_alarm` suppresses next session only.
- Session-end sampling seam returns every session by default.
- Weekly ISO week cadence allows first prompt plus one same-week re-prompt after skip.

## 3. Component and Accessibility Tests

Run component tests:

```bash
npm --workspace web run test -- components/questionnaire notification
```

Expected coverage:

- Confirmatory prompt renders through `Notification` with `dismissible={false}`.
- Escape/outside click/blur do not dismiss the prompt.
- Confirmatory answer buttons are keyboard reachable and do not require a mouse.
- Weekly Q1 auto-advance moves focus to Q2.
- Progress bar exposes correct ARIA state.
- Back and Done are reachable; Done remains disabled until Q2 selection.
- Smiley draw-in, check draw-in, progress fill, and muted skip honor `useMediaQuery("(prefers-reduced-motion: reduce)")`.

## 4. E2E and Layout

Run Playwright checks for the user flows and layout:

```bash
npm --workspace web run test:e2e -- questionnaire
npm --workspace web run test:layout -- questionnaire
```

Expected coverage:

- 360px and desktop layouts have no overlapping/truncated essential text.
- All controls satisfy 44px minimum target.
- Light and dark themes remain WCAG AA.
- Confirmatory prompt and session-end feedback are never visible together.
- Ren opens from `confirmed` and `opened_chat` handoffs without recommendation cards.
- Session-end negative actions route the "suggestion didn't help" action to `/app/account` (plain, no preferences anchor yet) and the "needed quiet time" action to `/app/account#notifications`.

## 5. Manual Smoke Scenarios

1. Start a monitoring session and feed controlled readings: `tense` for less than 20 seconds, then `a_little_tense`. Confirm no prompt.
2. Feed `tense` continuously past the sustained tunable. Confirm the sticky prompt appears in the bottom-right notification surface.
3. Try outside click and Escape. Confirm the prompt remains.
4. Choose `No, I'm okay`. Confirm prompt closes, false-alarm row is stored, no trend/Today visual changes, and the next session suppresses the prompt once.
5. End a session while a prompt is visible. Confirm prompt expires first, then session-end feedback appears.
6. Complete session-end feedback through Good, each negative reason, free text, and Skip. Confirm product feedback never opens Ren except explicit confirmatory handoff.
7. Sign in on the first authenticated visit of a new ISO week. Skip once, return later that week, confirm at most one re-prompt, then no third prompt.

## Model Artifact Sweep

No model artifact should be touched for this feature:

- No changes under `packages/ml-video`.
- No stress model threshold/weight/metadata changes.
- No `docs/MODELS.md` update required unless implementation unexpectedly changes inference artifacts.
