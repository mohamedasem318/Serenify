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

  it("persists the chosen device to localStorage", async () => {
    mockDevices([
      { deviceId: "cam1", kind: "videoinput", label: "FaceTime HD" },
      { deviceId: "cam2", kind: "videoinput", label: "USB Cam" },
    ]);
    render(<DevicePicker permissionGranted onChange={() => {}} />);
    await waitFor(() => screen.getByRole("option", { name: "USB Cam" }));
    fireEvent.change(screen.getByLabelText("Camera"), { target: { value: "cam2" } });
    expect(localStorage.getItem(STORAGE_KEY)).toBe("cam2");
  });
});
