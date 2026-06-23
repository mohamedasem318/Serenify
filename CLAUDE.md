<!-- SPECKIT START -->
For additional context about technologies to be used, project structure,
shell commands, and other important information, read the current plan
at `specs/009-today-card-trend-redesign/plan.md` (with supporting artifacts:
`research.md`, `data-model.md`, `contracts/today-trend-ui.md`, `quickstart.md`).
This is a frontend-only redesign of the employee dashboard today check-in card's
collapsed + expanded stress-trend surfaces and session timeline. It **consumes the
existing read layer** unchanged (`getTodayRecap` / `getTodayTrend` /
`deriveRecap` / `sessionTenor` in `apps/web/lib/api/monitoring-reads.ts`, wired in
`components/home/todays-checkin-card.tsx`) — no data-layer, RLS, or whitelist
change; no probability reaches the client. The central technique is **fixed-pixel
SVG rendering** (1 unit = 1px; SVG width = nLanes × laneWidth with a matching
viewBox; NO stretched viewBox — that stretch is the totem bug the prior build
hit). Visual source of truth: `serenify-008followups-trend-FINAL.html` (real
Graphite tokens). Two forks await Mohamed before implement: headline-honesty
(`deriveHeadline` "tense" wording vs FR-002) and the amber-text light value
(`#8A580F` mock vs `#7E5310` constitution) — see `plan.md` Complexity Tracking.
<!-- SPECKIT END -->

## Backlog ↔ Issues

`docs/BACKLOG.md` is the source of truth and is mirrored 1:1 to GitHub Issues. When you log
a new follow-up to BACKLOG, open its issue in the same change and record `(#NN)` on the entry.
When you fix a follow-up, mark its BACKLOG entry resolved (date + commit/PR) **and** close the
matching issue in the same change. Never update one without the other; on conflict, BACKLOG
wins. Full rules: constitution Principle VIII; operational detail + label taxonomy:
`docs/DECISIONS.md`.
