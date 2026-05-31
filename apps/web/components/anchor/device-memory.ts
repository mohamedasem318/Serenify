/**
 * Calibration camera memory (FR-045, DECISION-25 / T029).
 *
 * The camera that LAST SUCCESSFULLY STARTED is remembered and preferred on the next
 * entry. The two invariants that keep a busy/dead device from permanently hijacking
 * calibration (the inescapable-lockout bug):
 *
 *  1. Only a device that actually started is ever written — a pick that fails to
 *     acquire (busy / unplugged / blocked) is NEVER persisted.
 *  2. A remembered device that later fails is repaired: the orchestrator falls back
 *     to the system default and persists whatever DID start, overwriting the dead id.
 *
 * Persistence lives here rather than in the picker on purpose: only the orchestrator
 * — which owns `getUserMedia` — knows whether a device successfully started, so the
 * picker (which fires on selection, before acquisition) must not write.
 */
const STORAGE_KEY = "serenify-anchor-camera";

/** The remembered deviceId, or undefined when none is stored / no localStorage. */
export function readRememberedCamera(): string | undefined {
  if (typeof localStorage === "undefined") return undefined;
  return localStorage.getItem(STORAGE_KEY) ?? undefined;
}

/** Remember a camera — call ONLY after it has successfully started (no-op on falsy id). */
export function rememberCamera(deviceId: string | undefined | null): void {
  if (typeof localStorage === "undefined" || !deviceId) return;
  localStorage.setItem(STORAGE_KEY, deviceId);
}
