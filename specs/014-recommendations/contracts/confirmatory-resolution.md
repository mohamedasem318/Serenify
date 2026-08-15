# Contract — 012 confirmatory "Yes, that's me" resolves to the recommendation

Supersedes 012's FR-018/FR-058 interim Ren handoff for the **confirm path only**
(FR-010). Highest-regression change in the feature; SC-006 pins everything preserved.

## What changes

1. **`useConfirmatoryTrigger` deps** (`lib/questionnaire/confirmatory-trigger.ts`):
   - `onConfirm` still calls `finalize({ type: "answered", outcome: "confirmed" })`
     first — persisting the answer and consuming the budget exactly as today — then calls
     a new dep `resolveToRecommendation()` instead of `openRen("confirmatory_yes")`.
   - `openRen` stays, now invoked only by `onOpenChat` (`confirmatory_maybe`).
   - The pure reducers (`reduceOutcome`, `reduceDwellElapsed`,
     `markResolvedConsumingBudget`, `markResolvedRearm`) are **not edited**. The
     #127/#130/#132/#134 guarantee tests must pass byte-for-byte.
2. **Monitor host** (`components/monitor/monitoring-session.tsx`) implements
   `resolveToRecommendation`:
   - Resolve the pick: if today already has an active pick (same episode — a confirmation
     mid-episode changes prominence, not the pick, FR-018), UPDATE its `confirmed_at`;
     otherwise run the selection engine, INSERT a row with `source='confirmed'` +
     `confirmed_at` (new episode if the prior one was closed by an outcome — fresh
     budget).
   - Show `ConfirmedPickCard` in-session (below). No navigation (FR-011).
3. **`ConfirmedPickCard`** (new, `components/recommendations/`): rendered through the
   shared `Notification` primitive in the same slot the confirmatory prompt occupied —
   `dismissible`, `nonModal`, desktop `w-80` corner card / mobile bottom sheet, stacked
   via `--chat-pill-offset`. Content: the pick's title, duration, why-line — **the same
   words as home state 4** (both render from the same pick row + library entry) — an
   expand-instructions action (expanding records `opened_at`), and once instructions are
   closed, the inline "Did that help?" outcome question (same rules as home: asked once,
   ignorable at no cost, never over the open instructions). Dismissing the card is
   neither a swap nor an outcome — no write; the home card still shows state 4.

   **Pause/resume control (scope addition, Mohamed 2026-08-15).** The card carries ONE
   control that is a second entry point to the **already-shipped** feature-008 pause
   handler — no new machinery. Ground truth: `handlePause` / `handleResume` in
   `components/monitor/monitoring-session.tsx` stop and reacquire the camera and PATCH
   `status='paused'` / `'active'` on the same session row; a neutral `PausedStage`
   already renders; no migration is needed because the `status` CHECK already accepts
   `'paused'`. Why it belongs here: several library items send the person away from the
   desk, and today the in-session choice is ignore-or-end. It is **not per-item** — no
   logic decides which items "need" a pause. The single control becomes a **resume**
   action while the session is paused, so there are never two competing pause
   affordances; the card renders outside the op-surface switch, so it stays visible on
   the paused surface beside the existing Resume/End controls. **Pausing is not an answer
   to the confirmatory prompt**: no budget spend, no confirm, no dismiss, no false-alarm
   suppression — structurally true, because the 012 budget is only spent via `finalize`
   from the three answer handlers and pause never calls `finalize`. The confirmatory
   machinery and its pinned suites are untouched by pausing. Hallmark governs the
   control. The home card is unaffected.

   *Accepted, not fixed here*: resuming can auto-expire a still-visible confirmatory
   prompt — post-resume warm-up readings are non-sustaining, which expires a shown prompt
   as `signal_drop` at no budget cost and re-arms it. That is a pre-existing quirk of the
   shipped pause button, and it is moot for this card, which only exists after the prompt
   already resolved.
4. **Handoff seam** (`lib/chat/confirmatory-handoff.ts`): the monitor stops *producing*
   `confirmatory_yes`; the seam module and the chat page's parsing stay as-is (tolerant
   of a stale URL, `confirmatory_maybe` unchanged).
   `CONFIRMATORY_HANDOFF_SHOWS_RECOMMENDATIONS` remains `false` — chat still renders no
   recommendation cards.
5. **Home card**: with a confirmed active pick, renders state 4 (prominent — the mock's
   five small moves), same pick, same words (US2 scenario 2).

## What is preserved, and how

| 012 behaviour | preservation mechanism |
|---|---|
| "No, I'm okay" path (false alarm + next-session suppression) | `onFalseAlarm` and the sessionStorage suppression store untouched |
| "Maybe — talk about it" path | `onOpenChat` → `openRen("confirmatory_maybe")` untouched |
| D-6 dwell-before-swap | dwell machinery lives in the untouched reducers; the recommendation card's own states 7/8 adopt the same deferred-timer dwell (FR-029) |
| D-8 / D-11 explicit-answer-only budgets, tense-senior | `finalize` + `markResolvedConsumingBudget` untouched; confirm is still an answered resolution |
| One answered row per (session, kind) | DB index `qcp_one_answered_per_session_per_kind` untouched |
| Prompt persistence lifecycle (visible → answered/expired) | `createPrompt` / `resolvePrompt` wiring untouched |

## Interruption rule (FR-014)

A new confirmed detection while an outcome prompt is pending: the stale outcome prompt is
removed **without writing** an outcome; the confirmed pick takes over (in-session and on
the home card). If the prior episode had already recorded an outcome, the detection
starts a new episode with a fresh budget; if not, the episode and budget continue.

**Attach-only is intended design, not an index side effect — RULED (Mohamed,
2026-08-15, "Ruling C").** While an outcome prompt is pending, the pick is still *active*
(`outcome IS NULL AND swapped_away_at IS NULL`), so the new confirmed detection **attaches
to it** — UPDATE `confirmed_at`, prominence only — and **never inserts a second row**.
This is the episode rule from FR-018 applied unchanged: a confirmation mid-episode changes
prominence, not the pick. It is worth stating explicitly because
`rp_one_active_per_user_day` would *also* have prevented the insert, and a reader could
mistake the behaviour for a constraint the code is working around. The order of causation
is the reverse: the rule is the intent, and the index is the DB backstop that mirrors it
(the same relationship as everywhere else in this feature — data-model §2). If the index
were dropped tomorrow the behaviour would not change.

The person is not trapped by the attach. **Swap remains available in state 4**, so a
confirmed pick that does not suit them is still one ceremony-free action away from being
replaced.

## Tests

- Vitest: trigger-hook wiring (confirm → resolveToRecommendation, maybe → openRen,
  false-alarm unchanged); ConfirmedPickCard open/outcome/dismiss writes; FR-014
  interruption; existing 012 suites unmodified and green (SC-006).
- e2e: drive sustained tense → "Yes, that's me" → pick reachable in-session without
  navigation → home shows identical pick (SC-005).
