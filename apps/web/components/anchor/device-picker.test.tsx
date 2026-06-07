import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { DevicePicker } from "./device-picker";

const STORAGE_KEY = "serenify-anchor-camera";

function mockDevices(devices: Array<Partial<MediaDeviceInfo>>) {
  Object.defineProperty(navigator, "mediaDevices", {
    configurable: true,
    value: { enumerateDevices: vi.fn().mockResolvedValue(devices) },
  });
}

afterEach(() => {
  localStorage.clear();
  vi.restoreAllMocks();
});

describe("DevicePicker", () => {
  it("shows a single 'Default camera' placeholder before permission is granted", async () => {
    mockDevices([{ deviceId: "", kind: "videoinput", label: "" }]);
    render(<DevicePicker permissionGranted={false} onChange={() => {}} />);
    await waitFor(() =>
      expect(screen.getByRole("option", { name: "Default camera" })).toBeInTheDocument(),
    );
  });

  it("shows real device labels after grant", async () => {
    mockDevices([
      { deviceId: "cam1", kind: "videoinput", label: "FaceTime HD" },
      { deviceId: "cam2", kind: "videoinput", label: "USB Cam" },
    ]);
    const onChange = vi.fn();
    render(<DevicePicker permissionGranted onChange={onChange} />);
    await waitFor(() =>
      expect(screen.getByRole("option", { name: "FaceTime HD" })).toBeInTheDocument(),
    );
    expect(screen.getByRole("option", { name: "USB Cam" })).toBeInTheDocument();
    expect(onChange).toHaveBeenCalledWith("cam1");
  });

  it("pre-selects a remembered device that is still present", async () => {
    localStorage.setItem(STORAGE_KEY, "cam2");
    mockDevices([
      { deviceId: "cam1", kind: "videoinput", label: "FaceTime HD" },
      { deviceId: "cam2", kind: "videoinput", label: "USB Cam" },
    ]);
    const onChange = vi.fn();
    render(<DevicePicker permissionGranted onChange={onChange} />);
    await waitFor(() => expect(onChange).toHaveBeenCalledWith("cam2"));
    expect((screen.getByLabelText("Camera") as HTMLSelectElement).value).toBe("cam2");
  });

  it("falls back to the default when the remembered device is gone (no error)", async () => {
    localStorage.setItem(STORAGE_KEY, "unplugged");
    mockDevices([{ deviceId: "cam1", kind: "videoinput", label: "FaceTime HD" }]);
    const onChange = vi.fn();
    render(<DevicePicker permissionGranted onChange={onChange} />);
    await waitFor(() => expect(onChange).toHaveBeenCalledWith("cam1"));
  });

  it("does NOT persist a user SELECTION — only a successfully-started device is remembered", async () => {
    mockDevices([
      { deviceId: "cam1", kind: "videoinput", label: "FaceTime HD" },
      { deviceId: "cam2", kind: "videoinput", label: "USB Cam" },
    ]);
    const onChange = vi.fn();
    render(<DevicePicker permissionGranted onChange={onChange} />);
    await waitFor(() => screen.getByRole("option", { name: "USB Cam" }));
    // mount resolved the default (cam1) on a cleared store and re-persisted it for the
    // session (FR-045 / T029) — that is the ONLY write the picker makes.
    expect(localStorage.getItem(STORAGE_KEY)).toBe("cam1");

    fireEvent.change(screen.getByLabelText("Camera"), { target: { value: "cam2" } });
    expect(onChange).toHaveBeenCalledWith("cam2");
    // SELECTING cam2 writes nothing — a busy/dead pick must never be remembered, so a
    // chosen device is persisted only after getUserMedia succeeds (orchestrator). The
    // stored value stays the mount default, never the unverified selection.
    expect(localStorage.getItem(STORAGE_KEY)).not.toBe("cam2");
    expect(localStorage.getItem(STORAGE_KEY)).toBe("cam1");
  });
});

describe("DevicePicker — re-persists a resolved default on a cleared store (T029, FR-045/DECISION-25)", () => {
  it("(re-)writes the preference when the store is cleared and a real default resolves", async () => {
    // store cleared (afterEach), one real camera resolves as the default.
    mockDevices([{ deviceId: "cam1", kind: "videoinput", label: "FaceTime HD" }]);
    const onChange = vi.fn();
    render(<DevicePicker permissionGranted onChange={onChange} />);
    await waitFor(() => expect(onChange).toHaveBeenCalledWith("cam1"));
    // FR-045: a cleared preference MUST re-persist so remembered-device behaviour does
    // not silently break for the session. (FAILS against the pre-fix picker, which
    // never wrote the auto-resolved default.)
    expect(localStorage.getItem(STORAGE_KEY)).toBe("cam1");
  });

  it("does NOT clobber a stored-but-temporarily-absent device", async () => {
    localStorage.setItem(STORAGE_KEY, "unplugged"); // remembered, currently disconnected
    mockDevices([{ deviceId: "cam1", kind: "videoinput", label: "FaceTime HD" }]);
    const onChange = vi.fn();
    render(<DevicePicker permissionGranted onChange={onChange} />);
    await waitFor(() => expect(onChange).toHaveBeenCalledWith("cam1")); // falls back to default
    // the absent device's memory is kept so it returns on reconnect (FR-005) — the
    // resolved default is NOT written over a non-empty stored preference.
    expect(localStorage.getItem(STORAGE_KEY)).toBe("unplugged");
  });

  it("leaves a still-present remembered device untouched (no churn)", async () => {
    localStorage.setItem(STORAGE_KEY, "cam2");
    mockDevices([
      { deviceId: "cam1", kind: "videoinput", label: "FaceTime HD" },
      { deviceId: "cam2", kind: "videoinput", label: "USB Cam" },
    ]);
    render(<DevicePicker permissionGranted onChange={vi.fn()} />);
    await waitFor(() =>
      expect((screen.getByLabelText("Camera") as HTMLSelectElement).value).toBe("cam2"),
    );
    expect(localStorage.getItem(STORAGE_KEY)).toBe("cam2");
  });
});
