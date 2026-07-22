# Design mockups

Signed-off HTML design mockups — the **visual sources of truth** cited by several
feature specs. Standalone files: open one in a browser and use its own light/dark
toggle.

## These files are deliberately untracked

`.gitignore` ignores `docs/mockups/*.html`. Only this README is tracked. The
mockups are large point-in-time design artifacts; the specs that cite them are the
durable record of what was decided. They live on the design machine.

Consequence worth knowing: **a fresh clone will not contain them.** Spec references
to these filenames have always been dangling for anyone but the design machine —
moving them here did not change that.

## Contents

| File | Cited by | Governs |
|---|---|---|
| `serenify-live-session-graph-mock.html` | `specs/010-monitoring-graph-redesign/` | The live "This session" monitoring graph (`components/monitor/session-trend.tsx`, `lib/session-trend-geometry.ts`) |
| `serenify-008followups-trend-FINAL.html` | `specs/009-today-card-trend-redesign/` | The dashboard today-card trend + session timeline (`components/home/today-trend-plot.tsx`, `today-timeline.tsx`, `lib/trend-geometry.ts`) |
| `serenify-008-followups-trend-redesign-reference.html` | — | Earlier reference variant of the 009 redesign, kept for provenance |
| `serenify-011-chatbot-mock.html` | `specs/011-llm-client-chatbot/` | `/app/chat`, recent-chats card, persistent pill, crisis panel, empty states |
| `serenify-012-questionnaire-mocks.html` | `specs/012-questionnaire-feedback/` | The three questionnaire instruments, their states, copy, icons |

## Note on paths in specs

These files sat in the **repository root** until 2026-07-22 and were relocated here
in that cleanup. Specs written before that date say "(repo root)" — read those as
pointing at this folder. The spec documents were not rewritten: they are artifacts
of record, and the filenames they cite are unchanged and unambiguous.
