"use client";

import { useEffect, useState } from "react";

import { readRememberedCamera, rememberCamera } from "./device-memory";

/**
 * Camera chooser (📌 DECISION-13, FR-005). Before the first getUserMedia grant
 * browsers hide device labels, so a single "Default camera" placeholder is
 * shown; after `permissionGranted` flips true the list re-enumerates with real
 * labels. The remembered device (the last that SUCCESSFULLY started) is pre-selected
 * on return; if the stored device is gone it falls back to the default with no error.
 * The picker does NOT persist on selection — the orchestrator remembers a device only
 * after it actually starts (device-memory.ts), so a busy/dead pick is never stored.
 * It DOES re-persist the auto-resolved default when nothing is stored at all, so a
 * cleared preference recovers for the session without clobbering a temporarily-absent
 * remembered device (FR-045, DECISION-25). A native <select> is used for built-in
 * keyboard + mobile-picker accessibility.
 */
export function DevicePicker({
  permissionGranted,
  onChange,
  disabled,
}: {
  permissionGranted: boolean;
  onChange: (deviceId: string | undefined) => void;
  disabled?: boolean;
}) {
  const [devices, setDevices] = useState<MediaDeviceInfo[]>([]);
  const [selected, setSelected] = useState("");

  // Re-enumerates on mount and when permission flips (labels populate post-grant).
  // `onChange` must be stable (the orchestrator wraps it in useCallback) so this
  // does not re-run on every parent render.
  useEffect(() => {
    let cancelled = false;
    async function enumerate() {
      if (!navigator.mediaDevices?.enumerateDevices) return;
      const all = await navigator.mediaDevices.enumerateDevices();
      if (cancelled) return;
      const cams = all.filter((d) => d.kind === "videoinput");
      setDevices(cams);

      const stored = readRememberedCamera();
      const storedPresent = stored && cams.some((c) => c.deviceId === stored);
      const next = storedPresent ? stored : (cams[0]?.deviceId ?? "");
      setSelected(next);
      onChange(next || undefined);

      // FR-045 / DECISION-25: when the store is empty/cleared AND a real default
      // camera resolves, (re-)write it so the remembered-device preference doesn't
      // silently break for the session. Guarded on `!stored` so a stored-but-
      // temporarily-absent device is NEVER clobbered — its memory is kept so it
      // returns when it reconnects (preserving FR-005). This is the one resolution
      // the orchestrator can miss (it persists only what getUserMedia actually
      // started, and a started track may expose no deviceId); the no-lockout
      // invariant still holds because a busy remembered device is repaired on the
      // next entry (orchestrator fallback + repair).
      if (!stored && next) {
        rememberCamera(next);
      }
    }
    void enumerate();
    return () => {
      cancelled = true;
    };
  }, [permissionGranted, onChange]);

  function handleChange(event: React.ChangeEvent<HTMLSelectElement>) {
    const id = event.target.value;
    setSelected(id);
    // No persistence here — the orchestrator remembers a device only after it
    // SUCCESSFULLY starts, so a busy/dead pick is never written (no lockout).
    onChange(id || undefined);
  }

  const hasLabels = devices.some((d) => d.label);

  return (
    <div className="space-y-1.5">
      <label
        htmlFor="anchor-camera"
        className="block text-xs font-medium uppercase tracking-wide text-muted"
      >
        Camera
      </label>
      <select
        id="anchor-camera"
        value={selected}
        onChange={handleChange}
        disabled={disabled}
        className="h-12 w-full rounded-control border border-border bg-surface px-3 text-base text-ink outline-none transition-colors focus:border-meadow disabled:cursor-not-allowed disabled:opacity-60"
      >
        {hasLabels ? (
          devices.map((device, index) => (
            <option key={device.deviceId} value={device.deviceId}>
              {device.label || `Camera ${index + 1}`}
            </option>
          ))
        ) : (
          <option value="">Default camera</option>
        )}
      </select>
    </div>
  );
}
