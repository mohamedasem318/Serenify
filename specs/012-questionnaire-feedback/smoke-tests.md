# Smoke Tests: Questionnaire Feedback (Feature 012)

Manual + automated verification checklist derived from [quickstart.md](./quickstart.md).
This is a verification ledger, not an implementation script. Command/result rows are
filled by the Phase 8 verification tasks (T066–T068); they are left as placeholders
until the relevant phase runs.

**Scope note**: Phase 1 + Phase 2 deliver only the DB / RLS / RPC privacy foundation.
Web/UI smoke scenarios (sections 2–5) are recorded here for completeness but are not
exercisable until Phase 3+ ships the client and components.

---

## 1. Storage and RLS (Phase 2 — DB/privacy gate)

Static privacy gate (no live DB needed — CI-runnable), mirroring the
feature-008/011 privacy-test style:

```bash
uv run pytest apps/api/tests/test_questionnaire_privacy.py
```

Expected coverage:

- No `SUPABASE_SERVICE_ROLE_KEY` or service-role client path.
- All employee-private tables enable **and force** RLS.
- Confirmatory / session-feedback / weekly-cadence policies are owner-only (no manager/admin policy).
- `weekly_work_environment_contributions` has **no** `user_id`, `created_at`, `updated_at`, or precise timestamp.
- Weekly aggregate functions revoke `PUBLIC`/`anon` EXECUTE and grant only to `authenticated`; owner `postgres`.
- Manager summary RPC returns grouped counts only (no individual rows, no contribution id).
- The migration never alters/annotates `public.window_readings`.

| Run date | Command | Result |
|----------|---------|--------|
| _TBD (T066)_ | `uv run pytest apps/api/tests/test_questionnaire_privacy.py` | _placeholder_ |

---

## 2. Web Unit Tests (Phase 3+ — not in scope for Phase 1/2)

```bash
npm --workspace web run test -- questionnaire
```

Expected coverage:

- Sustained `tense` timer triggers at `CONFIRMATORY_TENSE_SUSTAINED_MS`.
- Signal drops before threshold do not trigger.
- Signal drops after `CONFIRMATORY_PROMPT_MIN_DWELL_MS` expire visible prompts without an answered outcome.
- Answer / signal-drop / session-end races resolve once.
- One prompt per monitoring session.
- `false_alarm` suppresses next session only.
- Session-end sampling seam returns every session by default.
- Weekly ISO-week cadence allows first prompt plus one same-week re-prompt after skip.

| Run date | Command | Result |
|----------|---------|--------|
| _TBD (T067)_ | `npm --workspace web run test -- questionnaire` | _placeholder_ |

---

## 3. Component and Accessibility Tests (Phase 3+)

```bash
npm --workspace web run test -- components/questionnaire notification
```

Expected coverage:

- Confirmatory prompt renders through `Notification` with `dismissible={false}`.
- Escape / outside click / blur do not dismiss the prompt.
- Confirmatory answer buttons are keyboard reachable.
- Weekly Q1 auto-advance moves focus to Q2.
- Progress bar exposes correct ARIA state.
- Back and Done reachable; Done disabled until Q2 selection.
- Smiley draw-in, check draw-in, progress fill, and muted skip honor `useMediaQuery("(prefers-reduced-motion: reduce)")`.

| Run date | Command | Result |
|----------|---------|--------|
| _TBD (T067)_ | `npm --workspace web run test -- components/questionnaire notification` | _placeholder_ |

---

## 4. E2E and Layout (Phase 3+)

```bash
npm --workspace web run test:e2e -- questionnaire
npm --workspace web run test:layout -- questionnaire
```

Expected coverage:

- 360px and desktop layouts: no overlapping/truncated essential text.
- All controls satisfy 44px minimum target.
- Light and dark themes remain WCAG AA.
- Confirmatory prompt and session-end feedback never visible together.
- Ren opens from `confirmed` and `opened_chat` handoffs without recommendation cards.
- Session-end negative actions: "suggestion didn't help" → `/app/account` (plain), "needed quiet time" → `/app/account#notifications`.

| Run date | Command | Result |
|----------|---------|--------|
| _TBD (T067)_ | `npm --workspace web run test:e2e -- questionnaire` | _placeholder_ |
| _TBD (T067)_ | `npm --workspace web run test:layout -- questionnaire` | _placeholder_ |

---

## 5. Manual Smoke Scenarios (Phase 3+)

1. Start a monitoring session and feed controlled readings: `tense` for less than 20 seconds, then `a_little_tense`. Confirm no prompt.
2. Feed `tense` continuously past the sustained tunable. Confirm the sticky prompt appears in the bottom-right notification surface.
3. Try outside click and Escape. Confirm the prompt remains.
4. Choose `No, I'm okay`. Confirm prompt closes, false-alarm row is stored, no trend/Today visual changes, and the next session suppresses the prompt once.
5. End a session while a prompt is visible. Confirm prompt expires first, then session-end feedback appears.
6. Complete session-end feedback through Good, each negative reason, free text, and Skip. Confirm product feedback never opens Ren except the explicit confirmatory handoff.
7. Sign in on the first authenticated visit of a new ISO week. Skip once, return later that week, confirm at most one re-prompt, then no third prompt.

| Scenario | Run date | Result |
|----------|----------|--------|
| 1–7 | _TBD (T068 manual)_ | _placeholder_ |

---

## Final Privacy Artifact Sweep (T068)

- [ ] No service-role questionnaire path anywhere in Feature 012 code.
- [ ] Aggregate-only manager returns (no individual rows, no contribution id).
- [ ] No precise contribution timestamp on `weekly_work_environment_contributions`.
- [ ] `public.window_readings` immutable (never altered/annotated by this feature).
- [ ] Today card / employee trend rendering untouched.

| Run date | Command | Result |
|----------|---------|--------|
| _TBD (T068)_ | privacy artifact sweep | _placeholder_ |

---

## Model Artifact Sweep

No model artifact is touched for this feature:

- No changes under `packages/ml-video`.
- No stress model threshold/weight/metadata changes.
- No `docs/MODELS.md` update required.
