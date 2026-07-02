# Research: Questionnaire Feedback

## R-1: Storage Split for Privacy and Aggregate Readiness

**Decision**: Store confirmatory outcomes and session-end feedback as employee-owned rows, but store weekly work-environment answers as identity-stripped aggregate contribution rows. Keep weekly prompt cadence in a separate employee-owned table that contains no answer values.

**Rationale**: Confirmatory and session-end feedback are employee-private and need owner reads for UX state. Weekly work-environment feedback has a future manager consumer, so the persisted manager-facing contribution must not carry `user_id` from day one. Splitting cadence from answers lets the product enforce first-visit/re-prompt behavior without creating an employee-attributed answer table for managers to inherit.

**Alternatives considered**:

- Store weekly answers with `user_id` and rely on manager RLS to hide it: rejected because future manager code could accidentally expose individual rows.
- Store only pre-aggregated counters: rejected because it makes duplicate prevention, testing, and future aggregate dimensions brittle. Identity-stripped contribution rows keep the data aggregate-friendly without exposing individuals.

## R-2: RLS and RPC Shape

**Decision**: Use owner-only RLS policies for `questionnaire_confirmatory_prompts`, `questionnaire_session_feedback`, and `weekly_checkin_cadence`. Revoke direct authenticated grants on `weekly_work_environment_contributions` and use restricted `SECURITY DEFINER` functions for weekly submit and manager aggregate reads.

**Rationale**: Existing migrations use explicit grants, `TO authenticated`, and `(select auth.uid())` policy predicates. Weekly contributions cannot have an employee owner column, so direct user inserts cannot safely enforce duplicate prevention. A caller-validating RPC can derive the caller's manager bucket, write an identity-stripped row, and update private cadence in one transaction.

**Alternatives considered**:

- Add FastAPI endpoints for all questionnaire writes: rejected as unnecessary and a wider privacy surface. Direct Supabase RLS is already the repo pattern for user-owned web data.
- Use service-role for aggregate insertion: rejected by Principle IX and project rules.

## R-3: Confirmatory Trigger Location

**Decision**: Implement the sustained-`tense` trigger in the browser monitoring coordinator, consuming the existing `Band` stream from `submitWindow()` outcomes.

**Rationale**: The inference service keeps per-session smoothing in memory. Adding server-side trigger state would either duplicate smoothing state or create cross-worker assumptions. The browser already owns live session state, receives only the coarse band contract, and can apply named product tunables without changing model artifacts.

**Alternatives considered**:

- Add server-side prompt eligibility to the monitoring API: rejected because it couples product prompt state to inference workers and the in-memory smoothing buffer constraint.
- Derive from Today card/trend polling: rejected because it is less immediate and would risk touching Today/trend rendering, which is explicitly out of scope.

## R-4: Confirmatory Window Link

**Decision**: Persist `triggered_window_captured_at` as required and `trigger_window_reading_id` as nullable. Resolve the reading id from owner-visible `window_readings` by `(session_id, captured_at)` when available.

**Rationale**: The current monitoring API returns `capturedAt` but not the reading id. Time linkage is sufficient for the prompt contract and keeps the monitoring API stable. The optional id gives feature 017 a stronger join when the persisted row is already readable under the employee's RLS whitelist.

**Alternatives considered**:

- Change the monitoring API to return reading id: deferred unless implementation proves the optional lookup unreliable.
- Update `window_readings` with a false-alarm column: rejected because readings must remain immutable and Today/trend rendering must remain unchanged.

## R-5: Notification Surface

**Decision**: Extend the existing `Notification` component with a backward-compatible `dismissible?: boolean` mode rather than creating a second toast/sheet implementation.

**Rationale**: Feature 003 established the surface and stacking convention. The confirmatory prompt is the one documented `dismissible:false` consumer, so extending the existing component keeps layout, reduced-motion, chat-pill offset, and visual tokens consistent.

**Accessibility requirement**: The non-dismissable mode is non-modal for confirmatory use. It removes close UI and blocks escape/outside dismissal, but it must not trap focus or make the rest of the app inert. Buttons remain normal tab stops, and the prompt is announced with stable labels.

## R-6: Feedback Cards and Motion

**Decision**: Implement the two feedback instruments as `components/questionnaire/*` cards that bind to the mock's copy/icon choices and repo Graphite tokens.

**Rationale**: The mock uses the real token values but `globals.css` is the source of truth. Card-level components let tests render each state independently and verify reduced-motion for smiley draw-in, check draw-in, progress fill, and muted skip.

**Motion rule**: Use `useMediaQuery("(prefers-reduced-motion: reduce)")`; do not use Framer Motion's `useReducedMotion`.

## R-7: Weekly Aggregate Read Contract

**Decision**: Define a future-facing manager summary RPC in this feature even though feature 017 builds the UI.

**Rationale**: The data shape is the privacy contract. The summary RPC returns only grouped counts and a sample size for the caller's visible team buckets; it never returns raw contribution ids or individual rows. Minimum-headcount suppression is explicitly not implemented here but remains a required pre-real-data hardening item.

## R-8: Model Artifact Scope

**Decision**: No model artifacts are touched.

**Rationale**: The trigger consumes the existing `Band = "at_ease" | "a_little_tense" | "tense"` contract. Named tunables are product prompt constants, not stress model thresholds or metadata. `docs/MODELS.md` does not need a doc sweep for this plan.
