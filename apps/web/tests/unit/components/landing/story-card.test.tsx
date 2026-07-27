import { act, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { StoryCard } from "@/components/landing/story-card";
import { useMediaQuery } from "@/hooks/use-media-query";
import { BAND_LABEL } from "@/lib/bands";
import * as copy from "@/lib/landing/copy";
import { STORY_BEATS, beatAt, chaptersOf } from "@/lib/landing/story-script";

/**
 * T106 (feature 013, US1) — the story card's state machine
 * (`research.md` §12.2 "Unit").
 *
 * The card's honesty properties are about what is on screen at each beat, so they are
 * asserted by STEPPING THE WHOLE SCRIPT rather than spot-checking three interesting
 * beats. An off-by-one in the panel mapping, or a thread that grows one bubble past the
 * cap on a beat nobody looked at, is exactly the kind of thing a spot check misses and a
 * visitor eventually sees.
 */

vi.mock("@/hooks/use-media-query", () => ({ useMediaQuery: vi.fn(() => false) }));
const mockedUseMediaQuery = vi.mocked(useMediaQuery);

/** The card owns the only IntersectionObserver; jsdom/happy-dom has none. */
class NoopObserver implements IntersectionObserver {
  readonly root = null;
  readonly rootMargin = "";
  readonly thresholds: readonly number[] = [];
  observe() {}
  unobserve() {}
  disconnect() {}
  takeRecords(): IntersectionObserverEntry[] {
    return [];
  }
}

beforeEach(() => {
  mockedUseMediaQuery.mockReturnValue(false);
  vi.stubGlobal("IntersectionObserver", NoopObserver);
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

/** A click that flushes React's work — userEvent deadlocks against fake timers here. */
async function click(element: HTMLElement) {
  await act(async () => {
    fireEvent.click(element);
  });
}

/** Advance the clock by one beat's duration. */
async function advanceOneBeat(index: number) {
  await act(async () => {
    vi.advanceTimersByTime(beatAt(index).durationMs + 1);
  });
}

function activePanels(): string[] {
  return Array.from(document.querySelectorAll("[data-panel][data-active]")).map(
    (element) => element.getAttribute("data-panel") ?? "",
  );
}

describe("exactly one panel is active at every beat", () => {
  it("holds for all 17 beat indices, stepped through the whole script", async () => {
    render(<StoryCard />);

    for (let index = 0; index < STORY_BEATS.length; index++) {
      expect(activePanels(), `beat ${index}`).toEqual([beatAt(index).panel]);
      await advanceOneBeat(index);
    }
  });
});

describe("the readout is permanently visible (FR-007)", () => {
  it("shows a band label at every beat", async () => {
    render(<StoryCard />);
    for (let index = 0; index < STORY_BEATS.length; index++) {
      const readout = screen.getByTestId("story-readout");
      expect(within(readout).getByTestId("story-reading").textContent, `beat ${index}`).toBe(
        BAND_LABEL[beatAt(index).band],
      );
      await advanceOneBeat(index);
    }
  });

  it("shows it under reduced motion too", () => {
    mockedUseMediaQuery.mockReturnValue(true);
    render(<StoryCard />);
    expect(screen.getByTestId("story-readout")).toBeInTheDocument();
    expect(screen.getByTestId("story-reading").textContent).toBeTruthy();
  });
});

describe("the thread never exceeds four bubbles (FR-011)", () => {
  it("holds at every beat, not just the ones with a push", async () => {
    render(<StoryCard />);
    let sawFour = false;
    for (let index = 0; index < STORY_BEATS.length; index++) {
      const thread = screen.queryByTestId("ren-thread");
      const count = thread ? within(thread).queryAllByRole("listitem").length : 0;
      expect(count, `beat ${index} rendered ${count} bubbles`).toBeLessThanOrEqual(4);
      if (count === 4) sawFour = true;
      await advanceOneBeat(index);
    }
    // Guards the vacuous pass: a thread that never filled up would satisfy "<= 4" while
    // proving nothing about the trim.
    expect(sawFour, "the thread never reached the cap, so the cap was never exercised").toBe(
      true,
    );
  });
});

describe("the closing beat renders the approved string", () => {
  it("matches §10.3 Position 3 character-for-character, clauses in order", async () => {
    render(<StoryCard />);
    for (let index = 0; index < STORY_BEATS.length - 1; index++) {
      await advanceOneBeat(index);
    }

    const narration = screen.getByTestId("story-narration");
    expect(narration.textContent).toBe(copy.STORY_CLOSING_BEAT);
    expect(narration.textContent).toBe(
      "What you said stays yours. The video was read and forgotten.",
    );
    const text = narration.textContent ?? "";
    expect(text.indexOf("stays yours")).toBeLessThan(text.indexOf("read and forgotten"));
  });
});

describe("reduced motion (FR-013, SC-010)", () => {
  it("arms no timer — the story does not advance on its own", async () => {
    mockedUseMediaQuery.mockReturnValue(true);
    render(<StoryCard />);

    const before = screen.getByTestId("story-narration").textContent;
    await act(async () => {
      // Far longer than the whole 42 s cycle.
      vi.advanceTimersByTime(120_000);
    });
    expect(screen.getByTestId("story-narration").textContent).toBe(before);
  });

  it("still lets the chapter markers step through deliberately", async () => {
    mockedUseMediaQuery.mockReturnValue(true);
    render(<StoryCard />);

    const markers = screen.getAllByRole("button");
    expect(markers).toHaveLength(chaptersOf().length);

    await click(markers[markers.length - 1] as HTMLElement);
    expect(activePanels()).toEqual([beatAt(STORY_BEATS.findIndex((b) => b.chapter === 5)).panel]);
  });

  it("applies no transition class to the panels", () => {
    mockedUseMediaQuery.mockReturnValue(true);
    render(<StoryCard />);
    for (const panel of document.querySelectorAll("[data-panel]")) {
      expect(panel.className).not.toMatch(/transition/);
    }
  });
});

describe("chapter markers", () => {
  it("are real <button> elements, which is what gives Enter and Space for free", () => {
    // A <div role="button"> would announce identically and pass a shallow a11y check
    // while doing nothing for a keyboard user. The element type IS the behaviour, so it
    // is what gets asserted — simulating Enter against a div would only prove the
    // simulation works.
    render(<StoryCard />);
    for (const marker of screen.getAllByRole("button")) {
      expect(marker.tagName).toBe("BUTTON");
      expect(marker).toHaveAttribute("type", "button");
    }
  });

  it("jump to the first beat of the chapter they name", async () => {
    render(<StoryCard />);

    const markers = screen.getAllByRole("button");
    for (const [chapter, marker] of markers.entries()) {
      await click(marker);
      const expected = STORY_BEATS.findIndex((beat) => beat.chapter === chapter);
      expect(activePanels(), `chapter ${chapter}`).toEqual([beatAt(expected).panel]);
      expect(marker).toHaveAttribute("aria-current", "true");
    }
  });

  it("marks exactly one marker current at a time", () => {
    render(<StoryCard />);
    expect(document.querySelectorAll('[aria-current="true"]')).toHaveLength(1);
  });
});
