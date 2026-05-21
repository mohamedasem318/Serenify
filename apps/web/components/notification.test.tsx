import { describe, expect, it, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

const { useMediaQueryMock, useReducedMotionMock } = vi.hoisted(() => ({
  useMediaQueryMock: vi.fn<(query: string) => boolean>(),
  useReducedMotionMock: vi.fn<() => boolean>(),
}));

vi.mock("@/hooks/use-media-query", () => ({
  useMediaQuery: useMediaQueryMock,
}));

vi.mock("framer-motion", async () => {
  const actual =
    await vi.importActual<typeof import("framer-motion")>("framer-motion");
  return {
    ...actual,
    useReducedMotion: useReducedMotionMock,
  };
});

import { Notification, CHAT_PILL_HEIGHT } from "@/components/notification";

function setup({
  mobile = false,
  reduceMotion = false,
}: { mobile?: boolean; reduceMotion?: boolean } = {}) {
  useMediaQueryMock.mockReturnValue(mobile);
  useReducedMotionMock.mockReturnValue(reduceMotion);
}

describe("Notification — closed state", () => {
  beforeEach(() => {
    useMediaQueryMock.mockReset();
    useReducedMotionMock.mockReset();
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
    useReducedMotionMock.mockReset();
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
    useReducedMotionMock.mockReset();
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

  it("renders the bg-black/50 overlay (softer than shadcn default)", async () => {
    setup({ mobile: true });
    render(
      <Notification open onOpenChange={vi.fn()} title="Heads up" />,
    );
    const overlay = await screen.findByTestId("notification-overlay");
    expect(overlay.className).toMatch(/\bbg-black\/50\b/);
    // And NOT the shadcn default which we are deliberately replacing.
    expect(overlay.className).not.toMatch(/\bbg-black\/80\b/);
  });
});

describe("Notification — reduced-motion variant", () => {
  beforeEach(() => {
    useMediaQueryMock.mockReset();
    useReducedMotionMock.mockReset();
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
    useReducedMotionMock.mockReset();
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
