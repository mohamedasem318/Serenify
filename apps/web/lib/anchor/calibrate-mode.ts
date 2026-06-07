import type { RecorderMode } from "@/components/anchor/use-anchor-recorder";

export type { RecorderMode };

/**
 * Reconcile the URL `?mode=` param against the user's REAL calibration state
 * (clarification #3 / 📌 DECISION-22, FR-038/053). Kept PURE so the calibrate
 * route's load-bearing decision is unit-tested directly rather than inferred from a
 * Server Component.
 *
 * Two intertwined decisions:
 *
 *  - **effective `mode`**: "recalibrate" only counts when a baseline actually
 *    exists. A stray `?mode=recalibrate` with no baseline falls back to first-time
 *    semantics (copy "set", exit `/app`) — the URL alone never manufactures a
 *    recalibration over a user who has nothing to replace.
 *  - **`redirectToApp`** (the feature-004 ST-17 guard): a CALIBRATED employee
 *    landing on a bare `/app/calibrate` (no recalibrate intent) is bounced to
 *    `/app` — there's nothing to do, the banner is already gone. A recalibrating
 *    user is NOT bounced (they came to replace). An uncalibrated user is never
 *    bounced (they came to calibrate).
 *
 * Conservative on null/undefined from `has_anchor` (a transient RPC failure): treat
 * as not-calibrated, so the recorder stays reachable rather than stranding a still-
 * uncalibrated user behind a redirect.
 */
export function resolveCalibrateMode({
  paramMode,
  hasAnchor,
}: {
  paramMode: string | string[] | undefined;
  hasAnchor: boolean | null | undefined;
}): { mode: RecorderMode; redirectToApp: boolean } {
  const calibrated = hasAnchor === true;
  const wantsRecalibrate = paramMode === "recalibrate";
  const mode: RecorderMode = wantsRecalibrate && calibrated ? "recalibrate" : "first-time";
  const redirectToApp = calibrated && mode !== "recalibrate";
  return { mode, redirectToApp };
}

/**
 * Where each mode returns to on completion or deferral (FR-053). Hard-navigated by
 * the recorder wrapper so the relaxed `camera=(self)` policy never lingers on a
 * non-capture document and the destination re-renders fresh (📌 DECISION-16/22).
 */
export function calibrateExit(mode: RecorderMode): "/app" | "/app/account" {
  return mode === "recalibrate" ? "/app/account" : "/app";
}
