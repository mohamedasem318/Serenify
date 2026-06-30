import { describe, expect, it, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

const { useMediaQueryMock } = vi.hoisted(() => ({
  useMediaQueryMock: vi.fn<(query: string) => boolean>(),
}));

// The component reads BOTH the viewport branch and the reduced-motion
// preference through useMediaQuery (the latter replaced framer-motion's
// useReducedMotion, which only snapshotted the value at mount). The mock
// is therefore query-aware so the two reads can be controlled
// independently.
vi.mock("@/hooks/use-media-query", () => ({
  useMediaQuery: useMediaQueryMock,
}));

import { Notification, CHAT_PILL_HEIGHT } from "@/components/notification";

function setup({
  mobile = false,
  reduceMotion = false,
}: { mobile?: boolean; reduceMotion?: boolean } = {}) {
  useMediaQueryMock.mockImplementation((query: string) =>
    query === "(prefers-reduced-motion: reduce)" ? reduceMotion : mobile,
  );
}

describe("Notification — closed state", () => {
  beforeEach(() => {
    useMediaQueryMock.mockReset();
    document.documentElement.style.removeProperty("--chat-pill-offset");
  });

  it("renders nothing in the DOM when open=false", () => {
    setup();
    render(
      <Notification open={false} onOpenChange={vi.fn()} title="Heads up" />,
    );
    expect(screen.queryByTestId("notification")).not.toBeInTheDocument();
    expect(screen.queryByTestId("notification-overlay")).not.toBeInTheDocument();
  });
});

describe("Notification — desktop slide-in variant", () => {
  beforeEach(() => {
    useMediaQueryMock.mockReset();
    document.documentElement.style.removeProperty("--chat-pill-offset");
  });

  it("renders the content with data-variant='desktop' when useMediaQuery is false", async () => {
    setup({ mobile: false });
    render(
      <Notification
        open
        onOpenChange={vi.fn()}
        title="Heads up"
        body="Something to check on."
      />,
    );
    const content = await screen.findByTestId("notification");
    expect(content).toHaveAttribute("data-variant", "desktop");
  });

  it("anchors the desktop card at the documented calc() bottom expression", async () => {
    setup({ mobile: false });
    render(
      <Notification open onOpenChange={vi.fn()} title="Heads up" />,
    );
    const content = await screen.findByTestId("notification");
    // Positioning lives in a Tailwind arbitrary-value class so it
    // survives framer-motion's per-frame inline-style overwrite. The
    // class itself is the contract; the browser resolves the calc +
    // var chain at runtime.
    expect(content.className).toContain(
      "bottom-[calc(1rem+var(--chat-pill-offset,0px)+1rem)]",
    );
  });

  it("emits the same bottom class regardless of --chat-pill-offset state on <html>", async () => {
    setup({ mobile: false });

    // Without --chat-pill-offset set (manager-pages case).
    const { unmount } = render(
      <Notification open onOpenChange={vi.fn()} title="Heads up" />,
    );
    const beforeContent = await screen.findByTestId("notification");
    expect(beforeContent.className).toContain(
      "bottom-[calc(1rem+var(--chat-pill-offset,0px)+1rem)]",
    );
    unmount();

    // With --chat-pill-offset set to 48px (employee-pages case).
    document.documentElement.style.setProperty(
      "--chat-pill-offset",
      `${CHAT_PILL_HEIGHT}px`,
    );
    render(<Notification open onOpenChange={vi.fn()} title="Heads up" />);
    const afterContent = await screen.findByTestId("notification");
    // Same className — the var() resolves in the browser, not in
    // the DOM serialisation. What we lock here is that the math is
    // expressed via the var() chain, not hardcoded per-mount.
    expect(afterContent.className).toContain(
      "bottom-[calc(1rem+var(--chat-pill-offset,0px)+1rem)]",
    );
    // The CSS var is set on <html> as expected, so the resolved
    // value would be calc(1rem + 48px + 1rem) = 80px in a real browser.
    expect(
      document.documentElement.style.getPropertyValue("--chat-pill-offset"),
    ).toBe("48px");
  });

  it("does NOT render the mobile overlay backdrop on the desktop variant DOM", async () => {
    setup({ mobile: false });
    render(
      <Notification open onOpenChange={vi.fn()} title="Heads up" />,
    );
    // The overlay element still mounts (Dialog needs it for keyboard
    // dismiss), but it carries `md:hidden`. Verify the class is on
    // the rendered element so the desktop pass cannot lose the
    // overlay-hiding behaviour.
    const overlay = await screen.findByTestId("notification-overlay");
    expect(overlay.className).toMatch(/\bmd:hidden\b/);
  });
});

describe("Notification — mobile bottom-sheet variant", () => {
  beforeEach(() => {
    useMediaQueryMock.mockReset();
    document.documentElement.style.removeProperty("--chat-pill-offset");
  });

  it("renders the content with data-variant='mobile' when useMediaQuery is true", async () => {
    setup({ mobile: true });
    render(
      <Notification open onOpenChange={vi.fn()} title="Heads up" />,
    );
    const content = await screen.findByTestId("notification");
    expect(content).toHaveAttribute("data-variant", "mobile");
  });

  it("uses bottom-0 (not the desktop calc() class) on the mobile variant", async () => {
    setup({ mobile: true });
    render(
      <Notification open onOpenChange={vi.fn()} title="Heads up" />,
    );
    const content = await screen.findByTestId("notification");
    // Mobile pins to the bottom edge via `bottom-0`. The desktop
    // calc() class MUST NOT appear or the mobile sheet would lift
    // off the bottom of the viewport.
    expect(content.className).toMatch(/\bbottom-0\b/);
    expect(content.className).not.toContain(
      "bottom-[calc(1rem+var(--chat-pill-offset,0px)+1rem)]",
    );
  });

  it("renders the scrim-token overlay (FR-021, not a raw bg-black scrim)", async () => {
    setup({ mobile: true });
    render(
      <Notification open onOpenChange={vi.fn()} title="Heads up" />,
    );
    const overlay = await screen.findByTestId("notification-overlay");
    expect(overlay.className).toMatch(/\bbg-scrim\b/);
    // And NOT a raw bg-black/* scrim — 007 re-tokenised every overlay to
    // the shared --color-scrim token (FR-021), replacing the shadcn default.
    expect(overlay.className).not.toMatch(/\bbg-black\//);
  });
});

describe("Notification — reduced-motion variant", () => {
  beforeEach(() => {
    useMediaQueryMock.mockReset();
    document.documentElement.style.removeProperty("--chat-pill-offset");
  });

  it("renders without throwing when useReducedMotion returns true", async () => {
    setup({ reduceMotion: true });
    render(
      <Notification
        open
        onOpenChange={vi.fn()}
        title="Heads up"
        body="Reduced-motion users see the same content."
      />,
    );
    expect(await screen.findByTestId("notification")).toBeInTheDocument();
    // Body still renders — the motion strategy change doesn't affect
    // semantic content.
    expect(
      screen.getByText("Reduced-motion users see the same content."),
    ).toBeInTheDocument();
  });

  it("still calls onOpenChange when dismissed under reduced-motion", async () => {
    setup({ reduceMotion: true });
    const onOpenChange = vi.fn();
    const user = userEvent.setup();
    render(
      <Notification open onOpenChange={onOpenChange} title="Heads up" />,
    );
    await user.click(screen.getByRole("button", { name: "Dismiss" }));
    await waitFor(() => {
      expect(onOpenChange).toHaveBeenCalledWith(false);
    });
  });
});

describe("Notification — dismiss control", () => {
  beforeEach(() => {
    useMediaQueryMock.mockReset();
    document.documentElement.style.removeProperty("--chat-pill-offset");
  });

  it("uses the default 'Dismiss' label and triggers onOpenChange(false) on click", async () => {
    setup();
    const onOpenChange = vi.fn();
    const user = userEvent.setup();
    render(
      <Notification open onOpenChange={onOpenChange} title="Heads up" />,
    );
    const dismiss = await screen.findByRole("button", { name: "Dismiss" });
    await user.click(dismiss);
    await waitFor(() => {
      expect(onOpenChange).toHaveBeenCalledWith(false);
    });
  });

  it("honours a custom dismissLabel prop", async () => {
    setup();
    render(
      <Notification
        open
        onOpenChange={vi.fn()}
        title="Heads up"
        dismissLabel="Got it"
      />,
    );
    expect(
      await screen.findByRole("button", { name: "Got it" }),
    ).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Dismiss" })).toBeNull();
  });
});

// ── T029 — non-dismissable confirmatory mode (dismissible=false / nonModal=true) ────────
// The confirmatory prompt is the one documented `dismissible:false` consumer: it removes
// close UI and blocks Escape / outside / blur dismissal, but stays keyboard-answerable and
// must NOT trap focus or make the rest of the app inert (R-5 / accessibility contract).
describe("Notification — non-dismissable confirmatory mode", () => {
  beforeEach(() => {
    useMediaQueryMock.mockReset();
    document.documentElement.style.removeProperty("--chat-pill-offset");
  });

  it("renders no close button when dismissible=false", async () => {
    setup();
    render(
      <Notification open onOpenChange={vi.fn()} title="Checking in" dismissible={false} nonModal>
        <button type="button">Yes, that&apos;s me</button>
      </Notification>,
    );
    await screen.findByTestId("notification");
    expect(screen.queryByRole("button", { name: "Dismiss" })).toBeNull();
  });

  it("does NOT render a scrim overlay in nonModal mode (no app inertness)", async () => {
    setup({ mobile: true }); // mobile is where the overlay would otherwise render
    render(
      <Notification open onOpenChange={vi.fn()} title="Checking in" dismissible={false} nonModal>
        <button type="button">Answer</button>
      </Notification>,
    );
    await screen.findByTestId("notification");
    expect(screen.queryByTestId("notification-overlay")).toBeNull();
  });

  it("Escape does not dismiss when dismissible=false", async () => {
    setup();
    const onOpenChange = vi.fn();
    const user = userEvent.setup();
    render(
      <Notification open onOpenChange={onOpenChange} title="Checking in" dismissible={false} nonModal>
        <button type="button">Answer</button>
      </Notification>,
    );
    await screen.findByTestId("notification");
    await user.keyboard("{Escape}");
    expect(onOpenChange).not.toHaveBeenCalled();
  });

  it("an outside click does not dismiss when dismissible=false", async () => {
    setup();
    const onOpenChange = vi.fn();
    const user = userEvent.setup();
    render(
      <div>
        <button type="button">outside app control</button>
        <Notification open onOpenChange={onOpenChange} title="Checking in" dismissible={false} nonModal>
          <button type="button">Answer</button>
        </Notification>
      </div>,
    );
    await screen.findByTestId("notification");
    await user.click(screen.getByRole("button", { name: "outside app control" }));
    expect(onOpenChange).not.toHaveBeenCalled();
  });

  it("keeps answer buttons keyboard-focusable and does not trap focus", async () => {
    setup();
    render(
      <div>
        <button type="button">outside app control</button>
        <Notification open onOpenChange={vi.fn()} title="Checking in" dismissible={false} nonModal>
          <button type="button">Yes, that&apos;s me</button>
        </Notification>
      </div>,
    );
    await screen.findByTestId("notification");
    const answer = screen.getByRole("button", { name: "Yes, that's me" });
    answer.focus();
    expect(answer).toHaveFocus();
    // non-modal: focus can leave the prompt to the rest of the app (no trap)
    const outside = screen.getByRole("button", { name: "outside app control" });
    outside.focus();
    expect(outside).toHaveFocus();
  });
});
