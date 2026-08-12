import { fireEvent, render, screen } from "@testing-library/react";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { afterEach, describe, expect, it } from "vitest";

import {
  ANCHOR_BANNER_DISMISS_KEY,
  RECALIBRATION_PROMPT_DONE_KEY,
  broadcastAnchorCaptured,
} from "@/lib/auth-broadcast";

import { RecalibrationPrompt } from "./recalibration-prompt";

afterEach(() => {
  sessionStorage.clear();
  localStorage.clear();
});

describe("RecalibrationPrompt", () => {
  it("recommends a fresh calibration and offers the way there", () => {
    render(<RecalibrationPrompt />);
    expect(
      screen.getByRole("heading", { name: "Time for a fresh calibration" }),
    ).toBeInTheDocument();
    expect(screen.getByText(/records video a little differently now/i)).toBeInTheDocument();
  });

  it("deep-links to the baseline SECTION of account settings, as a full navigation", () => {
    render(<RecalibrationPrompt />);
    const cta = screen.getByRole("link", { name: "Open baseline settings" });
    // The fragment is the whole point — landing at the top of Account would make the
    // user hunt for the control the prompt just told them to use.
    expect(cta).toHaveAttribute("href", "/app/account#account-baseline-heading");
    expect(cta.tagName).toBe("A"); // full document load, so the fragment scroll applies
  });

  it("the fragment matches the id the baseline section actually renders", () => {
    // A deep link is only as good as the anchor it points at, and nothing else in the
    // type system connects these two files. If someone renames the heading id, this
    // fails here rather than silently degrading to "scrolls to the top of Account".
    const section = readFileSync(
      resolve(process.cwd(), "components/anchor/baseline-section.tsx"),
      "utf8",
    );
    expect(section).toContain('id="account-baseline-heading"');
  });
});

describe("RecalibrationPrompt — persistence", () => {
  it("dismisses for the session and records it on the SHARED banner key", () => {
    render(<RecalibrationPrompt />);
    fireEvent.click(screen.getByRole("button", { name: "Not now" }));
    expect(screen.queryByRole("dialog")).toBeNull();
    // Deliberately the banner's key: the two surfaces are mutually exclusive, so one
    // key carries both and inherits sign-out clearing + cross-tab sync for free.
    expect(sessionStorage.getItem(ANCHOR_BANNER_DISMISS_KEY)).toBe("1");
  });

  it("stays hidden when already dismissed this session", () => {
    sessionStorage.setItem(ANCHOR_BANNER_DISMISS_KEY, "1");
    render(<RecalibrationPrompt />);
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("dismissal does NOT set the permanent latch — it must return next login", () => {
    render(<RecalibrationPrompt />);
    fireEvent.click(screen.getByRole("button", { name: "Not now" }));
    // The whole contract: dismissing is "not now", not "never". Only a capture retires
    // the prompt. If this ever writes the latch, dismissing silently becomes permanent
    // and the user is never asked again.
    expect(localStorage.getItem(RECALIBRATION_PROMPT_DONE_KEY)).toBeNull();
  });

  it("stays hidden permanently once a capture has happened in this browser", () => {
    localStorage.setItem(RECALIBRATION_PROMPT_DONE_KEY, "1");
    render(<RecalibrationPrompt />);
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("is retired by an actual capture, via the real broadcast path", () => {
    // Not a hand-written latch: the capture success path is what must set it.
    broadcastAnchorCaptured();
    render(<RecalibrationPrompt />);
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("survives a session dismissal being cleared, once the capture latch is set", () => {
    localStorage.setItem(RECALIBRATION_PROMPT_DONE_KEY, "1");
    sessionStorage.setItem(ANCHOR_BANNER_DISMISS_KEY, "1");
    sessionStorage.removeItem(ANCHOR_BANNER_DISMISS_KEY); // the sign-out reset
    render(<RecalibrationPrompt />);
    // Sign-out resets the SESSION dismissal but must never resurrect a retired prompt.
    expect(screen.queryByRole("dialog")).toBeNull();
  });
});

describe("RecalibrationPrompt — it is advice, not a gate", () => {
  it("closes on Escape and remembers it", () => {
    render(<RecalibrationPrompt />);
    fireEvent.keyDown(document.body, { key: "Escape", code: "Escape" });
    expect(screen.queryByRole("dialog")).toBeNull();
    // Escape is as deliberate as the button; if it were not recorded the prompt would
    // reappear on the next client render and read as a bug.
    expect(sessionStorage.getItem(ANCHOR_BANNER_DISMISS_KEY)).toBe("1");
  });

  it("keeps a corner dismiss control, unlike the blocking backend-down gate", () => {
    render(<RecalibrationPrompt />);
    expect(screen.getByRole("button", { name: "Close" })).toBeInTheDocument();
  });

  it("keeps Escape and the corner control live — it is not the backend-down gate", () => {
    const source = readFileSync(
      resolve(process.cwd(), "components/anchor/recalibration-prompt.tsx"),
      "utf8",
    );
    // The two the blocking gate suppresses and this must not: a keypress and an
    // explicit control are both deliberate acts, so both stay real exits.
    expect(source).not.toMatch(/onEscapeKeyDown/);
    expect(source).not.toMatch(/hideClose/);
  });

  it("outside-press does NOT dismiss — a stray tap must not spend the showing", () => {
    // Dismissal persists for the whole auth session, so an accidental backdrop
    // touch would silently consume the user's one prompt without them reading it.
    // Below 640px the dialog is edge-to-edge, which makes that tap easy to catch.
    const source = readFileSync(
      resolve(process.cwd(), "components/anchor/recalibration-prompt.tsx"),
      "utf8",
    );
    expect(source).toMatch(/onPointerDownOutside=\{\(event\) => event\.preventDefault\(\)\}/);
    expect(source).toMatch(/onInteractOutside=\{\(event\) => event\.preventDefault\(\)\}/);
  });

  it("opens focus on the dialog itself, never on a control", () => {
    // Measured in a real browser: Radix's default first-tabbable resolution put the
    // focus ring on "Not now", so an unrequested modal drew a ring around its DISMISS
    // action and read as though that were the expected answer. happy-dom does not
    // model :focus-visible or Radix's focus scope faithfully enough to assert the
    // outcome, so this pins the mechanism instead.
    const source = readFileSync(
      resolve(process.cwd(), "components/anchor/recalibration-prompt.tsx"),
      "utf8",
    );
    expect(source).toMatch(/onOpenAutoFocus=\{\(event\) => \{/);
    expect(source).toMatch(/event\.preventDefault\(\)/);
    expect(source).toMatch(/tabIndex=\{-1\}/);
  });
});

describe("RecalibrationPrompt — voice and colour discipline", () => {
  it("is calm: no exclamation marks, no crimson, no amber", () => {
    render(<RecalibrationPrompt />);
    const dialog = screen.getByRole("dialog");
    expect(dialog.textContent).not.toContain("!");
    expect(document.querySelector('[class*="crimson"]')).toBeNull();
    expect(document.querySelector('[class*="amber"]')).toBeNull();
  });

  it("reads as a recommendation — MEADOW, not the attention-foggy of the banner", () => {
    render(<RecalibrationPrompt />);
    const cta = screen.getByRole("link", { name: "Open baseline settings" });
    expect(cta.className).toMatch(/bg-meadow/);
    expect(cta.className).toMatch(/text-on-accent/);
    expect(cta.className).toMatch(/dark:text-bg/);
    // foggy is this codebase's "needs your attention" colour; using it here would
    // dress a recommendation as a problem.
    expect(cta.className).not.toMatch(/bg-foggy/);
  });

  it("never claims the user lost data or that their readings were wrong", () => {
    render(<RecalibrationPrompt />);
    const text = screen.getByRole("dialog").textContent ?? "";
    for (const alarming of [/\blost\b/i, /\bbroken\b/i, /\binvalid\b/i, /\bwrong\b/i, /\berror\b/i, /\binaccurate\b/i]) {
      expect(text).not.toMatch(alarming);
    }
  });

  it("uses the binding terminology and never names the questionnaire", () => {
    render(<RecalibrationPrompt />);
    const text = screen.getByRole("dialog").textContent ?? "";
    expect(text).toMatch(/calibration/i);
    expect(text).toMatch(/monitoring sessions/i);
    // This assertion used to be `not.toMatch(/check-?in/i)`, enforcing the pre-#198 rule
    // that banned a bare "check-in" outright. That rule inverted on 2026-08-12: check-in
    // now MEANS the monitoring session, so the word would be correct here if the prompt
    // used it. What is still wrong is naming the OTHER surface — this dialog is about
    // calibration and the camera sessions it feeds, and the weekly work-environment
    // survey has nothing to do with either.
    expect(text).not.toMatch(/survey|questionnaire/i);
  });

  it("uses typographic punctuation, not ASCII stand-ins", () => {
    render(<RecalibrationPrompt />);
    const text = screen.getByRole("dialog").textContent ?? "";
    expect(text).toContain("—"); // em-dash, never "--"
    expect(text).not.toContain("--");
    expect(text).not.toContain("...");
  });
});
