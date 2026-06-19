<!-- SPECKIT START -->
For additional context about technologies to be used, project structure,
shell commands, and other important information, read the current plan
at `specs/008-stress-inference-service/plan.md` (with supporting artifacts:
`research.md`, `data-model.md`, `contracts/inference-api.md`,
`contracts/smoothing-and-banding.md`, `quickstart.md`). This is the live video
stress-inference read path: it wires the committed model, `predict_delta`, and
the shared 2958-d extraction to a capture loop, a session-aware backend endpoint,
per-window persistence, and the monitoring UI. It reuses feature 005's capture +
on-device face detector and feature 006's usable-face-coverage gate / cause
vocabulary; the visual contract is `serenify-008-monitoring-mock.html` (intent
only — build against real Graphite tokens and existing `apps/web` components).
<!-- SPECKIT END -->
