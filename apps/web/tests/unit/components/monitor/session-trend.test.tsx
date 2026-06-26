import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { SessionTrend } from "@/components/monitor/session-trend";
import type { SessionTrendPoint } from "@/lib/api/monitoring-reads";
import type { Band } from "@/lib/api/monitoring-client";

/**
 * Feature 010 / 009b — US1 (T013). The redesigned live "This session" trend:
 *   SC-001/SC-002 fixed-px (svg width === viewBox width; no preserveAspectRatio stretch → a
 *                 TRUE circle) at 360px AND ~768px; fills the measured container.
 *   SC-003 step-line colour = band.
 *   SC-011 (live) the now marker recolours to the current band.
 *   FR-017 no number anywhere.
 * happy-dom has no layout engine, so the container width is stubbed via getBoundingClientRect.
 */

// happy-dom may not define ResizeObserver; the component's initial measure() covers the width.
if (typeof globalThis.ResizeObserver === "undefined") {
  globalThis.ResizeObserver = class {
    observe() {}
    unobserve() {}
    disconnect() {}
  } as unknown as typeof ResizeObserver;
}

const origRect = HTMLElement.prototype.getBoundingClientRect;
afterEach(() => {
  HTMLElement.prototype.getBoundingClientRect = origRect;
});

const NOW = Date.UTC(2026, 5, 25, 12, 0, 0);
const at = (secsAgo: number) => new Date(NOW - secsAgo * 1000).toISOString();
const pt = (
  id: string,
  band: Band | null,
  secsAgo: number,
  skipCause: SessionTrendPoint["skipCause"] = null,
): SessionTrendPoint => ({ id, band, scored: band !== null, skipCause, capturedAt: at(secsAgo) });

const renderTrend = (points: SessionTrendPoint[], width = 768, foggy = false) => {
  HTMLElement.prototype.getBoundingClientRect = function () {
    return { width, height: 210, top: 0, left: 0, right: width, bottom: 210, x: 0, y: 0, toJSON() {} } as DOMRect;
  };
  return render(
    <SessionTrend sessionId="s1" active={false} load={async () => points} now={() => NOW} showOutOfFrameFoggy={foggy} />,
  );
};

const NO_DIGIT = /[0-9]/;

describe("SessionTrend — fixed-px, true circle (SC-001/SC-002)", () => {
  it("sets svg width === viewBox width with NO preserveAspectRatio stretch (~768px)", async () => {
    renderTrend([pt("a", "at_ease", 20), pt("b", "tense", 0)], 768);
    const svg = await screen.findByTestId("session-trend-svg");
    expect(svg.getAttribute("width")).toBe("768");
    expect(svg.getAttribute("viewBox")).toBe("0 0 768 210");
    expect(svg.getAttribute("preserveAspectRatio")).toBeNull();
  });

  it("holds the matched-pair width at the 360px floor too", async () => {
    renderTrend([pt("a", "at_ease", 20), pt("b", "tense", 0)], 360);
    const svg = await screen.findByTestId("session-trend-svg");
    expect(svg.getAttribute("width")).toBe("360");
    expect(svg.getAttribute("viewBox")).toBe("0 0 360 210");
  });

  it("the now marker is a true <circle> element (1:1, no oval)", async () => {
    renderTrend([pt("a", "at_ease", 10), pt("b", "tense", 0)]);
    const dot = await screen.findByTestId("now-dot");
    expect(dot.tagName.toLowerCase()).toBe("circle");
  });
});

describe("SessionTrend — step-line colour encodes band (SC-003)", () => {
  it("draws coloured segments for a multi-band run", async () => {
    renderTrend([pt("a", "at_ease", 30), pt("b", "at_ease", 20), pt("c", "a_little_tense", 10), pt("d", "tense", 0)]);
    await screen.findByTestId("session-trend-svg");
    const segs = screen.getAllByTestId("trend-seg");
    expect(segs.length).toBeGreaterThanOrEqual(1);
    expect(segs.some((s) => s.getAttribute("stroke") === "var(--color-amber)")).toBe(true);
  });
});

describe("SessionTrend — now marker recolours to the current band (SC-011 live)", () => {
  it("amber on a tense live edge", async () => {
    renderTrend([pt("a", "at_ease", 10), pt("b", "tense", 0)]);
    const dot = await screen.findByTestId("now-dot");
    expect(dot.getAttribute("fill")).toBe("var(--color-amber)");
  });
  it("meadow on an at-ease live edge", async () => {
    renderTrend([pt("a", "tense", 10), pt("b", "at_ease", 0)]);
    const dot = await screen.findByTestId("now-dot");
    expect(dot.getAttribute("fill")).toBe("var(--color-meadow)");
  });
});

describe("SessionTrend — no number anywhere (FR-017)", () => {
  it("renders zero digits in the card text", async () => {
    renderTrend([pt("a", "at_ease", 10), pt("b", "tense", 0)]);
    await screen.findByTestId("session-trend-svg");
    expect(screen.getByTestId("session-trend").textContent ?? "").not.toMatch(NO_DIGIT);
  });
});

describe("SessionTrend — empty (zero trend points, FR-018)", () => {
  it("shows the text-only building state and no svg", async () => {
    renderTrend([]);
    expect(await screen.findByTestId("session-trend-empty")).toBeInTheDocument();
    expect(screen.queryByTestId("session-trend-svg")).toBeNull();
  });
});

// ── US2: the three honest no-read treatments ──────────────────────────────────────────
describe("SessionTrend — US2 warming dashed line (SC-004)", () => {
  it("a leading no-read run renders the dashed muted 'getting a read' line, not a gap", async () => {
    renderTrend([pt("a", null, 30), pt("b", null, 20), pt("c", "at_ease", 0)]);
    await screen.findByTestId("session-trend-svg");
    expect(screen.getByTestId("trend-warming")).toBeInTheDocument();
    expect(screen.getByText("getting a read")).toBeInTheDocument(); // unique to the gap label
  });
});

describe("SessionTrend — US2 foggy gate (SC-004/SC-008/FR-015)", () => {
  const outOfFrame = [
    pt("a", "at_ease", 40),
    pt("b", null, 30, "out-of-frame"),
    pt("c", null, 20, "out-of-frame"),
    pt("d", "at_ease", 0),
  ];

  it("gate OFF (launch): out-of-frame is the MUTED no-clear-read gap — never the foggy copy", async () => {
    renderTrend(outOfFrame); // foggy default OFF
    await screen.findByTestId("session-trend-svg");
    const gap = screen.getByTestId("treatment-no_clear_read");
    expect(within(gap).getByText("no clear read")).toBeInTheDocument();
    expect(screen.queryByTestId("treatment-foggy")).toBeNull();
    expect(screen.queryByText("step back into frame")).toBeNull(); // SC-008
    expect(screen.getAllByTestId("trend-fade").length).toBeGreaterThanOrEqual(2); // fade out + in
  });

  it("gate ON: the same out-of-frame skip renders the FOGGY 'step back into frame' gap", async () => {
    renderTrend(outOfFrame, 768, true);
    await screen.findByTestId("session-trend-svg");
    const foggy = screen.getByTestId("treatment-foggy");
    expect(within(foggy).getByText("step back into frame")).toBeInTheDocument();
  });
});

describe("SessionTrend — US2 no-clear-read gap, never bridged (SC-009)", () => {
  it("a low-light skip between two confident readings shows a muted gap with fade flanks", async () => {
    renderTrend([pt("a", "at_ease", 30), pt("b", "at_ease", 25), pt("c", null, 15, "low-light"), pt("d", "tense", 5), pt("e", "tense", 0)]);
    await screen.findByTestId("session-trend-svg");
    expect(screen.getByTestId("treatment-no_clear_read")).toBeInTheDocument();
    expect(screen.getAllByTestId("trend-fade").length).toBeGreaterThanOrEqual(2);
    // confident runs stay split (before/after the gap) — never one bridging polyline
    const segs = screen.getAllByTestId("trend-seg");
    expect(segs.length).toBeGreaterThanOrEqual(2);
  });
});

describe("SessionTrend — US2 empty vs warming discriminator (FR-018)", () => {
  it("a warming-only session (≥1 point) is NOT the empty text — it shows the warming line", async () => {
    renderTrend([pt("a", null, 10), pt("b", null, 0)]);
    await screen.findByTestId("session-trend-svg");
    expect(screen.queryByTestId("session-trend-empty")).toBeNull();
    expect(screen.getByTestId("trend-warming")).toBeInTheDocument();
  });
});

describe("SessionTrend — US2 legend gating (FR-021)", () => {
  it("gate OFF: two no-read keys (warming up + no clear read), NO foggy key", async () => {
    renderTrend([pt("a", "at_ease", 0)]); // confident-only → only the legend carries these strings
    await screen.findByTestId("session-trend-svg");
    expect(screen.getByText("warming up")).toBeInTheDocument();
    expect(screen.getByText(/no\s+clear read/)).toBeInTheDocument();
    expect(screen.queryByText("stepped out of frame")).toBeNull();
  });
  it("gate ON: the foggy 'stepped out of frame' key appears", async () => {
    renderTrend([pt("a", "at_ease", 0)], 768, true);
    await screen.findByTestId("session-trend-svg");
    expect(screen.getByText("stepped out of frame")).toBeInTheDocument();
  });
});

describe("SessionTrend — US2 no-read label renders at the 360px floor (label-fit watch)", () => {
  it("the muted gap label still renders at 360px (legibility verified visually at the checkpoint)", async () => {
    renderTrend([pt("a", "at_ease", 30), pt("b", null, 15, "low-light"), pt("c", "tense", 0)], 360);
    await screen.findByTestId("session-trend-svg");
    const gap = screen.getByTestId("treatment-no_clear_read");
    expect(within(gap).getByText("no clear read")).toBeInTheDocument();
  });
});

// ── US3 (T025): popup + parked marker + keyboard / reduced-motion a11y + honest subtitle ──

describe("SessionTrend — US3 now-marker popup reveal/dismiss (FR-007 / SC-005)", () => {
  const live = [pt("a", "at_ease", 10), pt("b", "tense", 0)];

  it("appears on focus and hides on blur (keyboard-reachable, NOT hover-only) — SC-005/FR-008", async () => {
    renderTrend(live);
    const marker = await screen.findByTestId("now-marker");
    expect(marker.getAttribute("aria-label")).toMatch(/you are here/i);
    expect(screen.getByTestId("now-tip").getAttribute("data-open")).toBe("false");
    expect(screen.getByTestId("now-tip-text").textContent).toBe("you are here");

    fireEvent.focus(marker);
    expect(screen.getByTestId("now-tip").getAttribute("data-open")).toBe("true");
    fireEvent.blur(marker);
    expect(screen.getByTestId("now-tip").getAttribute("data-open")).toBe("false");
  });

  it("appears on hover and hides on mouse-out", async () => {
    renderTrend(live);
    const marker = await screen.findByTestId("now-marker");
    fireEvent.pointerEnter(marker);
    expect(screen.getByTestId("now-tip").getAttribute("data-open")).toBe("true");
    fireEvent.pointerLeave(marker);
    expect(screen.getByTestId("now-tip").getAttribute("data-open")).toBe("false");
  });

  it("tap TOGGLES — a tap opens it, a second tap on the marker closes it", async () => {
    renderTrend(live);
    const marker = await screen.findByTestId("now-marker");
    fireEvent.click(marker);
    expect(screen.getByTestId("now-tip").getAttribute("data-open")).toBe("true");
    fireEvent.click(marker);
    expect(screen.getByTestId("now-tip").getAttribute("data-open")).toBe("false");
  });

  it("a tap OUTSIDE the marker dismisses a pinned popup", async () => {
    renderTrend(live);
    const marker = await screen.findByTestId("now-marker");
    fireEvent.click(marker); // pin open
    expect(screen.getByTestId("now-tip").getAttribute("data-open")).toBe("true");
    fireEvent.pointerDown(document.body);
    expect(screen.getByTestId("now-tip").getAttribute("data-open")).toBe("false");
  });
});

describe("SessionTrend — US3 live-copy honesty (FR-007 / US3 scenario 8)", () => {
  const liveTense = [pt("a", "at_ease", 20), pt("b", "tense", 0)];
  const parked = [pt("a", "at_ease", 20), pt("b", "tense", 10), pt("c", null, 0, "low-light")];
  const resumed = [pt("a", "at_ease", 20), pt("b", "tense", 10), pt("c", null, 5, "low-light"), pt("d", "at_ease", 0)];
  const trend = (id: string, points: SessionTrendPoint[]) => (
    <SessionTrend sessionId={id} active={false} load={async () => points} now={() => NOW} />
  );

  it("a pinned 'you are here' popup flips to 'last clear read' on repark — and back — WITHOUT re-opening", async () => {
    const { rerender } = renderTrend(liveTense);
    const marker = await screen.findByTestId("now-marker");
    await waitFor(() => expect(screen.getByTestId("now-tip-text").textContent).toBe("you are here"));

    fireEvent.click(marker); // pin the popup open while live
    expect(screen.getByTestId("now-tip").getAttribute("data-open")).toBe("true");

    // live edge becomes an active no-read with a prior confident reading → marker reparks
    rerender(trend("s2", parked));
    await waitFor(() => expect(screen.getByTestId("now-tip-text").textContent).toBe("last clear read"));
    expect(screen.getByTestId("now-marker").getAttribute("data-state")).toBe("parked");
    expect(screen.getByTestId("now-tip").getAttribute("data-open")).toBe("true"); // never re-opened

    // a confident reading returns → copy flips back, still pinned open
    rerender(trend("s3", resumed));
    await waitFor(() => expect(screen.getByTestId("now-tip-text").textContent).toBe("you are here"));
    expect(screen.getByTestId("now-marker").getAttribute("data-state")).toBe("live");
    expect(screen.getByTestId("now-tip").getAttribute("data-open")).toBe("true");
  });
});

describe("SessionTrend — US3 parked marker (FR-004a / SC-011)", () => {
  it("during an active no-read with a prior confident reading: muted + static + 'last clear read'", async () => {
    renderTrend([pt("a", "at_ease", 20), pt("b", "tense", 10), pt("c", null, 0, "low-light")]);
    const marker = await screen.findByTestId("now-marker");
    expect(marker.getAttribute("data-state")).toBe("parked");
    expect(marker.getAttribute("aria-label")).toMatch(/last clear read/i);

    const dot = screen.getByTestId("now-dot");
    expect(dot.getAttribute("fill")).toBe("var(--color-muted)"); // muted, not band-coloured
    expect(screen.queryByTestId("now-halo-static")).toBeNull(); // no halo when parked
    expect(marker.querySelector("animate")).toBeNull(); // static — no pulse

    fireEvent.focus(marker);
    expect(screen.getByTestId("now-tip-text").textContent).toBe("last clear read");
  });

  it("no marker at all when no confident reading has ever occurred (warming) — FR-004b", async () => {
    renderTrend([pt("a", null, 20), pt("b", null, 0)]); // ≥2 warming points, never confident
    await screen.findByTestId("session-trend-svg");
    expect(screen.queryByTestId("now-marker")).toBeNull();
  });
});

describe("SessionTrend — US3 reduced-motion (SC-006 / FR-006)", () => {
  it("a live marker shows a static halo and NO animation node under reduced-motion", async () => {
    const orig = window.matchMedia;
    window.matchMedia = ((q: string) => ({
      matches: q.includes("reduce"),
      media: q,
      onchange: null,
      addEventListener() {},
      removeEventListener() {},
      addListener() {},
      removeListener() {},
      dispatchEvent() {
        return false;
      },
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    })) as any;
    try {
      const { container } = renderTrend([pt("a", "at_ease", 10), pt("b", "tense", 0)]);
      await screen.findByTestId("now-marker");
      expect(screen.getByTestId("now-halo-static")).toBeInTheDocument();
      expect(container.querySelector("animate")).toBeNull();
    } finally {
      window.matchMedia = orig;
    }
  });
});

describe("SessionTrend — US3 touch hit-area ≥44px (T023 / Principle VI)", () => {
  it("the now-marker carries a hit-area radius ≥22 (≥44×44 target)", async () => {
    renderTrend([pt("a", "at_ease", 10), pt("b", "tense", 0)]);
    const hit = await screen.findByTestId("now-hit");
    expect(Number(hit.getAttribute("r"))).toBeGreaterThanOrEqual(22);
  });
});

describe("SessionTrend — US3 honest subtitle (FR-024 / SC-013)", () => {
  const TENSION = /tense|settled|tension/i;

  it("warming → a non-asserting line ('getting a read'), never a tension word", async () => {
    renderTrend([pt("a", null, 20), pt("b", null, 0)]);
    await screen.findByTestId("session-trend-svg");
    const sub = screen.getByTestId("session-trend-subtitle").textContent ?? "";
    expect(sub).toBe("getting a read");
    expect(sub).not.toMatch(TENSION);
  });

  it("active no-read → the neutral 'No clear read right now', never a tension word", async () => {
    renderTrend([pt("a", "at_ease", 20), pt("b", null, 0, "low-light")]);
    await screen.findByTestId("session-trend-svg");
    const sub = screen.getByTestId("session-trend-subtitle").textContent ?? "";
    expect(sub).toBe("No clear read right now");
    expect(sub).not.toMatch(TENSION);
  });
});
