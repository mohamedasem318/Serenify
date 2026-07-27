import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { fireEvent, render, screen, cleanup, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { CameraConsentGate } from "@/components/consent/camera-consent-gate";
import { currentRevision } from "@/lib/consent/evaluate";
import {
  CAMERA_GATE_ACCEPT_LABEL,
  CAMERA_GATE_DECLINE_LABEL,
  CAMERA_GATE_TITLE,
  CAMERA_GATE_WHAT_HAPPENS,
  CAMERA_GATE_WRITE_ERROR,
} from "@/lib/consent/copy";

/**
 * T056 — the camera gate's own behaviour (FR-038, ST-11, §6.4).
 *
 * The headline assertion is an ABSENCE, and it is asserted structurally rather than
 * visually: no capturing element is in the tree, and the module graph contains no
 * `getUserMedia` call. "The camera does not turn on" is a weaker claim than "no code
 * that could turn the camera on is mounted", and only the second one survives a future
 * refactor that hides the recorder behind a CSS class instead of not rendering it.
 */

const push = vi.fn();
const refresh = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push, refresh }),
}));

beforeEach(() => {
  vi.clearAllMocks();
});
afterEach(cleanup);

const ok = async () => ({ status: "ok" as const });

describe("FR-038 — nothing that can reach the camera is mounted", () => {
  it("renders no video, no canvas, and no media element", () => {
    const { container } = render(<CameraConsentGate onGrant={ok} />);
    expect(container.querySelector("video")).toBeNull();
    expect(container.querySelector("canvas")).toBeNull();
    expect(container.querySelector("audio")).toBeNull();
  });

  it("never touches navigator.mediaDevices during a render", () => {
    const getUserMedia = vi.fn();
    Object.defineProperty(globalThis.navigator, "mediaDevices", {
      value: { getUserMedia },
      configurable: true,
    });

    render(<CameraConsentGate onGrant={ok} />);

    expect(getUserMedia).not.toHaveBeenCalled();
  });

  it("its source imports no recorder and calls no capture API", () => {
    // The absence must hold in the MODULE GRAPH, not just in the rendered output — an
    // imported recorder could acquire the camera in a module-level effect.
    //
    // Two scans, because the file must be free to DOCUMENT what it does not do. The
    // executable scan runs on comment-stripped source; the call scan runs on the raw
    // file and looks for an invocation, so a commented-out `getUserMedia(...)` waiting
    // to be uncommented is still caught while the prose explaining its absence is not.
    const raw = readFileSync(
      resolve(process.cwd(), "components/consent/camera-consent-gate.tsx"),
      "utf8",
    );
    const code = raw.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");

    expect(code).not.toMatch(/getUserMedia|MediaRecorder|mediaDevices/);
    expect(code).not.toMatch(/anchor-recorder|calibrate-recorder|monitoring-session/i);
    expect(raw).not.toMatch(/getUserMedia\s*\(/);
    expect(raw).not.toMatch(/new\s+MediaRecorder/);
  });
});

describe("the two controls", () => {
  it("offers an explicit accept and an explicit decline, both as real buttons", () => {
    render(<CameraConsentGate onGrant={ok} />);
    const accept = screen.getByRole("button", { name: CAMERA_GATE_ACCEPT_LABEL });
    const decline = screen.getByRole("button", { name: CAMERA_GATE_DECLINE_LABEL });
    expect(accept).toBeInTheDocument();
    expect(decline).toBeInTheDocument();
  });

  it("gives both controls the same prominence class, so decline is not buried", () => {
    // FR-045 puts these documents under GDPR alongside Egypt's Law 151/2020, where
    // consent must be freely given. A decline that is visually de-emphasised beside a
    // prominent accept is the standard consent dark-pattern shape. Asserting the shared
    // sizing keeps a later "tidy-up" from quietly shrinking one of them.
    render(<CameraConsentGate onGrant={ok} />);
    const accept = screen.getByRole("button", { name: CAMERA_GATE_ACCEPT_LABEL });
    const decline = screen.getByRole("button", { name: CAMERA_GATE_DECLINE_LABEL });
    expect(accept.className).toContain("h-12");
    expect(decline.className).toContain("h-12");
    expect(accept.className).toContain("w-full");
    expect(decline.className).toContain("w-full");
    // and the decline is not a bare text link
    expect(decline.tagName).toBe("BUTTON");
  });

  it("both controls are keyboard reachable and carry accessible names", () => {
    render(<CameraConsentGate onGrant={ok} />);
    for (const name of [CAMERA_GATE_ACCEPT_LABEL, CAMERA_GATE_DECLINE_LABEL]) {
      const control = screen.getByRole("button", { name });
      control.focus();
      expect(document.activeElement).toBe(control);
      expect(control.className).toMatch(/focus-visible:ring/);
    }
  });
});

describe("accepting", () => {
  it("invokes the write action exactly once, for the camera key", async () => {
    const writer = vi.fn(ok);
    render(<CameraConsentGate onGrant={writer} />);

    fireEvent.click(screen.getByRole("button", { name: CAMERA_GATE_ACCEPT_LABEL }));

    await waitFor(() => expect(writer).toHaveBeenCalledTimes(1));
    expect(writer).toHaveBeenCalledWith("camera_inference");
  });

  it("supplies NO version id from the render — the action resolves it server-side", async () => {
    // The render must not be able to nominate which revision is being consented to. The
    // action takes only a key; the version comes from the registry (R8 is not reopened).
    const writer = vi.fn(ok);
    render(<CameraConsentGate onGrant={writer} />);
    fireEvent.click(screen.getByRole("button", { name: CAMERA_GATE_ACCEPT_LABEL }));

    await waitFor(() => expect(writer).toHaveBeenCalled());
    // toHaveBeenCalledWith compares the FULL argument list, so this simultaneously
    // proves the argument is the key and that no version id rode along beside it.
    expect(writer).toHaveBeenCalledWith("camera_inference");
    expect(writer).not.toHaveBeenCalledWith(
      "camera_inference",
      currentRevision("camera_inference").versionId,
    );
  });

  it("re-runs the gating server component on success rather than navigating", async () => {
    render(<CameraConsentGate onGrant={ok} />);
    fireEvent.click(screen.getByRole("button", { name: CAMERA_GATE_ACCEPT_LABEL }));
    await waitFor(() => expect(refresh).toHaveBeenCalledTimes(1));
    expect(push).not.toHaveBeenCalled();
  });

  it("surfaces a calm failure and stays put when the write fails", async () => {
    render(<CameraConsentGate onGrant={async () => ({ status: "error" as const })} />);
    fireEvent.click(screen.getByRole("button", { name: CAMERA_GATE_ACCEPT_LABEL }));

    await waitFor(() =>
      expect(screen.getByRole("alert")).toHaveTextContent(CAMERA_GATE_WRITE_ERROR),
    );
    expect(refresh).not.toHaveBeenCalled();
    // Still answerable — a failed write must not strand the user on a dead surface.
    //
    // WAITED FOR, NOT ASSERTED OUTRIGHT, AND THAT IS THE FLAKE FIX. The gate disables its
    // buttons on `pending` from `useTransition`, and `setFailed(true)` runs INSIDE the
    // transition scope. React is therefore free to commit the alert while `pending` is
    // still true and to settle the transition in a LATER commit — so the alert becoming
    // visible does not imply the button is re-enabled yet. Asserting immediately after
    // awaiting the alert made this test pass or fail on commit scheduling, which is what
    // failed the first web run of PR #182 and went green on re-run at the same SHA.
    //
    // The button DOES re-enable; only the moment is not ours to pin down. This is a test
    // bug, not a race in the gate — the component is deliberately left untouched.
    await waitFor(() =>
      expect(screen.getByRole("button", { name: CAMERA_GATE_ACCEPT_LABEL })).toBeEnabled(),
    );
  });
});

describe("the surface is presentable again on a later arrival (§6.4)", () => {
  it("holds no state that would suppress it after a decline", () => {
    const first = render(<CameraConsentGate onGrant={ok} />);
    fireEvent.click(screen.getByRole("button", { name: CAMERA_GATE_DECLINE_LABEL }));
    first.unmount();

    // A fresh mount is a fresh arrival. The gate renders in full because the absence of
    // a satisfying record IS the state — there is nothing local to consult.
    render(<CameraConsentGate onGrant={ok} />);
    expect(screen.getByRole("heading", { name: CAMERA_GATE_TITLE })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: CAMERA_GATE_ACCEPT_LABEL })).toBeInTheDocument();
  });

  it("uses no browser storage (FR-051)", () => {
    const source = readFileSync(
      resolve(process.cwd(), "components/consent/camera-consent-gate.tsx"),
      "utf8",
    );
    expect(source).not.toMatch(/localStorage|sessionStorage/);
  });
});

describe("what the surface says, and does not say", () => {
  it("renders the wording from lib/consent/copy.ts, including the transmission fact", () => {
    render(<CameraConsentGate onGrant={ok} />);
    for (const fact of CAMERA_GATE_WHAT_HAPPENS) {
      expect(screen.getByText(fact)).toBeInTheDocument();
    }
  });

  it("makes no claim about manager visibility anywhere on the surface", () => {
    const { container } = render(<CameraConsentGate onGrant={ok} />);
    expect(container.textContent ?? "").not.toMatch(/manager|team lead|employer|supervisor/i);
  });

  it("stays calm — no exclamation marks (Principle V)", () => {
    const { container } = render(<CameraConsentGate onGrant={ok} />);
    expect(container.textContent ?? "").not.toContain("!");
  });
});
