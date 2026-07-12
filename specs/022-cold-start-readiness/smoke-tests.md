# Smoke Tests: Cold-Start Readiness

**Feature**: `022-cold-start-readiness`

**Status**: Pending production deployment and Mohamed sign-off

## Automated Pre-Merge Evidence

- [ ] Health request remains pending before 75 seconds and aborts at the boundary.
- [ ] Monitoring session creation maps timeout to the existing network failure.
- [ ] Check-in wake state is disabled and politely announced.
- [ ] Camera remains unopened while session creation is pending.
- [ ] Repeated activation creates only one session.
- [ ] Calibration wake copy explains the expected delay.
- [ ] 360px and desktop layouts have no clipping or overlap in light and dark themes.
- [ ] Full tests, lint, typecheck, build, CI guard, diff, and secrets checks pass.

## Production Smoke Procedure

1. Confirm Azure Container Apps has zero active replicas.
2. At `https://serenify.tech`, sign in as a synthetic test employee.
3. Start calibration and confirm the wake message appears immediately, remains readable, and proceeds when the API wakes.
4. Let the API return to zero replicas, start a check-in, and confirm `Waking Serenify...` appears while the camera indicator remains off.
5. Confirm the camera prompt/indicator appears only after the backend session succeeds.
6. Repeat on a 360px phone viewport and desktop, in light and dark themes.
7. Confirm a retry surface is available if the API is intentionally unavailable beyond 75 seconds.

## Sign-Off

- **Automated evidence recorded by**: Pending
- **Production result**: Pending
- **Mohamed approval**: Pending
- **Date**: Pending

This file must be updated with actual results before the PR is squash-merged.
