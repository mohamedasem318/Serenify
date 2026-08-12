import { render, screen, cleanup, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const push = vi.fn();
const refresh = vi.fn();
vi.mock("next/navigation", () => ({ useRouter: () => ({ push, refresh }) }));
vi.mock("@/hooks/use-media-query", () => ({ useMediaQuery: () => false }));

const completeOnboarding = vi.fn<(form: FormData) => Promise<{ status: "ok" }>>(async () => ({
  status: "ok",
}));
vi.mock("@/app/(onboarding)/onboarding/actions", () => ({
  completeOnboarding: (form: FormData) => completeOnboarding(form),
}));

/**
 * A spy standing in for the real recorder. If the gate ever fails to withhold it, this
 * renders and every assertion below names it — which is stronger than asserting the
 * absence of a <video> tag, because it fails even if the recorder's own markup changes.
 */
const anchorRecorderMounted = vi.fn();
vi.mock("@/components/anchor/anchor-recorder", () => ({
  AnchorRecorder: (props: unknown) => {
    anchorRecorderMounted(props);
    return <div data-testid="anchor-recorder" />;
  },
}));

import { OnboardingForm } from "@/app/(onboarding)/onboarding/onboarding-form";
import { CAMERA_GATE_DECLINE_LABEL, CAMERA_GATE_TITLE } from "@/lib/consent/copy";

/**
 * T049 — the camera gate replaces the ANCHOR STEP'S RECORDER, not the whole form.
 *
 * WHY THIS SHAPE, recorded because the obvious alternative is a total product lockout.
 * Gating the whole route removes the NAME step, which is the only thing that ever writes
 * `profiles.full_name`. Declining then navigates to `/app`, where `proxy.ts:203` bounces
 * a null-`full_name` user straight back to `/onboarding` — and round again, forever, with
 * no way to set a name, reach `/app`, or reach the weekly work-environment survey.
 *
 * FR-043c is the resolution, not a workaround: declining blocks calibration, baseline
 * capture and monitoring sessions, "and nothing else". A text field is not camera
 * capture. So the name step runs regardless of consent, and the gate sits exactly where
 * the capture is.
 *
 * FR-038 still holds STRUCTURALLY, and is asserted rather than asserted-about: the
 * recorder is never rendered, so nothing that could call `getUserMedia` is ever mounted.
 */

async function reachAnchorStep(user: ReturnType<typeof userEvent.setup>) {
  await user.type(screen.getByLabelText(/full name/i), "Alex");
  await user.click(screen.getByRole("button", { name: /continue/i }));
  await waitFor(() => expect(completeOnboarding).toHaveBeenCalled());
}

beforeEach(() => vi.clearAllMocks());
afterEach(cleanup);

describe("the name step is reachable and functional regardless of consent", () => {
  it.each([true, false])("renders the name field with cameraBlocked=%s", (cameraBlocked) => {
    render(<OnboardingForm cameraBlocked={cameraBlocked} />);
    expect(screen.getByLabelText(/full name/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /continue/i })).toBeInTheDocument();
    // The consent surface must NOT pre-empt the name step.
    expect(screen.queryByRole("heading", { name: CAMERA_GATE_TITLE })).toBeNull();
  });

  it("submits the name even when camera consent is absent — this is what closes the loop", async () => {
    const user = userEvent.setup();
    render(<OnboardingForm cameraBlocked />);

    await reachAnchorStep(user);

    // full_name is now written, so proxy.ts:203 will no longer bounce this user back
    // here. Declining from the next step lands them on a usable /app.
    expect(completeOnboarding).toHaveBeenCalledTimes(1);
  });
});

describe("FR-038 — the recorder never mounts while consent is absent", () => {
  it("renders the gate in place of the recorder at the anchor step", async () => {
    const user = userEvent.setup();
    render(<OnboardingForm cameraBlocked />);
    await reachAnchorStep(user);

    expect(screen.getByRole("heading", { name: CAMERA_GATE_TITLE })).toBeInTheDocument();
    expect(screen.queryByTestId("anchor-recorder")).toBeNull();
    expect(anchorRecorderMounted).not.toHaveBeenCalled();
  });

  it("renders no video or canvas element anywhere on the gated anchor step", async () => {
    const user = userEvent.setup();
    const { container } = render(<OnboardingForm cameraBlocked />);
    await reachAnchorStep(user);

    expect(container.querySelector("video")).toBeNull();
    expect(container.querySelector("canvas")).toBeNull();
  });

  it("never touches navigator.mediaDevices on the whole gated path", async () => {
    const getUserMedia = vi.fn();
    Object.defineProperty(globalThis.navigator, "mediaDevices", {
      value: { getUserMedia },
      configurable: true,
    });

    const user = userEvent.setup();
    render(<OnboardingForm cameraBlocked />);
    await reachAnchorStep(user);

    expect(getUserMedia).not.toHaveBeenCalled();
  });

  it("mounts the recorder normally once consent is present", async () => {
    const user = userEvent.setup();
    render(<OnboardingForm cameraBlocked={false} />);
    await reachAnchorStep(user);

    expect(screen.getByTestId("anchor-recorder")).toBeInTheDocument();
    // Called at least once, not exactly once: this spy counts RENDERS, and React may
    // legitimately render a component more than once. The load-bearing direction is the
    // zero-call assertion above, which is exact and cannot be satisfied by accident.
    expect(anchorRecorderMounted).toHaveBeenCalled();
    expect(screen.queryByRole("heading", { name: CAMERA_GATE_TITLE })).toBeNull();
  });
});

describe("declining from the anchor step is now escapable", () => {
  it("navigates to /app, which the user can actually reach because full_name is set", async () => {
    const user = userEvent.setup();
    render(<OnboardingForm cameraBlocked />);
    await reachAnchorStep(user);

    await user.click(screen.getByRole("button", { name: CAMERA_GATE_DECLINE_LABEL }));

    expect(push).toHaveBeenCalledWith("/app");
    // and still nothing captured, and still nothing written
    expect(anchorRecorderMounted).not.toHaveBeenCalled();
  });
});
