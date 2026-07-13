# Smoke Tests: Cold-Start Readiness

**Feature**: `022-cold-start-readiness`

**Status**: Passed on protected Vercel branch preview against production services; approved for merge

## Automated Pre-Merge Evidence

- [x] Health request remains pending before 75 seconds and aborts at the boundary.
- [x] Monitoring session creation maps timeout to the existing network failure.
- [x] Check-in wake state is disabled and politely announced.
- [x] Camera remains unopened while session creation is pending.
- [x] Repeated activation creates only one session.
- [x] Calibration wake copy explains the expected delay.
- [x] 360px and desktop layouts have no clipping or overlap in light and dark themes.
- [x] Full tests, lint, typecheck, build, CI guard, diff, and secrets checks pass.

## Production Smoke Procedure

1. Confirm Azure Container Apps has zero active replicas.
2. At `https://serenify.tech`, sign in as a synthetic test employee.
3. Start calibration and confirm the wake message appears immediately, remains readable, and proceeds when the API wakes.
4. Let the API return to zero replicas, start a check-in, and confirm `Waking Serenify...` appears while the camera indicator remains off.
5. Confirm the camera prompt/indicator appears only after the backend session succeeds.
6. Repeat on a 360px phone viewport and desktop, in light and dark themes.
7. Confirm a retry surface is available if the API is intentionally unavailable beyond 75 seconds.

## Sign-Off

- **Automated evidence recorded by**: Codex, 2026-07-13 — 952 Vitest tests; ESLint 0 errors (2 pre-existing warnings); TypeScript and Turbopack production build passed; 8 SpecKit guard fixtures plus the live guard passed; 4 committed Playwright checks passed at 360px/desktop in light/dark; the layout harness returned 404 from the production build.
- **Production result**: PASS — calibration woke the production Azure API in under one minute; check-in completed normally; the first reading arrived at approximately 1:36 and updated again within about 10 seconds.
- **Mohamed approval**: Approved — "it worked flawlessly"; no comments or remaining UX concerns.
- **Date**: 2026-07-13

The branch preview used the production Azure API and Supabase project. The temporary preview CORS origin was removed after the smoke test; production web alias deployment follows the squash merge.
