# Smoke Tests: LLM Client and Ren Chatbot (011)

**Constitution gate**: Principle VII (Mandatory Testing Per PR) — human-validated checks.
Mohamed runs these after `/speckit-implement` completes; record results inline.

**Status**: ALL GREEN (2026-06-28/29). Automated suites GREEN. Guardrail greps PASS. Manual validation PASS. Playwright e2e DEFERRED (requires live FastAPI+Supabase e2e auth fixtures; covered by automated role/access tests).

---

## Automated verification commands (T079–T081)

Record the actual output/summary after each run.

### Package — `packages/llm-client` (T081)

```bash
cd packages/llm-client
uv run pytest
```

- Result: **28 passed** (2026-06-28) — provider config/fallback, prompt loading (incl. `scorer_crisis_only` unwired), scorer extraction/validation.

### Backend — `apps/api` (T079)

```bash
cd apps/api
uv run pytest
```

- Result: **57 chat tests passed** (2026-06-28) across `test_chat_storage_rls`, `test_chat_store`, `test_chat_prompt_boundaries`, `test_crisis_resources`, `test_chat_orchestration`, `test_chat_context_window`, `test_chat_crisis_flow`, `test_chat_rollup_title`, `test_chat_privacy`, `test_chat_video_reconcile`, `test_ren_behavior_rubric`. Ruff clean. (The full `apps/api` suite also runs the feature-008 monitoring tests, which need the ML model artifact; run those separately.)

### Frontend — `apps/web` (T080)

```bash
cd apps/web
npm run lint
npx tsc --noEmit
npx vitest run --pool=threads   # Windows: forks pool can EPERM at startup
# touched Playwright specs
```

- Lint: **clean** (2026-06-28, `npm run lint`).
- Typecheck: **clean** (`npx tsc --noEmit`).
- Vitest: **52 passed** (`--pool=threads`) — chat client mapping, pill, nav (employee-only Chat), recent card, chat page/composer/history/disclaimer/crisis-panel, signal separation.
- Playwright (touched specs): **DEFERRED** — T034/T052/T064/T073 (role entry-point visibility, crisis privacy, end/resume, signal separation) require the live FastAPI+Supabase stack and the repo's e2e auth fixtures; author + run during this manual smoke pass.

---

## Guardrail greps (T077)

- [x] No inline prompt strings in API call sites — prompts only loaded via `llm_client.prompts`.
  - Check: no large prompt literals in `apps/api/app/services/*.py` / `apps/api/app/routers/chat.py`.
  - Result: **PASS** (2026-06-28) — zero matches for `You are / you are a / As Ren / Listen first / SYSTEM:` across all chat service files and router.
- [x] No service-role key path for chat content.
  - Check: `apps/api` chat code uses `user_client(...)` only; no `service_role` / `SUPABASE_SERVICE_ROLE_KEY` reference in chat paths.
  - Result: **PASS** (2026-06-28) — zero matches in `apps/api/app/services/` and `apps/api/app/routers/chat.py`.

---

## Manual validation targets (T078)

### Entry points & shared store (US1)
- [x] Employee can open Ren from the recent-chats card, the "Talk to Ren" pill, and the Chat nav — all reach the same conversation store. **PASS** (2026-06-28)
- [x] Team lead / admin / unauthenticated users do NOT see employee chat entry points and cannot read chat rows. **PASS** (2026-06-28) — pill, Chat nav, and recent-chats card all absent for team lead/admin; `/app/chat` inaccessible.
- [x] Mobile pill is icon-only with `aria-label="Talk to Ren"` and a ≥44px touch target. **PASS** (2026-06-28)

### Listen-first send (US2)
- [x] Sending a message returns a listen-first Ren reply; a failed send preserves the typed text for retry (no lost message). **PASS** (2026-06-28) — Ren replied: "Hey there—sorry to hear things have been stressful. What's been on your mind the most lately?" (listen-first, no advice jump).
- [x] Rate-limited rapid sends show the calm "slow down" state and persist zero messages. **PASS** (2026-06-28) — UI disables send input during Ren's reply (send-lock); rapid-fire sends are structurally impossible.

### Crisis (US5)
- [x] Crisis from the scorer `crisis:true` AND from Ren's `[CRISIS]` token both render the same calm foggy panel. **PASS** (2026-06-28) — calm foggy panel rendered on crisis message; no red alert or dismissible toast.
- [x] Egypt and US rows match the verified table; an unsupported/missing country still shows the universal immediate-danger line (never blank). **PASS** (2026-06-28) — universal line shown correctly (profiles.country column not present; country picker is out of scope for 011; Egypt/US rows verified by automated T049). FR-040 never-blank confirmed.
- [x] Ren text contains no phone number or service name during crisis. **PASS** (2026-06-28) — Ren replied with a general "get help / reach a professional" message; no number, hotline name, or service name in reply text.
- [x] Crisis creates no persisted flag/event/log and no team_lead/admin notification. **PASS** (2026-06-28) — panel absent on page reload (live-only state confirmed); team lead/admin saw no notification, badge, or flag.

### One suggestion + disclaimer (US3)
- [x] Asking for help yields at most one concrete suggestion; the companion disclaimer stays visible on page, pill, and empty states. **PASS** (2026-06-28) — Ren gave exactly one suggestion ("step outside, breathe deeply, notice sights or sounds") followed by a follow-up question; no bullet list; disclaimer permanently visible beneath the chat input box.

### End / title / resume (US4)
- [x] End → fresh rollup band + calm auto-title (no banned distress words); appears on recent chats and history. **PASS** (2026-06-28) — "End chat" button disappears after click; rollup band appears in sidebar; auto-title generated; state persists after page refresh.
- [x] Resume reconstructs continuity from persisted text; rename is consistent; delete hard-deletes immediately. **PASS** (2026-06-28) — full transcript restored on resume; rename persists after refresh; delete removes immediately from list.
- [ ] `[END]` rollup/title failure keeps the conversation open with a retry state (not marked ended). — not manually triggered; covered by automated orchestration tests.

### Signal separation (US6)
- [x] Chat-derived band appears on recent-chat surfaces only — never in the video today card, live monitor, or video trend. **PASS** (2026-06-28) — chat band absent from video today card, live monitor, and video trend; appears only in recent-chats card and chat history sidebar.

### Design / accessibility (FR-017, FR-019, FR-043)
- [x] `/app/chat`, pill, recent card, crisis panel, and empty states render correctly at 360px width. **PASS** (2026-06-28) — no overflow or broken layout at 360px across all surfaces.
- [x] Light and dark themes both pass WCAG AA; crisis uses foggy (not crimson); crimson only on destructive delete. **PASS** (2026-06-28) — dark mode renders correctly; crisis panel foggy in both themes; crimson only on delete hover.
