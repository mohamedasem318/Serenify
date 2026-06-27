<!-- SPECKIT START -->
For additional context about technologies to be used, project structure,
shell commands, and other important information, read the current plan
at `specs/010-monitoring-graph-redesign/plan.md` (with supporting artifacts:
`research.md`, `data-model.md`, `contracts/session-trend-ui.md`, `quickstart.md`).
This is a frontend-only redesign of the live **"This session"** monitoring graph
(`apps/web/components/monitor/session-trend.tsx`, the card below the camera stage),
roadmap label `009b`. It **consumes the existing read layer** unchanged
(`getSessionTrend` in `apps/web/lib/api/monitoring-reads.ts`, wired in
`components/monitor/monitoring-session.tsx`) — no data-layer, RLS, whitelist,
page-layout, or token change; no probability reaches the client. The central
technique is **fixed-pixel SVG rendering** (1 unit = 1px; SVG width = container
width with a matching viewBox; NO stretched viewBox — the totem/oval bug). The
x-axis is a **uniform slot per capture window** on a **rolling ~2-min window**
(decided F1). It splits no-reads into three honest treatments (warming dashed line ·
out-of-frame foggy gap, **gated OFF at launch** per FR-015 · no-clear-read muted
gap) and parks the now-marker muted/static during a no-read. Visual source of
truth: `serenify-live-session-graph-mock.html` (real Graphite tokens; all already
in `globals.css`). NEW pure module: `apps/web/lib/session-trend-geometry.ts`.
All copy is signed off (FR-024 neutral no-read subtitle = "No clear read
right now"; FR-022 labels approved). The pre-existing ~12s
polling (vs the WebSocket constraint) is out of scope here (consumed unchanged).
<!-- SPECKIT END -->

## Backlog ↔ Issues

`docs/BACKLOG.md` is the source of truth and is mirrored 1:1 to GitHub Issues. When you log
a new follow-up to BACKLOG, open its issue in the same change and record `(#NN)` on the entry.
When you fix a follow-up, mark its BACKLOG entry resolved (date + commit/PR) **and** close the
matching issue in the same change. Never update one without the other; on conflict, BACKLOG
wins. Full rules: constitution Principle VIII; operational detail + label taxonomy:
`docs/DECISIONS.md`.
